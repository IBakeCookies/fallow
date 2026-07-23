/**
 * Plan-adherence audit (MATH.md §12): does the user's LOGGED behavior track
 * the classic plan or the energy plan?
 *
 * The two planners disagree structurally: the classic Σ P̄ objective spreads
 * (every touched task collects its ≈p₀ activation bonus — MATH.md §0/§2),
 * the energy model concentrates (satiety-tempered total output, §8.4). The
 * 🪫 drain logs already record what was actually worked per task per day, so
 * each finished day yields a revealed-preference comparison with NO new
 * instrument — the same trick as the §8.10 stopping fit, pointed at the
 * planner itself. Consistently higher energy overlap is the evidence gate for
 * promoting the energy plan out of the lab.
 *
 * Compositions are compared as SHARES of worked time, not absolute hours:
 * how much total to work is the stop decision, priced separately by §8.10 —
 * this audit asks only "which tasks got the day".
 */

import {
	calculatePooledAllocations,
	DEFAULT_USER_CONSTANTS,
	type CapacityPools,
	type FitPosterior,
	type UserConstants
} from './zenith';
import { optimizeSchedule, type EnergyParams, type EnergyTaskInput } from './zenith-energy';

/** One finished day: the stored session's plan inputs plus the logged hours. */
export interface PlanAuditDay {
	tasks: EnergyTaskInput[];
	/** The day's declared window (availableHours) */
	windowHours: number;
	/** Observed worked hours per task, from the 🪫 drain logs */
	workedHours: { taskId: number; hours: number }[];
	/** That day's stored switch cost (classic-planner input) */
	switchCost: number;
	/** That day's stored capacity pools (classic-planner input) */
	pools: CapacityPools;
}

export interface PlanAuditDayResult {
	workedHours: number;
	/** Composition overlap Σ min(shares) vs the classic plan, ∈ [0,1] */
	classicOverlap: number;
	/** Composition overlap vs the energy plan, ∈ [0,1] */
	energyOverlap: number;
	/** Effective number of tasks worked/planned: 1/Σ share² (inverse Herfindahl) */
	actualTaskSpread: number;
	classicTaskSpread: number;
	energyTaskSpread: number;
}

export interface PlanAudit {
	/** Days that had logged work on that day's task list */
	usedCount: number;
	days: PlanAuditDayResult[];
	/** Means over the used days */
	classicOverlap: number;
	energyOverlap: number;
	actualTaskSpread: number;
	classicTaskSpread: number;
	energyTaskSpread: number;
}

const EMPTY_AUDIT: PlanAudit = {
	usedCount: 0,
	days: [],
	classicOverlap: 0,
	energyOverlap: 0,
	actualTaskSpread: 0,
	classicTaskSpread: 0,
	energyTaskSpread: 0
};

// Shares of a nonnegative vector; an all-zero vector stays all-zero, so a
// plan that allocates nothing scores overlap 0 against any worked day.
function sharesOf(hours: number[]): number[] {
	const total = hours.reduce((sum, h) => sum + h, 0);
	return total > 0 ? hours.map((h) => h / total) : hours.map(() => 0);
}

// Σ min of two share vectors — the total-variation complement: 1 = identical
// composition, 0 = disjoint task sets.
function overlapOf(a: number[], b: number[]): number {
	return a.reduce((sum, share, i) => sum + Math.min(share, b[i]), 0);
}

// Inverse Herfindahl 1/Σ s²: 1 = all time on one task, n = equal split over n.
function taskSpreadOf(shares: number[]): number {
	const concentration = shares.reduce((sum, s) => sum + s * s, 0);
	return concentration > 0 ? 1 / concentration : 0;
}

/**
 * Compare each finished day's logged composition against what BOTH planners
 * would have suggested for that day, under the caller's live calibration
 * (fit posterior for the classic side, fitted energy params for the energy
 * side — pass what the dashboard uses so the comparison is against the plans
 * the user would actually have seen).
 *
 * Cost: one optimizeSchedule run per day (~60ms for a 3-task/8h day) — cap
 * the day count at the call site rather than here.
 */
export function auditPlanAdherence(
	days: PlanAuditDay[],
	params: EnergyParams,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	posterior?: FitPosterior
): PlanAudit {
	const results: PlanAuditDayResult[] = [];

	for (const day of days) {
		const { tasks, windowHours } = day;
		if (tasks.length === 0 || windowHours <= 0) continue;

		const hoursByTask = new Map<number, number>();
		for (const { taskId, hours } of day.workedHours) {
			if (hours > 0 && tasks.some((t) => t.id === taskId)) {
				hoursByTask.set(taskId, (hoursByTask.get(taskId) ?? 0) + hours);
			}
		}
		if (hoursByTask.size === 0) continue;

		const actual = tasks.map((t) => hoursByTask.get(t.id) ?? 0);

		const classicAllocations = calculatePooledAllocations(
			tasks.map((t) => ({
				title: t.title,
				difficulty: t.difficulty,
				enjoyment: t.enjoyment,
				cognitiveWeight: t.cognitiveDemand,
				physicalWeight: t.physicalDemand
			})),
			windowHours,
			day.pools,
			constants,
			day.switchCost,
			posterior
		);
		const classic = classicAllocations.map((a) => a.allocatedHours);

		const energyPlan = optimizeSchedule(tasks, windowHours, params, constants);
		const energyByTask = new Map<number, number>();
		for (const block of energyPlan.blocks) {
			if (block.taskId !== null) {
				energyByTask.set(block.taskId, (energyByTask.get(block.taskId) ?? 0) + block.hours);
			}
		}
		const energy = tasks.map((t) => energyByTask.get(t.id) ?? 0);

		const actualShares = sharesOf(actual);
		const classicShares = sharesOf(classic);
		const energyShares = sharesOf(energy);
		results.push({
			workedHours: actual.reduce((sum, h) => sum + h, 0),
			classicOverlap: overlapOf(actualShares, classicShares),
			energyOverlap: overlapOf(actualShares, energyShares),
			actualTaskSpread: taskSpreadOf(actualShares),
			classicTaskSpread: taskSpreadOf(classicShares),
			energyTaskSpread: taskSpreadOf(energyShares)
		});
	}

	if (results.length === 0) return EMPTY_AUDIT;
	const mean = (pick: (r: PlanAuditDayResult) => number): number =>
		results.reduce((sum, r) => sum + pick(r), 0) / results.length;
	return {
		usedCount: results.length,
		days: results,
		classicOverlap: mean((r) => r.classicOverlap),
		energyOverlap: mean((r) => r.energyOverlap),
		actualTaskSpread: mean((r) => r.actualTaskSpread),
		classicTaskSpread: mean((r) => r.classicTaskSpread),
		energyTaskSpread: mean((r) => r.energyTaskSpread)
	};
}
