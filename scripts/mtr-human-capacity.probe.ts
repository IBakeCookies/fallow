/**
 * What is true of the Human Capacity reading (`calculateHumanCapacity`) over a
 * day space — the metric MATH.md did not derive until later.
 *
 * Three questions, none of them answerable by the suite (which pins four
 * hand-built fixtures with externally-supplied hours, so it never sees a plan
 * the allocator actually produced):
 *
 * 1. **Is the reading the constraint?** The row claims to show how much of the
 *    sustainable pool the plan uses; the allocator constrains
 *    `Σ wᵢ·tᵢ ≤ pool` with `w = difficulty/10`. Recomputed independently from
 *    the returned plan, does `percent` equal
 *    `round(100·max(Σ w_cog·t / cogPool, Σ w_phys·t / physPool))`?
 *
 * 2. **What is reachable?** `AXIS_BAND.humanCapacity` has a critical arm above
 *    100 and both display paths gate a non-finite reading to N/A. Feasibility
 *    says neither can come from the app's own plan. Measured, not assumed.
 *
 * 3. **Does the row name the pool that binds?** Until 2026-08-06 the metric
 *    rounded each saturation and compared the ROUNDED pair, so any two
 *    saturations inside the same integer tied — and the tie went to cognitive.
 *    The rate is the question: a wrong `limitType` puts the wrong pool AND its
 *    wrong hour count into the row's description.
 *
 * A probe, not a test: every rate below moves whenever the allocator moves, and
 * the ones that matter are properties of a day space rather than of a fixture.
 * What it finds is pinned by one cheap fixture in the suite
 * (`calculation.test.ts`, "names the pool that binds"), never by the sweep.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateDailyMetrics,
	type DailyMetricsInput,
} from '$lib/business/model/metric/daily-metrics';
import { DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
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

const task = (id: number, mental: number, physical: number, enjoyment: number): Task => ({
	id,
	title: `t${id}`,
	mentalDifficulty: mental,
	physicalDifficulty: physical,
	enjoyment,
	createdAt: '2026-08-06',
	completed: false,
});

/**
 * The UI-reachable day space: integer sliders, budget on the 0.25 h lattice,
 * switch cost on the 5-minute one, and BOTH pools allowed to reach 0 — the
 * capacity fields accept it (injured user), which is the only way the Infinity
 * arm can be entered at all.
 */
function randomDays(count: number, seed: number): DailyMetricsInput[] {
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
					length: pick(1, 8, 1),
				},
				(_, index) => task(index + 1, pick(0, 10, 1), pick(0, 10, 1), pick(0, 10, 1)),
			),
			availableHours: pick(0.25, 14, 0.25),
			switchCost: pick(0, 30, 5) / 60,
			pools: {
				cognitiveHours: pick(0, 8, 0.5),
				physicalHours: pick(0, 8, 0.5),
			},
			constants: DEFAULT_USER_CONSTANTS,
			energyParams: DEFAULT_ENERGY_PARAMS,
		}),
	);
}

/** The pool draw of a solved plan, in the allocator's own currency. */
function demands(
	tasks: { mentalDifficulty: number; physicalDifficulty: number; suggestedHours: number }[],
) {
	return {
		cognitive: tasks.reduce((sum, t) => sum + (t.mentalDifficulty / 10) * t.suggestedHours, 0),
		physical: tasks.reduce((sum, t) => sum + (t.physicalDifficulty / 10) * t.suggestedHours, 0),
	};
}

const saturation = (demand: number, pool: number): number =>
	pool > 0 ? (demand / pool) * 100 : demand > 0.001 ? Infinity : 0;

const DAYS = 3000;
const SEED = 20260806;

describe('human capacity', () => {
	it('reproduces the allocator constraint, and stays inside it', () => {
		const days = randomDays(DAYS, SEED);
		let mismatch = 0;
		let over100 = 0;
		let infinite = 0;
		let poolBoundDays = 0;
		let worstOverdraw = 0;
		let widest = '';

		for (const day of days) {
			const metrics = calculateDailyMetrics(day);
			const { cognitive, physical } = demands(metrics.suggestedTasks);
			const cog = saturation(cognitive, day.pools!.cognitiveHours);
			const phys = saturation(physical, day.pools!.physicalHours);
			const expected = metrics.suggestedTasks.length ? Math.max(cog, phys) : 0;
			const got = metrics.humanCapacity.percent;

			if (got !== Math.round(expected)) {
				mismatch++;

				if (!widest)
					widest = `got ${got}, recomputed ${expected.toFixed(4)} (cog ${cog.toFixed(4)} phys ${phys.toFixed(4)})`;
			}

			if (Number.isFinite(got)) {
				if (got > 100) over100++;

				// How close a real plan gets to the wall it is allowed to touch.
				if (got >= 99) poolBoundDays++;

				worstOverdraw = Math.max(worstOverdraw, got);
			} else infinite++;
		}

		console.log(
			`[identity] percent = round(100·max(cog/pool, phys/pool)) on ${DAYS - mismatch} of ${DAYS} days${widest ? ` — first miss: ${widest}` : ''}`,
		);

		console.log(
			`[reachability] over 100%: ${over100} days · Infinity: ${infinite} days · max reading ${worstOverdraw}% · at or above 99%: ${poolBoundDays} days (${((poolBoundDays / DAYS) * 100).toFixed(1)}%)`,
		);
	});

	/**
	 * Rounding before the comparison is what decides `limitType`, so the
	 * question is how often the two saturations land inside one integer of each
	 * other — and, when they do, whether the pool the row NAMES is the one that
	 * actually binds. The old rule is reproduced locally; the fixed metric is
	 * called for the same plan.
	 */
	it('names the pool that binds', () => {
		const days = randomDays(DAYS, SEED);
		let ties = 0;
		let oldWrong = 0;
		let newWrong = 0;
		let worstGap = 0;
		let worstCase = '';
		let namedAnEmptyPool = 0;
		const shown: string[] = [];

		for (const day of days) {
			const metrics = calculateDailyMetrics(day);

			if (!metrics.suggestedTasks.length) continue;

			const { cognitive, physical } = demands(metrics.suggestedTasks);
			const cog = saturation(cognitive, day.pools!.cognitiveHours);
			const phys = saturation(physical, day.pools!.physicalHours);

			// A genuine tie (both pools equally saturated) has no wrong answer;
			// only a decidable pair can be decided wrongly. 1e-9 is float noise,
			// not a difference the display could ever show.
			if (!Number.isFinite(cog) || !Number.isFinite(phys)) continue;

			if (Math.abs(cog - phys) <= 1e-9) continue;

			const binds = cog > phys ? 'cognitive' : 'physical';
			const rounded = Math.round(cog) >= Math.round(phys) ? 'cognitive' : 'physical';

			if (Math.round(cog) === Math.round(phys)) ties++;

			if (rounded !== binds) {
				oldWrong++;

				// The extreme of the same defect: a day drawing NOTHING from the
				// cognitive pool, described as cognitively limited.
				if (cog === 0) namedAnEmptyPool++;

				const gap = Math.abs(cog - phys);

				if (gap > worstGap) {
					worstGap = gap;
					worstCase = `cog ${cog.toFixed(3)}% vs phys ${phys.toFixed(3)}% → old rule said ${rounded}`;
				}

				if (shown.length < 5)
					shown.push(
						`cog ${cog.toFixed(3)}% vs phys ${phys.toFixed(3)}% (both round to ${Math.round(cog)})`,
					);
			}

			if (metrics.humanCapacity.limitType !== binds) newWrong++;
		}

		console.log(
			`[limitType] rounded pairs that tie: ${ties} of ${DAYS} days · old rule named the non-binding pool on ${oldWrong} (${((oldWrong / DAYS) * 100).toFixed(2)}%) · fixed metric: ${newWrong}`,
		);

		console.log(
			`[limitType] widest gap the old rule swallowed — ${worstCase} · zero-cognitive days it called cognitive: ${namedAnEmptyPool}`,
		);

		console.log(`[limitType] examples: ${shown.join(' | ')}`);
	});
});
