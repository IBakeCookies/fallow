/**
 * What still reaches `GAIN_PERCENT_CAP`, and can a real fit get a user there?
 *
 * MATH.md is the sole surviving justification for the cap. It states a
 * 999% ladder (4.25 / 8.5 / 13 / 17.25 h at n = 1–4, never within 24 h at
 * n = 6, 569% and 41.6% at the defaults) that no committed probe reaches, and
 * it asserts the user who triggers it — "a fast-flow user logging 15–30m
 * everywhere" — exists without ever fitting one. Two separate claims, and only
 * the second decides whether the cap guards anything real.
 *
 * Arms:
 *   1  the ladder at ϕ̂ held on the 0.1h floor, σ = 0, over the app's own budget
 *      slider (0.25–24h, 0.25h steps) — plus the n = 5 rung MATH.md skips, and
 *      the ϕ̂ = 0.17h control. Tasks at difficulty 5, enjoyment 5 — NOT "the
 *      default sliders": the form's 5/5/5 draft maps through
 *      `getEffectiveDifficulty`'s 0.3 spillover to an effective difficulty of
 *      6.5. Difficulty 5 is reachable (one dimension at 0), and it is the cell
 *      that reproduces the ladder MATH.md first quoted
 *   2  the same sweep at the σ_ϕ a fit actually produces. MATH.md says "fitted"
 *      and never says σ; at ϕ̂ = 0.1h a non-zero σ_ϕ can fire §5.1's
 *      monotone-prefix cut and truncate the optimizer's menu, so the ladder is
 *      σ-dependent and the silence is itself the defect
 *   3  the same sweep at DEFAULT_USER_CONSTANTS, single-budget and pooled
 *   4  reachability: can `fitUserConstants` put a user on the ϕ floor from logs
 *      a person could produce, with `fitted` true?
 *   5  is the `naive = 0, optimized > 0` arm of `gainPercentOf` dead code?
 *
 * A probe, not a test: it answers "what is true of the model over a large input
 * space" and prints numbers, where a test answers "does this still hold" and is
 * binary. What it finds is pinned by one fixture in the suite, never by the
 * sweep itself.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
 *
 * Usage: npm run probe -- gain-cap-trigger
 */

import { describe, it } from 'vitest';
import {
	BLOCK_HOURS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
	GAIN_PERCENT_CAP,
	calculateFlowStateTime,
	calculateTaskParams,
	fitUserConstants,
	phiParameterStd,
	pooledProductivityGain,
	productivityGain,
	type FitPosterior,
	type FlowObservation,
	type PooledTaskInput,
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

/** Both module-private in `zenith.ts` (`:164`, `:422`); read here, never set. */
const PHI_FLOOR_HOURS = 0.1;
const PHI_UNCERTAINTY_RELATIVE_CAP = 0.5;

/** The app's own budget slider: 0.25–24h in 0.25h steps. */
const BUDGETS = Array.from(
	{
		length: 96,
	},
	(_, i) => (i + 1) * 0.25,
);

const TASK_COUNTS = [1, 2, 3, 4, 5, 6];

/** ϕ = c₁E + c₂β + c₃ ≤ 0 everywhere, so `calculateFlowStateTime`'s clamp is
 *  active on every task — "ϕ̂ held at the 0.1h floor" in MATH.md's sense. */
const FLOOR_CONSTANTS: UserConstants = {
	c1: 0,
	c2: 0,
	c3: 0,
};

const NEAR_FLOOR_CONSTANTS: UserConstants = {
	c1: 0,
	c2: 0,
	c3: 0.17,
};

function tasksAt(n: number, difficulty: number, enjoyment: number) {
	return Array.from(
		{
			length: n,
		},
		(_, i) => ({
			title: `t${i}`,
			difficulty,
			enjoyment,
		}),
	);
}

/**
 * The first budget on the lattice where the single-budget gain saturates, and
 * the largest gain seen anywhere on it.
 */
function ladderRung(
	tasks: { title: string; difficulty: number; enjoyment: number }[],
	constants: UserConstants,
	posterior?: FitPosterior,
	switchCost: number = DEFAULT_SWITCH_COST,
): { firstCap: number; max: number } {
	let firstCap = 0;
	let max = 0;

	for (const budget of BUDGETS) {
		const { gainPercent } = productivityGain(tasks, budget, constants, switchCost, posterior);

		if (gainPercent > max) max = gainPercent;

		if (firstCap === 0 && gainPercent >= GAIN_PERCENT_CAP) firstCap = budget;
	}

	return {
		firstCap,
		max,
	};
}

function rungLabel(firstCap: number): string {
	return firstCap > 0 ? `${firstCap}h` : 'never within 24h';
}

/**
 * What the σ arm did to one rung. `firstCap` is 0 for "never caps", so a bare
 * difference reads 0 for two arms that both have no rung — no movement and no
 * rung are not the same reading, and only one of them is evidence.
 */
function rungShift(dry: number, wet: number): string {
	if (dry === 0 && wet === 0) return 'no rung in either arm';

	if (dry === 0 || wet === 0) {
		return `rung appears/disappears: σ=0 ${rungLabel(dry)}, σ=fit ${rungLabel(wet)}`;
	}

	return `σ arm moves the rung by ${(wet - dry) / 0.25} budget steps`;
}

function reportLadder(label: string, constants: UserConstants, posterior?: FitPosterior): void {
	for (const n of TASK_COUNTS) {
		const { firstCap, max } = ladderRung(tasksAt(n, 5, 5), constants, posterior);

		console.log(
			`    ${label} n = ${n}: first 999% at ${rungLabel(firstCap)}, max over the sweep ${max}%`,
		);
	}
}

describe('GAIN_PERCENT_CAP: what reaches it, and can a fit get there?', () => {
	it('arm 1 — the 999% ladder at ϕ̂ on the 0.1h floor, σ = 0', () => {
		console.log('[1] single-budget, default sliders, ϕ̂ = 0.1h (floor clamp active), σ = 0');
		reportLadder('ϕ̂ = 0.1h', FLOOR_CONSTANTS);

		const control = ladderRung(tasksAt(1, 5, 5), NEAR_FLOOR_CONSTANTS);

		console.log(
			`    ϕ̂ = 0.17h n = 1: first 999% at ${rungLabel(control.firstCap)}, max over the sweep ${control.max}%`,
		);
	});

	it('arm 2 — the same ladder at the σ_ϕ the fit actually produces', () => {
		const rand = mulberry32(0x9a1c02);

		// MATH.md's own words as a history: every log 15–30m, spread over the
		// slider grid the user has touched.
		const logs: FlowObservation[] = Array.from(
			{
				length: 40,
			},
			() => {
				const { E, beta } = calculateTaskParams({
					title: 'l',
					difficulty: 1 + Math.floor(rand() * 10),
					enjoyment: 1 + Math.floor(rand() * 10),
				});

				return {
					E,
					beta,
					phi: 0.25 + rand() * 0.25,
				};
			},
		);

		const { constants, fitted, posterior } = fitUserConstants(logs);

		const { E, beta } = calculateTaskParams(
			{
				title: 'q',
				difficulty: 5,
				enjoyment: 5,
			},
			constants,
		);

		const phiHat = calculateFlowStateTime(E, beta, constants);
		const sigma = phiParameterStd(E, beta, posterior);

		console.log(
			`[2] 40 logs at 15–30m: fitted = ${fitted}, ϕ̂ = ${phiHat.toFixed(4)}h, σ_ϕ = ${sigma.toFixed(4)}h, ` +
				`σ/ϕ̂ = ${(sigma / phiHat).toFixed(3)} (cap ${PHI_UNCERTAINTY_RELATIVE_CAP})`,
		);

		reportLadder('σ = 0    ', constants);
		reportLadder('σ = fit  ', constants, posterior);

		// The paragraph this backs is about ϕ̂ = 0.1h, not about this fit's own
		// ϕ̂ = 0.36h: §5.1's monotone-prefix cut is what σ > 0 can fire, and the
		// floor is where it has the least room. σ_ϕ reads off (E, β) and the
		// posterior, not off the constants, so the floor ladder takes this
		// history's σ unchanged.
		console.log('    the ladder itself (ϕ̂ = 0.1h) under the same posterior:');
		reportLadder('floor σ=0', FLOOR_CONSTANTS);
		reportLadder('floor σ=f', FLOOR_CONSTANTS, posterior);

		for (const label of ['fitted ϕ̂ = 0.36h', 'floor ϕ̂ = 0.1h']) {
			const base = label.startsWith('floor') ? FLOOR_CONSTANTS : constants;

			for (const n of TASK_COUNTS) {
				const tasks = tasksAt(n, 5, 5);
				const dry = ladderRung(tasks, base).firstCap;
				const wet = ladderRung(tasks, base, posterior).firstCap;

				console.log(`    ${label} n = ${n}: ${rungShift(dry, wet)}`);
			}
		}
	});

	it('arm 3 — at default constants the cap is out of reach', () => {
		console.log('[3] DEFAULT_USER_CONSTANTS, same sweep');
		reportLadder('default', DEFAULT_USER_CONSTANTS);

		let pooledMax = 0;
		let pooledAt = '';

		for (const n of TASK_COUNTS) {
			const tasks: PooledTaskInput[] = tasksAt(n, 5, 5).map((task) => ({
				...task,
				cognitiveWeight: 0.5,
				physicalWeight: 0.5,
			}));

			for (const budget of BUDGETS) {
				const { gainPercent } = pooledProductivityGain(tasks, budget);

				if (gainPercent > pooledMax) {
					pooledMax = gainPercent;
					pooledAt = `n = ${n}, ${budget}h`;
				}
			}
		}

		console.log(`    pooled path max ${pooledMax}%  [${pooledAt}]`);

		// MATH.md quoted 569% here. The readings that could have produced it, so the
		// "does not reproduce" is a measurement and not an assertion: the whole
		// slider grid rather than one cell, the n = 0 prior posterior, and a zero
		// switch cost.
		let gridMax = 0;
		let gridAt = '';

		for (const [difficulty, enjoyment] of SLIDER_GRID) {
			const { max } = ladderRung(tasksAt(1, difficulty, enjoyment), DEFAULT_USER_CONSTANTS);

			if (max > gridMax) {
				gridMax = max;
				gridAt = `d=${difficulty} β=${enjoyment}`;
			}
		}

		const oneTask = tasksAt(1, 5, 5);

		console.log(`    n = 1 max over the whole slider grid: ${gridMax}%  [${gridAt}]`);

		console.log(
			`    n = 1 at the prior posterior: ${ladderRung(oneTask, DEFAULT_USER_CONSTANTS, fitUserConstants([]).posterior).max}%`,
		);

		console.log(
			`    n = 1 at zero switch cost: ${ladderRung(oneTask, DEFAULT_USER_CONSTANTS, undefined, 0).max}%`,
		);
	});

	it('arm 4 — can a real ⚡ history put a fitted user on the ϕ floor?', () => {
		const rand = mulberry32(0x9a1c04);
		const tally = emptyFloorTally();

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

		for (let user = 0; user < 200; user++) {
			const truth = drawFastUser(rand);

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

				recordFit(tally, logs, `${coverage.name} n=${n} σ=${noise}`);
			}
		}

		reportFloorTally(tally);
	});

	it('arm 5 — is the `naive = 0, optimized > 0` arm dead code?', () => {
		let hits = 0;
		let witness = '';
		let days = 0;

		for (const n of TASK_COUNTS) {
			for (const budget of BUDGETS) {
				days++;

				const { naive, optimized } = productivityGain(tasksAt(n, 5, 5), budget, FLOOR_CONSTANTS);

				if (naive > 0 || optimized <= 0) continue;

				hits++;
				witness ||= `ladder sweep: n = ${n}, budget ${budget}h, optimized ${optimized.toFixed(4)}`;
			}
		}

		console.log(`[5] ladder sweep: ${hits}/${days} days with naive = 0 and optimized > 0`);

		const random = countNaiveZero(mulberry32(0x9a1c05), randomDay);
		const starved = countNaiveZero(mulberry32(0x9a1c06), starvedDay);

		console.log(`    rv14 random days:  ${random.hits}/${random.days}  ${random.witness}`);
		console.log(`    rv14 starved days: ${starved.hits}/${starved.days}  ${starved.witness}`);
		console.log(`    ladder witness: ${witness || 'none'}`);
	});
});

/**
 * A synthetic FAST-flow user — MATH.md's "logging 15–30m everywhere".
 * `phi-cap-reachability.probe.ts`'s `drawUser` ranges INVERTED: that probe
 * draws toward ϕ > 3.06h because §5.1's corner is there, and a generator that
 * cannot produce a sub-0.1h truth would answer this section's question for it.
 */
function drawFastUser(rand: () => number): UserConstants {
	return {
		c1: 0.02 + rand() * 0.1,
		c2: -0.2 + rand() * 0.18,
		c3: 0.1 + rand() * 0.25,
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

const LOG_COUNTS = [1, 2, 3, 5, 8, 13, 21, 34];
const NOISE_ARMS = [0, 0.05, 0.15];

const SLIDER_GRID = Array.from(
	{
		length: 10,
	},
	(_, d) =>
		Array.from(
			{
				length: 10,
			},
			(_, e) => [d + 1, e + 1] as [number, number],
		),
).flat();

interface FloorTally {
	histories: number;
	fallbacks: number;
	floorHistories: number;
	floorCells: number;
	cells: number;
	minPhiOffFloor: number;
	minPhiAt: string;
	floorWitness: string;
	capCells: number;
	capWitness: string;
}

function emptyFloorTally(): FloorTally {
	return {
		histories: 0,
		fallbacks: 0,
		floorHistories: 0,
		floorCells: 0,
		cells: 0,
		minPhiOffFloor: Infinity,
		minPhiAt: '',
		floorWitness: '',
		capCells: 0,
		capWitness: '',
	};
}

/**
 * Fit one history and scan the whole 1–10 × 1–10 slider grid for a ϕ̂ on the
 * floor. Extracted so the arm above stays inside `max-depth` — the sweep is a
 * 4-deep cartesian product and `scripts/**` gets no exemption from that rule.
 */
function recordFit(tally: FloorTally, logs: FlowObservation[], arm: string): void {
	const { constants, fitted, posterior } = fitUserConstants(logs);

	tally.histories++;

	// A fit that fell back to the defaults is not a fitted user, and MATH.md's
	// claim is about a fitted one.
	if (!fitted) {
		tally.fallbacks++;

		return;
	}

	let onFloor = false;

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

		tally.cells++;

		if (phi <= PHI_FLOOR_HOURS + 1e-12) {
			onFloor = true;
			recordFloorCell(tally, arm, difficulty, enjoyment, constants, posterior);
		} else if (phi < tally.minPhiOffFloor) {
			tally.minPhiOffFloor = phi;
			tally.minPhiAt = `${arm} d=${difficulty} β=${enjoyment}`;
		}
	}

	if (onFloor) tally.floorHistories++;
}

/**
 * Arm 1's ladder is a statement about a GRID of constants; the gate needs it
 * on a FITTED user's own slider cell, where `a` and p₀ are that cell's, not the
 * default sliders'. Checked at the sweep's top budget first because the cap is
 * reached from below, so 24h not clearing it settles the cell in one call.
 */
function recordFloorCell(
	tally: FloorTally,
	arm: string,
	difficulty: number,
	enjoyment: number,
	constants: UserConstants,
	posterior: FitPosterior,
): void {
	tally.floorCells++;

	const tasks = tasksAt(1, difficulty, enjoyment);
	const { E, beta } = calculateTaskParams(tasks[0], constants);

	tally.floorWitness ||= `${arm} d=${difficulty} β=${enjoyment} σ_ϕ=${phiParameterStd(E, beta, posterior).toFixed(4)}h`;

	const top = productivityGain(tasks, 24, constants, DEFAULT_SWITCH_COST, posterior).gainPercent;

	if (top < GAIN_PERCENT_CAP) return;

	tally.capCells++;

	const rung = rungLabel(ladderRung(tasks, constants, posterior).firstCap);

	tally.capWitness ||= `${arm} d=${difficulty} β=${enjoyment} → n = 1 first 999% at ${rung}`;
}

function reportFloorTally(tally: FloorTally): void {
	const fittedHistories = tally.histories - tally.fallbacks;
	const share = (100 * tally.floorHistories) / Math.max(1, fittedHistories);

	console.log(
		`[4] ${tally.histories} synthetic histories, ${tally.fallbacks} fell back to the defaults ` +
			`(not fitted users)`,
	);

	console.log(
		`    fitted histories reaching the ϕ floor somewhere on the grid: ${tally.floorHistories}/${fittedHistories} (${share.toFixed(1)}%)`,
	);

	console.log(`    grid cells on the floor: ${tally.floorCells}/${tally.cells}`);
	console.log(`    floor witness: ${tally.floorWitness || 'none — no fitted history reached it'}`);

	console.log(
		`    floored cells whose n = 1 gain reaches 999% within 24h: ${tally.capCells}/${tally.floorCells}`,
	);

	console.log(`    cap witness: ${tally.capWitness || 'none — the ladder is not fit-reachable'}`);

	// As an excess over the floor: at 6 dp the smallest off-floor ϕ̂ prints as
	// 0.100000h and cannot be told from the floor it is contrasted against.
	console.log(
		`    smallest ϕ̂ off the floor: floor + ${(tally.minPhiOffFloor - PHI_FLOOR_HOURS).toExponential(3)}h  [${tally.minPhiAt}]`,
	);
}

interface Day {
	tasks: PooledTaskInput[];
	budget: number;
	pools?: { cognitiveHours: number; physicalHours: number };
}

/** rv14's day generator, and its pool-starved corner. */
function randomDay(rnd: () => number): Day {
	const n = 2 + Math.floor(rnd() * 7);

	const tasks: PooledTaskInput[] = Array.from(
		{
			length: n,
		},
		(_, i) => {
			const mental = 1 + Math.floor(rnd() * 10);
			const physical = 1 + Math.floor(rnd() * 10);

			return {
				title: `t${i}`,
				difficulty: Math.min(10, Math.max(mental, physical) + 0.3 * Math.min(mental, physical)),
				enjoyment: 1 + Math.floor(rnd() * 10),
				cognitiveWeight: mental / 10,
				physicalWeight: physical / 10,
			};
		},
	);

	return {
		tasks,
		budget: 0.5 + Math.floor(rnd() * 32) * 0.25,
	};
}

function starvedDay(rnd: () => number): Day {
	const n = 2 + Math.floor(rnd() * 9);

	const tasks: PooledTaskInput[] = Array.from(
		{
			length: n,
		},
		(_, i) => ({
			title: `t${i}`,
			difficulty: 1 + Math.floor(rnd() * 10),
			enjoyment: 1 + Math.floor(rnd() * 10),
			cognitiveWeight: 0.5 + Math.round(rnd() * 5) / 10,
			physicalWeight: Math.round(rnd() * 4) / 10,
		}),
	);

	return {
		tasks,
		budget: (1 + Math.floor(rnd() * 40)) * BLOCK_HOURS,
		pools: {
			cognitiveHours: Math.round(rnd() * 6) / 2,
			physicalHours: Math.round(rnd() * 8) / 2,
		},
	};
}

function countNaiveZero(
	rnd: () => number,
	generate: (r: () => number) => Day,
): { days: number; hits: number; witness: string } {
	let hits = 0;
	let witness = '';

	for (let day = 0; day < 3000; day++) {
		const { tasks, budget, pools } = generate(rnd);
		const { naive, optimized } = pooledProductivityGain(tasks, budget, pools);

		if (naive > 0 || optimized <= 0) continue;

		hits++;
		witness ||= `witness: n = ${tasks.length}, budget ${budget}h, optimized ${optimized.toFixed(4)}`;
	}

	return {
		days: 3000,
		hits,
		witness: witness || '(no witness)',
	};
}
