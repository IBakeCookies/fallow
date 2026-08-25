/**
 * The measurement behind MATH.md §8.4's one hard design constraint:
 *
 *   "Satiety must key on a **monotone** per-task accumulator. The session
 *    phase `s` decays over gaps (`s·e^(−g/τ)`, §8.2), so anything keyed to it
 *    could be laundered away by taking breaks — and the re-run-the-winner
 *    exploit would return."
 *
 * and its companion claim that the shipped form "introduces no new
 * break-then-resume gaming incentive."
 *
 * This is the only claim in the repo whose failure mode is an EXPLOIT rather
 * than a stale number, and it had zero tests. The four tests in the satiety
 * block cover the opt-out, dynamics-unchanged, one contiguous concavity
 * fixture, and a funds-3-tasks comparison — not one of them inserts a break.
 *
 * A probe, not a test. Arm A is a property that should hold exactly and
 * forever; arm B prints plan shapes and a price that move with the optimizer.
 *
 * ARM A — the rule holds. `satiatedOutput` must be a function of the per-task
 * output TOTALS alone: same totals, same satiety, no matter how many sessions
 * they were earned across or how long the gaps between them were. Verified by
 * replicating the wrapper outside the module and reproducing the shipped
 * `satiatedOutput` from the per-block outputs alone, on random schedules with
 * random session splits. If the replica ever disagrees, satiety has picked up
 * a dependence on WHEN output arrived, which is precisely the laundering
 * channel §8.4 forbids.
 *
 * ARM B — what the rule buys, which nothing has ever measured. A rule with no
 * price tag tells a future editor nothing about what they are breaking, so
 * this enumerates every lattice plan on small days and takes the argmax under
 * three accumulators built from the SAME per-block outputs:
 *
 *   - `cumulative` (shipped): O only ever grows. Telescopes to V(total).
 *   - `session`:    O resets to 0 at the start of every new session on a task.
 *   - `decay`:      O ← O·e^(−gap/τ) across gaps — the phase-keyed form §8.4
 *                   names, using §8.2's own decay constant.
 *
 * All three are written incrementally (each block's output valued at the
 * margin V′ reached so far) so they coincide exactly when every task is worked
 * in one session — the mutants differ ONLY in what a break does. What the arm
 * prints is how fragmented each objective's favourite plan is, and what the
 * mutants' plans are worth under the true objective: the size of the exploit
 * the constraint exists to prevent.
 *
 * κ = satietyScale·refOutput is recovered numerically rather than imported —
 * `buildCurves`, `satietyValue` and `TaskCurve.refOutput` are all module-
 * private. Solving S = κ·ln(1 + O/κ) for κ off a single-block evaluation gives
 * it exactly, and arm A's agreement is what proves the recovery correct.
 *
 * WHAT THE 2026-08-25 RE-RUN CHANGED, and why arm B's numbers below all moved.
 * Every task now comes from integer sliders through `toEnergyTask`, so the day
 * is on the app's own constraint surface. It was not: `difficulty` was set to
 * `max(mental, physical)` directly, skipping the 0.3 spillover the app applies,
 * so no day this probe generated was one a user could have declared and no arm
 * B figure was quotable in either direction (ROADMAP M40, the last of five
 * generators). Arm A is an identity and survives untouched, which is the point
 * of keeping the two arms apart.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	DEFAULT_ENERGY_PARAMS,
	DEFAULT_STEP_HOURS,
	evaluateSchedule,
	type EnergyTaskInput,
	type EvaluatedBlock,
	type ScheduleBlock,
} from '$lib/business/model/zenith-energy';
import { toEnergyTask } from '$lib/business/model/metric/calculation';
import type { Task } from '$lib/data/type';

function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const PARAMS = DEFAULT_ENERGY_PARAMS;
/** Agreement tighter than this is exact for our purposes; Simpson noise lives well below it. */
const REPLICA_TOLERANCE = 1e-9;

type Accumulator = 'cumulative' | 'session' | 'decay';

const ACCUMULATORS: Accumulator[] = ['cumulative', 'session', 'decay'];

/**
 * Recover κ = satietyScale·refOutput for one task by inverting the wrapper on
 * a single-block evaluation: S = κ·ln(1 + O/κ) is strictly increasing in κ and
 * tends to O, so a bisection on κ is unambiguous.
 */
function recoverKappa(task: EnergyTaskInput): number {
	const probeBlocks: ScheduleBlock[] = [
		{
			taskId: task.id,
			hours: 2,
		},
	];

	const evaluation = evaluateSchedule(probeBlocks, [task], 8, PARAMS);
	const rawOutput = evaluation.totalOutput;
	const satiated = evaluation.satiatedOutput;

	if (rawOutput <= 0 || satiated >= rawOutput) return Infinity;

	let lo = 1e-9;
	let hi = 1e6;

	for (let i = 0; i < 200; i++) {
		const mid = (lo + hi) / 2;

		if (mid * Math.log(1 + rawOutput / mid) < satiated) lo = mid;
		else hi = mid;
	}

	return (lo + hi) / 2;
}

function satietyValue(rawOutput: number, kappa: number): number {
	if (!Number.isFinite(kappa)) return rawOutput;

	return kappa * Math.log(1 + rawOutput / kappa);
}

interface AccumulatorState {
	/** Value of the accumulator the next block's output is charged against. */
	level: number;
	/** Clock time the task's previous block ended, for the decay variant. */
	endedAt: number;
}

/**
 * Score one evaluated schedule under one accumulator rule. Written
 * incrementally — every block's output is worth V(level + out) − V(level) at
 * the margin already reached — so `cumulative` telescopes to V(total) and
 * reproduces the shipped number exactly, while the mutants differ only in what
 * they do to `level` when a gap intervenes.
 */
function accumulate(
	blocks: EvaluatedBlock[],
	kappas: Map<number, number>,
	rule: Accumulator,
): number {
	const state = new Map<number, AccumulatorState>();
	let value = 0;

	for (const block of blocks) {
		if (block.taskId === null) continue;

		const kappa = kappas.get(block.taskId)!;
		const previous = state.get(block.taskId);
		let level = previous?.level ?? 0;

		if (previous && block.start > previous.endedAt + 1e-12) {
			const gap = block.start - previous.endedAt;

			if (rule === 'session') level = 0;

			if (rule === 'decay') level *= Math.exp(-gap / PARAMS.resumptionTimeConstant);
		}

		value += satietyValue(level + block.output, kappa) - satietyValue(level, kappa);

		state.set(block.taskId, {
			level: level + block.output,
			endedAt: block.start + block.hours,
		});
	}

	return value;
}

function drawTask(random: () => number, id: number): EnergyTaskInput {
	const slider = (min: number) => min + Math.floor(random() * (11 - min));

	const task: Task = {
		id,
		title: `t${id}`,
		mentalDifficulty: slider(0),
		physicalDifficulty: slider(0),
		enjoyment: slider(1),
		createdAt: '2026-08-25',
		completed: false,
	};

	return toEnergyTask(task);
}

/** Sessions a task was worked in, and the largest share of work any one task took. */
function planShape(blocks: EvaluatedBlock[]): { sessions: number; topShare: number } {
	const hoursByTask = new Map<number, number>();
	let sessions = 0;
	let previousTask: number | null = null;
	let worked = 0;

	for (const block of blocks) {
		if (block.taskId !== null) {
			if (block.taskId !== previousTask) sessions++;

			hoursByTask.set(block.taskId, (hoursByTask.get(block.taskId) ?? 0) + block.hours);
			worked += block.hours;
		}

		previousTask = block.taskId;
	}

	const top = Math.max(0, ...hoursByTask.values());

	return {
		sessions,
		topShare: worked > 0 ? top / worked : 0,
	};
}

/**
 * Every plan on the lattice: each slot is rest or one of the tasks. Exhaustive
 * rather than optimized, because arm B compares ARGMAXES — a search whose
 * moves were tuned against the shipped objective would bias the comparison
 * toward it.
 */
function* everyPlan(taskIds: number[], slots: number): Generator<ScheduleBlock[]> {
	const choices = [null, ...taskIds];
	const total = choices.length ** slots;

	for (let code = 0; code < total; code++) {
		const blocks: ScheduleBlock[] = [];
		let rest = code;

		for (let slot = 0; slot < slots; slot++) {
			blocks.push({
				taskId: choices[rest % choices.length],
				hours: DEFAULT_STEP_HOURS,
			});

			rest = Math.floor(rest / choices.length);
		}

		yield blocks;
	}
}

describe('MATH.md §8.4 — satiety keys on a monotone accumulator', () => {
	it('arm A: breaks cannot launder satiety away', () => {
		const random = mulberry32(0x5a1e01);
		let checked = 0;
		let worstDisagreement = 0;
		let splitSchedules = 0;

		for (let day = 0; day < 300; day++) {
			const tasks = Array.from(
				{
					length: 1 + Math.floor(random() * 3),
				},
				(_, i) => drawTask(random, i + 1),
			);

			const kappas = new Map(tasks.map((task) => [task.id, recoverKappa(task)]));
			const windowHours = 12;
			const slots = 12;

			const blocks: ScheduleBlock[] = Array.from(
				{
					length: slots,
				},
				() => {
					const pick = Math.floor(random() * (tasks.length + 1));

					return {
						taskId: pick === 0 ? null : tasks[pick - 1].id,
						hours: 1,
					};
				},
			);

			const evaluation = evaluateSchedule(blocks, tasks, windowHours, PARAMS);
			const replica = accumulate(evaluation.blocks, kappas, 'cumulative');
			const disagreement = Math.abs(replica - evaluation.satiatedOutput);
			// Only schedules where some task really was split across a gap can
			// witness laundering at all.
			const shape = planShape(evaluation.blocks);

			if (shape.sessions > new Set(evaluation.blocks.map((b) => b.taskId)).size - 1)
				splitSchedules++;

			checked++;
			worstDisagreement = Math.max(worstDisagreement, disagreement);
		}

		console.log(
			`[§8.4 arm A] ${checked} random schedules (1–3 tasks, 12 × 1h slots incl. rest), ` +
				`${splitSchedules} of them split a task across a gap`,
		);

		console.log(
			`[§8.4 arm A] worst |replica − shipped satiatedOutput| = ${worstDisagreement.toExponential(3)} ` +
				`(exact below ${REPLICA_TOLERANCE.toExponential(0)}: ${worstDisagreement < REPLICA_TOLERANCE})`,
		);

		console.log(
			'[§8.4 arm A] the replica reads ONLY per-task output totals, so agreement means ' +
				'satiety cannot see session count or gap length',
		);
	});

	it('arm B: what a laundering accumulator would cost', () => {
		const random = mulberry32(0x5a1e02);
		const windowHours = 6;
		const slots = Math.round(windowHours / DEFAULT_STEP_HOURS);
		const days = 24;

		const stats = new Map(
			ACCUMULATORS.map((rule) => [
				rule,
				{
					sessions: 0,
					topShare: 0,
					trueValue: 0,
					trueObjective: 0,
					workHours: 0,
				},
			]),
		);

		for (let day = 0; day < days; day++) {
			const tasks = [drawTask(random, 1), drawTask(random, 2)];
			const kappas = new Map(tasks.map((task) => [task.id, recoverKappa(task)]));

			const best = new Map(
				ACCUMULATORS.map((rule) => [
					rule,
					{
						score: -Infinity,
						plan: [] as EvaluatedBlock[],
					},
				]),
			);

			// Extracted so the enumeration stays inside `max-depth` — `scripts/**`
			// gets no exemption from that rule.
			const keepIfBetter = (rule: Accumulator, score: number, plan: EvaluatedBlock[]): void => {
				const current = best.get(rule)!;

				if (score <= current.score) return;

				current.score = score;
				current.plan = plan;
			};

			for (const plan of everyPlan(
				tasks.map((t) => t.id),
				slots,
			)) {
				const evaluation = evaluateSchedule(plan, tasks, windowHours, PARAMS);
				const bonuses = evaluation.freeTimeBonus + evaluation.terminalBonus;

				for (const rule of ACCUMULATORS)
					keepIfBetter(
						rule,
						accumulate(evaluation.blocks, kappas, rule) + bonuses,
						evaluation.blocks,
					);
			}

			for (const rule of ACCUMULATORS) {
				const winner = best.get(rule)!.plan;
				const shape = planShape(winner);
				const tally = stats.get(rule)!;

				tally.sessions += shape.sessions;
				tally.topShare += shape.topShare;
				// Every plan re-scored under the SHIPPED rule: what the mutant's
				// favourite plan is actually worth. Two scales, because MATH.md §8.4
				// quoted the first one as "the true objective" and it is not — the
				// optimizer maximizes satiatedOutput PLUS the leisure and terminal
				// terms, and the two scales price the mutants differently. They
				// reversed which mutant was worse on the off-surface population; on
				// the sliders they agree and only the size of the gap changes.
				tally.trueValue += accumulate(winner, kappas, 'cumulative');

				const rescored = evaluateSchedule(winner, tasks, windowHours, PARAMS);

				tally.trueObjective +=
					accumulate(winner, kappas, 'cumulative') +
					rescored.freeTimeBonus +
					rescored.terminalBonus;

				tally.workHours += winner
					.filter((b) => b.taskId !== null)
					.reduce((sum, b) => sum + b.hours, 0);
			}
		}

		const shippedValue = stats.get('cumulative')!.trueValue;
		const shippedObjective = stats.get('cumulative')!.trueObjective;

		console.log(
			`[§8.4 arm B] ${days} days × 2 tasks, every one of ${3 ** slots} lattice plans ` +
				`(${windowHours}h window, ${DEFAULT_STEP_HOURS}h step) enumerated per day`,
		);

		for (const rule of ACCUMULATORS) {
			const tally = stats.get(rule)!;
			const lost = ((shippedValue - tally.trueValue) / shippedValue) * 100;
			const lostObjective = ((shippedObjective - tally.trueObjective) / shippedObjective) * 100;

			console.log(
				`[§8.4 arm B] ${rule.padEnd(10)} argmax: ${(tally.sessions / days).toFixed(2)} sessions/day, ` +
					`top task takes ${((tally.topShare / days) * 100).toFixed(1)}% of worked hours, ` +
					`${(tally.workHours / days).toFixed(2)}h worked, ` +
					`worth ${lost >= 0 ? '−' : '+'}${Math.abs(lost).toFixed(3)}% of the satiety term Σ V(O), ` +
					`${lostObjective >= 0 ? '−' : '+'}${Math.abs(lostObjective).toFixed(3)}% of the full objective`,
			);
		}
	});
});
