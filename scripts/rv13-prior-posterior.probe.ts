/**
 * Measurements behind MATH.md §13.1: the σ_ϕ ladder that shows a zero-⚡-log
 * user is no longer treated as perfectly certain, and the two behaviour-change
 * numbers §13.1 quotes for it.
 *
 * §13.1's table claims σ_ϕ at the mid-scale task (E = 2.78, β = 1.44) runs
 * 0.411 → 0.194 → 0.072 → 0.023 → 0.003 for 0/1/5/20/200 logs (0.000 at n = 0
 * before the fix), that the prior's σ_ϕ is "≈ 29% of a typical ϕ̂", that the
 * priority score dropped 17.90 → 17.80 on its probe day, and that the plan
 * changed on 21.7% of random days at n = 1. Only the n = 0 entry is
 * generator-free — the rest depend on WHICH logs the user made, which the
 * section does not state — so this fixes the most natural generator (the same
 * mid-scale task logged n times, no residual) and prints the ladder beside its
 * closed form, then measures the two rates on a seeded day generator.
 *
 * (E, β) = (2.78, 1.44) is not an arbitrary point: it is `mapEffort(5)` and
 * `mapEnjoyability(5)` — the exact centre of both sliders — so "typical ϕ̂" and
 * "the probe task's ϕ̂" are the same number here, which is what makes the 29%
 * claim checkable at all.
 *
 * A probe, not a test: the rates move with the allocator. The suite pins the
 * property instead — that every `fitUserConstants` return carries a posterior
 * and that σ_ϕ is non-increasing in the data.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';
import {
	calculateFlowStateTime,
	calculatePooledAllocations,
	calculateTaskParams,
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
	expectedAverageProductivity,
	findOptimalSingleTaskTime,
	fitUserConstants,
	mapEffort,
	mapEnjoyability,
	phiParameterStd,
	type FitPosterior,
	type FlowObservation,
	type PooledTaskInput,
} from '$lib/business/model/zenith';

/** Seeded so a quoted number can be reproduced, not just re-rolled. */
function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** §13.1's probe task: the centre of both sliders. */
const E = mapEffort(5);
const BETA = mapEnjoyability(5);
const PHI_HAT = calculateFlowStateTime(E, BETA, DEFAULT_USER_CONSTANTS);

/** n logs of the SAME task at exactly the fitted plane — the zero-residual case. */
const logs = (n: number): FlowObservation[] =>
	Array.from(
		{
			length: n,
		},
		() => ({
			E,
			beta: BETA,
			phi: PHI_HAT,
			ageDays: 0,
		}),
	);

/** A seeded app-reachable day: integer sliders, pool weights tied to them. */
function randomDay(rnd: () => number): { tasks: PooledTaskInput[]; budget: number } {
	const n = 2 + Math.floor(rnd() * 5);

	return {
		tasks: Array.from(
			{
				length: n,
			},
			(_, i) => {
				const mental = 1 + Math.floor(rnd() * 10);
				const physical = 1 + Math.floor(rnd() * 10);

				return {
					title: `t${i}`,
					difficulty: Math.min(10, Math.max(mental, physical) + 0.3 * Math.min(mental, physical)),
					enjoyment: 1 + Math.floor(rnd() * 10),
					cognitiveWeight: mental / 10,
					physicalWeight: physical / 10,
				};
			},
		),
		budget: 1 + Math.floor(rnd() * 40) * 0.25,
	};
}

describe('MATH.md §13.1 — the prior as a posterior', () => {
	it('prints the σ_ϕ ladder against its closed form', () => {
		// With n identical rows x = [E, β, 1] and no residual the whole ladder is
		// closed-form: Σ = σ̂²(n·xxᵀ + λI)⁻¹ with σ̂² = ν₀σ₀²/(ν₀+n), so
		// σ_ϕ² = xᵀΣx = (σ₀²·xᵀx) / ((λ+n)(λ + n·xᵀx))·λ  —  the n = 0 entry is
		// σ₀·√(xᵀx/λ), which is where 0.411 comes from with no generator at all.
		const xx = E * E + BETA * BETA + 1;
		const lambda = 4;
		const sigma0 = 0.25;

		const closed = (n: number) =>
			Math.sqrt((lambda * sigma0 * sigma0 * xx) / ((lambda + n) * (lambda + n * xx)));

		let previous = Infinity;

		for (const n of [0, 1, 5, 20, 200]) {
			const measured = phiParameterStd(E, BETA, fitUserConstants(logs(n)).posterior);
			console.log(`n=${n}: σ_ϕ ${measured.toFixed(4)} h (closed form ${closed(n).toFixed(4)})`);
			expect(measured).toBeCloseTo(closed(n), 9);
			// The whole point of §13.1: uncertainty is monotone in data.
			expect(measured).toBeLessThanOrEqual(previous);
			previous = measured;
		}

		console.log(
			`ϕ̂ at the slider centre ${PHI_HAT.toFixed(4)} h, so the prior's σ_ϕ is ${((100 * closed(0)) / PHI_HAT).toFixed(1)}% of it`,
		);

		let sum = 0;
		let count = 0;

		for (let d = 1; d <= 10; d++)
			for (let e = 1; e <= 10; e++) {
				sum += calculateFlowStateTime(mapEffort(d), mapEnjoyability(e), DEFAULT_USER_CONSTANTS);
				count++;
			}

		console.log(
			`mean ϕ̂ over the 10×10 slider grid ${(sum / count).toFixed(4)} h → ${((100 * closed(0) * count) / sum).toFixed(1)}%`,
		);
	});

	it('prints the priority-score drop the first log used to cause', () => {
		const sigma1 = phiParameterStd(E, BETA, fitUserConstants(logs(1)).posterior);
		const sigma0 = phiParameterStd(E, BETA, fitUserConstants(logs(0)).posterior);

		for (const [difficulty, enjoyment] of [
			[5, 8],
			[6, 6.5],
			[5, 5],
		]) {
			const task = {
				title: 't',
				difficulty,
				enjoyment,
			};

			const { a, p0, phi } = calculateTaskParams(task);
			const T = findOptimalSingleTaskTime(task);

			const score = (sigma: number) =>
				Number((expectedAverageProductivity(T, a, p0, phi, sigma) * 10).toFixed(1));

			console.log(
				`difficulty ${difficulty} / enjoyment ${enjoyment}: priority ${score(0)} certain → ${score(sigma1)} at one log (σ_ϕ ${sigma1.toFixed(3)}) → ${score(sigma0)} at zero logs (σ_ϕ ${sigma0.toFixed(3)})`,
			);
		}
	});

	it('measures how often the plan moves', () => {
		const days = 1000;

		const posteriors: [string, FitPosterior | undefined][] = [
			['n = 1 (σ_ϕ 0.191)', fitUserConstants(logs(1)).posterior],
			['n = 0 prior (σ_ϕ 0.411)', fitUserConstants(logs(0)).posterior],
			['n = 5 (σ_ϕ 0.072)', fitUserConstants(logs(5)).posterior],
		];

		for (const [label, posterior] of posteriors) {
			const rnd = mulberry32(11);
			let changed = 0;

			for (let day = 0; day < days; day++) {
				const { tasks, budget } = randomDay(rnd);

				const plan = (p?: FitPosterior) =>
					calculatePooledAllocations(
						tasks,
						budget,
						DEFAULT_CAPACITY_POOLS,
						DEFAULT_USER_CONSTANTS,
						DEFAULT_SWITCH_COST,
						p,
					)
						.map((a) => a.allocatedHours.toFixed(6))
						.join(',');

				if (plan(posterior) !== plan(undefined)) changed++;
			}

			console.log(
				`${label}: plan differs from the certainty plan on ${((100 * changed) / days).toFixed(1)}% of ${days} seeded days`,
			);
		}
	});
});
