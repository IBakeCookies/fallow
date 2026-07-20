import { describe, expect, it } from 'vitest';
import {
	calculateSuggestedTasks,
	calculateFrictionIndex,
	calculateBurnoutRisk,
	calculateScheduleIntegrity,
	type SuggestedTask,
	type Task
} from './calculation';
import { DEFAULT_ENERGY_PARAMS } from '../zenith-energy';

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

describe('calculateBurnoutRisk (2026-07-20 v2: energy-model reservoir simulation, MATH.md §11.6)', () => {
	const work = (overrides: Partial<SuggestedTask> = {}) =>
		makeSuggested({
			id: 1,
			title: 'work',
			mentalDifficulty: 6,
			physicalDifficulty: 0,
			enjoyment: 4,
			suggestedHours: 3,
			...overrides
		});

	it('a dropped task (0 hours) does not change the risk', () => {
		// §11.3 property, preserved by construction in v2: a dropped task
		// contributes no schedule block, and the overhang it used to absorb
		// stretches the funded blocks instead.
		const dropped = makeSuggested({
			id: 2,
			title: 'gym (pool zeroed)',
			mentalDifficulty: 1,
			physicalDifficulty: 8,
			enjoyment: 7,
			suggestedHours: 0
		});
		expect(calculateBurnoutRisk([work(), dropped], 10, 0.25)).toBe(
			calculateBurnoutRisk([work()], 10, 0.25)
		);
	});

	it('budget beyond the funded plan (intended overwork) raises the risk', () => {
		// availableHours = hours the user INTENDS to work (§11.3 reading):
		// the same plan under a bigger declared budget simulates more drain.
		const low = calculateBurnoutRisk([work()], 3, 0.25);
		const high = calculateBurnoutRisk([work()], 6, 0.25);
		expect(high).toBeGreaterThan(low);
	});

	it('risk is monotone in reservoir demand and discriminates across a full day', () => {
		// The retired heuristic clamped at 100% after ~1.4h of hard work;
		// the reservoir law keeps resolution over the whole range.
		const risks = [1, 2, 4, 8].map((h) =>
			calculateBurnoutRisk([work({ mentalDifficulty: 9, suggestedHours: h })], h, 0.25)
		);
		expect([...risks]).toEqual([...risks].sort((a, b) => a - b));
		expect(new Set(risks).size).toBe(risks.length);
		expect(risks[risks.length - 1]).toBeLessThan(100); // micro-recovery floor: 100% unreachable

		const mild = calculateBurnoutRisk([work({ mentalDifficulty: 3, suggestedHours: 4 })], 4, 0.25);
		const hard = calculateBurnoutRisk([work({ mentalDifficulty: 9, suggestedHours: 4 })], 4, 0.25);
		expect(hard).toBeGreaterThan(mild);
	});

	it('enjoyment does not enter: drain is f(demand, duration) in the energy model', () => {
		// Deliberate v2 semantic change (the §11.4 boundary applied here):
		// loved-hard and hated-hard days drain the reservoirs identically.
		const loved = work({ enjoyment: 10, trueEnjoyability: 2, suggestedHours: 4 });
		const hated = work({ enjoyment: 1, trueEnjoyability: 1, suggestedHours: 4 });
		expect(calculateBurnoutRisk([loved], 4, 0.25)).toBe(calculateBurnoutRisk([hated], 4, 0.25));
	});

	it('calibrated drain rates personalize the metric', () => {
		// The connection to the user's capacity the heuristic never had: a
		// faster-draining user (higher fitted α) sees higher risk on the same plan.
		const base = calculateBurnoutRisk([work()], 3, 0.25);
		const fast = calculateBurnoutRisk([work()], 3, 0.25, {
			...DEFAULT_ENERGY_PARAMS,
			alphaCog: 0.9
		});
		expect(fast).toBeGreaterThan(base);
	});

	it('a declared budget with nothing funded still warns', () => {
		// Old guard preserved: the intended hours are simulated at the task
		// list's average demands.
		const unfunded = work({ suggestedHours: 0, mentalDifficulty: 8 });
		expect(calculateBurnoutRisk([unfunded], 6, 0.25)).toBeGreaterThan(0);
		expect(calculateBurnoutRisk([unfunded], 0, 0.25)).toBe(0);
		expect(calculateBurnoutRisk([], 6, 0.25)).toBe(0);
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
