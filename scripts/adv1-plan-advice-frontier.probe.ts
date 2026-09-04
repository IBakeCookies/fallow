/**
 * The plan-advice numbers that had no committed sweep behind them.
 *
 * `plan-advice.probe.ts` backs the priced-lever signs and the pure trim. Four
 * more numbers came from the 200-day sweep of 2026-07-28, which was thrown
 * away — the same failure mode that let "the trim is free" survive:
 *
 *   - `zenithGain.optimized` equals Σ avgProductivity over the funded tasks
 *     "to the last digit" (quoted at n = 5). `plan-advice.ts` itself says the
 *     two agree only "to within float noise", so which is it.
 *   - Σ P̄ is monotone non-decreasing in the budget: `budget + 1` "raised plan
 *     value on 128 of 200 days and lowered it on none".
 *   - Quarter-rounding the trim: "132 of 200" days had off-quarter slack,
 *     rounding down was no longer free on "58 of 200", rounding up let the
 *     dedup filter delete the lever on "50 of 200".
 *   - The frontier is monotone in plan value by construction ("0 of 1580"),
 *     and "16 of 1580" frontiers exceeded 3 options, "longest 5".
 *
 * And one number that never had a day at all: the zero-baseline defect quoted
 * a "2.568" with no recorded fixture, so the plan value `set-budget 1h`
 * reaches from a 0 h budget is measured here on the suite's own grind day.
 *
 * And one number the frontier's own admission rule rests on: the smallest
 * improvement it admits — 9.7657e-4, on Energy Balance, 9.8e5x the floor — so
 * `IMPROVEMENT_NOISE_FLOOR` is shown to sit orders of magnitude below the
 * readings rather than inside them. Priced on the gate's own quantity and not on
 * `after - before`, which runs 8.2x larger and would have overstated that margin.
 *
 * Same generator, seed and day count as `plan-advice.probe.ts` (600 days,
 * seed 42), so these counts compose with its 404 trim levers and 4287 priced
 * frontiers rather than describing a different sample.
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';
import {
	calculateDailyMetrics,
	type DailyMetricsInput,
} from '$lib/business/model/metric/daily-metrics';
import {
	improvementOf,
	suggestPlanAdjustments,
	type AdviceAxis,
	type AdviceLever,
} from '$lib/business/model/metric/plan-advice';
import { DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
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
/**
 * The suite's own grind day, mirrored: `GRIND` and `grindDay` in
 * `src/lib/business/model/metric/plan-advice.test.ts` — the same three tasks,
 * the same 0.25 h switch cost, and `DEFAULT_CAPACITY_POOLS` (4 h / 6 h).
 */
const GRIND = [task(1, 10, 2, 1), task(2, 9, 1, 2), task(3, 2, 9, 2)];
const grindDay = (budget: number) => day(GRIND, budget, 0.25, 4, 6);
/** The same one-minute tolerance `buildLevers` drops a budget lever under. */
const MIN_HOUR_STEP = 1 / 60;
/**
 * The same floor `paretoOptions` admits an option over, spelled as a literal and
 * deliberately not imported: an assertion against the constant it bounds moves
 * with it and pins nothing (docs/testing.md). Drift is the perturbation sweep's
 * to catch, not this file's.
 */
const IMPROVEMENT_NOISE_FLOOR = 1e-9;

/** Every improvement the frontier admitted on one day, as the gate scored it. */
const admittedImprovements = (input: DailyMetricsInput) => {
	const baseline = calculateDailyMetrics(input);

	return suggestPlanAdjustments(input, baseline).findings.flatMap((finding) =>
		[...finding.options, ...(finding.unpriced ? [finding.unpriced] : [])].map((option) => ({
			axis: finding.axis,
			improvement: improvementOf(
				finding.axis,
				baseline,
				calculateDailyMetrics(applyLever(input, option.lever)),
			),
			// The quantity a card would have been priced on instead, so the gap
			// between the two is measured rather than asserted.
			move: Math.abs(option.after - finding.before),
		})),
	);
};

/** `applyLever`'s two branches, which the module does not export. */
const applyLever = (input: DailyMetricsInput, lever: AdviceLever): DailyMetricsInput =>
	lever.kind === 'defer-task'
		? {
				...input,
				tasks: input.tasks.filter((task) => task.id !== lever.taskId),
			}
		: {
				...input,
				availableHours: lever.hours,
			};

const percentOf = (value: number, base: number) =>
	base > 0 ? Math.round(((value - base) / base) * 1000) / 10 : null;

/** Distance in representable doubles — 0 is "to the last digit". */
function ulpsApart(a: number, b: number): number {
	if (a === b) return 0;

	const buffer = new DataView(new ArrayBuffer(8));

	const bits = (value: number) => {
		buffer.setFloat64(0, value);

		return buffer.getBigUint64(0);
	};

	const difference = bits(Math.max(a, b)) - bits(Math.min(a, b));

	return Number(difference < 0n ? -difference : difference);
}

describe('plan advice — the frontier and the levers', () => {
	/**
	 * The whole cost column derives from "a plan's value is Σ P̄ over the funded
	 * tasks, and it is already computed". The advisor reads
	 * `zenithGain.optimized`; the budget marginal instead sums per-task
	 * `avgProductivity` differences, which is only sound if the two are the same
	 * number. They are the same SUM, but not summed in the same order — the plan
	 * comes back priority-sorted — so exactness is a measurement, not a given.
	 */
	it('measures Σ P̄ against the funded per-task sum', () => {
		let exact = 0;
		let counted = 0;
		let worstUlps = 0;
		let worstRelative = 0;

		for (const input of DAYS) {
			const metrics = calculateDailyMetrics(input);

			if (metrics.zenithGain.optimized <= 0) continue;

			const sum = metrics.suggestedTasks
				.filter((task) => task.suggestedHours > 0)
				.reduce((total, task) => total + task.avgProductivity, 0);

			counted++;

			const ulps = ulpsApart(sum, metrics.zenithGain.optimized);

			if (ulps === 0) exact++;

			worstUlps = Math.max(worstUlps, ulps);

			worstRelative = Math.max(
				worstRelative,
				Math.abs(sum - metrics.zenithGain.optimized) / metrics.zenithGain.optimized,
			);
		}

		console.log(
			`[Σ P̄] ${counted} funded days: ${exact} bit-exact, worst ${worstUlps} ulps, worst relative ${worstRelative.toExponential(1)}`,
		);

		// The claim the per-task decomposition actually needs: the two agree
		// far inside anything the card can render, whatever the summation order.
		expect(worstRelative).toBeLessThan(1e-12);
	});

	/**
	 * The premise for keeping `budget + 1` off the priced frontier. The exact
	 * optimum is monotone non-decreasing in the budget; the pooled path is a
	 * heuristic, which is why the budget marginal floors its own gain at 0.
	 */
	it('measures Σ P̄ against one extra budget hour', () => {
		let raised = 0;
		let lowered = 0;
		let flat = 0;
		let worst = 0;

		for (const input of DAYS) {
			const baseline = calculateDailyMetrics(input);

			const wider = calculateDailyMetrics({
				...input,
				availableHours: baseline.budgetHours + 1,
			});

			const before = baseline.zenithGain.optimized;
			const after = wider.zenithGain.optimized;

			if (after > before) raised++;
			else if (after < before) {
				lowered++;
				worst = Math.min(worst, percentOf(after, before) ?? 0);
			} else flat++;
		}

		console.log(
			`600 seeded days: budget + 1 raised Σ P̄ on ${raised}, lowered on ${lowered} (worst ${worst}%), flat on ${flat}`,
		);
	});

	/**
	 * The rounding defect, re-measured by re-applying the rounding the fix
	 * removed: `Math.round(h * 4) / 4` on `budget − planSlack`.
	 */
	it('measures quarter-rounding the trim', () => {
		let levers = 0;
		let offQuarter = 0;
		let roundedDown = 0;
		let notFree = 0;
		let deleted = 0;

		for (const input of DAYS) {
			const baseline = calculateDailyMetrics(input);
			const slack = baseline.planSlackHours;

			if (slack < MIN_HOUR_STEP) continue;

			levers++;

			const trimmed = Math.max(0, baseline.budgetHours - slack);
			const rounded = Math.round(trimmed * 4) / 4;

			if (Math.abs(trimmed - rounded) > 1e-9) offQuarter++;

			// Rounding UP to the budget is what the one-minute dedup then deletes.
			if (Math.abs(rounded - baseline.budgetHours) < MIN_HOUR_STEP) {
				deleted++;
				continue;
			}

			if (rounded >= trimmed - 1e-9) continue;

			roundedDown++;

			const value = calculateDailyMetrics({
				...input,
				availableHours: rounded,
			}).zenithGain.optimized;

			if ((percentOf(value, baseline.zenithGain.optimized) ?? 0) < 0) notFree++;
		}

		console.log(
			`[rounding] ${levers} trim levers: ${offQuarter} off-quarter, ${roundedDown} rounded down (${notFree} of them no longer free), ${deleted} deleted by the dedup`,
		);
	});

	/**
	 * The walk keeps only strictly increasing plan values, so the frontier is
	 * monotone by construction and its LAST row is the cheap option the card must
	 * not truncate away. The length distribution is what says whether truncation
	 * can fire at all.
	 */
	it('measures frontier length and plan-value monotonicity', () => {
		let frontiers = 0;
		let violations = 0;
		let overThree = 0;
		let longest = 0;
		let single = 0;

		for (const input of DAYS)
			for (const finding of suggestPlanAdjustments(input).findings) {
				if (finding.options.length === 0) continue;

				frontiers++;
				longest = Math.max(longest, finding.options.length);

				if (finding.options.length === 1) single++;

				if (finding.options.length > 3) overThree++;

				if (
					finding.options.some(
						(option, index) =>
							index > 0 && option.planValue <= finding.options[index - 1].planValue,
					)
				)
					violations++;
			}

		console.log(
			`${frontiers} priced frontiers: ${violations} not monotone in plan value, ${overThree} over 3 options (longest ${longest}), ${single} single-option`,
		);

		// By construction, not by measurement: the domination walk pushes an option
		// only when its plan value strictly exceeds every option already kept.
		expect(violations).toBe(0);
	});

	/**
	 * The lesson here — a curated fixture can make an ordering assertion pass
	 * VACUOUSLY. The suite's grind day is the fixture in question: at 10 h every
	 * priced frontier is a single option, so there is nothing to order, and the
	 * test had to move to 6 h to have more than one case to bite on.
	 */
	it('measures frontier width on the suite grind fixture', () => {
		for (const budget of [6, 10]) {
			const widths = suggestPlanAdjustments(grindDay(budget))
				.findings.map((finding) => finding.options.length)
				.filter((width) => width > 0);

			console.log(
				`[grind ${budget}h] ${widths.length} priced frontiers, widths ${widths.join('/')}`,
			);
		}
	});

	/**
	 * The zero-baseline defect needs a day, and the "2.568" once quoted for it
	 * had none. At a 0 h budget nothing is funded, so Σ P̄ is 0 and every ratio
	 * against it was rendered as 0% — "costs no plan value" for the one lever that
	 * CREATES all the value there is. `set-budget 1h` is that lever by
	 * construction: at budget 0 the trim and `budget − 1` both clamp onto the
	 * budget and are deduplicated away, and 1 h is wider than the budget, so it
	 * arrives unpriced beside each frontier rather than inside it.
	 */
	it('measures the plan value set-budget 1h reaches from a 0 h budget', () => {
		const zero = grindDay(0);
		const baseline = calculateDailyMetrics(zero);

		const offers = suggestPlanAdjustments(zero).findings.flatMap((finding) =>
			[...finding.options, ...(finding.unpriced ? [finding.unpriced] : [])]
				.filter((option) => option.lever.kind === 'set-budget' && option.lever.hours === 1)
				.map((option) => ({
					axis: finding.axis,
					priced: finding.options.includes(option),
					option,
				})),
		);

		const reached = calculateDailyMetrics({
			...zero,
			availableHours: 1,
		}).zenithGain.optimized;

		console.log(
			`[grind 0h] baseline Σ P̄ ${baseline.zenithGain.optimized}, set-budget 1h reaches ${reached.toFixed(3)} on ${offers.length} axes (${offers.map((offer) => offer.axis).join('/')}), delta ${offers.map((offer) => String(offer.option.planValueDeltaPercent)).join('/')}`,
		);

		// The defect and its fix, as signs and constructions: the baseline has no
		// value to take a ratio of, the lever reaches a positive one anyway, it is
		// the same plan on every axis that offers it, and the delta is null rather
		// than the 0% that read as costless.
		expect(baseline.zenithGain.optimized).toBe(0);
		expect(offers.length).toBeGreaterThan(0);

		for (const { option, priced } of offers) {
			expect(priced).toBe(false);
			expect(option.planValue).toBe(reached);
			expect(option.planValue).toBeGreaterThan(0);
			expect(option.planValueDeltaPercent).toBeNull();
		}
	});

	/**
	 * `IMPROVEMENT_NOISE_FLOOR` needs a gap to sit in, and only one end of it can
	 * be measured from outside: the filter is internal, so the noise it now
	 * rejects is unreachable here and a count of it would read 0 by construction.
	 * The day that produced one is pinned in the suite instead. This measures the
	 * other end — the smallest improvement an option that SURVIVES the floor
	 * makes — which is what says the floor rejects nothing a user would want.
	 *
	 * `improvementOf`, not `after − before`: the gate ranks on badness, and on
	 * Energy Balance and Flow Coverage that is not the reading. Measured both
	 * ways the answer differs by 8.2x, in the safe direction, which is exactly
	 * the margin a floor may not be justified by.
	 */
	it('measures the smallest improvement the frontier admits', () => {
		const smallest = new Map<AdviceAxis, number>();
		let options = 0;
		let smallestMove = Infinity;

		for (const input of DAYS)
			for (const { axis, improvement, move } of admittedImprovements(input)) {
				options++;

				if (move > 0) smallestMove = Math.min(smallestMove, move);

				if (Number.isFinite(improvement))
					smallest.set(axis, Math.min(smallest.get(axis) ?? Infinity, improvement));
			}

		const overall = Math.min(...smallest.values());

		console.log(
			`${options} options over ${smallest.size} axes, smallest admitted improvement ${overall.toExponential(4)} — ${(overall / IMPROVEMENT_NOISE_FLOOR).toExponential(1)}x the floor pinned here`,
		);

		console.log(
			`  smallest reading move ${smallestMove.toExponential(4)} — ${(smallestMove / overall).toFixed(1)}x the improvement, which is why the floor is priced on the gate`,
		);

		for (const [axis, value] of smallest) console.log(`  ${axis} ${value.toExponential(4)}`);

		// Orders of magnitude, not a hair: a floor close to the smallest real
		// improvement would be a threshold on the readings themselves, which is the
		// band's job and not this module's.
		expect(overall).toBeGreaterThan(IMPROVEMENT_NOISE_FLOOR);
	});
});
