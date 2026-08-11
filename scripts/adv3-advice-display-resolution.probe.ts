/**
 * How much of an advice option's improvement the CARD cannot show.
 *
 * The advisor searches on continuous badness (§14 — Energy Balance on
 * `|value − 50|`, the rest on the reading itself) and keeps a candidate only if
 * that badness strictly falls. What renders is coarser, so an option can be a
 * real improvement and still print the reading of the row it sits under, which
 * reads as an option that changes nothing.
 *
 * Asked because the card now draws a BUTTON on budget levers: a row that looks
 * like a no-op is no longer just noise to skim past, it is a click. The decision
 * it feeds is whether to suppress a word-identical option, so the cost of doing
 * that is measured too — the rows that would lose every option, and the relief
 * that would be thrown away with them.
 *
 * WHAT IT FOUND, and what the numbers mean now (MATH.md §25, 2026-08-08). Energy
 * Balance used to render as one of three words alone, and 365 of its 593 options
 * (61.6%) printed the row's own word back, hiding up to 39.3 points — worst case
 * a share moved 0.0 → 39.3 with "Physical Heavy" on both sides. Suppressing them
 * would have emptied 99 of 274 rows, discarding the axis's largest improvement
 * (median 6.2), so the share is printed beside the word instead
 * (`energyBalanceReading`). Since that shipped this measures the RESIDUE: 111 of
 * 593 (18.7%), all sub-percent (max 0.9 points), which is the whole-percent
 * rounding every other axis already carries. A run that climbs back toward 60% —
 * or that reports hidden improvement in whole points rather than tenths — means
 * a display got coarser than its decision again.
 *
 * A PRESENTATION measurement, so it goes through `buildAdviceDisplay` and reads
 * the rendered strings; the numbers behind them come from the model advice the
 * display was built from, matched back by lever identity. Nothing here restates
 * a threshold or a format — `band.ts` owns the first and the descriptor the
 * second (docs/testing.md).
 *
 * Same generator, seed and day count as `plan-advice.probe.ts` and
 * `adv1-plan-advice-frontier.probe.ts` (600 days, seed 42), so these counts
 * compose with theirs rather than describing a different sample.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateDailyMetrics,
	type DailyMetricsInput,
} from '$lib/business/model/metric/daily-metrics';
import {
	suggestPlanAdjustments,
	type AdviceAxis,
	type AdviceLever,
	type AdviceOption,
} from '$lib/business/model/metric/plan-advice';
import { DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
import { buildAdviceDisplay } from '$lib/presentation/utils/plan-advice-descriptor';
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
	createdAt: '2026-07-27',
	completed: false,
});

const day = (
	tasks: Task[],
	availableHours: number,
	switchCost: number,
	cognitiveHours: number,
	physicalHours: number,
): DailyMetricsInput => ({
	tasks,
	availableHours,
	switchCost,
	pools: {
		cognitiveHours,
		physicalHours,
	},
	constants: DEFAULT_USER_CONSTANTS,
	energyParams: DEFAULT_ENERGY_PARAMS,
});

function randomDays(count: number, seed: number): DailyMetricsInput[] {
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
					length: pick(2, 7, 1),
				},
				(_, index) => task(index + 1, pick(0, 10, 1), pick(0, 10, 1), pick(0, 10, 1)),
			);

			return day(
				tasks,
				pick(0.25, 12, 0.25),
				pick(5, 30, 5) / 60,
				pick(0.5, 6, 0.5),
				pick(0.5, 7, 0.5),
			);
		},
	);
}

const DAYS = randomDays(600, 42);
/** The reader whose decimals and words the strings below are formatted for. */
const LOCALE = 'en-GB';

/**
 * Badness, lower-is-better, as §14 ranks it: Energy Balance is a target between
 * the pools, every other axis reads directly. The one duplicated rule in this
 * file, and unavoidable — `plan-advice.ts` keeps its `AXIS` table private, and
 * the probe's whole question is the size of an improvement the display drops.
 */
const badness = (axis: AdviceAxis, value: number) =>
	axis === 'energyBalance' ? Math.abs(value - 50) : value;

/** One rendered option beside the model option it was rendered from. */
interface Priced {
	axis: AdviceAxis;
	/** The row's reading, as printed. */
	before: string;
	/** This option's reading, as printed. */
	after: string;
	/** Badness points the option buys — always > 0, or the model dropped it. */
	improvement: number;
	/** The two readings as the model has them, behind the strings above. */
	beforeValue: number;
	afterValue: number;
	/** Whether the two printed readings are the same string. */
	isInvisible: boolean;
}

/**
 * Every option the card would render for a day, each paired with its improvement.
 *
 * Matched by lever IDENTITY: `toRow` passes `option.lever` through untouched, so
 * the display option and the model option share one object. Nothing is re-derived
 * — the cap, the band filter and the unpriced row are whatever the descriptor did.
 */
function pricedOptions(input: DailyMetricsInput): Priced[] {
	const advice = suggestPlanAdjustments(input, calculateDailyMetrics(input));
	const display = buildAdviceDisplay(advice, LOCALE);
	const byAxis = new Map(advice.findings.map((finding) => [finding.axis, finding]));

	return display.rows.flatMap((row) => {
		const finding = byAxis.get(row.axis)!;

		const model = new Map<AdviceLever, AdviceOption>(
			[...finding.options, ...(finding.unpriced ? [finding.unpriced] : [])].map((option) => [
				option.lever,
				option,
			]),
		);

		return row.options.map((option) => {
			const after = model.get(option.lever)!.after;

			return {
				axis: row.axis,
				before: row.before,
				after: option.after,
				improvement: badness(row.axis, finding.before) - badness(row.axis, after),
				beforeValue: finding.before,
				afterValue: after,
				isInvisible: option.after === row.before,
			};
		});
	});
}

const quantile = (sorted: number[], q: number) =>
	sorted.length === 0 ? NaN : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

function spread(values: number[]): string {
	if (values.length === 0) return 'none';

	const sorted = [...values].sort((a, b) => a - b);

	return `median ${quantile(sorted, 0.5).toFixed(1)}, p90 ${quantile(sorted, 0.9).toFixed(1)}, max ${sorted[sorted.length - 1].toFixed(1)}`;
}

const ALL = DAYS.map(pricedOptions);

describe('advice display resolution', () => {
	/**
	 * The occurrence counter first: an invisible-option rate is meaningless
	 * without the rows that could have produced one, and Energy Balance only
	 * renders when the day is skewed at all.
	 */
	it('counts the rows and options the card renders (MATH.md §14)', () => {
		const rows = new Map<AdviceAxis, number>();
		const options = new Map<AdviceAxis, number>();

		for (const day of ALL)
			for (const option of day) {
				options.set(option.axis, (options.get(option.axis) ?? 0) + 1);
			}

		for (const day of ALL)
			for (const axis of new Set(day.map((option) => option.axis)))
				rows.set(axis, (rows.get(axis) ?? 0) + 1);

		const withRows = ALL.filter((day) => day.length > 0).length;

		console.log(
			`[rendered] ${withRows} of ${DAYS.length} days rendered at least one row; ` +
				`${ALL.flat().length} options in total`,
		);

		for (const [axis, count] of [...rows].sort((a, b) => b[1] - a[1]))
			console.log(`  ${axis}: ${count} rows, ${options.get(axis)} options`);
	});

	/**
	 * The defect as seen: an option that prints the row's own reading back. The
	 * improvement column says how much relief the card is failing to show, in the
	 * axis's own badness points (percentage points for every axis but Energy
	 * Balance, where it is distance from the 50 target).
	 */
	it('measures options whose printed reading equals the row’s (MATH.md §14/§25)', () => {
		const axes = new Set(ALL.flat().map((option) => option.axis));

		for (const axis of [...axes].sort()) {
			const options = ALL.flat().filter((option) => option.axis === axis);
			const invisible = options.filter((option) => option.isInvisible);

			console.log(
				`[same reading] ${axis}: ${invisible.length} of ${options.length} options ` +
					`(${((invisible.length / options.length) * 100).toFixed(1)}%), ` +
					`improvement hidden: ${spread(invisible.map((option) => option.improvement))}`,
			);

			// The tail, spelled out: a rate says how often, and only the raw readings
			// say what the worst case actually looks like on the card.
			const [worst] = [...invisible].sort((a, b) => b.improvement - a.improvement);

			if (worst)
				console.log(
					`  worst: ${worst.beforeValue.toFixed(1)} → ${worst.afterValue.toFixed(1)}, ` +
						`both printed “${worst.before}”`,
				);
		}
	});

	/**
	 * What suppressing them would cost. A row whose every option prints the row's
	 * own reading is the one the user cannot act on at all; dropping those options
	 * deletes the finding with them, along with the largest improvement the day
	 * had to offer on that axis.
	 */
	it('measures the rows suppression would empty (MATH.md §14)', () => {
		const byRow = new Map<string, Priced[]>();

		ALL.forEach((day, index) =>
			day.forEach((option) => {
				const key = `${index}:${option.axis}`;

				byRow.set(key, [...(byRow.get(key) ?? []), option]);
			}),
		);

		const axes = new Set(ALL.flat().map((option) => option.axis));

		for (const axis of [...axes].sort()) {
			const rows = [...byRow.values()].filter((row) => row[0].axis === axis);
			const emptied = rows.filter((row) => row.every((option) => option.isInvisible));

			const partial = rows.filter(
				(row) =>
					row.some((option) => option.isInvisible) && row.some((option) => !option.isInvisible),
			);

			console.log(
				`[suppression] ${axis}: ${emptied.length} of ${rows.length} rows lose every option ` +
					`(${partial.length} lose some), best improvement discarded: ${spread(
						emptied.map((row) => Math.max(...row.map((option) => option.improvement))),
					)}`,
			);
		}
	});
});
