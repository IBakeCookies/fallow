/**
 * Measurements behind MATH.md §14.3's claims about the price of the switch cost.
 *
 * §14.3 was added on 2026-08-04 quoting a fixture sweep that was never
 * committed: the 298-day table, the inversion counts off the constraints bar's
 * grid, the flooring counts, the reservation shares and the "not built" fit
 * measurements all came from a script that no longer exists. This is that sweep.
 *
 * The 298 days come from the committed generator (`scripts/generate-fixture.mjs`,
 * seed 42, 365 days), regenerated here into a temporary file rather than read
 * from a checked-in JSON: the generator is deterministic, so the days are
 * reproducible without a 300 kB artifact in the tree, and a probe that quotes
 * "the fixture year" must be running on the same year the generator defines.
 *
 * A probe, not a test: every number moves when the allocator changes. The one
 * assertion is on the monotonicity §14.3's per-arm clamp rests on, checked
 * against brute force rather than against the allocator that might be wrong.
 *
 * Usage: npm run probe
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
	calculateTaskPlan,
	calculateZenithGain,
	getEffectiveDifficulty,
} from '$lib/business/model/metric/calculation';
import { suggestPlanAdjustments } from '$lib/business/model/metric/plan-advice';
import {
	BLOCK_HOURS,
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_USER_CONSTANTS,
	calculateTotalProductivity,
	type CapacityPools,
	type PooledTaskInput,
	type UserConstants,
} from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
import type { Task } from '$lib/data/type';

/** The fixture's own ground truth (`generate-fixture.mjs` TRUTH). */
const TRUTH_CONSTANTS: UserConstants = {
	c1: 0.72,
	c2: -0.38,
	c3: 0.34,
};

interface FixtureDay {
	date: string;
	tasks: Task[];
	budget: number;
	switchCost: number;
	pools: CapacityPools;
}

function fixtureDays(): FixtureDay[] {
	const out = join(mkdtempSync(join(tmpdir(), 'adv2-')), 'fixture.json');

	execFileSync(
		'node',
		['scripts/generate-fixture.mjs', '--seed', '42', '--days', '365', '--out', out],
		{
			stdio: 'ignore',
		},
	);

	const backup = JSON.parse(readFileSync(out, 'utf8'));

	return backup.stores.sessions.map(
		(session: {
			date: string;
			tasks: Task[];
			availableHours: number;
			switchCost: number;
			cognitivePool: number;
			physicalPool: number;
		}) => ({
			date: session.date,
			tasks: session.tasks,
			budget: session.availableHours,
			switchCost: session.switchCost,
			pools: {
				cognitiveHours: session.cognitivePool,
				physicalHours: session.physicalPool,
			},
		}),
	);
}

const valueAt = (
	day: FixtureDay,
	switchCost: number,
	pools: CapacityPools = day.pools,
	budget: number = day.budget,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
) => calculateZenithGain(day.tasks, budget, switchCost, pools, constants).optimized;

const quantile = (values: number[], q: number) => {
	const sorted = [...values].sort((a, b) => a - b);

	return sorted.length === 0
		? 0
		: sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

const median = (values: number[]) => quantile(values, 0.5);

const mean = (values: number[]) =>
	values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length);

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
/** What the card would print: the delta rounded the way `plan-advice.ts` rounds it. */
const rounded = (relative: number) => Math.round(relative * 1000) / 10;

const pooled = (tasks: Task[]): PooledTaskInput[] =>
	tasks.map((task) => ({
		title: task.title,
		difficulty: getEffectiveDifficulty(task),
		enjoyment: task.enjoyment,
		cognitiveWeight: task.mentalDifficulty / 10,
		physicalWeight: task.physicalDifficulty / 10,
	}));

const task = (id: number, mental: number, physical: number, enjoyment: number): Task => ({
	id,
	title: `t${id}`,
	mentalDifficulty: mental,
	physicalDifficulty: physical,
	enjoyment,
	createdAt: '2026-08-04',
	completed: false,
});

/**
 * The exhaustive optimum over the same feasible set the allocator faces — every
 * block distribution under both pools and the (m−1)·switchCost funded-count
 * overhead, scored by the model's own objective (mirrors
 * `pool-allocator.probe.ts`, which is where §13.3's brute force lives).
 */
function bruteForceOptimum(
	tasks: PooledTaskInput[],
	budget: number,
	pools: CapacityPools,
	switchCost: number,
): number {
	const n = tasks.length;
	const budgetBlocks = Math.floor(budget / BLOCK_HOURS + 1e-9);

	if (budgetBlocks < 1) return 0;

	const values: number[][] = [];
	const caps: number[] = [];

	for (const task of tasks) {
		const poolMax = Math.min(
			task.cognitiveWeight > 0
				? Math.floor(pools.cognitiveHours / (BLOCK_HOURS * task.cognitiveWeight) + 1e-9)
				: budgetBlocks,
			task.physicalWeight > 0
				? Math.floor(pools.physicalHours / (BLOCK_HOURS * task.physicalWeight) + 1e-9)
				: budgetBlocks,
		);

		const row = [0];
		let cap = 0;
		let best = -Infinity;

		for (let b = 1; b <= Math.min(budgetBlocks, poolMax); b++) {
			const value = calculateTotalProductivity([task], [b * BLOCK_HOURS], DEFAULT_USER_CONSTANTS);

			row.push(value);

			if (value >= best) {
				best = value;
				cap = b;
			}
		}

		values.push(row);
		caps.push(cap);
	}

	let brute = 0;

	const search = (
		i: number,
		blocks: number,
		funded: number,
		cog: number,
		phys: number,
		value: number,
	) => {
		if (i === n) {
			if (value > brute) brute = value;

			return;
		}

		const task = tasks[i];

		for (let b = 0; b <= caps[i]; b++) {
			const nextCog = cog + b * BLOCK_HOURS * task.cognitiveWeight;
			const nextPhys = phys + b * BLOCK_HOURS * task.physicalWeight;
			const nextFunded = funded + (b > 0 ? 1 : 0);
			const overhead = nextFunded > 1 ? (nextFunded - 1) * switchCost : 0;

			if (
				b > 0 &&
				(nextCog > pools.cognitiveHours + 1e-9 ||
					nextPhys > pools.physicalHours + 1e-9 ||
					(blocks + b) * BLOCK_HOURS + overhead > budget + 1e-9)
			)
				break;

			search(i + 1, blocks + b, nextFunded, nextCog, nextPhys, value + values[i][b]);
		}
	};

	search(0, 0, 0, 0, 0, 0);

	return brute;
}

const DAYS = fixtureDays();

describe('the price of the switch cost (MATH.md §14.3)', () => {
	it('measures the fixture year at each day’s own inputs', () => {
		const dist = new Map<number, number>();

		for (const day of DAYS) dist.set(day.tasks.length, (dist.get(day.tasks.length) ?? 0) + 1);

		const group = (label: string, days: FixtureDay[], constants = DEFAULT_USER_CONSTANTS) => {
			const doubled: number[] = [];
			const free: number[] = [];
			let moved = 0;

			for (const day of days) {
				const base = valueAt(day, day.switchCost, day.pools, day.budget, constants);

				if (base <= 0) continue;

				const toDouble =
					(valueAt(day, day.switchCost * 2, day.pools, day.budget, constants) - base) / base;

				const toFree = (valueAt(day, 0, day.pools, day.budget, constants) - base) / base;

				doubled.push(toDouble);
				free.push(toFree);

				if (Math.abs(toDouble) > 1e-12 || Math.abs(toFree) > 1e-12) moved++;
			}

			console.log(
				`[§14.3 table] ${label} (${days.length}): → s = 0.5 median ${pct(median(doubled))}, mean ${pct(mean(doubled))}, p90-by-magnitude ${pct(quantile(doubled.map(Math.abs), 0.9))}, days moved ${pct(moved / days.length)}; → s = 0 median ${pct(median(free))}`,
			);
		};

		console.log(
			`[§14.3] ${DAYS.length} worked days, task-count distribution ${[...dist.keys()]
				.sort((a, b) => a - b)
				.map((count) => `${count}:${dist.get(count)}`)
				.join(' ')}, budget < 4 h on ${DAYS.filter((day) => day.budget < 4).length}`,
		);

		group('all', DAYS);

		group(
			'2–4 tasks',
			DAYS.filter((day) => day.tasks.length >= 2 && day.tasks.length <= 4),
		);

		group(
			'5+ tasks',
			DAYS.filter((day) => day.tasks.length >= 5),
		);

		group(
			'budget < 4 h',
			DAYS.filter((day) => day.budget < 4),
		);

		group('all, fixture ground-truth constants', DAYS, TRUTH_CONSTANTS);

		group(
			'2–4 tasks, fixture ground-truth constants',
			DAYS.filter((day) => day.tasks.length >= 2 && day.tasks.length <= 4),
			TRUTH_CONSTANTS,
		);

		// Inversions, flooring, and the reservation — all at each day's own inputs.
		let invertedDays = 0;
		let negativeArms = 0;
		let arms = 0;
		const negatives: number[] = [];
		const counterfactualShares: number[] = [];
		const shippedShares: number[] = [];
		let ulpDays = 0;
		let worstUlps = 0;

		for (const day of DAYS) {
			const { suggestedTasks, allocatedHours } = calculateTaskPlan(
				day.tasks,
				day.budget,
				day.switchCost,
				day.pools,
			);

			const base = calculateZenithGain(
				day.tasks,
				day.budget,
				day.switchCost,
				day.pools,
				DEFAULT_USER_CONSTANTS,
				undefined,
				allocatedHours,
			).optimized;

			// §14.3's note on reading the value through `calculateZenithGain` rather
			// than summing the priority-sorted plan.
			const summed = suggestedTasks.reduce((sum, task) => sum + task.avgProductivity, 0);

			if (summed !== base) {
				ulpDays++;
				const ulp = Math.abs(base) * Number.EPSILON;
				worstUlps = Math.max(worstUlps, Math.abs(summed - base) / (ulp || 1));
			}

			const funded = suggestedTasks.filter((task) => task.suggestedHours > 0).length;

			counterfactualShares.push(
				day.tasks.length > 1 ? ((day.tasks.length - 1) * day.switchCost) / day.budget : 0,
			);

			shippedShares.push(funded > 1 ? ((funded - 1) * day.switchCost) / day.budget : 0);

			if (base <= 0) continue;

			const freeDelta = (valueAt(day, 0) - base) / base;
			const doubledDelta = (valueAt(day, day.switchCost * 2) - base) / base;

			arms += 2;

			if (freeDelta < 0 || doubledDelta > 0) invertedDays++;

			for (const delta of [freeDelta, doubledDelta])
				if (delta < 0) {
					negativeArms++;
					negatives.push(delta);
				}
		}

		console.log(
			`[§14.3] at each day's own inputs: ${invertedDays} of ${DAYS.length} days invert; flooring at 0 would rewrite ${negativeArms} of ${arms} alternatives (median ${pct(median(negatives))})`,
		);

		console.log(
			`[§14.3] reservation: counterfactual over the task list median ${pct(median(counterfactualShares))}, p90 ${pct(quantile(counterfactualShares, 0.9))}; shipped over funded tasks p90 ${pct(quantile(shippedShares, 0.9))}`,
		);

		console.log(
			`[§14.3] Σ avgProductivity ≠ calculateZenithGain on ${ulpDays} of ${DAYS.length} days, worst ${worstUlps.toFixed(1)} ulps`,
		);
	});

	/**
	 * §14.3's clamp rests on the exact optimum being monotone non-increasing in
	 * `s`, and its "inversions are reachable" claim on the shipped allocator
	 * breaking that at inputs the constraints bar offers. Both are measured here:
	 * the grid is budgets and pools the bar's own steps produce, and the quoted
	 * worst case (2026-05-14, budget 3 h, pools 0.5/2, s = 5 min) is in it.
	 */
	it('sweeps the constraints bar’s grid for inversions the optimum rules out', () => {
		const BUDGETS = [1, 2, 3, 4, 6];

		const POOLS = [0.5, 1, 2, 4].flatMap((cognitiveHours) =>
			[0.5, 1, 2, 6].map((physicalHours) => ({
				cognitiveHours,
				physicalHours,
			})),
		);

		const SWITCH_COSTS = [5 / 60, 15 / 60, 30 / 60];

		const configurations = DAYS.flatMap((day) =>
			BUDGETS.flatMap((budget) =>
				POOLS.flatMap((pools) =>
					SWITCH_COSTS.map((switchCost) => ({
						day,
						budget,
						pools,
						switchCost,
					})),
				),
			),
		);

		let visible = 0;
		let visibleDoubled = 0;
		let pastOnePercent = 0;
		let atDeclaredSwitchCost = 0;
		let worstFree = 0;
		let worstFreeAt = '';
		let worstDoubled = 0;
		let worstDoubledAt = '';
		let worstBigPools = 0;

		for (const { day, budget, pools, switchCost } of configurations) {
			const base = valueAt(day, switchCost, pools, budget);

			if (base <= 0) continue;

			const where = `${day.date}, budget ${budget} h, pools ${pools.cognitiveHours}/${pools.physicalHours}, s = ${Math.round(switchCost * 60)} min`;
			const free = (valueAt(day, 0, pools, budget) - base) / base;
			const doubled = (valueAt(day, switchCost * 2, pools, budget) - base) / base;

			// Only the sign the optimum rules out counts, and only when the card would
			// print it: a delta rounding to 0.0% never reaches a user.
			const wrong = [
				{
					delta: free,
					isFree: true,
				},
				{
					delta: doubled,
					isFree: false,
				},
			].filter((arm) => (arm.isFree ? arm.delta < 0 : arm.delta > 0) && rounded(arm.delta) !== 0);

			for (const { delta, isFree } of wrong) {
				visible++;

				if (Math.abs(delta) > 0.01) pastOnePercent++;

				if (Math.abs(switchCost - day.switchCost) < 1e-9) atDeclaredSwitchCost++;

				if (!isFree) visibleDoubled++;

				if (isFree && pools.cognitiveHours >= 1 && pools.physicalHours >= 1)
					worstBigPools = Math.min(worstBigPools, delta);

				if (isFree && delta < worstFree) {
					worstFree = delta;
					worstFreeAt = where;
				}

				if (!isFree && delta > worstDoubled) {
					worstDoubled = delta;
					worstDoubledAt = where;
				}
			}
		}

		console.log(
			`[§14.3 grid] ${configurations.length} configurations across ${DAYS.length} days: ${visible} visible inversions (${visibleDoubled} on the doubled arm), ${pastOnePercent} past 1%, ${atDeclaredSwitchCost} of them at the day's own s`,
		);

		console.log(
			`[§14.3 grid] worst free arm ${pct(worstFree)} (${worstFreeAt}), worst doubled arm +${pct(worstDoubled)} (${worstDoubledAt || 'none'}), worst free arm with both pools ≥ 1 h ${pct(worstBigPools)}`,
		);

		// The quoted counterexample, brute-forced: the s = 5 min plan is feasible at
		// s = 0 and already achieves the exact s = 0 optimum, so the free arm's
		// negative sign is allocator error and never a fact about the day.
		const day = DAYS.find((candidate) => candidate.date === '2026-05-14')!;
		const inputs = pooled(day.tasks);

		const pools = {
			cognitiveHours: 0.5,
			physicalHours: 2,
		};

		const declared = valueAt(day, 5 / 60, pools, 3);
		const atFree = valueAt(day, 0, pools, 3);
		const brute = bruteForceOptimum(inputs, 3, pools, 0);

		console.log(
			`[§14.3] 2026-05-14 at budget 3 h, pools 0.5/2: s = 5 min plan ${declared.toFixed(6)}, s = 0 plan ${atFree.toFixed(6)} (${pct((atFree - declared) / declared)}), exact s = 0 optimum ${brute.toFixed(6)}`,
		);

		// The monotonicity the clamp rests on, checked against brute force and not
		// against the allocator: the exact optimum cannot fall when `s` falls.
		expect(brute).toBeGreaterThanOrEqual(declared - 1e-9);
	});

	/**
	 * §14.3's "not built: fitting `s` from the plan" rests on the funded count
	 * m(s) not being monotone in `s`. Same fixture days, `s` swept across the
	 * [0,1] h range the item would have inverted over.
	 */
	it('measures m(s) for the fit that was not built', () => {
		const steps = 101;
		let violations = 0;
		let daysWithViolation = 0;
		let wholeRange = 0;
		const widths: number[] = [];
		const shifts: number[] = [];

		for (const day of DAYS) {
			const counts: number[] = [];

			for (let step = 0; step < steps; step++) {
				const { suggestedTasks } = calculateTaskPlan(
					day.tasks,
					day.budget,
					step / (steps - 1),
					day.pools,
				);

				counts.push(suggestedTasks.filter((task) => task.suggestedHours > 0).length);
			}

			let dirty = false;

			for (let step = 1; step < steps; step++)
				if (counts[step] > counts[step - 1]) {
					violations++;
					dirty = true;
				}

			if (dirty) daysWithViolation++;

			// The inversion the fit would have to do: from the funded count observed
			// at the day's own declaration, which values of `s` are consistent?
			const observed = counts[Math.round(day.switchCost * (steps - 1))];

			const consistent = (target: number) => {
				const hits = counts.flatMap((count, step) => (count === target ? [step] : []));

				return hits.length === 0
					? null
					: {
							low: hits[0],
							high: hits[hits.length - 1],
						};
			};

			const bracket = consistent(observed);

			if (!bracket) continue;

			widths.push((bracket.high - bracket.low) / (steps - 1));

			if (bracket.low === 0 && bracket.high === steps - 1) wholeRange++;

			// One mis-counted task: how far does the bracket's lower edge move?
			const miscounted = consistent(observed + 1) ?? consistent(observed - 1);

			if (miscounted) shifts.push(Math.abs(miscounted.low - bracket.low) / (steps - 1));
		}

		console.log(
			`[§14.3] m(s) over ${DAYS.length} days × ${steps} values of s in [0,1] h: ${violations} monotonicity violations on ${daysWithViolation} days`,
		);

		console.log(
			`[§14.3] one-day bracket for the observed funded count: median ${median(widths).toFixed(2)} h wide, consistent with the whole [0,1] h range on ${pct(wholeRange / widths.length)} of days; one mis-counted task shifts the lower edge by a median ${median(shifts).toFixed(2)} h`,
		);
	});

	/**
	 * §14.3 suppresses the reservation sentence and the bracket independently, and
	 * justifies that with one number: +41.8% on "a 3-task day at a 0.5 h budget with
	 * s = 15 min". Every arm above re-derives the reading through
	 * `calculateZenithGain`; this one reads the SHIPPED field, which is only
	 * reachable through `suggestPlanAdjustments` (`calculateSwitchCostPrice` is
	 * module-private). The document states neither the day's tasks nor its pools, so
	 * the space is swept and a witness printed by value.
	 */
	it('reads the suppressed bracket off suggestPlanAdjustments (MATH.md §14.3)', () => {
		const BUDGET = 0.5;
		const SWITCH_COST = 0.25;

		const POOLS: CapacityPools[] = [
			{
				cognitiveHours: 0.5,
				physicalHours: 0.5,
			},
			{
				cognitiveHours: 0.5,
				physicalHours: 2,
			},
			{
				cognitiveHours: 1,
				physicalHours: 1,
			},
			DEFAULT_CAPACITY_POOLS,
		];

		const scan = (label: string, cases: { tasks: Task[]; pools: CapacityPools }[]) => {
			const deltas: number[] = [];
			let suppressed = 0;
			let unpriceable = 0;
			let best = 0;
			let bestAt = 'none';
			let nearest = Infinity;
			let nearestAt = 'none';

			for (const { tasks, pools } of cases) {
				const advice = suggestPlanAdjustments({
					tasks,
					availableHours: BUDGET,
					switchCost: SWITCH_COST,
					pools,
					constants: DEFAULT_USER_CONSTANTS,
					energyParams: DEFAULT_ENERGY_PARAMS,
				});

				const price = advice.switchCostPrice;

				// The two suppressions §14.3 separated: no reservation to report, yet a
				// bracket to print.
				if (price.reservedHours !== 0 || price.alternatives.length === 0) continue;

				suppressed++;

				const free = price.alternatives[0];

				if (free.planValueDeltaPercent === null) {
					unpriceable++;

					continue;
				}

				const delta = free.planValueDeltaPercent;

				deltas.push(delta);

				const where = `m/p/e ${tasks
					.map((t) => `${t.mentalDifficulty}/${t.physicalDifficulty}/${t.enjoyment}`)
					.join(
						' ',
					)}, pools ${pools.cognitiveHours}/${pools.physicalHours} → +${delta}% (declared Σ P̄ ${advice.planValue.toFixed(4)}, s = 0 Σ P̄ ${free.planValue.toFixed(4)})`;

				if (delta > best) {
					best = delta;
					bestAt = where;
				}

				// §14.3's +41.8% has no executing copy: whether the space reaches it at
				// all is the finding, so the closest value it does reach is reported.
				if (Math.abs(delta - 41.8) < Math.abs(nearest - 41.8)) {
					nearest = delta;
					nearestAt = where;
				}
			}

			console.log(
				`[§14.3 bracket] ${label}: ${cases.length} cases at budget ${BUDGET} h, s = 15 min; suppressed reservation with a non-empty bracket on ${suppressed} (${unpriceable} of those unpriceable, Σ P̄ = 0); s = 0 arm median +${median(deltas)}%, max +${best}%, exactly +41.8% on ${deltas.filter((delta) => delta === 41.8).length}`,
			);

			console.log(`[§14.3 bracket] ${label} max witness: ${bestAt}`);

			console.log(`[§14.3 bracket] ${label} nearest to +41.8%: ${nearestAt}`);
		};

		scan(
			'fixture 3-task days, own pools',
			DAYS.filter((day) => day.tasks.length === 3).map((day) => ({
				tasks: day.tasks,
				pools: day.pools,
			})),
		);

		// A deterministic grid rather than a seed: the triple IS the reproduction, and
		// §14.3 needs one stated by value.
		const PROFILES = [0, 5, 10].flatMap((mental) =>
			[0, 5, 10].flatMap((physical) => [2, 9].map((enjoyment) => [mental, physical, enjoyment])),
		);

		const triples = PROFILES.flatMap((first, i) =>
			PROFILES.slice(i).flatMap((second, j) =>
				PROFILES.slice(i + j).flatMap((third) =>
					POOLS.map((pools) => ({
						tasks: [first, second, third].map((profile, index) =>
							task(index + 1, profile[0], profile[1], profile[2]),
						),
						pools,
					})),
				),
			),
		);

		scan('grid triples × 4 pool settings', triples);
	});
});
