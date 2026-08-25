/**
 * What is true of the priority score (`SuggestedTask.priorityScore`, MATH.md
 * §3) as difficulty rises — and what the 1 dp print does to it.
 *
 * The score is the task's intrinsic value rescaled once for print:
 * `Number((P̄(T*) · 10).toFixed(1))`, with P̄(T*) the allocation-independent
 * `TaskAllocation.optimalAvgProductivity`. Two claims:
 *
 * CLAIM 1 — priority is NOT monotone in difficulty, and the r-cap is not why.
 *   A  P̄(T*) raw over effective difficulty 1 → 10 at 0.01: the difficulty-1
 *      value, the interior local max, the trough and its depth, and where the
 *      sweep first climbs back to where it started.
 *   B  Where the amplitude-ratio cap binds — read off the run as the difficulty
 *      band on which r = p₀/a sits flat at its maximum — against where the
 *      trough sits. The trough is far outside it.
 *   C  h(r) = P̄(T*)/a over the same sweep: flat across the capped band,
 *      monotone in r outside it. The dip therefore belongs to the closed form
 *      P̄/β = E·h(1/E²) (§1's maps give r = 1/E²), not to the cap.
 *   D  The uncapped counterfactual. h → 1 as r → 1 (§3's asymptote — a limit,
 *      the one figure below not read off a run), so an uncapped difficulty 1
 *      would read P̄/β = 1.0 where the shipped capped one reads h(r_cap). Both
 *      drop depths are printed: the cap SHRINKS the dip it is blamed for.
 *   E  The worst drop the INTEGER slider grid can reach, on the PRINTED score —
 *      over the 100 mental × enjoyment cells at physical 0, and again over the
 *      full mental × physical × enjoyment grid, since `getEffectiveDifficulty`
 *      mixes the two dimensions and reaches difficulties physical 0 cannot.
 *
 * CLAIM 2 — the 1 dp print ties adjacent slider cells.
 *   F  Adjacent-mental-difficulty pairs over physical 0–10 × enjoyment 1–10
 *      whose printed scores are equal, split by whether the pair's effective
 *      difficulty differs at all: `getEffectiveDifficulty` clamps at 10, so
 *      most of the raw tie count is the clamp, not the rounding. The consumers
 *      a genuine tie reaches are measured beside it.
 *
 * Every figure comes from the shipped functions: the printed score from
 * `calculateSuggestedTasks`, the raw P̄(T*) from `calculateTaskAllocations` at
 * budget 0 (the empty plan keeps every task-intrinsic value — §3), a, β and r
 * from `calculateTaskParams`, the difficulty mix from `getEffectiveDifficulty`.
 *
 * A probe, not a test: every number below moves whenever the curve moves.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateSuggestedTasks,
	calculateYieldIndex,
	getEffectiveDifficulty,
} from '$lib/business/model/metric/calculation';
import {
	calculateTaskAllocations,
	calculateTaskParams,
	mapEffort,
} from '$lib/business/model/zenith';
import type { Task } from '$lib/data/type';

/** 1 → 10 in 0.01 steps: fine enough to place the trough to the slider's own resolution. */
const SWEEP_STEP = 0.01;
const SWEEP_POINTS = 901;
/** Arms A–D hold enjoyment fixed; P̄ is linear in β, so the drop DEPTH does not depend on it (checked in A). */
const FIXED_ENJOYMENT = 5;

const task = (mental: number, physical: number, enjoyment: number): Task => ({
	id: 1,
	title: `m${mental}p${physical}e${enjoyment}`,
	mentalDifficulty: mental,
	physicalDifficulty: physical,
	enjoyment,
	createdAt: '2026-08-25',
	completed: false,
});

const effectiveDifficulty = (mental: number, physical: number) =>
	getEffectiveDifficulty({
		mentalDifficulty: mental,
		physicalDifficulty: physical,
	});

/** The shipped print: `calculateSuggestedTasks` at budget 0 — priority is allocation-independent. */
const printedScore = (mental: number, physical: number, enjoyment: number) =>
	calculateSuggestedTasks([task(mental, physical, enjoyment)], 0)[0].priorityScore;

/** Raw, un-rescaled P̄(T*) plus the curve parameters it is made of. */
function read(difficulty: number, enjoyment: number) {
	const input = {
		title: 'probe',
		difficulty,
		enjoyment,
	};

	const { a, p0, beta } = calculateTaskParams(input);
	const pbar = calculateTaskAllocations([input], 0)[0].optimalAvgProductivity;

	return {
		difficulty,
		pbar,
		beta,
		a,
		r: p0 / a,
		h: pbar / a,
	};
}

/** Physical 0 leaves `getEffectiveDifficulty` the identity on mental, so the sweep IS an effective-difficulty sweep. */
const sweep = (enjoyment: number) =>
	Array.from(
		{
			length: SWEEP_POINTS,
		},
		(_, i) => read(effectiveDifficulty(1 + i * SWEEP_STEP, 0), enjoyment),
	);

const SWEEP = sweep(FIXED_ENJOYMENT);
const START = SWEEP[0];
const TROUGH = SWEEP.reduce((best, point) => (point.pbar < best.pbar ? point : best));

const dropDepth = (points: typeof SWEEP) => {
	const low = points.reduce((best, point) => (point.pbar < best.pbar ? point : best));

	return 1 - low.pbar / points[0].pbar;
};

/**
 * The cap's value and its edge, both read off the run: r = p₀/a is non-increasing
 * in difficulty and sits flat at its maximum exactly where the cap binds. The
 * tolerance is float noise — the capped p₀ is a product that divides back to the
 * cap to within an ulp, not to the bit.
 */
const R_CAP = Math.max(...SWEEP.map((point) => point.r));
const isCapped = (r: number) => Math.abs(r - R_CAP) <= 1e-12 * R_CAP;

function capBoundary(enjoyment: number): number {
	let lo = 1;
	let hi = 10;

	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;

		if (isCapped(read(mid, enjoyment).r)) {
			lo = mid;
		} else {
			hi = mid;
		}
	}

	return lo;
}

const CAP_EDGE = capBoundary(FIXED_ENJOYMENT);

const GRID = Array.from(
	{
		length: 10,
	},
	(_, m) => m + 1,
).flatMap((mental) =>
	Array.from(
		{
			length: 11,
		},
		(_, physical) => ({
			mental,
			physical,
			effective: effectiveDifficulty(mental, physical),
		}),
	),
);

const percent = (share: number, digits = 1) => `${(100 * share).toFixed(digits)}%`;

describe('MATH.md §3 — priority over difficulty: the dip, and what the print rounds together', () => {
	it('A — the raw P̄(T*) sweep', () => {
		const localMax = SWEEP.find(
			(point, i) =>
				i > 0 &&
				i < SWEEP.length - 1 &&
				point.pbar >= SWEEP[i - 1].pbar &&
				point.pbar >= SWEEP[i + 1].pbar,
		)!;

		const recovery = SWEEP.find(
			(point) => point.difficulty > TROUGH.difficulty && point.pbar >= START.pbar,
		)!;

		console.log(
			`[A] enjoyment ${FIXED_ENJOYMENT}, effective difficulty 1 → 10 step ${SWEEP_STEP}: ` +
				`P̄(T*) reads ${START.pbar.toFixed(4)} at difficulty 1, rises to an interior LOCAL MAX of ` +
				`${localMax.pbar.toFixed(4)} at difficulty ${localMax.difficulty.toFixed(2)}, falls to a TROUGH of ` +
				`${TROUGH.pbar.toFixed(4)} at difficulty ${TROUGH.difficulty.toFixed(2)} — ${percent(dropDepth(SWEEP), 2)} below ` +
				`the difficulty-1 value — and first regains it at difficulty ${recovery.difficulty.toFixed(2)} ` +
				`(${recovery.pbar.toFixed(4)})`,
		);

		console.log(
			`[A] the depth is β-free: the same sweep drops ${percent(dropDepth(sweep(1)), 2)} at enjoyment 1 and ` +
				`${percent(dropDepth(sweep(10)), 2)} at enjoyment 10`,
		);
	});

	it('B — where the r-cap binds, against where the trough sits', () => {
		const beyond = SWEEP.filter((point) => point.difficulty > CAP_EDGE);

		console.log(
			`[B] r = p₀/a sits flat at its maximum ${R_CAP.toFixed(4)} for every effective difficulty up to ` +
				`${CAP_EDGE.toFixed(4)} (true effort E = ${mapEffort(CAP_EDGE).toFixed(4)}), and falls strictly below it above: ` +
				`r reads ${beyond[0].r.toFixed(4)} at difficulty ${beyond[0].difficulty.toFixed(2)} and ` +
				`${SWEEP.at(-1)!.r.toFixed(4)} at difficulty 10`,
		);

		console.log(
			`[B] the trough sits at difficulty ${TROUGH.difficulty.toFixed(2)}, r = ${TROUGH.r.toFixed(4)} — ` +
				`${(TROUGH.difficulty - CAP_EDGE).toFixed(2)} of difficulty OUTSIDE the capped band, which the sweep has ` +
				`already left by difficulty ${beyond[0].difficulty.toFixed(2)}`,
		);
	});

	it('C — h(r) = P̄(T*)/a: flat under the cap, monotone outside it', () => {
		const capped = SWEEP.filter((point) => point.difficulty <= CAP_EDGE);
		const beyond = SWEEP.filter((point) => point.difficulty > CAP_EDGE);
		const spread = Math.max(...capped.map((p) => p.h)) - Math.min(...capped.map((p) => p.h));
		const notFalling = beyond.filter((point, i) => i > 0 && point.h >= beyond[i - 1].h).length;

		const identity = Math.max(
			...SWEEP.map((point) =>
				Math.abs(point.pbar / point.beta - mapEffort(point.difficulty) * point.h),
			),
		);

		console.log(
			`[C] h is constant on the ${capped.length} capped sweep points — h = ${capped[0].h.toFixed(6)}, spread ` +
				`${spread.toExponential(2)} — while a = Eβ keeps growing, which is the whole of the rise into the local max. ` +
				`Above the cap h falls with difficulty (rises with r) on ${beyond.length - 1 - notFalling}/${beyond.length - 1} ` +
				`steps, ${notFalling} exceptions: ${beyond[0].h.toFixed(6)} at difficulty ` +
				`${beyond[0].difficulty.toFixed(2)} down to ${SWEEP.at(-1)!.h.toFixed(6)} at difficulty 10`,
		);

		console.log(
			`[C] so the whole shape is the closed form P̄/β = E·h(r): the two sides agree to ` +
				`${identity.toExponential(2)} over all ${SWEEP.length} points, and h is a function of r alone. The dip is the ` +
				`closed form's, not the cap's`,
		);
	});

	it('D — the uncapped counterfactual', () => {
		const cappedReading = START.pbar / START.beta;
		const troughReading = TROUGH.pbar / TROUGH.beta;

		console.log(
			`[D] shipped, capped: difficulty 1 has r pinned at ${R_CAP.toFixed(4)}, h = ${START.h.toFixed(6)}, so ` +
				`P̄/β = ${cappedReading.toFixed(6)} against the trough's ${troughReading.toFixed(6)} — a drop of ` +
				`${percent(1 - troughReading / cappedReading, 2)}`,
		);

		console.log(
			`[D] uncapped, difficulty 1 has r = 1 and h → 1 (§3's r → 1 asymptote — a limit, not a run figure, and the only ` +
				`one here), so P̄/β would read 1.000000 and the same trough would be a drop of ` +
				`${percent(1 - troughReading / 1, 2)}. The cap SHRINKS the dip by ` +
				`${(100 * (1 - troughReading / 1) - 100 * (1 - troughReading / cappedReading)).toFixed(2)} points; it does not ` +
				`cause it`,
		);
	});

	it('E — the worst drop the integer slider grid reaches, on the printed score', () => {
		const worstInRow = (cells: typeof GRID, enjoyment: number) => {
			const scored = cells.map((cell) => ({
				...cell,
				score: printedScore(cell.mental, cell.physical, enjoyment),
			}));

			let drop = 0;
			let witness = '';

			for (const [easier, harder] of scored.flatMap((a) => scored.map((b) => [a, b] as const))) {
				if (easier.effective >= harder.effective || easier.score - harder.score <= drop) continue;

				drop = easier.score - harder.score;

				witness =
					`enjoyment ${enjoyment}: mental/physical ${easier.mental}/${easier.physical} ` +
					`(effective ${easier.effective.toFixed(1)}) prints ${easier.score}, while the HARDER ` +
					`${harder.mental}/${harder.physical} (effective ${harder.effective.toFixed(1)}) prints ${harder.score}`;
			}

			return {
				drop,
				witness,
			};
		};

		const worstDrop = (cells: typeof GRID) => {
			let drop = 0;
			let witness = '';

			for (let enjoyment = 1; enjoyment <= 10; enjoyment++) {
				const row = worstInRow(cells, enjoyment);

				if (row.drop > drop) ({ drop, witness } = row);
			}

			return {
				drop,
				witness,
			};
		};

		const flat = worstDrop(GRID.filter((cell) => cell.physical === 0));
		const full = worstDrop(GRID);

		console.log(
			`[E] over the 100 mental × enjoyment cells at physical 0, the worst a harder task falls BELOW an easier one ` +
				`on the printed score is ${flat.drop.toFixed(1)} points — ${flat.witness}`,
		);

		console.log(
			`[E] over the whole ${GRID.length} mental × physical grid × 10 enjoyments — every effective difficulty the ` +
				`sliders can mix — the worst is ${full.drop.toFixed(1)} points: ${full.witness}`,
		);
	});

	it('F — what the 1 dp print ties together', () => {
		let pairs = 0;
		let ties = 0;
		let distinct = 0;
		const witnesses: { lower: Task; upper: Task; score: number }[] = [];

		const cells = Array.from(
			{
				length: 11,
			},
			(_, physical) =>
				Array.from(
					{
						length: 10,
					},
					(_, e) =>
						Array.from(
							{
								length: 9,
							},
							(_, m) => ({
								physical,
								enjoyment: e + 1,
								mental: m + 1,
							}),
						),
				),
		).flat(2);

		for (const { physical, enjoyment, mental } of cells) {
			const score = printedScore(mental, physical, enjoyment);

			const differs =
				effectiveDifficulty(mental, physical) !== effectiveDifficulty(mental + 1, physical);

			pairs++;

			if (differs) distinct++;

			if (score !== printedScore(mental + 1, physical, enjoyment)) continue;

			ties++;

			if (differs)
				witnesses.push({
					lower: task(mental, physical, enjoyment),
					upper: task(mental + 1, physical, enjoyment),
					score,
				});
		}

		const describeTask = (t: Task) =>
			`mental/physical ${t.mentalDifficulty}/${t.physicalDifficulty} (effective ` +
			`${effectiveDifficulty(t.mentalDifficulty, t.physicalDifficulty).toFixed(1)}), enjoyment ${t.enjoyment}`;

		console.log(
			`[F] ${pairs} adjacent-mental pairs (physical 0–10 × enjoyment 1–10 × mental d vs d+1): ${ties} print the same ` +
				`score (${percent(ties / pairs)}). Only ${distinct} of those pairs differ in effective difficulty at all — ` +
				`the other ${pairs - distinct} are the difficulty clamp at 10, tied before the print ever sees them`,
		);

		console.log(
			`[F] so the PRINT's own contribution is ${witnesses.length}/${distinct} pairs ` +
				`(${percent(witnesses.length / distinct, 2)}): ${witnesses
					.map(
						(pair) =>
							`${describeTask(pair.lower)} and ${describeTask(pair.upper)} both print ${pair.score}`,
					)
					.join('; ')}`,
		);

		// What a tie actually reaches, measured on the first witness: the two task
		// screens read `calculateSuggestedTasks`, whose sort is stable, so a tie
		// keeps input order — and `calculateInterleavedOrder` seeds from the same
		// comparator. `calculateYieldIndex` sums the same rounded key it sorts by,
		// so a swap cannot move its top-N sum.
		const { lower, upper } = witnesses[0];

		const pairPlan = (first: Task, second: Task) =>
			calculateSuggestedTasks(
				[
					{
						...first,
						id: 1,
						completed: true,
					},
					{
						...second,
						id: 2,
						completed: false,
					},
				],
				4,
			);

		const forward = pairPlan(lower, upper);
		const reversed = pairPlan(upper, lower);

		console.log(
			`[F] the tie reaches the ORDER: the same two tasks plan as ` +
				`[${forward.map((t) => t.title).join(', ')}] listed one way and ` +
				`[${reversed.map((t) => t.title).join(', ')}] listed the other. It does NOT reach the Yield Index, which ` +
				`sums the same rounded key it sorts by, so a swap cannot move its top-N sum: ` +
				`${calculateYieldIndex(forward)} forward, ${calculateYieldIndex(reversed)} reversed`,
		);
	});
});
