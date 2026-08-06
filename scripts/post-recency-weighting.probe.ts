/**
 * The measurements behind MATH.md §5.2, the recency weighting of the ϕ fit
 * (added 2026-08-04). Every number that section quotes was written without a
 * committed probe:
 *
 *   - "20 logs of ϕ = 4h aged ten years: Σw = 0.0195, and the row reads 109.4
 *     min against a 102.5 min default — 6.9 of the 135 minutes the same 20 logs
 *     move when fresh (237.5 min). Σw reports 0.0; n_eff would have reported
 *     20.0."
 *   - "at 3 half-lives (w = ⅛) a single log still moves the prediction ≈ ⅓ as
 *     much as a fresh one, not ⅛ — the ridge denominator is λ-dominated at small
 *     Σw, so the weights bite less than their ratio suggests."
 *   - "the effective memory is ≈ 1.44 years of logs" (∫2^(−t/H)dt = H/ln 2).
 *   - "Σw ≤ n always, with equality exactly when every log is same-day fresh."
 *
 * A probe, not a test: the movement ratios move with the ridge prior, the
 * default constants and the slider maps — honest model motion, not regression.
 * The suite pins the invariants (bit-equal collapse at wᵢ = 1, Σw = 4 for eight
 * logs at one half-life, the future-dated floor) in zenith.test.ts §5.2.
 *
 * Everything is measured on the "Your model" card's own reference task
 * (difficulty 5, enjoyment 5 — `calibration-descriptor.ts`), because that is
 * the row §5.2 argues about, and in minutes, because that is what the row
 * prints.
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_USER_CONSTANTS,
	PHI_RECENCY_HALF_LIFE_DAYS,
	calculateFlowStateTime,
	fitUserConstants,
	mapEffort,
	mapEnjoyability,
	type FlowObservation,
} from '$lib/business/model/zenith';

/** The card's reference task. */
const E = mapEffort(5);
const BETA = mapEnjoyability(5);
/** The logged time-to-flow §5.2's example uses: a slow logger against a 1.71h default. */
const LOGGED_PHI = 4;

const minutes = (constants = DEFAULT_USER_CONSTANTS): number =>
	calculateFlowStateTime(E, BETA, constants) * 60;

const history = (count: number, ageDays: number): FlowObservation[] =>
	Array.from(
		{
			length: count,
		},
		() => ({
			E,
			beta: BETA,
			phi: LOGGED_PHI,
			ageDays,
		}),
	);

const predicted = (count: number, ageDays: number): number =>
	minutes(fitUserConstants(history(count, ageDays)).constants);

/** The textbook effective sample size §5.2 rejects. */
const nEff = (weights: number[]): number =>
	weights.reduce((sum, w) => sum + w, 0) ** 2 / weights.reduce((sum, w) => sum + w * w, 0);

function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

describe('MATH.md §5.2 — recency weighting of the ϕ fit', () => {
	it('prices the ten-year logger the card row is about', () => {
		const ageDays = 10 * PHI_RECENCY_HALF_LIFE_DAYS;
		const stale = fitUserConstants(history(20, ageDays));
		const fresh = fitUserConstants(history(20, 0));
		const base = minutes();
		const weights = history(20, ageDays).map(() => 2 ** (-ageDays / PHI_RECENCY_HALF_LIFE_DAYS));

		console.log(
			`[§5.2] reference task d5/e5: E=${E.toFixed(4)} β=${BETA.toFixed(4)}, ` +
				`default ϕ = ${base.toFixed(1)} min`,
		);

		console.log(
			`[§5.2] 20 logs of ϕ = ${LOGGED_PHI}h aged ${ageDays}d (10 half-lives): ` +
				`Σw = ${stale.effectiveCount.toFixed(4)} (row prints ${stale.effectiveCount.toFixed(1)}), ` +
				`n_eff = ${nEff(weights).toFixed(1)}, fitted = ${stale.fitted}`,
		);

		console.log(
			`[§5.2] prediction: stale ${predicted(20, ageDays).toFixed(1)} min, ` +
				`fresh ${minutes(fresh.constants).toFixed(1)} min, default ${base.toFixed(1)} min ⇒ ` +
				`stale moves ${(predicted(20, ageDays) - base).toFixed(1)} of the ` +
				`${(minutes(fresh.constants) - base).toFixed(1)} min the same logs move fresh`,
		);

		// The one genuine invariant here: an ancient history must be worth less
		// than a fresh one, both in reported mass and in what it moves.
		expect(stale.effectiveCount).toBeLessThan(fresh.effectiveCount);
		expect(predicted(20, ageDays) - base).toBeLessThan(minutes(fresh.constants) - base);
	});

	it('measures how much shrinkage compresses the weight ratio', () => {
		const base = minutes();
		const freshMove = predicted(1, 0) - base;

		console.log(
			`[§5.2] one log, movement vs fresh (ridge compresses the weight ratio):\n${[
				0, 1, 2, 3, 4, 5, 10,
			]
				.map((halfLives) => {
					const ageDays = halfLives * PHI_RECENCY_HALF_LIFE_DAYS;
					const move = predicted(1, ageDays) - base;

					return (
						`  ${halfLives} half-lives: w = ${(2 ** -halfLives).toFixed(4)}, ` +
						`moves ${move.toFixed(2)} min = ${(move / freshMove).toFixed(4)}× fresh ` +
						`(weight ratio would say ${(2 ** -halfLives).toFixed(4)}×)`
					);
				})
				.join('\n')}`,
		);

		console.log(
			`[§5.2] effective memory ∫2^(−t/H)dt = H/ln2 = ` +
				`${(PHI_RECENCY_HALF_LIFE_DAYS / Math.LN2).toFixed(1)}d = ` +
				`${PHI_RECENCY_HALF_LIFE_DAYS / Math.LN2 / 365} years`,
		);

		// Shrinkage can only ever make a stale log count for MORE than its weight,
		// never less — that is what "the weights bite less than their ratio
		// suggests" means, and it is the direction the section argues.
		for (const halfLives of [1, 2, 3, 4, 5]) {
			const move = predicted(1, halfLives * PHI_RECENCY_HALF_LIFE_DAYS) - base;

			expect(move / freshMove).toBeGreaterThan(2 ** -halfLives);
		}
	});

	it('checks Σw ≤ n and when it is tight', () => {
		const random = mulberry32(0x5eed52);
		let worstExcess = -Infinity;
		let tight = 0;

		for (let trial = 0; trial < 2000; trial++) {
			const count = 1 + Math.floor(random() * 30);

			const observations = Array.from(
				{
					length: count,
				},
				() => ({
					E,
					beta: BETA,
					phi: LOGGED_PHI,
					// Deliberately includes future-dated logs (negative age): the max(0,·)
					// floor makes those weigh exactly 1, so Σw = n without "same-day".
					ageDays: Math.round(-30 + random() * 4000),
				}),
			);

			const { effectiveCount } = fitUserConstants(observations);

			worstExcess = Math.max(worstExcess, effectiveCount - count);

			if (Math.abs(effectiveCount - count) < 1e-12) tight++;
		}

		console.log(
			`[§5.2] 2000 seeded histories (ages −30…3970d): worst Σw − n = ` +
				`${worstExcess.toExponential(3)}, tight (Σw = n) in ${tight}`,
		);

		const futureDated = fitUserConstants([
			{
				E,
				beta: BETA,
				phi: LOGGED_PHI,
				ageDays: -400,
			},
		]);

		console.log(
			`[§5.2] a single log dated 400d in the FUTURE: Σw = ` +
				`${futureDated.effectiveCount} — equality without being same-day fresh`,
		);

		expect(worstExcess).toBeLessThanOrEqual(0);
		expect(futureDated.effectiveCount).toBe(1);
	});
});
