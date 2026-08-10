import { describe, expect, it } from 'vitest';
import {
	calculateRemainingDay,
	type RemainingDayInput,
} from '$lib/business/model/metric/remaining-day';
import {
	calculateInterleavedOrder,
	calculateSuggestedTasks,
} from '$lib/business/model/metric/calculation';
import { DEFAULT_CAPACITY_POOLS, DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import type { Task } from '$lib/data/type';

function makeTask(overrides: Partial<Task> & { id: number; title: string }): Task {
	return {
		physicalDifficulty: 5,
		mentalDifficulty: 5,
		enjoyment: 5,
		createdAt: '2026-08-10',
		completed: false,
		...overrides,
	};
}

function input(
	tasks: Task[],
	workedHours: [number, number][],
	overrides: Partial<RemainingDayInput> = {},
): RemainingDayInput {
	return {
		tasks,
		availableHours: 6,
		switchCost: 0.25,
		pools: DEFAULT_CAPACITY_POOLS,
		constants: DEFAULT_USER_CONSTANTS,
		workedHours: new Map(workedHours),
		...overrides,
	};
}

const SPEC = makeTask({
	id: 1,
	title: 'Write spec',
	mentalDifficulty: 8,
	physicalDifficulty: 1,
	enjoyment: 7,
});

const GYM = makeTask({
	id: 2,
	title: 'Gym',
	mentalDifficulty: 1,
	physicalDifficulty: 8,
	enjoyment: 4,
});

const EMAIL = makeTask({
	id: 3,
	title: 'Email',
	mentalDifficulty: 3,
	physicalDifficulty: 1,
	enjoyment: 2,
});

describe('calculateRemainingDay (MATH.md §35)', () => {
	it('has nothing to say before any hours are logged', () => {
		// Completion is not an hours instrument: only a 🪫 log is. A day with no
		// logs is a day the plan already describes.
		expect(calculateRemainingDay(input([SPEC, GYM, EMAIL], []))).toBeNull();

		expect(
			calculateRemainingDay(
				input(
					[
						{
							...SPEC,
							completed: true,
						},
						GYM,
						EMAIL,
					],
					[],
				),
			),
		).toBeNull();
	});

	it('spends the budget on hours worked, whoever worked them', () => {
		const remaining = calculateRemainingDay(input([SPEC, GYM, EMAIL], [[1, 2.5]]));

		expect(remaining?.workedHours).toBe(2.5);
		expect(remaining?.remainingHours).toBe(3.5);
	});

	it('leaves no budget once the day has been overrun', () => {
		const remaining = calculateRemainingDay(input([SPEC, GYM], [[1, 7]]));

		expect(remaining?.remainingHours).toBe(0);
		expect(remaining?.hoursByTask.size).toBe(0);
		expect(remaining?.plannedHours).toBe(0);
	});

	it('does not move another task when an unlogged task is ticked done', () => {
		// Ticking a box is not an hours instrument, so it cannot be evidence that
		// the day has time it did not have a moment ago. A task finished without a
		// 🪫 log stays in the candidate set and keeps drawing its share, which is
		// the day's presumption that it cost what was suggested — so every other
		// row's number is unchanged, exactly, not approximately (MATH.md §35).
		const day = [SPEC, GYM, EMAIL];

		const before = calculateRemainingDay(
			input(day, [[SPEC.id, 1]], {
				availableHours: 4.25,
			}),
		);

		const after = calculateRemainingDay(
			input(
				day.map((task) =>
					task.id === GYM.id
						? {
								...task,
								completed: true,
							}
						: task,
				),
				[[SPEC.id, 1]],
				{
					availableHours: 4.25,
				},
			),
		);

		expect(before?.hoursByTask.get(EMAIL.id)).toBeGreaterThan(0);
		expect(after?.hoursByTask.get(EMAIL.id)).toBe(before?.hoursByTask.get(EMAIL.id));
		expect(after?.remainingHours).toBe(before?.remainingHours);

		// Its own share is the accounting device and is not reported: the row would
		// otherwise be told to spend more hours on a task the user just finished.
		expect(before?.hoursByTask.get(GYM.id)).toBeGreaterThan(0);
		expect(after?.hoursByTask.has(GYM.id)).toBe(false);
		expect(after!.plannedHours).toBeLessThan(before!.plannedHours);
	});

	it('drops a completed task that was logged, keeping its hours spent', () => {
		// The plan said 2h; it took 4. The two open tasks are re-planned over the
		// two hours that are genuinely left, not over the plan's remainder. Logged
		// is what earns the drop — the hours are known, so nothing is refunded.
		const remaining = calculateRemainingDay(
			input(
				[
					{
						...SPEC,
						completed: true,
					},
					GYM,
					EMAIL,
				],
				[[SPEC.id, 4]],
			),
		);

		expect(remaining?.remainingHours).toBe(2);
		expect(remaining?.hoursByTask.has(SPEC.id)).toBe(false);
		expect(remaining?.plannedHours).toBeGreaterThan(0);
		expect(remaining?.plannedHours).toBeLessThanOrEqual(2);
	});

	it('offers nothing more to an open task already worked past its stopping time', () => {
		const [alone] = calculateSuggestedTasks([EMAIL], 8);

		const remaining = calculateRemainingDay(
			input([EMAIL], [[EMAIL.id, alone.optimalHours + 1]], {
				availableHours: 12,
			}),
		);

		expect(alone.suggestedHours).toBeGreaterThan(0);
		expect(remaining?.hoursByTask.get(EMAIL.id) ?? 0).toBe(0);
	});

	it('re-plans from the prefix rather than cold, which is the whole item', () => {
		// What the budget slider gives today is the second solve: the same hours
		// left, but every task back at zero, so the long session still collects
		// its activation bonus. The prefix plan must not agree with it.
		const day = [SPEC, GYM, EMAIL];

		const remaining = calculateRemainingDay(
			input(day, [[SPEC.id, 3]], {
				availableHours: 9,
			}),
		);

		const cold = calculateSuggestedTasks(day, 6);
		const coldSpec = cold.find((task) => task.id === SPEC.id)?.suggestedHours ?? 0;

		expect(coldSpec).toBeGreaterThan(0);
		expect(remaining?.hoursByTask.get(SPEC.id) ?? 0).toBeLessThan(coldSpec);
	});

	it('stops funding once the worked hours have exhausted a capacity pool', () => {
		// 0.8 cognitive weight × 5 h spends the whole 4-hour cognitive pool, so
		// nothing that draws on it is fundable today however many clock hours are
		// left — and every task in this fixture does. A task with mentalDifficulty 0
		// would still be fundable, which is the reading working, not leaking.
		const remaining = calculateRemainingDay(
			input([SPEC, GYM, EMAIL], [[SPEC.id, 5]], {
				availableHours: 12,
			}),
		);

		expect(remaining?.remainingHours).toBe(7);
		expect(remaining?.plannedHours).toBe(0);
	});

	it('ignores logs against tasks that are not on the day', () => {
		const remaining = calculateRemainingDay(input([SPEC, GYM], [[99, 3]]));

		expect(remaining).toBeNull();
	});

	it("charges the day's switch bill, not the afternoon's", () => {
		// A task with hours on it is one the DAY ran, so abandoning it mid-day does
		// not refund its switch. Without this the remainder buys extra blocks with a
		// bill it never pays, and the re-plan invents a gain on a day that went
		// perfectly (MATH.md §35).
		for (const worked of [
			[[1, 1] as [number, number]],
			[
				[1, 1],
				[2, 0.5],
			] as [number, number][],
			[
				[1, 1],
				[2, 0.5],
				[3, 0.75],
			] as [number, number][],
		]) {
			const day = [SPEC, GYM, EMAIL];
			// Tight on purpose: the bill only shows up in the answer on a day whose
			// budget the remainder actually exhausts.
			const budget = 4;

			const remaining = calculateRemainingDay(
				input(day, worked, {
					availableHours: budget,
				}),
			);

			const dayFunded = new Set<number>([
				...worked.filter(([, hours]) => hours > 0).map(([id]) => id),
				...(remaining?.hoursByTask.keys() ?? []),
			]);

			const bill = dayFunded.size > 1 ? (dayFunded.size - 1) * 0.25 : 0;
			const spent = (remaining?.workedHours ?? 0) + (remaining?.plannedHours ?? 0) + bill;

			expect(spent).toBeLessThanOrEqual(budget + 1e-9);
		}

		// The same bill for a task that was worked and then ticked done: it never
		// reaches the allocator as a candidate, so its switch is charged separately.
		const finished = calculateRemainingDay(
			input(
				[
					{
						...SPEC,
						completed: true,
					},
					GYM,
					EMAIL,
				],
				[[SPEC.id, 1]],
				{
					availableHours: 4,
				},
			),
		);

		const dayFunded = new Set<number>([SPEC.id, ...(finished?.hoursByTask.keys() ?? [])]);

		expect(
			(finished?.workedHours ?? 0) + (finished?.plannedHours ?? 0) + (dayFunded.size - 1) * 0.25,
		).toBeLessThanOrEqual(4 + 1e-9);
	});

	it('names nothing to do next once the remainder funds nothing', () => {
		const remaining = calculateRemainingDay(input([SPEC, GYM], [[SPEC.id, 7]]));

		expect(remaining?.hoursByTask.size).toBe(0);
		expect(remaining?.nextTask).toBeNull();
	});

	it('never names a task the remainder does not fund', () => {
		// The accounting share of a task ticked done without a log is solved and
		// never reported (MATH.md §35) — naming it would tell the user to go back to
		// work they just finished.
		const remaining = calculateRemainingDay(
			input(
				[
					SPEC,
					{
						...GYM,
						completed: true,
					},
					EMAIL,
				],
				[[SPEC.id, 1]],
				{
					availableHours: 4.25,
				},
			),
		);

		expect(remaining?.nextTask?.id).not.toBe(GYM.id);
		expect(remaining?.hoursByTask.has(remaining!.nextTask!.id)).toBe(true);
	});

	it('names position 1 of the RE-PLANNED order, not of the morning plan', () => {
		// The whole reason to open the app at 2pm: the plan's `#1` badge is the 8am
		// answer and stays it (§11.8), so a task worked past its own stopping time is
		// still first in the morning order while the remainder has nothing left to
		// give it.
		const day = [SPEC, GYM, EMAIL];
		const morning = calculateSuggestedTasks(day, 12);
		const [morningFirst] = calculateInterleavedOrder(morning);
		const spec = morning.find((task) => task.id === SPEC.id)!;

		const remaining = calculateRemainingDay(
			// Just past T*, not far past: an hour over would also drain the cognitive
			// pool, and then the remainder funds nothing at all for a different reason.
			input(day, [[SPEC.id, spec.optimalHours + 0.25]], {
				availableHours: 12,
			}),
		);

		expect(morningFirst.id).toBe(SPEC.id);
		expect(remaining?.hoursByTask.get(SPEC.id) ?? 0).toBe(0);
		expect([GYM.id, EMAIL.id]).toContain(remaining?.nextTask?.id);
	});

	it('never plans more hours than are left', () => {
		for (const worked of [0.25, 1, 2.5, 4, 5.75]) {
			const remaining = calculateRemainingDay(input([SPEC, GYM, EMAIL], [[1, worked]]));

			expect(remaining?.plannedHours).toBeLessThanOrEqual(remaining!.remainingHours + 1e-9);
		}
	});
});
