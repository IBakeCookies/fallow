/**
 * Whether an hour-of-day term in the drain rates (§8.7) could be read off 🪫
 * logs at all, or whether §8.7's own fresh-start approximation manufactures the
 * structure such a term would claim. Two numbers move: the apparent hour-of-day
 * modulation a year of logs shows when the truth has NONE — the ceiling — and
 * the smallest true modulation that clears it, read on the residuals as the app
 * stores them and again under each correction the stored rows themselves allow.
 * Reading 4 then turns those same corrections on α̂ ITSELF — the bias §8.7's
 * fresh-start bullet names and never priced — where the answer comes out the
 * other way round.
 *
 * THE GENERATOR IS THE MODEL: every day is chained through the SHIPPED
 * `simulateReservoirs` one block at a time — session, rest gap, session — each
 * block's end levels carried into the next block's `initialCog`/`initialPhys`
 * and that block's α taken from α(h) = α₀·(1 + a·cos(2π(h − 16)/24)) at its
 * MIDPOINT clock hour, rest gaps being `taskId: null`. A chained day is the
 * whole subject here and the shipped simulator is what chains it. Every row is
 * one the app could hold: 260 logged days, 2–4 sessions each, session hours on
 * the 45-minute lattice, gaps in quarter hours, demands on the ten slider
 * notches, the rating 1 − C_end noised at `DRAIN_NOISE_PRIOR_STD` and quantized
 * to the 0–10 notches stored, `createdAt` stamped at the session's END, and the
 * day ending at midnight — a session that would run past it is never worked, so
 * no row carries a `createdAt` on a later calendar day than its own `date`,
 * which is the row §8.14 excludes from a time-of-day reading. Every day starts
 * at FULL reservoirs, so the artifact measured is the one that accumulates
 * WITHIN a day and not overnight carry-over. Two routines, a fixed 09:00 start
 * and a start drawn 06:00–12:00: under a fixed routine clock hour and
 * position-in-day are the same variable, and the jitter is the only
 * identification the data could ever have. The reading is the app's own —
 * `fitDrainRate` over the whole log at `DEFAULT_ENERGY_PARAMS` — and the
 * generator's r is that same default, so the fit conditions on the TRUE
 * recovery rate 0.7 and no artifact below is a mis-fit r's. 40 seeds a cell,
 * one estimator everywhere: least squares of the row residual on
 * [1, cos(2πh/24), sin(2πh/24)] at the row's own fractional `createdAt` hour —
 * which is a synthetic epoch's UTC hour here, where a reading on real rows has
 * to be the user's LOCAL hour or the axis is shifted by their offset.
 *
 * Figures below are read off THIS file's own run (2026-09-15). Every one of
 * them is printed by the run; none is computed by hand.
 *
 * SELF-CHECK, printed first and the only assertions: at a = 0 with one session
 * a day from a full reservoir and no rating noise — §8.7's own model exactly —
 * the fit recovers α_cog 0.3361 against 0.35 (4.0%) and α_phys 0.3087 against
 * 0.3 (2.9%), and the amplitude it recovers reads 0.0072 / 0.0079 against the
 * jittered fresh-start ceilings 0.0276 / 0.0341. If they miss, the generator
 * and the fit disagree and every cell below is noise.
 *
 * READING 1 — the artifact, measured first because it IS the ceiling. The truth
 * carries no hour-of-day term at a = 0 and the residual of the app's own
 * fresh-start prediction carries one anyway (amplitude in drained-fraction
 * units; ceiling = the max over the 40 a = 0 seeds; peak = the circular mean of
 * the seeds' own peak hours with its resultant R; near16 = the share of seeds
 * peaking within ±3 h of the 16:00 a circadian term would want, the one of the
 * three a single logger could compute for themselves):
 *
 *                      ceiling  median  intercept         peak   near16
 *     fixed    α_cog    0.0551  0.0210     0.0051 17.4h R=0.71      73%
 *              α_phys   0.0418  0.0168     0.0084 17.4h R=0.68      70%
 *     jittered α_cog    0.0276  0.0138     0.0118 19.1h R=0.41      35%
 *              α_phys   0.0341  0.0130     0.0107 18.5h R=0.42      50%
 *
 * 779 rows a seed at 53 distinct clock hours under the fixed routine, 773 at 69
 * under the jittered one. The same a = 0 cell reads the α̂ the app would publish
 * as 0.3881 / 0.3378 (fixed) and 0.3905 / 0.3370 (jittered) against a true
 * 0.35 / 0.3 — with no circadian term anywhere in the generator.
 *
 * TWO SOURCES PUSH THE SAME WAY, so the inflation is split before it is
 * attributed. A day's earliest row started at C₀ = 1 exactly, so what it leaves
 * at the TRUE α is the 0–10 quantizer's alone: mean residual 0.0143 on those
 * rows against 0.0394 on the rest (fixed; 0.0141 against 0.0376 jittered).
 * Turn the rating noise off and the 0-notch clamp becomes unreachable — the
 * earliest-row residual falls to −0.0063 / 0.0031 while the rest holds at
 * 0.0252 / 0.0257, and α̂ reads 0.3730 / 0.3325 instead of 0.3881 / 0.3378. So
 * the clamp carries part of the inflation and the fresh-start deficit the rest.
 * The hour term is the deficit's: noiseless it does not vanish, it SHARPENS —
 * ceiling 0.0337, median 0.0250, peak 16.9h R=0.99 with 100% of seeds within
 * ±3 h of 16:00 (fixed α_cog; jittered 0.0232 / 0.0145 / 17.8h R=0.96 / 80%).
 * Rating noise is what blurs the artifact's phase, not what creates it.
 *
 * READING 2 — the smallest true amplitude that clears it. Median recovered
 * amplitude, the share of the 40 seeds above that routine's ceiling, and the
 * peak each cell recovers against a truth peaking at 16:00:
 *
 *     a                    0.00         0.10         0.20         0.35         0.50
 *     fixed  α_cog   0.0210 (0%)  0.0316 (3%) 0.0431 (13%) 0.0596 (63%) 0.0751 (88%)
 *            peak   17.4h R=0.71 17.4h R=0.94 17.4h R=0.97 17.4h R=0.98 17.4h R=0.99
 *            near16          73%          90%          95%          98%         100%
 *            α_phys  0.0168 (0%) 0.0273 (10%) 0.0388 (28%) 0.0527 (83%) 0.0676(100%)
 *            peak   17.4h R=0.68 17.5h R=0.90 17.5h R=0.95 17.5h R=0.98 17.4h R=0.99
 *            near16          70%          85%          88%          95%          98%
 *     jitt.  α_cog   0.0138 (0%) 0.0226 (35%) 0.0360 (83%) 0.0533 (98%) 0.0713(100%)
 *            peak   19.1h R=0.41 18.0h R=0.81 17.7h R=0.94 17.6h R=0.98 17.5h R=0.99
 *            near16          35%          65%          85%          95%          98%
 *            α_phys  0.0130 (0%) 0.0231 (15%) 0.0333 (45%) 0.0508 (98%) 0.0677(100%)
 *            peak   18.5h R=0.42 18.0h R=0.84 17.8h R=0.93 17.6h R=0.97 17.5h R=0.99
 *            near16          50%          68%          85%          95%          98%
 *
 * The smallest a whose MEDIAN clears the ceiling is 0.35 on both reservoirs
 * under the fixed routine (63% / 83% of seeds clear it) and 0.2 on α_cog / 0.35
 * on α_phys under the jittered one (83% / 98%). a = 0.1 clears nothing
 * anywhere: its best cell is jittered α_cog at 0.0226 against a 0.0276 ceiling,
 * with 35% of seeds over it.
 *
 * And the phase does not rescue what the amplitude cannot see. The artifact's
 * own peak lands at 17.4h–19.1h and a TRUE 16:00 term recovers at 17.4h–18.0h,
 * so the signal's band sits INSIDE the artifact's; only the concentration
 * differs (R 0.41–0.71 against R 0.81–0.99). Per logger it is worse than that:
 * 73% of fixed-routine loggers peak within ±3 h of 16:00 with NO term in the
 * truth at all, against 98% at a = 0.35. In the reading the app actually has,
 * an afternoon peak is the approximation's signature, not evidence.
 *
 * READING 3 — the two corrections the stored rows already allow, priced and
 * changed in neither direction: (a) §8.14's earliest-row-per-day filter, whose
 * every row satisfies the fresh-start assumption the fit makes about it; (b)
 * chaining each row onto the previous row's OWN rating (1 − d_prev/10)
 * recovered over the idle hours between the two `createdAt`s. Both read
 * residuals at the app's own whole-log α̂, so a constant bias in it lands on the
 * intercept and never in the amplitude:
 *
 *                             ceiling  ×fresh   smallest a   rows  |design|
 *     fixed    day-first α_cog  1.7667  32.05×  0.35 → none    260   1.69e-5
 *                        α_phys 0.9164  21.91×  0.35 → none    260   1.69e-5
 *              chained   α_cog  0.0392   0.71×  0.35 → 0.50    779   4.23e-2
 *                        α_phys 0.0361   0.86×  0.35 → 0.50    779   4.23e-2
 *     jittered day-first α_cog  0.1539   5.58×  0.20 → none    260   4.01e-3
 *                        α_phys 0.1718   5.04×  0.35 → none    260   4.01e-3
 *              chained   α_cog  0.0292   1.06×  0.20 → 0.35    773   7.16e-2
 *                        α_phys 0.0350   1.03×  0.35 → 0.35    773   7.16e-2
 *
 * |design| is the determinant of the NORMALIZED [1, cos, sin] normal equations,
 * which the run prints at 0.2500 for rows spread uniformly around the clock —
 * the most the mean-normalized form can reach — and → 0 as they crowd into one
 * arc. It measures CONDITIONING, not rank: every one of the 40 seeds in all 20
 * cells was solvable, and what filter (a) costs is conditioning. §8.14 leaves
 * 260 rows at 4 distinct clock hours under a fixed routine (|design| 1.69e-5
 * against the whole log's 4.23e-2) and at 34 under a jittered one (4.01e-3), so
 * under a fixed routine what it reads is a near-collinear fit's amplitude:
 * 0.3959 / 0.3367 at a = 0, where the whole log reads 0.0210 / 0.0168. The
 * jittered filter is better conditioned and still 3× the whole log's
 * (0.0449 / 0.0533 against 0.0138 / 0.0130). Its ceiling rises 5.04×–32.05× and
 * no a up to 0.5 clears it on either routine. Every row satisfying §8.7's
 * assumption does not buy the reading; it prices the reading out. The filter is
 * right for what §8.14 asks of it — a per-title ranking never reads the clock —
 * and wrong as an hour-of-day instrument.
 *
 * Chaining is the only correction that lowers anything, and it buys no
 * visibility: the ceiling reads 0.71× / 0.86× (fixed) and 1.06× / 1.03×
 * (jittered) of the fresh-start one, while the smallest visible a rises to 0.5
 * on both fixed reservoirs and to 0.35 on jittered α_cog. It takes the signal
 * down with the artifact:
 *
 *     a                    0.00         0.10         0.20         0.35         0.50
 *     fixed  α_cog   0.0141 (0%)  0.0142 (3%)  0.0211 (8%) 0.0371 (45%) 0.0527 (85%)
 *            peak    4.4h R=0.27 18.8h R=0.46 18.2h R=0.77 17.7h R=0.95 17.5h R=0.98
 *            near16          18%          48%          65%          88%          98%
 *            α_phys  0.0121 (0%)  0.0107 (0%)  0.0175 (8%) 0.0305 (20%) 0.0456 (78%)
 *            peak    4.3h R=0.56 20.3h R=0.36 18.4h R=0.73 17.9h R=0.94 17.6h R=0.97
 *            near16          13%          40%          63%          78%          95%
 *     jitt.  α_cog   0.0139 (0%)  0.0141 (0%) 0.0237 (23%) 0.0401 (88%) 0.0588(100%)
 *            peak    4.8h R=0.31 18.0h R=0.46 17.6h R=0.81 17.3h R=0.96 17.2h R=0.98
 *            near16          20%          53%          73%          90%          98%
 *            α_phys  0.0114 (0%)  0.0137 (3%) 0.0212 (10%) 0.0373 (53%) 0.0546 (98%)
 *            peak    5.0h R=0.27 18.2h R=0.47 17.7h R=0.84 17.4h R=0.96 17.3h R=0.98
 *            near16          18%          55%          78%          95%          95%
 *
 * What chaining buys is the PHASE, the one thing the app's own reading cannot
 * give, and it buys it per logger rather than across an ensemble: at a = 0 an
 * afternoon peak is rare — 18% / 13% (fixed) and 20% / 18% (jittered) of seeds
 * land within ±3 h of 16:00, against the 73% / 70% the fresh-start reading puts
 * there with no term in the truth — and at a = 0.35 it is the rule, 88% / 78%
 * and 90% / 95%. Under chaining an afternoon peak is evidence even when the
 * amplitude is still under the ceiling; under the reading the app has, it is
 * the approximation's signature.
 *
 * THE a = 0 CONTROL — chaining with 30% of each day's worked sessions never
 * logged: the truth drains through them and no row records it. 543 rows a seed
 * against the 779 / 773 of a perfect logger, with the correction still read at
 * the app's whole-log α̂:
 *
 *                      ceiling  median  intercept         peak   over perfect
 *     fixed    α_cog    0.0449  0.0141     0.0008 19.3h R=0.11        3%
 *              α_phys   0.0479  0.0122     0.0011  1.3h R=0.10        8%
 *     jittered α_cog    0.0339  0.0170     0.0022  2.0h R=0.15        8%
 *              α_phys   0.0315  0.0111     0.0017  0.8h R=0.05        0%
 *
 * "over perfect" is the share of control seeds above the PERFECT logger's
 * chained ceiling (0.0392 / 0.0361 fixed, 0.0292 / 0.0350 jittered). Every
 * median stays under it and every peak stays scattered, so missing rows do not
 * manufacture an afternoon term out of chaining. But three of the four control
 * ceilings sit ABOVE the perfect logger's — α_phys 0.0479 against 0.0361 — so
 * the ceiling a chained reading has to clear belongs to the logger it was
 * measured on. The artifact itself is not an artifact of perfect logging
 * either: under the same missing rows the fresh-start medians read
 * 0.0209 / 0.0194 (fixed) and 0.0175 / 0.0162 (jittered).
 *
 * READING 4 — what the chaining repair buys α ITSELF, which reading 3 never
 * asked. That reading scores chaining as a residual correction read AT the
 * app's whole-log α̂; it never re-fits α under a chained start. This one does:
 * `fitDrainRate`'s own ridge with the start level exposed — same λ, same prior
 * mean, same bounds, same minimizer, the start level the only difference the
 * reading can be measuring — scored against the rate the generator actually
 * used. a = 0 throughout, so every bit of the error below is the approximation's
 * and the quantizer's rather than a circadian term's. `day-first` is §8.14's
 * filter handed to the GLOBAL fit, the one correction that needs no new
 * estimator at all. `pool` is §8.13's map at that α̂ — where the chain actually
 * spends the bias, the map being monotone in α and near its own pole. Medians
 * over the same 40 seeds; true α 0.35 / 0.3, true pool 4.37 h / 5.31 h:
 *
 *                              median α̂  median err    RMSE    pool   Δ pool
 *     fixed  α_cog  shipped      0.3881     +0.0381  0.0400  3.88 h  −0.49 h
 *                   day-first    0.3562     +0.0062  0.0175  4.31 h  −0.06 h
 *                   chained      0.3550     +0.0050  0.0119  4.30 h  −0.07 h
 *            α_phys shipped      0.3378     +0.0378  0.0376  4.57 h  −0.74 h
 *                   day-first    0.3105     +0.0105  0.0196  5.09 h  −0.21 h
 *                   chained      0.3084     +0.0084  0.0123  5.13 h  −0.18 h
 *     jitt.  α_cog  shipped      0.3905     +0.0405  0.0397  3.86 h  −0.52 h
 *                   day-first    0.3556     +0.0056  0.0190  4.31 h  −0.06 h
 *                   chained      0.3583     +0.0083  0.0110  4.27 h  −0.11 h
 *            α_phys shipped      0.3370     +0.0370  0.0384  4.58 h  −0.72 h
 *                   day-first    0.3121     +0.0121  0.0198  5.05 h  −0.25 h
 *                   chained      0.3102     +0.0102  0.0139  5.12 h  −0.19 h
 *
 * Chaining wins, and it is the first correction in this file that wins
 * anything: it takes 78%–87% of the bias off α̂, the RMSE with it, and the pool
 * error from about half an hour to a tenth of one on α_cog. So the same repair
 * reads two opposite ways on the two axes this file measures — it cannot buy an
 * hour-of-day term (reading 3) and it can buy α.
 *
 * §8.14's filter buys most of the same thing for free. Handed to the global fit
 * it leaves +0.0062 / +0.0105 of bias against chaining's +0.0050 / +0.0084 and
 * pays in variance instead — RMSE 0.0175–0.0198 against 0.0110–0.0139, 260 rows
 * against 779 — which is the exact opposite of what it does on the clock axis,
 * where dropping those rows raised the ceiling 5.04×–32.05×. The filter is not
 * an hour-of-day instrument and IS an almost-unbiased α one.
 *
 * Both trades §8.7 names are priced here, and neither overturns the reading.
 * The previous rating's OWN noise: turn the rating noise off and the chained fit
 * reads −0.0070 / +0.0056 (fixed) where the shipped one reads +0.0230 / +0.0325,
 * so chaining slightly UNDERSHOOTS once the 0-notch clamp is unreachable, and
 * with the noise on the two errors point opposite ways and partly cancel — which
 * is why the noised chained bias (+0.0050) is the smaller of the two. That
 * cancellation is this generator's arithmetic and not a property to lean on; what
 * survives it is the RMSE, 0.0119 against 0.0400. And assuming nothing unlogged
 * drained the reservoir in between — the control, 30% of each day's worked
 * sessions never logged and the truth still draining through them:
 *
 *                    shipped        day-first          chained
 *     fixed  α_cog   +0.0332 0.0399  +0.0182 0.0268  +0.0144 0.0205
 *            α_phys  +0.0361 0.0380  +0.0216 0.0260  +0.0161 0.0198
 *     jitt.  α_cog   +0.0408 0.0413  +0.0228 0.0277  +0.0188 0.0209
 *            α_phys  +0.0347 0.0377  +0.0207 0.0254  +0.0160 0.0203
 *
 * (median err, then RMSE; pool errors −0.44 h → −0.16 h and −0.68 h → −0.34 h on
 * the fixed routine.) The repair keeps over half its win on a logger who skips
 * three sessions in ten and still beats the filter, which degrades further
 * because the day's earliest LOGGED row is then often not the day's earliest
 * WORKED one. So the missing-log trade is a price, not a barrier.
 *
 * What reading 4 does NOT settle. The rival reports its MAP alone; the ± the app
 * prints beside α̂ would be its own reading, and §8.14's gate reads that ± rather
 * than the point. The chained start reads every night as a full recovery,
 * because in this generator it is one — a logger whose reservoir carries over
 * (`RESERVOIR_CYCLE_HOURS`, ROADMAP item 41) starts each day below where the
 * chain puts them, and nothing here bounds that. And the whole reading is a
 * perfect-model one: the generator's law IS the fit's law, so what is measured
 * is the start level and nothing else about whether the law is right.
 *
 * WHAT WOULD FALSIFY WHAT. If the a = 0 ceiling had come out at ≈ 0, residual
 * structure could be tested against zero and any nonzero amplitude would be a
 * finding; instead the app's own reading puts 0.0276–0.0551 there, at a phase
 * inside the band a true term recovers at. If the hour term had gone with the
 * rating noise, it would have been the quantizer's rather than the
 * approximation's; instead it sharpens to 16.9h R=0.99 with every seed in the
 * afternoon. If the artifact's peak hour had separated from the signal's, phase
 * alone would identify a circadian term with no correction at all — it does not
 * under the app's reading, and does under chaining. If either correction had
 * lowered the ceiling by more than it lowered the signal, the correction would
 * be the way in; neither does — (a) raises the ceiling 5.04×–32.05× and (b)
 * pushes the smallest visible a up. And if the control had left the chained
 * ceiling where the perfect logger's sat, chaining would hold for any logger
 * rather than for the one it was measured on. And if reading 4's chained re-fit
 * had landed no closer to the generator's α than the shipped one — or closer
 * only on a perfect logger — the repair would be priced out for α as it is for
 * the clock; it is neither.
 *
 * A probe, not a test. Every figure moves with the ridge prior the two α fits
 * share (`DRAIN_PRIOR_STRENGTH`) and the two prior MEANS they shrink toward
 * (`DEFAULT_ENERGY_PARAMS`' alphaCog/alphaPhys), with `DRAIN_NOISE_PRIOR_STD` —
 * doubly, since it is both the fit's noise floor and the generator's rating
 * noise, which the noiseless arm prices — and the ν₀ it is blended in at
 * (`CALIBRATION_NOISE_PRIOR_WEIGHT`), with the α fit bounds
 * (`ALPHA_FIT_MIN`/`ALPHA_FIT_MAX`), with the 0–10 notch quantization and the
 * linear rating map, and with the rest of `DEFAULT_ENERGY_PARAMS` — the
 * generator draws its truth from the same defaults the fit conditions on, so
 * moving one moves both. The 16:00 phase is a choice, not a finding, and the
 * amplitudes are in drained-fraction units, so only the a column crosses to
 * another phase. The ceiling is a MAX over 40 seeds, the noisiest statistic
 * here: fixed α_phys reads a lower day-first ceiling (0.9164) than α_cog
 * (1.7667) on the same rows, which is that estimator moving and not the ceiling.
 * Reading 4's pool column moves with two more: `CAPACITY_FLOOR` and
 * `CAPACITY_MAP_POLE_MARGIN`, the §8.13 map's own constants, which is why the
 * α columns are printed beside it rather than only the hours.
 *
 * The rule for a real user's logs: an hour-of-day term becomes readable when
 * their own recovered amplitude clears a ceiling measured on a SYNTHETIC a = 0
 * logger with their row structure — their routine's jitter, their sessions a
 * day, their volume, their fitted α̂ — and never when it clears zero. None of
 * the ceilings above can stand in for that one: two routines at the same volume
 * already move it from 0.0276 to 0.0551 and the smallest visible a with it
 * (0.2 to 0.35), and the control moves it again for a logger who skips rows.
 * These tables are a best case at this row structure — 260 days and ≈ 780 rows,
 * more than a real user reaches — and volume itself is never swept here, so
 * what they bound is what THIS logger can see, with a term visible here still
 * having to clear the ceiling of whoever reads it.
 *
 * Usage: npm run probe -- scripts/circadian-residual.probe.ts
 */

import { describe, expect, it } from 'vitest';
import {
	toCognitiveDrainObservations,
	toPhysicalDrainObservations,
} from '$lib/business/model/energy-calibration';
import {
	ALPHA_FIT_MAX,
	ALPHA_FIT_MIN,
	capacityFromDrainRate,
	DEFAULT_ENERGY_PARAMS,
	DRAIN_NOISE_PRIOR_STD,
	DRAIN_PRIOR_STRENGTH,
	fitDrainRate,
	simulateReservoirs,
	type ReservoirDemand,
	type ScheduleBlock,
} from '$lib/business/model/zenith-energy';
import type { DrainObservationRecord } from '$lib/data/type';

const DAYS = 260;
const SEEDS = 40;
const BASE_SEED = 0xc17cad;
const MILLISECONDS_PER_DAY = 86_400_000;
const MILLISECONDS_PER_HOUR = 3_600_000;
/** a in α(h) = α₀·(1 + a·cos(2π(h − 16)/24)), as a share of the default rate. */
const AMPLITUDES = [0, 0.1, 0.2, 0.35, 0.5];
/** The afternoon dip: a choice, not a finding, so every reading prints the phase it recovers. */
const TRUE_PEAK_HOUR = 16;
const FIXED_START_HOUR = 9;
/** The a = 0 control: this share of each day's worked sessions is never logged. */
const DROP_SHARE = 0.3;
/** How close a recovered peak sits to TRUE_PEAK_HOUR to be counted near it. */
const NEAR_PEAK_HOURS = 3;
/** Rank test on the normalized 3×3 normal equations of [1, cos, sin]. */
const SINGULAR_DETERMINANT = 1e-9;

type Routine = 'fixed' | 'jittered';

const ROUTINES: Routine[] = ['fixed', 'jittered'];

/**
 * The three residual constructions: the app's own fresh-start prediction, and
 * the two corrections the stored rows already allow (§8.14's earliest-row
 * filter, and chaining onto the previous row's own rating).
 */
type Construction = 'fresh-start' | 'day-first' | 'chained';

const CONSTRUCTIONS: Construction[] = ['fresh-start', 'day-first', 'chained'];

interface Arm {
	routine: Routine;
	amplitude: number;
	/** §8.7's own self-report noise prior; 0 in the self-check only. */
	noiseStd: number;
	/** Drawn uniformly: one session a day in the self-check, 2–4 in both routines. */
	sessionCounts: number[];
	/** Share of worked sessions the truth drains through and no row records. */
	dropShare: number;
}

const routineArm = (routine: Routine, amplitude: number, dropShare: number): Arm => ({
	routine,
	amplitude,
	noiseStd: DRAIN_NOISE_PRIOR_STD,
	sessionCounts: [2, 3, 4],
	dropShare,
});

/** One session a day from a full reservoir and no rating noise: §8.7's own model. */
const SELF_CHECK_ARM: Arm = {
	routine: 'jittered',
	amplitude: 0,
	noiseStd: 0,
	sessionCounts: [1],
	dropShare: 0,
};

function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Box–Muller, so the rating noise is the Gaussian one §8.7's σ₀ prices. */
function gaussian(random: () => number): number {
	return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
}

function isoDate(day: number): string {
	// Constructed by hand rather than with Date so the probe stays
	// deterministic and dependency-free; only ISO ORDER is load-bearing here.
	const month = Math.floor(day / 31);
	const dayOfMonth = (day % 31) + 1;

	return `2026-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
}

/** A 0–10 rating as the app stores it. */
const notch = (fraction: number): number => Math.max(0, Math.min(10, Math.round(fraction * 10)));

/** The circadian law, evaluated at one block's MIDPOINT clock hour. */
const rateAt = (base: number, amplitude: number, hour: number): number =>
	base * (1 + amplitude * Math.cos((2 * Math.PI * (hour - TRUE_PEAK_HOUR)) / 24));

const clockHour = (row: DrainObservationRecord): number =>
	(row.createdAt / MILLISECONDS_PER_HOUR) % 24;

const taskOf = (row: DrainObservationRecord) => ({
	id: row.taskId,
	cognitiveDemand: row.cognitiveDemand,
	physicalDemand: row.physicalDemand,
});

const sessionBlock = (row: DrainObservationRecord): ScheduleBlock => ({
	taskId: row.taskId,
	hours: row.hours,
});

/**
 * One block through the SHIPPED simulator, at the α the circadian law gives its
 * midpoint hour, starting from the levels the previous block ended on. Rest
 * gaps are `taskId: null`, where demand 0 drops α out of the law entirely.
 */
function stepBlock(
	block: ScheduleBlock,
	task: ReservoirDemand,
	startHour: number,
	amplitude: number,
	cog: number,
	phys: number,
): { endCog: number; endPhys: number } {
	const midpoint = startHour + block.hours / 2;

	return simulateReservoirs([block], [task], {
		...DEFAULT_ENERGY_PARAMS,
		alphaCog: rateAt(DEFAULT_ENERGY_PARAMS.alphaCog, amplitude, midpoint),
		alphaPhys: rateAt(DEFAULT_ENERGY_PARAMS.alphaPhys, amplitude, midpoint),
		initialCog: cog,
		initialPhys: phys,
	});
}

/**
 * A logged history of 🪫 rows, each day chained block by block from full
 * reservoirs: session, rest gap, session, … Every row is one the app could
 * hold — 45-minute session lattice, quarter-hour gaps, slider-notch demands,
 * ratings noised at σ₀ and quantized to the 0–10 notches, `createdAt` at the
 * session's END.
 */
function synthesize(arm: Arm, seed: number): DrainObservationRecord[] {
	const random = mulberry32(seed);
	const rows: DrainObservationRecord[] = [];

	for (let day = 0; day < DAYS; day++) {
		const date = isoDate(day);
		const sessions = arm.sessionCounts[Math.floor(random() * arm.sessionCounts.length)];
		let hour = arm.routine === 'fixed' ? FIXED_START_HOUR : 6 + 0.25 * Math.floor(random() * 25);
		let cog = 1;
		let phys = 1;

		for (let session = 0; session < sessions; session++) {
			const hours = 0.75 * (1 + Math.floor(random() * 4));

			const demand: ReservoirDemand = {
				id: session + 1,
				cognitiveDemand: (1 + Math.floor(random() * 10)) / 10,
				physicalDemand: (1 + Math.floor(random() * 10)) / 10,
			};

			const gap = session === 0 ? 0 : 0.25 * (1 + Math.floor(random() * 8));

			// A day ends at midnight, so a session that would run past it is never
			// worked: no row's `createdAt` can land on a later calendar day than
			// its own `date`, which is the row §8.14 excludes from a time-of-day
			// reading. Drawn before the test, so the sessions a seed works are the
			// same under every amplitude.
			if (hour + gap + hours > 24) break;

			if (gap > 0) {
				({ endCog: cog, endPhys: phys } = stepBlock(
					{
						taskId: null,
						hours: gap,
					},
					demand,
					hour,
					arm.amplitude,
					cog,
					phys,
				));

				hour += gap;
			}

			({ endCog: cog, endPhys: phys } = stepBlock(
				{
					taskId: demand.id,
					hours,
				},
				demand,
				hour,
				arm.amplitude,
				cog,
				phys,
			));

			hour += hours;

			// Drawn before the drop coin, so the truth is the same session either
			// way: the control is only the arm where no row records it.
			const mindDrain = notch(1 - cog + arm.noiseStd * gaussian(random));
			const bodyDrain = notch(1 - phys + arm.noiseStd * gaussian(random));

			if (random() >= arm.dropShare)
				rows.push({
					date,
					taskId: demand.id,
					taskTitle: `t${demand.id}`,
					hours,
					cognitiveDemand: demand.cognitiveDemand,
					physicalDemand: demand.physicalDemand,
					mindDrain,
					bodyDrain,
					createdAt: day * MILLISECONDS_PER_DAY + hour * MILLISECONDS_PER_HOUR,
				});
		}
	}

	return rows;
}

/** The app's own reading: one whole-log α̂ per reservoir at the TRUE recovery rate. */
const fitOf = (rows: DrainObservationRecord[]): { cog: number; phys: number } => ({
	cog: fitDrainRate(
		toCognitiveDrainObservations(rows),
		DEFAULT_ENERGY_PARAMS.alphaCog,
		DEFAULT_ENERGY_PARAMS,
	).alpha,
	phys: fitDrainRate(
		toPhysicalDrainObservations(rows),
		DEFAULT_ENERGY_PARAMS.alphaPhys,
		DEFAULT_ENERGY_PARAMS,
	).alpha,
});

/** The generator's own rates: what a residual reads before any fit moves α. */
const TRUE_FIT = {
	cog: DEFAULT_ENERGY_PARAMS.alphaCog,
	phys: DEFAULT_ENERGY_PARAMS.alphaPhys,
};

const predict = (
	blocks: ScheduleBlock[],
	row: DrainObservationRecord,
	fit: { cog: number; phys: number },
	initialCog: number,
	initialPhys: number,
): { endCog: number; endPhys: number } =>
	simulateReservoirs(blocks, [taskOf(row)], {
		...DEFAULT_ENERGY_PARAMS,
		alphaCog: fit.cog,
		alphaPhys: fit.phys,
		initialCog,
		initialPhys,
	});

/** §8.14's filter, re-read on the clock axis: each day's earliest row by `createdAt`. */
function dayFirstRows(rows: DrainObservationRecord[]): DrainObservationRecord[] {
	const earliest = new Map<string, DrainObservationRecord>();

	for (const row of rows) {
		const held = earliest.get(row.date);

		if (held === undefined || row.createdAt < held.createdAt) earliest.set(row.date, row);
	}

	return [...earliest.values()];
}

/** Where a row that satisfies §8.7's assumption starts: both reservoirs full. */
const FULL = {
	cog: 1,
	phys: 1,
};

/**
 * Each row's starting levels under the chained correction: the previous row's
 * OWN rating (1 − d/10) rested through the idle hours between the two
 * `createdAt`s. The idle block carries demand 0, where α drops out of the law
 * entirely, so these levels do not move with the α being fitted — which is what
 * lets the chained fit below precompute them once per log instead of inside its
 * objective. A day's first row chains onto yesterday's last through the night,
 * which the rest law returns to full, so chaining reads a fresh morning rather
 * than a carried-over one.
 */
function startLevelsOf(rows: DrainObservationRecord[]): { cog: number; phys: number }[] {
	return rows.map((row, index) => {
		const previous = rows[index - 1];

		if (previous === undefined) return FULL;

		const { endCog, endPhys } = simulateReservoirs(
			[
				{
					taskId: null,
					hours: (row.createdAt - previous.createdAt) / MILLISECONDS_PER_HOUR - row.hours,
				},
			],
			[],
			{
				...DEFAULT_ENERGY_PARAMS,
				initialCog: 1 - previous.mindDrain / 10,
				initialPhys: 1 - previous.bodyDrain / 10,
			},
		);

		return {
			cog: endCog,
			phys: endPhys,
		};
	});
}

interface Point {
	hour: number;
	residual: number;
}

/**
 * Row residuals — the rating the app stored minus what the app's own α̂ predicts
 * that row's drained fraction to be. `fresh-start` and `day-first` predict from
 * FULL reservoirs (§8.7's assumption); `chained` starts from the previous row's
 * own rating recovered over the idle hours between the two `createdAt`s — for a
 * day's first row that idle block is the night, which the rest law returns to
 * full, so chaining reads a fresh morning rather than a carried-over one.
 */
function residualsOf(
	construction: Construction,
	rows: DrainObservationRecord[],
	fit: { cog: number; phys: number },
): { cog: Point[]; phys: Point[] } {
	const eligible = construction === 'day-first' ? dayFirstRows(rows) : rows;
	const starts = construction === 'chained' ? startLevelsOf(eligible) : undefined;
	const cog: Point[] = [];
	const phys: Point[] = [];

	for (const [index, row] of eligible.entries()) {
		const start = starts?.[index] ?? FULL;
		const end = predict([sessionBlock(row)], row, fit, start.cog, start.phys);
		const hour = clockHour(row);

		cog.push({
			hour,
			residual: row.mindDrain / 10 - (1 - end.endCog),
		});

		phys.push({
			hour,
			residual: row.bodyDrain / 10 - (1 - end.endPhys),
		});
	}

	return {
		cog,
		phys,
	};
}

const meanResidual = (points: Point[]): number =>
	points.length === 0
		? Number.NaN
		: points.reduce((sum, point) => sum + point.residual, 0) / points.length;

const determinant = (m: number[][]): number =>
	m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
	m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
	m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

/** Cramer on the normalized normal equations; null when the design is rank-deficient. */
function solve3(matrix: number[][], rhs: number[]): number[] | null {
	const det = determinant(matrix);

	if (Math.abs(det) < SINGULAR_DETERMINANT) return null;

	return [0, 1, 2].map(
		(column) =>
			determinant(matrix.map((row, r) => row.map((value, j) => (j === column ? rhs[r] : value)))) /
			det,
	);
}

/** Where b_c·cos + b_s·sin peaks, on a 0–24 h clock. */
const peakHourOf = (cosine: number, sine: number): number =>
	((((Math.atan2(sine, cosine) * 24) / (2 * Math.PI)) % 24) + 24) % 24;

interface HourTerm {
	/** √(b_c² + b_s²) — NaN when the rows cannot identify the term. */
	amplitude: number;
	/** Where the fitted term peaks, 0–24 h. */
	peakHour: number;
	/** b₀, where a constant bias in α̂ lands instead of in the amplitude. */
	intercept: number;
	/**
	 * |normalized normal equations|: at most ¼ (rows spread uniformly around the
	 * clock, printed as UNIFORM_DESIGN), → 0 as they crowd into one arc and
	 * cos/sin stop separating from the intercept. What an amplitude read off a
	 * narrow window is divided by. It measures CONDITIONING, not rank: the rank
	 * guard below fires only on a design that cannot be solved at all.
	 */
	determinant: number;
	/** How many distinct clock hours the rows sit at — 3 is the rank the fit needs. */
	distinctHours: number;
	/** Rows this construction reads: every row, or §8.14's one per day. */
	pointCount: number;
}

/**
 * Least squares of the residual on [1, cos(2πh/24), sin(2πh/24)] at the row's
 * own fractional `createdAt` hour. The normal equations are accumulated as
 * MEANS, so the determinant is O(1) and the rank test is scale-free.
 */
function fitHourTerm(points: Point[]): HourTerm {
	const hours = new Set<number>();

	const matrix = [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0],
	];

	const rhs = [0, 0, 0];

	for (const point of points) {
		hours.add(point.hour);

		const basis = [
			1,
			Math.cos((2 * Math.PI * point.hour) / 24),
			Math.sin((2 * Math.PI * point.hour) / 24),
		];

		for (let i = 0; i < 3; i++) {
			rhs[i] += basis[i] * point.residual;

			for (let j = 0; j < 3; j++) matrix[i][j] += basis[i] * basis[j];
		}
	}

	for (let i = 0; i < 3; i++) {
		rhs[i] /= points.length;

		for (let j = 0; j < 3; j++) matrix[i][j] /= points.length;
	}

	const beta = solve3(matrix, rhs);

	if (beta === null)
		return {
			amplitude: Number.NaN,
			peakHour: Number.NaN,
			intercept: Number.NaN,
			determinant: determinant(matrix),
			distinctHours: hours.size,
			pointCount: points.length,
		};

	const [intercept, cosine, sine] = beta;

	return {
		amplitude: Math.sqrt(cosine * cosine + sine * sine),
		peakHour: peakHourOf(cosine, sine),
		intercept,
		determinant: determinant(matrix),
		distinctHours: hours.size,
		pointCount: points.length,
	};
}

/**
 * The largest |design| the mean-normalized normal equations can reach: rows
 * spread uniformly around the clock, where cos² and sin² average to ½ and the
 * determinant is ¼ — NOT 1. Read off a uniform grid rather than asserted.
 */
const UNIFORM_DESIGN = fitHourTerm(
	Array.from({
		length: 240,
	}).map((_, step) => ({
		hour: step * 0.1,
		residual: 0,
	})),
).determinant;

/**
 * The three α̂ reading 4 scores against the generator's own rate: the app's own
 * whole-log fit, the same fit restricted to the rows that satisfy §8.7's
 * assumption, and the chained-start rival below.
 */
type Estimator = 'shipped' | 'day-first' | 'chained';

const ESTIMATORS: Estimator[] = ['shipped', 'day-first', 'chained'];

/** One row as the chained ridge reads it: `DrainObservation` plus its start level. */
interface ChainedObservation {
	demand: number;
	hours: number;
	drainedFraction: number;
	/** Where `startLevelsOf` leaves this reservoir going into the session. */
	start: number;
}

/** The shipped `minimizeSmooth1D`, rebuilt: it is internal. */
function minimize(f: (x: number) => number, min: number, max: number): number {
	const GRID = 128;
	let bestIdx = 0;
	let bestVal = Infinity;

	for (let i = 0; i <= GRID; i++) {
		const val = f(min + ((max - min) * i) / GRID);

		if (val < bestVal) {
			bestVal = val;
			bestIdx = i;
		}
	}

	const cell = (max - min) / GRID;
	let lo = Math.max(min, min + (bestIdx - 1) * cell);
	let hi = Math.min(max, min + (bestIdx + 1) * cell);
	const INV_PHI = (Math.sqrt(5) - 1) / 2;
	let x1 = hi - INV_PHI * (hi - lo);
	let x2 = lo + INV_PHI * (hi - lo);
	let f1 = f(x1);
	let f2 = f(x2);

	for (let i = 0; i < 48; i++) {
		if (f1 < f2) {
			hi = x2;
			x2 = x1;
			f2 = f1;
			x1 = hi - INV_PHI * (hi - lo);
			f1 = f(x1);
		} else {
			lo = x1;
			x1 = x2;
			f1 = f2;
			x2 = lo + INV_PHI * (hi - lo);
			f2 = f(x2);
		}
	}

	return (lo + hi) / 2;
}

/**
 * One session block through the SHIPPED law from `start` rather than from full.
 * Both reservoirs run through the cognitive slot: the law is the same for either
 * and only α, the demand and the start level differ, so the slot is a carrier.
 */
const drainedUnder = (alpha: number, o: ChainedObservation): number =>
	1 -
	simulateReservoirs(
		[
			{
				taskId: 0,
				hours: o.hours,
			},
		],
		[
			{
				id: 0,
				cognitiveDemand: o.demand,
				physicalDemand: 0,
			},
		],
		{
			...DEFAULT_ENERGY_PARAMS,
			alphaCog: alpha,
			initialCog: o.start,
		},
	).endCog;

/**
 * `fitDrainRate`'s own ridge with the start level exposed — the rival ROADMAP
 * item 40 asks for, and the one thing the shipped fit cannot be asked for: its
 * `D(w, H; α)` is hard-wired to C₀ = 1. Identical in every other respect — the
 * same informative predicate, the same λ and prior mean, the same bounds, the
 * same minimizer — so the only difference this reading can be measuring is the
 * start level. Rebuilt rather than imported because `fitRidge1D` is internal;
 * the PREDICTION is still shipped code, one block through `simulateReservoirs`.
 * The MAP alone: a rival's posterior ± would be its own reading.
 */
function fitChainedDrainRate(observations: ChainedObservation[], prior: number): number {
	const used = observations.filter((o) => o.demand > 0 && o.hours > 0);

	if (used.length === 0) return prior;

	const objective = (alpha: number): number => {
		let sum = DRAIN_PRIOR_STRENGTH * (alpha - prior) * (alpha - prior);

		for (const o of used) {
			const resid = o.drainedFraction - drainedUnder(alpha, o);
			sum += resid * resid;
		}

		return sum;
	};

	return minimize(objective, ALPHA_FIT_MIN, ALPHA_FIT_MAX);
}

/** The whole log read three ways, each as one α̂ per reservoir. */
function alphasOf(
	rows: DrainObservationRecord[],
): Record<Estimator, { cog: number; phys: number }> {
	const starts = startLevelsOf(rows);

	const chained = (
		demandOf: (row: DrainObservationRecord) => number,
		ratingOf: (row: DrainObservationRecord) => number,
		reservoir: 'cog' | 'phys',
		prior: number,
	): number =>
		fitChainedDrainRate(
			rows.map((row, index) => ({
				demand: demandOf(row),
				hours: row.hours,
				drainedFraction: ratingOf(row) / 10,
				start: starts[index][reservoir],
			})),
			prior,
		);

	return {
		shipped: fitOf(rows),
		'day-first': fitOf(dayFirstRows(rows)),
		chained: {
			cog: chained(
				(row) => row.cognitiveDemand,
				(row) => row.mindDrain,
				'cog',
				DEFAULT_ENERGY_PARAMS.alphaCog,
			),
			phys: chained(
				(row) => row.physicalDemand,
				(row) => row.bodyDrain,
				'phys',
				DEFAULT_ENERGY_PARAMS.alphaPhys,
			),
		},
	};
}

interface SeedRun {
	alphas: Record<Estimator, { cog: number; phys: number }>;
	rows: number;
	/** The hour-of-day term per construction, per reservoir. */
	terms: Record<Construction, { cog: HourTerm; phys: HourTerm }>;
	/**
	 * Mean row residual at the TRUE α, split by whether the row is its day's
	 * earliest. Those rows started at C₀ = 1 exactly, so what they leave is the
	 * 0–10 quantizer's; the later rows carry the fresh-start deficit on top of
	 * it. The split is what says which of the two inflates α̂.
	 */
	atTruth: Record<Reservoir, { first: number; later: number }>;
}

/**
 * `rivals` runs reading 4's two extra estimators, which reading 1–3's cells
 * have no use for and which cost a fit apiece. Only the a = 0 arms ask for
 * them: the fresh-start bias they price is what α̂ carries with no circadian
 * term anywhere in the truth.
 */
function runSeed(arm: Arm, seed: number, rivals: boolean): SeedRun {
	const rows = synthesize(arm, seed);

	const alphas = rivals
		? alphasOf(rows)
		: {
				shipped: fitOf(rows),
				'day-first': {
					cog: Number.NaN,
					phys: Number.NaN,
				},
				chained: {
					cog: Number.NaN,
					phys: Number.NaN,
				},
			};

	const fit = alphas.shipped;
	const earliest = new Set(dayFirstRows(rows));
	// `fresh-start` predicts each row on its own, so a subset's residuals are
	// the same rows' residuals — the split costs nothing but the partition.
	const first = residualsOf('fresh-start', [...earliest], TRUE_FIT);

	const later = residualsOf(
		'fresh-start',
		rows.filter((row) => !earliest.has(row)),
		TRUE_FIT,
	);

	const terms = Object.fromEntries(
		CONSTRUCTIONS.map((construction) => {
			const residuals = residualsOf(construction, rows, fit);

			return [
				construction,
				{
					cog: fitHourTerm(residuals.cog),
					phys: fitHourTerm(residuals.phys),
				},
			];
		}),
	) as Record<Construction, { cog: HourTerm; phys: HourTerm }>;

	return {
		alphas,
		rows: rows.length,
		terms,
		atTruth: {
			cog: {
				first: meanResidual(first.cog),
				later: meanResidual(later.cog),
			},
			phys: {
				first: meanResidual(first.phys),
				later: meanResidual(later.phys),
			},
		},
	};
}

const cellOf = (arm: Arm, rivals = false): SeedRun[] =>
	Array.from({
		length: SEEDS,
	}).map((_, seed) => runSeed(arm, BASE_SEED + seed, rivals));

/** Indexed [routine][amplitude index into AMPLITUDES]. */
const cells = ROUTINES.map((routine) =>
	AMPLITUDES.map((amplitude) => cellOf(routineArm(routine, amplitude, 0), amplitude === 0)),
);

/** The a = 0 control: the same routines with 30% of the worked sessions unlogged. */
const control = ROUTINES.map((routine) => cellOf(routineArm(routine, 0, DROP_SHARE), true));

/** The same a = 0 logger with NO rating noise: what the quantizer alone leaves. */
const noiseless = ROUTINES.map((routine) =>
	cellOf(
		{
			...routineArm(routine, 0, 0),
			noiseStd: 0,
		},
		true,
	),
);

const selfCheck = cellOf(SELF_CHECK_ARM);

type Reservoir = 'cog' | 'phys';

const RESERVOIRS: Reservoir[] = ['cog', 'phys'];

const TRUE_ALPHA: Record<Reservoir, number> = {
	cog: DEFAULT_ENERGY_PARAMS.alphaCog,
	phys: DEFAULT_ENERGY_PARAMS.alphaPhys,
};

const median = (values: number[]): number => {
	const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);

	return sorted.length === 0 ? Number.NaN : sorted[Math.floor(sorted.length / 2)];
};

const termOf = (run: SeedRun, construction: Construction, reservoir: Reservoir): HourTerm =>
	run.terms[construction][reservoir];

const amplitudesOf = (
	runs: SeedRun[],
	construction: Construction,
	reservoir: Reservoir,
): number[] => runs.map((run) => termOf(run, construction, reservoir).amplitude);

/** The artifact's ceiling: the largest amplitude the a = 0 seeds produced. */
const ceilingOf = (runs: SeedRun[], construction: Construction, reservoir: Reservoir): number =>
	Math.max(
		...amplitudesOf(runs, construction, reservoir).filter((value) => Number.isFinite(value)),
	);

const shareAbove = (
	runs: SeedRun[],
	construction: Construction,
	reservoir: Reservoir,
	ceiling: number,
): number =>
	amplitudesOf(runs, construction, reservoir).filter((value) => value > ceiling).length /
	runs.length;

const identifiedCount = (
	runs: SeedRun[],
	construction: Construction,
	reservoir: Reservoir,
): number =>
	amplitudesOf(runs, construction, reservoir).filter((value) => Number.isFinite(value)).length;

/** Circular distance in hours on a 24 h clock. */
const hourDistance = (a: number, b: number): number => {
	const gap = Math.abs(a - b) % 24;

	return Math.min(gap, 24 - gap);
};

/**
 * The recovered peak hours are a circular sample, so they are summarized as a
 * circular mean with its resultant length R (1 = every seed at one hour,
 * 0 = uniform around the clock) and the share landing within NEAR_PEAK_HOURS
 * of the truth.
 */
function peakSummary(
	runs: SeedRun[],
	construction: Construction,
	reservoir: Reservoir,
): { hour: number; resultant: number; shareNear: number } {
	const peaks = runs
		.map((run) => termOf(run, construction, reservoir).peakHour)
		.filter((peak) => Number.isFinite(peak));

	const angles = peaks.map((peak) => (2 * Math.PI * peak) / 24);
	const cosine = angles.reduce((sum, angle) => sum + Math.cos(angle), 0) / angles.length;
	const sine = angles.reduce((sum, angle) => sum + Math.sin(angle), 0) / angles.length;

	return {
		hour: ((((Math.atan2(sine, cosine) * 24) / (2 * Math.PI)) % 24) + 24) % 24,
		resultant: Math.sqrt(cosine * cosine + sine * sine),
		shareNear:
			peaks.filter((peak) => hourDistance(peak, TRUE_PEAK_HOUR) <= NEAR_PEAK_HOURS).length /
			peaks.length,
	};
}

const row = (label: string, cells_: string[]): string =>
	`  ${label.padEnd(16)}${cells_.map((cell) => cell.padStart(16)).join('')}`;

const amplitudeHeader = row(
	'a',
	AMPLITUDES.map((amplitude) => amplitude.toFixed(2)),
);

const peakCell = (summary: { hour: number; resultant: number }): string =>
	`${summary.hour.toFixed(1)}h R=${summary.resultant.toFixed(2)}`;

/** The a = 0 reading for one construction × reservoir, and the ceiling it sets. */
function printCeiling(
	routineIndex: number,
	construction: Construction,
	reservoir: Reservoir,
): number {
	const runs = cells[routineIndex][0];
	const ceiling = ceilingOf(runs, construction, reservoir);
	const peak = peakSummary(runs, construction, reservoir);

	console.log(
		`[§8.7] ${ROUTINES[routineIndex]}/${construction} α_${reservoir}: ceiling ` +
			`${ceiling.toFixed(4)} (max over ${SEEDS} a = 0 seeds, ` +
			`${identifiedCount(runs, construction, reservoir)} identified), median ` +
			`${median(amplitudesOf(runs, construction, reservoir)).toFixed(4)}, median intercept ` +
			`${median(runs.map((run) => termOf(run, construction, reservoir).intercept)).toFixed(4)}, ` +
			`${median(runs.map((run) => termOf(run, construction, reservoir).pointCount))} rows at ` +
			`${median(runs.map((run) => termOf(run, construction, reservoir).distinctHours))} distinct ` +
			`clock hours (median |design| ` +
			`${median(runs.map((run) => termOf(run, construction, reservoir).determinant)).toExponential(2)}), ` +
			`peak ${peakCell(peak)} (${(100 * peak.shareNear).toFixed(0)}% within ` +
			`±${NEAR_PEAK_HOURS} h of ${TRUE_PEAK_HOUR}:00)`,
	);

	return ceiling;
}

/** The smallest a whose MEDIAN amplitude clears the ceiling; -1 when none does. */
const smallestVisible = (
	routineIndex: number,
	construction: Construction,
	reservoir: Reservoir,
	ceiling: number,
): number =>
	AMPLITUDES.findIndex(
		(amplitude, a) =>
			amplitude > 0 &&
			median(amplitudesOf(cells[routineIndex][a], construction, reservoir)) > ceiling,
	);

/** The amplitude sweep against that ceiling, with the phase it recovers at each a. */
function printSweep(
	routineIndex: number,
	construction: Construction,
	ceilings: Record<Reservoir, number>,
): void {
	const label = `${ROUTINES[routineIndex]}/${construction}`;

	console.log(
		`[§8.7] ${label}: median recovered amplitude (share of ${SEEDS} seeds above the ceiling), ` +
			`then the circular-mean peak hour with its resultant R, then the share of seeds ` +
			`peaking within ±${NEAR_PEAK_HOURS} h of ${TRUE_PEAK_HOUR}:00 — the one of the three a ` +
			`single logger could compute for themselves`,
	);

	console.log(amplitudeHeader);

	for (const reservoir of RESERVOIRS) {
		console.log(
			row(
				`α_${reservoir}`,
				AMPLITUDES.map(
					(_, a) =>
						`${median(amplitudesOf(cells[routineIndex][a], construction, reservoir)).toFixed(4)}` +
						` (${(100 * shareAbove(cells[routineIndex][a], construction, reservoir, ceilings[reservoir])).toFixed(0)}%)`,
				),
			),
		);

		console.log(
			row(
				`α_${reservoir} peak`,
				AMPLITUDES.map((_, a) =>
					peakCell(peakSummary(cells[routineIndex][a], construction, reservoir)),
				),
			),
		);

		console.log(
			row(
				`α_${reservoir} near16`,
				AMPLITUDES.map(
					(_, a) =>
						`${(100 * peakSummary(cells[routineIndex][a], construction, reservoir).shareNear).toFixed(0)}%`,
				),
			),
		);
	}

	for (const reservoir of RESERVOIRS) {
		const visible = smallestVisible(routineIndex, construction, reservoir, ceilings[reservoir]);

		console.log(
			visible === -1
				? `[§8.7] ${label} α_${reservoir}: no a up to ${AMPLITUDES[AMPLITUDES.length - 1]} has a ` +
						`median amplitude above the ${ceilings[reservoir].toFixed(4)} ceiling`
				: `[§8.7] ${label} α_${reservoir}: smallest visible a = ${AMPLITUDES[visible]} (median ` +
						`amplitude ` +
						`${median(amplitudesOf(cells[routineIndex][visible], construction, reservoir)).toFixed(4)} ` +
						`against ${ceilings[reservoir].toFixed(4)}, ` +
						`${(100 * shareAbove(cells[routineIndex][visible], construction, reservoir, ceilings[reservoir])).toFixed(0)}% ` +
						`of seeds clear it)`,
		);
	}
}

const fmtPool = (hours: number | null): string =>
	hours === null || Number.isNaN(hours) ? 'none' : `${hours.toFixed(2)} h`;

/** §8.13's map, where α̂'s bias is actually spent — monotone, and near a pole. */
const poolOf = (alpha: number): number | null =>
	capacityFromDrainRate(alpha, DEFAULT_ENERGY_PARAMS);

const rootMeanSquare = (values: number[], truth: number): number =>
	Math.sqrt(values.reduce((sum, value) => sum + (value - truth) ** 2, 0) / values.length);

const signed = (value: number, digits: number): string =>
	`${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`;

const priceHeader = row('', ['median α̂', 'median err', 'RMSE', 'pool', 'Δ pool']);

/**
 * One reservoir's three α̂ scored against the rate the generator actually used,
 * and each carried through §8.13 into the pool of hours the app would offer.
 * The pool is the point of the row: `capacityFromDrainRate` is monotone in α
 * and sits near its own pole, so a small error in α̂ is not a small error in
 * hours, and that map is where the whole chain spends the bias.
 */
function printAlphaPrice(label: string, runs: SeedRun[], reservoir: Reservoir): void {
	const truth = TRUE_ALPHA[reservoir];
	const truePool = poolOf(truth);

	console.log(`[§8.7] ${label} α_${reservoir} (true α ${truth}, true pool ${fmtPool(truePool)})`);
	console.log(priceHeader);

	for (const estimator of ESTIMATORS) {
		const alphas = runs.map((run) => run.alphas[estimator][reservoir]);
		const pools = runs.map((run) => poolOf(run.alphas[estimator][reservoir]));
		const offered = pools.filter((pool): pool is number => pool !== null);
		const pool = offered.length === pools.length ? median(offered) : Number.NaN;

		console.log(
			row(estimator, [
				median(alphas).toFixed(4),
				signed(median(alphas) - truth, 4),
				rootMeanSquare(alphas, truth).toFixed(4),
				fmtPool(pool),
				truePool === null || Number.isNaN(pool) ? '—' : `${signed(pool - truePool, 2)} h`,
			]),
		);
	}
}

/** Every reading's ceilings, indexed [routine][construction][reservoir]. */
const ceilings = ROUTINES.map(
	(_, routineIndex) =>
		Object.fromEntries(
			CONSTRUCTIONS.map((construction) => [
				construction,
				Object.fromEntries(
					RESERVOIRS.map((reservoir) => [
						reservoir,
						ceilingOf(cells[routineIndex][0], construction, reservoir),
					]),
				) as Record<Reservoir, number>,
			]),
		) as Record<Construction, Record<Reservoir, number>>,
);

describe('MATH.md §8.7 — whether an hour-of-day drain term can be read off 🪫 logs', () => {
	it('self-check: one session a day, no rating noise — the fit recovers the generator', () => {
		const recovered: Record<Reservoir, number> = {
			cog: median(selfCheck.map((run) => run.alphas.shipped.cog)),
			phys: median(selfCheck.map((run) => run.alphas.shipped.phys)),
		};

		const errors = RESERVOIRS.map((reservoir) =>
			Math.abs(recovered[reservoir] - TRUE_ALPHA[reservoir]),
		);

		console.log(
			`[§8.7] self-check, a = 0 with one session a day from a full reservoir and no rating ` +
				`noise (${SEEDS} seeds, ${DAYS} days, median ${median(selfCheck.map((run) => run.rows))} ` +
				`rows, median MAP): ${RESERVOIRS.map(
					(reservoir, i) =>
						`α_${reservoir} ${recovered[reservoir].toFixed(4)} against ` +
						`${TRUE_ALPHA[reservoir]} (${((100 * errors[i]) / TRUE_ALPHA[reservoir]).toFixed(1)}%)`,
				).join(', ')}`,
		);

		const medians = RESERVOIRS.map((reservoir) =>
			median(amplitudesOf(selfCheck, 'fresh-start', reservoir)),
		);

		console.log(
			`[§8.7] self-check: median recovered amplitude ${RESERVOIRS.map(
				(reservoir, i) =>
					`α_${reservoir} ${medians[i].toFixed(4)} against the jittered fresh-start ceiling ` +
					`${ceilings[1]['fresh-start'][reservoir].toFixed(4)}`,
			).join(', ')}`,
		);

		console.log(
			errors.every((error, i) => error < 0.1 * TRUE_ALPHA[RESERVOIRS[i]]) &&
				medians.every((value, i) => value < ceilings[1]['fresh-start'][RESERVOIRS[i]])
				? '[§8.7] self-check VALID — the generator and the fit agree'
				: '[§8.7] self-check INVALID — every cell below is noise',
		);

		// Load-bearing: if §8.7's own model cannot recover the generator that
		// produced it, no cell below means anything.
		for (const [i, error] of errors.entries())
			expect(error).toBeLessThan(0.1 * TRUE_ALPHA[RESERVOIRS[i]]);

		for (const [i, value] of medians.entries())
			expect(value).toBeLessThan(ceilings[1]['fresh-start'][RESERVOIRS[i]]);
	});

	it('reading 1 — the artifact: the hour-of-day term a truth with NONE still shows', () => {
		console.log(
			`[§8.7] rows spread uniformly around the clock read |design| ` +
				`${UNIFORM_DESIGN.toFixed(4)} — the most the mean-normalized form can reach, and what ` +
				`every |design| below is a share of`,
		);

		for (const [routineIndex, routine] of ROUTINES.entries()) {
			console.log(
				`[§8.7] ${routine}: ${DAYS} days, 2–4 sessions each, median ` +
					`${median(cells[routineIndex][0].map((run) => run.rows))} rows a seed; the fit ` +
					`conditions on the TRUE recovery rate ${DEFAULT_ENERGY_PARAMS.recoveryRate}`,
			);

			for (const reservoir of RESERVOIRS) printCeiling(routineIndex, 'fresh-start', reservoir);

			// Two sources push the same way, so the inflation is split before it is
			// attributed: a day's earliest row started at C₀ = 1 exactly, so what it
			// leaves at the TRUE α is the 0–10 quantizer's alone.
			console.log(
				`[§8.7] ${routine}: mean row residual at the TRUE α, median over seeds — ` +
					`${RESERVOIRS.map(
						(reservoir) =>
							`α_${reservoir} ${median(cells[routineIndex][0].map((run) => run.atTruth[reservoir].first)).toFixed(4)} on each day's earliest row, ` +
							`${median(cells[routineIndex][0].map((run) => run.atTruth[reservoir].later)).toFixed(4)} on the rest`,
					).join(', ')}`,
			);

			for (const reservoir of RESERVOIRS) {
				const runs = noiseless[routineIndex];
				const peak = peakSummary(runs, 'fresh-start', reservoir);

				console.log(
					`[§8.7] ${routine} α_${reservoir} with NO rating noise (the 0-notch clamp ` +
						`unreachable, rounding only): mean residual at the TRUE α ` +
						`${median(runs.map((run) => run.atTruth[reservoir].first)).toFixed(4)} earliest / ` +
						`${median(runs.map((run) => run.atTruth[reservoir].later)).toFixed(4)} rest, ` +
						`median whole-log α̂ ` +
						`${median(runs.map((run) => run.alphas.shipped[reservoir])).toFixed(4)} ` +
						`against ${TRUE_ALPHA[reservoir]}, fresh-start ceiling ` +
						`${ceilingOf(runs, 'fresh-start', reservoir).toFixed(4)}, median ` +
						`${median(amplitudesOf(runs, 'fresh-start', reservoir)).toFixed(4)}, peak ` +
						`${peakCell(peak)} (${(100 * peak.shareNear).toFixed(0)}% within ` +
						`±${NEAR_PEAK_HOURS} h of ${TRUE_PEAK_HOUR}:00)`,
				);
			}

			console.log(`[§8.7] ${routine}: median whole-log α̂ and rows, across the sweep`);
			console.log(amplitudeHeader);

			for (const reservoir of RESERVOIRS)
				console.log(
					row(
						`fit α_${reservoir}`,
						AMPLITUDES.map(
							(_, a) =>
								`${median(cells[routineIndex][a].map((run) => run.alphas.shipped[reservoir])).toFixed(4)}` +
								` (${TRUE_ALPHA[reservoir]})`,
						),
					),
				);

			console.log(
				row(
					'rows',
					AMPLITUDES.map((_, a) => `${median(cells[routineIndex][a].map((run) => run.rows))}`),
				),
			);
		}
	});

	it('reading 2 — the smallest true amplitude that clears the artifact', () => {
		for (const [routineIndex] of ROUTINES.entries())
			printSweep(routineIndex, 'fresh-start', ceilings[routineIndex]['fresh-start']);
	});

	it('reading 3 — the two corrections the stored rows already allow', () => {
		for (const construction of ['day-first', 'chained'] as Construction[])
			for (const [routineIndex, routine] of ROUTINES.entries()) {
				for (const reservoir of RESERVOIRS) printCeiling(routineIndex, construction, reservoir);

				printSweep(routineIndex, construction, ceilings[routineIndex][construction]);

				for (const reservoir of RESERVOIRS) {
					const fresh = ceilings[routineIndex]['fresh-start'][reservoir];
					const corrected = ceilings[routineIndex][construction][reservoir];
					const freshVisible = smallestVisible(routineIndex, 'fresh-start', reservoir, fresh);

					const correctedVisible = smallestVisible(
						routineIndex,
						construction,
						reservoir,
						corrected,
					);

					console.log(
						`[§8.7] ${routine}/${construction} α_${reservoir} priced against fresh-start: ` +
							`ceiling ${fresh.toFixed(4)} → ${corrected.toFixed(4)} ` +
							`(${(corrected / fresh).toFixed(2)}×), smallest visible a ` +
							`${freshVisible === -1 ? 'none' : AMPLITUDES[freshVisible]} → ` +
							`${correctedVisible === -1 ? 'none' : AMPLITUDES[correctedVisible]}, rows ` +
							`${median(cells[routineIndex][0].map((run) => termOf(run, 'fresh-start', reservoir).pointCount))} → ` +
							`${median(cells[routineIndex][0].map((run) => termOf(run, construction, reservoir).pointCount))}`,
					);
				}
			}
	});

	it(`the a = 0 control — chaining with ${100 * DROP_SHARE}% of the worked sessions never logged`, () => {
		for (const [routineIndex, routine] of ROUTINES.entries()) {
			const runs = control[routineIndex];

			console.log(
				`[§8.7] ${routine}, a = 0 with ${(100 * DROP_SHARE).toFixed(0)}% of each day's ` +
					`sessions unlogged (the truth still drains through them): median ` +
					`${median(runs.map((run) => run.rows))} rows a seed against ` +
					`${median(cells[routineIndex][0].map((run) => run.rows))} logged in full`,
			);

			for (const reservoir of RESERVOIRS) {
				const peak = peakSummary(runs, 'chained', reservoir);
				const ceiling = ceilings[routineIndex].chained[reservoir];

				console.log(
					`[§8.7] ${routine}/chained α_${reservoir} under the control: ceiling ` +
						`${ceilingOf(runs, 'chained', reservoir).toFixed(4)}, median ` +
						`${median(amplitudesOf(runs, 'chained', reservoir)).toFixed(4)}, median intercept ` +
						`${median(runs.map((run) => termOf(run, 'chained', reservoir).intercept)).toFixed(4)}, ` +
						`peak ${peakCell(peak)} (${(100 * peak.shareNear).toFixed(0)}% within ` +
						`±${NEAR_PEAK_HOURS} h of ${TRUE_PEAK_HOUR}:00) — against the perfect logger's ` +
						`${ceiling.toFixed(4)} ceiling, ` +
						`${(100 * shareAbove(runs, 'chained', reservoir, ceiling)).toFixed(0)}% of its seeds ` +
						`clear it`,
				);

				console.log(
					`[§8.7] ${routine}/fresh-start α_${reservoir} under the control: median ` +
						`${median(amplitudesOf(runs, 'fresh-start', reservoir)).toFixed(4)} against the ` +
						`${ceilings[routineIndex]['fresh-start'][reservoir].toFixed(4)} fresh-start ceiling`,
				);
			}
		}
	});

	it('reading 4 — what the chaining repair buys α itself, and the pool behind it', () => {
		// a = 0 only: with no circadian term anywhere in the truth, every bit of
		// α̂'s error is the fresh-start approximation's and the quantizer's, which
		// is the whole of what a chained start could repair.
		const arms: { label: string; runs: SeedRun[][] }[] = [
			{
				label: "the app's logger",
				runs: cells.map((byAmplitude) => byAmplitude[0]),
			},
			{
				label: 'no rating noise',
				runs: noiseless,
			},
			{
				label: `${(100 * DROP_SHARE).toFixed(0)}% of sessions unlogged`,
				runs: control,
			},
		];

		for (const arm of arms)
			for (const [routineIndex, routine] of ROUTINES.entries())
				for (const reservoir of RESERVOIRS)
					printAlphaPrice(`${routine}, ${arm.label}:`, arm.runs[routineIndex], reservoir);

		// What chaining has to beat is not zero error: the earliest row of every
		// day already starts at C₀ = 1, so part of the shipped fit's inflation is
		// the 0–10 quantizer's and no start level can touch it. The noiseless arm
		// is where the two separate, so the shipped α̂ is printed side by side.
		for (const [routineIndex, routine] of ROUTINES.entries())
			for (const reservoir of RESERVOIRS)
				console.log(
					`[§8.7] ${routine} α_${reservoir}: shipped α̂ ` +
						`${median(cells[routineIndex][0].map((run) => run.alphas.shipped[reservoir])).toFixed(4)} ` +
						`with the rating noise on and ` +
						`${median(noiseless[routineIndex].map((run) => run.alphas.shipped[reservoir])).toFixed(4)} ` +
						`with it off, against a true ${TRUE_ALPHA[reservoir]} — the part between the two is ` +
						`the clamp's, and what a chained start can repair is the rest`,
				);
	});
});
