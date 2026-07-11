import { describe, expect, it } from 'vitest';
import { calculateSuggestedTasks, type Task } from './calculations';

function makeTask(overrides: Partial<Task> & { id: number; title: string }): Task {
	return {
		physicalDifficulty: 5,
		mentalDifficulty: 5,
		enjoyment: 5,
		createdAt: '2026-07-11',
		completed: false,
		...overrides
	};
}

describe('calculateSuggestedTasks', () => {
	it('priorityScore is intrinsic: independent of the allocation outcome', () => {
		// Two tasks with identical effective difficulty and enjoyment (same E, β),
		// but one is purely cognitive and gets ZERO hours because the cognitive
		// pool is empty. Its priority must still equal its twin's — priority
		// measures what a task is worth, not what this plan could give it.
		const mental = makeTask({ id: 1, title: 'mental', mentalDifficulty: 8, physicalDifficulty: 0 });
		const physical = makeTask({
			id: 2,
			title: 'physical',
			mentalDifficulty: 0,
			physicalDifficulty: 8
		});

		const suggested = calculateSuggestedTasks([mental, physical], 4, 0, {
			cognitiveHours: 0,
			physicalHours: 6
		});

		const mentalOut = suggested.find((t) => t.id === 1)!;
		const physicalOut = suggested.find((t) => t.id === 2)!;

		expect(mentalOut.suggestedHours).toBe(0);
		expect(physicalOut.suggestedHours).toBeGreaterThan(0);
		expect(mentalOut.priorityScore).toBe(physicalOut.priorityScore);
		expect(mentalOut.priorityScore).toBeGreaterThan(0);
	});

	it('honors custom user constants', () => {
		const task = makeTask({ id: 1, title: 'a', mentalDifficulty: 7, physicalDifficulty: 2 });
		const slowToFlow = { c1: 1.2, c2: -0.1, c3: 1.0 };
		const fastToFlow = { c1: 0.2, c2: -0.1, c3: 0.3 };

		const pools = { cognitiveHours: 10, physicalHours: 10 };
		const slow = calculateSuggestedTasks([task], 12, 0, pools, slowToFlow)[0];
		const fast = calculateSuggestedTasks([task], 12, 0, pools, fastToFlow)[0];

		// Longer time-to-flow → later optimal stopping → more suggested hours
		expect(slow.flowStateTime).toBeGreaterThan(fast.flowStateTime);
		expect(slow.suggestedHours).toBeGreaterThan(fast.suggestedHours);
	});
});
