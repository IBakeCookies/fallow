/**
 * Measurements behind MATH.md §5.1's first guard, `PHI_UNCERTAINTY_RELATIVE_CAP
 * = 0.5` (src/lib/business/model/zenith.ts). §5.1 says an uncapped grid over
 * (r × ϕ̂ × σ, 504 cases) showed 18 bimodal cases losing up to 59% of a task's
 * value to truncation, and that "at 0.5·ϕ̂ the probe grid has zero bimodal cases
 * and zero truncation loss", with the bisection bracket crossing zero exactly
 * once. That grid was never committed, so none of those four numbers could be
 * re-checked. This rebuilds it.
 *
 * A probe, not a test: it answers "what is true of the mixture over a large
 * input space" and prints numbers, where a test answers "does this still hold"
 * and is binary. Every number below moves whenever the quadrature rule, the ϕ
 * floor, the block lattice or the stopping solve changes — honest model motion,
 * not regression — which is why this runs on demand (`npm run probe`) and never
 * in `npm test`. What it finds is pinned by one fixture in the suite, never by
 * the sweep itself.
 *
 * Three things are measured per cell, on the exact BLOCK_HOURS menu
 * `buildBlockIncrements` builds — same span (T*(ϕ_max), +1 block) and same
 * 1e-12 tolerances, so no number here is a float artifact of a re-derivation:
 *
 * - BIMODAL — E[P̄] rises again after having fallen, i.e. the increments go
 *   positive → non-positive → positive and the value function has a second
 *   local maximum. (Measured this way and not as "any rise in the increments":
 *   past the curve's inflection x = 2−r the marginal always climbs back toward
 *   0⁻, at σ = 0 included, so the looser reading flags the certainty model
 *   itself — §2 proves monotone increments only on the working range (0, x*].)
 * - TRUNCATION LOSS — what the monotone-prefix cut (stop at the first
 *   non-positive OR non-decreasing increment) forfeits against the true best
 *   block count, as a % of that cell's best. This is the pre-crossing
 *   monotonicity violation priced: a cut that fires at or past the true best
 *   costs nothing.
 * - CROSSINGS — sign changes of the increment sequence across
 *   [T*(ϕ_min), T*(ϕ_max)], the bracket `expectedOptimalTime`'s 60-step
 *   bisection assumes holds exactly one.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	averageProductivity,
	BLOCK_HOURS,
	expectedAverageProductivity,
	expectedOptimalTime,
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

/**
 * The cap under measurement, and the quadrature it is applied inside.
 *
 * This is the ONE thing the probe does not import. `expectedAverageProductivity`
 * clamps σ_eff = min(σ_ϕ, 0.5·ϕ̂) internally, so the pre-cap mixture — the very
 * thing the 504-case grid measured to choose 0.5 — is unreachable through the
 * exported API: every σ/ϕ̂ > 0.5 returns the σ/ϕ̂ = 0.5 curve exactly (checked
 * below). Reproducing the uncapped half therefore needs the rule spelled out
 * here; the capped half calls the export and nothing else.
 */
const RELATIVE_CAP = 0.5;
const PHI_FLOOR_HOURS = 0.1;

const GH_NODES = [
	{
		xi: 0,
		w: 0.5333333333333333,
	},
	{
		xi: 0.9585724646138185,
		w: 0.2220759220056126,
	},
	{
		xi: -0.9585724646138185,
		w: 0.2220759220056126,
	},
	{
		xi: 2.0201828704560856,
		w: 0.011257411327720688,
	},
	{
		xi: -2.0201828704560856,
		w: 0.011257411327720688,
	},
];

// a = 1 makes r = p₀/a literally the p₀ passed in (amplitudeRatio caps at 0.9).
const PEAK_SCALE = 1;

interface Cell {
	r: number;
	phi: number;
	ratio: number;
}

interface Measurement {
	bimodal: boolean;
	lossPercent: number;
	/** null at σ = 0: the bracket collapses and the model uses the closed form. */
	crossings: number | null;
}

const nodePhis = (phi: number, sigma: number): number[] =>
	GH_NODES.map(({ xi }) => Math.max(PHI_FLOOR_HOURS, phi + Math.SQRT2 * sigma * xi));

interface Mixture {
	/** σ the mixture really runs at — what the bracket and the menu span follow. */
	sigma: number;
	curve: (T: number) => number;
}

/** The shipped path: σ goes in raw, the export clamps it. */
const shipped = (cell: Cell): Mixture => ({
	sigma: Math.min(cell.ratio, RELATIVE_CAP) * cell.phi,
	curve: (T) => expectedAverageProductivity(T, PEAK_SCALE, cell.r, cell.phi, cell.ratio * cell.phi),
});

/** The counterfactual the cap deleted: same mixture, σ never clamped. */
const uncapped = (cell: Cell): Mixture => {
	const sigma = cell.ratio * cell.phi;
	const phis = nodePhis(cell.phi, sigma);

	return {
		sigma,
		curve: (T) =>
			GH_NODES.reduce(
				(sum, { w }, index) =>
					sum + w * averageProductivity(T, PEAK_SCALE, cell.r, (1 - cell.r) / phis[index]),
				0,
			),
	};
};

function measure(cell: Cell, sigma: number, curve: (T: number) => number): Measurement {
	const phis = nodePhis(cell.phi, sigma);
	const phiMin = Math.min(...phis);
	const phiMax = Math.max(...phis);
	// `buildBlockIncrements`' own span: no component has positive marginal past
	// its own T*, so the mixture's stopping point is at most T*(ϕ_max).
	const blocks = Math.ceil(expectedOptimalTime(PEAK_SCALE, cell.r, phiMax, 0) / BLOCK_HOURS) + 1;

	const values = Array.from(
		{
			length: blocks + 1,
		},
		(_, n) => curve(n * BLOCK_HOURS),
	);

	const increments = values.slice(1).map((value, index) => value - values[index]);
	let stalled = false;
	let bimodal = false;

	for (const increment of increments) {
		if (increment <= 1e-12) stalled = true;
		else if (stalled) bimodal = true;
	}

	// `buildBlockIncrements`' cut, tolerances included: first non-positive OR
	// non-decreasing increment.
	let prefix = 0;

	for (let n = 0; n < increments.length; n++) {
		if (increments[n] <= 1e-12) break;

		if (n > 0 && increments[n] > increments[n - 1] + 1e-12) break;

		prefix = n + 1;
	}

	const best = Math.max(...values);
	const lossPercent = best > 0 ? ((best - values[prefix]) / best) * 100 : 0;

	if (phiMax - phiMin < 1e-12)
		return {
			bimodal,
			lossPercent,
			crossings: null,
		};

	const lo = expectedOptimalTime(PEAK_SCALE, cell.r, phiMin, 0);
	const hi = expectedOptimalTime(PEAK_SCALE, cell.r, phiMax, 0);
	const steps = 256;
	const dead = 1e-12 * best;
	let crossings = 0;
	let sign = 0;
	let previous = curve(lo);

	for (let i = 1; i <= steps; i++) {
		const value = curve(lo + ((hi - lo) * i) / steps);
		const delta = value - previous;

		previous = value;

		if (Math.abs(delta) <= dead) continue;

		const next = Math.sign(delta);

		if (sign !== 0 && next !== sign) crossings++;

		sign = next;
	}

	return {
		bimodal,
		lossPercent,
		crossings,
	};
}

const round = (value: number, digits: number): number => {
	const scale = 10 ** digits;

	return Math.round(value * scale) / scale;
};

const firstRatio = (cells: Cell[]): string =>
	cells.length > 0 ? `${round(Math.min(...cells.map((cell) => cell.ratio)), 3)}` : '—';

function report(label: string, cells: Cell[], mixtureOf: (cell: Cell) => Mixture): void {
	const results = cells.map((cell) => {
		const { sigma, curve } = mixtureOf(cell);

		return {
			cell,
			measurement: measure(cell, sigma, curve),
		};
	});

	const bimodal = results.filter((result) => result.measurement.bimodal);
	const lossy = results.filter((result) => result.measurement.lossPercent > 0);
	const bracketed = results.filter((result) => result.measurement.crossings !== null);
	const miscrossed = bracketed.filter((result) => result.measurement.crossings !== 1);

	const worst = lossy.reduce<(typeof results)[number] | null>(
		(best, result) =>
			best === null || result.measurement.lossPercent > best.measurement.lossPercent
				? result
				: best,
		null,
	);

	const corner =
		worst === null
			? 'none'
			: `${round(worst.measurement.lossPercent, 2)}% at r=${worst.cell.r} ϕ̂=${worst.cell.phi}h σ=${round(worst.cell.ratio * worst.cell.phi, 3)}h`;

	console.log(
		`${label}: ${cells.length} cells | bimodal ${bimodal.length} (first σ/ϕ̂ ${firstRatio(bimodal.map((result) => result.cell))}) | truncation loss ${lossy.length}, worst ${corner} (first σ/ϕ̂ ${firstRatio(lossy.map((result) => result.cell))}) | ≠1 crossing ${miscrossed.length}/${bracketed.length} (first σ/ϕ̂ ${firstRatio(miscrossed.map((result) => result.cell))})`,
	);
}

const R_VALUES = [0.04, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
// Deliberately past the 3.06h ceiling DEFAULT_USER_CONSTANTS can reach, into the
// fitted-constants range where §5.1 names its worst corner (ϕ̂ ≈ 6h).
const PHI_VALUES = [0.1, 0.25, 0.5, 1, 1.5, 2, 2.5, 3, 3.06, 4, 5, 6, 7, 8];

const RATIOS = Array.from(
	{
		length: 31,
	},
	(_, index) => round(index * 0.05, 2),
);

const GRID: Cell[] = R_VALUES.flatMap((r) =>
	PHI_VALUES.flatMap((phi) =>
		RATIOS.map((ratio) => ({
			r,
			phi,
			ratio,
		})),
	),
);

const below = (cells: Cell[]) => cells.filter((cell) => cell.ratio <= RELATIVE_CAP);
const above = (cells: Cell[]) => cells.filter((cell) => cell.ratio > RELATIVE_CAP);

/** Off-lattice cells the fixed grid cannot hit, so the corners are not cherry-picked. */
function randomCells(count: number, seed: number): Cell[] {
	const random = mulberry32(seed);

	return Array.from(
		{
			length: count,
		},
		() => ({
			r: round(0.04 + random() * 0.86, 4),
			phi: round(0.1 + random() * 7.9, 4),
			ratio: round(random() * 1.5, 4),
		}),
	);
}

/**
 * The corner §5.1 itself flags as the survivor — ϕ̂ ≈ 6h with σ at the cap,
 * where the low outer node still lands on the ϕ floor and the mixture is a
 * 0.1h spike against a 14.6h crawl. Kept by value: a sweep answers "how often",
 * a fixture answers "how bad exactly there", and they are different questions.
 */
const WORST_CORNER: Cell[] = [5, 5.5, 6, 6.5, 7].flatMap((phi) =>
	Array.from(
		{
			length: 44,
		},
		(_, index) => round(0.04 + index * 0.02, 2),
	).flatMap((r) =>
		[0.3, 0.4, 0.45, 0.48, 0.49, 0.5].map((ratio) => ({
			r,
			phi,
			ratio,
		})),
	),
);

describe('ϕ-uncertainty relative cap', () => {
	it('measures the shipped capped mixture (MATH.md §5.1 guard 1)', () => {
		report('capped grid, σ ≤ 0.5·ϕ̂', below(GRID), shipped);
		report('capped grid, σ > 0.5·ϕ̂ (export clamps)', above(GRID), shipped);

		// Does the damage need an exotic fit, or does a default-constants user reach it?
		report(
			'capped grid, σ ≤ 0.5·ϕ̂, ϕ̂ ≤ 3.06h (DEFAULT_USER_CONSTANTS ceiling)',
			below(GRID).filter((cell) => cell.phi <= 3.06),
			shipped,
		);

		const saturated = above(GRID).filter((cell) => {
			const wide = shipped(cell).curve;

			const atCap = shipped({
				...cell,
				ratio: RELATIVE_CAP,
			}).curve;

			return Array.from(
				{
					length: 41,
				},
				(_, n) => n * BLOCK_HOURS,
			).every((T) => wide(T) === atCap(T));
		});

		console.log(
			`clamp saturation: ${saturated.length}/${above(GRID).length} above-cap cells bit-identical to their σ/ϕ̂ = 0.5 twin over 41 blocks`,
		);
	});

	it('measures the uncapped grid that chose 0.5 (MATH.md §5.1)', () => {
		report('uncapped grid, σ ≤ 0.5·ϕ̂', below(GRID), uncapped);
		report('uncapped grid, σ > 0.5·ϕ̂', above(GRID), uncapped);

		const random = randomCells(4000, 42);

		report('uncapped 4000 seeded random cells, σ ≤ 0.5·ϕ̂', below(random), uncapped);
		report('uncapped 4000 seeded random cells, σ > 0.5·ϕ̂', above(random), uncapped);
	});

	it('measures the corner §5.1 names (ϕ̂ ≈ 6h, σ at the cap)', () => {
		report('worst-corner fixture, shipped', WORST_CORNER, shipped);

		report(
			'worst-corner fixture at the cap only',
			WORST_CORNER.filter((cell) => cell.ratio === RELATIVE_CAP),
			shipped,
		);
	});
});
