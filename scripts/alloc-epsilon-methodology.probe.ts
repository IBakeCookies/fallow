/**
 * The measurement behind MATH.md §4's closing methodological note: charging the
 * reference's feasibility in HOURS instead of in BLOCKS manufactures
 * "non-exactness" that is really a disagreement about which plans are
 * ADMISSIBLE.
 *
 * §4 quotes that lesson as "98/2400 non-exact, worst 49.72%", from the first cut
 * of `allocator-exactness.probe.ts` — a file that was then fixed, so those two
 * numbers cannot be re-run from anything committed. This probe re-measures the
 * same phenomenon with today's model and prints numbers that can:
 *
 *   - REFERENCE B (block rule) mirrors `budgetBlocksFor` (zenith.ts:951):
 *     ⌊(budget − overhead)/BLOCK_HOURS + 1e-9⌋ blocks. This is the reference
 *     `allocator-exactness.probe.ts` uses, and the allocator must match it
 *     exactly — asserted here, because that is an invariant, not a number.
 *   - REFERENCE H (hour rule) admits any vector with
 *     used·BLOCK_HOURS + overhead ≤ budget + 1e-9. Its epsilon is 1e-9 of an
 *     HOUR against the allocator's 1e-9 of a BLOCK (2.5e-10 h) — four times
 *     wider — so on a budget sitting a hair below a lattice point it admits one
 *     block the allocator is not allowed to place.
 *
 * The two counters printed for reference H are what make the note checkable: how
 * many of its "mismatches" carry an optimum the allocator could not place at all
 * (inadmissible under the block rule), and how many sit in the lattice±ε budget
 * family. A note that says "none of them was a suboptimality" is only true if
 * those two account for all of them.
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';
import {
	BLOCK_HOURS,
	DEFAULT_USER_CONSTANTS,
	calculateTaskAllocations,
	calculateTotalProductivity,
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

/** The allocator's own feasibility slack, in BLOCKS (`bestPlanWithSwitchCost`). */
const BLOCK_EPS = 1e-9;
/** The first cut's slack, in HOURS — the whole subject of the note. */
const HOUR_EPS = 1e-9;
const EXACTNESS_TOLERANCE = 1e-9;
const SWITCH_COSTS = [0, 0.1, 0.2, 0.25, 0.33, 0.5, 1.0];

/** ϕ collapses onto the 0.1h floor on easy tasks; large k, coarse blocks. */
const FAST_FLOW_CONSTANTS: UserConstants = {
	c1: 0.18,
	c2: -0.42,
	c3: 0.05,
};

const CONSTANT_SETS: UserConstants[] = [DEFAULT_USER_CONSTANTS, FAST_FLOW_CONSTANTS];
/** Only the lattice families matter here — the artifact IS a lattice artifact. */
const FAMILIES = ['lattice', 'lattice±ε', 'off-lattice'];
const CASES_PER_CELL = 400;

interface ProbeCase {
	tasks: Array<{ title: string; difficulty: number; enjoyment: number }>;
	budget: number;
	switchCost: number;
	constants: UserConstants;
	family: string;
}

function drawBudget(random: () => number, family: string): number {
	const blocks = 2 + Math.floor(random() * 19); // 0.5h … 5.0h

	if (family === 'lattice') return blocks * BLOCK_HOURS;

	if (family === 'lattice±ε') return blocks * BLOCK_HOURS + (random() < 0.5 ? -1e-9 : 1e-9);

	return 0.5 + random() * 4.5;
}

function casesFor(seed: number): ProbeCase[] {
	const random = mulberry32(seed);
	const cases: ProbeCase[] = [];

	for (const family of FAMILIES) {
		for (const constants of CONSTANT_SETS) {
			for (let index = 0; index < CASES_PER_CELL; index++) {
				const count = 2 + Math.floor(random() * 3); // 2 … 4 tasks

				cases.push({
					tasks: Array.from(
						{
							length: count,
						},
						(_, task) => ({
							title: `t${task + 1}`,
							difficulty: 1 + Math.floor(random() * 10),
							enjoyment: 1 + Math.floor(random() * 10),
						}),
					),
					budget: drawBudget(random, family),
					switchCost: SWITCH_COSTS[Math.floor(random() * SWITCH_COSTS.length)],
					constants,
					family,
				});
			}
		}
	}

	return cases;
}

/**
 * value[i][b]: the objective's contribution of giving task i exactly b blocks.
 * The objective is a sum of independent per-task terms, so a one-task call to
 * `calculateTotalProductivity` IS the i-th term — the real model function, not a
 * re-implementation of it.
 */
function valueTable(probeCase: ProbeCase, maxBlocks: number): number[][] {
	return probeCase.tasks.map((task) =>
		Array.from(
			{
				length: maxBlocks + 1,
			},
			(_, blocks) =>
				calculateTotalProductivity([task], [blocks * BLOCK_HOURS], probeCase.constants),
		),
	);
}

interface Best {
	value: number;
	blocks: number[];
}

/**
 * Exhaustive maximum over every block vector the given rule admits. `admits`
 * takes the funded count and the block total, which is all either rule needs.
 */
function bruteForce(
	probeCase: ProbeCase,
	table: number[][],
	maxBlocks: number,
	admits: (funded: number, used: number) => boolean,
): Best {
	const n = probeCase.tasks.length;
	const current = new Array<number>(n).fill(0);

	const best: Best = {
		value: 0,
		blocks: [...current],
	};

	const descend = (position: number, used: number, funded: number, value: number): void => {
		if (position === n) {
			if (admits(funded, used) && value > best.value) {
				best.value = value;
				best.blocks = [...current];
			}

			return;
		}

		for (let blocks = 0; used + blocks <= maxBlocks; blocks++) {
			current[position] = blocks;

			descend(
				position + 1,
				used + blocks,
				funded + (blocks > 0 ? 1 : 0),
				value + table[position][blocks],
			);
		}

		current[position] = 0;
	};

	descend(0, 0, 0, 0);

	return best;
}

const overheadFor = (switchCost: number, funded: number): number =>
	funded > 1 ? (funded - 1) * switchCost : 0;

/** `budgetBlocksFor` (zenith.ts:951) — the allocator's own admissibility rule. */
const blockRuleBlocks = (probeCase: ProbeCase, funded: number): number =>
	Math.floor(
		(probeCase.budget - overheadFor(probeCase.switchCost, funded)) / BLOCK_HOURS + BLOCK_EPS,
	);

interface Tally {
	nonExact: number;
	worstGap: number;
	inadmissible: number;
	atLatticeEpsilon: number;
	worstCase: string;
}

function emptyTally(): Tally {
	return {
		nonExact: 0,
		worstGap: 0,
		inadmissible: 0,
		atLatticeEpsilon: 0,
		worstCase: '—',
	};
}

function record(tally: Tally, probeCase: ProbeCase, best: Best, achieved: number): void {
	const gap = (best.value - achieved) / best.value;

	if (best.value <= 0 || gap <= EXACTNESS_TOLERANCE) return;

	tally.nonExact++;

	const funded = best.blocks.filter((blocks) => blocks > 0).length;
	const used = best.blocks.reduce((sum, blocks) => sum + blocks, 0);

	if (used > blockRuleBlocks(probeCase, funded)) tally.inadmissible++;

	if (probeCase.family === 'lattice±ε') tally.atLatticeEpsilon++;

	if (gap > tally.worstGap) {
		tally.worstGap = gap;
		tally.worstCase = `n=${probeCase.tasks.length} budget=${probeCase.budget} switch=${probeCase.switchCost} ${probeCase.family}`;
	}
}

describe('MATH.md §4 — the reference epsilon decides admissibility, not the winner', () => {
	it('block rule vs hour rule over the same 2400 cases', () => {
		const cases = casesFor(20260806);
		const block = emptyTally();
		const hour = emptyTally();

		for (const probeCase of cases) {
			const maxBlocks = Math.max(0, blockRuleBlocks(probeCase, 1));

			if (maxBlocks < 1) continue;

			// One block of slack so the hour rule can reach the vector the block
			// rule forbids — without it the two references share a search space and
			// the artifact is invisible by construction.
			const table = valueTable(probeCase, maxBlocks + 1);

			const achieved = calculateTotalProductivity(
				probeCase.tasks,
				calculateTaskAllocations(
					probeCase.tasks,
					probeCase.budget,
					probeCase.constants,
					probeCase.switchCost,
				).map((allocation) => allocation.allocatedHours),
				probeCase.constants,
			);

			record(
				block,
				probeCase,
				bruteForce(
					probeCase,
					table,
					maxBlocks + 1,
					(funded, used) => used <= blockRuleBlocks(probeCase, funded),
				),
				achieved,
			);

			record(
				hour,
				probeCase,
				bruteForce(
					probeCase,
					table,
					maxBlocks + 1,
					(funded, used) =>
						used * BLOCK_HOURS + overheadFor(probeCase.switchCost, funded) <=
						probeCase.budget + HOUR_EPS,
				),
				achieved,
			);
		}

		console.log(
			`[§4 epsilon] ${cases.length} cases (3 budget families × 2 constant sets × ${CASES_PER_CELL}), n ∈ 2–4, switchCost ∈ {${SWITCH_COSTS.join(', ')}}`,
		);

		console.log(
			`[§4 epsilon] BLOCK rule (1e-9 of a block = ${(BLOCK_EPS * BLOCK_HOURS).toExponential(1)} h): non-exact ${block.nonExact}/${cases.length}, worst gap ${(block.worstGap * 100).toFixed(4)}%`,
		);

		console.log(
			`[§4 epsilon] HOUR rule (1e-9 h, 4× wider): non-exact ${hour.nonExact}/${cases.length}, worst gap ${(hour.worstGap * 100).toFixed(4)}% @ ${hour.worstCase}`,
		);

		console.log(
			`[§4 epsilon] HOUR-rule mismatches whose optimum the allocator may not place: ${hour.inadmissible}/${hour.nonExact}; on a lattice±ε budget: ${hour.atLatticeEpsilon}/${hour.nonExact}`,
		);

		// The invariant, not the number: against its own admissibility rule the
		// allocator is exact (MATH.md §4). Everything the hour rule reports is a
		// plan it admits and the allocator may not place.
		expect(block.nonExact).toBe(0);
		expect(hour.inadmissible).toBe(hour.nonExact);
	});
});
