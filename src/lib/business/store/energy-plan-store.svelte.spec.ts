/* A visit to the Energy Lab is held by a store that lives as long as the page: the
   plan, the list's order, the classic comparison, the budget curve, the add-task
   draft and the three fits. The (app) layout keeps what outlives a visit: the
   params, the stop observations and the stop advice `/`'s session clock reads. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { flushSync } from 'svelte';
import LabHarness from '$lib/business/store/energy-lab-store.test-harness.svelte';
import Harness from '$lib/business/store/energy-plan-store.test-harness.svelte';
import {
	drainRecord,
	mockClock,
	mockObservations,
	mockSession,
	restRecord,
} from '$lib/business/store/layout-store-mock.test-utils.svelte';
import * as settingsRepository from '$lib/data/repository/settings-repository';
import * as sessionHistory from '$lib/business/session-history';
import type { EnergyLabStore } from '$lib/business/store/energy-lab-store.svelte';
import type { EnergyPlanStore } from '$lib/business/store/energy-plan-store.svelte';
import type { Task } from '$lib/business/type';
import {
	DEFAULT_ENERGY_PARAMS,
	fitDrainRate,
	optimizeSchedule,
} from '$lib/business/model/zenith-energy';
import type * as ZenithEnergy from '$lib/business/model/zenith-energy';
import {
	calculateSuggestedTasks,
	getEffectiveDifficulty,
	toEnergyTask,
} from '$lib/business/model/metric/calculation';
import type { DraftTask } from '$lib/business/model/metric/draft-impact';
import { calculateEnergyDraftImpact } from '$lib/business/model/metric/energy-draft-impact';
import { mapEffort } from '$lib/business/model/zenith';
import { toCognitiveDrainObservations } from '$lib/business/model/energy-calibration';

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

/** The layout's Lab, mounted and loaded: what every visit reads its params from. */
async function setupLab(): Promise<EnergyLabStore> {
	let lab!: EnergyLabStore;

	render(LabHarness, {
		onstore: (s: EnergyLabStore) => (lab = s),
	});

	await vi.waitFor(() => expect(lab.isLoaded).toBe(true));

	return lab;
}

/** One visit to `/energy`; `leave` unmounts it. */
function visit(lab: EnergyLabStore) {
	let store!: EnergyPlanStore;

	const { unmount } = render(Harness, {
		lab,
		onstore: (s: EnergyPlanStore) => (store = s),
	});

	return {
		store,
		leave: unmount,
	};
}

/** The Lab loaded, then a visit on top of it. */
async function setup() {
	const lab = await setupLab();

	return {
		lab,
		...visit(lab),
	};
}

describe('EnergyPlanStore', () => {
	beforeEach(() => {
		mockSession.reset();
		mockObservations.reset();
		mockClock.reset();
		readSettingMock.mockReset().mockResolvedValue(undefined);
		updateSettingMock.mockReset().mockResolvedValue(undefined);
		readStopObservationsMock.mockReset().mockResolvedValue([]);
	});

	// Settled 2026-07-29: one budget for both planners. The window
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

		const { store } = await setup();
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

	// The Lab makes the main page's call for itself (2026-07-20): both plans
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

		const { store } = await setup();
		const blocks = store.plan.blocks;
		const valueVsClassic = store.valueVsClassic;
		expect(store.plannedHours).toBeGreaterThan(0);

		// Exact, because WHICH field the tile divides is the claim.
		// This fixture's plan works 7.5 h of the 8 (satiated 7.720 + free 0.250 +
		// terminal 1.258 = 9.228) against classic's 7.75 h (7.942 + 0.125 + 1.095
		// = 9.163): +0.72%, one per cent. Scored on raw `totalOutput` — 10.413
		// against 10.809 — the same day reads −4%, so this is one of the days the
		// two scorings disagree on in SIGN, and the pin catches the old
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

		const { store } = await setup();
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

	/** The same three on the next day: a carried task is a copy with a fresh id. */
	const carriedTasks = (): Task[] =>
		threeTasks().map((task) => ({
			...task,
			id: task.id + 10,
		}));

	/** First appearance per task across the evaluated blocks — the day's own order. */
	const plannedOrder = (store: EnergyPlanStore) => [
		...new Set(
			store.plan.evaluation.blocks
				.map((block) => block.taskId)
				.filter((id): id is number => id !== null),
		),
	];

	it('reads the list in schedule order, with the unfunded behind it', async () => {
		mockSession.tasks = threeTasks();
		mockSession.availableHours = 2;

		const { store } = await setup();
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
	it('holds the order across a re-optimization, and re-sorts on the next visit', async () => {
		mockSession.tasks = threeTasks();
		mockSession.availableHours = 2;

		const { lab, store } = await setup();
		flushSync();

		const before = store.scheduledTasks.map((t) => t.id);

		// A drag big enough to fund a different task
		lab.setParam('alphaCog', 2);
		flushSync();

		expect(store.scheduledTasks.map((t) => t.id)).toEqual(before);

		const { store: next } = visit(lab);
		flushSync();

		expect(next.scheduledTasks.map((t) => t.id).slice(0, plannedOrder(next).length)).toEqual(
			plannedOrder(next),
		);
	});

	// `addTask` puts a new task first and the card's form sits above the list, so the
	// front is where the user is looking for the row they just deployed.
	it('puts a task added after the snapshot first', async () => {
		mockSession.tasks = threeTasks();

		const { store } = await setup();
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

		const { store } = await setup();
		flushSync();

		expect(store.scheduledTasks.map((t) => t.id)).toEqual([1, 2, 3]);

		mockSession.availableHours = 2;
		flushSync();

		const scheduled = plannedOrder(store);
		expect(scheduled.length).toBeGreaterThan(0);
		expect(store.scheduledTasks.map((t) => t.id).slice(0, scheduled.length)).toEqual(scheduled);
	});

	// `/energy` takes no date, so arriving from `/?date=` moves the viewed day to today
	// while the session still holds the last one: a plan to sort by, but the wrong day's.
	it("sorts by the viewed day's plan, not the last day's still in memory", async () => {
		mockSession.loadedDate = '2026-07-21';

		mockSession.tasks = [
			{
				id: 9,
				title: 'plan the trip',
				physicalDifficulty: 1,
				mentalDifficulty: 5,
				enjoyment: 6,
				createdAt: '2026-07-21',
				completed: false,
			},
		];

		mockSession.availableHours = 2;

		const { store } = await setup();
		flushSync();

		// Today lands
		mockSession.tasks = threeTasks();
		mockSession.loadedDate = '2026-07-20';
		flushSync();

		const scheduled = plannedOrder(store);
		expect(store.scheduledTasks.map((t) => t.id).slice(0, scheduled.length)).toEqual(scheduled);
	});

	// The visit ends with the page, so a Lab left before its day had a plan cannot leave
	// the next route solving one to finish the snapshot.
	it('solves nothing once the page has left, even before its day had a plan', async () => {
		mockSession.tasks = threeTasks();
		mockSession.availableHours = 0;

		const lab = await setupLab();
		const { leave } = visit(lab);
		flushSync();

		leave();
		optimizeScheduleMock.mockClear();

		mockSession.availableHours = 2;
		flushSync();

		expect(optimizeScheduleMock).not.toHaveBeenCalled();
	});

	/* A Lab left open while its day changes under it (midnight: `/energy` takes no date)
	   re-sorts its list to the new day's plan, instead of reading the new day in the
	   store's order until the next visit. */

	// Midnight is the one day change `/energy` shows while mounted, and no row survives
	// it, so it counts as a visit.
	it("re-sorts to the new day's plan when the day changes under the open page", async () => {
		mockSession.tasks = threeTasks();
		mockSession.availableHours = 2;

		const { store } = await setup();
		flushSync();

		// The clock moves the viewed day first; the new day's read lands after
		mockSession.selectedDate = '2026-07-21';
		flushSync();

		mockSession.tasks = carriedTasks();
		mockSession.loadedDate = '2026-07-21';
		flushSync();

		const scheduled = plannedOrder(store);
		expect(store.scheduledTasks.map((t) => t.id).slice(0, scheduled.length)).toEqual(scheduled);
	});

	/* A Lab reached from the example day by its nav link lists the visitor's own day in
	   that day's plan order. It does not keep the store's order for the whole visit. */
	it('sorts the real day by its plan when the example day is left for the Lab', async () => {
		// The example day, which no stored day stands behind
		mockSession.tasks = threeTasks();
		mockSession.loadedDate = null;
		mockSession.availableHours = 2;

		const { store } = await setup();
		flushSync();

		// The visitor's own day lands under the viewed date
		mockSession.tasks = carriedTasks();
		mockSession.loadedDate = mockSession.selectedDate;
		flushSync();

		const scheduled = plannedOrder(store);
		expect(store.scheduledTasks.map((t) => t.id).slice(0, scheduled.length)).toEqual(scheduled);
	});

	/* The Lab's `Effort` column reads this, and it has to be the same number `/` prints
	   for the same task: E = mapEffort(getEffectiveDifficulty(task)) and nothing else,
	   so the two screens cannot disagree about a task's effort. */
	it('carries the same true effort the main plan reports', async () => {
		mockSession.tasks = [
			{
				id: 1,
				title: 'write the calibration section',
				physicalDifficulty: 0,
				mentalDifficulty: 8,
				enjoyment: 9,
				createdAt: '2026-07-20',
				completed: false,
			},
		];

		mockSession.availableHours = 4;

		const { store } = await setup();
		flushSync();

		// 37/9: mapEffort of an effective difficulty of 8 (no physical spillover)
		expect(store.scheduledTasks[0].trueEffort).toBeCloseTo(4.111111111111, 12);

		expect(store.scheduledTasks[0].trueEffort).toBe(
			mapEffort(getEffectiveDifficulty(mockSession.tasks[0])),
		);

		expect(store.scheduledTasks[0].trueEffort).toBe(
			calculateSuggestedTasks(mockSession.tasks, mockSession.availableHours)[0].trueEffort,
		);
	});

	// business/model/AGENTS.md: "A fit never writes params silently." The whole point of the
	// Apply button is that the sliders stay the user's.
	it('computes the fits without touching the params', async () => {
		const { lab, store } = await setup();

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

		expect(lab.params.alphaCog).toBe(DEFAULT_ENERGY_PARAMS.alphaCog);
		expect(lab.params.alphaPhys).toBe(DEFAULT_ENERGY_PARAMS.alphaPhys);
		expect(lab.params.recoveryRate).toBe(DEFAULT_ENERGY_PARAMS.recoveryRate);
		expect(store.hasFit).toBe(true);
		expect(store.fitsApplied).toBe(false);
	});

	it('copies every fit into the manual inputs when Apply is pressed', async () => {
		const { lab, store } = await setup();

		mockObservations.drainObservations = [
			drainRecord(),
			drainRecord({
				hours: 2,
				mindDrain: 8,
			}),
		];

		mockObservations.restObservations = [restRecord()];

		// A finished day with a session on it, so λ₀ has a stop to read (MATH.md §8.10).
		readStopObservationsMock.mockResolvedValue([
			{
				tasks: [
					toEnergyTask({
						id: 1,
						title: 'deep work',
						physicalDifficulty: 2,
						mentalDifficulty: 8,
						enjoyment: 5,
						createdAt: '2026-07-19',
						completed: false,
					}),
				],
				windowHours: 8,
				workedHours: [
					{
						taskId: 1,
						hours: 2.25,
					},
				],
			},
		]);

		flushSync();
		await vi.waitFor(() => expect(store.stoppingFit.fitted).toBe(true));

		const round2 = (x: number) => Math.round(x * 100) / 100;

		store.applyFits();
		flushSync();

		expect(lab.params.recoveryRate).toBe(round2(store.recoveryFit.rate));
		expect(lab.params.alphaCog).toBe(round2(store.cognitiveDrainFit.alpha));
		expect(lab.params.alphaPhys).toBe(round2(store.physicalDrainFit.alpha));
		expect(lab.params.freeTimeValue).toBe(round2(store.stoppingFit.value));
		expect(store.fitsApplied).toBe(true);
	});

	// The bug the single button exists to kill: α is only identifiable CONDITIONED
	// on r (MATH.md §8.7), so an α adopted before r is an α fitted against the old
	// recovery. Three buttons let the user reach exactly that, with a re-armed
	// button as the only tell. `applyFits` lands on the fixed point in one press —
	// α ends up at the value fitted under the ADOPTED r, not the default one.
	it('adopts the drain rates under the fitted recovery, not the default one', async () => {
		const { lab, store } = await setup();

		mockObservations.drainObservations = [
			drainRecord(),
			drainRecord({
				hours: 2,
				mindDrain: 8,
			}),
		];

		mockObservations.restObservations = [restRecord()];
		flushSync();

		expect(lab.params.recoveryRate).toBe(DEFAULT_ENERGY_PARAMS.recoveryRate);
		const alphaUnderDefaultRecovery = store.cognitiveDrainFit.alpha;

		store.applyFits();
		flushSync();

		// The conditioning genuinely bites, so the fixed-point assertion is not vacuous.
		expect(lab.params.recoveryRate).not.toBe(DEFAULT_ENERGY_PARAMS.recoveryRate);
		expect(store.cognitiveDrainFit.alpha).not.toBeCloseTo(alphaUnderDefaultRecovery, 3);

		expect(store.fitsApplied).toBe(true);
	});

	// R3: the Lab and the Burnout Risk facade must read identical logs the same
	// way — only their fit SEQUENCE differs. That is the row filter as much as
	// the mapping: an α̂ the Lab prints and applies that the plan never fits on
	// is the one drift this guard exists to catch (MATH.md §8.7).
	it('maps drain records through the shared calibration mapping', async () => {
		const { lab, store } = await setup();

		const dayOne = drainRecord({
			createdAt: 9,
		});

		const dayTwo = drainRecord({
			date: '2026-07-18',
			createdAt: 9,
			hours: 2,
			cognitiveDemand: 0.6,
			mindDrain: 7,
		});

		// The later session on day one is not a second observation — the filter
		// below is the Lab's as much as the facade's.
		mockObservations.drainObservations = [
			dayOne,
			drainRecord({
				createdAt: 17,
				hours: 2,
				mindDrain: 7,
			}),
			dayTwo,
		];

		flushSync();

		expect(store.cognitiveDrainFit).toEqual(
			fitDrainRate(
				toCognitiveDrainObservations([dayOne, dayTwo]),
				DEFAULT_ENERGY_PARAMS.alphaCog,
				lab.params,
			),
		);
	});

	// The Lab's own pair of `fitDrainRate` calls sits outside
	// `calibrateEnergyParams`, so the filter reaches it only if it was put there
	// too — and the Lab is where a user READS α̂ and presses to apply it.
	it('leaves both drain fits unmoved by a later session on a day already read', async () => {
		const { store } = await setup();

		const morning = drainRecord({
			createdAt: 9,
			hours: 1,
			mindDrain: 3,
			bodyDrain: 3,
		});

		mockObservations.drainObservations = [morning];
		flushSync();

		const firstOnly = {
			cognitive: store.cognitiveDrainFit.alpha,
			physical: store.physicalDrainFit.alpha,
		};

		mockObservations.drainObservations = [
			morning,
			drainRecord({
				createdAt: 17,
				hours: 1,
				mindDrain: 9,
				bodyDrain: 9,
			}),
		];

		flushSync();

		expect(store.cognitiveDrainFit.alpha).toBe(firstOnly.cognitive);
		expect(store.physicalDrainFit.alpha).toBe(firstOnly.physical);
	});

	// The α and r fits are identity, so they read logs dated strictly
	// before the planned day — a rating logged today moves them from tomorrow. The
	// stop advisor above keeps every row, which is the same rule's state half.
	it('leaves the drain fit unmoved by a rating logged today', async () => {
		const { store } = await setup();

		mockObservations.drainObservations = [
			drainRecord({
				date: mockSession.today,
			}),
		];

		flushSync();

		expect(store.cognitiveDrainFit.fitted).toBe(false);
		expect(store.physicalDrainFit.fitted).toBe(false);
	});

	it('fits the same rating once it is dated a day earlier', async () => {
		const { store } = await setup();

		mockObservations.drainObservations = [
			drainRecord({
				date: '2026-07-19',
			}),
		];

		flushSync();

		expect(store.cognitiveDrainFit.fitted).toBe(true);
	});

	it('leaves the recovery fit unmoved by a break logged today', async () => {
		const { store } = await setup();

		mockObservations.restObservations = [
			restRecord({
				date: mockSession.today,
			}),
		];

		flushSync();

		expect(store.recoveryFit.fitted).toBe(false);
	});

	// The Lab is a today-only instrument, so its window closes at today even while
	// the session still holds the day the user arrived from (`/?date=`).
	it('fits up to today while the session still holds an earlier day', async () => {
		const { store } = await setup();
		mockSession.selectedDate = '2026-07-19';

		mockObservations.drainObservations = [drainRecord()];
		mockObservations.restObservations = [restRecord()];
		flushSync();

		expect(store.cognitiveDrainFit.fitted).toBe(true);
		expect(store.recoveryFit.fitted).toBe(true);
	});

	// ----- Budget curve (MATH.md §8.12) -----

	const twoTasks = (): Task[] => [
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

	it('sweeps nothing until asked, then holds the curve', async () => {
		mockSession.tasks = twoTasks();

		const { store } = await setup();
		expect(store.budgetCurve).toBeNull();
		expect(store.isCurveStale).toBe(false);
		expect(store.hasCurveError).toBe(false);

		await store.computeBudgetCurve();

		expect(store.isCurveBusy).toBe(false);
		expect(store.budgetCurve!.points.length).toBeGreaterThan(0);
		expect(store.isCurveStale).toBe(false);
	});

	// The whole reason the sweep exists: it is a statement about EVERY budget, so
	// the one input it must not depend on is the budget. A fingerprint that
	// included it would grey the card out on the very drag it is there to inform.
	it('does not go stale when the day window moves, only when the day does', async () => {
		mockSession.tasks = twoTasks();

		const { lab, store } = await setup();
		await store.computeBudgetCurve();

		mockSession.availableHours = 3;
		flushSync();
		expect(store.isCurveStale).toBe(false);

		lab.setParam('freeTimeValue', 1.5);
		flushSync();
		expect(store.isCurveStale).toBe(true);
	});

	// The calendar day is the other way it "does". This route is today-only, so
	// the only move it sees is the midnight tick — and there `selectedDate`
	// follows the live clock while the new day's tasks are still loading, which is
	// exactly this: the day advances and every input the sweep reads stands still.
	// Fingerprinting the inputs alone reports yesterday's curve as today's.
	it('goes stale when the calendar day rolls over under an unchanged task list', async () => {
		mockSession.tasks = twoTasks();

		const { store } = await setup();
		await store.computeBudgetCurve();

		mockSession.selectedDate = '2026-07-21';
		flushSync();

		expect(store.isCurveStale).toBe(true);
	});

	// `title` rides along on `EnergyTaskInput`, but no part of the sweep reads it
	// and no field of `BudgetCurve` carries one — so fingerprinting the whole
	// mapped task greyed out a bit-identical curve and invited a 16-solve re-run
	// every time a row was renamed (MATH.md §8.12).
	it('survives renaming a task', async () => {
		mockSession.tasks = twoTasks();

		const { store } = await setup();
		await store.computeBudgetCurve();

		const before = store.budgetCurve!;

		mockSession.tasks = mockSession.tasks.map((t) =>
			t.id === 1
				? {
						...t,
						title: 'deep work (API)',
					}
				: t,
		);

		flushSync();

		expect(store.isCurveStale).toBe(false);

		await store.computeBudgetCurve();
		expect(store.budgetCurve).toEqual(before);
	});

	// Plan-scoped, like every other reading on this page: the
	// sweep asks what the day's WORK is worth at each length, and finishing a
	// piece of it does not change the answer.
	it('survives checking a task off', async () => {
		mockSession.tasks = twoTasks();

		const { store } = await setup();
		await store.computeBudgetCurve();

		const before = store.budgetCurve!;

		mockSession.tasks = mockSession.tasks.map((t) =>
			t.id === 1
				? {
						...t,
						completed: true,
					}
				: t,
		);

		flushSync();

		expect(store.isCurveStale).toBe(false);

		await store.computeBudgetCurve();
		expect(store.budgetCurve).toEqual(before);
	});

	// ----- The add-task draft, priced on demand -----

	/* Funded on the Lab's 8 h day, so the reading has hours in it. */
	const draft: DraftTask = {
		physicalDifficulty: 9,
		mentalDifficulty: 2,
		enjoyment: 9,
	};

	const expectedImpact = (tasks: Task[], published: DraftTask) =>
		calculateEnergyDraftImpact(
			{
				tasks,
				windowHours: mockSession.availableHours,
				params: DEFAULT_ENERGY_PARAMS,
				constants: mockSession.userConstants,
			},
			published,
			optimizeSchedule(
				tasks.map(toEnergyTask),
				mockSession.availableHours,
				DEFAULT_ENERGY_PARAMS,
				mockSession.userConstants,
			),
		);

	it('prices nothing until the button asks, then holds the reading', async () => {
		mockSession.tasks = twoTasks();

		const { store } = await setup();

		store.previewDraft = draft;
		flushSync();
		expect(store.draftImpact).toBeNull();

		await store.computeDraftImpact();

		expect(store.isDraftBusy).toBe(false);
		expect(store.draftImpact).toEqual(expectedImpact(twoTasks(), draft));
	});

	/* The press prices what the form has published, which the store already holds:
	   an unnamed draft has nothing to solve, and the button is disabled there. */
	it('prices nothing while no draft is published', async () => {
		mockSession.tasks = twoTasks();

		const { store } = await setup();

		await store.computeDraftImpact();

		expect(store.draftImpact).toBeNull();
		expect(store.isDraftBusy).toBe(false);
	});

	/* A stale number beside live sliders is a number that disagrees with the
	   fields above it, so editing the draft drops the reading rather than marking
	   it stale — the panel goes back to its prompt line and the button returns. */
	it('drops the reading when the form publishes a different draft', async () => {
		mockSession.tasks = twoTasks();

		const { store } = await setup();
		store.previewDraft = draft;
		await store.computeDraftImpact();
		expect(store.draftImpact).not.toBeNull();

		store.previewDraft = {
			...draft,
			enjoyment: 3,
		};

		flushSync();

		expect(store.draftImpact).toBeNull();

		// And an emptied title, which publishes no draft at all.
		await store.computeDraftImpact();
		expect(store.draftImpact).not.toBeNull();

		store.previewDraft = null;
		flushSync();

		expect(store.draftImpact).toBeNull();
	});

	/* A keystroke in the TITLE republishes the same four ratings, because the
	   title reaches no solve at all (`prependDraft` blanks it) — so dropping the
	   reading there would charge a second press for a number that cannot have
	   moved. Identity, not equality: a recomputed reading would be a wasted solve. */
	it('keeps the reading when the republished draft carries the same ratings', async () => {
		mockSession.tasks = twoTasks();

		const { store } = await setup();
		store.previewDraft = draft;
		await store.computeDraftImpact();

		const priced = store.draftImpact;

		store.previewDraft = {
			...draft,
		};

		flushSync();

		expect(store.draftImpact).toBe(priced);
	});

	/* The press opens a yield before the solve, and the form can move the draft
	   inside it — a slider drag publishes on the next flush. The setter drops the
	   reading there, so a solve that landed anyway would put back figures for a
	   draft the fields no longer hold: the exact disagreement dropping exists to
	   prevent, and one the user cannot see is stale. */
	it('discards a solve the form has moved on from', async () => {
		mockSession.tasks = twoTasks();

		const { store } = await setup();
		store.previewDraft = draft;

		const pending = store.computeDraftImpact();

		store.previewDraft = {
			...draft,
			enjoyment: 3,
		};

		flushSync();

		await pending;

		expect(store.draftImpact).toBeNull();
		expect(store.isDraftBusy).toBe(false);
	});

	it('drops a second press while the first solve is still running', async () => {
		mockSession.tasks = twoTasks();

		const { store } = await setup();
		store.previewDraft = draft;

		const first = store.computeDraftImpact();

		// Resolves without solving: the guard returns before the yield, so the day
		// is solved once and the held reading is the first press's.
		await store.computeDraftImpact();

		expect(store.draftImpact).toBeNull();

		await first;

		expect(store.draftImpact).toEqual(expectedImpact(twoTasks(), draft));
	});
});
