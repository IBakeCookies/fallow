/**
 * What MATH.md §5.1's SECOND guard actually costs, inside the σ-cap.
 *
 * Guard 2 (`buildBlockIncrements`: stop at the first non-positive OR
 * non-decreasing increment) is justified in §5.1 by two statements that no
 * committed probe measured:
 *
 *   "Inside the cap the only residual violations are O(10⁻⁴) wiggles at one
 *    extreme corner (ϕ̂ ≈ 6h with σ at the cap …); cutting the menu there …
 *    at the cost of a few low-value blocks in a corner where the fit is
 *    dubious anyway."
 *
 * `phi-uncertainty-cap.probe.ts` measures WHERE the cut loses value and HOW
 * MUCH of the task's value (51 lossy cells, 26.53% worst, first at σ/ϕ̂ ≈ 0.35,
 * 2026-08-06). It does not measure the SIZE of the monotonicity violation that
 * fires the cut, how many blocks the cut drops, or which of the two cuts caused
 * each of those 51 — the quantities the sentence above asserts. This does.
 *
 * A probe, not a test: every number moves with the quadrature rule, the ϕ floor
 * and the block lattice. Grid deliberately identical to
 * `phi-uncertainty-cap.probe.ts` (same r × ϕ̂ values, σ/ϕ̂ in 0.05 steps up to
 * the cap) so the two files' cell counts are comparable, and menus are built
 * from the shipped export with `buildBlockIncrements`' own span and 1e-12
 * tolerances.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	BLOCK_HOURS,
	expectedAverageProductivity,
	expectedOptimalTime,
} from '$lib/business/model/zenith';

/** a = 1 makes r = p₀/a literally the p₀ passed in. */
const PEAK_SCALE = 1;
const RELATIVE_CAP = 0.5;
const PHI_FLOOR_HOURS = 0.1;
const GH_OUTER_XI = 2.0201828704560856;
const R_VALUES = [0.04, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const PHI_VALUES = [0.1, 0.25, 0.5, 1, 1.5, 2, 2.5, 3, 3.06, 4, 5, 6, 7, 8];

const RATIOS = Array.from(
	{
		length: 11,
	},
	(_, index) => Math.round(index * 0.05 * 100) / 100,
);

interface Cell {
	r: number;
	phi: number;
	ratio: number;
}

interface Measurement {
	/** The first pre-crossing monotonicity violation — guard 2's trigger — if any. */
	violation: {
		/** Block index j whose increment exceeded its predecessor. */
		block: number;
		/** Δ(j) − Δ(j−1) > 0, the wiggle's absolute size. */
		absolute: number;
		/** The same, relative to Δ(j−1). */
		relative: number;
	} | null;
	/** Value rises again after falling: a second lobe, which guard 1's cut hides. */
	bimodal: boolean;
	/** Blocks the cut drops: best block count − prefix length. */
	blocksDropped: number;
	/** % of the cell's best menu value forfeited by cutting there. */
	lossPercent: number;
	/** Is the low outer quadrature node sitting on the ϕ floor? */
	nodeClamped: boolean;
}

function measure(cell: Cell): Measurement {
	const sigma = Math.min(cell.ratio, RELATIVE_CAP) * cell.phi;
	const phiMax = Math.max(PHI_FLOOR_HOURS, cell.phi + Math.SQRT2 * sigma * GH_OUTER_XI);
	const blocks = Math.ceil(expectedOptimalTime(PEAK_SCALE, cell.r, phiMax, 0) / BLOCK_HOURS) + 1;

	const values = Array.from(
		{
			length: blocks + 1,
		},
		(_, n) => expectedAverageProductivity(n * BLOCK_HOURS, PEAK_SCALE, cell.r, cell.phi, sigma),
	);

	const increments = values.slice(1).map((value, index) => value - values[index]);
	let stalled = false;
	let bimodal = false;

	for (const increment of increments) {
		if (increment <= 1e-12) stalled = true;
		else if (stalled) bimodal = true;
	}

	let prefix = 0;
	let violation: Measurement['violation'] = null;

	for (let n = 0; n < increments.length; n++) {
		if (increments[n] <= 1e-12) break;

		if (n > 0 && increments[n] > increments[n - 1] + 1e-12) {
			violation = {
				block: n + 1,
				absolute: increments[n] - increments[n - 1],
				relative: (increments[n] - increments[n - 1]) / increments[n - 1],
			};

			break;
		}

		prefix = n + 1;
	}

	const best = Math.max(...values);

	return {
		violation,
		bimodal,
		blocksDropped: values.indexOf(best) - prefix,
		lossPercent: best > 0 ? ((best - values[prefix]) / best) * 100 : 0,
		nodeClamped: cell.phi - Math.SQRT2 * sigma * GH_OUTER_XI < PHI_FLOOR_HOURS,
	};
}

const describeCell = (cell: Cell): string =>
	`r=${cell.r} ϕ̂=${cell.phi}h σ/ϕ̂=${cell.ratio} (σ=${(cell.ratio * cell.phi).toFixed(3)}h)`;

describe('MATH.md §5.1 guard 2 — the size of the violation, and what the cut drops', () => {
	it('measures every monotonicity violation inside the σ-cap', () => {
		const cells: Cell[] = R_VALUES.flatMap((r) =>
			PHI_VALUES.flatMap((phi) =>
				RATIOS.map((ratio) => ({
					r,
					phi,
					ratio,
				})),
			),
		);

		const results = cells.map((cell) => ({
			cell,
			measurement: measure(cell),
		}));

		const lossy = results.filter((result) => result.measurement.lossPercent > 0);

		const hits = lossy.filter(
			(
				result,
			): result is {
				cell: Cell;
				measurement: Measurement & { violation: NonNullable<Measurement['violation']> };
			} => result.measurement.violation !== null,
		);

		// Attribution: §5.1 credits all 51 lossy cells to the monotone-prefix cut,
		// but a bimodal cell loses its second lobe to guard 1's non-positive cut
		// with no monotonicity violation anywhere.
		console.log(
			`[§5.1 guard 2] ${cells.length} cells inside the cap (same grid as ` +
				`phi-uncertainty-cap.probe.ts, σ/ϕ̂ ≤ ${RELATIVE_CAP}): ${lossy.length} forfeit value — ` +
				`${hits.length} to the monotone-prefix cut, ${lossy.length - hits.length} to the ` +
				`non-positive cut alone (bimodal), ` +
				`${hits.filter((hit) => hit.measurement.bimodal).length} both`,
		);

		if (hits.length === 0) return;

		const worstBy = (key: (hit: (typeof hits)[number]) => number) =>
			hits.reduce((best, hit) => (key(hit) > key(best) ? hit : best));

		const worstAbsolute = worstBy((hit) => hit.measurement.violation.absolute);
		const worstRelative = worstBy((hit) => hit.measurement.violation.relative);
		const worstDropped = worstBy((hit) => hit.measurement.blocksDropped);
		const worstLoss = worstBy((hit) => hit.measurement.lossPercent);

		console.log(
			`[§5.1 guard 2] wiggle size Δ(j) − Δ(j−1): worst absolute ` +
				`${worstAbsolute.measurement.violation.absolute.toExponential(2)} ` +
				`(${(worstAbsolute.measurement.violation.relative * 100).toFixed(1)}% of Δ(j−1)) at ` +
				`${describeCell(worstAbsolute.cell)}; worst relative ` +
				`${(worstRelative.measurement.violation.relative * 100).toFixed(1)}% at ` +
				`${describeCell(worstRelative.cell)}`,
		);

		console.log(
			`[§5.1 guard 2] blocks dropped: worst ${worstDropped.measurement.blocksDropped} ` +
				`(${(worstDropped.measurement.blocksDropped * BLOCK_HOURS).toFixed(2)}h) at ` +
				`${describeCell(worstDropped.cell)}, forfeiting ` +
				`${worstDropped.measurement.lossPercent.toFixed(2)}%`,
		);

		console.log(
			`[§5.1 guard 2] worst forfeiture ${worstLoss.measurement.lossPercent.toFixed(2)}% at ` +
				`${describeCell(worstLoss.cell)}, cut at block ` +
				`${worstLoss.measurement.violation.block}, dropping ` +
				`${worstLoss.measurement.blocksDropped} blocks`,
		);

		const clamped = hits.filter((hit) => hit.measurement.nodeClamped).length;
		const ratios = hits.map((hit) => hit.cell.ratio);
		const phis = hits.map((hit) => hit.cell.phi);

		console.log(
			`[§5.1 guard 2] where: σ/ϕ̂ ∈ ${Math.min(...ratios)}…${Math.max(...ratios)}, ` +
				`ϕ̂ ∈ ${Math.min(...phis)}…${Math.max(...phis)}h, ` +
				`low outer node on the ϕ floor in ${clamped}/${hits.length}`,
		);

		console.log(
			`[§5.1 guard 2] the corner §5.1 names (r = 0.3, ϕ̂ = 6h, σ at the cap): ` +
				`${JSON.stringify(
					measure({
						r: 0.3,
						phi: 6,
						ratio: RELATIVE_CAP,
					}),
				)}`,
		);
	});
});
