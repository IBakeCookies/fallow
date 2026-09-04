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
	type AdviceLever,
	type AdviceOption,
	type PlanAdvice,
} from '$lib/business/model/metric/plan-advice';
import { calculateQuadrantMargin } from '$lib/business/model/metric/calculation';
import {
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_USER_CONSTANTS,
	type CapacityPools,
} from '$lib/business/model/zenith';
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

/** The same lower-is-better reading the model orders candidates by. */
function badnessOf(axis: AdviceAxis, value: number): number {
	if (axis === 'energyBalance') return Math.abs(value - 50);

	// Bigger-better, and correct for both of this axis's numbers: an option that
	// raises the count raises the share with it.
	if (axis === 'scheduleIntegrity' || axis === 'flowCoverage') return -value;

	return value;
}

/**
 * What the model ORDERS each axis by. Flow Coverage is the one
 * axis whose badness is not a function of the reading it prints: it ranks on the
 * count of tasks that reach ϕ and displays the share.
 */
function readAxis(metrics: DailyMetrics, axis: AdviceAxis): number {
	if (axis === 'humanCapacity') return metrics.humanCapacity.percent;

	if (axis === 'flowCoverage') return metrics.flowCoverage.reached;

	// The two sentinels, or a day whose last task is deferred reads 50 and 100
	// here while the model reads NaN and excludes it.
	if (axis === 'energyBalance')
		return metrics.cognitiveLoad + metrics.physicalLoad === 0 ? NaN : metrics.energyBalance;

	if (axis === 'scheduleIntegrity')
		return metrics.suggestedTasks.every((task) => task.suggestedHours <= 0)
			? NaN
			: metrics.scheduleIntegrity;

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

		// The axes are still all reported. What an empty day has is
		// nothing to DO about them — an empty menu everywhere, not a missing axis.
		expect(everyOption(advice)).toEqual([]);
		expect(advice.unfunded).toEqual([]);
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

	// The one thing the model knows about obligation: a flagged task
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
	});

	// The Day Profile is a hard cliff on two hour-weighted averages,
	// so a flip is only worth printing when BOTH plans stand clear of it by
	// `QUADRANT_FLIP_MARGIN` — a quarter of one slider point.
	describe('the Day Profile a lever moves the day to', () => {
		const resolve = (base: DailyMetricsInput, lever: AdviceLever) =>
			calculateDailyMetrics(
				lever.kind === 'defer-task'
					? {
							...base,
							tasks: base.tasks.filter((task) => task.id !== lever.taskId),
						}
					: {
							...base,
							availableHours: lever.hours,
						},
			);

		it('reports the re-solved profile when both sides clear the cliff', () => {
			// A small enjoyable task beside a big joyless one: the day reads grind,
			// and dropping the joyless one leaves nothing but cruise.
			const base = input([
				makeTask({
					id: 1,
					title: 'Sketching',
					mentalDifficulty: 1,
					physicalDifficulty: 1,
					enjoyment: 7,
				}),
				makeTask({
					id: 2,
					title: 'Clear the garage',
					mentalDifficulty: 5,
					physicalDifficulty: 7,
					enjoyment: 1,
				}),
			]);

			const baseline = calculateDailyMetrics(base);
			const advice = suggestPlanAdjustments(base, baseline);
			const flips = everyOption(advice).filter((option) => option.quadrantFlip !== null);

			expect(calculateQuadrantMargin(baseline.suggestedTasks)).toBeGreaterThanOrEqual(0.25);
			expect(flips.length).toBeGreaterThan(0);

			flips.forEach((option) => {
				const applied = resolve(base, option.lever);

				expect(option.quadrantFlip).toBe(applied.dailyQuadrant);
				expect(option.quadrantFlip).not.toBe(baseline.dailyQuadrant);
				expect(calculateQuadrantMargin(applied.suggestedTasks)).toBeGreaterThanOrEqual(0.25);
			});
		});

		it('claims no flip from a baseline that straddles a cut', () => {
			// 4.5 h at effective difficulty 7 + 0.3·5 = 8.5 and 1.5 h at 1 + 0.3·1 =
			// 1.3 average 6.7, against the demanding cut of 5 + 0.3·5 = 6.5:
			// the day is grind by 0.2 of a slider point. Deferring the big task
			// leaves a squarely routine plan — the CANDIDATE is 4.5 points clear — so
			// only the baseline's thinness is keeping the flip off the card.
			const base = input([
				makeTask({
					id: 1,
					title: 'Sort the mail',
					mentalDifficulty: 1,
					physicalDifficulty: 1,
					enjoyment: 1,
				}),
				makeTask({
					id: 2,
					title: 'Repaint the fence',
					mentalDifficulty: 5,
					physicalDifficulty: 7,
					enjoyment: 5,
				}),
			]);

			const baseline = calculateDailyMetrics(base);
			const advice = suggestPlanAdjustments(base, baseline);

			expect(calculateQuadrantMargin(baseline.suggestedTasks)).toBeLessThan(0.25);

			const moved = everyOption(advice).filter(
				(option) => resolve(base, option.lever).dailyQuadrant !== baseline.dailyQuadrant,
			);

			// Not vacuous: there are flips to report, and the days they land on are
			// nowhere near a cut themselves.
			expect(moved.length).toBeGreaterThan(0);

			moved.forEach((option) =>
				expect(
					calculateQuadrantMargin(resolve(base, option.lever).suggestedTasks),
				).toBeGreaterThanOrEqual(0.25),
			);

			expect(everyOption(advice).every((option) => option.quadrantFlip === null)).toBe(true);
		});
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

	// A re-solve that lands on the same allocation reproduces every reading to
	// within float noise, and a bare `> 0` reads that noise as relief: the menu
	// offered a budget trim that moved Energy Balance by one ULP, for nothing.
	it('never offers an option that lands on the reading it started from', () => {
		const base = input(
			[
				makeTask({
					id: 1,
					title: 'Running',
					physicalDifficulty: 8,
					mentalDifficulty: 0,
					enjoyment: 9,
				}),
				makeTask({
					id: 2,
					title: 'Piano',
					physicalDifficulty: 0,
					mentalDifficulty: 6,
					enjoyment: 7,
				}),
				makeTask({
					id: 3,
					title: 'Gym',
					physicalDifficulty: 8,
					mentalDifficulty: 2,
					enjoyment: 4,
				}),
			],
			{
				availableHours: 4,
				switchCost: 0,
				pools: {
					cognitiveHours: 1,
					physicalHours: 1,
				},
			},
		);

		const noOptions = suggestPlanAdjustments(base).findings.flatMap((finding) =>
			(finding.unpriced ? [...finding.options, finding.unpriced] : finding.options)
				.filter((option) => Math.abs(option.after - finding.before) < 1e-9)
				.map((option) => `${finding.axis}: ${JSON.stringify(option.lever)}`),
		);

		expect(noOptions).toEqual([]);
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

	// On a budget-bound day the trim changes no allocation, so it costs nothing —
	// the case that proves the cost figure is not a fudge. It is NOT the general
	// property: see the pool-bound day below.
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

	// The counter-case, pinned from `scripts/plan-advice.probe.ts`:
	// the trim keeps the plan FEASIBLE — same funded count, same
	// allocated hours — but `allocate` is path-dependent on `budgetBlocks`, so a
	// pool-bound day re-solves to a different distribution of those hours and the
	// lever is not free. Guards against anyone "fixing" the residual with a clamp.
	it('does not promise a free trim on a pool-bound day', () => {
		const base = input(
			// [mental, physical, enjoyment] per task, from the probe's sweep.
			(
				[
					[9, 9, 6],
					[3, 5, 4],
					[1, 10, 7],
					[0, 1, 6],
					[0, 5, 9],
					[9, 5, 2],
					[8, 6, 8],
				] as const
			).map(([mentalDifficulty, physicalDifficulty, enjoyment], index) =>
				makeTask({
					id: index + 1,
					title: `t${index + 1}`,
					mentalDifficulty,
					physicalDifficulty,
					enjoyment,
				}),
			),
			{
				availableHours: 9.75,
				pools: {
					cognitiveHours: 4.5,
					physicalHours: 4.5,
				},
			},
		);

		const baseline = calculateDailyMetrics(base);
		const trimTo = baseline.budgetHours - baseline.planSlackHours;

		const trimmed = calculateDailyMetrics({
			...base,
			availableHours: trimTo,
		});

		const funded = (metrics: DailyMetrics) =>
			metrics.suggestedTasks.filter((task) => task.suggestedHours > 0).length;

		const allocated = (metrics: DailyMetrics) =>
			metrics.suggestedTasks.reduce((sum, task) => sum + task.suggestedHours, 0);

		// Feasible: nothing was cut, so this is not the rounding defect.
		expect(funded(trimmed)).toBe(funded(baseline));
		expect(allocated(trimmed)).toBeCloseTo(allocated(baseline), 10);

		// …and still not free.
		expect(trimmed.zenithGain.optimized).toBeLessThan(baseline.zenithGain.optimized);

		const advice = suggestPlanAdjustments(base, baseline);

		const trim = everyOption(advice).find(
			(option) => option.lever.kind === 'set-budget' && option.lever.hours === trimTo,
		);

		expect(trim!.planValueDeltaPercent).toBeLessThan(0);
	});

	it('lists the active tasks the plan funds no hours for', () => {
		// One block of budget cannot fund three tasks; the unfunded ones are the
		// most direct advice available and need no search.
		const base = grindDay(0.5);
		const baseline = calculateDailyMetrics(base);
		const advice = suggestPlanAdjustments(base, baseline);
		const unfunded = baseline.activeTasks.filter((task) => task.suggestedHours <= 0);

		expect(advice.unfunded.map((entry) => entry.taskId)).toEqual(unfunded.map((task) => task.id));
		expect(advice.unfunded.length).toBeGreaterThan(0);
	});

	// The flag is a colour decision on the card, so it rides along on the entry
	// rather than splitting the read into a second list.
	it('marks the unfunded tasks that are flagged must-do', () => {
		const starved = calculateDailyMetrics(grindDay(0.5))
			.activeTasks.filter((task) => task.suggestedHours <= 0)
			.map((task) => task.id);

		const pinned = starved[0];

		const advice = suggestPlanAdjustments(
			input(
				GRIND.map((task) =>
					task.id === pinned
						? {
								...task,
								mustDoToday: true,
							}
						: task,
				),
				{
					availableHours: 0.5,
				},
			),
		);

		expect(starved.length).toBeGreaterThan(1);

		expect(advice.unfunded.filter((entry) => entry.pinned).map((entry) => entry.taskId)).toEqual([
			pinned,
		]);

		const byId = (a: number, b: number) => a - b;

		expect(advice.unfunded.map((entry) => entry.taskId).sort(byId)).toEqual(
			[...starved].sort(byId),
		);
	});

	/**
	 * Days lifted from `plan-advice.probe.ts`'s seeded 600 and kept by value, one
	 * per branch: the sweep reaches configurations — a pool at its ceiling, a task
	 * no lever moves — that no hand-built fixture landed on.
	 */
	const seededDay = (
		sliders: [number, number, number][],
		availableHours: number,
		switchCost: number,
		pools: CapacityPools,
	): DailyMetricsInput =>
		input(
			sliders.map(([mentalDifficulty, physicalDifficulty, enjoyment], index) =>
				makeTask({
					id: index + 1,
					title: `t${index + 1}`,
					mentalDifficulty,
					physicalDifficulty,
					enjoyment,
				}),
			),
			{
				availableHours,
				switchCost,
				pools,
			},
		);

	describe('why a task got no hours', () => {
		// An hour of budget against six tasks: deferring t1, t2 or t3 funds t6, and
		// so does the extra hour — the two actionable branches on one day.
		const BOTH_BRANCHES = seededDay(
			[
				[4, 2, 9],
				[5, 8, 9],
				[5, 1, 6],
				[8, 2, 4],
				[5, 10, 5],
				[9, 8, 7],
			],
			1,
			5 / 60,
			{
				cognitiveHours: 1.5,
				physicalHours: 4,
			},
		);

		const reasonFor = (advice: PlanAdvice, taskId: number) =>
			advice.unfunded.find((entry) => entry.taskId === taskId)!.reason;

		// The attribution reads the candidates the frontier already solved, so a day
		// with unfunded work costs exactly what one without it costs.
		it('costs no solve beyond the levers already priced', () => {
			const base = grindDay(0.5);
			const baseline = calculateDailyMetrics(base);
			const advice = suggestPlanAdjustments(base, baseline);

			expect(baseline.activeTasks.some((task) => task.suggestedHours <= 0)).toBe(true);
			expect(advice.candidatesEvaluated).toBeGreaterThanOrEqual(GRIND.length + 1);
			expect(advice.candidatesEvaluated).toBeLessThanOrEqual(GRIND.length + 3);
		});

		// Both branches apply, and only the defer is a change to today's list the
		// user can make without buying an hour they may not have.
		it('names the defer, not the extra hour, when both would fund the task', () => {
			const wider = calculateDailyMetrics({
				...BOTH_BRANCHES,
				availableHours: BOTH_BRANCHES.availableHours + 1,
			});

			expect(wider.suggestedTasks.find((task) => task.id === 6)!.suggestedHours).toBeGreaterThan(0);

			expect(reasonFor(suggestPlanAdjustments(BOTH_BRANCHES), 6).kind).toBe('defer');
		});

		it('names the funding defer that keeps the most plan value', () => {
			const reason = reasonFor(suggestPlanAdjustments(BOTH_BRANCHES), 6);

			const funding = BOTH_BRANCHES.tasks
				.filter((task) => task.id !== 6)
				.map((task) => ({
					id: task.id,
					metrics: calculateDailyMetrics({
						...BOTH_BRANCHES,
						tasks: BOTH_BRANCHES.tasks.filter((other) => other.id !== task.id),
					}),
				}))
				.filter(
					(candidate) =>
						(candidate.metrics.suggestedTasks.find((task) => task.id === 6)?.suggestedHours ?? 0) >
						0,
				);

			expect(funding.length).toBeGreaterThan(1);
			expect(reason.kind === 'defer' && reason.taskId).toBeTruthy();

			const named = reason.kind === 'defer' ? reason.taskId : -1;
			const best = Math.max(...funding.map((candidate) => candidate.metrics.zenithGain.optimized));

			expect(
				funding.find((candidate) => candidate.id === named)!.metrics.zenithGain.optimized,
			).toBe(best);
		});

		// The flag removes a task from the DEFER CANDIDATES, not from the read:
		// someone else's removal still funds it, and that is the sentence it gets.
		it('attributes a pinned task and never names one as the task to drop', () => {
			const advice = suggestPlanAdjustments({
				...BOTH_BRANCHES,
				tasks: BOTH_BRANCHES.tasks.map((task) =>
					task.id === 6
						? {
								...task,
								mustDoToday: true,
							}
						: task,
				),
			});

			const entry = advice.unfunded.find((candidate) => candidate.taskId === 6)!;

			expect(entry.pinned).toBe(true);
			expect(entry.reason.kind).toBe('defer');

			expect(
				advice.unfunded.flatMap((candidate) =>
					candidate.reason.kind === 'defer' ? [candidate.reason.taskId] : [],
				),
			).not.toContain(6);
		});

		// Half an hour of physical pool against seven tasks: no single defer and no
		// extra hour reaches t5, and the pool it draws on is at its ceiling.
		it('names the pool that is full', () => {
			const advice = suggestPlanAdjustments(
				seededDay(
					[
						[7, 4, 3],
						[7, 3, 6],
						[3, 1, 8],
						[4, 1, 9],
						[0, 8, 6],
						[1, 6, 9],
						[2, 8, 2],
					],
					11.75,
					0.25,
					{
						cognitiveHours: 3,
						physicalHours: 0.5,
					},
				),
			);

			expect(reasonFor(advice, 5)).toEqual({
				kind: 'pool',
				limitType: 'physical',
			});
		});

		// 45 minutes for six tasks, with both pools far from full: nothing on offer
		// reaches t5, and there is no pool to blame for it either.
		it('says nothing reaches the task when no lever and no full pool explains it', () => {
			const advice = suggestPlanAdjustments(
				seededDay(
					[
						[5, 5, 6],
						[1, 8, 7],
						[9, 1, 1],
						[0, 3, 2],
						[2, 10, 6],
						[8, 3, 6],
					],
					0.75,
					25 / 60,
					{
						cognitiveHours: 5,
						physicalHours: 3,
					},
				),
			);

			expect(reasonFor(advice, 5)).toEqual({
				kind: 'none',
			});
		});
	});

	// Every axis, unconditionally and in order: the caller reads
	// the menu to know what helps, and the axis's presence says only that it was
	// asked. Dropping the ones nothing helps is what made an unfixable warning
	// indistinguishable from a day with no warning on it.
	it('files a finding for every axis, in axis order', () => {
		const advice = suggestPlanAdjustments(grindDay());

		expect(advice.findings.map((finding) => finding.axis)).toEqual([...ADVICE_AXES]);
		expect([...ADVICE_AXES]).toContain('flowCoverage');
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

	// Σ P̄ rises with the budget, so a budget increase inside the
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

				// Both sides through `readAxis`: `finding.before` is the PRINTED reading,
				// which Flow Coverage does not rank on.
				return (
					badnessOf(finding.axis, readAxis(metrics, finding.axis)) <
					badnessOf(finding.axis, readAxis(baseline, finding.axis))
				);
			}),
		);

		expect(deferrable.length).toBeGreaterThan(0);
		expect(deferrable.every((finding) => finding.options.length > 0)).toBe(true);
	});

	// A 5-minute switch cost puts the slack off the quarter-hour
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
		// Unspendable hours on a day where the trim does reproduce the plan, so the
		// value is untouched. The rounded lever was not even feasible.
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

	// With no baseline value there is no ratio; reporting 0 made
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

	// The budget's shadow price: what one more block is worth and
	// which task the allocator hands it to.
	describe('the marginal of the budget', () => {
		const hoursOf = (metrics: DailyMetrics, taskId: number) =>
			metrics.suggestedTasks.find((task) => task.id === taskId)!.suggestedHours;

		const widen = (base: DailyMetricsInput, baseline: DailyMetrics, blockHours: number) =>
			calculateDailyMetrics({
				...base,
				availableHours: baseline.budgetHours + blockHours,
			});

		it('prices the next block against a re-solve one block wider', () => {
			const rows = [0, 2, 6, 10, 14].map((hours) => {
				const base = grindDay(hours);
				const baseline = calculateDailyMetrics(base);
				const { budgetMarginal } = suggestPlanAdjustments(base, baseline);

				return {
					gain: budgetMarginal.planValueGain,
					delta:
						widen(base, baseline, budgetMarginal.blockHours).zenithGain.optimized -
						baseline.zenithGain.optimized,
				};
			});

			// Not vacuous: some of those budgets genuinely buy something.
			expect(rows.filter((row) => row.delta > 0).length).toBeGreaterThan(0);

			// Nothing on GRIND is completed, so the open-scoped rise IS the plan's
			// own Σ P̄ rise — which is what ties the per-task decomposition to the
			// objective. Floored at 0: the true optimum is monotone in the budget,
			// so a negative shadow price is a claim the model does not make.
			rows.forEach((row) => expect(row.gain).toBeCloseTo(Math.max(0, row.delta), 12));
		});

		// The allocator is blind to `completed` (a ticked-off task keeps its hours),
		// so the wider plan can spend its extra block on work
		// already done. Naming it would answer "what next?" with "the thing you
		// just finished".
		it('never spends the block on a task that is already done', () => {
			const done = [
				{
					...GRIND[0],
					completed: true,
				},
				GRIND[2],
			];

			const base = input(done, {
				availableHours: 6,
			});

			const baseline = calculateDailyMetrics(base);
			const { budgetMarginal } = suggestPlanAdjustments(base, baseline);
			const wider = widen(base, baseline, budgetMarginal.blockHours);

			// The defect this pins is live: the wider plan really does hand the
			// block to the completed task, which unscoped made it the recipient.
			expect(hoursOf(wider, GRIND[0].id)).toBeGreaterThan(hoursOf(baseline, GRIND[0].id));
			expect(hoursOf(wider, GRIND[2].id)).toBe(hoursOf(baseline, GRIND[2].id));

			expect(budgetMarginal.recipient).toBeNull();
			// …and the value that block carries is not reported as a gain either.
			expect(budgetMarginal.planValueGain).toBe(0);
		});

		// The rule is "largest gainer, not the only one". Multi-gainer days
		// exist but are rare (36 of 600 probe days, 5 of them with gainers of
		// different size), so the rule needs the fixture that produces one — on a
		// curated day it never bites and the tie-break is untested.
		it('names the largest gainer when the block reshuffles several tasks', () => {
			const reshuffle = [
				[5, 10, 8],
				[10, 5, 9],
				[3, 4, 5],
				[4, 7, 6],
				[4, 5, 6],
			].map(([mental, physical, enjoyment], index) =>
				makeTask({
					id: index + 1,
					title: `T${index + 1}`,
					mentalDifficulty: mental,
					physicalDifficulty: physical,
					enjoyment,
				}),
			);

			const base = input(reshuffle, {
				availableHours: 9.75,
				switchCost: 0.5,
			});

			const baseline = calculateDailyMetrics(base);
			const { budgetMarginal } = suggestPlanAdjustments(base, baseline);
			const wider = widen(base, baseline, budgetMarginal.blockHours);

			const gainers = baseline.activeTasks
				.map((task) => ({
					id: task.id,
					extra: hoursOf(wider, task.id) - task.suggestedHours,
				}))
				.filter((row) => row.extra > 0);

			// The fixture's whole point: more than one task gains, by different
			// amounts, so the tie-break has something to decide.
			expect(gainers.length).toBeGreaterThan(1);
			expect(new Set(gainers.map((row) => row.extra)).size).toBeGreaterThan(1);

			const largest = [...gainers].sort((a, b) => b.extra - a.extra)[0];

			expect(budgetMarginal.recipient?.taskId).toBe(largest.id);
		});

		it('names the task the extra block goes to', () => {
			const base = grindDay(6);
			const baseline = calculateDailyMetrics(base);
			const { budgetMarginal } = suggestPlanAdjustments(base, baseline);
			const recipient = budgetMarginal.recipient;

			expect(recipient).not.toBeNull();

			const wider = widen(base, baseline, budgetMarginal.blockHours);

			expect(hoursOf(wider, recipient!.taskId)).toBeGreaterThan(
				hoursOf(baseline, recipient!.taskId),
			);

			expect(recipient!.title).toBe(GRIND.find((task) => task.id === recipient!.taskId)!.title);
		});

		// The honest reading of a day whose budget is not what limits it. No claim
		// about WHY — pools and every task sitting past its T* look identical here.
		it('reports no recipient and no gain when the plan cannot spend another block', () => {
			const base = grindDay(14);
			const baseline = calculateDailyMetrics(base);

			expect(baseline.planSlackHours).toBeGreaterThan(1);

			const { budgetMarginal } = suggestPlanAdjustments(base, baseline);

			expect(budgetMarginal.recipient).toBeNull();
			expect(budgetMarginal.planValueGain).toBe(0);
			expect(budgetMarginal.planValueGainPercent).toBe(0);
		});

		// The one day where the shadow price matters most and the ratio cannot be
		// stated: no hours entered yet, so there is no plan value to divide by.
		it('has no ratio to report when the current plan has no value', () => {
			const base = grindDay(0);
			const baseline = calculateDailyMetrics(base);

			expect(baseline.zenithGain.optimized).toBe(0);

			const { budgetMarginal } = suggestPlanAdjustments(base, baseline);

			expect(budgetMarginal.planValueGain).toBeGreaterThan(0);
			expect(budgetMarginal.planValueGainPercent).toBeNull();
			expect(budgetMarginal.recipient).not.toBeNull();
		});
	});

	// `switchCost` is a measurement of the user, so this prices
	// the declared number rather than advising a different one.
	describe('the price of the switch cost', () => {
		const resolveAt = (base: DailyMetricsInput, switchCost: number) =>
			calculateDailyMetrics({
				...base,
				switchCost,
			}).zenithGain.optimized;

		it('prices the declared cost against a re-solve at zero and at double', () => {
			const rows = [2, 4, 6, 10].map((hours) => {
				const base = grindDay(hours);
				const baseline = calculateDailyMetrics(base);
				const { switchCostPrice } = suggestPlanAdjustments(base, baseline);
				const declared = baseline.zenithGain.optimized;
				const expected = [0, base.switchCost * 2].map((switchCost) => resolveAt(base, switchCost));

				return {
					candidates: switchCostPrice.alternatives.map((alternative) => alternative.switchCost),
					reported: switchCostPrice.alternatives.map((alternative) => alternative.planValue),
					reportedDeltas: switchCostPrice.alternatives.map(
						(alternative) => alternative.planValueDeltaPercent,
					),
					expected,
					expectedDeltas: expected.map(
						(value) => Math.round(((value - declared) / declared) * 1000) / 10,
					),
					declared,
				};
			});

			// The declaration each arm priced, which the bracket copy prints and
			// nothing else pinned: object-shorthand `switchCost` in place of
			// `candidate` renders "at 15m a switch … at 15m a switch" with two
			// different plan values, and passed the whole suite.
			rows.forEach((row) => expect(row.candidates).toEqual([0, 0.5]));

			// Not vacuous: the switch cost has to actually be moving the plan on
			// some of those budgets, or the identity below holds trivially.
			expect(rows.filter((row) => row.expected[0] > row.declared).length).toBeGreaterThan(0);

			// …and the doubled arm has to be genuinely NEGATIVE somewhere, or the
			// unfloored contract below is untested: flooring the delta at 0 the way
			// the budget marginal does would then still pass.
			expect(rows.filter((row) => row.expectedDeltas[1] < 0).length).toBeGreaterThan(0);

			// Exactly, not floored: both numbers are the Σ P̄ of a plan the
			// allocator really solved, so this is a comparison and not a shadow
			// price. Asserted on the percentages too, not only the
			// values — a floor lands on the percentage, and pinning the values
			// alone left the whole unfloored contract green under it.
			rows.forEach((row) => {
				row.reported.forEach((value, index) => expect(value).toBe(row.expected[index]));
				row.reportedDeltas.forEach((delta, index) => expect(delta).toBe(row.expectedDeltas[index]));
			});
		});

		// Three mutations passed the whole suite before this test existed: counting
		// listed tasks instead of funded ones, moving the `funded > 1` boundary, and
		// scoping the re-solve to active tasks — the last being the thing AGENTS.md
		// forbids first. Every earlier day here funds all of its tasks and completes
		// none, so none of the three had anything to bite on.
		it('counts the tasks the plan funds, over a task list that is neither', () => {
			const base = input(
				[
					...GRIND,
					makeTask({
						id: 4,
						title: 'Already done',
						mentalDifficulty: 8,
						physicalDifficulty: 1,
						enjoyment: 3,
						completed: true,
					}),
				],
				{
					availableHours: 1,
				},
			);

			const baseline = calculateDailyMetrics(base);
			const { switchCostPrice } = suggestPlanAdjustments(base, baseline);
			const funded = baseline.suggestedTasks.filter((task) => task.suggestedHours > 0).length;

			// The fixture's whole point: funded, listed and active are three different
			// numbers, so each mutation reports a different reservation.
			expect(funded).toBe(2);
			expect(base.tasks.length).toBe(4);
			expect(baseline.activeTasks.length).toBe(3);

			// Literal, not re-derived from the same baseline the assertion checks.
			expect(switchCostPrice.reservedHours).toBeCloseTo(0.25, 12);

			// Plan-scoped: the value is the whole list's, and the active-only solve is
			// a genuinely different number here rather than a float-noise apart —
			// which is what makes this a scope test.
			const activeOnly = calculateDailyMetrics({
				...base,
				tasks: base.tasks.filter((task) => !task.completed),
				switchCost: 0,
			}).zenithGain.optimized;

			expect(switchCostPrice.alternatives[0].planValue).toBe(resolveAt(base, 0));

			expect(Math.abs(switchCostPrice.alternatives[0].planValue - activeOnly)).toBeGreaterThan(
				0.01,
			);
		});

		it('reports the hours the plan reserves for switching', () => {
			const base = grindDay(10);
			const baseline = calculateDailyMetrics(base);
			const { switchCostPrice } = suggestPlanAdjustments(base, baseline);
			const funded = baseline.suggestedTasks.filter((task) => task.suggestedHours > 0).length;

			expect(funded).toBeGreaterThan(1);
			expect(switchCostPrice.reservedHours).toBeCloseTo((funded - 1) * base.switchCost, 12);

			expect(switchCostPrice.reservedShare).toBeCloseTo(
				switchCostPrice.reservedHours / base.availableHours,
				12,
			);
		});

		// The exact optimum is monotone non-increasing in `s`:
		// any allocation feasible at `s` is feasible at every smaller `s`, with the
		// same pool draw and the same Σ P̄. So a LOWER declaration can only read ≥ 0
		// and a higher one ≤ 0, and the opposite sign is allocator error rather
		// than a fact about the day.
		//
		// The fixture that produces one, found by sweeping the generated year rather
		// than curated: this is 2026-05-14 with its own tasks, at a budget and pools
		// on the constraints bar's own grid. Unclamped, the free arm reads −6.5% and
		// the card told the user that making switching free would COST them 6.5% —
		// while the s = 5 min plan is itself feasible at s = 0 and achieves the exact
		// optimum there.
		it('never reports a sign the monotonicity of the optimum rules out', () => {
			const base = input(
				[
					makeTask({
						id: 1,
						title: 'network',
						mentalDifficulty: 5,
						physicalDifficulty: 0,
						enjoyment: 2,
					}),
					makeTask({
						id: 2,
						title: 'guitar',
						mentalDifficulty: 4,
						physicalDifficulty: 1,
						enjoyment: 8,
					}),
					makeTask({
						id: 3,
						title: 'gym',
						mentalDifficulty: 1,
						physicalDifficulty: 9,
						enjoyment: 5,
					}),
					makeTask({
						id: 4,
						title: 'admin',
						mentalDifficulty: 3,
						physicalDifficulty: 1,
						enjoyment: 1,
					}),
					makeTask({
						id: 5,
						title: 'reading',
						mentalDifficulty: 6,
						physicalDifficulty: 0,
						enjoyment: 7,
						completed: true,
					}),
				],
				{
					availableHours: 3,
					switchCost: 5 / 60,
					pools: {
						cognitiveHours: 0.5,
						physicalHours: 2,
					},
				},
			);

			const baseline = calculateDailyMetrics(base);
			const { switchCostPrice } = suggestPlanAdjustments(base, baseline);
			const [free, doubled] = switchCostPrice.alternatives;

			// Not vacuous: the raw re-solve really does invert here, so the assertion
			// below is about the clamp and not about a day where nothing happens.
			expect(resolveAt(base, 0)).toBeLessThan(baseline.zenithGain.optimized);

			expect(free.planValueDeltaPercent).toBe(0);
			expect(doubled.planValueDeltaPercent).toBeLessThanOrEqual(0);
		});

		it('charges a one-task day nothing, having no switch to pay for', () => {
			const advice = suggestPlanAdjustments(input([GRIND[0]]));

			expect(advice.switchCostPrice.reservedHours).toBe(0);
			expect(advice.switchCostPrice.reservedShare).toBe(0);
		});

		it('has nothing to price when the day declares no switch cost', () => {
			const advice = suggestPlanAdjustments(
				input(GRIND, {
					switchCost: 0,
				}),
			);

			expect(advice.switchCostPrice.declared).toBe(0);
			expect(advice.switchCostPrice.alternatives).toEqual([]);
		});

		it('reports no percentage and no share when there is no plan to price', () => {
			const advice = suggestPlanAdjustments(
				input(GRIND, {
					availableHours: 0,
				}),
			);

			expect(advice.switchCostPrice.reservedShare).toBeNull();

			// Funded is 0 here, not 1, and that is the `funded > 1` guard's only
			// behavioural consequence: without it `(0 − 1)·s` is NEGATIVE and the card
			// prints it. Removing the guard passed every other test.
			expect(advice.switchCostPrice.reservedHours).toBe(0);

			advice.switchCostPrice.alternatives.forEach((alternative) =>
				expect(alternative.planValueDeltaPercent).toBeNull(),
			);
		});
	});

	// A zero-load plan reads the display sentinel 50, which is
	// also the axis target — read as a balance, "set the budget to 0" becomes
	// the axis's global optimum and the advisor chases the budget to nothing.
	describe('energy balance and the empty plan', () => {
		// The live day that surfaced it: physical-heavy, budget low enough that
		// `budget − 1` clamps to an empty plan.
		const PHYSICAL_HEAVY = [
			makeTask({
				id: 1,
				title: 'Boxing',
				physicalDifficulty: 9,
				mentalDifficulty: 3,
				enjoyment: 10,
			}),
			makeTask({
				id: 2,
				title: 'Guitar',
				physicalDifficulty: 1,
				mentalDifficulty: 5,
				enjoyment: 7,
			}),
			makeTask({
				id: 3,
				title: 'Reading',
				physicalDifficulty: 0,
				mentalDifficulty: 4,
				enjoyment: 3,
			}),
		];

		it('never offers a zero-load plan as balance advice', () => {
			const advice = suggestPlanAdjustments(
				input(PHYSICAL_HEAVY, {
					availableHours: 1,
				}),
			);

			const options = findingFor(advice, 'energyBalance')?.options ?? [];

			expect(options.map((option) => option.lever)).not.toContainEqual({
				kind: 'set-budget',
				hours: 0,
			});
		});

		it('generates no balance advice from a zero-load baseline', () => {
			const advice = suggestPlanAdjustments(
				input(PHYSICAL_HEAVY, {
					availableHours: 0,
				}),
			);

			const finding = findingFor(advice, 'energyBalance');

			// The axis is reported and its menu is empty, which is the NaN sentinel
			// failing every comparison — the card drops a row that
			// reads N/A with nothing under it.
			expect(Number.isNaN(finding?.before)).toBe(true);
			expect(finding?.options).toEqual([]);
			expect(finding?.unpriced).toBeNull();
		});

		it('still offers the empty plan on the v-badness axes, priced honestly', () => {
			const advice = suggestPlanAdjustments(
				input(PHYSICAL_HEAVY, {
					availableHours: 1,
				}),
			);

			const emptyPlan = findingFor(advice, 'physicalLoad')?.options.find(
				(option) => option.lever.kind === 'set-budget' && option.lever.hours === 0,
			);

			expect(emptyPlan?.after).toBe(0);
			expect(emptyPlan?.planValueDeltaPercent).toBe(-100);
		});
	});

	// The same defect, extended to Schedule Integrity (2026-08-07). The metric's
	// guards hand the axis two sentinels for a plan that funds nothing — 100 (no
	// tasks) and 0 (nothing funded) — and neither is an overhead share. The
	// no-budget day is the one that reached the card: 0% reads `critical`, so
	// the row appeared with an "add an hour" option on a day the user has not
	// budgeted at all, the same alarm-about-nothing the dashboard row already
	// gates on (`metric-descriptor.ts`).
	describe('schedule integrity and the plan that funds nothing', () => {
		it('generates no integrity advice from a no-budget baseline', () => {
			const advice = suggestPlanAdjustments(
				input(GRIND, {
					availableHours: 0,
				}),
			);

			const finding = findingFor(advice, 'scheduleIntegrity');

			expect(Number.isNaN(finding?.before)).toBe(true);
			expect(finding?.options).toEqual([]);
			expect(finding?.unpriced).toBeNull();
		});

		it('leaves the axis working on a day that does fund work', () => {
			const advice = suggestPlanAdjustments(input(GRIND));
			const finding = findingFor(advice, 'scheduleIntegrity');

			expect(finding?.before).toBeGreaterThan(0);
			expect(Number.isNaN(finding?.before)).toBe(false);
		});
	});

	// The live day that surfaced it (2026-08-08): every task
	// cognitive, so Energy Balance reads 100% and no lever moves it — the share is
	// invariant under both — and the axis was dropped from `findings` entirely.
	// The card read that absence as "every axis is in band" and printed "this day
	// is fine" under a row the dashboard was banding Caution.
	describe('an axis no lever can move', () => {
		const COGNITIVE_ONLY = [
			makeTask({
				id: 1,
				title: 'Design the error boundary',
				mentalDifficulty: 8,
				physicalDifficulty: 0,
				enjoyment: 9,
			}),
			makeTask({
				id: 2,
				title: 'Write the PDF solution',
				mentalDifficulty: 6,
				physicalDifficulty: 0,
				enjoyment: 7,
			}),
			makeTask({
				id: 3,
				title: 'Review the PR',
				mentalDifficulty: 5,
				physicalDifficulty: 0,
				enjoyment: 4,
			}),
		];

		it('still reports the reading, under an empty menu', () => {
			const finding = findingFor(suggestPlanAdjustments(input(COGNITIVE_ONLY)), 'energyBalance');

			// Not vacuous: 100 is the worst this axis reads, and every candidate ties
			// it, which is why the menu below is empty rather than unsearched.
			expect(finding?.before).toBe(100);
			expect(finding?.options).toEqual([]);
			expect(finding?.unpriced).toBeNull();
		});
	});

	// Grind Density counts tasks, but every lever the advisor can
	// pull is priced in hours, so it paid ~3% of Σ P̄ to move the reading 15-33pp
	// by deferring a 15-minute chore. Retired as an axis, kept as a row.
	describe('grind density is not an axis', () => {
		it('offers no advice on a day of pure grind', () => {
			const base = grindDay();

			// Not vacuous: every task this day funds is a grind, so the axis would
			// read 100 — the worst value it has — and lead the frontier.
			expect(calculateDailyMetrics(base).grindDensity.percent).toBe(100);

			expect(ADVICE_AXES).not.toContain('grindDensity');

			expect(suggestPlanAdjustments(base).findings.map((finding) => finding.axis)).not.toContain(
				'grindDensity',
			);
		});
	});
});

/**
 * Five cognitive tasks against a 10-hour day, at a 6 h cognitive
 * pool: three of the five reach ϕ, and exactly one defer — the largest task —
 * frees enough for a fourth to reach it, taking the day to 4/4.
 *
 * Deferring any of the OTHER four moves the reading 3/5 → 3/4 without a single
 * task reaching flow: the share rises because the denominator fell. That is the
 * move that retired Grind Density for offering, and the reason this axis ranks
 * on the count.
 */
const FLOW = [
	makeTask({
		id: 1,
		title: 'Design error boundary',
		mentalDifficulty: 8,
		physicalDifficulty: 0,
		enjoyment: 9,
	}),
	makeTask({
		id: 2,
		title: 'Write the PDF solution',
		mentalDifficulty: 6,
		physicalDifficulty: 0,
		enjoyment: 7,
	}),
	makeTask({
		id: 3,
		title: 'Review the API PR',
		mentalDifficulty: 5,
		physicalDifficulty: 0,
		enjoyment: 4,
	}),
	makeTask({
		id: 4,
		title: 'Review the app PR',
		mentalDifficulty: 5,
		physicalDifficulty: 0,
		enjoyment: 3,
	}),
	makeTask({
		id: 5,
		title: 'Daily',
		mentalDifficulty: 2,
		physicalDifficulty: 0,
		enjoyment: 2,
	}),
];

const flowDay = (tasks: Task[] = FLOW) =>
	input(tasks, {
		availableHours: 10,
		pools: {
			cognitiveHours: 6,
			physicalHours: 4,
		},
	});

const deferredIds = (finding: { options: AdviceOption[] } | undefined) =>
	(finding?.options ?? [])
		.map((option) => option.lever)
		.filter((lever) => lever.kind === 'defer-task')
		.map((lever) => (lever.kind === 'defer-task' ? lever.taskId : -1));

// The headline whose remedy is in the reading — "2/5 means drop tasks or add
// hours" — and which the advisor did not search on until now.
describe('the flow-coverage axis', () => {
	it('offers the defer that carries another task into flow', () => {
		const advice = suggestPlanAdjustments(flowDay());
		const finding = findingFor(advice, 'flowCoverage');

		expect(calculateDailyMetrics(flowDay()).flowCoverage).toEqual({
			reached: 3,
			total: 5,
		});

		expect(deferredIds(finding)).toContain(1);
	});

	// The whole point of re-solving rather than guessing, on this axis: the share
	// shown is the one the plan without that task actually reports.
	it('reports the share the model reproduces once that defer is applied', () => {
		const advice = suggestPlanAdjustments(flowDay());

		const option = findingFor(advice, 'flowCoverage')!.options.find(
			(candidate) => candidate.lever.kind === 'defer-task' && candidate.lever.taskId === 1,
		);

		const applied = calculateDailyMetrics(flowDay(FLOW.filter((task) => task.id !== 1)));

		expect(applied.flowCoverage).toEqual({
			reached: 4,
			total: 4,
		});

		expect(option!.after).toBe(100);
	});

	// The Grind Density defect, written as a test. Deferring any of these four
	// takes the reading from 60% to 75% and no task reaches flow that did not
	// before; if this goes green under a badness of −share, the axis was built on
	// the ratio.
	it('refuses a defer that raises the share without raising the count', () => {
		const advice = suggestPlanAdjustments(flowDay());
		const finding = findingFor(advice, 'flowCoverage');
		const offered = deferredIds(finding);

		// Or the loop below passes on an axis that does not exist yet.
		expect(finding).toBeDefined();

		for (const taskId of [2, 3, 4, 5]) {
			const applied = calculateDailyMetrics(flowDay(FLOW.filter((task) => task.id !== taskId)));

			expect(applied.flowCoverage, `task ${taskId}`).toEqual({
				reached: 3,
				total: 4,
			});

			expect(offered, `task ${taskId}`).not.toContain(taskId);
		}
	});

	// Energy Balance and Schedule Integrity each needed a NaN sentinel to stop
	// "defer the last task" winning their frontier. This axis
	// needs none: an empty plan reaches flow zero times, which is the worst
	// reading it has.
	it('never offers to empty a plan whose only task reaches flow', () => {
		const single = [FLOW[0]];
		const advice = suggestPlanAdjustments(flowDay(single));

		expect(calculateDailyMetrics(flowDay(single)).flowCoverage).toEqual({
			reached: 1,
			total: 1,
		});

		expect(findingFor(advice, 'flowCoverage')!.options).toEqual([]);
	});

	// Why this axis needs no counterpart to the Energy Balance display defect
	// (`adv3-advice-display-resolution.probe.ts`): the smallest real
	// improvement is one whole task's share, which the card's `Math.round` cannot
	// swallow. A budget lever holds the denominator and raises the count; a defer
	// lowers the denominator and cannot raise the count without freeing hours.
	it('moves the share by at least one whole task', () => {
		const advice = suggestPlanAdjustments(flowDay());
		const finding = findingFor(advice, 'flowCoverage')!;
		const baseline = calculateDailyMetrics(flowDay());
		const step = 100 / baseline.flowCoverage.total;
		const options = finding.unpriced ? [...finding.options, finding.unpriced] : finding.options;

		expect(options.length).toBeGreaterThan(0);

		options.forEach((option) => expect(option.after - finding.before).toBeGreaterThanOrEqual(step));
	});
});
