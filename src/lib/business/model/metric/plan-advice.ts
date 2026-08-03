/**
 * What to change when the day reads badly (MATH.md §14).
 *
 * The dashboard reports that Burnout Risk is 82% and the Day Profile is
 * "Grind"; this answers what would help and what it would cost. Not a rule
 * table — a rule table has to guess the consequence of its own advice.
 * `calculateDailyMetrics` is pure, so every candidate adjustment is re-solved
 * by the same optimizer that produced the plan being criticised, and every
 * number here is a real model output.
 *
 * Threshold-free on purpose: whether a reading is bad enough to act on is a
 * band, and bands are presentation policy (AGENTS.md §5) — this module answers
 * the same question for every axis, unconditionally, and
 * `plan-advice-descriptor` decides which answers to surface.
 */

import {
	calculateDailyMetrics,
	type DailyMetrics,
	type DailyMetricsInput,
} from '$lib/business/model/metric/daily-metrics';
import {
	calculateTaskPlan,
	isPinned,
	type DailyQuadrant,
} from '$lib/business/model/metric/calculation';
import { BLOCK_HOURS } from '$lib/business/model/zenith';

/** One honest change to today's inputs (MATH.md §14 — pools and switch cost are not levers). */
export type AdviceLever =
	| {
			/**
			 * "Suppose this task were not on today's list" — a counterfactual, not an
			 * operation. `applyLever` filters it out and re-solves; nothing is moved
			 * and nothing is deleted, and the model has no opinion on where it goes.
			 * Performing it is `SessionStore.moveTaskToTomorrow` (AGENTS.md §6),
			 * which this module knows nothing about.
			 */
			kind: 'defer-task';
			taskId: number;
			title: string;
	  }
	| {
			kind: 'set-budget';
			hours: number;
	  };

export const ADVICE_AXES = [
	'burnoutRisk',
	'humanCapacity',
	'cognitiveLoad',
	'physicalLoad',
	'energyBalance',
	'frictionIndex',
	'grindDensity',
	'timeScarcity',
	'scheduleIntegrity',
] as const;

export type AdviceAxis = (typeof ADVICE_AXES)[number];

export interface AdviceOption {
	lever: AdviceLever;
	/** The axis reading this lever produces. */
	after: number;
	/** Day Profile under this lever, so a grind → cruise flip is visible. */
	quadrant: DailyQuadrant;
	/** Σ P̄ of the resulting plan (MATH.md §14) and its signed change, in %. */
	planValue: number;
	/** Null when the current plan's Σ P̄ is 0: there is no ratio to report. */
	planValueDeltaPercent: number | null;
}

export interface AdviceFinding {
	axis: AdviceAxis;
	/** The current plan's reading, for the same axis. */
	before: number;
	/**
	 * Pareto-efficient Σ P̄-priced levers, biggest improvement first. Empty when
	 * only `unpriced` improves this axis.
	 */
	options: AdviceOption[];
	/**
	 * An improving budget *increase*, which Σ P̄ does not price — the extra hour
	 * costs the user something plan value cannot see. It therefore neither
	 * dominates `options` nor is ranked among them (MATH.md §14). At most one
	 * exists, because `budget + 1` is the only such lever.
	 */
	unpriced: AdviceOption | null;
}

/**
 * The time budget's shadow price (MATH.md §14.2): what the allocator would do
 * with one more block, and what that block is worth in Σ P̄.
 *
 * A DAY-level diagnostic, deliberately not a per-task column: the budget is a
 * number the user owns, while which task receives a block is the allocator's
 * decision, and a per-task column is arithmetic on a curve that ignores both
 * pools and the switch cost. (It is NOT because per-task marginals equalize at
 * the optimum — that was the plan and the probe refuted it, §14.2.)
 */
export interface BudgetMarginal {
	/** One allocator block, in hours — what "the next block" means (MATH.md §4). */
	blockHours: number;
	/**
	 * Σ P̄ that block adds across the tasks still OPEN (MATH.md §11.8/§14.2).
	 * Never negative: the true optimum is monotone in the budget, and the pooled
	 * path's heuristic noise is floored away.
	 */
	planValueGain: number;
	/** That rise against the whole current plan's Σ P̄, in %; null when that is 0. */
	planValueGainPercent: number | null;
	/**
	 * The open task the block goes to, or null when none takes it — the day where
	 * a wider budget buys no remaining work. Why is deliberately not claimed: a
	 * bound capacity pool, tasks near their stopping times, and a block spent on
	 * work already ticked off are indistinguishable from one extra solve.
	 */
	recipient: { taskId: number; title: string } | null;
}

export interface PlanAdvice {
	planValue: number;
	quadrant: DailyQuadrant;
	/** In `ADVICE_AXES` order; axes nothing can improve are omitted. */
	findings: AdviceFinding[];
	/** Active tasks the plan funds no hours for — a read, not a search. */
	unfundedTaskIds: number[];
	/**
	 * The `mustDoToday` subset of that read, partitioned out of it: an unfunded
	 * task the advisor is forbidden to defer is the one conflict the menu below
	 * cannot express, since the flag removed its only per-task lever (MATH.md §14).
	 */
	unfundedMustDoTaskIds: number[];
	budgetMarginal: BudgetMarginal;
	candidatesEvaluated: number;
}

/**
 * Raw reading and badness per axis, badness always lower-is-better. Energy
 * Balance is a target between the pools rather than a maximum, and Schedule
 * Integrity is bigger-better — the rest read directly (MATH.md §14).
 */
const AXIS: Record<
	AdviceAxis,
	{
		read: (metrics: DailyMetrics) => number;
		badness: (value: number) => number;
	}
> = {
	burnoutRisk: {
		read: (metrics) => metrics.burnoutRisk,
		badness: (value) => value,
	},
	humanCapacity: {
		read: (metrics) => metrics.humanCapacity.percent,
		badness: (value) => value,
	},
	cognitiveLoad: {
		read: (metrics) => metrics.cognitiveLoad,
		badness: (value) => value,
	},
	physicalLoad: {
		read: (metrics) => metrics.physicalLoad,
		badness: (value) => value,
	},
	energyBalance: {
		// A zero-load plan has no balance: `calculateEnergyBalance` returns the
		// display sentinel 50 there, which is also the target — read as-is, an
		// empty plan is this axis's global optimum and "set the budget to 0"
		// wins the frontier (MATH.md §14.1 defect 5). NaN fails the improvement
		// test in both directions, so zero-load candidates and baselines are
		// silently excluded, like the Infinity Human Capacity reading.
		read: (metrics) =>
			metrics.cognitiveLoad + metrics.physicalLoad === 0 ? NaN : metrics.energyBalance,
		badness: (value) => Math.abs(value - 50),
	},
	frictionIndex: {
		read: (metrics) => metrics.frictionIndex,
		badness: (value) => value,
	},
	grindDensity: {
		read: (metrics) => metrics.grindDensity,
		badness: (value) => value,
	},
	timeScarcity: {
		read: (metrics) => metrics.timeScarcity,
		badness: (value) => value,
	},
	scheduleIntegrity: {
		read: (metrics) => metrics.scheduleIntegrity,
		badness: (value) => -value,
	},
};

/** Σ P̄ over funded tasks — the allocator's own objective (MATH.md §14). */
function planValueOf(metrics: DailyMetrics): number {
	return metrics.zenithGain.optimized;
}

/**
 * Budget levers nearer than a minute to the current budget are the same lever,
 * not advice — `budget − planSlack` lands within float noise of the budget on a
 * plan that spends everything.
 */
const MIN_BUDGET_STEP = 1 / 60;

/**
 * Whether Σ P̄ captures what this lever costs the user. Deferring and trimming
 * both pay in plan value; *adding* an hour pays in an hour, which the objective
 * does not see — and Σ P̄ is monotone in the budget, so a priced comparison
 * would let `budget + 1` dominate every real alternative (MATH.md §14).
 */
function isPriced(lever: AdviceLever, budget: number): boolean {
	return lever.kind === 'defer-task' || lever.hours < budget;
}

function buildLevers(baseline: DailyMetrics): AdviceLever[] {
	const levers: AdviceLever[] = baseline.activeTasks
		.filter((task) => !isPinned(task))
		.map((task) => ({
			kind: 'defer-task' as const,
			taskId: task.id,
			title: task.title,
		}));

	const budget = baseline.budgetHours;
	// Deliberately unrounded: switch cost moves in 5-minute steps, so the slack it
	// carries is not quarter-aligned, and rounding the trim to quarters would cut
	// past the hours the plan actually spends — the one lever that must be free
	// (MATH.md §14).
	const trimmed = Math.max(0, budget - baseline.planSlackHours);

	const hours = [trimmed, budget - 1, budget + 1]
		.map((h) => Math.max(0, h))
		.filter(
			(h, index, all) =>
				Math.abs(h - budget) >= MIN_BUDGET_STEP &&
				all.findIndex((other) => Math.abs(other - h) < MIN_BUDGET_STEP) === index,
		);

	return [
		...levers,
		...hours.map((h) => ({
			kind: 'set-budget' as const,
			hours: h,
		})),
	];
}

function applyLever(input: DailyMetricsInput, lever: AdviceLever): DailyMetricsInput {
	if (lever.kind === 'defer-task')
		return {
			...input,
			tasks: input.tasks.filter((task) => task.id !== lever.taskId),
		};

	return {
		...input,
		availableHours: lever.hours,
	};
}

/**
 * The candidates that beat the current plan on one axis and are not dominated
 * on (improvement ↑, plan value ↑) — sorted by improvement, so the caller reads
 * "the most relief" first and "most of the relief, far cheaper" after it. The
 * unpriced budget increase is returned beside the frontier, never inside it.
 */
function paretoOptions(
	candidates: { lever: AdviceLever; metrics: DailyMetrics }[],
	axis: AdviceAxis,
	baseline: DailyMetrics,
): Pick<AdviceFinding, 'options' | 'unpriced'> {
	const { read, badness } = AXIS[axis];
	const baseValue = planValueOf(baseline);
	const baseBadness = badness(read(baseline));

	const improving = candidates
		.map((candidate) => {
			const after = read(candidate.metrics);
			const planValue = planValueOf(candidate.metrics);

			return {
				improvement: baseBadness - badness(after),
				option: {
					lever: candidate.lever,
					after,
					quadrant: candidate.metrics.dailyQuadrant,
					planValue,
					// A zero baseline has no ratio, and reporting 0% there renders a
					// real gain as costing nothing (MATH.md §14).
					planValueDeltaPercent:
						baseValue > 0 ? Math.round(((planValue - baseValue) / baseValue) * 1000) / 10 : null,
				},
			};
		})
		// `>` and not `>=`: an Infinity reading (a zero pool with demand on it)
		// must not count as improving on itself, which would yield NaN.
		.filter((entry) => entry.improvement > 0)
		.sort((a, b) => b.improvement - a.improvement || b.option.planValue - a.option.planValue);

	const frontier: AdviceOption[] = [];
	let bestValue = -Infinity;

	for (const { option } of improving) {
		if (!isPriced(option.lever, baseline.budgetHours) || option.planValue <= bestValue) continue;

		bestValue = option.planValue;
		frontier.push(option);
	}

	return {
		options: frontier,
		unpriced:
			improving.find((entry) => !isPriced(entry.option.lever, baseline.budgetHours))?.option ??
			null,
	};
}

/**
 * One extra solve, one block wider than today's budget (MATH.md §14.2). Only the
 * plan is needed, so this goes to the allocator directly instead of through
 * `calculateDailyMetrics` — the twenty other metrics would be computed and
 * thrown away.
 */
function calculateBudgetMarginal(input: DailyMetricsInput, baseline: DailyMetrics): BudgetMarginal {
	const { tasks, switchCost, pools, constants, posterior } = input;
	const budget = baseline.budgetHours + BLOCK_HOURS;

	const { suggestedTasks } = calculateTaskPlan(
		tasks,
		budget,
		switchCost,
		pools,
		constants,
		posterior,
	);

	// Active-scoped, like every "what is still ahead" reading (MATH.md §11.8).
	// The allocator is blind to `completed` — a task keeps its hours once ticked
	// off — so a wider budget can spend its extra block on work already done:
	// true about the plan, and useless as the next-up sentence this feeds.
	const open = new Map(baseline.activeTasks.map((task) => [task.id, task]));

	const gains = suggestedTasks
		.filter((task) => open.has(task.id))
		.map((task) => {
			const before = open.get(task.id)!;

			return {
				task,
				extraHours: task.suggestedHours - before.suggestedHours,
				// Σ P̄ is a per-task sum (MATH.md §14), so the day's rise restricted to
				// open work is just this sum — no second gain solve needed.
				extraValue: task.avgProductivity - before.avgProductivity,
			};
		});

	const baseValue = planValueOf(baseline);

	// Floored: Σ P̄ is monotone in the budget at the true optimum, but the pooled
	// path is a near-exact heuristic (MATH.md §13.3) and two adjacent budgets can
	// invert by a fraction of a percent. A negative shadow price is a claim the
	// model does not make.
	const gain = Math.max(
		0,
		gains.reduce((sum, row) => sum + row.extraValue, 0),
	);

	// The largest gainer, not the only one: the pooled transfer and admission
	// moves can reshuffle several tasks to fit the new block in (MATH.md §13.3).
	const [recipient] = gains
		.filter((row) => row.extraHours > 0)
		.sort((a, b) => b.extraHours - a.extraHours);

	return {
		blockHours: BLOCK_HOURS,
		planValueGain: gain,
		planValueGainPercent: baseValue > 0 ? Math.round((gain / baseValue) * 1000) / 10 : null,
		recipient: recipient
			? {
					taskId: recipient.task.id,
					title: recipient.task.title,
				}
			: null,
	};
}

/**
 * Re-solve the day under each lever and report, per axis, the efficient menu
 * of adjustments. Costs one full solve per candidate — `activeTasks + 3` of
 * them, up to ~950 ms on a 12-task day — so call it on demand, never from a
 * `$derived` (MATH.md §14).
 *
 * Pass `baseline` when the caller already has the current plan; it is only
 * recomputed here so the function stays usable on its own.
 */
export function suggestPlanAdjustments(
	input: DailyMetricsInput,
	baseline: DailyMetrics = calculateDailyMetrics(input),
): PlanAdvice {
	const levers = buildLevers(baseline);

	const candidates = levers.map((lever) => ({
		lever,
		metrics: calculateDailyMetrics(applyLever(input, lever)),
	}));

	const findings = ADVICE_AXES.map((axis) => ({
		axis,
		before: AXIS[axis].read(baseline),
		...paretoOptions(candidates, axis, baseline),
	})).filter((finding) => finding.options.length > 0 || finding.unpriced !== null);

	const unfunded = baseline.activeTasks.filter((task) => task.suggestedHours <= 0);

	return {
		planValue: planValueOf(baseline),
		quadrant: baseline.dailyQuadrant,
		findings,
		unfundedTaskIds: unfunded.filter((task) => !isPinned(task)).map((task) => task.id),
		unfundedMustDoTaskIds: unfunded.filter(isPinned).map((task) => task.id),
		budgetMarginal: calculateBudgetMarginal(input, baseline),
		candidatesEvaluated: candidates.length,
	};
}
