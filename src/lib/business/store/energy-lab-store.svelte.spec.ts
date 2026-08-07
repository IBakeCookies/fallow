import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from 'vitest-browser-svelte';
import { flushSync } from 'svelte';
import Harness from '$lib/business/store/energy-lab-store.test-harness.svelte';
import {
	drainRecord,
	mockObservations,
	mockSession,
	restRecord,
} from '$lib/business/store/energy-lab-store.test-utils.svelte';
import * as settingsRepository from '$lib/data/repository/settings-repository';
import * as sessionHistory from '$lib/business/session-history';
import type { EnergyLabStore } from '$lib/business/store/energy-lab-store.svelte';
import type { Task } from '$lib/business/type';
import { AUTOSAVE_DEBOUNCE_MS } from '$lib/business/store/debounced-write.svelte';
import { StorageStatusStore } from '$lib/business/store/storage-status.svelte';
import {
	adviseStop,
	DEFAULT_ENERGY_PARAMS,
	fitDrainRate,
	type StopAdvice,
	type StopObservation,
} from '$lib/business/model/zenith-energy';
import { toEnergyTask } from '$lib/business/model/metric/calculation';
import { toCognitiveDrainObservations } from '$lib/business/model/energy-calibration';

vi.mock('$lib/data/repository/settings-repository', () => ({
	ENERGY_PARAMS_SETTING: 'energyParams',
	$readSetting: vi.fn(async () => undefined),
	$updateSetting: vi.fn(async () => {}),
}));

vi.mock('$lib/business/session-history', () => ({
	readStopObservations: vi.fn(async () => []),
}));

const readSettingMock = vi.mocked(settingsRepository.$readSetting);
const updateSettingMock = vi.mocked(settingsRepository.$updateSetting);
const readStopObservationsMock = vi.mocked(sessionHistory.readStopObservations);

const stopObservation = (windowHours: number): StopObservation => ({
	tasks: [],
	windowHours,
	workedHours: [],
});

/** Mount the Lab and settle the load. Loading never writes params back. */
async function setup(): Promise<EnergyLabStore> {
	let store!: EnergyLabStore;

	render(Harness, {
		onstore: (s: EnergyLabStore) => (store = s),
	});

	await vi.waitFor(() => expect(store.isLoaded).toBe(true));

	return store;
}

function useFakeTimers() {
	vi.useFakeTimers({
		toFake: ['setTimeout', 'clearTimeout'],
	});
}

describe('EnergyLabStore', () => {
	beforeEach(() => {
		mockSession.reset();
		mockObservations.reset();
		readSettingMock.mockReset().mockResolvedValue(undefined);
		updateSettingMock.mockReset().mockResolvedValue(undefined);
		readStopObservationsMock.mockReset().mockResolvedValue([]);
	});

	afterEach(() => {
		vi.useRealTimers();
		delete (document as { hidden?: boolean }).hidden; // restore the prototype getter
	});

	it('loads the persisted params through the sanitizer', async () => {
		readSettingMock.mockResolvedValue({
			alphaCog: 0.9,
			recoveryRate: 'abc',
		});

		const store = await setup();

		expect(store.params.alphaCog).toBe(0.9);
		expect(store.params.recoveryRate).toBe(DEFAULT_ENERGY_PARAMS.recoveryRate);
	});

	// A failed read leaves #params on DEFAULT_ENERGY_PARAMS, which is
	// indistinguishable from a user who never calibrated — so the store has to
	// say so. Injected, because raising the toast is the route's job (R1/R2).
	it('reports a failed params read and keeps the defaults', async () => {
		readSettingMock.mockRejectedValue(new Error('IndexedDB unavailable'));

		const notifyParamsLoadFailed = vi.fn();
		let store!: EnergyLabStore;

		render(Harness, {
			onstore: (s: EnergyLabStore) => (store = s),
			onparamsloadfailed: notifyParamsLoadFailed,
		});

		await vi.waitFor(() => expect(store.isLoaded).toBe(true));

		expect(notifyParamsLoadFailed).toHaveBeenCalledTimes(1);
		expect(store.params).toEqual(DEFAULT_ENERGY_PARAMS);

		// The regression: loading used to arm the autosave, so a transient read
		// error persisted the defaults over the stored calibration — via the
		// debounce, or this destroy flush.
		cleanup();
		expect(updateSettingMock).not.toHaveBeenCalled();
	});

	// Settled 2026-07-29 (MATH.md §13.6): one budget for both planners. The window
	// is a plain read of the session — there is no lab-local override to fork it
	// with, and no `|| 8` fallback inventing a window the main page does not have.
	it('takes the day window from the session budget, with no fallback and no fork', async () => {
		mockSession.tasks = [
			{
				id: 1,
				title: 'deep work',
				physicalDifficulty: 2,
				mentalDifficulty: 8,
				enjoyment: 6,
				createdAt: '2026-07-20T08:00:00.000Z',
				completed: false,
			},
		];

		const store = await setup();
		// The window is not a public field — it would be a pass-through read of a
		// value the route writes to the session. It is observable as what the plan
		// partitions it into, which pins the number AND the stronger claim that the
		// optimizer is bounded by it rather than a label merely quoting it.
		const windowOf = () => store.plannedHours + store.trailingFreeHours;

		expect(windowOf()).toBeCloseTo(8, 10);
		expect(store.plannedHours).toBeGreaterThan(0);

		mockSession.availableHours = 2;
		flushSync();
		expect(windowOf()).toBeCloseTo(2, 10);
		expect(store.plannedHours).toBeLessThanOrEqual(2);

		// A day with no budget yet has no window. The old fallback showed 8 here.
		mockSession.availableHours = 0;
		flushSync();
		expect(windowOf()).toBe(0);
		expect(store.plannedHours).toBe(0);
	});

	// The Lab makes the main page's §11.8 call for itself (2026-07-20): both plans
	// simulate the full intended day, completed tasks included. `toEnergyTask`
	// drops the flag and `calculateInterleavedOrder` ranks on hours, so the only
	// way a completion can reach either plan is a `!t.completed` filter added
	// here — which would reshuffle the plan on every tick and bias the comparison
	// pro-energy, since it strips work from the classic side only.
	it('plans over completed tasks too, so ticking one off moves nothing', async () => {
		mockSession.tasks = [
			{
				id: 1,
				title: 'deep work',
				physicalDifficulty: 2,
				mentalDifficulty: 8,
				enjoyment: 6,
				createdAt: '2026-07-20',
				completed: false,
			},
			{
				id: 2,
				title: 'boxing',
				physicalDifficulty: 9,
				mentalDifficulty: 2,
				enjoyment: 5,
				createdAt: '2026-07-20',
				completed: false,
			},
		];

		const store = await setup();
		const blocks = store.plan.blocks;
		const valueVsClassic = store.valueVsClassic;
		expect(store.plannedHours).toBeGreaterThan(0);

		// Exact, because WHICH field the tile divides is the claim (MATH.md §30).
		// This fixture's plan works 7.5 h of the 8 (satiated 7.720 + free 0.250 +
		// terminal 1.258 = 9.228) against classic's 7.75 h (7.942 + 0.125 + 1.095
		// = 9.163): +0.72%, one per cent. Scored on raw `totalOutput` — 10.413
		// against 10.809 — the same day reads −4%, so this is one of the days §30
		// says the two scorings disagree on in SIGN, and the pin catches the old
		// field rather than merely its size.
		expect(valueVsClassic).toBe(1);

		mockSession.tasks = mockSession.tasks.map((t) =>
			t.id === 1
				? {
						...t,
						completed: true,
					}
				: t,
		);

		flushSync();

		expect(store.plan.blocks).toEqual(blocks);
		expect(store.valueVsClassic).toBe(valueVsClassic);
	});

	// The task list beside the plan reads this: without it the only place the plan
	// says what a task got is the timeline, and a task funded zero says nothing at
	// all there — the row is where the slider that starved it lives.
	it('sums the plan into hours per task, omitting the ones it funded zero', async () => {
		mockSession.tasks = [
			{
				id: 1,
				title: 'deep work',
				physicalDifficulty: 2,
				mentalDifficulty: 8,
				enjoyment: 8,
				createdAt: '2026-07-20',
				completed: false,
			},
			{
				id: 2,
				title: 'boxing',
				physicalDifficulty: 9,
				mentalDifficulty: 2,
				enjoyment: 5,
				createdAt: '2026-07-20',
				completed: false,
			},
			{
				id: 3,
				title: 'inbox',
				physicalDifficulty: 1,
				mentalDifficulty: 4,
				enjoyment: 1,
				createdAt: '2026-07-20',
				completed: false,
			},
		];

		mockSession.availableHours = 2;

		const store = await setup();
		const allocated = store.allocatedHoursByTask;

		// A two-hour day cannot fund three tasks, and the ones it skipped are absent
		// rather than present with 0 — the row renders the difference.
		expect(allocated.size).toBeGreaterThan(0);
		expect(allocated.size).toBeLessThan(3);

		for (const hours of allocated.values()) expect(hours).toBeGreaterThan(0);

		// The entries account for exactly the planned work, so a row can be read as
		// this task's share of the number the summary tile shows.
		const total = [...allocated.values()].reduce((sum, hours) => sum + hours, 0);
		expect(total).toBeCloseTo(store.plan.evaluation.workHours, 10);
	});

	/* ----- The list's order (snapshotted schedule order) ----- */

	const threeTasks = (): Task[] => [
		{
			id: 1,
			title: 'inbox',
			physicalDifficulty: 1,
			mentalDifficulty: 4,
			enjoyment: 1,
			createdAt: '2026-07-20',
			completed: false,
		},
		{
			id: 2,
			title: 'deep work',
			physicalDifficulty: 2,
			mentalDifficulty: 8,
			enjoyment: 9,
			createdAt: '2026-07-20',
			completed: false,
		},
		{
			id: 3,
			title: 'boxing',
			physicalDifficulty: 9,
			mentalDifficulty: 2,
			enjoyment: 5,
			createdAt: '2026-07-20',
			completed: false,
		},
	];

	/** First appearance per task across the evaluated blocks — the day's own order. */
	const plannedOrder = (store: EnergyLabStore) => [
		...new Set(
			store.plan.evaluation.blocks
				.map((block) => block.taskId)
				.filter((id): id is number => id !== null),
		),
	];

	it('reads the list in schedule order, with the unfunded behind it', async () => {
		mockSession.tasks = threeTasks();
		mockSession.availableHours = 2;

		const store = await setup();
		flushSync();

		const scheduled = plannedOrder(store);
		const ids = store.scheduledTasks.map((t) => t.id);

		// Every task is still here — the order changes, the membership never does
		expect([...ids].sort()).toEqual([1, 2, 3]);
		// A two-hour day cannot fund three tasks, so this asserts both halves at once
		expect(scheduled.length).toBeLessThan(3);
		expect(ids.slice(0, scheduled.length)).toEqual(scheduled);

		// …and the tail is the unfunded, in the store's own order
		expect(ids.slice(scheduled.length)).toEqual(
			mockSession.tasks.map((t) => t.id).filter((id) => !scheduled.includes(id)),
		);
	});

	// The whole reason the order is a snapshot: every parameter edit re-optimizes, and a
	// live sort re-ranked the rows under a slider drag — moving the row being dragged
	// out from under the cursor.
	it('holds the order across a re-optimization, and re-sorts only when asked', async () => {
		mockSession.tasks = threeTasks();
		mockSession.availableHours = 2;

		const store = await setup();
		flushSync();

		const before = store.scheduledTasks.map((t) => t.id);

		// A drag big enough to fund a different task
		store.setParam('alphaCog', 2);
		flushSync();

		expect(store.scheduledTasks.map((t) => t.id)).toEqual(before);

		store.resnapshotOrder();
		flushSync();

		expect(store.scheduledTasks.map((t) => t.id).slice(0, plannedOrder(store).length)).toEqual(
			plannedOrder(store),
		);
	});

	// `addTask` puts a new task first and the card's form sits above the list, so the
	// front is where the user is looking for the row they just deployed.
	it('puts a task added after the snapshot first', async () => {
		mockSession.tasks = threeTasks();

		const store = await setup();
		flushSync();

		const snapshot = store.scheduledTasks.map((t) => t.id);

		mockSession.tasks = [
			{
				id: 4,
				title: 'water the plants',
				physicalDifficulty: 1,
				mentalDifficulty: 1,
				enjoyment: 4,
				createdAt: '2026-07-20',
				completed: false,
			},
			...mockSession.tasks,
		];

		flushSync();

		// First, and the snapshot behind it is untouched — adding a task re-plans the
		// day, and re-ranking the rows on that is the whole thing this avoids.
		expect(store.scheduledTasks.map((t) => t.id)).toEqual([4, ...snapshot]);
	});

	// No window is no plan, so there is nothing to sort by — and the snapshot stays
	// unfilled rather than empty, so setting one still orders the list.
	it("keeps the store's order until there is a plan to sort by", async () => {
		mockSession.tasks = threeTasks();
		mockSession.availableHours = 0;

		const store = await setup();
		flushSync();

		expect(store.scheduledTasks.map((t) => t.id)).toEqual([1, 2, 3]);

		mockSession.availableHours = 2;
		flushSync();

		const scheduled = plannedOrder(store);
		expect(scheduled.length).toBeGreaterThan(0);
		expect(store.scheduledTasks.map((t) => t.id).slice(0, scheduled.length)).toEqual(scheduled);
	});

	it('reports nothing when the params read succeeds', async () => {
		const notifyParamsLoadFailed = vi.fn();
		let store!: EnergyLabStore;

		render(Harness, {
			onstore: (s: EnergyLabStore) => (store = s),
			onparamsloadfailed: notifyParamsLoadFailed,
		});

		await vi.waitFor(() => expect(store.isLoaded).toBe(true));

		expect(notifyParamsLoadFailed).not.toHaveBeenCalled();
	});

	// AGENTS.md §3: "A fit never writes params silently." The whole point of the
	// Apply buttons is that the sliders stay the user's.
	it('computes the fits without touching the params', async () => {
		const store = await setup();

		mockObservations.drainObservations = [
			drainRecord(),
			drainRecord({
				hours: 2,
				mindDrain: 8,
			}),
		];

		mockObservations.restObservations = [restRecord()];
		flushSync();

		expect(store.cognitiveDrainFit.fitted).toBe(true);
		expect(store.recoveryFit.fitted).toBe(true);
		// The fits genuinely moved, so the assertions below are not vacuous.
		expect(store.cognitiveDrainFit.alpha).not.toBeCloseTo(DEFAULT_ENERGY_PARAMS.alphaCog, 2);
		expect(store.recoveryFit.rate).not.toBeCloseTo(DEFAULT_ENERGY_PARAMS.recoveryRate, 2);

		expect(store.params.alphaCog).toBe(DEFAULT_ENERGY_PARAMS.alphaCog);
		expect(store.params.alphaPhys).toBe(DEFAULT_ENERGY_PARAMS.alphaPhys);
		expect(store.params.recoveryRate).toBe(DEFAULT_ENERGY_PARAMS.recoveryRate);
		expect(store.drainFitApplied).toBe(false);
		expect(store.recoveryFitApplied).toBe(false);
	});

	it('copies a fit into the manual inputs only when its Apply is pressed', async () => {
		const store = await setup();

		mockObservations.drainObservations = [
			drainRecord(),
			drainRecord({
				hours: 2,
				mindDrain: 8,
			}),
		];

		mockObservations.restObservations = [restRecord()];
		readStopObservationsMock.mockResolvedValue([stopObservation(8), stopObservation(6)]);
		flushSync();
		await vi.waitFor(() => expect(store.stopObservationCount).toBe(2));

		const round2 = (x: number) => Math.round(x * 100) / 100;

		store.applyDrainFit();
		flushSync();
		expect(store.params.alphaCog).toBe(round2(store.cognitiveDrainFit.alpha));
		expect(store.params.alphaPhys).toBe(round2(store.physicalDrainFit.alpha));
		expect(store.drainFitApplied).toBe(true);

		store.applyRecoveryFit();
		flushSync();
		expect(store.params.recoveryRate).toBe(round2(store.recoveryFit.rate));
		expect(store.recoveryFitApplied).toBe(true);

		store.applyStoppingFit();
		flushSync();
		expect(store.stoppingFitApplied).toBe(true);

		if (store.stoppingFit.fitted) {
			expect(store.params.freeTimeValue).toBe(round2(store.stoppingFit.value));
		}
	});

	// R3: the Lab and the Burnout Risk facade must read identical logs the same
	// way — only their fit SEQUENCE differs.
	it('maps drain records through the shared calibration mapping', async () => {
		const store = await setup();

		const records = [
			drainRecord(),
			drainRecord({
				hours: 2,
				cognitiveDemand: 0.6,
				mindDrain: 7,
			}),
		];

		mockObservations.drainObservations = records;
		flushSync();

		expect(store.cognitiveDrainFit).toEqual(
			fitDrainRate(
				toCognitiveDrainObservations(records),
				DEFAULT_ENERGY_PARAMS.alphaCog,
				store.params,
			),
		);
	});

	it('debounces the param autosave into a single write of the last value', async () => {
		const store = await setup();
		useFakeTimers();

		store.setParam('alphaCog', 0.4);
		flushSync();
		store.setParam('alphaCog', 0.6);
		flushSync();
		expect(updateSettingMock).not.toHaveBeenCalled();

		vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 1);
		expect(updateSettingMock).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(updateSettingMock).toHaveBeenCalledTimes(1);

		expect(updateSettingMock.mock.calls[0][1]).toMatchObject({
			alphaCog: 0.6,
		});
	});

	// The regression: /energy builds its own store, so leaving the page inside
	// the debounce window used to drop the edit outright.
	it('flushes the pending param write when the page is left', async () => {
		const store = await setup();
		useFakeTimers();

		store.setParam('satietyScale', 0.9);
		flushSync();
		expect(updateSettingMock).not.toHaveBeenCalled();

		cleanup();

		expect(updateSettingMock).toHaveBeenCalledTimes(1);

		expect(updateSettingMock.mock.calls[0][1]).toMatchObject({
			satietyScale: 0.9,
		});

		// …and the flushed write is not repeated by the timer that was pending.
		vi.advanceTimersByTime(1000);
		expect(updateSettingMock).toHaveBeenCalledTimes(1);
	});

	it('flushes the pending param write when the tab hides', async () => {
		const store = await setup();
		useFakeTimers();

		// Must differ from the default, or the assignment is not a state change and
		// the autosave effect never re-runs — the test would pass vacuously.
		expect(DEFAULT_ENERGY_PARAMS.terminalEnergyValue).not.toBe(2.5);
		store.setParam('terminalEnergyValue', 2.5);
		flushSync();
		expect(updateSettingMock).not.toHaveBeenCalled();

		Object.defineProperty(document, 'hidden', {
			value: true,
			configurable: true,
		});

		document.dispatchEvent(new Event('visibilitychange'));

		expect(updateSettingMock).toHaveBeenCalledTimes(1);

		expect(updateSettingMock.mock.calls[0][1]).toMatchObject({
			terminalEnergyValue: 2.5,
		});
	});

	it('reports a failed param write on the app-wide banner store', async () => {
		const status = new StorageStatusStore();
		let store!: EnergyLabStore;

		render(Harness, {
			onstore: (s: EnergyLabStore) => (store = s),
			status,
		});

		await vi.waitFor(() => expect(store.isLoaded).toBe(true));
		updateSettingMock.mockRejectedValueOnce(new Error('QuotaExceededError'));

		store.setParam('alphaPhys', 0.5);
		flushSync();

		await vi.waitFor(() => expect(status.error).toBe('save-failed'));
	});

	// The stop-observation read is async and re-runs whenever the drain logs
	// change, so completions can land out of order.
	it('drops a stale stop-observation load that resolves after a newer one', async () => {
		let resolveStale!: (value: StopObservation[]) => void;

		readStopObservationsMock.mockReturnValueOnce(
			new Promise<StopObservation[]>((resolve) => (resolveStale = resolve)),
		);

		const store = await setup();

		readStopObservationsMock.mockResolvedValue([stopObservation(8), stopObservation(6)]);
		mockObservations.drainObservations = [drainRecord()]; // re-triggers the read
		flushSync();
		await vi.waitFor(() => expect(store.stopObservationCount).toBe(2));

		resolveStale([stopObservation(4)]);
		await vi.waitFor(() => expect(readStopObservationsMock).toHaveBeenCalledTimes(2));
		expect(store.stopObservationCount).toBe(2);
	});

	// ----- Live stop advisor (MATH.md §8.11) -----

	it("prices the day so far from TODAY's drain logs only", async () => {
		mockSession.tasks = [
			{
				id: 1,
				title: 'deep work',
				physicalDifficulty: 2,
				mentalDifficulty: 8,
				enjoyment: 6,
				createdAt: '2026-07-20T08:00:00.000Z',
				completed: false,
			},
		];

		const store = await setup();

		const oracle = (workedHours: { taskId: number; hours: number }[]) =>
			adviseStop(
				{
					tasks: mockSession.tasks.map(toEnergyTask),
					windowHours: 8,
					workedHours,
				},
				store.params,
				mockSession.userConstants,
			);

		const fresh = store.stopAdvice;

		expect(fresh).toEqual(oracle([]));
		expect(fresh?.verdict).toBe('continue');

		// Yesterday's log is history, not the day so far.
		mockObservations.drainObservations = [
			drainRecord({
				date: '2026-07-19',
				hours: 6,
			}),
		];

		flushSync();
		expect(store.stopAdvice).toEqual(fresh);

		// Today's log moves the reading.
		mockObservations.drainObservations = [
			drainRecord({
				date: '2026-07-20',
				hours: 6,
			}),
		];

		flushSync();
		const worn = store.stopAdvice;

		expect(worn).toEqual(
			oracle([
				{
					taskId: 1,
					hours: 6,
				},
			]),
		);

		expect(worn).not.toEqual(fresh);
	});

	// Next-up family (MATH.md §11.8): unlike the plan, the advisor DOES respond
	// to completion — "one more session of a task you checked off" is no advice.
	it('stops recommending a task the user checked off', async () => {
		mockSession.tasks = [
			{
				id: 1,
				title: 'deep work',
				physicalDifficulty: 2,
				mentalDifficulty: 8,
				enjoyment: 6,
				createdAt: '2026-07-20T08:00:00.000Z',
				completed: false,
			},
		];

		const store = await setup();

		expect(store.stopAdvice?.verdict).toBe('continue');

		mockSession.tasks = mockSession.tasks.map((t) => ({
			...t,
			completed: true,
		}));

		flushSync();

		expect(store.stopAdvice).toBeNull();
	});

	/** What the recommended session is worth; the window-full verdict prices none. */
	const marginalValue = (advice: StopAdvice | null) => {
		if (advice === null || advice.verdict === 'window-full') {
			throw new Error(`expected a priced verdict, got ${advice?.verdict ?? 'null'}`);
		}

		return advice.marginalValue;
	};

	// The split MATH.md §8.11 calls "the one deliberate asymmetry with §8.10" is
	// decided HERE and nowhere else: candidates are the OPEN tasks, while every
	// task's logged hours stay in the reconstruction. Both halves need a second
	// task to be visible — with one task, filtering either way still reads null.
	// The completed task is the STRONGER one on purpose (as in the model-level
	// sibling, zenith-energy.test.ts): it wins the unfiltered max at every level
	// of logged hours, so recommending the open one can only come through the
	// filter. With the ratings the other way round, dropping the candidate set
	// entirely leaves the same answer and the assertion pins nothing.
	it("prices the open task against a completed one's logged hours", async () => {
		mockSession.tasks = [
			{
				id: 1,
				title: 'deep work',
				physicalDifficulty: 2,
				mentalDifficulty: 8,
				enjoyment: 9,
				createdAt: '2026-07-20T08:00:00.000Z',
				completed: true,
			},
			{
				id: 2,
				title: 'inbox',
				physicalDifficulty: 3,
				mentalDifficulty: 3,
				enjoyment: 3,
				createdAt: '2026-07-20T08:00:00.000Z',
				completed: false,
			},
		];

		const store = await setup();

		mockObservations.drainObservations = [
			drainRecord({
				date: '2026-07-20',
				hours: 4.5,
			}),
		];

		flushSync();
		const drained = store.stopAdvice;

		// Only the open task is a candidate — the completed one is no advice...
		expect(drained).toEqual(
			adviseStop(
				{
					tasks: mockSession.tasks.map(toEnergyTask),
					windowHours: 8,
					workedHours: [
						{
							taskId: 1,
							hours: 4.5,
						},
					],
				},
				store.params,
				mockSession.userConstants,
				new Set([2]),
			),
		);

		expect(drained).toMatchObject({
			taskId: 2,
		});

		// ...and it would have won without the filter, so the recommendation is the
		// filter's doing and not the fixture's.
		expect(
			adviseStop(
				{
					tasks: mockSession.tasks.map(toEnergyTask),
					windowHours: 8,
					workedHours: [
						{
							taskId: 1,
							hours: 4.5,
						},
					],
				},
				store.params,
				mockSession.userConstants,
			),
		).toMatchObject({
			taskId: 1,
		});

		// ...but its 4.5 h drained the reservoirs the open task must work with: take
		// them away and the same task prices strictly higher on a fresher day.
		mockObservations.drainObservations = [];
		flushSync();

		expect(marginalValue(store.stopAdvice)).toBeGreaterThan(marginalValue(drained));
	});

	// The defect MATH.md §18 fixed, pinned where it was VISIBLE: the writer used to
	// upsert on (taskId, date), so a second session replaced the first and the day
	// read short. Every layer between the rows and the advice has to sum them.
	it("sums a task's sessions into the day so far", async () => {
		mockSession.tasks = [
			{
				id: 1,
				title: 'deep work',
				physicalDifficulty: 2,
				mentalDifficulty: 8,
				enjoyment: 6,
				createdAt: '2026-07-20T08:00:00.000Z',
				completed: false,
			},
		];

		const store = await setup();

		mockObservations.drainObservations = [
			drainRecord({
				date: '2026-07-20',
				hours: 3,
			}),
			drainRecord({
				date: '2026-07-20',
				hours: 1.5,
				mindDrain: 6,
			}),
		];

		flushSync();

		expect(store.stopAdvice).toEqual(
			adviseStop(
				{
					tasks: mockSession.tasks.map(toEnergyTask),
					windowHours: 8,
					workedHours: [
						{
							taskId: 1,
							hours: 4.5,
						},
					],
				},
				store.params,
				mockSession.userConstants,
				new Set([1]),
			),
		);

		// Not the last session alone, which is what the upsert left behind.
		expect(store.stopAdvice).not.toEqual(
			adviseStop(
				{
					tasks: mockSession.tasks.map(toEnergyTask),
					windowHours: 8,
					workedHours: [
						{
							taskId: 1,
							hours: 1.5,
						},
					],
				},
				store.params,
				mockSession.userConstants,
				new Set([1]),
			),
		);
	});
});
