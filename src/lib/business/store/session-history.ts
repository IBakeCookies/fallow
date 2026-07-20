/**
 * Read-side session access for pages outside the live daily session (calendar,
 * analytics) plus storage startup. This is the business layer's facade over
 * the data layer — presentation code calls these instead of the repositories.
 */

import type { DailySession, Task } from '$lib/data/type';
import { $readSessionsByDateRange } from '$lib/data/repository/session-repository';
import { $readAllFlowObservations } from '$lib/data/repository/flow-observation-repository';
import { $readAllDrainObservations } from '$lib/data/repository/drain-observation-repository';
import { migrateFromLocalStorageToIndexedDB } from '$lib/data/migration/local-storage-migration';
import { addDays, toISODate } from '$lib/business/utils/date';
import {
	DEFAULT_SWITCH_COST,
	fitUserConstants,
	type FitPosterior,
	type UserConstants
} from '$lib/business/model/zenith';
import type { EnergyTaskInput, StopObservation } from '$lib/business/model/zenith-energy';
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
}> {
	const observations = await $readAllFlowObservations();
	const fit = fitUserConstants(
		observations.map((o) => ({ E: o.E, beta: o.beta, phi: o.phiHours }))
	);
	return { constants: fit.constants, posterior: fit.posterior };
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
 * Finished days for the stopping-value calibration (MATH.md §8.10): each day
 * with at least one 🪫 drain log is joined with its stored session (that
 * day's tasks + declared window) into a StopObservation. Today is excluded —
 * an unfinished day has not revealed its stop yet. The fit itself decides
 * which days are informative (censored days are dropped there, not here).
 */
export async function readStopObservations(today: string): Promise<StopObservation[]> {
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

	const observations: StopObservation[] = [];
	for (const [date, hoursByTask] of byDate) {
		const session = sessionByDate.get(date);
		if (!session || session.tasks.length === 0 || session.availableHours <= 0) continue;
		observations.push({
			tasks: session.tasks.map(toEnergyTask),
			windowHours: session.availableHours,
			workedHours: [...hoursByTask].map(([taskId, hours]) => ({ taskId, hours }))
		});
	}
	return observations;
}
