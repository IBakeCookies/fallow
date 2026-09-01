/**
 * Measurement behind `eslint.config.js`'s `max-depth: ['error', 4]` cap on
 * `zenith.ts`: what it costs to fold `improveWithTransfers`'s donor×give
 * nesting into one loop over materialized (donor, give) pairs. That fold is the
 * obvious way to satisfy `max-depth: 3`, it was committed once (2fe64f0) and
 * reverted (78bf74b), and without a number the cap reads as a preference.
 *
 * A probe, not a test: the answer is a ratio that moves with the allocator, the
 * corpus and the box, and in the suite that is a red build carrying no
 * regression.
 *
 * The variant is generated from TODAY'S `zenith.ts` by replacing the donation
 * block between its two anchors, so this measures the shipped code rather than
 * a copy that can drift; if either anchor stops matching exactly once, the
 * probe throws instead of quietly measuring the wrong thing. Both modules are
 * checked to return byte-identical plans over the corpus before either is
 * timed — a timing comparison between two different answers is meaningless.
 *
 * Timed in situ, not as a microbenchmark of the enumeration: `greedyAllocateBlocks`
 * dominates each pass, so the enumeration's share is the whole question and an
 * isolated benchmark of it would report a far larger ratio than the allocator
 * ever pays.
 *
 * RESULT — the fold is slower on both regimes, on every run. Three runs on an
 * idle AMD Ryzen 7 7800X3D (4 cores, node v22.14.0; a contended run is
 * discarded, not averaged in) read the FOLDED/NESTED ratio at:
 *
 *   n 4-8,  budget 3-9 h    1.11x - 1.34x   1419 of 1500 days pool-bound
 *   n 6-11, budget 4-10 h   1.09x - 1.29x    381 of  400 days pool-bound
 *
 * Those are the ratio EXTREMES over the three runs — worst-case nested against
 * best-case folded and back. They are the quotable band; the ratio of two
 * medians is not, and the per-run medians (1.24x-1.26x and 1.16x-1.21x) sit
 * well inside it. Read the conclusion off the LOW end, where the fold still
 * costs 1.09x: the sign holds across the whole band, the magnitude does not.
 *
 * The spread WITHIN a run and the spread BETWEEN runs are different quantities.
 * Each ms cell prints its own ±2%-±5%; the bands above are ±9% and ±8% around
 * their midpoints, so a single run understates the uncertainty by about half.
 *
 * Two causes, both proportional to how hard the pool binds: the pair list is
 * rebuilt on each of `4·budgetBlocks + 16` improvement passes, and the nested
 * form's `others` hoist is lost, so `subset.filter((i) => i !== donor)` runs
 * once per donation instead of once per donor.
 */
import { describe, it } from 'vitest';
import { cpus, loadavg } from 'node:os';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import type * as Zenith from '$lib/business/model/zenith';
import type { PooledTaskInput } from '$lib/business/model/zenith';

type Allocator = typeof Zenith;

const SOURCE = 'src/lib/business/model/zenith.ts';
const VARIANT = 'scripts/zenith-folded.tmp.ts';
/** First line of the nested donation block, and the comment that follows it. */
const OPEN = '\t\tfor (const donor of subset) {';
const CLOSE = '\t\t// Admission move:';

/** 2fe64f0's donation block, verbatim — the fold this probe prices. */
const FOLDED = `\t\tconst donations = subset.flatMap((donor) =>
\t\t\t[...new Set([1, 2, blocks[donor]])]
\t\t\t\t.filter((give) => give > 0 && give <= blocks[donor])
\t\t\t\t.map((give) => ({
\t\t\t\t\tdonor,
\t\t\t\t\tgive,
\t\t\t\t})),
\t\t);

\t\tfor (const { donor, give } of donations) {
\t\t\tconst trial = [...blocks];
\t\t\ttrial[donor] -= give;

\t\t\tconst refilled = greedyAllocateBlocks(
\t\t\t\ttasks,
\t\t\t\tsubset.filter((i) => i !== donor),
\t\t\t\tbudgetBlocks,
\t\t\t\tpoolCog,
\t\t\t\tpoolPhys,
\t\t\t\ttrial,
\t\t\t).blocks;

\t\t\tconst refillValue = planValue(tasks, refilled);

\t\t\tif (refillValue > bestValue + 1e-12) {
\t\t\t\tbestBlocks = refilled;
\t\t\t\tbestValue = refillValue;
\t\t\t}
\t\t}

`;

/** Writes the folded variant beside the source, or throws if the anchors moved. */
function writeFoldedVariant(): void {
	const source = readFileSync(SOURCE, 'utf8');
	const open = source.indexOf(OPEN);
	const close = source.indexOf(CLOSE);

	if (open === -1 || source.indexOf(OPEN, open + 1) !== -1)
		throw new Error(`${SOURCE}: expected exactly one ${JSON.stringify(OPEN)}`);

	if (close === -1 || close < open)
		throw new Error(`${SOURCE}: no ${JSON.stringify(CLOSE)} after it`);

	writeFileSync(VARIANT, source.slice(0, open) + FOLDED + source.slice(close));
}

interface Day {
	tasks: PooledTaskInput[];
	budget: number;
	pools: { cognitiveHours: number; physicalHours: number };
	switchCost: number;
}

/** Pool-bound days: the regime where the improvement pass actually runs. */
function corpus(count: number, nlo: number, nhi: number, blo: number, bhi: number): Day[] {
	let seed = 13579;
	const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

	return Array.from(
		{
			length: count,
		},
		() => {
			const n = nlo + Math.floor(rnd() * (nhi - nlo + 1));

			return {
				tasks: Array.from(
					{
						length: n,
					},
					(_, i) => ({
						title: `t${i}`,
						difficulty: 1 + Math.floor(rnd() * 10),
						enjoyment: 1 + Math.floor(rnd() * 10),
						cognitiveWeight: Math.round(rnd() * 10) / 10,
						physicalWeight: Math.round(rnd() * 10) / 10,
					}),
				),
				budget: blo + Math.floor(rnd() * (bhi - blo) * 4) / 4,
				pools: {
					cognitiveHours: Math.round(rnd() * 25) / 10,
					physicalHours: Math.round(rnd() * 25) / 10,
				},
				switchCost: [0, 0.25, 0.5][Math.floor(rnd() * 3)],
			};
		},
	);
}

/**
 * Checks the two modules agree on every day and returns how many of those days
 * the pools actually bind on — this probe's occurrence counter. A corpus where
 * the improvement pass never runs would report a ratio of 1 and mean nothing by
 * it, and a timing comparison between two different answers measures nothing.
 */
function agreeAndCountPoolBound(
	plan: (mod: Allocator, d: Day) => { allocatedHours: number }[],
	nested: Allocator,
	folded: Allocator,
	days: readonly Day[],
	label: string,
): number {
	let bound = 0;

	for (const d of days) {
		const a = plan(nested, d);

		if (JSON.stringify(a) !== JSON.stringify(plan(folded, d)))
			throw new Error(`${label}: plans differ — timing is meaningless`);

		const cog = a.reduce((s, x, i) => s + x.allocatedHours * d.tasks[i].cognitiveWeight, 0);
		const phys = a.reduce((s, x, i) => s + x.allocatedHours * d.tasks[i].physicalWeight, 0);

		if (cog > d.pools.cognitiveHours - 0.26 || phys > d.pools.physicalHours - 0.26) bound++;
	}

	return bound;
}

const REPS = 7;

interface Timing {
	median: number;
	min: number;
	max: number;
}

/** Median of `REPS` after a discarded warm-up, with the extremes it came from. */
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
	`${t.median.toFixed(0)} ms ±${Math.round((50 * (t.max - t.min)) / t.median)}%`;

describe('max-depth fold cost', () => {
	it('prices folding the donor×give nesting into materialized pairs', async () => {
		writeFoldedVariant();

		try {
			const nested = await import('$lib/business/model/zenith');
			const folded = await import(`${process.cwd()}/${VARIANT}`);

			console.log(`[box] ${cpus()[0].model}, ${cpus().length} cores, node ${process.version}`);

			console.log(
				`[box] load average ${loadavg()
					.map((l) => l.toFixed(2))
					.join(' ')} — read this on an IDLE box`,
			);

			for (const [label, days] of [
				['n 4-8,  budget 3-9 h ', corpus(1500, 4, 8, 3, 9)],
				['n 6-11, budget 4-10 h', corpus(400, 6, 11, 4, 10)],
			] as const) {
				const plan = (mod: Allocator, d: Day) =>
					mod.calculatePooledAllocations(
						d.tasks,
						d.budget,
						d.pools,
						mod.DEFAULT_USER_CONSTANTS,
						d.switchCost,
					);

				const bound = agreeAndCountPoolBound(plan, nested, folded as typeof nested, days, label);

				const run = (mod: Allocator) => () => {
					for (const d of days) plan(mod, d);
				};

				const n = timeMs(run(nested));
				const f = timeMs(run(folded as Allocator));

				console.log(
					`[cost] ${label}  ${days.length} days, ${bound} pool-bound\n` +
						`         NESTED (shipped) ${ms(n)}\n` +
						`         FOLDED           ${ms(f)}\n` +
						`         ratio band this run ${(f.min / n.max).toFixed(2)}x - ${(f.max / n.min).toFixed(2)}x` +
						`  (medians ${(f.median / n.median).toFixed(2)}x — do not quote this alone)`,
				);
			}
		} finally {
			rmSync(VARIANT, {
				force: true,
			});
		}
	});
});
