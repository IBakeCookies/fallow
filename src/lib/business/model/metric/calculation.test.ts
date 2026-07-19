import { describe, expect, it } from 'vitest';
import {
	calculateSuggestedTasks,
	calculateFrictionIndex,
	calculateBurnoutRisk,
	calculateScheduleIntegrity,
	type SuggestedTask,
	type Task
} from './calculation';

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

// Hand-built SuggestedTask for metrics that only read a few fields — lets a
// test pin hours/T* exactly instead of routing through the allocator.
function makeSuggested(
	overrides: Partial<SuggestedTask> & { id: number; title: string }
): SuggestedTask {
	return {
		...makeTask(overrides),
		suggestedHours: 1,
		priorityScore: 5,
		flowStateTime: 1,
		trueEffort: 3,
		trueEnjoyability: 1.5,
		peakProductivity: 2,
		avgProductivity: 1,
		optimalHours: 2,
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

describe('calculateFrictionIndex (2026-07-18 fix: raw scales)', () => {
	it('a maximum-difficulty task at maximum enjoyment has ZERO friction', () => {
		// Old mapped-gap behavior read this task as 75% friction (E=5, β=2 →
		// gap 3 of max 4) — difficulty you love is not friction.
		const lovedHard = makeSuggested({
			id: 1,
			title: 'loved hard',
			mentalDifficulty: 10,
			physicalDifficulty: 0,
			enjoyment: 10,
			suggestedHours: 4
		});
		expect(calculateFrictionIndex([lovedHard])).toBe(0);
	});

	it('reads 100% only for max-difficulty, min-enjoyment work', () => {
		const grind = makeSuggested({
			id: 1,
			title: 'grind',
			mentalDifficulty: 10,
			physicalDifficulty: 0,
			enjoyment: 1,
			suggestedHours: 3
		});
		expect(calculateFrictionIndex([grind])).toBe(100);
	});

	it('time-weights the difficulty−enjoyment gap over allocated hours', () => {
		// gap 4 (difficulty 7, enjoyment 3) on all allocated time → 4/9 ≈ 44%
		const mixed = makeSuggested({
			id: 1,
			title: 'mixed',
			mentalDifficulty: 7,
			physicalDifficulty: 0,
			enjoyment: 3,
			suggestedHours: 2
		});
		expect(calculateFrictionIndex([mixed])).toBe(44);
		// Adding an equal-hours zero-gap task halves the index
		const easy = makeSuggested({
			id: 2,
			title: 'easy',
			mentalDifficulty: 3,
			physicalDifficulty: 0,
			enjoyment: 8,
			suggestedHours: 2
		});
		expect(calculateFrictionIndex([mixed, easy])).toBe(22);
	});
});

describe('calculateBurnoutRisk (2026-07-18 fix: overhang over funded tasks only)', () => {
	it('a dropped task (0 hours) does not change the risk', () => {
		// Before the fix a dropped task's T* still counted toward the "optimal
		// workload", absorbing overhang hours the user will actually spend on
		// the funded tasks' diminishing-returns zones (probe: an injured
		// user's dropped gym task suppressed overhang 6.2h → 1.8h).
		const funded = makeSuggested({
			id: 1,
			title: 'work',
			mentalDifficulty: 6,
			physicalDifficulty: 0,
			enjoyment: 4,
			suggestedHours: 3,
			optimalHours: 3.5,
			trueEffort: 3.2,
			trueEnjoyability: 1.3
		});
		const dropped = makeSuggested({
			id: 2,
			title: 'gym (pool zeroed)',
			mentalDifficulty: 1,
			physicalDifficulty: 8,
			enjoyment: 7,
			suggestedHours: 0,
			optimalHours: 4.4,
			trueEffort: 4,
			trueEnjoyability: 1.7
		});
		const budget = 10;
		expect(calculateBurnoutRisk([funded, dropped], budget, 0.25)).toBe(
			calculateBurnoutRisk([funded], budget, 0.25)
		);
	});

	it('overhang beyond the funded workload raises the risk', () => {
		// Mild strain so neither side saturates at 100
		const funded = makeSuggested({
			id: 1,
			title: 'work',
			mentalDifficulty: 6,
			physicalDifficulty: 0,
			enjoyment: 4,
			suggestedHours: 3,
			optimalHours: 3.5,
			trueEffort: 2,
			trueEnjoyability: 1.6
		});
		// Same plan, bigger declared budget → more diminishing-returns hours
		const low = calculateBurnoutRisk([funded], 4, 0.25);
		const high = calculateBurnoutRisk([funded], 4.5, 0.25);
		expect(low).toBeLessThan(100);
		expect(high).toBeLessThan(100);
		expect(high).toBeGreaterThan(low);
	});
});

describe('calculateScheduleIntegrity (2026-07-18 redefinition: overhead share)', () => {
	it('a single funded session is 100% integral', () => {
		const solo = makeSuggested({ id: 1, title: 'solo', suggestedHours: 4 });
		expect(calculateScheduleIntegrity([solo], 6, 0.25)).toBe(100);
	});

	it('more funded tasks per worked hour means more switching overhead', () => {
		const t = (id: number, hours: number) =>
			makeSuggested({ id, title: `t${id}`, suggestedHours: hours });
		// 4h over two tasks: 4/(4+0.25) ≈ 94%
		expect(calculateScheduleIntegrity([t(1, 2), t(2, 2)], 6, 0.25)).toBe(94);
		// The same 4h over eight tasks: 4/(4+1.75) ≈ 70%
		const eight = Array.from({ length: 8 }, (_, i) => t(i + 1, 0.5));
		expect(calculateScheduleIntegrity(eight, 6, 0.25)).toBe(70);
	});

	it('dropped tasks are consolidation, not fragmentation', () => {
		// Old rule: a 0-hour task counted as "fragmented" and pushed the metric
		// down, although dropping is exactly how the allocator UN-fragments a day.
		const funded = makeSuggested({ id: 1, title: 'funded', suggestedHours: 4 });
		const dropped = makeSuggested({ id: 2, title: 'dropped', suggestedHours: 0 });
		expect(calculateScheduleIntegrity([funded, dropped], 6, 0.25)).toBe(100);
	});

	it('keeps its empty-state guards', () => {
		expect(calculateScheduleIntegrity([], 6, 0.25)).toBe(100);
		const t = makeSuggested({ id: 1, title: 't', suggestedHours: 0 });
		expect(calculateScheduleIntegrity([t], 0, 0.25)).toBe(0); // no budget set
		expect(calculateScheduleIntegrity([t], 6, 0.25)).toBe(0); // budget set, nothing funded
	});
});
