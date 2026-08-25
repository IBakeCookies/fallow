/**
 * Measurements behind the 2026-08-08 MATH.md entry: where the HEDGED stopping time
 * actually lands relative to the §3 closed form's [1.5194, 1.7933]ϕ band, and
 * how far σ̂ falls once logs accumulate.
 *
 * Three claims were corrected that day, and each rested on a number no probe
 * emitted. §4's own rule says that makes them unbacked, so this probe emits
 * them:
 *
 *  1. `TaskAllocation.optimalHours` is free to leave the band. The docs first
 *     said "outside the band whenever σ_ϕ > 0", which is false in the other
 *     direction — most pairs sit inside it. What matters is that nothing HOLDS
 *     them there, so copy may not quote the band for the rendered value.
 *  2. σ̂ carries no floor at σ₀ = 0.25h. §5.1's justification for feeding the
 *     allocator `phiParameterStd` once said it did.
 *  3. `expectedOptimalTime` is the argmax of E[P̄] — checked against a dense
 *     grid, since the bisection could otherwise be solving a different problem.
 *
 * A probe, not a test: these numbers move with the curve, the quadrature and
 * the prior. The suite pins the DIRECTION instead (`zenith.test.ts`: the hedged
 * stop-by leaves the band and can precede ϕ; σ̂ is no floor).
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import {
	calculateTaskAllocations,
	calculateTaskParams,
	expectedAverageProductivity,
	expectedOptimalTime,
	findOptimalSingleTaskTime,
	fitUserConstants,
	phiParameterStd,
	type FlowObservation,
} from '$lib/business/model/zenith';

/** Wide enough that no allocation is budget-limited: the stop time is the point. */
const UNCONSTRAINED_BUDGET = 8;
const BAND_LOW = 1.5194;
const BAND_HIGH = 1.7933;

describe('the hedged stopping time against the closed form band', () => {
	it('measures where all 100 integer slider pairs land on the zero-log posterior', () => {
		const { constants, posterior } = fitUserConstants([]);
		let belowBand = 0;
		let inBand = 0;
		let aboveBand = 0;
		let belowPhi = 0;
		let minRatio = Infinity;
		let maxRatio = -Infinity;
		let minPair = '';
		// The closed form is the control: it must stay in the band everywhere,
		// or the band itself is wrong rather than the hedge leaving it.
		let closedFormMin = Infinity;
		let closedFormMax = -Infinity;

		for (let difficulty = 1; difficulty <= 10; difficulty++) {
			for (let enjoyment = 1; enjoyment <= 10; enjoyment++) {
				const [alloc] = calculateTaskAllocations(
					[
						{
							title: 'probe',
							difficulty,
							enjoyment,
						},
					],
					UNCONSTRAINED_BUDGET,
					constants,
					0,
					posterior,
				);

				const ratio = alloc.optimalHours / alloc.phi;

				if (ratio < BAND_LOW) belowBand++;
				else if (ratio > BAND_HIGH) aboveBand++;
				else inBand++;

				if (ratio < 1) belowPhi++;

				if (ratio < minRatio) {
					minRatio = ratio;
					minPair = `difficulty ${difficulty} / enjoyment ${enjoyment}`;
				}

				maxRatio = Math.max(maxRatio, ratio);

				const closedForm =
					findOptimalSingleTaskTime(
						{
							title: 'probe',
							difficulty,
							enjoyment,
						},
						constants,
					) / alloc.phi;

				closedFormMin = Math.min(closedFormMin, closedForm);
				closedFormMax = Math.max(closedFormMax, closedForm);
			}
		}

		writeFileSync(
			'/tmp/hedged-stop-band.json',
			JSON.stringify(
				{
					pairs: 100,
					hedged: {
						belowBand,
						inBand,
						aboveBand,
						belowPhi,
						minRatio,
						maxRatio,
						minPair,
					},
					closedForm: {
						minRatio: closedFormMin,
						maxRatio: closedFormMax,
					},
				},
				null,
				2,
			),
		);
	});
});

describe('σ̂ under accumulating logs', () => {
	function sigmaHatMinutes(observations: FlowObservation[]): number {
		return Math.sqrt(fitUserConstants(observations).posterior.sigma2) * 60;
	}

	it('measures how far below the σ₀ = 15 min prior σ̂ falls', () => {
		const prior = sigmaHatMinutes([]);

		// Perfectly consistent logs: the residual sum is ~0, so σ̂ is driven
		// purely by how little weight the prior keeps. This is the floor claim's
		// cleanest counterexample.
		const identical: FlowObservation[] = Array.from(
			{
				length: 200,
			},
			() => ({
				E: 3,
				beta: 1.5,
				phi: 0.6,
			}),
		);

		// A user with real day-to-day scatter: σ̂ should converge to THEIR
		// scatter, which is the reason §5.1 still prefers parameter uncertainty.
		const scatterHours = 3 / 60;
		let seed = 12345;

		const nextGaussian = (): number => {
			// Box–Muller on a seeded LCG — reproducible, unlike Math.random().
			seed = (seed * 1664525 + 1013904223) % 4294967296;
			const u1 = (seed + 1) / 4294967297;
			seed = (seed * 1664525 + 1013904223) % 4294967296;
			const u2 = (seed + 1) / 4294967297;

			return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
		};

		const scattered: FlowObservation[] = Array.from(
			{
				length: 200,
			},
			(_, i) => ({
				E: 1 + (i % 5),
				beta: 1 + (i % 3) * 0.25,
				phi: 0.6 + nextGaussian() * scatterHours,
			}),
		);

		writeFileSync(
			'/tmp/hedged-stop-sigma.json',
			JSON.stringify(
				{
					priorMinutes: prior,
					identical200Minutes: sigmaHatMinutes(identical),
					scattered200Minutes: sigmaHatMinutes(scattered),
					scatterInputMinutes: scatterHours * 60,
				},
				null,
				2,
			),
		);
	});
});

describe('expectedOptimalTime is the argmax of E[P̄]', () => {
	it('compares the bisection against a dense grid search', () => {
		const { constants, posterior } = fitUserConstants([]);

		// The pair MATH.md quotes: difficulty 1 / enjoyment 10, the deepest hedge.
		const { a, p0, phi, E, beta } = calculateTaskParams(
			{
				title: 'probe',
				difficulty: 1,
				enjoyment: 10,
			},
			constants,
		);

		const sigmaPhi = phiParameterStd(E, beta, posterior);
		const step = 0.0001;
		let gridArgmax = step;
		let gridBest = -Infinity;

		for (let t = step; t <= 4 * phi; t += step) {
			const value = expectedAverageProductivity(t, a, p0, phi, sigmaPhi);

			if (value > gridBest) {
				gridBest = value;
				gridArgmax = t;
			}
		}

		const bisection = expectedOptimalTime(a, p0, phi, sigmaPhi);

		writeFileSync(
			'/tmp/hedged-stop-argmax.json',
			JSON.stringify(
				{
					phi,
					sigmaPhi,
					gridStep: step,
					gridArgmax,
					bisection,
					absoluteGapHours: Math.abs(gridArgmax - bisection),
				},
				null,
				2,
			),
		);
	});
});
