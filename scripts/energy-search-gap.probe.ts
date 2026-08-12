/**
 * Measurement behind MATH.md §8.6's claim that the compound moves made the
 * multi-seed steepest-ascent search reliable — no stranded ~1% of objective and
 * no wrong plan STRUCTURE (a funded task dropped, or an unfunded one bought).
 * §8.6's evidence is two hand-built witnesses and one legacy objective pair; the
 * residual optimality gap over an input space was never measured, and the worse
 * failure mode it names — the wrong funded set — was never measured at all.
 *
 * A probe, not a test: it answers "what is true of the model over a large input
 * space" and prints numbers, where a test answers "does this still hold" and is
 * binary. The gap below legitimately moves whenever a move, a seed, the step
 * lattice or the objective changes, which is why this runs on demand
 * (`npm run probe`) and never in `npm test` — in the suite it would go red on
 * every honest model change while its real signal, the size of the number, is
 * not a regression at all.
 *
 * Both tiers score `optimizeSchedule` against a reference optimum on the SAME
 * DEFAULT_STEP_HOURS lattice, so nothing here measures quantization (§8.8) —
 * only search slack:
 *
 * - ENUMERATED: small enough to enumerate every lattice plan (each 45-min slot
 *   independently assigned to a task or rest), so the reference IS the optimum
 *   and a shortfall is a proven search defect. This tier is what can falsify
 *   §8.6.
 * - APPROX: a long random-restart hill climb, labelled APPROX because it is a
 *   LOWER bound on the true optimum — a 0 there is evidence, not proof, and a
 *   negative gap just means the product search beat the reference.
 *
 * The ENUMERATED tier's worst day then gets a REST-SPLIT AUDIT, because §8.6
 * explains that day in prose: it replays the shipped split-around-rest move on
 * the plan the search returned and says whether the move is generated, and if so
 * whether it improves — so "the search cannot reach that break" is output, not a
 * story.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports (docs/testing.md).
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	DEFAULT_STEP_HOURS,
	evaluateSchedule,
	optimizeSchedule,
	type EnergyTaskInput,
	type ScheduleBlock,
} from '$lib/business/model/zenith-energy';

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

interface Day {
	tasks: EnergyTaskInput[];
	windowHours: number;
}

const task = (
	id: number,
	difficulty: number,
	enjoyment: number,
	cognitiveDemand: number,
	physicalDemand: number,
): EnergyTaskInput => ({
	id,
	title: `t${id}`,
	difficulty,
	enjoyment,
	cognitiveDemand,
	physicalDemand,
});

/**
 * The day §8.6 was written on: pre-fix the search dropped `reading` entirely and
 * lost to a hand-built plan. Kept by value, swept across every window whose
 * lattice is still enumerable, because the sweep and the fixture answer
 * different questions — the sweep asks how common a gap is, the fixture asks
 * whether the one day known to break the search is now provably solved.
 */
const PROBE_DAY: EnergyTaskInput[] = [
	task(1, 10, 10, 0.2, 1.0),
	task(2, 6, 9, 0.4, 0.3),
	task(3, 4, 7, 0.5, 0.05),
];

function randomDays(
	count: number,
	seed: number,
	tasks: [number, number],
	window: [number, number],
): Day[] {
	const random = mulberry32(seed);

	const pick = (min: number, max: number, step: number) =>
		min + Math.round((random() * (max - min)) / step) * step;

	return Array.from(
		{
			length: count,
		},
		() => ({
			tasks: Array.from(
				{
					length: pick(tasks[0], tasks[1], 1),
				},
				(_, index) =>
					task(index + 1, pick(1, 10, 1), pick(1, 10, 1), pick(0, 1, 0.1), pick(0, 1, 0.1)),
			),
			windowHours: pick(window[0], window[1], 0.25),
		}),
	);
}

/** Slots are the lattice: index 0 is rest, index i+1 is `tasks[i]`. */
const slotCount = (day: Day) => Math.floor(day.windowHours / DEFAULT_STEP_HOURS + 1e-9);

const blocksOf = (day: Day, slots: number[]): ScheduleBlock[] =>
	slots.map((label) => ({
		taskId: label === 0 ? null : day.tasks[label - 1].id,
		hours: DEFAULT_STEP_HOURS,
	}));

const objectiveOf = (day: Day, blocks: ScheduleBlock[]) =>
	evaluateSchedule(blocks, day.tasks, day.windowHours).objective;

const fundedSet = (blocks: ScheduleBlock[]) =>
	[...new Set(blocks.filter((b) => b.taskId !== null && b.hours > 0).map((b) => b.taskId))]
		.sort((x, y) => x! - y!)
		.join(',');

/** Every lattice plan, exhaustively: an odometer over (tasks+1)^slots. */
function enumeratedOptimum(day: Day): ScheduleBlock[] {
	const slots = slotCount(day);
	const labels = day.tasks.length + 1;
	const digits = new Array<number>(slots).fill(0);
	let best = digits.slice();
	let bestScore = -Infinity;

	for (;;) {
		const value = objectiveOf(day, blocksOf(day, digits));

		if (value > bestScore) {
			bestScore = value;
			best = digits.slice();
		}

		let i = 0;

		while (i < slots && ++digits[i] === labels) digits[i++] = 0;

		if (i === slots) break;
	}

	return blocksOf(day, best);
}

/** The steepest single-slot relabel that beats `score`, or null at a local optimum. */
function bestRelabel(day: Day, current: number[], labels: number, score: number) {
	let climbed: { slots: number[]; score: number } | null = null;
	let climbedScore = score;

	for (let slot = 0; slot < current.length; slot++) {
		for (let label = 0; label < labels; label++) {
			const candidate = current.slice();
			candidate[slot] = label;
			const value = label === current[slot] ? score : objectiveOf(day, blocksOf(day, candidate));

			if (value > climbedScore + 1e-12) {
				climbedScore = value;

				climbed = {
					slots: candidate,
					score: value,
				};
			}
		}
	}

	return climbed;
}

/**
 * Random-restart steepest ascent over single-slot relabels, from randomized
 * lattice plans. Deliberately NOT seeded with `optimizeSchedule`'s answer: a
 * reference that starts from the thing it is judging can never report a gap.
 */
function hillClimbOptimum(day: Day, restarts: number, seed: number): ScheduleBlock[] {
	const random = mulberry32(seed);
	const slots = slotCount(day);
	const labels = day.tasks.length + 1;
	let best: number[] = new Array<number>(slots).fill(0);
	let bestScore = objectiveOf(day, blocksOf(day, best));

	for (let restart = 0; restart < restarts; restart++) {
		let current = Array.from(
			{
				length: slots,
			},
			() => Math.floor(random() * labels),
		);
		let score = objectiveOf(day, blocksOf(day, current));

		for (;;) {
			const climbed = bestRelabel(day, current, labels, score);

			if (!climbed) break;

			current = climbed.slots;
			score = climbed.score;
		}

		if (score > bestScore) {
			bestScore = score;
			best = current;
		}
	}

	return blocksOf(day, best);
}

const percentile = (sorted: number[], q: number) =>
	sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];

/**
 * Shortfall is (reference − search)/reference in percent: positive means the
 * product search left objective on the table, and every quoted statistic —
 * median, p99, worst — carries that sign, so a negative worst means the search
 * beat the reference on every day. A funded-set mismatch is the
 * structural failure §8.6 calls the worse of the two — the reference funds a
 * task the search leaves at zero hours, or the search funds one the reference
 * does not — and is counted separately because a day can be within 0.01% of the
 * optimum while returning a different plan to the user.
 */
function searchGap(
	label: string,
	days: Day[],
	reference: (day: Day, index: number) => ScheduleBlock[],
): { day: Day; search: ScheduleBlock[]; reference: ScheduleBlock[] } {
	const shortfalls: number[] = [];
	let exact = 0;
	let mismatches = 0;
	let worst = -Infinity;
	let worstDump = 'none';
	let worstCase = {
		day: days[0],
		search: [] as ScheduleBlock[],
		reference: [] as ScheduleBlock[],
	};

	days.forEach((day, index) => {
		const search = optimizeSchedule(day.tasks, day.windowHours).blocks;
		const referenceBlocks = reference(day, index);
		const got = objectiveOf(day, search);
		const target = objectiveOf(day, referenceBlocks);
		const shortfall = ((target - got) / target) * 100;

		shortfalls.push(shortfall);

		if (Math.abs(target - got) <= 1e-9) exact++;

		if (fundedSet(search) !== fundedSet(referenceBlocks)) mismatches++;

		if (shortfall > worst) {
			worst = shortfall;

			worstCase = {
				day,
				search,
				reference: referenceBlocks,
			};

			worstDump = JSON.stringify({
				windowHours: day.windowHours,
				tasks: day.tasks,
				search,
				reference: referenceBlocks,
				searchObjective: got,
				referenceObjective: target,
			});
		}
	});

	const sorted = [...shortfalls].sort((x, y) => x - y);

	console.log(
		`${label}: ${days.length} days, ${exact} exact (within 1e-9), median shortfall ${percentile(sorted, 0.5).toFixed(4)}%, p99 ${percentile(sorted, 0.99).toFixed(4)}%, worst shortfall ${worst.toFixed(4)}%, funded-set mismatches ${mismatches} of ${days.length}`,
	);

	console.log(`${label} worst day: ${worstDump}`);

	return worstCase;
}

const fmt = (blocks: ScheduleBlock[]) =>
	blocks.map((b) => `${b.taskId === null ? 'rest' : `t${b.taskId}`} ${b.hours}h`).join(' + ');

/** Adjacent same-task blocks merged, trailing rest dropped — as the model reads a plan. */
const merged = (blocks: ScheduleBlock[]): ScheduleBlock[] => {
	const out: ScheduleBlock[] = [];

	for (const b of blocks) {
		const prev = out[out.length - 1];

		if (prev && prev.taskId === b.taskId) prev.hours += b.hours;
		else
			out.push({
				...b,
			});
	}

	while (out.length > 0 && out[out.length - 1].taskId === null) out.pop();

	return out;
};

/** Read off the numbers, so the sentence cannot outlive the day it describes. */
function verdictOf(generated: boolean, uphill: number): string {
	if (!generated) return 'the split-around-rest move is NOT GENERATED — see the guards above';

	if (uphill > 0)
		return 'the move is GENERATED and IMPROVING — the search left it on the table, a real hill-climb defect';

	return 'no guard blocks the move and every interior split is downhill, so the residue is a steepest-ascent limit and not a missing candidate';
}

/**
 * Why the worst enumerated day stays short: it replays the shipped
 * split-around-rest move (`neighbors` in `zenith-energy.ts`) on the plan the
 * search returned — every interior lattice split, one step handed to rest.
 * `neighbors` is module-private, so the guards are mirrored here — keep them in
 * step with it.
 */
function restSplitAudit(day: Day, search: ScheduleBlock[], reference: ScheduleBlock[]): void {
	const step = DEFAULT_STEP_HOURS;
	const block = search[0];
	const optimum = merged(reference);
	const incumbent = objectiveOf(day, search);
	const target = objectiveOf(day, optimum);

	if (target - incumbent <= 1e-9) {
		console.log('REST-SPLIT AUDIT: skipped — the worst enumerated day is exactly optimal');

		return;
	}

	if (search.length !== 1 || block.taskId === null) {
		console.log(
			`REST-SPLIT AUDIT: skipped — worst day is no longer one funded block (${fmt(search)})`,
		);

		return;
	}

	// The move's own arithmetic: one step of rest on top of unchanged worked
	// hours, so it needs a spare step of window (`room`) to land.
	const avail = Math.floor((day.windowHours - block.hours) / step + 1e-9) * step;
	const room = avail > step - 1e-9;
	const generated = block.hours >= 2 * step && room;
	const steps = Math.round(block.hours / step);
	const sweep: string[] = [];
	let uphill = 0;

	for (let k = 1; k < steps; k++) {
		const candidate = [
			{
				taskId: block.taskId,
				hours: k * step,
			},
			{
				taskId: null,
				hours: step,
			},
			{
				taskId: block.taskId,
				hours: block.hours - k * step,
			},
		];

		const value = objectiveOf(day, candidate);

		if (value > incumbent + 1e-9) uphill++;

		sweep.push(`${k * step}+${block.hours - k * step} ${value.toFixed(6)}`);
	}

	console.log(
		`REST-SPLIT AUDIT (worst enumerated day): window ${day.windowHours}h, search ${fmt(search)} = ${incumbent.toFixed(6)}, exhaustive optimum ${fmt(optimum)} = ${target.toFixed(6)}, shortfall ${(((target - incumbent) / target) * 100).toFixed(4)}%`,
	);

	console.log(
		`  split-around-rest move: ${generated ? 'GENERATED' : 'NOT GENERATED'} (funded true, >= 2*step ${block.hours >= 2 * step}, room ${room} with ${avail}h spare)`,
	);

	console.log(
		`  every interior split it offers: ${sweep.join(' | ')} — ${uphill} of ${steps - 1} beat the incumbent`,
	);

	console.log(`  VERDICT: ${verdictOf(generated, uphill)}`);
}

describe('energy search gap', () => {
	it('measures the residual optimality gap (MATH.md §8.6)', () => {
		const worst = searchGap(
			'ENUMERATED 2-3 tasks x 3-6h',
			randomDays(60, 8006, [2, 3], [3, 6]),
			enumeratedOptimum,
		);

		restSplitAudit(worst.day, worst.search, worst.reference);

		searchGap(
			'ENUMERATED §8.6 witness day x 3-8h',
			[3, 4, 5, 6, 7, 8].map((windowHours) => ({
				tasks: PROBE_DAY,
				windowHours,
			})),
			enumeratedOptimum,
		);

		searchGap(
			'APPROX 4-6 tasks x 8-12h, 200 restarts',
			randomDays(12, 8607, [4, 6], [8, 12]),
			(day, index) => hillClimbOptimum(day, 200, 9000 + index),
		);
	});
});
