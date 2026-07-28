import { getContext, setContext, onMount, onDestroy } from 'svelte';
import { browser } from '$app/environment';
import type { Task, DailySession, SavedRoutine, FlowObservationRecord } from '$lib/data/type';
import { logError } from '$lib/logger';
// Namespace imports: the $-prefixed controller methods can't be imported by
// name inside .svelte.ts files ($ is reserved for runes), but property access
// on a namespace is fine.
import * as sessionRepository from '$lib/data/repository/session-repository';
import * as routineRepository from '$lib/data/repository/routine-repository';
import * as flowObservationRepository from '$lib/data/repository/flow-observation-repository';
import { liveToday } from '$lib/business/state/today.svelte';
import { addDays } from '$lib/business/utils/date';
import { initializeStorage } from '$lib/business/store/session-history';
import { getEffectiveDifficulty } from '$lib/business/model/metric/calculation';
import {
	DEFAULT_SWITCH_COST,
	DEFAULT_CAPACITY_POOLS,
	fitUserConstants,
	mapEffort,
	mapEnjoyability,
} from '$lib/business/model/zenith';

const CONTEXT_KEY = Symbol();

/**
 * Reads the viewed day out of wherever the app keeps it (the URL, in this app).
 * Injected rather than imported so the store stays free of SvelteKit routing:
 * the caller owns the routing dependency, the store just observes a string.
 * Called inside a `$derived`, so any reactive source it reads is tracked.
 */
export type ReadDateParam = () => string | null;

/**
 * A storage failure the app-wide banner can show. 'load-failed' is the
 * recoverable one; 'save-failed' has already lost the edit.
 */
export type StorageErrorKind = 'save-failed' | 'load-failed';

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

	// ----- Daily session state -----
	#tasks = $state<Task[]>([]);
	#availableHours = $state<number>(0);
	#switchCost = $state<number>(DEFAULT_SWITCH_COST);
	#cognitivePool = $state<number>(DEFAULT_CAPACITY_POOLS.cognitiveHours);
	#physicalPool = $state<number>(DEFAULT_CAPACITY_POOLS.physicalHours);
	#isLoading = $state(true);
	#yesterdaySession = $state<DailySession | null>(null);
	#routines = $state<SavedRoutine[]>([]);
	#flowObservations = $state<FlowObservationRecord[]>([]);

	// Which date the in-memory state belongs to. Loads are async, so this lags
	// selectedDate during navigation — the auto-save guard uses it to avoid
	// persisting one day's tasks under another day's key.
	#loadedDate = $state<string | null>(null);

	// Whether the loaded date already has a persisted session. Auto-save skips
	// pristine days (so merely browsing future dates creates no records) but
	// keeps saving once a session exists (so deleting the last task persists).
	#loadedHadSession = $state(false);

	// A storage failure the UI should surface. Machine value; the layout resolves
	// it to a localized banner. 'load-failed' is the recoverable one — a failed
	// read leaves #loadedDate null, which blocks the auto-save guard forever, so
	// the banner offers retryLoad(). Cleared by clearStorageError.
	#storageError = $state<StorageErrorKind | null>(null);

	// Trailing-debounced auto-save: the effect captures a snapshot into
	// #pendingSave and (re)arms #saveTimer, so a burst of edits collapses to one
	// IndexedDB put; the write is flushed early when the tab is hidden.
	#pendingSave: DailySession | null = null;
	#saveTimer: ReturnType<typeof setTimeout> | undefined;

	// The URL is the single source of truth for the viewed day: /?date=YYYY-MM-DD
	// for any other day, plain / for today. Routes without a date param (Energy
	// Lab, calendar, …) always view today. Invalid dates fall back to today.
	#today = $derived(liveToday.value);
	#dateParam = $derived(this.#readDateParam());
	#selectedDate = $derived(
		this.#dateParam && /^\d{4}-\d{2}-\d{2}$/.test(this.#dateParam) ? this.#dateParam : this.#today,
	);

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

	// Personalized model constants: ridge least-squares fit of ϕ = c₁E + c₂β + c₃
	// over the logged time-to-flow measurements, anchored to the article's
	// defaults. Every ⚡ log nudges the model; more logs = less anchor.
	#constantsFit = $derived(
		fitUserConstants(
			this.#flowObservations.map((o) => ({
				E: o.E,
				beta: o.beta,
				phi: o.phiHours,
			})),
		),
	);

	constructor(readDateParam: ReadDateParam) {
		this.#readDateParam = readDateParam;

		onMount(() => {
			this.#boot();
		});

		// Yesterday is relative to the live clock and a tab can stay open across
		// midnight, so re-read it on every rollover rather than caching whichever
		// day the mount happened to see (the "import yesterday" action reads it).
		$effect(() => {
			const yesterday = addDays(this.#today, -1);

			if (!browser || this.#isLoading) return;

			sessionRepository
				.$readSessionByDate(yesterday)
				.then((session) => (this.#yesterdaySession = session))
				// Decoration, not the viewed day: log it rather than raising the
				// banner, whose retry does not cover this read.
				.catch((e) => logError('Failed to load yesterday’s session', e));
		});

		// Reload whenever the viewed date changes, whatever triggered the
		// navigation (nav "Today" link, calendar deep-link, back/forward button,
		// switching to a route without a date param).
		$effect(() => {
			if (browser && !this.#isLoading && this.#selectedDate !== this.#loadedDate) {
				this.#loadSession(this.#selectedDate);
			}
		});

		// Auto-save to IndexedDB for today and future plans (past days save
		// explicitly on toggle). Guards: the in-memory state must actually belong
		// to the viewed date (loads are async), and pristine never-saved days are
		// skipped so browsing ahead creates no empty records. The put is debounced
		// (trailing 500ms) so typing a budget doesn't fire a put per keystroke.
		$effect(() => {
			if (
				browser &&
				!this.#isLoading &&
				!this.#isViewingPast &&
				this.#loadedDate === this.#selectedDate
			) {
				const dirty =
					this.#loadedHadSession ||
					this.#tasks.length > 0 ||
					this.#availableHours > 0 ||
					this.#switchCost !== DEFAULT_SWITCH_COST ||
					this.#cognitivePool !== DEFAULT_CAPACITY_POOLS.cognitiveHours ||
					this.#physicalPool !== DEFAULT_CAPACITY_POOLS.physicalHours;

				if (!dirty) return;

				// Snapshot inside the tracked effect (so deep task edits are seen),
				// then persist on a trailing debounce.
				this.#pendingSave = {
					date: this.#selectedDate,
					tasks: $state.snapshot(this.#tasks),
					availableHours: this.#availableHours,
					switchCost: this.#switchCost,
					cognitivePool: this.#cognitivePool,
					physicalPool: this.#physicalPool,
					updatedAt: Date.now(),
				};

				clearTimeout(this.#saveTimer);
				this.#saveTimer = setTimeout(() => this.#flushSave(), 500);
			}
		});

		// The effect's own teardown can't do this: it also runs before every
		// re-run, so flushing there would defeat the debounce. Destroy is not
		// rare — the (app) layout re-keys its subtree on a locale switch.
		onDestroy(() => this.#flushSave());

		// Flush the pending write the instant the tab is hidden (the debounce may
		// not fire before a discard), and on returning re-read the selected date
		// so another tab's writes are picked up. Re-reading only when nothing is
		// pending is safe: a hidden tab can't be mid-edit, so no ping-pong.
		$effect(() => {
			if (!browser) return;

			const onVisibility = () => {
				if (document.hidden) this.#flushSave();
				else if (!this.#pendingSave) this.#loadSession(this.#selectedDate);
			};

			document.addEventListener('visibilitychange', onVisibility);

			return () => document.removeEventListener('visibilitychange', onVisibility);
		});
	}

	// Everything the app needs before it can show a day. Separate from onMount
	// because it is also the retry path: a boot that fails leaves the store
	// unable to load or save anything until it is run again.
	async #boot() {
		try {
			await initializeStorage();
			this.#routines = await routineRepository.$readAllRoutines();
			this.#flowObservations = await flowObservationRepository.$readAllFlowObservations();
			await this.#loadSession(this.#selectedDate);
		} catch (e) {
			logError('Failed to load from IndexedDB', e);
			this.#storageError = 'load-failed';
		} finally {
			this.#isLoading = false;
		}
	}

	/** Re-run the initial read — the banner's action after a failed load. */
	retryLoad() {
		this.#storageError = null;
		this.#boot();
	}

	// Persist the pending snapshot now, cancelling any scheduled debounce.
	#flushSave() {
		if (!this.#pendingSave) return;

		clearTimeout(this.#saveTimer);
		const payload = this.#pendingSave;
		this.#pendingSave = null;

		sessionRepository
			.$updateSession(payload)
			// guard: a late flush of a previous date must not mark the currently
			// loaded (possibly pristine) day as having a session
			.then(() => {
				if (payload.date === this.#loadedDate) this.#loadedHadSession = true;
			})
			.catch((e) => {
				logError('Failed to save session', e, {
					date: payload.date,
				});

				this.#storageError = 'save-failed';
			});
	}

	async #loadSession(date: string) {
		// A pending debounced save may belong to the previous date — flush before
		// loading so a quick date switch can't drop the edit (the payload carries
		// its own date, so a late flush is always safe).
		this.#flushSave();

		try {
			const session = await sessionRepository.$readSessionByDate(date);

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
			if (this.#storageError === 'load-failed') this.#storageError = null;
		} catch (e) {
			logError('Failed to load session', e, {
				date,
			});

			this.#storageError = 'load-failed';
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
	get storageError() {
		return this.#storageError;
	}
	/**
	 * Raise the app-wide persistence banner from another store (the Energy Lab
	 * writes its own setting; the measurement store its own observations), so
	 * there is one place a storage failure shows up rather than one banner per
	 * store. The layout's retry action covers every store that can raise
	 * 'load-failed'.
	 */
	reportStorageError(kind: StorageErrorKind) {
		this.#storageError = kind;
	}
	clearStorageError() {
		this.#storageError = null;
	}
	get today() {
		return this.#today;
	}
	get selectedDate() {
		return this.#selectedDate;
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
				id: Date.now(),
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

				this.#storageError = 'save-failed';
			}
		}
	}

	removeTask(id: number) {
		this.#tasks = this.#tasks.filter((t) => t.id !== id);
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
			const session = await sessionRepository.$readSessionByDate(date);
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

			return 0;
		}
	}

	importTasks(imported: Omit<Task, 'id' | 'createdAt' | 'completed'>[]) {
		const newTasks = imported.map((t) => ({
			...t,
			id: Date.now() + Math.random(),
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

			this.#flowObservations = await flowObservationRepository.$readAllFlowObservations();

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
			this.#storageError = 'save-failed';
		}
	}

	// Remove one measured data point; the constants refit automatically since
	// they are derived from the observations. Clears today's ⚡ badge if the
	// deleted log belonged to a task in today's session.
	async deleteFlowLog(id: number) {
		const record = this.#flowObservations.find((o) => o.id === id);

		try {
			await flowObservationRepository.$deleteFlowObservation(id);
			this.#flowObservations = await flowObservationRepository.$readAllFlowObservations();

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
			this.#storageError = 'save-failed';
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
			this.#storageError = 'save-failed';
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
			this.#routines = await routineRepository.$readAllRoutines();
		} catch (e) {
			logError('Failed to save routine', e);
			this.#storageError = 'save-failed';
		}
	}

	async deleteRoutine(id: string) {
		try {
			await routineRepository.$deleteRoutine(id);
			this.#routines = await routineRepository.$readAllRoutines();
		} catch (e) {
			logError('Failed to delete routine', e);
			this.#storageError = 'save-failed';
		}
	}
}

export function setSessionStore(readDateParam: ReadDateParam): SessionStore {
	return setContext<SessionStore>(CONTEXT_KEY, new SessionStore(readDateParam));
}

export function getSessionStore(): SessionStore {
	return getContext<SessionStore>(CONTEXT_KEY);
}
