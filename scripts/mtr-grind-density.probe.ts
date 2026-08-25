/**
 * What is true of Grind Density (`calculateGrindDensity`) over a day space the
 * allocator actually produces.
 *
 * The metric is one predicate over a count — `|{t funded : Eᵤ(t) > βᵤ(t)}| / m`,
 * plan-scoped, unweighted by hours. Six questions:
 *
 * 1. **Is the reading the formula?** Recompute from the returned plan.
 * 2. **What can it read, and how coarse is a step?** The value is quantized to
 *    100/m, and `AXIS_BAND.grindDensity` cuts at 25/50/75 — so on a small plan
 *    one task crossing the threshold can cross two bands. This is why the row
 *    renders the fraction beside the percent.
 * 3. **What did unfunded tasks vote?** The fix: a 0 h task is work the plan
 *    does NOT do, where Friction and Reward weigh it 0 already. The reading arm
 *    only: the fix's companion figure — the 79 free defer-an-unfunded-task
 *    options the advisor used to offer — was measured against the
 *    pre-retirement advisor and cannot be re-run, because the axis was retired
 *    and no grind-density finding exists to carry a lever.
 * 4. **Where is the threshold?** `>` compares EFFECTIVE difficulty (a composite,
 *    dominant + 0.3·secondary) against the raw enjoyment slider — the zero
 *    boundary, but binary: a cell does not read "a little" grind, it counts.
 * 5. **Is it its own reading?** Same two inputs as Friction and Reward Density.
 * 6. **What would hours have said, and why is this no longer an advice axis?**
 *    The count and the hour-weighted share of the same predicate split bands on
 *    a quarter of days, that hour-weighted share is already Sustainable Work's
 *    complement, and the count moves further than the hours a defer actually
 *    gives up — a task-denominated axis under hour-priced levers.
 *
 * A probe, not a test: every rate below moves whenever the allocator moves.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateFrictionIndex,
	calculateGrindDensity,
	calculateRewardDensity,
	calculateSuggestedTasks,
	getEffectiveDifficulty,
	type SuggestedTask,
} from '$lib/business/model/metric/calculation';
import { ADVICE_AXES } from '$lib/business/model/metric/plan-advice';
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

const band = (v: number) =>
	v <= 25 ? 'success' : v <= 50 ? 'neutral' : v <= 75 ? 'warning' : 'critical';

describe('Grind Density over a day space', () => {
	it('1. reading = formula, recomputed from the returned plan', () => {
		let worst = 0;
		let worstDay = '';

		for (const d of DAYS) {
			const p = plan(d).filter((t) => t.suggestedHours > 0);

			const expected = !p.length
				? 0
				: Math.round(
						(p.filter((t) => getEffectiveDifficulty(t) > t.enjoyment).length / p.length) * 100,
					);

			const gap = Math.abs(calculateGrindDensity(plan(d)).percent - expected);

			if (gap > worst) {
				worst = gap;
				worstDay = dump(d);
			}
		}

		console.log(`1. max |reading − recomputed| over ${DAYS.length} days: ${worst} ${worstDay}`);
	});

	it('2. reachable range, band occupancy, and the size of one task flip', () => {
		const rows = DAYS.map((d) => {
			const reading = calculateGrindDensity(plan(d));

			return {
				d,
				v: reading.percent,
				n: reading.funded,
			};
		}).filter((r) => r.n > 0);

		const counts: Record<string, number> = {
			success: 0,
			neutral: 0,
			warning: 0,
			critical: 0,
		};

		for (const r of rows) counts[band(r.v)] += 1;

		const sorted = rows.map((r) => r.v).sort((a, b) => a - b);
		const q = (f: number) => sorted[Math.floor(f * (sorted.length - 1))];

		console.log(
			`2. min ${sorted[0]} p50 ${q(0.5)} p90 ${q(0.9)} max ${sorted[sorted.length - 1]} | ` +
				`bands success ${counts.success} neutral ${counts.neutral} warning ${counts.warning} critical ${counts.critical} | ` +
				`${new Set(sorted).size} distinct values`,
		);

		// One task crossing the threshold moves the reading by 100/n. How many
		// bands can that single flip cross?
		const jumps = rows.map((r) => {
			const step = 100 / r.n;

			const bandsCrossed = new Set(
				[r.v, Math.min(100, r.v + step), Math.max(0, r.v - step)].map((v) => band(Math.round(v))),
			).size;

			return {
				...r,
				step,
				bandsCrossed,
			};
		});

		const multi = jumps.filter((j) => j.bandsCrossed > 2);

		console.log(
			`   plan sizes: ${[1, 2, 3, 4].map((n) => `n=${n}: ${rows.filter((r) => r.n === n).length}`).join(', ')}, ` +
				`n≥5: ${rows.filter((r) => r.n >= 5).length} | one flip = ${Math.round(100 / 1)}pp at n=1, ` +
				`${Math.round(100 / 3)}pp at n=3`,
		);

		console.log(
			`   ${multi.length}/${rows.length} days sit where ONE task flipping crosses ≥2 band boundaries; ` +
				`n=1 days (reading is only ever 0 or 100): ${rows.filter((r) => r.n === 1).length}`,
		);
	});

	it('3. what unfunded (0 h) tasks used to vote', () => {
		/** The old rule: every task in the plan is one of `n`. */
		const oldRule = (p: SuggestedTask[]) =>
			p.length
				? Math.round(
						(p.filter((t) => getEffectiveDifficulty(t) > t.enjoyment).length / p.length) * 100,
					)
				: 0;

		const rows = DAYS.map((d) => {
			const p = plan(d);
			const reading = calculateGrindDensity(p);

			return {
				d,
				all: oldRule(p),
				fundedOnly: reading.percent,
				unfunded: p.length - reading.funded,
				n: p.length,
			};
		});

		const withUnfunded = rows.filter((r) => r.unfunded > 0);
		const moved = withUnfunded.filter((r) => r.all !== r.fundedOnly);
		const bandMoved = moved.filter((r) => band(r.all) !== band(r.fundedOnly));

		const worst = [...moved].sort(
			(a, b) => Math.abs(b.all - b.fundedOnly) - Math.abs(a.all - a.fundedOnly),
		)[0];

		console.log(
			`3. ${withUnfunded.length}/${rows.length} days carry an unfunded task; on ${moved.length} of them the OLD rule ` +
				`disagreed with the shipped funded-only reading (${bandMoved.length} in a different BAND)`,
		);

		if (worst) {
			console.log(
				`   worst: old ${worst.all}% vs work-you-will-do ${worst.fundedOnly}% ` +
					`(${worst.unfunded}/${worst.n} unfunded) — ${dump(worst.d)}`,
			);
		}

		// The advisor's free "defer a task you were not going to touch" lever, which
		// this fix removed, is moot from both ends now: the axis was retired
		// outright, so no grind-density finding exists to carry any lever at all.
		// Question 6 measures what replaced it.
	});

	it('4. the threshold: composite difficulty vs the raw enjoyment slider', () => {
		const cells = [];

		for (let m = 0; m <= 10; m += 1) {
			for (let p = 0; p <= 10; p += 1) {
				for (let e = 1; e <= 10; e += 1) {
					cells.push({
						m,
						p,
						e,
						grind:
							getEffectiveDifficulty({
								mentalDifficulty: m,
								physicalDifficulty: p,
							}) > e,
					});
				}
			}
		}

		const inverted = cells.filter((c) => c.grind && c.e > c.m && c.e > c.p);

		console.log(
			`4. ${inverted.length}/${cells.length} cells (${((inverted.length / cells.length) * 100).toFixed(1)}%) COUNT as a grind ` +
				`though enjoyment beats both difficulty sliders; e.g. ${inverted
					.slice(0, 3)
					.map((c) => `m${c.m}/p${c.p}/e${c.e}`)
					.join(', ')}`,
		);

		// How often does that fire on days the allocator builds?
		let grindTasks = 0;
		let invertedTasks = 0;

		for (const d of DAYS) {
			for (const t of plan(d).filter((s) => s.suggestedHours > 0)) {
				if (getEffectiveDifficulty(t) <= t.enjoyment) continue;

				grindTasks += 1;

				if (t.enjoyment > t.mentalDifficulty && t.enjoyment > t.physicalDifficulty) {
					invertedTasks += 1;
				}
			}
		}

		console.log(
			`   on seeded days: ${invertedTasks}/${grindTasks} counted grinds (${((invertedTasks / grindTasks) * 100).toFixed(1)}%) ` +
				`are tasks the user rated more enjoyable than either difficulty dimension`,
		);

		// Ties: the metric is strict `>`, so difficulty == enjoyment is not a grind.
		const ties = cells.filter(
			(c) =>
				getEffectiveDifficulty({
					mentalDifficulty: c.m,
					physicalDifficulty: c.p,
				}) === c.e,
		).length;

		console.log(`   ties (Eᵤ === βᵤ, not counted): ${ties}/${cells.length} cells`);
	});

	it('5. is it its own reading? (vs Friction Index, Reward Density)', () => {
		// Days that work no hours are dropped: Reward Density has no reading there
		// and neither has this one.
		const rows = DAYS.map((d) => {
			const p = plan(d);

			return {
				grind: calculateGrindDensity(p).percent,
				friction: calculateFrictionIndex(p),
				reward: calculateRewardDensity(p),
			};
		}).filter((r): r is typeof r & { reward: number } => r.reward !== null);

		const spearman = (a: number[], b: number[]) => {
			const rank = (xs: number[]) => {
				const order = xs
					.map((x, i) => ({
						x,
						i,
					}))
					.sort((u, v) => u.x - v.x);

				const r = new Array(xs.length).fill(0);

				for (let i = 0; i < order.length;) {
					let j = i;
					while (j + 1 < order.length && order[j + 1].x === order[i].x) j += 1;
					const avg = (i + j) / 2 + 1;
					for (let k = i; k <= j; k += 1) r[order[k].i] = avg;
					i = j + 1;
				}

				return r;
			};

			const ra = rank(a);
			const rb = rank(b);
			const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
			const ma = mean(ra);
			const mb = mean(rb);
			let num = 0;
			let da = 0;
			let db = 0;

			for (let i = 0; i < ra.length; i += 1) {
				num += (ra[i] - ma) * (rb[i] - mb);
				da += (ra[i] - ma) ** 2;
				db += (rb[i] - mb) ** 2;
			}

			return num / Math.sqrt(da * db);
		};

		console.log(
			`5. Spearman(grind, friction) = ${spearman(
				rows.map((r) => r.grind),
				rows.map((r) => r.friction),
			).toFixed(4)} | Spearman(grind, reward) = ${spearman(
				rows.map((r) => r.grind),
				rows.map((r) => r.reward),
			).toFixed(4)}`,
		);
	});

	it('6. what hours would say instead, and why this is no longer an axis', () => {
		/** The same predicate, weighted by allocated hours. */
		const hourShare = (p: SuggestedTask[]) => {
			const funded = p.filter((t) => t.suggestedHours > 0);
			const hours = funded.reduce((sum, t) => sum + t.suggestedHours, 0);

			if (!hours) return null;

			const grind = funded
				.filter((t) => getEffectiveDifficulty(t) > t.enjoyment)
				.reduce((sum, t) => sum + t.suggestedHours, 0);

			return Math.round((grind / hours) * 100);
		};

		const rows = DAYS.map((d) => {
			const p = plan(d);
			const reading = calculateGrindDensity(p);

			return {
				d,
				n: reading.funded,
				count: reading.percent,
				hours: hourShare(p),
				reward: calculateRewardDensity(p),
			};
		}).filter((r): r is typeof r & { hours: number } => r.hours !== null);

		const gaps = rows.map((r) => Math.abs(r.count - r.hours)).sort((a, b) => a - b);
		const q = (f: number) => gaps[Math.floor(f * (gaps.length - 1))];
		const bandSplit = rows.filter((r) => band(r.count) !== band(r.hours));

		const worst = [...rows].sort(
			(a, b) => Math.abs(b.count - b.hours) - Math.abs(a.count - a.hours),
		)[0];

		console.log(
			`6. |count − hours| over ${rows.length} funded days: p50 ${q(0.5)}pp p90 ${q(0.9)}pp ` +
				`max ${gaps[gaps.length - 1]}pp | exact agreement ${gaps.filter((g) => !g).length}, ` +
				`count overstates ${rows.filter((r) => r.count > r.hours).length}, ` +
				`understates ${rows.filter((r) => r.count < r.hours).length}`,
		);

		console.log(
			`   ${bandSplit.length}/${rows.length} days land in a different BAND under the two — ` +
				`worst: count ${worst.count}% ${band(worst.count)} (n=${worst.n}) vs hours ` +
				`${worst.hours}% ${band(worst.hours)} — ${dump(worst.d)}`,
		);

		// Weighting this metric by hours would not add a reading, it would duplicate
		// Sustainable Work, which measures the sustainable side of the same
		// partition over the same hours, so `100 − reward` IS the hour-weighted
		// grind share.
		const duplicate = Math.max(
			...rows.map((r) => (r.reward === null ? 0 : Math.abs(100 - r.reward - r.hours))),
		);

		console.log(
			`   max |(100 − Sustainable Work) − hour-weighted grind| = ${duplicate}pp: ` +
				`weighting this by hours is a duplicate row, not a repair`,
		);

		// Why it is not an advice axis: a count denominated in tasks, moved by levers
		// priced in hours. Deferring the day's smallest funded grind drops it from
		// BOTH the count and the denominator, so the step is the rounded reading's
		// own difference, for the task's share of the booked time — the ratio the
		// advisor was buying at ~3% of Σ P̄ a step.
		const reading = (grinds: number, funded: number) =>
			funded ? Math.round((grinds / funded) * 100) : 0;

		const levers = [];

		for (const d of DAYS) {
			const p = plan(d).filter((t) => t.suggestedHours > 0);
			const total = p.reduce((sum, t) => sum + t.suggestedHours, 0);
			const grinds = p.filter((t) => getEffectiveDifficulty(t) > t.enjoyment);

			if (!total || !grinds.length) continue;

			const smallest = grinds.reduce((a, b) => (b.suggestedHours < a.suggestedHours ? b : a));

			levers.push({
				d,
				share: (smallest.suggestedHours / total) * 100,
				step: reading(grinds.length, p.length) - reading(grinds.length - 1, p.length - 1),
				hours: smallest.suggestedHours,
			});
		}

		const mispriced = levers.filter((l) => l.step > 2 * l.share);
		const byRatio = [...levers].sort((a, b) => b.step / b.share - a.step / a.share);

		console.log(
			`   ${mispriced.length}/${levers.length} days have a funded grind whose deferral moves the COUNT ` +
				`more than twice as far as it moves the day's booked hours`,
		);

		if (byRatio[0]) {
			console.log(
				`   worst ratio: −${byRatio[0].step}pp for ${byRatio[0].hours}h = ` +
					`${byRatio[0].share.toFixed(1)}% of booked time — ${dump(byRatio[0].d)}`,
			);
		}

		console.log(
			`   axis retired: ADVICE_AXES has ${ADVICE_AXES.length} axes and grindDensity is ` +
				`${(ADVICE_AXES as readonly string[]).includes('grindDensity') ? 'still one' : 'not one'}`,
		);
	});
});
