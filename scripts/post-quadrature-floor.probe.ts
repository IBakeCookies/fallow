/**
 * The two quadrature claims MATH.md §5.1 makes about its own accuracy floor,
 * neither of which had a probe:
 *
 *   1. "the 5-node Gauss–Hermite rule (exact for polynomial integrands through
 *      degree 9 … ; moment checks to 4·10⁻¹⁶ in the probe)" — no committed
 *      probe or test checked a single moment.
 *   2. "**The accuracy floor is not the rule's order** — it is the ϕ-floor
 *      clamping of the outer nodes (weight 0.0113 each) … Inside the σ-cap that
 *      is a sub-1% shift of the mean ϕ."
 *
 * Claim 1 is a property of the rule (it either holds or the abscissae are
 * wrong), so it carries an assertion. Claim 2 is a measurement over ϕ̂ and σ and
 * only prints — with one exception: the shift is a pure consequence of clamping,
 * so it can never be negative, and that is asserted.
 *
 * The nodes are spelled out here rather than imported because `zenith.ts` keeps
 * `GH_NODES` private and exposes only the mixture; the values are copied from
 * `zenith.ts:367` and the first test would fail loudly if they drifted.
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';

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

const RELATIVE_CAP = 0.5;
const PHI_FLOOR_HOURS = 0.1;
/** ϕ̂ values, spanning the ϕ floor to the largest fitted ϕ̂ ever measured (8.04h). */
const PHI_VALUES = [0.1, 0.15, 0.2, 0.25, 0.31, 0.4, 0.5, 1, 1.5, 2, 3, 3.06, 5, 6, 8];

/** (m−1)!! for even m — the standard-normal moments; odd moments vanish. */
function doubleFactorial(m: number): number {
	let product = 1;

	for (let k = m - 1; k > 1; k -= 2) product *= k;

	return product;
}

/** Σ wₙ·(√2σξₙ)^m: the rule's estimate of the m-th central moment of N(ϕ̂, σ²). */
const ruleMoment = (sigma: number, m: number): number =>
	GH_NODES.reduce((sum, { xi, w }) => sum + w * (Math.SQRT2 * sigma * xi) ** m, 0);

/** The clamped mixture's mean: what the model integrates against, once the floor bites. */
const clampedMean = (phi: number, sigma: number): number =>
	GH_NODES.reduce(
		(sum, { xi, w }) => sum + w * Math.max(PHI_FLOOR_HOURS, phi + Math.SQRT2 * sigma * xi),
		0,
	);

describe('MATH.md §5.1 — the quadrature rule and its real accuracy floor', () => {
	it('reproduces every moment of N(ϕ̂, σ²) through degree 9', () => {
		const sigma = 0.4;
		let worst = 0;

		const rows = Array.from(
			{
				length: 11,
			},
			(_, m) => {
				const exact = m % 2 === 0 ? doubleFactorial(m) * sigma ** m : 0;
				const got = ruleMoment(sigma, m);
				// Scaled by σ^m so degrees are comparable; odd moments are exactly 0,
				// where an absolute error in those units is the only honest metric.
				const error = Math.abs(got - exact) / sigma ** m / (m % 2 === 0 ? doubleFactorial(m) : 1);

				if (m <= 9) worst = Math.max(worst, error);

				return `  m=${m}: exact ${exact.toExponential(6)}, rule ${got.toExponential(6)}, rel err ${error.toExponential(2)}`;
			},
		);

		console.log(
			`[§5.1 quadrature] central moments of N(0, σ²) at σ = ${sigma}:\n${rows.join('\n')}`,
		);

		console.log(
			`[§5.1 quadrature] worst relative moment error over m = 0…9: ${worst.toExponential(2)} ` +
				`— degree 10 is where the rule stops being exact, as its order predicts`,
		);

		expect(worst).toBeLessThan(1e-14);

		// Non-vacuity: the rule must actually FAIL at degree 10, or "through 9"
		// would be an understatement of a rule of some higher order.
		expect(Math.abs(ruleMoment(sigma, 10) - doubleFactorial(10) * sigma ** 10)).toBeGreaterThan(
			1e-6 * sigma ** 10,
		);
	});

	it('measures the mean-ϕ shift the floor clamping causes inside the cap', () => {
		const rows = PHI_VALUES.map((phi) => {
			const shifts = Array.from(
				{
					length: 11,
				},
				(_, index) => {
					const ratio = Math.round(index * (RELATIVE_CAP / 10) * 100) / 100;

					return {
						ratio,
						shift: (clampedMean(phi, ratio * phi) - phi) / phi,
					};
				},
			);

			const worst = shifts.reduce((best, row) => (row.shift > best.shift ? row : best));

			return {
				phi,
				worst,
				atCap: shifts[shifts.length - 1].shift,
			};
		});

		console.log(
			`[§5.1 floor clamp] relative shift of the mixture's mean ϕ vs ϕ̂, σ/ϕ̂ ≤ ${RELATIVE_CAP}:\n${rows
				.map(
					(row) =>
						`  ϕ̂=${row.phi}h: at the cap ${(row.atCap * 100).toFixed(2)}%, ` +
						`worst ${(row.worst.shift * 100).toFixed(2)}% at σ/ϕ̂=${row.worst.ratio}`,
				)
				.join('\n')}`,
		);

		const overOnePercent = rows.filter((row) => row.worst.shift > 0.01);

		console.log(
			`[§5.1 floor clamp] ϕ̂ values whose worst in-cap shift exceeds 1%: ` +
				`${overOnePercent.map((row) => `${row.phi}h (${(row.worst.shift * 100).toFixed(1)}%)`).join(', ') || 'none'}`,
		);

		// Clamping can only raise a node, so the mean can only move up.
		for (const row of rows) expect(row.worst.shift).toBeGreaterThanOrEqual(0);
	});
});
