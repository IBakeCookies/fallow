/**
 * What is true of the Day Profile (`calculateDailyQuadrant`, MATH.md §29) over
 * a day space the allocator actually produces, and what §29 changed.
 *
 * Before §29 the label classified two UNWEIGHTED averages over the raw task
 * list against a single cut at 5.5. After it, both averages are weighted by
 * allocated hours over funded tasks, and the difficulty cut is 6.5 — what a
 * task rated at the midpoint of both 0–10 sliders reads through `max + 0.3·min`.
 * Six questions:
 *
 * 1. **Is 5.5 the same cut on both axes?** It is the midpoint of a 1–10 slider,
 *    but the difficulty axis is not a slider. Marginals of each axis, and the
 *    share of days each candidate cut calls demanding.
 * 2. **Are all four labels reachable?** Cruise and Routine need the difficulty
 *    average below its cut. Label mix under the old law and the new one.
 * 3. **How far is a day from flipping?** Distance to the nearer cut, and the
 *    share of days one ±1 slider point on ONE task relabels — the noise floor
 *    the advisor's flip gate has to clear.
 * 4. **What did hour-weighting move?** Count-average vs hour-weighted, over the
 *    same cut, plus how often an unfunded task used to get a vote.
 * 5. **Does the 2×2 still add anything over the Avg Enjoyment row beside it?**
 *    Occurrence counter first: the difficulty axis only discriminates where it
 *    is not saturated.
 * 6. **Does history read a day the way the dashboard does?** `summarizeSession`
 *    weights by each task's own T* (one-task solves, for the perf reason in
 *    `scoreTasksIndividually`) rather than by its share of one budget.
 *
 * A probe, not a test: every rate below moves whenever the allocator moves.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateDailyQuadrant,
	calculateQuadrantMargin,
	calculateSuggestedTasks,
	getEffectiveDifficulty,
	type DailyQuadrant,
	type SuggestedTask,
} from '$lib/business/model/metric/calculation';
import { summarizeSession } from '$lib/business/model/metric/history';
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
	createdAt: '2026-08-07',
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

/** The cut the code ships (§29), and the one it replaced. */
const DEMANDING_CUT = 6.5;
const OLD_CUT = 5.5;
const ENJOYABLE_CUT = 5.5;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

function label(diff: number, enj: number, cut: number): DailyQuadrant {
	const enjoyable = enj >= ENJOYABLE_CUT;

	if (diff >= cut) return enjoyable ? 'flow' : 'grind';

	return enjoyable ? 'cruise' : 'routine';
}

/** The pre-§29 reading: unweighted over the raw list, both cuts at 5.5. */
function oldQuadrant(tasks: Task[]): DailyQuadrant {
	if (!tasks.length) return 'routine';

	return label(
		mean(tasks.map(getEffectiveDifficulty)),
		mean(tasks.map((t) => t.enjoyment)),
		OLD_CUT,
	);
}

/** The shipped axes, recomputed here so the probe checks the code, not itself. */
function axesOf(p: SuggestedTask[]): { diff: number; enj: number } | null {
	const funded = p.filter((t) => t.suggestedHours > 0);
	const hours = funded.reduce((s, t) => s + t.suggestedHours, 0);

	if (hours <= 0) return null;

	return {
		diff: funded.reduce((s, t) => s + getEffectiveDifficulty(t) * t.suggestedHours, 0) / hours,
		enj: funded.reduce((s, t) => s + t.enjoyment * t.suggestedHours, 0) / hours,
	};
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

const DAYS = randomDays(600, 20260807);
const PLANS = DAYS.map(plan);
const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(1)}%`;

describe('Day Profile over a day space', () => {
	it('1. what each axis reads, against the cut it is judged by', () => {
		const diffs: number[] = [];
		const enjs: number[] = [];
		let noReading = 0;

		for (const p of PLANS) {
			const a = axesOf(p);

			if (!a) {
				noReading++;
				continue;
			}

			diffs.push(a.diff);
			enjs.push(a.enj);
		}

		const q = (xs: number[], p: number) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length * p)];

		console.log(
			`plans that book no hours (no reading at all): ${noReading}/${DAYS.length} = ${pct(noReading, DAYS.length)}`,
		);

		console.log(
			`effective difficulty: mean ${mean(diffs).toFixed(2)}  p10 ${q(diffs, 0.1).toFixed(2)}  median ${q(diffs, 0.5).toFixed(2)}  p90 ${q(diffs, 0.9).toFixed(2)}`,
		);

		console.log(
			`  demanding at the OLD cut 5.5: ${pct(diffs.filter((x) => x >= OLD_CUT).length, diffs.length)}   at the shipped cut 6.5: ${pct(diffs.filter((x) => x >= DEMANDING_CUT).length, diffs.length)}`,
		);

		console.log(
			`raw enjoyment:        mean ${mean(enjs).toFixed(2)}  p10 ${q(enjs, 0.1).toFixed(2)}  median ${q(enjs, 0.5).toFixed(2)}  p90 ${q(enjs, 0.9).toFixed(2)}   enjoyable: ${pct(enjs.filter((x) => x >= ENJOYABLE_CUT).length, enjs.length)}`,
		);

		// What a single 0–10 pair has to read to clear each cut.
		const under = (cut: number) => {
			let n = 0;

			for (let m = 0; m <= 10; m++)
				for (let p = 0; p <= 10; p++)
					if (
						getEffectiveDifficulty({
							mentalDifficulty: m,
							physicalDifficulty: p,
						}) < cut
					)
						n++;

			return n;
		};

		console.log(
			`single-task m/p pairs below the cut: ${under(OLD_CUT)}/121 at 5.5, ${under(DEMANDING_CUT)}/121 at 6.5`,
		);

		// The spillover's own contribution under the old cut: pairs the user rated
		// at or below the slider midpoint on BOTH dimensions, still called demanding.
		const inflated: string[] = [];

		for (let m = 0; m <= 5; m++)
			for (let p = 0; p <= 5; p++)
				if (
					getEffectiveDifficulty({
						mentalDifficulty: m,
						physicalDifficulty: p,
					}) >= OLD_CUT
				)
					inflated.push(`${m}/${p}`);

		console.log(
			`pairs with NEITHER dimension above 5 that the old cut called demanding: ${inflated.length}/36 — ${inflated.join(' ')}`,
		);
	});

	it('2. label mix, old law against shipped', () => {
		const before: Record<string, number> = {
			flow: 0,
			grind: 0,
			cruise: 0,
			routine: 0,
			none: 0,
		};

		const after: Record<string, number> = {
			flow: 0,
			grind: 0,
			cruise: 0,
			routine: 0,
			none: 0,
		};

		const example: Record<string, string> = {};
		let relabelled = 0;

		DAYS.forEach((d, i) => {
			const old = oldQuadrant(d.tasks);
			const now = calculateDailyQuadrant(PLANS[i]);
			before[old]++;
			after[now ?? 'none']++;
			example[now ?? 'none'] ??= dump(d);

			if (now !== null && now !== old) relabelled++;
		});

		for (const key of ['flow', 'grind', 'cruise', 'routine', 'none'] as const)
			console.log(
				`${key.padEnd(8)} before ${String(before[key]).padStart(3)} ${pct(before[key], DAYS.length).padStart(6)} → after ${String(after[key]).padStart(3)} ${pct(after[key], DAYS.length).padStart(6)}  ${example[key] ?? '— UNREACHABLE'}`,
			);

		console.log(
			`days the change relabels (excluding the new no-reading days): ${relabelled}/${DAYS.length} = ${pct(relabelled, DAYS.length)}`,
		);
	});

	it('3. distance to the cut, and what a flip gate at 0.25 suppresses', () => {
		let thin = 0;
		let flippable = 0;
		let read = 0;
		let thinnest = Infinity;
		let thinnestDay = '';

		DAYS.forEach((d, i) => {
			const margin = calculateQuadrantMargin(PLANS[i]);

			if (margin === null) return;

			read++;

			if (margin < 0.25) thin++;

			if (margin < thinnest) {
				thinnest = margin;
				thinnestDay = dump(d);
			}

			const base = calculateDailyQuadrant(PLANS[i]);

			const flips = d.tasks.some((t, index) =>
				(
					[
						['mentalDifficulty', 1],
						['mentalDifficulty', -1],
						['physicalDifficulty', 1],
						['physicalDifficulty', -1],
						['enjoyment', 1],
						['enjoyment', -1],
					] as const
				).some(([field, delta]) => {
					const value = t[field] + delta;

					if (value < (field === 'enjoyment' ? 1 : 0) || value > 10) return false;

					const edited = d.tasks.map((x, j) =>
						index === j
							? {
									...x,
									[field]: value,
								}
							: x,
					);

					const moved = calculateDailyQuadrant(
						plan({
							...d,
							tasks: edited,
						}),
					);

					return moved !== null && moved !== base;
				}),
			);

			if (flips) flippable++;
		});

		console.log(`margin to the nearer cut < 0.25: ${thin}/${read} = ${pct(thin, read)}`);

		console.log(
			`relabelled by ONE ±1 slider point on ONE task (re-solved): ${flippable}/${read} = ${pct(flippable, read)}`,
		);

		console.log(`thinnest margin ${thinnest.toFixed(4)} — ${thinnestDay}`);
	});

	it('4. what hour-weighting moved', () => {
		let compared = 0;
		let disagree = 0;
		let unfundedVoters = 0;
		let first = '';

		DAYS.forEach((d, i) => {
			const p = PLANS[i];
			const a = axesOf(p);

			if (!a) return;

			compared++;

			if (p.some((t) => t.suggestedHours <= 0)) unfundedVoters++;

			// Same cut, same scope — only the weighting differs.
			const counted = label(
				mean(p.map(getEffectiveDifficulty)),
				mean(p.map((t) => t.enjoyment)),
				DEMANDING_CUT,
			);

			const weighted = label(a.diff, a.enj, DEMANDING_CUT);

			if (counted !== weighted) {
				disagree++;
				first ||= `count ${counted} vs hours ${weighted} — ${dump(d)} → h ${p.map((t) => t.suggestedHours).join('/')}`;
			}
		});

		console.log(
			`days carrying at least one unfunded task, which used to vote: ${unfundedVoters}/${compared} = ${pct(unfundedVoters, compared)}`,
		);

		console.log(
			`weighting alone changes the label: ${disagree}/${compared} = ${pct(disagree, compared)}`,
		);

		console.log(`first: ${first || '— none'}`);
	});

	it('5. what the 2×2 adds over the Avg Enjoyment row beside it', () => {
		const arm = (cut: number) => {
			let discriminates = 0;
			let agrees = 0;
			let read = 0;

			for (const p of PLANS) {
				const a = axesOf(p);

				if (!a) continue;

				read++;

				if (a.diff < cut) discriminates++;

				if (label(a.diff, a.enj, cut) === (a.enj >= ENJOYABLE_CUT ? 'flow' : 'grind')) agrees++;
			}

			return `difficulty axis below the cut ${pct(discriminates, read)} — label = threshold on enjoyment alone ${pct(agrees, read)}`;
		};

		console.log(`old cut 5.5: ${arm(OLD_CUT)}`);
		console.log(`cut 6.5:     ${arm(DEMANDING_CUT)}`);
	});

	it('6. does history read a day the way the dashboard does', () => {
		let compared = 0;
		let disagree = 0;
		let first = '';

		DAYS.forEach((d, i) => {
			const dashboard = calculateDailyQuadrant(PLANS[i]);

			const summary = summarizeSession({
				date: '2026-08-07',
				tasks: d.tasks,
				availableHours: d.availableHours,
				switchCost: d.switchCost,
			});

			if (dashboard === null && summary.quadrant === null) return;

			compared++;

			if (dashboard !== summary.quadrant) {
				disagree++;
				first ||= `dashboard ${dashboard} vs history ${summary.quadrant} — ${dump(d)}`;
			}
		});

		console.log(
			`history disagrees with the dashboard: ${disagree}/${compared} = ${pct(disagree, compared)}`,
		);

		console.log(`first: ${first || '— none'}`);
	});
});
