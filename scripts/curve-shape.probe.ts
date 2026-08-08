/**
 * The SHAPE of what `suggestBudgetCurve` hands the chart — the measurement
 * behind §8.12's "why the marginal is a hull slope and not a step difference".
 *
 * `plan(b)` books whole §8.8 steps, so `dayValue` is a staircase. Both arms are
 * measured here over the same 60 days, so the comparison is reproducible rather
 * than remembered:
 *
 *   RAW      — the step difference of `dayValue`, which is what first shipped.
 *              Reconstructed here from `dayValue` itself; the model no longer
 *              computes it.
 *   MAJORANT — the shipped `valuePerHour`, and the three properties §8.12's copy
 *              rests on: non-increasing, last-positive-step == recommendation,
 *              and telescoping to the level.
 *
 * It also re-measures the two λ₀-line figures §8.12 quotes, and how often each λ₀
 * lands on the "no window is worth working" branch.
 *
 * Usage: npx vitest run --config vitest.probe.config.ts --disableConsoleIntercept scripts/curve-shape.probe.ts
 */

import { describe, it } from 'vitest';
import {
	BUDGET_CURVE_MAX_HOURS,
	DEFAULT_ENERGY_PARAMS,
	evaluateSchedule,
	suggestBudgetCurve,
} from '$lib/business/model/zenith-energy';
import { DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import { toEnergyTask } from '$lib/business/model/metric/calculation';
import type { Task } from '$lib/data/type';

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;

	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const STEP = 0.75;

function drawDays(count: number, seed: number): Task[][] {
	const random = mulberry32(seed);
	const pick = (min: number, max: number) => min + Math.round(random() * (max - min));

	return Array.from(
		{
			length: count,
		},
		() =>
			Array.from(
				{
					length: pick(1, 6),
				},
				(_, index): Task => ({
					id: index + 1,
					title: `t${index + 1}`,
					mentalDifficulty: pick(1, 10),
					physicalDifficulty: pick(1, 10),
					enjoyment: pick(1, 10),
					createdAt: '2026-08-08',
					completed: false,
				}),
			),
	);
}

describe('budget curve shape', () => {
	it('reports negativity and the zero-crossing index', () => {
		let negatives = 0;
		let totalPlotted = 0;
		let nullRecs = 0;
		const offsets: Record<string, number> = {};

		const tally = (k: string) => {
			offsets[k] = (offsets[k] ?? 0) + 1;
		};

		// RAW arm.
		let rawSawtooth = 0;
		let rawDeclining = 0;
		let rawMaxTouches = 0;
		const rawOffsets: Record<string, number> = {};
		// MAJORANT arm.
		let telescopeWorst = 0;
		let lastPositiveIsKnee = 0;
		let decliningDays = 0;
		let withKnee = 0;

		// One sweep per day, both arms off it: `dayValue` carries the level, so the
		// raw difference the first cut plotted is recoverable without a second solve.
		for (const day of drawDays(60, 20260808)) {
			const tasks = day.map(toEnergyTask);
			const curve = suggestBudgetCurve(tasks, DEFAULT_ENERGY_PARAMS, DEFAULT_USER_CONSTANTS);
			const pts = curve.points;

			// The do-nothing day, which is where both the level and the majorant start.
			const doNothing = evaluateSchedule(
				[],
				tasks,
				BUDGET_CURVE_MAX_HOURS,
				DEFAULT_ENERGY_PARAMS,
				DEFAULT_USER_CONSTANTS,
			).objective;

			const raw = pts.map((p, i) => (p.dayValue - (i ? pts[i - 1].dayValue : doNothing)) / STEP);

			totalPlotted += pts.length;
			negatives += pts.filter((p) => p.valuePerHour < 0).length;

			rawMaxTouches = Math.max(rawMaxTouches, raw.filter((v) => v <= 1e-12).length);

			const rawFirstZero = raw.findIndex((v) => v <= 1e-12);

			if (rawFirstZero >= 0 && raw.slice(rawFirstZero).some((v) => v > 1e-12)) rawSawtooth++;

			if (raw.every((v, i) => i === 0 || v <= raw[i - 1] + 1e-12)) rawDeclining++;

			if (pts.every((p, i) => i === 0 || p.valuePerHour <= pts[i - 1].valuePerHour + 1e-12))
				decliningDays++;

			const total = pts.reduce((sum, p) => sum + p.valuePerHour * STEP, 0);

			telescopeWorst = Math.max(
				telescopeWorst,
				Math.abs(total - (pts[pts.length - 1].dayValue - doNothing)),
			);

			if (curve.recommendedHours === null) {
				nullRecs++;
				continue;
			}

			withKnee++;

			const firstZero = pts.find((p) => p.valuePerHour <= 1e-12);

			tally(
				firstZero === undefined
					? 'never'
					: String(Math.round((firstZero.budgetHours - curve.recommendedHours) / STEP)),
			);

			const rawFirst = raw.findIndex((v) => v <= 1e-12);

			const rawKey =
				rawFirst < 0
					? 'never'
					: String(Math.round((pts[rawFirst].budgetHours - curve.recommendedHours) / STEP));

			rawOffsets[rawKey] = (rawOffsets[rawKey] ?? 0) + 1;

			const lastPositive = [...pts].reverse().find((p) => p.valuePerHour > 1e-12);

			if (
				lastPositive !== undefined &&
				Math.abs(lastPositive.budgetHours - curve.recommendedHours) < 1e-9
			)
				lastPositiveIsKnee++;
		}

		console.log(`plotted points: ${totalPlotted}, negative valuePerHour: ${negatives}`);
		console.log(`null recommendations: ${nullRecs}/60`);

		console.log('RAW step difference — what the first cut plotted:');
		console.log(`  monotonically non-increasing: ${rawDeclining}/60`);
		console.log(`  returns above zero after touching it: ${rawSawtooth}/60`);
		console.log(`  most zero-touches on one day: ${rawMaxTouches}`);

		console.log(
			`  first-zero offset from recommendedHours, in ${STEP}h steps: ${JSON.stringify(rawOffsets)}`,
		);

		console.log('MAJORANT slope — what ships:');
		console.log(`  monotonically non-increasing: ${decliningDays}/60`);
		console.log(`  telescoping error, worst: ${telescopeWorst.toExponential(2)}`);
		console.log(`  last positive step == recommendedHours: ${lastPositiveIsKnee}/${withKnee}`);

		console.log(
			`  first-zero offset from recommendedHours, in ${STEP}h steps: ${JSON.stringify(offsets)}`,
		);

		// §8.12's λ₀-line paragraph: how far a λ₀ line would sit from the actual
		// recommendation, re-measured on the majorant. One task at the e2e day's
		// shape, default λ₀ = 0.5, shipped 12 h cap.
		const e2eDay = suggestBudgetCurve(
			[
				{
					id: 1,
					title: 'Deep work',
					mentalDifficulty: 5,
					physicalDifficulty: 5,
					enjoyment: 5,
					createdAt: '2026-08-08',
					completed: false,
				},
			].map(toEnergyTask),
			DEFAULT_ENERGY_PARAMS,
			DEFAULT_USER_CONSTANTS,
		);

		const lambda = DEFAULT_ENERGY_PARAMS.freeTimeValue;
		const belowLambda = e2eDay.points.find((p) => p.valuePerHour < lambda);

		console.log(
			`e2e-shaped one-task day: recommendedHours=${e2eDay.recommendedHours}, ` +
				`λ₀=${lambda} crossed at ${belowLambda?.budgetHours ?? 'never'}, ` +
				`points below λ₀: ${e2eDay.points.filter((p) => p.valuePerHour < lambda).length}/${e2eDay.points.length}`,
		);

		// The same paragraph's second illustration: two tasks at the form defaults,
		// where the sweep runs to the cap and the card prints "never got there".
		const twoTask = suggestBudgetCurve(
			[1, 2]
				.map((id) => ({
					id,
					title: `t${id}`,
					mentalDifficulty: 5,
					physicalDifficulty: 5,
					enjoyment: 5,
					createdAt: '2026-08-08',
					completed: false,
				}))
				.map(toEnergyTask),
			DEFAULT_ENERGY_PARAMS,
			DEFAULT_USER_CONSTANTS,
		);

		console.log(
			`default two-task day: recommendedHours=${twoTask.recommendedHours}, ` +
				`points below λ₀: ${twoTask.points.filter((p) => p.valuePerHour < lambda).length}/${twoTask.points.length}`,
		);

		// The break-even LINE is fixed at zero by definition; λ₀ moves the CURVE
		// against it. This is the sweep behind that claim, and behind the
		// `energy_free_time_value_hint` slider copy.
		// `noWork` is the second null: the day value never leaves the do-nothing
		// level, so the card says "no window is worth working" instead of "it would
		// use every hour you give it". Counted here because it is what sets how often
		// the pre-fix sentinel knee fired — every one of these days used to come back
		// recommending the first swept step with 0 h of work on it.
		for (const l of [0.2, 0.5, 0.75, 1, 1.25, 1.5, 2, 3]) {
			let interior = 0;
			let kneeSum = 0;
			let noWork = 0;

			for (const day of drawDays(60, 20260808)) {
				const curve = suggestBudgetCurve(
					day.map(toEnergyTask),
					{
						...DEFAULT_ENERGY_PARAMS,
						freeTimeValue: l,
					},
					DEFAULT_USER_CONSTANTS,
				);

				if (curve.points.every((p) => p.workHours === 0)) noWork++;

				if (curve.recommendedHours === null) continue;

				interior++;
				kneeSum += curve.recommendedHours;
			}

			const mean = interior ? `, mean ${(kneeSum / interior).toFixed(2)}h` : '';

			console.log(
				`λ₀=${l}: recommendation on ${interior}/60 days${mean}; no work at any budget on ${noWork}/60`,
			);
		}

		// One concrete day with an interior knee, printed, so the plot's floor is
		// visible as numbers.
		const one = suggestBudgetCurve(
			[
				{
					id: 1,
					title: 'a',
					mentalDifficulty: 7,
					physicalDifficulty: 2,
					enjoyment: 6,
					createdAt: '2026-08-08',
					completed: false,
				},
			].map(toEnergyTask),
			DEFAULT_ENERGY_PARAMS,
			DEFAULT_USER_CONSTANTS,
		);

		console.log(`one-task day, recommendedHours=${one.recommendedHours}`);

		console.log(
			one.points
				.map(
					(p) =>
						`  b=${p.budgetHours.toFixed(2)} work=${p.workHours.toFixed(2)} day=${p.dayValue.toFixed(4)} v/h=${p.valuePerHour.toFixed(4)}`,
				)
				.join('\n'),
		);
	});
});
