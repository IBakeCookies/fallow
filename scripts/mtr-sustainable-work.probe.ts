/**
 * What is true of Sustainable Work (`calculateRewardDensity`, MATH.md §27) over
 * a day space the allocator actually produces.
 *
 * The metric had no entry in MATH.md and divided by the TIME BUDGET:
 * `Σ_{e ≥ Eᵤ} hᵢ / B`, where its siblings normalize differently — Grind Density
 * over the task COUNT, Friction Index over Σh (§11.4). §27 moved it to Σh. Both
 * are computed side by side below (`before` = /B, `after` = the shipped /Σh) so
 * the comparison survives the change. Six questions:
 *
 * 1. **Is the reading the formula?** Recompute from the returned plan.
 * 2. **Is the top band reachable?** `getBandBiggerBetter` calls ≥75 success. Over
 *    B, switch overhead and unfunded slack are in the denominator, so a day with
 *    NO grind in it reads below 100. How far below, and in which band?
 * 3. **Which question does /B answer?** On a day reading 60, is that "40% of my
 *    time is grind" or "40% of my budget is unbooked"? Decompose:
 *    before = allocatedShare × after.
 * 4. **Does it respond to the thing it names?** Love every task (affect) vs add
 *    an hour of budget with the same tasks (not affect).
 * 5. **Does it contradict the row above it?** Grind Density is the exact
 *    complementary predicate, banded smaller-better. Census of days where one
 *    reads `success` and the other `warning`/`critical`.
 * 6. **Is the fixed reading still its own?** Or a restatement of Grind Density
 *    (§24's test) — the two differ only by hour- vs count-weighting.
 *
 * A probe, not a test: every rate below moves whenever the allocator moves.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateGrindDensity,
	calculateRewardDensity,
	calculateSuggestedTasks,
	getEffectiveDifficulty,
	type SuggestedTask,
} from '$lib/business/model/metric/calculation';
import { getBandBiggerBetter, getBandSmallerBetter } from '$lib/presentation/utils/band';
import { DEFAULT_CAPACITY_POOLS, DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
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
	createdAt: '2026-08-06',
	completed: false,
});

interface Day {
	tasks: Task[];
	availableHours: number;
	switchCost: number;
}

const dump = (d: Day): string =>
	`m/p/e ${d.tasks.map((t) => `${t.mentalDifficulty}/${t.physicalDifficulty}/${t.enjoyment}`).join(' ')} | ${d.availableHours}h | s=${Math.round(d.switchCost * 60)}m`;

const plan = (d: Day): SuggestedTask[] =>
	calculateSuggestedTasks(
		d.tasks,
		d.availableHours,
		d.switchCost,
		DEFAULT_CAPACITY_POOLS,
		DEFAULT_USER_CONSTANTS,
	);

const sustainable = (t: SuggestedTask) => t.enjoyment >= getEffectiveDifficulty(t);
const hours = (tasks: SuggestedTask[]) => tasks.reduce((s, t) => s + t.suggestedHours, 0);

/** Every reading a day carries, both denominators. */
function read(d: Day) {
	const p = plan(d);
	const worked = hours(p);
	const good = hours(p.filter(sustainable));

	return {
		d,
		worked,
		/** The pre-§27 formula: sustainable hours over the time budget. */
		before: worked > 0 ? Math.round((good / d.availableHours) * 100) : 0,
		/** What ships: sustainable hours over worked hours. */
		after: calculateRewardDensity(p) ?? 0,
		grind: calculateGrindDensity(p).percent,
		allocShare: (worked / d.availableHours) * 100,
	};
}

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

const DAYS = randomDays(600, 20260807);
const ROWS = DAYS.map(read).filter((r) => r.worked > 0);
/* The shipped policy, imported rather than restated (AGENTS.md R3): Sustainable
   Work reads through `getBandBiggerBetter` at `metric-descriptor.ts`, Grind
   Density through `AXIS_BAND.grindDensity` = `getBandSmallerBetter`. */
const band = getBandBiggerBetter;
const bandSmaller = getBandSmallerBetter;

const tally = (values: number[]) => {
	const counts: Record<string, number> = {
		success: 0,
		neutral: 0,
		warning: 0,
		critical: 0,
	};

	for (const v of values) counts[band(v)] += 1;

	return `success ${counts.success} neutral ${counts.neutral} warning ${counts.warning} critical ${counts.critical}`;
};

const spread = (values: number[]) => {
	const s = [...values].sort((a, b) => a - b);
	const q = (f: number) => Math.round(s[Math.floor(f * (s.length - 1))]);

	return `min ${q(0)} p10 ${q(0.1)} p50 ${q(0.5)} p90 ${q(0.9)} max ${q(1)}`;
};

function spearman(a: number[], b: number[]): number {
	const rank = (xs: number[]) => {
		const order = xs
			.map((x, i) => ({
				x,
				i,
			}))
			.sort((p, q) => p.x - q.x);

		const r = new Array<number>(xs.length);
		let i = 0;

		while (i < order.length) {
			let j = i;

			while (j + 1 < order.length && order[j + 1].x === order[i].x) j += 1;

			const avg = (i + j) / 2;

			for (let k = i; k <= j; k += 1) r[order[k].i] = avg;

			i = j + 1;
		}

		return r;
	};

	const ra = rank(a);
	const rb = rank(b);
	const n = a.length;
	const ma = ra.reduce((s, x) => s + x, 0) / n;
	const mb = rb.reduce((s, x) => s + x, 0) / n;
	let num = 0;
	let da = 0;
	let db = 0;

	for (let i = 0; i < n; i += 1) {
		num += (ra[i] - ma) * (rb[i] - mb);
		da += (ra[i] - ma) ** 2;
		db += (rb[i] - mb) ** 2;
	}

	return num / Math.sqrt(da * db);
}

describe('Sustainable Work over a day space', () => {
	it('1. reading = formula, recomputed from the returned plan', () => {
		let worst = 0;

		for (const r of ROWS) {
			const expected = (hours(plan(r.d).filter(sustainable)) / r.worked) * 100;

			worst = Math.max(worst, Math.abs(r.after - expected));
		}

		console.log(`1. max |reading − recomputed| over ${ROWS.length} funded days: ${worst}`);

		console.log(
			`   null on an unfunded plan: ${calculateRewardDensity([])} (empty), ` +
				`${calculateRewardDensity(
					plan({
						tasks: [task(1, 5, 5, 5)],
						availableHours: 0.1,
						switchCost: 0.25,
					}),
				)} (0.1 h budget, nothing fits)`,
		);
	});

	it('2. what a grind-free day reads', () => {
		const clean = ROWS.filter((r) => r.grind === 0);

		console.log(
			`2. ${clean.length}/${ROWS.length} days have ZERO grind tasks. Over the BUDGET they read ` +
				`${spread(clean.map((r) => r.before))} — bands ${tally(clean.map((r) => r.before))}`,
		);

		console.log(
			`   over WORKED time: ${spread(clean.map((r) => r.after))} — bands ${tally(clean.map((r) => r.after))}`,
		);

		const worst = [...clean].sort((a, b) => a.before - b.before)[0];

		console.log(
			`   worst grind-free day: ${worst.before}% before, ${worst.after}% after — ${dump(worst.d)}`,
		);

		console.log(
			`   whole sweep before ${spread(ROWS.map((r) => r.before))} | after ${spread(ROWS.map((r) => r.after))}`,
		);

		console.log(
			`   band ladder before ${tally(ROWS.map((r) => r.before))} | after ${tally(ROWS.map((r) => r.after))}`,
		);
	});

	it('3. decomposition: the budget denominator prices unbooked time as grind', () => {
		console.log(
			`3. n=${ROWS.length}. Spearman(before, allocated share) = ` +
				`${spearman(
					ROWS.map((r) => r.before),
					ROWS.map((r) => r.allocShare),
				).toFixed(4)}; Spearman(before, after) = ${spearman(
					ROWS.map((r) => r.before),
					ROWS.map((r) => r.after),
				).toFixed(4)}`,
		);

		const alloc = [...ROWS.map((r) => r.allocShare)].sort((a, b) => a - b);

		console.log(
			`   allocated share of budget: min ${alloc[0].toFixed(1)}% ` +
				`p50 ${alloc[Math.floor(0.5 * (alloc.length - 1))].toFixed(1)}% max ${alloc[alloc.length - 1].toFixed(1)}% — ` +
				`the median day forfeited ${(100 - alloc[Math.floor(0.5 * (alloc.length - 1))]).toFixed(1)} pts of the old reading to slack alone`,
		);

		const pure = ROWS.filter((r) => r.after === 100);

		console.log(
			`   of the ${pure.length} days whose worked time is 100% sustainable, the old formula put ` +
				`${pure.filter((r) => r.before < 75).length} below 'success' and ${pure.filter((r) => r.before < 25).length} in 'critical'`,
		);
	});

	it('4. affect vs budget: which moves the reading', () => {
		const move = (make: (d: Day) => Day) => {
			let moves = 0;
			let sum = 0;
			let worst = 0;

			for (const r of ROWS) {
				const to = read(make(r.d)).after;

				if (to !== r.after) {
					moves += 1;
					sum += Math.abs(to - r.after);
					worst = Math.max(worst, Math.abs(to - r.after));
				}
			}

			return `${moves}/${ROWS.length} days (mean |Δ| ${(sum / Math.max(1, moves)).toFixed(1)}, worst ${worst})`;
		};

		console.log(
			`4. loving every task moves it on ${move((d) => ({
				...d,
				tasks: d.tasks.map((t) => ({
					...t,
					enjoyment: 10,
				})),
			}))}`,
		);

		console.log(
			`   +1 h of budget, same tasks, moves it on ${move((d) => ({
				...d,
				availableHours: d.availableHours + 1,
			}))} — re-planning only`,
		);
	});

	it('5. does it contradict Grind Density, its complementary predicate?', () => {
		const clash = (v: (r: (typeof ROWS)[number]) => number) =>
			ROWS.filter(
				(r) => bandSmaller(r.grind) === 'success' && ['warning', 'critical'].includes(band(v(r))),
			);

		const before = clash((r) => r.before);
		const after = clash((r) => r.after);

		console.log(
			`5. days banding Grind Density 'success' next to Sustainable Work 'warning'/'critical': ` +
				`${before.length}/${ROWS.length} before, ${after.length}/${ROWS.length} after`,
		);

		const zero = before.filter((r) => r.grind === 0).sort((a, b) => a.before - b.before);

		console.log(
			`   ${zero.length} of the old ones had ZERO grind tasks; worst read Grind 0% (success) next to ` +
				`Sustainable ${zero[0].before}% (${band(zero[0].before)}), now ${zero[0].after}%: ${dump(zero[0].d)}`,
		);
	});

	it('6. is the fixed reading its own, or a restatement of Grind Density?', () => {
		console.log(
			`6. Spearman(after, Grind Density) = ${spearman(
				ROWS.map((r) => r.after),
				ROWS.map((r) => r.grind),
			).toFixed(4)} — an hour-weighted restatement of the count would be −1`,
		);

		const disagree = ROWS.filter((r) => Math.abs(100 - r.after - r.grind) >= 25);

		console.log(
			`   ${disagree.length}/${ROWS.length} days where the grind SHARE OF HOURS and the grind share of ` +
				`TASKS differ by ≥25 pts — one long grind among short joys, or the reverse`,
		);
	});
});
