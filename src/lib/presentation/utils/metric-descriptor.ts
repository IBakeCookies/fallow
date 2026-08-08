/**
 * Dashboard metrics → display rows: label, description, formatted value and
 * the band the reading falls in.
 *
 * The band policy itself lives in `utils/band.ts` — it is shared with the plan
 * advice card, which decides which findings to surface from the same call
 * (AGENTS.md R3). The numbers come from `calculateDailyMetrics`; nothing here
 * computes.
 *
 * Four readings carry `headline` and are promoted to tiles: the three that judge
 * whether today's plan is one a person can actually finish — Flow Coverage,
 * Human Capacity, Burnout Risk — and the one that answers how far through it you
 * are, Completion Rate. The rest are reference. Fallow Gain is deliberately not
 * among them: it judges the allocator, not the day, and there is no action a
 * reader can take on it.
 *
 * A reading is gated on the inputs it needs: a metric that is undefined without
 * tasks, without active tasks or without a budget renders N/A, never 0. `gated`
 * is that policy, one argument wide, because the same three-line ternary spelled
 * out 20 times is how a missing gate hides. The two rows the model can answer
 * with "nothing to report" — the bottleneck and the recovery ratio — say so in
 * their own words instead.
 *
 * The gate has to match the metric's scope family (MATH.md §11.8): only a
 * next-up reading may be gated on active tasks. Gating a plan-scoped one that
 * way blanks it the moment the last task is checked done — the same defect as
 * the red 0 that §11.8 rescoped these metrics to remove.
 */

import type { Metric } from '$lib/presentation/type';
import type { DailyMetrics } from '$lib/business/model/metric/daily-metrics';
import * as m from '$lib/paraglide/messages.js';
import {
	AXIS_BAND,
	energyBalanceReading,
	getBandBiggerBetter,
	getBandDeepWork,
	type Band,
} from '$lib/presentation/utils/band';

type Reading = Pick<Metric, 'value' | 'band'>;

export function buildMetrics(
	metrics: DailyMetrics,
	pools: { cognitiveHours: number; physicalHours: number },
): Metric[] {
	const notAvailable: Reading = {
		value: m.na_value(),
		band: 'neutral',
	};

	const gated = (available: boolean, value: string, band: Band): Reading =>
		available
			? {
					value,
					band,
				}
			: notAvailable;

	const {
		totalTasks,
		completedTasks,
		zenithGain,
		yieldIndex,
		completionRate,
		flowCoverage,
		humanCapacity,
		timeScarcity,
		bottleneckTask,
		longestWarmUp,
		burnoutRisk,
		cognitiveLoad,
		physicalLoad,
		energyBalance,
		scheduleIntegrity,
		frictionIndex,
		deepWorkRatio,
		quickWins,
		grindDensity,
		rewardDensity,
		recoveryRatio,
		dailyQuadrant,
		averagePhysicalDifficulty,
		averageMentalDifficulty,
		averageEnjoyment,
	} = metrics;

	const hasTasks = totalTasks > 0;
	const hasActive = metrics.activeTasks.length > 0;
	const hasBudget = metrics.budgetHours > 0;
	const planned = hasTasks && hasBudget;
	// Tasks and a budget are not enough for the two allocation-shape readings:
	// both short-circuit to a 0 sentinel when the plan funds NOTHING — a budget
	// too small for any task to fit — and 0 is a verdict in both directions.
	// Schedule Integrity reads it critical (the alarm about nothing the comment
	// below already claimed to prevent) and Friction Index reads it 'success',
	// promising a frictionless day that was never planned. It is the case the
	// advisor answers with NaN so it stays silent; the rows go N/A to match.
	const funded = grindDensity.funded > 0;

	// The ratio has to hold, not merely be non-zero: one easy task against thirty
	// hard ones is not a day that funds its own recovery.
	const recovery: Reading =
		recoveryRatio === null
			? notAvailable
			: recoveryRatio.hard === 0
				? {
						value: m.metric_no_strain(),
						band: 'neutral',
					}
				: {
						value: `${recoveryRatio.easy}:${recoveryRatio.hard}`,
						band: recoveryRatio.easy >= recoveryRatio.hard ? 'success' : 'warning',
					};

	return [
		{
			label: m.metric_zenith_gain(),
			description: m.metric_zenith_gain_desc(),
			...gated(
				planned,
				// Signed from the value, not hardcoded '+': the dashboard reads the
				// POOLED gain, which can be slightly negative when the pooled greedy
				// is the suboptimal side (MATH.md §19.3) — a hardcoded plus rendered
				// that as "+-0.5%".
				`${zenithGain.gainPercent > 0 ? '+' : zenithGain.gainPercent < 0 ? '−' : ''}${Math.abs(zenithGain.gainPercent)}%`,
				zenithGain.gainPercent >= 15
					? 'success'
					: zenithGain.gainPercent >= 5
						? 'neutral'
						: 'warning',
			),
		},
		{
			label: m.metric_yield_index(),
			description: m.metric_yield_index_desc(),
			...gated(completedTasks > 0, `${yieldIndex}%`, getBandBiggerBetter(yieldIndex)),
		},
		{
			headline: true,
			label: m.metric_completion_rate(),
			description: m.metric_completion_rate_desc(),
			// The reading is honest at 0% but the band is not: an untouched day is the
			// starting state, not a critical one, and colouring it red on first paint
			// is what makes every other warning easy to ignore.
			...gated(
				hasTasks,
				`${completionRate}%`,
				completedTasks > 0 ? getBandBiggerBetter(completionRate) : 'neutral',
			),
		},
		{
			headline: true,
			label: m.metric_flow_coverage(),
			description: m.metric_flow_coverage_desc(),
			// Plan-scoped (§11.8): "3/3 reached flow" is the answer a finished day
			// earns, so this is gated on the plan, not on what is left of it.
			...gated(
				planned,
				`${flowCoverage.reached}/${flowCoverage.total}`,
				flowCoverage.reached === flowCoverage.total
					? 'success'
					: flowCoverage.reached >= flowCoverage.total / 2
						? 'neutral'
						: 'warning',
			),
		},
		{
			headline: true,
			label: m.metric_human_capacity(),
			// The description names the pool that binds, so it can only be written
			// once one does: with no tasks the model reports no limit type, and
			// naming a pool anyway describes a constraint that isn't there.
			description:
				humanCapacity.limitType === 'none'
					? m.metric_human_capacity_desc_none()
					: m.metric_human_capacity_desc({
							type:
								humanCapacity.limitType === 'cognitive'
									? m.metric_type_cognitive()
									: m.metric_type_physical(),
							hours:
								humanCapacity.limitType === 'cognitive'
									? pools.cognitiveHours
									: pools.physicalHours,
						}),
			// Finite as well as planned: a pool of 0 hours carrying demand saturates
			// to Infinity (MATH.md §14), which renders literally as "Infinity%".
			...gated(
				planned && Number.isFinite(humanCapacity.percent),
				`${humanCapacity.percent}%`,
				AXIS_BAND.humanCapacity(humanCapacity.percent),
			),
		},
		{
			label: m.metric_time_scarcity(),
			description: m.metric_time_scarcity_desc(),
			// Budget-gated as well as task-gated: with no budget the model returns a
			// degenerate 100%, which is true but says nothing and reads as an alarm.
			...gated(planned, `${timeScarcity}%`, AXIS_BAND.timeScarcity(timeScarcity)),
		},
		{
			label: m.metric_bottleneck(),
			// Names the pool the reading itself read the draw on — NOT Human
			// Capacity's. The two agree while the day is untouched and may part once
			// it is half done: that row judges the day as planned, this one points at
			// what is left, so its axis is whichever pool the remaining work loads
			// (MATH.md §23.1).
			description:
				bottleneckTask === null
					? m.metric_bottleneck_desc_none()
					: m.metric_bottleneck_desc({
							// The `_pool` pair, not the bare one: this sentence's host noun
							// is "pool", and German inflects for it — the bare form is
							// nominative neuter for Human Capacity's "{type} Limit" and
							// renders "deinen Kognitives-Pool" here.
							type:
								bottleneckTask.limitType === 'cognitive'
									? m.metric_type_cognitive_pool()
									: m.metric_type_physical_pool(),
						}),
			value: bottleneckTask?.title ?? m.metric_none_detected(),
			// Neutral either way, deliberately: this row names a task, and naming is
			// not a judgement of it. Banding it 'warning' whenever one existed made
			// the row a constant — every non-empty list warned, so the colour said
			// nothing (MATH.md §23). How over-drawn the pool is, is Human Capacity's
			// reading, and it is banded there.
			band: 'neutral',
		},
		{
			label: m.metric_longest_warm_up(),
			description: longestWarmUp
				? m.metric_longest_warm_up_desc({
						task: longestWarmUp.title,
					})
				: m.metric_longest_warm_up_desc_none(),
			// Next-up (§11.8), so gating on active tasks is the matching gate.
			// Banded on Flow Coverage's own criterion — hours ≥ ϕ — narrowed to this
			// one task, so the two rows cannot disagree about it.
			...gated(
				hasActive && longestWarmUp !== null,
				`${longestWarmUp?.flowStateTime.toFixed(1)}h`,
				longestWarmUp !== null && longestWarmUp.suggestedHours >= longestWarmUp.flowStateTime
					? 'success'
					: 'warning',
			),
		},
		{
			headline: true,
			label: m.metric_burnout_risk(),
			description: m.metric_burnout_risk_desc(),
			...gated(planned, `${burnoutRisk}%`, AXIS_BAND.burnoutRisk(burnoutRisk)),
		},
		{
			// Burnout Risk is a headline tile, so the energy group's separator starts
			// here: `section` is a list-only marker and a promoted row never renders it.
			section: true,
			label: m.metric_cognitive_load(),
			description: m.metric_cognitive_load_desc(),
			// Both loads arrive exact and are rounded HERE (MATH.md §25, like
			// §20's capacity split). The band still reads the exact value — the
			// plan advisor bands the same number, and a card that warns about an
			// axis the row below it colours 'success' is the defect
			// `plan-advice-descriptor` pins.
			...gated(planned, `${Math.round(cognitiveLoad)}%`, AXIS_BAND.cognitiveLoad(cognitiveLoad)),
		},
		{
			label: m.metric_physical_load(),
			description: m.metric_physical_load_desc(),
			...gated(planned, `${Math.round(physicalLoad)}%`, AXIS_BAND.physicalLoad(physicalLoad)),
		},
		{
			label: m.metric_energy_balance(),
			description: m.metric_energy_balance_desc(),
			// The share as well as the word it falls in: the word alone is three
			// buckets over a continuous reading, and the advice card's Energy Balance
			// options moved inside one bucket on 61.6% of them (MATH.md §25).
			...gated(
				planned,
				energyBalanceReading(energyBalance),
				AXIS_BAND.energyBalance(energyBalance),
			),
		},
		{
			section: true,
			label: m.metric_schedule_integrity(),
			description: m.metric_schedule_integrity_desc(),
			// Same as time scarcity: budget 0 short-circuits to 0%, an alarm about
			// nothing — and so does a budget too small to fund any task, which is
			// why the gate is `funded` and not `planned`.
			...gated(
				planned && funded,
				`${scheduleIntegrity}%`,
				AXIS_BAND.scheduleIntegrity(scheduleIntegrity),
			),
		},
		{
			label: m.metric_friction_index(),
			description: m.metric_friction_index_desc(),
			...gated(planned && funded, `${frictionIndex}%`, AXIS_BAND.frictionIndex(frictionIndex)),
		},
		{
			section: true,
			label: m.metric_deep_work(),
			description: m.metric_deep_work_desc(),
			// Exact in, rounded here (MATH.md §26, like the Loads above).
			...gated(planned, `${Math.round(deepWorkRatio)}%`, getBandDeepWork(deepWorkRatio)),
		},
		{
			label: m.metric_quick_wins(),
			description: m.metric_quick_wins_desc(),
			...gated(hasActive, `${quickWins}`, quickWins > 0 ? 'success' : 'neutral'),
		},
		{
			section: true,
			label: m.metric_grind_density(),
			description: m.metric_grind_density_desc(),
			// Gated on FUNDED work, not on the task list: with nothing funded there
			// is no grind share to report, and 0% would read as a clean day
			// (MATH.md §11.10). The fraction rides along because the percent is
			// quantized to 100/funded — "50% (1/2)" is the honest form of a reading
			// one task can swing by 50 points.
			...gated(
				grindDensity.funded > 0,
				`${grindDensity.percent}% (${grindDensity.grinds}/${grindDensity.funded})`,
				AXIS_BAND.grindDensity(grindDensity.percent),
			),
		},
		{
			label: m.metric_sustainable_work(),
			description: m.metric_sustainable_work_desc(),
			// Exact in, rounded here (MATH.md §27). Null when the plan funds no
			// hours: there is no worked time to take a share of, and 0% would
			// report a day with no work as a day of pure grind.
			...gated(
				planned && rewardDensity !== null,
				`${Math.round(rewardDensity ?? 0)}%`,
				getBandBiggerBetter(rewardDensity ?? 0),
			),
		},
		{
			label: m.metric_recovery_ratio(),
			description: m.metric_recovery_ratio_desc(),
			...recovery,
		},
		{
			label: m.metric_day_profile(),
			description: m.metric_day_profile_desc(),
			// Gated on the reading, not on the task list: the profile is hour-weighted
			// over funded tasks, so a plan that books nothing has no character to
			// name and must not render as "Routine" (MATH.md §29).
			...gated(
				dailyQuadrant !== null,
				dailyQuadrant === null
					? ''
					: {
							flow: m.quadrant_flow(),
							grind: m.quadrant_grind(),
							cruise: m.quadrant_cruise(),
							routine: m.quadrant_routine(),
						}[dailyQuadrant],
				'neutral',
			),
		},
		{
			label: m.metric_avg_physical(),
			description: m.metric_avg_physical_desc(),
			...gated(hasTasks, `${averagePhysicalDifficulty}/10`, 'neutral'),
		},
		{
			label: m.metric_avg_mental(),
			description: m.metric_avg_mental_desc(),
			...gated(hasTasks, `${averageMentalDifficulty}/10`, 'neutral'),
		},
		{
			label: m.metric_avg_enjoyment(),
			description: m.metric_avg_enjoyment_desc(),
			...gated(hasTasks, `${averageEnjoyment}/10`, 'neutral'),
		},
	];
}
