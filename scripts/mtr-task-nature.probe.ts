/**
 * Measurements behind MATH.md §22: the balanced rate over the slider square
 * before and after the zero gate, and what the rejected demand-share rule would
 * have moved.
 *
 * Exhaustive, not sampled — the claims ARE the whole space: every integer pair
 * the two difficulty sliders admit, 0–10 either way (`persisted.ts`'s
 * `DIFFICULTY_MIN`/`RATING_MAX`), so 121 pairs, no randomness to seed and none a
 * re-run can reroll.
 *
 * A probe, not a test: the rates move whenever the ±3 threshold or the gate
 * moves, and in the suite that is a red build carrying no regression. What it
 * found is pinned by fixture in `calculation.test.ts` — the four pairs that
 * moved, and the 45 the shipped rule calls balanced.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports. An undated number in that document is unfalsifiable.
 *
 * Usage: npm run probe -- scripts/mtr-task-nature.probe.ts
 */

import { describe, it } from 'vitest';
import { getTaskNature } from '$lib/business/model/metric/calculation';

const MAX = 10;

const SQUARE = Array.from(
	{
		length: MAX + 1,
	},
	(_, mental) =>
		Array.from(
			{
				length: MAX + 1,
			},
			(_, physical) => [mental, physical] as const,
		),
).flat();

const f = (n: number) => n.toFixed(1);

const shipped = (mental: number, physical: number) =>
	getTaskNature({
		mentalDifficulty: mental,
		physicalDifficulty: physical,
	});

/**
 * The pre-2026-08-07 rule — the ±3 gap alone — read through the shipped one
 * rather than restated: +1 to both sliders preserves the gap and removes any
 * zero, so the gate cannot fire. A change to the threshold moves both readings
 * together, which is the point.
 */
const gapOnly = (mental: number, physical: number) => shipped(mental + 1, physical + 1);

/**
 * The alternative §22 rejects: the dominant dimension's share of total demand.
 * 0/0 divides to NaN, which fails the comparison and lands on balanced — the
 * same verdict the shipped rule gives it.
 */
const demandShare = (mental: number, physical: number) =>
	Math.max(mental, physical) / (mental + physical) >= 0.65
		? mental > physical
			? 'cognitive'
			: 'physical'
		: 'balanced';

const balanced = (
	rule: (mental: number, physical: number) => string,
	pairs: readonly (readonly [number, number])[] = SQUARE,
) => pairs.filter(([mental, physical]) => rule(mental, physical) === 'balanced').length;

const rate = (count: number, total: number) => `${count}/${total} = ${f((100 * count) / total)}%`;

describe('getTaskNature over every pair the sliders reach', () => {
	it('what did the zero gate move, and what is the balanced rate?', () => {
		const moved = SQUARE.filter(
			([mental, physical]) => gapOnly(mental, physical) !== shipped(mental, physical),
		);

		console.log(`\n${SQUARE.length} integer pairs, 0–${MAX} on both sliders:`);
		console.log(`  [§22 "exactly 4 of the 121"] pairs the zero gate moves: ${moved.length}`);

		for (const [mental, physical] of moved)
			console.log(
				`    (m${mental},p${physical})  ${gapOnly(mental, physical)} → ${shipped(mental, physical)}`,
			);

		console.log(
			`  [§22 "falls from 49/121 = 40.5%"] balanced under the gap alone: ` +
				`${rate(balanced(gapOnly), SQUARE.length)}`,
		);

		console.log(
			`  [§22 "to 45/121 = 37.2%"] balanced as shipped: ` +
				`${rate(balanced(shipped), SQUARE.length)}`,
		);
	});

	it('does the gate change anything over 1–10, where §16 sampled?', () => {
		const interior = SQUARE.filter(([mental, physical]) => Math.min(mental, physical) >= 1);

		console.log(`\n${interior.length} integer pairs, 1–${MAX} on both sliders:`);

		console.log(
			`  [§22 "over 1–10 it is 44% either way"] balanced under the gap alone ` +
				`${rate(balanced(gapOnly, interior), interior.length)}, as shipped ` +
				`${rate(balanced(shipped, interior), interior.length)}`,
		);
	});

	it('how far off is the demand-share rule §22 rejected?', () => {
		const against = (rule: (mental: number, physical: number) => string) =>
			SQUARE.filter(
				([mental, physical]) => demandShare(mental, physical) !== rule(mental, physical),
			);

		const versusShipped = against(shipped);

		console.log(`\nmax/(m+p) ≥ 0.65 against the gap rule, over all ${SQUARE.length} pairs:`);

		console.log(
			`  [§22 "disagrees with the gap rule on 22 of the 121 pairs"] ` +
				`vs the gap alone: ${against(gapOnly).length}  |  vs shipped (with the gate): ` +
				`${versusShipped.length}`,
		);

		for (const [mental, physical] of versusShipped)
			console.log(
				`    (m${mental},p${physical})  gap says ${shipped(mental, physical)}, ` +
					`share says ${demandShare(mental, physical)}`,
			);
	});
});
