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
	RECOVERY_FIT_MIN,
	sampleTrajectory,
	simulateReservoirs,
	STOP_INVERSION_MARGIN,
	stopIndifferencePoint,
	type DrainObservation,
	type EnergyTaskInput,
	type RestObservation,
	type StopObservation
} from './zenith-energy';
import { calculateFlowStateTime, mapEffort, mapEnjoyability } from './zenith';

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

		it('fragmentation is costly: contiguous work far outproduces confetti slicing', () => {
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
			expect(off.objective).toBeCloseTo(
				off.totalOutput + off.freeTimeBonus + off.terminalBonus,
				12
			);
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
			// The witness is off the 45-min lattice, so this guards SEARCH
			// reliability at the fine step it was written for; quantization loss
			// has its own tests below.
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
			const result = optimizeSchedule(day, 8, DEFAULT_ENERGY_PARAMS, undefined, {
				stepHours: 0.25
			});
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
			const funded = new Set(result.blocks.filter((b) => b.taskId !== null).map((b) => b.taskId));
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
			expect(zero.evaluation.objective).toBeCloseTo(DEFAULT_ENERGY_PARAMS.terminalEnergyValue, 9);
		});
	});

	describe('45-min block granularity (MATH.md §8.8)', () => {
		const probeDay = [
			makeTask(1, 'boxing', 10, 10, 0.2, 1.0),
			makeTask(2, 'guitar', 6, 9, 0.4, 0.3),
			makeTask(3, 'reading', 4, 7, 0.5, 0.05)
		];
		const mixedDay = [
			makeTask(1, 'write spec', 8, 6, 0.9, 0.1),
			makeTask(2, 'gym', 4, 7, 0.1, 0.9),
			makeTask(3, 'email', 3, 3, 0.4, 0.1),
			makeTask(4, 'refactor', 7, 5, 0.8, 0.1)
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

		it('quantization keeps the funded-task structure and ≥97% of the fine-step objective', () => {
			// Probe 2026-07-18: observed ratios 0.9865 (probeDay) and 0.9979
			// (mixedDay); funded sets identical. The bound leaves slack for param
			// drift but catches a structural regression outright.
			for (const tasks of [probeDay, mixedDay]) {
				const coarse = optimizeSchedule(tasks, 8);
				const fine = optimizeSchedule(tasks, 8, DEFAULT_ENERGY_PARAMS, undefined, {
					stepHours: 0.25
				});
				expect(funded(coarse.blocks)).toEqual(funded(fine.blocks));
				expect(coarse.evaluation.objective).toBeGreaterThanOrEqual(
					0.97 * fine.evaluation.objective
				);
			}
		});

		it('honors a stepHours override (blocks land on that lattice instead)', () => {
			const { blocks } = optimizeSchedule(probeDay, 8, DEFAULT_ENERGY_PARAMS, undefined, {
				stepHours: 0.5
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

	describe('recovery-rate calibration (fitRecoveryRate, MATH.md §8.9)', () => {
		const m = DEFAULT_ENERGY_PARAMS.restRecoveryMultiplier;
		const restParams = { restRecoveryMultiplier: m };
		const prior = DEFAULT_ENERGY_PARAMS.recoveryRate;

		// Independent forward model: during pure rest the drained fraction
		// decays exponentially at the corrected recovery rate r·m.
		const pair = (rate: number, before: number, hours: number): RestObservation => ({
			drainedBefore: before,
			drainedAfter: before * Math.exp(-rate * m * hours),
			hours
		});
		// One logged rest = mind + body, two observations of the same break.
		const loggedRests = (rate: number, count: number): RestObservation[] =>
			Array.from({ length: count }, (_, i) => {
				const hours = [0.5, 0.75, 1, 0.5, 0.75, 0.5, 1, 0.75][i % 8];
				return [pair(rate, 0.6, hours), pair(rate, 0.45, hours)];
			}).flat();

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
				usedCount: 0
			});
			// Fresh going in (nothing to recover) or a zero-length break (no time
			// to recover in): the prediction is constant in r — no signal.
			const uninformative = fitRecoveryRate(
				[
					{ drainedBefore: 0, drainedAfter: 0, hours: 1 },
					{ drainedBefore: 0.5, drainedAfter: 0.5, hours: 0 }
				],
				prior,
				restParams
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
			const underUnitMultiplier = fitRecoveryRate(data, prior, { restRecoveryMultiplier: 1 });
			expect(underUnitMultiplier.rate).toBeGreaterThan(1.45);
			expect(underUnitMultiplier.rate).toBeLessThan(1.2 * m);
		});

		it('adversarial pairs (more drained after resting) pin to the lower bound with a wide std', () => {
			const fit = fitRecoveryRate(
				[
					{ drainedBefore: 0.3, drainedAfter: 0.6, hours: 0.5 },
					{ drainedBefore: 0.4, drainedAfter: 0.7, hours: 0.5 }
				],
				prior,
				restParams
			);
			expect(fit.fitted).toBe(true);
			expect(fit.rate).toBeGreaterThanOrEqual(RECOVERY_FIT_MIN);
			expect(fit.rate).toBeLessThan(prior);
			// The residuals are large, so the noise blend must report low confidence.
			expect(fit.rateStd!).toBeGreaterThan(0.3);
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
				drainedFraction: drainAt(TRUE_R, 0.9, hours)
			}));
			const lawParams = (recovery: number) => ({
				recoveryRate: recovery,
				restRecoveryMultiplier: m,
				microRecoveryFraction: DEFAULT_ENERGY_PARAMS.microRecoveryFraction
			});
			const biased = fitDrainRate(drainObs, DEFAULT_ENERGY_PARAMS.alphaCog, lawParams(prior));
			const rFit = fitRecoveryRate(loggedRests(TRUE_R, 5), prior, restParams);
			const conditioned = fitDrainRate(
				drainObs,
				DEFAULT_ENERGY_PARAMS.alphaCog,
				lawParams(rFit.rate)
			);
			expect(Math.abs(conditioned.alpha - TRUE_ALPHA)).toBeLessThan(
				Math.abs(biased.alpha - TRUE_ALPHA)
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
		const day = [
			makeTask(1, 'boxing', 10, 10, 0.2, 1.0),
			makeTask(2, 'guitar', 6, 9, 0.4, 0.3),
			makeTask(3, 'reading', 4, 7, 0.5, 0.05)
		];
		const prior = DEFAULT_ENERGY_PARAMS.freeTimeValue;

		// Synthetic user: work the plan the optimizer builds at the TRUE λ₀,
		// then log the per-task hours — what drain logs would record.
		const dayFromPlan = (trueLambda: number, windowHours: number): StopObservation => {
			const { blocks } = optimizeSchedule(day, windowHours, {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: trueLambda
			});
			const byTask = new Map<number, number>();
			for (const b of blocks) {
				if (b.taskId !== null) byTask.set(b.taskId, (byTask.get(b.taskId) ?? 0) + b.hours);
			}
			return {
				tasks: day,
				windowHours,
				workedHours: [...byTask].map(([taskId, hours]) => ({ taskId, hours }))
			};
		};

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
		});

		it('extraction is λ₀-free: the current freeTimeValue slider cannot bias it', () => {
			const obs = dayFromPlan(0.9, 10);
			const at0 = stopIndifferencePoint(obs, { ...DEFAULT_ENERGY_PARAMS, freeTimeValue: 0 });
			const at3 = stopIndifferencePoint(obs, { ...DEFAULT_ENERGY_PARAMS, freeTimeValue: 3 });
			expect(at0).not.toBeNull();
			expect(at0).toBe(at3);
		});

		it('stopping earlier reveals a higher indifference price (diminishing marginals)', () => {
			const early: StopObservation = {
				tasks: day,
				windowHours: 12,
				workedHours: [{ taskId: 1, hours: 2.25 }]
			};
			const late: StopObservation = {
				tasks: day,
				windowHours: 12,
				workedHours: [
					{ taskId: 1, hours: 3 },
					{ taskId: 2, hours: 3 },
					{ taskId: 3, hours: 1.5 }
				]
			};
			expect(stopIndifferencePoint(early, DEFAULT_ENERGY_PARAMS)!).toBeGreaterThan(
				stopIndifferencePoint(late, DEFAULT_ENERGY_PARAMS)!
			);
		});

		it('drops censored and uninformative days; all-dropped falls back', () => {
			// Worked to the window edge: stopping reveals only an inequality.
			const edge: StopObservation = {
				tasks: day,
				windowHours: 6,
				workedHours: [{ taskId: 2, hours: 6 }]
			};
			// Nothing worked, and sessions shorter than one 45-min step.
			const empty: StopObservation = { tasks: day, windowHours: 8, workedHours: [] };
			const sliver: StopObservation = {
				tasks: day,
				windowHours: 8,
				workedHours: [{ taskId: 2, hours: 0.5 }]
			};
			expect(stopIndifferencePoint(edge, DEFAULT_ENERGY_PARAMS)).toBeNull();
			expect(stopIndifferencePoint(empty, DEFAULT_ENERGY_PARAMS)).toBeNull();
			expect(stopIndifferencePoint(sliver, DEFAULT_ENERGY_PARAMS)).toBeNull();
			expect(fitStoppingValue([edge, empty, sliver], prior, DEFAULT_ENERGY_PARAMS)).toEqual({
				value: prior,
				fitted: false,
				usedCount: 0
			});
		});

		it('censors a strongly inverted day (interruption) but keeps a mild inversion at its midpoint', () => {
			// Strong inversion — a long grind on the weakest task while
			// boxing/guitar sat unstarted: the marginal of STARTING a strong task
			// exceeds what the last reading step was worth by far more than
			// STOP_INVERSION_MARGIN (probe: lo ≈ 0.91, hi ≈ 0.26, gap ≈ 0.65).
			// The day's own data contradicts a rational stop, so only the
			// one-sided λ₀ ≤ hi reading survives — censored like a
			// worked-to-the-edge day, NOT averaged into the fit: its midpoint sits
			// at the task curves' characteristic marginal regardless of the user's
			// true λ₀ (MATH.md §8.10, probes 2026-07-19).
			const grind: StopObservation = {
				tasks: day,
				windowHours: 12,
				workedHours: [{ taskId: 3, hours: 4.5 }]
			};
			expect(stopIndifferencePoint(grind, DEFAULT_ENERGY_PARAMS)).toBeNull();
			expect(fitStoppingValue([grind], prior, DEFAULT_ENERGY_PARAMS).fitted).toBe(false);

			// A 1-step interrupted sliver is the practical contamination case
			// (probe: gap ≈ 0.34) — also censored.
			const sliver: StopObservation = {
				tasks: day,
				windowHours: 12,
				workedHours: [{ taskId: 3, hours: DEFAULT_STEP_HOURS }]
			};
			expect(stopIndifferencePoint(sliver, DEFAULT_ENERGY_PARAMS)).toBeNull();

			// Mild inversion — 2.25h of reading only (probe: gap ≈ 0.07, within
			// the margin = the instrument's own slack): kept at the bracket
			// midpoint and used by the fit.
			const mild: StopObservation = {
				tasks: day,
				windowHours: 12,
				workedHours: [{ taskId: 3, hours: 2.25 }]
			};
			const step = DEFAULT_STEP_HOURS;
			const workValue = (blocks: { taskId: number | null; hours: number }[]) => {
				const ev = evaluateSchedule(blocks, day, 12, DEFAULT_ENERGY_PARAMS);
				return ev.satiatedOutput + ev.terminalBonus;
			};
			const base = workValue([{ taskId: 3, hours: 2.25 }]);
			const lo = Math.max(
				(workValue([{ taskId: 3, hours: 2.25 + step }]) - base) / step,
				(workValue([
					{ taskId: 3, hours: 2.25 },
					{ taskId: 1, hours: step }
				]) -
					base) /
					step,
				(workValue([
					{ taskId: 3, hours: 2.25 },
					{ taskId: 2, hours: step }
				]) -
					base) /
					step
			);
			const hi = (base - workValue([{ taskId: 3, hours: 2.25 - step }])) / step;
			expect(lo).toBeGreaterThan(hi); // inverted...
			expect(lo).toBeLessThanOrEqual(hi + STOP_INVERSION_MARGIN); // ...but within the margin
			expect(stopIndifferencePoint(mild, DEFAULT_ENERGY_PARAMS)).toBeCloseTo(
				(Math.max(0, lo) + hi) / 2,
				10
			);
			expect(fitStoppingValue([mild], prior, DEFAULT_ENERGY_PARAMS).usedCount).toBe(1);
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
				Array.from({ length: 8 }, () => obs),
				prior,
				DEFAULT_ENERGY_PARAMS
			);
			expect(eight.valueStd!).toBeLessThan(two.valueStd!);
		});

		it('W*(λ₀) is monotone with a graded response — §8.3’s bang-bang is gone (satiety fixed it)', () => {
			const worked = [0.4, 0.8, 1.2, 1.5].map((l) => {
				const { blocks } = optimizeSchedule(day, 12, {
					...DEFAULT_ENERGY_PARAMS,
					freeTimeValue: l
				});
				return blocks.reduce((s, b) => s + (b.taskId !== null ? b.hours : 0), 0);
			});
			for (let i = 1; i < worked.length; i++) {
				expect(worked[i]).toBeLessThanOrEqual(worked[i - 1] + 1e-9);
			}
			expect(new Set(worked.map((w) => w.toFixed(2))).size).toBeGreaterThanOrEqual(3);
		});

		it('is deterministic', () => {
			const days = [dayFromPlan(0.9, 8), dayFromPlan(0.9, 12)];
			const a = fitStoppingValue(days, prior, DEFAULT_ENERGY_PARAMS);
			const b = fitStoppingValue(days, prior, DEFAULT_ENERGY_PARAMS);
			expect(a).toEqual(b);
		});
	});

	describe('numeric verification (closed forms vs independent integration)', () => {
		const p = DEFAULT_ENERGY_PARAMS;

		it('reservoir closed form matches Euler integration of dC/dτ = −αwC + r·m·(1−(1−b)w)(1−C)', () => {
			const task = makeTask(1, 'x', 7, 4, 0.8, 0.3);
			const hours = 2.5;
			const ev = evaluateSchedule([{ taskId: 1, hours }], [task], 8, p);
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
				{ taskId: 1, hours: 1.5 },
				{ taskId: null, hours: 0.5 },
				{ taskId: 2, hours: 2 }
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
			const constants = { c1: 0.1, c2: -0.05, c3: 0.05 }; // ϕ hits the 0.1h floor
			const hours = 8;
			const ev = evaluateSchedule([{ taskId: 1, hours }], [fast], 12, p, constants);

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
				return { rho, eq: (rec * gate) / rho };
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
