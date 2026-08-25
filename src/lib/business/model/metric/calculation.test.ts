import { describe, expect, it } from 'vitest';
import {
	calculateSuggestedTasks,
	calculateDailyQuadrant,
	calculateQuadrantMargin,
	calculateFrictionIndex,
	calculateBurnoutRisk,
	calculateScheduleIntegrity,
	calculateYieldIndex,
	calculateInterleavedOrder,
	calculateHumanCapacity,
	calculateTimeScarcity,
	calculateFlowCoverage,
	calculateBottleneckTask,
	calculateLongestWarmUp,
	calculateTaskPlan,
	calculateZenithGain,
	calculateCognitiveLoad,
	calculatePhysicalLoad,
	calculateEnergyBalance,
	calculateDeepWorkRatio,
	calculateGrindDensity,
	calculateRewardDensity,
	getTaskNature,
	type SuggestedTask,
} from '$lib/business/model/metric/calculation';
import {
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
} from '$lib/business/model/zenith';
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
	// ±3 is the threshold; the boundary belongs to the dominant side. A zero
	// dimension outranks the gap, so the sub-threshold pairs the sliders reach
	// at the bottom of the range are dominant, not balanced (MATH.md §22).
	it.each([
		[9, 2, 'cognitive'],
		[8, 5, 'cognitive'],
		[2, 9, 'physical'],
		[5, 8, 'physical'],
		[5, 5, 'balanced'],
		[7, 5, 'balanced'],
		[5, 7, 'balanced'],
		[2, 0, 'cognitive'],
		[1, 0, 'cognitive'],
		[0, 2, 'physical'],
		[0, 1, 'physical'],
		[0, 0, 'balanced'],
	] as const)('mental %s / physical %s is %s', (mentalDifficulty, physicalDifficulty, nature) => {
		expect(
			getTaskNature({
				mentalDifficulty,
				physicalDifficulty,
			}),
		).toBe(nature);
	});

	// The rate MATH.md §22 quotes, pinned from `mtr-task-nature.probe.ts`: 45 of
	// the 121 pairs the sliders reach, down from 49 before the zero gate.
	it('calls 45 of the 121 reachable pairs balanced', () => {
		const square = Array.from(
			{
				length: 11,
			},
			(_, mentalDifficulty) =>
				Array.from(
					{
						length: 11,
					},
					(_, physicalDifficulty) => ({
						mentalDifficulty,
						physicalDifficulty,
					}),
				),
		).flat();

		expect(square.filter((pair) => getTaskNature(pair) === 'balanced')).toHaveLength(45);
	});
});

describe('calculateDailyQuadrant', () => {
	const day = (
		specs: [mental: number, physical: number, enjoyment: number, hours: number][],
	): SuggestedTask[] =>
		specs.map(([mentalDifficulty, physicalDifficulty, enjoyment, suggestedHours], index) =>
			makeSuggested({
				id: index + 1,
				title: `t${index + 1}`,
				mentalDifficulty,
				physicalDifficulty,
				enjoyment,
				suggestedHours,
			}),
		);

	// Enjoyment cuts at 5.5, the midpoint of its 1–10 slider; difficulty at 6.5,
	// what a task rated at the midpoint of BOTH 0–10 sliders reads through
	// `max + 0.3·min` (MATH.md §29).
	it.each([
		[8, 8, 'flow'],
		[8, 3, 'grind'],
		[3, 8, 'cruise'],
		[3, 3, 'routine'],
	] as const)('difficulty %s / enjoyment %s is %s', (mental, enjoyment, quadrant) => {
		expect(calculateDailyQuadrant(day([[mental, 0, enjoyment, 1]]))).toBe(quadrant);
	});

	// The cut is on the composite, so the spillover decides these two — the old
	// fixtures all set physical 0, the one case where it contributes nothing.
	it('reads the midpoint of both difficulty sliders as demanding, and one point under it as not', () => {
		expect(calculateDailyQuadrant(day([[5, 5, 3, 1]]))).toBe('grind'); // 5 + 0.3×5 = 6.5
		expect(calculateDailyQuadrant(day([[5, 4, 3, 1]]))).toBe('routine'); // 5 + 0.3×4 = 6.2
	});

	it('weights by allocated hours, not by task count', () => {
		// Three short joys outnumber one long grind; the day is still the grind.
		const tasks = day([
			[9, 0, 2, 6],
			[1, 0, 9, 0.5],
			[1, 0, 9, 0.5],
			[1, 0, 9, 0.5],
		]);

		expect(calculateDailyQuadrant(tasks)).toBe('grind');
	});

	it('gives a task the plan funded no hours for no vote', () => {
		const funded = day([[2, 0, 9, 3]]);
		const withUnfunded = [...funded, ...day([[10, 10, 1, 0]])];

		expect(calculateDailyQuadrant(funded)).toBe('cruise');
		expect(calculateDailyQuadrant(withUnfunded)).toBe('cruise');
	});

	it('has no reading for an empty list or a plan that books nothing', () => {
		expect(calculateDailyQuadrant([])).toBeNull();
		expect(calculateDailyQuadrant(day([[9, 9, 9, 0]]))).toBeNull();
	});

	it('reports the distance to the nearer cut, so the advisor can refuse a hairline flip', () => {
		// Difficulty 6.5 sits ON its cut; enjoyment 5 is 0.5 under its own.
		expect(calculateQuadrantMargin(day([[5, 5, 5, 1]]))).toBe(0);
		expect(calculateQuadrantMargin(day([[3, 0, 8, 1]]))).toBeCloseTo(2.5, 10);
		expect(calculateQuadrantMargin([])).toBeNull();
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

	it('measures EFFECTIVE difficulty, so a two-dimensional task can outrun the enjoyment it beat on both sliders', () => {
		// The §11.4 boundary is stated per-task ("difficulty you love is not
		// friction"), but the left side is the spillover composite
		// (max + 0.3·min = 9.1 here) and the right is the raw slider. Enjoyment 8
		// beats BOTH difficulty dimensions and the task still reads friction —
		// deliberate (a task demanding 7 of body AND mind demands more than
		// either number says), and the only fixture that pins the interior of the
		// scale: DIFFICULTY_SPILLOVER moves this number, the endpoints above
		// hide it (both clamp).
		const bothDimensions = makeSuggested({
			id: 1,
			title: 'competitive climbing',
			mentalDifficulty: 7,
			physicalDifficulty: 7,
			enjoyment: 8,
			suggestedHours: 2,
		});

		expect(calculateFrictionIndex([bothDimensions])).toBe(12);

		// Single-dimension at the same peak: gap 0, and no friction at all.
		expect(
			calculateFrictionIndex([
				{
					...bothDimensions,
					physicalDifficulty: 0,
				},
			]),
		).toBe(0);
	});

	it('returns the sentinel 0 when there are no allocated hours to average over', () => {
		expect(calculateFrictionIndex([])).toBe(0);

		// A max-gap task the plan does not fund reads 0, not 100: it is absent from
		// both sides of a time-weighted average. §32 gates the row N/A there, so the
		// sentinel never reaches the user as "a frictionless day".
		expect(
			calculateFrictionIndex([
				makeSuggested({
					id: 1,
					title: 'unfunded grind',
					mentalDifficulty: 10,
					physicalDifficulty: 0,
					enjoyment: 1,
					suggestedHours: 0,
				}),
			]),
		).toBe(0);
	});
});

describe('calculateGrindDensity (MATH.md §11.10)', () => {
	const chore = (overrides: Partial<SuggestedTask> = {}) =>
		makeSuggested({
			id: 1,
			title: 'chore',
			mentalDifficulty: 8,
			physicalDifficulty: 0,
			enjoyment: 2,
			suggestedHours: 1,
			...overrides,
		});

	const treat = (overrides: Partial<SuggestedTask> = {}) =>
		makeSuggested({
			id: 2,
			title: 'treat',
			mentalDifficulty: 3,
			physicalDifficulty: 0,
			enjoyment: 9,
			suggestedHours: 1,
			...overrides,
		});

	it('counts the funded plan, and reports what it counted', () => {
		expect(
			calculateGrindDensity([
				chore(),
				treat(),
				treat({
					id: 3,
				}),
			]),
		).toEqual({
			grinds: 1,
			funded: 3,
			percent: 33,
		});
	});

	it('a dropped task does not vote', () => {
		// A task the plan funds 0 h is work the day does not do, so it drains no
		// willpower — and counting it made "defer a task you were not going to
		// touch" the advisor's cheapest fix, at Σ P̄ cost 0.
		const withDropped = calculateGrindDensity([
			chore(),
			treat(),
			chore({
				id: 3,
				suggestedHours: 0,
			}),
		]);

		expect(withDropped).toEqual(calculateGrindDensity([chore(), treat()]));
		expect(withDropped.percent).toBe(50);
	});

	it('with nothing funded there is no share to report', () => {
		// The 0 is a sentinel, not a clean day: the row gates on `funded` and the
		// advisor reads NaN, so neither renders this as the best possible plan.
		expect(
			calculateGrindDensity([
				chore({
					suggestedHours: 0,
				}),
			]),
		).toEqual({
			grinds: 0,
			funded: 0,
			percent: 0,
		});

		expect(calculateGrindDensity([])).toEqual({
			grinds: 0,
			funded: 0,
			percent: 0,
		});
	});

	it('splits at strict > , so it partitions with Sustainable Work', () => {
		// Effective difficulty 5 against enjoyment 5: not a grind, and the same
		// task IS sustainable time (`enjoyment >= difficulty`). Every funded task
		// belongs to exactly one of the two readings.
		const tie = chore({
			mentalDifficulty: 5,
			physicalDifficulty: 0,
			enjoyment: 5,
		});

		expect(calculateGrindDensity([tie]).grinds).toBe(0);
		expect(calculateRewardDensity([tie])).toBe(100);
	});

	it('measures EFFECTIVE difficulty, so a two-dimensional task can grind on its own', () => {
		// m7/p7 demands more than either slider says: 7 + 0.3·7 = 9.1 > 9. The
		// interior of the scale, where `DIFFICULTY_SPILLOVER` is visible — the same
		// boundary Friction Index reads as a magnitude (§11.4), here as a count.
		expect(
			calculateGrindDensity([
				chore({
					mentalDifficulty: 7,
					physicalDifficulty: 7,
					enjoyment: 9,
				}),
			]).grinds,
		).toBe(1);

		// One dimension at the same peak: 7 < 9, no grind.
		expect(
			calculateGrindDensity([
				chore({
					mentalDifficulty: 7,
					physicalDifficulty: 0,
					enjoyment: 9,
				}),
			]).grinds,
		).toBe(0);
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

	it('with NOTHING funded, one more dropped task does move the risk (§11.3 scope)', () => {
		// §11.3 claimed the dropped-task invariance above without qualification.
		// It only holds while the plan funds something: with nothing funded the
		// reading simulates the declared budget at the task list's AVERAGE demands
		// (§11.6), so another task moves the average and the number.
		const unfunded = work({
			suggestedHours: 0,
		});

		const dropped = makeSuggested({
			id: 2,
			title: 'gym',
			mentalDifficulty: 1,
			physicalDifficulty: 8,
			enjoyment: 7,
			suggestedHours: 0,
		});

		// The exact pair §11.3 quotes. Pinned by value, not by `not.toBe`: the
		// inequality alone survives swapping the mean for a max (32 → 48), a sum
		// (32 → 48), or the cognitive/physical demands (28 → 18) — every mutant
		// still moves the reading, just not to the mean's number.
		expect(calculateBurnoutRisk([unfunded], 10, 0.25)).toBe(32);
		expect(calculateBurnoutRisk([unfunded, dropped], 10, 0.25)).toBe(16);
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

	it('overwork stretches the funded blocks PRO-RATA, not evenly (§11.6)', () => {
		// §11.6's "stretching the funded blocks pro-rata" was previously pinned by
		// nothing: the other multi-task fixtures sit where pro-rata and an equal
		// split coincide, so an equal-split regression passed the whole suite.
		// This fixture separates them by 33 points. It works because the plan ends
		// on a TINY light task: pro-rata keeps it short (0.25h × 1.875), so the day
		// ends on the heavy p10 block, while an equal split hands it 2.33h of extra
		// low-demand time and lets the reservoirs refill.
		//
		// Mutant readings at this fixture (scratch-probed 2026-08-07), all killed:
		//   pro-rata (shipped)  41   ← the physical reservoir binds, 0.593 vs 0.833
		//   equal split          8
		//   gaps stretched too  33   (§11.6 stretches the FUNDED blocks only)
		//   gaps omitted        53
		//   overhang ignored    43
		const plan = [
			makeSuggested({
				id: 1,
				title: 'admin',
				mentalDifficulty: 2,
				physicalDifficulty: 4,
				enjoyment: 4,
				suggestedHours: 3.25,
			}),
			makeSuggested({
				id: 2,
				title: 'move house',
				mentalDifficulty: 6,
				physicalDifficulty: 10,
				enjoyment: 4,
				suggestedHours: 4.5,
			}),
			makeSuggested({
				id: 3,
				title: 'water plants',
				mentalDifficulty: 1,
				physicalDifficulty: 1,
				enjoyment: 4,
				suggestedHours: 0.25,
			}),
		];

		// allocated 8h + 2 gaps × 15m = 8.5h against a declared 15.5h, so the
		// overhang is 7h and the pro-rata stretch is exactly 1.875.
		expect(calculateBurnoutRisk(plan, 15.5, 0.25)).toBe(41);
	});

	it('treats a non-positive switch cost as no switching, so the span stays the budget', () => {
		// The overhead term is (n−1)·switchCost, so a NEGATIVE cost used to grow
		// the overhang while the gap blocks were only pushed when positive — the
		// simulated day then ran longer than the declared budget with the whole
		// difference counted as work (4 tasks, 10h budget, s = −30m: an 11.5h
		// span), reading ~1–2 points high. Reachable mid-typing: the number input
		// defers clamping to blur.
		const plan = [1, 2, 3, 4].map((id) =>
			makeSuggested({
				id,
				title: `t${id}`,
				mentalDifficulty: 7,
				physicalDifficulty: 2,
				enjoyment: 4,
				suggestedHours: 1.5,
			}),
		);

		const zero = calculateBurnoutRisk(plan, 10, 0);

		expect(calculateBurnoutRisk(plan, 10, -0.5)).toBe(zero);
		expect(calculateBurnoutRisk(plan, 10, Number.NaN)).toBe(zero);
	});

	it('MORE budget can read LOWER risk once the plan is re-solved (settled, not a bug)', () => {
		// Pins the worst case found by scripts/burnout-risk.probe.ts (2026-08-25,
		// MATH.md §11.6): walking availableHours over a FIXED task list, the
		// reading fell on 3033 of 37800 steps, worst 29 points — right here.
		// Mechanism: the bigger budget funds 4 tasks instead of 2, and their three
		// 25-minute switch gaps are 1.25h of REST inside the day against one gap's
		// 0.42h, so simulated WORK falls from 2.83h to 2.25h (the two-task plan's
		// 2.75h stretches by 1.03 to fill 3.25h; the four-task plan's 2.25h already
		// fills 3.5h with its gaps) and both reservoirs end higher. It is NOT min()
		// swapping reservoirs — the cognitive one binds on both sides.
		// business/model/AGENTS.md settled this as INTENDED ("Burnout Risk is not monotone in
		// the declared budget or the switch cost, and that stays"), so this is a characterization
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

		// Same cell without the argument. Rounding alone would hold 94 across
		// sc ∈ [0.233, 0.278], so the constant MATH.md §11.5 quotes is pinned here.
		expect(DEFAULT_SWITCH_COST).toBe(0.25);
		expect(calculateScheduleIntegrity([t(1, 2), t(2, 2)], 6)).toBe(94);

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

		// The no-budget guard only bites on a FUNDED list: at 0 hours the
		// nothing-funded guard returns 0 anyway, so deleting it stays invisible.
		const funded = makeSuggested({
			id: 2,
			title: 'funded',
			suggestedHours: 4,
		});

		expect(calculateScheduleIntegrity([funded], 0, 0.25)).toBe(0);
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

	// MATH.md §20: the pool that BINDS is decided on the exact saturations. The
	// rounded pair below ties at 60%, and the tie used to go to cognitive — which
	// put the wrong pool, and its wrong hour count, into the row's description.
	it('names the pool that binds, not the one rounding ties toward', () => {
		const mental = makeSuggested({
			id: 1,
			title: 'mental',
			mentalDifficulty: 10,
			physicalDifficulty: 0,
			suggestedHours: 2.4, // 2.4 of 4 cognitive-hours → 60.00%
		});

		const physical = makeSuggested({
			id: 2,
			title: 'physical',
			mentalDifficulty: 0,
			physicalDifficulty: 10,
			suggestedHours: 2.41, // 2.41 of 4 physical-hours → 60.25%
		});

		expect(
			calculateHumanCapacity([mental, physical], {
				cognitiveHours: 4,
				physicalHours: 4,
			}),
		).toEqual({
			percent: 60,
			limitType: 'physical',
		});
	});
});

describe('calculateTimeScarcity', () => {
	// ϕ = 1h each and both funded, so Σϕ = 2h against one switch.
	const tasks = [
		makeSuggested({
			id: 1,
			title: 'a',
		}),
		makeSuggested({
			id: 2,
			title: 'b',
		}),
	];

	// The same day plus a task the plan seats no hours in: Σϕ = 3h over three
	// listed tasks, against the ONE switch the plan makes (MATH.md §37).
	const withUnfunded = [
		...tasks,
		makeSuggested({
			id: 3,
			title: 'c',
			suggestedHours: 0,
		}),
	];

	const day = (count: number, budget: number, switchCost = DEFAULT_SWITCH_COST) =>
		calculateTimeScarcity(
			calculateSuggestedTasks(
				Array.from(
					{
						length: count,
					},
					(_, i) =>
						makeTask({
							id: i + 1,
							title: `t${i}`,
						}),
				),
				budget,
				switchCost,
			),
			budget,
			switchCost,
		);

	// The covering end is tight: Σϕ = 3h plus the one switch the plan pays.
	// Billing the unfunded task's switch too would read 8 on this budget. The
	// zero end is what did not move (MATH.md §37) — nothing is funded, so there
	// is no bill and the whole Σϕ is the deficit.
	it('is 0 when the budget covers flow time for every task and 100 with no budget', () => {
		expect(calculateTimeScarcity(withUnfunded, 3.25)).toBe(0);
		expect(calculateTimeScarcity(withUnfunded, 0)).toBe(100);
	});

	// Pins the readings this ladder walks, not a law. A budget step that seats k
	// more tasks bills k·s, so a rise needs Δm·s > BLOCK_HOURS — which Δm = 2
	// satisfies at the default 15-minute cost. Measured, the default never fires
	// over 19200 budget steps (MATH.md §37), but that is an empirical result,
	// not a guarantee; the rise above the block is pinned below. The tight two
	// steps here seat 2 then 1 of the 3 tasks, so they also pin the bill's scope.
	it('grows as the budget shrinks and stays in [0, 100]', () => {
		expect([10, 4, 2, 1, 0.5].map((budget) => day(3, budget))).toEqual([0, 44, 76, 88, 92]);
	});

	// Plan family (MATH.md §11.8): the reading describes the day as designed, so
	// checking a task done must not move it — its hours stay allocated.
	it('does not move when a task is checked done', () => {
		const done = [
			tasks[0],
			makeSuggested({
				id: 2,
				title: 'b',
				completed: true,
			}),
		];

		expect(calculateTimeScarcity(done, 2)).toBe(calculateTimeScarcity(tasks, 2));
	});

	// Σϕ runs over every listed task (MATH.md §11.8), and adding one raises the
	// deficit and the denominator together — the direction is not self-evident.
	// This budget seats everything it is given (m = n), so these readings are the
	// demand side alone and say nothing about the bill's scope, which is pinned
	// below. Not a law either: a task that makes the plan seat FEWER tasks drops
	// the switch bill by more than its ϕ adds, on 0.19% of probed steps (§37).
	it('rises as tasks are added to a budget that seats them', () => {
		const readings = Array.from(
			{
				length: 5,
			},
			(_, n) => day(n + 1, 6),
		);

		for (let i = 1; i < readings.length; i++) {
			expect(readings[i]).toBeGreaterThanOrEqual(readings[i - 1]);
		}

		expect(readings.at(-1)).toBeGreaterThan(readings[0]);
	});

	// The switch bill is over the FUNDED set (MATH.md §37, §19.1): a task the
	// plan seats no hours in is switched to by nobody, so it brings its ϕ to the
	// demand and no overhead with it.
	it('bills the funded tasks, not the listed ones', () => {
		// Σϕ = 3h, two funded tasks, one switch: (3 − (2 − 0.25)) / 3.
		expect(calculateTimeScarcity(withUnfunded, 2, 0.25)).toBe(42);
		// Charging its switch too would read the day as (3 − 1.5) / 3.
		expect(calculateTimeScarcity(withUnfunded, 2, 0.25)).not.toBe(50);
	});

	// The listed bill saturated at exactly 100 as soon as (n − 1)·s reached the
	// budget — eight tasks at the default cost did it to every budget under
	// 1.75h, pinning a 15-minute day and a 90-minute one at the same reading.
	// The funded bill reads 98 against 94 and still separates them.
	it('does not pin at 100 on a day the plan can still run', () => {
		// The listed bill read 100 at BOTH budgets: (n − 1)·s = 1.75h swallowed
		// every budget at or under it, so a 15-minute day and a 90-minute day were
		// indistinguishable (MATH.md §37).
		expect([day(8, 0.25), day(8, 1.5)]).toEqual([98, 94]);
	});

	it('MORE budget can read HIGHER scarcity once the plan is re-solved (settled, not a bug)', () => {
		// The seam MATH.md §37 accepted when the bill moved to the funded set: a
		// BLOCK_HOURS budget step that seats k more tasks bills k·s, so the
		// reading RISES whenever Δm·s > BLOCK_HOURS — at s = 45m one new task
		// clears it, on 4.14% of probed steps and every day touched, worst +13
		// points. Here 1.5h funds ONE task and pays no switch, 1.75h
		// funds two and hands 45 of those 15 new minutes to the switch between
		// them, so the effective budget FALLS from 1.5h to 1h. §37 settled it as
		// INTENDED ("It stays"), for §11.6's reason: holding the funded set fixed
		// while walking the budget would report a plan the user is not being
		// shown, and smoothing it is the listed bill again, which cost the whole
		// 100 pin. So this is a characterization test: an agent who reads the
		// rise as a bug gets a red build pointing at that decision instead of a
		// silent semantic change.
		const pair = [
			makeTask({
				id: 1,
				title: 't1',
				mentalDifficulty: 5,
				physicalDifficulty: 4,
				enjoyment: 10,
			}),
			makeTask({
				id: 2,
				title: 't2',
				mentalDifficulty: 5,
				physicalDifficulty: 4,
				enjoyment: 5,
			}),
		];

		const switchCost = 0.75;

		// [funded tasks, reading] — the count rides along so a failure names the
		// mechanism and not just the number.
		const reading = (availableHours: number) => {
			const plan = calculateSuggestedTasks(pair, availableHours, switchCost);

			return [
				plan.filter((task) => task.suggestedHours > 0).length,
				calculateTimeScarcity(plan, availableHours, switchCost),
			];
		};

		expect(reading(1.5)).toEqual([1, 61]);
		expect(reading(1.75)).toEqual([2, 74]);
	});

	it('charges a single funded task no switch cost', () => {
		const one = [tasks[0]];

		expect(calculateTimeScarcity(one, 1, 2)).toBe(calculateTimeScarcity(one, 1, 0));
	});

	// One charge per switch the plan makes: the ladder steps by s/Σϕ = 8.3 points
	// per 15 minutes on this day, not the 16.7 the listed bill's two switches
	// took (MATH.md §37).
	it('honours the switch cost it is given', () => {
		expect(
			[0, 0.25, 0.5, 0.75].map((switchCost) => calculateTimeScarcity(withUnfunded, 2, switchCost)),
		).toEqual([33, 42, 50, 58]);
	});

	// ϕ is read off the plan, so the user's fitted constants (MATH.md §5, §5.2)
	// reach the reading through the allocator — a slower-to-flow user reads
	// scarcer on the same day, with no second ϕ of this metric's own (R3).
	it('reads the ϕ the plan was solved on', () => {
		const slowToFlow = {
			...DEFAULT_USER_CONSTANTS,
			c3: DEFAULT_USER_CONSTANTS.c3 + 1,
		};

		const plan = (constants: typeof DEFAULT_USER_CONSTANTS) =>
			calculateTimeScarcity(
				calculateSuggestedTasks(
					[
						makeTask({
							id: 1,
							title: 'a',
						}),
						makeTask({
							id: 2,
							title: 'b',
						}),
					],
					4,
					0.25,
					DEFAULT_CAPACITY_POOLS,
					constants,
				),
				4,
				0.25,
			);

		expect(plan(slowToFlow)).toBeGreaterThan(plan(DEFAULT_USER_CONSTANTS));
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

describe('calculateBottleneckTask', () => {
	// Cognitive draw 0.9·1 = 0.9 vs physical 0.2·1 = 0.2 — the two axes disagree
	// about which task is worst, so the binding pool decides (MATH.md §23).
	const brainy = makeSuggested({
		id: 1,
		title: 'brainy',
		mentalDifficulty: 9,
		physicalDifficulty: 2,
		suggestedHours: 1,
	});

	const heavy = makeSuggested({
		id: 2,
		title: 'heavy',
		mentalDifficulty: 2,
		physicalDifficulty: 9,
		suggestedHours: 1,
	});

	// Tiny pool on one axis, huge on the other, so the binding pool is the one
	// under test and not an accident of the demands.
	const binds = (limitType: 'cognitive' | 'physical') => ({
		cognitiveHours: limitType === 'cognitive' ? 0.1 : 100,
		physicalHours: limitType === 'physical' ? 0.1 : 100,
	});

	it('names the largest draw on the pool that binds, per axis', () => {
		expect(calculateBottleneckTask([brainy, heavy], binds('cognitive'))).toEqual({
			title: 'brainy',
			limitType: 'cognitive',
		});

		expect(calculateBottleneckTask([brainy, heavy], binds('physical'))).toEqual({
			title: 'heavy',
			limitType: 'physical',
		});
	});

	it('weighs hours, not difficulty alone', () => {
		const long = makeSuggested({
			id: 3,
			title: 'long',
			mentalDifficulty: 4,
			suggestedHours: 4,
		});

		// 0.4·4 = 1.6 beats 0.9·1 = 0.9: a mild task can still own the day.
		expect(calculateBottleneckTask([brainy, long], binds('cognitive'))?.title).toBe('long');
	});

	// The defect this signature exists to prevent (MATH.md §23.1): the axis is
	// read off the SAME list the task is picked from, so a list that loads only
	// one system is named on that system — it does not report "none" because some
	// other list bound the other pool.
	it('reads its axis off the list it is given', () => {
		const bodyOnly = makeSuggested({
			id: 5,
			title: 'pure body',
			mentalDifficulty: 0,
			physicalDifficulty: 8,
			suggestedHours: 2,
		});

		// Pools where cognitive would bind on a mixed list — irrelevant here, since
		// nothing on THIS list draws cognitively.
		expect(calculateBottleneckTask([bodyOnly], binds('cognitive'))).toEqual({
			title: 'pure body',
			limitType: 'physical',
		});
	});

	// The property that earns the name (MATH.md §23): the pool is fixed, so
	// dropping a task lowers the binding saturation by exactly its own draw —
	// the largest draw is therefore the largest available relief. Asserted
	// through `calculateHumanCapacity` rather than by re-deriving the draw here,
	// which would only restate the implementation.
	it('names the task whose removal relieves the binding pool most', () => {
		const pools = {
			cognitiveHours: 8,
			physicalHours: 8,
		};

		// Physical demand 0 throughout, so cognitive binds before and after any
		// single removal and the comparison stays on one axis.
		const plan = [
			makeSuggested({
				id: 1,
				title: 'hard and short',
				mentalDifficulty: 9,
				physicalDifficulty: 0,
				suggestedHours: 1,
			}),
			makeSuggested({
				id: 2,
				title: 'mild and long',
				mentalDifficulty: 4,
				physicalDifficulty: 0,
				suggestedHours: 4,
			}),
			makeSuggested({
				id: 3,
				title: 'hardest',
				mentalDifficulty: 10,
				physicalDifficulty: 0,
				suggestedHours: 1.5,
			}),
		];

		const named = calculateBottleneckTask(plan, pools);
		expect(named?.title).toBe('mild and long');

		const without = (title: string) =>
			calculateHumanCapacity(
				plan.filter((t) => t.title !== title),
				pools,
			).percent;

		expect(without(named!.title)).toBe(Math.min(...plan.map((t) => without(t.title))));
	});

	it('reports nothing when nothing draws at all', () => {
		expect(calculateBottleneckTask([])).toBeNull();

		// Funded no hours, so it draws nothing — the row must not blame it.
		expect(
			calculateBottleneckTask([
				makeSuggested({
					id: 4,
					title: 'unfunded',
					suggestedHours: 0,
				}),
			]),
		).toBeNull();
	});
});

describe('calculateLongestWarmUp', () => {
	it('names the largest ϕ and carries the hours funded against it', () => {
		const quick = makeSuggested({
			id: 1,
			title: 'quick',
			flowStateTime: 0.4,
			suggestedHours: 1,
		});

		const slow = makeSuggested({
			id: 2,
			title: 'slow',
			flowStateTime: 2.2,
			suggestedHours: 1,
		});

		expect(calculateLongestWarmUp([quick, slow])).toEqual({
			title: 'slow',
			flowStateTime: 2.2,
			suggestedHours: 1,
		});
	});

	it('is null on an empty list', () => {
		expect(calculateLongestWarmUp([])).toBeNull();
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

describe('calculateCognitiveLoad / calculatePhysicalLoad (MATH.md §25)', () => {
	const cognitive = (hours: number, mentalDifficulty: number) =>
		makeSuggested({
			id: 1,
			title: 'thinking',
			mentalDifficulty,
			physicalDifficulty: 0,
			suggestedHours: hours,
		});

	// The reading the locale copy used to misdescribe: INTENSITY-weighted, not a
	// share of the day's hours. Every hour of this day is cognitive work.
	it('weights by difficulty, so a full day of medium mental work reads 50%', () => {
		expect(calculateCognitiveLoad([cognitive(8, 5)], 8)).toBe(50);
	});

	it('reads the full 100% only at maximum difficulty filling the budget', () => {
		expect(calculateCognitiveLoad([cognitive(8, 10)], 8)).toBe(100);
	});

	// Same hours, same weights, the WHOLE budget as denominator — which is what
	// makes a wider budget lower the reading with no allocation change (§14.2).
	it('divides by the whole budget, switch overhead included', () => {
		expect(calculateCognitiveLoad([cognitive(4, 10)], 10)).toBe(40);
		expect(calculateCognitiveLoad([cognitive(4, 10)], 20)).toBe(20);
	});

	it('is exact, not rounded to whole percent', () => {
		expect(calculateCognitiveLoad([cognitive(4, 10)], 12)).toBeCloseTo(33.3333, 4);
	});

	// Plan scope (§11.8): a completed task keeps its hours, so the reading holds.
	it('counts completed tasks — their hours stay allocated', () => {
		const done = makeSuggested({
			id: 2,
			title: 'done',
			mentalDifficulty: 10,
			physicalDifficulty: 0,
			suggestedHours: 4,
			completed: true,
		});

		expect(calculateCognitiveLoad([done], 10)).toBe(40);
	});

	it('reads the other dimension the same way', () => {
		const physical = makeSuggested({
			id: 1,
			title: 'lifting',
			mentalDifficulty: 0,
			physicalDifficulty: 6,
			suggestedHours: 5,
		});

		expect(calculatePhysicalLoad([physical], 10)).toBe(30);
		expect(calculateCognitiveLoad([physical], 10)).toBe(0);
	});

	// The clamp is slack for allocator output (§25: 3000 days, max 100.000%) and
	// exists for hand-built hours measured against a smaller budget.
	it('clamps a task list whose weighted hours exceed the budget', () => {
		expect(calculateCognitiveLoad([cognitive(12, 10)], 8)).toBe(100);
	});

	it.each([
		['no tasks', [], 8],
		['a zero budget', [cognitive(4, 10)], 0],
		['a non-numeric budget', [cognitive(4, 10)], Number.NaN],
	] as const)('reads 0 on %s', (_label, tasks, budget) => {
		expect(calculateCognitiveLoad([...tasks], budget)).toBe(0);
	});
});

describe('calculateEnergyBalance (MATH.md §25)', () => {
	const day = (mentalHours: number, physicalHours: number) => [
		makeSuggested({
			id: 1,
			title: 'thinking',
			mentalDifficulty: 10,
			physicalDifficulty: 0,
			suggestedHours: mentalHours,
		}),
		makeSuggested({
			id: 2,
			title: 'lifting',
			mentalDifficulty: 0,
			physicalDifficulty: 10,
			suggestedHours: physicalHours,
		}),
	];

	const balanceOf = (tasks: SuggestedTask[], budget: number) =>
		calculateEnergyBalance(
			calculateCognitiveLoad(tasks, budget),
			calculatePhysicalLoad(tasks, budget),
		);

	// 4h and 6h of full-demand work in a 12h day: loads 33.33/50, whose exact
	// ratio is 40 — the band boundary, 'balanced'. Rounded to 33/50 first it
	// reads 39.76, i.e. 'physical': the classification flip §25 measured on 1.6%
	// of seeded days.
	it('divides the exact loads, not their rounded percents', () => {
		expect(balanceOf(day(4, 6), 12)).toBeCloseTo(40, 10);
		expect(calculateEnergyBalance(33, 50)).toBeCloseTo(39.759, 3);
	});

	it('is 50 on an even split and 100 on a purely cognitive day', () => {
		expect(balanceOf(day(3, 3), 10)).toBe(50);
		expect(balanceOf(day(3, 0), 10)).toBe(100);
	});

	// The thin plan that used to round to 0/0 and take the zero-load sentinel,
	// costing the advisor an axis the day really had (§25, §14.1 defect 5).
	it('reports a load too thin to round to 1%', () => {
		const thin = [
			makeSuggested({
				id: 1,
				title: 'a short easy thing',
				mentalDifficulty: 1,
				physicalDifficulty: 0,
				suggestedHours: 0.5,
			}),
		];

		expect(calculateCognitiveLoad(thin, 12)).toBeCloseTo(0.4167, 4);
		expect(balanceOf(thin, 12)).toBe(100);
	});

	// Genuinely loadless: the 50 sentinel, which is also the target — the reason
	// the advisor reads this case as NaN instead of scoring it (§14.1 defect 5).
	it('falls back to 50 when the day carries no load at all', () => {
		expect(balanceOf(day(0, 0), 10)).toBe(50);
		expect(calculateEnergyBalance(0, 0)).toBe(50);
	});
});

describe('calculateDeepWorkRatio (MATH.md §26)', () => {
	const focus = (hours: number, mentalDifficulty: number) =>
		makeSuggested({
			id: 1,
			title: 'thinking',
			mentalDifficulty,
			physicalDifficulty: 0,
			suggestedHours: hours,
		});

	// The ramp, not the old `>= 7` step: mental 5 is not sustained focus, 9 is
	// entirely, and 7 — the threshold that used to swing a whole block — is half.
	it.each([
		[10, 100],
		[9, 100],
		[8, 75],
		[7, 50],
		[6, 25],
		[5, 0],
		[0, 0],
	])('counts a full day of mental-%s work as %s%%', (mental, expected) => {
		expect(calculateDeepWorkRatio([focus(8, mental)], 8)).toBeCloseTo(expected, 10);
	});

	// The defect the ramp removes: under the step cut these two days read 0% and
	// 100%, so one slider point rewrote the row.
	it('moves by a quarter of the block, not the whole of it, across the old cut', () => {
		expect(
			calculateDeepWorkRatio([focus(8, 7)], 8) - calculateDeepWorkRatio([focus(8, 6)], 8),
		).toBe(25);
	});

	// Whole budget, switch overhead included — the §25 denominator, so unspent
	// budget lowers the reading. That is why the band is not bigger-better.
	it('divides by the whole budget', () => {
		expect(calculateDeepWorkRatio([focus(4, 10)], 8)).toBe(50);
		expect(calculateDeepWorkRatio([focus(4, 10)], 16)).toBe(25);
	});

	it('is exact, not rounded to whole percent', () => {
		expect(calculateDeepWorkRatio([focus(4, 10)], 12)).toBeCloseTo(33.3333, 4);
	});

	// Plan scope (§11.8): finishing the deep task must not empty the row.
	it('counts completed tasks — their hours stay allocated', () => {
		expect(
			calculateDeepWorkRatio(
				[
					makeSuggested({
						id: 2,
						title: 'done',
						mentalDifficulty: 10,
						physicalDifficulty: 0,
						suggestedHours: 4,
						completed: true,
					}),
				],
				8,
			),
		).toBe(50);
	});

	it('clamps a task list whose deep hours exceed the budget', () => {
		expect(calculateDeepWorkRatio([focus(12, 10)], 8)).toBe(100);
	});

	it.each([
		['no tasks', [], 8],
		['a zero budget', [focus(4, 10)], 0],
		['a non-numeric budget', [focus(4, 10)], Number.NaN],
	] as const)('reads 0 on %s', (_label, tasks, budget) => {
		expect(calculateDeepWorkRatio([...tasks], budget)).toBe(0);
	});
});

describe('calculateRewardDensity — Sustainable Work (MATH.md §27)', () => {
	const hours = (
		id: number,
		suggestedHours: number,
		difficulty: number,
		enjoyment: number,
	): SuggestedTask =>
		makeSuggested({
			id,
			title: `t${id}`,
			mentalDifficulty: difficulty,
			physicalDifficulty: 0,
			enjoyment,
			suggestedHours,
		});

	// The §27 defect: the denominator is the hours the plan books, not the
	// budget. 2 h of sustainable work is all of a 2 h plan whatever the budget
	// was — unbooked time and switch overhead are not grind.
	it('divides by worked hours, not by the time budget', () => {
		expect(calculateRewardDensity([hours(1, 2, 3, 8)])).toBe(100);
		expect(calculateRewardDensity([hours(1, 2, 3, 8), hours(2, 2, 8, 1)])).toBe(50);
	});

	// The reachability the bigger-better band needs: a plan with no grind in it
	// reads 100, which the /B formula could not do once any hour went unbooked.
	it('reads 100 on a grind-free plan and 0 when every hour is grind', () => {
		expect(calculateRewardDensity([hours(1, 1, 2, 9), hours(2, 3, 5, 5)])).toBe(100);
		expect(calculateRewardDensity([hours(1, 1, 9, 2), hours(2, 3, 8, 4)])).toBe(0);
	});

	// Hours, not tasks — this is what keeps it from restating Grind Density.
	it('weighs a long grind above three short joys', () => {
		expect(
			calculateRewardDensity([
				hours(1, 6, 9, 2),
				hours(2, 0.5, 2, 9),
				hours(3, 0.5, 2, 9),
				hours(4, 0.5, 2, 9),
			]),
		).toBeCloseTo(20, 10);
	});

	// EFFECTIVE difficulty, the same composite Grind Density and Friction use
	// (§11.4): 7/7 demands more than either slider says, so enjoyment 8 does not
	// cover it (7 + 0.3·7 = 9.1).
	it('measures EFFECTIVE difficulty, so a task hard in both dimensions is not covered by enjoyment 8', () => {
		const both = makeSuggested({
			id: 1,
			title: 'both',
			mentalDifficulty: 7,
			physicalDifficulty: 7,
			enjoyment: 8,
			suggestedHours: 2,
		});

		expect(calculateRewardDensity([both])).toBe(0);

		expect(
			calculateRewardDensity([
				{
					...both,
					physicalDifficulty: 0,
				},
			]),
		).toBe(100);
	});

	// Ties are sustainable: the predicate is enjoyment ≥ difficulty, the exact
	// complement of Grind Density's difficulty > enjoyment. No hour is neither.
	it('counts a tie as sustainable, so the two rows partition the hours', () => {
		expect(calculateRewardDensity([hours(1, 2, 6, 6)])).toBe(100);
	});

	// Plan scope (§11.8): a checked-off task keeps its hours, so the row holds.
	it('counts completed tasks — their hours stay allocated', () => {
		expect(
			calculateRewardDensity([
				{
					...hours(1, 2, 3, 8),
					completed: true,
				},
				hours(2, 2, 8, 1),
			]),
		).toBe(50);
	});

	it('is exact, not rounded to whole percent', () => {
		expect(calculateRewardDensity([hours(1, 1, 3, 8), hours(2, 2, 8, 1)])).toBeCloseTo(33.3333, 4);
	});

	// Null, never 0: nothing booked is not a day of pure grind.
	it.each([
		['no tasks', []],
		['a plan that funded nothing', [hours(1, 0, 3, 8), hours(2, 0, 8, 1)]],
	] as const)('reads null on %s', (_label, tasks) => {
		expect(calculateRewardDensity([...tasks])).toBeNull();
	});
});
