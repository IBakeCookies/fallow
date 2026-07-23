/**
 * Read-side session access for pages outside the live daily session (calendar,
 * analytics) plus storage startup. This is the business layer's facade over
 * the data layer — presentation code calls these instead of the repositories.
 */

import type { DailySession, Task } from '$lib/data/type';
import { $readSessionsByDateRange } from '$lib/data/repository/session-repository';
import { $readAllFlowObservations } from '$lib/data/repository/flow-observation-repository';
import { $readAllDrainObservations } from '$lib/data/repository/drain-observation-repository';
import { $readAllRestObservations } from '$lib/data/repository/rest-observation-repository';
import { migrateFromLocalStorageToIndexedDB } from '$lib/data/migration/local-storage-migration';
import { addDays, toISODate } from '$lib/business/utils/date';
import {
	calculateFlowStateTime,
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
	fitUserConstants,
	mapEffort,
	mapEnjoyability,
	type FitPosterior,
	type UserConstants
} from '$lib/business/model/zenith';
import {
	DEFAULT_ENERGY_PARAMS,
	fitStoppingValue,
	type EnergyTaskInput,
	type StoppingValueFit,
	type StopObservation
} from '$lib/business/model/zenith-energy';
import {
	calibrateEnergyParams,
	type EnergyCalibration
} from '$lib/business/model/energy-calibration';
import type { PlanAuditDay } from '$lib/business/model/plan-audit';
import { getEffectiveDifficulty } from '$lib/business/model/metric/calculation';

/**
 * Run once per page that touches persistence: migrates any legacy
 * localStorage data and asks the browser to exempt our IndexedDB data
 * from best-effort eviction under disk pressure.
 */
export async function initializeStorage(): Promise<void> {
	await migrateFromLocalStorageToIndexedDB(toISODate(), DEFAULT_SWITCH_COST);
	if (navigator.storage?.persist) {
		await navigator.storage.persist();
	}
}

/**
 * The personalized model fit: ridge least-squares of the logged time-to-flow
 * measurements, anchored to the article defaults, plus the Bayesian posterior
 * the allocator consumes (MATH.md §5.1). Used by the calendar/analytics pages
 * so per-day completion rates match what the main dashboard showed that day —
 * which requires passing the posterior too, not just the point estimate.
 */
export async function readUserFit(): Promise<{
	constants: UserConstants;
	posterior?: FitPosterior;
	fitted: boolean;
	usedCount: number;
}> {
	const observations = await $readAllFlowObservations();
	const fit = fitUserConstants(
		observations.map((o) => ({ E: o.E, beta: o.beta, phi: o.phiHours }))
	);
	return {
		constants: fit.constants,
		posterior: fit.posterior,
		fitted: fit.fitted,
		usedCount: observations.length
	};
}

export async function readSessionsByDateRange(
	startDate: string,
	endDate: string
): Promise<DailySession[]> {
	return $readSessionsByDateRange(startDate, endDate);
}

// Mirrors the Energy Lab's task mapping (effective difficulty combines the
// mental/physical sliders the same way the classic model does).
function toEnergyTask(task: Task): EnergyTaskInput {
	return {
		id: task.id,
		title: task.title,
		difficulty: getEffectiveDifficulty(task),
		enjoyment: task.enjoyment,
		cognitiveDemand: task.mentalDifficulty / 10,
		physicalDemand: task.physicalDifficulty / 10
	};
}

/**
 * Finished days: each day before `today` with at least one 🪫 drain log,
 * joined with its stored session, chronologically ascending. Shared by the
 * stopping-value calibration (§8.10) and the plan-adherence audit (§12) —
 * both read "what was actually worked" out of the same join.
 */
async function readFinishedDays(
	today: string
): Promise<{ session: DailySession; workedHours: { taskId: number; hours: number }[] }[]> {
	const drainLogs = await $readAllDrainObservations();
	const byDate = new Map<string, Map<number, number>>();
	for (const log of drainLogs) {
		if (log.date >= today || log.hours <= 0) continue;
		const day = byDate.get(log.date) ?? new Map<number, number>();
		day.set(log.taskId, (day.get(log.taskId) ?? 0) + log.hours);
		byDate.set(log.date, day);
	}
	if (byDate.size === 0) return [];

	const dates = [...byDate.keys()].sort();
	const sessions = await $readSessionsByDateRange(dates[0], addDays(today, -1));
	const sessionByDate = new Map(sessions.map((s) => [s.date, s]));

	const days: { session: DailySession; workedHours: { taskId: number; hours: number }[] }[] = [];
	for (const date of dates) {
		const session = sessionByDate.get(date);
		if (!session || session.tasks.length === 0 || session.availableHours <= 0) continue;
		days.push({
			session,
			workedHours: [...byDate.get(date)!].map(([taskId, hours]) => ({ taskId, hours }))
		});
	}
	return days;
}

/**
 * Finished days for the stopping-value calibration (MATH.md §8.10). Today is
 * excluded — an unfinished day has not revealed its stop yet. The fit itself
 * decides which days are informative (censored days are dropped there, not here).
 */
export async function readStopObservations(today: string): Promise<StopObservation[]> {
	return (await readFinishedDays(today)).map(({ session, workedHours }) => ({
		tasks: session.tasks.map(toEnergyTask),
		windowHours: session.availableHours,
		workedHours
	}));
}

/**
 * Finished days for the plan-adherence audit (MATH.md §12): the §8.10 join
 * plus each day's stored classic-planner inputs (switch cost, pools), so the
 * audit compares against the plan the user would actually have seen that day.
 * Chronologically ascending — cap cost with `.slice(-n)` at the call site.
 */
export async function readPlanAuditDays(today: string): Promise<PlanAuditDay[]> {
	return (await readFinishedDays(today)).map(({ session, workedHours }) => ({
		tasks: session.tasks.map(toEnergyTask),
		windowHours: session.availableHours,
		workedHours,
		switchCost: session.switchCost,
		pools: {
			cognitiveHours: session.cognitivePool ?? DEFAULT_CAPACITY_POOLS.cognitiveHours,
			physicalHours: session.physicalPool ?? DEFAULT_CAPACITY_POOLS.physicalHours
		}
	}));
}

/**
 * Everything the user's logs currently say about their model, in one read —
 * the calibration-visibility snapshot (analytics "Your model" card). Runs the
 * full conditioning chain on ALL logs: ϕ constants from ⚡ flow logs, then
 * r from ☕ rest pairs, α given r from 🪫 drain ratings (§8.7/§8.9 — the same
 * fit the main page's Burnout Risk uses), then λ₀ given everything from
 * finished days' stop decisions (§8.10). `flow` reports ϕ for a mid-scale
 * reference task (difficulty 5, enjoyment 5) so the fitted plane reads as one
 * legible number next to its default.
 */
export interface CalibrationSnapshot {
	flow: { fitted: boolean; usedCount: number; phiHours: number; defaultPhiHours: number };
	energy: EnergyCalibration;
	stopping: StoppingValueFit;
}

export async function readCalibrationSnapshot(today: string): Promise<CalibrationSnapshot> {
	const [fit, rest, drain, stops] = await Promise.all([
		readUserFit(),
		$readAllRestObservations(),
		$readAllDrainObservations(),
		readStopObservations(today)
	]);
	const energy = calibrateEnergyParams(rest, drain);
	const stopping = fitStoppingValue(
		stops,
		DEFAULT_ENERGY_PARAMS.freeTimeValue,
		energy.params,
		fit.constants
	);
	const E = mapEffort(5);
	const beta = mapEnjoyability(5);
	return {
		flow: {
			fitted: fit.fitted,
			usedCount: fit.usedCount,
			phiHours: calculateFlowStateTime(E, beta, fit.constants),
			defaultPhiHours: calculateFlowStateTime(E, beta, DEFAULT_USER_CONSTANTS)
		},
		energy,
		stopping
	};
}
