import { describe, expect, it } from 'vitest';
import {
	ALPHA_FIT_MAX,
	ALPHA_FIT_MIN,
	DEFAULT_ENERGY_PARAMS,
	DEFAULT_STEP_HOURS,
	evaluateSchedule,
	fitDrainRate,
	fitRecoveryRate,
	fitStoppingValue,
	normalizeSchedule,
	optimizeSchedule,
	sampleTrajectory,
	simulateReservoirs,
	STOP_INVERSION_MARGIN,
	suggestBudgetCurve,
	adviseStop,
	stopBracket,
	stopIndifferencePoint,
	type DrainObservation,
	type ScheduleBlock,
	type StopAdvice,
	type EnergyTaskInput,
	type RestObservation,
	type StopObservation,
} from '$lib/business/model/zenith-energy';
import { calculateFlowStateTime, mapEffort, mapEnjoyability } from '$lib/business/model/zenith';

const MS_PER_HOUR = 3_600_000;
/** An arbitrary fixed wall clock: the day's breaks are DELTAS between moments. */
const LOG_ORIGIN = Date.parse('2026-08-19T08:00:00.000Z');

function makeTask(
	id: number,
	title: string,
	difficulty: number,
	enjoyment: number,
	cognitiveDemand: number,
	physicalDemand: number,
): EnergyTaskInput {
	return {
		id,
		title,
		difficulty,
		enjoyment,
		cognitiveDemand,
		physicalDemand,
	};
}

/**
 * The 2026-07-14 probe day (boxing / guitar / reading), declared ONCE.
 *
 * As the three integer sliders reach it. Boxing was always reachable (sliders 2
 * mental / 10 physical: difficulty min(10, 10 + 0.3·2) = 10, demands 0.2/1.0).
 * The other two were not, and the DIFFICULTIES are what this day's findings are
 * stated in — the canonical amplitudes 10.4 / 6.67 / 4.60 the tests below
 * reconstruct — so the difficulties are held and the secondary demands move:
 * guitar 0.4/0.3 → 0.6/0.0 (sliders 6/0) and reading 0.5/0.05 → 0.4/0.0
 * (sliders 4/0). physicalDemand 0.05 had no slider at all: the demands are
 * slider/10.
 *
 * Four describe blocks below declared their own copy of the pre-slider triple
 * until 2026-08-21, which is how §8.10's fixture drifted from the rest of the
 * file for two days (ROADMAP M44). One declaration is the guard: there is no
 * longer a second place for it to drift from.
 */
const PROBE_DAY = [
	makeTask(1, 'boxing', 10, 10, 0.2, 1.0),
	makeTask(2, 'guitar', 6, 9, 0.6, 0),
	makeTask(3, 'reading', 4, 7, 0.4, 0),
];

describe('Zenith Energy Model', () => {
	describe('normalizeSchedule', () => {
		it('merges adjacent same-task blocks into one session', () => {
			const merged = normalizeSchedule(
				[
					{
						taskId: 1,
						hours: 1,
					},
					{
						taskId: 1,
						hours: 1,
					},
				],
				8,
			);

			expect(merged).toEqual([
				{
					taskId: 1,
					hours: 2,
				},
			]);
		});

		it('clips to the window, drops empty blocks and trailing rest', () => {
			const blocks = normalizeSchedule(
				[
					{
						taskId: 1,
						hours: 3,
					},
					{
						taskId: null,
						hours: 0,
					},
					{
						taskId: 2,
						hours: 10,
					},
					{
						taskId: null,
						hours: 2,
					},
				],
				4,
			);

			expect(blocks).toEqual([
				{
					taskId: 1,
					hours: 3,
				},
				{
					taskId: 2,
					hours: 1,
				},
			]);
		});
	});

	describe('evaluateSchedule', () => {
		const tasks = [makeTask(1, 'A', 7, 4, 0.8, 0.1), makeTask(2, 'B', 3, 8, 0.2, 0.7)];

		it('objective decomposes into satiated output + free-time bonus + terminal bonus', () => {
			const ev = evaluateSchedule(
				[
					{
						taskId: 1,
						hours: 1.5,
					},
					{
						taskId: null,
						hours: 0.5,
					},
					{
						taskId: 2,
						hours: 2,
					},
				],
				tasks,
				8,
			);

			expect(ev.workHours).toBeCloseTo(3.5, 10);
			expect(ev.leisureHours).toBeCloseTo(4.5, 10);
			expect(ev.objective).toBeCloseTo(ev.satiatedOutput + ev.freeTimeBonus + ev.terminalBonus, 12);

			expect(ev.totalOutput).toBeCloseTo(
				ev.blocks.reduce((sum, b) => sum + b.output, 0),
				12,
			);

			// V(O) ≤ O with equality only at O = 0
			expect(ev.satiatedOutput).toBeLessThan(ev.totalOutput);
			expect(ev.satiatedOutput).toBeGreaterThan(0);
		});

		it('energy reservoirs drain while working and recover while resting', () => {
			const ev = evaluateSchedule(
				[
					{
						taskId: 1,
						hours: 2,
					},
					{
						taskId: null,
						hours: 1,
					},
					{
						taskId: 1,
						hours: 0.5,
					},
				],
				tasks,
				8,
			);

			const [work, rest] = ev.blocks;
			expect(work.cogAfter).toBeLessThan(DEFAULT_ENERGY_PARAMS.initialCog);
			expect(rest.cogAfter).toBeGreaterThan(work.cogAfter);
		});

		it('fragmentation is costly: contiguous work far outproduces confetti slicing', () => {
			const deep = [makeTask(1, 'deep', 6, 6, 0.7, 0.1)];

			const contiguous = evaluateSchedule(
				[
					{
						taskId: 1,
						hours: 2,
					},
				],
				deep,
				8,
			);

			const confetti: { taskId: number | null; hours: number }[] = [];

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

			const sliced = evaluateSchedule(confetti, deep, 8);
			expect(contiguous.totalOutput).toBeGreaterThan(1.5 * sliced.totalOutput);
		});

		it('a merged same-task pair scores exactly like one block (one session)', () => {
			const deep = [makeTask(1, 'deep', 6, 6, 0.7, 0.1)];

			const single = evaluateSchedule(
				[
					{
						taskId: 1,
						hours: 2,
					},
				],
				deep,
				8,
			);

			const pair = evaluateSchedule(
				[
					{
						taskId: 1,
						hours: 1,
					},
					{
						taskId: 1,
						hours: 1,
					},
				],
				deep,
				8,
			);

			expect(pair.totalOutput).toBeCloseTo(single.totalOutput, 12);
		});

		it('rest-recovery multiplier speeds recovery of an idle reservoir (Xia & Frey Law)', () => {
			const deep = [makeTask(1, 'deep', 8, 5, 0.9, 0.1)];

			// interior rest bracketed by a marker so it is not trailing-dropped
			const sched = [
				{
					taskId: 1,
					hours: 3,
				},
				{
					taskId: null,
					hours: 1,
				},
				{
					taskId: 1,
					hours: 0.01,
				},
			];

			const base = evaluateSchedule(sched, deep, 12, {
				...DEFAULT_ENERGY_PARAMS,
				restRecoveryMultiplier: 1,
			});

			const boosted = evaluateSchedule(sched, deep, 12, {
				...DEFAULT_ENERGY_PARAMS,
				restRecoveryMultiplier: 2,
			});

			expect(boosted.blocks[1].cogAfter).toBeGreaterThan(base.blocks[1].cogAfter);
		});

		it('warm-up carries over across a gap: resuming beats a hard reset (Monk/Trafton)', () => {
			const tasks = [makeTask(1, 'A', 6, 6, 0.7, 0.1), makeTask(2, 'B', 5, 5, 0.3, 0.3)];

			const sched = [
				{
					taskId: 1,
					hours: 1.5,
				},
				{
					taskId: 2,
					hours: 0.25,
				},
				{
					taskId: 1,
					hours: 1.5,
				},
			];

			const reset = evaluateSchedule(sched, tasks, 8, {
				...DEFAULT_ENERGY_PARAMS,
				resumptionTimeConstant: 0,
			});

			const carry = evaluateSchedule(sched, tasks, 8, {
				...DEFAULT_ENERGY_PARAMS,
				resumptionTimeConstant: 0.5,
			});

			expect(carry.blocks[2].output).toBeGreaterThan(reset.blocks[2].output);
		});

		it('warm-up carryover decays with gap length: short break keeps more than long', () => {
			const deep = [makeTask(1, 'A', 6, 6, 0.7, 0.1)];

			const shortGap = evaluateSchedule(
				[
					{
						taskId: 1,
						hours: 1.5,
					},
					{
						taskId: null,
						hours: 0.25,
					},
					{
						taskId: 1,
						hours: 1.5,
					},
				],
				deep,
				8,
			);

			const longGap = evaluateSchedule(
				[
					{
						taskId: 1,
						hours: 1.5,
					},
					{
						taskId: null,
						hours: 2,
					},
					{
						taskId: 1,
						hours: 1.5,
					},
				],
				deep,
				8,
			);

			expect(shortGap.blocks[2].output).toBeGreaterThan(longGap.blocks[2].output);
		});

		it('§8.2 survival: 84.648% of warm-up survives 5 min away, 1.832% survives 2 h (2026-08-18)', () => {
			// Zero demand makes the output gate C_cog^0·C_phys^0 = 1, so a block's
			// output is a function of session phase alone: a fresh run of length x
			// integrates p over [0, x], and a D-hour run resumed at phase s over
			// [s, s+D] — which is the difference of two fresh runs.
			const phaseOnly = [makeTask(1, 'A', 6, 6, 0, 0)];
			const sEnd = 0.5;
			const resumedHours = 0.1;

			const fresh = (hours: number) =>
				evaluateSchedule(
					[
						{
							taskId: 1,
							hours,
						},
					],
					phaseOnly,
					12,
				).totalOutput;

			/** What the resumed run is worth if `share` of the phase survived. */
			const atShare = (share: number) => fresh(share * sEnd + resumedHours) - fresh(share * sEnd);

			const resumedAfter = (gap: number) =>
				evaluateSchedule(
					[
						{
							taskId: 1,
							hours: sEnd,
						},
						{
							taskId: null,
							hours: gap,
						},
						{
							taskId: 1,
							hours: resumedHours,
						},
					],
					phaseOnly,
					12,
				).blocks[2].output;

			expect(DEFAULT_ENERGY_PARAMS.resumptionTimeConstant).toBe(0.5);
			expect(resumedAfter(5 / 60) / atShare(0.8464817)).toBeCloseTo(1, 5);
			expect(resumedAfter(2) / atShare(0.0183156)).toBeCloseTo(1, 5);
		});

		it('an empty schedule earns only leisure + terminal value', () => {
			const ev = evaluateSchedule([], tasks, 8);
			expect(ev.totalOutput).toBe(0);
			expect(ev.leisureHours).toBe(8);
			expect(ev.endCog).toBeCloseTo(1, 6);
			expect(ev.endPhys).toBeCloseTo(1, 6);
			// Nothing worked: "when you stop" is where you started (MATH.md §13.6).
			expect(ev.workEndCog).toBeCloseTo(1, 12);
			expect(ev.workEndPhys).toBeCloseTo(1, 12);
		});

		// MATH.md §13.6: the Lab's tile reads the end of WORK, terminalBonus the end
		// of the window. Rest after the last work block must move one and not the other.
		it('workEnd* read the last worked block, endCog/endPhys the end of the window', () => {
			const deep = [makeTask(1, 'deep', 8, 6, 1, 0)];

			const ev = evaluateSchedule(
				[
					{
						taskId: 1,
						hours: 6,
					},
				],
				deep,
				12,
			);

			const lastWorked = ev.blocks.findLast((b) => b.taskId !== null)!;
			expect(ev.workEndCog).toBe(lastWorked.cogAfter);
			expect(ev.workEndPhys).toBe(lastWorked.physAfter);
			// Six hours of full-demand cognitive work leaves you spent; the six hours
			// of implicit rest that follow refill the reservoir the terminal term sees.
			expect(ev.workEndCog).toBeLessThan(0.3);
			expect(ev.endCog).toBeGreaterThan(0.9);

			// A trailing EXPLICIT rest launders nothing either.
			const withRest = evaluateSchedule(
				[
					{
						taskId: 1,
						hours: 6,
					},
					{
						taskId: null,
						hours: 3,
					},
				],
				deep,
				12,
			);

			expect(withRest.workEndCog).toBeCloseTo(ev.workEndCog, 12);
		});
	});

	describe('satiety (per-task diminishing daily returns)', () => {
		// The winner-take-all probe scenario (2026-07-11/14): one dominant
		// high-amplitude task plus two weaker ones.
		const day = PROBE_DAY;

		const sched = [
			{
				taskId: 2,
				hours: 2,
			},
			{
				taskId: null,
				hours: 1,
			},
			{
				taskId: 2,
				hours: 2,
			},
		];

		it('satietyScale ≤ 0 recovers the pure total-output objective exactly', () => {
			const off = evaluateSchedule(sched, day, 8, {
				...DEFAULT_ENERGY_PARAMS,
				satietyScale: 0,
			});

			expect(off.satiatedOutput).toBeCloseTo(off.totalOutput, 12);

			expect(off.objective).toBeCloseTo(
				off.totalOutput + off.freeTimeBonus + off.terminalBonus,
				12,
			);
		});

		it('satiety does not touch the dynamics: raw block outputs are identical on/off', () => {
			const on = evaluateSchedule(sched, day, 8);

			const off = evaluateSchedule(sched, day, 8, {
				...DEFAULT_ENERGY_PARAMS,
				satietyScale: 0,
			});

			on.blocks.forEach((b, i) => expect(b.output).toBeCloseTo(off.blocks[i].output, 12));
			expect(on.totalOutput).toBeCloseTo(off.totalOutput, 12);
		});

		it('discounts later output on the same task more than earlier output (concavity)', () => {
			const first = evaluateSchedule(
				[
					{
						taskId: 2,
						hours: 2,
					},
				],
				day,
				8,
			);

			const both = evaluateSchedule(
				[
					{
						taskId: 2,
						hours: 4,
					},
				],
				day,
				8,
			);

			const rawGain = both.totalOutput - first.totalOutput;
			const satiatedGain = both.satiatedOutput - first.satiatedOutput;
			// still worth something (V is strictly increasing)…
			expect(satiatedGain).toBeGreaterThan(0);
			// …but the marginal value ratio fell below the first session's
			expect(satiatedGain / rawGain).toBeLessThan(first.satiatedOutput / first.totalOutput);
		});

		it('breaks winner-take-all: default optimizer funds all three tasks, satiety-off does not', () => {
			const fundedTasks = (blocks: { taskId: number | null }[]) =>
				new Set(blocks.filter((b) => b.taskId !== null).map((b) => b.taskId));

			const withSatiety = optimizeSchedule(day, 8);

			const without = optimizeSchedule(day, 8, {
				...DEFAULT_ENERGY_PARAMS,
				satietyScale: 0,
			});

			expect(fundedTasks(withSatiety.blocks).size).toBe(3);
			expect(fundedTasks(without.blocks).size).toBeLessThan(3);
		});

		it("a break cannot launder satiety away — §8.4's one hard constraint (2026-08-06)", () => {
			// Pins `scripts/satiety-gaming.probe.ts` arm A. §8.4 forbids keying
			// satiety on anything that decays over gaps, because the session phase
			// does and the re-run-the-winner exploit would come back. Nothing in
			// the suite inserted a break before this.
			//
			// κ = satietyScale·refOutput is recovered by inverting the wrapper,
			// S = κ·ln(1 + O/κ), on each schedule. If satiety saw session count or
			// gap length at all, the two would imply different κ.
			const task = makeTask(1, 'deep', 8, 5, 0.9, 0.1);

			const recoverKappa = (blocks: ScheduleBlock[]): number => {
				const evaluation = evaluateSchedule(blocks, [task], 12, DEFAULT_ENERGY_PARAMS);
				const raw = evaluation.totalOutput;
				const satiated = evaluation.satiatedOutput;
				let lo = 1e-9;
				let hi = 1e6;

				for (let i = 0; i < 200; i++) {
					const mid = (lo + hi) / 2;

					if (mid * Math.log(1 + raw / mid) < satiated) lo = mid;
					else hi = mid;
				}

				return (lo + hi) / 2;
			};

			const contiguous = recoverKappa([
				{
					taskId: 1,
					hours: 4,
				},
			]);

			const split = recoverKappa([
				{
					taskId: 1,
					hours: 2,
				},
				{
					taskId: null,
					hours: 1.5,
				},
				{
					taskId: 1,
					hours: 2,
				},
			]);

			// Same κ, so the discount is a function of the per-task TOTAL alone.
			expect(split).toBeCloseTo(contiguous, 6);

			// Non-vacuous: the break really did change the day's raw output, so
			// this is not two identical evaluations agreeing with themselves.
			expect(
				evaluateSchedule(
					[
						{
							taskId: 1,
							hours: 4,
						},
					],
					[task],
					12,
					DEFAULT_ENERGY_PARAMS,
				).totalOutput,
			).not.toBeCloseTo(
				evaluateSchedule(
					[
						{
							taskId: 1,
							hours: 2,
						},
						{
							taskId: null,
							hours: 1.5,
						},
						{
							taskId: 1,
							hours: 2,
						},
					],
					[task],
					12,
					DEFAULT_ENERGY_PARAMS,
				).totalOutput,
				6,
			);
		});
	});

	describe('micro-recovery gate (w = 1 reservoir floor)', () => {
		const day = PROBE_DAY;

		it('a full-demand task drains toward a positive floor, not zero', () => {
			// eq = b·r′/(α + b·r′) ≈ 0.149 with the defaults; the zero-floor law
			// would be at 0.091 after 8 hours.
			const ev = evaluateSchedule(
				[
					{
						taskId: 1,
						hours: 8,
					},
				],
				day,
				8,
			);

			expect(ev.blocks[0].physAfter).toBeGreaterThan(0.15);
		});

		it('microRecoveryFraction 0 recovers the pure (1−w) gate: drains toward zero', () => {
			const ev = evaluateSchedule(
				[
					{
						taskId: 1,
						hours: 8,
					},
				],
				day,
				8,
				{
					...DEFAULT_ENERGY_PARAMS,
					microRecoveryFraction: 0,
				},
			);

			expect(ev.blocks[0].physAfter).toBeLessThan(0.1);
		});

		// §8.5's floor is an identity, and the section's own justification now
		// rests on it alone — the 2026-07-14 "demand 10 vs 9.5 flips the plan"
		// cliff does not reproduce under today's search
		// (scripts/sat-gate-floor.probe.ts, 2026-08-06).
		it('the w = 1 floor is exactly b·r′/(α + b·r′), and 0 when b = 0', () => {
			const {
				microRecoveryFraction: b,
				recoveryRate,
				restRecoveryMultiplier,
			} = DEFAULT_ENERGY_PARAMS;

			const rPrime = recoveryRate * restRecoveryMultiplier;

			const long = [
				{
					taskId: 1,
					hours: 400,
				},
			];

			const floorFor = (alpha: number) => (b * rPrime) / (alpha + b * rPrime);
			const on = evaluateSchedule(long, day, 400);

			expect(on.blocks[0].physAfter).toBeCloseTo(floorFor(DEFAULT_ENERGY_PARAMS.alphaPhys), 6);

			const off = evaluateSchedule(long, day, 400, {
				...DEFAULT_ENERGY_PARAMS,
				microRecoveryFraction: 0,
			});

			expect(off.blocks[0].physAfter).toBeCloseTo(0, 6);
		});

		it('does not touch rest recovery (the gate is 1 at zero demand regardless of b)', () => {
			const half = {
				...DEFAULT_ENERGY_PARAMS,
				initialCog: 0.5,
				initialPhys: 0.5,
			};

			const on = evaluateSchedule([], day, 8, half);

			const off = evaluateSchedule([], day, 8, {
				...half,
				microRecoveryFraction: 0,
			});

			expect(on.endCog).toBeCloseTo(off.endCog, 12);
			expect(on.endPhys).toBeCloseTo(off.endPhys, 12);
		});
	});

	describe('optimizeSchedule', () => {
		it('beats the hand-built plan that exposed a local-search failure (probe 2026-07-14)', () => {
			// The pre-fix search dropped reading entirely on this day and scored
			// below this plan; the compound moves + drop-one seeds must dominate it.
			// The witness is off the 45-min lattice, so this guards SEARCH
			// reliability at the fine step it was written for; quantization loss
			// has its own tests below.
			const day = PROBE_DAY;

			const handBuilt = evaluateSchedule(
				[
					{
						taskId: 1,
						hours: 3.5,
					},
					{
						taskId: 3,
						hours: 1.5,
					},
					{
						taskId: 2,
						hours: 3,
					},
				],
				day,
				8,
			);

			const result = optimizeSchedule(day, 8, DEFAULT_ENERGY_PARAMS, undefined, {
				stepHours: 0.25,
			});

			expect(result.evaluation.objective).toBeGreaterThanOrEqual(handBuilt.objective - 1e-9);
		});

		// The two enumerated frontier days whose optimum funds a set two smaller
		// than the drop-one seeds reach (probe 2026-08-13, §8.6). Both optima are
		// pinned VALUES from that enumeration, not re-enumerated here — enumerating
		// either day is ~1 min.
		const fundedIdsOf = (blocks: ScheduleBlock[]) =>
			[...new Set(blocks.filter((b) => b.taskId !== null && b.hours > 0).map((b) => b.taskId))]
				.sort((x, y) => x! - y!)
				.join(',');

		it('funds the 2-of-4 optimum the drop-one seeds cannot reach (§8.6)', () => {
			const day = [
				makeTask(1, 'a', 6, 3, 0.5, 0.2),
				makeTask(2, 'b', 5, 8, 0.9, 0.9),
				makeTask(3, 'c', 5, 5, 0.4, 1),
				makeTask(4, 'd', 2, 7, 0.4, 0.6),
			];

			const search = optimizeSchedule(day, 6.75);

			expect(search.evaluation.objective).toBeGreaterThanOrEqual(6.1595663228 - 1e-9);
			expect(fundedIdsOf(search.blocks)).toBe('1,2');
		});

		it('funds the 2-of-5 optimum the drop-one seeds cannot reach (§8.6)', () => {
			const day = [
				makeTask(1, 'a', 9, 3, 0.6, 0.9),
				makeTask(2, 'b', 8, 7, 0.1, 0),
				makeTask(3, 'c', 6, 2, 0.2, 0.5),
				makeTask(4, 'd', 2, 2, 0.6, 0),
				makeTask(5, 'e', 7, 5, 0.8, 0.8),
			];

			const search = optimizeSchedule(day, 6);

			expect(search.evaluation.objective).toBeGreaterThanOrEqual(9.3923880946 - 1e-9);
			expect(fundedIdsOf(search.blocks)).toBe('2,5');
		});

		it('reaches the off-midpoint interior rest on the probe’s worst enumerated day (§8.6)', () => {
			// Probe 2026-08-06, scripts/energy-search-gap.probe.ts: this was the
			// worst of 60 enumerated days (2–3 tasks × 3–6 h), 0.5951% below the
			// EXHAUSTIVE lattice optimum. The search returned one 5.25 h block; the
			// optimum works the SAME 5.25 h split 3.75 + 1.5 around an interior
			// 45-min rest, which the midpoint-only split could not offer (its
			// 3 + 2.25 is downhill, so steepest ascent stopped there).
			const day = [makeTask(1, 'heavy', 10, 7, 0.5, 0.8), makeTask(2, 'light', 4, 8, 0.9, 0.1)];
			const search = optimizeSchedule(day, 6);

			const optimum = evaluateSchedule(
				[
					{
						taskId: 1,
						hours: 3.75,
					},
					{
						taskId: null,
						hours: 0.75,
					},
					{
						taskId: 1,
						hours: 1.5,
					},
				],
				day,
				6,
			);

			expect(search.evaluation.objective).toBeGreaterThanOrEqual(optimum.objective - 1e-9);
		});

		it('with zero leisure/terminal value it never leaves the window end idle', () => {
			const tasks = [makeTask(1, 'grind', 6, 5, 0.8, 0.2)];

			const result = optimizeSchedule(tasks, 12, {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: 0,
				terminalEnergyValue: 0,
			});

			const span = result.blocks.reduce((sum, b) => sum + b.hours, 0);
			expect(span).toBeCloseTo(12, 9);
			expect(result.blocks[result.blocks.length - 1].taskId).not.toBeNull();
		});

		it('leisure + terminal value produce genuine early stopping', () => {
			const tasks = [makeTask(1, 'grind', 6, 5, 0.8, 0.2)];

			const noValues = optimizeSchedule(tasks, 12, {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: 0,
				terminalEnergyValue: 0,
			});

			// With efficient recovery and warm-up carryover, sustained work is
			// attractive, so the default values trim work only at the margin — but a
			// stronger leisure price stops it outright (the mechanism, not a fixed gap).
			const withValues = optimizeSchedule(tasks, 12);
			expect(withValues.evaluation.workHours).toBeLessThan(noValues.evaluation.workHours);

			const highLeisure = optimizeSchedule(tasks, 12, {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: 2,
			});

			expect(highLeisure.evaluation.workHours).toBe(0);
		});

		it('concentrates a scarce hour on ONE of two identical tasks (no spreading)', () => {
			const twins = [makeTask(1, 'A', 5, 5, 0.5, 0.1), makeTask(2, 'B', 5, 5, 0.5, 0.1)];

			const result = optimizeSchedule(twins, 1, {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: 0.1,
			});

			const funded = new Set(result.blocks.filter((b) => b.taskId !== null).map((b) => b.taskId));
			expect(funded.size).toBe(1);
		});

		it('never returns a schedule worse than doing nothing, and is deterministic', () => {
			const tasks = [
				makeTask(1, 'write spec', 8, 6, 0.9, 0.1),
				makeTask(2, 'gym', 4, 7, 0.1, 0.9),
				makeTask(3, 'email', 3, 3, 0.4, 0.1),
				makeTask(4, 'refactor', 7, 5, 0.8, 0.1),
			];

			const a = optimizeSchedule(tasks, 8);
			const b = optimizeSchedule(tasks, 8);
			const empty = evaluateSchedule([], tasks, 8);
			expect(a.evaluation.objective).toBeGreaterThanOrEqual(empty.objective - 1e-9);
			expect(a.blocks).toEqual(b.blocks);
		});

		it('schedules restorative interior rest on a long demanding window', () => {
			// Pre-fix this returned one continuous block and never rested; with the
			// recovery correction + warm-up carryover, interspersed breaks now pay.
			const deep = [makeTask(1, 'deep', 8, 5, 0.9, 0.1)];
			const result = optimizeSchedule(deep, 10);
			const restBlocks = result.blocks.filter((b) => b.taskId === null).length;
			expect(restBlocks).toBeGreaterThan(0);
		});

		it('handles no tasks and zero window gracefully', () => {
			expect(optimizeSchedule([], 8).blocks).toEqual([]);
			const zero = optimizeSchedule([makeTask(1, 'A', 5, 5, 0.5, 0.1)], 0);
			expect(zero.blocks).toEqual([]);
			expect(zero.evaluation.objective).toBeCloseTo(DEFAULT_ENERGY_PARAMS.terminalEnergyValue, 9);
		});
	});

	describe('45-min block granularity (MATH.md §8.8)', () => {
		const probeDay = PROBE_DAY;

		const mixedDay = [
			makeTask(1, 'write spec', 8, 6, 0.9, 0.1),
			makeTask(2, 'gym', 4, 7, 0.1, 0.9),
			makeTask(3, 'email', 3, 3, 0.4, 0.1),
			makeTask(4, 'refactor', 7, 5, 0.8, 0.1),
		];

		const funded = (blocks: { taskId: number | null }[]) =>
			new Set(blocks.filter((b) => b.taskId !== null).map((b) => b.taskId));

		it('every block is a whole number of 45-min units, even for off-lattice windows', () => {
			for (const windowHours of [1, 4.5, 7.9, 8, 10.1, 12]) {
				for (const tasks of [probeDay, mixedDay]) {
					const { blocks } = optimizeSchedule(tasks, windowHours);
					const total = blocks.reduce((sum, b) => sum + b.hours, 0);
					expect(total).toBeLessThanOrEqual(windowHours + 1e-9);

					for (const b of blocks) {
						const units = b.hours / DEFAULT_STEP_HOURS;
						expect(Math.abs(units - Math.round(units))).toBeLessThan(1e-9);
					}
				}
			}
		});

		// The slowest test in the suite: it runs the 0.25 h lattice twice, 32 slots
		// deep, which is where the §8.6 pair seeds climb longest — this fixture went
		// 813 ms → 1970 ms when they landed. That fits the 5 s default alone but not
		// alongside the browser projects, so the timeout below is a hang detector,
		// not a machine-speed gate.
		it('quantization keeps ≥97% of the fine-step objective, and both days’ structure', () => {
			// Probe 2026-08-21: ratios 0.9843 (probeDay) and 0.9952 (mixedDay). The
			// bound leaves slack for param drift but catches a structural regression
			// outright. The funded set now survives the lattice on BOTH days, so the
			// assertion covers both: the probe day's 3-vs-2 mismatch was a property
			// of the unreachable demands it carried until M44, not of the lattice
			// (§8.8).
			for (const tasks of [probeDay, mixedDay]) {
				const coarse = optimizeSchedule(tasks, 8);

				const fine = optimizeSchedule(tasks, 8, DEFAULT_ENERGY_PARAMS, undefined, {
					stepHours: 0.25,
				});

				expect(coarse.evaluation.objective).toBeGreaterThanOrEqual(
					0.97 * fine.evaluation.objective,
				);

				expect(funded(coarse.blocks)).toEqual(funded(fine.blocks));
			}
		}, 20_000);

		it('honors a stepHours override (blocks land on that lattice instead)', () => {
			const { blocks } = optimizeSchedule(probeDay, 8, DEFAULT_ENERGY_PARAMS, undefined, {
				stepHours: 0.5,
			});

			expect(blocks.length).toBeGreaterThan(0);

			for (const b of blocks) {
				const units = b.hours / 0.5;
				expect(Math.abs(units - Math.round(units))).toBeLessThan(1e-9);
			}
		});
	});

	describe('drain-rate calibration (fitDrainRate)', () => {
		const lawParams = {
			recoveryRate: DEFAULT_ENERGY_PARAMS.recoveryRate,
			restRecoveryMultiplier: DEFAULT_ENERGY_PARAMS.restRecoveryMultiplier,
			microRecoveryFraction: DEFAULT_ENERGY_PARAMS.microRecoveryFraction,
		};

		// Independent forward model (mirrors MATH.md §8.7): drained fraction
		// after H hours at demand w from a full reservoir.
		function drained(w: number, H: number, alpha: number): number {
			const rec = lawParams.recoveryRate * lawParams.restRecoveryMultiplier;
			const gate = 1 - (1 - lawParams.microRecoveryFraction) * w;
			const rho = alpha * w + rec * gate;
			const eq = (rec * gate) / rho;

			return 1 - (eq + (1 - eq) * Math.exp(-rho * H));
		}

		const grid: [number, number][] = [
			[1, 1],
			[1, 2],
			[0.8, 1.5],
			[0.6, 3],
			[0.9, 0.75],
			[0.5, 2],
			[1, 4],
			[0.7, 2.5],
		];

		const cleanObs = (alphaStar: number): DrainObservation[] =>
			grid.map(([w, H]) => ({
				demand: w,
				hours: H,
				drainedFraction: drained(w, H, alphaStar),
			}));

		it('recovers the prior mean exactly and a nearby true α closely from clean data', () => {
			const atPrior = fitDrainRate(cleanObs(0.35), 0.35, lawParams);
			expect(atPrior.fitted).toBe(true);
			expect(atPrior.usedCount).toBe(8);
			expect(atPrior.alpha).toBeCloseTo(0.35, 3);
			// Away from the prior the ridge shrinks the estimate toward 0.35 a
			// little; λ was tuned so 8 clean logs land within ~10% (probe 2026-07-15).
			const away = fitDrainRate(cleanObs(0.7), 0.35, lawParams);
			expect(away.alpha).toBeGreaterThan(0.6);
			expect(away.alpha).toBeLessThan(0.7);
		});

		it('falls back with fitted: false on empty or uninformative observations', () => {
			expect(fitDrainRate([], 0.35, lawParams)).toEqual({
				alpha: 0.35,
				fitted: false,
				usedCount: 0,
			});

			// demand 0: the rated reservoir was never touched by this session
			const idle = fitDrainRate(
				[
					{
						demand: 0,
						hours: 2,
						drainedFraction: 0.9,
					},
				],
				0.35,
				lawParams,
			);

			expect(idle.fitted).toBe(false);
			expect(idle.alpha).toBe(0.35);
		});

		it('demand-0 observations carry no signal even when mixed with real ones', () => {
			const real: DrainObservation = {
				demand: 1,
				hours: 2,
				drainedFraction: drained(1, 2, 0.35),
			};

			const alone = fitDrainRate([real], 0.35, lawParams);

			const mixed = fitDrainRate(
				[
					{
						demand: 0,
						hours: 2,
						drainedFraction: 1,
					},
					real,
				],
				0.35,
				lawParams,
			);

			expect(mixed.alpha).toBeCloseTo(alone.alpha, 6);
			expect(mixed.usedCount).toBe(1);
		});

		it('a single rating moves α partway toward its implication; more logs move further', () => {
			// 8/10 drained after 2h at full demand — the defaults predict ≈ 4.8/10,
			// and the rating alone implies α ≈ 0.89.
			const one = fitDrainRate(
				[
					{
						demand: 1,
						hours: 2,
						drainedFraction: 0.8,
					},
				],
				0.35,
				lawParams,
			);

			expect(one.alpha).toBeGreaterThan(0.5); // moved substantially…
			expect(one.alpha).toBeLessThan(0.75); // …but the prior still holds part back

			const five = fitDrainRate(
				Array.from(
					{
						length: 5,
					},
					() => ({
						demand: 1,
						hours: 2,
						drainedFraction: 0.8,
					}),
				),
				0.35,
				lawParams,
			);

			expect(five.alpha).toBeGreaterThan(one.alpha);
		});

		it('is monotone in the reported drain and stays inside the fit bounds', () => {
			let prev = -Infinity;

			for (let rating = 0; rating <= 10; rating++) {
				const fit = fitDrainRate(
					[
						{
							demand: 1,
							hours: 2,
							drainedFraction: rating / 10,
						},
					],
					0.35,
					lawParams,
				);

				expect(fit.alpha).toBeGreaterThanOrEqual(prev - 1e-9);
				expect(fit.alpha).toBeGreaterThanOrEqual(ALPHA_FIT_MIN);
				expect(fit.alpha).toBeLessThanOrEqual(ALPHA_FIT_MAX);
				prev = fit.alpha;
			}

			// Absurd data pins to a bound instead of breaking anything
			const absurd = fitDrainRate(
				Array.from(
					{
						length: 6,
					},
					() => ({
						demand: 1,
						hours: 0.25,
						drainedFraction: 1,
					}),
				),
				0.35,
				lawParams,
			);

			// The literal, not ALPHA_FIT_MAX: asserting a bound against its own
			// constant moves both sides together, so the VALUE stays unpinned —
			// lowering it to 0.9 left the whole suite green (sweep 2026-08-20).
			expect(absurd.alpha).toBeCloseTo(2, 6);
		});

		it('posterior std shrinks with data and grows with inconsistency', () => {
			const consistent = Array.from(
				{
					length: 8,
				},
				() => ({
					demand: 1,
					hours: 2,
					drainedFraction: 0.5,
				}),
			);

			const noisy = [0.2, 0.8, 0.3, 0.7, 0.4, 0.9, 0.1, 0.6].map((d) => ({
				demand: 1,
				hours: 2,
				drainedFraction: d,
			}));

			const few = fitDrainRate(consistent.slice(0, 2), 0.35, lawParams);
			const many = fitDrainRate(consistent, 0.35, lawParams);
			const scattered = fitDrainRate(noisy, 0.35, lawParams);
			expect(many.alphaStd!).toBeLessThan(few.alphaStd!);
			expect(scattered.alphaStd!).toBeGreaterThan(many.alphaStd!);
			// Literals for the same reason the ± above carries: DRAIN_NOISE_PRIOR_STD
			// sets the floor these sit on and only a probe mentioned it, against its
			// own value. The two orderings above hold whatever it is set to.
			expect(many.alphaStd!).toBeCloseTo(0.032664, 6);
			expect(scattered.alphaStd!).toBeCloseTo(0.090441, 6);
		});

		it('is deterministic', () => {
			const obs = cleanObs(0.9);
			const a = fitDrainRate(obs, 0.35, lawParams);
			const b = fitDrainRate(obs, 0.35, lawParams);
			expect(a).toEqual(b);
		});
	});

	describe('recovery-rate calibration (fitRecoveryRate, MATH.md §8.9)', () => {
		const m = DEFAULT_ENERGY_PARAMS.restRecoveryMultiplier;

		const restParams = {
			restRecoveryMultiplier: m,
		};

		const prior = DEFAULT_ENERGY_PARAMS.recoveryRate;

		// Independent forward model: during pure rest the drained fraction
		// decays exponentially at the corrected recovery rate r·m.
		const pair = (rate: number, before: number, hours: number): RestObservation => ({
			drainedBefore: before,
			drainedAfter: before * Math.exp(-rate * m * hours),
			hours,
		});

		// One logged rest = mind + body, two observations of the same break.
		const loggedRests = (rate: number, count: number): RestObservation[] =>
			Array.from(
				{
					length: count,
				},
				(_, i) => {
					const hours = [0.5, 0.75, 1, 0.5, 0.75, 0.5, 1, 0.75][i % 8];

					return [pair(rate, 0.6, hours), pair(rate, 0.45, hours)];
				},
			).flat();

		it('recovers the prior mean exactly and a nearby true rate closely from clean data', () => {
			const atPrior = fitRecoveryRate(loggedRests(prior, 8), prior, restParams);
			expect(atPrior.fitted).toBe(true);
			expect(atPrior.usedCount).toBe(16);
			expect(atPrior.rate).toBeCloseTo(prior, 3);
			// Away from the prior the ridge shrinks a little; λ was tuned so 8
			// clean logged rests land within ~10% (probe 2026-07-18: 1.4 → 1.31).
			const away = fitRecoveryRate(loggedRests(1.4, 8), prior, restParams);
			expect(away.rate).toBeGreaterThan(1.25);
			expect(away.rate).toBeLessThan(1.4);
		});

		it('falls back with fitted: false on empty or uninformative observations', () => {
			expect(fitRecoveryRate([], prior, restParams)).toEqual({
				rate: prior,
				fitted: false,
				usedCount: 0,
			});

			// Fresh going in (nothing to recover) or a zero-length break (no time
			// to recover in): the prediction is constant in r — no signal.
			const uninformative = fitRecoveryRate(
				[
					{
						drainedBefore: 0,
						drainedAfter: 0,
						hours: 1,
					},
					{
						drainedBefore: 0.5,
						drainedAfter: 0.5,
						hours: 0,
					},
				],
				prior,
				restParams,
			);

			expect(uninformative.fitted).toBe(false);
			expect(uninformative.rate).toBe(prior);
		});

		it('a single logged rest moves r about halfway; more logs move further and tighten the std', () => {
			// Probe-tuned λ (2026-07-18): 1 rest → 51% of the way, 3 → 72%, 10 → 88%.
			const one = fitRecoveryRate(loggedRests(1.4, 1), prior, restParams);
			expect(one.rate).toBeGreaterThan(prior + 0.4 * (1.4 - prior));
			expect(one.rate).toBeLessThan(prior + 0.65 * (1.4 - prior));
			const ten = fitRecoveryRate(loggedRests(1.4, 10), prior, restParams);
			expect(ten.rate).toBeGreaterThan(one.rate);
			expect(ten.rateStd!).toBeLessThan(one.rateStd!);
		});

		it('identifies the product r·m: refitting under a different multiplier rescales r', () => {
			// Rest data cannot separate r from the rest multiplier — the fit
			// conditions on m exactly like the α fit conditions on r. Generate at
			// (r=1.2, m=1.5) and fit under m=1.0: the data now implies r ≈ 1.8
			// (the product), so the fitted rate must land well above 1.2 and head
			// toward 1.8 — short of it only by the ridge shrinkage, which is
			// larger here because the implied rate sits further from the prior.
			const data = loggedRests(1.2, 8);

			const underUnitMultiplier = fitRecoveryRate(data, prior, {
				restRecoveryMultiplier: 1,
			});

			expect(underUnitMultiplier.rate).toBeGreaterThan(1.45);
			expect(underUnitMultiplier.rate).toBeLessThan(1.2 * m);
		});

		it('adversarial pairs (more drained after resting) pin to the lower bound with a wide std', () => {
			const fit = fitRecoveryRate(
				[
					{
						drainedBefore: 0.3,
						drainedAfter: 0.6,
						hours: 0.5,
					},
					{
						drainedBefore: 0.4,
						drainedAfter: 0.7,
						hours: 0.5,
					},
				],
				prior,
				restParams,
			);

			expect(fit.fitted).toBe(true);
			// The literal lower bound, for the reason ALPHA_FIT_MAX carries above:
			// raising RECOVERY_FIT_MIN to 0.6 moved this fit 0.1 -> 0.6 and every
			// other rate with it, and nothing went red.
			expect(fit.rate).toBeCloseTo(0.1, 9);
			expect(fit.rate).toBeLessThan(prior);
			// The residuals are large, so the noise blend must report low confidence.
			// Pinned to the literal because this ± is what the Energy page prints:
			// RECOVERY_NOISE_PRIOR_STD and CALIBRATION_NOISE_PRIOR_WEIGHT both feed
			// it and neither had a fixture (sweep 2026-08-20).
			expect(fit.rateStd!).toBeCloseTo(0.6149, 4);
		});

		it('fitting r first reduces the alpha fit bias it was built to remove (probe 2026-07-18)', () => {
			// True world: fast recoverer (r = 1.4) with true αcog = 0.5. Drain
			// ratings fitted at the default r must bend α down to compensate;
			// conditioning on the r fitted from rest pairs recovers most of it.
			const TRUE_R = 1.4;
			const TRUE_ALPHA = 0.5;

			const drainAt = (recovery: number, w: number, hours: number) => {
				const rec = recovery * m;
				const gate = 1 - (1 - DEFAULT_ENERGY_PARAMS.microRecoveryFraction) * w;
				const rho = TRUE_ALPHA * w + rec * gate;
				const eq = (rec * gate) / rho;

				return 1 - (eq + (1 - eq) * Math.exp(-rho * hours));
			};

			const drainObs = [1.5, 2, 2.5, 2, 1.5].map((hours) => ({
				demand: 0.9,
				hours,
				drainedFraction: drainAt(TRUE_R, 0.9, hours),
			}));

			const lawParams = (recovery: number) => ({
				recoveryRate: recovery,
				restRecoveryMultiplier: m,
				microRecoveryFraction: DEFAULT_ENERGY_PARAMS.microRecoveryFraction,
			});

			const biased = fitDrainRate(drainObs, DEFAULT_ENERGY_PARAMS.alphaCog, lawParams(prior));
			const rFit = fitRecoveryRate(loggedRests(TRUE_R, 5), prior, restParams);

			const conditioned = fitDrainRate(
				drainObs,
				DEFAULT_ENERGY_PARAMS.alphaCog,
				lawParams(rFit.rate),
			);

			expect(Math.abs(conditioned.alpha - TRUE_ALPHA)).toBeLessThan(
				Math.abs(biased.alpha - TRUE_ALPHA),
			);
		});

		it('is deterministic', () => {
			const obs = loggedRests(1.1, 4);
			const a = fitRecoveryRate(obs, prior, restParams);
			const b = fitRecoveryRate(obs, prior, restParams);
			expect(a).toEqual(b);
		});
	});

	describe('stopping-value calibration (fitStoppingValue, MATH.md §8.10)', () => {
		// The same day `scripts/stop-inversion-margin.probe.ts` declares, field for
		// field; the reachability reasoning is on `PROBE_DAY` itself.
		const day = PROBE_DAY;
		const prior = DEFAULT_ENERGY_PARAMS.freeTimeValue;

		/**
		 * MATH.md §8.10's break-omission witness: sliders 8/3/8 and 0/3/2 through
		 * `toEnergyTask` (difficulty 8 + 0.3·3 and 3, demands slider/10), a 14 h
		 * window, and the three sessions the app's own plan at λ₀ 0.7 works —
		 * 45-minute breaks between them, which is what the log moments carry.
		 */
		const WITNESS_LOGGED: StopObservation = {
			tasks: [makeTask(1, 'deep work', 8.9, 8, 0.8, 0.3), makeTask(2, 'errand', 3, 2, 0, 0.3)],
			windowHours: 14,
			workedHours: [
				{
					taskId: 1,
					hours: 3.75,
					endedAt: LOG_ORIGIN + 3.75 * MS_PER_HOUR,
				},
				{
					taskId: 1,
					hours: 2.25,
					endedAt: LOG_ORIGIN + 6.75 * MS_PER_HOUR,
				},
				{
					taskId: 1,
					hours: 1.5,
					endedAt: LOG_ORIGIN + 9 * MS_PER_HOUR,
				},
			],
		};

		/**
		 * The three censored days §8.10 drops, declared once because two tests below
		 * read them: `EDGE_DAY` worked its whole window so
		 * no step was forgone (`hi` only), `SLIVER_DAY` carries less than one step
		 * so no step can be undone (`lo` only), and `EMPTY_DAY` logged nothing at
		 * all and so reveals neither.
		 */
		const EDGE_DAY: StopObservation = {
			tasks: day,
			windowHours: 6,
			workedHours: [
				{
					taskId: 2,
					hours: 6,
				},
			],
		};

		const EMPTY_DAY: StopObservation = {
			tasks: day,
			windowHours: 8,
			workedHours: [],
		};

		const SLIVER_DAY: StopObservation = {
			tasks: day,
			windowHours: 8,
			workedHours: [
				{
					taskId: 2,
					hours: 0.5,
				},
			],
		};

		/**
		 * A day that ended with every task ticked: hours logged, room left in the
		 * window, and nothing open to extend, so `bestNextStep` has no candidate
		 * and only `λ₀ ≤ hi` survives. §8.10 calls this the ordinary good day the
		 * fit discards whole, and 2026-08-21 measured what using it would cost.
		 */
		const COMPLETED_DAY: StopObservation = {
			tasks: day,
			windowHours: 12,
			workedHours: [
				{
					taskId: 1,
					hours: 2.25,
					endedAt: LOG_ORIGIN + 2.25 * MS_PER_HOUR,
				},
				{
					taskId: 2,
					hours: 1.5,
					endedAt: LOG_ORIGIN + 4.5 * MS_PER_HOUR,
				},
			],
			openTaskIds: new Set(),
		};

		// Synthetic user: work the plan the optimizer builds at the TRUE λ₀ and log
		// each session as it finishes — one 🪫 row per session carrying the moment
		// it ended (§18), which is what the day's breaks survive in. `summed`
		// re-reads the same day with the moments dropped: the reading before
		// 2026-08-19, and still what a batch-logged day gets.
		const dayFromPlan = (trueLambda: number, windowHours: number): StopObservation => {
			const { blocks } = optimizeSchedule(day, windowHours, {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: trueLambda,
			});

			const workedHours: StopObservation['workedHours'] = [];
			let clock = 0;

			for (const b of blocks) {
				clock += b.hours;

				if (b.taskId !== null)
					workedHours.push({
						taskId: b.taskId,
						hours: b.hours,
						endedAt: LOG_ORIGIN + clock * MS_PER_HOUR,
					});
			}

			return {
				tasks: day,
				windowHours,
				workedHours,
			};
		};

		const summed = (observation: StopObservation): StopObservation => ({
			...observation,
			workedHours: observation.workedHours.map(({ taskId, hours }) => ({
				taskId,
				hours,
			})),
		});

		it('recovers the generating λ₀ from synthetic days across windows', () => {
			// Probe 2026-07-19: per-day brackets contain the true λ₀ = 0.9 and
			// midpoints sit at ≈ 1.0; three days ridge-blended with the 0.5 prior
			// land near the truth.
			const days = [8, 10, 12].map((T) => dayFromPlan(0.9, T));
			const fit = fitStoppingValue(days, prior, DEFAULT_ENERGY_PARAMS);
			expect(fit.fitted).toBe(true);
			expect(fit.usedCount).toBe(3);
			expect(fit.value).toBeGreaterThan(0.75);
			expect(fit.value).toBeLessThan(1.05);

			// And the log moments are READ: the same days summed into one contiguous
			// block fit a different λ₀. Which reading lands closer is a population
			// question, not a three-day one — `stop-block-structure.probe.ts` measures
			// it over 441 cells (logged |err| mean 0.086 against summed 0.123, better
			// at every λ₀ level), and on these three days summed happens to land
			// nearer. Asserting the direction here pinned a population property to a
			// sample, and passed only on a fixture the sliders could not produce
			// (MATH.md §8.10, 2026-08-19).
			const flat = fitStoppingValue(days.map(summed), prior, DEFAULT_ENERGY_PARAMS);
			expect(flat.usedCount).toBe(3);
			expect(fit.value).not.toBeCloseTo(flat.value, 3);
		});

		// Both readings, because the reconstruction now has a second input: the log
		// moments. They are wall-clock numbers and no slider can reach them, so the
		// recovered structure is λ₀-free by construction — this is the guard that
		// the fallback predicate never acquires a λ₀ dependence either.
		it('extraction is λ₀-free: the current freeTimeValue slider cannot bias it', () => {
			for (const obs of [dayFromPlan(0.9, 10), summed(dayFromPlan(0.9, 10))]) {
				const at0 = stopIndifferencePoint(obs, {
					...DEFAULT_ENERGY_PARAMS,
					freeTimeValue: 0,
				});

				const at3 = stopIndifferencePoint(obs, {
					...DEFAULT_ENERGY_PARAMS,
					freeTimeValue: 3,
				});

				expect(at0).not.toBeNull();
				expect(at0).toBe(at3);
			}
		});

		// MATH.md §8.10: break omission was listed as absorbed noise and measured as
		// the dominant, one-signed error term. The witness is the ruling's own —
		// sliders 8/3/8 beside 0/3/2 through `toEnergyTask`, a 14 h window, and the
		// app's own plan for it at λ₀ 0.7 (t1 3.75 / rest 0.75 / t1 2.25 / rest 0.75
		// / t1 1.5). Pinned as the PAIR: summed reads 0.293 low and inverts its
		// bracket (lo 0.469 > hi 0.345, kept because the gap is inside the margin),
		// the logged reading lands 0.030 high and does not invert.
		it('reads the day’s breaks off the 🪫 rows’ own log moments', () => {
			const params = {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: 0.7,
			};

			expect(stopIndifferencePoint(WITNESS_LOGGED, params)!).toBeCloseTo(0.73042, 5);
			expect(stopIndifferencePoint(summed(WITNESS_LOGGED), params)!).toBeCloseTo(0.40664, 5);
		});

		// The fix cannot apply to a day whose sessions were all written down at once,
		// and it must not pretend otherwise: no gap is recoverable, so the day reads
		// exactly as it did before. Same for a row whose moment is unusable — a
		// restored backup can carry one, and the whole DAY falls back, not the row.
		it('falls back to the summed reading when no structure is recoverable', () => {
			const flat = stopIndifferencePoint(summed(WITNESS_LOGGED), DEFAULT_ENERGY_PARAMS);

			const batched: StopObservation = {
				...WITNESS_LOGGED,
				workedHours: WITNESS_LOGGED.workedHours.map((row) => ({
					...row,
					endedAt: LOG_ORIGIN + 20 * MS_PER_HOUR,
				})),
			};

			const oneUnusable: StopObservation = {
				...WITNESS_LOGGED,
				workedHours: WITNESS_LOGGED.workedHours.map((row, i) =>
					i === 1
						? {
								taskId: row.taskId,
								hours: row.hours,
							}
						: row,
				),
			};

			expect(stopIndifferencePoint(batched, DEFAULT_ENERGY_PARAMS)).toBe(flat);
			expect(stopIndifferencePoint(oneUnusable, DEFAULT_ENERGY_PARAMS)).toBe(flat);
		});

		// Recovered rest is scaled to leave one step of room, so a day whose logged
		// span runs past its declared window still prices — and `window-full` keeps
		// reading WORKED hours, because a verdict must never be decided by recovered
		// structure. 3 h worked inside a 9 h span of an 8 h window: room, not full.
		it('keeps the window arithmetic on worked hours, not the recovered span', () => {
			const overrun: StopObservation = {
				tasks: [makeTask(1, 'deep work', 7, 6, 0.8, 0.2)],
				windowHours: 8,
				workedHours: [
					{
						taskId: 1,
						hours: 1.5,
						endedAt: LOG_ORIGIN + 1.5 * MS_PER_HOUR,
					},
					{
						taskId: 1,
						hours: 1.5,
						endedAt: LOG_ORIGIN + 9 * MS_PER_HOUR,
					},
				],
				openTaskIds: new Set([1]),
			};

			expect(stopIndifferencePoint(overrun, DEFAULT_ENERGY_PARAMS)).toBeCloseTo(0.73342, 5);

			expect(adviseStop(overrun, DEFAULT_ENERGY_PARAMS)).toMatchObject({
				verdict: 'continue',
			});
		});

		it('stopping earlier reveals a higher indifference price (diminishing marginals)', () => {
			const early: StopObservation = {
				tasks: day,
				windowHours: 12,
				workedHours: [
					{
						taskId: 1,
						hours: 2.25,
					},
				],
			};

			const late: StopObservation = {
				tasks: day,
				windowHours: 12,
				workedHours: [
					{
						taskId: 1,
						hours: 3,
					},
					{
						taskId: 2,
						hours: 3,
					},
					{
						taskId: 3,
						hours: 1.5,
					},
				],
			};

			expect(stopIndifferencePoint(early, DEFAULT_ENERGY_PARAMS)!).toBeGreaterThan(
				stopIndifferencePoint(late, DEFAULT_ENERGY_PARAMS)!,
			);
		});

		it('prices the stop against OPEN work only — finished tasks are no forgone step', () => {
			const worked = [
				{
					taskId: 1,
					hours: 2.25,
				},
			];

			const allOpen = stopIndifferencePoint(
				{
					tasks: day,
					windowHours: 12,
					workedHours: worked,
				},
				DEFAULT_ENERGY_PARAMS,
			);

			// The explicit full set is the same day: omitting the field means
			// every task was still open.
			expect(
				stopIndifferencePoint(
					{
						tasks: day,
						windowHours: 12,
						workedHours: worked,
						openTaskIds: new Set([1, 2, 3]),
					},
					DEFAULT_ENERGY_PARAMS,
				),
			).toBe(allOpen);

			// Boxing done, the other two still open: the stop is priced against
			// what was left, so the revealed leisure value is lower.
			expect(
				stopIndifferencePoint(
					{
						tasks: day,
						windowHours: 12,
						workedHours: worked,
						openTaskIds: new Set([2, 3]),
					},
					DEFAULT_ENERGY_PARAMS,
				)!,
			).toBeLessThan(allOpen!);

			// Everything checked off: the day forwent nothing, so it reveals no
			// indifference at all and drops like a worked-to-the-edge day.
			expect(
				stopIndifferencePoint(
					{
						tasks: day,
						windowHours: 12,
						workedHours: worked,
						openTaskIds: new Set(),
					},
					DEFAULT_ENERGY_PARAMS,
				),
			).toBeNull();
		});

		// Re-pinned 2026-08-19 from `scripts/stop-inversion-margin.probe.ts`'s
		// witness arm, on the reachable fixture above: the one day the 2026-08-12
		// open-task correction was argued on, logged the way the app logs it (the
		// row carries its moment, `openTaskIds` is the Set `session-history.ts`
		// always builds). The sibling above asserts only that one is smaller, which
		// cannot catch a change that moves both.
		it('prices the §8.10 witness day at 1.321 over all tasks and 1.190 over the two left open', () => {
			const observation: StopObservation = {
				tasks: day,
				windowHours: 12,
				workedHours: [
					{
						taskId: 1,
						hours: 2.25,
						endedAt: LOG_ORIGIN + 2.25 * MS_PER_HOUR,
					},
				],
				openTaskIds: new Set([1, 2, 3]),
			};

			const allOpen = stopIndifferencePoint(observation, DEFAULT_ENERGY_PARAMS)!;

			const filtered = stopIndifferencePoint(
				{
					...observation,
					openTaskIds: new Set([2, 3]),
				},
				DEFAULT_ENERGY_PARAMS,
			)!;

			expect(allOpen).toBeCloseTo(1.32147, 3);
			expect(filtered).toBeCloseTo(1.18957, 3);
			expect(allOpen - filtered).toBeCloseTo(0.1319, 3);
		});

		// `lo` is a max over the open tasks, `hi` never reads them, and the censor
		// fires on max(0, lo) > hi + margin — so shrinking the set can only lower
		// the point and can only un-censor. The empty set is the sibling above.
		it('narrowing the open set can only lower the point, never censor a kept day', () => {
			const compositions = [
				[
					{
						taskId: 1,
						hours: 2.25,
					},
				],
				[
					{
						taskId: 1,
						hours: 3,
					},
					{
						taskId: 2,
						hours: 3,
					},
					{
						taskId: 3,
						hours: 1.5,
					},
				],
			];

			const subsets = [[1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]];

			for (const workedHours of compositions) {
				const allOpen = stopIndifferencePoint(
					{
						tasks: day,
						windowHours: 12,
						workedHours,
					},
					DEFAULT_ENERGY_PARAMS,
				)!;

				expect(allOpen).not.toBeNull();

				for (const ids of subsets) {
					const point = stopIndifferencePoint(
						{
							tasks: day,
							windowHours: 12,
							workedHours,
							openTaskIds: new Set(ids),
						},
						DEFAULT_ENERGY_PARAMS,
					);

					expect(point).not.toBeNull();
					expect(point!).toBeLessThanOrEqual(allOpen);
				}
			}
		});

		it('drops censored and uninformative days; all-dropped falls back', () => {
			for (const observation of [EDGE_DAY, EMPTY_DAY, SLIVER_DAY])
				expect(stopIndifferencePoint(observation, DEFAULT_ENERGY_PARAMS)).toBeNull();

			expect(
				fitStoppingValue([EDGE_DAY, EMPTY_DAY, SLIVER_DAY], prior, DEFAULT_ENERGY_PARAMS),
			).toEqual({
				value: prior,
				fitted: false,
				usedCount: 0,
			});
		});

		/**
		 * (pin) Which SIDE each censored category reveals, which the midpoint threw
		 * away until `stopBracket` was exported for the probes that had to rebuild
		 * it. Nothing asserted this before, and nothing about it moved: the fit still
		 * reads the midpoint and still drops every day that has no midpoint.
		 */
		it('names the side a censored day reveals, and the midpoint is the bracket’s (pin)', () => {
			// Worked to the window edge, and every task ticked: no forgone step, so
			// only λ₀ ≤ hi. A sliver carries no whole step to undo, so only λ₀ ≥ lo.
			for (const observation of [EDGE_DAY, COMPLETED_DAY]) {
				const bracket = stopBracket(observation, DEFAULT_ENERGY_PARAMS)!;
				expect(bracket.lo).toBeNull();
				expect(bracket.hi).not.toBeNull();
			}

			const sliver = stopBracket(SLIVER_DAY, DEFAULT_ENERGY_PARAMS)!;
			expect(sliver.hi).toBeNull();
			expect(sliver.lo).not.toBeNull();

			expect(stopBracket(EMPTY_DAY, DEFAULT_ENERGY_PARAMS)).toBeNull();

			const twoSided = dayFromPlan(0.9, 10);
			const bracket = stopBracket(twoSided, DEFAULT_ENERGY_PARAMS)!;

			expect(stopIndifferencePoint(twoSided, DEFAULT_ENERGY_PARAMS)).toBe(
				(bracket.lo! + bracket.hi!) / 2,
			);
		});

		it('censors a strongly inverted day (interruption) but keeps a mild inversion at its midpoint', () => {
			// Strong inversion — a long grind on the weakest task while
			// boxing/guitar sat unstarted: the marginal of STARTING a strong task
			// exceeds what the last reading step was worth by far more than
			// STOP_INVERSION_MARGIN. The day's own data contradicts a rational stop,
			// so only the one-sided λ₀ ≤ hi reading survives — censored like a
			// worked-to-the-edge day, NOT averaged into the fit: its midpoint sits
			// at the task curves' characteristic marginal regardless of the user's
			// true λ₀ (MATH.md §8.10). The lo/hi/gap figures that stood here were
			// measured on the unreachable fixture and no arm of
			// `stop-inversion-margin.probe.ts` prints this day, so they are gone
			// rather than re-derived.
			const grind: StopObservation = {
				tasks: day,
				windowHours: 12,
				workedHours: [
					{
						taskId: 3,
						hours: 4.5,
					},
				],
			};

			expect(stopIndifferencePoint(grind, DEFAULT_ENERGY_PARAMS)).toBeNull();
			expect(fitStoppingValue([grind], prior, DEFAULT_ENERGY_PARAMS).fitted).toBe(false);

			// A 1-step interrupted sliver is the practical contamination case —
			// also censored.
			const sliver: StopObservation = {
				tasks: day,
				windowHours: 12,
				workedHours: [
					{
						taskId: 3,
						hours: DEFAULT_STEP_HOURS,
					},
				],
			};

			expect(stopIndifferencePoint(sliver, DEFAULT_ENERGY_PARAMS)).toBeNull();

			// Mild inversion — 2.25h of reading only, inverted by less than the
			// margin (the instrument's own slack): kept at the bracket midpoint
			// and used by the fit. The assertions below rebuild the bracket, so
			// the gap is checked rather than quoted.
			const mild: StopObservation = {
				tasks: day,
				windowHours: 12,
				workedHours: [
					{
						taskId: 3,
						hours: 2.25,
					},
				],
			};

			const step = DEFAULT_STEP_HOURS;

			const workValue = (blocks: { taskId: number | null; hours: number }[]) => {
				const ev = evaluateSchedule(blocks, day, 12, DEFAULT_ENERGY_PARAMS);

				return ev.satiatedOutput + ev.terminalBonus;
			};

			const base = workValue([
				{
					taskId: 3,
					hours: 2.25,
				},
			]);

			// Unlogged tasks are probed at their CANONICAL amplitude position
			// (MATH.md §13.4). Boxing (10.4) and guitar (6.67) both outrank
			// reading (4.60), so their probe block goes BEFORE it, not appended.
			const lo = Math.max(
				(workValue([
					{
						taskId: 3,
						hours: 2.25 + step,
					},
				]) -
					base) /
					step,
				(workValue([
					{
						taskId: 1,
						hours: step,
					},
					{
						taskId: 3,
						hours: 2.25,
					},
				]) -
					base) /
					step,
				(workValue([
					{
						taskId: 2,
						hours: step,
					},
					{
						taskId: 3,
						hours: 2.25,
					},
				]) -
					base) /
					step,
			);

			const hi =
				(base -
					workValue([
						{
							taskId: 3,
							hours: 2.25 - step,
						},
					])) /
				step;

			expect(lo).toBeGreaterThan(hi); // inverted...
			expect(lo).toBeLessThanOrEqual(hi + STOP_INVERSION_MARGIN); // ...but within the margin

			expect(stopIndifferencePoint(mild, DEFAULT_ENERGY_PARAMS)).toBeCloseTo(
				(Math.max(0, lo) + hi) / 2,
				10,
			);

			expect(fitStoppingValue([mild], prior, DEFAULT_ENERGY_PARAMS).usedCount).toBe(1);
		});

		it('censoring DOES discard some near-rational days — "zero inversions" was wrong (2026-08-06, §8.10)', () => {
			// Pins the correction from `scripts/stop-inversion-margin.probe.ts`.
			// §8.10 asserted three times that optimizer days and their ±1-lattice-
			// step "mood" variants "produced zero inversions" / "never invert at
			// all", and that is the entire argument that censoring throws away
			// interruptions and not honest days. On a wider grid: 4 of 315
			// optimizer days invert, and 44 of 1179 mood variants do, 6 of them
			// past the margin. This is one of those 6, found by search and frozen.
			//
			// The claim is not that the margin is mis-set — it is that the
			// population it excludes is not empty, so the cost of censoring is a
			// real number rather than zero.
			const params = {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: 0.9,
			};

			const tasks = [makeTask(1, 'light', 4, 10, 0.8, 0.2), makeTask(2, 'heavy', 10, 5, 0.6, 0.4)];
			const windowHours = 12;

			const rational: StopObservation = {
				tasks,
				windowHours,
				workedHours: [
					{
						taskId: 2,
						hours: 6.75,
					},
					{
						taskId: 1,
						hours: 1.5,
					},
				],
			};

			// The optimizer's own plan for this day reads cleanly.
			expect(stopIndifferencePoint(rational, params)).not.toBeNull();

			// One lattice step of "mood" off it — 15 minutes' less on the light
			// task — and the day is censored.
			const mood: StopObservation = {
				tasks,
				windowHours,
				workedHours: [
					{
						taskId: 2,
						hours: 6.75,
					},
					{
						taskId: 1,
						hours: 1.5 - DEFAULT_STEP_HOURS,
					},
				],
			};

			expect(stopIndifferencePoint(mood, params)).toBeNull();
		});

		it('an interrupted day NO margin can censor still reads far above the λ₀ that generated it (2026-08-13, §8.10)', () => {
			// Pins the load-bearing finding of
			// `scripts/stop-margin-fit-error.probe.ts`: the inversion margin cannot
			// price the contamination it exists for, because most interrupted days
			// never invert. This is the optimizer's own plan for a λ₀ = 0.3 user —
			// guitar 3.75h, boxing 3.75h, reading 2.25h on the reachable fixture
			// above — with the last 2.25h of guitar interrupted away. Its bracket is
			// NOT inverted, so no margin at any width censors it, yet its midpoint
			// sits at the task curves' characteristic marginal, far above the λ₀
			// that generated it. (The bracket bounds and the ratio quoted here
			// before were measured on the unreachable fixture, and that probe still
			// draws its days off-surface, so they are gone rather than re-derived.)
			const params = {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: 0.3,
			};

			const interrupted: StopObservation = {
				tasks: day,
				windowHours: 10,
				workedHours: [
					{
						taskId: 1,
						hours: 3.75,
					},
					{
						taskId: 3,
						hours: 2.25,
					},
					{
						taskId: 2,
						hours: 1.5,
					},
				],
			};

			const point = stopIndifferencePoint(interrupted, params);

			expect(point).not.toBeNull();
			expect(point!).toBeGreaterThan(0.3 + 1);
		});

		it('prior profile is exact arithmetic: one day moves λ₀ halfway to its point', () => {
			const obs = dayFromPlan(1.3, 10);
			const point = stopIndifferencePoint(obs, DEFAULT_ENERGY_PARAMS)!;
			const fit = fitStoppingValue([obs], prior, DEFAULT_ENERGY_PARAMS);
			expect(fit.value).toBeCloseTo((point + prior) / 2, 10);
		});

		it('posterior std shrinks with consistent data', () => {
			const obs = dayFromPlan(0.9, 10);
			const two = fitStoppingValue([obs, obs], prior, DEFAULT_ENERGY_PARAMS);

			const eight = fitStoppingValue(
				Array.from(
					{
						length: 8,
					},
					() => obs,
				),
				prior,
				DEFAULT_ENERGY_PARAMS,
			);

			expect(eight.valueStd!).toBeLessThan(two.valueStd!);
			// Both ± pinned to literals: STOP_NOISE_PRIOR_STD and
			// CALIBRATION_NOISE_PRIOR_WEIGHT reach the Energy page through them and
			// the shrinkage above holds whatever either is set to.
			expect(two.valueStd!).toBeCloseTo(0.12588, 5);
			expect(eight.valueStd!).toBeCloseTo(0.049596, 6);
		});

		it('W*(λ₀) is monotone with a graded response — §8.3’s bang-bang is gone (satiety fixed it)', () => {
			const worked = [0.4, 0.8, 1.2, 1.5].map((l) => {
				const { blocks } = optimizeSchedule(day, 12, {
					...DEFAULT_ENERGY_PARAMS,
					freeTimeValue: l,
				});

				return blocks.reduce((s, b) => s + (b.taskId !== null ? b.hours : 0), 0);
			});

			for (let i = 1; i < worked.length; i++) {
				expect(worked[i]).toBeLessThanOrEqual(worked[i - 1] + 1e-9);
			}

			expect(new Set(worked.map((w) => w.toFixed(2))).size).toBeGreaterThanOrEqual(3);
		});

		/**
		 * The SHIPPED default, which nothing measured until 2026-08-20: the ladder
		 * above samples λ₀ ∈ {0.4, 0.8, 1.2, 1.5} and §8.3's probe
		 * {0.2, 0.4, 0.8, 1.0, 1.2, 1.5}, so 0.5 — the value the app runs on — was
		 * in neither. Pinned to the literal, not to
		 * `DEFAULT_ENERGY_PARAMS.freeTimeValue`, so that moving the default shows
		 * up here as the product decision it is. Both declarations of this day
		 * (M44) give 11.25 h, so the figure does not depend on that ambiguity.
		 */
		/**
		 * §8.10 feasibility 2: V_T is conditioned on, not fitted, BECAUSE it moves
		 * the stop. The 300-day sweep behind that (2026-08-21) reports a median
		 * 1-step span and 5 steps at worst; this pins the cheapest witness of the
		 * mechanism on the day the file already declares, so a change that made V_T
		 * stop mattering could not pass. Literals, not `terminalEnergyValue` — the
		 * point is the gap between the two ends of the sweep, and reading the
		 * default for one end would let both sides move together (ROADMAP M45).
		 */
		it('V_T moves the optimal stop, which is why the fit conditions on it', () => {
			const stop = (terminalEnergyValue: number) =>
				optimizeSchedule(PROBE_DAY, 8, {
					...DEFAULT_ENERGY_PARAMS,
					freeTimeValue: 0.9,
					terminalEnergyValue,
				}).evaluation.workHours;

			expect(stop(0)).toBeCloseTo(6.75, 9);
			expect(stop(6)).toBeCloseTo(6, 9);
		});

		it('plans 11.25 h of a 12-hour window at the shipped default λ₀', () => {
			const { evaluation } = optimizeSchedule(day, 12, DEFAULT_ENERGY_PARAMS);
			expect(DEFAULT_ENERGY_PARAMS.freeTimeValue).toBe(0.5);
			expect(evaluation.workHours).toBeCloseTo(11.25, 9);
		});

		/**
		 * …and what that default means is a property of the DAY, not of λ₀: the
		 * same 0.5 fills 94% of the window above and 38% here. That is why the
		 * default cannot be read off one probe day, and why raising it is not a
		 * free tuning move — one slider notch to λ₀ = 1 (the Lab's range is
		 * [0, 3] step 0.1) empties the plan on this portfolio entirely, and that
		 * optimum is real: satiated output over 4.5 h of these tasks is worth less
		 * than 12 h of leisure priced at 1 (§8.3, §15).
		 */
		it('the same default tapers to 4.5 h on a light day, and λ₀ = 1 empties it', () => {
			const light = [makeTask(1, 'errand', 3, 5, 0.2, 0.2), makeTask(2, 'tidy', 2, 4, 0.1, 0.3)];

			for (const windowHours of [8, 10, 12, 14]) {
				expect(
					optimizeSchedule(light, windowHours, DEFAULT_ENERGY_PARAMS).evaluation.workHours,
				).toBeCloseTo(4.5, 9);
			}

			expect(
				optimizeSchedule(light, 12, {
					...DEFAULT_ENERGY_PARAMS,
					freeTimeValue: 1,
				}).evaluation.workHours,
			).toBe(0);
		});

		it('is deterministic', () => {
			const days = [dayFromPlan(0.9, 8), dayFromPlan(0.9, 12)];
			const a = fitStoppingValue(days, prior, DEFAULT_ENERGY_PARAMS);
			const b = fitStoppingValue(days, prior, DEFAULT_ENERGY_PARAMS);
			expect(a).toEqual(b);
		});
	});

	describe('live stop advisor (adviseStop, MATH.md §8.11)', () => {
		const singleTask = [makeTask(1, 'Deep work', 7, 6, 0.8, 0.2)];

		const singleDay = (hours: number, windowHours = 8): StopObservation => ({
			tasks: singleTask,
			windowHours,
			workedHours:
				hours > 0
					? [
							{
								taskId: 1,
								hours,
							},
						]
					: [],
		});

		/** Narrows to the priced arm; a test reaching this on the wrong arm fails. */
		const priced = (advice: StopAdvice | null) => {
			if (advice === null || advice.verdict === 'window-full') {
				throw new Error('expected a priced verdict');
			}

			return advice;
		};

		const workValue = (hours: number, windowHours = 8) => {
			const ev = evaluateSchedule(
				hours > 0
					? [
							{
								taskId: 1,
								hours,
							},
						]
					: [],
				singleTask,
				windowHours,
			);

			return ev.satiatedOutput + ev.terminalBonus;
		};

		it('prices the best next session of a single-task day exactly: max over whole-step durations of the average work-value gain per hour', () => {
			const worked = 1.5;
			const room = Math.floor((8 - worked) / DEFAULT_STEP_HOURS);
			let expected = -Infinity;
			let expectedHours = 0;

			for (let m = 1; m <= room; m++) {
				const hours = m * DEFAULT_STEP_HOURS;
				const avg = (workValue(worked + hours) - workValue(worked)) / hours;

				if (avg > expected) {
					expected = avg;
					expectedHours = hours;
				}
			}

			const advice = priced(adviseStop(singleDay(worked), DEFAULT_ENERGY_PARAMS));

			expect(advice.taskId).toBe(1);
			expect(advice.marginalValue).toBeCloseTo(expected, 12);
			expect(advice.sessionHours).toBeCloseTo(expectedHours, 12);
		});

		// MATH.md §8.11 shares §8.10's reconstruction, and it applies no censor, so
		// the recovered breaks reach the live card directly. Two things to hold: the
		// day's own break is read, and a probed SESSION is priced at its full length
		// rather than clipped by `normalizeSchedule` — the counterfactual pays its
		// overhang out of the day's last rest instead.
		it('prices a probed session on its full length, out of the recovered break', () => {
			const errand = makeTask(1, 'errand', 3, 2, 0, 0.3);
			const deep = makeTask(2, 'deep work', 9, 10, 0.9, 0.2);

			const observation: StopObservation = {
				tasks: [deep, errand],
				windowHours: 8,
				workedHours: [
					{
						taskId: 1,
						hours: 0.75,
						endedAt: LOG_ORIGIN + 0.75 * MS_PER_HOUR,
					},
					{
						taskId: 1,
						hours: 0.75,
						endedAt: LOG_ORIGIN + 6 * MS_PER_HOUR,
					},
				],
				openTaskIds: new Set([1, 2]),
			};

			const advice = priced(adviseStop(observation, DEFAULT_ENERGY_PARAMS));

			// The day reads [errand 0.75, rest 4.5, errand 0.75]; the best session is
			// 3 fresh steps of `deep`, inserted at its canonical rank ahead of the
			// logged work, and 4.5 + 2.25 h does not fit an 8 h window — so 2.25 h of
			// the break pays for it. Priced against the clipped schedule the same
			// session reads 1.30025, and `normalizeSchedule` would have cut the
			// logged work itself away to make room.
			expect(advice.taskId).toBe(2);
			expect(advice.sessionHours).toBe(2.25);
			expect(advice.marginalValue).toBeCloseTo(1.35921, 5);
			expect(advice.marginalValue).toBeGreaterThan(1.30026);
		});

		it('looks ahead past the warm-up ramp: continues when only a longer session clears λ₀ (probe 2026-08-03)', () => {
			// Hard, unloved task: long ϕ, so the first 45 min is mostly ramp and its
			// one-step marginal undersells the session. A one-step advisor stops here.
			const grind = [makeTask(1, 'Grind', 10, 2, 0.6, 0.2)];

			const value = (hours: number) => {
				const ev = evaluateSchedule(
					hours > 0
						? [
								{
									taskId: 1,
									hours,
								},
							]
						: [],
					grind,
					10,
				);

				return ev.satiatedOutput + ev.terminalBonus;
			};

			const oneStep = (value(DEFAULT_STEP_HOURS) - value(0)) / DEFAULT_STEP_HOURS;
			let bestAvg = -Infinity;

			for (let m = 1; m <= Math.floor(10 / DEFAULT_STEP_HOURS); m++) {
				const hours = m * DEFAULT_STEP_HOURS;

				bestAvg = Math.max(bestAvg, (value(hours) - value(0)) / hours);
			}

			// The fixture only tests something while the two straddle a λ₀.
			expect(bestAvg).toBeGreaterThan(oneStep);

			const advice = priced(
				adviseStop(
					{
						tasks: grind,
						windowHours: 10,
						workedHours: [],
					},
					{
						...DEFAULT_ENERGY_PARAMS,
						freeTimeValue: (oneStep + bestAvg) / 2,
					},
				),
			);

			expect(advice.verdict).toBe('continue');
			expect(advice.marginalValue).toBeCloseTo(bestAvg, 12);
		});

		it('continues at a mid-day checkpoint where the one-step arm would cry stop (λ₀ = 0.9, probe 2026-08-06)', () => {
			// scripts/stop-advisor.probe.ts measured the one-step arm false-stopping
			// on 19.7% of mid-day checkpoints at λ₀ = 0.9 against the session arm's
			// 6.6% (MATH.md §8.11). A rate is the sweep; this pins the MECHANISM on
			// one checkpoint of a day built the probe's WAY (not one of its 72
			// seeded days — the probe prints rates and dumps no exemplar) — ground
			// truth is the
			// optimizer's own plan under λ₀ = 0.9 walked chronologically, and the
			// advisor sees only the composition worked so far.
			//
			// Measured here: the one-step arm's best is 0.6157 (one more step of A,
			// well past A's ramp) or 0.5490 (B's first step, almost all ramp), both
			// under λ₀; the session arm prices 3 h of B at 1.0761 and continues.
			const lambda = 0.9;

			const params = {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: lambda,
			};

			const windowHours = 12;
			const workedOnA = 6;
			const pair = [makeTask(1, 'Deep A', 9, 8, 0.5, 0.5), makeTask(2, 'Deep B', 9, 4, 0.5, 0.5)];
			// Truth here is CONTINUE: the plan spends its first 6 h on A (3.75 +
			// rest + 2.25) and still has 3.75 h of B to go, so a stop verdict at
			// this checkpoint would be a false stop.
			const plan = optimizeSchedule(pair, windowHours, params);
			let prefixOnA = 0;

			for (const b of plan.blocks) {
				if (b.taskId === null) continue;

				if (b.taskId !== 1) break;

				prefixOnA += b.hours;
			}

			const planWork = plan.blocks.reduce((sum, b) => sum + (b.taskId === null ? 0 : b.hours), 0);
			expect(prefixOnA).toBeGreaterThanOrEqual(workedOnA - 1e-9);
			expect(planWork).toBeGreaterThanOrEqual(workedOnA + DEFAULT_STEP_HOURS - 1e-9);

			const value = (blocks: ScheduleBlock[]) => {
				const ev = evaluateSchedule(blocks, pair, windowHours, params);

				return ev.satiatedOutput + ev.terminalBonus;
			};

			const base = value([
				{
					taskId: 1,
					hours: workedOnA,
				},
			]);

			const perHour = (blocks: ScheduleBlock[], hours: number) => (value(blocks) - base) / hours;

			const advice = priced(
				adviseStop(
					{
						tasks: pair,
						windowHours,
						workedHours: [
							{
								taskId: 1,
								hours: workedOnA,
							},
						],
					},
					params,
				),
			);

			// The one-step replica below is only honest if it shares adviseStop's
			// own base and canonical-rank placement (B ranks under A, so B's block
			// appends). Reproducing the SHIPPED recommendation's price from the
			// replica is that check: same search, two lookaheads.
			expect(advice.taskId).toBe(2);
			expect(advice.sessionHours).toBeCloseTo(3, 12);

			expect(advice.marginalValue).toBeCloseTo(
				perHour(
					[
						{
							taskId: 1,
							hours: workedOnA,
						},
						{
							taskId: 2,
							hours: 3,
						},
					],
					3,
				),
				12,
			);

			const oneStep = Math.max(
				perHour(
					[
						{
							taskId: 1,
							hours: workedOnA + DEFAULT_STEP_HOURS,
						},
					],
					DEFAULT_STEP_HOURS,
				),
				perHour(
					[
						{
							taskId: 1,
							hours: workedOnA,
						},
						{
							taskId: 2,
							hours: DEFAULT_STEP_HOURS,
						},
					],
					DEFAULT_STEP_HOURS,
				),
			);

			// Both halves of the claim: the naive advisor stops here, the shipped
			// one continues. Collapsing adviseStop back to m = 1 fails all three.
			expect(oneStep).toBeLessThan(lambda);
			expect(advice.marginalValue).toBeGreaterThan(lambda);
			expect(advice.verdict).toBe('continue');
		});

		it('verdict flips across the freeTimeValue threshold; the marginal itself is λ₀-free', () => {
			const day = singleDay(1.5);
			const base = priced(adviseStop(day, DEFAULT_ENERGY_PARAMS));

			const at = (freeTimeValue: number) =>
				priced(
					adviseStop(day, {
						...DEFAULT_ENERGY_PARAMS,
						freeTimeValue,
					}),
				);

			const generous = at(base.marginalValue - 0.01);
			const stingy = at(base.marginalValue + 0.01);

			expect(generous.verdict).toBe('continue');
			expect(stingy.verdict).toBe('stop');
			expect(generous.marginalValue).toBe(base.marginalValue);
			expect(stingy.marginalValue).toBe(base.marginalValue);
		});

		it('on a fresh morning it advises starting, and picks the lighter of two curve-twins', () => {
			// Identical curve (same difficulty/enjoyment), different demands: the
			// low-demand twin's first block drains less and gates higher, so the
			// argmax is known without assuming an amplitude order.
			const heavy = makeTask(1, 'Heavy', 8, 5, 0.9, 0.9);
			const light = makeTask(2, 'Light', 8, 5, 0.3, 0.3);

			const advice = priced(
				adviseStop(
					{
						tasks: [heavy, light],
						windowHours: 8,
						workedHours: [],
					},
					DEFAULT_ENERGY_PARAMS,
				),
			);

			expect(advice.verdict).toBe('continue');
			expect(advice.taskId).toBe(2);
		});

		it('degrades to stop as the day wears on: a λ₀ the fresh day clears, a worn day does not', () => {
			const fresh = priced(adviseStop(singleDay(0, 10), DEFAULT_ENERGY_PARAMS));
			const worn = priced(adviseStop(singleDay(6, 10), DEFAULT_ENERGY_PARAMS));

			expect(worn.marginalValue).toBeLessThan(fresh.marginalValue);
			expect(fresh.verdict).toBe('continue');
			expect(worn.verdict).toBe('stop');
		});

		it('recommends only candidate tasks, while non-candidate work still shapes the day', () => {
			// The non-candidate dominates every unfiltered max (higher amplitude,
			// lighter demands), so this test can only pass through the filter.
			const pair = [
				makeTask(1, 'Done already', 8, 8, 0.3, 0.2),
				makeTask(2, 'Still open', 4, 4, 0.5, 0.5),
			];

			const withHistory = priced(
				adviseStop(
					{
						tasks: pair,
						windowHours: 10,
						workedHours: [
							{
								taskId: 1,
								hours: 4.5,
							},
						],
						openTaskIds: new Set([2]),
					},
					DEFAULT_ENERGY_PARAMS,
				),
			);

			const withoutHistory = priced(
				adviseStop(
					{
						tasks: pair,
						windowHours: 10,
						workedHours: [],
						openTaskIds: new Set([2]),
					},
					DEFAULT_ENERGY_PARAMS,
				),
			);

			expect(withHistory.taskId).toBe(2);
			expect(withoutHistory.taskId).toBe(2);
			// The completed task's 4.5 h drained the reservoirs the open task needs,
			// so pricing it as if the day were fresh would be a different number.
			expect(withHistory.marginalValue).not.toBeCloseTo(withoutHistory.marginalValue, 6);
			expect(withHistory.marginalValue).toBeLessThan(withoutHistory.marginalValue);
		});

		// The sibling above ranks the LOGGED task first, so its probe lands last
		// either way. This is the other branch of `growBy` (MATH.md §13.4): a
		// candidate probed AHEAD of logged work, which is what makes the forward
		// reading order-dependent (MATH.md §8.11's bounds). Three tasks, with the
		// candidate at rank 1, so the position is the MIDDLE — insert-first,
		// append-last and canonical are three different numbers here, where two
		// tasks would let a constant index 0 pass for canonical.
		it('inserts an unlogged candidate at its canonical rank, between higher- and lower-amplitude logged work', () => {
			const trio = [
				makeTask(1, 'Deep work', 9, 9, 0.8, 0.2), // rank 0 by amplitude a + p₀
				makeTask(2, 'Review', 6, 6, 0.8, 0.2), // rank 1 — the candidate
				makeTask(3, 'Admin', 3, 3, 0.8, 0.2), // rank 2
			];

			const worked: ScheduleBlock[] = [
				{
					taskId: 1,
					hours: 2.25,
				},
				{
					taskId: 3,
					hours: 2.25,
				},
			];

			// Leaves room for exactly one step, so the advice IS the m = 1 probe.
			const windowHours = 4.5 + DEFAULT_STEP_HOURS;

			const value = (blocks: ScheduleBlock[]) => {
				const ev = evaluateSchedule(blocks, trio, windowHours);

				return ev.satiatedOutput + ev.terminalBonus;
			};

			const base = value(worked);
			const probe = (blocks: ScheduleBlock[]) => (value(blocks) - base) / DEFAULT_STEP_HOURS;

			const step: ScheduleBlock = {
				taskId: 2,
				hours: DEFAULT_STEP_HOURS,
			};

			const advice = priced(
				adviseStop(
					{
						tasks: trio,
						windowHours,
						workedHours: worked.map((b) => ({
							taskId: b.taskId!,
							hours: b.hours,
						})),
						openTaskIds: new Set([2]),
					},
					DEFAULT_ENERGY_PARAMS,
				),
			);

			expect(advice.sessionHours).toBeCloseTo(DEFAULT_STEP_HOURS, 12);
			expect(advice.marginalValue).toBeCloseTo(probe([worked[0], step, worked[1]]), 12);
			// Neither end of the day is the same number — which is the point of
			// pinning the convention rather than the value.
			expect(advice.marginalValue).not.toBeCloseTo(probe([step, ...worked]), 6);
			expect(advice.marginalValue).not.toBeCloseTo(probe([...worked, step]), 6);
		});

		it('returns null when no candidate is left to recommend', () => {
			expect(
				adviseStop(
					{
						...singleDay(1.5),
						openTaskIds: new Set(),
					},
					DEFAULT_ENERGY_PARAMS,
				),
			).toBeNull();
		});

		it('reports window-full when no whole step fits, including hours logged past the window', () => {
			expect(adviseStop(singleDay(7.6), DEFAULT_ENERGY_PARAMS)).toEqual({
				verdict: 'window-full',
			});

			expect(adviseStop(singleDay(9), DEFAULT_ENERGY_PARAMS)).toEqual({
				verdict: 'window-full',
			});
		});

		it('returns null when there is nothing to advise on', () => {
			expect(adviseStop(singleDay(1, 0), DEFAULT_ENERGY_PARAMS)).toBeNull();

			expect(
				adviseStop(
					{
						tasks: [],
						windowHours: 8,
						workedHours: [],
					},
					DEFAULT_ENERGY_PARAMS,
				),
			).toBeNull();
		});

		it('is deterministic', () => {
			const a = adviseStop(singleDay(1.5), DEFAULT_ENERGY_PARAMS);
			const b = adviseStop(singleDay(1.5), DEFAULT_ENERGY_PARAMS);

			expect(a).toEqual(b);
		});
	});

	describe('numeric verification (closed forms vs independent integration)', () => {
		const p = DEFAULT_ENERGY_PARAMS;

		it('reservoir closed form matches Euler integration of dC/dτ = −αwC + r·m·(1−(1−b)w)(1−C)', () => {
			const task = makeTask(1, 'x', 7, 4, 0.8, 0.3);
			const hours = 2.5;

			const ev = evaluateSchedule(
				[
					{
						taskId: 1,
						hours,
					},
				],
				[task],
				8,
				p,
			);

			const euler = (w: number, alpha: number) => {
				let C = 1;
				const n = 400000;
				const dt = hours / n;
				const rec = p.recoveryRate * p.restRecoveryMultiplier;
				const gate = 1 - (1 - p.microRecoveryFraction) * w;
				for (let i = 0; i < n; i++) C += dt * (-alpha * w * C + rec * gate * (1 - C));

				return C;
			};

			expect(ev.blocks[0].cogAfter).toBeCloseTo(euler(0.8, p.alphaCog), 5);
			expect(ev.blocks[0].physAfter).toBeCloseTo(euler(0.3, p.alphaPhys), 5);
		});

		it('simulateReservoirs agrees with evaluateSchedule end levels (the Burnout Risk core)', () => {
			const tasks = [makeTask(1, 'A', 7, 4, 0.8, 0.1), makeTask(2, 'B', 3, 8, 0.2, 0.7)];

			const blocks = [
				{
					taskId: 1,
					hours: 1.5,
				},
				{
					taskId: null,
					hours: 0.5,
				},
				{
					taskId: 2,
					hours: 2,
				},
			];

			// Window = span, so evaluateSchedule appends no tail rest.
			const ev = evaluateSchedule(blocks, tasks, 4, p);
			const sim = simulateReservoirs(blocks, tasks, p);
			expect(sim.endCog).toBeCloseTo(ev.endCog, 12);
			expect(sim.endPhys).toBeCloseTo(ev.endPhys, 12);
		});

		it('Simpson block output matches an independent fine midpoint integration at the ϕ floor', () => {
			// Near-floor ϕ inside a long block is the worst case for the quadrature's
			// 1024-node cap (probe 2026-07-23: rel. error 6.9e-7; headroom kept here).
			const fast = makeTask(1, 'fast', 1, 10, 0.9, 0.1);

			const constants = {
				c1: 0.1,
				c2: -0.05,
				c3: 0.05,
			}; // ϕ hits the 0.1h floor

			const hours = 8;

			const ev = evaluateSchedule(
				[
					{
						taskId: 1,
						hours,
					},
				],
				[fast],
				12,
				p,
				constants,
			);

			// Independent replica of the integrand p(s)·C_cog^wc·C_phys^wp.
			const E = mapEffort(1);
			const beta = mapEnjoyability(10);
			const phi = calculateFlowStateTime(E, beta, constants);
			const amp = E * beta + beta / E;
			const k = 1 / phi;
			const rec = p.recoveryRate * p.restRecoveryMultiplier;

			const law = (w: number, alpha: number) => {
				const gate = 1 - (1 - p.microRecoveryFraction) * w;
				const rho = alpha * w + rec * gate;

				return {
					rho,
					eq: (rec * gate) / rho,
				};
			};

			const lc = law(0.9, p.alphaCog);
			const lp = law(0.1, p.alphaPhys);

			const cAt = (l: { rho: number; eq: number }, t: number) =>
				l.eq + (1 - l.eq) * Math.exp(-l.rho * t);

			const n = 500000;
			let sum = 0;

			for (let i = 0; i < n; i++) {
				const u = ((i + 0.5) * hours) / n;

				sum +=
					amp * k * u * Math.exp(-k * u) * Math.pow(cAt(lc, u), 0.9) * Math.pow(cAt(lp, u), 0.1);
			}

			const numeric = (sum * hours) / n;
			expect(Math.abs(ev.blocks[0].output - numeric) / numeric).toBeLessThan(1e-4);
		});
	});

	describe('budget curve (suggestBudgetCurve, MATH.md §8.12)', () => {
		const tasks = [makeTask(1, 'A', 7, 5, 0.8, 0.2), makeTask(2, 'B', 4, 7, 0.2, 0.8)];

		it('sweeps the whole range on the step lattice, one point per step', () => {
			const curve = suggestBudgetCurve(tasks, DEFAULT_ENERGY_PARAMS, undefined, {
				maxBudgetHours: 6,
			});

			expect(curve.points.map((p) => p.budgetHours)).toEqual([
				0.75, 1.5, 2.25, 3, 3.75, 4.5, 5.25, 6,
			]);

			expect(curve.maxBudgetHours).toBe(6);
			expect(curve.freeTimeValue).toBe(DEFAULT_ENERGY_PARAMS.freeTimeValue);

			// Work never exceeds the budget it was solved under.
			for (const point of curve.points)
				expect(point.workHours).toBeLessThanOrEqual(point.budgetHours + 1e-9);
		});

		it('the recommendation is the SMALLEST budget reaching the best day value', () => {
			// ONE task at the default λ₀, which is where an interior knee actually lives:
			// satiety is per-task (§8.4), so a multi-task day always has a fresh task to
			// move to and runs to the cap. This one recommends 7.5 h of a 12 h sweep, so
			// nine points sit strictly below the best and seven tie it — both loops below
			// run, which is what makes "smallest" a tested claim rather than a
			// restatement. (The e2e's task, at the form's default sliders rather than
			// this one's, crosses at 8.25 h — same shape, different day.)
			const curve = suggestBudgetCurve([tasks[0]], DEFAULT_ENERGY_PARAMS);
			const best = Math.max(...curve.points.map((p) => p.dayValue));

			expect(curve.recommendedHours).toBe(7.5);

			const below = curve.points.filter((p) => p.budgetHours < curve.recommendedHours!);
			const atOrAbove = curve.points.filter((p) => p.budgetHours >= curve.recommendedHours!);

			// Non-vacuity: both sides are populated, so neither loop is skipped.
			expect(below.length).toBe(9);
			expect(atOrAbove.length).toBe(7);

			for (const point of below) expect(point.dayValue).toBeLessThan(best);

			for (const point of atOrAbove) expect(point.dayValue).toBeCloseTo(best, 12);
		});

		it('reports no recommendation when the best value is at the top of the range', () => {
			// λ₀ = 0 prices free time at nothing, so every extra hour is worth working
			// and the day value is still climbing when the sweep runs out.
			const curve = suggestBudgetCurve(
				tasks,
				{
					...DEFAULT_ENERGY_PARAMS,
					freeTimeValue: 0,
				},
				undefined,
				{
					maxBudgetHours: 6,
				},
			);

			expect(curve.recommendedHours).toBeNull();
		});

		it('a high price on free time recommends a short day', () => {
			// λ₀ = 0.75 is where this fixture's knee comes inside a 6 h cap. Pinned
			// with the work and the marginal AT the recommendation, not just the
			// hours: a recommendation that books nothing is the failure mode this
			// test exists to catch, and `recommendedHours < 6` alone passes on it.
			const curve = suggestBudgetCurve(
				tasks,
				{
					...DEFAULT_ENERGY_PARAMS,
					freeTimeValue: 0.75,
				},
				undefined,
				{
					maxBudgetHours: 6,
				},
			);

			expect(curve.recommendedHours).toBe(4.5);

			const at = curve.points.find((p) => p.budgetHours === curve.recommendedHours)!;

			expect(at.workHours).toBeGreaterThan(0);
			expect(at.valuePerHour).toBeGreaterThan(0);
		});

		it('recommends nothing when no window beats not working at all', () => {
			// Priced above the whole board, the optimizer books nothing at any budget.
			// `dayValue` is then flat at the do-nothing day, and the sweep must say so
			// rather than name its first step: seeded from -Infinity the first budget
			// always "rose", which advertised a 45-minute day booking 0 h of work
			// under copy claiming an hour past it adds nothing (MATH.md §8.12).
			const curve = suggestBudgetCurve(
				tasks,
				{
					...DEFAULT_ENERGY_PARAMS,
					freeTimeValue: 3,
				},
				undefined,
				{
					maxBudgetHours: 6,
				},
			);

			expect(curve.recommendedHours).toBeNull();
			expect(curve.points.every((p) => p.workHours === 0)).toBe(true);
			expect(curve.points.every((p) => p.valuePerHour === 0)).toBe(true);
		});

		it('day value never falls as the budget grows — the running max (MATH.md §14.2)', () => {
			// A fixture that ACTUALLY dips, found by search: `plan(b)` maximizes the
			// objective at its own window rather than this score, so the raw
			// common-horizon sweep falls 8.4906 → 8.4508 between 8.25 h and 9 h here.
			// Most fixtures never dip at all (§8.12 measures 0.4% of steps) and pass this
			// assertion with the running max deleted — mutation-verified, so keep THIS
			// fixture: it is the one that fails when the floor goes.
			const dipping = [makeTask(1, 'A', 6, 8, 0.9, 0.7), makeTask(2, 'B', 7, 6, 0.1, 0.8)];

			const curve = suggestBudgetCurve(dipping, DEFAULT_ENERGY_PARAMS, undefined, {
				maxBudgetHours: 9,
			});

			for (let i = 1; i < curve.points.length; i++)
				expect(curve.points[i].dayValue).toBeGreaterThanOrEqual(curve.points[i - 1].dayValue);

			// The flat step the floor produces, pinned by value: without it this point
			// reads below its predecessor and `valuePerHour` goes negative.
			const flat = curve.points.find((p) => p.budgetHours === 9)!;
			expect(flat.valuePerHour).toBe(0);
		});

		// The three properties the card's copy rests on. `plan(b)` books whole
		// steps, so `dayValue` is a staircase and its RAW difference is a spike
		// train: zero wherever a step failed to seat another block, then back up.
		// Measured on the raw definition, 0 of 60 seeded days fell monotonically
		// and 32 returned above zero after touching it. The majorant slope is what
		// makes "it never rises" and "the last positive step is the recommendation"
		// true statements (MATH.md §8.12, scripts/curve-shape.probe.ts).
		it('values an hour of window at the concave-majorant slope, which never rises', () => {
			const curve = suggestBudgetCurve(tasks, DEFAULT_ENERGY_PARAMS, undefined, {
				maxBudgetHours: 6,
			});

			// Every point, including the first: its predecessor is the do-nothing day,
			// so the shortest window swept carries a real marginal rather than a zero
			// standing in for a missing one.
			expect(curve.points[0].valuePerHour).toBeGreaterThan(0);

			for (let i = 0; i < curve.points.length; i++) {
				expect(curve.points[i].valuePerHour).toBeGreaterThanOrEqual(0);

				if (i > 0)
					expect(curve.points[i].valuePerHour).toBeLessThanOrEqual(
						curve.points[i - 1].valuePerHour + 1e-12,
					);
			}
		});

		it('redistributes the gain without inventing any: the slopes telescope to the level', () => {
			const curve = suggestBudgetCurve(tasks, DEFAULT_ENERGY_PARAMS, undefined, {
				maxBudgetHours: 6,
			});

			const summed = curve.points.reduce((sum, p) => sum + p.valuePerHour * DEFAULT_STEP_HOURS, 0);
			// From the do-nothing day, which is where the majorant starts — the same
			// score on the same horizon with an empty schedule, exactly as §8.12
			// writes it.
			const doNothing = evaluateSchedule([], tasks, 6, DEFAULT_ENERGY_PARAMS).objective;
			const climbed = curve.points[curve.points.length - 1].dayValue - doNothing;

			expect(summed).toBeCloseTo(climbed, 12);
		});

		it('is still above zero at the recommendation, and zero after it', () => {
			// One task satiates, so this day has a recommendation inside the range.
			const curve = suggestBudgetCurve([tasks[0]], DEFAULT_ENERGY_PARAMS);

			expect(curve.recommendedHours).not.toBeNull();

			for (const p of curve.points) {
				if (p.budgetHours <= curve.recommendedHours! - DEFAULT_STEP_HOURS / 2) continue;

				if (p.budgetHours < curve.recommendedHours! + DEFAULT_STEP_HOURS / 2)
					expect(p.valuePerHour).toBeGreaterThan(0);
				else expect(p.valuePerHour).toBe(0);
			}
		});

		it('has nothing to sweep with no tasks', () => {
			const curve = suggestBudgetCurve([], DEFAULT_ENERGY_PARAMS, undefined, {
				maxBudgetHours: 6,
			});

			expect(curve.points).toEqual([]);
			expect(curve.recommendedHours).toBeNull();
		});
	});

	describe('sampleTrajectory', () => {
		it('stays in [0,1] energy bounds, is time-ordered, and spans the window', () => {
			const tasks = [makeTask(1, 'A', 7, 5, 0.8, 0.2), makeTask(2, 'B', 4, 7, 0.2, 0.8)];
			const { blocks } = optimizeSchedule(tasks, 8);
			const traj = sampleTrajectory(blocks, tasks, 8);
			expect(traj[0].t).toBe(0);
			expect(traj[traj.length - 1].t).toBeCloseTo(8, 9);

			for (let i = 0; i < traj.length; i++) {
				expect(traj[i].cog).toBeGreaterThanOrEqual(0);
				expect(traj[i].cog).toBeLessThanOrEqual(1);
				expect(traj[i].phys).toBeGreaterThanOrEqual(0);
				expect(traj[i].phys).toBeLessThanOrEqual(1);
				expect(traj[i].rate).toBeGreaterThanOrEqual(0);

				if (i > 0) expect(traj[i].t).toBeGreaterThanOrEqual(traj[i - 1].t - 1e-12);
			}
		});
	});
});
