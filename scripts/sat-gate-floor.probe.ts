/**
 * The measurement behind MATH.md §8.5 — the micro-recovery gate
 * `g = 1 − (1−b)·w`, its positive floor for full-demand tasks, and the two
 * claims the section rests on that nothing has ever checked:
 *
 *   1. `C_eq(w=1) = b·r′/(α + b·r′) > 0` — algebra quoted in the section and in
 *      `microRecoveryFraction`'s doc comment, never compared to what the shipped
 *      law actually converges to.
 *   2. "Rejected — gate `(1−w^q)`. Still exactly 0 at `w = 1` for every q: the
 *      within-session decay of a full-demand task is bit-identical to the
 *      current law. Its only effect is inflating mid-range equilibria."
 *   3. "a knife-edge remained exactly at w = 1 … lowering the probe day's boxing
 *      demand from 1.0 to just 0.95 jumped its optimal allocation from 2.65 h to
 *      4.56 h — a plan cliff from a 5% demand change", and the companion claim
 *      that with the gate "the demand sweep wp 1.0 → 0.7 becomes smooth and
 *      monotone … instead of cliffed". Both were measured on 2026-07-14, before
 *      §8.6's compound moves and §8.8's 45-min lattice — i.e. with the search
 *      §8.6 then found unreliable on this very day.
 *
 * Arms A and B are algebra: exact identities that should hold forever, so they
 * assert. Arm C is a sweep whose numbers move with the optimizer, the lattice
 * and the objective — it prints, and the printed numbers belong in MATH.md WITH
 * THEIR DATE beside the claim they support (AGENTS.md §4).
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_ENERGY_PARAMS,
	DEFAULT_STEP_HOURS,
	optimizeSchedule,
	simulateReservoirs,
	type EnergyTaskInput,
} from '$lib/business/model/zenith-energy';

const P = DEFAULT_ENERGY_PARAMS;
/** Long enough that the exponential term is far below the print precision. */
const CONVERGED_HOURS = 400;

/**
 * The §8.1/§8.5 law's coefficients, replicated because `reservoirLaw` is
 * module-private. `gate` is a parameter so arm B can substitute the rejected
 * `1−w^q` gate into the same law.
 */
function law(w: number, alpha: number, r: number, m: number, gate: number) {
	const rec = r * m;
	const rho = alpha * w + rec * gate;

	return {
		rho,
		eq: rho > 0 ? (rec * gate) / rho : 0,
	};
}

const microGate = (w: number, b: number) => 1 - (1 - b) * w;

/** What the SHIPPED law converges to at full demand, via the public simulator. */
function shippedFloor(alpha: number, r: number, m: number, b: number): number {
	const { endCog } = simulateReservoirs(
		[
			{
				taskId: 1,
				hours: CONVERGED_HOURS,
			},
		],
		[
			{
				id: 1,
				cognitiveDemand: 1,
				physicalDemand: 1,
			},
		],
		{
			...P,
			alphaCog: alpha,
			recoveryRate: r,
			restRecoveryMultiplier: m,
			microRecoveryFraction: b,
			initialCog: 1,
			initialPhys: 1,
		},
	);

	return endCog;
}

const task = (
	id: number,
	title: string,
	difficulty: number,
	enjoyment: number,
	cognitiveDemand: number,
	physicalDemand: number,
): EnergyTaskInput => ({
	id,
	title,
	difficulty,
	enjoyment,
	cognitiveDemand,
	physicalDemand,
});

/** The 2026-07-14 probe day §8.5's knife-edge number was measured on. */
const PROBE_DAY = [
	task(1, 'boxing', 10, 10, 0.2, 1.0),
	task(2, 'guitar', 6, 9, 0.4, 0.3),
	task(3, 'reading', 4, 7, 0.5, 0.05),
];

const DEMANDS = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7];

function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Hours the optimizer gives task 1 when its physical demand is `wp`. */
function allocation(
	tasks: EnergyTaskInput[],
	windowHours: number,
	wp: number,
	b: number,
	step: number,
): { hours: number; objective: number } {
	const day = [
		{
			...tasks[0],
			physicalDemand: wp,
		},
		...tasks.slice(1),
	];

	const result = optimizeSchedule(
		day,
		windowHours,
		{
			...P,
			microRecoveryFraction: b,
		},
		undefined,
		{
			stepHours: step,
		},
	);

	return {
		hours: result.blocks
			.filter((block) => block.taskId === tasks[0].id)
			.reduce((sum, block) => sum + block.hours, 0),
		objective: result.evaluation.objective,
	};
}

describe('MATH.md §8.5 — the micro-recovery gate', () => {
	it('arm A: the w = 1 floor is exactly b·r′/(α + b·r′)', () => {
		const combinations = [0.05, 0.3, 0.35, 0.5, 1, 2].flatMap((alpha) =>
			[0.1, 0.7, 1.5, 3].flatMap((r) =>
				[1, 1.5, 2].flatMap((m) =>
					[0, 0.01, 0.05, 0.2, 1].map((b) => ({
						alpha,
						r,
						m,
						b,
					})),
				),
			),
		);

		let worst = 0;

		for (const { alpha, r, m, b } of combinations) {
			const rec = b * r * m;
			worst = Math.max(worst, Math.abs(shippedFloor(alpha, r, m, b) - rec / (alpha + rec)));
		}

		console.log(
			`[§8.5 arm A] ${combinations.length} (α, r, m, b) combinations: worst |shipped C(${CONVERGED_HOURS}h at w=1) − b·r′/(α+b·r′)| = ${worst.toExponential(3)}`,
		);

		const rPrime = P.recoveryRate * P.restRecoveryMultiplier;
		const b = P.microRecoveryFraction;

		console.log(
			`[§8.5 arm A] at the defaults (b=${b}, r′=${rPrime}): floor = ${((b * rPrime) / (P.alphaPhys + b * rPrime)).toFixed(5)} (phys, α=${P.alphaPhys}) / ${((b * rPrime) / (P.alphaCog + b * rPrime)).toFixed(5)} (cog, α=${P.alphaCog})`,
		);

		for (const [name, alpha] of [
			['cog', P.alphaCog],
			['phys', P.alphaPhys],
		] as const) {
			const off = law(0.5, alpha, P.recoveryRate, P.restRecoveryMultiplier, microGate(0.5, 0)).eq;
			const on = law(0.5, alpha, P.recoveryRate, P.restRecoveryMultiplier, microGate(0.5, b)).eq;
			// Where a phenomenological clamp at F = 0.15 would start binding —
			// §8.5's stated reason for rejecting it as "non-smooth above w ≈ 0.95".
			let binds = 1;

			for (let w = 0; w <= 1.0001; w += 0.001)
				if (law(w, alpha, P.recoveryRate, P.restRecoveryMultiplier, microGate(w, 0)).eq <= 0.15) {
					binds = w;
					break;
				}

			console.log(
				`[§8.5 arm A] ${name}: eq(w=0.5) ${off.toFixed(5)} → ${on.toFixed(5)} (+${(((on - off) / off) * 100).toFixed(2)}%); a F=0.15 clamp would bind from w = ${binds.toFixed(3)}`,
			);
		}

		// b = 0 is the pure (1−w) gate: a full-demand task drains to exactly 0.
		expect(shippedFloor(P.alphaCog, P.recoveryRate, P.restRecoveryMultiplier, 0)).toBeCloseTo(
			0,
			12,
		);

		// …and any b > 0 leaves a strictly positive floor matching the closed form.
		expect(shippedFloor(P.alphaCog, P.recoveryRate, P.restRecoveryMultiplier, 0.05)).toBeCloseTo(
			0.13043478260869565,
			9,
		);

		expect(worst).toBeLessThan(1e-8);
	});

	it('arm B: the rejected (1−w^q) gate is 0 at w = 1 for every q', () => {
		const pure = law(1, P.alphaCog, P.recoveryRate, P.restRecoveryMultiplier, microGate(1, 0));

		const shipped = law(
			1,
			P.alphaCog,
			P.recoveryRate,
			P.restRecoveryMultiplier,
			microGate(1, P.microRecoveryFraction),
		);

		console.log(
			`[§8.5 arm B] at w=1, α=${P.alphaCog}: pure (1−w) gate → ρ=${pure.rho}, eq=${pure.eq}; SHIPPED b=${P.microRecoveryFraction} gate → ρ=${shipped.rho}, eq=${shipped.eq.toFixed(6)}`,
		);

		for (const q of [0.25, 0.5, 1, 2, 4]) {
			const full = law(1, P.alphaCog, P.recoveryRate, P.restRecoveryMultiplier, 1 - 1 ** q);
			const mid = law(0.5, P.alphaCog, P.recoveryRate, P.restRecoveryMultiplier, 1 - 0.5 ** q);

			const midPure = law(
				0.5,
				P.alphaCog,
				P.recoveryRate,
				P.restRecoveryMultiplier,
				microGate(0.5, 0),
			);

			console.log(
				`[§8.5 arm B] q=${q}: eq(w=1)=${full.eq}, ρ(w=1)=${full.rho} (identical to the PURE gate, not to the shipped one) | eq(w=0.5) ${midPure.eq.toFixed(4)} → ${mid.eq.toFixed(4)} (${(((mid.eq - midPure.eq) / midPure.eq) * 100).toFixed(1)}%)`,
			);

			// The rejection reason: no q rescues the w = 1 corner.
			expect(full.eq).toBe(0);
			expect(full.rho).toBe(P.alphaCog);
		}
	});

	it('arm C: what the demand sweep actually does, with and without the gate', () => {
		/** The demand sweep on one day: allocations, biggest single-step jump, monotone. */
		const sweep = (tasks: EnergyTaskInput[], windowHours: number, b: number, step: number) => {
			const points = DEMANDS.map((wp) => allocation(tasks, windowHours, wp, b, step));
			const hours = points.map((point) => point.hours);
			let biggest = 0;

			for (let i = 1; i < hours.length; i++)
				biggest = Math.max(biggest, Math.abs(hours[i] - hours[i - 1]));

			return {
				hours,
				biggest,
				monotone: hours.every((h, i) => i === 0 || h >= hours[i - 1] - 1e-9),
				row: points
					.map(
						(point, i) => `${DEMANDS[i]}: ${point.hours.toFixed(2)}h/${point.objective.toFixed(3)}`,
					)
					.join('  '),
			};
		};

		for (const step of [0.25, DEFAULT_STEP_HOURS])
			for (const b of [0, P.microRecoveryFraction]) {
				const result = sweep(PROBE_DAY, 8, b, step);

				console.log(
					`[§8.5 arm C] probe day, 8h, step ${step}, b=${b}: ${result.row} | biggest jump per 0.05 demand ${result.biggest.toFixed(2)}h, monotone ${result.monotone}`,
				);
			}

		// The same question over an input space rather than one day: does the gate
		// make the demand → allocation response smoother?
		const random = mulberry32(0x8005);

		const pick = (min: number, max: number, stepSize: number) =>
			min + Math.round((random() * (max - min)) / stepSize) * stepSize;

		const days = Array.from(
			{
				length: 20,
			},
			() => ({
				tasks: [
					task(1, 'wp', pick(1, 10, 1), pick(1, 10, 1), pick(0, 0.5, 0.1), 1),
					task(2, 't2', pick(1, 10, 1), pick(1, 10, 1), pick(0, 1, 0.1), pick(0, 0.5, 0.1)),
					task(3, 't3', pick(1, 10, 1), pick(1, 10, 1), pick(0, 1, 0.1), pick(0, 0.5, 0.1)),
				],
				windowHours: pick(4, 8, DEFAULT_STEP_HOURS),
			}),
		);

		for (const b of [0, P.microRecoveryFraction]) {
			const sweeps = days.map((day) => sweep(day.tasks, day.windowHours, b, DEFAULT_STEP_HOURS));
			const worstJump = Math.max(...sweeps.map((s) => s.biggest));
			const meanJump = sweeps.reduce((sum, s) => sum + s.biggest, 0) / sweeps.length;
			const nonMonotone = sweeps.filter((s) => !s.monotone).length;

			// A "plan cliff from a 5% demand change" = more than one lattice step of
			// allocation moving between demand 1.00 and 0.95.
			const cliffDays = sweeps.filter(
				(s) => Math.abs(s.hours[1] - s.hours[0]) > DEFAULT_STEP_HOURS + 1e-9,
			).length;

			console.log(
				`[§8.5 arm C] ${days.length} seeded days (3 tasks incl. one at wp=1, 4–8h), demand 1.00→0.70 in 0.05: b=${b} → mean biggest jump ${meanJump.toFixed(3)}h, worst ${worstJump.toFixed(2)}h, non-monotone days ${nonMonotone}/${days.length}, days moving >1 step on the 1.00→0.95 change ${cliffDays}/${days.length}`,
			);
		}
	});
});
