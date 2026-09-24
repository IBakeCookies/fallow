/**
 * Does a capacity pool DERIVED from the fitted drain rate (MATH.md §8.13) beat
 * the two declared constants it would replace (`DEFAULT_CAPACITY_POOLS`, 4/6)?
 *
 * The gate on ROADMAP item 18, in four arms, and item 45's in a fifth:
 *
 *   A  self-consistent  — the generator's true pools ARE the map of its true α,
 *                         so the law holds by construction and what is measured
 *                         is the ESTIMATION CHAIN: fit noise, the 🪫 logging-rate
 *                         bias, and proximity to the §8.13 pole
 *   B  misspecified     — true pools swept INDEPENDENTLY of α, so the map is
 *                         wrong by construction: this bounds the loss for the
 *                         user whose capacity is not their reservoir floor
 *   C  logging rate     — one truth, the 🪫 opt-in rate swept, to price how far
 *                         α̂ (and so the derived pool) drifts with diligence
 *   D  plan value       — arm A's α grid read on the OBJECTIVE instead of on
 *                         plan adherence: the plan solved under a declared pool,
 *                         then worked under the true one, scored `Σ vᵢ·P̄ᵢ(tᵢ)`
 *                         against the plan that knew the truth
 *   E  posterior        — arm A's α grid again, 40 seeds a cell at three
 *                         volumes and two opt-in rates, read on α̂'s OWN ±:
 *                         whether a withhold keyed on it fires where the map's
 *                         pole margin does not, and whether the band it would
 *                         hand the offer covers the pool the true α maps to
 *
 * Why arm D exists. A and B score with `classicOverlap` (`plan-audit.ts`), and
 * on this fixture that instrument cannot rank a pool: at seed 42, at three of
 * A's four evaluable points it puts the KNOWN-CORRECT pool at or below declared
 * 4/6 (Δ +0.0000, −0.0035, −0.0024, +0.0116), because a pool cannot bind on a day
 * shorter than itself and 4/6 binds on 9–16 of 60 days. Arm D is not exposed to
 * that failure — planning under the truth is the reference every other pool is
 * measured against — and it does not need the DECLARED pool to bind, since a
 * pool that is too generous is priced by the hours the true day could not hold.
 *
 * SELF-CHECK, printed first and the only assertion: every α̂ below is the app's
 * only if the row each α fit keeps is the day's first session. On a fixture
 * logging every session it is, on all 297 cognitive and 249 physical days (157
 * and 66 of them with more than one row to order).
 *
 * What arm A's seed sweep found (run 2026-09-24, seeds 42–53, today's
 * constants): every one of those four-decimal Δ is smaller than the spread of
 * its own cell across seeds, so none of them carries a sign. Per point, the
 * range of the truth−4/6 Δ against the seed-42 cell the sentence above quotes:
 * +0.0000 over a range of 0.0000 (both pools are inert — truth 4.00/5.97 h IS
 * very nearly 4/6, and it binds on 9 of 60 days); −0.0035 over 0.0044, positive
 * at 2 of 12 seeds; −0.0024 over 0.0129, positive at 6 of 12; +0.0116 over
 * 0.0403, ranging −0.0170 to +0.0232 and positive at 9 of 12. The derived−4/6
 * Δ moves further still — at α 0.7/0.45 it runs −0.0072 to +0.0084 (positive at
 * 4 of 12), and the +0.0204 headline at α 0.95/0.6 runs −0.0315 to +0.0467
 * (positive at 9 of 12). So "the control ranks the correct pool below 4/6" is
 * one draw of a quantity centred near zero, not a property of the instrument,
 * and the one favourable point is not a favourable point either. The sweep
 * prints only seed 42's blocks, so it says nothing about how the binding counts
 * beside them move; what it decides is the Δ, and the Δ decides nothing.
 *
 * What arm D found (run 2026-09-24, seed 42, same four α pairs): planning under
 * 4/6 loses 1.757% of the objective on average against planning under the
 * truth, and the derived pool loses 0.784% — so the map roughly halves the cost
 * of the constants it would replace. The two are not uniformly ordered: 4/6
 * wins by 0.024 and 0.327 pp at the two points where it happens to be nearly
 * right (truth 4.00/5.97 h and 2.89/4.78 h) and loses by 1.081 and 3.165 pp as
 * the truth moves away from it. The asymmetry is the reading: α̂ comes back high
 * at every point, so the derived pool is 0.27–0.79 h SMALL, and an
 * under-declared pool leaves value unspent (worst day 1.452–10.227%) while an
 * over-declared one plots a day that cannot be worked (worst day 14.880–48.272%
 * once the truth moves off 4/6). The reference holds empirically as well as by
 * design: the best day is 0.000% at every point and under both pools, so the
 * greedy's inexactness never let a wrong pool score above the right one here.
 * It stays a reading about the estimator on a law it was given — arm B, the
 * loss when that law is false, still returns no derived pool at any point.
 *
 * What arm C found (run 2026-09-24, seed 42): sweeping the 🪫 opt-in rate from
 * 0.15 to 1.56 logs per day leaves α̂_cog wandering 0.5365–0.7013 with no
 * trend, and the derived cognitive pool 2.21–2.27 h where it is defined at all. It does
 * NOT reproduce the "α̂ drifts upward with the logging rate, so the pool shrinks
 * the more diligently you log" direction ROADMAP item 18 recorded on 2026-08-04
 * from an uncommitted variant; that direction is unsupported here. At three of
 * the five rates α̂_phys lands inside the §8.13 pole margin and the map declines
 * to answer — as it does at every point of arm B, which is therefore a reading
 * about the gate rather than about the pools it was built to sweep.
 *
 * What arm E found (run 2026-09-24, seeds 42–81, arm A's five α pairs at 60,
 * 150 and 365 days and at opt-in rates 0.4 and 1). The band the offer would
 * carry — the pool at α̂ + σ̂ and at α̂ − σ̂ — does NOT cover the pool a known α
 * maps to, and covers less the longer someone logs. Pooled over both
 * reservoirs, α̂ ± σ̂ holds the true α on 68.8%, 43.0% and 17.0% of fits at 60,
 * 150 and 365 days and the default rate, and on 54.5%, 26.5% and 11.5% for a
 * complete logger; the pool band follows at 62.2%, 39.8%, 15.8% and 52.5%,
 * 27.8%, 12.6%, against the 68.3% a 1σ band is worth. It is a displacement σ̂
 * tightens around, not scatter it prices — at 365 days the median α̂ sits above
 * α at every point and the median banded offer below the true pool — and it is
 * not r̂'s: fitted at the generator's own r, α's band holds 67.0%, 43.0%, 19.0%
 * and 58.3%, 37.0%, 12.3%. The same seeds started on full reservoirs, at that
 * r, split it. For a complete logger they hold 63.3%, 63.3% and 55.5%, so most
 * of it is the mornings the night did not refill; the cognitive fits there hold
 * 26–31 of 40 per point at 365 days — the control `drain-fit-day-first.probe.ts`
 * reads on its own generator — while the physical ones at low α still lose
 * coverage with volume (29, 18 and 12 of 40 at α 0.25), a remainder this arm
 * does not attribute. At the default rate full mornings fall to 74.3%, 67.8%
 * and 36.5%, and the cognitive fits carry the fall (4–10 of 40 per point at 365
 * days, the physical 18–27): there the earliest LOGGED row is often not the
 * day's first worked session, and the unlogged ones before it drained the
 * reservoir.
 *
 * Spent as a withhold BESIDE the margin — no offer once α̂ − σ̂ is below the
 * gate — the posterior fires where the margin does not: of 382–390 offers per
 * volume and rate it would hold back 69, 35 and 19 at the default rate and 33,
 * 14 and 11 for a complete logger (α̂ − σ̂ past the pole itself on 10, all at 60
 * days and the default rate), and only ever at α up to 2.46 × the true pole. At
 * physical α 0.25, 1.36 × the pole, where there is no true pool and the margin
 * still offers on 25–33 of 40 seeds, it holds back 22 of 33 at 60 days and the
 * default rate but only 9 of 29 at 365 days and a complete logger, because σ̂
 * shrinks around the displaced α̂: the withhold thins out as the band stops
 * covering. Spent as a REPLACEMENT for the margin — offer wherever α̂ − σ̂
 * clears the pole — it would drop the 10 offers past the pole, and its gate
 * would admit 5, 12 and 16 fits the margin refuses at the default rate and 11,
 * 10 and 11 for a complete logger, 2, 10, 13 and 6, 9, 11 of them at that
 * α 0.25, where no offer is right. So the margin stays and no band ships. Whether a withhold beside the
 * margin is worth the offers it drops is a plan-value question — arm D's
 * instrument, not this arm's.
 *
 * What it CANNOT decide: whether a real person's capacity is their reservoir
 * floor. A generator only ever replays its own assumptions — arm A tests an
 * estimator against a law it was given, arm B prices being wrong about that
 * law, and neither is evidence about people. Both scorings are independent of
 * the 🪫 fit that produced the pool; the sweep is a reading, never a training
 * objective.
 *
 * Usage: npm run probe
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	calibrateEnergyParams,
	keepDayFirstDrainRows,
	offerFittedPools,
	toCognitiveDrainObservations,
	toPhysicalDrainObservations,
} from '$lib/business/model/energy-calibration';
import { auditPlanAdherence, type PlanAuditDay } from '$lib/business/model/plan-audit';
import { toEnergyTask, toPooledInputs } from '$lib/business/model/metric/calculation';
import {
	BLOCK_HOURS,
	calculatePooledAllocations,
	calculateTotalProductivity,
	DEFAULT_CAPACITY_POOLS,
	fitUserConstants,
	type CapacityPools,
} from '$lib/business/model/zenith';
import {
	CAPACITY_MAP_POLE_MARGIN,
	capacityFromDrainRate,
	DEFAULT_ENERGY_PARAMS,
	isInformativeDrainObservation,
	type DrainRateFit,
	type EnergyParams,
} from '$lib/business/model/zenith-energy';
import type { DrainObservationRecord, RestObservationRecord, Task } from '$lib/data/type';

/**
 * Days scored per grid point. `auditPlanAdherence` costs ~60 ms/day and says to
 * cap at the call site; arm D reuses the number so the arms read comparable
 * spans, though not the same days — it scores the last 60 SESSIONS, while the
 * adherence arms score the last 60 days that carry a 🪫 row.
 */
const DAY_CAP = 60;
/** The generator's own last day, for ⚡ recency weights. */
const END_DATE = '2026-08-04';

interface Fixture {
	sessions: {
		date: string;
		tasks: Task[];
		availableHours: number;
		switchCost: number;
	}[];
	drainObservations: DrainObservationRecord[];
	restObservations: RestObservationRecord[];
	flowObservations: {
		date: string;
		E: number;
		beta: number;
		phiHours: number;
	}[];
}

function generate(flags: string[], seed = 42, days = 365): Fixture {
	const out = join(mkdtempSync(join(tmpdir(), 'capacity-')), 'fixture.json');

	execFileSync(
		'node',
		[
			'scripts/generate-fixture.mjs',
			'--seed',
			String(seed),
			'--days',
			String(days),
			'--out',
			out,
			...flags,
		],
		{
			stdio: 'ignore',
		},
	);

	return JSON.parse(readFileSync(out, 'utf8')).stores;
}

const ageOf = (date: string) => (Date.parse(END_DATE) - Date.parse(date)) / 86_400_000;

/** The app's chain: r from ☕, α conditioned on it, then §8.13 at those params. */
function derive(fixture: Fixture): {
	params: EnergyParams;
	pools: CapacityPools | null;
} {
	const fit = calibrateEnergyParams(fixture.restObservations, fixture.drainObservations);
	const cognitiveHours = capacityFromDrainRate(fit.params.alphaCog, fit.params);
	const physicalHours = capacityFromDrainRate(fit.params.alphaPhys, fit.params);

	return {
		params: fit.params,
		pools:
			cognitiveHours === null || physicalHours === null
				? null
				: {
						cognitiveHours,
						physicalHours,
					},
	};
}

function auditDays(fixture: Fixture, pools: CapacityPools): PlanAuditDay[] {
	const worked = new Map<string, { taskId: number; hours: number }[]>();

	for (const row of fixture.drainObservations) {
		worked.set(row.date, [
			...(worked.get(row.date) ?? []),
			{
				taskId: row.taskId,
				hours: row.hours,
			},
		]);
	}

	return fixture.sessions
		.filter((session) => worked.has(session.date))
		.slice(-DAY_CAP)
		.map((session) => ({
			tasks: session.tasks.map(toEnergyTask),
			windowHours: session.availableHours,
			switchCost: session.switchCost,
			workedHours: worked.get(session.date)!,
			pools,
		}));
}

/**
 * The ϕ plane the fixture's own ⚡ rows fit. The generator's TRUTH c₁c₂c₃ are
 * deliberately off the defaults, so scoring a plan under the default plane
 * would mis-score every day.
 */
const phiPlaneOf = (fixture: Fixture) =>
	fitUserConstants(
		fixture.flowObservations.map((o) => ({
			E: o.E,
			beta: o.beta,
			phi: o.phiHours,
			ageDays: ageOf(o.date),
		})),
	);

/** Mean `classicOverlap` under one pool pair. */
function overlapUnder(fixture: Fixture, params: EnergyParams, pools: CapacityPools): number {
	const phi = phiPlaneOf(fixture);

	return auditPlanAdherence(auditDays(fixture, pools), params, phi.constants, phi.posterior)
		.classicOverlap;
}

const hours = (value: number | null) => (value === null ? '  none' : value.toFixed(2).padStart(6));
/** A Δ, always carrying its sign so a sweep's rows line up. */
const signed = (value: number) => (value >= 0 ? '+' : '') + value.toFixed(4);

/**
 * Scored days on which a pool could bind AT ALL: `Σ wᵢ·tᵢ ≤ Σ tᵢ ≤ budget`, so
 * a pool of P hours is inert on every day whose window is shorter than P.
 */
const bindableDays = (days: PlanAuditDay[], pools: CapacityPools) =>
	days.filter((day) => Math.min(pools.cognitiveHours, pools.physicalHours) < day.windowHours)
		.length;

/** The days a pool is scored against: what it has to be shorter than to bind. */
function windowSummary(fixture: Fixture): string {
	const windows = fixture.sessions.map((session) => session.availableHours).sort((a, b) => a - b);
	const median = windows[Math.floor(windows.length / 2)];

	return `median window ${median.toFixed(2)} h, max ${windows[windows.length - 1].toFixed(2)} h`;
}

const gap = (a: number, b: number) =>
	Math.abs(a - b)
		.toFixed(2)
		.padStart(6);

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

type PooledInputs = ReturnType<typeof toPooledInputs>;

/**
 * The hours a plan is actually worked when the reservoirs turn out to be
 * `truth`: the user follows the plan in its own priority order and each task
 * gets what the pools can still absorb, so a plan plotted against a pool the
 * user does not have is truncated rather than refused. Re-solving under the
 * truth instead would score the map against an oracle nobody has.
 *
 * Truncation floors to `BLOCK_HOURS`, as every allocation the planner emits
 * does: an unfloored remainder would hand the truncated plan a partial block
 * the app can neither schedule nor overspend, and only the truncated side gets
 * one — the plan that knew the truth is never cut — so the bias would run one
 * way.
 */
function workedUnder(
	inputs: PooledInputs,
	plan: { allocatedHours: number; optimalAvgProductivity: number }[],
	truth: CapacityPools,
): number[] {
	const worked = plan.map(() => 0);
	let cognitive = truth.cognitiveHours;
	let physical = truth.physicalHours;

	const byPriority = plan
		.map((_, index) => index)
		.sort((a, b) => plan[b].optimalAvgProductivity - plan[a].optimalAvgProductivity);

	for (const index of byPriority) {
		const { cognitiveWeight, physicalWeight } = inputs[index];

		const room = Math.min(
			cognitiveWeight > 0 ? cognitive / cognitiveWeight : Infinity,
			physicalWeight > 0 ? physical / physicalWeight : Infinity,
		);

		worked[index] = Math.min(
			plan[index].allocatedHours,
			Math.max(0, Math.floor(room / BLOCK_HOURS) * BLOCK_HOURS),
		);

		cognitive -= worked[index] * cognitiveWeight;
		physical -= worked[index] * physicalWeight;
	}

	return worked;
}

/**
 * What one day's plan is worth when it was solved under `declared` and lived
 * under `truth` — the objective `Σ vᵢ·P̄ᵢ(tᵢ)` of the hours actually worked.
 */
function dayValue(
	inputs: PooledInputs,
	day: Fixture['sessions'][number],
	phi: ReturnType<typeof phiPlaneOf>,
	declared: CapacityPools,
	truth: CapacityPools,
): number {
	const plan = calculatePooledAllocations(
		inputs,
		day.availableHours,
		declared,
		phi.constants,
		day.switchCost,
		phi.posterior,
	);

	return calculateTotalProductivity(
		inputs,
		workedUnder(inputs, plan, truth),
		phi.constants,
		phi.posterior,
	);
}

/**
 * Mean shortfall against planning under the true pool, in percent of it, over
 * the days where that reference is positive. Unlike `classicOverlap` this reads
 * the objective the planner maximizes, so it does not need the DECLARED pool to
 * bind: a pool that is too generous shows up as hours the day could not hold.
 *
 * Planning under the truth is the reference, not a proven maximum — the pooled
 * allocator is a greedy that is exact only to within a block (MATH.md §4), so a
 * plan solved under some other pool and then truncated can in principle score
 * above it. The best-day column is what shows whether that happens.
 */
function valueLoss(
	fixture: Fixture,
	declared: CapacityPools,
	truth: CapacityPools,
): {
	meanLossPercent: number;
	worstLossPercent: number;
	bestLossPercent: number;
	scoredDays: number;
} {
	const phi = phiPlaneOf(fixture);
	const losses: number[] = [];

	for (const day of fixture.sessions.slice(-DAY_CAP)) {
		const inputs = toPooledInputs(day.tasks);
		const ceiling = dayValue(inputs, day, phi, truth, truth);

		if (ceiling <= 0) continue;

		losses.push((100 * (ceiling - dayValue(inputs, day, phi, declared, truth))) / ceiling);
	}

	return {
		meanLossPercent: mean(losses),
		worstLossPercent: Math.max(...losses),
		bestLossPercent: Math.min(...losses),
		scoredDays: losses.length,
	};
}

/**
 * One grid point: the truth it was generated from against what came back.
 *
 * `withTruthScoring` adds the control arm A needs — `classicOverlap` under the
 * KNOWN-correct pool. Ranking that below 4/6 would mean the audit cannot
 * identify a pool on this fixture at all, which voids the comparison rather
 * than losing it.
 */
function report(
	label: string,
	truth: CapacityPools,
	fixture: Fixture,
	withTruthScoring = false,
): { lines: string[]; derivedDelta: number | null; truthDelta: number | null } {
	const { params, pools } = derive(fixture);

	const lines = [
		`  ${label}`,
		`    truth      cog ${truth.cognitiveHours.toFixed(2).padStart(6)}  phys ${truth.physicalHours.toFixed(2).padStart(6)}`,
		`    α̂ fitted   cog ${params.alphaCog.toFixed(4)}  phys ${params.alphaPhys.toFixed(4)}   (r̂ ${params.recoveryRate.toFixed(4)})`,
		`    derived    cog ${hours(pools?.cognitiveHours ?? null)}  phys ${hours(pools?.physicalHours ?? null)}`,
	];

	if (pools === null) {
		lines.push('    → no derived pool: α̂ below the §8.13 gate');

		return {
			lines,
			derivedDelta: null,
			truthDelta: null,
		};
	}

	const scored = auditDays(fixture, pools);
	const derivedOverlap = overlapUnder(fixture, params, pools);
	const declaredOverlap = overlapUnder(fixture, params, DEFAULT_CAPACITY_POOLS);

	lines.push(
		`    |derived−truth|  cog ${gap(pools.cognitiveHours, truth.cognitiveHours)}  phys ${gap(pools.physicalHours, truth.physicalHours)}`,
		`    |4/6−truth|      cog ${gap(DEFAULT_CAPACITY_POOLS.cognitiveHours, truth.cognitiveHours)}` +
			`  phys ${gap(DEFAULT_CAPACITY_POOLS.physicalHours, truth.physicalHours)}`,
		`    classicOverlap   derived ${derivedOverlap.toFixed(4)}  vs 4/6 ${declaredOverlap.toFixed(4)}` +
			`   (Δ ${signed(derivedOverlap - declaredOverlap)})`,
		`    pool can bind on   derived ${bindableDays(scored, pools)}/${scored.length} days` +
			`   4/6 ${bindableDays(scored, DEFAULT_CAPACITY_POOLS)}/${scored.length}` +
			`${withTruthScoring ? `   truth ${bindableDays(scored, truth)}/${scored.length}` : ''}` +
			`   (${windowSummary(fixture)})`,
	);

	const truthOverlap = withTruthScoring ? overlapUnder(fixture, params, truth) : null;

	if (truthOverlap !== null) {
		lines.push(
			`    classicOverlap   truth ${truthOverlap.toFixed(4)}` +
				`   (vs 4/6 Δ ${signed(truthOverlap - declaredOverlap)})`,
		);
	}

	return {
		lines,
		derivedDelta: derivedOverlap - declaredOverlap,
		truthDelta: truthOverlap === null ? null : truthOverlap - declaredOverlap,
	};
}

/**
 * Mirrors `generate-fixture.mjs`'s TRUTH.recoveryRate and its two model
 * constants. Arm A's truth pools must be the map read at the recovery the
 * generator actually simulates, or the arm is not self-consistent and part of
 * every |derived − truth| is that mismatch rather than the estimator.
 */
const GENERATOR_RECOVERY = {
	recoveryRate: 0.95,
	restRecoveryMultiplier: 1.5,
	microRecoveryFraction: 0.05,
};

/**
 * The truth pools an arm generates from, read off the map at `params` — null
 * when either α is inside the §8.13 pole margin there, since the map then
 * defines no pool to generate a day from.
 */
const truePoolsOf = (
	alphaCog: number,
	alphaPhys: number,
	params: typeof GENERATOR_RECOVERY,
): CapacityPools | null => {
	const cognitiveHours = capacityFromDrainRate(alphaCog, params);
	const physicalHours = capacityFromDrainRate(alphaPhys, params);

	return cognitiveHours === null || physicalHours === null
		? null
		: {
				cognitiveHours,
				physicalHours,
			};
};

/**
 * Arm A's seed sweep. A four-decimal Δ read on ONE fixture is a reading about
 * that fixture until something says how far the next one moves; twelve seeds is
 * what separates a margin from a coincidence at the ~0.003 the Δ table turns
 * on. `SEEDS[0]` stays 42, so the blocks printed above the spread are the same
 * run every earlier quote was read from.
 */
const SEEDS = [42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53];

/** One swept Δ, as the spread that decides whether its sign means anything. */
const spreadRow = (label: string, deltas: number[]) =>
	deltas.length === 0
		? `    ${label}   no pool at any seed`
		: `    ${label}   n ${String(deltas.length).padStart(2)}` +
			`   min ${signed(Math.min(...deltas))}   max ${signed(Math.max(...deltas))}` +
			`   range ${(Math.max(...deltas) - Math.min(...deltas)).toFixed(4)}` +
			`   mean ${signed(mean(deltas))}` +
			`   Δ > 0 at ${deltas.filter((delta) => delta > 0).length}/${deltas.length} seeds`;

/** The α pairs arms A, D and E generate days from. */
const SELF_CONSISTENT_GRID = [
	[0.3, 0.25],
	[0.4, 0.3],
	[0.52, 0.35],
	[0.7, 0.45],
	[0.95, 0.6],
];

/**
 * Arm E's axes: arm C's opt-in rate at the generator's own default and at a
 * complete logger — the one population whose earliest LOGGED row is also its
 * earliest worked one — crossed with the day counts of a new user and of a
 * year's logger. The arm reads no audit, so it can afford the seeds a coverage
 * share needs.
 */
const POSTERIOR_RATES = [0.4, 1];
const POSTERIOR_DAYS = [60, 150, 365];
const POSTERIOR_SEEDS = [...Array(40).keys()].map((index) => 42 + index);

type RecoveryParams = Pick<
	EnergyParams,
	'recoveryRate' | 'restRecoveryMultiplier' | 'microRecoveryFraction'
>;

/**
 * The smallest α the shipped map answers for at `params` — the margin times the
 * pole — found by bisection on the map itself rather than restated.
 */
function gateOf(params: RecoveryParams): number {
	let below = 0;
	let above = 1;

	while (capacityFromDrainRate(above, params) === null) above *= 2;

	for (let step = 0; step < 60; step++) {
		const middle = (below + above) / 2;

		if (capacityFromDrainRate(middle, params) === null) below = middle;
		else above = middle;
	}

	return above;
}

interface PosteriorRead {
	alpha: number;
	std: number;
	recoveryRate: number;
	/** The α below which the shipped map declines, at the FITTED recovery. */
	gate: number;
	/** What the Day Setup button offers: that gate, the 0.1 h rounding, the field's ceiling. */
	offer: number | null;
	/** The pool at α̂ + σ̂, and at α̂ − σ̂ — null once α̂ − σ̂ is below the gate. */
	low: number | null;
	high: number | null;
	/** The same filter, prior and fit conditioned on the generator's own r. */
	trueRecovery: DrainRateFit;
	/** That fit again, on the same days started on full reservoirs. */
	fullMornings: DrainRateFit;
}

/**
 * Both reservoirs, read the way the offer reads them. `fullMornings` is the
 * same seed generated with `--full-mornings`: identical days, draws and noise.
 */
function readPosteriors(
	fixture: Fixture,
	fullMornings: Fixture,
): Record<'cognitive' | 'physical', PosteriorRead | null> {
	const calibration = calibrateEnergyParams(fixture.restObservations, fixture.drainObservations);
	const offer = offerFittedPools(calibration);
	const gate = gateOf(calibration.params);

	// No ☕ rows, so r stays the seed's: what displacement remains is not r̂'s.
	const atTrueRecovery = (drain: DrainObservationRecord[]) =>
		calibrateEnergyParams([], drain, {
			...DEFAULT_ENERGY_PARAMS,
			...GENERATOR_RECOVERY,
		});

	const trueRecovery = atTrueRecovery(fixture.drainObservations);
	const fullMorningRecovery = atTrueRecovery(fullMornings.drainObservations);

	const read = (reservoir: 'cognitive' | 'physical'): PosteriorRead | null => {
		const fit = reservoir === 'cognitive' ? calibration.cognitiveDrain : calibration.physicalDrain;

		if (!fit.fitted) return null;

		return {
			alpha: fit.alpha,
			std: fit.alphaStd!,
			recoveryRate: calibration.params.recoveryRate,
			gate,
			offer: reservoir === 'cognitive' ? offer.cognitiveHours : offer.physicalHours,
			low: capacityFromDrainRate(fit.alpha + fit.alphaStd!, calibration.params),
			high: capacityFromDrainRate(fit.alpha - fit.alphaStd!, calibration.params),
			trueRecovery:
				reservoir === 'cognitive' ? trueRecovery.cognitiveDrain : trueRecovery.physicalDrain,
			fullMornings:
				reservoir === 'cognitive'
					? fullMorningRecovery.cognitiveDrain
					: fullMorningRecovery.physicalDrain,
		};
	};

	return {
		cognitive: read('cognitive'),
		physical: read('physical'),
	};
}

const medianOf = (values: number[]) =>
	[...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** A group's median offer error, signed and absolute, or a dash for a group with no member. */
function offerError(group: PosteriorRead[], truth: number): string {
	if (group.length === 0) return '—';

	const errors = group.map((read) => read.offer! - truth);
	const middle = medianOf(errors);

	return `${(middle >= 0 ? '+' : '') + middle.toFixed(2)} h / |${medianOf(errors.map(Math.abs)).toFixed(2)}| h`;
}

interface PosteriorCounts {
	fitted: number;
	offered: number;
	pastMargin: number;
	pastPole: number;
	clearOfPole: number;
	alphaCovered: number;
	trueRecoveryCovered: number;
	fullMorningsCovered: number;
	/** Offers with a band, counted only where a true pool exists for it to cover. */
	banded: number;
	poolCovered: number;
}

/** One reservoir at one truth, volume and rate, over every seed: its lines and its counts. */
function readPosteriorCell(
	label: string,
	reads: (PosteriorRead | null)[],
	alphaTrue: number,
	truth: number | null,
): { lines: string[]; counts: PosteriorCounts } {
	const fitted = reads.filter((read): read is PosteriorRead => read !== null);
	const poleOf = (read: PosteriorRead) => read.gate / CAPACITY_MAP_POLE_MARGIN;
	const offered = fitted.filter((read) => read.offer !== null);
	const banded = offered.filter((read) => read.high !== null);
	const pastMargin = offered.filter((read) => read.high === null);
	const pastPole = pastMargin.filter((read) => read.alpha - read.std < poleOf(read));

	const clearOfPole = fitted.filter(
		(read) => read.alpha < read.gate && read.alpha - read.std >= poleOf(read),
	);

	const alphaCovered = fitted.filter((read) => Math.abs(read.alpha - alphaTrue) <= read.std);
	const covers = (fit: DrainRateFit) => Math.abs(fit.alpha - alphaTrue) <= fit.alphaStd!;
	const trueRecoveryCovered = fitted.filter((read) => covers(read.trueRecovery));
	const fullMorningsCovered = fitted.filter((read) => covers(read.fullMornings));

	const poolCovered =
		truth === null ? [] : banded.filter((read) => read.low! <= truth && truth <= read.high!);

	const againstPole = (value: (read: PosteriorRead) => number) => {
		const ratios = fitted.map((read) => value(read) / poleOf(read));

		return `min ${Math.min(...ratios).toFixed(2)} median ${medianOf(ratios).toFixed(2)}`;
	};

	return {
		lines: [
			`  ${label}   fit ${fitted.length}/${reads.length}` +
				`   r̂ ${medianOf(fitted.map((read) => read.recoveryRate)).toFixed(3)}` +
				`   α̂ ${medianOf(fitted.map((read) => read.alpha)).toFixed(4)}` +
				` ± ${medianOf(fitted.map((read) => read.std)).toFixed(4)}` +
				`   α̂/pole ${againstPole((read) => read.alpha)}` +
				`   (α̂ − σ̂)/pole ${againstPole((read) => read.alpha - read.std)}`,
			`        offered ${offered.length}   band past the margin ${pastMargin.length}, past the pole ${pastPole.length}` +
				`   withheld with the band clear of the pole ${clearOfPole.length}` +
				`   α̂ ± σ̂ covers α ${alphaCovered.length}/${fitted.length}`,
			`        at the true r: α̂ ${medianOf(fitted.map((read) => read.trueRecovery.alpha)).toFixed(4)},` +
				` covers α ${trueRecoveryCovered.length}/${fitted.length}` +
				`   and on full mornings: α̂ ${medianOf(fitted.map((read) => read.fullMornings.alpha)).toFixed(4)},` +
				` covers α ${fullMorningsCovered.length}/${fitted.length}`,
			truth === null
				? `        no true pool: each of the ${offered.length} offers is one the map declines at the truth`
				: `        band covers the true pool ${poolCovered.length}/${banded.length}` +
					`   offer − truth ${offerError(banded, truth)} with a band,` +
					` ${offerError(pastMargin, truth)} past the margin`,
		],
		counts: {
			fitted: fitted.length,
			offered: offered.length,
			pastMargin: pastMargin.length,
			pastPole: pastPole.length,
			clearOfPole: clearOfPole.length,
			alphaCovered: alphaCovered.length,
			trueRecoveryCovered: trueRecoveryCovered.length,
			fullMorningsCovered: fullMorningsCovered.length,
			banded: truth === null ? 0 : banded.length,
			poolCovered: poolCovered.length,
		},
	};
}

function addCounts(sum: PosteriorCounts | undefined, cell: PosteriorCounts): PosteriorCounts {
	if (sum === undefined) return cell;

	return {
		fitted: sum.fitted + cell.fitted,
		offered: sum.offered + cell.offered,
		pastMargin: sum.pastMargin + cell.pastMargin,
		pastPole: sum.pastPole + cell.pastPole,
		clearOfPole: sum.clearOfPole + cell.clearOfPole,
		alphaCovered: sum.alphaCovered + cell.alphaCovered,
		trueRecoveryCovered: sum.trueRecoveryCovered + cell.trueRecoveryCovered,
		fullMorningsCovered: sum.fullMorningsCovered + cell.fullMorningsCovered,
		banded: sum.banded + cell.banded,
		poolCovered: sum.poolCovered + cell.poolCovered,
	};
}

describe('capacity from the fitted drain rate (MATH.md §8.13)', () => {
	/**
	 * The α fits read each day's earliest 🪫 row by `createdAt`, so every α̂ below
	 * is only the app's if the generator stamps a row at the moment it would be
	 * written. It writes a day's rows in the order the sessions were worked, so
	 * the lowest id per day is that day's first session.
	 */
	it('self-check — the row the α fit keeps is the day’s first session', () => {
		// Every session logged, so most days carry several rows to order.
		const { drainObservations } = generate(['--drain-log-rate', '1']);

		const readings = (
			[
				['cog ', toCognitiveDrainObservations],
				['phys', toPhysicalDrainObservations],
			] as const
		).map(([label, toObservations]) => {
			const firstSession = new Map<string, number>();
			const rowsPerDay = new Map<string, number>();

			for (const row of drainObservations) {
				if (!isInformativeDrainObservation(toObservations([row])[0])) continue;

				firstSession.set(row.date, Math.min(firstSession.get(row.date) ?? Infinity, row.id!));
				rowsPerDay.set(row.date, (rowsPerDay.get(row.date) ?? 0) + 1);
			}

			const kept = keepDayFirstDrainRows(drainObservations, toObservations);
			const misread = kept.filter((row) => row.id !== firstSession.get(row.date)).length;
			const ordered = [...rowsPerDay.values()].filter((count) => count > 1).length;

			return {
				line: `  ${label}  ${kept.length} days, ${ordered} with more than one row, a later session kept on ${misread}`,
				misread,
			};
		});

		console.log(
			[
				'',
				'SELF-CHECK — the day-first row the α fits read, on a fixture logging every session',
				...readings.map((reading) => reading.line),
				'',
			].join('\n'),
		);

		for (const reading of readings) expect(reading.misread).toBe(0);
	});

	it('A — self-consistent: the true pool IS the map of the true α', () => {
		const blocks: string[][] = [];
		const spread: string[] = [];

		for (const [alphaCog, alphaPhys] of SELF_CONSISTENT_GRID) {
			const label = `α true  cog ${alphaCog}  phys ${alphaPhys}`;
			const truth = truePoolsOf(alphaCog, alphaPhys, GENERATOR_RECOVERY);

			if (truth === null) {
				blocks.push([
					`  ${label}`,
					'    → skipped: inside the §8.13 pole margin at the generator’s own recovery,',
					'      so the map defines no true pool for this α to generate a day from',
				]);

				spread.push(`  ${label}   → skipped: inside the §8.13 pole margin`, '');
				continue;
			}

			const derivedDeltas: number[] = [];
			const truthDeltas: number[] = [];

			for (const seed of SEEDS) {
				const point = report(
					label,
					truth,
					generate(
						[
							'--alpha-cog',
							String(alphaCog),
							'--alpha-phys',
							String(alphaPhys),
							'--true-pools',
							`${truth.cognitiveHours},${truth.physicalHours}`,
						],
						seed,
					),
					true,
				);

				if (seed === SEEDS[0]) blocks.push(point.lines);

				if (point.derivedDelta !== null) derivedDeltas.push(point.derivedDelta);

				if (point.truthDelta !== null) truthDeltas.push(point.truthDelta);
			}

			spread.push(
				`  ${label}`,
				spreadRow('derived − 4/6', derivedDeltas),
				spreadRow('truth   − 4/6', truthDeltas),
				'',
			);
		}

		console.log(
			[
				'',
				"ARM A — self-consistent (true pools = §8.13 map of the true α, at the GENERATOR's recovery)",
				`last ${DAY_CAP} audit-eligible days per point, seed ${SEEDS[0]}`,
				'',
				...blocks.flatMap((block) => [...block, '']),
				`  SEED SPREAD of the classicOverlap Δ over seeds ${SEEDS[0]}–${SEEDS[SEEDS.length - 1]}`,
				'  (n counts the seeds at which the pool being scored exists at all)',
				'',
				...spread,
			].join('\n'),
		);
	});

	it('B — misspecified: true pools swept independently of α', () => {
		const losses: number[] = [];
		const seen = new Set<string>();
		const blocks: string[][] = [];
		let degenerate = 0;

		for (const cognitive of [2, 4, 7]) {
			for (const physical of [3, 6, 9]) {
				const fixture = generate(['--true-pools', `${cognitive},${physical}`]);
				const days = createHash('sha256').update(JSON.stringify(fixture.sessions)).digest('hex');

				// A pool no day is long enough to spend never binds, so the point
				// generates a day-for-day copy of an earlier point's fixture and
				// would otherwise be averaged in as if it were evidence.
				if (seen.has(days)) {
					degenerate++;
					continue;
				}

				seen.add(days);

				const { params, pools } = derive(fixture);

				if (pools !== null) {
					losses.push(
						overlapUnder(fixture, params, DEFAULT_CAPACITY_POOLS) -
							overlapUnder(fixture, params, pools),
					);
				}

				blocks.push(
					report(
						`true pools  cog ${cognitive}  phys ${physical}`,
						{
							cognitiveHours: cognitive,
							physicalHours: physical,
						},
						fixture,
					).lines,
				);
			}
		}

		const summary =
			losses.length === 0
				? ['  no listed point produced a derived pool at all — see the α̂ readings above']
				: [
						`  classicOverlap loss vs 4/6 over ${losses.length} distinct points:` +
							`  worst ${Math.max(...losses).toFixed(4)}` +
							`  mean ${(losses.reduce((sum, loss) => sum + loss, 0) / losses.length).toFixed(4)}`,
						'  (positive = the derived pool scores WORSE than declared 4/6)',
					];

		console.log(
			[
				'',
				'ARM B — misspecified (α at the generator defaults 0.52 / 0.24, pools swept)',
				`last ${DAY_CAP} audit-eligible days per point`,
				'',
				...blocks.flatMap((block) => [...block, '']),
				`  ${degenerate} of 9 grid points are not listed: their pools never bound, so the`,
				'  generator emitted a day-for-day copy of an earlier point and they are not evidence',
				'',
				...summary,
				'',
			].join('\n'),
		);
	});

	it('C — what the 🪫 opt-in rate costs the derived pool', () => {
		const truth = truePoolsOf(0.52, 0.24, GENERATOR_RECOVERY);

		// α_phys 0.24 sits inside the pole margin at the generator's recovery, so
		// there is no pair to constrain the day with — the sweep then runs on the
		// committed generator's own uncapped days, which is what it measures.
		const poolFlags = truth
			? ['--true-pools', `${truth.cognitiveHours},${truth.physicalHours}`]
			: [];

		const rows = [0.1, 0.25, 0.5, 0.75, 1].map((rate) => {
			const fixture = generate(['--drain-log-rate', String(rate), ...poolFlags]);
			const { params, pools } = derive(fixture);
			const perDay = fixture.drainObservations.length / fixture.sessions.length;

			return (
				`  rate ${rate.toFixed(2)}   ${String(fixture.drainObservations.length).padStart(4)} 🪫 rows` +
				`  (${perDay.toFixed(2)}/day)   α̂ cog ${params.alphaCog.toFixed(4)}  phys ${params.alphaPhys.toFixed(4)}` +
				`   derived cog ${hours(pools?.cognitiveHours ?? null)}  phys ${hours(pools?.physicalHours ?? null)}`
			);
		});

		console.log(
			[
				'',
				`ARM C — logging-rate bias (α true 0.52 / 0.24, true pools ${
					truth
						? `${truth.cognitiveHours.toFixed(2)} / ${truth.physicalHours.toFixed(2)} h)`
						: 'undefined at this recovery — no capacity constraint on the day)'
				}`,
				'',
				...rows,
				'',
			].join('\n'),
		);
	});

	it('D — plan value: what each pool is worth against the pool that is true', () => {
		const evaluable: { declared: number; derived: number }[] = [];

		const rows = SELF_CONSISTENT_GRID.map(([alphaCog, alphaPhys]) => {
			const label = `α true  cog ${alphaCog}  phys ${alphaPhys}`;
			const truth = truePoolsOf(alphaCog, alphaPhys, GENERATOR_RECOVERY);

			if (truth === null) return `  ${label}   → skipped: inside the §8.13 pole margin`;

			const fixture = generate([
				'--alpha-cog',
				String(alphaCog),
				'--alpha-phys',
				String(alphaPhys),
				'--true-pools',
				`${truth.cognitiveHours},${truth.physicalHours}`,
			]);

			const { pools } = derive(fixture);
			const declared = valueLoss(fixture, DEFAULT_CAPACITY_POOLS, truth);

			if (pools === null)
				return (
					`  ${label}   truth ${truth.cognitiveHours.toFixed(2)}/${truth.physicalHours.toFixed(2)} h` +
					`   4/6 loses ${declared.meanLossPercent.toFixed(3)}%   derived: none (below the §8.13 gate)`
				);

			const derivedLoss = valueLoss(fixture, pools, truth);

			evaluable.push({
				declared: declared.meanLossPercent,
				derived: derivedLoss.meanLossPercent,
			});

			return (
				`  ${label}   truth ${truth.cognitiveHours.toFixed(2)}/${truth.physicalHours.toFixed(2)} h` +
				`  derived ${pools.cognitiveHours.toFixed(2)}/${pools.physicalHours.toFixed(2)} h\n` +
				`      mean loss vs planning under the truth   4/6 ${declared.meanLossPercent.toFixed(3)}%` +
				`   derived ${derivedLoss.meanLossPercent.toFixed(3)}%` +
				`   (Δ ${(derivedLoss.meanLossPercent - declared.meanLossPercent >= 0 ? '+' : '') + (derivedLoss.meanLossPercent - declared.meanLossPercent).toFixed(3)} pp)\n` +
				`      worst day                               4/6 ${declared.worstLossPercent.toFixed(3)}%` +
				`   derived ${derivedLoss.worstLossPercent.toFixed(3)}%\n` +
				`      best day                                4/6 ${declared.bestLossPercent.toFixed(3)}%` +
				`   derived ${derivedLoss.bestLossPercent.toFixed(3)}%   over ${declared.scoredDays} days`
			);
		});

		console.log(
			[
				'',
				'ARM D — plan value under the true pool (positive = worse than planning under the truth)',
				`last ${DAY_CAP} days per point, scored on the objective Σ vᵢ·P̄ᵢ(tᵢ)`,
				'',
				...rows.flatMap((row) => [row, '']),
				`  over the ${evaluable.length} evaluable points, mean loss   4/6 ${mean(evaluable.map((point) => point.declared)).toFixed(3)}%` +
					`   derived ${mean(evaluable.map((point) => point.derived)).toFixed(3)}%`,
				'',
			].join('\n'),
		);
	});

	it('E — α̂’s own posterior against the map’s margin (ROADMAP item 45)', () => {
		const truePole = gateOf(GENERATOR_RECOVERY) / CAPACITY_MAP_POLE_MARGIN;
		const blocks: string[] = [];
		const pooled = new Map<string, PosteriorCounts>();

		for (const [alphaCog, alphaPhys] of SELF_CONSISTENT_GRID) {
			const truth = truePoolsOf(alphaCog, alphaPhys, GENERATOR_RECOVERY);

			const poolFlags = truth
				? ['--true-pools', `${truth.cognitiveHours},${truth.physicalHours}`]
				: [];

			const cells = POSTERIOR_DAYS.flatMap((days) =>
				POSTERIOR_RATES.map((rate) => {
					const flags = [
						'--alpha-cog',
						String(alphaCog),
						'--alpha-phys',
						String(alphaPhys),
						'--drain-log-rate',
						String(rate),
						...poolFlags,
					];

					return {
						days,
						rate,
						reads: POSTERIOR_SEEDS.map((seed) =>
							readPosteriors(
								generate(flags, seed, days),
								generate([...flags, '--full-mornings'], seed, days),
							),
						),
					};
				}),
			);

			for (const reservoir of ['cognitive', 'physical'] as const) {
				const alphaTrue = reservoir === 'cognitive' ? alphaCog : alphaPhys;
				const truePool = capacityFromDrainRate(alphaTrue, GENERATOR_RECOVERY);

				blocks.push(
					'',
					`  ${reservoir === 'cognitive' ? 'cog ' : 'phys'}  α true ${alphaTrue}, ${(alphaTrue / truePole).toFixed(2)} × the true pole` +
						`   true pool ${truePool === null ? 'none: inside the margin at the true recovery' : `${truePool.toFixed(2)} h`}` +
						`${truth ? '' : '   (days uncapped: the pair has no true pools)'}`,
				);

				for (const { days, rate, reads } of cells) {
					const label = `${String(days).padStart(5)} d  rate ${rate.toFixed(2)}`;

					const cell = readPosteriorCell(
						label,
						reads.map((read) => read[reservoir]),
						alphaTrue,
						truePool,
					);

					blocks.push(...cell.lines);
					pooled.set(label, addCounts(pooled.get(label), cell.counts));
				}
			}
		}

		const share = (part: number, whole: number) =>
			whole === 0 ? '—' : `${((100 * part) / whole).toFixed(1)}%`;

		console.log(
			[
				'',
				"ARM E — α̂'s own posterior against the map's margin (ROADMAP item 45)",
				`${POSTERIOR_SEEDS.length} seeds a cell, read at the FITTED recovery the way the Day Setup offer reads them.`,
				'The band is the pool at α̂ + σ̂ and at α̂ − σ̂; it has no upper end once α̂ − σ̂ passes',
				`the margin (${CAPACITY_MAP_POLE_MARGIN} × the pole). The pole is read off the shipped gate, never restated.`,
				'A 1σ band is nominally worth 68.3%.',
				...blocks,
				'',
				'  POOLED over the five α pairs and both reservoirs',
				...[...pooled].map(
					([key, sum]) =>
						`  ${key}   offered ${sum.offered}/${sum.fitted}` +
						`   band past the margin ${sum.pastMargin} (past the pole ${sum.pastPole})` +
						`   withheld with the band clear of the pole ${sum.clearOfPole}` +
						`   α̂ ± σ̂ covers α ${share(sum.alphaCovered, sum.fitted)}` +
						` (at the true r ${share(sum.trueRecoveryCovered, sum.fitted)},` +
						` on full mornings ${share(sum.fullMorningsCovered, sum.fitted)})` +
						`   band covers the true pool ${share(sum.poolCovered, sum.banded)} of ${sum.banded}`,
				),
				'',
			].join('\n'),
		);
	});
});
