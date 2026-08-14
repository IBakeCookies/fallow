/**
 * MATH.md §1–§2: the v2 curve's five properties and the three structural facts
 * about `N(x)` under "Marginal of the average".
 *
 * §2 states the facts are "provable on paper — so the allocator's exactness does
 * not hang on a numeric sweep", and nothing in the repo checked the
 * differentiations themselves (`N' = e^(−x)·x·(1−r−x)`,
 * `D' = e^(−x)·x²·(x+r−2)`, `u(r) = N(2−r) = e^(r−2)·(7−2r) − (1+r)`).
 *
 * A hand derivation that is wrong reads exactly like one that is right, and
 * §4's truncate-at-first-non-positive-increment rule and the greedy allocator's
 * exactness both rest on these facts. So this probe differentiates numerically
 * and evaluates every stated range at its ENDPOINTS, including
 * `AMPLITUDE_RATIO_CAP` (r = 0.9) and the r → 1 asymptote past it.
 *
 * §2's peak-display claim was quoted the same way: only the grid maximum of the
 * v1→v2 gap `1 − (1+r)·e^(−r)` was printed, while the per-difficulty figures and
 * the count of integer slider cells over 5% were left to the reader's algebra.
 * So the gap is also swept over the 100 integer cells, worst-per-difficulty.
 *
 * A probe, not a test: it sweeps r and the whole slider domain and prints
 * margins. The invariants it establishes are pinned by cheap fixtures in
 * `zenith.test.ts`; the sweep itself never runs in `npm test`.
 *
 * Deterministic — a grid, no randomness, so every number below reproduces.
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';
import {
	averageProductivity,
	avgProductivityDerivative,
	calculateTaskParams,
	findOptimalSingleTaskTime,
	mapEffort,
	optimalStoppingX,
	productivity,
} from '$lib/business/model/zenith';

/** The r-cap (AMPLITUDE_RATIO_CAP is module-private in zenith.ts). */
const AMPLITUDE_RATIO_CAP = 0.9;
/**
 * The marginal's numerator and the two auxiliary functions §2 builds on it, all
 * transcribed from MATH.md — NOT from `zenith.ts` — so a wrong derivation in the
 * document shows up as a mismatch against finite differences.
 */
const N = (x: number, r: number) => Math.exp(-x) * (x * x + (1 + r) * x + (1 + r)) - (1 + r);
/** Fact 1: N'(x) = e^(−x)·x·(1 − r − x). */
const nPrime = (x: number, r: number) => Math.exp(-x) * x * (1 - r - x);
/** Fact 2: M = N/x², M' = D/x³ with D = x·N' − 2N and D' = e^(−x)·x²·(x + r − 2). */
const M = (x: number, r: number) => N(x, r) / (x * x);
const D = (x: number, r: number) => x * nPrime(x, r) - 2 * N(x, r);
const dPrime = (x: number, r: number) => Math.exp(-x) * x * x * (x + r - 2);
/** Fact 3: u(r) := N(2−r) = e^(r−2)·(7 − 2r) − (1+r). */
const u = (r: number) => Math.exp(r - 2) * (7 - 2 * r) - (1 + r);
/** Endpoints first: 0 (r → 0 limit), the 0.9 cap, and 0.95/1 beyond it. */
const R_GRID = [0, 0.05, 0.1, 0.207, 0.3, 0.5, 0.7, AMPLITUDE_RATIO_CAP, 0.95, 1];

/** Independent root of N — not `optimalStoppingX`'s rearranged eˣ form. */
function rootOfN(r: number): number {
	let lo = 1e-12;
	let hi = 40;

	for (let i = 0; i < 200; i++) {
		const mid = (lo + hi) / 2;

		if (N(mid, r) > 0) lo = mid;
		else hi = mid;
	}

	return (lo + hi) / 2;
}

/** The slider domain at quarter-step resolution (37 × 37 = 1369 tasks). */
const DOMAIN: { difficulty: number; enjoyment: number }[] = [];

for (let difficulty = 1; difficulty <= 10; difficulty += 0.25) {
	for (let enjoyment = 1; enjoyment <= 10; enjoyment += 0.25) {
		DOMAIN.push({
			difficulty,
			enjoyment,
		});
	}
}

describe('MATH.md §2 marginal facts', () => {
	it('fact 1: N(0) = 0, N′ = e^(−x)·x·(1−r−x), one root x* ∈ (1−r, 2−r), N < 0 forever past it', () => {
		let worstDerivative = 0;

		for (const r of R_GRID) {
			expect(N(0, r)).toBeCloseTo(0, 12);

			for (let i = 1; i <= 400; i++) {
				const x = i * 0.05;
				const h = 1e-6;
				const fd = (N(x + h, r) - N(x - h, r)) / (2 * h);
				worstDerivative = Math.max(worstDerivative, Math.abs(fd - nPrime(x, r)));
			}

			const root = rootOfN(r);

			// N rises to its peak at x = 1−r, so the crossing must come later. At
			// r = 1 the rising interval (0, 1−r) is empty and x* collapses to 0 — the
			// degenerate flat curve AMPLITUDE_RATIO_CAP exists to exclude.
			if (r < 1) expect(nPrime((1 - r) / 2, r)).toBeGreaterThan(0);

			expect(nPrime(1 - r + 0.05, r)).toBeLessThan(0);
			expect(root).toBeGreaterThanOrEqual(1 - r);
			// "negative FOREVER past the optimum": scan two decades of x beyond it.
			let worstPast = -Infinity;

			for (let i = 0; i <= 20000; i++)
				worstPast = Math.max(worstPast, N(root + 1e-6 + i * 0.01, r));

			console.log(
				`r=${r}  x*=${root.toFixed(6)}  optimalStoppingX=${optimalStoppingX(r).toFixed(6)}  ` +
					`peak at 1−r=${(1 - r).toFixed(3)}  max N past x*=${worstPast.toExponential(2)}  ` +
					`N(200)=${N(200, r).toFixed(4)} vs −(1+r)=${(-(1 + r)).toFixed(4)}`,
			);

			expect(worstPast).toBeLessThanOrEqual(0);
			expect(N(200, r)).toBeCloseTo(-(1 + r), 10);
		}

		console.log(`max |N′ − finite difference| = ${worstDerivative.toExponential(3)}`);
		expect(worstDerivative).toBeLessThan(1e-6);
	});

	it('fact 2: D(0) = 0, D′ = e^(−x)·x²·(x+r−2), so M = N/x² strictly decreases on (0, 2−r)', () => {
		let worstDerivative = 0;

		for (const r of R_GRID) {
			expect(D(0, r)).toBeCloseTo(0, 12);
			let worstD = -Infinity;
			let steps = 0;
			let prev = Infinity;

			for (let i = 1; i <= 20000; i++) {
				const x = (i / 20000) * (2 - r);
				const h = 1e-6;

				worstDerivative = Math.max(
					worstDerivative,
					Math.abs((D(x + h, r) - D(x - h, r)) / (2 * h) - dPrime(x, r)),
				);

				worstD = Math.max(worstD, D(x, r));
				const m = M(x, r);

				if (m < prev) steps++;

				prev = m;
			}

			console.log(
				`r=${r}  2−r=${(2 - r).toFixed(3)}  max D on (0,2−r]=${worstD.toExponential(2)}  ` +
					`strictly-decreasing steps=${steps}/20000`,
			);

			expect(worstD).toBeLessThanOrEqual(0);
			expect(steps).toBe(20000);
		}

		console.log(`max |D′ − finite difference| = ${worstDerivative.toExponential(3)}`);
		expect(worstDerivative).toBeLessThan(1e-6);
	});

	it('fact 3: u(r) = N(2−r) is convex with negative endpoints, so x* < 2−r everywhere', () => {
		for (const r of R_GRID) {
			expect(u(r)).toBeCloseTo(N(2 - r, r), 12);
			expect(rootOfN(r)).toBeLessThan(2 - r);
		}

		let worstU = -Infinity;
		let worstConvexity = Infinity;

		for (let i = 0; i <= 100000; i++) {
			const r = i / 100000;
			worstU = Math.max(worstU, u(r));
			// u″(r) = e^(r−2)·(3 − 2r)
			worstConvexity = Math.min(worstConvexity, Math.exp(r - 2) * (3 - 2 * r));
		}

		console.log(
			`u(0)=${u(0).toFixed(6)}  u(1)=${u(1).toFixed(6)}  max u on [0,1]=${worstU.toFixed(6)}  ` +
				`min u″=${worstConvexity.toFixed(6)}`,
		);

		expect(worstU).toBeLessThan(0);
		expect(worstConvexity).toBeGreaterThan(0);
		expect(u(0)).toBeCloseTo(7 * Math.exp(-2) - 1, 12);
		expect(u(1)).toBeCloseTo(5 * Math.exp(-1) - 2, 12);
	});
});

describe('MATH.md §2 curve properties the suite does not assert', () => {
	it('is concave on the whole working range: p″ = a·k²·e^(−kt)·(kt − (2−r)) < 0 on (0, T*]', () => {
		let worstSecond = -Infinity;
		let worstClosedForm = 0;
		let worstMargin = Infinity;

		for (const task of DOMAIN) {
			const { a, p0, k } = calculateTaskParams({
				title: '',
				...task,
			});

			const r = p0 / a;

			const optimal = findOptimalSingleTaskTime({
				title: '',
				...task,
			});

			for (let i = 1; i <= 100; i++) {
				const t = (i / 100) * optimal;
				const h = 1e-5;

				const fd =
					(productivity(t + h, a, p0, k) -
						2 * productivity(t, a, p0, k) +
						productivity(t - h, a, p0, k)) /
					(h * h);

				const closed = a * k * k * Math.exp(-k * t) * (k * t - (2 - r));
				worstClosedForm = Math.max(worstClosedForm, Math.abs(fd - closed) / Math.abs(closed));
				worstSecond = Math.max(worstSecond, closed);
			}

			// How far the inflection sits beyond the stopping point, in x units.
			worstMargin = Math.min(worstMargin, 2 - r - k * optimal);
		}

		console.log(
			`max p″ on (0,T*] over ${DOMAIN.length} tasks = ${worstSecond.toExponential(3)}  ` +
				`min (2−r) − kT* margin = ${worstMargin.toFixed(6)}  ` +
				`max rel |p″ − finite difference| = ${worstClosedForm.toExponential(3)}`,
		);

		expect(worstSecond).toBeLessThan(0);
		expect(worstMargin).toBeGreaterThan(0);
	});

	it('decays to 0 (burnout tail) and peaks at a·e^(r−1); P̄ and its marginal match the closed forms', () => {
		let worstTail = 0;
		let worstPeak = 0;
		let worstAverage = 0;
		let worstLimit = 0;
		let worstActivation = 0;
		let worstDisplayShift = 0;

		for (const task of DOMAIN) {
			const { a, p0, k, phi } = calculateTaskParams({
				title: '',
				...task,
			});

			const r = p0 / a;
			worstTail = Math.max(worstTail, productivity(200, a, p0, k));
			worstPeak = Math.max(worstPeak, Math.abs(productivity(phi, a, p0, k) - a * Math.exp(r - 1)));

			// "peak-productivity displays change only slightly": v1's peak was
			// (a+p₀)/e, the first-order-in-r expansion of a·e^(r−1).
			worstDisplayShift = Math.max(
				worstDisplayShift,
				Math.abs(a * Math.exp(r - 1) - (a * (1 + r)) / Math.E) / (a * Math.exp(r - 1)),
			);

			for (const T of [0.25, 1, 2.5, 6]) {
				const n = 20000;
				let sum = 0;

				for (let i = 0; i < n; i++) sum += productivity(((i + 0.5) * T) / n, a, p0, k);

				worstAverage = Math.max(
					worstAverage,
					Math.abs(averageProductivity(T, a, p0, k) - sum / n) / (sum / n),
				);
			}

			worstLimit = Math.max(
				worstLimit,
				Math.abs(avgProductivityDerivative(0, a, p0, k) - (k * (a - p0)) / 2),
			);

			worstActivation = Math.max(
				worstActivation,
				Math.abs(averageProductivity(1e-9, a, p0, k) - p0) / p0,
			);
		}

		console.log(
			`max p(200h)=${worstTail.toExponential(3)}  max |p(ϕ) − a·e^(r−1)|=${worstPeak.toExponential(3)}  ` +
				`max rel P̄ vs quadrature=${worstAverage.toExponential(3)}  ` +
				`max |P̄′(0⁺) − k(a−p₀)/2|=${worstLimit.toExponential(3)}  ` +
				`max rel |P̄(0⁺) − p₀|=${worstActivation.toExponential(3)}  ` +
				`max peak shift vs v1 (a+p₀)/e=${(100 * worstDisplayShift).toFixed(2)}%`,
		);

		expect(worstTail).toBeLessThan(1e-6);
		expect(averageProductivity(0, 6, 0.5, 0.5)).toBe(0);
	});

	it('the peak gap 1 − (1+r)·e^(−r) per integer slider cell: difficulty-only, monotone, > 5% on the easiest rows', () => {
		// r = p₀/a = (β/E)/(E·β) = 1/E², so the gap depends on the difficulty
		// slider alone — enjoyment is swept to show it cannot move it.
		let cellsOver5Percent = 0;
		let previousWorst = Infinity;

		for (let difficulty = 1; difficulty <= 10; difficulty++) {
			let worst = 0;
			let flattest = Infinity;
			let rowR = 0;

			for (let enjoyment = 1; enjoyment <= 10; enjoyment++) {
				const { a, p0 } = calculateTaskParams({
					title: '',
					difficulty,
					enjoyment,
				});

				const r = p0 / a;
				const v2Peak = a * Math.exp(r - 1);
				const shift = Math.abs(v2Peak - (a * (1 + r)) / Math.E) / v2Peak;

				expect(shift).toBeCloseTo(1 - (1 + r) * Math.exp(-r), 12);

				worst = Math.max(worst, shift);
				flattest = Math.min(flattest, shift);
				rowR = r;

				if (shift > 0.05) cellsOver5Percent++;
			}

			console.log(
				`difficulty=${difficulty}  r=${rowR.toFixed(6)}  ` +
					`worst peak shift vs v1 (a+p₀)/e=${(100 * worst).toFixed(2)}%  ` +
					`(identical on all 10 enjoyment cells)`,
			);

			expect(flattest).toBeCloseTo(worst, 12);
			expect(worst).toBeGreaterThan(0);
			expect(worst).toBeLessThan(previousWorst);
			previousWorst = worst;
		}

		console.log(`integer slider cells shifting more than 5% = ${cellsOver5Percent}/100`);

		// Whole rows cross together, since enjoyment does not enter the gap.
		expect(cellsOver5Percent % 10).toBe(0);
	});
});

describe('MATH.md §1 amplitude cap', () => {
	it('r = 1/E² and the cap binds exactly below user difficulty 1.1217', () => {
		const capEffort = 1 / Math.sqrt(AMPLITUDE_RATIO_CAP);
		const capDifficulty = (capEffort - 5 / 9) * (9 / 4);

		console.log(
			`1/√0.9 = ${capEffort.toFixed(6)} → user difficulty ${capDifficulty.toFixed(6)}  ` +
				`(slider span ${(100 * (capDifficulty - 1)) / 9}% of the 1–10 range)`,
		);

		for (const difficulty of [1, 1.1, 1.12, 1.1217, 1.13, 1.5, 10]) {
			const { a, p0 } = calculateTaskParams({
				title: '',
				difficulty,
				enjoyment: 5,
			});

			const E = mapEffort(difficulty);
			const raw = 1 / (E * E);

			console.log(
				`difficulty=${difficulty}  E=${E.toFixed(6)}  1/E²=${raw.toFixed(6)}  ` +
					`effective r=${(p0 / a).toFixed(6)}  cap binds=${raw > AMPLITUDE_RATIO_CAP}`,
			);

			expect(p0 / a).toBeCloseTo(Math.min(raw, AMPLITUDE_RATIO_CAP), 12);
			expect(raw > AMPLITUDE_RATIO_CAP).toBe(difficulty < capDifficulty);
		}
	});
});
