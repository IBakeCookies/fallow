import { describe, expect, it } from 'vitest';
import {
	DEFAULT_ENERGY_PARAMS,
	evaluateSchedule,
	normalizeSchedule,
	optimizeSchedule,
	sampleTrajectory,
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

		it('objective decomposes into output + free-time bonus + terminal bonus', () => {
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
			expect(ev.objective).toBeCloseTo(ev.totalOutput + ev.freeTimeBonus + ev.terminalBonus, 12);
			expect(ev.totalOutput).toBeCloseTo(
				ev.blocks.reduce((sum, b) => sum + b.output, 0),
				12
			);
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

	describe('optimizeSchedule', () => {
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
