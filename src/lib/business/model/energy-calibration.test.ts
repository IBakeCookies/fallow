import { describe, it, expect } from 'vitest';
import {
	calibrateEnergyParams,
	rankDrainByTask,
	RESERVOIR_CYCLE_HOURS,
	seedMorningReservoirs,
	toCognitiveDrainObservations,
	toPhysicalDrainObservations,
	toRestObservations,
} from '$lib/business/model/energy-calibration';
import {
	DEFAULT_ENERGY_PARAMS,
	fitDrainRate,
	fitRecoveryRate,
	simulateReservoirs,
} from '$lib/business/model/zenith-energy';
import type { DrainObservationRecord, RestObservationRecord } from '$lib/data/type';

const drainRecord = (over: Partial<DrainObservationRecord> = {}): DrainObservationRecord => ({
	date: '2026-07-20',
	taskId: 1,
	taskTitle: 'deep work',
	hours: 2,
	cognitiveDemand: 0.8,
	physicalDemand: 0.3,
	mindDrain: 6,
	bodyDrain: 2,
	createdAt: 0,
	...over,
});

const restRecord = (over: Partial<RestObservationRecord> = {}): RestObservationRecord => ({
	date: '2026-07-20',
	hours: 0.5,
	mindBefore: 8,
	mindAfter: 5,
	bodyBefore: 4,
	bodyAfter: 1,
	createdAt: 0,
	...over,
});

describe('record → observation mappings', () => {
	it('maps the 0–10 ratings to [0,1] fractions and leaves the demands alone', () => {
		const records = [drainRecord()];

		expect(toCognitiveDrainObservations(records)).toEqual([
			{
				demand: 0.8,
				hours: 2,
				drainedFraction: 0.6,
			},
		]);

		expect(toPhysicalDrainObservations(records)).toEqual([
			{
				demand: 0.3,
				hours: 2,
				drainedFraction: 0.2,
			},
		]);
	});

	it('flattens each rest pair into both reservoirs, which share the one recovery rate', () => {
		expect(toRestObservations([restRecord()])).toEqual([
			{
				drainedBefore: 0.8,
				drainedAfter: 0.5,
				hours: 0.5,
			},
			{
				drainedBefore: 0.4,
				drainedAfter: 0.1,
				hours: 0.5,
			},
		]);
	});
});

describe('calibrateEnergyParams', () => {
	const rest = [
		restRecord(),
		restRecord({
			hours: 1,
			mindBefore: 9,
			mindAfter: 4,
		}),
	];

	const drain = [
		drainRecord(),
		drainRecord({
			hours: 3,
			cognitiveDemand: 0.5,
			mindDrain: 8,
			bodyDrain: 5,
		}),
	];

	// R3 guard: the Energy Lab feeds the same records through the same mappings
	// in its own sequence, so a mapping change must move both or neither.
	it('feeds the fits exactly the shared mappings, in the §8.7/§8.9 order', () => {
		const calibration = calibrateEnergyParams(rest, drain);

		const recovery = fitRecoveryRate(
			toRestObservations(rest),
			DEFAULT_ENERGY_PARAMS.recoveryRate,
			DEFAULT_ENERGY_PARAMS,
		);

		// Recovery is fitted FIRST, and the drain fits condition on its result.
		const conditioned = {
			...DEFAULT_ENERGY_PARAMS,
			recoveryRate: recovery.rate,
		};

		expect(calibration.recovery).toEqual(recovery);

		expect(calibration.cognitiveDrain).toEqual(
			fitDrainRate(toCognitiveDrainObservations(drain), conditioned.alphaCog, conditioned),
		);

		expect(calibration.physicalDrain).toEqual(
			fitDrainRate(toPhysicalDrainObservations(drain), conditioned.alphaPhys, conditioned),
		);
	});

	it('carries the seed through untouched for everything it did not fit', () => {
		const seed = {
			...DEFAULT_ENERGY_PARAMS,
			freeTimeValue: 1.23,
			satietyScale: 0.77,
		};

		const { params } = calibrateEnergyParams([], [], seed);

		// No logs → no fit succeeds → the seed comes back whole.
		expect(params).toEqual(seed);
		expect(params).not.toBe(seed);
	});
});

describe('seedMorningReservoirs', () => {
	// Slow enough that a night does not fully heal — the regime where
	// carry-over is visible at all.
	const slowRecovery = {
		...DEFAULT_ENERGY_PARAMS,
		recoveryRate: 0.1,
	};

	it('returns the params untouched when the previous day has no worked hours', () => {
		expect(seedMorningReservoirs(slowRecovery, [])).toBe(slowRecovery);

		expect(
			seedMorningReservoirs(slowRecovery, [
				drainRecord({
					hours: 0,
				}),
			]),
		).toBe(slowRecovery);
	});

	it('matches the closed-form law: work from fresh, then rest out the 24 h cycle', () => {
		const hours = 8;

		const seeded = seedMorningReservoirs(slowRecovery, [
			drainRecord({
				hours,
				cognitiveDemand: 1,
				physicalDemand: 0.5,
			}),
		]);

		// Independent oracle: C_work = eq + (1−eq)·e^(−ρh) with
		// ρ = α·w + r′·g, g = 1−(1−b)·w, eq = r′·g/ρ; then the night pulls
		// toward 1 at ρ_rest = r′ (gate is 1 at demand 0).
		const morning = (w: number, alpha: number) => {
			const rPrime = slowRecovery.recoveryRate * slowRecovery.restRecoveryMultiplier;
			const gate = 1 - (1 - slowRecovery.microRecoveryFraction) * w;
			const rho = alpha * w + rPrime * gate;
			const eq = (rPrime * gate) / rho;
			const afterWork = eq + (1 - eq) * Math.exp(-rho * hours);

			return 1 + (afterWork - 1) * Math.exp(-rPrime * (RESERVOIR_CYCLE_HOURS - hours));
		};

		expect(seeded.initialCog).toBeCloseTo(morning(1, slowRecovery.alphaCog), 12);
		expect(seeded.initialPhys).toBeCloseTo(morning(0.5, slowRecovery.alphaPhys), 12);
		expect(seeded.initialCog).toBeLessThan(1);

		// Only the two starting levels move; the calibration itself is untouched.
		expect({
			...seeded,
			initialCog: 1,
			initialPhys: 1,
		}).toEqual(slowRecovery);
	});

	it('heals completely overnight at default recovery — carry-over needs fitted evidence', () => {
		const seeded = seedMorningReservoirs(DEFAULT_ENERGY_PARAMS, [
			drainRecord({
				hours: 10,
				cognitiveDemand: 1,
				physicalDemand: 1,
			}),
		]);

		expect(seeded.initialCog).toBeGreaterThan(0.999);
		expect(seeded.initialPhys).toBeGreaterThan(0.999);
	});

	// The scope for the ONE approximation behind both as-logged
	// order and omitted intraday breaks (permuting the cycle's blocks): attenuated
	// by the trailing rest, so invisible at defaults and worth ~9 points at the r
	// fit floor. `scripts/mtr2-carry-over.probe.ts` sweeps the grid; these are its
	// two ends.
	it('reads block order only in proportion to the trailing rest', () => {
		const asLogged = [
			drainRecord({
				hours: 8,
				cognitiveDemand: 1,
				physicalDemand: 0.1,
			}),
			drainRecord({
				hours: 5,
				cognitiveDemand: 0.2,
				physicalDemand: 1,
			}),
			drainRecord({
				hours: 3,
				cognitiveDemand: 0.5,
				physicalDemand: 0.5,
			}),
		];

		const reversed = [...asLogged].reverse();
		const gap = RESERVOIR_CYCLE_HOURS - 16;
		const healed = seedMorningReservoirs(DEFAULT_ENERGY_PARAMS, asLogged);
		const healedReversed = seedMorningReservoirs(DEFAULT_ENERGY_PARAMS, reversed);

		// e^(−1.05·8) ≈ 2·10⁻⁴ of any end-of-work difference survives the gap.
		expect(healedReversed.initialCog).toBeCloseTo(healed.initialCog, 3);

		expect(healedReversed.initialPhys).toBeCloseTo(healed.initialPhys, 3);

		// The same gap at the fit floor keeps e^(−0.15·8) ≈ 0.30 of it, and this
		// day spends 9 points of that — the regime the section has to scope.
		const slow = seedMorningReservoirs(slowRecovery, asLogged);
		const slowReversed = seedMorningReservoirs(slowRecovery, reversed);
		const moved = Math.abs(slowReversed.initialCog - slow.initialCog);

		expect(moved).toBeGreaterThan(0.05);

		expect(moved).toBeLessThan(
			Math.exp(-slowRecovery.recoveryRate * slowRecovery.restRecoveryMultiplier * gap),
		);
	});

	it('is monotone: a longer previous day starts the morning lower', () => {
		const morningCog = (hours: number) =>
			seedMorningReservoirs(slowRecovery, [
				drainRecord({
					hours,
					cognitiveDemand: 1,
				}),
			]).initialCog;

		const levels = [2, 6, 10, 16].map(morningCog);

		for (let i = 1; i < levels.length; i++) {
			expect(levels[i]).toBeLessThan(levels[i - 1]);
		}
	});

	// Two rows for ONE task became possible with per-session rows,
	// and the demands go into `simulateReservoirs` keyed by id — so sharing the
	// taskId let the later row's demands re-rate the earlier session, which is
	// what capturing demands at logging time exists to prevent (§8.7).
	it("keeps each session's own demands when a task is rated twice in a day", () => {
		const twoSessions = seedMorningReservoirs(slowRecovery, [
			drainRecord({
				hours: 3,
				cognitiveDemand: 0.9,
			}),
			drainRecord({
				hours: 3,
				cognitiveDemand: 0.2,
			}),
		]);

		// The same two sessions, told apart by task, are the same day's work.
		const twoTasks = seedMorningReservoirs(slowRecovery, [
			drainRecord({
				hours: 3,
				cognitiveDemand: 0.9,
			}),
			drainRecord({
				taskId: 2,
				hours: 3,
				cognitiveDemand: 0.2,
			}),
		]);

		expect(twoSessions.initialCog).toBeCloseTo(twoTasks.initialCog, 12);

		// ...and NOT the reading where the second row's lighter demand applies to
		// both blocks, which is what a taskId-keyed lookup collapses to.
		const bothLight = seedMorningReservoirs(slowRecovery, [
			drainRecord({
				hours: 6,
				cognitiveDemand: 0.2,
			}),
		]);

		expect(twoSessions.initialCog).toBeLessThan(bothLight.initialCog);
	});

	it('gives an over-logged day NO rest at all, not a negative or mirrored gap', () => {
		// The gap is max(0, 24 − Σh), so a 26 h day gets no rest block: the
		// morning level must equal 26 h of straight work. Asserting only
		// 0 < level < 1 (as this test once did) pins nothing — dropping the guard
		// is bit-identical because `simulateReservoirs` already skips hours ≤ 0,
		// and a sign slip (`Math.abs(24 − Σh)`, handing the day 2 h of BONUS rest)
		// still lands inside the range while moving Burnout Risk 98 → 73.
		const overLogged = [
			drainRecord({
				hours: 26,
				cognitiveDemand: 1,
				physicalDemand: 1,
			}),
		];

		const seeded = seedMorningReservoirs(slowRecovery, overLogged);

		const pureWork = simulateReservoirs(
			[
				{
					taskId: 0,
					hours: 26,
				},
			],
			[
				{
					id: 0,
					cognitiveDemand: 1,
					physicalDemand: 1,
				},
			],
			{
				...slowRecovery,
				initialCog: 1,
				initialPhys: 1,
			},
		);

		expect(seeded.initialCog).toBe(pureWork.endCog);
		expect(seeded.initialPhys).toBe(pureWork.endPhys);

		// Still a valid level, and never above the day that DID get its night.
		expect(seeded.initialCog).toBeGreaterThan(0);
		expect(seeded.initialCog).toBeLessThan(1);

		expect(seeded.initialCog).toBeLessThanOrEqual(
			seedMorningReservoirs(slowRecovery, [
				drainRecord({
					hours: 24,
					cognitiveDemand: 1,
					physicalDemand: 1,
				}),
			]).initialCog,
		);
	});

	it('anchors the cycle at 24 h — the constant itself, which no oracle pins', () => {
		// The 24 h cycle derives from work-start-to-work-start being the only
		// anchor available (no clock times are stored). Every other test here is
		// insensitive to it: the 12-decimal oracle above IMPORTS
		// RESERVOIR_CYCLE_HOURS into its own expectation, the healing bound
		// (> 0.999) tolerates cycles down to 17 h, and the store's carry-over test
		// is directional and only gets stronger as the cycle shrinks — so 24 → 17
		// and 24 → 48 both passed the full suite before this line existed.
		expect(RESERVOIR_CYCLE_HOURS).toBe(24);
	});
});

describe('as-of-day vs whole-history fit', () => {
	// Pins `scripts/fit-snapshot-drift.probe.ts`. The entire case for the
	// `fitSnapshots` store is that an early day audited against the CURRENT fit
	// is audited against a drain rate its own logs never supported. Nothing in
	// the suite measured that; the numbers behind it (0.3069 / 0.4973) were
	// prose from a probe that was thrown away.
	const drainingDay = (day: number, alpha: number): DrainObservationRecord[] =>
		[0, 1, 2].map((i) => {
			const hours = 1 + (i % 3) * 0.5;
			const demand = 0.5 + (i % 4) * 0.1;

			return drainRecord({
				date: `2026-${String(1 + Math.floor(day / 28)).padStart(2, '0')}-${String((day % 28) + 1).padStart(2, '0')}`,
				taskId: i + 1,
				hours,
				cognitiveDemand: demand,
				physicalDemand: demand * 0.6,
				mindDrain: Math.round((1 - Math.exp(-alpha * demand * hours)) * 10),
				bodyDrain: 2,
				createdAt: day * 86_400_000 + i,
			});
		});

	const historyFor = (days: number, alphaOn: (day: number) => number): DrainObservationRecord[] =>
		Array.from(
			{
				length: days,
			},
			(_, day) => drainingDay(day, alphaOn(day)),
		).flat();

	const alphaCogOf = (drain: DrainObservationRecord[]) =>
		calibrateEnergyParams([], drain).params.alphaCog;

	it("a drifting user's day-10 fit is far below the whole-history fit", () => {
		const days = 120;
		const drifting = historyFor(days, (day) => 0.25 + (0.55 - 0.25) * (day / days));
		const early = alphaCogOf(drifting.filter((r) => r.createdAt < 10 * 86_400_000));
		const whole = alphaCogOf(drifting);

		// The bias the store exists to remove: auditing day 10 against `whole`
		// prices it at a drain rate its own logs never saw.
		expect(whole).toBeGreaterThan(early * 1.2);
	});

	it('and a NON-drifting user shows no such gap — the effect is the drift', () => {
		const days = 120;
		const flat = historyFor(days, () => 0.4);
		const early = alphaCogOf(flat.filter((r) => r.createdAt < 10 * 86_400_000));
		const whole = alphaCogOf(flat);

		// Control. Without this the test above would also pass on a fit that is
		// simply unstable at small n, which is a different (and cheaper) problem.
		expect(Math.abs(whole - early) / early).toBeLessThan(0.1);
	});
});

describe('rankDrainByTask', () => {
	const TODAY = '2026-07-20';
	const RANGE_START = '2026-06-21';

	// `createdAt` is what orders a day's sessions, so it is a parameter here and
	// not a default: the day's earliest row is the only eligible one (MATH.md §8.14).
	const row = (
		date: string,
		taskTitle: string,
		mindDrain: number,
		createdAt: number,
	): DrainObservationRecord => ({
		date,
		taskId: 1,
		taskTitle,
		hours: 2,
		cognitiveDemand: 0.8,
		physicalDemand: 0,
		mindDrain,
		bodyDrain: 0,
		createdAt,
	});

	/** `days` days of that title as the day's FIRST session, plus a later row nobody ranks. */
	const firstOn = (days: string[], taskTitle: string, mindDrain: number) =>
		days.map((date) => row(date, taskTitle, mindDrain, 100));

	const INBOX_DAYS = ['2026-07-06', '2026-07-07', '2026-07-08'];
	const DEEP_DAYS = ['2026-07-09', '2026-07-10', '2026-07-11'];
	// α̂ ≈ 0.20 against ≈ 0.95 — a gap several times the two posterior stds, so
	// these two clear §8.14's separation gate.
	const inbox = (days = INBOX_DAYS) => firstOn(days, 'inbox', 2);
	const deepWork = (days = DEEP_DAYS) => firstOn(days, 'deep work', 8);

	const rank = (drain: DrainObservationRecord[]) =>
		rankDrainByTask(drain, RANGE_START, TODAY, DEFAULT_ENERGY_PARAMS);

	it('names the fastest and the slowest title to drain the reservoir', () => {
		const ranking = rank([...inbox(), ...deepWork()]);

		expect(ranking.cognitive?.most.taskTitle).toBe('deep work');
		expect(ranking.cognitive?.least.taskTitle).toBe('inbox');
		expect(ranking.cognitive!.most.alpha).toBeGreaterThan(ranking.cognitive!.least.alpha);
	});

	it('leaves a reservoir the rows never load unranked', () => {
		// Every fixture row is `physicalDemand: 0`, which §8.7 drops as uninformative.
		expect(rank([...inbox(), ...deepWork()]).physical).toBeNull();

		// Control: the same day-first shape, loading the physical reservoir instead,
		// does rank — so the null above is the demand and not the fold.
		const loaded = [...inbox(), ...deepWork()].map((r) => ({
			...r,
			cognitiveDemand: 0,
			physicalDemand: 0.8,
			bodyDrain: r.mindDrain,
			mindDrain: 0,
		}));

		expect(rank(loaded).physical).not.toBeNull();
		expect(rank(loaded).cognitive).toBeNull();
	});

	it('ignores a title that is never the day’s first session', () => {
		// Logged last on all six days, and the most draining of the three — so a
		// fold that kept later sessions would rank it top rather than drop it.
		const wrapUp = [...INBOX_DAYS, ...DEEP_DAYS].map((date) => row(date, 'wrap up', 10, 200));

		expect(rank([...inbox(), ...deepWork(), ...wrapUp]).cognitive?.most.taskTitle).toBe(
			'deep work',
		);
	});

	it('ignores a title with too few eligible rows to fit', () => {
		// Two days, and the highest rated drain of the three: a fold without
		// §8.14's minimum would make this the top end.
		const quickCall = firstOn(['2026-07-13', '2026-07-14'], 'quick call', 10);

		expect(rank([...inbox(), ...deepWork(), ...quickCall]).cognitive?.most.taskTitle).toBe(
			'deep work',
		);
	});

	it('reads only the rows inside the range', () => {
		const early = ['2026-06-01', '2026-06-02', '2026-06-03'];

		expect(rank([...inbox(early), ...deepWork()]).cognitive).toBeNull();
		// Control: the same two titles inside the range do rank, so the null above
		// is the range and not the fixture.
		expect(rank([...inbox(), ...deepWork()]).cognitive).not.toBeNull();
	});

	it('withholds a ranking whose ends are not separated by their own uncertainty', () => {
		const close = [...firstOn(INBOX_DAYS, 'inbox', 5), ...firstOn(DEEP_DAYS, 'deep work', 6)];

		expect(rank(close).cognitive).toBeNull();
		// Control, as above: separated ends off the same shape of fixture do rank.
		expect(rank([...inbox(), ...deepWork()]).cognitive).not.toBeNull();
	});

	it('anchors every title to the α it is handed, not to the model default', () => {
		const rows = [...inbox(), ...deepWork()];

		const at = (alphaCog: number) =>
			rankDrainByTask(rows, RANGE_START, TODAY, {
				...DEFAULT_ENERGY_PARAMS,
				alphaCog,
			});

		// Same rows, two global rates: the ridge pulls each title's α̂ toward
		// whichever it was anchored to (MATH.md §8.14).
		expect(at(1.5).cognitive!.most.alpha).toBeGreaterThan(at(0.2).cognitive!.most.alpha);
	});

	// Pin on §8.7's ridge, which is what makes the anchor above protective: it is
	// evidence and not noise that moves a title away from the global rate, so the
	// minimum-row gate is a floor under an ordering that already shrinks.
	it('shrinks a thin title toward the anchor harder than a well-logged one', () => {
		const anchor = DEFAULT_ENERGY_PARAMS.alphaCog;

		const alphaOf = (count: number) =>
			fitDrainRate(
				toCognitiveDrainObservations(
					Array.from(
						{
							length: count,
						},
						(_, i) => row(`2026-07-0${i + 1}`, 'inbox', 9, 100),
					),
				),
				anchor,
				DEFAULT_ENERGY_PARAMS,
			).alpha;

		expect(Math.abs(alphaOf(1) - anchor)).toBeLessThan(Math.abs(alphaOf(5) - anchor));
	});

	it('counts the rows the causal window held back instead of fitting them', () => {
		// Today's and two dated past it, on their own days and rated highest of all
		// three titles: a window that stopped holding them would rank this top.
		const held = firstOn([TODAY, '2026-07-25', '2026-07-26'], 'triage', 10);
		const ranking = rank([...inbox(), ...deepWork(), ...held]);

		expect(ranking.deferredCount).toBe(3);
		expect(ranking.cognitive?.most.taskTitle).toBe('deep work');
	});
});
