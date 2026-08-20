/**
 * The break/fragmentation numbers MATH.md §8 (intro), §8.3–8.4 and §13.5 quote,
 * and business/model/AGENTS.md's "Fragmentation stays costly (probe-verified)". The probes
 * they were measured on (2026-07-13/14) were never committed, so this file
 * rebuilds them against the shipped model:
 *
 *  1. §8 intro — the OLD behavior the corrections were driven by: "micro-breaks
 *     always reduced output at equal work-hours".
 *  2. §8.3 — fragmentation still costs ("contiguous ≈ 1.5× confetti on the
 *     standard probe", the suite's own fragmentation fixture).
 *  3. §8.3 — "a ~30-minute break placed mid-session raises total output at
 *     equal work-hours" (the Jaber–Neumann result).
 *  4. §8.3 — interior rest on the 10-hour demanding window (the section quotes
 *     "6 breaks", a Pomodoro-like pattern).
 *  5. §8.3/§8.4 — the W*(λ₀) ladder on the 12-hour probe day.
 *  6. §8.3 — the same ladder under the pre-fix DYNAMICS ("10.25 h at λ₀ = 0.5,
 *     1.0 and 1.5 alike, with the collapse point above 1.5").
 *  7. §13.5 — raw output vs chunk count at a fixed 6 h of work in a 12-hour
 *     window ("peaks at 2 chunks (+19%) … at full demand the peak moves to
 *     3–10 chunks and reaches +153%"). "demand d" is read as
 *     cognitiveDemand = physicalDemand = d, and the 6 h of rest that is not
 *     work fills the window, split equally over the k−1 interior gaps.
 *  8. §8.4 — the fragmentation ratios (raw 1.45×, objective 1.17× with satiety
 *     and 1.28× without) on the §8.4 guitar task.
 *  9. §8.3's SHIPPED DEFAULT, which no instrument had ever measured: the ladder
 *     in (5) sampled λ₀ ∈ {0.2, 0.4, 0.8, 1.0, 1.2, 1.5} and the suite fixture
 *     {0.4, 0.8, 1.2, 1.5}, so 0.5 — the value the app runs on — was skipped by
 *     both. Added 2026-08-20 with the portfolio spread beside it, because the
 *     default's effect is a property of the DAY, not of λ₀ alone.
 *
 * A probe, not a test: every number here moves when the optimizer, the lattice
 * or the reservoir law moves, legitimately. What the suite pins instead is the
 * SIGN of (1)–(3): "fragmentation is costly", "warm-up carries over across a
 * gap", "warm-up carryover decays with gap length", and the monotone-and-graded
 * W*(λ₀) fixture in `zenith-energy.test.ts`.
 *
 * The pre-2026-07-13 model is recovered exactly through the params that were
 * added to disable each correction — `resumptionTimeConstant: 0` (binary
 * reset), `restRecoveryMultiplier: 1`, `satietyScale: 0`, and
 * `microRecoveryFraction: 0` — so the old and new arms differ in the dynamics
 * only. The old SEARCH (pre-§8.6 moves, pre-§8.8 45-min lattice) is gone and
 * cannot be reconstructed, so plan-shape numbers from that era are reported
 * under today's optimizer and are not comparable to the ones §8 quotes.
 */
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_ENERGY_PARAMS,
	DEFAULT_STEP_HOURS,
	evaluateSchedule,
	optimizeSchedule,
	type EnergyTaskInput,
	type ScheduleBlock,
} from '$lib/business/model/zenith-energy';

const task = (
	id: number,
	title: string,
	difficulty: number,
	enjoyment: number,
	cognitiveDemand: number,
	physicalDemand: number,
): EnergyTaskInput => ({
	id,
	title,
	difficulty,
	enjoyment,
	cognitiveDemand,
	physicalDemand,
});

const CURRENT = DEFAULT_ENERGY_PARAMS;

/** The model before §8.1–8.2 (and before §8.4–8.5), via the disabling params. */
const PRE_FIX = {
	...DEFAULT_ENERGY_PARAMS,
	resumptionTimeConstant: 0,
	restRecoveryMultiplier: 1,
	satietyScale: 0,
	microRecoveryFraction: 0,
};

const DEEP = [task(1, 'deep', 8, 5, 0.9, 0.1)];
/** The suite's fragmentation fixture task. */
const FRAG = [task(1, 'deep', 6, 6, 0.7, 0.1)];

/** The 12-hour probe day of §8.3/§8.10. */
const PROBE_DAY = [
	task(1, 'boxing', 10, 10, 0.2, 1.0),
	task(2, 'guitar', 6, 9, 0.4, 0.3),
	task(3, 'reading', 4, 7, 0.5, 0.05),
];

/** The §8.4 guitar task, alone, for the fragmentation ratios. */
const GUITAR = [task(1, 'guitar', 6, 9, 0.4, 0.3)];

/** `work`h of work on one task, split into `breaks + 1` equal runs around `rest`h rests. */
function chopped(breaks: number, rest = 0.25, work = 4): ScheduleBlock[] {
	const chunk = work / (breaks + 1);
	const out: ScheduleBlock[] = [];

	for (let i = 0; i <= breaks; i++) {
		out.push({
			taskId: 1,
			hours: chunk,
		});

		if (i < breaks) {
			out.push({
				taskId: null,
				hours: rest,
			});
		}
	}

	return out;
}

const CHUNK_COUNTS = [1, 2, 3, 4, 6, 8, 10, 12, 24];

/** 6h of work as `k` equal chunks, with the window's other 6h split over the k−1 gaps. */
function kChunks(k: number): ScheduleBlock[] {
	return chopped(k - 1, k > 1 ? 6 / (k - 1) : 0, 6);
}

/**
 * argmax over CHUNK_COUNTS, its gain over k = 1, and monotonicity after it —
 * with the size of the largest post-peak rise, since a "non-monotone" verdict
 * at the 4th decimal is quadrature noise, not a gaming channel.
 */
function summarize(outputs: number[]): string {
	const peak = outputs.indexOf(Math.max(...outputs));
	const gain = ((outputs[peak] - outputs[0]) / outputs[0]) * 100;
	const after = outputs.slice(peak);
	const rises = after.map((v, i) => (i === 0 ? 0 : ((v - after[i - 1]) / after[i - 1]) * 100));
	const worst = Math.max(...rises);

	return `argmax k=${CHUNK_COUNTS[peak]} +${gain.toFixed(1)}% ${worst <= 0 ? 'monotone after peak' : `NON-MONOTONE after peak (largest rise +${worst.toFixed(3)}%)`}`;
}

describe('break economics (MATH.md §8 intro, §8.1–8.3)', () => {
	it('pre-fix, micro-breaks always reduced output at equal work-hours; now they pay', () => {
		const straight = [
			{
				taskId: 1,
				hours: 4,
			},
		];

		for (const [label, params] of [
			['pre-fix', PRE_FIX],
			['current', CURRENT],
		] as const) {
			const base = evaluateSchedule(straight, DEEP, 12, params).totalOutput;

			const deltas = [1, 2, 4, 8].map((n) => {
				const out = evaluateSchedule(chopped(n), DEEP, 12, params).totalOutput;

				return `${n}×15m ${(((out - base) / base) * 100).toFixed(2)}%`;
			});

			console.log(`${label}: 4h contiguous = ${base.toPrecision(8)} | ${deltas.join('  ')}`);
		}

		// The invariant, not the numbers: every micro-break loses under a hard
		// reset, and the first ones win under carryover.
		const preBase = evaluateSchedule(straight, DEEP, 12, PRE_FIX).totalOutput;
		const nowBase = evaluateSchedule(straight, DEEP, 12, CURRENT).totalOutput;

		for (const n of [1, 2, 4, 8]) {
			expect(evaluateSchedule(chopped(n), DEEP, 12, PRE_FIX).totalOutput).toBeLessThan(preBase);
		}

		expect(evaluateSchedule(chopped(1), DEEP, 12, CURRENT).totalOutput).toBeGreaterThan(nowBase);
	});

	it('fragmentation still costs: contiguous vs confetti on the suite fixture', () => {
		const contiguous = evaluateSchedule(
			[
				{
					taskId: 1,
					hours: 2,
				},
			],
			FRAG,
			8,
		).totalOutput;

		const confetti: ScheduleBlock[] = [];

		for (let i = 0; i < 8; i++) {
			confetti.push(
				{
					taskId: 1,
					hours: 0.25,
				},
				{
					taskId: null,
					hours: 0.25,
				},
			);
		}

		const carry = evaluateSchedule(confetti, FRAG, 8).totalOutput;

		const reset = evaluateSchedule(confetti, FRAG, 8, {
			...CURRENT,
			resumptionTimeConstant: 0,
		}).totalOutput;

		console.log(
			`contiguous ${contiguous.toPrecision(10)} / confetti ${carry.toPrecision(10)} = ${(contiguous / carry).toFixed(4)}×  (hard reset: ${(contiguous / reset).toFixed(4)}×)`,
		);

		expect(contiguous).toBeGreaterThan(carry);
	});

	it('a ~30-minute break mid-session raises total output at equal work-hours', () => {
		const withBreak: ScheduleBlock[] = [
			{
				taskId: 1,
				hours: 2,
			},
			{
				taskId: null,
				hours: 0.5,
			},
			{
				taskId: 1,
				hours: 2,
			},
		];

		for (const [label, day] of [
			['deep (d8/w.9)', DEEP],
			['frag fixture (d6/w.7)', FRAG],
		] as const) {
			const straight = evaluateSchedule(
				[
					{
						taskId: 1,
						hours: 4,
					},
				],
				day,
				12,
			).totalOutput;

			const broken = evaluateSchedule(withBreak, day, 12).totalOutput;

			console.log(
				`${label}: 4h straight ${straight.toPrecision(8)} → 2h+30m rest+2h ${broken.toPrecision(8)} (${(((broken - straight) / straight) * 100).toFixed(2)}%)`,
			);

			expect(broken).toBeGreaterThan(straight);
		}
	});

	it('counts interior rest the optimizer schedules on the 10-hour demanding window', () => {
		for (const step of [DEFAULT_STEP_HOURS, 0.25]) {
			for (const [label, params] of [
				['current', CURRENT],
				['pre-fix', PRE_FIX],
			] as const) {
				const { blocks, evaluation } = optimizeSchedule(DEEP, 10, params, undefined, {
					stepHours: step,
				});

				console.log(
					`${label} step ${step}h: ${blocks.filter((b) => b.taskId === null).length} rest blocks, ${evaluation.workHours}h work — ${blocks.map((b) => `${b.taskId === null ? 'rest' : 'work'} ${b.hours}`).join(', ')}`,
				);
			}
		}
	});

	it('W*(λ₀) on the 12-hour probe day', () => {
		const ladder = [0.2, 0.4, 0.5, 0.6, 0.8, 1.0, 1.2, 1.5].map((lambda) => {
			const { evaluation } = optimizeSchedule(PROBE_DAY, 12, {
				...CURRENT,
				freeTimeValue: lambda,
			});

			return `λ₀ ${lambda} → ${evaluation.workHours}h`;
		});

		console.log(ladder.join('  |  '));
	});

	it('W*(λ₀) on the same day under the pre-fix dynamics', () => {
		const sweep = [0.2, 0.4, 0.5, 0.8, 1.0, 1.2, 1.5].map((lambda) => ({
			lambda,
			workHours: optimizeSchedule(PROBE_DAY, 12, {
				...PRE_FIX,
				freeTimeValue: lambda,
			}).evaluation.workHours,
		}));

		const collapsed = sweep.find((s) => s.workHours === 0);

		console.log(
			`pre-fix dynamics: ${sweep.map((s) => `λ₀ ${s.lambda} → ${s.workHours}h`).join('  |  ')}`,
		);

		console.log(
			collapsed
				? `pre-fix dynamics: collapses to all-leisure at λ₀ ${collapsed.lambda}`
				: `pre-fix dynamics: no collapse to all-leisure anywhere in λ₀ ∈ [0.2, 1.5] (minimum ${Math.min(...sweep.map((s) => s.workHours))}h)`,
		);
	});

	/**
	 * Two ordinary days that are NOT the probe day: a cognitive desk pair and a
	 * pair of low-difficulty errands. The probe day is demanding on both axes and
	 * so answers only the demanding case.
	 */
	const DESK = [task(1, 'write spec', 8, 6, 0.9, 0.1), task(2, 'email', 3, 3, 0.4, 0.1)];
	const LIGHT = [task(1, 'errand', 3, 5, 0.2, 0.2), task(2, 'tidy', 2, 4, 0.1, 0.3)];

	const PORTFOLIOS: [string, EnergyTaskInput[]][] = [
		['probe day', PROBE_DAY],
		['desk pair', DESK],
		['errand pair', LIGHT],
	];

	it('what the SHIPPED default plans, by portfolio and window', () => {
		for (const [name, tasks] of PORTFOLIOS) {
			const row = [8, 10, 12, 14].map((windowHours) => {
				const { evaluation } = optimizeSchedule(tasks, windowHours, CURRENT);

				return `T=${windowHours}: ${evaluation.workHours}h (${(evaluation.workHours / windowHours).toFixed(2)} of window)`;
			});

			console.log(`λ₀ = ${CURRENT.freeTimeValue} · ${name} — ${row.join('  |  ')}`);
		}
	});

	/**
	 * Why the default cannot simply be raised: the Lab's slider reaches 3 in
	 * steps of 0.1, and one notch to λ₀ = 1 empties the plan on both light
	 * portfolios. The rival re-pricing is the occurrence check — an empty plan
	 * from a search that failed to find work would print the same 0h.
	 */
	it('λ₀ = 1 empties the plan on the light portfolios, and that optimum is real', () => {
		for (const [name, tasks] of PORTFOLIOS) {
			for (const windowHours of [8, 12]) {
				const raised = {
					...CURRENT,
					freeTimeValue: 1,
				};

				const found = optimizeSchedule(tasks, windowHours, raised);
				const rival = optimizeSchedule(tasks, windowHours, CURRENT).blocks;
				const repriced = evaluateSchedule(rival, tasks, windowHours, raised);

				console.log(
					`λ₀ = 1 · ${name} T=${windowHours}: ${found.evaluation.workHours}h scoring ${found.evaluation.objective.toFixed(4)} — the default's plan repriced: ${repriced.workHours}h scoring ${repriced.objective.toFixed(4)}${repriced.objective > found.evaluation.objective + 1e-9 ? ' — RIVAL WINS, the 0h is a search failure' : ''}`,
				);
			}
		}
	});

	it('raw output vs chunk count at a fixed 6h of work (MATH.md §13.5)', () => {
		for (const [difficulty, enjoyment, demand] of [
			[8, 6, 0.8],
			[8, 6, 1.0],
			[3, 8, 1.0],
			[10, 10, 0.2],
			// Two more low-difficulty/full-demand sets, because §13.5 claims a
			// +153% peak and TWO non-monotone parameterizations.
			[1, 8, 1.0],
			[5, 6, 1.0],
		] as const) {
			const day = [task(1, 'chunked', difficulty, enjoyment, demand, demand)];
			const runs = CHUNK_COUNTS.map((k) => evaluateSchedule(kChunks(k), day, 12));
			const outputs = runs.map((r) => r.totalOutput);

			console.log(
				`d${difficulty}/e${enjoyment}/demand ${demand}: ${CHUNK_COUNTS.map((k, i) => `k=${k} ${(outputs[i] / outputs[0]).toFixed(4)}×`).join('  ')} — ${summarize(outputs)}`,
			);

			// The construction, not the numbers: every k spends exactly 6h working.
			for (const run of runs) expect(run.workHours).toBeCloseTo(6, 9);
		}
	});

	it('4h contiguous vs 0.5h slices with 0.5h gaps on the §8.4 guitar task', () => {
		const contiguous = [
			{
				taskId: 1,
				hours: 4,
			},
		];

		const sliced = chopped(7, 0.5);

		const ratios = [
			['satiety on', CURRENT],
			[
				'satiety off',
				{
					...CURRENT,
					satietyScale: 0,
				},
			],
		].map(([label, params]) => {
			const whole = evaluateSchedule(contiguous, GUITAR, 8, params as typeof CURRENT);
			const frag = evaluateSchedule(sliced, GUITAR, 8, params as typeof CURRENT);

			return {
				label: label as string,
				raw: whole.totalOutput / frag.totalOutput,
				objective: whole.objective / frag.objective,
			};
		});

		console.log(
			`§8.4 guitar, 4h contiguous vs 8×0.5h + 0.5h gaps (8h window): raw ${ratios.map((r) => `${r.raw.toFixed(4)}× (${r.label})`).join(' / ')}  |  objective ${ratios.map((r) => `${r.objective.toFixed(4)}× (${r.label})`).join(' / ')}`,
		);

		// §8.4's claim that satiety lives outside the dynamics: raw output cannot
		// see satietyScale at all.
		expect(ratios[0].raw).toBeCloseTo(ratios[1].raw, 12);
		expect(ratios[0].raw).toBeGreaterThan(1);
	});
});
