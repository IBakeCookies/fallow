/**
 * What to change when the day reads badly.
 *
 * The dashboard reports that Burnout Risk is 82% and the Day Profile is
 * "Grind"; this answers what would help and what it would cost. Not a rule
 * table — a rule table has to guess the consequence of its own advice.
 * `calculateDailyMetrics` is pure, so every candidate adjustment is re-solved
 * by the same optimizer that produced the plan being criticised, and every
 * number here is a real model output.
 *
 * Threshold-free on purpose: whether a reading is bad enough to act on is a
 * band, and bands are presentation policy (presentation/AGENTS.md) — this module answers
 * the same question for every axis, unconditionally, and
 * `plan-advice-descriptor` decides which answers to surface.
 */

import {
	calculateDailyMetrics,
	type DailyMetrics,
	type DailyMetricsInput,
} from '$lib/business/model/metric/daily-metrics';
import {
	calculateQuadrantMargin,
	calculateTaskPlan,
	calculateZenithGain,
	isPinned,
	type DailyQuadrant,
} from '$lib/business/model/metric/calculation';
import { BLOCK_HOURS, importanceWeightOf } from '$lib/business/model/zenith';

/** One honest change to today's inputs (pools and switch cost are not levers). */
export type AdviceLever =
	| {
			/**
			 * "Suppose this task were not on today's list" — a counterfactual, not an
			 * operation. `applyLever` filters it out and re-solves; nothing is moved
			 * and nothing is deleted, and the model has no opinion on where it goes.
			 * Performing it is `SessionStore.moveTaskToTomorrow` (business/AGENTS.md),
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

/**
 * The readings the advisor searches over.
 *
 * Grind Density is deliberately NOT one of them. It counts
 * tasks where every lever it can pull is priced in hours, so deferring a 0.25 h
 * chore moved it 15–33pp for ~3% of Σ P̄ — the axis rewarded cardinality, which
 * is not what the allocator optimizes. Friction Index reads the same two inputs
 * hour-weighted and by magnitude, so nothing is lost. It stays a dashboard row:
 * "2 of your 3 jobs are chores" is a fair description, just not an objective.
 */
export const ADVICE_AXES = [
	'burnoutRisk',
	'humanCapacity',
	'cognitiveLoad',
	'physicalLoad',
	'energyBalance',
	'frictionIndex',
	'timeScarcity',
	'scheduleIntegrity',
	'flowCoverage',
] as const;

export type AdviceAxis = (typeof ADVICE_AXES)[number];

export interface AdviceOption {
	lever: AdviceLever;
	/** The axis reading this lever produces. */
	after: number;
	/**
	 * The Day Profile this lever moves the day TO, so a grind → cruise flip is
	 * visible — `null` when it does not move it, or when the move is too thin to
	 * claim (`quadrantFlipOf`).
	 */
	quadrantFlip: DailyQuadrant | null;
	/** Σ P̄ of the resulting plan and its signed change, in %. */
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
	 * only `unpriced` improves this axis — and empty beside a null `unpriced`
	 * when nothing does, which is a reading and not an omission.
	 */
	options: AdviceOption[];
	/**
	 * An improving budget *increase*, which Σ P̄ does not price — the extra hour
	 * costs the user something plan value cannot see. It therefore neither
	 * dominates `options` nor is ranked among them. At most one
	 * exists, because `budget + 1` is the only such lever.
	 */
	unpriced: AdviceOption | null;
}

/**
 * The time budget's shadow price: what the allocator would do
 * with one more block, and what that block is worth in Σ P̄.
 *
 * A DAY-level diagnostic, deliberately not a per-task column: the budget is a
 * number the user owns, while which task receives a block is the allocator's
 * decision, and a per-task column is arithmetic on a curve that ignores both
 * pools and the switch cost. (It is NOT because per-task marginals equalize at
 * the optimum — that was the plan and the probe refuted it.)
 */
export interface BudgetMarginal {
	/** One allocator block, in hours — what "the next block" means (MATH.md §4). */
	blockHours: number;
	/**
	 * Σ P̄ that block adds across the tasks still OPEN.
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

/** The same day and the same tasks, solved against a different declared cost. */
export interface SwitchCostAlternative {
	/** The declaration being tried, in hours. */
	switchCost: number;
	/** Σ P̄ of the plan that declaration produces. */
	planValue: number;
	/** Signed change against the current plan's Σ P̄, in %; null when that is 0. */
	planValueDeltaPercent: number | null;
}

/**
 * What today's declared switch cost is doing to today's plan.
 *
 * A DIAGNOSTIC on a declared measurement, never advice: the model rules `switchCost`
 * "a measurement of the user, not a choice about the day", which is exactly why
 * it is not an `AdviceLever` — and by the same sentence why it may be
 * instrumented. `DEFAULT_SWITCH_COST` is a literal with a citation and no other
 * instrument anywhere, while over-declaring it is the most expensive input
 * mistake the model can absorb.
 */
export interface SwitchCostPrice {
	/** Today's declaration, in hours — the number being priced. */
	declared: number;
	/**
	 * The `(m−1)·declared` hours the allocator takes off the budget before it
	 * places a block (`zenith.ts` `bestPlanWithSwitchCost`), where `m` is the
	 * count of tasks the plan actually funds — not the count on the list.
	 */
	reservedHours: number;
	/** Those hours as a share of the budget, 0–1; null when the budget is 0. */
	reservedShare: number | null;
	/**
	 * Zero and double, in that order — the bracket, not a menu: zero is the whole
	 * price of having a switch cost at all, and double is the asymmetry check,
	 * since an over-declared cost reserves overhead the day never spends. Empty
	 * when the declaration is 0 and there is nothing to price.
	 */
	alternatives: SwitchCostAlternative[];
}

export interface PlanAdvice {
	planValue: number;
	/** One per axis, in `ADVICE_AXES` order — including the ones nothing improves. */
	findings: AdviceFinding[];
	/** Active tasks the plan funds no hours for — a read, not a search. */
	unfundedTaskIds: number[];
	/**
	 * The `mustDoToday` subset of that read, partitioned out of it: an unfunded
	 * task the advisor is forbidden to defer is the one conflict the menu below
	 * cannot express, since the flag removed its only per-task lever.
	 */
	unfundedMustDoTaskIds: number[];
	budgetMarginal: BudgetMarginal;
	switchCostPrice: SwitchCostPrice;
	candidatesEvaluated: number;
}

// Named so `badness` can compose with the reading instead of respelling its
// sentinel guard (AGENTS.md R3).
const readEnergyBalance = (metrics: DailyMetrics): number =>
	metrics.cognitiveLoad + metrics.physicalLoad === 0 ? NaN : metrics.energyBalance;

const readScheduleIntegrity = (metrics: DailyMetrics): number =>
	metrics.suggestedTasks.every((task) => task.suggestedHours <= 0)
		? NaN
		: metrics.scheduleIntegrity;

/**
 * Raw reading and badness per axis, badness always lower-is-better. Energy
 * Balance is a target between the pools rather than a maximum, and Schedule
 * Integrity is bigger-better — the rest read directly.
 */
const AXIS: Record<
	AdviceAxis,
	{
		read: (metrics: DailyMetrics) => number;
		badness: (metrics: DailyMetrics) => number;
	}
> = {
	burnoutRisk: {
		read: (metrics) => metrics.burnoutRisk,
		badness: (metrics) => metrics.burnoutRisk,
	},
	humanCapacity: {
		read: (metrics) => metrics.humanCapacity.percent,
		badness: (metrics) => metrics.humanCapacity.percent,
	},
	cognitiveLoad: {
		read: (metrics) => metrics.cognitiveLoad,
		badness: (metrics) => metrics.cognitiveLoad,
	},
	physicalLoad: {
		read: (metrics) => metrics.physicalLoad,
		badness: (metrics) => metrics.physicalLoad,
	},
	energyBalance: {
		// A zero-load plan has no balance: `calculateEnergyBalance` returns the
		// display sentinel 50 there, which is also the target — read as-is, an
		// empty plan is this axis's global optimum and "set the budget to 0"
		// wins the frontier. NaN fails the improvement
		// test in both directions, so zero-load candidates and baselines are
		// silently excluded, like the Infinity Human Capacity reading.
		// The test is exact because the loads now are: rounded to
		// whole percent, a real but thin plan — 0.5h of difficulty-1 work in a 12h
		// day, 0.42% — read as 0/0 and lost this axis as if it were loadless.
		read: readEnergyBalance,
		badness: (metrics) => Math.abs(readEnergyBalance(metrics) - 50),
	},
	frictionIndex: {
		// No sentinel, unlike Energy Balance and Schedule Integrity: 0 friction on a
		// plan that funds nothing is that day's true reading, not a stand-in, and the
		// defer reaching it is priced at the whole plan's Σ P̄.
		read: (metrics) => metrics.frictionIndex,
		badness: (metrics) => metrics.frictionIndex,
	},
	timeScarcity: {
		read: (metrics) => metrics.timeScarcity,
		badness: (metrics) => metrics.timeScarcity,
	},
	scheduleIntegrity: {
		// A plan that funds nothing has no overhead share: the metric's guards
		// hand back the sentinels 100 (no tasks) and 0 (nothing funded), and the
		// 100 is this axis's global optimum — so "defer the last task" would win
		// the frontier on a day with no work left to measure. Same treatment as
		// Energy Balance above: NaN, which fails the
		// improvement test in both directions and drops such candidates AND
		// baselines silently. Until now this was safe only by circumstance — the
		// frontier's Σ P̄ gate happened to reject the empty plan.
		read: readScheduleIntegrity,
		badness: (metrics) => -readScheduleIntegrity(metrics),
	},
	flowCoverage: {
		// Ranks on the COUNT and displays the share: a defer shrinks
		// numerator and denominator together, so a share-ranked axis would hand out
		// free improvements for starving a task.
		read: (metrics) =>
			metrics.flowCoverage.total === 0
				? NaN
				: (100 * metrics.flowCoverage.reached) / metrics.flowCoverage.total,
		badness: (metrics) => -metrics.flowCoverage.reached,
	},
};

/** Σ vᵢ·P̄ᵢ over funded tasks — the allocator's own objective (MATH.md §0). */
function planValueOf(metrics: DailyMetrics): number {
	return metrics.zenithGain.optimized;
}

/**
 * A quarter of one slider point — the noise floor under a Day Profile flip.
 *
 * The label is a hard cliff on two hour-weighted averages with no hysteresis:
 * 16.2% of seeded days sit within 0.25 of a cut, and one ±1 slider point on ONE
 * task — re-solved, so the allocation moves with it — relabels 31.8%. "Day
 * Profile → Cruise" is read as a change in the day's character, so a crossing
 * this thin is a claim the metric cannot support.
 */
const QUADRANT_FLIP_MARGIN = 0.25;

/**
 * The profile a lever moves the day to, when the move is worth printing: both
 * readings must exist, differ, and clear the cliff by `QUADRANT_FLIP_MARGIN` —
 * a baseline already straddling a cut had no settled character for the lever to
 * change.
 */
function quadrantFlipOf(baseline: DailyMetrics, candidate: DailyMetrics): DailyQuadrant | null {
	if (candidate.dailyQuadrant === null || candidate.dailyQuadrant === baseline.dailyQuadrant)
		return null;

	const before = calculateQuadrantMargin(baseline.suggestedTasks);
	const after = calculateQuadrantMargin(candidate.suggestedTasks);

	if (before === null || after === null) return null;

	return Math.min(before, after) >= QUADRANT_FLIP_MARGIN ? candidate.dailyQuadrant : null;
}

/**
 * Two hour-valued declarations nearer than a minute apart are the same
 * declaration, not a distinct one to report: `budget − planSlack` lands within
 * float noise of the budget on a plan that spends everything, and doubling a
 * switch cost of zero lands on zero.
 */
const MIN_HOUR_STEP = 1 / 60;

/**
 * Whether Σ P̄ captures what this lever costs the user. Deferring and trimming
 * both pay in plan value; *adding* an hour pays in an hour, which the objective
 * does not see — and Σ P̄ is monotone in the budget, so a priced comparison
 * would let `budget + 1` dominate every real alternative.
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
	// past the hours the plan actually spends — the one lever that must stay
	// FEASIBLE. Feasible, not free: `allocate` is path-dependent on `budgetBlocks`,
	// so on a pool-bound day the re-solve lands up to −0.9% below.
	// Clamped once, by the `.map` below — `planSlackHours` is itself floored at 0
	// (`daily-metrics.ts`), so the subtraction cannot exceed the budget either way.
	const trimmed = budget - baseline.planSlackHours;

	const hours = [trimmed, budget - 1, budget + 1]
		.map((h) => Math.max(0, h))
		.filter(
			(h, index, all) =>
				Math.abs(h - budget) >= MIN_HOUR_STEP &&
				all.findIndex((other) => Math.abs(other - h) < MIN_HOUR_STEP) === index,
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
	const baseBadness = badness(baseline);

	const improving = candidates
		.map((candidate) => {
			const after = read(candidate.metrics);
			const planValue = planValueOf(candidate.metrics);

			return {
				improvement: baseBadness - badness(candidate.metrics),
				option: {
					lever: candidate.lever,
					after,
					quadrantFlip: quadrantFlipOf(baseline, candidate.metrics),
					planValue,
					// A zero baseline has no ratio, and reporting 0% there renders a
					// real gain as costing nothing.
					planValueDeltaPercent:
						baseValue > 0 ? Math.round(((planValue - baseValue) / baseValue) * 1000) / 10 : null,
				},
			};
		})
		// `>` and not `>=` so a candidate that merely TIES the baseline is not
		// offered as an option. The non-readings need no help from the operator:
		// Infinity − Infinity and the zero-load NaN are both NaN, and every NaN
		// comparison is false.
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
 * One extra solve, one block wider than today's budget. Only the
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

	// Active-scoped, like every "what is still ahead" reading.
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
				// Σ vᵢ·P̄ᵢ is a per-task sum, so the day's rise restricted to open work
				// is just this sum — no second gain solve needed. The weight has to be
				// applied here: `avgProductivity` is intrinsic (MATH.md §0 leaves every
				// per-task figure unweighted), while the `planValueOf` baseline this is
				// compared against is the weighted objective.
				extraValue:
					importanceWeightOf(task.importance) * (task.avgProductivity - before.avgProductivity),
			};
		});

	const baseValue = planValueOf(baseline);

	// Floored: Σ P̄ is monotone in the budget at the true optimum, but the pooled
	// path is a near-exact heuristic and two adjacent budgets can
	// invert by a fraction of a percent. A negative shadow price is a claim the
	// model does not make.
	const gain = Math.max(
		0,
		gains.reduce((sum, row) => sum + row.extraValue, 0),
	);

	// The largest gainer, not the only one: the pooled transfer and admission
	// moves can reshuffle several tasks to fit the new block in.
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
 * Two extra solves, at a switch cost of zero and of double.
 *
 * Goes through `calculateZenithGain` and not through the allocator plus a sum
 * over `avgProductivity`, even though Σ vᵢ·P̄ᵢ is a per-task sum and the two agree
 * to within float noise once each term carries its weight. They agree only to
 * within it: the plan comes back
 * priority-sorted, so a hand-rolled sum adds the same terms in a different order
 * and lands a few ulps off `planValueOf`. Reading the value from the function
 * that defines it makes the comparison exact by construction, and the naive
 * baseline it also builds is n rotation passes against a 2ⁿ enumeration.
 *
 * PLAN-SCOPED, over every task and not just the open ones: it is compared
 * against `planValueOf(baseline)`, which `calculateDailyMetrics` builds from the
 * whole task list, and mixing the two scopes here would report
 * a difference that is mostly the scope change.
 */
function calculateSwitchCostPrice(
	input: DailyMetricsInput,
	baseline: DailyMetrics,
): SwitchCostPrice {
	const { tasks, switchCost, pools, constants, posterior } = input;
	const budget = baseline.budgetHours;
	const baseValue = planValueOf(baseline);
	// Funded, not listed: the allocator pays for the switches it actually makes,
	// so a task the pools zeroed out costs nothing to "switch" to.
	const funded = baseline.suggestedTasks.filter((task) => task.suggestedHours > 0).length;
	const reservedHours = funded > 1 ? (funded - 1) * switchCost : 0;

	const planValueAt = (candidate: number) =>
		calculateZenithGain(tasks, budget, candidate, pools, constants, posterior).optimized;

	return {
		declared: switchCost,
		reservedHours,
		reservedShare: budget > 0 ? reservedHours / budget : null,
		alternatives: [0, switchCost * 2]
			.filter((candidate) => Math.abs(candidate - switchCost) >= MIN_HOUR_STEP)
			.map((candidate) => {
				const planValue = planValueAt(candidate);

				const delta =
					baseValue > 0 ? Math.round(((planValue - baseValue) / baseValue) * 1000) / 10 : null;

				return {
					switchCost: candidate,
					planValue,
					// CLAMPED TO THE DIRECTION THE OPTIMUM ALLOWS, and only that far.
					// The exact optimum is monotone non-increasing in `s`:
					// any allocation feasible at `s` is feasible at every smaller `s`, with
					// the same pool draw and the same Σ P̄. So a lower declaration can only
					// be worth ≥ 0 and a higher one ≤ 0, and the opposite sign is
					// allocator suboptimality rather than anything about the day —
					// measured to −6.5% on the free arm over inputs straight off the
					// constraints bar's grid, which is a number no user can tell from a
					// real one.
					//
					// This is NOT the budget marginal's floor, which would zero the doubled arm on 284 of
					// 596 fixture alternatives and delete the one thing this reading exists
					// to say: over-declaring is the expensive direction. Every informative
					// value passes through untouched; only a provably impossible sign is
					// moved, and only to 0.
					planValueDeltaPercent:
						delta === null
							? null
							: candidate < switchCost
								? Math.max(0, delta)
								: Math.min(0, delta),
				};
			}),
	};
}

/**
 * Re-solve the day under each lever and report, per axis, the efficient menu
 * of adjustments. Costs one full solve per candidate — `activeTasks + 3` of
 * them, measured at 109-124 ms for a 12-task day, its worst case —
 * so call it on demand, never from a `$derived`.
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

	// Every axis, including the ones no lever moves. Dropping
	// those made an unfixable warning indistinguishable from no warning at all,
	// and the caller — which owns the bands, not this file — cannot tell the two
	// apart from an absence.
	const findings = ADVICE_AXES.map((axis) => ({
		axis,
		before: AXIS[axis].read(baseline),
		...paretoOptions(candidates, axis, baseline),
	}));

	const unfunded = baseline.activeTasks.filter((task) => task.suggestedHours <= 0);

	return {
		planValue: planValueOf(baseline),
		findings,
		unfundedTaskIds: unfunded.filter((task) => !isPinned(task)).map((task) => task.id),
		unfundedMustDoTaskIds: unfunded.filter(isPinned).map((task) => task.id),
		budgetMarginal: calculateBudgetMarginal(input, baseline),
		switchCostPrice: calculateSwitchCostPrice(input, baseline),
		candidatesEvaluated: candidates.length,
	};
}
