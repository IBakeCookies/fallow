import { getContext, setContext, onMount } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import type {
	Persisted,
	Task,
	DailySession,
	SavedRoutine,
	FlowObservationRecord,
} from '$lib/data/type';
import { logError } from '$lib/logger';
// Namespace imports: the $-prefixed controller methods can't be imported by
// name inside .svelte.ts files ($ is reserved for runes), but property access
// on a namespace is fine.
import * as sessionRepository from '$lib/data/repository/session-repository';
import * as routineRepository from '$lib/data/repository/routine-repository';
import * as flowObservationRepository from '$lib/data/repository/flow-observation-repository';
import { liveToday } from '$lib/business/state/today.svelte';
import { addDays, daysBetween, isISODate } from '$lib/business/utils/date';
import {
	sanitizeFlowObservations,
	sanitizeRoutines,
	sanitizeSession,
} from '$lib/business/model/persisted';
import { initializeStorage, readHistoryPrefills } from '$lib/business/session-history';
import { suggestTitles, type TitleRating } from '$lib/business/model/title-memory';
import {
	prefillBudgetFor,
	summarizeBudgetHistory,
	type BudgetHistory,
} from '$lib/business/model/budget-memory';
import {
	summarizeDeclaredConstraints,
	type DeclaredConstraints,
} from '$lib/business/model/constraint-memory';
import { getEffectiveDifficulty, isPinned } from '$lib/business/model/metric/calculation';
import {
	summarizeDeferDestination,
	type DeferDestination,
} from '$lib/business/model/metric/defer-destination';
import {
	DEFAULT_CAPACITY_POOLS,
	fitUserConstants,
	mapEffort,
	mapEnjoyability,
} from '$lib/business/model/zenith';
import {
	createDebouncedWrite,
	type DebouncedWrite,
} from '$lib/business/store/debounced-write.svelte';
import type {
	StorageReporter,
	StorageStatusStore,
} from '$lib/business/store/storage-status.svelte';

const CONTEXT_KEY = Symbol();

/**
 * Reads the viewed day out of wherever the app keeps it (the URL, in this app).
 * Injected rather than imported so the store stays free of SvelteKit routing:
 * the caller owns the routing dependency, the store just observes a string.
 * Called inside a `$derived`, so any reactive source it reads is tracked.
 */
export type ReadDateParam = () => string | null;

/** business/AGENTS.md, "Task ids come from `nextTaskId` and nowhere else". */
function nextTaskId(tasks: readonly Task[]): number {
	return Math.max(Date.now(), ...tasks.map((task) => Math.floor(task.id) + 1));
}

/**
 * The daily session as a shared reactive store: tasks, time budget, capacity
 * pools, flow observations, and their IndexedDB persistence. Created once in
 * the (app) layout via context — never at module level, so no state can leak
 * between SSR requests — and consumed by any page that needs live tasks
 * (main page, Energy Lab).
 *
 * Drain and rest measurements live in `EnergyObservationStore`: they key on the
 * live clock rather than the viewed day, so none of the date-routing or
 * auto-save machinery here applies to them.
 */
export class SessionStore {
	// Assigned first thing in the constructor. The `!` is load-bearing: the
	// $derived fields below reference it in their initializers, and those are
	// lazy (never evaluated before the constructor body runs) — but TypeScript
	// checks declaration order, not laziness.
	#readDateParam!: ReadDateParam;
	#reporter!: StorageReporter;

	// ----- Daily session state -----
	#tasks = $state<Task[]>([]);
	// `null` is "this day has no hours of its own yet", which is what keeps a day
	// the user only browsed pristine: the prefill below answers for it, the
	// auto-save's dirty test reads this field, and the first edit assigns a number.
	#availableHours = $state<number | null>(null);
	// The same `null`, for the same reason, three more times: the carry-over below
	// answers for an untouched day (ROADMAP item 32).
	#switchCost = $state<number | null>(null);
	#cognitivePool = $state<number | null>(null);
	#physicalPool = $state<number | null>(null);
	#isLoading = $state(true);
	#yesterdaySession = $state<DailySession | null>(null);
	#routines = $state<SavedRoutine[]>([]);
	#flowObservations = $state<Persisted<FlowObservationRecord>[]>([]);
	// `$state` but not a SvelteMap: it is replaced wholesale when the read lands and
	// never mutated, so tracking the reference is the whole of it. Tracking it at all
	// matters because the banner's Retry lands a second read behind a form that is
	// already on screen, and a plain field would leave a list that had already asked
	// showing nothing until the next keystroke.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- read-only lookup, replaced not mutated
	#titleRatings = $state(new Map<string, TitleRating>());
	#budgetHistory = $state<BudgetHistory>(summarizeBudgetHistory([]));
	#declaredConstraints = $state<DeclaredConstraints>(summarizeDeclaredConstraints([]));

	// Session writes, counted per date. A reading held about a day OTHER than the
	// viewed one cannot key its freshness off that day's inputs — today → tomorrow
	// (edit it) → today reads identically — so it keys off the count for the day it
	// describes (`readDeferDestination`, ROADMAP item 21). Per date and not one
	// counter: today's own auto-save withdrew a reading it cannot have affected.
	#writeGenerations = new SvelteMap<string, number>();

	// Which date the in-memory state belongs to. Loads are async, so this lags
	// selectedDate during navigation — the auto-save guard uses it to avoid
	// persisting one day's tasks under another day's key.
	#loadedDate = $state<string | null>(null);

	// Whether the loaded date already has a persisted session. Auto-save skips
	// pristine days (so merely browsing future dates creates no records) but
	// keeps saving once a session exists (so deleting the last task persists).
	#loadedHadSession = $state(false);

	// Trailing-debounced auto-save, so a burst of edits collapses to one
	// IndexedDB put. Built in the constructor: it registers lifecycle hooks.
	#autoSave!: DebouncedWrite<DailySession>;

	// The URL is the single source of truth for the viewed day: /?date=YYYY-MM-DD
	// for any other day, plain / for today. Routes without a date param (Energy
	// Lab, calendar, …) always view today. Invalid dates fall back to today.
	#today = $derived(liveToday.value);
	#dateParam = $derived(this.#readDateParam());
	#selectedDate = $derived(isISODate(this.#dateParam) ? this.#dateParam : this.#today);

	// Day modes: past is read-only history (completion toggles only), future
	// is a plan you can edit freely; flow logging — an actual measurement —
	// stays today-only.
	#isViewingPast = $derived(this.#selectedDate < this.#today);
	#isViewingFuture = $derived(this.#selectedDate > this.#today);

	// What a day with no hours of its own opens on (ROADMAP item 16). Derived
	// rather than assigned at load, so every later day answers from the one boot
	// fold. A past day gets nothing: a day the user did not plan has no budget, and
	// filling one in would be a claim about their history.
	#prefilledHours = $derived(
		this.#isViewingPast ? 0 : prefillBudgetFor(this.#budgetHistory, this.#selectedDate),
	);

	// Where a defer sends: the one definition, read by the move, by the preview and
	// by the freshness key the preview is held under (AGENTS.md R3).
	#deferDestinationDate = $derived(addDays(this.#selectedDate, 1));

	#activeTasks = $derived(this.#tasks.filter((t) => !t.completed));

	// Capacity pools, sanitized (empty/invalid inputs → 0, i.e. no capacity)
	#pools = $derived({
		cognitiveHours: Math.max(0, Number(this.cognitivePool) || 0),
		physicalHours: Math.max(0, Number(this.physicalPool) || 0),
	});

	// The logs a plan for the viewed day is allowed to read: dated STRICTLY BEFORE
	// it (MATH.md §33). A ⚡ log is a measurement of the day you are executing, and
	// letting it into that day's own fit re-times every task on the page mid-run —
	// against a thin history one log can halve every ϕ, and the allocations move
	// with it. It lands on the next day's plan instead, where a plan changing is
	// what making a plan means. Same filter, two more consequences: a future day
	// previews with today's logs already in it, and a past day reads through the
	// model that day had rather than through today's, read backwards.
	#fittedFlowObservations = $derived(
		this.#flowObservations.filter((o) => o.date < this.#selectedDate),
	);

	/** Logged but not yet counted — dated on or after the planned day. The budget
	 *  bar says so rather than printing a total the fit did not use. */
	#pendingFlowLogCount = $derived(
		this.#flowObservations.length - this.#fittedFlowObservations.length,
	);
	get pendingFlowLogCount() {
		return this.#pendingFlowLogCount;
	}

	// Personalized model constants: ridge least-squares fit of ϕ = c₁E + c₂β + c₃
	// over the logged time-to-flow measurements, anchored to the article's
	// defaults. Every ⚡ log nudges the model; more logs = less anchor. Ages run
	// against the planned day, not the live one — the §5.2 weights are part of
	// "the fit as of day D", so a past day must not have its own logs discounted
	// by however long ago that day was.
	#constantsFit = $derived(
		fitUserConstants(
			this.#fittedFlowObservations.map((o) => ({
				E: o.E,
				beta: o.beta,
				phi: o.phiHours,
				ageDays: daysBetween(o.date, this.#selectedDate),
			})),
		),
	);

	constructor(readDateParam: ReadDateParam, status: StorageStatusStore) {
		this.#readDateParam = readDateParam;

		// A failed read leaves #loadedDate null, which blocks the auto-save guard
		// forever — so this store is one the banner's retry has to cover.
		this.#reporter = status.register('session', () => this.retryLoad());

		this.#autoSave = createDebouncedWrite(
			async (session) => {
				await this.#persistSession(session);

				// Guard: a late flush of a previous date must not mark the currently
				// loaded (possibly pristine) day as having a session.
				if (session.date === this.#loadedDate) this.#loadedHadSession = true;
			},
			(error, session) => {
				logError('Failed to save session', error, {
					date: session.date,
				});

				this.#reporter.report('save-failed');
			},
		);

		onMount(() => {
			this.#boot();
		});

		// Yesterday is relative to the live clock and a tab can stay open across
		// midnight, so re-read it on every rollover rather than caching whichever
		// day the mount happened to see (the "import yesterday" action reads it).
		$effect(() => {
			const yesterday = addDays(this.#today, -1);

			if (this.#isLoading) return;

			this.#readSession(yesterday)
				.then((session) => (this.#yesterdaySession = session))
				// Decoration, not the viewed day: log it rather than raising the
				// banner, whose retry does not cover this read.
				.catch((e) => logError('Failed to load yesterday’s session', e));
		});

		// Reload whenever the viewed date changes, whatever triggered the
		// navigation (nav "Today" link, calendar deep-link, back/forward button,
		// switching to a route without a date param).
		$effect(() => {
			if (!this.#isLoading && this.#selectedDate !== this.#loadedDate) {
				this.#loadSession(this.#selectedDate);
			}
		});

		// Auto-save to IndexedDB for today and future plans (past days save
		// explicitly on toggle). Guards: the in-memory state must actually belong
		// to the viewed date (loads are async), and pristine never-saved days are
		// skipped so browsing ahead creates no empty records.
		$effect(() => {
			if (!this.#isLoading && !this.#isViewingPast && this.#loadedDate === this.#selectedDate) {
				// The RAW field, never the prefill: a day whose hours the user has not
				// touched is pristine, so browsing ahead still creates no records.
				const dirty =
					this.#loadedHadSession ||
					this.#tasks.length > 0 ||
					(this.#availableHours ?? 0) > 0 ||
					this.#switchCost !== null ||
					this.#cognitivePool !== null ||
					this.#physicalPool !== null;

				if (!dirty) return;

				// Snapshot inside the tracked effect, so deep task edits are seen.
				this.#autoSave.schedule({
					date: this.#selectedDate,
					tasks: $state.snapshot(this.#tasks),
					// The effective hours, so a day saved for another reason records
					// the budget it was showing while that happened.
					availableHours: this.availableHours,
					switchCost: this.switchCost,
					cognitivePool: this.cognitivePool,
					physicalPool: this.physicalPool,
					updatedAt: Date.now(),
				});
			}
		});

		// On returning to the tab, re-read the selected date so another tab's
		// writes are picked up. Only when nothing is pending: an edit of ours that
		// has not landed yet would be overwritten by the older stored day. (The
		// hidden half of this — flushing before a discard — is the writer's.)
		$effect(() => {
			const onVisibilityChange = () => {
				if (!document.hidden && !this.#autoSave.pending) this.#loadSession(this.#selectedDate);
			};

			document.addEventListener('visibilitychange', onVisibilityChange);

			return () => document.removeEventListener('visibilitychange', onVisibilityChange);
		});
	}

	// Everything the app needs before it can show a day. Separate from onMount
	// because it is also the retry path: a boot that fails leaves the store
	// unable to load or save anything until it is run again.
	async #boot() {
		this.#booting = true;

		try {
			await initializeStorage();

			// Started here and awaited before the day, so it overlaps the two reads
			// below rather than landing behind the day it feeds: the budget an unseen
			// day opens on is on screen, and the constraints panel snapshots whether
			// that budget is 0 the moment the day lands (ROADMAP item 16).
			const prefills = this.#readHistoryPrefills();

			this.#routines = await this.#readRoutines();
			this.#flowObservations = await this.#readFlowObservations();
			await prefills;
			await this.#loadSession(this.#selectedDate);
		} catch (e) {
			logError('Failed to load from IndexedDB', e);
			this.#reporter.report('load-failed');
		} finally {
			this.#isLoading = false;
			this.#booting = false;
		}
	}

	// Every flow-observation read goes through here: the records feed the ϕ fit,
	// where one corrupt number would make every constant NaN (AGENTS.md R4).
	async #readFlowObservations(): Promise<Persisted<FlowObservationRecord>[]> {
		return sanitizeFlowObservations(await flowObservationRepository.$readAllFlowObservations());
	}

	// Every session read goes through here, so a new read site cannot quietly skip
	// the validation (AGENTS.md R4). A day that fails it reads as absent: the day
	// loads empty, and the next edit overwrites the broken record.
	async #readSession(date: string): Promise<DailySession | null> {
		return sanitizeSession(await sessionRepository.$readSessionByDate(date));
	}

	// Every session write goes through here, so the generation above cannot be
	// forgotten at a new write site.
	async #persistSession(session: DailySession) {
		await sessionRepository.$updateSession(session);
		this.#writeGenerations.set(session.date, this.writeGenerationFor(session.date) + 1);
	}

	/**
	 * The destination day as it stands, with the fallbacks the destination write
	 * uses — ONE definition for the move and for the preview it is shown under
	 * (AGENTS.md R3), so the two can never disagree about the day being sent to.
	 */
	async #readDestination(date: string) {
		const session = await this.#readSession(date);

		return {
			tasks: session?.tasks ?? [],
			// A day this write creates is a day saved for a reason of its own, so it
			// records the hours it will open on — the rule the auto-save payload
			// follows. A 0 here would make the destination a STORED day at 0, which
			// no prefill may speak for (ROADMAP item 16).
			availableHours: session?.availableHours ?? prefillBudgetFor(this.#budgetHistory, date),
			switchCost: session?.switchCost ?? this.#declaredConstraints.switchCost,
			pools: {
				cognitiveHours: session?.cognitivePool ?? this.#declaredConstraints.pools.cognitiveHours,
				physicalHours: session?.physicalPool ?? this.#declaredConstraints.pools.physicalHours,
			},
		};
	}

	/**
	 * What tomorrow already looks like, for the reading the advice card shows over
	 * its defer levers (ROADMAP item 21). Read-only — nothing here touches the
	 * destination record.
	 *
	 * `null` wherever the move would refuse, on the move's own guards: a reading
	 * about a day no button can send to is worse than no reading. A failed read is
	 * `null` too, on `#readHistoryPrefills`' policy — the advice it sits under is
	 * priced on today and still correct, so the line goes and the banner stays down.
	 */
	async readDeferDestination(): Promise<DeferDestination | null> {
		if (this.#loadedDate !== this.#selectedDate || this.#isViewingPast) return null;

		try {
			const destination = await this.#readDestination(this.#deferDestinationDate);

			// Solved under the viewed day's fit: the constants are global, and refitting
			// them for tomorrow (§33 would allow today's ⚡ there) is a second window
			// definition for a reading that reports counts.
			return summarizeDeferDestination({
				...destination,
				constants: this.#constantsFit.constants,
				posterior: this.#constantsFit.posterior,
			});
		} catch (e) {
			logError('Failed to read the defer destination', e, {
				date: this.#selectedDate,
			});

			return null;
		}
	}

	// What each title was last rated and what each weekday is usually budgeted.
	// Its own failure surface: the form falls back to its 5/5/5 defaults and the
	// day to 0 hours, which is what both did before this existed — so a failure is
	// logged and never bannered, and the caught chain is what lets `#boot` await
	// this without a failed prefill taking the day down with it. The banner's
	// Retry does re-run it, via `#boot`, if it is raised for another read.
	#readHistoryPrefills(): Promise<void> {
		return readHistoryPrefills(this.#today)
			.then((prefills) => {
				this.#titleRatings = prefills.titleRatings;
				this.#budgetHistory = prefills.budgets;
				this.#declaredConstraints = prefills.constraints;
			})
			.catch((e) => logError('Failed to load history prefills', e));
	}

	// Routine tasks are imported straight into the live plan, so their numbers
	// get the same keep-and-clamp as session tasks (AGENTS.md R4).
	async #readRoutines(): Promise<SavedRoutine[]> {
		return sanitizeRoutines(await routineRepository.$readAllRoutines());
	}

	// Serializes #boot: a double-press would interleave two boots over the same
	// state. Not $state — nothing renders it.
	#booting = false;

	/**
	 * Re-run the initial read — registered as the banner's retry action. Back to
	 * loading while it runs, so the stale day on screen is not read as loaded.
	 */
	retryLoad() {
		if (this.#booting) return;

		this.#isLoading = true;
		this.#boot();
	}

	/** Rated titles a part-typed one could be naming; empty until it is a query. */
	suggestTitles(query: string): TitleRating[] {
		return suggestTitles(this.#titleRatings, query);
	}

	async #loadSession(date: string) {
		// A pending debounced save may belong to the previous date — flush before
		// loading so a quick date switch can't drop the edit (the payload carries
		// its own date, so a late flush is always safe).
		this.#autoSave.flush();

		try {
			const session = await this.#readSession(date);

			if (date !== this.#selectedDate) return; // navigated again mid-load

			if (session) {
				this.#tasks = session.tasks;
				this.#availableHours = session.availableHours;
				this.#switchCost = session.switchCost;
				// Absent pools on a stored day are the constants it ran with, never `null`
				// (business/AGENTS.md, "a stored day keeps its own").
				this.#cognitivePool = session.cognitivePool ?? DEFAULT_CAPACITY_POOLS.cognitiveHours;
				this.#physicalPool = session.physicalPool ?? DEFAULT_CAPACITY_POOLS.physicalHours;
			} else {
				// No data for this date: nothing here is answered, so the day shows what
				// its weekday usually gets and how the last stored day worked, until the
				// user says otherwise.
				this.#tasks = [];
				this.#availableHours = null;
				this.#switchCost = null;
				this.#cognitivePool = null;
				this.#physicalPool = null;
			}

			this.#loadedHadSession = Boolean(session);
			this.#loadedDate = date;

			// Reading again worked, so the day is no longer unreachable — this is
			// what makes a load failure recover on the next date change too.
			this.#reporter.clearLoadFailure();
		} catch (e) {
			logError('Failed to load session', e, {
				date,
			});

			this.#reporter.report('load-failed');
		}
	}

	// ----- Read access -----

	get tasks() {
		return this.#tasks;
	}
	get activeTasks() {
		return this.#activeTasks;
	}
	get isLoading() {
		return this.#isLoading;
	}
	get today() {
		return this.#today;
	}
	get selectedDate() {
		return this.#selectedDate;
	}
	/** Which day the in-memory values belong to — lags `selectedDate` while a day
	 *  loads, so it is the signal for "these hours describe this day". */
	get loadedDate() {
		return this.#loadedDate;
	}
	/** The day a defer sends to — `readDeferDestination`'s subject, and what the
	 *  reading's holder keys its freshness on. */
	get deferDestinationDate() {
		return this.#deferDestinationDate;
	}
	/** How many session records have been written for `date` — the freshness key for
	 *  a reading about a day other than the viewed one (`readDeferDestination`). */
	writeGenerationFor(date: string): number {
		return this.#writeGenerations.get(date) ?? 0;
	}
	get isViewingPast() {
		return this.#isViewingPast;
	}
	get isViewingFuture() {
		return this.#isViewingFuture;
	}
	get yesterdaySession() {
		return this.#yesterdaySession;
	}
	get routines() {
		return this.#routines;
	}
	get flowObservations() {
		return this.#flowObservations;
	}
	get pools() {
		return this.#pools;
	}
	get constantsFit() {
		return this.#constantsFit;
	}
	get userConstants() {
		return this.#constantsFit.constants;
	}

	// ----- Budget scalars (settable so inputs can two-way bind) -----

	/** The day's hours: the user's own where there are any, the weekday's usual
	 *  reading where the day has none (ROADMAP item 16). */
	/**
	 * What one of the four constraint fields holds after the user sets it: `null`
	 * while it still says what it was already showing. `NumberInput` reports on blur
	 * whether or not the value moved, so without this a tab through the panel
	 * declares the day and stores it — the phantom session the prefill's `null`
	 * exists to prevent (business/AGENTS.md).
	 */
	#declare(value: number, prefilled: number): number | null {
		return value === prefilled ? null : value;
	}

	get availableHours() {
		return this.#availableHours ?? this.#prefilledHours;
	}
	set availableHours(v: number) {
		this.#availableHours = this.#declare(v, this.#prefilledHours);
	}
	get switchCost() {
		return this.#switchCost ?? this.#declaredConstraints.switchCost;
	}
	set switchCost(v: number) {
		this.#switchCost = this.#declare(v, this.#declaredConstraints.switchCost);
	}
	get cognitivePool() {
		return this.#cognitivePool ?? this.#declaredConstraints.pools.cognitiveHours;
	}
	set cognitivePool(v: number) {
		this.#cognitivePool = this.#declare(v, this.#declaredConstraints.pools.cognitiveHours);
	}
	get physicalPool() {
		return this.#physicalPool ?? this.#declaredConstraints.pools.physicalHours;
	}
	set physicalPool(v: number) {
		this.#physicalPool = this.#declare(v, this.#declaredConstraints.pools.physicalHours);
	}

	// ----- Task mutations -----

	// Structural edits are today-and-future only (the invariant `toggleTask`
	// documents), and mid-navigation the in-memory tasks still belong to the
	// previous day.
	get #canEditPlan() {
		return this.#loadedDate === this.#selectedDate && !this.#isViewingPast;
	}

	addTask(taskData: {
		title: string;
		physicalDifficulty: number;
		mentalDifficulty: number;
		enjoyment: number;
		mustDoToday?: boolean;
	}) {
		if (!this.#canEditPlan) return;

		this.#tasks = [
			{
				id: nextTaskId(this.#tasks),
				...taskData,
				createdAt: this.#selectedDate,
				completed: false,
			},
			...this.#tasks,
		];
	}

	// Completion can be toggled on ANY day — forgetting to check a task off
	// before midnight shouldn't falsify history. Structural edits (add/edit/
	// remove) work on today and future plans; past days stay read-only:
	// those rewrite the plan, this records the truth.
	async toggleTask(id: number) {
		// Same guard as the auto-save effect: loads are async, so mid-navigation
		// the in-memory tasks still belong to the previous day and writing them
		// under #selectedDate would overwrite the incoming day with them.
		if (this.#loadedDate !== this.#selectedDate) return;

		this.#tasks = this.#tasks.map((t) =>
			t.id === id
				? {
						...t,
						completed: !t.completed,
					}
				: t,
		);

		// The auto-save $effect doesn't persist past sessions, so historical
		// toggles are saved explicitly under the viewed date.
		if (this.#isViewingPast) {
			try {
				await this.#persistSession({
					date: this.#selectedDate,
					tasks: $state.snapshot(this.#tasks),
					availableHours: this.availableHours,
					switchCost: this.switchCost,
					cognitivePool: this.cognitivePool,
					physicalPool: this.physicalPool,
					updatedAt: Date.now(),
				});
			} catch (e) {
				logError('Failed to save completion change', e, {
					date: this.#selectedDate,
				});

				this.#reporter.report('save-failed');
			}
		}
	}

	/**
	 * Remove a task and hand back the way to put it back — the ✕ deletes at once and
	 * the page offers an undo for as long as its toast lives (`removeTaskWithUndo`).
	 * The undo is a closure because only the store knows what restoring means: the
	 * row's position, and the day it was removed from.
	 */
	removeTask(id: number): { task: Task; undo: () => void } | undefined {
		if (!this.#canEditPlan) return undefined;

		const index = this.#tasks.findIndex((t) => t.id === id);

		if (index === -1) return undefined;

		const task = this.#tasks[index];
		const date = this.#selectedDate;

		this.#tasks = this.#tasks.filter((t) => t.id !== id);

		return {
			task,
			undo: () => {
				// Same guard as toggleTask, and the undo is what makes it reachable
				// without a race: a toast outlives a click on another day, and putting
				// the task back into the tasks on screen would autosave it into that
				// day instead — or into the day whose load has not landed yet.
				if (this.#loadedDate !== this.#selectedDate || this.#selectedDate !== date) return;

				// Its original id: `nextTaskId` is monotonic, so a task added in between
				// cannot have taken it, and the drain log that outlives a task
				// re-attaches to the row that produced it.
				this.#tasks = [...this.#tasks.slice(0, index), task, ...this.#tasks.slice(index)];
			},
		};
	}

	// Serializes moveTaskToTomorrow: two overlapping moves would each
	// read-modify-write tomorrow's record and the second would drop the first's
	// task. Not $state — nothing renders it.
	#moving = false;

	/**
	 * Move one active task to tomorrow's plan: append it there, then drop it
	 * here. The destination write is a read-modify-write against tomorrow's
	 * stored session — the only write in this store that does not target the
	 * viewed day (business/AGENTS.md). Ordered so the failure mode is a visible
	 * duplicate, never a vanished task: the local removal (persisted by
	 * auto-save) happens only after the destination write lands.
	 */
	async moveTaskToTomorrow(id: number): Promise<boolean> {
		if (!this.#canEditPlan) return false;

		if (this.#moving) return false;

		const task = this.#tasks.find((t) => t.id === id);

		// A completed task IS history, on the same footing as the past days
		// `#canEditPlan` refuses.
		if (!task || task.completed || isPinned(task)) return false;

		this.#moving = true;

		const tomorrow = this.#deferDestinationDate;

		try {
			const dest = await this.#readDestination(tomorrow);

			// Definition and provenance only: a fresh id in the destination day's
			// id space (observation joins are per-date, so the old id keeps its ⚡ and
			// 🪫 here — the measurements stay with the day that took them) and no
			// `mustDoToday`, a statement about today rather than about the task.
			const moved: Task = {
				id: nextTaskId(dest.tasks),
				title: task.title,
				physicalDifficulty: task.physicalDifficulty,
				mentalDifficulty: task.mentalDifficulty,
				enjoyment: task.enjoyment,
				createdAt: task.createdAt,
				completed: false,
			};

			await this.#persistSession({
				date: tomorrow,
				tasks: [moved, ...dest.tasks],
				availableHours: dest.availableHours,
				switchCost: dest.switchCost,
				cognitivePool: dest.pools.cognitiveHours,
				physicalPool: dest.pools.physicalHours,
				updatedAt: Date.now(),
			});

			this.#tasks = this.#tasks.filter((t) => t.id !== id);

			return true;
		} catch (e) {
			logError('Failed to move task to tomorrow', e, {
				date: this.#selectedDate,
			});

			this.#reporter.report('save-failed');

			return false;
		} finally {
			this.#moving = false;
		}
	}

	updateTask(
		id: number,
		changes: Partial<
			Pick<Task, 'title' | 'physicalDifficulty' | 'mentalDifficulty' | 'enjoyment' | 'mustDoToday'>
		>,
	) {
		if (!this.#canEditPlan) return;

		this.#tasks = this.#tasks.map((t) =>
			t.id === id
				? {
						...t,
						...changes,
					}
				: t,
		);
	}

	// Import a specific day's tasks (stripped to their definition) into the
	// viewed day. Returns the imported count so the UI can react to empty days.
	async importFromDate(date: string): Promise<number> {
		try {
			const session = await this.#readSession(date);
			const tasks = session?.tasks ?? [];

			// The count the header reports is what actually landed, not what was read:
			// the await above outlives a date change, and `importTasks` then refuses.
			return this.importTasks(
				tasks.map((t) => ({
					title: t.title,
					physicalDifficulty: t.physicalDifficulty,
					mentalDifficulty: t.mentalDifficulty,
					enjoyment: t.enjoyment,
				})),
			);
		} catch (e) {
			logError('Failed to load session for import', e, {
				date,
			});

			// 0 makes the header say "No tasks on that date", which is a claim about
			// the user's data that this failure cannot support. A failed read is
			// retryable, so raise the banner and let the count stay 0.
			this.#reporter.report('load-failed');

			return 0;
		}
	}

	/** Returns how many landed, so a caller reporting a count reports the truth. */
	importTasks(imported: Omit<Task, 'id' | 'createdAt' | 'completed'>[]): number {
		if (!this.#canEditPlan) return 0;

		let id = nextTaskId(this.#tasks);

		const newTasks = imported.map((t) => ({
			...t,
			id: id++,
			createdAt: this.#selectedDate,
			completed: false,
		}));

		this.#tasks = [...newTasks, ...this.#tasks];

		return newTasks.length;
	}

	// ----- Flow observations (model personalization) -----

	/** One task's ⚡ measurement for a day, or undefined. One per (task, date) by
	 *  construction — `$createOrUpdateFlowObservation` upserts on that key. */
	#flowLogFor(taskId: number, date: string) {
		return this.#flowObservations.find((o) => o.taskId === taskId && o.date === date);
	}

	/**
	 * One day's ⚡ readings in MINUTES, per task — what the row's badge shows and
	 * what its editor opens on. Minutes rather than `phiHours` because minutes is
	 * the unit the measurement is taken and shown in; hours is the fit's (MATH.md
	 * §2), and this converts between them the way `logFlow`'s `minutes / 60` does
	 * backwards — the only two places either direction is spelled.
	 *
	 * Takes the day for the reason `drainLogsOn` does: the main page renders any
	 * date, and a row must show the measurement of the day it is showing.
	 *
	 * A plain `Map`, not a `SvelteMap`: rebuilt on every read from `$state`
	 * observations, so the reactivity is already the array's.
	 */
	flowMinutesOn(date: string): ReadonlyMap<number, number> {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- derived, never mutated
		const byTask = new Map<number, number>();

		for (const log of this.#flowObservations) {
			if (log.date !== date) continue;

			byTask.set(log.taskId, Math.round(log.phiHours * 60));
		}

		return byTask;
	}

	// Log a measured "minutes until flow" for a task: upserts an (E, β, ϕ) data
	// point that personalizes the model constants, keyed by (task, date), which
	// is also the ⚡ badge the row reads back. Re-logging the same task on the
	// same day REPLACES the earlier measurement (typo correction).
	//
	// Stamped with the VIEWED day, not the live clock, and today is the only day
	// a FIRST measurement may land on: a correction re-describes a measurement
	// that exists, while a first one on a past day is a measurement nobody took.
	// The guard is here rather than only in the UI because the date is the store's.
	async logFlow(id: number, minutes: number) {
		// Same guard as toggleTask: mid-navigation the task, its title and its
		// covariates are the previous day's, and the record stamps #selectedDate.
		if (this.#loadedDate !== this.#selectedDate) return;

		const task = this.#tasks.find((t) => t.id === id);

		if (!task) return;

		const date = this.#selectedDate;
		const existing = this.#flowLogFor(id, date);

		if (date !== this.#today && !existing) return;

		// A CORRECTION keeps what the record froze; only a first measurement derives it.
		// The rule is about the correction and not the address it arrived by (MATH.md §36),
		// so the row obeys it as much as `editFlowLog` does: the covariates were captured
		// when the measurement was taken, and re-deriving them here would let a difficulty
		// raised on Friday re-price what Monday measured — including on a save that changes
		// nothing but re-submits the same number.
		const measured = existing ?? {
			taskTitle: task.title,
			difficulty: getEffectiveDifficulty(task),
			enjoyment: task.enjoyment,
			E: mapEffort(getEffectiveDifficulty(task)),
			beta: mapEnjoyability(task.enjoyment),
		};

		try {
			await flowObservationRepository.$createOrUpdateFlowObservation({
				date,
				taskId: id,
				taskTitle: measured.taskTitle,
				difficulty: measured.difficulty,
				enjoyment: measured.enjoyment,
				E: measured.E,
				beta: measured.beta,
				phiHours: minutes / 60,
			});

			// The re-read IS the badge: it lands only once the write did, so the row
			// never shows success for a failed persist.
			this.#flowObservations = await this.#readFlowObservations();
		} catch (e) {
			logError('Failed to save flow observation', e);
			this.#reporter.report('save-failed');
		}
	}

	// Correct one measurement by its RECORD rather than by its row (2026-08-10). The
	// analytics history shows every day at once and therefore views none of them, so it
	// has neither a viewed day to stamp nor that day's task to read — and needs neither,
	// because a correction rewrites only what the user measured (MATH.md §36).
	//
	// Through the repository's edit-by-id and NOT through `logFlow`'s upsert with the
	// record spread back in: those differ exactly when the record has been deleted since
	// the list read it, where the upsert's not-found branch would re-insert it with a
	// fresh stamp. `$updateFlowObservation` no-ops instead.
	async editFlowLog(recordId: number, minutes: number) {
		try {
			await flowObservationRepository.$updateFlowObservation(recordId, {
				phiHours: minutes / 60,
			});

			this.#flowObservations = await this.#readFlowObservations();
		} catch (e) {
			logError('Failed to save flow observation', e);
			this.#reporter.report('save-failed');
		}
	}

	// Remove one measured data point; the constants refit automatically since
	// they are derived from the observations, and so does the ⚡ badge of whatever
	// day it belonged to.
	//
	// Hands back the way to put it back, as `removeTask` does: the list's ✕ drops the
	// measurement at once and offers an undo for as long as its toast lives
	// (`removeLogWithUndo`). A closure, because only the store knows what restoring
	// means — the whole record under the id and stamp it was dropped with, a re-log
	// being a second measurement rather than the same one (MATH.md §36).
	//
	// Nothing to offer back in two cases, and `undefined` says so for both: a record
	// this store does not hold (a second click on a ✕ whose row is already gone, which
	// must not delete blind either), and a delete that failed — the record is still
	// there, and the banner already says the write did not land.
	async deleteFlowLog(id: number): Promise<(() => Promise<void>) | undefined> {
		const dropped = this.#flowObservations.find((observation) => observation.id === id);

		if (!dropped) return undefined;

		// Snapshotted before the delete, for the reason every write out of a store's
		// state is: what reaches IndexedDB must be a plain record, not a proxy.
		const record = $state.snapshot(dropped);

		try {
			await flowObservationRepository.$deleteFlowObservation(id);
			this.#flowObservations = await this.#readFlowObservations();
		} catch (e) {
			logError('Failed to delete flow observation', e);
			this.#reporter.report('save-failed');

			return undefined;
		}

		return () => this.#restoreFlowLog(record);
	}

	async #restoreFlowLog(record: Persisted<FlowObservationRecord>) {
		try {
			await flowObservationRepository.$restoreFlowObservation(record);
			this.#flowObservations = await this.#readFlowObservations();
		} catch (e) {
			logError('Failed to restore flow observation', e);
			this.#reporter.report('save-failed');
		}
	}

	// Drop the ⚡ measurement a row is showing. The same delete as above, addressed
	// the way a row can address it — by its task — since the row has no record id and
	// (taskId, date) is what the log is keyed by anyway. The VIEWED day's, for the
	// reason logFlow gives: the reading a past row shows is that day's observation,
	// and dropping what is on screen is the one thing every row can do.
	//
	// The undo comes back out with it, on the same contract: the address a drop arrived
	// by is no reason for it to be reversible on one screen and permanent on the other.
	async clearFlowLog(id: number): Promise<(() => Promise<void>) | undefined> {
		const record = this.#flowLogFor(id, this.#selectedDate);

		if (!record) return undefined;

		return this.deleteFlowLog(record.id);
	}

	// Delete all measured data points → model reverts to the article defaults.
	async resetFlowLogs() {
		try {
			await flowObservationRepository.$deleteAllFlowObservations();
			this.#flowObservations = [];
		} catch (e) {
			logError('Failed to reset flow observations', e);
			this.#reporter.report('save-failed');
		}
	}

	// ----- Routines -----

	async saveCurrentAsRoutine(name: string) {
		const routine: SavedRoutine = {
			id: `routine-${Date.now()}`,
			name,
			tasks: this.#tasks.map((t) => ({
				title: t.title,
				physicalDifficulty: t.physicalDifficulty,
				mentalDifficulty: t.mentalDifficulty,
				enjoyment: t.enjoyment,
			})),
			createdAt: Date.now(),
		};

		try {
			await routineRepository.$updateRoutine(routine);
			this.#routines = await this.#readRoutines();
		} catch (e) {
			logError('Failed to save routine', e);
			this.#reporter.report('save-failed');
		}
	}

	async deleteRoutine(id: string) {
		try {
			await routineRepository.$deleteRoutine(id);
			this.#routines = await this.#readRoutines();
		} catch (e) {
			logError('Failed to delete routine', e);
			this.#reporter.report('save-failed');
		}
	}
}

export function setSessionStore(
	readDateParam: ReadDateParam,
	status: StorageStatusStore,
): SessionStore {
	return setContext<SessionStore>(CONTEXT_KEY, new SessionStore(readDateParam, status));
}

export function getSessionStore(): SessionStore {
	return getContext<SessionStore>(CONTEXT_KEY);
}
