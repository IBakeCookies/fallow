/**
 * Measurements behind MATH.md §25: what rounding the two Load percents cost
 * Energy Balance, and why the `min(100, ·)` clamp is slack.
 *
 * Both claims are about a POPULATION of days, not a case: "the classification
 * flips on 1.6% of days" and "the clamp never binds" need the plan space the
 * allocator actually produces, which no fixture can carry. The fixtures in
 * `calculation.test.ts` pin what this found (the intensity weighting, the
 * exact-ratio balance, the 0.42% thin plan).
 *
 * A probe, not a test: these rates move legitimately whenever the allocator, the
 * mappings or the block lattice move, and in the suite that is a red build
 * carrying no regression. Runs on demand (`npm run probe`), never in `npm test`.
 *
 * Deterministic: seeded days, no randomness a re-run can reroll.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports. An undated number in that document is unfalsifiable.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateCognitiveLoad,
	calculateEnergyBalance,
	calculatePhysicalLoad,
	calculateTaskPlan,
	type SuggestedTask,
} from '$lib/business/model/metric/calculation';
import { DEFAULT_CAPACITY_POOLS, DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import type { Task } from '$lib/data/type';

/** Seeded so a quoted number can be reproduced, not just re-rolled. */
function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const f = (n: number, digits = 2) => n.toFixed(digits);
/** `presentation/utils/band.ts`, the classification the flips are measured on. */
const skew = (value: number) => (value > 60 ? 'cognitive' : value < 40 ? 'physical' : 'balanced');

interface Day {
	tasks: Task[];
	budget: number;
	switchCost: number;
}

function seedDays(seed: number, count: number): Day[] {
	const rnd = mulberry32(seed);

	return Array.from(
		{
			length: count,
		},
		() => {
			const n = 2 + Math.floor(rnd() * 6);

			return {
				// Difficulty spans 0 (the sliders admit it, MATH.md §22), so days with
				// one dead dimension are in the sample.
				tasks: Array.from(
					{
						length: n,
					},
					(_, i) => ({
						id: i + 1,
						title: `t${i}`,
						physicalDifficulty: Math.floor(rnd() * 11),
						mentalDifficulty: Math.floor(rnd() * 11),
						enjoyment: 1 + Math.floor(rnd() * 10),
						createdAt: '2026-08-07',
						completed: false,
					}),
				),
				budget: 0.25 + Math.floor(rnd() * 48) * 0.25,
				switchCost: (5 + Math.floor(rnd() * 6) * 5) / 60,
			};
		},
	);
}

function plan(day: Day, budget = day.budget): SuggestedTask[] {
	return calculateTaskPlan(
		day.tasks,
		budget,
		day.switchCost,
		DEFAULT_CAPACITY_POOLS,
		DEFAULT_USER_CONSTANTS,
	).suggestedTasks;
}

/** What the metric layer reported before 2026-08-07: whole-percent loads. */
function roundedBalance(tasks: SuggestedTask[], budget: number): number {
	return calculateEnergyBalance(
		Math.round(calculateCognitiveLoad(tasks, budget)),
		Math.round(calculatePhysicalLoad(tasks, budget)),
	);
}

describe('the Load percents and Energy Balance', () => {
	it('is the 100% clamp ever the binding thing?', () => {
		const days = seedDays(20260807, 3000);
		let maxLoad = 0;
		let atCeiling = 0;

		for (const day of days) {
			const tasks = plan(day);

			const load = Math.max(
				calculateCognitiveLoad(tasks, day.budget),
				calculatePhysicalLoad(tasks, day.budget),
			);

			maxLoad = Math.max(maxLoad, load);

			if (load >= 99.999) atCeiling++;
		}

		console.log(`\n${days.length} seeded days`);
		console.log(`  max load reached: ${f(maxLoad, 3)}%  (clamp is at 100)`);
		console.log(`  days at the ceiling: ${atCeiling}`);
		console.log(`  → Σ hours ≤ budget − overhead and weights ≤ 1, so the clamp is slack`);
	});

	it('what did rounding the loads first cost Energy Balance?', () => {
		const days = seedDays(20260807, 3000);
		let flips = 0;
		let maxError = 0;
		let loadlessReadings = 0;
		let withLoad = 0;

		for (const day of days) {
			const tasks = plan(day);
			const cog = calculateCognitiveLoad(tasks, day.budget);
			const phys = calculatePhysicalLoad(tasks, day.budget);

			if (cog + phys === 0) continue;

			withLoad++;

			const exact = calculateEnergyBalance(cog, phys);
			const rounded = roundedBalance(tasks, day.budget);

			// The old zero-load misfire: a real plan whose loads both round to 0
			// took the 50 sentinel, and the advisor dropped the axis as loadless.
			if (Math.round(cog) + Math.round(phys) === 0) {
				loadlessReadings++;
				continue;
			}

			maxError = Math.max(maxError, Math.abs(rounded - exact));

			if (skew(rounded) !== skew(exact)) {
				flips++;

				if (flips <= 3)
					console.log(
						`  flip: loads ${f(cog)}/${f(phys)} → balance ${f(rounded)} (${skew(rounded)}) ` +
							`vs exact ${f(exact)} (${skew(exact)})`,
					);
			}
		}

		console.log(`\nof ${withLoad} days (of ${days.length}) carrying any load:`);

		console.log(
			`  cognitive/physical/balanced flips: ${flips} (${f((100 * flips) / withLoad, 1)}%), ` +
				`max |rounded − exact| ${f(maxError)} pp`,
		);

		console.log(
			`  plans with load that rounded to 0/0 (axis lost as loadless): ${loadlessReadings}`,
		);
	});

	it('a thin plan is where 0/0 is reachable', () => {
		const thin: SuggestedTask[] = [
			{
				id: 1,
				title: 'a short easy thing',
				mentalDifficulty: 1,
				physicalDifficulty: 0,
				enjoyment: 5,
				createdAt: '2026-08-07',
				completed: false,
				suggestedHours: 0.5,
				priorityScore: 1,
				flowStateTime: 0.5,
				trueEffort: 1,
				trueEnjoyability: 1.5,
				peakProductivity: 1,
				avgProductivity: 1,
				optimalHours: 0.5,
				nature: 'cognitive',
			},
		];

		const cog = calculateCognitiveLoad(thin, 12);
		const phys = calculatePhysicalLoad(thin, 12);

		console.log(
			`\n0.5h of difficulty-1 work in a 12h day: loads ${f(cog)}/${f(phys)} → ` +
				`balance exact ${f(calculateEnergyBalance(cog, phys))} (purely cognitive), ` +
				`rounded-first ${f(roundedBalance(thin, 12))} (the sentinel: no balance at all)`,
		);
	});

	it('does the rounding change which candidate the plan advisor prefers?', () => {
		const days = seedDays(4242, 2000);
		let compared = 0;
		let orderingFlips = 0;
		let worstRegret = 0;
		// The advisor's badness on this axis: distance from the 50 target (§14).
		const badness = (value: number) => Math.abs(value - 50);

		for (const day of days)
			for (const candidate of [day.budget + 1, Math.max(0.25, day.budget - 1)]) {
				const base = plan(day);
				const alt = plan(day, candidate);

				const exactBase = calculateEnergyBalance(
					calculateCognitiveLoad(base, day.budget),
					calculatePhysicalLoad(base, day.budget),
				);

				const exactAlt = calculateEnergyBalance(
					calculateCognitiveLoad(alt, candidate),
					calculatePhysicalLoad(alt, candidate),
				);

				compared++;

				const exactBetter = badness(exactAlt) < badness(exactBase);

				const roundedBetter =
					badness(roundedBalance(alt, candidate)) < badness(roundedBalance(base, day.budget));

				if (exactBetter === roundedBetter) continue;

				orderingFlips++;

				// What the rounding-only "improvement" really costs on this axis.
				if (roundedBetter)
					worstRegret = Math.max(worstRegret, badness(exactAlt) - badness(exactBase));
			}

		console.log(`\n${compared} budget±1h candidate comparisons:`);

		console.log(
			`  ordering flips under rounding: ${orderingFlips} (${f((100 * orderingFlips) / compared, 1)}%)`,
		);

		console.log(
			`  worst true penalty of a rounding-only "improvement": ${f(worstRegret)} pp — ` +
				`noise, not a wrong lever`,
		);
	});
});
