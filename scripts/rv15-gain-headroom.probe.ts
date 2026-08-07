/**
 * Measurements behind MATH.md §21: how much headroom the Zenith Gain has to
 * report, and why a correct optimizer against a correct baseline still reads
 * ~2-3% on an ordinary day.
 *
 * §19 made the gain HONEST — it no longer bills the baseline for switches it
 * never makes. This probe asks the next question: honest and small, or honest
 * and broken? The answer is the first, and the reason is structural rather than
 * a defect, so it is worth writing down before someone "fixes" the number.
 *
 * The reference day is a real reported one — piano (P1 M7 E7), Gym (P8 M1 E5),
 * guitar (P0 M4 E9), network (P0 M5 E2) on a 4 h budget, which the dashboard
 * reads as +2.9%. Arms A/I reproduce that screen exactly, including each task's
 * rendered ϕ and stop-by, so the numbers below sit on a day that existed rather
 * than on a generator's idea of one.
 *
 * Every alternative plan here is billed for its OWN switches — a plan funding m
 * tasks may only spend budget − (m−1)·switchCost on work — and lands on the
 * 15-minute lattice. Both matter: an unbilled continuous split overruns the day
 * AND collects a full activation bonus on sub-block crumbs, which is exactly
 * how the pre-§13.2 baseline beat plans that could actually be executed.
 *
 * Usage: npm run probe -- rv15-gain-headroom
 */

import { describe, it } from 'vitest';
import {
	averageProductivity,
	BLOCK_HOURS,
	calculatePooledAllocations,
	calculateTaskParams,
	calculateTotalProductivity,
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
	expectedAverageProductivity,
	findOptimalSingleTaskTime,
	fitUserConstants,
	phiParameterStd,
	pooledProductivityGain,
	type PooledTaskInput,
} from '$lib/business/model/zenith';

/**
 * What the app actually runs with. `fitUserConstants([])` returns the DEFAULT
 * constants together with the PRIOR as a posterior (§13.1) — so a user with no
 * logged sessions is not modelled as certain, they are modelled as maximally
 * uncertain. Omitting this is not a rounding detail: σ_ϕ > 0 shrinks every T*
 * (piano 3h56 → 3h45 on screen) and moves the reported gain.
 */
const FIT = fitUserConstants([]);
const POST = FIT.posterior;
const SPILLOVER = 0.3;

function task(title: string, physical: number, mental: number, enjoyment: number): PooledTaskInput {
	const dominant = Math.max(physical, mental);
	const secondary = Math.min(physical, mental);

	return {
		title,
		difficulty: Math.min(10, Math.max(1, dominant + SPILLOVER * secondary)),
		enjoyment,
		cognitiveWeight: mental / 10,
		physicalWeight: physical / 10,
	};
}

/** The user's reported day. */
const DAY: PooledTaskInput[] = [
	task('piano', 1, 7, 7),
	task('Gym', 8, 1, 5),
	task('guitar', 0, 4, 9),
	task('network', 0, 5, 2),
];

const hm = (h: number) => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

const planOf = (tasks: PooledTaskInput[], budget: number): number[] =>
	calculatePooledAllocations(
		tasks,
		budget,
		DEFAULT_CAPACITY_POOLS,
		DEFAULT_USER_CONSTANTS,
		DEFAULT_SWITCH_COST,
		POST,
	).map((a) => a.allocatedHours);

const value = (tasks: PooledTaskInput[], hours: number[]) =>
	calculateTotalProductivity(tasks, hours, DEFAULT_USER_CONSTANTS, POST);

/** Total output ∫p dt — the objective the planner deliberately does NOT use (§0). */
const output = (tasks: PooledTaskInput[], hours: number[]) =>
	tasks.reduce((sum, t, i) => {
		const { a, p0, k } = calculateTaskParams(t, DEFAULT_USER_CONSTANTS);

		return sum + hours[i] * averageProductivity(hours[i], a, p0, k);
	}, 0);

/**
 * Scale `shares` to a plan that actually fits the day AND lands on the app's own
 * 15-minute lattice: a plan opening m tasks only has budget − (m−1)·switchCost
 * of work time, and cannot hand anyone a sub-block sliver.
 *
 * The lattice is not a detail. A CONTINUOUS split is free to give every task a
 * 4-minute crumb and collect its full ≈ p₀ activation bonus, which is how the
 * pre-§13.2 baseline beat plans that were actually executable. Any task whose
 * proportional share rounds below one block is dropped, and the bill is
 * recomputed for the smaller m.
 */
function feasible(shares: number[], budget: number): number[] {
	let live = shares.map((s) => (s > 1e-9 ? s : 0));

	for (;;) {
		const m = live.filter((s) => s > 0).length;

		if (m === 0) return live.map(() => 0);

		const work = Math.max(0, budget - (m > 1 ? (m - 1) * DEFAULT_SWITCH_COST : 0));
		const blocks = Math.floor(work / BLOCK_HOURS + 1e-9);

		if (blocks < m) {
			// Cannot seat them all; drop the smallest share and re-bill.
			const smallest = live.indexOf(Math.min(...live.filter((s) => s > 0)));
			live = live.map((s, i) => (i === smallest ? 0 : s));
			continue;
		}

		// One block each, then largest-remainder on the rest.
		const total = live.reduce((s, x) => s + x, 0);
		const want = live.map((s) => (s > 0 ? ((blocks - m) * s) / total : 0));
		const give = want.map(Math.floor);
		let left = blocks - m - give.reduce((s, x) => s + x, 0);

		const byRemainder = want
			.map((w, i) => ({
				i,
				rem: w - Math.floor(w),
			}))
			.filter(({ i }) => live[i] > 0)
			.sort((x, y) => y.rem - x.rem);

		for (let j = 0; left > 0; j = (j + 1) % byRemainder.length, left--) give[byRemainder[j].i]++;

		return live.map((s, i) => (s > 0 ? (give[i] + 1) * BLOCK_HOURS : 0));
	}
}

describe('Zenith Gain — is 2.9% the optimizer failing or the baseline being good?', () => {
	it('A. reproduces the day and shows how concave each task curve is', () => {
		const budget = 4;

		const gain = pooledProductivityGain(
			DAY,
			budget,
			DEFAULT_CAPACITY_POOLS,
			DEFAULT_USER_CONSTANTS,
			DEFAULT_SWITCH_COST,
			POST,
		);

		const plan = planOf(DAY, budget);

		console.log(`\n=== A. the reported day, budget ${budget}h ===`);

		console.log(
			`optimized ${gain.optimized.toFixed(4)}  naive ${gain.naive.toFixed(4)}  gain ${gain.gainPercent}%`,
		);

		console.log(`plan: ${DAY.map((t, i) => `${t.title} ${hm(plan[i])}`).join(', ')}`);

		// ϕ and T* exactly as the task row renders them: expected under the
		// posterior, not the σ = 0 certainty values.
		const allocs = calculatePooledAllocations(
			DAY,
			budget,
			DEFAULT_CAPACITY_POOLS,
			DEFAULT_USER_CONSTANTS,
			DEFAULT_SWITCH_COST,
			POST,
		);

		console.log(`\nP̄ as a % of that task's own best, by session length:`);
		console.log(`  ${'task'.padEnd(9)}${'ϕ'.padEnd(7)}${'T*'.padEnd(7)}  15m  30m   1h   2h   4h`);

		for (const [i, t] of DAY.entries()) {
			const { E, beta, a, p0, phi } = calculateTaskParams(t, DEFAULT_USER_CONSTANTS);
			const sigma = phiParameterStd(E, beta, POST);
			const at = (h: number) => expectedAverageProductivity(h, a, p0, phi, sigma);
			const best = at(allocs[i].optimalHours);
			const pct = (h: number) => `${((100 * at(h)) / best).toFixed(0)}%`.padStart(5);

			console.log(
				`  ${t.title.padEnd(9)}${hm(phi).padEnd(7)}${hm(allocs[i].optimalHours).padEnd(7)}${[
					0.25, 0.5, 1, 2, 4,
				]
					.map(pct)
					.join('')}`,
			);
		}

		const ceiling = allocs.reduce((sum, alloc) => sum + alloc.optimalAvgProductivity, 0);
		const clock = allocs.reduce((s, alloc) => s + alloc.optimalHours, 0);

		const split = value(
			DAY,
			feasible(
				DAY.map(() => 1),
				budget,
			),
		);

		console.log(
			`\nceiling Σ P̄(T*) = ${ceiling.toFixed(4)}, but it needs ${hm(clock)} of clock, not ${budget}h`,
		);

		console.log(
			`feasible equal split at ${budget}h = ${split.toFixed(4)} = ${((100 * split) / ceiling).toFixed(1)}% of that ceiling`,
		);

		console.log(
			`→ the entire prize any allocator could ever win here is ${(((ceiling - split) / split) * 100).toFixed(1)}%, ` +
				`and most of it is unreachable at ${budget}h`,
		);
	});

	it('B. sweeps the budget — the gain is large exactly where selection bites', () => {
		console.log(`\n=== B. same 4 tasks, gain vs budget ===`);
		console.log(`budget   gain%   funded  plan`);

		for (let b = 0.5; b <= 12.0001; b += 0.5) {
			const g = pooledProductivityGain(
				DAY,
				b,
				DEFAULT_CAPACITY_POOLS,
				DEFAULT_USER_CONSTANTS,
				DEFAULT_SWITCH_COST,
				POST,
			);

			const plan = planOf(DAY, b);

			console.log(
				`${hm(b).padStart(6)}  ${g.gainPercent.toFixed(1).padStart(6)}   ` +
					`${String(plan.filter((h) => h > 0).length).padStart(4)}    ${plan.map(hm).join(' ')}`,
			);
		}
	});

	it('C. splits the optimizer edge into SELECTION vs SHAPE', () => {
		console.log(`\n=== C. where does the optimizer's edge come from? ===`);
		console.log(`budget  equalAll  equalOnChosen  optimized  | selection  shape`);

		for (const b of [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12]) {
			const plan = planOf(DAY, b);
			const chosen = plan.map((h) => (h > 0 ? 1 : 0));

			// Baseline: split across every task on the list.
			const all = value(
				DAY,
				feasible(
					DAY.map(() => 1),
					b,
				),
			);

			// Same equal split, but only over the tasks the optimizer decided to fund.
			const onChosen = value(DAY, feasible(chosen, b));
			const opt = value(DAY, plan);
			const pct = (x: number, from: number) => (from > 0 ? ((100 * x) / from).toFixed(1) : '—');

			console.log(
				`${hm(b).padStart(6)}  ${all.toFixed(4)}    ${onChosen.toFixed(4)}     ${opt.toFixed(4)}  |` +
					`${pct(onChosen - all, all).padStart(9)}% ${pct(opt - onChosen, all).padStart(6)}%`,
			);
		}
	});

	it('D. scores the plans a real person would actually run (all billed for switches)', () => {
		const budget = 4;
		const n = DAY.length;
		const plan = planOf(DAY, budget);
		const opt = value(DAY, plan);
		const stars = DAY.map((t) => findOptimalSingleTaskTime(t, DEFAULT_USER_CONSTANTS));
		// "Work the list top to bottom, each to its natural stopping point."
		const listOrder = new Array<number>(n).fill(0);
		let rem = budget;

		for (let i = 0; i < n; i++) {
			const take = Math.min(stars[i], Math.max(0, rem - (i > 0 ? DEFAULT_SWITCH_COST : 0)));

			if (take <= 0) break;

			listOrder[i] = take;
			rem -= take + (i > 0 ? DEFAULT_SWITCH_COST : 0);
		}

		const rows: [string, number[]][] = [
			[
				'equal split (the shipped baseline)',
				feasible(
					DAY.map(() => 1),
					budget,
				),
			],
			[
				'split by difficulty',
				feasible(
					DAY.map((t) => t.difficulty),
					budget,
				),
			],
			[
				'split by enjoyment (do the fun ones)',
				feasible(
					DAY.map((t) => t.enjoyment),
					budget,
				),
			],
			['list order, each to its own T*', listOrder],
			['all day on task #1', feasible([1, 0, 0, 0], budget)],
			['the two "important" ones only', feasible([1, 1, 0, 0], budget)],
		];

		console.log(`\n=== D. optimized vs plans a person would really run (${budget}h) ===`);
		console.log(`optimized Σ P̄ = ${opt.toFixed(4)}   [${plan.map(hm).join(' ')}]\n`);
		console.log(`${'plan'.padEnd(38)}${'Σ P̄'.padEnd(9)}${'gain'.padStart(8)}   hours`);

		for (const [label, hours] of rows) {
			const v = value(DAY, hours);

			console.log(
				`${label.padEnd(38)}${v.toFixed(4)}   ${(((opt - v) / v) * 100).toFixed(1).padStart(6)}%   ` +
					`[${hours.map(hm).join(' ')}]`,
			);
		}

		console.log(`\nsame plans under TOTAL OUTPUT ∫p dt (the objective §0 rejected):`);
		const optOut = output(DAY, plan);

		for (const [label, hours] of rows) {
			const v = output(DAY, hours);

			console.log(
				`${label.padEnd(38)}${v.toFixed(4)}   ${(((optOut - v) / v) * 100).toFixed(1).padStart(6)}%`,
			);
		}
	});

	it('E. how often does the gain clear a bar worth showing? (2000 random days)', () => {
		let seed = 20260807;

		const rnd = () => {
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};

		console.log(`\n=== E. gain distribution over random app-reachable days ===`);
		console.log(` n   budget    median    p90     p99    >5%    >10%   >25%    max`);

		for (const n of [2, 3, 4, 5, 6, 8]) {
			for (const budget of [2, 4, 8]) {
				const gains: number[] = [];

				for (let d = 0; d < 2000; d++) {
					const tasks = Array.from(
						{
							length: n,
						},
						(_, i) =>
							task(
								`t${i}`,
								Math.floor(rnd() * 11),
								Math.floor(rnd() * 11),
								1 + Math.floor(rnd() * 10),
							),
					);

					gains.push(
						pooledProductivityGain(
							tasks,
							budget,
							DEFAULT_CAPACITY_POOLS,
							DEFAULT_USER_CONSTANTS,
							DEFAULT_SWITCH_COST,
							POST,
						).gainPercent,
					);
				}

				gains.sort((a, b) => a - b);
				const q = (p: number) => gains[Math.floor(gains.length * p)];

				const share = (bar: number) =>
					`${((100 * gains.filter((g) => g > bar).length) / gains.length).toFixed(0)}%`.padStart(6);

				console.log(
					`${String(n).padStart(2)}   ${hm(budget).padStart(5)}   ${q(0.5).toFixed(1).padStart(6)}  ` +
						`${q(0.9).toFixed(1).padStart(6)}  ${q(0.99).toFixed(1).padStart(6)}  ` +
						`${share(5)} ${share(10)} ${share(25)}  ${gains[gains.length - 1].toFixed(0).padStart(5)}`,
				);
			}
		}
	});

	it('F. what makes a day have a big gain?', () => {
		console.log(`\n=== F. gain vs how unlike each other the tasks are (4h, n=4) ===`);
		// The label names the CONSTRUCTION; the spread it produces is measured, not
		// asserted — hand-guessed spreads in the label drifted from the real ones.
		console.log(`construction              gain%   measured ϕ spread`);

		// Hold the count and budget fixed; vary only how different the tasks are.
		const cases: [string, PooledTaskInput[]][] = [
			['four identical tasks', [0, 1, 2, 3].map((i) => task(`same${i}`, 0, 5, 5))],
			['mental 4..7', [4, 5, 6, 7].map((m, i) => task(`t${i}`, 0, m, 5))],
			['mental 2,5,7,9', [2, 5, 7, 9].map((m, i) => task(`t${i}`, 0, m, 5))],
			['the reported day', DAY],
			['mental 0,3,7,10', [0, 3, 7, 10].map((m, i) => task(`t${i}`, 0, m, 5))],
			[
				'mental AND enjoyment spread',
				[task('a', 0, 1, 10), task('b', 0, 4, 8), task('c', 0, 7, 3), task('d', 0, 10, 1)],
			],
		];

		for (const [label, tasks] of cases) {
			const phis = tasks.map((t) => calculateTaskParams(t, DEFAULT_USER_CONSTANTS).phi);
			const spread = Math.max(...phis) / Math.min(...phis);

			const g = pooledProductivityGain(
				tasks,
				4,
				DEFAULT_CAPACITY_POOLS,
				DEFAULT_USER_CONSTANTS,
				DEFAULT_SWITCH_COST,
				POST,
			);

			console.log(
				`${label.padEnd(26)}${g.gainPercent.toFixed(1).padStart(6)}   ` +
					`${spread.toFixed(2)}×  (ϕ = ${phis.map((p) => hm(p)).join(', ')})`,
			);
		}
	});

	it('G. ranks the optimizer against the plans you might otherwise have run', () => {
		let seed = 424242;

		const rnd = () => {
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};

		console.log(`\n=== G. the optimizer's rank among 20000 executable plans for the same day ===`);

		console.log(
			`A "plan you might have run": pick a random non-empty subset of the list,\n` +
				`spend the whole billed budget on it, split at random on the 15-min lattice.\n`,
		);

		console.log(
			`budget  worst   median    best  optimized  | vs median  vs worst  percentile  #plans beating it`,
		);

		for (const budget of [2, 3, 4, 6, 8]) {
			const opt = value(DAY, planOf(DAY, budget));
			const scores: number[] = [];

			for (let s = 0; s < 20000; s++) {
				// Random non-empty subset. The rescue index must be drawn ONCE, not
				// once per element inside the map — that draws n independent indices
				// and usually matches none of them, yielding an empty plan.
				let mask = DAY.map(() => rnd() < 0.5);

				if (!mask.some(Boolean)) {
					const pick = Math.floor(rnd() * DAY.length);
					mask = mask.map((_, i) => i === pick);
				}

				const m = mask.filter(Boolean).length;
				const work = Math.max(0, budget - (m > 1 ? (m - 1) * DEFAULT_SWITCH_COST : 0));
				const blocks = Math.floor(work / BLOCK_HOURS + 1e-9);

				if (blocks < m) continue;

				// One block each, then scatter the rest at random.
				const give = DAY.map((_, i) => (mask[i] ? 1 : 0));
				const idx = DAY.map((_, i) => i).filter((i) => mask[i]);

				for (let b = 0; b < blocks - m; b++) give[idx[Math.floor(rnd() * idx.length)]]++;

				scores.push(
					value(
						DAY,
						give.map((g) => g * BLOCK_HOURS),
					),
				);
			}

			scores.sort((a, b) => a - b);
			const median = scores[Math.floor(scores.length / 2)];
			const beat = scores.filter((s) => s > opt + 1e-12).length;
			const pct = (from: number) => `${(((opt - from) / from) * 100).toFixed(1)}%`.padStart(8);

			console.log(
				`${hm(budget).padStart(6)}  ${scores[0].toFixed(3)}  ${median.toFixed(3)}   ` +
					`${scores[scores.length - 1].toFixed(3)}     ${opt.toFixed(3)}  |` +
					`${pct(median)}  ${pct(scores[0])}     ` +
					`${((100 * scores.filter((s) => s <= opt).length) / scores.length).toFixed(2).padStart(6)}%` +
					`   ${String(beat).padStart(6)} / ${scores.length}`,
			);
		}
	});

	it('H. isolates SPLIT quality — random plans that all fund every task', () => {
		let seed = 99001;

		const rnd = () => {
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};

		console.log(`\n=== H. same day, but every sampled plan funds all 4 tasks ===`);

		console.log(
			`G mixed two things: picking a good SPLIT and funding everything. Holding the\n` +
				`funded set at all 4 leaves only the split, which is what the 2.9% measures.\n`,
		);

		console.log(
			`budget   worst  median   equalSplit  optimized  | vs median  vs equal  percentile`,
		);

		for (const budget of [2, 3, 4, 6, 8]) {
			const opt = value(DAY, planOf(DAY, budget));

			const equal = value(
				DAY,
				feasible(
					DAY.map(() => 1),
					budget,
				),
			);

			const n = DAY.length;
			const work = budget - (n - 1) * DEFAULT_SWITCH_COST;
			const blocks = Math.floor(work / BLOCK_HOURS + 1e-9);

			if (blocks < n) continue;

			const scores: number[] = [];

			for (let s = 0; s < 20000; s++) {
				const give = DAY.map(() => 1);

				for (let b = 0; b < blocks - n; b++) give[Math.floor(rnd() * n)]++;

				scores.push(
					value(
						DAY,
						give.map((g) => g * BLOCK_HOURS),
					),
				);
			}

			scores.sort((a, b) => a - b);
			const median = scores[Math.floor(scores.length / 2)];
			const pct = (from: number) => `${(((opt - from) / from) * 100).toFixed(1)}%`.padStart(8);

			console.log(
				`${hm(budget).padStart(6)}  ${scores[0].toFixed(3)}  ${median.toFixed(3)}    ` +
					`${equal.toFixed(3)}     ${opt.toFixed(3)}  |${pct(median)} ${pct(equal)}    ` +
					`${((100 * scores.filter((s) => s <= opt).length) / scores.length).toFixed(2).padStart(6)}%`,
			);
		}
	});
});

describe('which threshold is actually binding, budget by budget?', () => {
	it('I. flow / stopping / pools across the sweep', () => {
		console.log(`\n=== I. what limits the day at each budget? ===`);
		console.log(`budget  flow   atT*  cogUsed/4h  physUsed/6h  slack   gain%`);

		for (const b of [1, 2, 3, 4, 5, 6, 8, 10, 12]) {
			const allocs = calculatePooledAllocations(
				DAY,
				b,
				DEFAULT_CAPACITY_POOLS,
				DEFAULT_USER_CONSTANTS,
				DEFAULT_SWITCH_COST,
				POST,
			);

			const reached = allocs.filter((a) => a.allocatedHours >= a.phi).length;

			const atStar = allocs.filter(
				(a) => a.allocatedHours > 0 && a.allocatedHours >= a.optimalHours - 1e-9,
			).length;

			const cog = allocs.reduce((s, a, i) => s + a.allocatedHours * DAY[i].cognitiveWeight, 0);
			const phys = allocs.reduce((s, a, i) => s + a.allocatedHours * DAY[i].physicalWeight, 0);
			const work = allocs.reduce((s, a) => s + a.allocatedHours, 0);
			const m = allocs.filter((a) => a.allocatedHours > 0).length;
			const slack = b - work - (m > 1 ? (m - 1) * DEFAULT_SWITCH_COST : 0);

			const g = pooledProductivityGain(
				DAY,
				b,
				DEFAULT_CAPACITY_POOLS,
				DEFAULT_USER_CONSTANTS,
				DEFAULT_SWITCH_COST,
				POST,
			);

			console.log(
				`${hm(b).padStart(6)}   ${reached}/4    ${atStar}/4   ` +
					`${cog.toFixed(2).padStart(5)}       ${phys.toFixed(2).padStart(5)}      ` +
					`${hm(Math.max(0, slack))}  ${g.gainPercent.toFixed(1).padStart(5)}`,
			);
		}
	});
});
