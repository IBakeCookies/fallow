/**
 * The SHAPE of what `suggestBudgetCurve` hands the chart — the measurement
 * behind §8.12's "why the marginal is a hull slope and not a step difference".
 *
 * `plan(b)` books whole §8.8 steps, so `dayValue` is a staircase. Every arm is
 * measured here over the same 60 days, so the comparison is reproducible rather
 * than remembered:
 *
 *   RAW      — the step difference of `dayValue`, the marginal the majorant
 *              replaced. Reconstructed from `dayValue` itself; the model no
 *              longer computes it.
 *   MAJORANT — the shipped `valuePerHour`, and the three properties §8.12's copy
 *              rests on: non-increasing, last-positive-step == recommendation,
 *              and telescoping to the level.
 *   SENTINEL — the rejected seeding of the level, `-Infinity` in place of the
 *              do-nothing day, run per λ₀ off its own sweep: what it recommends
 *              on the days it disagrees, and that it disagrees nowhere else.
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
	DEFAULT_STEP_HOURS,
	evaluateSchedule,
	optimizeSchedule,
	suggestBudgetCurve,
} from '$lib/business/model/zenith-energy';
import { DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import { toEnergyTask } from '$lib/business/model/metric/calculation';
import type { EnergyParams, EnergyTaskInput } from '$lib/business/model/zenith-energy';
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

const STEP = DEFAULT_STEP_HOURS;

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

/**
 * The SENTINEL arm's sweep: the same lattice and the same common-horizon
 * scoring as `suggestBudgetCurve`, with the level seeded from `-Infinity`
 * rather than from the do-nothing day, and the budget it names. The shipped
 * level floors at do-nothing, so this cannot be read back off `dayValue` the
 * way the RAW arm is — it takes its own solves.
 */
function reconstructSeededKnee(
	tasks: EnergyTaskInput[],
	params: EnergyParams,
): {
	budgetHours: number | null;
	workHours: number;
} {
	let best = -Infinity;
	let budgetHours: number | null = null;
	let workHours = 0;

	for (let budget = STEP; budget <= BUDGET_CURVE_MAX_HOURS + 1e-9; budget += STEP) {
		const plan = optimizeSchedule(tasks, budget, params, DEFAULT_USER_CONSTANTS);

		const scored = evaluateSchedule(
			plan.blocks,
			tasks,
			BUDGET_CURVE_MAX_HOURS,
			params,
			DEFAULT_USER_CONSTANTS,
		).objective;

		if (scored > best) {
			best = scored;
			budgetHours = budget;
			workHours = plan.evaluation.workHours;
		}
	}

	return {
		budgetHours,
		workHours,
	};
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
		// use every hour you give it".
		// SENTINEL arm, the second reconstruction: the rejected seeding, `best` from
		// -Infinity instead of the do-nothing day, run off its own sweep because the
		// shipped level floors at do-nothing and cannot be read back through. On a
		// FLAT day — the level never leaves that floor — it names a budget the
		// shipped rule refuses; everywhere else the two must agree, and that control
		// is what says the seeding costs nothing but this branch.
		for (const l of [0.2, 0.5, 0.75, 1, 1.25, 1.5, 2, 3]) {
			const params = {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: l,
			};

			let interior = 0;
			let kneeSum = 0;
			let noWork = 0;
			let flat = 0;
			let sentinelFirstStep = 0;
			let sentinelNoWork = 0;
			let elsewhereAgreed = 0;
			let elsewhere = 0;

			for (const day of drawDays(60, 20260808)) {
				const tasks = day.map(toEnergyTask);
				const curve = suggestBudgetCurve(tasks, params, DEFAULT_USER_CONSTANTS);

				const doNothing = evaluateSchedule(
					[],
					tasks,
					BUDGET_CURVE_MAX_HOURS,
					params,
					DEFAULT_USER_CONSTANTS,
				).objective;

				const seeded = reconstructSeededKnee(tasks, params);
				// Same top-of-range null as the shipped rule: only the seed differs.
				const lastSwept = curve.points[curve.points.length - 1].budgetHours;

				const sentinel =
					seeded.budgetHours !== null && seeded.budgetHours < lastSwept - 1e-9
						? seeded.budgetHours
						: null;

				const isFlat = curve.points.every((p) => Math.abs(p.dayValue - doNothing) < 1e-12);

				const agrees =
					sentinel === null || curve.recommendedHours === null
						? sentinel === curve.recommendedHours
						: Math.abs(sentinel - curve.recommendedHours) < 1e-9;

				if (curve.points.every((p) => p.workHours === 0)) noWork++;

				if (isFlat) {
					flat++;
					sentinelFirstStep += sentinel !== null && Math.abs(sentinel - STEP) < 1e-9 ? 1 : 0;
					sentinelNoWork += sentinel !== null && seeded.workHours === 0 ? 1 : 0;
				} else {
					elsewhere++;
					elsewhereAgreed += agrees ? 1 : 0;
				}

				if (curve.recommendedHours === null) continue;

				interior++;
				kneeSum += curve.recommendedHours;
			}

			const mean = interior ? `, mean ${(kneeSum / interior).toFixed(2)}h` : '';

			console.log(
				`λ₀=${l}: recommendation on ${interior}/60 days${mean}; no work at any budget on ${noWork}/60`,
			);

			console.log(
				`  -Infinity seed: flat days ${flat}/60, of which it names the first swept step on ` +
					`${sentinelFirstStep}/${flat} and books 0h there on ${sentinelNoWork}/${flat}; ` +
					`agrees with the shipped knee on ${elsewhereAgreed}/${elsewhere} of the rest`,
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
