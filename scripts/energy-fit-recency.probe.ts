/**
 * Whether drift in a user's true recovery rate r and drain rates α_cog/α_phys
 * dominates the noise of their unweighted whole-history fits (§8.9, §8.7) —
 * the reading that has to exist before the three energy fits are
 * recency-weighted, together or not at all (§5.2). Two numbers move: the
 * smallest drift, as a share of the starting rate, that a year of ☕/🪫 logs
 * reads above a stationary logger's noise ceiling; and the drift past which
 * fitting only the late half of the history beats fitting all of it, against
 * the truth at the history's end.
 *
 * THE GENERATOR IS THE MODEL: a year of ☕/🪫 rows drawn from §8.9's rest law
 * and §8.7's drain law at the day's OWN true rates, ratings quantized to the
 * 0–10 notches the app stores, 🪫 hours on the 45-minute lattice, ☕ breaks in
 * quarter hours and demands on the ten slider notches — every row is one the
 * app could hold, and every 🪫 row starts from a FULL reservoir, exactly as
 * §8.7's fit assumes, so the run measures the estimator and not the model's
 * fresh-start approximation. §8.7's row filter still applies, and it discards
 * rows this generator made fresh: the light logger writes at most one 🪫 a day
 * and loses nothing, the heavy one writes ~1.7 and loses the rest — which is
 * why every light cell below is the pre-filter one and the heavy cells moved. The truth starts AT the defaults (r 0.7,
 * α_cog 0.35, α_phys 0.3) and drifts θ(t) = θ₀·(1 + δ·s(t)) by the same share δ
 * on all three rates, so the ridge prior sits on the START of the drift: the
 * case in which a whole-history fit hides it best. The history is cut at its
 * midpoint day and each half goes through `calibrateEnergyParams` on its own.
 * s(t) is linear over the 365 days, or a step at that SAME day — so the step is
 * the split's best case, each half stationary at exactly one of the two rates,
 * and the linear ramp its worst, each half straddling half the drift. 40 seeds
 * per cell of shape × δ × volume; the row structure is the seed's, so the same
 * logger is re-rated under every drift.
 *
 * Figures below are read off THIS file's own run (2026-09-18). Every one of
 * them is printed by the run; none is computed by hand.
 *
 * SELF-CHECK, printed first and load-bearing (the phi-prequential-skill.probe.ts
 * convention). At δ = 0 and the heavy volume the whole-history fit recovers
 * r 0.7110 against 0.7 (1.6%), α_cog 0.3372 against 0.35 (3.7%) and α_phys
 * 0.3109 against 0.3 (3.6%), all inside the 10% the self-check asserts. If they
 * miss, the generator and the fits disagree and every cell below is noise; they
 * are the only assertions here.
 *
 * READING 1 — the noise ceiling, the largest z = |θ̂_late − θ̂_early| /
 * √(s²_early + s²_late) the 40 STATIONARY seeds of that volume produced, and
 * the smallest δ whose median z clears it, with the share of seeds that do:
 *
 *                   ceiling      linear          step
 *     light r          1.13    δ 0.25  95%   δ 0.10  83%
 *           α_cog      1.38    δ 0.10  98%   δ 0.10 100%
 *           α_phys     1.87    δ 0.50 100%   δ 0.25  98%
 *     heavy r          1.91    δ 0.10  93%   δ 0.10 100%
 *           α_cog      1.71    δ 0.10 100%   δ 0.10 100%
 *           α_phys     1.88    δ 0.25 100%   δ 0.10  60%
 *
 * A 10% drift is already visible on α_cog at both volumes and both shapes; the
 * last rate to surface is α_phys, at 50% under a light logger's linear ramp
 * (median z 5.10 against a 1.87 ceiling — δ 0.25 reads 1.76 and misses). The
 * light logger is 102 ☕ / 158 🪫 over the year, the heavy one 417 ☕ / 628 🪫.
 *
 * The ceiling is not the ceiling of a calibrated z. If each half-fit's std
 * matched its own sampling spread, a stationary z would be |N(0,1)| at every
 * volume, whose median the run prints as its nominal 0.674. Measured, the
 * stationary median z reads r 0.30 / α_cog 0.45 / α_phys 0.73 light and
 * r 0.54 / α_cog 0.49 / α_phys 0.64 heavy: every cell is under the nominal, the
 * heavy ones nearest it (0.49–0.64) and light r and α_cog furthest under
 * (0.30, 0.45). The mechanism is the same ν₀ blend toward σ₀ that
 * §8.7 shares across the three fits — at the smaller n of a light half it
 * widens s past the fits' real spread, while the one ridge prior pulls both
 * halves toward the same point and narrows the numerator. z runs compressed at
 * light volume, and the 40-seed max inherits that compression, which is why the
 * light ceilings sit BELOW the heavy ones on r (1.13 against 1.91) and α_cog
 * (1.38 against 1.71). So volume does not buy a lower z ceiling; what it buys
 * is the z at a given δ — heavy/step α_cog reads 6.79 where light/step reads
 * 3.34 — which is what drops the smallest visible δ in the table above.
 *
 * READING 2 — median |θ̂ − θ(day 365)| for the whole-history fit and for the
 * late half, printed as late ÷ whole. Under 1× is where halving the history
 * pays:
 *
 *     δ                 0.00   0.10   0.25   0.50   1.00
 *     light linear r    1.04×  0.60×  0.58×  0.46×  0.47×
 *                α_cog  1.11×  0.21×  0.33×  0.55×  0.49×
 *                α_phys 1.00×  0.94×  0.71×  0.51×  0.52×
 *           step   r    1.04×  0.25×  0.25×  0.06×  0.04×
 *                α_cog  1.11×  0.19×  0.16×  0.18×  0.14×
 *                α_phys 1.00×  0.45×  0.48×  0.06×  0.05×
 *     heavy linear r    1.05×  0.68×  0.54×  0.45×  0.46×
 *                α_cog  1.03×  0.23×  0.30×  0.50×  0.45×
 *                α_phys 0.98×  0.73×  0.69×  0.48×  0.49×
 *           step   r    1.05×  0.21×  0.11×  0.05×  0.06×
 *                α_cog  1.03×  0.15×  0.22×  0.14×  0.07×
 *                α_phys 0.98×  0.35×  0.43×  0.06×  0.05×
 *
 * The crossover is not at a positive drift: every one of the forty-eight δ > 0
 * cells is under 1×, and the δ = 0 column — the pure price of halving the mass,
 * with nothing to find — runs 0.98×–1.11×. The late half is never the worse of
 * the two once the drift is real, and the step shape, the best case for a
 * midpoint split, is where it runs furthest (0.04× on r at δ = 1 against the
 * linear ramp's 0.47× on the same rate and volume). The absolute errors under
 * those ratios are in rate units: at δ = 1, light/linear r reads 0.3802 for the
 * whole history against 0.1796 for the late half.
 *
 * THE δ = 0 CONTROL. That ≈1× column is measured with the truth sitting exactly
 * on the ridge prior both halves shrink toward, which is the friendliest
 * possible case for halving. The same 40 stationary seeds on a truth 1.5× off
 * the defaults (r 1.050, α_cog 0.525, α_phys 0.450), with nothing to find
 * either:
 *
 *                        r    α_cog   α_phys
 *     light ceiling   1.67     1.76     1.44
 *           median z  0.48     0.57     0.47
 *           whole   0.0049   0.0176   0.0052
 *           late    0.0117   0.0207   0.0048
 *           ratio    2.40×    1.18×    0.92×
 *     heavy ceiling   1.98     3.51     1.84
 *           median z  0.79     0.71     0.80
 *           whole   0.0098   0.0153   0.0034
 *           late    0.0094   0.0152   0.0043
 *           ratio    0.96×    0.99×    1.27×
 *
 * Halving does cost more than ≈1× on r and α_cog when the prior is wrong AND
 * the logger is light — 2.40× and 1.18× there, against 0.96× and 0.99× at the
 * heavy volume, where the data outvotes the prior in each half on its own. So
 * on those two rates the crossover a light logger has to clear is not at δ ≈ 0
 * if their rates sit off the defaults, and reading 2's δ = 0 column understates
 * it. α_phys is the exception and inverts the contrast: 0.92× light against
 * 1.27× heavy, the only control cell where halving pays at the light volume.
 *
 * The ceiling moves with WHERE the truth sits, too, and mostly upward: four of
 * the six cells above are higher than their on-prior twins (heavy α_cog 3.51
 * against 1.71, light r 1.67 against 1.13), the exceptions being both α_phys
 * cells (light 1.44 against 1.87, heavy 1.84 against 1.88). A ceiling measured at the defaults is therefore not a
 * ceiling for a user whose rates sit elsewhere, which is what the closing rule
 * below has to be read against.
 *
 * READING 3 — the conditioning order priced (§5.2). α_cog fitted on the LATE
 * half but conditioned on the WHOLE history's r, against the same half
 * conditioned on its own r, as median |α̂_cog − α_cog(day 365)| and their
 * ratio:
 *
 *     δ                 0.00   0.10   0.25   0.50   1.00
 *     light linear      0.96×  1.45×  1.47×  1.31×  1.43×
 *           step        0.96×  0.99×  0.80×  2.78×  3.89×
 *     heavy linear      0.98×  1.48×  1.65×  1.38×  1.52×
 *           step        0.98×  1.20×  0.22×  3.36×  6.69×
 *
 * Crossing the conditioner costs 1.31×–1.65× on every linear cell at δ > 0 and
 * up to 6.69× on the step at δ = 1, where the whole-history r is an average of
 * two regimes and α bends to absorb it. The third reason is therefore not a
 * theoretical worry: weighting α without weighting r is measurably worse than
 * weighting neither. At δ = 0.1 and 0.25 on the step both errors sit between
 * 0.0023 and 0.0102, and the four ratios there — 0.99× and 0.80× light, 1.20×
 * and 0.22× heavy — read as noise at those magnitudes rather than as a cost.
 *
 * WHAT WOULD FALSIFY WHAT. If the smallest visible δ had come out above 1.0 at
 * the light volume, a year of a real logger's ☕/🪫 rows could not see drift at
 * all and §5.2's first reason would stand on its own. If the δ = 0 columns of
 * reading 2 and of the control had both been far above 1×, halving the mass
 * would cost more than the bias it removes and §5.2's second reason would be
 * the binding one — instead only light r and α_cog are, so the second reason
 * binds on those two rates at the light volume and nowhere else. If reading 3's
 * ratio had been ≈ 1×, weighting α alone would be safe and the three fits would
 * not need to be weighted together (§5.2).
 *
 * A probe, not a test. Every figure moves with the two ridge priors
 * (`DRAIN_PRIOR_STRENGTH`, `RECOVERY_PRIOR_STRENGTH`), the noise priors and
 * ν₀ that set the stds z divides by, the fit bounds, the 0–10 notch
 * quantization and the linear rating map, and with `DEFAULT_ENERGY_PARAMS`
 * themselves — the drifting arms' truth is drawn from them, so moving a default
 * moves the generator and the prior together. The ceiling is a MAX over 40
 * seeds, the noisiest statistic here: on-prior α_phys reads 1.87 light and 1.88
 * heavy, indistinguishable across a twelvefold difference in logging volume,
 * which is the estimator of the ceiling moving and not the ceiling.
 *
 * The rule for a user's own logs: revisit §5.2's deferral when their split
 * reading clears the ceiling at their volume AND the drift it implies is past
 * the crossover. Neither half of that test can be taken from the tables above
 * as printed — both the ceiling and the crossover move with where the user's
 * rates sit relative to the defaults, which is what the control measures — so
 * the ceiling has to be re-measured on a synthetic stationary logger at THEIR
 * volume and THEIR fitted rates, never read off the user's own history.
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';
import {
	calibrateEnergyParams,
	toCognitiveDrainObservations,
} from '$lib/business/model/energy-calibration';
import { DEFAULT_ENERGY_PARAMS, fitDrainRate } from '$lib/business/model/zenith-energy';
import type { DrainObservationRecord, RestObservationRecord } from '$lib/data/type';

const DAYS = 365;
/** The last logged day: where θ(end) and both error readings are taken. */
const END_DAY = DAYS - 1;
const MILLISECONDS_PER_DAY = 86_400_000;
const SEEDS = 40;
const BASE_SEED = 0xe7f17c;
/** The same share δ on all three rates — a person who drifts, drifts. */
const DELTAS = [0, 0.1, 0.25, 0.5, 1];
/**
 * What a stationary z would read if each half-fit's std matched its own
 * sampling spread: z is then |N(0,1)| and its median is 0.674.
 */
const NOMINAL_MEDIAN_Z = 0.674;
/** The δ = 0 control: a truth this far off the ridge prior both fits shrink toward. */
const OFF_PRIOR_SCALE = 1.5;

type Shape = 'linear' | 'step';

const SHAPES: Shape[] = ['linear', 'step'];

interface Volume {
	label: string;
	restPerWeek: number;
	drainPerWeek: number;
}

const VOLUMES: Volume[] = [
	{
		label: 'light',
		restPerWeek: 2,
		drainPerWeek: 3,
	},
	{
		label: 'heavy',
		restPerWeek: 8,
		drainPerWeek: 12,
	},
];

/** The three fitted rates, in the order every array below is indexed by. */
const RATE_LABELS = ['r', 'α_cog', 'α_phys'];

function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function isoDate(day: number): string {
	// Constructed by hand rather than with Date so the probe stays
	// deterministic and dependency-free; only ISO ORDER is load-bearing here.
	const month = Math.floor(day / 31);
	const dayOfMonth = (day % 31) + 1;

	return `2026-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
}

/** The one day both the split and the step cut at, so each half is one regime. */
const MIDPOINT_DAY = Math.floor(DAYS / 2);
/** Where the history is cut in two: every row dated before it is the early half. */
const MIDPOINT_DATE = isoDate(MIDPOINT_DAY);

/**
 * θ(t) = θ₀·(1 + δ·s(t)) for [r, α_cog, α_phys]; s is linear or a midpoint
 * step. `scale` moves θ₀ itself off the defaults the ridge prior sits on.
 */
function ratesOn(day: number, shape: Shape, delta: number, scale = 1): number[] {
	const s = shape === 'step' ? (day < MIDPOINT_DAY ? 0 : 1) : day / END_DAY;
	const factor = scale * (1 + delta * s);

	return [
		DEFAULT_ENERGY_PARAMS.recoveryRate * factor,
		DEFAULT_ENERGY_PARAMS.alphaCog * factor,
		DEFAULT_ENERGY_PARAMS.alphaPhys * factor,
	];
}

/** A 0–10 rating as the app stores it. */
const notch = (fraction: number): number => Math.max(0, Math.min(10, Math.round(fraction * 10)));

/** MATH.md §8.7's D(w, H) from a FULL reservoir, at the day's own α and r. */
function drainedFraction(demand: number, hours: number, alpha: number, recovery: number): number {
	const rest = recovery * DEFAULT_ENERGY_PARAMS.restRecoveryMultiplier;
	const gate = 1 - (1 - DEFAULT_ENERGY_PARAMS.microRecoveryFraction) * demand;
	const rho = alpha * demand + rest * gate;
	const equilibrium = (rest * gate) / rho;

	return 1 - (equilibrium + (1 - equilibrium) * Math.exp(-rho * hours));
}

/** This day's row count: the whole part of the daily rate always, the fraction as a coin. */
function drawCount(random: () => number, perWeek: number): number {
	const perDay = perWeek / 7;

	return Math.floor(perDay) + (random() < perDay % 1 ? 1 : 0);
}

interface History {
	rest: RestObservationRecord[];
	drain: DrainObservationRecord[];
}

/**
 * A year of ☕/🪫 rows from the model's own two laws at the day's true rates.
 * The row STRUCTURE (dates, counts, hours, demands, pre-rest notches) depends
 * on the seed alone, so the same seed gives the same logger under every drift.
 */
function synthesize(
	shape: Shape,
	delta: number,
	volume: Volume,
	seed: number,
	scale: number,
): History {
	const random = mulberry32(seed);
	const rest: RestObservationRecord[] = [];
	const drain: DrainObservationRecord[] = [];

	for (let day = 0; day < DAYS; day++) {
		const [recovery, alphaCog, alphaPhys] = ratesOn(day, shape, delta, scale);
		const date = isoDate(day);
		const drainRows = drawCount(random, volume.drainPerWeek);
		const restRows = drawCount(random, volume.restPerWeek);

		for (let i = 0; i < drainRows; i++) {
			// The 45-minute lattice (§8.8) and the ten slider notches.
			const hours = 0.75 * (1 + Math.floor(random() * 4));
			const cognitiveDemand = (1 + Math.floor(random() * 10)) / 10;
			const physicalDemand = (1 + Math.floor(random() * 10)) / 10;

			drain.push({
				date,
				taskId: i + 1,
				taskTitle: `t${i + 1}`,
				hours,
				cognitiveDemand,
				physicalDemand,
				mindDrain: notch(drainedFraction(cognitiveDemand, hours, alphaCog, recovery)),
				bodyDrain: notch(drainedFraction(physicalDemand, hours, alphaPhys, recovery)),
				createdAt: day * MILLISECONDS_PER_DAY + i,
			});
		}

		for (let i = 0; i < restRows; i++) {
			const hours = 0.25 * (1 + Math.floor(random() * 8));
			const decay = Math.exp(-recovery * DEFAULT_ENERGY_PARAMS.restRecoveryMultiplier * hours);
			// Notches 1–9: a pair that went in fresh is dropped by the fit.
			const mindBefore = 1 + Math.floor(random() * 9);
			const bodyBefore = 1 + Math.floor(random() * 9);

			rest.push({
				date,
				hours,
				mindBefore,
				mindAfter: notch((mindBefore / 10) * decay),
				bodyBefore,
				bodyAfter: notch((bodyBefore / 10) * decay),
				createdAt: day * MILLISECONDS_PER_DAY + i,
			});
		}
	}

	return {
		rest,
		drain,
	};
}

function half(history: History, isEarly: boolean): History {
	const keep = (date: string): boolean => (isEarly ? date < MIDPOINT_DATE : date >= MIDPOINT_DATE);

	return {
		rest: history.rest.filter((row) => keep(row.date)),
		drain: history.drain.filter((row) => keep(row.date)),
	};
}

/** The three MAP rates and their posterior stds, in RATE_LABELS order. */
interface Reading {
	value: number[];
	std: number[];
}

function readFit(history: History): Reading {
	const { params, recovery, cognitiveDrain, physicalDrain } = calibrateEnergyParams(
		history.rest,
		history.drain,
	);

	return {
		value: [params.recoveryRate, params.alphaCog, params.alphaPhys],
		std: [
			recovery.rateStd ?? Number.NaN,
			cognitiveDrain.alphaStd ?? Number.NaN,
			physicalDrain.alphaStd ?? Number.NaN,
		],
	};
}

interface SeedRun {
	/** z = |θ̂_late − θ̂_early| / √(s²_early + s²_late), per rate */
	z: number[];
	/** the whole-history MAP per rate */
	whole: number[];
	/** the late half's MAP per rate */
	late: number[];
	/** α_cog on the late half conditioned on the WHOLE history's r */
	crossedAlphaCog: number;
	restRows: number;
	drainRows: number;
}

function runSeed(
	shape: Shape,
	delta: number,
	volume: Volume,
	seed: number,
	scale: number,
): SeedRun {
	const history = synthesize(shape, delta, volume, seed, scale);
	const lateHistory = half(history, false);
	const early = readFit(half(history, true));
	const late = readFit(lateHistory);
	const whole = readFit(history);

	const crossed = fitDrainRate(
		toCognitiveDrainObservations(lateHistory.drain),
		DEFAULT_ENERGY_PARAMS.alphaCog,
		{
			...DEFAULT_ENERGY_PARAMS,
			recoveryRate: whole.value[0],
		},
	);

	return {
		z: late.value.map(
			(value, i) =>
				Math.abs(value - early.value[i]) / Math.sqrt(early.std[i] ** 2 + late.std[i] ** 2),
		),
		whole: whole.value,
		late: late.value,
		crossedAlphaCog: crossed.alpha,
		restRows: history.rest.length,
		drainRows: history.drain.length,
	};
}

const cellOf = (shape: Shape, delta: number, volume: Volume, scale = 1): SeedRun[] =>
	Array.from({
		length: SEEDS,
	}).map((_, seed) => runSeed(shape, delta, volume, BASE_SEED + seed, scale));

/** At δ = 0 the shape does not exist, so the stationary cell is one per volume. */
const stationary = VOLUMES.map((volume) => cellOf('linear', 0, volume));
/** The same stationary seeds on a truth OFF the prior — δ = 0's missing control. */
const offPrior = VOLUMES.map((volume) => cellOf('linear', 0, volume, OFF_PRIOR_SCALE));

/** Indexed [volume][shape][δ index into DELTAS, 0 being the stationary cell]. */
const cells = VOLUMES.map((volume, v) =>
	SHAPES.map((shape) =>
		DELTAS.map((delta) => (delta === 0 ? stationary[v] : cellOf(shape, delta, volume))),
	),
);

const median = (values: number[]): number => {
	const sorted = [...values].sort((a, b) => a - b);

	return sorted[Math.floor(sorted.length / 2)];
};

const medianOf = (runs: SeedRun[], pick: (run: SeedRun) => number): number =>
	median(runs.map(pick));

/** The noise ceiling per rate: the largest z a stationary logger of this volume produced. */
const ceilingOf = (runs: SeedRun[]): number[] =>
	RATE_LABELS.map((_, i) => Math.max(...runs.map((run) => run.z[i])));

const shareAbove = (runs: SeedRun[], i: number, ceiling: number): number =>
	runs.filter((run) => run.z[i] > ceiling).length / runs.length;

const row = (label: string, cells_: string[]): string =>
	`  ${label.padEnd(14)}${cells_.map((cell) => cell.padStart(14)).join('')}`;

const deltaHeader = row(
	'δ',
	DELTAS.map((delta) => delta.toFixed(2)),
);

describe('MATH.md §5.2 — whether the energy fits need recency weighting', () => {
	it('self-check: the whole-history fit recovers a stationary generator', () => {
		const heavy = stationary[1];
		const truth = ratesOn(END_DAY, 'linear', 0);

		const errors = RATE_LABELS.map((_, i) =>
			Math.abs(medianOf(heavy, (run) => run.whole[i]) - truth[i]),
		);

		const recovered = RATE_LABELS.map(
			(label, i) =>
				`${label} ${medianOf(heavy, (run) => run.whole[i]).toFixed(4)} against ${truth[i]} ` +
				`(${((100 * errors[i]) / truth[i]).toFixed(1)}%)`,
		).join(', ');

		console.log(
			`[§5.2] self-check, δ = 0 at the heavy volume (${SEEDS} seeds, median MAP): ${recovered}`,
		);

		console.log(
			errors.every((error, i) => error < 0.1 * truth[i])
				? '[§5.2] self-check VALID — the fits and the generator agree'
				: '[§5.2] self-check INVALID — every cell below is noise',
		);

		// Load-bearing: if the whole-history fit cannot recover a stationary
		// generator, the generator and the fit disagree and no cell means anything.
		for (const [i, error] of errors.entries()) expect(error).toBeLessThan(0.1 * truth[i]);
	});

	it('reading 1 — the split reading against a stationary logger’s noise ceiling', () => {
		for (const [v, volume] of VOLUMES.entries()) {
			const ceiling = ceilingOf(stationary[v]);

			const ceilingCells = RATE_LABELS.map((label, i) => `${label} ${ceiling[i].toFixed(2)}`).join(
				', ',
			);

			const medianCells = RATE_LABELS.map(
				(label, i) => `${label} ${medianOf(stationary[v], (run) => run.z[i]).toFixed(2)}`,
			).join(', ');

			console.log(
				`[§5.2] ${volume.label} (${volume.restPerWeek} ☕ + ${volume.drainPerWeek} 🪫 a week, ` +
					`${medianOf(stationary[v], (run) => run.restRows)} ☕ / ` +
					`${medianOf(stationary[v], (run) => run.drainRows)} 🪫 over ${DAYS} days): ` +
					`noise ceiling (max z over ${SEEDS} stationary seeds) ${ceilingCells}`,
			);

			console.log(
				`[§5.2] ${volume.label}: stationary median z ${medianCells} against a nominal ` +
					`${NOMINAL_MEDIAN_Z} — the median of |N(0,1)|, what z reads when each half-fit's ` +
					`std matches its own sampling spread`,
			);

			for (const [s, shape] of SHAPES.entries()) {
				console.log(`[§5.2] ${volume.label}/${shape}: median z (share of seeds above the ceiling)`);
				console.log(deltaHeader);

				for (const [i, label] of RATE_LABELS.entries())
					console.log(
						row(
							label,
							DELTAS.map((_, d) => {
								const runs = cells[v][s][d];

								return `${medianOf(runs, (run) => run.z[i]).toFixed(2)} (${(
									100 * shareAbove(runs, i, ceiling[i])
								).toFixed(0)}%)`;
							}),
						),
					);

				for (const [i, label] of RATE_LABELS.entries()) {
					const visible = DELTAS.findIndex(
						(delta, d) => delta > 0 && medianOf(cells[v][s][d], (run) => run.z[i]) > ceiling[i],
					);

					console.log(
						visible === -1
							? `[§5.2] ${volume.label}/${shape} ${label}: no δ up to ` +
									`${DELTAS[DELTAS.length - 1]} has a median z above the ceiling`
							: `[§5.2] ${volume.label}/${shape} ${label}: smallest visible drift δ = ` +
									`${DELTAS[visible]} (median z ` +
									`${medianOf(cells[v][s][visible], (run) => run.z[i]).toFixed(2)} against ` +
									`${ceiling[i].toFixed(2)}, ` +
									`${(100 * shareAbove(cells[v][s][visible], i, ceiling[i])).toFixed(0)}% of seeds clear it)`,
					);
				}
			}
		}
	});

	it('reading 2 — whole history against late half, at the truth the history ends on', () => {
		for (const [v, volume] of VOLUMES.entries())
			for (const [s, shape] of SHAPES.entries()) {
				console.log(
					`[§5.2] ${volume.label}/${shape}: median |θ̂ − θ(day ${DAYS})| per rate, and ` +
						`late ÷ whole — under 1 is where halving the history pays`,
				);

				console.log(deltaHeader);

				for (const [i, label] of RATE_LABELS.entries()) {
					const errors = DELTAS.map((delta, d) => {
						const truth = ratesOn(END_DAY, shape, delta)[i];

						return {
							whole: medianOf(cells[v][s][d], (run) => Math.abs(run.whole[i] - truth)),
							late: medianOf(cells[v][s][d], (run) => Math.abs(run.late[i] - truth)),
						};
					});

					console.log(
						row(
							`${label} whole`,
							errors.map((error) => error.whole.toFixed(4)),
						),
					);

					console.log(
						row(
							`${label} late`,
							errors.map((error) => error.late.toFixed(4)),
						),
					);

					console.log(
						row(
							`${label} ratio`,
							errors.map((error) => `${(error.late / error.whole).toFixed(2)}×`),
						),
					);
				}
			}
	});

	it(`the δ = 0 control — a truth ${OFF_PRIOR_SCALE}× off the prior both halves shrink toward`, () => {
		const truth = ratesOn(END_DAY, 'linear', 0, OFF_PRIOR_SCALE);

		for (const [v, volume] of VOLUMES.entries()) {
			const runs = offPrior[v];
			const ceiling = ceilingOf(runs);

			const errors = RATE_LABELS.map((_, i) => ({
				whole: medianOf(runs, (run) => Math.abs(run.whole[i] - truth[i])),
				late: medianOf(runs, (run) => Math.abs(run.late[i] - truth[i])),
			}));

			console.log(
				`[§5.2] ${volume.label}, δ = 0 with the truth at ${OFF_PRIOR_SCALE}× the defaults ` +
					`(${RATE_LABELS.map((label, i) => `${label} ${truth[i].toFixed(3)}`).join(', ')}), ` +
					`same ${SEEDS} seeds:`,
			);

			console.log(row('', RATE_LABELS));

			console.log(
				row(
					'ceiling',
					ceiling.map((value) => value.toFixed(2)),
				),
			);

			console.log(
				row(
					'median z',
					RATE_LABELS.map((_, i) => medianOf(runs, (run) => run.z[i]).toFixed(2)),
				),
			);

			console.log(
				row(
					'whole',
					errors.map((error) => error.whole.toFixed(4)),
				),
			);

			console.log(
				row(
					'late',
					errors.map((error) => error.late.toFixed(4)),
				),
			);

			console.log(
				row(
					'ratio',
					errors.map((error) => `${(error.late / error.whole).toFixed(2)}×`),
				),
			);
		}
	});

	it('reading 3 — α_cog on the late half, conditioned on whose r', () => {
		for (const [v, volume] of VOLUMES.entries()) {
			console.log(
				`[§5.2] ${volume.label}: median |α̂_cog − α_cog(day ${DAYS})| on the LATE half, ` +
					`conditioned on the whole history’s r against on the late half’s own`,
			);

			console.log(deltaHeader);

			for (const [s, shape] of SHAPES.entries()) {
				const errors = DELTAS.map((delta, d) => {
					const truth = ratesOn(END_DAY, shape, delta)[1];

					return {
						crossed: medianOf(cells[v][s][d], (run) => Math.abs(run.crossedAlphaCog - truth)),
						own: medianOf(cells[v][s][d], (run) => Math.abs(run.late[1] - truth)),
					};
				});

				console.log(
					row(
						`${shape} crossed`,
						errors.map((error) => error.crossed.toFixed(4)),
					),
				);

				console.log(
					row(
						`${shape} own`,
						errors.map((error) => error.own.toFixed(4)),
					),
				);

				console.log(
					row(
						`${shape} ratio`,
						errors.map((error) => `${(error.crossed / error.own).toFixed(2)}×`),
					),
				);
			}
		}
	});
});
