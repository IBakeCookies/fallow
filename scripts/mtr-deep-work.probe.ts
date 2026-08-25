/**
 * What is true of the Deep Work row (`calculateDeepWorkRatio`) over a day space
 * the allocator actually produces.
 *
 * The metric had no MATH.md entry at first, so nothing measured: (a) a hard
 * `mentalDifficulty >= 7` cut, which counts a full hour or none of it, and (b)
 * `getBandBiggerBetter`, which calls ≥75% of the day in high-mental work
 * "Optimal". Five questions:
 *
 * 1. **Reachable range and band occupancy** under the old bigger-better band.
 * 2. **Does the green band contradict its neighbours?** Deep Work 'success'
 *    while Cognitive Load bands warning/critical, or Burnout Risk does.
 * 3. **The cliff.** Largest jump in the reading from moving ONE task's mental
 *    slider by one point, step cut vs the ramp.
 * 4. **Where the day turns depleting.** Burnout Risk by deep-work decile —
 *    what the new band's upper edge is calibrated against.
 * 5. **Slack.** The same task list against a widening budget.
 *
 * A probe, not a test: every rate below moves whenever the allocator moves.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateBurnoutRisk,
	calculateCognitiveLoad,
	calculateDeepWorkRatio,
	calculateSuggestedTasks,
	type SuggestedTask,
} from '$lib/business/model/metric/calculation';
import { DEFAULT_CAPACITY_POOLS, DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
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

const task = (id: number, mental: number, physical: number, enjoyment: number): Task => ({
	id,
	title: `t${id}`,
	mentalDifficulty: mental,
	physicalDifficulty: physical,
	enjoyment,
	createdAt: '2026-08-07',
	completed: false,
});

interface Day {
	tasks: Task[];
	availableHours: number;
	switchCost: number;
}

const dump = (d: Day): string =>
	`m/p/e ${d.tasks.map((t) => `${t.mentalDifficulty}/${t.physicalDifficulty}/${t.enjoyment}`).join(' ')} | ${d.availableHours}h | s=${Math.round(d.switchCost * 60)}m`;

const plan = (d: Day): SuggestedTask[] =>
	calculateSuggestedTasks(
		d.tasks,
		d.availableHours,
		d.switchCost,
		DEFAULT_CAPACITY_POOLS,
		DEFAULT_USER_CONSTANTS,
	);

/** Enjoyment starts at 1 in the form (a 0 there is a division by zero, §2). */
function randomDays(count: number, seed: number): Day[] {
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
					length: pick(1, 7, 1),
				},
				(_, index) => task(index + 1, pick(0, 10, 1), pick(0, 10, 1), pick(1, 10, 1)),
			),
			availableHours: pick(0.25, 12, 0.25),
			switchCost: pick(5, 30, 5) / 60,
		}),
	);
}

const DAYS = randomDays(2000, 20260807);

/** The reading as it was before: a full hour counts, or none of it. */
const stepReading = (p: SuggestedTask[], budget: number): number =>
	!budget || !p.length
		? 0
		: (p.filter((t) => t.mentalDifficulty >= 7).reduce((s, t) => s + t.suggestedHours, 0) /
				budget) *
			100;

const biggerBetter = (v: number) =>
	v >= 75 ? 'success' : v >= 50 ? 'neutral' : v >= 25 ? 'warning' : 'critical';

/** `presentation/utils/band.ts`: the two neighbours' own out-of-band rules —
 *  load only reads as a problem past 70, burnout risk past 50. */
const loadIsBad = (v: number) => v > 70;
const riskIsBad = (v: number) => v > 50;

describe('Deep Work over a day space', () => {
	it('1. reachable range and band occupancy under the old bigger-better band', () => {
		const readings = DAYS.map((d) => stepReading(plan(d), d.availableHours));

		const counts: Record<string, number> = {
			success: 0,
			neutral: 0,
			warning: 0,
			critical: 0,
		};

		for (const v of readings) counts[biggerBetter(v)] += 1;

		const sorted = [...readings].sort((a, b) => a - b);
		const q = (f: number) => sorted[Math.floor(f * (sorted.length - 1))].toFixed(1);

		console.log(
			`1. min ${q(0)} p50 ${q(0.5)} p90 ${q(0.9)} max ${q(1)} | ` +
				`old bands success ${counts.success} neutral ${counts.neutral} warning ${counts.warning} critical ${counts.critical} of ${DAYS.length}`,
		);
	});

	it('2. the green band against Cognitive Load and Burnout Risk', () => {
		let green = 0;
		let vsLoad = 0;
		let vsBurnout = 0;
		let worst = '';
		let worstRisk = -1;

		for (const d of DAYS) {
			const p = plan(d);
			const deep = stepReading(p, d.availableHours);

			if (biggerBetter(deep) !== 'success') continue;

			green += 1;

			const load = calculateCognitiveLoad(p, d.availableHours);
			const risk = calculateBurnoutRisk(p, d.availableHours, d.switchCost);
			const riskBad = riskIsBad(risk);

			if (loadIsBad(load)) vsLoad += 1;

			if (riskBad) vsBurnout += 1;

			if (riskBad && risk > worstRisk) {
				worstRisk = risk;
				worst = `deep ${deep.toFixed(0)}% load ${load.toFixed(0)}% risk ${risk}% — ${dump(d)}`;
			}
		}

		console.log(
			`2. of ${green} days the old band coloured 'Optimal': ${vsLoad} (${((vsLoad / green) * 100).toFixed(0)}%) ` +
				`carry an out-of-band Cognitive Load, ${vsBurnout} (${((vsBurnout / green) * 100).toFixed(0)}%) an out-of-band Burnout Risk`,
		);

		console.log(`   worst: ${worst}`);
	});

	// The allocation is held fixed: re-planning moves hours around, and that
	// discontinuity is the allocator's, not the metric's. What is measured here
	// is what the READING does to one slider point on an unchanged plan.
	it('3. one slider point on a fixed plan: the step cut vs the ramp', () => {
		let stepJump = 0;
		let rampJump = 0;
		let stepWorst = '';
		let stepCrossings = 0;
		let comparisons = 0;

		for (const d of DAYS) {
			const p = plan(d);

			for (let i = 0; i < p.length; i += 1) {
				if (p[i].mentalDifficulty >= 10) continue;

				comparisons += 1;

				const nudged = p.map((t, j) =>
					j === i
						? {
								...t,
								mentalDifficulty: t.mentalDifficulty + 1,
							}
						: t,
				);

				const dStep = Math.abs(
					stepReading(nudged, d.availableHours) - stepReading(p, d.availableHours),
				);

				const dRamp = Math.abs(
					calculateDeepWorkRatio(nudged, d.availableHours) -
						calculateDeepWorkRatio(p, d.availableHours),
				);

				if (dStep > 0) stepCrossings += 1;

				if (dStep > stepJump) {
					stepJump = dStep;
					stepWorst = `task ${i + 1} m${p[i].mentalDifficulty}→${p[i].mentalDifficulty + 1} (${p[i].suggestedHours}h) — ${dump(d)}`;
				}

				if (dRamp > rampJump) rampJump = dRamp;
			}
		}

		console.log(
			`3. worst single-point slider move: step ${stepJump.toFixed(1)} pp, ramp ${rampJump.toFixed(1)} pp | ` +
				`the step moved the reading at all on ${stepCrossings}/${comparisons} moves (only the 6→7 crossing does)`,
		);

		console.log(`   step worst: ${stepWorst}`);
	});

	it('4. Burnout Risk by deep-work decile (the new upper edge)', () => {
		const rows = DAYS.map((d) => {
			const p = plan(d);

			return {
				deep: calculateDeepWorkRatio(p, d.availableHours),
				risk: calculateBurnoutRisk(p, d.availableHours, d.switchCost),
			};
		});

		for (let lo = 0; lo < 100; lo += 10) {
			const bin = rows.filter((r) => r.deep >= lo && r.deep < lo + 10).map((r) => r.risk);

			if (!bin.length) continue;

			bin.sort((a, b) => a - b);

			const median = bin[Math.floor(bin.length / 2)];
			const outOfBand = bin.filter(riskIsBad).length;

			console.log(
				`4. deep ${String(lo).padStart(3)}–${lo + 10}%: n=${String(bin.length).padStart(4)} ` +
					`median risk ${String(median).padStart(3)}% | risk>50 on ${((outOfBand / bin.length) * 100).toFixed(0)}%`,
			);
		}
	});

	it('5. the same work against a widening budget', () => {
		const tasks = [task(1, 9, 2, 6), task(2, 8, 1, 5), task(3, 3, 3, 7)];

		for (const availableHours of [2, 4, 6, 8, 10, 12]) {
			const d: Day = {
				tasks,
				availableHours,
				switchCost: 15 / 60,
			};

			const p = plan(d);
			const deep = calculateDeepWorkRatio(p, availableHours);
			const allocated = p.reduce((s, t) => s + t.suggestedHours, 0);

			console.log(
				`5. budget ${String(availableHours).padStart(2)}h: allocated ${allocated.toFixed(2)}h → ` +
					`deep ${deep.toFixed(1)}% (old band ${biggerBetter(deep)})`,
			);
		}
	});
});
