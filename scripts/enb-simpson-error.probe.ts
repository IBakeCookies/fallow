/**
 * What the 1024-node cap costs `blockOutput` (MATH.md §8,
 * business/model/AGENTS.md). Composite Simpson with 16 nodes per fastest
 * timescale (min of ϕ, 1/ρ) holds a block's output to a relative error under
 * 1.1e-6 out to a 9h block; past there the cap thins the node density and the
 * error grows with the block. Over every task the app can produce the worst is
 * 5.0015e-5, in a 24h block at sliders mental 2 / physical 0 / enjoyment 10,
 * and no reachable cell at any block length reads above that. The suite fixture
 * pins 1e-4.
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
 *
 * WHAT `FAST_TASK` BOUNDS. It is off the sliders on purpose: `difficulty: 1`
 * cannot sit beside demands `0.9/0.1`, which come from sliders 9/1 and which
 * `getEffectiveDifficulty` projects to difficulty 9.3, where ϕ leaves its floor
 * entirely. The second arm settles the conservatism instead of arguing it — all
 * 1,210 slider combinations (mental and physical 0–10, enjoyment 1–10) through
 * `toEnergyTask`, maximised PER BLOCK LENGTH, because a maximum over
 * cells × lengths hides the counterexample. `FAST_TASK` bounds the reachable
 * surface GLOBALLY, 5.5613e-5 against 5.0015e-5 at 24h, and NOT pointwise:
 * sliders 10/10/1 (difficulty 10, demands 1.0/1.0, ϕ = 0.500h) exceed it at
 * every block length from 1h to 8h — 1.0450e-6 against 2.8438e-7 at 1h,
 * 7.7322e-7 against 6.9364e-7 at 8h. `FAST_TASK` leads from 9h on, the regime
 * where the cap binds; below it every reachable reading is under 1.1e-6.
 *
 * WHY IT IS KEPT: not because it is an extreme, which it is not. The demands
 * that move the reservoir fastest are 0/0 — ρ(w) = α·w + r'·(1−0.95·w) is
 * strictly DECREASING in w, so 1/ρ reads 0.952h at 0/0 against 2.140h/1.020h
 * at 0.9/0.1 — and the model's input box has a corner above it: `BOX_CORNER`,
 * the same difficulty at demands 1.0/1.0, reads higher at every length beside
 * it (6.3864e-5 against 5.5613e-5 at 24h) and higher than the reachable surface
 * reaches anywhere, so that is the point the global bound rests on. Neither pairing reaches the node budget,
 * which takes min(ϕ, 1/ρ, hours) and gets ϕ. `FAST_TASK` stays because the
 * quadrature figures in business/model/AGENTS.md and the suite fixture are read
 * off it. `REACHABLE_WORST` is the surface's own 24h argmax, and the ϕ floor is
 * reachable — both difficulty sliders at 0 clamp to difficulty 1 and land on it.
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
import { toEnergyTask } from '$lib/business/model/metric/calculation';
import type { Task } from '$lib/data/type';

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

/** Sliders mental 2 / physical 0 / enjoyment 10, through `toEnergyTask`. */
const REACHABLE_WORST: EnergyTaskInput = {
	id: 2,
	title: 'worst a user can file',
	difficulty: 2,
	enjoyment: 10,
	cognitiveDemand: 0.2,
	physicalDemand: 0,
};

/** Difficulty 1 with both demands at 1.0: the corner of the model's input box at the ϕ floor. */
const BOX_CORNER: EnergyTaskInput = {
	id: 3,
	title: 'floor at full demands',
	difficulty: 1,
	enjoyment: 10,
	cognitiveDemand: 1,
	physicalDemand: 1,
};

const BLOCK_LENGTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 24];

/** Independent replica of the integrand ∫₀ᴰ p(u)·C_cog(u)^wc·C_phys(u)^wp du integrates. */
function integrand(task: EnergyTaskInput, constants: UserConstants) {
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

	return (u: number) =>
		amp *
		k *
		u *
		Math.exp(-k * u) *
		Math.pow(cAt(lc, u), task.cognitiveDemand) *
		Math.pow(cAt(lp, u), task.physicalDemand);
}

/** Simpson at n intervals over [0, hours]. */
function reference(task: EnergyTaskInput, constants: UserConstants, hours: number, n: number) {
	const f = integrand(task, constants);
	const h = hours / n;
	let sum = 0;

	for (let j = 0; j <= n; j++) {
		sum += (j === 0 || j === n ? 1 : j % 2 === 1 ? 4 : 2) * f(j * h);
	}

	return (sum * h) / 3;
}

/**
 * Every block length in one pass: at a fixed step, composite Simpson over
 * [0, H] is the sum of its two-interval panels, so a running total read off at
 * each hour boundary IS that boundary's own composite Simpson value.
 */
function referenceByLength(
	task: EnergyTaskInput,
	constants: UserConstants,
	panelsPerHour: number,
): { hours: number; ref: number }[] {
	const f = integrand(task, constants);
	const h = 1 / (2 * panelsPerHour);
	const byLength: { hours: number; ref: number }[] = [];
	let sum = 0;
	let left = f(0);

	for (let hour = 1; hour <= Math.max(...BLOCK_LENGTHS); hour++) {
		for (let panel = 0; panel < panelsPerHour; panel++) {
			const u = hour - 1 + 2 * panel * h;
			const right = f(u + 2 * h);

			sum += ((left + 4 * f(u + h) + right) * h) / 3;
			left = right;
		}

		if (BLOCK_LENGTHS.includes(hour))
			byLength.push({
				hours: hour,
				ref: sum,
			});
	}

	return byLength;
}

/** One slider combination through `toEnergyTask`. */
function cell(mental: number, physical: number, enjoyment: number): EnergyTaskInput {
	const task: Task = {
		id: 100,
		title: `m${mental}/p${physical}/e${enjoyment}`,
		mentalDifficulty: mental,
		physicalDifficulty: physical,
		enjoyment,
		createdAt: '2026-08-27',
		completed: false,
	};

	return toEnergyTask(task);
}

/** All 1,210 slider combinations the task form admits. */
function reachableCells(): EnergyTaskInput[] {
	const cells: EnergyTaskInput[] = [];

	for (let mental = 0; mental <= 10; mental++)
		for (let physical = 0; physical <= 10; physical++)
			for (let enjoyment = 1; enjoyment <= 10; enjoyment++)
				cells.push(cell(mental, physical, enjoyment));

	return cells;
}

const phiOf = (task: EnergyTaskInput) =>
	calculateFlowStateTime(
		mapEffort(task.difficulty),
		mapEnjoyability(task.enjoyment),
		FLOOR_CONSTANTS,
	);

/** What `blockOutput` reads for one task filling a block of `hours`. */
function shipped(task: EnergyTaskInput, hours: number): number {
	return evaluateSchedule(
		[
			{
				taskId: task.id,
				hours,
			},
		],
		[task],
		24,
		p,
		FLOOR_CONSTANTS,
	).blocks[0].output;
}

/** The shipped reading against the 400k reference, refused unless doubling it agrees. */
function measure(task: EnergyTaskInput, hours: number) {
	const output = shipped(task, hours);
	const ref = reference(task, FLOOR_CONSTANTS, hours, 400_000);
	const refRel = Math.abs(reference(task, FLOOR_CONSTANTS, hours, 800_000) - ref) / ref;

	expect(refRel).toBeLessThan(1e-9);

	return {
		output,
		ref,
		rel: Math.abs(output - ref) / ref,
	};
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
		const rec = p.recoveryRate * p.restRecoveryMultiplier;

		const rho = (w: number, alpha: number) =>
			alpha * w + rec * (1 - (1 - p.microRecoveryFraction) * w);

		for (const task of [FAST_TASK, BOX_CORNER, REACHABLE_WORST]) {
			const phi = phiOf(task);
			const rhoC = rho(task.cognitiveDemand, p.alphaCog);
			const rhoP = rho(task.physicalDemand, p.alphaPhys);

			console.log(
				`\n${task.title} (difficulty ${task.difficulty}, w = ${task.cognitiveDemand}/${task.physicalDemand}): ` +
					`ϕ = ${phi}h (floor), 1/ρ_cog = ${(1 / rhoC).toFixed(3)}h, 1/ρ_phys = ${(1 / rhoP).toFixed(3)}h`,
			);

			console.log(
				'fastest timescale is ϕ, so 16 nodes/timescale wants n = 160·hours; the cap is 1024',
			);

			let worstRel = 0;

			for (const hours of [1, 2, 4, 6, 8, 10, 12, 16, 24]) {
				const { output, ref, rel } = measure(task, hours);
				const n = nodesUsed(phi, hours, rhoC, rhoP);

				worstRel = Math.max(worstRel, rel);

				console.log(
					`hours ${String(hours).padStart(2)}: n = ${String(n).padStart(4)} (${(n / (hours / phi)).toFixed(2)} nodes/ϕ)  simpson ${output.toPrecision(12)}  ref ${ref.toPrecision(12)}  rel err ${rel.toExponential(4)}`,
				);
			}

			console.log(`worst relative error over the sweep: ${worstRel.toExponential(4)}`);
		}
	});
});

describe('the app-reachable surface, per block length (MATH.md §8)', () => {
	it('finds the worst reachable task at each block length, beside FAST_TASK', () => {
		// Two passes, because 1,210 cells × 13 lengths at the 400k reference is
		// hours of work: screen every cell against a fixed-step reference cheap
		// enough to run 15,730 times, then re-measure only each length's argmax at
		// the validated 400k one. The screen only has to RANK, its value is
		// printed beside the re-measurement, and a mis-rank can only swap cells
		// that agree to the screen's own fidelity — which leaves the maximum
		// printed here where it is.
		const cells = reachableCells();
		const worstByLength = new Map<number, { task: EnergyTaskInput; screened: number }>();

		for (const task of cells)
			for (const { hours, ref } of referenceByLength(task, FLOOR_CONSTANTS, 500)) {
				const rel = Math.abs(shipped(task, hours) - ref) / ref;
				const worst = worstByLength.get(hours);

				if (!worst || rel > worst.screened)
					worstByLength.set(hours, {
						task,
						screened: rel,
					});
			}

		const exceeded: number[] = [];
		let globalWorst = {
			hours: 0,
			rel: 0,
			title: '',
		};

		for (const [hours, { task, screened }] of worstByLength) {
			const phi = phiOf(task);
			const { rel } = measure(task, hours);
			const fast = measure(FAST_TASK, hours).rel;

			if (rel > fast) exceeded.push(hours);

			if (rel > globalWorst.rel)
				globalWorst = {
					hours,
					rel,
					title: task.title,
				};

			console.log(
				`hours ${String(hours).padStart(2)}: worst reachable ${task.title.padEnd(11)} ` +
					`(difficulty ${task.difficulty.toFixed(1).padStart(4)}, w = ${task.cognitiveDemand}/${task.physicalDemand}, ϕ = ${phi.toFixed(3)}h)  ` +
					`rel err ${rel.toExponential(4)} (screened ${screened.toExponential(4)})  ` +
					`FAST_TASK ${fast.toExponential(4)}  ratio ${(rel / fast).toFixed(2)}×`,
			);
		}

		console.log(
			`\nworst reachable error anywhere: ${globalWorst.rel.toExponential(4)} (${globalWorst.title} at ${globalWorst.hours}h)`,
		);

		console.log(
			`block lengths where the worst reachable task EXCEEDS FAST_TASK: ${exceeded.join(', ')}`,
		);

		const atFloor = cells.filter((task) => phiOf(task) <= 0.1);
		const still = measure(cell(0, 0, 10), 24).rel;

		console.log(
			`the ϕ floor is a REGION: ${atFloor.length} of ${cells.length} cells sit on it, the 24h argmax among them — ` +
				`its still-reservoir neighbour m0/p0/e10 (demands 0/0) reads ${still.toExponential(4)}, ` +
				`${(100 * (1 - still / globalWorst.rel)).toFixed(2)}% under it`,
		);
	});
});
