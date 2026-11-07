import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from 'vitest-browser-svelte';
import { flushSync } from 'svelte';
import Harness from '$lib/business/store/energy-lab-store.test-harness.svelte';
import {
	drainRecord,
	mockObservations,
	mockSession,
	mockClock,
} from '$lib/business/store/layout-store-mock.test-utils.svelte';
import * as settingsRepository from '$lib/data/repository/settings-repository';
import * as sessionHistory from '$lib/business/session-history';
import type { EnergyLabStore } from '$lib/business/store/energy-lab-store.svelte';
import { AUTOSAVE_DEBOUNCE_MS } from '$lib/business/store/debounced-write.svelte';
import { StorageStatusStore } from '$lib/business/store/storage-status.svelte';
import {
	adviseStop,
	DEFAULT_ENERGY_PARAMS,
	DEFAULT_STEP_HOURS,
	evaluateSchedule,
	optimizeSchedule,
	type ScheduleBlock,
	type StopAdvice,
	type StopObservation,
} from '$lib/business/model/zenith-energy';
import type * as ZenithEnergy from '$lib/business/model/zenith-energy';
import { toEnergyTask } from '$lib/business/model/metric/calculation';

vi.mock('$lib/data/repository/settings-repository', () => ({
	ENERGY_PARAMS_SETTING: 'energyParams',
	$readSetting: vi.fn(async () => undefined),
	$updateSetting: vi.fn(async () => {}),
}));

vi.mock('$lib/business/session-history', () => ({
	readStopObservations: vi.fn(async () => []),
}));

// Passthrough; the off-page tests only count the solves.
vi.mock('$lib/business/model/zenith-energy', async (importOriginal) => {
	const mod = await importOriginal<typeof ZenithEnergy>();

	return {
		...mod,
		optimizeSchedule: vi.fn(mod.optimizeSchedule),
	};
});

// The Lab reads the wall clock through `liveNow` (beside `liveToday`), so the
// spec owns it: `mockClock.now` is what the store sees, reactive, resting at 0.
vi.mock('$lib/business/state/today.svelte', async () => {
	const { mockClock } = await import('$lib/business/store/layout-store-mock.test-utils.svelte');

	return {
		liveToday: {
			value: '2026-07-20',
		},
		liveNow: {
			get value() {
				return mockClock.now;
			},
		},
	};
});

const readSettingMock = vi.mocked(settingsRepository.$readSetting);
const updateSettingMock = vi.mocked(settingsRepository.$updateSetting);
const readStopObservationsMock = vi.mocked(sessionHistory.readStopObservations);
const optimizeScheduleMock = vi.mocked(optimizeSchedule);
const MS_PER_HOUR = 3_600_000;

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
		mockClock.reset();
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

	// Created in the (app) layout, so the store is alive on all six routes. The plan is
	// `/energy`'s, so no window or date `/` moves runs the optimizer here.
	it('solves nothing while `/` moves the window and the day', async () => {
		mockSession.tasks = [
			{
				id: 1,
				title: 'deep work',
				physicalDifficulty: 2,
				mentalDifficulty: 8,
				enjoyment: 5,
				createdAt: '2026-07-20',
				completed: false,
			},
		];

		optimizeScheduleMock.mockClear();

		await setup();

		// A budget keystroke, then a date link
		mockSession.availableHours = 3;
		mockSession.selectedDate = '2026-07-21';
		mockSession.loadedDate = '2026-07-21';
		flushSync();

		expect(optimizeScheduleMock).not.toHaveBeenCalled();
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
		await vi.waitFor(() => expect(store.stopObservations).toHaveLength(2));

		resolveStale([stopObservation(4)]);
		await vi.waitFor(() => expect(readStopObservationsMock).toHaveBeenCalledTimes(2));
		expect(store.stopObservations).toHaveLength(2);
	});

	/* A finished day's λ₀ inputs come from its STORED session too — the open scope
	   and the window `toStopObservations` reads — and completion can be toggled on
	   any past day, so the read keys on the session store's past-write count as
	   well as on the drain logs. */
	it('re-reads the stop observations when a past day is written', async () => {
		const store = await setup();

		readStopObservationsMock.mockResolvedValue([stopObservation(8), stopObservation(6)]);
		mockSession.pastWriteGeneration += 1;
		flushSync();

		await vi.waitFor(() => expect(store.stopObservations).toHaveLength(2));
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

	// Next-up family: unlike the plan, the advisor DOES respond
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

	// The session clock reads the advice once, so it must wait for every input.
	it('holds the stop advice unready until today and its logs have both been read', async () => {
		const store = await setup();

		mockSession.loadedDate = '2026-07-19';
		expect(store.isStopAdviceReady).toBe(false);

		mockSession.loadedDate = mockSession.today;
		mockObservations.isLoading = true;
		expect(store.isStopAdviceReady).toBe(false);

		mockObservations.isLoading = false;
		expect(store.isStopAdviceReady).toBe(true);
	});

	it('holds the stop advice unready on the example day', async () => {
		const store = await setup();

		mockSession.loadedDate = null;
		expect(store.isStopAdviceReady).toBe(false);
	});

	it('holds the stop advice unready until the params have been read', async () => {
		let resolveRead!: (value: undefined) => void;

		readSettingMock.mockReturnValueOnce(new Promise((resolve) => (resolveRead = resolve)));

		let store!: EnergyLabStore;

		render(Harness, {
			onstore: (s: EnergyLabStore) => (store = s),
		});

		expect(store.isStopAdviceReady).toBe(false);

		resolveRead(undefined);
		await vi.waitFor(() => expect(store.isStopAdviceReady).toBe(true));
	});

	/** What the recommended session is worth; the window-full verdict prices none. */
	const marginalValue = (advice: StopAdvice | null) => {
		if (advice === null || advice.verdict === 'window-full') {
			throw new Error(`expected a priced verdict, got ${advice?.verdict ?? 'null'}`);
		}

		return advice.marginalValue;
	};

	// Which tasks count as open is decided HERE for the live advisor (§8.11) and
	// in `toStopObservations` for the fit (§8.10): candidates are the OPEN tasks,
	// while every task's logged hours stay in the reconstruction. Both halves need a second
	// task to be visible — with one task, filtering either way still reads null.
	// The completed task is the STRONGER one on purpose (as in the model-level
	// sibling, zenith-energy.test.ts): it wins the unfiltered max at every level
	// of logged hours, so recommending the open one can only come through the
	// filter. With the ratings the other way round, dropping the candidate set
	// entirely leaves the same answer and the assertion pins nothing. 3 h logged,
	// not 4.5: on the v2 curve a cold start pays from its first minute, and at
	// 4.5 h the fresh weak task wins the unfiltered max (read 2026-09-11), which
	// would leave the same assertion pinning nothing.
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
				hours: 3,
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
							hours: 3,
						},
					],
					openTaskIds: new Set([2]),
				},
				store.params,
				mockSession.userConstants,
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
							hours: 3,
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

	// The defect that was fixed, pinned where it was VISIBLE: the writer used to
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
					openTaskIds: new Set([1]),
				},
				store.params,
				mockSession.userConstants,
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
					openTaskIds: new Set([1]),
				},
				store.params,
				mockSession.userConstants,
			),
		);
	});

	// The inversion itself, priced: the truncated day reads a HIGHER marginal
	// than the true longer one, and the two verdicts differ. Probe
	// `session-row-truncation.probe.ts` (2026-08-18) prices the section's own
	// witness at 0.667 / 1.099 / 0.372 — difficulty 7 at w = (0.8, 0.2), which no
	// task record reaches, since demands 0.8/0.2 are sliders 8/2 and difficulty
	// 8 + 0.3·2. These are the same three states on the nearest task the sliders
	// DO reach at difficulty 7.
	it('reads the truncated day as worth MORE than the true longer one', async () => {
		mockSession.tasks = [
			{
				id: 1,
				title: 'deep work',
				physicalDifficulty: 0,
				mentalDifficulty: 7,
				enjoyment: 6,
				createdAt: '2026-07-20T08:00:00.000Z',
				completed: false,
			},
		];

		const store = await setup();

		const logged = (...hours: number[]) => {
			mockObservations.drainObservations = hours.map((h) =>
				drainRecord({
					date: '2026-07-20',
					hours: h,
				}),
			);

			flushSync();

			return store.stopAdvice;
		};

		const first = logged(3);

		expect(first).toMatchObject({
			verdict: 'continue',
			sessionHours: 0.75,
		});

		expect(marginalValue(first)).toBeCloseTo(0.79857, 4);

		// What the upsert left behind after the second session: less worked, priced
		// higher, still `continue`.
		const truncated = logged(1.5);

		expect(truncated).toMatchObject({
			verdict: 'continue',
			sessionHours: 0.75,
		});

		expect(marginalValue(truncated)).toBeCloseTo(1.22214, 4);

		// The day that actually happened — two rows, summed.
		const whole = logged(3, 1.5);

		expect(whole).toMatchObject({
			verdict: 'stop',
			sessionHours: 0.75,
		});

		expect(marginalValue(whole)).toBeCloseTo(0.48214, 4);
		expect(marginalValue(whole)).toBeLessThan(marginalValue(first));
	});

	// The store is the ONLY `adviseStop` caller, so the row's log moment has to
	// reach it or §8.10's recovered breaks never touch the live card (MATH.md
	// §8.11). The two rows above logged 90 min apart are a day with a real break
	// in it: the reservoirs recover across it, so the next session is worth more
	// and the verdict comes back. `drainRecord`'s default `createdAt: 0` is what
	// makes the pin above a batch-logged day, which reads summed.
	it('reads today’s breaks off the 🪫 rows’ log moments', async () => {
		mockSession.tasks = [
			{
				id: 1,
				title: 'deep work',
				physicalDifficulty: 0,
				mentalDifficulty: 7,
				enjoyment: 6,
				createdAt: '2026-07-20T08:00:00.000Z',
				completed: false,
			},
		];

		const store = await setup();

		const logged = (...rows: { hours: number; createdAt: number }[]) => {
			mockObservations.drainObservations = rows.map(({ hours, createdAt }) =>
				drainRecord({
					date: '2026-07-20',
					hours,
					createdAt,
				}),
			);

			flushSync();

			return store.stopAdvice;
		};

		const hour = 3_600_000;

		const batched = logged(
			{
				hours: 3,
				createdAt: 0,
			},
			{
				hours: 1.5,
				createdAt: 0,
			},
		);

		const spaced = logged(
			{
				hours: 3,
				createdAt: 3 * hour,
			},
			{
				hours: 1.5,
				createdAt: 6 * hour,
			},
		);

		expect(batched).toMatchObject({
			verdict: 'stop',
		});

		expect(marginalValue(batched)).toBeCloseTo(0.48214, 4);

		expect(spaced).toMatchObject({
			verdict: 'continue',
		});

		expect(marginalValue(spaced)).toBeGreaterThan(marginalValue(batched));
	});

	// The goal is the header of the `readAt` block in zenith-energy.test.ts. A
	// 3 h row written two hours ago: the card prices the session after those two
	// hours of rest, over the steps the clock still holds — worked hours for the
	// room, worked + idle for the span. Red today: the store hands the model no
	// moment to read the day at.
	it('prices the next session after the idle time since the last 🪫 log', async () => {
		mockSession.tasks = [
			{
				id: 1,
				title: 'deep work',
				physicalDifficulty: 0,
				mentalDifficulty: 7,
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
				createdAt: 0,
			}),
		];

		mockClock.now = 2 * MS_PER_HOUR;
		flushSync();

		const tasks = mockSession.tasks.map(toEnergyTask);

		const valueOf = (blocks: ScheduleBlock[]) => {
			const ev = evaluateSchedule(blocks, tasks, 8, store.params, mockSession.userConstants);

			return ev.satiatedOutput + ev.terminalBonus;
		};

		const base = valueOf([
			{
				taskId: 1,
				hours: 3,
			},
		]);

		// 3 h worked, 5 h spanned, of 8: four steps of clock.
		const longest = Math.floor((8 - 5) / DEFAULT_STEP_HOURS + 1e-9);
		let expected = {
			sessionHours: 0,
			marginalValue: -Infinity,
		};

		for (let m = 1; m <= longest; m++) {
			const hours = m * DEFAULT_STEP_HOURS;

			const marginalValue =
				(valueOf([
					{
						taskId: 1,
						hours: 3,
					},
					{
						taskId: null,
						hours: 2,
					},
					{
						taskId: 1,
						hours,
					},
				]) -
					base) /
				hours;

			if (marginalValue > expected.marginalValue)
				expected = {
					sessionHours: hours,
					marginalValue,
				};
		}

		const advice = store.stopAdvice;

		if (advice === null || advice.verdict === 'window-full') {
			throw new Error(`expected a priced verdict, got ${advice?.verdict ?? 'null'}`);
		}

		expect(advice.marginalValue).toBeCloseTo(expected.marginalValue, 12);
		expect(advice.sessionHours).toBeCloseTo(expected.sessionHours, 12);
	});

	// A card left open must move with the clock, not only with the logs.
	it('re-prices as the clock moves on from the last log', async () => {
		mockSession.tasks = [
			{
				id: 1,
				title: 'deep work',
				physicalDifficulty: 0,
				mentalDifficulty: 7,
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
				createdAt: 0,
			}),
		];

		flushSync();
		const atTheLog = store.stopAdvice;

		mockClock.now = 2 * MS_PER_HOUR;
		flushSync();

		expect(store.stopAdvice).not.toEqual(atTheLog);
	});
});
