import { describe, expect, it } from 'vitest';
import {
	calculateSuggestedTasks,
	calculateDailyQuadrant,
	calculateFrictionIndex,
	calculateBurnoutRisk,
	calculateScheduleIntegrity,
	calculateYieldIndex,
	calculateInterleavedOrder,
	calculateHumanCapacity,
	calculateTimeScarcity,
	calculateFlowCoverage,
	calculateTaskPlan,
	calculateZenithGain,
	getTaskNature,
	type SuggestedTask,
} from '$lib/business/model/metric/calculation';
import type { Task } from '$lib/data/type';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';

function makeTask(overrides: Partial<Task> & { id: number; title: string }): Task {
	return {
		physicalDifficulty: 5,
		mentalDifficulty: 5,
		enjoyment: 5,
		createdAt: '2026-07-11',
		completed: false,
		...overrides,
	};
}

// Hand-built SuggestedTask for metrics that only read a few fields — lets a
// test pin hours/T* exactly instead of routing through the allocator.
function makeSuggested(
	overrides: Partial<SuggestedTask> & { id: number; title: string },
): SuggestedTask {
	return {
		...makeTask(overrides),
		nature: getTaskNature(makeTask(overrides)),
		suggestedHours: 1,
		priorityScore: 5,
		flowStateTime: 1,
		trueEffort: 3,
		trueEnjoyability: 1.5,
		peakProductivity: 2,
		avgProductivity: 1,
		optimalHours: 2,
		...overrides,
	};
}

describe('getTaskNature', () => {
	// ±3 is the threshold; the boundary belongs to the dominant side.
	it.each([
		[9, 2, 'cognitive'],
		[8, 5, 'cognitive'],
		[2, 9, 'physical'],
		[5, 8, 'physical'],
		[5, 5, 'balanced'],
		[7, 5, 'balanced'],
		[5, 7, 'balanced'],
	] as const)('mental %s / physical %s is %s', (mentalDifficulty, physicalDifficulty, nature) => {
		expect(
			getTaskNature({
				mentalDifficulty,
				physicalDifficulty,
			}),
		).toBe(nature);
	});
});

describe('calculateDailyQuadrant', () => {
	// 5.5 splits both axes; effective difficulty is the dominant dimension
	// plus 0.3 × the secondary one.
	it.each([
		[8, 8, 'flow'],
		[8, 3, 'grind'],
		[3, 8, 'cruise'],
		[3, 3, 'routine'],
	] as const)('difficulty %s / enjoyment %s is %s', (mentalDifficulty, enjoyment, quadrant) => {
		expect(
			calculateDailyQuadrant([
				makeTask({
					id: 1,
					title: 'a',
					mentalDifficulty,
					physicalDifficulty: 0,
					enjoyment,
				}),
			]),
		).toBe(quadrant);
	});
});

describe('calculateSuggestedTasks', () => {
	it('priorityScore is intrinsic: independent of the allocation outcome', () => {
		// Two tasks with identical effective difficulty and enjoyment (same E, β),
		// but one is purely cognitive and gets ZERO hours because the cognitive
		// pool is empty. Its priority must still equal its twin's — priority
		// measures what a task is worth, not what this plan could give it.
		const mental = makeTask({
			id: 1,
			title: 'mental',
			mentalDifficulty: 8,
			physicalDifficulty: 0,
		});

		const physical = makeTask({
			id: 2,
			title: 'physical',
			mentalDifficulty: 0,
			physicalDifficulty: 8,
		});

		const suggested = calculateSuggestedTasks([mental, physical], 4, 0, {
			cognitiveHours: 0,
			physicalHours: 6,
		});

		const mentalOut = suggested.find((t) => t.id === 1)!;
		const physicalOut = suggested.find((t) => t.id === 2)!;

		expect(mentalOut.suggestedHours).toBe(0);
		expect(physicalOut.suggestedHours).toBeGreaterThan(0);
		expect(mentalOut.priorityScore).toBe(physicalOut.priorityScore);
		expect(mentalOut.priorityScore).toBeGreaterThan(0);
	});

	// The task badge reads `nature` off the plan instead of re-classifying in the
	// component, so the threshold has one definition (AGENTS.md R2/R3).
	it('stamps each task with its nature', () => {
		const suggested = calculateSuggestedTasks(
			[
				makeTask({
					id: 1,
					title: 'deep work',
					mentalDifficulty: 9,
					physicalDifficulty: 2,
				}),
				makeTask({
					id: 2,
					title: 'boxing',
					mentalDifficulty: 2,
					physicalDifficulty: 9,
				}),
				makeTask({
					id: 3,
					title: 'errands',
					mentalDifficulty: 5,
					physicalDifficulty: 5,
				}),
			],
			8,
		);

		expect(new Map(suggested.map((t) => [t.id, t.nature]))).toEqual(
			new Map([
				[1, 'cognitive'],
				[2, 'physical'],
				[3, 'balanced'],
			]),
		);
	});

	it('honors custom user constants', () => {
		const task = makeTask({
			id: 1,
			title: 'a',
			mentalDifficulty: 7,
			physicalDifficulty: 2,
		});

		const slowToFlow = {
			c1: 1.2,
			c2: -0.1,
			c3: 1.0,
		};

		const fastToFlow = {
			c1: 0.2,
			c2: -0.1,
			c3: 0.3,
		};

		const pools = {
			cognitiveHours: 10,
			physicalHours: 10,
		};

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
			suggestedHours: 4,
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
			suggestedHours: 3,
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
			suggestedHours: 2,
		});

		expect(calculateFrictionIndex([mixed])).toBe(44);

		// Adding an equal-hours zero-gap task halves the index
		const easy = makeSuggested({
			id: 2,
			title: 'easy',
			mentalDifficulty: 3,
			physicalDifficulty: 0,
			enjoyment: 8,
			suggestedHours: 2,
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
			...overrides,
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
			suggestedHours: 0,
		});

		expect(calculateBurnoutRisk([work(), dropped], 10, 0.25)).toBe(
			calculateBurnoutRisk([work()], 10, 0.25),
		);
	});

	it('budget beyond the funded plan (intended overwork) raises the risk', () => {
		// availableHours = hours the user INTENDS to work (§11.3 reading):
		// the same plan under a bigger declared budget simulates more drain.
		// SCOPE: the plan here is hand-built, so the funded set is HELD FIXED
		// across the two budgets. It says nothing about a re-solved day — where
		// the reading may fall instead; see the characterization pin below.
		const low = calculateBurnoutRisk([work()], 3, 0.25);
		const high = calculateBurnoutRisk([work()], 6, 0.25);
		expect(high).toBeGreaterThan(low);
	});

	it('MORE budget can read LOWER risk once the plan is re-solved (settled, not a bug)', () => {
		// Pins the worst case found by scripts/burnout-risk.probe.ts (2026-08-06,
		// MATH.md §11.6): walking availableHours over a FIXED task list, the
		// reading fell on 3006 of 37800 steps, worst 29 points — right here.
		// Mechanism: the bigger budget funds 4 tasks instead of 2, and their three
		// 25-minute switch gaps are 1.25h of REST inside the day against one gap's
		// 0.42h, so simulated WORK falls from 2.83h to 2.25h (the two-task plan's
		// 2.75h stretches by 1.03 to fill 3.25h; the four-task plan's 2.25h already
		// fills 3.5h with its gaps) and both reservoirs end higher. It is NOT min()
		// swapping reservoirs — the cognitive one binds on both sides.
		// AGENTS.md §5 settled this as INTENDED ("Burnout Risk is not monotone in
		// the declared budget, and that stays"), so this is a characterization
		// test: an agent who reads the fall as a bug and smooths it gets a red
		// build pointing at that decision instead of a silent semantic change.
		const tasks = [
			makeTask({
				id: 1,
				title: 't1',
				mentalDifficulty: 9,
				physicalDifficulty: 10,
				enjoyment: 6,
			}),
			makeTask({
				id: 2,
				title: 't2',
				mentalDifficulty: 8,
				physicalDifficulty: 5,
				enjoyment: 8,
			}),
			makeTask({
				id: 3,
				title: 't3',
				mentalDifficulty: 3,
				physicalDifficulty: 1,
				enjoyment: 0,
			}),
			makeTask({
				id: 4,
				title: 't4',
				mentalDifficulty: 4,
				physicalDifficulty: 8,
				enjoyment: 2,
			}),
		];

		const switchCost = 25 / 60;

		// Re-solved per budget, exactly as the probe (and the screen) does it, so
		// the simulated blocks are the real interleaved order.
		const riskAt = (availableHours: number) =>
			calculateBurnoutRisk(
				calculateSuggestedTasks(tasks, availableHours, switchCost),
				availableHours,
				switchCost,
			);

		expect(riskAt(3.25)).toBe(41);
		expect(riskAt(3.5)).toBe(12);
	});

	it('risk is monotone in reservoir demand and discriminates across a full day', () => {
		// The retired heuristic clamped at 100% after ~1.4h of hard work;
		// the reservoir law keeps resolution over the whole range.
		const risks = [1, 2, 4, 8].map((h) =>
			calculateBurnoutRisk(
				[
					work({
						mentalDifficulty: 9,
						suggestedHours: h,
					}),
				],
				h,
				0.25,
			),
		);

		expect([...risks]).toEqual([...risks].sort((a, b) => a - b));
		expect(new Set(risks).size).toBe(risks.length);
		expect(risks[risks.length - 1]).toBeLessThan(100); // micro-recovery floor: 100% unreachable

		const mild = calculateBurnoutRisk(
			[
				work({
					mentalDifficulty: 3,
					suggestedHours: 4,
				}),
			],
			4,
			0.25,
		);

		const hard = calculateBurnoutRisk(
			[
				work({
					mentalDifficulty: 9,
					suggestedHours: 4,
				}),
			],
			4,
			0.25,
		);

		expect(hard).toBeGreaterThan(mild);
	});

	it('enjoyment does not enter: drain is f(demand, duration) in the energy model', () => {
		// Deliberate v2 semantic change (the §11.4 boundary applied here):
		// loved-hard and hated-hard days drain the reservoirs identically.
		const loved = work({
			enjoyment: 10,
			trueEnjoyability: 2,
			suggestedHours: 4,
		});

		const hated = work({
			enjoyment: 1,
			trueEnjoyability: 1,
			suggestedHours: 4,
		});

		expect(calculateBurnoutRisk([loved], 4, 0.25)).toBe(calculateBurnoutRisk([hated], 4, 0.25));
	});

	it('calibrated drain rates personalize the metric', () => {
		// The connection to the user's capacity the heuristic never had: a
		// faster-draining user (higher fitted α) sees higher risk on the same plan.
		const base = calculateBurnoutRisk([work()], 3, 0.25);

		const fast = calculateBurnoutRisk([work()], 3, 0.25, {
			...DEFAULT_ENERGY_PARAMS,
			alphaCog: 0.9,
		});

		expect(fast).toBeGreaterThan(base);
	});

	it('a declared budget with nothing funded still warns', () => {
		// Old guard preserved: the intended hours are simulated at the task
		// list's average demands.
		const unfunded = work({
			suggestedHours: 0,
			mentalDifficulty: 8,
		});

		expect(calculateBurnoutRisk([unfunded], 6, 0.25)).toBeGreaterThan(0);
		expect(calculateBurnoutRisk([unfunded], 0, 0.25)).toBe(0);
		expect(calculateBurnoutRisk([], 6, 0.25)).toBe(0);
	});
});

describe('calculateScheduleIntegrity (2026-07-18 redefinition: overhead share)', () => {
	it('a single funded session is 100% integral', () => {
		const solo = makeSuggested({
			id: 1,
			title: 'solo',
			suggestedHours: 4,
		});

		expect(calculateScheduleIntegrity([solo], 6, 0.25)).toBe(100);
	});

	it('more funded tasks per worked hour means more switching overhead', () => {
		const t = (id: number, hours: number) =>
			makeSuggested({
				id,
				title: `t${id}`,
				suggestedHours: hours,
			});

		// 4h over two tasks: 4/(4+0.25) ≈ 94%
		expect(calculateScheduleIntegrity([t(1, 2), t(2, 2)], 6, 0.25)).toBe(94);

		// The same 4h over eight tasks: 4/(4+1.75) ≈ 70%
		const eight = Array.from(
			{
				length: 8,
			},
			(_, i) => t(i + 1, 0.5),
		);

		expect(calculateScheduleIntegrity(eight, 6, 0.25)).toBe(70);
	});

	it('dropped tasks are consolidation, not fragmentation', () => {
		// Old rule: a 0-hour task counted as "fragmented" and pushed the metric
		// down, although dropping is exactly how the allocator UN-fragments a day.
		const funded = makeSuggested({
			id: 1,
			title: 'funded',
			suggestedHours: 4,
		});

		const dropped = makeSuggested({
			id: 2,
			title: 'dropped',
			suggestedHours: 0,
		});

		expect(calculateScheduleIntegrity([funded, dropped], 6, 0.25)).toBe(100);
	});

	it('keeps its empty-state guards', () => {
		expect(calculateScheduleIntegrity([], 6, 0.25)).toBe(100);

		const t = makeSuggested({
			id: 1,
			title: 't',
			suggestedHours: 0,
		});

		expect(calculateScheduleIntegrity([t], 0, 0.25)).toBe(0); // no budget set
		expect(calculateScheduleIntegrity([t], 6, 0.25)).toBe(0); // budget set, nothing funded
	});
});

describe('calculateYieldIndex', () => {
	const t = (id: number, priorityScore: number, completed: boolean) =>
		makeSuggested({
			id,
			title: `t${id}`,
			priorityScore,
			completed,
		});

	it('returns 0 with no completions', () => {
		expect(calculateYieldIndex([t(1, 9, false), t(2, 6, false)])).toBe(0);
	});

	it('is 100 when the completed tasks are the top-priority ones', () => {
		expect(calculateYieldIndex([t(1, 9, true), t(2, 6, false), t(3, 3, false)])).toBe(100);
		expect(calculateYieldIndex([t(1, 9, true), t(2, 6, true), t(3, 3, false)])).toBe(100);
	});

	it('normalizes against the best same-count choice, regardless of input order', () => {
		// Completed the weakest of priorities {9, 6, 3}: 3/9 ≈ 33%
		expect(calculateYieldIndex([t(3, 3, true), t(1, 9, false), t(2, 6, false)])).toBe(33);
	});
});

describe('calculateInterleavedOrder', () => {
	// This order is not display-only: it sets the block sequence Burnout Risk simulates.
	const cognitive = (id: number, priorityScore: number, suggestedHours = 1) =>
		makeSuggested({
			id,
			title: `cog${id}`,
			mentalDifficulty: 8,
			physicalDifficulty: 0,
			priorityScore,
			suggestedHours,
		});

	const physical = (id: number, priorityScore: number) =>
		makeSuggested({
			id,
			title: `phys${id}`,
			mentalDifficulty: 0,
			physicalDifficulty: 8,
			priorityScore,
		});

	it('only sequences funded tasks (a 0h task has no session)', () => {
		const order = calculateInterleavedOrder([cognitive(1, 9), cognitive(2, 8, 0)]);
		expect(order.map((t) => t.id)).toEqual([1]);
	});

	it('alternates natures, highest priority first', () => {
		const order = calculateInterleavedOrder([cognitive(1, 9), cognitive(2, 8), physical(3, 7)]);
		expect(order.map((t) => t.id)).toEqual([1, 3, 2]);
	});

	it('falls back to plain priority order when no contrast exists', () => {
		const order = calculateInterleavedOrder([cognitive(2, 8), cognitive(1, 9), cognitive(3, 7)]);
		expect(order.map((t) => t.id)).toEqual([1, 2, 3]);
	});
});

describe('calculateHumanCapacity', () => {
	it('reports the more saturated pool', () => {
		// 5h at mental 8 → 4 cognitive-hours on a 4h pool: 100%, cognitive-limited
		const deep = makeSuggested({
			id: 1,
			title: 'deep',
			mentalDifficulty: 8,
			physicalDifficulty: 2,
			suggestedHours: 5,
		});

		const { percent, limitType } = calculateHumanCapacity([deep], {
			cognitiveHours: 4,
			physicalHours: 6,
		});

		expect(percent).toBe(100);
		expect(limitType).toBe('cognitive');
	});

	it('a zeroed pool reads Infinity with demand (deliberately unclamped), 0 without', () => {
		const gym = makeSuggested({
			id: 1,
			title: 'gym',
			mentalDifficulty: 0,
			physicalDifficulty: 8,
			suggestedHours: 1,
		});

		expect(
			calculateHumanCapacity([gym], {
				cognitiveHours: 4,
				physicalHours: 0,
			}).percent,
		).toBe(Infinity);

		const read = makeSuggested({
			id: 2,
			title: 'read',
			mentalDifficulty: 6,
			physicalDifficulty: 0,
			suggestedHours: 1,
		});

		expect(
			calculateHumanCapacity([read], {
				cognitiveHours: 4,
				physicalHours: 0,
			}).percent,
		).toBeLessThan(Infinity);
	});

	it('empty task list reads none', () => {
		expect(
			calculateHumanCapacity([], {
				cognitiveHours: 4,
				physicalHours: 6,
			}),
		).toEqual({
			percent: 0,
			limitType: 'none',
		});
	});
});

describe('calculateTimeScarcity', () => {
	const tasks = [
		makeTask({
			id: 1,
			title: 'a',
		}),
		makeTask({
			id: 2,
			title: 'b',
		}),
	];

	it('is 0 when the budget covers flow time for every task and 100 with no budget', () => {
		expect(calculateTimeScarcity(tasks, 24)).toBe(0);
		expect(calculateTimeScarcity(tasks, 0)).toBe(100);
	});

	it('grows as the budget shrinks and stays in [0, 100]', () => {
		let prev = 0;

		for (const budget of [10, 4, 2, 1, 0.5]) {
			const s = calculateTimeScarcity(tasks, budget);
			expect(s).toBeGreaterThanOrEqual(prev);
			expect(s).toBeLessThanOrEqual(100);
			prev = s;
		}
	});
});

describe('calculateFlowCoverage', () => {
	it('counts funded tasks whose allocation reaches ϕ; unfunded never count', () => {
		const reaches = makeSuggested({
			id: 1,
			title: 'reaches',
			suggestedHours: 2,
			flowStateTime: 1.5,
		});

		const short = makeSuggested({
			id: 2,
			title: 'short',
			suggestedHours: 1,
			flowStateTime: 1.5,
		});

		// suggestedHours 0 ≥ flowStateTime 0 — must still NOT count as reached
		const dropped = makeSuggested({
			id: 3,
			title: 'dropped',
			suggestedHours: 0,
			flowStateTime: 0,
		});

		expect(calculateFlowCoverage([reaches, short, dropped])).toEqual({
			reached: 1,
			total: 3,
		});

		expect(calculateFlowCoverage([])).toEqual({
			reached: 0,
			total: 0,
		});
	});
});

describe('calculateZenithGain', () => {
	it('guards empty inputs and reports a real gain otherwise', () => {
		expect(calculateZenithGain([], 8)).toEqual({
			optimized: 0,
			naive: 0,
			gainPercent: 0,
		});

		expect(
			calculateZenithGain(
				[
					makeTask({
						id: 1,
						title: 'a',
					}),
				],
				0,
			),
		).toEqual({
			optimized: 0,
			naive: 0,
			gainPercent: 0,
		});

		const gain = calculateZenithGain(
			[
				makeTask({
					id: 1,
					title: 'hard boring',
					mentalDifficulty: 9,
					enjoyment: 2,
				}),
				makeTask({
					id: 2,
					title: 'easy fun',
					mentalDifficulty: 2,
					enjoyment: 9,
				}),
			],
			4,
			0.25,
		);

		expect(gain.optimized).toBeGreaterThan(0);
		expect(gain.optimized).toBeGreaterThanOrEqual(gain.naive);
	});

	// The plan is solved once and handed here; a wrong-order or stale array would
	// change the optimized side of the ratio without any other symptom.
	it('trusts a supplied allocation only when it is the one it would have solved', () => {
		const tasks = [
			makeTask({
				id: 1,
				title: 'hard boring',
				mentalDifficulty: 9,
				enjoyment: 2,
			}),
			makeTask({
				id: 2,
				title: 'easy fun',
				mentalDifficulty: 2,
				enjoyment: 9,
			}),
		];

		const { allocatedHours } = calculateTaskPlan(tasks, 4, 0.25);
		const solvedForItself = calculateZenithGain(tasks, 4, 0.25);

		expect(
			calculateZenithGain(tasks, 4, 0.25, undefined, undefined, undefined, allocatedHours),
		).toEqual(solvedForItself);

		// Passing hours that are not the solved plan's must change the reading —
		// otherwise this parameter proves nothing about what the screen shows.
		expect(
			calculateZenithGain(tasks, 4, 0.25, undefined, undefined, undefined, [0, 0]).optimized,
		).toBe(0);

		// A wrong-length array is a caller bug, and index-pairing would turn it
		// into NaN across the whole optimized sum: solve instead of trusting it.
		for (const wrongLength of [[], [0.5], [0.5, 0.5, 0.5]]) {
			expect(
				calculateZenithGain(tasks, 4, 0.25, undefined, undefined, undefined, wrongLength),
			).toEqual(solvedForItself);
		}
	});
});

describe('calculateTaskPlan', () => {
	// Deliberately listed worst-first, so the plan's order is not the input's.
	const tasks = [
		makeTask({
			id: 1,
			title: 'hard boring',
			mentalDifficulty: 9,
			enjoyment: 2,
		}),
		makeTask({
			id: 2,
			title: 'easy fun',
			mentalDifficulty: 2,
			enjoyment: 9,
		}),
	];

	it('returns the plan in priority order and its hours in INPUT order', () => {
		const { suggestedTasks, allocatedHours } = calculateTaskPlan(tasks, 6, 0.25);

		// The sort is real — otherwise "input order" and "plan order" would be the
		// same array and the distinction this function exists for is untested.
		expect(suggestedTasks.map((task) => task.id)).not.toEqual([1, 2]);
		expect(allocatedHours).toHaveLength(tasks.length);

		tasks.forEach((task, index) => {
			const planned = suggestedTasks.find((suggested) => suggested.id === task.id)!;

			expect(allocatedHours[index]).toBe(planned.suggestedHours);
		});
	});

	it('agrees with calculateSuggestedTasks, which is now the same solve', () => {
		expect(calculateTaskPlan(tasks, 6, 0.25).suggestedTasks).toEqual(
			calculateSuggestedTasks(tasks, 6, 0.25),
		);
	});

	it('has no plan and no hours for an empty day', () => {
		expect(calculateTaskPlan([], 8)).toEqual({
			suggestedTasks: [],
			allocatedHours: [],
		});
	});
});
