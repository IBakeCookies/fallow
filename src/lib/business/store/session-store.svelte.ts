import { getContext, setContext, onMount } from 'svelte';
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
import { initializeStorage, readTitleRatings } from '$lib/business/session-history';
import { suggestTitles, type TitleRating } from '$lib/business/model/title-memory';
import { getEffectiveDifficulty, isPinned } from '$lib/business/model/metric/calculation';
import {
	DEFAULT_SWITCH_COST,
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

/**
 * The next task id: monotonic and never recycled. `Date.now()` alone collided
 * for two tasks added in the same millisecond (and the import path used
 * `Date.now() + Math.random()`, putting fractions in a field three observation
 * stores use as their foreign key). Recycling ids is the other trap: `max + 1`
 * over the day's tasks alone would hand a new task the id of a deleted one, and
 * the deleted task's drain logs — measurements outlive their task — would
 * silently re-attach to it.
 *
 * "Never recycled" is within a day: only the viewed day's tasks are in scope, so
 * across days it rests on `Date.now()`, and importing N tasks reserves ids up to
 * now+N−1. Adding a task on another day inside that window could reuse one —
 * harmless, because every observation join is per-date, and no UI reaches two
 * days that fast.
 */
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
	#availableHours = $state<number>(0);
	#switchCost = $state<number>(DEFAULT_SWITCH_COST);
	#cognitivePool = $state<number>(DEFAULT_CAPACITY_POOLS.cognitiveHours);
	#physicalPool = $state<number>(DEFAULT_CAPACITY_POOLS.physicalHours);
	#isLoading = $state(true);
	#yesterdaySession = $state<DailySession | null>(null);
	#routines = $state<SavedRoutine[]>([]);
	#flowObservations = $state<Persisted<FlowObservationRecord>[]>([]);
	// `$state` but not a SvelteMap: it is replaced wholesale when the read lands and
	// never mutated, so tracking the reference is the whole of it. Tracking it at all
	// matters because the read is not awaited — the form is on screen and typed into
	// while it is still in flight, and a plain field would leave a list that had
	// already asked showing nothing until the next keystroke.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- read-only lookup, replaced not mutated
	#titleRatings = $state(new Map<string, TitleRating>());

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

	#activeTasks = $derived(this.#tasks.filter((t) => !t.completed));

	// Capacity pools, sanitized (empty/invalid inputs → 0, i.e. no capacity)
	#pools = $derived({
		cognitiveHours: Math.max(0, Number(this.#cognitivePool) || 0),
		physicalHours: Math.max(0, Number(this.#physicalPool) || 0),
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
				await sessionRepository.$updateSession(session);

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
				const dirty =
					this.#loadedHadSession ||
					this.#tasks.length > 0 ||
					this.#availableHours > 0 ||
					this.#switchCost !== DEFAULT_SWITCH_COST ||
					this.#cognitivePool !== DEFAULT_CAPACITY_POOLS.cognitiveHours ||
					this.#physicalPool !== DEFAULT_CAPACITY_POOLS.physicalHours;

				if (!dirty) return;

				// Snapshot inside the tracked effect, so deep task edits are seen.
				this.#autoSave.schedule({
					date: this.#selectedDate,
					tasks: $state.snapshot(this.#tasks),
					availableHours: this.#availableHours,
					switchCost: this.#switchCost,
					cognitivePool: this.#cognitivePool,
					physicalPool: this.#physicalPool,
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
		try {
			await initializeStorage();
			this.#routines = await this.#readRoutines();
			this.#flowObservations = await this.#readFlowObservations();
			await this.#loadSession(this.#selectedDate);

			// Not awaited: it reads the whole history to prefill a form the user has
			// not opened yet, and the day must not wait on it.
			this.#readTitleRatings();
		} catch (e) {
			logError('Failed to load from IndexedDB', e);
			this.#reporter.report('load-failed');
		} finally {
			this.#isLoading = false;
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

	// What each title was last rated, for the add-task form's suggestions. Its own
	// failure surface: the form falls back to its 5/5/5 defaults, which is what it
	// did before this existed — so a failure is logged and never bannered. The
	// banner's Retry does re-run it, via `#boot`, if it is raised for another read.
	#readTitleRatings() {
		readTitleRatings(this.#today)
			.then((ratings) => (this.#titleRatings = ratings))
			.catch((e) => logError('Failed to load title ratings', e));
	}

	// Routine tasks are imported straight into the live plan, so their numbers
	// get the same keep-and-clamp as session tasks (AGENTS.md R4).
	async #readRoutines(): Promise<SavedRoutine[]> {
		return sanitizeRoutines(await routineRepository.$readAllRoutines());
	}

	/** Re-run the initial read — registered as the banner's retry action. */
	retryLoad() {
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
				this.#cognitivePool = session.cognitivePool ?? DEFAULT_CAPACITY_POOLS.cognitiveHours;
				this.#physicalPool = session.physicalPool ?? DEFAULT_CAPACITY_POOLS.physicalHours;
			} else {
				// No data for this date
				this.#tasks = [];
				this.#availableHours = 0;
				this.#switchCost = DEFAULT_SWITCH_COST;
				this.#cognitivePool = DEFAULT_CAPACITY_POOLS.cognitiveHours;
				this.#physicalPool = DEFAULT_CAPACITY_POOLS.physicalHours;
			}

			this.#loadedHadSession = !!session;
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

	get availableHours() {
		return this.#availableHours;
	}
	set availableHours(v: number) {
		this.#availableHours = v;
	}
	get switchCost() {
		return this.#switchCost;
	}
	set switchCost(v: number) {
		this.#switchCost = v;
	}
	get cognitivePool() {
		return this.#cognitivePool;
	}
	set cognitivePool(v: number) {
		this.#cognitivePool = v;
	}
	get physicalPool() {
		return this.#physicalPool;
	}
	set physicalPool(v: number) {
		this.#physicalPool = v;
	}

	// ----- Task mutations -----

	addTask(taskData: {
		title: string;
		physicalDifficulty: number;
		mentalDifficulty: number;
		enjoyment: number;
		mustDoToday?: boolean;
	}) {
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
				await sessionRepository.$updateSession({
					date: this.#selectedDate,
					tasks: $state.snapshot(this.#tasks),
					availableHours: this.#availableHours,
					switchCost: this.#switchCost,
					cognitivePool: this.#cognitivePool,
					physicalPool: this.#physicalPool,
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
	 * viewed day (AGENTS.md §6). Ordered so the failure mode is a visible
	 * duplicate, never a vanished task: the local removal (persisted by
	 * auto-save) happens only after the destination write lands.
	 */
	async moveTaskToTomorrow(id: number): Promise<boolean> {
		// Same guard as toggleTask: loads are async, so mid-navigation the
		// in-memory tasks still belong to the previous day. Past days are
		// read-only history, and a completed task IS history.
		if (this.#loadedDate !== this.#selectedDate || this.#isViewingPast) return false;

		if (this.#moving) return false;

		const task = this.#tasks.find((t) => t.id === id);

		if (!task || task.completed || isPinned(task)) return false;

		this.#moving = true;

		const tomorrow = addDays(this.#selectedDate, 1);

		try {
			const dest = await this.#readSession(tomorrow);
			const destTasks = dest?.tasks ?? [];

			// Definition and provenance only: a fresh id in the destination day's
			// id space (observation joins are per-date, so the old id keeps its
			// logs here), no `mustDoToday` (a statement about today, not the task)
			// and no `flowMinutes` (a measurement keyed to this date).
			const moved: Task = {
				id: nextTaskId(destTasks),
				title: task.title,
				physicalDifficulty: task.physicalDifficulty,
				mentalDifficulty: task.mentalDifficulty,
				enjoyment: task.enjoyment,
				createdAt: task.createdAt,
				completed: false,
			};

			await sessionRepository.$updateSession({
				date: tomorrow,
				tasks: [moved, ...destTasks],
				availableHours: dest?.availableHours ?? 0,
				switchCost: dest?.switchCost ?? DEFAULT_SWITCH_COST,
				cognitivePool: dest?.cognitivePool ?? DEFAULT_CAPACITY_POOLS.cognitiveHours,
				physicalPool: dest?.physicalPool ?? DEFAULT_CAPACITY_POOLS.physicalHours,
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

			if (tasks.length) {
				this.importTasks(
					tasks.map((t) => ({
						title: t.title,
						physicalDifficulty: t.physicalDifficulty,
						mentalDifficulty: t.mentalDifficulty,
						enjoyment: t.enjoyment,
					})),
				);
			}

			return tasks.length;
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

	importTasks(imported: Omit<Task, 'id' | 'createdAt' | 'completed'>[]) {
		let id = nextTaskId(this.#tasks);

		const newTasks = imported.map((t) => ({
			...t,
			id: id++,
			createdAt: this.#selectedDate,
			completed: false,
		}));

		this.#tasks = [...newTasks, ...this.#tasks];
	}

	// ----- Flow observations (model personalization) -----

	// Log a measured "minutes until flow" for a task: stamps it on the task
	// (shown as the ⚡ badge, persisted with the session) and upserts an
	// (E, β, ϕ) data point that personalizes the model constants — re-logging
	// the same task today REPLACES the earlier measurement (typo correction).
	async logFlow(id: number, minutes: number) {
		const task = this.#tasks.find((t) => t.id === id);

		if (!task) return;

		const difficulty = getEffectiveDifficulty(task);

		try {
			await flowObservationRepository.$updateFlowObservation({
				date: this.#today,
				taskId: id,
				taskTitle: task.title,
				difficulty,
				enjoyment: task.enjoyment,
				E: mapEffort(difficulty),
				beta: mapEnjoyability(task.enjoyment),
				phiHours: minutes / 60,
			});

			this.#flowObservations = await this.#readFlowObservations();

			// Stamp the ⚡ badge only once the write lands, so the UI never shows
			// success for a failed persist.
			this.#tasks = this.#tasks.map((t) =>
				t.id === id
					? {
							...t,
							flowMinutes: minutes,
						}
					: t,
			);
		} catch (e) {
			logError('Failed to save flow observation', e);
			this.#reporter.report('save-failed');
		}
	}

	// Remove one measured data point; the constants refit automatically since
	// they are derived from the observations. Clears today's ⚡ badge if the
	// deleted log belonged to a task in today's session.
	async deleteFlowLog(id: number) {
		const record = this.#flowObservations.find((o) => o.id === id);

		try {
			await flowObservationRepository.$deleteFlowObservation(id);
			this.#flowObservations = await this.#readFlowObservations();

			if (record && record.date === this.#today) {
				this.#tasks = this.#tasks.map((t) =>
					t.id === record.taskId
						? {
								...t,
								flowMinutes: undefined,
							}
						: t,
				);
			}
		} catch (e) {
			logError('Failed to delete flow observation', e);
			this.#reporter.report('save-failed');
		}
	}

	// Delete all measured data points → model reverts to the article defaults.
	async resetFlowLogs() {
		try {
			await flowObservationRepository.$deleteAllFlowObservations();
			this.#flowObservations = [];

			this.#tasks = this.#tasks.map((t) =>
				t.flowMinutes
					? {
							...t,
							flowMinutes: undefined,
						}
					: t,
			);
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
