/**
 * Measurements behind what quantizing the Zenith Gain's naive baseline onto the
 * block lattice did to the sign of the reported gain.
 *
 * MATH.md's table claims the gain read NEGATIVE on 4% (n = 2) to 19% (n = 6) of
 * 400 random days BEFORE the fix and 0% at every task count after, with the
 * `naive = 0 → GAIN_PERCENT_CAP` case at 0/0/0/7/7/14% and "the typical
 * non-capped day gains ~4–6%". The section does not state the generator, so
 * this fixes a seeded app-reachable one (integer sliders, pool weights tied to
 * them, budget on the 0.25 h lattice) and runs both baselines side by side: the
 * shipped baseline and a replica of the pre-2026-07-26 CONTINUOUS equal split,
 * which is the only part of the "before" row that can still be measured.
 *
 * SCOPE NARROWED 2026-08-06. Two of the three claims this file was written to
 * check have since been RETRACTED: the `naive = 0` row was an artifact of the
 * baseline's switch bill rather than a scenario, and the "~4–6% typical day"
 * went with it. The cap counters below are consequently identically zero at
 * every task count — kept as a one-line assertion that they stay zero, since
 * that is now the claim worth guarding. What this probe still measures on its
 * own is the continuous-vs-block "before" row and the single-budget ≥ 0
 * guarantee; the retraction's own numbers live in
 * `rv14-naive-switch-bill.probe.ts`.
 *
 * The 0% row is the load-bearing half, and on the single-budget path it is a
 * theorem rather than a measurement (the block equal split is one of the
 * distributions the exact greedy maximizes over, Fox 1966, §4) — so it is
 * asserted here and pinned in the suite. The pooled path has no proof; its rate
 * is a measurement that can legitimately move.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';
import {
	BLOCK_HOURS,
	calculateTaskAllocations,
	calculateTotalProductivity,
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
	GAIN_PERCENT_CAP,
	pooledProductivityGain,
	productivityGain,
	type PooledTaskInput,
} from '$lib/business/model/zenith';
import { getEffectiveDifficulty } from '$lib/business/model/metric/calculation';

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

const DAYS_PER_COUNT = 400;

describe('The naive baseline on the block lattice', () => {
	it('prints the gain-sign rates before and after, per task count', () => {
		for (const n of [2, 3, 4, 5, 6, 8]) {
			const rnd = mulberry32(100 + n);
			let negativeBefore = 0;
			let negativeAfter = 0;
			let negativePooled = 0;
			let capped = 0;
			let sliverDays = 0;
			const nonCapped: number[] = [];

			for (let day = 0; day < DAYS_PER_COUNT; day++) {
				const tasks: PooledTaskInput[] = Array.from(
					{
						length: n,
					},
					(_, i) => {
						const mental = 1 + Math.floor(rnd() * 10);
						const physical = 1 + Math.floor(rnd() * 10);

						return {
							title: `t${i}`,
							difficulty: getEffectiveDifficulty({
								mentalDifficulty: mental,
								physicalDifficulty: physical,
							}),
							enjoyment: 1 + Math.floor(rnd() * 10),
							cognitiveWeight: mental / 10,
							physicalWeight: physical / 10,
						};
					},
				);

				const budget = 0.5 + Math.floor(rnd() * 32) * 0.25;
				const after = productivityGain(tasks, budget, DEFAULT_USER_CONSTANTS, DEFAULT_SWITCH_COST);

				const pooled = pooledProductivityGain(
					tasks,
					budget,
					DEFAULT_CAPACITY_POOLS,
					DEFAULT_USER_CONSTANTS,
					DEFAULT_SWITCH_COST,
				);

				// The pre-2026-07-26 baseline: a CONTINUOUS equal split of the
				// effective budget, free to hand every task a sub-block sliver and
				// collect its ≈ p₀ activation bonus.
				const overhead = n > 1 ? (n - 1) * DEFAULT_SWITCH_COST : 0;
				const effective = Math.max(0, budget - overhead);
				const share = effective / n;

				if (share > 1e-9 && share < BLOCK_HOURS) sliverDays++;

				const naiveBefore = calculateTotalProductivity(
					tasks,
					tasks.map(() => share),
				);

				const optimized = calculateTotalProductivity(
					tasks,
					calculateTaskAllocations(tasks, budget).map((alloc) => alloc.allocatedHours),
				);

				if (naiveBefore > 0 && optimized < naiveBefore) negativeBefore++;

				if (after.gainPercent < 0) negativeAfter++;

				if (pooled.gainPercent < 0) negativePooled++;

				if (after.gainPercent === GAIN_PERCENT_CAP) capped++;
				else nonCapped.push(after.gainPercent);

				// The guarantee on the single-budget path: the block equal split is
				// one of the distributions the exact greedy maximizes over.
				expect(after.gainPercent).toBeGreaterThanOrEqual(0);
			}

			nonCapped.sort((a, b) => a - b);
			const mean = nonCapped.reduce((sum, g) => sum + g, 0) / nonCapped.length;

			// Since the retraction there are no capped days, so the with-cap and
			// without-cap means are the same number and the "cap contributes x% of
			// the mean" line MATH.md quoted has no content left. What is worth
			// guarding is that the count stays zero.
			expect(capped).toBe(0);

			console.log(
				`n=${n}: MEAN gain ${mean.toFixed(1)}%, median ${nonCapped[Math.floor(nonCapped.length / 2)].toFixed(1)}%, p10 ${nonCapped[Math.floor(nonCapped.length * 0.1)].toFixed(1)}%, p90 ${nonCapped[Math.floor(nonCapped.length * 0.9)].toFixed(1)}% — no capped days`,
			);

			console.log(
				`n=${n}: gain < 0 before ${((100 * negativeBefore) / DAYS_PER_COUNT).toFixed(1)}%, after ${((100 * negativeAfter) / DAYS_PER_COUNT).toFixed(1)}% (pooled ${((100 * negativePooled) / DAYS_PER_COUNT).toFixed(1)}%); sub-block sliver days ${((100 * sliverDays) / DAYS_PER_COUNT).toFixed(1)}%`,
			);
		}
	});
});
