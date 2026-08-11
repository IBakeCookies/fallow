/**
 * The measurement behind MATH.md §8.7's identifiability and prior-strength
 * claims, none of which had a probe (only the ORDERINGS are unit-tested):
 *
 *   1. "Only α is fit. The fit conditions on the current `recoveryRate` … that
 *      conditioning is what makes α identifiable at all. `recoveryRate` itself
 *      cannot be recovered from end-of-session ratings: it enters the observable
 *      D only jointly with α through ρ and C_eq." (business/model/AGENTS.md states it as a
 *      rule: "`recoveryRate` is _not_ identifiable from end-of-session ratings
 *      — don't try.")
 *   2. The λ = `DRAIN_PRIOR_STRENGTH` = 0.25 tuning: "one consistent full-demand
 *      log moves α ~50% of the way to what it implies, three ~70%, ten ~85%;
 *      λ = 0.5 left three logs at only 57%", the sensitivity dD/dα the units are
 *      quoted in, and the reported stds (0.088 → 0.033 from 2 → 8 logs, 0.090
 *      with ±3-notch scatter).
 *   3. "Saturation shrinkage": 8 clean logs from α* = 1.2 fit to 0.96, with the
 *      predictions differing "by under one rating notch".
 *
 * A probe, not a test: arm A's numbers are a property of the law, but arms B and
 * C move with λ, σ₀, ν₀ and the defaults, and in the suite that is a red build
 * carrying no regression (docs/testing.md). The orderings that MUST hold are
 * already asserted in `zenith-energy.test.ts`; what this prints is the SIZE of
 * each effect, in the units the ratings are given in (one notch = 0.1 of D).
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_ENERGY_PARAMS,
	DRAIN_NOISE_PRIOR_STD,
	DRAIN_PRIOR_STRENGTH,
	fitDrainRate,
	type DrainObservation,
} from '$lib/business/model/zenith-energy';

const P = DEFAULT_ENERGY_PARAMS;

/**
 * §8.7's forward model, replicated: the drained fraction after H hours at demand
 * w from a FULL reservoir, under the §8.1/§8.5 law. Independent of the module so
 * a fitted α can be scored against the data that generated it.
 */
function drained(w: number, H: number, alpha: number, r = P.recoveryRate): number {
	const rec = r * P.restRecoveryMultiplier;
	const gate = 1 - (1 - P.microRecoveryFraction) * w;
	const rho = alpha * w + rec * gate;
	const eq = (rec * gate) / rho;

	return 1 - (eq + (1 - eq) * Math.exp(-rho * H));
}

const lawParams = (r: number) => ({
	recoveryRate: r,
	restRecoveryMultiplier: P.restRecoveryMultiplier,
	microRecoveryFraction: P.microRecoveryFraction,
});

/** The 8-log clean grid the §8.7 unit tests fit on: (demand, hours). */
const GRID: [number, number][] = [
	[1, 1],
	[1, 2],
	[0.8, 1.5],
	[0.6, 3],
	[0.9, 0.75],
	[0.5, 2],
	[1, 4],
	[0.7, 2.5],
];

const cleanLogs = (alpha: number, r = P.recoveryRate): DrainObservation[] =>
	GRID.map(([demand, hours]) => ({
		demand,
		hours,
		drainedFraction: drained(demand, hours, alpha, r),
	}));

/** Best α for these observations under a ridge of strength λ toward the default. */
function ridgeFit(observations: DrainObservation[], lambda: number, r = P.recoveryRate): number {
	let best = 0.05;
	let bestValue = Infinity;

	for (let alpha = 0.05; alpha <= 2.0001; alpha += 0.0002) {
		let value = lambda * (alpha - P.alphaCog) ** 2;

		for (const o of observations) {
			const residual = o.drainedFraction - drained(o.demand, o.hours, alpha, r);
			value += residual * residual;
		}

		if (value < bestValue) {
			bestValue = value;
			best = alpha;
		}
	}

	return best;
}

/** Unpenalized best α and its misfit, in rating notches (one notch = 0.1 of D). */
function profileAt(
	observations: DrainObservation[],
	r: number,
): { alpha: number; notches: number } {
	const alpha = ridgeFit(observations, 0, r);
	let ssr = 0;

	for (const o of observations) {
		const residual = o.drainedFraction - drained(o.demand, o.hours, alpha, r);
		ssr += residual * residual;
	}

	return {
		alpha,
		notches: Math.sqrt(ssr / observations.length) * 10,
	};
}

describe('MATH.md §8.7 — what end-of-session ratings can and cannot identify', () => {
	it('arm A: recoveryRate is not identifiable from drain ratings; α is, given r', () => {
		const TRUE_ALPHA = 0.5;
		const TRUE_R = P.recoveryRate;
		const observations = cleanLogs(TRUE_ALPHA, TRUE_R);

		console.log(
			`[§8.7 arm A] 8 noiseless logs generated at α*=${TRUE_ALPHA}, r*=${TRUE_R}; refitted under each conditioning r (σ₀ = ${DRAIN_NOISE_PRIOR_STD * 10} notches)`,
		);

		const profiles = [0.1, 0.3, 0.5, 0.7, 1, 1.5, 2, 3].map((r) => {
			const profile = profileAt(observations, r);
			const ridge = fitDrainRate(observations, P.alphaCog, lawParams(r));

			console.log(
				`[§8.7 arm A] r=${r}: best α ${profile.alpha.toFixed(4)}, misfit ${profile.notches.toFixed(3)} notches | shipped ridge fit α ${ridge.alpha.toFixed(4)} ± ${ridge.alphaStd!.toFixed(4)}`,
			);

			return profile;
		});

		const worstMisfit = Math.max(...profiles.map((p) => p.notches));

		const spread =
			Math.max(...profiles.map((p) => p.alpha)) / Math.min(...profiles.map((p) => p.alpha));

		console.log(
			`[§8.7 arm A] a 30× range of r is absorbed by α over a ${spread.toFixed(2)}× range of α at a worst misfit of ${worstMisfit.toFixed(3)} notches — the ratings cannot see which (r, α) they came from`,
		);

		// The identifiability claim in its exact form: only the JOINT (α, r)
		// matters, so no conditioning r is ruled out by the data. Every profile
		// stays inside the rating noise the fit itself assumes.
		expect(worstMisfit).toBeLessThan(DRAIN_NOISE_PRIOR_STD * 10);
		// …while α at a FIXED r is pinned exactly, which is what the conditioning buys.
		expect(profileAt(observations, TRUE_R).alpha).toBeCloseTo(TRUE_ALPHA, 3);

		const sensitivity = [0.2, 0.35, 0.5, 0.8, 1.2].map((alpha) => {
			const row = [1, 1.5, 2, 3]
				.map(
					(H) =>
						`H=${H}:${((drained(1, H, alpha + 1e-4) - drained(1, H, alpha - 1e-4)) / 2e-4).toFixed(3)}`,
				)
				.join(' ');

			return `α=${alpha} [${row}]`;
		});

		console.log(`[§8.7 arm A] dD/dα at w=1: ${sensitivity.join('  ')}`);

		console.log(
			`[§8.7 arm A] dD/dα vanishing with demand (H=2, α=${P.alphaCog}): ${[0.5, 0.2, 0.05, 0]
				.map(
					(w) =>
						`w=${w}:${((drained(w, 2, P.alphaCog + 1e-4) - drained(w, 2, P.alphaCog - 1e-4)) / 2e-4).toFixed(3)}`,
				)
				.join('  ')}`,
		);
	});

	it('arm B: how far n consistent logs move α, at λ = 0.25 and λ = 0.5', () => {
		// "8/10 drained after 2 h at full demand" — the log §8.7's λ sweep uses.
		const log: DrainObservation = {
			demand: 1,
			hours: 2,
			drainedFraction: 0.8,
		};

		const implied = ridgeFit([log], 0);

		console.log(
			`[§8.7 arm B] the defaults predict ${drained(1, 2, P.alphaCog).toFixed(4)} for a 2 h full-demand session; a 0.8 rating alone implies α = ${implied.toFixed(4)} (prior α₀ = ${P.alphaCog})`,
		);

		for (const n of [1, 3, 10]) {
			const logs = Array.from(
				{
					length: n,
				},
				() => ({
					...log,
				}),
			);

			const shipped = fitDrainRate(logs, P.alphaCog, lawParams(P.recoveryRate));

			const moved = (alpha: number) =>
				(((alpha - P.alphaCog) / (implied - P.alphaCog)) * 100).toFixed(1);

			console.log(
				`[§8.7 arm B] n=${n}: λ=${DRAIN_PRIOR_STRENGTH} → α ${shipped.alpha.toFixed(4)} (${moved(shipped.alpha)}% of the way) ± ${shipped.alphaStd!.toFixed(4)} | λ=0.5 → α ${ridgeFit(logs, 0.5).toFixed(4)} (${moved(ridgeFit(logs, 0.5))}%)`,
			);
		}

		// What λ = 0.5 buys against an outlier: 4 on-default logs plus one
		// "10/10 drained after 30 min".
		const onDefault = (hours: number): DrainObservation => ({
			demand: 1,
			hours,
			drainedFraction: drained(1, hours, P.alphaCog),
		});

		const clean = [onDefault(1), onDefault(1.5), onDefault(2), onDefault(2.5)];

		const wild: DrainObservation = {
			demand: 1,
			hours: 0.5,
			drainedFraction: 1,
		};

		console.log(
			`[§8.7 arm B] 4 on-default logs fit α ${ridgeFit(clean, DRAIN_PRIOR_STRENGTH).toFixed(4)}; adding one wild outlier: λ=${DRAIN_PRIOR_STRENGTH} → ${ridgeFit([...clean, wild], DRAIN_PRIOR_STRENGTH).toFixed(4)}, λ=0.5 → ${ridgeFit([...clean, wild], 0.5).toFixed(4)} (the stronger prior absorbs ${Math.abs(ridgeFit([...clean, wild], DRAIN_PRIOR_STRENGTH) - ridgeFit([...clean, wild], 0.5)).toFixed(4)} more of it)`,
		);

		const consistent = Array.from(
			{
				length: 8,
			},
			() => ({
				demand: 1,
				hours: 2,
				drainedFraction: 0.5,
			}),
		);

		// Same 0.5 mean, ±3 notches of scatter.
		const scattered = [0.2, 0.8, 0.3, 0.7, 0.4, 0.9, 0.1, 0.6].map((drainedFraction) => ({
			demand: 1,
			hours: 2,
			drainedFraction,
		}));

		const two = fitDrainRate(consistent.slice(0, 2), P.alphaCog, lawParams(P.recoveryRate));
		const eight = fitDrainRate(consistent, P.alphaCog, lawParams(P.recoveryRate));
		const noisy = fitDrainRate(scattered, P.alphaCog, lawParams(P.recoveryRate));

		console.log(
			`[§8.7 arm B] reported std: 2 consistent logs ± ${two.alphaStd!.toFixed(4)} → 8 ± ${eight.alphaStd!.toFixed(4)}; 8 logs with ±3-notch scatter around the same mean ± ${noisy.alphaStd!.toFixed(4)} (same MAP ${noisy.alpha.toFixed(4)} vs ${eight.alpha.toFixed(4)})`,
		);
	});

	it('arm C: saturation shrinkage is invisible to the ratings', () => {
		for (const trueAlpha of [0.7, 1.2, 1.6]) {
			const logs = cleanLogs(trueAlpha);
			const fit = fitDrainRate(logs, P.alphaCog, lawParams(P.recoveryRate));

			const worstNotch = Math.max(
				...GRID.map(([w, H]) => Math.abs(drained(w, H, trueAlpha) - drained(w, H, fit.alpha)) * 10),
			);

			console.log(
				`[§8.7 arm C] α*=${trueAlpha}: 8 clean logs fit ${fit.alpha.toFixed(4)} ± ${fit.alphaStd!.toFixed(4)}, worst prediction gap ${worstNotch.toFixed(3)} notches`,
			);
		}

		console.log(
			`[§8.7 arm C] α=1.0 vs α=1.4 predictions at w=1: ${[1, 2, 3]
				.map(
					(H) =>
						`H=${H}:${(Math.abs(drained(1, H, 1) - drained(1, H, 1.4)) * 10).toFixed(3)} notches`,
				)
				.join('  ')}`,
		);
	});
});
