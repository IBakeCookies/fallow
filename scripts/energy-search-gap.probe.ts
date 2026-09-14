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
 *   The file ran 2090 s on 2026-09-14, the run every deterministic figure
 *   below was read from; that run predates the [move] arm, which adds 258-269 s
 *   of its own.
 * - APPROX: a long random-restart hill climb, labelled APPROX because it is a
 *   LOWER bound on the true optimum — a 0 there is evidence, not proof, and a
 *   negative gap just means the product search beat the reference. It stays a
 *   lower bound: its own mismatch lines print what enumerating those days would
 *   cost. Since the transfer into a block that does not exist yet (2026-09-14)
 *   no day in either tier mismatches its funded set, so the line fires nowhere;
 *   when it last did, on the 4-task FRONTIER day, the reference WAS that
 *   enumeration: 5^9 = 1.95e6 plans at 27.4-29.1 µs/eval, 1.49e-2-1.58e-2 h
 *   over three runs. The estimate was checked against the enumeration's own
 *   clock when the tier was built (v1 curve: 51.7 s predicted, ~51 s taken);
 *   no run since times the tier on its own.
 *
 * Every day whose funded set differs from its reference prints its signed
 * shortfall and which side is behind, so half of a mismatch is attributable
 * even where the reference is a lower bound.
 *
 * The APPROX and FRONTIER days then get an UPHILL AUDIT of two candidate
 * families. It needs no reference: `localSearch` stops at a local optimum over
 * generated candidates, so anything uphill from the returned plan is a
 * candidate the search cannot reach, and finding one is a proven defect.
 * CARVE-FROM-BLOCK, §8.6's unbuilt rest split that takes its step out of the
 * block instead of out of spare `room`, is generated nowhere. SHRINK-ONE +
 * INSERT-ONE is now generated for an unfunded task and for the shrunk block's
 * own, so what the audit still reaches there is the narrowing — a step
 * re-positioned for a task funded elsewhere.
 *
 * On 2026-09-14 it reads 0 uphill on all 21 days, both families, and the two
 * readings that raised ROADMAP M104 are closed by the move: the 4-task FRONTIER
 * day returns 7.817403, which IS the enumerated optimum it used to miss, and
 * APPROX day 1 returns 15.507345, above both the 15.492131 the audit had found
 * uphill of it and the 15.493362 of its own lower-bound reference. The
 * narrowing forfeits nothing these days can see. 17 of the 21 spend the window
 * fully; three of those hold a mid-block rest anyway — the split is generated
 * while the plan still has room and the plan grows into the window afterwards,
 * so a full window does not strand that structure.
 *
 * The last four arms price §8.6's cap on the pair family, which no committed
 * instrument reached before: `pairSeedTasks` exists on `OptimizeOptions` for
 * them and nothing else sets it. Every timing below is a range, not a figure
 * (docs/testing.md): each cell prints the half-range of its own reps, except the
 * [app] one-solve rows, whose cell is already a distribution over 60 days and
 * prints its percentiles instead. The bands quoted here are what TWO runs of
 * these arms read on this box on 2026-09-14, under the transfer into a block
 * that does not exist yet, with the editor idle beside them and nothing else; a
 * contended run is discarded, not averaged in, and the eight identical-work
 * cells below are how one is recognised. EVERY band in this paragraph fell when
 * that move landed, because it raises the search each ratio is divided by; the
 * 2026-09-11 three-run bands it replaces belong to the neighbourhood before it.
 *
 * The pair seeds at the cap of 3 cost roughly 1.1×–2.3× the same search without
 * them (per run: 1.11–2.32, 1.12–2.23); the shipped cap of 4 costs
 * roughly 1.0×–1.6× the cap of 3 it replaced (per run: 0.96–1.62, 0.99–1.57).
 * At 3 tasks all three capped arms ARE one search, and at 4 tasks
 * C(4,2) IS the cap of 4, so eight cells per run time identical work: over 16
 * of them they read 0.93×–1.06×, which is the table's noise floor and the
 * reason no third digit is quoted anywhere here. Unbounded C(n,2) at 15 tasks
 * still costs several times the shipped four-task search
 * (5.7×–7.7×) and 6.4×–9.7× the cap of 3 it replaced — every
 * ratio here is quoted with the arm it is divided by, because those two are one
 * measurement a column apart. Cap 4's cost is flat in n (three more seeds at any
 * size) where C(n,2)'s is quadratic. The ratio is composition-dependent and cost
 * is not monotone in n (a wide list makes the window bind and the classic seed
 * truncate), so the range is the result and no single cell is — and the cap-4
 * decision does not move inside any of these bands: it costs a fraction of one
 * solve at every reading, against an order of magnitude for the unbounded
 * family.
 *
 * In absolute ms on the paths the product takes, over app-shaped days (3-8
 * tasks × 6-10 h): one solve — `EnergyLabStore`'s `#plan`, once per slider
 * move — median ~131-149 ms at cap 3 against ~181-183 at cap 4 (two runs:
 * 131.3/181.2, 149.4/183.2), p95 ~298-339 against ~381-398;
 * `suggestBudgetCurve`'s 12 solves over an 8-task 9.25 h horizon, ~721-746 ms
 * against ~903-954. The same one-solve row read ~73-76 ms at cap 3 before the
 * transfer into a new block (2026-09-11 bands) and ~55-59 on the v1 curve
 * (2026-08-27), both boxes otherwise idle. A ratio cannot say whether a
 * change is felt; between runs the sweep row moves ±3%, against ±1-2% within
 * one.
 *
 * The [move] arm prices the transfer into a block that does not exist yet
 * (ROADMAP M104) the same way, against the search without it — the only caller
 * of `withNewBlockTransfer`. Over the 400 days of the forfeit sweep it is
 * better on 34, a different funded set on 16 of those, median 0.1969% and worst
 * 1.7016%; and WORSE on 6, worst 1.5022%, because a richer neighbourhood can
 * carry steepest ascent into a different basin. It costs roughly 1.7x one solve
 * (110.4/108.5 ms without against 184.1/191.7 with, p95 227/241 against
 * 387/402) and roughly 1.9x the budget sweep (490.5/500.4 ms ±2-3% against
 * 924.0/951.5 ms ±1-2%), two runs on 2026-09-14.
 *
 * GATING that move to the spent window it is explained by — the case where the
 * insert moves below it never fire — was priced on 2026-09-14 and REFUSED, so
 * the arm above prices the ungated family and no knob for the gated one is
 * committed. A third mode generated the family only where `avail` is under one
 * step; over the same 400 days it is better on 0 and WORSE on 6, identical on
 * 394, which is six of the move's thirty-four winning days forfeited (28 left,
 * median 0.1560%) while none of its six losing days is fixed — their worst is
 * the same 1.5022% day the pair cap decides. It saves almost nothing either:
 * one solve 162.3 ms (p95 333.3) against 180.8 (374.6) ungated and 107.2
 * (214.3) without, and the budget sweep 900.5 ms ±1% against 913.3 ±3% and
 * 500.4 ±1% — the two gated-vs-ungated sweep readings overlap inside their own
 * bands. The climb spends the window early, so most candidates are generated
 * at a state the gate would not have excluded, and the gain it does remove is
 * taken at states that still have room. Both M104 witnesses survive the gate
 * (the 4-task FRONTIER day returns 7.817403 under it), so the witnesses are
 * not what refutes it; the sweep is. To re-read these, make the `destinations`
 * guard in `neighbors` `withNewBlockTransfer && !room`.
 *
 * What a cap of 3 forfeits, over 400 seeded days (2026-09-14): the pair
 * family beats no pairs on 4, worst 0.275655 objective, and unbounded C(n,2)
 * beats a cap of 3 on 4, worst 0.183938 — 1.5022% of that day's objective. A
 * cap of 4 reaches two of the four; the other two need 5 (7 tasks × 8.5 h,
 * 0.2556%) and 6 (7 tasks × 7.75 h, 1.5022%). That last day is also the one
 * the [move] arm above loses most on, by the same 0.183938 of objective: with
 * the move on, a cap of 6 returns 12.244529 there — exactly what the move gives
 * up at the shipped cap of 4 — so that day is decided by the pair cap, not by
 * the move. On the v1 curve both forfeited days
 * were reached by a cap of 4.
 *
 * That count is one draw, so the same comparison runs on five seeds. Over 2000
 * days cap 4 beats cap 3 on 3 (2, 0, 0, 0, 1 per seed) and never once returns
 * a different plan at an unchanged objective, so nothing pays for nothing. The
 * per-seed worst gain runs 0.3471%–0.8327%: the
 * RATE is the stable figure here and the magnitude is not. Where such a day's
 * FUNDED SET changes — a task funded nowhere at cap 3, or a different
 * task entirely — that is the structural failure §8.6 calls the worse of the
 * two, and is why 0.35% of days was worth ~1.5× on the interactive path
 * (ROADMAP M54, 2026-08-27 — the rate and the ratio as they read then).
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
 * Days per task count in the FRONTIER tier. The committed 3 keeps the arm that
 * holds it inside a file that runs ~39 min (2026-09-14); the seeds are a
 * prefix, so raising this line widens the same sequence. The sweep that found
 * both §8.6 witnesses ran 20 days at 4 tasks and 8 at 5 (~28 min).
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
 * of this day (ROADMAP M44, 2026-08-21): `guitar`'s difficulty 6 sits above the
 * 4.9 its 0.4/0.3 demands derive, and `reading`'s 0.05 is no slider at all — and
 * here that is the point. This fixture is the historical day that broke the
 * search, not a day a user could file — moving it would keep the name and lose
 * the question.
 */
const PROBE_DAY: EnergyTaskInput[] = [
	task(1, 10, 10, 0.2, 1.0),
	task(2, 6, 9, 0.4, 0.3),
	task(3, 4, 7, 0.5, 0.05),
];

/**
 * DELIBERATELY off the slider surface too, for a different reason than
 * `PROBE_DAY`: `difficulty` is drawn independently of the two demands, where
 * `toEnergyTask` derives it from them. The miss is two-sided — of the
 * five-seed sweep's 10,990 tasks, 266 (2.4%) are ones the app could file,
 * 7,636 sit BELOW the difficulty their demands force and 3,088 above. Per arm:
 * 48 of 2,210 on the 400-day forfeit/gain sweep, 4 of 350 on the [app] arm,
 * 0 of 58 in the cost cells.
 *
 * Every figure read off these days survives it, because each is a difference
 * between two solves of the SAME day — a gap against a reference optimum, or
 * one seed set against another — and a difficulty its demands would not pair
 * with is common to both sides. What the generator has to cover is the (task
 * count, window, composition) space the caps behave differently over, and drawing
 * only on the surface would keep 2.4% of the tasks and far fewer whole days.
 * The one reading that is a property of the population and not of a day — the
 * RATE at which a wider cap wins — is this generator's rate and not the app's;
 * the decision it feeds turns on what those days change, the funded set, and on
 * what the wider cap costs.
 */
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
 * Two candidate families swept from the plan the search returned:
 * CARVE-FROM-BLOCK, §8.6's unbuilt rest split that takes the step out of the
 * block instead of out of spare `room` (so it survives a fully-spent window),
 * which `neighbors` generates nowhere; and SHRINK-ONE + INSERT-ONE, which it
 * generates for an unfunded task and for the shrunk block's own, so what this
 * sweep still reaches there is the narrowing — a step re-positioned for a task
 * funded elsewhere. Any uphill candidate is a proven defect with no reference
 * needed, because `localSearch` already stopped at a local optimum over
 * everything it does generate.
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

/** A wall clock is a range, so this carries the spread it was read at. */
interface Timing {
	median: number;
	min: number;
	max: number;
}

/**
 * Median of `REPS` after one discarded warm-up, WITH the extremes it came from.
 * A lone mean is not quotable: the first call pays JIT, and only its own machine
 * makes any of these comparable (`plan-advice.probe.ts` prints the box for the
 * same reason). The extremes are kept so the reader does not have to run this
 * twice to discover its precision — `ms` below prints them as a half-range.
 * They are the spread WITHIN one run and are not the same quantity as the
 * spread BETWEEN runs, which the header states separately from two of them.
 */
function timeMs(run: () => void): Timing {
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

	return {
		median: samples[Math.floor(REPS / 2)],
		min: samples[0],
		max: samples[REPS - 1],
	};
}

const ms = (t: Timing) =>
	`${t.median.toFixed(1)} ms ±${Math.round((50 * (t.max - t.min)) / t.median)}%`;

/** Replicates the count `buildSeeds` lays down, which is module-private. */
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
		// still enumerate — 5^9 = 1.95e6, 6^8 = 1.68e6, 7^7 = 8.2e5 plans. A 12 h
		// window at 4 tasks would be 5^16 = 1.5e11, so it is the window, not the
		// task count, that has to give here.
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

		console.log('UPHILL AUDIT (candidates the search cannot reach):');
		approxDays.forEach((day, index) => uphillAudit(`APPROX day ${index}`, day));
	});

	/**
	 * What each cap on the pair family costs. Nothing here is reachable through
	 * the product signature — `pairSeedTasks` exists on `OptimizeOptions` for
	 * these arms and nothing else sets it, so every cap below is passed as a
	 * literal and none of them tracks the shipped default.
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
				// What ships since ROADMAP M54. At n = 3 it IS the cap-3 search, so
				// that cell doubles as a noise floor for every ratio in this table.
				const wider = timeMs(() => solve(day, 4));
				const full = timeMs(() => solve(day, n));

				console.log(
					`[cost] ${label} ${n} tasks x 12h: no pairs ${ms(none)} (${seedCount(n, 0)} seeds), cap 3 ${ms(capped)} (${seedCount(n, 3)}) = ${(capped.median / none.median).toFixed(2)}x, cap 4 ${ms(wider)} (${seedCount(n, 4)}) = ${(wider.median / capped.median).toFixed(2)}x cap 3, C(n,2) ${ms(full)} (${seedCount(n, n)}) = ${(full.median / wider.median).toFixed(2)}x cap 4, ${(full.median / capped.median).toFixed(2)}x cap 3`,
				);
			}
		}
	});

	/**
	 * ROADMAP M53's lesson applied to M54: two days in 400 is the maximum of ONE
	 * draw of one generator, and a change to every plan the app proposes should
	 * not rest on one draw. The same sweep on five seeds, cap 3 against cap 4
	 * only — the arms above already priced the two ends. Seed 8600 is the arm
	 * above's own population, so its row is a cross-check and not a sixth draw.
	 *
	 * The second column is what a superset of seeds can do BESIDES lifting the
	 * objective: the search keeps the best and only accepts strict improvements,
	 * so a wider cap can also return a different plan at an unchanged objective —
	 * pair (0,3) now falls between (0,2) and (1,2) in the seed order. That would
	 * be churn a user pays for and gets nothing from, so it is counted, not
	 * argued.
	 *
	 * Each gain day then prints both funded SETS. That is the discriminator the
	 * decision turns on: §8.6 calls a wrong funded set the worse of the two
	 * failures — a task the user is told to do, or not — and it is the defect the
	 * pair family was added to fix. A gain that only redistributes hours among
	 * the same tasks is margin, and margin is what the cost below is weighed
	 * against.
	 */
	it('checks the cap-4 gain across seeds', () => {
		for (const seed of [8600, 8601, 8602, 8603, 8604]) {
			const days = randomDays(400, seed, [3, 8], [4, 12]);
			const gains: number[] = [];
			let churn = 0;

			days.forEach((day, index) => {
				const three = solve(day, 3);
				const four = solve(day, 4);
				const gain = four.evaluation.objective - three.evaluation.objective;

				if (gain > 1e-9) {
					gains.push((gain / four.evaluation.objective) * 100);

					console.log(
						`  [seed ${seed}] day ${index}: ${day.tasks.length} tasks x ${day.windowHours}h, +${gain.toFixed(6)}, funds {${fundedSet(three.blocks)}} -> {${fundedSet(four.blocks)}}`,
					);

					console.log(`      cap 3: ${fmt(three.blocks)}`);
					console.log(`      cap 4: ${fmt(four.blocks)}`);
				} else if (fmt(four.blocks) !== fmt(three.blocks)) churn++;
			});

			console.log(
				`[seed ${seed}] cap 4 beats cap 3 on ${gains.length}/${days.length} days, worst ${(gains.length > 0 ? Math.max(...gains) : 0).toFixed(4)}% of the objective; different plan at an unchanged objective on ${churn}`,
			);
		}
	});

	/**
	 * The same cap priced in ABSOLUTE ms on the paths the product takes, because
	 * a ratio cannot say whether a change is felt: `EnergyLabStore`'s `#plan` is
	 * one solve per slider move, `suggestBudgetCurve` is a solve per 45-min
	 * budget step, and `auditPlanAdherence` is one per logged day. The days here
	 * are app-shaped (3-8 tasks, 6-10 h) rather than the arm above's 12 h ladder.
	 */
	it('prices the cap on the paths the product takes', () => {
		console.log(`[app] ${cpus()[0].model}, ${cpus().length} cores, node ${process.version}`);

		const days = randomDays(60, 8611, [3, 8], [6, 10]);

		for (const cap of [3, 4]) {
			// Each day's own median; the spread that matters here is across DAYS,
			// which the percentiles below report, not across one day's reps.
			const each = days.map((day) => timeMs(() => solve(day, cap)).median).sort((a, b) => a - b);

			console.log(
				`[app] one solve (the Lab's $derived) over ${days.length} app-shaped days, cap ${cap}: median ${percentile(each, 0.5).toFixed(1)} ms, p95 ${percentile(each, 0.95).toFixed(1)} ms, worst ${each[each.length - 1].toFixed(1)} ms`,
			);
		}

		// `suggestBudgetCurve`'s own shape, on the widest day above: one solve per
		// budget step. The common-horizon rescoring between them shares a single
		// curve build and is not a solve, so this is that function's solve cost.
		const widest = days.reduce((a, b) => (b.tasks.length > a.tasks.length ? b : a));
		const steps = Math.floor(widest.windowHours / DEFAULT_STEP_HOURS + 1e-9);

		for (const cap of [3, 4]) {
			const sweep = timeMs(() => {
				for (let step = 1; step <= steps; step++)
					solve(
						{
							tasks: widest.tasks,
							windowHours: step * DEFAULT_STEP_HOURS,
						},
						cap,
					);
			});

			console.log(
				`[app] the budget sweep's ${steps} solves (${widest.tasks.length} tasks x ${widest.windowHours}h horizon), cap ${cap}: ${ms(sweep)}`,
			);
		}
	});

	/**
	 * The other half of the same question: the family is only worth its ~1.5x if
	 * it buys something, and the cap only defensible if C(n,2) buys little more.
	 * Both are objective gaps on the SAME lattice — the three arms differ in
	 * seeds alone, so a gap is a basin the seeds below it never reach.
	 */
	it('measures what the pair seeds buy and what the cap forfeits', () => {
		const days = randomDays(400, 8600, [3, 8], [4, 12]);
		const bought: number[] = [];
		const forfeit: { day: Day; gap: number; relative: number; enough: number }[] = [];

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
					relative: ((full - capped) / full) * 100,
					enough,
				});
			}
		}

		const worstOf = (values: number[]) => (values.length > 0 ? Math.max(...values) : 0);

		console.log(
			`[cap] the pair family beats no pairs on ${bought.length}/${days.length} days, worst ${worstOf(bought).toFixed(6)} objective`,
		);

		console.log(
			`[cap] C(n,2) beats the 3-task cap on ${forfeit.length}/${days.length} days, worst ${worstOf(forfeit.map((f) => f.gap)).toFixed(6)} (${worstOf(forfeit.map((f) => f.relative)).toFixed(4)}% of the objective)`,
		);

		for (const { day, gap, relative, enough } of forfeit) {
			console.log(
				`  forfeited: ${day.tasks.length} tasks x ${day.windowHours}h, gap ${gap.toFixed(6)} (${relative.toFixed(4)}%), first cap that reaches it ${enough}`,
			);
		}
	});

	/**
	 * What the transfer into a block that does not exist yet (§8.6) buys and what
	 * it costs. The `false` arm is the search without that family and is the only
	 * caller of the knob; the `true` arm is the product's own default, so the
	 * ratio below is what the move added to every solve the app runs.
	 *
	 * A richer neighbourhood is not monotone in plan value — steepest ascent can
	 * climb into a different basin and finish lower — so the losing days are
	 * printed beside the winning ones rather than netted against them.
	 */
	it('prices the transfer into a block that does not exist yet', () => {
		const withMove = (day: Day, withNewBlockTransfer: boolean) =>
			optimizeSchedule(day.tasks, day.windowHours, undefined, undefined, {
				withNewBlockTransfer,
			});

		const days = randomDays(400, 8600, [3, 8], [4, 12]);
		const gains: number[] = [];
		const losses: number[] = [];
		let structural = 0;

		for (const day of days) {
			const without = withMove(day, false);
			const shipped = withMove(day, true);
			const gap = shipped.evaluation.objective - without.evaluation.objective;
			const relative = (100 * gap) / Math.abs(without.evaluation.objective);

			if (gap > 1e-9) {
				gains.push(relative);

				if (fundedSet(shipped.blocks) !== fundedSet(without.blocks)) structural++;
			}

			if (gap < -1e-9) losses.push(-relative);
		}

		const sorted = [...gains].sort((x, y) => x - y);
		// A re-run is allowed to find the move paying on nothing; printing that is
		// the result, so neither line may index an empty array.
		const worstOf = (values: number[]) => (values.length > 0 ? Math.max(...values) : 0);

		console.log(
			`[move] over ${days.length} days (3-8 tasks x 4-12h): ${gains.length} better, ${structural} of them a different funded set, median ${(sorted.length > 0 ? percentile(sorted, 0.5) : 0).toFixed(4)}%, worst ${worstOf(gains).toFixed(4)}%`,
		);

		console.log(
			`[move] and ${losses.length} worse, worst ${worstOf(losses).toFixed(4)}%: a richer neighbourhood picks a different basin`,
		);

		console.log(`[move] ${cpus()[0].model}, ${cpus().length} cores, node ${process.version}`);

		const costDays = randomDays(60, 8611, [3, 8], [6, 10]);

		for (const on of [false, true]) {
			const each = costDays
				.map((day) => timeMs(() => withMove(day, on)).median)
				.sort((a, b) => a - b);

			console.log(
				`[move] one solve over ${costDays.length} app-shaped days, ${on ? 'with' : 'without'}: median ${percentile(each, 0.5).toFixed(1)} ms, p95 ${percentile(each, 0.95).toFixed(1)} ms, worst ${each[each.length - 1].toFixed(1)} ms`,
			);
		}

		const widest = costDays.reduce((a, b) => (b.tasks.length > a.tasks.length ? b : a));
		const steps = Math.floor(widest.windowHours / DEFAULT_STEP_HOURS + 1e-9);

		for (const on of [false, true]) {
			const sweep = timeMs(() => {
				for (let step = 1; step <= steps; step++)
					withMove(
						{
							tasks: widest.tasks,
							windowHours: step * DEFAULT_STEP_HOURS,
						},
						on,
					);
			});

			console.log(
				`[move] the budget sweep's ${steps} solves (${widest.tasks.length} tasks x ${widest.windowHours}h), ${on ? 'with' : 'without'}: ${ms(sweep)}`,
			);
		}
	});
});
