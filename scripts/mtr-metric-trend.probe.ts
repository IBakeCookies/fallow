/**
 * What the analytics metric trend (MATH.md §31) costs and how far it lands from
 * the dashboard, over a day space the allocator actually produces.
 *
 * The card was asked to plot four of the readings the dashboard shows for today
 * — Burnout Risk (§11.6), Cognitive and Physical Load (§25), Fallow Gain (§21)
 * — across the viewed range. History cannot afford the dashboard's plan: the
 * exact allocator enumerates 2ⁿ funded subsets, so every point is read off
 * `solveWithoutSwitchCost` (§29) instead. This measures which of the four
 * survive that, and it is why the shipped card plots three:
 *
 * 1. **What does a year cost?** The fold runs an energy simulation per day for
 *    Burnout Risk; the year view is 365 of them on the main thread.
 * 2. **How far is each reading from the dashboard's?** Median and p95 of the
 *    absolute difference, against the spread of the reading itself — the same
 *    gap is small on Burnout Risk and fatal on a gain whose median is ~3%.
 * 3. **Does the difference change what a reader would conclude?** The share of
 *    days the two readings fall in different bands.
 * 4. **Which term is responsible?** Burnout Risk and the gain take `switchCost`
 *    as an argument separate from the solve, so the approximation is the
 *    ALLOCATION alone — measured against passing 0 for both.
 * 5. **Is the exact solve really unaffordable?** §31's per-n table starts at n = 8; a year
 *    is only unaffordable for a heavy user, so the cost is taken per n.
 * 6. **What does the gap actually depend on?** The dropped term is the switch
 *    bill, so the gap is read against what that bill was worth on the day.
 *
 * A probe, not a test: every rate below moves whenever the allocator moves.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateBurnoutRisk,
	calculateCognitiveLoad,
	calculatePhysicalLoad,
	calculateTaskPlan,
	calculateZenithGain,
	type SuggestedTask,
} from '$lib/business/model/metric/calculation';
import { AXIS_BAND } from '$lib/presentation/utils/band';
import { DEFAULT_CAPACITY_POOLS, DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
import type { Task } from '$lib/data/type';

function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const task = (id: number, mental: number, physical: number, enjoyment: number): Task => ({
	id,
	title: `t${id}`,
	mentalDifficulty: mental,
	physicalDifficulty: physical,
	enjoyment,
	createdAt: '2026-08-07',
	completed: false,
});

interface Day {
	tasks: Task[];
	availableHours: number;
	switchCost: number;
}

/** Enjoyment starts at 1 in the form (a 0 there is a division by zero, §2). */
function randomDays(count: number, seed: number): Day[] {
	const random = mulberry32(seed);

	const pick = (min: number, max: number, step: number) =>
		min + Math.round((random() * (max - min)) / step) * step;

	return Array.from(
		{
			length: count,
		},
		() => ({
			tasks: Array.from(
				{
					length: pick(1, 7, 1),
				},
				(_, index) => task(index + 1, pick(0, 10, 1), pick(0, 10, 1), pick(1, 10, 1)),
			),
			availableHours: pick(0.25, 16, 0.25),
			switchCost: pick(5, 30, 5) / 60,
		}),
	);
}

interface Reading {
	burnoutRisk: number;
	cognitiveLoad: number;
	physicalLoad: number;
	gainPercent: number;
}

/**
 * The four readings off one already-solved plan. `switchCost` is passed
 * separately from the solve on purpose: it is what question 4 varies.
 */
function read(
	day: Day,
	plan: SuggestedTask[],
	allocatedHours: number[],
	switchCost: number,
): Reading {
	return {
		burnoutRisk: calculateBurnoutRisk(plan, day.availableHours, switchCost, DEFAULT_ENERGY_PARAMS),
		cognitiveLoad: calculateCognitiveLoad(plan, day.availableHours),
		physicalLoad: calculatePhysicalLoad(plan, day.availableHours),
		gainPercent: calculateZenithGain(
			day.tasks,
			day.availableHours,
			switchCost,
			DEFAULT_CAPACITY_POOLS,
			DEFAULT_USER_CONSTANTS,
			undefined,
			allocatedHours,
		).gainPercent,
	};
}

const solve = (day: Day, switchCost: number) =>
	calculateTaskPlan(
		day.tasks,
		day.availableHours,
		switchCost,
		DEFAULT_CAPACITY_POOLS,
		DEFAULT_USER_CONSTANTS,
	);

/** The dashboard: the exact plan, at the day's own switch cost. */
function dashboardReading(day: Day): Reading {
	const { suggestedTasks, allocatedHours } = solve(day, day.switchCost);

	return read(day, suggestedTasks, allocatedHours, day.switchCost);
}

/** History: the switch-cost-free plan, still priced at the day's own cost. */
function historyReading(day: Day): Reading {
	const { suggestedTasks, allocatedHours } = solve(day, 0);

	return read(day, suggestedTasks, allocatedHours, day.switchCost);
}

/** The cheaper alternative: drop the switch cost from the readings too. */
function costFreeReading(day: Day): Reading {
	const { suggestedTasks, allocatedHours } = solve(day, 0);

	return read(day, suggestedTasks, allocatedHours, 0);
}

const KEYS = ['burnoutRisk', 'cognitiveLoad', 'physicalLoad', 'gainPercent'] as const;

const quantile = (xs: number[], p: number) =>
	[...xs].sort((x, y) => x - y)[Math.min(xs.length - 1, Math.floor(xs.length * p))];

const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(1)}%`;

/**
 * The band each reading actually ships with, imported rather than restated
 * (AGENTS.md R3). A local three-band 30/60 ladder — which is what this probe
 * used to carry — is not the policy for ANY of the four: Burnout Risk reads
 * through `getBandSmallerBetter` (25/50/75), the two Loads through the same
 * ladder behind a `> 70` gate that makes every ordinary day 'success', and
 * Fallow Gain through its own 15/5 ladder in `metric-descriptor.ts`. Every
 * "band differs" rate below is a claim about what a reader would SEE, so it
 * has to be measured against what the cards do.
 */
const BAND: Record<(typeof KEYS)[number], (value: number) => string> = {
	burnoutRisk: AXIS_BAND.burnoutRisk,
	cognitiveLoad: AXIS_BAND.cognitiveLoad,
	physicalLoad: AXIS_BAND.physicalLoad,
	gainPercent: (value) => (value >= 15 ? 'success' : value >= 5 ? 'neutral' : 'warning'),
};

const DAYS = randomDays(600, 20260807);

describe('the analytics metric trend', () => {
	it('1. what a year of points costs on the main thread', () => {
		// A year view is 365 days; the seeded space is drawn from the same
		// generator the other metric probes use, so n runs 1–7 rather than the
		// n = 12 that §31's per-n table tops out at.
		const year = DAYS.slice(0, 365);
		const solved = year.map((day) => solve(day, 0));
		const startFold = performance.now();

		year.forEach((day, index) =>
			read(day, solved[index].suggestedTasks, solved[index].allocatedHours, day.switchCost),
		);

		const foldMs = performance.now() - startFold;
		const startSolve = performance.now();
		year.forEach((day) => solve(day, 0));
		const solveMs = performance.now() - startSolve;
		const startBurnout = performance.now();

		year.forEach((day, index) =>
			calculateBurnoutRisk(
				solved[index].suggestedTasks,
				day.availableHours,
				day.switchCost,
				DEFAULT_ENERGY_PARAMS,
			),
		);

		const burnoutMs = performance.now() - startBurnout;

		console.log(`365-day switch-cost-free solve: ${solveMs.toFixed(0)} ms`);
		console.log(`365-day four-reading fold on top of it: ${foldMs.toFixed(0)} ms`);
		console.log(`  of which Burnout Risk alone: ${burnoutMs.toFixed(0)} ms`);
		console.log(`total for the year view: ${(solveMs + foldMs).toFixed(0)} ms`);
	});

	it('2. how far each reading lands from the dashboard', () => {
		const deltas: Record<string, number[]> = {
			burnoutRisk: [],
			cognitiveLoad: [],
			physicalLoad: [],
			gainPercent: [],
		};

		const levels: Record<string, number[]> = {
			burnoutRisk: [],
			cognitiveLoad: [],
			physicalLoad: [],
			gainPercent: [],
		};

		for (const day of DAYS) {
			const dashboard = dashboardReading(day);
			const history = historyReading(day);

			for (const key of KEYS) {
				deltas[key].push(Math.abs(dashboard[key] - history[key]));
				levels[key].push(dashboard[key]);
			}
		}

		// A gap only means something against the spread of the reading itself: a
		// p95 of 13 points is small on Burnout Risk and enormous on a gain whose
		// own median is ~3% (§21).
		for (const key of KEYS) {
			const xs = deltas[key];
			const exact = xs.filter((d) => d === 0).length;

			console.log(
				`${key}: identical on ${pct(exact, xs.length)}, median |Δ| ${quantile(xs, 0.5).toFixed(2)}, ` +
					`p95 ${quantile(xs, 0.95).toFixed(2)}, max ${Math.max(...xs).toFixed(2)} ` +
					`(the reading itself: median ${quantile(levels[key], 0.5).toFixed(2)}, p95 ${quantile(levels[key], 0.95).toFixed(2)})`,
			);
		}
	});

	it('3. how often the two readings fall in different bands', () => {
		const banded = ['burnoutRisk', 'cognitiveLoad', 'physicalLoad'] as const;

		const moved: Record<string, number> = {
			burnoutRisk: 0,
			cognitiveLoad: 0,
			physicalLoad: 0,
		};

		for (const day of DAYS) {
			const dashboard = dashboardReading(day);
			const history = historyReading(day);

			for (const key of banded)
				if (BAND[key](dashboard[key]) !== BAND[key](history[key])) moved[key]++;
		}

		for (const key of banded)
			console.log(
				`${key}: band differs on ${moved[key]}/${DAYS.length} = ${pct(moved[key], DAYS.length)}`,
			);
	});

	it('4. what pricing the readings at switchCost 0 as well would cost', () => {
		const priced: Record<string, number[]> = {
			burnoutRisk: [],
			cognitiveLoad: [],
			physicalLoad: [],
			gainPercent: [],
		};

		const free: Record<string, number[]> = {
			burnoutRisk: [],
			cognitiveLoad: [],
			physicalLoad: [],
			gainPercent: [],
		};

		for (const day of DAYS) {
			const dashboard = dashboardReading(day);
			const history = historyReading(day);
			const costFree = costFreeReading(day);

			for (const key of KEYS) {
				priced[key].push(Math.abs(dashboard[key] - history[key]));
				free[key].push(Math.abs(dashboard[key] - costFree[key]));
			}
		}

		for (const key of KEYS)
			console.log(
				`${key}: switch cost kept p95 ${quantile(priced[key], 0.95).toFixed(2)}, ` +
					`dropped p95 ${quantile(free[key], 0.95).toFixed(2)}`,
			);
	});

	it('6. how the gap depends on what the switch bill is worth', () => {
		// The seeded space draws budgets 0.25–16 h against switch costs of
		// 5–30 min, so a large share of its days spend most of the budget on
		// overhead — a regime an 8 h day with three tasks never reaches. The
		// approximation drops exactly that bill, so the share it represents is
		// the variable the gap should be read against.
		const buckets = [0.05, 0.15, 0.3, 1];

		// The gain is bucketed alongside, on the SAME days: judging the survivors
		// on ordinary overhead while judging the gain over the whole space —
		// including the corner this comment calls unreachable — would compare two
		// different populations and call the difference a property of the reading.
		const rows = buckets.map(() => ({
			days: 0,
			cognitive: [] as number[],
			bandMoved: 0,
			gainPriced: [] as number[],
			gainFree: [] as number[],
			gainLevel: [] as number[],
		}));

		for (const day of DAYS) {
			const { suggestedTasks } = solve(day, day.switchCost);
			const funded = suggestedTasks.filter((t) => t.suggestedHours > 0).length;
			const overhead = Math.max(0, funded - 1) * day.switchCost;
			const share = day.availableHours > 0 ? overhead / day.availableHours : 1;
			const index = buckets.findIndex((edge) => share <= edge);
			const row = rows[index === -1 ? rows.length - 1 : index];
			const dashboard = dashboardReading(day);
			const history = historyReading(day);
			const costFree = costFreeReading(day);

			row.days++;
			row.cognitive.push(Math.abs(dashboard.cognitiveLoad - history.cognitiveLoad));
			row.gainPriced.push(Math.abs(dashboard.gainPercent - history.gainPercent));
			row.gainFree.push(Math.abs(dashboard.gainPercent - costFree.gainPercent));
			row.gainLevel.push(dashboard.gainPercent);

			if (BAND.cognitiveLoad(dashboard.cognitiveLoad) !== BAND.cognitiveLoad(history.cognitiveLoad))
				row.bandMoved++;
		}

		rows.forEach((row, index) => {
			if (row.days === 0) return;

			const from = index === 0 ? 0 : buckets[index - 1];

			console.log(
				`overhead ${(from * 100).toFixed(0)}–${(buckets[index] * 100).toFixed(0)}% of budget: ` +
					`${row.days} days, Cognitive Load p95 |Δ| ${quantile(row.cognitive, 0.95).toFixed(2)}, ` +
					`band differs ${pct(row.bandMoved, row.days)}`,
			);

			console.log(
				`   same days, Fallow Gain: priced p95 |Δ| ${quantile(row.gainPriced, 0.95).toFixed(2)}, ` +
					`both-arms-free p95 |Δ| ${quantile(row.gainFree, 0.95).toFixed(2)}, ` +
					`own median ${quantile(row.gainLevel, 0.5).toFixed(2)}`,
			);
		});
	});

	it('5. what the EXACT solve costs over the same space', () => {
		const sizes = [7, 30, 365];

		for (const size of sizes) {
			const slice = DAYS.slice(0, size);
			const start = performance.now();

			slice.forEach((day) => {
				const { suggestedTasks, allocatedHours } = solve(day, day.switchCost);

				read(day, suggestedTasks, allocatedHours, day.switchCost);
			});

			console.log(
				`exact solve + fold over ${size} days: ${(performance.now() - start).toFixed(0)} ms`,
			);
		}

		// §31's per-n table runs n = 8–12; the space above runs n = 1–7. What the
		// exact solve costs is 2ⁿ in the task count, so the worst realistic day
		// is what decides whether a year is affordable, not the mean.
		const byCount = new Map<number, number[]>();

		for (const day of DAYS) {
			const start = performance.now();

			solve(day, day.switchCost);
			const ms = performance.now() - start;
			const bucket = byCount.get(day.tasks.length) ?? [];

			bucket.push(ms);
			byCount.set(day.tasks.length, bucket);
		}

		for (const n of [...byCount.keys()].sort((a, b) => a - b)) {
			const xs = byCount.get(n) ?? [];

			console.log(
				`n = ${n}: ${xs.length} days, median ${quantile(xs, 0.5).toFixed(2)} ms, max ${Math.max(...xs).toFixed(2)} ms`,
			);
		}

		// A year AT a fixed n, which is what a user with a standing task list
		// actually has. This is the table §31 quotes: the seeded space above
		// averages over n = 1–7 and so understates the day that decides it.
		const standing = (count: number): Day => ({
			tasks: Array.from(
				{
					length: count,
				},
				(_, index) => task(index + 1, 3 + (index % 8), index % 9, 1 + (index % 10)),
			),
			availableHours: 8,
			switchCost: 0.25,
		});

		for (const n of [8, 10, 12]) {
			const day = standing(n);
			const start = performance.now();

			for (let index = 0; index < 365; index++) solve(day, day.switchCost);

			console.log(`365 exact solves at n = ${n}: ${(performance.now() - start).toFixed(0)} ms`);
		}
	});
});
