/**
 * The measurement behind MATH.md §4's headline exactness claim: "**for the
 * single-budget problem with switch cost and n ≤ 12, the returned plan attains
 * the true maximum of the objective over all block-quantized plans.**"
 *
 * That sentence quantifies over every task set, budget and switch cost. What
 * backed it was ONE hand-picked case — `zenith.test.ts`'s "is EXACTLY optimal
 * on the block grid": 3 tasks (8/3, 4/9, 6/6), budget 3h, switchCost 0.25,
 * default constants, no posterior. Every OTHER brute-force comparison in the
 * suite is on the POOLED allocator, which is the path §4 does not claim exact.
 * So the strongest claim in the document rested on the smallest sample in it.
 *
 * A probe, not a test: it answers "is the allocator exact over a large input
 * space" and prints counts and gaps. Arm A should print zeros forever — there
 * it doubles as an existence check on a proof. Arm B is the one that prints a
 * number that legitimately moves, and it measures something §4 does not state
 * at all.
 *
 * WHY THESE INPUTS. The exactness argument has three seams a single fixture
 * cannot touch:
 *
 *   1. Lattice epsilons. `budgetBlocksFor` floors with a +1e-9 nudge and the
 *      subset search compares with a ±1e-9 tie band, so budgets sitting
 *      exactly ON a block boundary — and a hair either side of one — are the
 *      natural failure region. The fixture's 3h is on-lattice and never
 *      probes the other two.
 *   2. Switch costs that are not multiples of BLOCK_HOURS. Only 0.25 — itself
 *      exactly one block — is ever tested, which is the one value where the
 *      fixed charge cannot desynchronize the budget from the lattice.
 *   3. σ > 0. With a posterior, §5.1's guard-2 monotone-prefix truncation
 *      REMOVES blocks from the menu, so "attains the true maximum" is not
 *      claimed to hold — and the plan-level size of that loss is nowhere
 *      measured. `phi-uncertainty-cap.probe.ts` measures the per-task menu
 *      forfeiture; this measures what survives budget competition and subset
 *      enumeration, which can absorb it (another task takes the block) or
 *      amplify it (the truncation changes which subset gets funded).
 *
 * ARM A — σ = 0, the claim as written. Brute force enumerates every block
 * vector, charges (funded − 1)·switchCost off the budget exactly as the
 * allocator does, and takes the max. Any gap above 1e-9 falsifies §4 line 346
 * and the printed input tuple localizes which of the three seams did it.
 *
 * ARM B — σ > 0, the claim's unstated exception. Same sweep, same brute force,
 * both sides scored on the mixture objective. Nonzero is EXPECTED; the number
 * is the point.
 *
 * The brute force is credible only if it is really searching a superset of the
 * allocator's space, so it enumerates blocks PAST each task's optimal stopping
 * point (which the allocator's truncated increment menu will not offer) and
 * re-scores from `expectedAverageProductivity` rather than reusing any
 * increment. Arm A returning 0 mismatches is therefore evidence, not a
 * tautology.
 *
 * Two counters printed beside every cell keep it that way, because a zero here
 * has two very different causes and they must not be confused:
 *
 *   - "guard 2 truncates" — did the mechanism arm B exists to measure happen
 *     at all? On the first three runs of this file the answer was NO in every
 *     cell, and the 0.0000% forfeiture beside it meant nothing.
 *   - "optimum past the menu" — did the reference actually reach a plan the
 *     allocator structurally cannot place? Where this is 0, the two searches
 *     agreed on a shared subset and no exactness was tested.
 *
 * A cell with a zero forfeiture and a zero on either counter is an EMPTY
 * measurement, not a clean bill of health. Read them together.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	BLOCK_HOURS,
	DEFAULT_USER_CONSTANTS,
	calculateTaskAllocations,
	calculateTaskParams,
	calculateTotalProductivity,
	expectedAverageProductivity,
	phiParameterStd,
	type FitPosterior,
	type UserConstants,
} from '$lib/business/model/zenith';

function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** The allocator's own feasibility slack (`bestPlanWithSwitchCost`). */
const FEASIBILITY_EPS = 1e-9;
/** Above this, a gap is a real defect rather than float noise. */
const EXACTNESS_TOLERANCE = 1e-9;
/**
 * Switch costs. 0.25 is one whole block — the only value the suite tests, and
 * the only one that cannot slide the budget off the lattice. 0.1/0.2/0.33 are
 * the desynchronizing cases; 1.0 is large enough to make funding a second task
 * a real decision rather than a formality.
 */
const SWITCH_COSTS = [0, 0.1, 0.2, 0.25, 0.33, 0.5, 1.0];
/**
 * σ/ϕ̂ targets for arm B. 0.5 is the shipped `PHI_UNCERTAINTY_RELATIVE_CAP`,
 * so it is the most hedging the allocator will ever do.
 */
const SIGMA_RATIOS = [0.1, 0.3, 0.5];

/**
 * A fast-flow user whose ϕ collapses onto the 0.1h floor on easy tasks —
 * the constants `zenith.test.ts` uses to stress the increment menu. Included
 * so exactness is not only checked where ϕ is comfortably mid-range.
 */
const FAST_FLOW_CONSTANTS: UserConstants = {
	c1: 0.18,
	c2: -0.42,
	c3: 0.05,
};

/**
 * A slow-flow user, ϕ reaching ~8h. Not decoration — arm B is EMPTY without
 * it, and finding that out is most of what this file learned.
 *
 * §5.1's guard 2 (stop the menu at the first non-monotone increment) fires on
 * 0 of 5100 cells when ϕ comes from `DEFAULT_USER_CONSTANTS`, which is why the
 * first two runs of this probe reported a reassuring 0.0000% forfeiture at
 * every σ. Swept over raw (r, ϕ, σ/ϕ) it fires on 3.52% of cells, and over the
 * REACHABLE product — r pinned to the 100 slider pairs, ϕ free — on 0.47%,
 * truncating a 44-block menu to 3 at its worst (r = 0.479, ϕ = 8h, σ/ϕ = 0.35).
 *
 * The reason the two disagree is that r and ϕ come from different places: a
 * and p₀ depend only on (E, β), so the sliders pin r ∈ [0.04, 0.90], while ϕ
 * is `c₁E + c₂β + c₃` and follows the FITTED constants — and a real fit does
 * reach ϕ̂ = 8.04h (`phi-cap-reachability.probe.ts`, 2026-08-06). Holding the
 * default constants therefore holds ϕ short and hides the entire region where
 * the guard has anything to do.
 */
const SLOW_FLOW_CONSTANTS: UserConstants = {
	c1: 1.35,
	c2: -0.45,
	c3: 0.6,
};

/**
 * The constants that actually put guard 2 in play, and the only reason arm B
 * reports anything but zero.
 *
 * Guard 2 needs a LONG ϕ at a slider pair whose amplitude ratio is mid-range:
 * the lowest ϕ at which it fires for any of the 100 slider pairs is 6.25h, and
 * that pair is difficulty 2 / enjoyment 1 (r = 0.479). None of the three sets
 * above reaches it — slow-flow tops out at 6.90h, but at high-difficulty pairs
 * whose r is wrong — so all three print an empty arm B.
 *
 * These are a legitimate fit, not a contrivance: `fitUserConstants` accepts a
 * constants triple unless ϕ is non-finite or exceeds 16h at the corners
 * E ∈ {1, 5}, β ∈ {1, 2}, and the maximum ϕ any ACCEPTED fit can place at a
 * slider pair is exactly 16h. This set puts ϕ(d=2, e=1) at ~6.5h and stays
 * far inside that bound.
 *
 * What it does NOT establish is how often a real user's ridge-anchored fit
 * lands here — the λ = 4 prior pulls ϕ̂ toward 3.06h, exactly the shrinkage
 * `phi-cap-reachability.probe.ts` measured. So read arm B as "what the
 * truncation costs where it bites", not as a population rate.
 */
const LONG_FLOW_CONSTANTS: UserConstants = {
	c1: 0.3,
	c2: -0.2,
	c3: 6.3,
};

interface ProbeTask {
	title: string;
	difficulty: number;
	enjoyment: number;
}

interface ProbeCase {
	tasks: ProbeTask[];
	budget: number;
	switchCost: number;
	constants: UserConstants;
	/** How the budget was placed relative to the 15-minute lattice. */
	family: string;
}

interface Mismatch {
	gap: number;
	achieved: number;
	brute: number;
	probeCase: ProbeCase;
	sigmaRatio: number;
}

/**
 * Isotropic posterior scaled so a REFERENCE task lands near the requested
 * σ/ϕ̂. σ = √(xᵀΣx) with x = [E, β, 1], so Σ = v·I gives σ = √v·‖x‖ — the
 * ratio each task actually gets still varies with its own (E, β, ϕ), which is
 * the point: one covariance, a spread of hedging levels across the plan.
 */
function posteriorForRatio(ratio: number, constants: UserConstants): FitPosterior {
	const reference = calculateTaskParams(
		{
			title: 'ref',
			difficulty: 5,
			enjoyment: 5,
		},
		constants,
	);

	const norm = Math.hypot(reference.E, reference.beta, 1);
	const variance = ((ratio * reference.phi) / norm) ** 2;

	return {
		covariance: [
			[variance, 0, 0],
			[0, variance, 0],
			[0, 0, variance],
		],
		sigma2: variance,
	};
}

/**
 * value[i][b] = the objective's contribution from giving task i exactly b
 * blocks. Precomputed because the enumeration below revisits each (task,
 * blocks) pair thousands of times, and because it is the honest way to score
 * blocks BEYOND the optimal stopping point — the allocator's increment menu
 * stops offering those, and the brute force must not.
 */
function valueTable(
	tasks: ProbeTask[],
	constants: UserConstants,
	maxBlocks: number,
	posterior?: FitPosterior,
): number[][] {
	return tasks.map((task) => {
		const { E, beta, a, p0, phi } = calculateTaskParams(task, constants);
		const sigma = posterior ? phiParameterStd(E, beta, posterior) : 0;

		return Array.from(
			{
				length: maxBlocks + 1,
			},
			(_, blocks) => expectedAverageProductivity(blocks * BLOCK_HOURS, a, p0, phi, sigma),
		);
	});
}

/**
 * How many blocks a plan funding `fundedCount` tasks may place. This MIRRORS
 * `budgetBlocksFor` (zenith.ts:951) on purpose, and the probe is wrong without
 * it.
 *
 * The first cut of this file charged feasibility in HOURS —
 * `used·BLOCK_HOURS + overhead ≤ budget + 1e-9` — and reported 98/2400
 * non-exact, worst 49.72%. Every one of those was a budget sitting within 1e-9
 * of a lattice point, and none was a suboptimality: the allocator's epsilon is
 * 1e-9 of a BLOCK (2.5e-10 h) while that test's was 1e-9 of an HOUR, four
 * times wider, so the two sides simply disagreed about whether a boundary plan
 * was admissible at all. A reference that admits plans the allocator is not
 * allowed to place measures the tie-break convention, not the search.
 *
 * Sharing the rule is not conceding the question. Quantization defines the
 * feasible SET — it is part of "over all block-quantized plans" — whereas the
 * claim is about which member of that set gets picked. The brute force below
 * still searches every member, including the ones the allocator's truncated
 * increment menu can never reach.
 */
function budgetBlocksFor(budget: number, switchCost: number, fundedCount: number): number {
	const overhead = fundedCount > 1 ? (fundedCount - 1) * switchCost : 0;

	return Math.floor((budget - overhead) / BLOCK_HOURS + FEASIBILITY_EPS);
}

interface BruteContext {
	table: number[][];
	subset: number[];
	budgetBlocks: number;
	bestValue: number;
	bestBlocks: number[];
	current: number[];
}

/**
 * Exhaustive descent over the block vectors of ONE funded subset. Every member
 * gets at least one block, so the subset really is the funded set and its
 * overhead is the one already charged. Recursive rather than nested loops so n
 * is a parameter and the body stays inside `max-depth` — `scripts/**` gets no
 * exemption from that rule.
 */
function descend(context: BruteContext, position: number, used: number, value: number): void {
	if (position === context.subset.length) {
		if (value > context.bestValue) {
			context.bestValue = value;
			context.bestBlocks = [...context.current];
		}

		return;
	}

	const task = context.subset[position];
	// Every remaining member still needs its own block.
	const reserved = context.subset.length - position - 1;

	for (let blocks = 1; used + blocks + reserved <= context.budgetBlocks; blocks++) {
		context.current[task] = blocks;
		descend(context, position + 1, used + blocks, value + context.table[task][blocks]);
	}

	context.current[task] = 0;
}

/**
 * The true maximum over every block-quantized plan: each funded subset in
 * turn, at the block budget that subset's switch overhead leaves it.
 */
function bruteForceBest(
	probeCase: ProbeCase,
	posterior?: FitPosterior,
): { value: number; blocks: number[]; beyondMenu: boolean; guard2Binds: boolean } {
	const n = probeCase.tasks.length;
	const maxBlocks = Math.max(0, budgetBlocksFor(probeCase.budget, probeCase.switchCost, 1));
	const table = valueTable(probeCase.tasks, probeCase.constants, maxBlocks, posterior);
	let bestValue = 0;
	let bestBlocks = probeCase.tasks.map(() => 0);

	for (let mask = 1; mask < 1 << n; mask++) {
		const subset: number[] = [];

		for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.push(i);

		const budgetBlocks = budgetBlocksFor(probeCase.budget, probeCase.switchCost, subset.length);

		if (budgetBlocks < subset.length) continue;

		const context: BruteContext = {
			table,
			subset,
			budgetBlocks,
			bestValue,
			bestBlocks,
			current: probeCase.tasks.map(() => 0),
		};

		descend(context, 0, 0, 0);
		bestValue = context.bestValue;
		bestBlocks = context.bestBlocks;
	}

	const menus = table.map(menuLength);

	return {
		value: bestValue,
		blocks: bestBlocks,
		beyondMenu: bestBlocks.some((blocks, i) => blocks > menus[i].monotone),
		// Does §5.1's guard 2 cut in ahead of the optimal-stopping point at all?
		// If not, arm B has nothing to measure and must say so rather than print
		// a reassuring zero.
		guard2Binds: menus.some((menu) => menu.monotone < menu.positive),
	};
}

/**
 * Budget families. The first three exist because the lattice epsilons are the
 * whole reason to sweep budgets at all: ON a block boundary, a hair either
 * side of one, and nowhere near one.
 *
 * `generous` exists because the first run without it printed 0.0000% on every
 * arm-B cell — vacuously. At 0.5–5 h across 2–5 tasks no task ever gets near
 * its own stopping point, so the increment menu's truncation never binds and
 * the arm was measuring nothing. Tasks only reach T* ≈ 1.7ϕ (~5 h at default
 * constants) when the budget is long and the plan is narrow, which is why this
 * family pairs 6–14 h with n ≤ 3 — also what keeps the exhaustive enumeration
 * finite at 56 blocks.
 */
const FAMILIES: Array<{ label: string; maxTasks: number }> = [
	{
		label: 'lattice',
		maxTasks: 5,
	},
	{
		label: 'lattice±ε',
		maxTasks: 5,
	},
	{
		label: 'off-lattice',
		maxTasks: 5,
	},
	{
		label: 'generous',
		maxTasks: 3,
	},
];

function drawBudget(random: () => number, family: string): number {
	if (family === 'generous') return 6 + Math.floor(random() * 33) * BLOCK_HOURS; // 6h … 14h

	const blocks = 2 + Math.floor(random() * 19); // 0.5h … 5.0h

	if (family === 'lattice') return blocks * BLOCK_HOURS;

	if (family === 'lattice±ε') return blocks * BLOCK_HOURS + (random() < 0.5 ? -1e-9 : 1e-9);

	return 0.5 + random() * 4.5;
}

function drawCase(
	random: () => number,
	family: { label: string; maxTasks: number },
	constants: UserConstants,
): ProbeCase {
	const count = 2 + Math.floor(random() * (family.maxTasks - 1));

	return {
		tasks: Array.from(
			{
				length: count,
			},
			(_, index) => ({
				title: `t${index + 1}`,
				// Integer sliders: what the app can actually produce. difficulty 1 is
				// included deliberately — that is where AMPLITUDE_RATIO_CAP binds.
				difficulty: 1 + Math.floor(random() * 10),
				enjoyment: 1 + Math.floor(random() * 10),
			}),
		),
		budget: drawBudget(random, family.label),
		switchCost: SWITCH_COSTS[Math.floor(random() * SWITCH_COSTS.length)],
		constants,
		family: family.label,
	};
}

/**
 * How many blocks the allocator's menu can offer task `i`, read off the same
 * value table the brute force scores with: the longest prefix of increments
 * that stays positive AND non-increasing. That is `buildBlockIncrements`'s
 * truncation — guard 1 (optimal stopping) and §5.1's guard 2 (monotone
 * prefix), which under σ > 0 can cut in EARLIER than the peak.
 *
 * Reimplemented here rather than imported because the point is to bound the
 * allocator's reachable set from outside it: if the brute-force optimum ever
 * hands a task more blocks than this, the allocator structurally could not
 * have found that plan, and any gap is attributable to truncation rather than
 * to the search.
 */
function menuLength(values: number[]): { monotone: number; positive: number } {
	let previous = Infinity;
	let monotone = -1;
	let positive = values.length - 1;

	for (let blocks = 1; blocks < values.length; blocks++) {
		const increment = values[blocks] - values[blocks - 1];

		if (increment <= 0) {
			positive = blocks - 1;
			break;
		}

		if (monotone < 0 && increment > previous + FEASIBILITY_EPS) monotone = blocks - 1;

		previous = increment;
	}

	return {
		// Where guard 2 stops the menu; -1 means it never fired, so the menu runs
		// to the optimal-stopping point and only guard 1 is doing any work.
		monotone: monotone < 0 ? positive : monotone,
		positive,
	};
}

const CONSTANT_SETS: Array<{ label: string; constants: UserConstants }> = [
	{
		label: 'default',
		constants: DEFAULT_USER_CONSTANTS,
	},
	{
		label: 'fast-flow',
		constants: FAST_FLOW_CONSTANTS,
	},
	{
		label: 'slow-flow',
		constants: SLOW_FLOW_CONSTANTS,
	},
	{
		label: 'long-flow',
		constants: LONG_FLOW_CONSTANTS,
	},
];

/** The ϕ span each constant set actually reaches, so the sweep's coverage is on the record. */
function phiSpan(constants: UserConstants): string {
	const phis: number[] = [];

	for (let difficulty = 1; difficulty <= 10; difficulty++)
		for (let enjoyment = 1; enjoyment <= 10; enjoyment++)
			phis.push(
				calculateTaskParams(
					{
						title: 'q',
						difficulty,
						enjoyment,
					},
					constants,
				).phi,
			);

	return `${Math.min(...phis).toFixed(2)}–${Math.max(...phis).toFixed(2)}h`;
}

function casesFor(seed: number, perCell: number): ProbeCase[] {
	const random = mulberry32(seed);

	const cells = FAMILIES.flatMap((family) =>
		CONSTANT_SETS.map((set) => ({
			family,
			constants: set.constants,
		})),
	);

	return cells.flatMap((cell) =>
		Array.from(
			{
				length: perCell,
			},
			() => drawCase(random, cell.family, cell.constants),
		),
	);
}

/** Per-family tallies, so a mismatch is attributable to the seam that caused it. */
function byFamily(cases: ProbeCase[], hit: boolean[]): string {
	return FAMILIES.map((family) => {
		const indices = cases.map((_, i) => i).filter((i) => cases[i].family === family.label);
		const count = indices.filter((i) => hit[i]).length;

		return `${family.label} ${count}/${indices.length}`;
	}).join(', ');
}

function fmt(value: number): string {
	return value.toFixed(4);
}

function pct(value: number): string {
	return `${(value * 100).toFixed(4)}%`;
}

function describeCase(probeCase: ProbeCase): string {
	const sliders = probeCase.tasks.map((t) => `${t.difficulty}/${t.enjoyment}`).join(' ');

	return (
		`n=${probeCase.tasks.length} [${sliders}] budget=${probeCase.budget} ` +
		`switch=${probeCase.switchCost} ${probeCase.family}`
	);
}

describe('MATH.md §4 — the single-budget allocator is exact on the block lattice', () => {
	it('arm A: σ = 0, the claim exactly as §4 states it', () => {
		const cases = casesFor(0xa11c01, 400);
		const nonExact: boolean[] = [];
		const truncationBound: boolean[] = [];
		const guard2: boolean[] = [];
		let worst: Mismatch | null = null;

		for (const probeCase of cases) {
			const brute = bruteForceBest(probeCase);

			const allocations = calculateTaskAllocations(
				probeCase.tasks,
				probeCase.budget,
				probeCase.constants,
				probeCase.switchCost,
			);

			const achieved = calculateTotalProductivity(
				probeCase.tasks,
				allocations.map((a) => a.allocatedHours),
				probeCase.constants,
			);

			const gap = brute.value > 0 ? (brute.value - achieved) / brute.value : 0;

			nonExact.push(gap > EXACTNESS_TOLERANCE);
			truncationBound.push(brute.beyondMenu);
			guard2.push(brute.guard2Binds);

			if (gap > EXACTNESS_TOLERANCE && (!worst || gap > worst.gap))
				worst = {
					gap,
					achieved,
					brute: brute.value,
					probeCase,
					sigmaRatio: 0,
				};
		}

		console.log(
			`[§4 arm A] ${cases.length} cases (${FAMILIES.length} budget families × ` +
				`${CONSTANT_SETS.length} constant sets × 400), switchCost ∈ {${SWITCH_COSTS.join(', ')}}`,
		);

		console.log(
			`[§4 arm A] ϕ reached: ${CONSTANT_SETS.map((s) => `${s.label} ${phiSpan(s.constants)}`).join(', ')}`,
		);

		console.log(
			`[§4 arm A] non-exact ${nonExact.filter(Boolean).length}/${cases.length} — ` +
				`by family: ${byFamily(cases, nonExact)}`,
		);

		// Non-vacuity: the reference must be searching plans the allocator cannot
		// reach, or "0 mismatches" only says the two agreed on a shared subset.
		console.log(
			`[§4 arm A] cases whose optimum lies past the increment menu ` +
				`(reference strictly wider than the allocator): ${byFamily(cases, truncationBound)}`,
		);

		console.log(`[§4 arm A] cases where §5.1 guard 2 truncates: ${byFamily(cases, guard2)}`);

		console.log(
			worst
				? `[§4 arm A] worst gap ${pct(worst.gap)} — achieved ${fmt(worst.achieved)} ` +
						`vs brute ${fmt(worst.brute)} @ ${describeCase(worst.probeCase)}`
				: '[§4 arm A] worst gap 0.0000% — no case separated the two',
		);
	});

	it('arm B: σ > 0, the plan-level cost of §5.1 monotone-prefix truncation', () => {
		const cases = casesFor(0xa11c02, 250);

		console.log(`[§4 arm B] ${cases.length} cases per σ/ϕ̂ level, same generator as arm A`);

		for (const ratio of SIGMA_RATIOS) {
			const nonExact: boolean[] = [];
			const truncationBound: boolean[] = [];
			const guard2: boolean[] = [];
			let totalGap = 0;
			let worst: Mismatch | null = null;

			for (const probeCase of cases) {
				const posterior = posteriorForRatio(ratio, probeCase.constants);
				const brute = bruteForceBest(probeCase, posterior);

				const allocations = calculateTaskAllocations(
					probeCase.tasks,
					probeCase.budget,
					probeCase.constants,
					probeCase.switchCost,
					posterior,
				);

				const achieved = calculateTotalProductivity(
					probeCase.tasks,
					allocations.map((a) => a.allocatedHours),
					probeCase.constants,
					posterior,
				);

				const gap = brute.value > 0 ? (brute.value - achieved) / brute.value : 0;

				totalGap += Math.max(0, gap);
				nonExact.push(gap > EXACTNESS_TOLERANCE);
				truncationBound.push(brute.beyondMenu);
				guard2.push(brute.guard2Binds);

				if (gap > EXACTNESS_TOLERANCE && (!worst || gap > worst.gap))
					worst = {
						gap,
						achieved,
						brute: brute.value,
						probeCase,
						sigmaRatio: ratio,
					};
			}

			console.log(
				`[§4 arm B] σ/ϕ̂ ≈ ${ratio}: non-exact ${nonExact.filter(Boolean).length}/${cases.length}, ` +
					`mean forfeit ${pct(totalGap / cases.length)}, worst ${pct(worst?.gap ?? 0)}${
						worst ? ` @ ${describeCase(worst.probeCase)}` : ''
					}`,
			);

			console.log(
				`[§4 arm B] σ/ϕ̂ ≈ ${ratio}: optimum past the menu — ${byFamily(cases, truncationBound)}`,
			);

			console.log(`[§4 arm B] σ/ϕ̂ ≈ ${ratio}: guard 2 truncates — ${byFamily(cases, guard2)}`);
		}
	});
});
