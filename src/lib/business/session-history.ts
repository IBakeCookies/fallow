/**
 * Read-side session access for pages outside the live daily session (calendar,
 * analytics) plus storage startup. This is the business layer's facade over
 * the data layer — presentation code calls these instead of the repositories.
 *
 * It sits at the root of `business/` rather than in `store/` because it holds no
 * reactive state: these are one-shot composed reads, and the stores are among
 * the callers. `utils/` would be worse — that folder is pure helpers, which is
 * why a route may value-import from it, and nothing here is pure. Root is where
 * the layer's other data-layer facades already live (`backup.ts`,
 * `appearance.ts`).
 */

import type {
	DailySession,
	DrainObservationRecord,
	FitSnapshotRecord,
	FlowObservationRecord,
	RestObservationRecord,
} from '$lib/data/type';
import { $readSessionsByDateRange } from '$lib/data/repository/session-repository';
import { $readAllFlowObservations } from '$lib/data/repository/flow-observation-repository';
import { $readAllDrainObservations } from '$lib/data/repository/drain-observation-repository';
import { $readAllRestObservations } from '$lib/data/repository/rest-observation-repository';
import { $readFitSnapshotsByDateRange } from '$lib/data/repository/fit-snapshot-repository';
import {
	migrateFromLocalStorageToIndexedDB,
	migrateEnergyParamsFromLocalStorage,
} from '$lib/data/migration/local-storage-migration';
import { addDays, daysBetween, toISODate } from '$lib/business/utils/date';
import {
	calculateFlowStateTime,
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
	fitUserConstants,
	mapEffort,
	mapEnjoyability,
	type FitPosterior,
	type UserConstants,
} from '$lib/business/model/zenith';
import {
	DEFAULT_ENERGY_PARAMS,
	fitStoppingValue,
	type EnergyParams,
	type StoppingValueFit,
	type StopObservation,
} from '$lib/business/model/zenith-energy';
import {
	calibrateEnergyParams,
	type EnergyCalibration,
} from '$lib/business/model/energy-calibration';
import {
	auditPlanAdherence,
	type PlanAudit,
	type PlanAuditDay,
} from '$lib/business/model/plan-audit';
import { summarizeSession, type DaySummary } from '$lib/business/model/metric/history';
import { latestRatingsByTitle, type TitleRating } from '$lib/business/model/title-memory';
import { summarizeBudgetHistory, type BudgetHistory } from '$lib/business/model/budget-memory';
import {
	summarizeDeclaredConstraints,
	type DeclaredConstraints,
} from '$lib/business/model/constraint-memory';
import { toEnergyTask } from '$lib/business/model/metric/calculation';
import {
	sanitizeDrainObservations,
	sanitizeFitSnapshots,
	sanitizeFlowObservations,
	sanitizeRestObservations,
	sanitizeSessions,
	type FitSnapshot,
} from '$lib/business/model/persisted';

/** Sorts below every ISO date, so it is the open lower bound of a range read. */
const BEFORE_ANY_DATE = '0000-01-01';

/**
 * Run once per page that touches persistence: migrates any legacy
 * localStorage data and asks the browser to exempt our IndexedDB data
 * from best-effort eviction under disk pressure.
 */
export async function initializeStorage(): Promise<void> {
	await migrateFromLocalStorageToIndexedDB(toISODate(), DEFAULT_SWITCH_COST);
	await migrateEnergyParamsFromLocalStorage();

	try {
		await navigator.storage?.persist();
	} catch {
		// Best-effort: the exemption is a nicety, and this runs before every read,
		// so a refused request must not fail boot into the storage-error surface.
	}
}

/**
 * The personalized model fit: ridge least-squares of the logged time-to-flow
 * measurements, anchored to the article defaults, plus the Bayesian posterior
 * the allocator consumes (MATH.md §5.1). Used by the calendar/analytics pages
 * so per-day completion rates match what the main dashboard showed that day —
 * which requires passing the posterior too, not just the point estimate.
 */
interface UserFit {
	constants: UserConstants;
	/** Never absent: every `fitUserConstants` path returns one. */
	posterior: FitPosterior;
	fitted: boolean;
	/** Σw: what the ⚡ history is worth in fresh logs, not its row count (§5.2). */
	usedCount: number;
	/** Logs dated on or after `day`, which this fit therefore did not read. Every
	 *  surface that prints a log count owes the user this one too. */
	pendingCount: number;
}

/**
 * The fit **as of** `day`: logs dated strictly before it, aged against it.
 * Causal rather than whole-history, which is what makes the fit this returns
 * the one that day actually planned under — and what stops a ⚡ logged this
 * afternoon from re-scoring a day the user finished in March.
 */
function fitFrom(observations: FlowObservationRecord[], day: string): UserFit {
	const counted = observations.filter((o) => o.date < day);

	const fit = fitUserConstants(
		counted.map((o) => ({
			E: o.E,
			beta: o.beta,
			phi: o.phiHours,
			ageDays: daysBetween(o.date, day),
		})),
	);

	return {
		constants: fit.constants,
		posterior: fit.posterior,
		fitted: fit.fitted,
		usedCount: fit.effectiveCount,
		pendingCount: observations.length - counted.length,
	};
}

async function readUserFit(): Promise<UserFit> {
	return fitFrom(sanitizeFlowObservations(await $readAllFlowObservations()), toISODate());
}

/** Below this many prequentially scored ⚡ logs the skill reading is withheld. */
const SKILL_MIN_SCORED_LOGS = 5;

/**
 * MATH.md §5's prequential walk over the user's own history: each distinct log
 * date up to `today`, scored against `fitFrom` at that date — the window a live
 * plan reads, evaluated at a past day. The earliest date is skipped: its fit had
 * seen nothing, so both planes are the defaults and the gap is identically zero.
 * The gap is mean|ϕ − ϕ̂_default| − mean|ϕ − ϕ̂_fitted|, positive when the fit
 * was closer, and never clamped.
 */
function phiSkillFrom(
	observations: FlowObservationRecord[],
	today: string,
): CalibrationSnapshot['flow']['skill'] {
	const days = [...new Set(observations.map((o) => o.date))].filter((date) => date <= today).sort();
	let gapSum = 0;
	let scoredCount = 0;

	for (const day of days.slice(1)) {
		const fit = fitFrom(observations, day);

		for (const o of observations.filter((entry) => entry.date === day)) {
			gapSum +=
				Math.abs(o.phiHours - calculateFlowStateTime(o.E, o.beta, DEFAULT_USER_CONSTANTS)) -
				Math.abs(o.phiHours - calculateFlowStateTime(o.E, o.beta, fit.constants));

			scoredCount += 1;
		}
	}

	return scoredCount < SKILL_MIN_SCORED_LOGS
		? null
		: {
				gapHours: gapSum / scoredCount,
				scoredCount,
			};
}

/**
 * Every stored day that has tasks in the range, summarized with the fit that day
 * ran under, ascending by date. The calendar and the analytics screen must read
 * a day identically, so the reads and the summarize call are composed here
 * instead of in each page (AGENTS.md R2).
 *
 * Each day is scored against **its own** recorded fit (`fitSnapshots`),
 * not one whole-history fit applied across the range — which is what let a ⚡
 * logged today silently move the completion rate of a day months past. Days with
 * no snapshot (before the store existed, or a day the user never opened
 * analytics on) fall back to the live fit, per day: refitting them instead is the
 * `O(days × logVolume)` cost that was rejected, and it is the reason the snapshots
 * are stored at all.
 */
export async function readDaySummaries(startDate: string, endDate: string): Promise<DaySummary[]> {
	const [fit, sessions, recorded] = await Promise.all([
		readUserFit(),
		$readSessionsByDateRange(startDate, endDate).then(sanitizeSessions),
		$readFitSnapshotsByDateRange(startDate, endDate).then(sanitizeFitSnapshots),
	]);

	const fitByDate = new Map(recorded.map((snapshot) => [snapshot.date, snapshot]));

	return sessions
		.filter((session) => session.tasks.length > 0)
		.map((session) => {
			const snapshot = fitByDate.get(session.date);

			return summarizeSession(
				session,
				snapshot?.constants ?? fit.constants,
				snapshot?.posterior ?? fit.posterior,
			);
		});
}

/** What the stored days say about a day the user has not filled in yet. */
export interface HistoryPrefills {
	/** What each task title was last rated (the add-task form's suggestions). */
	titleRatings: Map<string, TitleRating>;
	/** What each weekday's budget usually is (an unseen day's hours). */
	budgets: BudgetHistory;
	/** What the last day that declared them says the switch cost and pools are. */
	constraints: DeclaredConstraints;
}

/**
 * Everything the boot read derives from the stored days, over everything ever
 * stored up to and including `today` — a title or a weekday used once a year is
 * still the best guess there is, so this deliberately has no lookback window.
 * `date` is the store's keyPath and ISO dates sort lexicographically, so a lower
 * bound below any of them reads all of history in one range query.
 *
 * Every fold runs off that one scan: it grows with the user's whole history, and
 * a second range read would double the read `SessionStore` deliberately does not
 * wait for.
 */
export async function readHistoryPrefills(today: string): Promise<HistoryPrefills> {
	const sessions = sanitizeSessions(await $readSessionsByDateRange(BEFORE_ANY_DATE, today));

	return {
		titleRatings: latestRatingsByTitle(sessions),
		budgets: summarizeBudgetHistory(sessions),
		constraints: summarizeDeclaredConstraints(sessions),
	};
}

interface FinishedDay {
	session: DailySession;
	workedHours: { taskId: number; hours: number; endedAt?: number }[];
}

/**
 * Finished days: each day before `today` with at least one 🪫 drain log,
 * joined with its stored session, chronologically ascending. Shared by the
 * stopping-value calibration (§8.10) and the plan-adherence audit — both read
 * "what was actually worked" out of the same join.
 *
 * Takes the drain logs rather than reading them, so a caller that needs both
 * derivations pays for one read (and one sessions range read) instead of two.
 *
 * One row per SESSION, not one per task — summing them here is what destroyed
 * the day's breaks before §8.10's estimator could read them. Each row's
 * `createdAt` rides along as `endedAt`, and it is validated HERE rather than in
 * `sanitizeDrainObservations`: one sanitizer feeds every consumer, and
 * §8.7's α fit does not need the field, so a row failing this check must not
 * disappear from that fit (AGENTS.md R4). A day with any unusable moment loses
 * the field on every row and reads as summed.
 */
async function readFinishedDays(
	today: string,
	drainLogs: DrainObservationRecord[],
): Promise<FinishedDay[]> {
	const byDate = new Map<string, FinishedDay['workedHours']>();

	for (const log of drainLogs) {
		if (log.date >= today || log.hours <= 0) continue;

		const day = byDate.get(log.date) ?? [];

		day.push({
			taskId: log.taskId,
			hours: log.hours,
			endedAt: log.createdAt,
		});

		byDate.set(log.date, day);
	}

	if (byDate.size === 0) return [];

	const dates = [...byDate.keys()].sort();
	const sessions = sanitizeSessions(await $readSessionsByDateRange(dates[0], addDays(today, -1)));
	const sessionByDate = new Map(sessions.map((s) => [s.date, s]));
	const days: FinishedDay[] = [];

	for (const date of dates) {
		const session = sessionByDate.get(date);

		if (!session || session.tasks.length === 0 || session.availableHours <= 0) continue;

		const rows = byDate.get(date)!;

		days.push({
			session,
			workedHours: rows.every((row) => Number.isFinite(row.endedAt))
				? rows
				: rows.map(({ taskId, hours }) => ({
						taskId,
						hours,
					})),
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
	const drainLogs = sanitizeDrainObservations(await $readAllDrainObservations());

	return toStopObservations(await readFinishedDays(today, drainLogs));
}

function toStopObservations(days: FinishedDay[]): StopObservation[] {
	return days.map(({ session, workedHours }) => ({
		tasks: session.tasks.map(toEnergyTask),
		windowHours: session.availableHours,
		workedHours,
		openTaskIds: new Set(session.tasks.filter((t) => !t.completed).map((t) => t.id)),
	}));
}

/**
 * Finished days for the plan-adherence audit: the §8.10 join plus each day's
 * stored classic-planner inputs (switch cost, pools) and the fit recorded on it,
 * so the audit compares against the plan the user would actually have seen that
 * day. Chronologically ascending — `readModelReport` caps the lookback.
 *
 * A day with no snapshot carries no `fit` and falls back to the live one: days
 * before the snapshot store existed, and days the user never opened analytics on.
 */
function toPlanAuditDays(
	days: FinishedDay[],
	stops: StopObservation[],
	fitByDate: Map<string, FitSnapshot>,
): PlanAuditDay[] {
	// A PlanAuditDay is a StopObservation plus that day's classic-planner inputs,
	// so it extends the rows the stopping fit already built rather than mapping
	// every day's tasks through toEnergyTask a second time.
	return stops.map((stop, index) => {
		const { session } = days[index];
		const snapshot = fitByDate.get(session.date);

		return {
			...stop,
			switchCost: session.switchCost,
			pools: {
				cognitiveHours: session.cognitivePool ?? DEFAULT_CAPACITY_POOLS.cognitiveHours,
				physicalHours: session.physicalPool ?? DEFAULT_CAPACITY_POOLS.physicalHours,
			},
			...(snapshot && {
				fit: {
					params: snapshot.params,
					constants: snapshot.constants,
					posterior: snapshot.posterior,
				},
			}),
		};
	});
}

/**
 * Each calibrated parameter over the recorded days, ascending and ending in
 * today's fit — one series per row of the "Your model" card. Parallel arrays
 * because that is what a row's sparkline takes; they are always the same length.
 */
export interface FitTrend {
	phiHours: number[];
	recoveryRate: number[];
	alphaCog: number[];
	alphaPhys: number[];
	stoppingValue: number[];
}

/**
 * Everything the user's logs currently say about their model, in one read —
 * the calibration-visibility snapshot (analytics "Your model" card). Runs the
 * full conditioning chain on the logs that precede today: ϕ constants
 * from ⚡ flow logs, then r from ☕ rest pairs, α given r from 🪫 drain ratings
 * (§8.7/§8.9 — the same fit the main page's Burnout Risk uses), then λ₀ given
 * everything from finished days' stop decisions (§8.10). `flow` reports ϕ for a mid-scale
 * reference task (difficulty 5, enjoyment 5) so the fitted plane reads as one
 * legible number next to its default.
 *
 * Only the ϕ fit is recency-weighted (§5.2); r, α and λ₀ read every log the
 * window admits at equal weight, so the five rows of the card do not all answer
 * "over what period?" the same way.
 */
export interface CalibrationSnapshot {
	/** `usedCount` is ϕ's recency-weighted fresh-log equivalent, not a row count
	 *  (§5.2); `pendingCount` is the raw rows dated today, which no fit has read
	 *  yet and which the row therefore names rather than folds in. */
	flow: {
		fitted: boolean;
		usedCount: number;
		pendingCount: number;
		phiHours: number;
		defaultPhiHours: number;
		/** The §5 prequential gap in hours and the logs it is measured over, or
		 *  null below `SKILL_MIN_SCORED_LOGS` — a 2-log reading invites false trust. */
		skill: { gapHours: number; scoredCount: number } | null;
	};
	/** The ☕/🪫 rows dated today, which the two fits below deferred — every
	 *  surface that prints a log count owes the user this one too. */
	energy: EnergyCalibration & { pendingRestCount: number; pendingDrainCount: number };
	/** `todayPending` is the same promise in λ₀'s unit: today is a day the fit
	 *  will read tomorrow. It is 0 or 1 by construction, hence a boolean. */
	stopping: StoppingValueFit & { todayPending: boolean };
	/** The defaults each fit is anchored to — every row shows one next to its fit. */
	defaults: EnergyParams;
	/** How each fit has moved over the recorded days. */
	trend: FitTrend;
}

/** ϕ for the mid-scale reference task the card reports — difficulty 5, enjoyment 5. */
const REFERENCE_EFFORT = mapEffort(5);
const REFERENCE_ENJOYABILITY = mapEnjoyability(5);

function referencePhi(constants: UserConstants): number {
	return calculateFlowStateTime(REFERENCE_EFFORT, REFERENCE_ENJOYABILITY, constants);
}

/**
 * The recorded days plus today. Today's point is the LIVE fit, not whatever was
 * recorded earlier today: the card prints the live numbers, so a sparkline
 * ending on a stale record would contradict the value beside it.
 *
 * `windowStart` bounds it to a fixed CALENDAR lookback rather than to everything
 * the report read — that range is widened to reach the oldest audited day, so
 * the sparkline's x-extent would otherwise stretch with however long ago the
 * user last worked. It is deliberately not the audit's window, which counts the
 * last `auditDayCap` days that were WORKED and so reaches further back for
 * anyone who skips days: once there are `auditDayCap` worked days the audit's
 * stretch contains this one, never the reverse, so the sparkline only ever shows
 * movement the audit also scored. Before that it can be the wider of the two — a
 * snapshot is stamped on any day analytics was opened, an audited day needs
 * logged work.
 */
function trendFrom(
	snapshots: FitSnapshot[],
	today: string,
	windowStart: string,
	live: CalibrationSnapshot['flow'] & {
		params: EnergyParams;
		stoppingValue: number;
	},
): FitTrend {
	const past = snapshots.filter(
		(snapshot) => snapshot.date !== today && snapshot.date >= windowStart,
	);

	return {
		phiHours: [...past.map((s) => referencePhi(s.constants)), live.phiHours],
		recoveryRate: [...past.map((s) => s.params.recoveryRate), live.params.recoveryRate],
		alphaCog: [...past.map((s) => s.params.alphaCog), live.params.alphaCog],
		alphaPhys: [...past.map((s) => s.params.alphaPhys), live.params.alphaPhys],
		stoppingValue: [...past.map((s) => s.stoppingValue), live.stoppingValue],
	};
}

function calibrationSnapshotFrom(
	fit: UserFit,
	skill: CalibrationSnapshot['flow']['skill'],
	rest: RestObservationRecord[],
	drain: DrainObservationRecord[],
	stops: StopObservation[],
	recorded: FitSnapshot[],
	today: string,
	trendStart: string,
	todayPending: boolean,
): CalibrationSnapshot {
	// Causal on the same rule as the ϕ fit above, and for the same reason the
	// dashboard's copy of these fits is: the card reports the model the day is
	// planning under, so including today's ☕/🪫 here would print an α the main
	// page is not using. Only the FITS are filtered — `ModelReport.drain` still
	// carries every row, because the carry-over is a state read.
	const countedRest = rest.filter((o) => o.date < today);
	const countedDrain = drain.filter((o) => o.date < today);
	const energy = calibrateEnergyParams(countedRest, countedDrain);

	const stopping = fitStoppingValue(
		stops,
		DEFAULT_ENERGY_PARAMS.freeTimeValue,
		energy.params,
		fit.constants,
	);

	const flow = {
		fitted: fit.fitted,
		usedCount: fit.usedCount,
		pendingCount: fit.pendingCount,
		phiHours: referencePhi(fit.constants),
		defaultPhiHours: referencePhi(DEFAULT_USER_CONSTANTS),
		skill,
	};

	return {
		flow,
		energy: {
			...energy,
			pendingRestCount: rest.length - countedRest.length,
			pendingDrainCount: drain.length - countedDrain.length,
		},
		stopping: {
			...stopping,
			todayPending,
		},
		defaults: DEFAULT_ENERGY_PARAMS,
		trend: trendFrom(recorded, today, trendStart, {
			...flow,
			params: energy.params,
			stoppingValue: stopping.value,
		}),
	};
}

/**
 * Today's fit as a storable record. Only what a fit can move: the rest of
 * `EnergyParams` is model constants, so `sanitizeFitSnapshots` restores them
 * from the defaults on the way back in.
 */
function toFitSnapshotRecord(
	date: string,
	fit: UserFit,
	calibration: CalibrationSnapshot,
): Omit<FitSnapshotRecord, 'createdAt'> {
	return {
		date,
		c1: fit.constants.c1,
		c2: fit.constants.c2,
		c3: fit.constants.c3,
		covariance: fit.posterior.covariance,
		sigma2: fit.posterior.sigma2,
		alphaCog: calibration.energy.params.alphaCog,
		alphaPhys: calibration.energy.params.alphaPhys,
		recoveryRate: calibration.energy.params.recoveryRate,
		stoppingValue: calibration.stopping.value,
	};
}

/**
 * The window of recorded fits to read: the trend's fixed lookback, widened to
 * reach the oldest audited day. Those two differ for a user who skips days — the
 * audit keeps the last `auditDayCap` days that were WORKED, which can be older
 * than `auditDayCap` calendar days, and a day whose snapshot went unread would
 * silently fall back to the live fit.
 */
function recordedFitRangeStart(
	trendStart: string,
	days: FinishedDay[],
	auditDayCap: number,
): string {
	const oldestAudited = days.at(-auditDayCap)?.session.date ?? days[0]?.session.date;

	return oldestAudited !== undefined && oldestAudited < trendStart ? oldestAudited : trendStart;
}

/** An audit of no days — the oracle for a report read before anything is worked. */
export const EMPTY_PLAN_AUDIT: PlanAudit = auditPlanAdherence([], DEFAULT_ENERGY_PARAMS);

export interface ModelReport {
	calibration: CalibrationSnapshot;
	audit: PlanAudit;
	/**
	 * Every sanitized 🪫 row, for the trend to seed each day's morning
	 * reservoirs off its predecessor exactly as the dashboard does. Already read
	 * here for the fit, so surfacing it costs no second read.
	 */
	drain: DrainObservationRecord[];
	/**
	 * Every sanitized ☕ row, for the analytics screen's break totals — same
	 * shape of reason as `drain`: the r fit reads them here, so surfacing them
	 * costs no second whole-store scan.
	 */
	rest: RestObservationRecord[];
	/**
	 * Today's fit, for the caller to persist with `$updateFitSnapshot` — a read
	 * does not write, and a failed stamp must not take the two cards down with it.
	 */
	todaysFit: Omit<FitSnapshotRecord, 'createdAt'>;
}

/**
 * Everything the analytics screen's two model cards need, in one read: they
 * share the calibration snapshot, and the audit runs one optimizer pass per
 * audited day (~60ms), so `auditDayCap` bounds the lookback. The ϕ skill walk
 * alone is whole-history by design — one ridge refit per distinct ⚡ date
 * (MATH.md §5), a cost far below one audited day's optimizer pass.
 *
 * "One read" is literal — each store is read exactly once here and every
 * derivation is computed from those records. The two cards used to compose their
 * own reads, which cost three scans of the drain log and two of everything else,
 * growing with the user's whole history on every visit to the screen.
 */
export async function readModelReport(today: string, auditDayCap: number): Promise<ModelReport> {
	const [flow, rest, drain] = await Promise.all([
		$readAllFlowObservations().then(sanitizeFlowObservations),
		$readAllRestObservations().then(sanitizeRestObservations),
		$readAllDrainObservations().then(sanitizeDrainObservations),
	]);

	const fit = fitFrom(flow, today);
	// Widened by a day so the split below can say whether today would qualify as
	// a finished day, without a second scan of the sessions store.
	const finished = await readFinishedDays(addDays(today, 1), drain);
	const days = finished.filter(({ session }) => session.date < today);
	const stops = toStopObservations(days);
	const trendStart = addDays(today, -(auditDayCap - 1));

	const recorded = sanitizeFitSnapshots(
		await $readFitSnapshotsByDateRange(recordedFitRangeStart(trendStart, days, auditDayCap), today),
	);

	const calibration = calibrationSnapshotFrom(
		fit,
		phiSkillFrom(flow, today),
		rest,
		drain,
		stops,
		recorded,
		today,
		trendStart,
		finished.length > days.length,
	);

	const fitByDate = new Map(recorded.map((snapshot) => [snapshot.date, snapshot]));

	return {
		calibration,
		drain,
		rest,
		audit: auditPlanAdherence(
			toPlanAuditDays(days, stops, fitByDate).slice(-auditDayCap),
			calibration.energy.params,
			fit.constants,
			fit.posterior,
		),
		todaysFit: toFitSnapshotRecord(today, fit, calibration),
	};
}
