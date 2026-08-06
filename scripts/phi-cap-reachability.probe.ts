/**
 * Is MATH.md §5.1's residual defect REACHABLE by a real fit?
 *
 * §5.1 (re-measured 2026-08-06) says `PHI_UNCERTAINTY_RELATIVE_CAP = 0.5` does
 * not do what it claimed: inside the cap there are still 7 bimodal cells and 51
 * that forfeit value to the monotone-prefix cut, worst 26.53%, all of them
 * appearing past σ/ϕ̂ ≈ 0.35 and needing ϕ̂ > 3.06h — the ceiling
 * `DEFAULT_USER_CONSTANTS` can reach. §5.1 then defends the cap with "the
 * damage needs a fitted ϕ̂ past 3h", and stops there. That is a statement about
 * a GRID, not about users: nothing measures whether a real ⚡ history can put a
 * task at ϕ̂ > 3.06h and σ/ϕ̂ > 0.35 AT THE SAME TIME.
 *
 * There is a structural reason to doubt it can. The ridge anchors ĉ to the
 * default with λ = RIDGE_PRIOR_STRENGTH = 4 pseudo-observations, so few logs
 * (large σ) pull ϕ̂ back toward the clean ≤ 3.06h region, while many logs (ϕ̂
 * free to move past 3h) shrink σ. The two conditions fight each other, and the
 * one mechanism that can satisfy both is EXTRAPOLATION: σ_ϕ = √(xᵀΣx) grows
 * with distance from the logged region, so a user who logs only easy tasks and
 * then adds a hard one gets a large σ and a large extrapolated ϕ̂ at once.
 * Arm 2 exists to hit that case on purpose.
 *
 * This probe decides between three fixes by measuring BOTH sides of the trade:
 *
 * - THE DEFECT SIDE — how often a fitted (ϕ̂, σ) lands in the lossy corner, and
 *   what the monotone-prefix cut actually forfeits there. Reachable and
 *   expensive ⇒ a live bug; unreachable ⇒ the cap is a documentation problem.
 * - THE COST SIDE — how many realistic cells sit at σ/ϕ̂ ∈ (0.35, 0.5], i.e.
 *   what lowering the cap would newly clamp, and how much hedging those users
 *   lose. Lowering the cap buys exactness by hedging LESS, and the users it
 *   stops hedging for are the ones with the least data — the exact failure
 *   §5.1 was built to fix. That cost has never been quantified either.
 *
 * A probe, not a test: it answers "what is true of the fit over a large input
 * space" and prints numbers, where a test answers "does this still hold" and is
 * binary. Every number below moves whenever the ridge, the recency weighting,
 * the quadrature or the block lattice changes — honest model motion, not
 * regression — which is why this runs on demand (`npm run probe`) and never in
 * `npm test`. What it finds is pinned by one fixture in the suite, never by the
 * sweep itself.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	BLOCK_HOURS,
	calculateFlowStateTime,
	calculateTaskParams,
	DEFAULT_USER_CONSTANTS,
	expectedAverageProductivity,
	expectedOptimalTime,
	fitUserConstants,
	phiParameterStd,
	type FitPosterior,
	type FlowObservation,
	type UserConstants,
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
 * The two boundaries under test, both from §5.1's re-measurement: the σ/ϕ̂ where
 * the low quadrature node collapses onto the ϕ floor and the mixture starts
 * misbehaving, and the ϕ̂ below which the whole sweep was clean anyway.
 */
const LOSS_RATIO = 0.35;
const CLEAN_PHI_CEILING = 3.06;
const SHIPPED_CAP = 0.5;
/** The ϕ floor and quadrature the shipped mixture runs, for the menu span. */
const PHI_FLOOR_HOURS = 0.1;
const GH_OUTER_XI = 2.0201828704560856;
/** ⚡ logs are a stopwatch reading; σ₀ = FLOW_NOISE_PRIOR_STD is the model's own prior. */
const NOISE_ARMS = [0.25, 0.5];

interface Query {
	/** What the user typed, not what the model mapped it to. */
	difficulty: number;
	enjoyment: number;
	phiHat: number;
	sigma: number;
	ratio: number;
}

/** One fitted user, queried across the slider grid the UI actually offers. */
function queryGrid(constants: UserConstants, posterior: FitPosterior): Query[] {
	const out: Query[] = [];

	for (let difficulty = 1; difficulty <= 10; difficulty++) {
		for (let enjoyment = 1; enjoyment <= 10; enjoyment++) {
			const { E, beta, phi } = calculateTaskParams(
				{
					title: 'q',
					difficulty,
					enjoyment,
				},
				constants,
			);

			const sigma = phiParameterStd(E, beta, posterior);

			out.push({
				difficulty,
				enjoyment,
				phiHat: phi,
				sigma,
				ratio: phi > 0 ? sigma / phi : 0,
			});
		}
	}

	return out;
}

/**
 * What the monotone-prefix cut forfeits for this task, as a % of the best
 * reachable block value — the same quantity `phi-uncertainty-cap.probe.ts`
 * measures, but on a menu whose (a, p₀, ϕ̂, σ) all came out of a real fit
 * instead of a swept grid. `sigmaOverride` prices the counterfactual cap.
 */
function truncationLossPercent(
	difficulty: number,
	enjoyment: number,
	constants: UserConstants,
	sigma: number,
): number {
	const { a, p0, phi } = calculateTaskParams(
		{
			title: 'q',
			difficulty,
			enjoyment,
		},
		constants,
	);

	const effective = Math.min(sigma, SHIPPED_CAP * phi);
	const phiMax = Math.max(PHI_FLOOR_HOURS, phi + Math.SQRT2 * effective * GH_OUTER_XI);
	const blocks = Math.ceil(expectedOptimalTime(a, p0, phiMax, 0) / BLOCK_HOURS) + 1;

	const values = Array.from(
		{
			length: blocks + 1,
		},
		(_, n) => expectedAverageProductivity(n * BLOCK_HOURS, a, p0, phi, sigma),
	);

	const increments = values.slice(1).map((value, index) => value - values[index]);
	// `buildBlockIncrements`' cut, tolerances included: first non-positive OR
	// non-decreasing increment.
	let prefix = 0;

	for (let n = 0; n < increments.length; n++) {
		if (increments[n] <= 1e-12) break;

		if (n > 0 && increments[n] > increments[n - 1] + 1e-12) break;

		prefix = n + 1;
	}

	const best = Math.max(...values);

	return best > 0 ? ((best - values[prefix]) / best) * 100 : 0;
}

/** How much hedging a user loses if the cap drops from 0.5·ϕ̂ to 0.35·ϕ̂. */
function hedgingDelta(
	difficulty: number,
	enjoyment: number,
	constants: UserConstants,
	sigma: number,
): { valuePercent: number; hoursShift: number } {
	const { a, p0, phi } = calculateTaskParams(
		{
			title: 'q',
			difficulty,
			enjoyment,
		},
		constants,
	);

	const atShipped = Math.min(sigma, SHIPPED_CAP * phi);
	const atLower = Math.min(sigma, LOSS_RATIO * phi);
	const tShipped = expectedOptimalTime(a, p0, phi, atShipped);
	const tLower = expectedOptimalTime(a, p0, phi, atLower);
	const vShipped = expectedAverageProductivity(tShipped, a, p0, phi, atShipped);
	const vLower = expectedAverageProductivity(tLower, a, p0, phi, atLower);

	return {
		// Positive = the lower cap reports MORE value, i.e. hedges less.
		valuePercent: vShipped > 0 ? ((vLower - vShipped) / vShipped) * 100 : 0,
		hoursShift: tLower - tShipped,
	};
}

/**
 * A synthetic user's true constants. Deliberately wider than the defaults can
 * reach (ϕ(E=5, β=1) = 3.06h): the corner under test needs ϕ̂ > 3.06h, so a
 * generator that cannot produce slow users would answer its own question.
 */
function drawUser(rand: () => number): UserConstants {
	return {
		c1: 0.3 + rand() * 1.1, // ϕ(5,1) reaches ~8h at the top
		c2: -0.5 + rand() * 0.45,
		c3: 0.2 + rand() * 1.0,
	};
}

function logAt(
	constants: UserConstants,
	difficulty: number,
	enjoyment: number,
	noise: number,
	rand: () => number,
): FlowObservation {
	const { E, beta } = calculateTaskParams(
		{
			title: 'l',
			difficulty,
			enjoyment,
		},
		constants,
	);

	// Box–Muller from the same seeded stream.
	const u1 = Math.max(1e-12, rand());
	const gauss = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rand());

	return {
		E,
		beta,
		phi: Math.max(0.1, calculateFlowStateTime(E, beta, constants) + noise * gauss),
	};
}

interface Tally {
	cells: number;
	overRatio: number;
	corner: number;
	worstLoss: number;
	worstLossAt: string;
	maxRatio: number;
	/** σ/ϕ̂ at the largest ϕ̂ seen, and ϕ̂ at the largest σ/ϕ̂ seen. The corner
	 *  needs both at once; printing each one's partner shows whether they ever
	 *  approach it together or trade off, which is the whole question. */
	maxPhi: number;
	ratioAtMaxPhi: number;
	phiAtMaxRatio: number;
	/** Every cell that DID land in the corner, so a zero loss is attributable. */
	census: string[];
	/** Cells the 0.35 cap would newly clamp, and what that costs them. */
	clamped: number;
	worstHedgeLoss: number;
	worstHedgeAt: string;
	worstHoursShift: number;
}

const empty = (): Tally => ({
	cells: 0,
	overRatio: 0,
	corner: 0,
	worstLoss: 0,
	worstLossAt: '—',
	maxRatio: 0,
	maxPhi: 0,
	ratioAtMaxPhi: 0,
	phiAtMaxRatio: 0,
	census: [],
	clamped: 0,
	worstHedgeLoss: 0,
	worstHedgeAt: '—',
	worstHoursShift: 0,
});

function record(
	tally: Tally,
	query: Query,
	constants: UserConstants,
	n: number,
	arm: string,
): void {
	tally.cells++;

	if (query.ratio > tally.maxRatio) {
		tally.maxRatio = query.ratio;
		tally.phiAtMaxRatio = query.phiHat;
	}

	if (query.phiHat > tally.maxPhi) {
		tally.maxPhi = query.phiHat;
		tally.ratioAtMaxPhi = query.ratio;
	}

	if (query.ratio > LOSS_RATIO) tally.overRatio++;

	if (query.ratio > LOSS_RATIO && query.phiHat > CLEAN_PHI_CEILING) {
		tally.corner++;

		const loss = truncationLossPercent(query.difficulty, query.enjoyment, constants, query.sigma);

		const { a, p0 } = calculateTaskParams(
			{
				title: 'q',
				difficulty: query.difficulty,
				enjoyment: query.enjoyment,
			},
			constants,
		);

		if (tally.census.length < 12)
			tally.census.push(
				`${arm}, n=${n}: ϕ̂=${query.phiHat.toFixed(2)}h σ/ϕ̂=${query.ratio.toFixed(3)} ` +
					`r=${(p0 / a).toFixed(3)} → loss ${loss.toFixed(4)}%`,
			);

		if (loss > tally.worstLoss) {
			tally.worstLoss = loss;
			tally.worstLossAt = `${arm}, n=${n}, ϕ̂=${query.phiHat.toFixed(2)}h, σ/ϕ̂=${query.ratio.toFixed(3)}`;
		}
	}

	if (query.ratio > LOSS_RATIO) {
		tally.clamped++;

		const { valuePercent, hoursShift } = hedgingDelta(
			query.difficulty,
			query.enjoyment,
			constants,
			query.sigma,
		);

		if (valuePercent > tally.worstHedgeLoss) {
			tally.worstHedgeLoss = valuePercent;
			tally.worstHedgeAt = `${arm}, n=${n}, ϕ̂=${query.phiHat.toFixed(2)}h, σ/ϕ̂=${query.ratio.toFixed(3)}`;
		}

		if (Math.abs(hoursShift) > Math.abs(tally.worstHoursShift)) tally.worstHoursShift = hoursShift;
	}
}

function report(name: string, tally: Tally): void {
	const pct = (x: number) => ((x / Math.max(1, tally.cells)) * 100).toFixed(2);

	console.log(`\n  ${name}`);
	console.log(`    cells                        ${tally.cells}`);

	console.log(
		`    σ/ϕ̂ > ${LOSS_RATIO}                   ${tally.overRatio} (${pct(tally.overRatio)}%)`,
	);

	console.log(
		`    LOSSY CORNER (also ϕ̂ > ${CLEAN_PHI_CEILING}h) ${tally.corner} (${pct(tally.corner)}%)`,
	);

	console.log(
		`    worst truncation loss        ${tally.worstLoss.toFixed(4)}%  [${tally.worstLossAt}]`,
	);

	console.log(
		`    max σ/ϕ̂ seen                 ${tally.maxRatio.toFixed(3)}  (ϕ̂ there: ${tally.phiAtMaxRatio.toFixed(2)}h)`,
	);

	console.log(
		`    max ϕ̂ seen                   ${tally.maxPhi.toFixed(2)}h  (σ/ϕ̂ there: ${tally.ratioAtMaxPhi.toFixed(3)})`,
	);

	if (tally.census.length) {
		console.log(`    corner census (first ${tally.census.length}):`);

		for (const line of tally.census) console.log(`      ${line}`);
	}

	console.log(`    -- cost of dropping the cap to ${LOSS_RATIO} --`);
	console.log(`    cells newly clamped          ${tally.clamped} (${pct(tally.clamped)}%)`);

	console.log(
		`    worst hedging lost           +${tally.worstHedgeLoss.toFixed(3)}% reported value  [${tally.worstHedgeAt}]`,
	);

	console.log(`    largest T* shift             ${tally.worstHoursShift.toFixed(3)}h`);
}

/**
 * Fit one history and record every query cell it produces. Extracted so the
 * arms below stay inside `max-depth` — the sweep is a 4-deep cartesian product
 * and `scripts/**` gets no exemption from that rule.
 */
function sweepHistory(
	tally: Tally,
	logs: FlowObservation[],
	n: number,
	arm: string,
	keep: (query: Query) => boolean = () => true,
): void {
	const { constants, posterior, fitted } = fitUserConstants(logs);

	if (!fitted) return;

	for (const query of queryGrid(constants, posterior))
		if (keep(query)) record(tally, query, constants, n, arm);
}

const LOG_COUNTS = [1, 2, 3, 5, 8, 13, 21, 34];

describe('ϕ-uncertainty cap: is the residual defect reachable by a real fit?', () => {
	it('arm 1 — habit-shaped histories across log counts, coverage and noise', () => {
		const rand = mulberry32(0x5eed01);
		const tally = empty();

		// Coverage: how much of the (difficulty, enjoyment) space the user has
		// ever logged. A user who rates everything the same way is the norm, not
		// the exception, and it is what makes Σ ill-conditioned off that point.
		const coverages: { name: string; pick: (r: () => number) => [number, number] }[] = [
			{
				name: 'single-point',
				pick: () => [5, 5],
			},
			{
				name: 'narrow',
				pick: (r) => [4 + Math.floor(r() * 3), 4 + Math.floor(r() * 3)],
			},
			{
				name: 'spread',
				pick: (r) => [1 + Math.floor(r() * 10), 1 + Math.floor(r() * 10)],
			},
		];

		// Flattened, not nested: same iteration order, two levels instead of four.
		const cells = NOISE_ARMS.flatMap((noise) =>
			coverages.flatMap((coverage) =>
				LOG_COUNTS.map((n) => ({
					noise,
					coverage,
					n,
				})),
			),
		);

		for (let user = 0; user < 120; user++) {
			const truth = drawUser(rand);

			for (const { noise, coverage, n } of cells) {
				const logs = Array.from(
					{
						length: n,
					},
					() => {
						const [difficulty, enjoyment] = coverage.pick(rand);

						return logAt(truth, difficulty, enjoyment, noise, rand);
					},
				);

				sweepHistory(tally, logs, n, coverage.name);
			}
		}

		report('ARM 1 — habit-shaped histories', tally);
	});

	it('arm 2 — extrapolation: log only easy tasks, then plan a hard one', () => {
		const rand = mulberry32(0x5eed02);
		const tally = empty();

		const cells = NOISE_ARMS.flatMap((noise) =>
			LOG_COUNTS.map((n) => ({
				noise,
				n,
			})),
		);

		for (let user = 0; user < 200; user++) {
			const truth = drawUser(rand);

			for (const { noise, n } of cells) {
				// Every log at the easy, enjoyable corner...
				const logs = Array.from(
					{
						length: n,
					},
					() => logAt(truth, 1 + Math.floor(rand() * 2), 9 + Math.floor(rand() * 2), noise, rand),
				);

				// ...and every query at the far corner the user has never logged.
				sweepHistory(
					tally,
					logs,
					n,
					'extrapolated',
					(query) => query.difficulty >= 8 && query.enjoyment <= 3,
				);
			}
		}

		report('ARM 2 — extrapolation to an unlogged corner', tally);
	});

	it('control — the default-constants user, who §5.1 says is safe', () => {
		const rand = mulberry32(0x5eed03);
		const tally = empty();

		for (let user = 0; user < 200; user++) {
			for (const n of LOG_COUNTS) {
				const logs = Array.from(
					{
						length: n,
					},
					() =>
						logAt(
							DEFAULT_USER_CONSTANTS,
							1 + Math.floor(rand() * 10),
							1 + Math.floor(rand() * 10),
							0.25,
							rand,
						),
				);

				sweepHistory(tally, logs, n, 'default-truth');
			}
		}

		report('CONTROL — truth = DEFAULT_USER_CONSTANTS', tally);

		console.log(
			`\n  (§5.1's claim is that ϕ̂ ≤ ${CLEAN_PHI_CEILING}h keeps this clean. A nonzero LOSSY`,
		);

		console.log('  CORNER here would mean the fit leaves the safe region for a user the');
		console.log('  defaults describe exactly — a strictly stronger finding than arm 1.)');
	});
});
