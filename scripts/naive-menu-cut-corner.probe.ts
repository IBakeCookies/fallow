/**
 * The σ_ϕ corner: the negative-gain witness, and whether the menu cut behind
 * it is reachable from the product.
 *
 * MATH.md records one place the "gain ≥ 0 on the single-budget path" guarantee
 * weakens: `buildBlockIncrements` cuts a task's menu at the first non-DECREASING
 * increment when σ_ϕ > 0 (§5.1), and that cut can fire while E[P̄] is still
 * rising — leaving the naive baseline free to place a value-adding block the
 * optimizer was never offered. It quotes a constructed witness (optimized
 * 0.886678 against naive 0.891116, −0.5%) and files it as harmless because the
 * corner is "not reachable from the product": 0 cuts in 156,000 integer-slider
 * cells against 8,806 of 919,968 quarter-step ones, all at ϕ̂ ≥ 4h with
 * σ/ϕ ≥ 0.35. None of those numbers had a probe, and the grid behind the two
 * counts is not recoverable from the text, so this states its own.
 *
 * Not an arm of `rv14-naive-switch-bill.probe.ts`: that generator is σ_ϕ = 0 by
 * construction (no posterior), so it cannot see any of this, and its docblock
 * promises a different draw.
 *
 * Arms:
 *   1  the witness cell itself — reproduced, or the smallest gain it reaches
 *   2  how often the non-decreasing cut fires, by slider regime, and how often
 *      it also COSTS value (a cut at or past the menu's own best block count
 *      forfeits nothing and is not a weakened guarantee)
 *   3  reachability of the corner by a FITTED posterior: σ_ϕ/ϕ̂ ≥ 0.35 at
 *      ϕ̂ ≥ 4h. §5.1 already swept the same corner one threshold lower (ϕ̂ > 3.06h,
 *      0 of 576,000 fitted cells — `phi-cap-reachability.probe.ts`); this asks it
 *      at ϕ̂ ≥ 4h and is the weaker of the two by cell count, so read it as a
 *      confirmation and §5.1's as the bound
 *
 * A probe, not a test: it answers "what is true of the model over a large input
 * space" and prints numbers. What it finds is pinned by one fixture in the
 * suite, never by the sweep itself.
 *
 * Usage: npm run probe -- naive-menu-cut-corner
 */

import { describe, it } from 'vitest';
import {
	BLOCK_HOURS,
	DEFAULT_SWITCH_COST,
	calculateFlowStateTime,
	calculateTaskParams,
	expectedAverageProductivity,
	expectedOptimalTime,
	fitUserConstants,
	phiParameterStd,
	productivityGain,
	type FitPosterior,
	type FlowObservation,
	type UserConstants,
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

/**
 * Read from `zenith.ts`, never set: the ϕ floor (`:164`), the σ-cap §5.1 owns
 * (which is where the σ/ϕ axis below stops), and the outermost of the five
 * Gauss–Hermite abscissae `phiQuadratureNodes` uses — all module-private. The
 * menu's span is T*(ϕ_max), so reproducing `buildBlockIncrements`' cut needs the
 * largest node and nothing else of the quadrature.
 *
 * Then the corner MATH.md calls unreachable, and the ϕ̂ its witness sits at.
 */
const PHI_FLOOR_HOURS = 0.1;
const PHI_UNCERTAINTY_RELATIVE_CAP = 0.5;
const GH_MAX_ABSCISSA = 2.0201828704560856;
const CORNER_RATIO = 0.35;
const CORNER_PHI_HOURS = 4;
const WITNESS_PHI_HOURS = 4.5;

/**
 * A posterior whose σ_ϕ is exactly `sigmaPhi` at every (E, β): `phiParameterStd`
 * is √(xᵀΣx) with x = [E, β, 1], so a covariance carrying only the [2][2] entry
 * answers with √Σ₂₂ whatever the sliders are (`gain-cap-trigger.probe.ts:86-97`
 * hand-builds constants the same way).
 */
function fixedSigmaPosterior(sigmaPhi: number): FitPosterior {
	return {
		covariance: [
			[0, 0, 0],
			[0, 0, 0],
			[0, 0, sigmaPhi * sigmaPhi],
		],
		sigma2: sigmaPhi * sigmaPhi,
	};
}

/** ϕ = c₁E + c₂β + c₃ with c₁ = c₂ = 0 puts every task's ϕ̂ at c₃ exactly. */
const flatConstants = (phi: number): UserConstants => ({
	c1: 0,
	c2: 0,
	c3: phi,
});

interface Menu {
	/** Which of `buildBlockIncrements`' two rules ended the menu, if either. */
	cut: 'none' | 'non-positive' | 'non-decreasing';
	/** Blocks the cut menu offers greedy. */
	blocks: number;
	/** Block count maximizing E[P̄] over the same span — what the cut may forfeit. */
	bestBlocks: number;
}

/**
 * `buildBlockIncrements` replicated over a menu it is not asked for: same span
 * (T*(ϕ_max), +1 block), same 1e-12 tolerances, same two break conditions — so
 * no number here is a float artifact of a re-derivation. It reports WHICH rule
 * fired, which the shipped function has no reason to.
 *
 * `sigmaPhi` must already be inside the σ-cap, which is where `RATIO_AXIS` stops:
 * the shipped span clamps σ before taking ϕ_max and this does not, so the two
 * would part company above the cap.
 */
function menuAt(a: number, p0: number, phi: number, sigmaPhi: number): Menu {
	const phiMax = Math.max(PHI_FLOOR_HOURS, phi + Math.SQRT2 * sigmaPhi * GH_MAX_ABSCISSA);
	const span = Math.ceil(expectedOptimalTime(a, p0, phiMax, 0) / BLOCK_HOURS) + 1;

	const values = Array.from(
		{
			length: span + 1,
		},
		(_, j) => expectedAverageProductivity(j * BLOCK_HOURS, a, p0, phi, sigmaPhi),
	);

	let cut: Menu['cut'] = 'none';
	let blocks = span;
	let prevDelta = Infinity;

	for (let j = 1; j <= span; j++) {
		const delta = values[j] - values[j - 1];

		if (delta <= 1e-12) {
			cut = 'non-positive';
			blocks = j - 1;
			break;
		}

		if (delta > prevDelta + 1e-12) {
			cut = 'non-decreasing';
			blocks = j - 1;
			break;
		}

		prevDelta = delta;
	}

	let bestBlocks = 0;

	for (let j = 1; j <= span; j++) if (values[j] > values[bestBlocks]) bestBlocks = j;

	return {
		cut,
		blocks,
		bestBlocks,
	};
}

describe('The σ_ϕ menu cut and its negative-gain corner', () => {
	it('arm 1 — the constructed witness: one task, ϕ̂ = 4.5h, σ/ϕ̂ = 0.35, 4h budget', () => {
		// The witness cell. Effective difficulty 1.3 is what the two integer sliders at
		// 1 produce (`getEffectiveDifficulty`'s 0.3 spillover), so the cell is
		// UI-reachable on the difficulty axis; the document does not say which enjoyment it
		// used, so the whole integer row is swept and the worst cell reported.
		const difficulty = getEffectiveDifficulty({
			mentalDifficulty: 1,
			physicalDifficulty: 1,
		});

		const phi = WITNESS_PHI_HOURS;
		const constants = flatConstants(phi);
		const posterior = fixedSigmaPosterior(CORNER_RATIO * phi);
		let worst = Infinity;
		let worstAt = '';

		for (let enjoyment = 1; enjoyment <= 10; enjoyment++) {
			const tasks = [
				{
					title: 't0',
					difficulty,
					enjoyment,
				},
			];

			const { optimized, naive, gainPercent } = productivityGain(
				tasks,
				4,
				constants,
				DEFAULT_SWITCH_COST,
				posterior,
			);

			const { a, p0 } = calculateTaskParams(tasks[0], constants);
			const menu = menuAt(a, p0, phi, CORNER_RATIO * phi);

			console.log(
				`[1] difficulty ${difficulty} enjoyment ${enjoyment}: optimized ${optimized.toFixed(6)} ` +
					`vs naive ${naive.toFixed(6)} → ${gainPercent.toFixed(1)}%; menu cut ${menu.cut} ` +
					`at ${menu.blocks} blocks (best ${menu.bestBlocks})`,
			);

			if (gainPercent < worst) {
				worst = gainPercent;
				worstAt = `enjoyment ${enjoyment}`;
			}
		}

		console.log(`[1] smallest gain over the row: ${worst.toFixed(1)}% at ${worstAt}`);
	});

	it('arm 2 — how often the non-decreasing cut fires, by slider regime', () => {
		for (const regime of REGIMES) {
			const tally = emptyCutTally();

			for (const difficulty of difficultyAxis(regime.sliderStep))
				for (const enjoyment of sliderAxis(regime.sliderStep))
					sweepSliderCell(tally, difficulty, enjoyment, regime);

			reportCutTally(tally, regime);
			reportWitnessCell(regime);
		}
	});

	it('arm 3 — can a fitted posterior reach σ/ϕ̂ ≥ 0.35 at ϕ̂ ≥ 4h?', () => {
		const rand = mulberry32(0x5eed19);

		for (const logs of LOG_COUNTS) {
			const tally = emptyFitTally();

			for (const arm of FIT_ARMS)
				for (let history = 0; history < HISTORIES_PER_ARM; history++)
					recordHistory(tally, drawHistory(rand, logs, arm), arm.name);

			reportFitTally(tally, logs);
		}
	});
});

interface Regime {
	name: string;
	sliderStep: number;
	phiCeilingHours: number;
	phiStepHours: number;
}

/**
 * The two regimes the document contrasts. Its own grid is not recoverable from
 * the text — it gives the slider granularity and a ϕ bound, but neither the σ
 * axis nor the step counts, and 919,968 = 1369 × 672 is a factorization rather
 * than evidence — so these axes are this probe's, stated here and quoted with
 * the counts.
 *
 * ϕ is an axis and not a slider consequence: the sliders set (a, p₀) and ϕ comes
 * from the fitted plane, which is a property of the USER. Reading it any other
 * way would need a constants triple per cell and would measure the fit — which
 * is arm 3, separately and on purpose.
 */
const REGIMES: Regime[] = [
	{
		name: 'integer sliders, ϕ ≤ 6h',
		sliderStep: 1,
		phiCeilingHours: 6,
		phiStepHours: 0.25,
	},
	{
		name: 'quarter-step sliders, ϕ ≤ 8h',
		sliderStep: 0.25,
		phiCeilingHours: 8,
		phiStepHours: 0.5,
	},
];

/** σ/ϕ from 0 to the cap in 0.05 steps — past the cap the model clamps. */
const RATIO_AXIS = Array.from(
	{
		length: 11,
	},
	(_, i) => (i * PHI_UNCERTAINTY_RELATIVE_CAP) / 10,
);

const sliderAxis = (step: number): number[] =>
	Array.from(
		{
			length: Math.round(9 / step) + 1,
		},
		(_, i) => 1 + i * step,
	);

/**
 * The difficulty axis is what the TWO difficulty sliders reach through
 * `getEffectiveDifficulty`, not 1–10: the form has a mental and a physical one
 * and blends them, which is how effective difficulty 1.3 — the witness cell — is
 * integer-reachable at all.
 */
const difficultyAxis = (step: number): number[] => {
	const sliders = sliderAxis(step);

	const all = sliders.flatMap((mentalDifficulty) =>
		sliders
			.filter((physicalDifficulty) => physicalDifficulty <= mentalDifficulty)
			.map((physicalDifficulty) =>
				getEffectiveDifficulty({
					mentalDifficulty,
					physicalDifficulty,
				}),
			),
	);

	return [...new Set(all)].sort((x, y) => x - y);
};

interface CutTally {
	cells: number;
	monotoneCuts: number;
	costlyCuts: number;
	phiLo: number;
	phiHi: number;
	ratioLo: number;
	ratioHi: number;
	worstLossPercent: number;
	witness: string;
}

function emptyCutTally(): CutTally {
	return {
		cells: 0,
		monotoneCuts: 0,
		costlyCuts: 0,
		phiLo: Infinity,
		phiHi: 0,
		ratioLo: Infinity,
		ratioHi: 0,
		worstLossPercent: 0,
		witness: '',
	};
}

/**
 * One slider cell over the whole (ϕ × σ/ϕ) grid. Extracted so the arm stays
 * inside `max-depth` — the sweep is a 4-deep cartesian product and `scripts/**`
 * gets no exemption from that rule.
 */
function sweepSliderCell(
	tally: CutTally,
	difficulty: number,
	enjoyment: number,
	regime: Regime,
): void {
	const { a, p0 } = calculateTaskParams(
		{
			title: 'q',
			difficulty,
			enjoyment,
		},
		// ϕ is the axis below, so only (a, p₀) is read here — both are functions of
		// (E, β) alone and never of the constants.
		flatConstants(1),
	);

	for (
		let phi = regime.phiStepHours;
		phi <= regime.phiCeilingHours + 1e-9;
		phi += regime.phiStepHours
	)
		for (const ratio of RATIO_AXIS)
			recordCell(tally, a, p0, phi, ratio, `d=${difficulty} β=${enjoyment}`);
}

function recordCell(
	tally: CutTally,
	a: number,
	p0: number,
	phi: number,
	ratio: number,
	cell: string,
): void {
	tally.cells++;

	const menu = menuAt(a, p0, phi, ratio * phi);

	if (menu.cut !== 'non-decreasing') return;

	tally.monotoneCuts++;
	tally.phiLo = Math.min(tally.phiLo, phi);
	tally.phiHi = Math.max(tally.phiHi, phi);
	tally.ratioLo = Math.min(tally.ratioLo, ratio);
	tally.ratioHi = Math.max(tally.ratioHi, ratio);

	// A cut at or past the menu's own best block count forfeits nothing: greedy
	// was never going to fund those blocks. Only a cut STRICTLY before it is the
	// weakened guarantee.
	if (menu.blocks >= menu.bestBlocks) return;

	tally.costlyCuts++;

	const cost = valueLossPercent(a, p0, phi, ratio * phi, menu);

	tally.worstLossPercent = Math.max(tally.worstLossPercent, cost);
	tally.witness ||= `${cell} ϕ=${phi.toFixed(2)}h σ/ϕ=${ratio.toFixed(2)} cut at ${menu.blocks} of ${menu.bestBlocks} blocks`;
}

function valueLossPercent(
	a: number,
	p0: number,
	phi: number,
	sigmaPhi: number,
	menu: Menu,
): number {
	const best = expectedAverageProductivity(menu.bestBlocks * BLOCK_HOURS, a, p0, phi, sigmaPhi);
	const cut = expectedAverageProductivity(menu.blocks * BLOCK_HOURS, a, p0, phi, sigmaPhi);

	return best > 0 ? ((best - cut) / best) * 100 : 0;
}

function reportCutTally(tally: CutTally, regime: Regime): void {
	console.log(
		`[2] ${regime.name}: ${tally.monotoneCuts} of ${tally.cells} cells cut by the NON-DECREASING rule ` +
			`(${difficultyAxis(regime.sliderStep).length} difficulties × ${sliderAxis(regime.sliderStep).length} enjoyments × ` +
			`ϕ ${regime.phiStepHours}–${regime.phiCeilingHours}h step ${regime.phiStepHours} × ${RATIO_AXIS.length} σ/ϕ steps to ${PHI_UNCERTAINTY_RELATIVE_CAP})`,
	);

	if (tally.monotoneCuts === 0) return;

	const first = tally.witness ? ` — first: ${tally.witness}` : '';

	console.log(
		`[2] ${regime.name}: cut cells occupy ϕ ${tally.phiLo.toFixed(2)}–${tally.phiHi.toFixed(2)}h, ` +
			`σ/ϕ ${tally.ratioLo.toFixed(2)}–${tally.ratioHi.toFixed(2)}`,
	);

	console.log(
		`[2] ${regime.name}: ${tally.costlyCuts} of those fire STRICTLY BEFORE the menu's best block count ` +
			`(worst ${tally.worstLossPercent.toFixed(2)}% of the cell's best value)` +
			`${first}`,
	);
}

/**
 * The tension the whole finding turns on: arm 1's witness is a cell, and a
 * regime that reports zero cuts while containing that cell is refuted by it.
 */
function reportWitnessCell(regime: Regime): void {
	const difficulty = getEffectiveDifficulty({
		mentalDifficulty: 1,
		physicalDifficulty: 1,
	});

	const onAxes =
		difficultyAxis(regime.sliderStep).includes(difficulty) &&
		WITNESS_PHI_HOURS <= regime.phiCeilingHours &&
		Math.abs(WITNESS_PHI_HOURS % regime.phiStepHours) < 1e-9;

	const { a, p0 } = calculateTaskParams(
		{
			title: 'w',
			difficulty,
			enjoyment: 1,
		},
		flatConstants(1),
	);

	const menu = menuAt(a, p0, WITNESS_PHI_HOURS, CORNER_RATIO * WITNESS_PHI_HOURS);

	console.log(
		`[2] ${regime.name}: arm 1's witness (d=${difficulty}, ϕ=${WITNESS_PHI_HOURS}h, σ/ϕ=${CORNER_RATIO}) is ` +
			`${onAxes ? 'ON this regime’s axes' : 'off this regime’s axes'} and its menu is cut ${menu.cut} ` +
			`at ${menu.blocks} of ${menu.bestBlocks} blocks`,
	);
}

const LOG_COUNTS = [1, 2, 3, 5, 8, 13, 21, 34];
const HISTORIES_PER_ARM = 60;

/**
 * Coverage — how much of the (difficulty, enjoyment) space the user has ever
 * logged — crossed with stopwatch noise. Coverage is the axis that matters here
 * and `phi-cap-reachability.probe.ts` explains why: a user who rates everything
 * the same way is the norm, and it is what leaves Σ ill-conditioned off that
 * point, which is where a large σ_ϕ comes from at all.
 */
const FIT_ARMS = [
	{
		name: 'single-point',
		pick: () => [5, 5] as [number, number],
	},
	{
		name: 'narrow',
		pick: (r: () => number) =>
			[4 + Math.floor(r() * 3), 4 + Math.floor(r() * 3)] as [number, number],
	},
	{
		name: 'spread',
		pick: (r: () => number) =>
			[1 + Math.floor(r() * 10), 1 + Math.floor(r() * 10)] as [number, number],
	},
].flatMap((coverage) =>
	// σ_log 0.25 and 0.5 h are `phi-cap-reachability.probe.ts`'s own arms, and a
	// noisier history is what leaves σ_ϕ large — a lower-noise sweep would report
	// a bound weaker than the one §5.1 already has on record.
	[0.05, 0.25, 0.5].map((noise) => ({
		name: `${coverage.name}/σ=${noise}`,
		pick: coverage.pick,
		noise,
	})),
);

/** Every integer slider pair the form can produce, as a query grid. */
const SLIDER_GRID = sliderAxis(1).flatMap((difficulty) =>
	sliderAxis(1).map((enjoyment) => [difficulty, enjoyment] as [number, number]),
);

/**
 * A synthetic SLOW user — `phi-cap-reachability.probe.ts`'s `drawUser` ranges,
 * which draw ϕ(5,1) out to ~8h. The corner needs ϕ̂ ≥ 4h, so a generator that
 * cannot produce slow users would answer this arm's question for it.
 */
function drawUser(rand: () => number): UserConstants {
	return {
		c1: 0.3 + rand() * 1.1,
		c2: -0.5 + rand() * 0.45,
		c3: 0.2 + rand() * 1.0,
	};
}

function drawHistory(
	rand: () => number,
	logs: number,
	arm: (typeof FIT_ARMS)[number],
): FlowObservation[] {
	const constants = drawUser(rand);

	return Array.from(
		{
			length: logs,
		},
		() => {
			const [difficulty, enjoyment] = arm.pick(rand);

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
				phi: Math.max(
					PHI_FLOOR_HOURS,
					calculateFlowStateTime(E, beta, constants) + arm.noise * gauss,
				),
			};
		},
	);
}

interface FitTally {
	histories: number;
	fallbacks: number;
	overRatio: number;
	inCorner: number;
	maxRatio: number;
	maxRatioAtCornerPhi: number;
	/** Which arm produced that largest ratio at ϕ̂ ≥ 4h — the bound's own witness. */
	maxRatioAt: string;
	witness: string;
}

function emptyFitTally(): FitTally {
	return {
		histories: 0,
		fallbacks: 0,
		overRatio: 0,
		inCorner: 0,
		maxRatio: 0,
		maxRatioAtCornerPhi: 0,
		maxRatioAt: '',
		witness: '',
	};
}

/**
 * Fit one history and scan every UI-reachable slider cell it can be queried at.
 * Extracted so the arm stays inside `max-depth`.
 */
function recordHistory(tally: FitTally, logs: FlowObservation[], arm: string): void {
	const { constants, fitted, posterior } = fitUserConstants(logs);

	tally.histories++;

	// A fit that fell back to the defaults is not a fitted user, and the corner
	// is a claim about one.
	if (!fitted) {
		tally.fallbacks++;

		return;
	}

	let over = false;
	let corner = false;

	for (const [difficulty, enjoyment] of SLIDER_GRID) {
		const { E, beta } = calculateTaskParams(
			{
				title: 'q',
				difficulty,
				enjoyment,
			},
			constants,
		);

		const phi = calculateFlowStateTime(E, beta, constants);
		const ratio = phiParameterStd(E, beta, posterior) / phi;

		tally.maxRatio = Math.max(tally.maxRatio, ratio);

		if (ratio >= CORNER_RATIO) over = true;

		if (phi < CORNER_PHI_HOURS) continue;

		if (ratio > tally.maxRatioAtCornerPhi) {
			tally.maxRatioAtCornerPhi = ratio;
			tally.maxRatioAt = `${arm} d=${difficulty} β=${enjoyment} ϕ̂=${phi.toFixed(2)}h`;
		}

		if (ratio < CORNER_RATIO) continue;

		corner = true;
		tally.witness ||= `${arm} d=${difficulty} β=${enjoyment} ϕ̂=${phi.toFixed(2)}h σ/ϕ̂=${ratio.toFixed(3)}`;
	}

	if (over) tally.overRatio++;

	if (corner) tally.inCorner++;
}

function reportFitTally(tally: FitTally, logs: number): void {
	const fitted = tally.histories - tally.fallbacks;
	const first = tally.witness ? ` — first in the corner: ${tally.witness}` : '';

	console.log(
		`[3] ${logs} log(s): ${fitted} of ${tally.histories} histories fitted; ` +
			`${tally.overRatio} reach σ/ϕ̂ ≥ ${CORNER_RATIO} somewhere, ${tally.inCorner} reach it at ϕ̂ ≥ ${CORNER_PHI_HOURS}h ` +
			`(largest σ/ϕ̂ ${tally.maxRatio.toFixed(3)} anywhere, ${tally.maxRatioAtCornerPhi.toFixed(3)} at ϕ̂ ≥ ${CORNER_PHI_HOURS}h ` +
			`[${tally.maxRatioAt || 'no cell reaches that ϕ̂'}])${first}`,
	);
}
