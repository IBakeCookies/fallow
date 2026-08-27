/**
 * The measurement behind MATH.md's pricing table — the one number in the
 * document that exists specifically to price work nobody has built yet:
 *
 *   "Value lost to a per-task ϕ error of size `s` (400 days, ΣT* = 19.4 h,
 *    mean % below the oracle plan)" — 5 budgets × 5 error sizes, ending
 *   "**Price any future per-task-ϕ proposal against this table before
 *    building it.**"
 *
 * It is also ROADMAP item 6's re-open gate. A wrong cell therefore mis-prices
 * a decision that has not been taken yet, which is the worst kind of stale
 * number to carry. And it is prose: none of the 25 values appears in `src/` or
 * `scripts/`, and the probe that produced them was never committed — the exact
 * failure that already burned this repo.
 *
 * A probe, not a test: the table moves whenever the curve, the lattice or the
 * allocator moves.
 *
 * THE SEAM PROBLEM, AND WHY THIS DOES NOT NEED THE SEAM. MATH.md says
 * "Per-task ϕ and σ_ϕ were injected into the real allocator". No such injection
 * point exists on `main` — ϕ is `c₁E + c₂β + c₃` from ONE shared
 * `UserConstants`, mapped over every task by `buildTaskParams`. So the deleted
 * probe had a seam that is gone, and rebuilding it would mean editing shipped
 * code to measure it.
 *
 * It is not needed. The question is what a WRONG ϕ costs, so:
 *
 *   - the wrong plan is whatever the shipped allocator already returns at the
 *     shipped constants — no injection, the real code path;
 *   - truth is ϕ_true,i = ϕ_i + s·ξᵢ, ξᵢ ∈ {−1, +1}. `a` and `p₀` depend only
 *     on (E, β), so a ϕ offset leaves them untouched and only k = (1−r)/ϕ
 *     moves;
 *   - both plans are scored under ϕ_true.
 *
 * The ORACLE is built here rather than called, because no shipped entry point
 * accepts per-task ϕ. It is the max over funded subsets of greedy on the
 * merged true-ϕ increment menus, at that subset's post-switch-cost block
 * budget — exact for the single budget by Fox (1966) / §4, and now measured to
 * be exact: `allocator-exactness.probe.ts` found 0 gaps in 6400 cases against
 * full enumeration (2026-08-06). Reusing that structure keeps this oracle
 * cheap enough for 400 days × 25 cells.
 *
 * SELF-CHECK, printed first and load-bearing. At s = 0 the oracle must
 * reproduce the shipped allocation's value exactly. If it does not, the two
 * sides are not the same objective and every cell below is noise. A mismatch
 * count above zero invalidates the run.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	BLOCK_HOURS,
	DEFAULT_USER_CONSTANTS,
	averageProductivity,
	calculateTaskAllocations,
	calculateTaskParams,
	findOptimalSingleTaskTime,
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

const DAYS = 400;
const TASKS_PER_DAY = 6;
const BUDGETS = [1, 2, 4, 6, 10];
const ERROR_SIZES = [0.1, 0.2, 0.4, 0.8, 1.6];
const SWITCH_COST = 0.25;
const EPS = 1e-9;
/** ϕ has a hard floor at 0.1h; an offset must not push a task through it. */
const PHI_FLOOR = 0.1;

interface ProbeTask {
	title: string;
	difficulty: number;
	enjoyment: number;
}

interface TrueParams {
	a: number;
	p0: number;
	phi: number;
}

/** The task's true curve once its ϕ is displaced by ±s. */
function displaced(task: ProbeTask, offset: number): TrueParams {
	const { a, p0, phi } = calculateTaskParams(task, DEFAULT_USER_CONSTANTS);

	return {
		a,
		p0,
		phi: Math.max(PHI_FLOOR, phi + offset),
	};
}

function valueAt(params: TrueParams, hours: number): number {
	const k = (1 - params.p0 / params.a) / params.phi;

	return averageProductivity(hours, params.a, params.p0, k);
}

/**
 * The increment menu under the TRUE curve, truncated exactly as
 * `buildBlockIncrements` does: stop at the first non-positive increment, and
 * at the first non-monotone one.
 */
function menuOf(params: TrueParams, maxBlocks: number): number[] {
	const increments: number[] = [];
	let previous = 0;
	let previousDelta = Infinity;

	for (let blocks = 1; blocks <= maxBlocks; blocks++) {
		const value = valueAt(params, blocks * BLOCK_HOURS);
		const delta = value - previous;

		if (delta <= 1e-12 || delta > previousDelta + 1e-12) break;

		increments.push(delta);
		previous = value;
		previousDelta = delta;
	}

	return increments;
}

/**
 * The exact single-budget optimum under the true curves: for every funded
 * subset, greedy on that subset's merged increments at its own post-overhead
 * block budget, and take the best. Exact by §4 (marginal analysis on
 * diminishing increments), and that exactness is itself now measured.
 */
function oracleValue(
	truth: TrueParams[],
	budget: number,
	switchCost: number,
): { value: number; funded: Set<number> } {
	const n = truth.length;
	const maxBlocks = Math.floor(budget / BLOCK_HOURS + EPS);
	const menus = truth.map((params) => menuOf(params, maxBlocks));
	let best = 0;
	let bestFunded = new Set<number>();

	for (let mask = 1; mask < 1 << n; mask++) {
		const members: number[] = [];

		for (let i = 0; i < n; i++) if (mask & (1 << i)) members.push(i);

		const overhead = members.length > 1 ? (members.length - 1) * switchCost : 0;
		const blockBudget = Math.floor((budget - overhead) / BLOCK_HOURS + EPS);

		if (blockBudget <= 0) continue;

		// Greedy: the top `blockBudget` increments of the merged menus. Valid as
		// per-task prefixes because each menu is non-increasing. Tagged by owner
		// so the winning plan's funded set can be read back out.
		const pooled = members.flatMap((i) =>
			menus[i].map((delta) => ({
				delta,
				owner: i,
			})),
		);

		pooled.sort((x, y) => y.delta - x.delta);

		let value = 0;
		const funded = new Set<number>();

		for (let i = 0; i < Math.min(blockBudget, pooled.length); i++) {
			value += pooled[i].delta;
			funded.add(pooled[i].owner);
		}

		if (value > best) {
			best = value;
			bestFunded = funded;
		}
	}

	return {
		value: best,
		funded: bestFunded,
	};
}

/** What the shipped plan is worth once the true ϕ is revealed. */
function shippedValueUnderTruth(
	tasks: ProbeTask[],
	truth: TrueParams[],
	budget: number,
	switchCost: number,
): { value: number; funded: Set<number> } {
	const allocations = calculateTaskAllocations(tasks, budget, DEFAULT_USER_CONSTANTS, switchCost);
	const funded = new Set<number>();
	let value = 0;

	allocations.forEach((allocation, i) => {
		if (allocation.allocatedHours > 0) funded.add(i);

		value += valueAt(truth[i], allocation.allocatedHours);
	});

	return {
		value,
		funded,
	};
}

function drawDay(random: () => number): ProbeTask[] {
	return Array.from(
		{
			length: TASKS_PER_DAY,
		},
		(_, index) => ({
			title: `t${index + 1}`,
			difficulty: 1 + Math.floor(random() * 10),
			enjoyment: 1 + Math.floor(random() * 10),
		}),
	);
}

describe('What a per-task ϕ error costs', () => {
	it('self-check: at s = 0 the oracle reproduces the shipped allocation', () => {
		const random = mulberry32(0x91700c);
		let checked = 0;
		let mismatches = 0;
		let worst = 0;

		for (let day = 0; day < 200; day++) {
			const tasks = drawDay(random);
			const truth = tasks.map((task) => displaced(task, 0));

			for (const budget of BUDGETS) {
				const oracle = oracleValue(truth, budget, SWITCH_COST);
				const shipped = shippedValueUnderTruth(tasks, truth, budget, SWITCH_COST);
				const difference = Math.abs(oracle.value - shipped.value);

				checked++;

				if (difference > 1e-9) mismatches++;

				worst = Math.max(worst, difference);
			}
		}

		console.log(
			`[self-check] ${checked} (day, budget) pairs at s = 0: ${mismatches} mismatches, ` +
				`worst |oracle − shipped| = ${worst.toExponential(3)}`,
		);

		console.log(
			mismatches === 0
				? '[self-check] VALID — the oracle and the shipped allocator agree exactly with no error injected'
				: '[self-check] INVALID — the table below is not measuring what it claims',
		);
	});

	it('the pricing table: mean % below the oracle plan', () => {
		const random = mulberry32(0x91700d);

		const days = Array.from(
			{
				length: DAYS,
			},
			() => drawDay(random),
		);

		const signs = days.map(() =>
			Array.from(
				{
					length: TASKS_PER_DAY,
				},
				() => (random() < 0.5 ? -1 : 1),
			),
		);

		const sumOptimal =
			days.reduce(
				(total, tasks) =>
					total +
					tasks.reduce((s, task) => s + findOptimalSingleTaskTime(task, DEFAULT_USER_CONSTANTS), 0),
				0,
			) / DAYS;

		console.log(
			`[table] ${DAYS} days × ${TASKS_PER_DAY} tasks, mean ΣT* = ${sumOptimal.toFixed(1)}h ` +
				`(MATH.md's grid says 19.4h), switchCost ${SWITCH_COST}h`,
		);

		console.log(`[table] budget | ${ERROR_SIZES.map((s) => `s=${s}h`.padStart(7)).join(' | ')}`);

		for (const budget of BUDGETS) {
			const cells = ERROR_SIZES.map((size) => {
				let lossTotal = 0;
				let fundedSetChanges = 0;

				days.forEach((tasks, index) => {
					const truth = tasks.map((task, i) => displaced(task, signs[index][i] * size));
					const oracle = oracleValue(truth, budget, SWITCH_COST);
					const shipped = shippedValueUnderTruth(tasks, truth, budget, SWITCH_COST);

					if (oracle.value > 0) lossTotal += ((oracle.value - shipped.value) / oracle.value) * 100;

					// The first-order channel MATH.md says drives the U-shape: does the
					// wrong ϕ change WHICH tasks get funded, not just for how long?
					const sameSet =
						oracle.funded.size === shipped.funded.size &&
						[...oracle.funded].every((i) => shipped.funded.has(i));

					if (!sameSet) fundedSetChanges++;
				});

				return {
					loss: lossTotal / DAYS,
					fundedSetChanges,
				};
			});

			console.log(
				`[table] ${`${budget} h`.padStart(6)} | ${cells
					.map((cell) => cell.loss.toFixed(2).padStart(7))
					.join(' | ')}`,
			);

			console.log(
				`[funded] ${`${budget} h`.padStart(6)} | ${cells
					.map((cell) => `${((100 * cell.fundedSetChanges) / DAYS).toFixed(0)}%`.padStart(7))
					.join(' | ')}`,
			);
		}
	});
});
