/* `a = E·β` is monotone in effort, so the hardest task the sliders reach is the
   most valuable one. Flow research reports an inverted-U instead (in arousal,
   which is not the difficulty slider — MATH.md §10), and ROADMAP
   item 42 says no swap can be judged until a before/after instrument over real
   declared days has measured it. This probe is that instrument. What it measures:
   how far an inverted-U `a`, swept over peak location and width, moves the
   priority ranking, each task's stop time, where the 0.9 r-cap binds and the
   plans the author's own declared days are solved into. It also measures what
   each shape costs when the other one is the truth.

   It prices; it does not recommend. No shipped fit reads how `a` varies with
   difficulty (MATH.md §7), so nothing here can say which shape is true.

   The family is `a = β·g(E)`, `g(E) = E^m · e^(−m(E−1)/E₀)`: its peak is at
   `E = E₀`, and `g(1) = 1` leaves the easiest task where it is today. Today's
   `a = E·β` is the row m = 1, E₀ = ∞, run through the same code as every cell.
   The grid — peak at slider difficulty d₀ ∈ {3, 5, 7, 9} (E₀ = mapEffort(d₀)) ×
   m ∈ {0.5, 1, 2} — is a choice, not a finding. Every row runs on
   `fitUserConstants([])`, the defaults plus the zero-log prior, so only `a`
   differs between rows.
   - Arm A, height only: `a` and `p₀` both scale by `c = g(E)/E`, so r, T* and
     ϕ stay put and P̄ scales by exactly c (MATH.md §2). It runs through the
     shipped pooled allocator with `importanceWeight = v·c`, which is that
     model's plan exactly, posterior included.
   - Arm B, height and r: `p₀ = β/E` stays, so `r = 1/(E·g(E))` under the cap
     and T* moves. Priorities come from `expectedOptimalTime` and
     `expectedAverageProductivity` on the counterfactual curve; plans from a
     single-budget brute force copied from allocator-exactness.probe.ts, run for
     both rows so each before/after pair comes from one solver.

   The corpus, scripts/declared-day.json, is 23 of the author's declared days
   (2026-09-06 to 2026-10-04): sliders, importance, budget, switch cost and
   pools, nothing else. It is small (at most 4 tasks, at most 3 h) and one
   user's. The slider-grid reading is what generalises; the day readings are how
   much it moves days that really happened.

   Readings, 2026-11-05:

   Self-checks, the only assertions. (i) Arm A on the today row reproduces
   `calculateTaskPlan`'s hours bit-identically on 23/23 days. (ii) The brute
   force at σ = 0 matches `calculateTaskAllocations`' value, worst gap
   0.00e+0. (iii) Both pools are at least the budget on 23/23 days, tightest
   margin 1 h, so no pool binds and the single-budget brute force is exact here.

   1. Slider grid, 1210 cells (mental 0–10 × physical 0–10 × enjoyment 1–10).
      Priority is raw P̄(T*) on the zero-log posterior; the cap band and T* ÷ ϕ
      are read at σ = 0, where "flat at its floor" holds.
      - Today's most valuable effective difficulty is 10.00 in both arms, and
        arm B's today row ranks the grid with Spearman 1.0000 against the
        shipped priority.
      - Most cells move it to the other end. Arm A reads 1.00 on every m 0.5
        and m 1 cell and on d₀ 3 m 2, 1.30 on d₀ 5 m 2, 5.60–5.90 across
        enjoyment on d₀ 7 m 2 and 8.00–8.20 on d₀ 9 m 2. Arm B reads 1.00 on every m 0.5 and m 1 cell and on
        d₀ 3 m 2, 1.00–1.30 on d₀ 5 m 2, 6.30–6.50 on d₀ 7 m 2 and 8.50–8.60
        on d₀ 9 m 2. P̄(T*) = a·h(r) (MATH.md §3), and the anchor keeps the
        capped difficulty-1 task at today's value.
      - Spearman against today runs from −0.3960 (d₀ 3 m 2) to 0.8588
        (d₀ 9 m 2) in arm A, and from −0.2755 to 0.9005 on the same two cells
        in arm B.
      - Arm B's cap binds on [1.00, 1.12] today, and on cells from [1.00, 1.09]
        (d₀ 7 m 2, d₀ 9 m 2) to [1.00, 1.20] (d₀ 3 m 0.5). It is contiguous on
        every row and never returns at the hard end. T* ÷ ϕ floors at 1.5194 on
        every row and tops out at 1.7750 today, from 1.6727 (d₀ 3 m 2) to
        1.7722 (d₀ 9 m 2) on the cells. Arm A leaves both unchanged by
        construction.
   2. Declared days, against the same arm's today row. Hours moved is
      Σᵢ|Δhᵢ|/2, averaged over days. The top task is argmax raw P̄(T*).
      - The funded set changes on 0/23 days on every arm B cell and on at most
        3/23 in arm A (d₀ 3 m 2).
      - The block vector changes on 3/23 (d₀ 9 m 2) to 13/23 (every d₀ 3
        cell) in arm A, and on 4/23 (d₀ 9 m 2) to 13/23 (d₀ 3 m 2) in arm B.
      - Mean hours moved runs 0.0326–0.2772 h/day in arm A and
        0.0543–0.2609 h/day in arm B, with the extremes at d₀ 9 m 2 and
        d₀ 3 m 2 in both arms.
      - The top task changes on 6–7/23 days on the d₀ 3 cells, 2/23 on every
        d₀ 5 and d₀ 7 cell and on d₀ 9 m 0.5 and m 1, and 1/23 on d₀ 9 m 2, in
        both arms.
   3. Cross-scored. The cost is the share of the true shape's own plan value
      that the other shape's plan loses, per day. The shipped pooled plan equals
      the brute force on 23/23 days under today's shape, so the today side of arm
      A's costs carries no solver error, and none is negative.
      - Arm A's mean cost is 0.0853%–2.0290% when today ships and a cell is
        true, and 0.0363%–2.5976% when a cell ships and today is true. Arm B's
        is 0.0869%–0.9910% and 0.1550%–1.8685%.
      - The worst day is on d₀ 3 m 2 when that cell ships and today is true:
        16.4162% in arm A and 11.7439% in arm B. Every cell has a day that
        costs 0.0000%.

   Usage: npm run probe -- scripts/amplitude-shape.probe.ts */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	calculateTaskPlan,
	getEffectiveDifficulty,
	toPooledInputs,
} from '$lib/business/model/metric/calculation';
import {
	BLOCK_HOURS,
	DEFAULT_CAPACITY_POOLS,
	calculatePooledAllocations,
	calculateTaskAllocations,
	calculateTaskParams,
	calculateTotalProductivity,
	expectedAverageProductivity,
	expectedOptimalTime,
	fitUserConstants,
	mapEffort,
	phiParameterStd,
	type FitPosterior,
} from '$lib/business/model/zenith';
import type { Task } from '$lib/data/type';

/** The defaults plus the zero-log prior every user starts on — the same for every arm and row. */
const FIT = fitUserConstants([]);
const CONSTANTS = FIT.constants;
const POSTERIOR = FIT.posterior;
/** The allocator's own feasibility slack (`budgetBlocksFor`). */
const FEASIBILITY_EPS = 1e-9;

type TaskInput = Parameters<typeof calculateTaskParams>[0];

interface Cell {
	label: string;
	E0: number;
	m: number;
}

/** Today's a = E·β is the m = 1, E₀ → ∞ limit, run through the same code as every cell. */
const TODAY: Cell = {
	label: 'today (m 1, E₀ ∞)',
	E0: Infinity,
	m: 1,
};

const ROWS: Cell[] = [
	TODAY,
	...[3, 5, 7, 9].flatMap((d0) =>
		[0.5, 1, 2].map((m) => ({
			label: `d₀ ${d0} m ${m}`,
			E0: mapEffort(d0),
			m,
		})),
	),
];

/** g(E) = E^m · e^(−m(E−1)/E₀): peak at E₀, g(1) = 1. */
const g = (E: number, cell: Cell) => E ** cell.m * Math.exp((-cell.m * (E - 1)) / cell.E0);

/** Arm A's height factor c = g(E)/E — exactly 1 in float on the today row. */
function heightFactor(difficulty: number, cell: Cell): number {
	const E = mapEffort(difficulty);

	return g(E, cell) / E;
}

interface Curve {
	a: number;
	p0: number;
	phi: number;
	sigma: number;
	v: number;
}

/** Arm B's curve: a = β·g(E) and the raw p₀ = β/E — the shipped functions clamp r. */
function curve(input: TaskInput, cell: Cell, posterior?: FitPosterior): Curve {
	const { E, beta, phi } = calculateTaskParams(input, CONSTANTS);

	return {
		a: beta * g(E, cell),
		p0: beta / E,
		phi,
		sigma: posterior ? phiParameterStd(E, beta, posterior) : 0,
		v: input.importanceWeight ?? 1,
	};
}

const termValue = ({ a, p0, phi, sigma, v }: Curve, hours: number) =>
	v * expectedAverageProductivity(hours, a, p0, phi, sigma);

/** P̄(T*), raw — the priority score before the ×10 and the 1 dp print. */
const optimalAverage = ({ a, p0, phi, sigma }: Curve) =>
	expectedAverageProductivity(expectedOptimalTime(a, p0, phi, sigma), a, p0, phi, sigma);

// The single-budget brute force, copied from allocator-exactness.probe.ts; its
// `valueTable` takes the per-task curve so a candidate row can be fed.

function valueTable(curves: Curve[], maxBlocks: number): number[][] {
	return curves.map((task) =>
		Array.from(
			{
				length: maxBlocks + 1,
			},
			(_, blocks) => termValue(task, blocks * BLOCK_HOURS),
		),
	);
}

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

function bruteForceBest(
	curves: Curve[],
	budget: number,
	switchCost: number,
): { value: number; blocks: number[] } {
	const n = curves.length;
	const table = valueTable(curves, Math.max(0, budgetBlocksFor(budget, switchCost, 1)));
	let bestValue = 0;
	let bestBlocks = curves.map(() => 0);

	for (let mask = 1; mask < 1 << n; mask++) {
		const subset: number[] = [];

		for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.push(i);

		const budgetBlocks = budgetBlocksFor(budget, switchCost, subset.length);

		if (budgetBlocks < subset.length) continue;

		const context: BruteContext = {
			table,
			subset,
			budgetBlocks,
			bestValue,
			bestBlocks,
			current: curves.map(() => 0),
		};

		descend(context, 0, 0, 0);
		bestValue = context.bestValue;
		bestBlocks = context.bestBlocks;
	}

	return {
		value: bestValue,
		blocks: bestBlocks,
	};
}

interface DeclaredDay {
	availableHours: number;
	switchCost: number;
	cognitivePool?: number;
	physicalPool?: number;
	tasks: Pick<Task, 'physicalDifficulty' | 'mentalDifficulty' | 'enjoyment' | 'importance'>[];
}

const DAYS = (JSON.parse(readFileSync('scripts/declared-day.json', 'utf8')) as DeclaredDay[]).map(
	(day) => ({
		budget: day.availableHours,
		switchCost: day.switchCost,
		// The app's fallback. The corpus's 6/4 is the default's 4/6 the other way round.
		pools: {
			cognitiveHours: day.cognitivePool ?? DEFAULT_CAPACITY_POOLS.cognitiveHours,
			physicalHours: day.physicalPool ?? DEFAULT_CAPACITY_POOLS.physicalHours,
		},
		tasks: day.tasks.map((task, i): Task => ({
			...task,
			id: i + 1,
			title: `task ${i + 1}`,
			createdAt: '2026-11-05',
			completed: false,
		})),
	}),
);

type Day = (typeof DAYS)[number];

/** One arm's solve of one day under one row: the plan, each task's priority, and that shape's scorer. */
interface Solved {
	hours: number[];
	priority: number[];
	value: (hours: number[]) => number;
}

/** Arm A, height only: the shipped pooled allocator with importanceWeight = v·c(E). */
function armA(day: Day, cell: Cell): Solved {
	const inputs = toPooledInputs(day.tasks).map((input) => ({
		...input,
		importanceWeight: input.importanceWeight * heightFactor(input.difficulty, cell),
	}));

	const allocations = calculatePooledAllocations(
		inputs,
		day.budget,
		day.pools,
		CONSTANTS,
		day.switchCost,
		POSTERIOR,
	);

	return {
		hours: allocations.map((allocation) => allocation.allocatedHours),
		priority: allocations.map(
			(allocation, i) =>
				heightFactor(inputs[i].difficulty, cell) * allocation.optimalAvgProductivity,
		),
		value: (hours) => calculateTotalProductivity(inputs, hours, CONSTANTS, POSTERIOR),
	};
}

/** Arm B, height and r: the brute force on the counterfactual curves. */
function armB(day: Day, cell: Cell): Solved {
	const curves = toPooledInputs(day.tasks).map((input) => curve(input, cell, POSTERIOR));

	return {
		hours: bruteForceBest(curves, day.budget, day.switchCost).blocks.map(
			(blocks) => blocks * BLOCK_HOURS,
		),
		priority: curves.map(optimalAverage),
		value: (hours) => curves.reduce((sum, task, i) => sum + termValue(task, hours[i]), 0),
	};
}

const ARMS = [
	{
		name: 'A',
		solve: armA,
	},
	{
		name: 'B',
		solve: armB,
	},
];

/** What shipping `shipped`'s plan costs when `truth`'s shape is true, as a share of `truth`'s own plan. */
function crossCost(truth: Solved, shipped: Solved): number {
	const best = truth.value(truth.hours);

	return (best - truth.value(shipped.hours)) / best;
}

const argmax = (values: number[]) => values.indexOf(Math.max(...values));
const percent = (share: number) => `${(100 * share).toFixed(4)}%`;
const mean = (values: number[]) => values.reduce((sum, x) => sum + x, 0) / values.length;

const spread = (values: number[]) =>
	`mean ${percent(mean(values))} [${percent(Math.min(...values))}, ${percent(Math.max(...values))}]`;

/** Every mental 0–10 × physical 0–10 × enjoyment 1–10 cell the sliders reach. */
const SLIDERS = Array.from(
	{
		length: 11,
	},
	(_, mental) =>
		Array.from(
			{
				length: 11,
			},
			(_, physical) =>
				Array.from(
					{
						length: 10,
					},
					(_, e) => ({
						title: 'grid',
						difficulty: getEffectiveDifficulty({
							mentalDifficulty: mental,
							physicalDifficulty: physical,
						}),
						enjoyment: e + 1,
					}),
				),
		),
).flat(2);

/** The shipped priority, raw, read the way mtr-priority-monotonicity reads it: the empty plan. */
const SHIPPED_PRIORITY = SLIDERS.map(
	(input) =>
		calculateTaskAllocations([input], 0, CONSTANTS, 0, POSTERIOR)[0].optimalAvgProductivity,
);

/** Average ranks over runs of equal values. */
function ranks(values: number[]): number[] {
	const order = values.map((_, i) => i).sort((x, y) => values[x] - values[y]);
	const rank: number[] = [];

	for (let start = 0, end = 0; start < order.length; start = end) {
		while (end < order.length && values[order[end]] === values[order[start]]) end++;

		for (let k = start; k < end; k++) rank[order[k]] = (start + end - 1) / 2;
	}

	return rank;
}

function spearman(x: number[], y: number[]): number {
	const xRanks = ranks(x);
	const yRanks = ranks(y);
	// Average ranks keep the rank sum, so both means are (n − 1)/2.
	const centre = (x.length - 1) / 2;
	let sumXY = 0;
	let sumXX = 0;
	let sumYY = 0;

	xRanks.forEach((r, i) => {
		sumXY += (r - centre) * (yRanks[i] - centre);
		sumXX += (r - centre) ** 2;
		sumYY += (yRanks[i] - centre) ** 2;
	});

	return sumXY / Math.sqrt(sumXX * sumYY);
}

/** The effective difficulty with the highest priority, per enjoyment level. */
function mostValuable(priority: number[]): string {
	const peaks = Array.from(
		{
			length: 10,
		},
		(_, e) =>
			SLIDERS[
				SLIDERS.reduce(
					(best, cell, i) =>
						cell.enjoyment === e + 1 && (best < 0 || priority[i] > priority[best]) ? i : best,
					-1,
				)
			].difficulty,
	);

	const lowest = Math.min(...peaks);
	const highest = Math.max(...peaks);

	return lowest === highest
		? `${lowest.toFixed(2)} at every enjoyment`
		: `${peaks.map((d, e) => `e${e + 1} ${d.toFixed(2)}`).join(', ')}`;
}

/** Effective difficulty 1 → 10 at 0.01. */
const SWEEP = Array.from(
	{
		length: 901,
	},
	(_, i) => 1 + i / 100,
);

/**
 * T* ÷ ϕ at σ = 0 over the sweep, and where it sits at its floor — the capped
 * band. r = 1/(E·g(E)) is β-free, so one enjoyment serves.
 */
function capBand(cell: Cell): string {
	const ratio = SWEEP.map((difficulty) => {
		const { a, p0, phi } = curve(
			{
				title: 'sweep',
				difficulty,
				enjoyment: 5,
			},
			cell,
		);

		return expectedOptimalTime(a, p0, phi, 0) / phi;
	});

	const floor = Math.min(...ratio);
	const capped = ratio.flatMap((value, i) => (value - floor <= 1e-12 * floor ? [i] : []));
	const runs = capped.filter((index, j) => j === 0 || index !== capped[j - 1] + 1).length;

	return (
		`cap binds on [${SWEEP[capped[0]].toFixed(2)}, ${SWEEP[capped.at(-1)!].toFixed(2)}] ` +
		`(${capped.length} points, ${runs === 1 ? 'contiguous' : `${runs} runs`}); ` +
		`T*/ϕ ${floor.toFixed(4)}–${Math.max(...ratio).toFixed(4)}`
	);
}

describe('ROADMAP item 42 — what an inverted-U `a` would move', () => {
	it('self-checks', () => {
		const identical = DAYS.filter((day) => {
			const shipped = calculateTaskPlan(
				day.tasks,
				day.budget,
				day.switchCost,
				day.pools,
				CONSTANTS,
				POSTERIOR,
			).allocatedHours;

			const hours = armA(day, TODAY).hours;

			return hours.length === shipped.length && hours.every((h, i) => h === shipped[i]);
		}).length;

		console.log(
			`[check i] arm A at c ≡ 1 (today row) through calculatePooledAllocations vs calculateTaskPlan, ` +
				`zero-log posterior: hours bit-identical (===) on ${identical}/${DAYS.length} days`,
		);

		expect(identical).toBe(DAYS.length);

		const gaps = DAYS.map((day) => {
			const inputs = toPooledInputs(day.tasks);

			const hours = calculateTaskAllocations(inputs, day.budget, CONSTANTS, day.switchCost).map(
				(allocation) => allocation.allocatedHours,
			);

			const brute = bruteForceBest(
				inputs.map((input) => curve(input, TODAY)),
				day.budget,
				day.switchCost,
			);

			return Math.abs(brute.value - calculateTotalProductivity(inputs, hours, CONSTANTS));
		});

		console.log(
			`[check ii] brute force at the shipped a (today row, σ = 0) vs calculateTaskAllocations' value ` +
				`(σ = 0): worst absolute gap ${Math.max(...gaps).toExponential(2)} over ${DAYS.length} days, tolerance 1e-9`,
		);

		expect(Math.max(...gaps)).toBeLessThanOrEqual(1e-9);

		const margins = DAYS.map(
			(day) => Math.min(day.pools.cognitiveHours, day.pools.physicalHours) - day.budget,
		);

		console.log(
			`[check iii] both pools ≥ budget on ${margins.filter((m) => m >= 0).length}/${DAYS.length} days, ` +
				`tightest margin ${Math.min(...margins)} h — slider weights are ≤ 1, so no pool can bind and the ` +
				`single-budget brute force is exact on this corpus`,
		);

		for (const margin of margins) expect(margin).toBeGreaterThanOrEqual(0);
	});

	it('1 — slider grid', () => {
		console.log(
			`[1] ${SLIDERS.length} slider cells (mental 0–10 × physical 0–10 × enjoyment 1–10, through ` +
				`getEffectiveDifficulty). Priority = raw P̄(T*) on the zero-log posterior (σ = phiParameterStd); ` +
				`Spearman against today's, ties by average rank. Cap band and T*/ϕ on σ = 0, over effective ` +
				`difficulty 1 → 10 step 0.01 at enjoyment 5`,
		);

		for (const cell of ROWS) {
			const priority = SLIDERS.map(
				(input, i) => heightFactor(input.difficulty, cell) * SHIPPED_PRIORITY[i],
			);

			console.log(
				`[1 A] ${cell.label}: most valuable difficulty ${mostValuable(priority)}; ` +
					`Spearman vs today ${spearman(priority, SHIPPED_PRIORITY).toFixed(4)}`,
			);
		}

		console.log(
			'[1 A] cap band and T*/ϕ: today’s on every row — c scales a and p₀ together, r is unchanged',
		);

		for (const cell of ROWS) {
			const priority = SLIDERS.map((input) => optimalAverage(curve(input, cell, POSTERIOR)));

			console.log(
				`[1 B] ${cell.label}: most valuable difficulty ${mostValuable(priority)}; ` +
					`Spearman vs today ${spearman(priority, SHIPPED_PRIORITY).toFixed(4)}; ${capBand(cell)}`,
			);
		}
	});

	it('2 — declared days', () => {
		console.log(
			`[2] ${DAYS.length} declared days, one user, zero-log posterior. Arm A: the shipped pooled allocator; ` +
				`arm B: the brute force on both rows. Hours moved = Σᵢ|Δhᵢ|/2 per day, averaged over days. ` +
				`Top task = argmax raw P̄(T*)`,
		);

		for (const arm of ARMS) {
			const reference = DAYS.map((day) => arm.solve(day, TODAY));

			for (const cell of ROWS) {
				const solved = DAYS.map((day) => arm.solve(day, cell));

				const share = (changed: (s: Solved, baseline: Solved) => boolean) =>
					`${solved.filter((s, d) => changed(s, reference[d])).length}/${DAYS.length}`;

				const moved = mean(
					solved.map(
						(s, d) =>
							s.hours.reduce((sum, h, i) => sum + Math.abs(h - reference[d].hours[i]), 0) / 2,
					),
				);

				console.log(
					`[2 ${arm.name}] ${cell.label}: funded set changes ` +
						`${share((s, baseline) => s.hours.some((h, i) => h > 0 !== baseline.hours[i] > 0))}, block vector ` +
						`${share((s, baseline) => s.hours.some((h, i) => h !== baseline.hours[i]))}, mean hours moved ` +
						`${moved.toFixed(4)} h/day, top task ${share((s, baseline) => argmax(s.priority) !== argmax(baseline.priority))}`,
				);
			}
		}
	});

	it('3 — cross-scored', () => {
		const solverGaps = DAYS.map((day) => crossCost(armB(day, TODAY), armA(day, TODAY)));

		console.log(
			`[3] shipped pooled vs brute force, today's shape, zero-log posterior, per day ` +
				`(share of the brute-force value the shipped plan leaves, ≤ 1e-9 printed =): ` +
				`${solverGaps.map((gap, d) => `${d} ${gap <= 1e-9 ? '=' : percent(gap)}`).join(', ')}`,
		);

		console.log(
			`[3] cost = (V(plan solved under the true shape) − V(plan solved under the other)) / V(plan solved ` +
				`under the true shape), zero-log posterior, per day; mean [min, max] over ${DAYS.length} days, as read`,
		);

		for (const arm of ARMS) {
			const reference = DAYS.map((day) => arm.solve(day, TODAY));

			for (const cell of ROWS) {
				const solved = DAYS.map((day) => arm.solve(day, cell));

				console.log(
					`[3 ${arm.name}] ${cell.label}: ship today, cell true ` +
						`${spread(solved.map((s, d) => crossCost(s, reference[d])))}; ship cell, today true ` +
						`${spread(solved.map((s, d) => crossCost(reference[d], s)))}`,
				);
			}
		}
	});
});
