/**
 * Why Primary Bottleneck stopped reading E/β, and what the binding-pool draw
 * reads instead.
 *
 * The retired formula's defect is a claim about a RANKING over the whole slider
 * domain — "the biggest drag on your list" — so it can only be shown by sweeping
 * that domain and comparing the ranking against the model's own task value,
 * P̄(T*). A fixture cannot say that; it can only pin one pair once the sweep has
 * found it, which is what `calculation.test.ts` does.
 *
 * A probe, not a test: these numbers move legitimately whenever the curve, the
 * mappings or `AMPLITUDE_RATIO_CAP` move, and in the suite that is a red build
 * carrying no regression. Runs on demand (`npm run probe`), never in `npm test`.
 *
 * Deterministic: an exhaustive 10×10 integer slider grid plus seeded days — no
 * randomness that a re-run can reroll.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports. An undated number in that document is unfalsifiable.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateBottleneckTask,
	calculateHumanCapacity,
	calculateSuggestedTasks,
} from '$lib/business/model/metric/calculation';
import {
	averageProductivity,
	calculateTaskParams,
	optimalStoppingX,
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_USER_CONSTANTS,
} from '$lib/business/model/zenith';
import type { Task } from '$lib/data/type';

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

interface Cell {
	/** User sliders, 1–10. */
	Eu: number;
	betaU: number;
	/** Mapped (MATH.md §1). */
	E: number;
	beta: number;
	/** The effective p₀ the curve integrates — capped, so not always β/E. */
	p0: number;
	phi: number;
	/** The retired reading. */
	ratio: number;
	/** The model's own task value, and the priority the app ranks by. */
	value: number;
}

function cell(Eu: number, betaU: number): Cell {
	const { E, beta, a, p0, k, phi } = calculateTaskParams(
		{
			difficulty: Eu,
			enjoyment: betaU,
		},
		DEFAULT_USER_CONSTANTS,
	);

	return {
		Eu,
		betaU,
		E,
		beta,
		p0,
		phi,
		ratio: E / beta,
		value: averageProductivity(optimalStoppingX(p0 / a) / k, a, p0, k),
	};
}

const grid: Cell[] = [];
for (let Eu = 1; Eu <= 10; Eu++)
	for (let betaU = 1; betaU <= 10; betaU++) grid.push(cell(Eu, betaU));

const PAIRS = grid.length * (grid.length - 1);
const f = (n: number, digits = 3) => n.toFixed(digits);

/** Rank correlation of E/β against another reading of the same grid. */
function spearmanAgainstRatio(key: (c: Cell) => number): number {
	const rank = (k: (c: Cell) => number) => {
		const positions = new Map<Cell, number>();
		[...grid].sort((x, y) => k(x) - k(y)).forEach((c, i) => positions.set(c, i));

		return positions;
	};

	const byRatio = rank((c) => c.ratio);
	const byKey = rank(key);
	const n = grid.length;
	let d2 = 0;
	for (const c of grid) d2 += (byRatio.get(c)! - byKey.get(c)!) ** 2;

	return 1 - (6 * d2) / (n * (n * n - 1));
}

describe('the retired E/β reading', () => {
	it('ranks against P̄(T*), the value the app itself prioritizes by', () => {
		console.log('\nworst 5 by E/β — what the row used to name:');
		for (const c of [...grid].sort((x, y) => y.ratio - x.ratio).slice(0, 5))
			console.log(
				`  difficulty ${c.Eu} enjoyment ${c.betaU}: E/β ${f(c.ratio)}, P̄(T*) ${f(c.value)}`,
			);

		console.log('worst 5 by P̄(T*) — what the priority list ranks last:');
		for (const c of [...grid].sort((x, y) => x.value - y.value).slice(0, 5))
			console.log(
				`  difficulty ${c.Eu} enjoyment ${c.betaU}: E/β ${f(c.ratio)}, P̄(T*) ${f(c.value)}`,
			);

		let inverted = 0;
		let worst: { named: Cell; over: Cell; gap: number } | null = null;

		for (const named of grid)
			for (const over of grid) {
				if (named === over || named.ratio <= over.ratio || named.value <= over.value) continue;

				inverted++;
				const gap = named.value - over.value;

				if (worst === null || gap > worst.gap)
					worst = {
						named,
						over,
						gap,
					};
			}

		console.log(
			`\nSpearman(E/β, −P̄(T*)) = ${f(
				spearmanAgainstRatio((c) => -c.value),
				4,
			)}`,
		);

		console.log(
			`inverted ordered pairs (named the MORE valuable task): ${inverted}/${PAIRS} = ` +
				`${f((100 * inverted) / PAIRS, 1)}%`,
		);

		if (worst !== null)
			console.log(
				`worst inversion: difficulty ${worst.named.Eu} enjoyment ${worst.named.betaU} ` +
					`(E/β ${f(worst.named.ratio)}, P̄(T*) ${f(worst.named.value)}) named over ` +
					`difficulty ${worst.over.Eu} enjoyment ${worst.over.betaU} ` +
					`(E/β ${f(worst.over.ratio)}, P̄(T*) ${f(worst.over.value)}) — worth ${f(worst.gap)} MORE`,
			);
	});

	it('is a proxy for ϕ, which is the reading it was mistaken for', () => {
		console.log('\nSpearman(E/β, candidate readings of "drag"):');

		console.log(
			`  ϕ, time to reach flow          ${f(
				spearmanAgainstRatio((c) => c.phi),
				4,
			)}`,
		);

		console.log(
			`  difficulty − enjoyment         ${f(
				spearmanAgainstRatio((c) => c.Eu - c.betaU),
				4,
			)}`,
		);

		console.log(
			`  −p₀, effective initial rate    ${f(
				spearmanAgainstRatio((c) => -c.p0),
				4,
			)}`,
		);

		console.log(
			`  −P̄(T*), model task value       ${f(
				spearmanAgainstRatio((c) => -c.value),
				4,
			)}`,
		);
	});

	it('is not even 1/p₀ where AMPLITUDE_RATIO_CAP binds', () => {
		const capped = grid.filter((c) => Math.abs(c.p0 - c.beta / c.E) > 1e-12);
		console.log(`\ncells where the curve's p₀ ≠ β/E: ${capped.length}/${grid.length}`);

		const flips: string[] = [];
		for (const named of grid)
			for (const over of grid)
				if (named !== over && named.ratio > over.ratio && 1 / named.p0 < 1 / over.p0)
					flips.push(
						`  difficulty ${named.Eu} enjoyment ${named.betaU} (E/β ${f(named.ratio)}, ` +
							`1/p₀ ${f(1 / named.p0)}) named over difficulty ${over.Eu} enjoyment ${over.betaU} ` +
							`(E/β ${f(over.ratio)}, 1/p₀ ${f(1 / over.p0)})`,
					);

		console.log(`ordered pairs where E/β and 1/p₀ disagree: ${flips.length}/${PAIRS}`);
		for (const line of flips) console.log(line);
	});
});

describe('the binding-pool draw', () => {
	it('names a task, and the row is no longer a constant', () => {
		const random = mulberry32(23);
		const pick = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
		let named = 0;
		let none = 0;
		let cognitive = 0;
		let differsFromRatio = 0;
		const shares: number[] = [];
		const DAYS = 600;

		for (let d = 0; d < DAYS; d++) {
			const tasks: Task[] = Array.from(
				{
					length: pick(1, 7),
				},
				(unused, i) => ({
					id: i + 1,
					title: `t${i + 1}`,
					mentalDifficulty: pick(0, 10),
					physicalDifficulty: pick(0, 10),
					enjoyment: pick(1, 10),
					createdAt: '2026-08-07',
					completed: false,
				}),
			);

			const budget = 0.25 * pick(1, 64);

			const plan = calculateSuggestedTasks(
				tasks,
				budget,
				pick(1, 6) * 0.0833,
				DEFAULT_CAPACITY_POOLS,
				DEFAULT_USER_CONSTANTS,
			);

			const capacity = calculateHumanCapacity(plan, DEFAULT_CAPACITY_POOLS);
			const bottleneck = calculateBottleneckTask(plan, DEFAULT_CAPACITY_POOLS);

			if (capacity.limitType === 'cognitive') cognitive++;

			if (bottleneck === null) {
				none++;
				continue;
			}

			named++;

			const weight = (t: (typeof plan)[number]) =>
				(bottleneck.limitType === 'cognitive' ? t.mentalDifficulty : t.physicalDifficulty) / 10;

			const draw = (t: (typeof plan)[number]) => weight(t) * t.suggestedHours;
			const total = plan.reduce((sum, t) => sum + draw(t), 0);
			const chosen = plan.find((t) => t.title === bottleneck.title)!;
			shares.push(total > 0 ? draw(chosen) / total : 0);

			// The old reading, on the same plan, for how often the two disagree.
			const byRatio = plan.reduce((worst, t) =>
				t.trueEffort / t.trueEnjoyability > worst.trueEffort / worst.trueEnjoyability ? t : worst,
			);

			if (byRatio.title !== bottleneck.title) differsFromRatio++;
		}

		shares.sort((x, y) => x - y);
		console.log(`\n${DAYS} seeded days (1–7 tasks, difficulties 0–10, budgets 0.25–16h):`);
		console.log(`  names a task: ${named}  |  nothing draws on the binding pool: ${none}`);

		console.log(
			`  binding pool was cognitive on ${cognitive} days, physical on ${DAYS - cognitive}`,
		);

		console.log(
			`  named task's share of the binding draw: min ${f(shares[0])}, ` +
				`median ${f(shares[shares.length >> 1])}, max ${f(shares[shares.length - 1])}`,
		);

		console.log(
			`  names a DIFFERENT task than the retired E/β reading: ${differsFromRatio}/${named} = ` +
				`${f((100 * differsFromRatio) / named, 1)}%`,
		);
	});
});
