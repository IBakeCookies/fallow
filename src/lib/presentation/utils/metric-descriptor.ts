/**
 * Dashboard metrics → display rows: label, description, formatted value and
 * color band.
 *
 * Presentation policy on purpose (see the `status.ts` header): banding a
 * reading as good/bad is a display decision, not domain math, so the
 * thresholds live here next to the colors rather than in the model. The
 * numbers themselves come from `calculateDailyMetrics` — nothing here computes.
 */

import type { Metric } from '$lib/presentation/type';
import type { DailyMetrics } from '$lib/business/model/metric/daily-metrics';
import * as m from '$lib/paraglide/messages.js';
import {
	STATUS,
	getStatusBiggerBetter,
	getStatusSmallerBetter,
} from '$lib/presentation/utils/status';

/** Metrics that are undefined without tasks/budget render as N/A, not 0. */
const notAvailable = () => ({
	value: m.na_value(),
	valStyle: STATUS.NEUTRAL.color,
});

export function buildMetrics(
	metrics: DailyMetrics,
	pools: { cognitiveHours: number; physicalHours: number },
): Metric[] {
	const NA = notAvailable();
	const hasTasks = metrics.totalTasks > 0;
	const hasActive = metrics.activeTasks.length > 0;
	const hasBudget = metrics.budgetHours > 0;

	const {
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

	return [
		{
			label: m.metric_zenith_gain(),
			description: m.metric_zenith_gain_desc(),
			...(hasTasks && hasBudget
				? {
						value: `+${zenithGain.gainPercent}%`,
						valStyle:
							zenithGain.gainPercent >= 15
								? STATUS.SUCCESS.color
								: zenithGain.gainPercent >= 5
									? STATUS.NEUTRAL.color
									: STATUS.WARNING.color,
					}
				: NA),
		},
		{
			label: m.metric_yield_index(),
			description: m.metric_yield_index_desc(),
			...(metrics.completedTasks > 0
				? {
						value: `${yieldIndex}%`,
						valStyle: getStatusBiggerBetter(yieldIndex).color,
					}
				: NA),
		},
		{
			label: m.metric_completion_rate(),
			description: m.metric_completion_rate_desc(),
			...(hasTasks
				? {
						value: `${completionRate}%`,
						valStyle: getStatusBiggerBetter(completionRate).color,
					}
				: NA),
		},
		{
			label: m.metric_flow_coverage(),
			description: m.metric_flow_coverage_desc(),
			...(hasActive && hasBudget
				? {
						value: `${flowCoverage.reached}/${flowCoverage.total}`,
						valStyle:
							flowCoverage.reached === flowCoverage.total
								? STATUS.SUCCESS.color
								: flowCoverage.reached >= flowCoverage.total / 2
									? STATUS.NEUTRAL.color
									: STATUS.WARNING.color,
					}
				: NA),
		},
		{
			section: true,
			label: m.metric_human_capacity(),
			description: m.metric_human_capacity_desc({
				type:
					humanCapacity.limitType === 'cognitive'
						? m.metric_type_cognitive()
						: m.metric_type_physical(),
				hours: humanCapacity.limitType === 'cognitive' ? pools.cognitiveHours : pools.physicalHours,
			}),
			...(hasTasks && hasBudget
				? {
						value: `${humanCapacity.percent}%`,
						valStyle:
							humanCapacity.percent <= 75
								? STATUS.SUCCESS.color
								: humanCapacity.percent <= 100
									? STATUS.NEUTRAL.color
									: STATUS.CRITICAL.color,
					}
				: NA),
		},
		{
			label: m.metric_time_scarcity(),
			description: m.metric_time_scarcity_desc(),
			...(hasTasks
				? {
						value: `${timeScarcity}%`,
						valStyle: getStatusSmallerBetter(timeScarcity).color,
					}
				: NA),
		},
		{
			label: m.metric_bottleneck(),
			value: bottleneckTask === 'None Detected' ? m.metric_none_detected() : bottleneckTask,
			description: m.metric_bottleneck_desc(),
			valStyle: bottleneckTask !== 'None Detected' ? STATUS.WARNING.color : STATUS.NEUTRAL.color,
		},
		{
			section: true,
			label: m.metric_burnout_risk(),
			description: m.metric_burnout_risk_desc(),
			...(hasTasks && hasBudget
				? {
						value: `${burnoutRisk}%`,
						valStyle: getStatusSmallerBetter(burnoutRisk).color,
					}
				: NA),
		},
		{
			label: m.metric_cognitive_load(),
			description: m.metric_cognitive_load_desc(),
			...(hasTasks && hasBudget
				? {
						value: `${cognitiveLoad}%`,
						valStyle: getStatusSmallerBetter(cognitiveLoad > 70 ? cognitiveLoad : 0).color,
					}
				: NA),
		},
		{
			label: m.metric_physical_load(),
			description: m.metric_physical_load_desc(),
			...(hasTasks && hasBudget
				? {
						value: `${physicalLoad}%`,
						valStyle: getStatusSmallerBetter(physicalLoad > 70 ? physicalLoad : 0).color,
					}
				: NA),
		},
		{
			label: m.metric_energy_balance(),
			description: m.metric_energy_balance_desc(),
			...(hasTasks && hasBudget
				? {
						value:
							energyBalance > 60
								? m.metric_cognitive_heavy()
								: energyBalance < 40
									? m.metric_physical_heavy()
									: m.metric_balanced(),
						valStyle:
							energyBalance > 60 || energyBalance < 40
								? STATUS.WARNING.color
								: STATUS.SUCCESS.color,
					}
				: NA),
		},
		{
			section: true,
			label: m.metric_schedule_integrity(),
			description: m.metric_schedule_integrity_desc(),
			...(hasTasks
				? {
						value: `${scheduleIntegrity}%`,
						valStyle: getStatusBiggerBetter(scheduleIntegrity).color,
					}
				: NA),
		},
		{
			label: m.metric_friction_index(),
			description: m.metric_friction_index_desc(),
			...(hasTasks && hasBudget
				? {
						value: `${frictionIndex}%`,
						valStyle: getStatusSmallerBetter(frictionIndex).color,
					}
				: NA),
		},
		{
			section: true,
			label: m.metric_deep_work(),
			description: m.metric_deep_work_desc(),
			...(hasTasks && hasBudget
				? {
						value: `${deepWorkRatio}%`,
						valStyle: getStatusBiggerBetter(deepWorkRatio).color,
					}
				: NA),
		},
		{
			label: m.metric_quick_wins(),
			description: m.metric_quick_wins_desc(),
			...(hasActive
				? {
						value: `${quickWins}`,
						valStyle: quickWins > 0 ? STATUS.SUCCESS.color : STATUS.NEUTRAL.color,
					}
				: NA),
		},
		{
			label: m.metric_task_variety(),
			description: m.metric_task_variety_desc(),
			...(hasActive
				? {
						value: `${taskVariety}%`,
						valStyle: getStatusBiggerBetter(taskVariety).color,
					}
				: NA),
		},
		{
			section: true,
			label: m.metric_grind_density(),
			description: m.metric_grind_density_desc(),
			...(hasActive
				? {
						value: `${grindDensity}%`,
						valStyle: getStatusSmallerBetter(grindDensity).color,
					}
				: NA),
		},
		{
			label: m.metric_sustainable_work(),
			description: m.metric_sustainable_work_desc(),
			...(hasTasks && hasBudget
				? {
						value: `${rewardDensity}%`,
						valStyle: getStatusBiggerBetter(rewardDensity).color,
					}
				: NA),
		},
		{
			label: m.metric_recovery_ratio(),
			value:
				recoveryRatio === 'No strain'
					? m.metric_no_strain()
					: recoveryRatio === 'N/A'
						? m.na_value()
						: recoveryRatio,
			description: m.metric_recovery_ratio_desc(),
			valStyle:
				recoveryRatio === 'No strain' || recoveryRatio === 'N/A'
					? STATUS.NEUTRAL.color
					: recoveryRatio.startsWith('0:')
						? STATUS.WARNING.color
						: STATUS.SUCCESS.color,
		},
		{
			label: m.metric_day_profile(),
			description: m.metric_day_profile_desc(),
			...(hasTasks
				? {
						value: {
							flow: m.quadrant_flow(),
							grind: m.quadrant_grind(),
							cruise: m.quadrant_cruise(),
							routine: m.quadrant_routine(),
						}[dailyQuadrant],
						valStyle: STATUS.NEUTRAL.color,
					}
				: NA),
		},
		{
			label: m.metric_avg_physical(),
			description: m.metric_avg_physical_desc(),
			...(hasTasks
				? {
						value: `${averagePhysicalDifficulty}/10`,
						valStyle: STATUS.NEUTRAL.color,
					}
				: NA),
		},
		{
			label: m.metric_avg_mental(),
			description: m.metric_avg_mental_desc(),
			...(hasTasks
				? {
						value: `${averageMentalDifficulty}/10`,
						valStyle: STATUS.NEUTRAL.color,
					}
				: NA),
		},
		{
			label: m.metric_avg_enjoyment(),
			description: m.metric_avg_enjoyment_desc(),
			...(hasTasks
				? {
						value: `${averageEnjoyment}/10`,
						valStyle: STATUS.NEUTRAL.color,
					}
				: NA),
		},
	];
}
