import { getContext, setContext, onMount } from 'svelte';
import { browser } from '$app/environment';
import { page } from '$app/state';
import type {
	Task,
	DailySession,
	SavedRoutine,
	FlowObservationRecord,
	DrainObservationRecord,
	RestObservationRecord
} from '$lib/data/type';
// Namespace imports: the $-prefixed controller methods can't be imported by
// name inside .svelte.ts files ($ is reserved for runes), but property access
// on a namespace is fine.
import * as sessionRepository from '$lib/data/repository/session-repository';
import * as routineRepository from '$lib/data/repository/routine-repository';
import * as flowObservationRepository from '$lib/data/repository/flow-observation-repository';
import * as drainObservationRepository from '$lib/data/repository/drain-observation-repository';
import * as restObservationRepository from '$lib/data/repository/rest-observation-repository';
import { liveToday } from '$lib/business/state/today.svelte';
import { addDays } from '$lib/business/utils/date';
import { initializeStorage } from '$lib/business/store/session-history';
import { getEffectiveDifficulty } from '$lib/business/model/metric/calculation';
import {
	DEFAULT_SWITCH_COST,
	DEFAULT_CAPACITY_POOLS,
	fitUserConstants,
	mapEffort,
	mapEnjoyability
} from '$lib/business/model/zenith';

const CONTEXT_KEY = Symbol();

/**
 * The daily session as a shared reactive store: tasks, time budget, capacity
 * pools, flow observations, and their IndexedDB persistence. Created once in
 * the (app) layout via context — never at module level, so no state can leak
 * between SSR requests — and consumed by any page that needs live tasks
 * (main page, Energy Lab).
 */
export class SessionStore {
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
	#drainObservations = $state<DrainObservationRecord[]>([]);
	#restObservations = $state<RestObservationRecord[]>([]);

	// Which date the in-memory state belongs to. Loads are async, so this lags
	// selectedDate during navigation — the auto-save guard uses it to avoid
	// persisting one day's tasks under another day's key.
	#loadedDate = $state<string | null>(null);

	// Whether the loaded date already has a persisted session. Auto-save skips
	// pristine days (so merely browsing future dates creates no records) but
	// keeps saving once a session exists (so deleting the last task persists).
	#loadedHadSession = $state(false);

	// A persistence failure the UI should surface. Machine value ('save-failed');
	// the layout resolves it to a localized banner. Cleared by clearStorageError.
	#storageError = $state<string | null>(null);

	// Trailing-debounced auto-save: the effect captures a snapshot into
	// #pendingSave and (re)arms #saveTimer, so a burst of edits collapses to one
	// IndexedDB put; the write is flushed early when the tab is hidden.
	#pendingSave: DailySession | null = null;
	#saveTimer: ReturnType<typeof setTimeout> | undefined;

	// The URL is the single source of truth for the viewed day: /?date=YYYY-MM-DD
	// for any other day, plain / for today. Routes without a date param (Energy
	// Lab, calendar, …) always view today. Invalid dates fall back to today.
	#today = $derived(liveToday.value);
	#dateParam = $derived(page.url.searchParams.get('date'));
	#selectedDate = $derived(
		this.#dateParam && /^\d{4}-\d{2}-\d{2}$/.test(this.#dateParam) ? this.#dateParam : this.#today
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
		physicalHours: Math.max(0, Number(this.#physicalPool) || 0)
	});

	// Personalized model constants: ridge least-squares fit of ϕ = c₁E + c₂β + c₃
	// over the logged time-to-flow measurements, anchored to the article's
	// defaults. Every ⚡ log nudges the model; more logs = less anchor.
	#constantsFit = $derived(
		fitUserConstants(this.#flowObservations.map((o) => ({ E: o.E, beta: o.beta, phi: o.phiHours })))
	);

	constructor() {
		onMount(async () => {
			try {
				await initializeStorage();
				this.#yesterdaySession = await sessionRepository.$readSessionByDate(
					addDays(this.#today, -1)
				);
				this.#routines = await routineRepository.$readAllRoutines();
				this.#flowObservations = await flowObservationRepository.$readAllFlowObservations();
				this.#drainObservations = await drainObservationRepository.$readAllDrainObservations();
				this.#restObservations = await restObservationRepository.$readAllRestObservations();
				await this.#loadSession(this.#selectedDate);
			} catch (e) {
				console.error('Failed to load from IndexedDB', e);
			} finally {
				this.#isLoading = false;
			}
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
					updatedAt: Date.now()
				};
				clearTimeout(this.#saveTimer);
				this.#saveTimer = setTimeout(() => this.#flushSave(), 500);
				return () => clearTimeout(this.#saveTimer);
			}
		});

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
				console.error('Failed to save session', e);
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
		} catch (e) {
			console.error('Failed to load session for date', date, e);
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
	get drainObservations() {
		return this.#drainObservations;
	}
	get restObservations() {
		return this.#restObservations;
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
	}) {
		this.#tasks = [
			{
				id: Date.now(),
				...taskData,
				createdAt: this.#selectedDate,
				completed: false
			},
			...this.#tasks
		];
	}

	// Completion can be toggled on ANY day — forgetting to check a task off
	// before midnight shouldn't falsify history. Structural edits (add/edit/
	// remove) work on today and future plans; past days stay read-only:
	// those rewrite the plan, this records the truth.
	async toggleTask(id: number) {
		this.#tasks = this.#tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));

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
					updatedAt: Date.now()
				});
			} catch (e) {
				console.error('Failed to save completion change for', this.#selectedDate, e);
				this.#storageError = 'save-failed';
			}
		}
	}

	removeTask(id: number) {
		this.#tasks = this.#tasks.filter((t) => t.id !== id);
	}

	updateTask(
		id: number,
		changes: Partial<Pick<Task, 'title' | 'physicalDifficulty' | 'mentalDifficulty' | 'enjoyment'>>
	) {
		this.#tasks = this.#tasks.map((t) => (t.id === id ? { ...t, ...changes } : t));
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
						enjoyment: t.enjoyment
					}))
				);
			}
			return tasks.length;
		} catch (e) {
			console.error('Failed to load session for import', date, e);
			return 0;
		}
	}

	importTasks(imported: Omit<Task, 'id' | 'createdAt' | 'completed'>[]) {
		const newTasks = imported.map((t) => ({
			...t,
			id: Date.now() + Math.random(),
			createdAt: this.#selectedDate,
			completed: false
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
				phiHours: minutes / 60
			});
			this.#flowObservations = await flowObservationRepository.$readAllFlowObservations();
			// Stamp the ⚡ badge only once the write lands, so the UI never shows
			// success for a failed persist.
			this.#tasks = this.#tasks.map((t) => (t.id === id ? { ...t, flowMinutes: minutes } : t));
		} catch (e) {
			console.error('Failed to save flow observation', e);
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
					t.id === record.taskId ? { ...t, flowMinutes: undefined } : t
				);
			}
		} catch (e) {
			console.error('Failed to delete flow observation', e);
			this.#storageError = 'save-failed';
		}
	}

	// Delete all measured data points → model reverts to the article defaults.
	async resetFlowLogs() {
		try {
			await flowObservationRepository.$deleteAllFlowObservations();
			this.#flowObservations = [];
			this.#tasks = this.#tasks.map((t) => (t.flowMinutes ? { ...t, flowMinutes: undefined } : t));
		} catch (e) {
			console.error('Failed to reset flow observations', e);
			this.#storageError = 'save-failed';
		}
	}

	// ----- Drain observations (energy-model α calibration) -----

	// Log an end-of-session drain rating for a task: after `hours` of work,
	// how drained body and mind feel (0–10). Captures the task's reservoir
	// demands at logging time; re-rating the same task today REPLACES the
	// earlier record (typo correction), mirroring logFlow. Today-only by the
	// same logic as flow logs — it is a measurement, not a plan.
	async logDrain(id: number, hours: number, mindDrain: number, bodyDrain: number) {
		const task = this.#tasks.find((t) => t.id === id);
		if (!task) return;

		try {
			await drainObservationRepository.$updateDrainObservation({
				date: this.#today,
				taskId: id,
				taskTitle: task.title,
				hours,
				cognitiveDemand: task.mentalDifficulty / 10,
				physicalDemand: task.physicalDifficulty / 10,
				mindDrain,
				bodyDrain
			});
			this.#drainObservations = await drainObservationRepository.$readAllDrainObservations();
		} catch (e) {
			console.error('Failed to save drain observation', e);
			this.#storageError = 'save-failed';
		}
	}

	// Remove one drain rating; any fitted α values are derived from the
	// observations, so consumers refit automatically.
	async deleteDrainLog(id: number) {
		try {
			await drainObservationRepository.$deleteDrainObservation(id);
			this.#drainObservations = await drainObservationRepository.$readAllDrainObservations();
		} catch (e) {
			console.error('Failed to delete drain observation', e);
			this.#storageError = 'save-failed';
		}
	}

	// Delete all drain ratings → the energy model's drain calibration reverts
	// to whatever the lab parameters say.
	async resetDrainLogs() {
		try {
			await drainObservationRepository.$deleteAllDrainObservations();
			this.#drainObservations = [];
		} catch (e) {
			console.error('Failed to reset drain observations', e);
			this.#storageError = 'save-failed';
		}
	}

	// Log a pre/post-rest rating pair: a break of `hours`, with both energy
	// systems rated going in and coming out (0–10). Not tied to a task, and
	// appended rather than upserted — several breaks a day are normal.
	// Today-only like the other measurements.
	async logRest(
		hours: number,
		mindBefore: number,
		mindAfter: number,
		bodyBefore: number,
		bodyAfter: number
	) {
		try {
			await restObservationRepository.$createRestObservation({
				date: this.#today,
				hours,
				mindBefore,
				mindAfter,
				bodyBefore,
				bodyAfter
			});
			this.#restObservations = await restObservationRepository.$readAllRestObservations();
		} catch (e) {
			console.error('Failed to save rest observation', e);
			this.#storageError = 'save-failed';
		}
	}

	// Remove one rest pair; the fitted recovery rate is derived from the
	// observations, so consumers refit automatically.
	async deleteRestLog(id: number) {
		try {
			await restObservationRepository.$deleteRestObservation(id);
			this.#restObservations = await restObservationRepository.$readAllRestObservations();
		} catch (e) {
			console.error('Failed to delete rest observation', e);
			this.#storageError = 'save-failed';
		}
	}

	// Delete all rest pairs → the energy model's recovery calibration reverts
	// to whatever the lab parameters say.
	async resetRestLogs() {
		try {
			await restObservationRepository.$deleteAllRestObservations();
			this.#restObservations = [];
		} catch (e) {
			console.error('Failed to reset rest observations', e);
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
				enjoyment: t.enjoyment
			})),
			createdAt: Date.now()
		};
		try {
			await routineRepository.$updateRoutine(routine);
			this.#routines = await routineRepository.$readAllRoutines();
		} catch (e) {
			console.error('Failed to save routine', e);
			this.#storageError = 'save-failed';
		}
	}

	async deleteRoutine(id: string) {
		try {
			await routineRepository.$deleteRoutine(id);
			this.#routines = await routineRepository.$readAllRoutines();
		} catch (e) {
			console.error('Failed to delete routine', e);
			this.#storageError = 'save-failed';
		}
	}
}

export function setSessionStore(): SessionStore {
	return setContext<SessionStore>(CONTEXT_KEY, new SessionStore());
}

export function getSessionStore(): SessionStore {
	return getContext<SessionStore>(CONTEXT_KEY);
}
