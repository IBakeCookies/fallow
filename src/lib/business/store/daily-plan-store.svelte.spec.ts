import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { flushSync } from 'svelte';
import { suggestPlanAdjustments } from '$lib/business/model/metric/plan-advice';
import type * as PlanAdvice from '$lib/business/model/metric/plan-advice';
import Harness from '$lib/business/store/daily-plan-store.test-harness.svelte';
import {
	drainRecord,
	mockObservations,
	mockSession,
	restRecord,
} from '$lib/business/store/energy-lab-store.test-utils.svelte';
import type { DailyPlanStore } from '$lib/business/store/daily-plan-store.svelte';
import type { Task } from '$lib/business/type';

// Passthrough by default; the error-path test overrides one call to throw.
vi.mock('$lib/business/model/metric/plan-advice', async (importOriginal) => {
	const mod = await importOriginal<typeof PlanAdvice>();

	return {
		...mod,
		suggestPlanAdjustments: vi.fn(mod.suggestPlanAdjustments),
	};
});

const task = (id: number, title: string, over: Partial<Task> = {}): Task => ({
	id,
	title,
	physicalDifficulty: 3,
	mentalDifficulty: 8,
	enjoyment: 5,
	createdAt: '2026-07-20',
	completed: false,
	...over,
});

function setup(): DailyPlanStore {
	let store!: DailyPlanStore;

	render(Harness, {
		onstore: (s: DailyPlanStore) => (store = s),
	});

	return store;
}

describe('DailyPlanStore', () => {
	beforeEach(() => {
		mockSession.reset();
		mockObservations.reset();
		vi.clearAllMocks();
	});

	it('plans the session tasks and reacts to the session changing', () => {
		const store = setup();
		expect(store.daily.totalTasks).toBe(0);

		mockSession.tasks = [
			task(1, 'deep work'),
			task(2, 'boxing', {
				physicalDifficulty: 9,
				mentalDifficulty: 2,
			}),
		];

		flushSync();

		expect(store.daily.totalTasks).toBe(2);
		expect(store.daily.suggestedTasks.map((t) => t.id).sort()).toEqual([1, 2]);
		// Priority-sorted, so the run order covers every planned task
		expect(store.daily.runOrder.size).toBe(2);
	});

	// The wiring this store exists for: Burnout Risk must read the user's own
	// drain/rest fits, not the model defaults (MATH.md §8.7/§8.9). A squeezed day
	// (2 demanding tasks into 4h) is where the fitted α and r stop cancelling.
	it('refits the energy params from the calibration logs', () => {
		const store = setup();
		mockSession.tasks = [task(1, 'deep work'), task(2, 'more deep work')];
		mockSession.availableHours = 4;
		flushSync();
		const onDefaults = store.daily.burnoutRisk;
		expect(onDefaults).toBeGreaterThan(0);

		// Same records the Energy Lab's spec uses to move the α and r fits
		mockObservations.drainObservations = [
			drainRecord(),
			drainRecord({
				hours: 2,
				mindDrain: 8,
			}),
		];

		mockObservations.restObservations = [restRecord()];
		flushSync();

		expect(store.daily.burnoutRisk).not.toBe(onDefaults);
	});

	// Overnight carry-over (MATH.md §11.9): the viewed day's predecessor seeds
	// the morning reservoirs. The same heavy log feeds the α fit identically from
	// either date — only yesterday's carries into this morning.
	it('reads yesterday’s logged work into the morning, and only yesterday’s', () => {
		const store = setup();
		mockSession.tasks = [task(1, 'deep work')];
		mockSession.availableHours = 4;

		// Rest pairs that barely recover pin the fitted r near its floor — the
		// regime where a night does not fully heal (§11.9: default recovery does).
		mockObservations.restObservations = [1, 2, 3].map((createdAt) =>
			restRecord({
				createdAt,
				hours: 1,
				mindBefore: 9,
				mindAfter: 9,
				bodyBefore: 9,
				bodyAfter: 9,
			}),
		);

		const heavyDay = (date: string) =>
			drainRecord({
				date,
				hours: 8,
				mindDrain: 9,
				bodyDrain: 9,
			});

		mockObservations.drainObservations = [heavyDay('2026-07-10')];
		flushSync();
		const freshMorning = store.daily.burnoutRisk;

		mockObservations.drainObservations = [heavyDay('2026-07-19')];
		flushSync();

		expect(store.daily.burnoutRisk).toBeGreaterThan(freshMorning);
	});

	// Advice costs one full solve per candidate (MATH.md §14), so it is explicitly
	// requested and then goes stale rather than recomputing on every keystroke.
	it('computes advice on demand only', async () => {
		const store = setup();

		mockSession.tasks = [
			task(1, 'tax return', {
				enjoyment: 1,
				mentalDifficulty: 10,
			}),
		];

		mockSession.availableHours = 10;
		flushSync();

		expect(store.advice).toBeNull();
		expect(store.adviceStale).toBe(false);

		await store.computeAdvice();

		expect(store.advice?.candidatesEvaluated).toBeGreaterThan(0);
		expect(store.adviceBusy).toBe(false);
		expect(store.adviceStale).toBe(false);
	});

	it('marks advice stale when the day changes under it, and fresh again after a recompute', async () => {
		const store = setup();

		mockSession.tasks = [
			task(1, 'tax return', {
				enjoyment: 1,
				mentalDifficulty: 10,
			}),
		];

		mockSession.availableHours = 10;
		flushSync();
		await store.computeAdvice();

		mockSession.availableHours = 6;
		flushSync();

		expect(store.adviceStale).toBe(true);

		await store.computeAdvice();

		expect(store.adviceStale).toBe(false);
	});

	// The busy guard drops a second request instead of queueing it — safe only
	// because the in-flight run reads its input AFTER the pre-solve yield, so it
	// solves the day as it stands, not as it stood when the button was clicked.
	it('ignores a second request while one is in flight, and solves the freshest day', async () => {
		const store = setup();
		mockSession.tasks = [task(1, 'deep work')];
		flushSync();

		const first = store.computeAdvice();
		expect(store.adviceBusy).toBe(true);
		const second = store.computeAdvice();

		// The day changes during the yield: the in-flight run must pick it up.
		mockSession.availableHours = 6;
		flushSync();

		await Promise.all([first, second]);

		expect(suggestPlanAdjustments).toHaveBeenCalledTimes(1);
		expect(store.adviceStale).toBe(false);
	});

	// The only caller is a fire-and-forget click handler, so a failed solve must
	// land in adviceError (and reset busy) instead of an unhandled rejection.
	it('reports a failed solve and recovers on the next one', async () => {
		const store = setup();
		mockSession.tasks = [task(1, 'deep work')];
		flushSync();

		vi.mocked(suggestPlanAdjustments).mockImplementationOnce(() => {
			throw new Error('solver blew up');
		});

		await store.computeAdvice();

		expect(store.adviceError).toBe(true);
		expect(store.adviceBusy).toBe(false);
		expect(store.advice).toBeNull();

		await store.computeAdvice();

		expect(store.adviceError).toBe(false);
		expect(store.advice).not.toBeNull();
	});
});
