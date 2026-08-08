/**
 * The measurements behind MATH.md §33, the causal fit window (added 2026-08-08).
 *
 * §33's central claim is about MAGNITUDE, not sign: that a single ⚡ log against
 * a thin history re-times EVERY task on the page, by enough that a user watching
 * their own plan reshuffle mid-day reads it as a bug. The section quotes these:
 *
 *   - one log's effect on an UNLOGGED task's ϕ, over n = 1…8 logs
 *   - how much of the total move the FIRST log accounts for
 *   - that the effect is global: c₁, c₂, c₃ are shared, so a log on one task
 *     moves every other task's ϕ, including tasks with no logs at all
 *   - what the same log does one day later (recency is not the mechanism —
 *     §5.2's half-life is 365 days, so a one-day deferral changes nothing about
 *     the size of the jump, only about WHEN the user meets it)
 *
 * A probe, not a test: every number moves with the ridge prior and the default
 * constants. The suite pins the invariant — that a plan for day D reads only
 * logs dated before D — in `session-store.svelte.spec.ts`.
 *
 * Reported in minutes, because that is what the task row prints.
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_USER_CONSTANTS,
	PHI_RECENCY_HALF_LIFE_DAYS,
	calculateFlowStateTime,
	fitUserConstants,
	mapEffort,
	mapEnjoyability,
	type FlowObservation,
} from '$lib/business/model/zenith';

const minutes = (hours: number) => hours * 60;

/** A task the user never logs — the one whose ϕ moving is the surprise. */
const BYSTANDER = {
	difficulty: 4,
	enjoyment: 3,
};

/** The task being logged, distinct from the bystander so nothing is shared but
 *  the constants themselves. */
const LOGGED = {
	difficulty: 5,
	enjoyment: 2,
};

const phiOf = (
	task: {
		difficulty: number;
		enjoyment: number;
	},
	constants: typeof DEFAULT_USER_CONSTANTS,
) =>
	minutes(
		calculateFlowStateTime(mapEffort(task.difficulty), mapEnjoyability(task.enjoyment), constants),
	);

/** `n` logs on LOGGED, each measuring `measuredHours`, all dated `ageDays` old. */
const history = (n: number, measuredHours: number, ageDays = 1): FlowObservation[] =>
	Array.from(
		{
			length: n,
		},
		() => ({
			E: mapEffort(LOGGED.difficulty),
			beta: mapEnjoyability(LOGGED.enjoyment),
			phi: measuredHours,
			ageDays,
		}),
	);

describe('§33 — what one ⚡ log does to a plan', () => {
	it('re-times a task the user never logged, most of it on the first log', () => {
		const base = phiOf(BYSTANDER, DEFAULT_USER_CONSTANTS);
		// The user's own case: the model predicted ~2h20m and they reached flow in 1h.
		const measured = 1;
		const rows: string[] = [];
		let first = 0;
		let last = 0;

		for (const n of [1, 2, 3, 4, 5, 6, 8]) {
			const fit = fitUserConstants(history(n, measured));
			const phi = phiOf(BYSTANDER, fit.constants);
			const movePct = ((phi - base) / base) * 100;

			if (n === 1) first = phi;

			last = phi;

			rows.push(
				`  n=${n}  ϕ(bystander) = ${phi.toFixed(1)} min  (${movePct.toFixed(1)}% vs ${base.toFixed(1)} default)  Σw=${fit.effectiveCount.toFixed(2)}`,
			);
		}

		const firstShare = ((base - first) / (base - last)) * 100;

		console.log(
			[
				'',
				'A bystander task (difficulty 4, enjoyment 3) that is NEVER logged,',
				`re-timed by logs on a DIFFERENT task (difficulty ${LOGGED.difficulty}, enjoyment ${LOGGED.enjoyment}, measured ${measured}h):`,
				'',
				...rows,
				'',
				`  the FIRST log alone accounts for ${firstShare.toFixed(0)}% of the whole 8-log move`,
				'',
			].join('\n'),
		);

		// The claim under test is that the move is large, not that it is any
		// particular size — a loose floor so the probe fails only if the effect
		// stops being the thing §33 is about.
		expect(Math.abs((first - base) / base)).toBeGreaterThan(0.1);
		expect(firstShare).toBeGreaterThan(50);
	});

	it('is not a recency effect: deferring the log one day changes nothing', () => {
		const measured = 1;
		const sameDay = phiOf(BYSTANDER, fitUserConstants(history(1, measured, 0)).constants);
		const nextDay = phiOf(BYSTANDER, fitUserConstants(history(1, measured, 1)).constants);
		const base = phiOf(BYSTANDER, DEFAULT_USER_CONSTANTS);

		console.log(
			[
				'',
				`Deferring one log by a day (§5.2 half-life = ${PHI_RECENCY_HALF_LIFE_DAYS}d):`,
				`  age 0d: ϕ = ${sameDay.toFixed(2)} min`,
				`  age 1d: ϕ = ${nextDay.toFixed(2)} min`,
				`  difference: ${Math.abs(nextDay - sameDay).toFixed(3)} min, against a ${Math.abs(sameDay - base).toFixed(1)} min jump`,
				'',
				'  → the causal window changes WHEN the user meets the jump, not its size.',
				'',
			].join('\n'),
		);

		// Under a 365-day half-life a one-day deferral is noise beside the jump.
		expect(Math.abs(nextDay - sameDay)).toBeLessThan(Math.abs(sameDay - base) / 100);
	});

	it('moves every task, so the whole list re-times together', () => {
		const fit = fitUserConstants(history(1, 1));

		const tasks = [
			{
				difficulty: 1,
				enjoyment: 5,
			},
			{
				difficulty: 3,
				enjoyment: 3,
			},
			{
				difficulty: 5,
				enjoyment: 1,
			},
		];

		const rows = tasks.map((t) => {
			const before = phiOf(t, DEFAULT_USER_CONSTANTS);
			const after = phiOf(t, fit.constants);

			return {
				t,
				before,
				after,
				pct: ((after - before) / before) * 100,
			};
		});

		console.log(
			[
				'',
				'One log, three unlogged tasks:',
				...rows.map(
					(r) =>
						`  difficulty ${r.t.difficulty}, enjoyment ${r.t.enjoyment}:  ${r.before.toFixed(1)} → ${r.after.toFixed(1)} min  (${r.pct.toFixed(1)}%)`,
				),
				'',
			].join('\n'),
		);

		// Not one task: all of them, in the same direction.
		expect(rows.every((r) => r.pct < 0)).toBe(true);
	});
});
