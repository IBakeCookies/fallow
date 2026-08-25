/**
 * Measurements behind MATH.md §11.6's claims about the Burnout Risk scale:
 * that 100% is unreachable (micro-recovery floors each reservoir at eq > 0),
 * that a full-demand cognitive day "tops out near 87% at defaults", that
 * sustained moderate work plateaus (an 8h and a 16h demand-0.5 day read alike),
 * and that the scale is "monotone and discriminating" — the 25/41/57/63/66%
 * ladder for 1/2/4/6/8h of demand-0.9 cognitive work. The switch-cost arm asks
 * what §11.6's monotonicity sentence leaves out: which way the declared `s`
 * moves the reading, over the domain the day's own input allows.
 *
 * A probe, not a test: every number here is a property of the model over a
 * large input space, not a binary "does this still hold". The ceiling, the
 * plateau gap and the ladder all move legitimately whenever α, r, b or the
 * allocator move — in the suite that is a red build carrying no regression, so
 * this runs on demand (`npm run probe`) and never in `npm test`. What the
 * probe FINDS is pinned by one fixture in `calculation.test.ts`, never by the
 * sweep.
 *
 * The plan is never hand-built: days go through `calculateSuggestedTasks`, so
 * the block schedule `calculateBurnoutRisk` simulates is the real one —
 * interleaved run order, switch costs as rest gaps, budget overhang stretching
 * the funded blocks pro-rata.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports. An undated number in that document is unfalsifiable.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateBurnoutRisk,
	calculateSuggestedTasks,
	type SuggestedTask,
} from '$lib/business/model/metric/calculation';
import { DEFAULT_CAPACITY_POOLS, DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import {
	ALPHA_FIT_MAX,
	DEFAULT_ENERGY_PARAMS,
	RECOVERY_FIT_MIN,
	type EnergyParams,
} from '$lib/business/model/zenith-energy';
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

const task = (id: number, mental: number, physical: number, enjoyment: number): Task => ({
	id,
	title: `t${id}`,
	mentalDifficulty: mental,
	physicalDifficulty: physical,
	enjoyment,
	createdAt: '2026-08-06',
	completed: false,
});

interface Day {
	tasks: Task[];
	availableHours: number;
	/** Hours, as the model takes it (the dump prints minutes). */
	switchCost: number;
}

const day = (tasks: Task[], availableHours: number, switchCostMinutes: number): Day => ({
	tasks,
	availableHours,
	switchCost: switchCostMinutes / 60,
});

/** Verbatim day, so any number below can be re-run by hand from this one line. */
const dump = (d: Day): string =>
	`m/p/e ${d.tasks.map((t) => `${t.mentalDifficulty}/${t.physicalDifficulty}/${t.enjoyment}`).join(' ')} | ${d.availableHours}h | s=${Math.round(d.switchCost * 60)}m`;

const plan = (d: Day): SuggestedTask[] =>
	calculateSuggestedTasks(
		d.tasks,
		d.availableHours,
		d.switchCost,
		DEFAULT_CAPACITY_POOLS,
		DEFAULT_USER_CONSTANTS,
	);

const atBudget = (d: Day, availableHours: number): Day => ({
	...d,
	availableHours,
});

const atSwitchCost = (d: Day, switchCostMinutes: number): Day => ({
	...d,
	switchCost: switchCostMinutes / 60,
});

const risk = (d: Day, params: EnergyParams): number =>
	calculateBurnoutRisk(plan(d), d.availableHours, d.switchCost, params);

function randomDays(count: number, seed: number): Day[] {
	const random = mulberry32(seed);

	const pick = (min: number, max: number, step: number) =>
		min + Math.round((random() * (max - min)) / step) * step;

	return Array.from(
		{
			length: count,
		},
		() => {
			const tasks = Array.from(
				{
					length: pick(1, 7, 1),
				},
				(_, index) => task(index + 1, pick(0, 10, 1), pick(0, 10, 1), pick(0, 10, 1)),
			);

			return day(tasks, pick(0.25, 16, 0.25), pick(5, 30, 5));
		},
	);
}

/**
 * The curated fixture beside the sweep, and where the monotonicity claim is
 * most likely to break: Burnout Risk is min(C_cog, C_phys), so a plan holding
 * both a cognitive-extreme and a physical-extreme task can swap WHICH
 * reservoir binds as the budget grows and the allocator re-funds the mix. The
 * sweep asks "does this ever happen"; this fixture asks "does it happen where
 * the mechanism says it should".
 */
const MIXED_BIND = [
	task(1, 10, 0, 6),
	task(2, 0, 10, 6),
	task(3, 8, 2, 3),
	task(4, 2, 8, 9),
	task(5, 6, 5, 5),
];

const PARAM_SETS: { label: string; params: EnergyParams }[] = [
	{
		label: 'DEFAULT_ENERGY_PARAMS',
		params: DEFAULT_ENERGY_PARAMS,
	},
	{
		label: `α = ALPHA_FIT_MAX ${ALPHA_FIT_MAX}`,
		params: {
			...DEFAULT_ENERGY_PARAMS,
			alphaCog: ALPHA_FIT_MAX,
			alphaPhys: ALPHA_FIT_MAX,
		},
	},
	{
		label: `r = RECOVERY_FIT_MIN ${RECOVERY_FIT_MIN}`,
		params: {
			...DEFAULT_ENERGY_PARAMS,
			recoveryRate: RECOVERY_FIT_MIN,
		},
	},
	{
		label: 'b = 0 (micro-recovery off)',
		params: {
			...DEFAULT_ENERGY_PARAMS,
			microRecoveryFraction: 0,
		},
	},
	{
		label: 'b = 0.3 (micro-recovery max)',
		params: {
			...DEFAULT_ENERGY_PARAMS,
			microRecoveryFraction: 0.3,
		},
	},
];

/** One task at demand w on the cognitive reservoir, budget = the whole day. */
const pure = (mental: number, hours: number): Day => day([task(1, mental, 0, 5)], hours, 15);

/**
 * (a) The ceiling and the plateau. `≥100` is the hard claim ("100% is
 * unreachable"); `>87` is the soft one ("tops out near 87% at defaults") and is
 * only a violation under DEFAULT_ENERGY_PARAMS — the other parameter sets are
 * printed to show how far the ceiling moves when a calibration fit runs to its
 * bound, which is the honest scope of "at defaults".
 */
function ceiling(label: string, params: EnergyParams, days: Day[]): void {
	let max = -1;
	let worst = days[0];
	let atLeast100 = 0;
	let above87 = 0;

	for (const d of days) {
		const r = risk(d, params);

		if (r >= 100) atLeast100++;

		if (r > 87) above87++;

		if (r > max) {
			max = r;
			worst = d;
		}
	}

	const ladder = [4, 8, 16, 24].map((h) => risk(pure(10, h), params));
	const plateau = Math.abs(risk(pure(5, 8), params) - risk(pure(5, 16), params));

	console.log(
		`ceiling ${label}: ${days.length} days, ${atLeast100} ≥100%, ${above87} >87%, max ${max}% on [${dump(worst)}]; full-demand cognitive 4/8/16/24h = ${ladder.join('/')}%; demand-0.5 |8h − 16h| = ${plateau} points`,
	);
}

/**
 * (b) Resolution and monotonicity in the budget. Holding the task list fixed
 * and walking `availableHours`, the reading should only rise: more intended
 * hours is more drain. It can fall anyway — the plan is re-solved at every
 * budget, so the funded mix changes, and min(C_cog, C_phys) can switch which
 * reservoir it reads. Counting the steps is the measurement; a decrease is not
 * an error the model raises, it is a number.
 */
function budgetMonotonicity(label: string, days: Day[]): void {
	let steps = 0;
	let decreases = 0;
	let daysWithDecrease = 0;
	let worstDrop = 0;
	let worst = '';

	for (const d of days) {
		const budgets = Array.from(
			{
				length: 64,
			},
			(_, index) => (index + 1) * 0.25,
		);

		const readings = budgets.map((hours) => risk(atBudget(d, hours), DEFAULT_ENERGY_PARAMS));
		let dipped = false;

		for (let i = 1; i < readings.length; i++) {
			const drop = readings[i - 1] - readings[i];

			steps++;

			if (drop <= 0) continue;

			decreases++;
			dipped = true;

			if (drop <= worstDrop) continue;

			worstDrop = drop;
			worst = `${dump(atBudget(d, budgets[i]))}: ${readings[i - 1]}% → ${readings[i]}%`;
		}

		if (dipped) daysWithDecrease++;
	}

	console.log(
		`budget walk ${label}: ${days.length} days × 63 steps = ${steps}, DECREASED at ${decreases} (on ${daysWithDecrease} days), worst drop ${worstDrop} points [${worst}]`,
	);
}

/**
 * (c) The declared switch cost, which §11.6's monotonicity sentence does not
 * name at all. `s` is user-set on the same screen as the reading, and re-solving
 * at every step moves what the allocator funds; a switch gap simulates as
 * full-rate rest (demand 0, gate 1), which is why the movement is mostly down.
 */
function switchCostWalk(label: string, days: Day[]): void {
	const costs = Array.from(
		{
			length: 13,
		},
		(_, index) => index * 5,
	);

	let steps = 0;
	let decreases = 0;
	let increases = 0;
	let worstFall = 0;
	let worstRise = 0;
	let rose = '';

	for (const d of days) {
		const readings = costs.map((minutes) => risk(atSwitchCost(d, minutes), DEFAULT_ENERGY_PARAMS));

		for (let i = 1; i < readings.length; i++) {
			const change = readings[i] - readings[i - 1];

			steps++;

			if (change < 0) {
				decreases++;
				worstFall = Math.max(worstFall, -change);

				continue;
			}

			if (change <= 0) continue;

			increases++;

			if (change <= worstRise) continue;

			worstRise = change;
			rose = `${dump(atSwitchCost(d, costs[i]))}: ${readings[i - 1]}% → ${readings[i]}%`;
		}
	}

	console.log(
		`switch-cost walk ${label}: ${days.length} days × ${costs.length - 1} steps = ${steps}, DECREASED at ${decreases}, INCREASED at ${increases}, worst fall ${worstFall} points, worst rise ${worstRise} points [${rose}]`,
	);
}

const DAYS = randomDays(600, 42);

describe('burnout risk', () => {
	it('measures the ceiling and the plateau (MATH.md §11.6)', () => {
		for (const set of PARAM_SETS) ceiling(set.label, set.params, DAYS);

		console.log(
			`curated mixed-bind fixture, defaults, budget 0.25–16h: max ${Math.max(
				...Array.from(
					{
						length: 64,
					},
					(_, index) => risk(day(MIXED_BIND, (index + 1) * 0.25, 15), DEFAULT_ENERGY_PARAMS),
				),
			)}%`,
		);
	});

	it('measures budget monotonicity and the resolution ladder (MATH.md §11.6)', () => {
		budgetMonotonicity('600 seeded random days', DAYS);

		for (const switchCost of [5, 15, 30])
			budgetMonotonicity(
				`curated mixed-bind fixture, s = ${switchCost}m`,
				[MIXED_BIND, MIXED_BIND.slice(0, 2), MIXED_BIND.slice(0, 3)].map((tasks) =>
					day(tasks, 0.25, switchCost),
				),
			);

		console.log(
			`resolution ladder, demand-0.9 single cognitive task at defaults, 1/2/4/6/8h = ${[
				1, 2, 4, 6, 8,
			]
				.map((h) => risk(pure(9, h), DEFAULT_ENERGY_PARAMS))
				.join('/')}%`,
		);
	});

	it('measures the switch-cost walk (MATH.md §11.6)', () => {
		switchCostWalk('600 seeded random days, s = 0–60m step 5m', DAYS);
	});
});
