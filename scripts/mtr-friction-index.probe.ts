/**
 * What is true of the Friction Index (`calculateFrictionIndex`) over a day
 * space the allocator actually produces.
 *
 * A fix removed the metric's asymmetry (mapped E ∈ [1,5] vs β ∈ [1,2]) by
 * moving to raw 1–10 scales, and pinned the two endpoints by fixture:
 * loved-hard = 0, difficulty-10/enjoyment-1 = 100. Neither the fix nor the
 * suite says anything about the INTERIOR, which is what the dashboard renders
 * and what `AXIS_BAND.frictionIndex` bands. Four questions:
 *
 * 1. **Is the reading the formula?** Recompute
 *    `Σ max(0, Eᵤ − β)·h / (9·Σh)` independently from the returned plan.
 * 2. **What is reachable?** The band has a warning arm above 50 and a critical
 *    arm above 75. Can a plan the app itself builds land there?
 * 3. **Is the zero boundary where the math says it is?** "Difficulty you love
 *    is not friction" — but the comparison is EFFECTIVE difficulty (dominant +
 *    0.3·secondary) against a raw slider, so a task the user rated MORE
 *    enjoyable than either difficulty dimension can still carry a gap.
 *    Measured over the reachable 0–10 cube.
 * 4. **Is it its own reading?** Grind Density and Reward Density compare the
 *    same two quantities. Rank correlation over the sweep.
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

describe('Friction Index over a day space', () => {
	it('1. reading = formula, recomputed from the returned plan', () => {
		let worst = 0;
		let worstDay = '';

		for (const d of DAYS) {
			const p = plan(d);
			const hours = p.reduce((s, t) => s + t.suggestedHours, 0);

			const expected =
				hours <= 0
					? 0
					: Math.round(
							(p.reduce(
								(s, t) =>
									s + Math.max(0, getEffectiveDifficulty(t) - t.enjoyment) * t.suggestedHours,
								0,
							) /
								(9 * hours)) *
								100,
						);

			const gap = Math.abs(calculateFrictionIndex(p) - expected);

			if (gap > worst) {
				worst = gap;
				worstDay = dump(d);
			}
		}

		console.log(`1. max |reading − recomputed| over ${DAYS.length} days: ${worst} ${worstDay}`);
	});

	it('2. reachable range and band occupancy', () => {
		const readings = DAYS.map((d) => calculateFrictionIndex(plan(d)));

		const band = (v: number) =>
			v <= 25 ? 'success' : v <= 50 ? 'neutral' : v <= 75 ? 'warning' : 'critical';

		const counts: Record<string, number> = {
			success: 0,
			neutral: 0,
			warning: 0,
			critical: 0,
		};

		for (const v of readings) counts[band(v)] += 1;

		const sorted = [...readings].sort((a, b) => a - b);
		const q = (f: number) => sorted[Math.floor(f * (sorted.length - 1))];

		console.log(
			`2. min ${sorted[0]} p50 ${q(0.5)} p90 ${q(0.9)} p99 ${q(0.99)} max ${sorted[sorted.length - 1]} | ` +
				`bands success ${counts.success} neutral ${counts.neutral} warning ${counts.warning} critical ${counts.critical}`,
		);

		const worst = DAYS.map((d, i) => ({
			d,
			v: readings[i],
		})).sort((a, b) => b.v - a.v)[0];

		console.log(`   worst day ${worst.v}%: ${dump(worst.d)}`);
	});

	it("3. zero boundary vs the user's own two sliders (spillover asymmetry)", () => {
		const cells = [];

		for (let m = 0; m <= 10; m += 1) {
			for (let p = 0; p <= 10; p += 1) {
				for (let e = 1; e <= 10; e += 1) {
					cells.push({
						m,
						p,
						e,
						gap:
							getEffectiveDifficulty({
								mentalDifficulty: m,
								physicalDifficulty: p,
							}) - e,
					});
				}
			}
		}

		// The user rated the task MORE enjoyable than either difficulty dimension,
		// yet the effective composite still exceeds enjoyment.
		const inverted = cells
			.filter((c) => c.e > c.m && c.e > c.p && c.gap > 0)
			.sort((a, b) => b.gap - a.gap);

		const worst = inverted[0];

		console.log(
			`3. ${inverted.length}/${cells.length} cells (${((inverted.length / cells.length) * 100).toFixed(1)}%) read friction > 0 ` +
				`though enjoyment beats BOTH difficulty sliders; worst m${worst.m}/p${worst.p}/e${worst.e} → ` +
				`gap ${worst.gap.toFixed(1)} = ${Math.round((worst.gap / 9) * 100)}%`,
		);
	});

	it('4. is it its own reading? (vs Grind Density, Reward Density)', () => {
		const rows = DAYS.map((d) => {
			const p = plan(d);

			return {
				friction: calculateFrictionIndex(p),
				grind: calculateGrindDensity(p).percent,
				reward: calculateRewardDensity(p) ?? 0,
			};
		});

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
			`4. Spearman(friction, grind) = ${spearman(
				rows.map((r) => r.friction),
				rows.map((r) => r.grind),
			).toFixed(4)} | Spearman(friction, reward) = ${spearman(
				rows.map((r) => r.friction),
				rows.map((r) => r.reward),
			).toFixed(4)}`,
		);
	});

	it('5. monotonicity: enjoyment never raises it, difficulty never lowers it', () => {
		// Two readings per perturbation: RE-PLANNED (the allocator re-funds the
		// day, which is what the dashboard shows) and FIXED-hours (the formula
		// alone, holding the original allocation). Only the second is a claim
		// about the metric; the first also carries the allocator's response.
		/** The same edit read against the ORIGINAL allocation: the formula alone. */
		const atHours = (tasks: Task[], p: SuggestedTask[]): SuggestedTask[] =>
			p.map((s) => ({
				...s,
				...tasks.find((t) => t.id === s.id)!,
			}));

		const edits = DAYS.flatMap((d) =>
			d.tasks.flatMap((t, i) => [
				{
					d,
					i,
					axis: 'e' as const,
					tasks:
						t.enjoyment < 10
							? d.tasks.map((x, j) =>
									j === i
										? {
												...x,
												enjoyment: x.enjoyment + 1,
											}
										: x,
								)
							: null,
				},
				{
					d,
					i,
					axis: 'm' as const,
					tasks:
						t.mentalDifficulty < 10
							? d.tasks.map((x, j) =>
									j === i
										? {
												...x,
												mentalDifficulty: x.mentalDifficulty + 1,
											}
										: x,
								)
							: null,
				},
			]),
		).filter((edit) => edit.tasks !== null);

		const deltas = edits.map((edit) => {
			const p = plan(edit.d);
			const base = calculateFrictionIndex(p);

			return {
				...edit,
				replanned:
					calculateFrictionIndex(
						plan({
							...edit.d,
							tasks: edit.tasks!,
						}),
					) - base,
				fixed: calculateFrictionIndex(atHours(edit.tasks!, p)) - base,
			};
		});

		const up = deltas
			.filter((x) => x.axis === 'e' && x.replanned > 0)
			.sort((a, b) => b.replanned - a.replanned);

		const down = deltas
			.filter((x) => x.axis === 'm' && x.replanned < 0)
			.sort((a, b) => a.replanned - b.replanned);

		console.log(
			`5. FIXED hours (formula alone), ${deltas.length} perturbations: ` +
				`+1 enjoyment raised friction ${deltas.filter((x) => x.axis === 'e' && x.fixed > 0).length}×, ` +
				`+1 mental difficulty lowered it ${deltas.filter((x) => x.axis === 'm' && x.fixed < 0).length}×`,
		);

		console.log(
			`   RE-PLANNED (dashboard): +1 enjoyment RAISED it ${up.length}× (worst +${up[0]?.replanned ?? 0} pts), ` +
				`+1 difficulty LOWERED it ${down.length}× (worst ${down[0]?.replanned ?? 0} pts)`,
		);

		console.log(
			`   worst enjoyment inversion: ${dump(up[0].d)} [task ${up[0].i + 1} e+1 → +${up[0].replanned}]`,
		);
	});
});
