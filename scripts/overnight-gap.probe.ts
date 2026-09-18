/**
 * What the fixed 24 h reservoir cycle costs against the overnight gap the 🪫
 * rows' own `createdAt`s carry (ROADMAP item 41). `seedMorningReservoirs`
 * simulates yesterday's rows from full reservoirs and then rests for
 * `RESERVOIR_CYCLE_HOURS − workedHours`, which anchors work-start to
 * work-start. The clock is available and unused: every row carries a required
 * `createdAt`, and §8.10/§8.11 read exactly those moments to recover a day's
 * own breaks, while this anchor does not. Both
 * errors item 41 names are reachable: a gap SHORT of 24 − W is a late finish
 * with an early start, credited rest the user never had, and a gap PAST it is
 * a long night credited less than it took. This file prices the bias and asks
 * which consumer could read the fix at all. The second question is the one
 * that decides the build.
 *
 * ONLY THE TRAILING GAP MOVES between the two arms. Yesterday's rows, their
 * order and their demands are identical in both, so nothing below is credited
 * with the omission of intraday breaks — that one is bounded separately by
 * `mtr2-carry-over.probe.ts`, whose affine argument (a cycle is a composition
 * of affine maps, so permuting blocks moves only the offset, and the trailing
 * rest's own factor e^(−ρ_rest·gap) bounds the spread) is why this arm can be
 * read alone. The clock arm is the SHIPPED seeding with one number changed:
 * `seedAtGap` below is `seedMorningReservoirs`' body with the gap passed in.
 *
 * THE GENERATOR IS THE MODEL: every morning level is read through the shipped
 * `simulateReservoirs` and every reading through the shipped
 * `calculateDailyMetrics`. Rows are ones the app could hold: demands are
 * `slider/10` for a 1-10 slider, so they never reach 0, and `createdAt` is
 * stamped at each session's END. Session LENGTHS are multiples of the
 * 45-minute step except for the remainder that closes out a whole-hour W,
 * which the app reaches too — 🪫 hours are entered in minutes
 * (`measurement-prompt.ts`), not on the lattice. Reading 1 holds ONE demand
 * profile fixed so W and the gap are its only moving parts; readings 2 and 4
 * draw demands, task sliders and budgets at random, seeded.
 *
 * Figures below are read off THIS file's own run (2026-09-18). Every one of
 * them is printed by the run; none is computed by hand.
 *
 * SELF-CHECK, printed first: `seedAtGap` at gap = 24 − W reproduces
 * `seedMorningReservoirs` EXACTLY (worst |Δ| 0.00e+0 over 24 fixture days,
 * both row builders), so the two arms differ by the anchor and nothing else.
 * Beside it the contrast the whole item rests on, pinned at both ends: the
 * anchor moves the morning level by 7.52e-4 at the default r = 0.7 and by
 * 0.1944 at the fit floor r = 0.1. The seeding's own docblock holds that
 * carry-over is visible only where the ☕ fit says recovery is slow; that is
 * that claim measured, and it frames every reading below.
 *
 * READING 1 — the morning level, per anchor, in reservoir units (0–1). `Δ` is
 * clock − shipped, signed: NEGATIVE means the shipped anchor starts the day
 * too HIGH, which is the credited-rest error. The sign flips at g = 24 − W by
 * construction, and the magnitude is asymmetric — the error costs more on the
 * short-gap side than it gains on the long one, because the DEFICIT it carries
 * decays exponentially in the gap. The five-gap sweep prints in full; the two
 * extremes of each W are quoted here:
 *
 *     r = 0.10 (RECOVERY_FIT_MIN, ρ_rest = 0.15/h)
 *        W    g   24−W   shipped    clock         Δ
 *        6   12     18    0.9537   0.8862   −0.0676
 *        6   24     18    0.9537   0.9812   +0.0275
 *        8   10     16    0.9318   0.8323   −0.0995
 *        8   22     16    0.9318   0.9723   +0.0405
 *       10    8     14    0.9037   0.7631   −0.1406
 *       10   20     14    0.9037   0.9608   +0.0572
 *       12    6     12    0.8668   0.6724   −0.1944
 *       12   18     12    0.8668   0.9458   +0.0790
 *     r = 0.30 (ρ_rest = 0.45/h) — 16× smaller on the W 8 cell, 5× on W 12
 *        8   10     16    0.9996   0.9934   −0.0061
 *       12    6     12    0.9972   0.9588   −0.0385
 *     r = 0.70 (the default, ρ_rest = 1.05/h) — gone
 *       12    6     12    1.0000   0.9992   −0.0008
 *
 * READING 2 — what the anchor moves on the one reading that consumes it.
 * **`calculateBurnoutRisk` is the only thing `calculateDailyMetrics` hands
 * `energyParams` to**, so the allocator never sees the seeded level and a plan
 * solved from one day cannot move. `plan rows moved` is 0 by construction; the
 * assertion documents that, and `daily-metrics.test.ts` carries the suite pin,
 * since a probe never runs in `npm test`. The risk is a displayed INTEGER, so a
 * sub-point move is one nobody sees. Days at gap = 24 − W are excluded from
 * this sweep: there the two arms ARE the same seeding, and including them once
 * diluted the share below by a fifth.
 *
 *     r = 0.10   risk moved 157/200   worst 3 points   median +0   plan rows moved 0
 *     r = 0.30   risk moved   4/200   worst 1 point    median +0   plan rows moved 0
 *     r = 0.70   risk moved   0/200   worst 0 points   median +0   plan rows moved 0
 *
 * **A displayed integer is not the whole consequence, and the rest is unpriced
 * here.** `daily-plan-store` hands the SAME input to `suggestPlanAdjustments`,
 * which re-solves the day per candidate lever and ranks them on the
 * `burnoutRisk` axis, and to `calculateDraftImpact`. A 3-point move at the fit
 * floor can therefore reorder the advice card's menu, which is a recommendation
 * and not a number. What that reordering is worth is not measured here.
 *
 * READING 3 — the consumer that cannot read it in time. `metric/history.ts`
 * audits a finished day and holds both ends of the gap; `daily-plan-store`
 * seeds the VIEWED day's morning, so a browsed past day holds them too. TODAY
 * holds only the start. The gap's other end is the moment work begins, and no
 * model input records it before the first 🪫 row: the session clock's
 * `runningSince` is the nearest thing and is not it — it is the current
 * segment's start, it exists only if the user runs the clock, and it is
 * localStorage-tier, which R4 bars from feeding a calculation. The column is
 * what is left of Δ after the day's own first session — i.e. what the fix would
 * still be worth at the first moment the live plan could read it:
 *
 *     r = 0.10, W 8, g 10   Δ at dawn −0.0995   after 1 session −0.0639 (64%)
 *     r = 0.10, W 8, g 22   Δ at dawn +0.0405   after 1 session +0.0260 (64%)
 *     r = 0.30, W 8, g 10   Δ at dawn −0.0061   after 1 session −0.0034 (55%)
 *     r = 0.70, W 8, g 10   Δ at dawn −0.0000   after 1 session −0.0000 (41%)
 *
 * Most of it survives, so the late reading is not a stale one. What it is not
 * is a MORNING reading: the seed would change under the user after the first
 * log of the day, on a card that has already been read.
 *
 * READING 4 — what the moments cannot carry, over 400 generated day pairs.
 * `plain` reads them as they are; `guarded` also drops a row whose `createdAt`
 * falls on a different calendar day than its own `date` — the test §8.14
 * sketches for a row logged onto a PAST day, which no shipped code performs
 * (`rankDrainByTask` filters earliest-per-date only), so the guard is this
 * probe's own construction. `err` is the median error in the gap read, against
 * the gap the generator used:
 *
 *     arm                            usable (guarded)  median err   WRONG     worst  cross midnight
 *     clean                              400/400          +0.0 h    15/400    3.0 h       21
 *     one moment missing                   0/400               —     0/400    0.0 h       21
 *     yesterday batch-logged             393/400          +0.0 h     8/400    3.0 h       21
 *     today batch-logged                 392/400          +6.0 h   392/400   11.0 h       13
 *     today logged onto a past day         8/400         +24.0 h     8/400   24.0 h      400
 *
 * `WRONG` counts pairs the guarded anchor USES and gets wrong by any amount,
 * which is the number that decides this item: a median over 400 pairs cannot
 * see fifteen of them, and a wrong reading is the failure the fixed cycle does
 * not have, because it is acted on rather than detected.
 *
 * **The guard is not optional**: without it a day corrected after the fact
 * reads a 24 h gap on all 400 pairs, worse than what it replaces. **The guard
 * is not sufficient, and it is not free.** It cannot see a batch-logged today
 * at all — 392 pairs read usable and wrong, worst 11.0 h. And it is a CALENDAR
 * test, so on a day whose work crossed midnight it drops the row that carries
 * the gap's own end rather than the pair: **15 of 400 CLEAN pairs come back
 * usable and wrong, worst 3.0 h**, on data with nothing wrong with it. The 21
 * midnight-crossing pairs in the clean arm are what those 15 are drawn from
 * (the count is printed; which of them turn wrong is not).
 * **A missing moment is the only honest case**: unusable, detected, and
 * falling back to 24 − W, which is what a restored backup needs
 * (`sanitizeDrainObservations` does not check the field and must not, §8.7).
 * A build that wants the clock anchor needs a rule for a midnight-crossing
 * session that the calendar test cannot express.
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';
import {
	RESERVOIR_CYCLE_HOURS,
	seedMorningReservoirs,
} from '$lib/business/model/energy-calibration';
import {
	DEFAULT_ENERGY_PARAMS,
	RECOVERY_FIT_MIN,
	simulateReservoirs,
	type EnergyParams,
	type ScheduleBlock,
} from '$lib/business/model/zenith-energy';
import {
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
} from '$lib/business/model/zenith';
import { calculateDailyMetrics } from '$lib/business/model/metric/daily-metrics';
import type { DrainObservationRecord, Task } from '$lib/data/type';

const MS_PER_HOUR = 3_600_000;
const BASE_SEED = 0x41_9a_c3;
const SWEEP_DAYS = 200;
const MOMENT_PAIRS = 400;
const STEP = 0.75;
const ORIGIN = Date.parse('2026-09-01T08:00:00Z');
/** The recovery rates the sweep reads: the fit floor, a middling fitted one, the default. */
const RATES = [RECOVERY_FIT_MIN, 0.3, DEFAULT_ENERGY_PARAMS.recoveryRate];
/**
 * Yesterday's worked hours. The gaps are read RELATIVE to the shipped anchor
 * 24 − W, so every cell holds both of the errors item 41 names: a gap short of
 * it is a late finish with an early start (rest the model credits and the user
 * never had), a gap past it is a long night credited less than it took.
 */
const WORKED = [6, 8, 10, 12];
const GAP_OFFSETS = [-6, -3, 0, +3, +6];

const gapsFor = (worked: number): number[] =>
	GAP_OFFSETS.map((offset) => RESERVOIR_CYCLE_HOURS - worked + offset).filter((gap) => gap > 0);

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;

	return () => {
		a = (a + 0x6d_2b_79_f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

const median = (values: number[]): number => {
	const sorted = [...values].sort((x, y) => x - y);
	const half = sorted.length >> 1;

	return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
};

const paramsAt = (rate: number): EnergyParams => ({
	...DEFAULT_ENERGY_PARAMS,
	recoveryRate: rate,
});

/** ρ_rest, the rate an idle reservoir refills at (MATH.md §8.1). */
const restRate = (params: EnergyParams): number =>
	params.recoveryRate * params.restRecoveryMultiplier;

/**
 * `seedMorningReservoirs` with the trailing gap passed in rather than derived
 * from `RESERVOIR_CYCLE_HOURS`. Everything else — one block per ROW keyed by
 * position, demands captured at logging time, the simulation from full
 * reservoirs — is the shipped body, and the self-check pins that.
 */
function seedAtGap(
	params: EnergyParams,
	previousDayDrain: DrainObservationRecord[],
	gapHours: number,
): EnergyParams {
	const worked = previousDayDrain.filter((o) => o.hours > 0);

	if (!worked.length) return params;

	const blocks: ScheduleBlock[] = worked.map((o, i) => ({
		taskId: i,
		hours: o.hours,
	}));

	if (gapHours > 0)
		blocks.push({
			taskId: null,
			hours: gapHours,
		});

	const { endCog, endPhys } = simulateReservoirs(
		blocks,
		worked.map((o, i) => ({
			id: i,
			cognitiveDemand: o.cognitiveDemand,
			physicalDemand: o.physicalDemand,
		})),
		{
			...params,
			initialCog: 1,
			initialPhys: 1,
		},
	);

	return {
		...params,
		initialCog: endCog,
		initialPhys: endPhys,
	};
}

/**
 * The gap the rows' own moments carry: yesterday's last session END to today's
 * first session START. `createdAt` is ≈ the session's end, so today's first
 * start is `createdAt − hours`, the same arithmetic §8.10's `recoveredRest`
 * uses for a within-day gap. Null where the moments cannot carry it — a row
 * with an unusable moment, or a gap the clock reads as negative (a clock
 * adjustment, or a row logged onto a past day), which is where the fixed cycle
 * remains the fallback. The calendar guard is this probe's own: §8.14 names the
 * `createdAt`-vs-`date` mismatch but performs no such test.
 */
function clockGapHours(
	yesterday: DrainObservationRecord[],
	today: DrainObservationRecord[],
	withLateLogGuard = false,
): number | null {
	const live = (o: DrainObservationRecord) =>
		!withLateLogGuard ||
		!Number.isFinite(o.createdAt) ||
		new Date(o.createdAt).toISOString().slice(0, 10) === o.date;

	const worked = yesterday.filter((o) => o.hours > 0 && live(o));
	const started = today.filter((o) => o.hours > 0 && live(o));

	if (!worked.length || !started.length) return null;

	if ([...worked, ...started].some((o) => !Number.isFinite(o.createdAt))) return null;

	const lastEnd = Math.max(...worked.map((o) => o.createdAt));
	const firstRow = started.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b));
	const firstStart = firstRow.createdAt - firstRow.hours * MS_PER_HOUR;
	const gap = (firstStart - lastEnd) / MS_PER_HOUR;

	return gap > 0 ? gap : null;
}

/** A demand the sliders can produce: `mentalDifficulty/10` for a 1-10 slider, so never 0. */
const notch = (random: () => number): number => (1 + Math.floor(random() * 10)) / 10;

/** One day's rows: sessions on the 45-minute lattice summing to `worked`, stamped at their ends. */
function dayRows(
	random: () => number,
	date: string,
	startedAt: number,
	worked: number,
): DrainObservationRecord[] {
	const rows: DrainObservationRecord[] = [];
	let remaining = worked;
	let clock = startedAt;
	let id = 0;

	while (remaining > 1e-9) {
		const steps = Math.min(Math.ceil(remaining / STEP), 1 + Math.floor(random() * 3));
		const hours = Math.min(remaining, steps * STEP);
		const breakHours = remaining > hours ? STEP * Math.floor(random() * 2) : 0;

		clock += hours * MS_PER_HOUR;

		rows.push({
			date,
			taskId: id,
			taskTitle: `t${id}`,
			hours,
			cognitiveDemand: notch(random),
			physicalDemand: notch(random),
			mindDrain: Math.round(random() * 10),
			bodyDrain: Math.round(random() * 10),
			createdAt: clock,
		});

		clock += breakHours * MS_PER_HOUR;
		remaining -= hours;
		id += 1;
	}

	return rows;
}

/**
 * Yesterday as a FIXED profile: equal sessions on the lattice at one demand
 * pair, so reading 1's only moving parts are W and the gap. The random builder
 * above varies demands, which is what reading 2's plan sweep wants and what
 * would make a W column unreadable here.
 */
function fixedDayRows(worked: number): DrainObservationRecord[] {
	const rows: DrainObservationRecord[] = [];
	let clock = ORIGIN;
	let remaining = worked;
	let id = 0;

	while (remaining > 1e-9) {
		const hours = Math.min(remaining, 2 * STEP);

		clock += hours * MS_PER_HOUR;

		rows.push({
			date: '2026-09-01',
			taskId: id,
			taskTitle: `t${id}`,
			hours,
			cognitiveDemand: 0.7,
			physicalDemand: 0.4,
			mindDrain: 6,
			bodyDrain: 4,
			createdAt: clock,
		});

		remaining -= hours;
		id += 1;
	}

	return rows;
}

function drawTasks(random: () => number, count: number): Task[] {
	return Array.from(
		{
			length: count,
		},
		(_, i) => ({
			id: i + 1,
			title: `task ${i + 1}`,
			mentalDifficulty: 1 + Math.floor(random() * 10),
			physicalDifficulty: 1 + Math.floor(random() * 10),
			enjoyment: 1 + Math.floor(random() * 10),
			createdAt: '2026-09-01',
			completed: false,
		}),
	);
}

/** The largest move the anchor makes over one cell's gap sweep, either reservoir. */
function worstAnchorMove(
	params: EnergyParams,
	rows: DrainObservationRecord[],
	worked: number,
): number {
	const shipped = seedMorningReservoirs(params, rows);

	const moves = gapsFor(worked).map((gap) => {
		const clock = seedAtGap(params, rows, gap);

		return Math.max(
			Math.abs(clock.initialCog - shipped.initialCog),
			Math.abs(clock.initialPhys - shipped.initialPhys),
		);
	});

	return Math.max(...moves);
}

/** How far the gap-passing rebuild departs from the shipped seeding at 24 − W: it must not. */
function anchorAgreement(
	params: EnergyParams,
	rows: DrainObservationRecord[],
	worked: number,
): number {
	const shipped = seedMorningReservoirs(params, rows);
	const rebuilt = seedAtGap(params, rows, RESERVOIR_CYCLE_HOURS - worked);

	return Math.max(
		Math.abs(shipped.initialCog - rebuilt.initialCog),
		Math.abs(shipped.initialPhys - rebuilt.initialPhys),
	);
}

/** How many of a plan's rows the second seed funds differently — 0 while Burnout Risk is the only consumer. */
const planRowsMoved = (
	shipped: { suggestedTasks: { id: number; suggestedHours: number }[] },
	clock: { suggestedTasks: { id: number; suggestedHours: number }[] },
): number => {
	const byTask = new Map(clock.suggestedTasks.map((t) => [t.id, t.suggestedHours]));

	return shipped.suggestedTasks.filter(
		(t) => Math.abs(t.suggestedHours - (byTask.get(t.id) ?? 0)) > 1e-9,
	).length;
};

const MOMENT_ARMS = [
	'clean',
	'one moment missing',
	'yesterday batch-logged',
	'today batch-logged',
	'today logged onto a past day',
] as const;

type MomentArm = (typeof MOMENT_ARMS)[number];

/** Each arm's damage to a clean pair's log moments, in place. */
function damage(
	arm: MomentArm,
	yesterday: DrainObservationRecord[],
	today: DrainObservationRecord[],
	lastEnd: number,
): void {
	if (arm === 'one moment missing') yesterday[0].createdAt = Number.NaN;

	if (arm === 'yesterday batch-logged') for (const row of yesterday) row.createdAt = lastEnd;

	if (arm === 'today batch-logged') {
		const end = Math.max(...today.map((o) => o.createdAt));

		for (const row of today) row.createdAt = end;
	}

	// A row logged onto a past day carries a LIVE moment, so its `createdAt`
	// sits on a later calendar day than its own `date` (§8.14).
	if (arm === 'today logged onto a past day')
		for (const row of today) row.createdAt += 24 * MS_PER_HOUR;
}

const planOf = (tasks: Task[], availableHours: number, energyParams: EnergyParams) =>
	calculateDailyMetrics({
		tasks,
		availableHours,
		switchCost: DEFAULT_SWITCH_COST,
		pools: DEFAULT_CAPACITY_POOLS,
		constants: DEFAULT_USER_CONSTANTS,
		energyParams,
	});

describe('overnight gap: the fixed 24 h cycle against the rows own moments', () => {
	it('self-check: seedAtGap at 24 − W is the shipped seeding, and the default rate hides the anchor', () => {
		const random = mulberry32(BASE_SEED);
		let worstAgreement = 0;
		let worstDefault = 0;
		let worstFloor = 0;
		let days = 0;

		for (const rate of RATES)
			for (const worked of WORKED) {
				// Both builders, so the agreement is the seeding's and not one profile's.
				const profiles = [fixedDayRows(worked), dayRows(random, '2026-09-01', ORIGIN, worked)];
				const params = paramsAt(rate);
				const moved = Math.max(...profiles.map((rows) => worstAnchorMove(params, rows, worked)));

				worstAgreement = Math.max(
					worstAgreement,
					...profiles.map((rows) => anchorAgreement(params, rows, worked)),
				);

				days += profiles.length;

				if (rate === DEFAULT_ENERGY_PARAMS.recoveryRate)
					worstDefault = Math.max(worstDefault, moved);

				if (rate === RECOVERY_FIT_MIN) worstFloor = Math.max(worstFloor, moved);
			}

		console.log(
			`\nSELF-CHECK  seedAtGap(24 − W) vs seedMorningReservoirs on ${days} days: ` +
				`worst |Δ| ${worstAgreement.toExponential(2)}`,
		);

		console.log(
			`            worst |Δ| the anchor moves: ${worstDefault.toExponential(2)} at the ` +
				`default r = ${DEFAULT_ENERGY_PARAMS.recoveryRate}, ` +
				`${worstFloor.toFixed(4)} at the fit floor r = ${RECOVERY_FIT_MIN}`,
		);

		expect(worstAgreement).toBeLessThan(1e-12);
		// The contrast is the claim, so both sides are pinned: invisible at the
		// default rate, two orders of magnitude larger at the floor.
		expect(worstDefault).toBeLessThan(0.001);
		expect(worstFloor).toBeGreaterThan(0.05);
	});

	it('reading 1: the morning level, per anchor', () => {
		console.log(
			'\nREADING 1 — morning cognitive level, shipped anchor vs the rows own gap\n' +
				'  (one fixed demand profile: W and g are the only moving parts)',
		);

		for (const rate of RATES) {
			const params = paramsAt(rate);

			console.log(
				`  r = ${rate.toFixed(2)} (ρ_rest = ${restRate(params).toFixed(2)}/h)\n` +
					'     W    g   24−W   shipped    clock         Δ',
			);

			for (const worked of WORKED) {
				const rows = fixedDayRows(worked);
				const shipped = seedMorningReservoirs(params, rows);

				for (const gap of gapsFor(worked)) {
					const clock = seedAtGap(params, rows, gap);
					const delta = clock.initialCog - shipped.initialCog;

					console.log(
						`    ${String(worked).padStart(2)}   ${String(gap).padStart(2)}     ` +
							`${String(RESERVOIR_CYCLE_HOURS - worked).padStart(2)}    ` +
							`${shipped.initialCog.toFixed(4)}   ${clock.initialCog.toFixed(4)}   ` +
							`${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(4)}`,
					);
				}
			}
		}
	});

	it('reading 2: what the anchor moves on the one reading that consumes it', () => {
		console.log(
			'\nREADING 2 — Burnout Risk, the one reading that consumes the seeded level.\n' +
				'  The allocator never sees it: `calculateDailyMetrics` hands `energyParams`\n' +
				'  to `calculateBurnoutRisk` alone, so a plan solved from one day cannot\n' +
				'  move — asserted here, and pinned in `daily-metrics.test.ts` because a\n' +
				'  probe never runs in `npm test`. What this does NOT bound is the advice\n' +
				'  card: `suggestPlanAdjustments` takes the same input and ranks its levers\n' +
				'  on the `burnoutRisk` axis, so the points below can reorder a menu. That\n' +
				'  consequence is unpriced here.',
		);

		for (const rate of RATES) {
			const random = mulberry32(BASE_SEED + 2);
			const params = paramsAt(rate);
			let moved = 0;
			let worstPoints = 0;
			let planMoved = 0;
			const signed: number[] = [];

			for (let day = 0; day < SWEEP_DAYS; day += 1) {
				const worked = WORKED[day % WORKED.length];
				// The zero offset makes the two arms the same seeding, so a day at it
				// cannot move and would only dilute the share below.
				const gaps = gapsFor(worked).filter((gap) => gap !== RESERVOIR_CYCLE_HOURS - worked);
				const gap = gaps[day % gaps.length];
				const rows = dayRows(random, '2026-09-01', ORIGIN, worked);
				const tasks = drawTasks(random, 3 + Math.floor(random() * 3));
				const availableHours = 4 + Math.floor(random() * 5);
				const shipped = planOf(tasks, availableHours, seedMorningReservoirs(params, rows));
				const clock = planOf(tasks, availableHours, seedAtGap(params, rows, gap));
				// The displayed reading is an integer, so a difference under a point
				// is one the user never sees.
				const delta = clock.burnoutRisk - shipped.burnoutRisk;

				if (delta !== 0) moved += 1;

				signed.push(delta);
				worstPoints = Math.max(worstPoints, Math.abs(delta));

				planMoved += planRowsMoved(shipped, clock);
			}

			console.log(
				`  r = ${rate.toFixed(2)}   risk moved ${String(moved).padStart(3)}/${SWEEP_DAYS}   ` +
					`worst ${String(worstPoints).padStart(2)} points   ` +
					`median ${median(signed) >= 0 ? '+' : '−'}${Math.abs(median(signed))}   ` +
					`plan rows moved ${planMoved}`,
			);

			expect(planMoved).toBe(0);
		}
	});

	it('reading 3: what is left of the gap by the time today can read it', () => {
		console.log(
			'\nREADING 3 — Δ at dawn, and Δ after the day s own first session\n' +
				'  (the moment TODAY first holds the row that reveals its start)',
		);

		const worked = 8;

		for (const rate of RATES)
			// 24 − W is 16 here, so these are the two directions of the error.
			for (const gap of [10, 22]) {
				const params = paramsAt(rate);
				const rows = fixedDayRows(worked);
				const shipped = seedMorningReservoirs(params, rows);
				const clock = seedAtGap(params, rows, gap);
				const dawn = clock.initialCog - shipped.initialCog;

				// One session of today's own work, identical under both seeds.
				const session: ScheduleBlock[] = [
					{
						taskId: 0,
						hours: 1.5,
					},
				];

				const task = [
					{
						id: 0,
						cognitiveDemand: 0.7,
						physicalDemand: 0.3,
					},
				];

				const after =
					simulateReservoirs(session, task, clock).endCog -
					simulateReservoirs(session, task, shipped).endCog;

				console.log(
					`  r = ${rate.toFixed(2)}, W ${worked}, g ${String(gap).padStart(2)} (24−W = ${RESERVOIR_CYCLE_HOURS - worked})   ` +
						`Δ at dawn ${dawn >= 0 ? '+' : '−'}${Math.abs(dawn).toFixed(4)}   ` +
						`after 1 session ${after >= 0 ? '+' : '−'}${Math.abs(after).toFixed(4)} ` +
						`(${Math.abs(dawn) < 1e-12 ? '—' : `${Math.round((after / dawn) * 100)}%`})`,
				);
			}
	});

	it('reading 4: what the moments cannot carry', () => {
		console.log(
			'\nREADING 4 — whether the clock anchor is readable at all.\n' +
				'  `plain` reads the moments as they are; `guarded` also drops a row whose\n' +
				'  `createdAt` falls on a different calendar day than its own `date` — the\n' +
				'  test §8.14 sketches for a row logged onto a past day, which no shipped\n' +
				'  code performs (`rankDrainByTask` filters earliest-per-date only).',
		);

		for (const arm of MOMENT_ARMS) {
			const random = mulberry32(BASE_SEED + 4);
			let usable = 0;
			let guardedUsable = 0;
			let crossedMidnight = 0;
			let guardedWrong = 0;
			let guardedWorst = 0;
			const errors: number[] = [];
			const guardedErrors: number[] = [];

			for (let pair = 0; pair < MOMENT_PAIRS; pair += 1) {
				const worked = 6 + Math.floor(random() * 7);
				const trueGap = 6 + Math.floor(random() * 13);
				const yesterday = dayRows(random, '2026-09-01', ORIGIN, worked);
				const lastEnd = Math.max(...yesterday.map((o) => o.createdAt));

				const today = dayRows(
					random,
					'2026-09-02',
					lastEnd + trueGap * MS_PER_HOUR,
					4 + Math.floor(random() * 5),
				);

				damage(arm, yesterday, today, lastEnd);

				const read = clockGapHours(yesterday, today);

				if (read !== null) {
					usable += 1;
					errors.push(read - trueGap);
				}

				const guarded = clockGapHours(yesterday, today, true);
				// The median cannot see a handful of wrong readings among 400, and a WRONG
				// one is the failure the fallback does not have: it is used.
				const guardedError = guarded === null ? 0 : Math.abs(guarded - trueGap);

				if (guarded !== null) {
					guardedUsable += 1;
					guardedErrors.push(guarded - trueGap);
					guardedWrong += guardedError > 1e-9 ? 1 : 0;
					guardedWorst = Math.max(guardedWorst, guardedError);
				}

				// Why the guard's count differs from 400: it is a CALENDAR test, so a
				// session that ran past midnight is stamped on the day after the one it
				// is filed under and reads as a late log. Counted rather than argued.
				if (
					[...yesterday, ...today].some(
						(o) =>
							Number.isFinite(o.createdAt) &&
							new Date(o.createdAt).toISOString().slice(0, 10) !== o.date,
					)
				)
					crossedMidnight += 1;
			}

			const cell = (count: number, errs: number[]) =>
				`${String(count).padStart(3)}/${MOMENT_PAIRS}${
					errs.length
						? ` err ${median(errs) >= 0 ? '+' : '−'}${Math.abs(median(errs)).toFixed(1)} h`
						: '           '
				}`;

			console.log(
				`  ${arm.padEnd(30)} plain ${cell(usable, errors)}   ` +
					`guarded ${cell(guardedUsable, guardedErrors)}   ` +
					`guarded WRONG ${String(guardedWrong).padStart(3)}/${MOMENT_PAIRS} ` +
					`worst ${guardedWorst.toFixed(1)} h   (${crossedMidnight} cross midnight)`,
			);
		}
	});
});
