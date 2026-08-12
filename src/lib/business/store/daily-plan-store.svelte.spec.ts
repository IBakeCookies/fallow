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
import type { DailyMetrics } from '$lib/business/model/metric/daily-metrics';
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

/**
 * The `DailyMetrics` fields a completion is ALLOWED to move (MATH.md §11.8:
 * progress and next-up scope). Everything else is plan-scoped and frozen — so a
 * metric added to `DailyMetrics` is frozen until it is listed here deliberately.
 */
const RESPONDS_TO_COMPLETION: ReadonlySet<string> = new Set<keyof DailyMetrics>([
	// The plan array carries each task's own `completed` flag, so it necessarily
	// differs; the HOURS it allocates must not, asserted separately.
	'suggestedTasks',
	'activeTasks',
	'runOrder',
	'remainingSuggestedHours',
	'completedTasks',
	// Progress scope — these exist in order to move.
	'completionRate',
	'yieldIndex',
	// Next-up scope — what is still ahead of you.
	'bottleneckTask',
	'longestWarmUp',
	'momentum',
	'quickWins',
]);

function planScoped(daily: DailyMetrics): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(daily).filter(([field]) => !RESPONDS_TO_COMPLETION.has(field)),
	);
}

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

	// The §11.8 scope split is DECIDED HERE, not in the model:
	// `calculateDailyMetrics` scopes each metric within whatever task list it is
	// handed, and this store hands it `session.tasks` — the full day, completed
	// included. `session.activeTasks` exists right next to it, so the slip is one
	// word wide, invisible to every model-layer test (scope is the caller's
	// choice), and it moves every plan-scoped metric the moment a box is ticked.
	// That is the regression that produced this invariant: Burnout Risk RISING
	// when work got done.
	it('freezes every plan-scoped metric when a task is checked done', () => {
		const store = setup();

		mockSession.tasks = [
			task(1, 'deep work'),
			task(2, 'boxing', {
				physicalDifficulty: 9,
				mentalDifficulty: 2,
			}),
			task(3, 'inbox', {
				mentalDifficulty: 3,
				physicalDifficulty: 1,
				enjoyment: 2,
			}),
		];

		flushSync();

		const frozen = planScoped(store.daily);
		const allocation = store.daily.suggestedTasks.map((t) => [t.id, t.suggestedHours]);
		expect(store.daily.burnoutRisk).toBeGreaterThan(0);

		mockSession.tasks = mockSession.tasks.map((t) =>
			t.id === 2
				? {
						...t,
						completed: true,
					}
				: t,
		);

		flushSync();

		expect(planScoped(store.daily)).toEqual(frozen);
		expect(store.daily.suggestedTasks.map((t) => [t.id, t.suggestedHours])).toEqual(allocation);

		// ...and the progress side did respond, so the freeze above is not vacuous.
		expect(store.daily.completedTasks).toBe(1);
		expect(store.daily.activeTasks).toHaveLength(2);
		expect(store.daily.completionRate).toBeGreaterThan(0);
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

	/* MATH.md §33: the α and r fits read only logs dated strictly before the
	   planned day, on the same rule as the ϕ fit — a 🪫 rating made mid-day must
	   not move the parameters the day it is being executed under. The distinction
	   that keeps this from being blunt is identity vs state: today's rating stops
	   moving α, and still drains the reservoirs everywhere the simulation reads
	   it (§11.9 below, §8.11's advisor). */
	it('leaves the viewed day’s own 🪫/☕ logs out of its parameter fit', () => {
		const store = setup();
		mockSession.tasks = [task(1, 'deep work'), task(2, 'more deep work')];
		mockSession.availableHours = 4;
		flushSync();
		const onDefaults = store.daily.burnoutRisk;

		// The very records that moved the fit above, re-dated onto the planned day.
		mockObservations.drainObservations = [
			drainRecord({
				date: mockSession.selectedDate,
			}),
			drainRecord({
				date: mockSession.selectedDate,
				hours: 2,
				mindDrain: 8,
			}),
		];

		mockObservations.restObservations = [
			restRecord({
				date: mockSession.selectedDate,
			}),
		];

		flushSync();

		expect(store.daily.burnoutRisk).toBe(onDefaults);
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
		expect(store.isAdviceStale).toBe(false);

		await store.computeAdvice();

		expect(store.advice?.candidatesEvaluated).toBeGreaterThan(0);
		expect(store.isAdviceBusy).toBe(false);
		expect(store.isAdviceStale).toBe(false);
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

		expect(store.isAdviceStale).toBe(true);

		await store.computeAdvice();

		expect(store.isAdviceStale).toBe(false);
	});

	// The day can also change by being a different day, which the model inputs
	// cannot see: `selectedDate` follows the live clock and the URL, and
	// `loadSession` is async, so both a navigation and the midnight tick move the
	// day while the previous day's tasks are still in memory. Fingerprinting the
	// inputs alone reports FRESH through that window — advice priced for a day
	// that is gone, with its buttons live.
	it('marks advice stale when the viewed day moves under an unchanged task list', async () => {
		const store = setup();

		mockSession.tasks = [task(1, 'tax return')];
		mockSession.availableHours = 10;
		flushSync();
		await store.computeAdvice();

		mockSession.selectedDate = '2026-07-21';
		flushSync();

		expect(store.isAdviceStale).toBe(true);
	});

	// The busy guard drops a second request instead of queueing it — safe only
	// because the in-flight run reads its input AFTER the pre-solve yield, so it
	// solves the day as it stands, not as it stood when the button was clicked.
	it('ignores a second request while one is in flight, and solves the freshest day', async () => {
		const store = setup();
		mockSession.tasks = [task(1, 'deep work')];
		flushSync();

		const first = store.computeAdvice();
		expect(store.isAdviceBusy).toBe(true);
		const second = store.computeAdvice();

		// The day changes during the yield: the in-flight run must pick it up.
		mockSession.availableHours = 6;
		flushSync();

		await Promise.all([first, second]);

		expect(suggestPlanAdjustments).toHaveBeenCalledTimes(1);
		expect(store.isAdviceStale).toBe(false);
	});

	// The only caller is a fire-and-forget click handler, so a failed solve must
	// land in hasAdviceError (and reset busy) instead of an unhandled rejection.
	it('reports a failed solve and recovers on the next one', async () => {
		const store = setup();
		mockSession.tasks = [task(1, 'deep work')];
		flushSync();

		vi.mocked(suggestPlanAdjustments).mockImplementationOnce(() => {
			throw new Error('solver blew up');
		});

		await store.computeAdvice();

		expect(store.hasAdviceError).toBe(true);
		expect(store.isAdviceBusy).toBe(false);
		expect(store.advice).toBeNull();

		await store.computeAdvice();

		expect(store.hasAdviceError).toBe(false);
		expect(store.advice).not.toBeNull();
	});

	// ROADMAP item 21. Where every defer lever on the card sends a task, read once
	// per advice run — day-level, so it is one reading for the card and not one per
	// lever.
	describe('the defer destination', () => {
		const destinationDate = '2026-07-21'; // the mock's `selectedDate` + 1

		const tomorrow = {
			taskCount: 4,
			budgetHours: 6,
			fundedCount: 3,
		};

		it('reads the destination alongside the advice', async () => {
			const store = setup();
			mockSession.tasks = [task(1, 'tax return')];
			mockSession.deferDestination = tomorrow;
			flushSync();

			expect(store.deferDestination).toBeNull();

			await store.computeAdvice();

			expect(store.deferDestination).toEqual(tomorrow);
		});

		// The advice is priced on today and still correct without it, so a refused or
		// failed destination read costs the line and never the card.
		it('keeps the advice when the destination read answers nothing', async () => {
			const store = setup();
			mockSession.tasks = [task(1, 'tax return')];
			flushSync();
			await store.computeAdvice();

			expect(store.advice).not.toBeNull();
			expect(store.hasAdviceError).toBe(false);
			expect(store.deferDestination).toBeNull();
		});

		/* The advice fingerprint cannot cover a reading about ANOTHER day: it is a
		   value over the VIEWED day's inputs, so today → tomorrow (edit it) → today
		   fingerprints identically and the destination line would keep claiming a day
		   the user just changed. The destination date's own write count is what sees
		   that. */
		it('withdraws the destination once its own day is written, with the advice still fresh', async () => {
			const store = setup();
			mockSession.tasks = [task(1, 'tax return')];
			mockSession.deferDestination = tomorrow;
			flushSync();
			await store.computeAdvice();

			mockSession.writeGenerations.set(destinationDate, 1);
			flushSync();

			expect(store.deferDestination).toBeNull();
			expect(store.isAdviceStale).toBe(false);
			expect(store.advice).not.toBeNull();
		});

		/* Only a write to the DESTINATION day can change what this line says. Keying it
		   off every session write withdrew it on today's own autosave — so adding a task
		   and pressing Check inside the 500 ms debounce silently produced no line at
		   all, which is the common path. */
		it('keeps the destination when the viewed day is the one written', async () => {
			const store = setup();
			mockSession.tasks = [task(1, 'tax return')];
			mockSession.deferDestination = tomorrow;
			flushSync();
			await store.computeAdvice();

			mockSession.writeGenerations.set(mockSession.selectedDate, 1);
			flushSync();

			expect(store.deferDestination).toEqual(tomorrow);
		});
	});

	// MATH.md §35. The plan stays the whole intended day; this is the other
	// question, over the open tasks and the hours genuinely left.
	describe('remaining day', () => {
		// The mock's own clock, not the wall clock: the gate compares the viewed day
		// against `SessionStore.today`, so the spec drives dates and never the time.
		const today = mockSession.today;

		it('says nothing until today has hours logged against it', () => {
			const store = setup();
			mockSession.tasks = [task(1, 'deep work'), task(2, 'inbox')];
			flushSync();

			expect(store.remainingDay).toBeNull();

			// Ticking a box is not an hours instrument — only a 🪫 log is.
			mockSession.tasks = mockSession.tasks.map((t) =>
				t.id === 1
					? {
							...t,
							completed: true,
						}
					: t,
			);

			flushSync();

			expect(store.remainingDay).toBeNull();
		});

		it('has nothing to say about a day that is not today', () => {
			// Today's own logs, read while a PAST day is on screen: a finished day
			// has no remainder, and today's hours are not that day's. Only the date
			// gate can produce null here — the logs themselves are current.
			const store = setup();
			mockSession.selectedDate = '2026-07-19';
			mockSession.tasks = [task(1, 'deep work'), task(2, 'inbox')];

			mockObservations.drainObservations = [
				drainRecord({
					date: today,
					taskId: 1,
					hours: 2,
				}),
			];

			flushSync();

			expect(store.remainingDay).toBeNull();
		});

		it('re-plans the open tasks over the hours the logs leave', () => {
			const store = setup();
			mockSession.availableHours = 6;

			mockSession.tasks = [
				task(1, 'deep work', {
					completed: true,
				}),
				task(2, 'inbox', {
					mentalDifficulty: 3,
					physicalDifficulty: 1,
					enjoyment: 2,
				}),
			];

			mockObservations.drainObservations = [
				drainRecord({
					date: today,
					taskId: 1,
					hours: 4,
				}),
			];

			flushSync();

			expect(store.remainingDay?.workedHours).toBe(4);
			expect(store.remainingDay?.remainingHours).toBe(2);
			// The completed task spent the hours and is out of the running.
			expect(store.remainingDay?.hoursByTask.has(1)).toBe(false);
			expect(store.remainingDay?.hoursByTask.get(2) ?? 0).toBeGreaterThan(0);
		});

		// The item's own kill criterion (ROADMAP item 12): any plan-family row
		// that moves mid-day means the reading was wired into the wrong scope.
		it('moves no plan-scoped metric when hours are logged', () => {
			const store = setup();
			mockSession.availableHours = 6;

			mockSession.tasks = [
				task(1, 'deep work'),
				task(2, 'inbox', {
					mentalDifficulty: 3,
					physicalDifficulty: 1,
					enjoyment: 2,
				}),
			];

			flushSync();

			const frozen = planScoped(store.daily);
			const allocation = store.daily.suggestedTasks.map((t) => [t.id, t.suggestedHours]);

			mockObservations.drainObservations = [
				drainRecord({
					date: today,
					taskId: 1,
					hours: 3,
				}),
			];

			flushSync();

			expect(planScoped(store.daily)).toEqual(frozen);
			expect(store.daily.suggestedTasks.map((t) => [t.id, t.suggestedHours])).toEqual(allocation);
			// ...and the new reading did appear, so the freeze above is not vacuous.
			expect(store.remainingDay?.workedHours).toBe(3);
		});
	});
});
