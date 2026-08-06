/**
 * Dashboard metrics → display rows: label, description, formatted value and
 * the band the reading falls in.
 *
 * The band policy itself lives in `utils/band.ts` — it is shared with the plan
 * advice card, which decides which findings to surface from the same call
 * (AGENTS.md R3). The numbers come from `calculateDailyMetrics`; nothing here
 * computes.
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
	energyBalanceSkew,
	getBandBiggerBetter,
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
		burnoutRisk,
		cognitiveLoad,
		physicalLoad,
		energyBalance,
		scheduleIntegrity,
		frictionIndex,
		deepWorkRatio,
		quickWins,
		taskVariety,
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
			headline: true,
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
			headline: true,
			label: m.metric_time_scarcity(),
			description: m.metric_time_scarcity_desc(),
			// Budget-gated as well as task-gated: with no budget the model returns a
			// degenerate 100%, which is true but says nothing and reads as an alarm.
			...gated(planned, `${timeScarcity}%`, AXIS_BAND.timeScarcity(timeScarcity)),
		},
		{
			headline: true,
			label: m.metric_bottleneck(),
			description: m.metric_bottleneck_desc(),
			value: bottleneckTask ?? m.metric_none_detected(),
			band: bottleneckTask === null ? 'neutral' : 'warning',
		},
		{
			section: true,
			label: m.metric_burnout_risk(),
			description: m.metric_burnout_risk_desc(),
			...gated(planned, `${burnoutRisk}%`, AXIS_BAND.burnoutRisk(burnoutRisk)),
		},
		{
			label: m.metric_cognitive_load(),
			description: m.metric_cognitive_load_desc(),
			...gated(planned, `${cognitiveLoad}%`, AXIS_BAND.cognitiveLoad(cognitiveLoad)),
		},
		{
			label: m.metric_physical_load(),
			description: m.metric_physical_load_desc(),
			...gated(planned, `${physicalLoad}%`, AXIS_BAND.physicalLoad(physicalLoad)),
		},
		{
			label: m.metric_energy_balance(),
			description: m.metric_energy_balance_desc(),
			...gated(
				planned,
				{
					cognitive: m.metric_cognitive_heavy(),
					physical: m.metric_physical_heavy(),
					balanced: m.metric_balanced(),
				}[energyBalanceSkew(energyBalance)],
				AXIS_BAND.energyBalance(energyBalance),
			),
		},
		{
			section: true,
			label: m.metric_schedule_integrity(),
			description: m.metric_schedule_integrity_desc(),
			// Same as time scarcity: budget 0 short-circuits to 0%, an alarm about
			// nothing.
			...gated(planned, `${scheduleIntegrity}%`, AXIS_BAND.scheduleIntegrity(scheduleIntegrity)),
		},
		{
			label: m.metric_friction_index(),
			description: m.metric_friction_index_desc(),
			...gated(planned, `${frictionIndex}%`, AXIS_BAND.frictionIndex(frictionIndex)),
		},
		{
			section: true,
			label: m.metric_deep_work(),
			description: m.metric_deep_work_desc(),
			...gated(planned, `${deepWorkRatio}%`, getBandBiggerBetter(deepWorkRatio)),
		},
		{
			label: m.metric_quick_wins(),
			description: m.metric_quick_wins_desc(),
			...gated(hasActive, `${quickWins}`, quickWins > 0 ? 'success' : 'neutral'),
		},
		{
			label: m.metric_task_variety(),
			description: m.metric_task_variety_desc(),
			...gated(hasTasks, `${taskVariety}%`, getBandBiggerBetter(taskVariety)),
		},
		{
			section: true,
			label: m.metric_grind_density(),
			description: m.metric_grind_density_desc(),
			...gated(hasTasks, `${grindDensity}%`, AXIS_BAND.grindDensity(grindDensity)),
		},
		{
			label: m.metric_sustainable_work(),
			description: m.metric_sustainable_work_desc(),
			...gated(planned, `${rewardDensity}%`, getBandBiggerBetter(rewardDensity)),
		},
		{
			label: m.metric_recovery_ratio(),
			description: m.metric_recovery_ratio_desc(),
			...recovery,
		},
		{
			label: m.metric_day_profile(),
			description: m.metric_day_profile_desc(),
			...gated(
				hasTasks,
				{
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
