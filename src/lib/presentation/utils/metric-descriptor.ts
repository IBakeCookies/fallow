/**
 * Dashboard metrics → display rows: label, description, formatted value and
 * the band the reading falls in.
 *
 * The band policy itself lives in `utils/band.ts` — it is shared with the plan
 * advice card, which decides which findings to surface from the same call
 * (AGENTS.md R3). The numbers come from `calculateDailyMetrics`; nothing here
 * computes.
 *
 * Four readings carry `headline` and are promoted to tiles: the
 * three that judge whether today's plan is one a person can actually finish —
 * Flow Coverage, Human Capacity, Burnout Risk — and the one that answers how far
 * through it you are, Completion Rate. The rest are reference. Fallow Gain is
 * deliberately not among them: it judges the allocator, not the day, and there
 * is no action a reader can take on it.
 *
 * A reading is gated on the inputs it needs: a metric that is undefined without
 * tasks, without active tasks, without a budget or — for the executed capacity
 * burn-down — without a logged hour today renders N/A, never 0. `gated`
 * is that policy, one argument wide, because the same three-line ternary spelled
 * out 20 times is how a missing gate hides. The two rows the model can answer
 * with "nothing to report" — the bottleneck and the recovery ratio — say so in
 * their own words instead.
 *
 * The gate has to match the metric's scope family: only a
 * next-up reading may be gated on active tasks. Gating a plan-scoped one that
 * way blanks it the moment the last task is checked done — the same defect as
 * the red 0 these metrics were rescoped to remove.
 */

import type { Metric } from '$lib/presentation/type';
import type { DailyMetrics } from '$lib/business/model/metric/daily-metrics';
import type { RemainingDay } from '$lib/business/model/metric/remaining-day';
import * as m from '$lib/paraglide/messages.js';
import {
	AXIS_BAND,
	energyBalanceReading,
	getBandBiggerBetter,
	getBandDeepWork,
	getBandFlowReached,
	type Band,
} from '$lib/presentation/utils/band';

type Reading = Pick<Metric, 'value' | 'band'>;

export function buildMetrics(
	metrics: DailyMetrics,
	pools: { cognitiveHours: number; physicalHours: number },
	remainingDay: RemainingDay | null = null,
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

	// The hours already worked, against the pool they load hardest.
	// Null on the three states the row cannot read: a day that is not today, a
	// today with no 🪫 log, and a 0-hour pool carrying a draw, which saturates to
	// Infinity and would print as "Infinity%" in the sentence below. The
	// unread copy names none of them — it says what makes the row read.
	const capacity =
		remainingDay && Number.isFinite(remainingDay.capacity.percentSpent)
			? remainingDay.capacity
			: null;

	const spent = Math.round(capacity?.percentSpent ?? 0);

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
				// is the suboptimal side — a hardcoded plus rendered
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
			// Plan-scoped: "3/3 reached flow" is the answer a finished day
			// earns, so this is gated on the plan, not on what is left of it.
			...gated(
				planned,
				`${flowCoverage.reached}/${flowCoverage.total}`,
				AXIS_BAND.flowCoverage((flowCoverage.reached / flowCoverage.total) * 100),
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
			// to Infinity, which renders literally as "Infinity%".
			...gated(
				planned && Number.isFinite(humanCapacity.percent),
				`${humanCapacity.percent}%`,
				AXIS_BAND.humanCapacity(humanCapacity.percent),
			),
		},
		{
			label: m.metric_capacity_left(),
			// Next-up: it counts the hours you WORKED, so it moves as the day
			// is logged and names whichever pool those hours load hardest — which mid-day
			// need not be the pool the plan leans on, the same split Primary Bottleneck
			// is drawn along. Like Human Capacity's, the sentence can only name a
			// pool once one is measured.
			description:
				capacity === null
					? m.metric_capacity_left_desc_none()
					: m.metric_capacity_left_desc({
							type:
								capacity.limitType === 'cognitive'
									? m.metric_type_cognitive_pool()
									: m.metric_type_physical_pool(),
							hours:
								capacity.limitType === 'cognitive' ? pools.cognitiveHours : pools.physicalHours,
							percent: spent,
						}),
			// A share, not a duration: the pool is spent at wᵈ = difficultyᵈ/10, so an
			// hour of easy work draws minutes of it and rendering that as
			// "12m" beside the clock-time rows reads as time the user can still work.
			// Banded on the share SPENT, so it reads on Human Capacity's own thresholds
			// — and reaches the critical band above 100% that allocator output cannot:
			// the plan is held to the pools, worked hours are not.
			// Both halves off the one rounded share, or a pool half spent reads "88%
			// left" over a sentence saying 13% is gone. The band reads the exact one.
			...gated(
				capacity !== null,
				`${Math.max(0, 100 - spent)}%`,
				AXIS_BAND.humanCapacity(capacity?.percentSpent ?? 0),
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
			// what is left, so its axis is whichever pool the remaining work loads.
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
			// nothing. How over-drawn the pool is, is Human Capacity's
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
			// Next-up, so gating on active tasks is the matching gate.
			...gated(
				hasActive && longestWarmUp !== null,
				`${longestWarmUp?.flowStateTime.toFixed(1)}h`,
				longestWarmUp !== null
					? getBandFlowReached(longestWarmUp.suggestedHours, longestWarmUp.flowStateTime)
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
			label: m.metric_cognitive_load(),
			description: m.metric_cognitive_load_desc(),
			// Both loads arrive exact and are rounded HERE, like the capacity
			// split. The band still reads the exact value — the plan advisor bands
			// the same number, and a card that warns about an axis the row below it
			// colours 'success' is the defect `plan-advice-descriptor` pins.
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
			// options moved inside one bucket on 61.6% of them.
			...gated(
				planned,
				energyBalanceReading(energyBalance),
				AXIS_BAND.energyBalance(energyBalance),
			),
		},
		{
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
			label: m.metric_deep_work(),
			description: m.metric_deep_work_desc(),
			// Exact in, rounded here, like the Loads above.
			...gated(planned, `${Math.round(deepWorkRatio)}%`, getBandDeepWork(deepWorkRatio)),
		},
		{
			label: m.metric_quick_wins(),
			description: m.metric_quick_wins_desc(),
			...gated(hasActive, `${quickWins}`, quickWins > 0 ? 'success' : 'neutral'),
		},
		{
			label: m.metric_grind_density(),
			description: m.metric_grind_density_desc(),
			// Gated on FUNDED work, not on the task list: with nothing funded there
			// is no grind share to report, and 0% would read as a clean day. The
			// fraction rides along because the percent is quantized to 100/funded —
			// "50% (1/2)" is the honest form of a reading one task can swing by 50
			// points.
			...gated(
				grindDensity.funded > 0,
				`${grindDensity.percent}% (${grindDensity.grinds}/${grindDensity.funded})`,
				AXIS_BAND.grindDensity(grindDensity.percent),
			),
		},
		{
			label: m.metric_sustainable_work(),
			description: m.metric_sustainable_work_desc(),
			// Exact in, rounded here. Null when the plan funds no
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
			// name and must not render as "Routine".
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
