/**
 * The quadrature-accuracy claim behind `blockOutput` (MATH.md §8, business/model/AGENTS.md):
 * "composite Simpson with ≥16 nodes per fastest timescale (min of ϕ, 1/ρ) —
 * relative error ~1e-6 even for near-floor ϕ tasks in long blocks". The code
 * comment in `zenith-energy.ts` says "probe-verified"; the probe was never
 * committed, so this file is that measurement.
 *
 * A probe, not a test: it sweeps block lengths and reports the error curve,
 * where the suite only needs one worst case pinned (which it has — "Simpson
 * block output matches an independent fine midpoint integration at the ϕ
 * floor", `zenith-energy.test.ts`).
 *
 * DESIGN. The worst case for the node budget is the ϕ FLOOR (0.1h, the
 * fastest the warm-up hump can oscillate) inside a LONG block, because
 * `blockOutput` caps the node count at 1024: 16 nodes per ϕ needs
 * n = 160·hours, so the cap starts binding at 6.4h and the effective node
 * density then FALLS as the block grows. Ground truth is an independent
 * re-implementation of the same integrand — the closed-form reservoir
 * trajectories are exact, so only the quadrature is approximate — evaluated by
 * composite Simpson at 400k intervals. That reference is VALIDATED before any
 * error is believed: doubling it to 800k must not move it by more than 1e-9
 * relative, and the check is asserted below. Without that, a drifting
 * reference would masquerade as quadrature error.
 */
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_ENERGY_PARAMS,
	evaluateSchedule,
	type EnergyTaskInput,
} from '$lib/business/model/zenith-energy';
import {
	calculateFlowStateTime,
	mapEffort,
	mapEnjoyability,
	type UserConstants,
} from '$lib/business/model/zenith';

const p = DEFAULT_ENERGY_PARAMS;

/** Constants that drive ϕ onto its 0.1h floor for the task below. */
const FLOOR_CONSTANTS: UserConstants = {
	c1: 0.1,
	c2: -0.05,
	c3: 0.05,
};

const FAST_TASK: EnergyTaskInput = {
	id: 1,
	title: 'fast',
	difficulty: 1,
	enjoyment: 10,
	cognitiveDemand: 0.9,
	physicalDemand: 0.1,
};

/** Independent replica of ∫₀ᴰ p(u)·C_cog(u)^wc·C_phys(u)^wp du, Simpson at n intervals. */
function reference(task: EnergyTaskInput, constants: UserConstants, hours: number, n: number) {
	const E = mapEffort(task.difficulty);
	const beta = mapEnjoyability(task.enjoyment);
	const phi = calculateFlowStateTime(E, beta, constants);
	const amp = E * beta + beta / E;
	const k = 1 / phi;
	const rec = p.recoveryRate * p.restRecoveryMultiplier;

	const law = (w: number, alpha: number) => {
		const gate = 1 - (1 - p.microRecoveryFraction) * w;
		const rho = alpha * w + rec * gate;

		return {
			rho,
			eq: (rec * gate) / rho,
		};
	};

	const lc = law(task.cognitiveDemand, p.alphaCog);
	const lp = law(task.physicalDemand, p.alphaPhys);

	const cAt = (l: { rho: number; eq: number }, t: number) =>
		l.eq + (1 - l.eq) * Math.exp(-l.rho * t);

	const f = (u: number) =>
		amp *
		k *
		u *
		Math.exp(-k * u) *
		Math.pow(cAt(lc, u), task.cognitiveDemand) *
		Math.pow(cAt(lp, u), task.physicalDemand);

	const h = hours / n;
	let sum = 0;

	for (let j = 0; j <= n; j++) {
		sum += (j === 0 || j === n ? 1 : j % 2 === 1 ? 4 : 2) * f(j * h);
	}

	return (sum * h) / 3;
}

/** The node count `blockOutput` actually uses, mirrored from zenith-energy.ts. */
function nodesUsed(phi: number, hours: number, rhoC: number, rhoP: number): number {
	const fastest = Math.min(phi, 1 / rhoC, 1 / rhoP, hours);
	let n = Math.ceil(hours / (fastest / 16));
	n = Math.min(Math.max(n, 16), 1024);

	if (n % 2 === 1) n++;

	return n;
}

describe('block-output quadrature error at the ϕ floor (MATH.md §8, business/model/AGENTS.md)', () => {
	it('measures relative error vs a refined reference as the block grows', () => {
		const phi = calculateFlowStateTime(
			mapEffort(FAST_TASK.difficulty),
			mapEnjoyability(FAST_TASK.enjoyment),
			FLOOR_CONSTANTS,
		);

		const rec = p.recoveryRate * p.restRecoveryMultiplier;
		const rhoC = p.alphaCog * 0.9 + rec * (1 - (1 - p.microRecoveryFraction) * 0.9);
		const rhoP = p.alphaPhys * 0.1 + rec * (1 - (1 - p.microRecoveryFraction) * 0.1);

		console.log(
			`ϕ = ${phi}h (floor), 1/ρ_cog = ${(1 / rhoC).toFixed(3)}h, 1/ρ_phys = ${(1 / rhoP).toFixed(3)}h`,
		);

		console.log(
			'fastest timescale is ϕ, so 16 nodes/timescale wants n = 160·hours; the cap is 1024',
		);

		let worstRel = 0;

		for (const hours of [1, 2, 4, 6, 8, 10, 12, 16, 24]) {
			const output = evaluateSchedule(
				[
					{
						taskId: FAST_TASK.id,
						hours,
					},
				],
				[FAST_TASK],
				24,
				p,
				FLOOR_CONSTANTS,
			).blocks[0].output;

			const ref = reference(FAST_TASK, FLOOR_CONSTANTS, hours, 400_000);
			const refFiner = reference(FAST_TASK, FLOOR_CONSTANTS, hours, 800_000);
			const refRel = Math.abs(refFiner - ref) / ref;
			const rel = Math.abs(output - ref) / ref;
			const n = nodesUsed(phi, hours, rhoC, rhoP);

			// The reference must be converged, or the "error" below is its own.
			expect(refRel).toBeLessThan(1e-9);

			worstRel = Math.max(worstRel, rel);

			console.log(
				`hours ${String(hours).padStart(2)}: n = ${String(n).padStart(4)} (${(n / (hours / phi)).toFixed(2)} nodes/ϕ)  simpson ${output.toPrecision(12)}  ref ${ref.toPrecision(12)}  rel err ${rel.toExponential(3)}`,
			);
		}

		console.log(`worst relative error over the sweep: ${worstRel.toExponential(3)}`);
	});
});
