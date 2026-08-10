/**
 * Measurements behind MATH.md §35 — the mid-day re-plan from a prefix of hours
 * already worked (ROADMAP item 12).
 *
 * Five questions, the first four of which had to be answered before the item
 * shipped and the fifth of which was answered by a bug report against it:
 *
 *  1. What is the re-plan worth against the two things a user can do today —
 *     stick to the morning plan, or drag the budget slider down (a COLD
 *     re-solve, every task back at zero)?
 *  2. What does it do on a day executed exactly to plan? It must be ≈0 there,
 *     or the reading is inventing disagreement rather than reacting to it.
 *  3. Which switch-cost convention: is re-entering an already-started task a
 *     context switch to be charged, or free? The shipped answer is FREE, and
 *     this prices the alternative it was chosen over.
 *  4. What does the second solve cost in wall clock at n = 12 — the reason it
 *     is gated rather than folded into `calculateDailyMetrics` (§14.2's cost
 *     rule).
 *  5. What was it worth to drop a task that was ticked done with nothing logged
 *     against it? That is the refund the first version handed out, and it is
 *     the reason a checkbox could reshuffle the afternoon.
 *
 * Scoring is the model's own objective over the WHOLE day: Σᵢ P̄ᵢ(hᵢ + tᵢ),
 * where hᵢ is what the user actually worked before the re-plan and tᵢ is what
 * the strategy gives them after it. All three strategies are scored the same
 * way over the same prefix, so the only difference is the afternoon.
 *
 * A probe, not a test: the numbers move whenever the allocator changes, which
 * is a legitimate model change and not a regression. Whatever it prints belongs
 * in MATH.md WITH ITS DATE.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateRemainingDay,
	type RemainingDayInput,
} from '$lib/business/model/metric/remaining-day';
import {
	calculateSuggestedTasks,
	getEffectiveDifficulty,
} from '$lib/business/model/metric/calculation';
import {
	BLOCK_HOURS,
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
	calculateTaskParams,
	expectedAverageProductivity,
} from '$lib/business/model/zenith';
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

const SEED = 0x9e12ab;
const DAYS = 400;
const BUDGETS = [2, 4, 4, 6, 8];

const task = (id: number, mental: number, physical: number, enjoyment: number): Task => ({
	id,
	title: `t${id}`,
	mentalDifficulty: mental,
	physicalDifficulty: physical,
	enjoyment,
	createdAt: '2026-08-10',
	completed: false,
});

/** Σᵢ P̄ᵢ(hoursᵢ) under the model's own objective — the currency every arm is scored in. */
function dayValue(tasks: Task[], hours: Map<number, number>): number {
	return tasks.reduce((sum, t) => {
		const spent = hours.get(t.id) ?? 0;

		if (spent <= 0) return sum;

		const { a, p0, phi } = calculateTaskParams(
			{
				title: t.title,
				difficulty: getEffectiveDifficulty(t),
				enjoyment: t.enjoyment,
			},
			DEFAULT_USER_CONSTANTS,
		);

		return sum + expectedAverageProductivity(spent, a, p0, phi, 0);
	}, 0);
}

function addHours(
	base: Map<number, number>,
	extra: ReadonlyMap<number, number>,
): Map<number, number> {
	const total = new Map(base);

	for (const [id, hours] of extra) total.set(id, (total.get(id) ?? 0) + hours);

	return total;
}

/** Snap to the block lattice, which is where the allocator's exactness lives. */
const snap = (hours: number) => Math.round(hours / BLOCK_HOURS) * BLOCK_HOURS;

/**
 * The marginal value of task `t`'s LAST block, given the prefix — the block a
 * trim would take back first.
 */
function lastBlockValue(t: Task, worked: number, planned: number): number {
	const { a, p0, phi } = calculateTaskParams(
		{
			title: t.title,
			difficulty: getEffectiveDifficulty(t),
			enjoyment: t.enjoyment,
		},
		DEFAULT_USER_CONSTANTS,
	);

	return (
		expectedAverageProductivity(worked + planned, a, p0, phi, 0) -
		expectedAverageProductivity(worked + planned - BLOCK_HOURS, a, p0, phi, 0)
	);
}

/**
 * Σ P̄ prices neither the pools nor the switch bill — they are CONSTRAINTS, not
 * terms — so an arm that ignores them outscores one that respects them for free.
 * (§19 is the same trap, one level down: the gain's naive baseline paid for
 * switches it never made.) Every arm is therefore trimmed to the same
 * feasibility before it is scored: drop the cheapest funded block until the
 * remaining budget, its switch reservation, and both depleted pools all hold.
 *
 * Returns the trimmed plan and how many blocks it had to take back — which is 0
 * for the re-plan arm on every day, since that one is feasible by construction.
 */
function trimToFeasible(
	tasks: Task[],
	worked: Map<number, number>,
	plan: Map<number, number>,
	budgetLeft: number,
): { plan: Map<number, number>; trimmed: number } {
	const out = new Map([...plan].filter(([, hours]) => hours > 0));
	let trimmed = 0;
	const byId = new Map(tasks.map((t) => [t.id, t]));

	for (;;) {
		const funded = [...out.keys()];
		const hours = [...out.values()].reduce((a, b) => a + b, 0);
		// The DAY's switch bill, not the afternoon's: a task with hours on it is
		// funded whether or not this plan gives it more (MATH.md §35). Charging the
		// afternoon's own count instead is what let a plan abandon two started
		// tasks and pocket their switches.
		const dayFunded = new Set(funded);

		for (const [id, h] of worked) if (h > 0) dayFunded.add(id);

		const overhead = dayFunded.size > 1 ? (dayFunded.size - 1) * DEFAULT_SWITCH_COST : 0;

		const draw = tasks.reduce(
			(acc, t) => {
				const total = (worked.get(t.id) ?? 0) + (out.get(t.id) ?? 0);

				return {
					cog: acc.cog + (t.mentalDifficulty / 10) * total,
					phys: acc.phys + (t.physicalDifficulty / 10) * total,
				};
			},
			{
				cog: 0,
				phys: 0,
			},
		);

		const feasible =
			hours + overhead <= budgetLeft + 1e-9 &&
			draw.cog <= DEFAULT_CAPACITY_POOLS.cognitiveHours + 1e-9 &&
			draw.phys <= DEFAULT_CAPACITY_POOLS.physicalHours + 1e-9;

		if (feasible || funded.length === 0)
			return {
				plan: out,
				trimmed,
			};

		// Take back the cheapest block anywhere in the plan.
		let victim = funded[0];
		let cheapest = Infinity;

		for (const id of funded) {
			const value = lastBlockValue(byId.get(id)!, worked.get(id) ?? 0, out.get(id)!);

			if (value < cheapest) {
				cheapest = value;
				victim = id;
			}
		}

		const left = (out.get(victim) ?? 0) - BLOCK_HOURS;

		if (left > 1e-9) out.set(victim, left);
		else out.delete(victim);

		trimmed++;
	}
}

const median = (xs: number[]) => {
	const s = [...xs].sort((x, y) => x - y);

	return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const percentile = (xs: number[], p: number) => {
	const s = [...xs].sort((x, y) => x - y);

	return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

interface Day {
	tasks: Task[];
	budget: number;
	/** The morning plan, by task id. */
	plan: Map<number, number>;
	/** What actually got worked before the re-plan, by task id. */
	worked: Map<number, number>;
	/** Ids ticked done by then. */
	completed: Set<number>;
}

/**
 * One simulated mid-day. The divergence is deliberately NOT a random walk over
 * the whole day: it is the two things that actually go wrong — the hours land
 * on a task the plan under-funded, and a task finishes off-schedule.
 */
function makeDay(rand: () => number, forceOnPlan: boolean): Day {
	const n = 3 + Math.floor(rand() * 5); // 3–7

	const tasks = Array.from(
		{
			length: n,
		},
		(_, i) =>
			task(
				i + 1,
				1 + Math.floor(rand() * 10),
				1 + Math.floor(rand() * 10),
				1 + Math.floor(rand() * 10),
			),
	);

	const budget = BUDGETS[Math.floor(rand() * BUDGETS.length)];
	const suggested = calculateSuggestedTasks(tasks, budget);
	const plan = new Map(suggested.map((t) => [t.id, t.suggestedHours]));
	const worked = new Map<number, number>();
	const completed = new Set<number>();

	if (forceOnPlan) {
		// The control arm, and it has to be exact about what "to plan" means: work
		// HALF of every funded task's own allocation and finish nothing. Completing
		// a task would confound the control — it hands the afternoon back a switch
		// the morning had reserved, which is a real gain of the re-plan but not the
		// thing this arm is asking about.
		for (const t of suggested) {
			const planned = plan.get(t.id) ?? 0;
			const take = snap(planned / 2);

			if (take > 0) worked.set(t.id, take);
		}

		return {
			tasks,
			budget,
			plan,
			worked,
			completed,
		};
	}

	// The divergent arm: a fraction of the day went somewhere the plan did not
	// put it, and one task may have finished early or late.
	const spendable = snap(budget * (0.3 + rand() * 0.45));
	const victim = tasks[Math.floor(rand() * tasks.length)];

	if (rand() < 0.6) {
		// Everything on one task — the "you spent the morning on the wrong thing" case.
		worked.set(victim.id, spendable);
	} else {
		// Split across two, one of them finished off-schedule.
		const other = tasks[Math.floor(rand() * tasks.length)];
		const first = snap(spendable * (0.3 + rand() * 0.4));

		worked.set(victim.id, first);

		if (other.id !== victim.id && spendable - first > 0) {
			worked.set(other.id, spendable - first);

			if (rand() < 0.5) completed.add(other.id);
		}
	}

	if (rand() < 0.35) completed.add(victim.id);

	return {
		tasks,
		budget,
		plan,
		worked,
		completed,
	};
}

function withCompletion(day: Day): Task[] {
	return day.tasks.map((t) => ({
		...t,
		completed: day.completed.has(t.id),
	}));
}

function remainingInput(day: Day, budget: number): RemainingDayInput {
	return {
		tasks: withCompletion(day),
		availableHours: budget,
		switchCost: DEFAULT_SWITCH_COST,
		pools: DEFAULT_CAPACITY_POOLS,
		constants: DEFAULT_USER_CONSTANTS,
		workedHours: day.worked,
	};
}

/** What the morning plan still asks for, given what has been worked and finished. */
function morningRemainder(day: Day): Map<number, number> {
	const out = new Map<number, number>();
	let left = Math.max(0, day.budget - [...day.worked.values()].reduce((a, b) => a + b, 0));

	for (const t of day.tasks) {
		if (day.completed.has(t.id)) continue;

		const owed = Math.max(0, (day.plan.get(t.id) ?? 0) - (day.worked.get(t.id) ?? 0));
		const take = snap(Math.min(owed, left));

		if (take > 0) {
			out.set(t.id, take);
			left -= take;
		}
	}

	return out;
}

/** What the budget slider gives today: the same hours left, solved COLD. */
function coldResolve(day: Day): Map<number, number> {
	const workedTotal = [...day.worked.values()].reduce((a, b) => a + b, 0);
	const open = withCompletion(day).filter((t) => !t.completed);

	return new Map(
		calculateSuggestedTasks(open, Math.max(0, day.budget - workedTotal))
			.filter((t) => t.suggestedHours > 0)
			.map((t) => [t.id, t.suggestedHours]),
	);
}

const gain = (arm: number, base: number) => (base > 0 ? (arm - base) / base : 0);

/**
 * Every arm scored the same way: trimmed to feasibility, then valued over the
 * WHOLE day, prefix included. The denominator matters — scoring the afternoon's
 * increment alone divides by a small number and turns a few minutes of
 * difference into a triple-digit percentage. `Σ P̄` of the day is the quantity
 * §0's objective actually names, and it is what these percentages are OF.
 */
function scoreArm(day: Day, plan: Map<number, number>, budgetLeft: number) {
	const { plan: feasible, trimmed } = trimToFeasible(day.tasks, day.worked, plan, budgetLeft);

	return {
		value: dayValue(day.tasks, addHours(day.worked, feasible)),
		funded: [...feasible.keys()].sort((a, b) => a - b).join(','),
		trimmed,
	};
}

describe('prefix-aware mid-day re-plan (MATH.md §35)', () => {
	it('prices the re-plan against the morning plan and against a cold re-solve', () => {
		const rand = mulberry32(SEED);
		const vsCold: number[] = [];
		const vsMorning: number[] = [];
		let differsFromCold = 0;
		let zeroRemaining = 0;
		let replanTrimmed = 0;
		let coldTrimmed = 0;
		let morningTrimmed = 0;

		for (let d = 0; d < DAYS; d++) {
			const day = makeDay(rand, false);
			const replan = calculateRemainingDay(remainingInput(day, day.budget));

			if (!replan) continue;

			if (replan.remainingHours <= 0) {
				zeroRemaining++;
				continue;
			}

			const left = replan.remainingHours;
			const armReplan = scoreArm(day, new Map(replan.hoursByTask), left);
			const armCold = scoreArm(day, coldResolve(day), left);
			const armMorning = scoreArm(day, morningRemainder(day), left);

			if (armReplan.trimmed) replanTrimmed++;

			if (armCold.trimmed) coldTrimmed++;

			if (armMorning.trimmed) morningTrimmed++;

			vsCold.push(gain(armReplan.value, armCold.value));
			vsMorning.push(gain(armReplan.value, armMorning.value));

			if (armReplan.funded !== armCold.funded) differsFromCold++;
		}

		console.log(
			`\n=== Value of the re-plan (${vsCold.length} days, seed 0x${SEED.toString(16)}) ===`,
		);

		console.log(
			`vs COLD re-solve (the budget slider): median ${pct(median(vsCold))}  mean ${pct(mean(vsCold))}  p90 ${pct(percentile(vsCold, 0.9))}  worst ${pct(Math.min(...vsCold))}`,
		);

		console.log(
			`vs the MORNING plan's remainder:      median ${pct(median(vsMorning))}  mean ${pct(mean(vsMorning))}  p90 ${pct(percentile(vsMorning, 0.9))}  worst ${pct(Math.min(...vsMorning))}`,
		);

		console.log(
			`funded set differs from cold on ${differsFromCold}/${vsCold.length} days (${pct(differsFromCold / vsCold.length)})`,
		);

		console.log(`days with no hours left at all (skipped): ${zeroRemaining}`);

		console.log(
			`days needing a feasibility trim — re-plan ${replanTrimmed}, cold ${coldTrimmed}, morning ${morningTrimmed}`,
		);
	});

	it('does almost nothing on a day executed exactly to plan', () => {
		const rand = mulberry32(SEED + 1);
		const vsMorning: number[] = [];
		let differs = 0;

		for (let d = 0; d < DAYS; d++) {
			const day = makeDay(rand, true);
			const replan = calculateRemainingDay(remainingInput(day, day.budget));

			if (!replan || replan.remainingHours <= 0) continue;

			const left = replan.remainingHours;
			const armReplan = scoreArm(day, new Map(replan.hoursByTask), left);
			const armMorning = scoreArm(day, morningRemainder(day), left);

			vsMorning.push(gain(armReplan.value, armMorning.value));

			if (armReplan.funded !== armMorning.funded) differs++;
		}

		console.log(`\n=== On-plan control (${vsMorning.length} days) ===`);

		console.log(
			`vs the morning plan's remainder: median ${pct(median(vsMorning))}  mean ${pct(mean(vsMorning))}  p90 ${pct(percentile(vsMorning, 0.9))}`,
		);

		console.log(
			`funded set differs from the morning remainder on ${differs}/${vsMorning.length} days (${pct(differs / vsMorning.length)})`,
		);
	});

	it('prices the switch-cost convention it did not take', () => {
		// Charging re-entry means the afternoon pays one more switch whenever it
		// picks up a task the morning already started. The allocator charges
		// switches off the budget (`budgetBlocksFor`), so charging it here is the
		// same operation: hand the solve one switchCost fewer hours.
		const rand = mulberry32(SEED + 2);
		const free: number[] = [];
		const charged: number[] = [];
		let differs = 0;

		for (let d = 0; d < DAYS; d++) {
			const day = makeDay(rand, false);

			const openStarted = day.tasks.some(
				(t) => !day.completed.has(t.id) && (day.worked.get(t.id) ?? 0) > 0,
			);

			const asFree = calculateRemainingDay(remainingInput(day, day.budget));

			if (!asFree || asFree.remainingHours <= 0) continue;

			const asCharged = openStarted
				? calculateRemainingDay(remainingInput(day, day.budget - DEFAULT_SWITCH_COST))
				: asFree;

			if (!asCharged) continue;

			const vMorning = scoreArm(day, morningRemainder(day), asFree.remainingHours).value;

			free.push(
				gain(scoreArm(day, new Map(asFree.hoursByTask), asFree.remainingHours).value, vMorning),
			);

			charged.push(
				gain(scoreArm(day, new Map(asCharged.hoursByTask), asFree.remainingHours).value, vMorning),
			);

			const a = [...asFree.hoursByTask.keys()].sort().join(',');
			const b = [...asCharged.hoursByTask.keys()].sort().join(',');

			if (a !== b) differs++;
		}

		console.log(`\n=== Switch-cost convention (${free.length} days) ===`);
		console.log(`free re-entry (SHIPPED): median ${pct(median(free))}  mean ${pct(mean(free))}`);

		console.log(
			`charged re-entry:        median ${pct(median(charged))}  mean ${pct(mean(charged))}`,
		);

		console.log(
			`they pick a different funded set on ${differs}/${free.length} days (${pct(differs / free.length)})`,
		);
	});

	it('prices the checkbox: what dropping an unlogged completion was worth', () => {
		// Ticking a box is not an hours instrument. The first shipped version still
		// dropped a completed task from the candidate set whether or not anything
		// was logged against it, which refunded hours and a switch the day may well
		// have spent. This prices that refund: tick one open, unlogged task done
		// and measure how far it moved every OTHER task's allocation.
		//
		// The convention now in the code is inputs-identical either way, so its
		// column is 0 by construction and there is nothing to sweep — the number
		// worth quoting is what the drop was doing, which is what this prints.
		const rand = mulberry32(SEED + 4);
		const drift: number[] = [];
		let moved = 0;
		let gained = 0;

		for (let d = 0; d < DAYS; d++) {
			const day = makeDay(rand, false);

			const untouched = day.tasks.find(
				(t) => !day.completed.has(t.id) && !(day.worked.get(t.id) ?? 0),
			);

			if (!untouched) continue;

			const before = calculateRemainingDay(remainingInput(day, day.budget));

			if (!before || before.remainingHours <= 0) continue;

			// The old convention, reproduced exactly: a completed task left the
			// candidate set. With no hours on it, it also drew no pool, so striking
			// it from the day's list is the same operation.
			const dropped = calculateRemainingDay({
				...remainingInput(day, day.budget),
				tasks: day.tasks.filter((t) => t.id !== untouched.id),
			});

			if (!dropped) continue;

			const others = day.tasks.filter((t) => t.id !== untouched.id);

			const shift = others.reduce(
				(sum, t) =>
					sum +
					Math.abs((dropped.hoursByTask.get(t.id) ?? 0) - (before.hoursByTask.get(t.id) ?? 0)),
				0,
			);

			const net = others.reduce(
				(sum, t) =>
					sum + (dropped.hoursByTask.get(t.id) ?? 0) - (before.hoursByTask.get(t.id) ?? 0),
				0,
			);

			drift.push(shift);

			if (shift > 1e-9) moved++;

			if (net > 1e-9) gained++;
		}

		console.log(`\n=== Ticking one unlogged task done (${drift.length} days) ===`);

		console.log(
			`hours moved onto other tasks by the DROP convention: median ${median(drift).toFixed(2)}h  mean ${mean(drift).toFixed(2)}h  p90 ${percentile(drift, 0.9).toFixed(2)}h  worst ${Math.max(...drift).toFixed(2)}h`,
		);

		console.log(
			`it moved something on ${moved}/${drift.length} days (${pct(moved / drift.length)}), and handed the day a NET gain on ${gained} of them`,
		);

		console.log('the convention in the code moves nothing on any day, by construction');
	});

	it('measures the second solve, which is why it is gated', () => {
		const rand = mulberry32(SEED + 3);

		for (const n of [3, 7, 12]) {
			const tasks = Array.from(
				{
					length: n,
				},
				(_, i) =>
					task(
						i + 1,
						1 + Math.floor(rand() * 10),
						1 + Math.floor(rand() * 10),
						1 + Math.floor(rand() * 10),
					),
			);

			const worked = new Map([[tasks[0].id, 2]]);

			const input: RemainingDayInput = {
				tasks,
				availableHours: 8,
				switchCost: DEFAULT_SWITCH_COST,
				pools: DEFAULT_CAPACITY_POOLS,
				constants: DEFAULT_USER_CONSTANTS,
				workedHours: worked,
			};

			const runs = 20;
			const started = performance.now();

			for (let i = 0; i < runs; i++) calculateRemainingDay(input);

			const each = (performance.now() - started) / runs;
			// The gate's whole point: an unlogged day never reaches the solve.
			const emptyStart = performance.now();

			for (let i = 0; i < runs; i++)
				calculateRemainingDay({
					...input,
					workedHours: new Map(),
				});

			const emptyEach = (performance.now() - emptyStart) / runs;

			console.log(
				`n = ${String(n).padStart(2)}: ${each.toFixed(1)} ms/solve, ${emptyEach.toFixed(3)} ms when nothing is logged`,
			);
		}
	});
});
