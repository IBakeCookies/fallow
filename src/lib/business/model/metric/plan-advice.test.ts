import { describe, expect, it } from 'vitest';
import {
	calculateDailyMetrics,
	type DailyMetrics,
	type DailyMetricsInput,
} from '$lib/business/model/metric/daily-metrics';
import {
	ADVICE_AXES,
	suggestPlanAdjustments,
	type AdviceAxis,
	type AdviceOption,
	type PlanAdvice,
} from '$lib/business/model/metric/plan-advice';
import { DEFAULT_CAPACITY_POOLS, DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
import type { Task } from '$lib/data/type';

function makeTask(overrides: Partial<Task> & { id: number; title: string }): Task {
	return {
		physicalDifficulty: 5,
		mentalDifficulty: 5,
		enjoyment: 5,
		createdAt: '2026-07-27',
		completed: false,
		...overrides,
	};
}

function input(tasks: Task[], overrides: Partial<DailyMetricsInput> = {}): DailyMetricsInput {
	return {
		tasks,
		availableHours: 8,
		switchCost: 0.25,
		pools: DEFAULT_CAPACITY_POOLS,
		constants: DEFAULT_USER_CONSTANTS,
		energyParams: DEFAULT_ENERGY_PARAMS,
		...overrides,
	};
}

// A deliberately punishing day: hard, joyless work against a budget longer than
// the plan wants, which is what drives burnout risk, friction and grind up.
const GRIND = [
	makeTask({
		id: 1,
		title: 'Tax return',
		mentalDifficulty: 10,
		physicalDifficulty: 2,
		enjoyment: 1,
	}),
	makeTask({
		id: 2,
		title: 'Migrate the database',
		mentalDifficulty: 9,
		physicalDifficulty: 1,
		enjoyment: 2,
	}),
	makeTask({
		id: 3,
		title: 'Move the boxes',
		mentalDifficulty: 2,
		physicalDifficulty: 9,
		enjoyment: 2,
	}),
];

const grindDay = (availableHours = 10) =>
	input(GRIND, {
		availableHours,
	});

function findingFor(advice: PlanAdvice, axis: AdviceAxis) {
	return advice.findings.find((finding) => finding.axis === axis);
}

/** The same lower-is-better reading the model orders candidates by (MATH.md §14). */
function badnessOf(axis: AdviceAxis, value: number): number {
	if (axis === 'energyBalance') return Math.abs(value - 50);

	if (axis === 'scheduleIntegrity') return -value;

	return value;
}

/** The same nine readings the model searches over (MATH.md §14). */
function readAxis(metrics: DailyMetrics, axis: AdviceAxis): number {
	if (axis === 'humanCapacity') return metrics.humanCapacity.percent;

	return metrics[axis];
}

function everyOption(advice: PlanAdvice): AdviceOption[] {
	return advice.findings.flatMap((finding) =>
		finding.unpriced ? [...finding.options, finding.unpriced] : finding.options,
	);
}

function budgetLevers(advice: PlanAdvice): number[] {
	return everyOption(advice)
		.filter((option) => option.lever.kind === 'set-budget')
		.map((option) => (option.lever.kind === 'set-budget' ? option.lever.hours : -1));
}

describe('suggestPlanAdjustments', () => {
	it('has nothing to suggest for an empty day instead of throwing', () => {
		const advice = suggestPlanAdjustments(
			input([], {
				availableHours: 0,
			}),
		);

		expect(advice.findings).toEqual([]);
		expect(advice.unfundedTaskIds).toEqual([]);
		expect(advice.planValue).toBe(0);
	});

	it('evaluates one candidate per active task plus the budget levers', () => {
		const advice = suggestPlanAdjustments(grindDay());

		// 3 tasks + at most 3 budget levers (trim / −1h / +1h, deduplicated).
		expect(advice.candidatesEvaluated).toBeGreaterThanOrEqual(GRIND.length + 1);
		expect(advice.candidatesEvaluated).toBeLessThanOrEqual(GRIND.length + 3);
	});

	it('never offers to defer a completed task', () => {
		const advice = suggestPlanAdjustments(
			input(
				GRIND.map((task) =>
					task.id === 1
						? {
								...task,
								completed: true,
							}
						: task,
				),
				{
					availableHours: 10,
				},
			),
		);

		const deferred = everyOption(advice)
			.filter((option) => option.lever.kind === 'defer-task')
			.map((option) => (option.lever.kind === 'defer-task' ? option.lever.taskId : -1));

		expect(deferred).not.toContain(1);
		expect(deferred.length).toBeGreaterThan(0);
	});

	// The one thing the model knows about obligation (MATH.md §14): a flagged task
	// is not a candidate at all. Nothing else about it changes.
	it('never offers to defer a task flagged mustDoToday', () => {
		const advice = suggestPlanAdjustments(
			input(
				GRIND.map((task) =>
					task.id === 1
						? {
								...task,
								mustDoToday: true,
							}
						: task,
				),
				{
					availableHours: 10,
				},
			),
		);

		const deferred = everyOption(advice)
			.filter((option) => option.lever.kind === 'defer-task')
			.map((option) => (option.lever.kind === 'defer-task' ? option.lever.taskId : -1));

		expect(deferred).not.toContain(1);

		expect(advice.candidatesEvaluated).toBe(
			suggestPlanAdjustments(grindDay()).candidatesEvaluated - 1,
		);
	});

	// The flag is persisted, so a hand-edited or restored value can be anything.
	it('treats a non-boolean mustDoToday as not flagged rather than trusting it', () => {
		const advice = suggestPlanAdjustments(
			input(
				GRIND.map((task) =>
					task.id === 1
						? {
								...task,
								mustDoToday: 'yes' as unknown as boolean,
							}
						: task,
				),
				{
					availableHours: 10,
				},
			),
		);

		expect(advice.candidatesEvaluated).toBe(suggestPlanAdjustments(grindDay()).candidatesEvaluated);
	});

	it('falls back to the budget levers when every task must happen today', () => {
		const advice = suggestPlanAdjustments(
			input(
				GRIND.map((task) => ({
					...task,
					mustDoToday: true,
				})),
				{
					availableHours: 10,
				},
			),
		);

		const kinds = everyOption(advice).map((option) => option.lever.kind);

		expect(kinds).not.toContain('defer-task');
		expect(advice.candidatesEvaluated).toBeGreaterThan(0);
	});

	// The whole point of re-solving instead of guessing: an option's reading must
	// be what the model actually reports once that lever is pulled.
	it('reports readings the model reproduces when the lever is applied', () => {
		const base = grindDay();
		const advice = suggestPlanAdjustments(base);
		const finding = findingFor(advice, 'burnoutRisk');
		const option = finding?.options[0] ?? finding?.unpriced;

		expect(option).toBeDefined();

		const lever = option!.lever;

		const applied =
			lever.kind === 'defer-task'
				? calculateDailyMetrics({
						...base,
						tasks: base.tasks.filter((task) => task.id !== lever.taskId),
					})
				: calculateDailyMetrics({
						...base,
						availableHours: lever.hours,
					});

		expect(applied.burnoutRisk).toBe(option!.after);
		expect(applied.zenithGain.optimized).toBe(option!.planValue);
		expect(applied.dailyQuadrant).toBe(option!.quadrant);
	});

	it('only offers options that improve the axis they are filed under', () => {
		const advice = suggestPlanAdjustments(grindDay());

		expect(advice.findings.length).toBeGreaterThan(0);

		const notImproving = advice.findings.flatMap((finding) =>
			(finding.unpriced ? [...finding.options, finding.unpriced] : finding.options).filter(
				(option) =>
					badnessOf(finding.axis, option.after) >= badnessOf(finding.axis, finding.before),
			),
		);

		expect(notImproving).toEqual([]);
	});

	// The frontier is what makes the menu honest: a bigger improvement may cost
	// more plan value, but no option may be beaten on BOTH counts.
	it('returns a Pareto frontier — no option is dominated by another on its axis', () => {
		const advice = suggestPlanAdjustments(grindDay());

		const dominated = advice.findings.flatMap((finding) =>
			finding.options.filter((option) =>
				finding.options.some(
					(other) =>
						other !== option &&
						badnessOf(finding.axis, other.after) <= badnessOf(finding.axis, option.after) &&
						other.planValue > option.planValue,
				),
			),
		);

		expect(dominated).toEqual([]);
	});

	// 6h and not the usual 10: at 10 the trim already carries both the biggest
	// improvement and the highest plan value on every axis, so every priced
	// frontier is a single option and the ordering is vacuous.
	it('orders options by decreasing improvement and increasing plan value', () => {
		const advice = suggestPlanAdjustments(grindDay(6));
		const multi = advice.findings.filter((finding) => finding.options.length > 1);

		expect(multi.length).toBeGreaterThan(0);

		const outOfOrder = multi.flatMap((finding) =>
			finding.options.filter(
				(option, index) => index > 0 && option.planValue <= finding.options[index - 1].planValue,
			),
		);

		expect(outOfOrder).toEqual([]);
	});

	it('offers to trim a budget the plan cannot spend, and prices it', () => {
		// 14h against three tasks the optimizer stops well short of: slack is large,
		// so "declare only the hours the plan uses" must be a candidate.
		const base = grindDay(14);
		const baseline = calculateDailyMetrics(base);

		expect(baseline.planSlackHours).toBeGreaterThan(1);

		const advice = suggestPlanAdjustments(base, baseline);

		expect(budgetLevers(advice)).toContain(14 - baseline.planSlackHours);
	});

	// Trimming unspendable hours changes no allocation, so it must cost nothing —
	// the case that proves the cost figure is not a fudge.
	it('prices a pure budget trim at zero plan value', () => {
		const base = grindDay(14);
		const baseline = calculateDailyMetrics(base);
		const trimTo = 14 - baseline.planSlackHours;
		const advice = suggestPlanAdjustments(base, baseline);

		const trim = everyOption(advice).find(
			(option) => option.lever.kind === 'set-budget' && option.lever.hours === trimTo,
		);

		expect(trim?.planValueDeltaPercent).toBe(0);
	});

	it('lists the active tasks the plan funds no hours for', () => {
		// One block of budget cannot fund three tasks; the unfunded ones are the
		// most direct advice available and need no search.
		const base = grindDay(0.5);
		const baseline = calculateDailyMetrics(base);
		const advice = suggestPlanAdjustments(base, baseline);
		const unfunded = baseline.activeTasks.filter((task) => task.suggestedHours <= 0);

		expect(advice.unfundedTaskIds).toEqual(unfunded.map((task) => task.id));
		expect(advice.unfundedTaskIds.length).toBeGreaterThan(0);
	});

	it('files every finding under a known axis, in axis order, with options', () => {
		const advice = suggestPlanAdjustments(grindDay());
		const order = advice.findings.map((finding) => ADVICE_AXES.indexOf(finding.axis));

		expect(order).toEqual([...order].sort((a, b) => a - b));
		expect(order.every((index) => index >= 0)).toBe(true);

		expect(
			advice.findings.every((finding) => finding.options.length > 0 || finding.unpriced !== null),
		).toBe(true);
	});

	// A zero pool with demand on it makes Human Capacity read Infinity
	// (calculateHumanCapacity). Infinity − Infinity is NaN, so the axis must
	// simply produce no options rather than a garbage frontier.
	it('does not produce NaN options when a capacity pool is zero', () => {
		const advice = suggestPlanAdjustments(
			input(GRIND, {
				availableHours: 8,
				pools: {
					cognitiveHours: 0,
					physicalHours: 0,
				},
			}),
		);

		const broken = everyOption(advice).filter(
			(option) => Number.isNaN(option.after) || Number.isNaN(option.planValueDeltaPercent),
		);

		expect(broken).toEqual([]);
	});

	it('is deterministic — the same input yields the same advice', () => {
		expect(suggestPlanAdjustments(grindDay())).toEqual(suggestPlanAdjustments(grindDay()));
	});

	// MATH.md §14.1-1. Σ P̄ rises with the budget, so a budget increase inside the
	// frontier would out-value every defer and dominate the whole menu — which on
	// 99 of 1580 probe frontiers reduced the advice to "work an extra hour".
	it('never files a budget increase inside the priced frontier', () => {
		for (const hours of [4, 6, 8, 10, 14]) {
			const advice = suggestPlanAdjustments(grindDay(hours));

			const raises = advice.findings.flatMap((finding) =>
				finding.options.filter(
					(option) => option.lever.kind === 'set-budget' && option.lever.hours > hours,
				),
			);

			expect(raises).toEqual([]);
		}
	});

	// The regression itself: the extra hour must not silence a defer that helps.
	it('keeps improving defers on an axis a budget increase also improves', () => {
		const base = grindDay(6);
		const baseline = calculateDailyMetrics(base);
		const advice = suggestPlanAdjustments(base, baseline);
		const withUnpriced = advice.findings.filter((finding) => finding.unpriced !== null);

		expect(withUnpriced.length).toBeGreaterThan(0);

		// Every axis the extra hour improves and a defer also improves must still
		// list that defer; `unpriced` is reported beside the frontier, not in it.
		const deferrable = withUnpriced.filter((finding) =>
			baseline.activeTasks.some((task) => {
				const metrics = calculateDailyMetrics({
					...base,
					tasks: base.tasks.filter((other) => other.id !== task.id),
				});

				return (
					badnessOf(finding.axis, readAxis(metrics, finding.axis)) <
					badnessOf(finding.axis, finding.before)
				);
			}),
		);

		expect(deferrable.length).toBeGreaterThan(0);
		expect(deferrable.every((finding) => finding.options.length > 0)).toBe(true);
	});

	// MATH.md §14.1-2. A 5-minute switch cost puts the slack off the quarter-hour
	// grid; rounding the trim to quarters cut into funded time (58/200 probe days)
	// or deleted the lever (50/200).
	it('trims to exactly the hours the plan spends, unrounded', () => {
		const base = input(GRIND, {
			availableHours: 9,
			// 10 minutes: two switches make the overhead 1/3 h, so no quarter-hour
			// trim exists.
			switchCost: 1 / 6,
		});

		const baseline = calculateDailyMetrics(base);
		const trimTo = baseline.budgetHours - baseline.planSlackHours;

		expect(Math.abs(trimTo * 4 - Math.round(trimTo * 4))).toBeGreaterThan(1e-9);

		const advice = suggestPlanAdjustments(base, baseline);

		const trim = everyOption(advice).find(
			(option) => option.lever.kind === 'set-budget' && option.lever.hours === trimTo,
		);

		expect(trim).toBeDefined();
		// Unspendable hours, so the allocation — and therefore the value — is
		// untouched. The rounded lever was not free.
		expect(trim!.planValueDeltaPercent).toBe(0);
	});

	it('drops a budget lever less than a minute from the current budget', () => {
		// A plan that spends its whole budget leaves float-noise slack, and
		// "set the budget to what it already is" is not advice.
		const base = grindDay(2.25);
		const baseline = calculateDailyMetrics(base);

		expect(baseline.planSlackHours).toBeLessThan(1 / 60);

		const advice = suggestPlanAdjustments(base, baseline);

		expect(budgetLevers(advice)).not.toContain(baseline.budgetHours);

		expect(
			budgetLevers(advice).filter((hours) => Math.abs(hours - baseline.budgetHours) < 1 / 60),
		).toEqual([]);
	});

	// MATH.md §14.1-3. With no baseline value there is no ratio; reporting 0 made
	// the card render a real gain as "costs no plan value".
	it('reports a null delta rather than 0% when the plan has no value to lose', () => {
		const base = input(GRIND, {
			availableHours: 0,
		});

		const baseline = calculateDailyMetrics(base);
		const advice = suggestPlanAdjustments(base, baseline);

		expect(baseline.zenithGain.optimized).toBe(0);

		const gains = everyOption(advice).filter((option) => option.planValue > 0);

		expect(gains.length).toBeGreaterThan(0);
		expect(gains.every((option) => option.planValueDeltaPercent === null)).toBe(true);
	});
});
