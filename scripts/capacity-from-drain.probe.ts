/**
 * Does a capacity pool DERIVED from the fitted drain rate (MATH.md §8.13) beat
 * the two declared constants it would replace (`DEFAULT_CAPACITY_POOLS`, 4/6)?
 *
 * The gate on ROADMAP item 18, in four arms:
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
 *
 * Why arm D exists. A and B score with `classicOverlap` (`plan-audit.ts`), and
 * on this fixture that instrument cannot rank a pool: at three of A's four
 * evaluable points it puts the KNOWN-CORRECT pool at or below declared 4/6
 * (Δ +0.0000, −0.0035, −0.0024, +0.0116), because a pool cannot bind on a day
 * shorter than itself and 4/6 binds on 9–16 of 60 days. Arm D is not exposed to
 * that failure — planning under the truth is the reference every other pool is
 * measured against — and it does not need the DECLARED pool to bind, since a
 * pool that is too generous is priced by the hours the true day could not hold.
 *
 * What arm D found (run 2026-09-03, seed 42, same four α pairs): planning under
 * 4/6 loses 1.757% of the objective on average against planning under the
 * truth, and the derived pool loses 0.970% — so the map roughly halves the cost
 * of the constants it would replace. The two are not uniformly ordered: 4/6
 * wins by 0.040 and 0.425 pp at the two points where it happens to be nearly
 * right (truth 4.00/5.97 h and 2.89/4.78 h) and loses by 0.865 and 2.750 pp as
 * the truth moves away from it. The asymmetry is the reading: α̂ comes back high
 * at every point, so the derived pool is 0.30–0.89 h SMALL, and an
 * under-declared pool leaves value unspent (worst day 2.4–11.0%) while an
 * over-declared one plots a day that cannot be worked (worst day 14.9–48.3%
 * once the truth moves off 4/6). The reference holds empirically as well as by
 * design: the best day is 0.000% at every point and under both pools, so the
 * greedy's inexactness never let a wrong pool score above the right one here.
 * It stays a reading about the estimator on a law it was given — arm B, the
 * loss when that law is false, still returns no derived pool at any point.
 *
 * What arm C found (run 2026-08-30, seed 42): sweeping the 🪫 opt-in rate from
 * 0.15 to 1.56 logs per day leaves α̂_cog wandering 0.59–0.72 with no trend, and
 * the derived cognitive pool 2.16–2.25 h where it is defined at all. It does
 * NOT reproduce the "α̂ drifts upward with the logging rate, so the pool shrinks
 * the more diligently you log" direction ROADMAP item 18 recorded on 2026-08-04
 * from an uncommitted variant; that direction is unsupported here. At three of
 * the five rates α̂_phys lands inside the §8.13 pole margin and the map declines
 * to answer — as it does at every point of arm B, which is therefore a reading
 * about the gate rather than about the pools it was built to sweep.
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
import { describe, it } from 'vitest';
import { calibrateEnergyParams } from '$lib/business/model/energy-calibration';
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
import { capacityFromDrainRate, type EnergyParams } from '$lib/business/model/zenith-energy';
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

function generate(flags: string[]): Fixture {
	const out = join(mkdtempSync(join(tmpdir(), 'capacity-')), 'fixture.json');

	execFileSync(
		'node',
		['scripts/generate-fixture.mjs', '--seed', '42', '--days', '365', '--out', out, ...flags],
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
): string[] {
	const { params, pools } = derive(fixture);

	const lines = [
		`  ${label}`,
		`    truth      cog ${truth.cognitiveHours.toFixed(2).padStart(6)}  phys ${truth.physicalHours.toFixed(2).padStart(6)}`,
		`    α̂ fitted   cog ${params.alphaCog.toFixed(4)}  phys ${params.alphaPhys.toFixed(4)}   (r̂ ${params.recoveryRate.toFixed(4)})`,
		`    derived    cog ${hours(pools?.cognitiveHours ?? null)}  phys ${hours(pools?.physicalHours ?? null)}`,
	];

	if (pools === null) {
		lines.push('    → no derived pool: α̂ below the §8.13 gate');

		return lines;
	}

	const scored = auditDays(fixture, pools);
	const derivedOverlap = overlapUnder(fixture, params, pools);
	const declaredOverlap = overlapUnder(fixture, params, DEFAULT_CAPACITY_POOLS);

	lines.push(
		`    |derived−truth|  cog ${gap(pools.cognitiveHours, truth.cognitiveHours)}  phys ${gap(pools.physicalHours, truth.physicalHours)}`,
		`    |4/6−truth|      cog ${gap(DEFAULT_CAPACITY_POOLS.cognitiveHours, truth.cognitiveHours)}` +
			`  phys ${gap(DEFAULT_CAPACITY_POOLS.physicalHours, truth.physicalHours)}`,
		`    classicOverlap   derived ${derivedOverlap.toFixed(4)}  vs 4/6 ${declaredOverlap.toFixed(4)}` +
			`   (Δ ${(derivedOverlap - declaredOverlap >= 0 ? '+' : '') + (derivedOverlap - declaredOverlap).toFixed(4)})`,
		`    pool can bind on   derived ${bindableDays(scored, pools)}/${scored.length} days` +
			`   4/6 ${bindableDays(scored, DEFAULT_CAPACITY_POOLS)}/${scored.length}` +
			`${withTruthScoring ? `   truth ${bindableDays(scored, truth)}/${scored.length}` : ''}` +
			`   (${windowSummary(fixture)})`,
	);

	if (withTruthScoring) {
		const truthOverlap = overlapUnder(fixture, params, truth);

		lines.push(
			`    classicOverlap   truth ${truthOverlap.toFixed(4)}` +
				`   (vs 4/6 Δ ${(truthOverlap - declaredOverlap >= 0 ? '+' : '') + (truthOverlap - declaredOverlap).toFixed(4)})`,
		);
	}

	return lines;
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

/** The α pairs arms A and D generate self-consistent days from. */
const SELF_CONSISTENT_GRID = [
	[0.3, 0.25],
	[0.4, 0.3],
	[0.52, 0.35],
	[0.7, 0.45],
	[0.95, 0.6],
];

describe('capacity from the fitted drain rate (MATH.md §8.13)', () => {
	it('A — self-consistent: the true pool IS the map of the true α', () => {
		const blocks = SELF_CONSISTENT_GRID.map(([alphaCog, alphaPhys]) => {
			const label = `α true  cog ${alphaCog}  phys ${alphaPhys}`;
			const truth = truePoolsOf(alphaCog, alphaPhys, GENERATOR_RECOVERY);

			if (truth === null) {
				return [
					`  ${label}`,
					'    → skipped: inside the §8.13 pole margin at the generator’s own recovery,',
					'      so the map defines no true pool for this α to generate a day from',
				];
			}

			const fixture = generate([
				'--alpha-cog',
				String(alphaCog),
				'--alpha-phys',
				String(alphaPhys),
				'--true-pools',
				`${truth.cognitiveHours},${truth.physicalHours}`,
			]);

			return report(label, truth, fixture, true);
		});

		console.log(
			[
				'',
				"ARM A — self-consistent (true pools = §8.13 map of the true α, at the GENERATOR's recovery)",
				`last ${DAY_CAP} audit-eligible days per point`,
				'',
				...blocks.flatMap((block) => [...block, '']),
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
					),
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
});
