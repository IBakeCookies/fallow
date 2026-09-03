/**
 * What the advice card's "% plan value" agrees with, and what it does not.
 *
 * The card prices every lever in Σ vᵢ·P̄ᵢ — a sum of per-task AVERAGE
 * productivities (MATH.md §0). A reader who takes "value" to mean the amount of
 * work the day does is reading a different quantity: Σ vᵢ·P̄ᵢ·tᵢ, which the
 * objective deliberately does not maximize. This sweep measures how far apart
 * the two run on days the app really produces, so the card's own sentence about
 * what its percentages are can rest on a number rather than on an intuition.
 *
 * Three arms, all read off the shipped `plan-advice.ts` and the shipped
 * allocator:
 *
 *   1. every defer lever the card can offer — how often Δ plan value and
 *      Δ output disagree in SIGN, and by how much;
 *   2. one more funded task — the breadth effect, which is why a defer removes
 *      a whole term rather than a share of the work;
 *   3. the switch-cost bracket's two arms against the output they move.
 *
 * The 365 days come from the committed generator (`scripts/generate-fixture.mjs`,
 * seed 42), regenerated into a temporary file rather than read from a
 * checked-in JSON: the generator is deterministic, so the days are reproducible
 * without a 300 kB artifact in the tree.
 *
 * A probe, not a test, and it asserts nothing: the identity both readings rest
 * on — that Σ vᵢ·P̄ᵢ over the funded tasks IS `zenithGain.optimized` — is
 * already measured to ulps over 600 days by `adv1-plan-advice-frontier.probe.ts`,
 * and a second, weaker copy of it here would be a mirror (AGENTS.md R3).
 *
 * Measured 2026-09-03, 284 priceable days of the fixture year:
 *
 *   1. 851 defer levers. 812 (95.4%) cost plan value; 696 (81.8%) cost plan
 *      value while output RISES. Over all levers, Δ plan value median −7.6%
 *      (p10 −21.3%, p90 −1.7%) against Δ output median +26.9% (p10 −1.7%,
 *      p90 +51.0%); over the 696 disagreeing ones alone, −8.3% against +31.2%.
 *   2. One more task, by shape. Light 2/1/5 seats on 284 of 284, middling 5/4/5
 *      on 278, heavy 8/7/2 on 180 — and wherever it seats, plan value rises on
 *      ALL of them, by a median +16.1% / +8.1% / +4.7% while output moves
 *      −14.4% / −20.5% / −24.8%. Plan value up while output down on 76.1% /
 *      76.6% / 99.4% of the days that seat it.
 *   3. The bracket. At s = 0, Δ plan value median +11.6% against Δ output
 *      +48.2%; at 2s, −13.3% against −14.9%. Per day, |Δoutput| / |Δplan value|
 *      has a median of 4.26× (p90 5.87×) on the free arm and 2.73× (p90 4.34×)
 *      on the doubled one.
 *
 * Usage: npm run probe
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import {
	calculateDailyMetrics,
	type DailyMetrics,
	type DailyMetricsInput,
} from '$lib/business/model/metric/daily-metrics';
import { suggestPlanAdjustments } from '$lib/business/model/metric/plan-advice';
import { isPinned } from '$lib/business/model/metric/calculation';
import {
	DEFAULT_USER_CONSTANTS,
	importanceWeightOf,
	type CapacityPools,
} from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
import type { Task } from '$lib/data/type';

interface FixtureDay {
	date: string;
	tasks: Task[];
	budget: number;
	switchCost: number;
	pools: CapacityPools;
}

function fixtureDays(): FixtureDay[] {
	const out = join(mkdtempSync(join(tmpdir(), 'adv4-')), 'fixture.json');

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

const inputFor = (day: FixtureDay, tasks: Task[] = day.tasks): DailyMetricsInput => ({
	tasks,
	availableHours: day.budget,
	switchCost: day.switchCost,
	pools: day.pools,
	constants: DEFAULT_USER_CONSTANTS,
	energyParams: DEFAULT_ENERGY_PARAMS,
});

/** Σ vᵢ·P̄ᵢ — what the card calls plan value, and what the allocator maximizes. */
const planValueOf = (metrics: DailyMetrics) => metrics.zenithGain.optimized;

/** Σ vᵢ·P̄ᵢ·tᵢ — the work the same plan does, which the objective does not maximize. */
const outputOf = (metrics: DailyMetrics) =>
	metrics.suggestedTasks.reduce(
		(sum, task) =>
			sum + importanceWeightOf(task.importance) * task.avgProductivity * task.suggestedHours,
		0,
	);

const relative = (after: number, before: number) => (before > 0 ? (after - before) / before : NaN);

const quantile = (values: number[], q: number) => {
	const sorted = [...values].sort((a, b) => a - b);

	return sorted.length === 0
		? 0
		: sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

const share = (count: number, total: number) =>
	`${count} of ${total} (${((100 * count) / Math.max(1, total)).toFixed(1)}%)`;

/** A day the allocator has something to say about: real hours, more than one task. */
const isPriceable = (day: FixtureDay) => day.budget > 0 && day.tasks.length > 1;

describe('plan value against the work the same plan does', () => {
	const days = fixtureDays().filter(isPriceable);

	it('prices every defer the card can offer, both ways', () => {
		const rows: { plan: number; output: number }[] = [];
		let daysWithLever = 0;

		for (const day of days) {
			const base = calculateDailyMetrics(inputFor(day));
			const levers = base.activeTasks.filter((task) => !isPinned(task));

			if (levers.length > 0) daysWithLever++;

			for (const lever of levers) {
				const after = calculateDailyMetrics(
					inputFor(
						day,
						day.tasks.filter((task) => task.id !== lever.id),
					),
				);

				const plan = relative(planValueOf(after), planValueOf(base));
				const output = relative(outputOf(after), outputOf(base));

				if (Number.isFinite(plan) && Number.isFinite(output))
					rows.push({
						plan,
						output,
					});
			}
		}

		const disagree = rows.filter((row) => row.plan < 0 && row.output > 0);
		const costsPlanValue = rows.filter((row) => row.plan < 0);

		console.log('\n=== 1. defer levers ===');
		console.log(`days ${days.length}, days with a lever ${daysWithLever}, levers ${rows.length}`);
		console.log(`  costs plan value:           ${share(costsPlanValue.length, rows.length)}`);
		console.log(`  ... while output RISES:     ${share(disagree.length, rows.length)}`);

		console.log(
			`  Δ plan value  median ${pct(
				quantile(
					rows.map((r) => r.plan),
					0.5,
				),
			)}` +
				`  p10 ${pct(
					quantile(
						rows.map((r) => r.plan),
						0.1,
					),
				)}` +
				`  p90 ${pct(
					quantile(
						rows.map((r) => r.plan),
						0.9,
					),
				)}`,
		);

		console.log(
			`  Δ output      median ${pct(
				quantile(
					rows.map((r) => r.output),
					0.5,
				),
			)}` +
				`  p10 ${pct(
					quantile(
						rows.map((r) => r.output),
						0.1,
					),
				)}` +
				`  p90 ${pct(
					quantile(
						rows.map((r) => r.output),
						0.9,
					),
				)}`,
		);

		console.log(
			`  on the disagreeing levers: Δ plan value median ${pct(
				quantile(
					disagree.map((r) => r.plan),
					0.5,
				),
			)}` +
				`, Δ output median ${pct(
					quantile(
						disagree.map((r) => r.output),
						0.5,
					),
				)}`,
		);
	});

	// Why a defer reads the way it does: each funded task contributes its own
	// average, so the sum counts how many tasks the plan seats and not only how
	// well it seats them. P̄(0) = 0, so an unfunded task contributes nothing.
	//
	// Three shapes and not one: a single hand-picked task makes the arm a property
	// of that task, and the light one is the case most likely to seat on every day.
	it('measures what one more funded task is worth to each reading', () => {
		const SHAPES = [
			{
				label: 'light  2/1/5',
				mental: 2,
				physical: 1,
				enjoyment: 5,
			},
			{
				label: 'middling 5/4/5',
				mental: 5,
				physical: 4,
				enjoyment: 5,
			},
			{
				label: 'heavy  8/7/2',
				mental: 8,
				physical: 7,
				enjoyment: 2,
			},
		];

		console.log('\n=== 2. one more task on the list ===');

		for (const shape of SHAPES) {
			const rows: { plan: number; output: number; seated: boolean }[] = [];

			for (const day of days) {
				const base = calculateDailyMetrics(inputFor(day));

				const extra: Task = {
					id: Math.max(...day.tasks.map((task) => task.id)) + 1,
					title: 'one more',
					mentalDifficulty: shape.mental,
					physicalDifficulty: shape.physical,
					enjoyment: shape.enjoyment,
					createdAt: day.date,
					completed: false,
				};

				const after = calculateDailyMetrics(inputFor(day, [...day.tasks, extra]));

				const seated =
					(after.suggestedTasks.find((task) => task.id === extra.id)?.suggestedHours ?? 0) > 0;

				const plan = relative(planValueOf(after), planValueOf(base));
				const output = relative(outputOf(after), outputOf(base));

				if (Number.isFinite(plan) && Number.isFinite(output))
					rows.push({
						plan,
						output,
						seated,
					});
			}

			const seated = rows.filter((row) => row.seated);
			const rises = seated.filter((row) => row.plan > 0);
			const bought = seated.filter((row) => row.plan > 0 && row.output < 0);

			console.log(
				`  ${shape.label.padEnd(16)} seated ${share(seated.length, rows.length).padEnd(22)}` +
					` plan value rises ${share(rises.length, seated.length).padEnd(22)}` +
					` \u0394 plan value median ${pct(
						quantile(
							seated.map((r) => r.plan),
							0.5,
						),
					).padStart(6)}` +
					`  \u0394 output median ${pct(
						quantile(
							seated.map((r) => r.output),
							0.5,
						),
					).padStart(7)}` +
					`  up while output down ${share(bought.length, seated.length)}`,
			);
		}
	});

	// The two extra solves the card already runs, read a second way. The bracket
	// is the one place the card prices a whole block of the budget, so it is
	// where averaging costs the reading the most.
	it('reads the switch-cost bracket against the output it moves', () => {
		const free: { plan: number; output: number }[] = [];
		const doubled: { plan: number; output: number }[] = [];

		for (const day of days) {
			if (day.switchCost <= 0) continue;

			const base = calculateDailyMetrics(inputFor(day));
			const advice = suggestPlanAdjustments(inputFor(day), base);

			for (const alternative of advice.switchCostPrice.alternatives) {
				const after = calculateDailyMetrics({
					...inputFor(day),
					switchCost: alternative.switchCost,
				});

				const row = {
					plan: relative(planValueOf(after), planValueOf(base)),
					output: relative(outputOf(after), outputOf(base)),
				};

				if (!Number.isFinite(row.plan) || !Number.isFinite(row.output)) continue;

				(alternative.switchCost < day.switchCost ? free : doubled).push(row);
			}
		}

		const report = (label: string, rows: { plan: number; output: number }[]) => {
			const ratios = rows
				.filter((row) => Math.abs(row.plan) > 1e-9)
				.map((row) => Math.abs(row.output) / Math.abs(row.plan));

			console.log(
				`  ${label.padEnd(10)} n=${String(rows.length).padStart(3)}` +
					`  Δ plan value median ${pct(
						quantile(
							rows.map((r) => r.plan),
							0.5,
						),
					)}` +
					`  Δ output median ${pct(
						quantile(
							rows.map((r) => r.output),
							0.5,
						),
					)}` +
					`  |output/plan| median ${quantile(ratios, 0.5).toFixed(2)}×` +
					`  p90 ${quantile(ratios, 0.9).toFixed(2)}×`,
			);
		};

		console.log('\n=== 3. the switch-cost bracket ===');
		report('s = 0', free);
		report('s doubled', doubled);
	});
});
