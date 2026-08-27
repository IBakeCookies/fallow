/**
 * Measurement behind MATH.md §8.6's claim that the compound moves made the
 * multi-seed steepest-ascent search reliable — no stranded ~1% of objective and
 * no wrong plan STRUCTURE (a funded task dropped, or an unfunded one bought).
 * §8.6's evidence is two hand-built witnesses; the residual optimality gap over
 * an input space was never measured, and the worse failure mode it names — the
 * wrong funded set — was never measured at all.
 *
 * A probe, not a test: it answers "what is true of the model over a large input
 * space" and prints numbers, where a test answers "does this still hold" and is
 * binary. The gap below legitimately moves whenever a move, a seed, the step
 * lattice or the objective changes, which is why this runs on demand
 * (`npm run probe`) and never in `npm test` — in the suite it would go red on
 * every honest model change while its real signal, the size of the number, is
 * not a regression at all.
 *
 * All three tiers score `optimizeSchedule` against a reference optimum on the
 * SAME DEFAULT_STEP_HOURS lattice, so nothing here measures quantization
 * (§8.8) — only search slack:
 *
 * - ENUMERATED: small enough to enumerate every lattice plan (each 45-min slot
 *   independently assigned to a task or rest), so the reference IS the optimum
 *   and a shortfall is a proven search defect. This tier is what can falsify
 *   §8.6.
 * - FRONTIER: the same exhaustive reference at the largest task counts that
 *   still enumerate — 4, 5 and 6 tasks over the widest window each affords.
 *   ~7 min, which is most of this file's runtime.
 * - APPROX: a long random-restart hill climb, labelled APPROX because it is a
 *   LOWER bound on the true optimum — a 0 there is evidence, not proof, and a
 *   negative gap just means the product search beat the reference. It stays a
 *   lower bound: its own mismatch lines print what enumerating those days would
 *   cost, and it is 129 h for the cheapest and ~6 years for the other. The same
 *   line fires on an enumerated tier, where the prediction can be checked
 *   against the enumeration that just ran (51.7 s predicted, ~51 s taken).
 *
 * Every day whose funded set differs from its reference prints its signed
 * shortfall and which side is behind, so half of a mismatch is attributable
 * even where the reference is a lower bound.
 *
 * The APPROX and FRONTIER days then get an UPHILL AUDIT of the two candidate
 * families `neighbors` does NOT generate. It needs no reference: `localSearch`
 * stops at a local optimum over generated candidates, so anything uphill from
 * the returned plan is a candidate the search cannot reach, and finding one is
 * a proven defect. It has found none: 0 uphill candidates over 21 days, 16 of
 * them with a fully-spent window, where CARVE-FROM-BLOCK is the only one of the
 * two families still available. Three of those 16 hold a mid-block rest anyway
 * — the split is generated while the plan still has room and the plan grows into
 * the window afterwards, so a full window does not strand that structure.
 *
 * The last two arms price §8.6's three-task cap on the pair family, which no
 * committed instrument reached before: `pairSeedTasks` exists on
 * `OptimizeOptions` for them and nothing else sets it. On this box the pair
 * seeds cost 1.28×–2.40× the same search without them, and unbounded C(n,2)
 * costs 1.00× at 3 tasks (where every pair IS a top-three pair) rising to
 * 13.84× at 15 — 4147 ms against 300, on a path three call sites take. The
 * ratio is composition-dependent and cost is not monotone in n (a wide list
 * makes the window bind and the classic seed truncate), so the range is the
 * result and no single cell is.
 *
 * What the cap forfeits, over 400 seeded days: the pair family beats no pairs
 * on 4, worst 0.395580 objective, and unbounded C(n,2) beats the cap on 2,
 * worst 0.208672 — but a cap of FOUR reaches both, at C(4,2) = 6 pair seeds
 * instead of 3 (ROADMAP M54; moving the constant is a plan change, not a
 * provenance one).
 *
 * Whatever it prints stays here, beside the run that produced it, never in
 * MATH.md — which holds derivations only (R7, docs/testing.md).
 *
 * Usage: npm run probe
 */

import { cpus } from 'node:os';
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

/**
 * Days per task count in the FRONTIER tier. The committed 3 keeps that tier at
 * ~7 min of the file's ~10; the seeds are a prefix, so raising this line widens
 * the same sequence. The sweep that found both §8.6 witnesses ran 20 days at 4
 * tasks and 8 at 5 (~28 min).
 */
const FRONTIER_DAYS_PER_SIZE = 3;

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
 *
 * DELIBERATELY NOT realigned onto the sliders with the other nine declarations
 * of this day (ROADMAP M44, 2026-08-21): `guitar 0.4/0.3` and `reading 0.5/0.05`
 * are unreachable demands, and here that is the point. This fixture is the
 * historical day that broke the search, not a day a user could file — moving it
 * would keep the name and lose the question.
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
 * What enumerating this day would actually cost, measured on this machine
 * instead of quoted from another one: every lattice plan times one
 * `evaluateSchedule`.
 */
function enumerationCost(day: Day): string {
	const labels = day.tasks.length + 1;
	const slots = slotCount(day);

	const plan = blocksOf(
		day,
		Array.from(
			{
				length: slots,
			},
			(_, index) => index % labels,
		),
	);

	const runs = 2000;

	// One discarded batch first: timing a cold loop measures JIT warm-up on this
	// day's shape and reads 2-3x the steady-state cost, which is not reproducible.
	for (let run = 0; run < runs; run++) objectiveOf(day, plan);

	const start = performance.now();

	for (let run = 0; run < runs; run++) objectiveOf(day, plan);

	const micros = ((performance.now() - start) * 1000) / runs;
	const hours = (labels ** slots * micros) / 3.6e9;

	return `exhaustive ${labels}^${slots} = ${(labels ** slots).toExponential(2)} plans at ${micros.toFixed(1)} µs/eval = ${hours.toExponential(2)} h (${(hours / 8766).toExponential(2)} years)`;
}

/**
 * Shortfall is (reference − search)/reference in percent: positive means the
 * product search left objective on the table, and every quoted statistic —
 * median, p99, worst — carries that sign, so a negative worst means the search
 * beat the reference on every day. A funded-set mismatch is the
 * structural failure §8.6 calls the worse of the two — the reference funds a
 * task the search leaves at zero hours, or the search funds one the reference
 * does not — and is counted separately because a day can be within 0.01% of the
 * optimum while returning a different plan to the user. Each mismatch prints its
 * own line: the sign of its shortfall says which of the two searches is proven
 * to be behind, and only WHICH funded set the true optimum has stays open where
 * the reference is a lower bound.
 */
function searchGap(
	label: string,
	days: Day[],
	reference: (day: Day, index: number) => ScheduleBlock[],
): void {
	const shortfalls: number[] = [];
	let exact = 0;
	let mismatches = 0;
	let worst = -Infinity;
	let worstDump = 'none';

	days.forEach((day, index) => {
		const search = optimizeSchedule(day.tasks, day.windowHours).blocks;
		const referenceBlocks = reference(day, index);
		const got = objectiveOf(day, search);
		const target = objectiveOf(day, referenceBlocks);
		const shortfall = ((target - got) / target) * 100;

		shortfalls.push(shortfall);

		if (Math.abs(target - got) <= 1e-9) exact++;

		if (fundedSet(search) !== fundedSet(referenceBlocks)) {
			mismatches++;

			const behind =
				shortfall > 1e-9 ? 'search behind' : shortfall < -1e-9 ? 'reference behind' : 'tied';

			console.log(
				`${label} mismatch day ${index}: ${day.tasks.length} tasks x ${day.windowHours}h, shortfall ${shortfall.toFixed(4)}% (${behind}), search funds {${fundedSet(search)}} vs reference {${fundedSet(referenceBlocks)}}, ${enumerationCost(day)}`,
			);
		}

		if (shortfall > worst) {
			worst = shortfall;

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
}

const fmt = (blocks: ScheduleBlock[]) =>
	blocks.map((b) => `${b.taskId === null ? 'rest' : `t${b.taskId}`} ${b.hours}h`).join(' + ');

/**
 * The two candidate families `neighbors` (in `zenith-energy.ts`) does not
 * generate, swept from the plan the search returned: CARVE-FROM-BLOCK, §8.6's
 * unbuilt rest split that takes the step out of the block instead of out of
 * spare `room` (so it survives a fully-spent window), and SHRINK-ONE +
 * INSERT-ONE, the two-move path whose intermediate is downhill. Any uphill
 * candidate is a proven defect with no reference needed, because `localSearch`
 * already stopped at a local optimum over everything it does generate.
 */
function uphillAudit(label: string, day: Day): void {
	const step = DEFAULT_STEP_HOURS;
	const search = optimizeSchedule(day.tasks, day.windowHours).blocks;
	const incumbent = objectiveOf(day, search);
	const total = search.reduce((sum, b) => sum + b.hours, 0);
	const room = Math.floor((day.windowHours - total) / step + 1e-9) * step > step - 1e-9;
	const uphill: string[] = [];

	const consider = (name: string, candidate: ScheduleBlock[]) => {
		const value = objectiveOf(day, candidate);

		if (value > incumbent + 1e-9) uphill.push(`${name} ${value.toFixed(6)}`);
	};

	search.forEach((block, index) => {
		const steps = Math.round(block.hours / step);

		if (block.taskId !== null)
			for (let kept = 1; kept <= steps - 2; kept++)
				consider(`carve ${index}@${kept * step}h`, [
					...search.slice(0, index),
					{
						taskId: block.taskId,
						hours: kept * step,
					},
					{
						taskId: null,
						hours: step,
					},
					{
						taskId: block.taskId,
						hours: block.hours - (kept + 1) * step,
					},
					...search.slice(index + 1),
				]);

		const shrunk = [
			...search.slice(0, index),
			...(steps > 1
				? [
						{
							...block,
							hours: block.hours - step,
						},
					]
				: []),
			...search.slice(index + 1),
		];

		for (let position = 0; position <= shrunk.length; position++)
			for (const task of day.tasks)
				consider(`shrink ${index} insert t${task.id}@${position}`, [
					...shrunk.slice(0, position),
					{
						taskId: task.id,
						hours: step,
					},
					...shrunk.slice(position),
				]);
	});

	console.log(
		`  ${label}: ${day.tasks.length} tasks x ${day.windowHours}h, room ${room}, ${fmt(search)} = ${incumbent.toFixed(6)}, ${uphill.length} uphill${uphill.length > 0 ? `: ${uphill.join(' | ')}` : ''}`,
	);
}

const REPS = 5;

/**
 * Median of `REPS` after one discarded warm-up. A lone mean is not quotable: the
 * first call pays JIT, and only its own machine makes any of these comparable
 * (`plan-advice.probe.ts` prints the box for the same reason).
 */
function timeMs(run: () => void): number {
	run();

	const samples = Array.from(
		{
			length: REPS,
		},
		() => {
			const started = performance.now();

			run();

			return performance.now() - started;
		},
	).sort((a, b) => a - b);

	return samples[Math.floor(REPS / 2)];
}

/** Seeds `buildSeeds` lays down: 4 fixed, drop-one per task, then C(min(n,cap),2). */
const seedCount = (n: number, cap: number) => {
	const paired = n >= 3 ? Math.min(n, cap) : 0;

	return 4 + (n >= 2 ? n : 0) + (paired * (paired - 1)) / 2;
};

/**
 * The synthetic ladder: one composition per size, so cost is read against task
 * COUNT alone. The seeded days beside it vary composition too, which is what
 * shows the ratio is not a function of n.
 */
const ladderDay = (n: number, windowHours: number): Day => ({
	tasks: Array.from(
		{
			length: n,
		},
		(_, index) => task(index + 1, 1 + (index % 10), 1 + ((index * 3) % 10), 0.5, 0.5),
	),
	windowHours,
});

const solve = (day: Day, cap: number) =>
	optimizeSchedule(day.tasks, day.windowHours, undefined, undefined, {
		pairSeedTasks: cap,
	});

describe('energy search gap', () => {
	it('measures the residual optimality gap (MATH.md §8.6)', () => {
		searchGap(
			'ENUMERATED 2-3 tasks x 3-6h',
			randomDays(60, 8006, [2, 3], [3, 6]),
			enumeratedOptimum,
		);

		searchGap(
			'ENUMERATED §8.6 witness day x 3-8h',
			[3, 4, 5, 6, 7, 8].map((windowHours) => ({
				tasks: PROBE_DAY,
				windowHours,
			})),
			enumeratedOptimum,
		);

		// The exhaustive frontier: one window per task count, the widest each can
		// still enumerate — 5^9 = 1.95e6, 6^8 = 1.68e6, 7^7 = 8.2e5 plans, ~2 min
		// per size. A 12 h window at 4 tasks would be 5^16 = 1.5e11, so it is the
		// window, not the task count, that has to give here.
		for (const [tasks, windowHours] of [
			[4, 6.75],
			[5, 6],
			[6, 5.25],
		]) {
			const label = `FRONTIER ${tasks} tasks x ${windowHours}h`;

			const days = randomDays(
				FRONTIER_DAYS_PER_SIZE,
				8700 + tasks,
				[tasks, tasks],
				[windowHours, windowHours],
			);

			searchGap(label, days, enumeratedOptimum);
			days.forEach((day, index) => uphillAudit(`${label} day ${index}`, day));
		}

		const approxDays = randomDays(12, 8607, [4, 6], [8, 12]);

		searchGap('APPROX 4-6 tasks x 8-12h, 200 restarts', approxDays, (day, index) =>
			hillClimbOptimum(day, 200, 9000 + index),
		);

		console.log('UPHILL AUDIT (candidate families the search never generates):');
		approxDays.forEach((day, index) => uphillAudit(`APPROX day ${index}`, day));
	});

	/**
	 * What the three-task cap on the pair family costs and saves. Neither arm is
	 * reachable through the product signature — `pairSeedTasks` exists on
	 * `OptimizeOptions` for these two calls and nothing else sets it.
	 *
	 * A wall clock is only quotable with its machine attached, so the box and the
	 * runtime print beside the numbers and nothing else may be running on it.
	 */
	it('prices the pair-seed cap against no pairs and against C(n,2)', () => {
		console.log(`[cost] ${cpus()[0].model}, ${cpus().length} cores, node ${process.version}`);

		for (const [label, dayOf] of [
			['ladder', (n: number) => ladderDay(n, 12)],
			['seeded', (n: number) => randomDays(1, 8600 + n, [n, n], [12, 12])[0]],
		] as [string, (n: number) => Day][]) {
			for (const n of [3, 4, 6, 8, 10, 12, 15]) {
				const day = dayOf(n);
				const none = timeMs(() => solve(day, 0));
				const capped = timeMs(() => solve(day, 3));
				const full = timeMs(() => solve(day, n));

				console.log(
					`[cost] ${label} ${n} tasks x 12h: no pairs ${none.toFixed(1)} ms (${seedCount(n, 0)} seeds), capped ${capped.toFixed(1)} ms (${seedCount(n, 3)}) = ${(capped / none).toFixed(2)}x, C(n,2) ${full.toFixed(1)} ms (${seedCount(n, n)}) = ${(full / capped).toFixed(2)}x the capped search`,
				);
			}
		}
	});

	/**
	 * The other half of the same question: the cap is only worth its ~1.5x if the
	 * pair family buys something, and only defensible if C(n,2) buys little more.
	 * Both are objective gaps on the SAME lattice — the three arms differ in
	 * seeds alone, so a gap is a basin the seeds below it never reach.
	 */
	it('measures what the pair seeds buy and what the cap forfeits', () => {
		const days = randomDays(400, 8600, [3, 8], [4, 12]);
		const bought: number[] = [];
		const forfeit: { day: Day; gap: number; enough: number }[] = [];

		for (const day of days) {
			const none = solve(day, 0).evaluation.objective;
			const capped = solve(day, 3).evaluation.objective;
			const full = solve(day, day.tasks.length).evaluation.objective;

			if (capped - none > 1e-9) bought.push(capped - none);

			if (full - capped > 1e-9) {
				// The smallest cap that reaches it: 4 would be a cheap fix, 8 is not.
				let enough = day.tasks.length;

				while (enough > 3 && solve(day, enough - 1).evaluation.objective > full - 1e-9) enough--;

				forfeit.push({
					day,
					gap: full - capped,
					enough,
				});
			}
		}

		const worstOf = (values: number[]) => (values.length > 0 ? Math.max(...values) : 0);

		console.log(
			`[cap] the pair family beats no pairs on ${bought.length}/${days.length} days, worst ${worstOf(bought).toFixed(6)} objective`,
		);

		console.log(
			`[cap] C(n,2) beats the 3-task cap on ${forfeit.length}/${days.length} days, worst ${worstOf(forfeit.map((f) => f.gap)).toFixed(6)}`,
		);

		for (const { day, gap, enough } of forfeit) {
			console.log(
				`  forfeited: ${day.tasks.length} tasks x ${day.windowHours}h, gap ${gap.toFixed(6)}, first cap that reaches it ${enough}`,
			);
		}
	});
});
