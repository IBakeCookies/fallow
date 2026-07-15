import { describe, expect, it } from 'vitest';
import {
	ALPHA_FIT_MAX,
	ALPHA_FIT_MIN,
	DEFAULT_ENERGY_PARAMS,
	evaluateSchedule,
	fitDrainRate,
	normalizeSchedule,
	optimizeSchedule,
	sampleTrajectory,
	type DrainObservation,
	type EnergyTaskInput
} from './zenith-energy';

function makeTask(
	id: number,
	title: string,
	difficulty: number,
	enjoyment: number,
	cognitiveDemand: number,
	physicalDemand: number
): EnergyTaskInput {
	return { id, title, difficulty, enjoyment, cognitiveDemand, physicalDemand };
}

describe('Zenith Energy Model', () => {
	describe('normalizeSchedule', () => {
		it('merges adjacent same-task blocks into one session', () => {
			const merged = normalizeSchedule(
				[
					{ taskId: 1, hours: 1 },
					{ taskId: 1, hours: 1 }
				],
				8
			);
			expect(merged).toEqual([{ taskId: 1, hours: 2 }]);
		});

		it('clips to the window, drops empty blocks and trailing rest', () => {
			const blocks = normalizeSchedule(
				[
					{ taskId: 1, hours: 3 },
					{ taskId: null, hours: 0 },
					{ taskId: 2, hours: 10 },
					{ taskId: null, hours: 2 }
				],
				4
			);
			expect(blocks).toEqual([
				{ taskId: 1, hours: 3 },
				{ taskId: 2, hours: 1 }
			]);
		});
	});

	describe('evaluateSchedule', () => {
		const tasks = [makeTask(1, 'A', 7, 4, 0.8, 0.1), makeTask(2, 'B', 3, 8, 0.2, 0.7)];

		it('objective decomposes into satiated output + free-time bonus + terminal bonus', () => {
			const ev = evaluateSchedule(
				[
					{ taskId: 1, hours: 1.5 },
					{ taskId: null, hours: 0.5 },
					{ taskId: 2, hours: 2 }
				],
				tasks,
				8
			);
			expect(ev.workHours).toBeCloseTo(3.5, 10);
			expect(ev.leisureHours).toBeCloseTo(4.5, 10);
			expect(ev.objective).toBeCloseTo(ev.satiatedOutput + ev.freeTimeBonus + ev.terminalBonus, 12);
			expect(ev.totalOutput).toBeCloseTo(
				ev.blocks.reduce((sum, b) => sum + b.output, 0),
				12
			);
			// V(O) ≤ O with equality only at O = 0
			expect(ev.satiatedOutput).toBeLessThan(ev.totalOutput);
			expect(ev.satiatedOutput).toBeGreaterThan(0);
		});

		it('energy reservoirs drain while working and recover while resting', () => {
			const ev = evaluateSchedule(
				[
					{ taskId: 1, hours: 2 },
					{ taskId: null, hours: 1 },
					{ taskId: 1, hours: 0.5 }
				],
				tasks,
				8
			);
			const [work, rest] = ev.blocks;
			expect(work.cogAfter).toBeLessThan(DEFAULT_ENERGY_PARAMS.initialCog);
			expect(rest.cogAfter).toBeGreaterThan(work.cogAfter);
		});

		it('warm-up resets on switch: contiguous work far outproduces confetti slicing', () => {
			const deep = [makeTask(1, 'deep', 6, 6, 0.7, 0.1)];
			const contiguous = evaluateSchedule([{ taskId: 1, hours: 2 }], deep, 8);
			const confetti: { taskId: number | null; hours: number }[] = [];
			for (let i = 0; i < 8; i++) {
				confetti.push({ taskId: 1, hours: 0.25 }, { taskId: null, hours: 0.25 });
			}
			const sliced = evaluateSchedule(confetti, deep, 8);
			expect(contiguous.totalOutput).toBeGreaterThan(1.5 * sliced.totalOutput);
		});

		it('a merged same-task pair scores exactly like one block (one session)', () => {
			const deep = [makeTask(1, 'deep', 6, 6, 0.7, 0.1)];
			const single = evaluateSchedule([{ taskId: 1, hours: 2 }], deep, 8);
			const pair = evaluateSchedule(
				[
					{ taskId: 1, hours: 1 },
					{ taskId: 1, hours: 1 }
				],
				deep,
				8
			);
			expect(pair.totalOutput).toBeCloseTo(single.totalOutput, 12);
		});

		it('rest-recovery multiplier speeds recovery of an idle reservoir (Xia & Frey Law)', () => {
			const deep = [makeTask(1, 'deep', 8, 5, 0.9, 0.1)];
			// interior rest bracketed by a marker so it is not trailing-dropped
			const sched = [
				{ taskId: 1, hours: 3 },
				{ taskId: null, hours: 1 },
				{ taskId: 1, hours: 0.01 }
			];
			const base = evaluateSchedule(sched, deep, 12, {
				...DEFAULT_ENERGY_PARAMS,
				restRecoveryMultiplier: 1
			});
			const boosted = evaluateSchedule(sched, deep, 12, {
				...DEFAULT_ENERGY_PARAMS,
				restRecoveryMultiplier: 2
			});
			expect(boosted.blocks[1].cogAfter).toBeGreaterThan(base.blocks[1].cogAfter);
		});

		it('warm-up carries over across a gap: resuming beats a hard reset (Monk/Trafton)', () => {
			const tasks = [makeTask(1, 'A', 6, 6, 0.7, 0.1), makeTask(2, 'B', 5, 5, 0.3, 0.3)];
			const sched = [
				{ taskId: 1, hours: 1.5 },
				{ taskId: 2, hours: 0.25 },
				{ taskId: 1, hours: 1.5 }
			];
			const reset = evaluateSchedule(sched, tasks, 8, {
				...DEFAULT_ENERGY_PARAMS,
				resumptionTimeConstant: 0
			});
			const carry = evaluateSchedule(sched, tasks, 8, {
				...DEFAULT_ENERGY_PARAMS,
				resumptionTimeConstant: 0.5
			});
			expect(carry.blocks[2].output).toBeGreaterThan(reset.blocks[2].output);
		});

		it('warm-up carryover decays with gap length: short break keeps more than long', () => {
			const deep = [makeTask(1, 'A', 6, 6, 0.7, 0.1)];
			const shortGap = evaluateSchedule(
				[
					{ taskId: 1, hours: 1.5 },
					{ taskId: null, hours: 0.25 },
					{ taskId: 1, hours: 1.5 }
				],
				deep,
				8
			);
			const longGap = evaluateSchedule(
				[
					{ taskId: 1, hours: 1.5 },
					{ taskId: null, hours: 2 },
					{ taskId: 1, hours: 1.5 }
				],
				deep,
				8
			);
			expect(shortGap.blocks[2].output).toBeGreaterThan(longGap.blocks[2].output);
		});

		it('an empty schedule earns only leisure + terminal value', () => {
			const ev = evaluateSchedule([], tasks, 8);
			expect(ev.totalOutput).toBe(0);
			expect(ev.leisureHours).toBe(8);
			expect(ev.endCog).toBeCloseTo(1, 6);
			expect(ev.endPhys).toBeCloseTo(1, 6);
		});
	});

	describe('satiety (per-task diminishing daily returns)', () => {
		// The winner-take-all probe scenario (2026-07-11/14): one dominant
		// high-amplitude task plus two weaker ones.
		const day = [
			makeTask(1, 'boxing', 10, 10, 0.2, 1.0),
			makeTask(2, 'guitar', 6, 9, 0.4, 0.3),
			makeTask(3, 'reading', 4, 7, 0.5, 0.05)
		];
		const sched = [
			{ taskId: 2, hours: 2 },
			{ taskId: null, hours: 1 },
			{ taskId: 2, hours: 2 }
		];

		it('satietyScale ≤ 0 recovers the pure total-output objective exactly', () => {
			const off = evaluateSchedule(sched, day, 8, {
				...DEFAULT_ENERGY_PARAMS,
				satietyScale: 0
			});
			expect(off.satiatedOutput).toBeCloseTo(off.totalOutput, 12);
			expect(off.objective).toBeCloseTo(off.totalOutput + off.freeTimeBonus + off.terminalBonus, 12);
		});

		it('satiety does not touch the dynamics: raw block outputs are identical on/off', () => {
			const on = evaluateSchedule(sched, day, 8);
			const off = evaluateSchedule(sched, day, 8, { ...DEFAULT_ENERGY_PARAMS, satietyScale: 0 });
			on.blocks.forEach((b, i) => expect(b.output).toBeCloseTo(off.blocks[i].output, 12));
			expect(on.totalOutput).toBeCloseTo(off.totalOutput, 12);
		});

		it('discounts later output on the same task more than earlier output (concavity)', () => {
			const first = evaluateSchedule([{ taskId: 2, hours: 2 }], day, 8);
			const both = evaluateSchedule([{ taskId: 2, hours: 4 }], day, 8);
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
			const without = optimizeSchedule(day, 8, { ...DEFAULT_ENERGY_PARAMS, satietyScale: 0 });
			expect(fundedTasks(withSatiety.blocks).size).toBe(3);
			expect(fundedTasks(without.blocks).size).toBeLessThan(3);
		});
	});

	describe('micro-recovery gate (w = 1 reservoir floor)', () => {
		const day = [
			makeTask(1, 'boxing', 10, 10, 0.2, 1.0),
			makeTask(2, 'guitar', 6, 9, 0.4, 0.3),
			makeTask(3, 'reading', 4, 7, 0.5, 0.05)
		];

		it('a full-demand task drains toward a positive floor, not zero', () => {
			// eq = b·r′/(α + b·r′) ≈ 0.149 with the defaults; the zero-floor law
			// would be at 0.091 after 8 hours.
			const ev = evaluateSchedule([{ taskId: 1, hours: 8 }], day, 8);
			expect(ev.blocks[0].physAfter).toBeGreaterThan(0.15);
		});

		it('microRecoveryFraction 0 recovers the pure (1−w) gate: drains toward zero', () => {
			const ev = evaluateSchedule([{ taskId: 1, hours: 8 }], day, 8, {
				...DEFAULT_ENERGY_PARAMS,
				microRecoveryFraction: 0
			});
			expect(ev.blocks[0].physAfter).toBeLessThan(0.1);
		});

		it('does not touch rest recovery (the gate is 1 at zero demand regardless of b)', () => {
			const half = { ...DEFAULT_ENERGY_PARAMS, initialCog: 0.5, initialPhys: 0.5 };
			const on = evaluateSchedule([], day, 8, half);
			const off = evaluateSchedule([], day, 8, { ...half, microRecoveryFraction: 0 });
			expect(on.endCog).toBeCloseTo(off.endCog, 12);
			expect(on.endPhys).toBeCloseTo(off.endPhys, 12);
		});
	});

	describe('optimizeSchedule', () => {
		it('beats the hand-built plan that exposed a local-search failure (probe 2026-07-14)', () => {
			// The pre-fix search dropped reading entirely on this day and scored
			// below this plan; the compound moves + drop-one seeds must dominate it.
			const day = [
				makeTask(1, 'boxing', 10, 10, 0.2, 1.0),
				makeTask(2, 'guitar', 6, 9, 0.4, 0.3),
				makeTask(3, 'reading', 4, 7, 0.5, 0.05)
			];
			const handBuilt = evaluateSchedule(
				[
					{ taskId: 1, hours: 3.5 },
					{ taskId: 3, hours: 1.5 },
					{ taskId: 2, hours: 3 }
				],
				day,
				8
			);
			const result = optimizeSchedule(day, 8);
			expect(result.evaluation.objective).toBeGreaterThanOrEqual(handBuilt.objective - 1e-9);
		});

		it('with zero leisure/terminal value it never leaves the window end idle', () => {
			const tasks = [makeTask(1, 'grind', 6, 5, 0.8, 0.2)];
			const result = optimizeSchedule(tasks, 12, {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: 0,
				terminalEnergyValue: 0
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
				terminalEnergyValue: 0
			});
			// With efficient recovery and warm-up carryover, sustained work is
			// attractive, so the default values trim work only at the margin — but a
			// stronger leisure price stops it outright (the mechanism, not a fixed gap).
			const withValues = optimizeSchedule(tasks, 12);
			expect(withValues.evaluation.workHours).toBeLessThan(noValues.evaluation.workHours);
			const highLeisure = optimizeSchedule(tasks, 12, {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: 2
			});
			expect(highLeisure.evaluation.workHours).toBe(0);
		});

		it('concentrates a scarce hour on ONE of two identical tasks (no spreading)', () => {
			const twins = [makeTask(1, 'A', 5, 5, 0.5, 0.1), makeTask(2, 'B', 5, 5, 0.5, 0.1)];
			const result = optimizeSchedule(twins, 1, {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: 0.1
			});
			const funded = new Set(
				result.blocks.filter((b) => b.taskId !== null).map((b) => b.taskId)
			);
			expect(funded.size).toBe(1);
		});

		it('never returns a schedule worse than doing nothing, and is deterministic', () => {
			const tasks = [
				makeTask(1, 'write spec', 8, 6, 0.9, 0.1),
				makeTask(2, 'gym', 4, 7, 0.1, 0.9),
				makeTask(3, 'email', 3, 3, 0.4, 0.1),
				makeTask(4, 'refactor', 7, 5, 0.8, 0.1)
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
			expect(zero.evaluation.objective).toBeCloseTo(
				DEFAULT_ENERGY_PARAMS.terminalEnergyValue,
				9
			);
		});
	});

	describe('drain-rate calibration (fitDrainRate)', () => {
		const lawParams = {
			recoveryRate: DEFAULT_ENERGY_PARAMS.recoveryRate,
			restRecoveryMultiplier: DEFAULT_ENERGY_PARAMS.restRecoveryMultiplier,
			microRecoveryFraction: DEFAULT_ENERGY_PARAMS.microRecoveryFraction
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
			[0.7, 2.5]
		];
		const cleanObs = (alphaStar: number): DrainObservation[] =>
			grid.map(([w, H]) => ({ demand: w, hours: H, drainedFraction: drained(w, H, alphaStar) }));

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
				usedCount: 0
			});
			// demand 0: the rated reservoir was never touched by this session
			const idle = fitDrainRate([{ demand: 0, hours: 2, drainedFraction: 0.9 }], 0.35, lawParams);
			expect(idle.fitted).toBe(false);
			expect(idle.alpha).toBe(0.35);
		});

		it('demand-0 observations carry no signal even when mixed with real ones', () => {
			const real: DrainObservation = { demand: 1, hours: 2, drainedFraction: drained(1, 2, 0.35) };
			const alone = fitDrainRate([real], 0.35, lawParams);
			const mixed = fitDrainRate(
				[{ demand: 0, hours: 2, drainedFraction: 1 }, real],
				0.35,
				lawParams
			);
			expect(mixed.alpha).toBeCloseTo(alone.alpha, 6);
			expect(mixed.usedCount).toBe(1);
		});

		it('a single rating moves α partway toward its implication; more logs move further', () => {
			// 8/10 drained after 2h at full demand — the defaults predict ≈ 4.8/10,
			// and the rating alone implies α ≈ 0.89.
			const one = fitDrainRate([{ demand: 1, hours: 2, drainedFraction: 0.8 }], 0.35, lawParams);
			expect(one.alpha).toBeGreaterThan(0.5); // moved substantially…
			expect(one.alpha).toBeLessThan(0.75); // …but the prior still holds part back
			const five = fitDrainRate(
				Array.from({ length: 5 }, () => ({ demand: 1, hours: 2, drainedFraction: 0.8 })),
				0.35,
				lawParams
			);
			expect(five.alpha).toBeGreaterThan(one.alpha);
		});

		it('is monotone in the reported drain and stays inside the fit bounds', () => {
			let prev = -Infinity;
			for (let rating = 0; rating <= 10; rating++) {
				const fit = fitDrainRate(
					[{ demand: 1, hours: 2, drainedFraction: rating / 10 }],
					0.35,
					lawParams
				);
				expect(fit.alpha).toBeGreaterThanOrEqual(prev - 1e-9);
				expect(fit.alpha).toBeGreaterThanOrEqual(ALPHA_FIT_MIN);
				expect(fit.alpha).toBeLessThanOrEqual(ALPHA_FIT_MAX);
				prev = fit.alpha;
			}
			// Absurd data pins to a bound instead of breaking anything
			const absurd = fitDrainRate(
				Array.from({ length: 6 }, () => ({ demand: 1, hours: 0.25, drainedFraction: 1 })),
				0.35,
				lawParams
			);
			expect(absurd.alpha).toBeCloseTo(ALPHA_FIT_MAX, 6);
		});

		it('posterior std shrinks with data and grows with inconsistency', () => {
			const consistent = Array.from({ length: 8 }, () => ({
				demand: 1,
				hours: 2,
				drainedFraction: 0.5
			}));
			const noisy = [0.2, 0.8, 0.3, 0.7, 0.4, 0.9, 0.1, 0.6].map((d) => ({
				demand: 1,
				hours: 2,
				drainedFraction: d
			}));
			const few = fitDrainRate(consistent.slice(0, 2), 0.35, lawParams);
			const many = fitDrainRate(consistent, 0.35, lawParams);
			const scattered = fitDrainRate(noisy, 0.35, lawParams);
			expect(many.alphaStd!).toBeLessThan(few.alphaStd!);
			expect(scattered.alphaStd!).toBeGreaterThan(many.alphaStd!);
		});

		it('is deterministic', () => {
			const obs = cleanObs(0.9);
			const a = fitDrainRate(obs, 0.35, lawParams);
			const b = fitDrainRate(obs, 0.35, lawParams);
			expect(a).toEqual(b);
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
