/**
 * The measurements behind MATH.md's whole case for the `fitSnapshots` store,
 * and for rejecting the alternative that would have been strictly more correct.
 *
 * Two numbers, neither reproducible:
 *
 *   DRIFT — "Measured on a synthetic year of a heavy logger whose true rates
 *   drift (α 0.25 → 0.55 over 365 days, 730 ⚡ / 730 ☕ / 1095 🪫): α_cog fitted
 *   from logs up to day 10 is 0.3069, the whole-history fit is 0.4973 — the
 *   day-10 plan was audited against a drain rate 62 % higher than that day's
 *   own logs supported. The bias is an early-history bias and it does not show
 *   up inside the 30-day audit window (0.4809 → 0.4965 there)."
 *
 *   COST — "refitting per audited day costs the WHOLE-history fit each time
 *   (measured 19 ms per day at the volume above, 570 ms for a 30-day audit,
 *   against 17.6 ms for one whole-history fit), so recomputation is
 *   O(auditDays × totalLogVolume)".
 *
 * The drift number justifies storing snapshots at all. The cost number is the
 * ENTIRE rejection of per-day recomputation — which MATH.md itself concedes
 * "would fix history retroactively, which storing cannot". A rejection that
 * strong deserves a measurement that exists. None of `0.3069`, `0.4973`,
 * `0.4809`, `0.4965`, `19 ms`, `570 ms` or `17.6 ms` appears anywhere in
 * `src/` or `scripts/`; they are prose from a probe that was thrown away.
 *
 * A probe, not a test. The drift arm sweeps a space (drift shape × log volume
 * × as-of day) that one synthetic year samples once, and the cost arm is
 * wall-clock — legitimately different on every machine, which is exactly why
 * it must be re-runnable rather than quoted.
 *
 * WHAT WOULD FALSIFY WHAT. If the day-10 ratio is not materially above 1, the
 * drift bias is not real and the store has no justification. If the in-window
 * pair is as biased as the early pair, the "it went unnoticed because the
 * audit window is clean" explanation is wrong. If per-day refit does NOT cost
 * about one whole-history fit, or does not grow with log volume, then
 * O(auditDays × totalLogVolume) is wrong and recomputation — the more correct
 * option — was rejected on a false premise.
 *
 * Timing is reported as a median over repeats after a warm-up, because V8's
 * first pass through a fit is not the cost the user pays on their thousandth
 * analytics visit. Read the RATIO between the arms rather than the absolute
 * milliseconds: the ratio is the thing the argument actually rests on, and
 * it is the part that survives being run on a different machine.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import { calibrateEnergyParams } from '$lib/business/model/energy-calibration';
import type { DrainObservationRecord, RestObservationRecord } from '$lib/data/type';

function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** MATH.md's own logger: 730 ⚡ / 730 ☕ / 1095 🪫 over 365 days. */
const DAYS = 365;
const REST_PER_DAY = 2;
const DRAIN_PER_DAY = 3;
/** MATH.md's drift: α 0.25 → 0.55 across the year. */
const ALPHA_START = 0.25;
const ALPHA_END = 0.55;
/** The audit's window — the "does not show up in-window" half of the claim. */
const AUDIT_WINDOW_DAYS = 30;
const AS_OF_DAYS = [5, 10, 20, 30, 60, 120, 365];

type DriftShape = 'linear' | 'step' | 'flat';

const DRIFT_SHAPES: DriftShape[] = ['linear', 'step', 'flat'];
/** Log-volume multipliers on MATH.md's own rates, for the O(volume) claim. */
const VOLUME_MULTIPLIERS = [1, 2, 4];

function alphaOn(day: number, shape: DriftShape): number {
	const t = day / DAYS;

	if (shape === 'flat') return (ALPHA_START + ALPHA_END) / 2;

	if (shape === 'step') return day < DAYS / 2 ? ALPHA_START : ALPHA_END;

	return ALPHA_START + (ALPHA_END - ALPHA_START) * t;
}

function isoDate(day: number): string {
	// Day 0 is 2026-01-01. Constructed by hand rather than with Date so the
	// probe stays deterministic and dependency-free.
	const month = Math.min(11, Math.floor(day / 31));
	const dayOfMonth = (day % 31) + 1;

	return `2026-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
}

interface History {
	rest: RestObservationRecord[];
	drain: DrainObservationRecord[];
}

/**
 * A heavy logger whose TRUE cognitive drain rate walks from 0.25 to 0.55. The
 * drain rating is generated from the reservoir law's own closed form,
 * C(h) = e^(−α·w·h) with the day's true α, so the fit has a real signal to
 * recover rather than noise around a constant.
 */
function synthesizeHistory(shape: DriftShape, volume: number, seed: number): History {
	const random = mulberry32(seed);
	const rest: RestObservationRecord[] = [];
	const drain: DrainObservationRecord[] = [];

	for (let day = 0; day < DAYS; day++) {
		const alpha = alphaOn(day, shape);
		const date = isoDate(day);

		for (let i = 0; i < DRAIN_PER_DAY * volume; i++) {
			const hours = 1 + Math.floor(random() * 4) * 0.5;
			const demand = 0.4 + Math.floor(random() * 7) * 0.1;
			const drained = 1 - Math.exp(-alpha * demand * hours);
			// Ratings are 0–10 notches, so the instrument quantizes.
			const notch = Math.max(0, Math.min(10, Math.round(drained * 10)));

			drain.push({
				date,
				taskId: 1 + (i % 3),
				taskTitle: `t${1 + (i % 3)}`,
				hours,
				cognitiveDemand: demand,
				physicalDemand: demand * 0.6,
				mindDrain: notch,
				bodyDrain: Math.max(
					0,
					Math.min(10, Math.round((1 - Math.exp(-0.3 * demand * 0.6 * hours)) * 10)),
				),
				createdAt: day * 86_400_000 + i,
			});
		}

		for (let i = 0; i < REST_PER_DAY * volume; i++) {
			const hours = 0.25 + Math.floor(random() * 4) * 0.25;
			const before = 3 + Math.floor(random() * 6);
			const after = Math.max(0, Math.round(before * Math.exp(-0.7 * 1.5 * hours)));

			rest.push({
				date,
				hours,
				mindBefore: before,
				mindAfter: after,
				bodyBefore: before,
				bodyAfter: after,
				createdAt: day * 86_400_000 + i,
			});
		}
	}

	return {
		rest,
		drain,
	};
}

function upTo(history: History, day: number): History {
	const cutoff = isoDate(day);

	return {
		rest: history.rest.filter((r) => r.date <= cutoff),
		drain: history.drain.filter((d) => d.date <= cutoff),
	};
}

function alphaCogOf(history: History): number {
	return calibrateEnergyParams(history.rest, history.drain).params.alphaCog;
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);

	return sorted[Math.floor(sorted.length / 2)];
}

/** Median wall-clock ms of `run`, after discarding a warm-up pass. */
function timeIt(run: () => void, repeats: number): number {
	run();

	const samples: number[] = [];

	for (let i = 0; i < repeats; i++) {
		const started = performance.now();

		run();
		samples.push(performance.now() - started);
	}

	return median(samples);
}

describe('per-day fit snapshots', () => {
	it('drift: the as-of-day fit against the whole-history fit', () => {
		console.log(
			`[drift] ${DAYS} days, ${REST_PER_DAY * DAYS} ☕ / ${DRAIN_PER_DAY * DAYS} 🪫 at 1×, ` +
				`true α_cog ${ALPHA_START} → ${ALPHA_END}`,
		);

		for (const shape of DRIFT_SHAPES) {
			const history = synthesizeHistory(shape, 1, 0xf17501);
			const whole = alphaCogOf(history);

			const cells = AS_OF_DAYS.map((day) => {
				const asOf = alphaCogOf(upTo(history, day));

				return `d${day} ${asOf.toFixed(4)} (${(((whole - asOf) / asOf) * 100).toFixed(0)}%)`;
			});

			console.log(
				`[drift] ${shape.padEnd(6)} whole-history α_cog ${whole.toFixed(4)}; ` +
					`as-of-day fit and the whole-history fit's excess over it: ${cells.join(', ')}`,
			);

			// The "does not show up inside the 30-day audit window" half. This is
			// the AS-OF-DAY fit at the window's two ends — each over the whole
			// history up to that day — not a fit restricted to the window's own
			// logs. That distinction is the claim: an auditor scoring all 30 days
			// against today's fit is only wrong by however much the as-of-day fit
			// moved ACROSS the window, and MATH.md says that is nearly nothing
			// (0.4809 → 0.4965) even while the day-10 gap is 62%.
			const windowStart = DAYS - AUDIT_WINDOW_DAYS;
			const inWindowEarly = alphaCogOf(upTo(history, windowStart));
			const inWindowLate = alphaCogOf(upTo(history, DAYS));

			console.log(
				`[drift] ${shape.padEnd(6)} inside the last ${AUDIT_WINDOW_DAYS} days: ` +
					`${inWindowEarly.toFixed(4)} → ${inWindowLate.toFixed(4)} ` +
					`(${(((inWindowLate - inWindowEarly) / inWindowEarly) * 100).toFixed(1)}% apart)`,
			);
		}
	});

	it('cost: one whole-history fit against a 30-day per-day refit', () => {
		for (const volume of VOLUME_MULTIPLIERS) {
			const history = synthesizeHistory('linear', volume, 0xf17502);
			const logs = history.rest.length + history.drain.length;
			const once = timeIt(() => void alphaCogOf(history), 5);

			// What recomputation would cost: the whole-history fit, once per
			// audited day, each over the logs dated ≤ that day.
			const audited = Array.from(
				{
					length: AUDIT_WINDOW_DAYS,
				},
				(_, i) => DAYS - AUDIT_WINDOW_DAYS + i,
			);

			const slices = audited.map((day) => upTo(history, day));

			const perAudit = timeIt(() => {
				for (const slice of slices) alphaCogOf(slice);
			}, 3);

			console.log(
				`[cost] ${volume}× volume (${logs} logs): one whole-history fit ` +
					`${once.toFixed(1)} ms; ${AUDIT_WINDOW_DAYS}-day refit ${perAudit.toFixed(1)} ms ` +
					`(${(perAudit / AUDIT_WINDOW_DAYS).toFixed(1)} ms/day, ` +
					`${(perAudit / AUDIT_WINDOW_DAYS / once).toFixed(2)}× the single fit)`,
			);
		}

		console.log(
			'[cost] read the RATIOS, not the milliseconds — the O(auditDays × volume) ' +
				'claim is what the per-day/single ratio and its growth across volumes test',
		);
	});
});
