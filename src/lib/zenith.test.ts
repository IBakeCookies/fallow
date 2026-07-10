import { describe, expect, it } from 'vitest';
import {
	calculateTaskAllocations,
	mapEffort,
	mapEnjoyability,
	calculateFlowStateTime,
	productivityGain,
	DEFAULT_USER_CONSTANTS,
	DEFAULT_SWITCH_COST
} from './zenith';

describe('Zenith Gradient Algorithm', () => {
	describe('Parameter Mappings', () => {
		it('maps user effort (1-10) to true effort E (1-5)', () => {
			// E = (4/9)Eᵤ + 5/9
			expect(mapEffort(1)).toBeCloseTo(1, 1); // Min: 1 → 1
			expect(mapEffort(10)).toBeCloseTo(5, 1); // Max: 10 → 5
			expect(mapEffort(5.5)).toBeCloseTo(3, 1); // Mid: 5.5 → 3
		});

		it('maps user enjoyability (1-10) to true β (1-2)', () => {
			// β = (1/9)βᵤ + 8/9
			expect(mapEnjoyability(1)).toBeCloseTo(1, 1); // Min: 1 → 1
			expect(mapEnjoyability(10)).toBeCloseTo(2, 1); // Max: 10 → 2
		});
	});

	describe('Flow State Time', () => {
		it('calculates ϕ = c₁E + c₂β + c₃', () => {
			// With default constants: c1=0.56, c2=-0.24, c3=0.5
			const E = 3.67; // Effort = 7 user → 3.67 true
			const beta = 1.22; // Enjoyability = 3 user → 1.22 true
			// ϕ = 0.56*3.67 + (-0.24)*1.22 + 0.5 ≈ 2.06 - 0.29 + 0.5 = 2.27
			const phi = calculateFlowStateTime(E, beta, DEFAULT_USER_CONSTANTS);
			expect(phi).toBeCloseTo(2.26, 1);
		});
	});

	describe('Task Allocation', () => {
		it('distributes time budget optimally across tasks', () => {
			const allocations = calculateTaskAllocations(
				[
					{ title: 'Write report', difficulty: 4, enjoyment: 2 },
					{ title: 'Practice piano', difficulty: 2, enjoyment: 8 }
				],
				6,
				DEFAULT_USER_CONSTANTS,
				0 // No switch cost for core algorithm test
			);

			expect(allocations).toHaveLength(2);
			// Total should equal budget
			expect(allocations[0].allocatedHours + allocations[1].allocatedHours).toBeCloseTo(6, 1);
			// Both tasks should get non-zero time
			expect(allocations[0].allocatedHours).toBeGreaterThan(0);
			expect(allocations[1].allocatedHours).toBeGreaterThan(0);
		});

		it('gives equal tasks equal time (sanity check from article)', () => {
			// If all tasks have same E and β, time should be split equally
			const allocations = calculateTaskAllocations(
				[
					{ title: 'Task A', difficulty: 5, enjoyment: 5 },
					{ title: 'Task B', difficulty: 5, enjoyment: 5 },
					{ title: 'Task C', difficulty: 5, enjoyment: 5 }
				],
				6,
				DEFAULT_USER_CONSTANTS,
				0 // No switch cost for core algorithm test
			);

			expect(allocations).toHaveLength(3);
			expect(allocations[0].allocatedHours).toBeCloseTo(2, 0.5);
			expect(allocations[1].allocatedHours).toBeCloseTo(2, 0.5);
			expect(allocations[2].allocatedHours).toBeCloseTo(2, 0.5);
		});

		it('reproduces article example allocation pattern', () => {
			// From article: Essay(Eu=7,βu=3), Math(6,6), Video(4,8), Physics(8,5)
			// Article results: Essay=0.70h, Math=1.84h, Video=1.11h, Physics=2.31h
			// Essay (high E, low β) should get LEAST time
			// Physics (highest E, medium β) should get MOST time
			const allocations = calculateTaskAllocations(
				[
					{ title: 'Essay', difficulty: 7, enjoyment: 3 },
					{ title: 'Math homework', difficulty: 6, enjoyment: 6 },
					{ title: 'Edit video', difficulty: 4, enjoyment: 8 },
					{ title: 'Study physics', difficulty: 8, enjoyment: 5 }
				],
				6,
				DEFAULT_USER_CONSTANTS,
				0 // No switch cost for core algorithm test
			);

			expect(allocations).toHaveLength(4);
			const total = allocations.reduce((sum, a) => sum + a.allocatedHours, 0);
			expect(total).toBeCloseTo(6, 1);

			const essay = allocations.find((a) => a.title === 'Essay')!;
			const physics = allocations.find((a) => a.title === 'Study physics')!;

			// Essay should get less than physics (article: 0.70 vs 2.31)
			expect(essay.allocatedHours).toBeLessThan(physics.allocatedHours);
		});

		it('applies context-switching penalty correctly', () => {
			const switchCost = 0.25; // 15 minutes per switch
			const tasks = [
				{ title: 'Task A', difficulty: 5, enjoyment: 5 },
				{ title: 'Task B', difficulty: 5, enjoyment: 5 },
				{ title: 'Task C', difficulty: 5, enjoyment: 5 }
			];

			const allocationsNoSwitch = calculateTaskAllocations(tasks, 6, DEFAULT_USER_CONSTANTS, 0);
			const allocationsWithSwitch = calculateTaskAllocations(
				tasks,
				6,
				DEFAULT_USER_CONSTANTS,
				switchCost
			);

			const totalNoSwitch = allocationsNoSwitch.reduce((sum, a) => sum + a.allocatedHours, 0);
			const totalWithSwitch = allocationsWithSwitch.reduce((sum, a) => sum + a.allocatedHours, 0);

			// With 3 tasks, there are 2 switches, so 0.5h overhead
			expect(totalNoSwitch).toBeCloseTo(6, 1);
			expect(totalWithSwitch).toBeCloseTo(5.5, 1); // 6 - 2*0.25 = 5.5
		});
	});

	describe('Productivity Gain', () => {
		it('shows improvement over naive equal split', () => {
			const gain = productivityGain(
				[
					{ title: 'Hard boring', difficulty: 9, enjoyment: 2 },
					{ title: 'Easy fun', difficulty: 2, enjoyment: 9 }
				],
				4,
				DEFAULT_USER_CONSTANTS,
				0 // No switch cost for core algorithm test
			);

			expect(gain.optimized).toBeGreaterThan(gain.naive);
			expect(gain.gainPercent).toBeGreaterThan(0);
		});
	});

	describe('Bug Fixes', () => {
		it('distributes time across all tasks with small budget (regression test)', () => {
			// This test prevents the bug where only one task got all the time
			const allocations = calculateTaskAllocations(
				[
					{ title: 'network', difficulty: 3, enjoyment: 1 },
					{ title: 'Gym', difficulty: 8, enjoyment: 5 },
					{ title: 'Bike', difficulty: 4, enjoyment: 7 },
					{ title: 'reading', difficulty: 5, enjoyment: 5 },
					{ title: 'guitar', difficulty: 4, enjoyment: 9 },
					{ title: 'piano', difficulty: 7, enjoyment: 6 }
				],
				2, // 2 hour budget
				DEFAULT_USER_CONSTANTS,
				0 // No switch cost for core algorithm test
			);

			// All tasks should get some time
			const tasksWithTime = allocations.filter((a) => a.allocatedHours > 0.01);
			expect(tasksWithTime.length).toBeGreaterThanOrEqual(4); // At least 4 tasks should get time

			// Total should equal budget
			const total = allocations.reduce((sum, a) => sum + a.allocatedHours, 0);
			expect(total).toBeCloseTo(2, 1);

			// High enjoyment tasks should get reasonable allocation
			const guitar = allocations.find((a) => a.title === 'guitar');
			expect(guitar!.allocatedHours).toBeGreaterThan(0.1);
		});

		it('handles 1 hour budget correctly', () => {
			const allocations = calculateTaskAllocations(
				[
					{ title: 'network', difficulty: 3, enjoyment: 1 },
					{ title: 'Gym', difficulty: 8, enjoyment: 5 },
					{ title: 'Bike', difficulty: 4, enjoyment: 7 },
					{ title: 'reading', difficulty: 5, enjoyment: 5 },
					{ title: 'guitar', difficulty: 4, enjoyment: 9 },
					{ title: 'piano', difficulty: 7, enjoyment: 6 }
				],
				1, // 1 hour budget
				DEFAULT_USER_CONSTANTS,
				0 // No switch cost for core algorithm test
			);

			// Total should equal budget
			const total = allocations.reduce((sum, a) => sum + a.allocatedHours, 0);
			expect(total).toBeCloseTo(1, 1);

			// Multiple tasks should get time
			const tasksWithTime = allocations.filter((a) => a.allocatedHours > 0.05);
			expect(tasksWithTime.length).toBeGreaterThanOrEqual(3);
		});
	});
});
