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
import type { DailyQuadrant } from '$lib/business/model/metric/calculation';

/** One honest change to today's inputs (MATH.md §14 — pools and switch cost are not levers). */
export type AdviceLever =
	| {
			/**
			 * "Suppose this task were not on today's list" — a counterfactual, not an
			 * operation. `applyLever` filters it out and re-solves; nothing is moved
			 * and nothing is deleted, and the model has no opinion on where it goes
			 * (tasks cannot move between days at all — AGENTS.md §6). Applying it is
			 * the user's action, which is why the card offers no Apply here.
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

export interface PlanAdvice {
	planValue: number;
	quadrant: DailyQuadrant;
	/** In `ADVICE_AXES` order; axes nothing can improve are omitted. */
	findings: AdviceFinding[];
	/** Active tasks the plan funds no hours for — a read, not a search. */
	unfundedTaskIds: number[];
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
		// `=== true` and not a truthiness check: the flag is persisted, so it is
		// user-reachable and may come back from an older backup as anything at all
		// (AGENTS.md R4 — validate on read).
		.filter((task) => task.mustDoToday !== true)
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

	return {
		planValue: planValueOf(baseline),
		quadrant: baseline.dailyQuadrant,
		findings,
		unfundedTaskIds: baseline.activeTasks
			.filter((task) => task.suggestedHours <= 0)
			.map((task) => task.id),
		candidatesEvaluated: candidates.length,
	};
}
