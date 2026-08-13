/**
 * The measurements behind three unbacked stretches of MATH.md §11.6, §11.9 and
 * §12 — every one a number the document states and nothing in `src/` or
 * `scripts/` reproduces.
 *
 * §11.6, "Monotone in demand and duration, NOT in the declared budget (same
 *   probe)". `scripts/burnout-risk.probe.ts` measures the budget walk and the
 *   duration ladder; it never varies DEMAND, and the suite pins demand at one
 *   pair (mild 3 vs hard 9). The demand arm is measured here over the full 0–10
 *   scale at four durations.
 *
 * §11.6, the worst-drop decomposition — "their three switch gaps are 1.25h of
 *   REST against one gap's 0.42h, so the simulated WORK falls from 2.83h to
 *   2.25h", "both reservoirs end higher", "NOT min() swapping reservoirs — the
 *   cognitive one binds on both sides". Those numbers live in a test COMMENT
 *   beside `expect(riskAt(3.25)).toBe(41)`; the test asserts the two readings
 *   and nothing about the mechanism claimed to produce them.
 *
 * §11.9, the carry-over levels — "at the fit floor, a fully-drained 8 h day
 *   starts the next morning near 92 %, and a 16 h day (8 h gap) near 71 %", and
 *   "ρ_rest = 0.7·1.5 = 1.05/h leaves e^(−16.8) ≈ 5·10⁻⁸ of an 8 h day's
 *   deficit by morning". `energy-calibration.test.ts` pins the closed form, the
 *   no-logs identity, > 0.999 healing at defaults, monotonicity and the > 24 h
 *   guard — no percentage in §11.9 is asserted anywhere.
 *
 * §11.9, the inherited approximations — "breaks inside the worked day are
 *   omitted, and block order is taken as logged — both wash out exponentially
 *   through the trailing rest, which dominates the cycle". Stated
 *   unconditionally for a feature whose own section says it is only visible when
 *   the ☕ fit is slow, which is where the trailing rest stops dominating. Both
 *   halves are ONE mechanism: `reservoirAt` is affine in the incoming level, so
 *   a cycle is a composition of affine maps, permuting blocks leaves the total
 *   contraction e^(−Σρᵢhᵢ) alone and moves only the offset, and walking a break
 *   out of the trailing gap permutes the same multiset. The morning spread is
 *   therefore bounded by the trailing rest's own factor e^(−ρ_rest·gap), which
 *   is printed beside every measured spread, and the displayed risk attenuates a
 *   second time through today's own simulation.
 *
 * §12, "probe 2026-07-11: two identical tasks on 1h score 1.955 split vs 1.58
 *   concentrated under Σ P̄". The framing of the whole audit rests on the
 *   classic objective preferring to spread; neither number appears in the repo.
 *
 * A probe, not a test: these are properties of the model over an input space
 * (the demand grid) and readings that move legitimately whenever α, r, b or the
 * allocator move. What it FINDS is pinned by one cheap fixture in the suite,
 * never by the sweep.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateBurnoutRisk,
	calculateInterleavedOrder,
	calculateSuggestedTasks,
	type SuggestedTask,
} from '$lib/business/model/metric/calculation';
import {
	averageProductivity,
	calculateTaskParams,
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_USER_CONSTANTS,
} from '$lib/business/model/zenith';
import {
	DEFAULT_ENERGY_PARAMS,
	RECOVERY_FIT_MIN,
	simulateReservoirs,
	type EnergyParams,
	type ScheduleBlock,
} from '$lib/business/model/zenith-energy';
import {
	RESERVOIR_CYCLE_HOURS,
	seedMorningReservoirs,
} from '$lib/business/model/energy-calibration';
import type { DrainObservationRecord, Task } from '$lib/data/type';

const task = (id: number, mental: number, physical: number, enjoyment: number): Task => ({
	id,
	title: `t${id}`,
	mentalDifficulty: mental,
	physicalDifficulty: physical,
	enjoyment,
	createdAt: '2026-08-06',
	completed: false,
});

const plan = (tasks: Task[], availableHours: number, switchCost: number): SuggestedTask[] =>
	calculateSuggestedTasks(
		tasks,
		availableHours,
		switchCost,
		DEFAULT_CAPACITY_POOLS,
		DEFAULT_USER_CONSTANTS,
	);

/** The §11.6 budget-walk worst case: 4 tasks at s = 25m, 3.25h → 3.5h. */
const WORST_DROP_TASKS = [task(1, 9, 10, 6), task(2, 8, 5, 8), task(3, 3, 1, 0), task(4, 4, 8, 2)];
const WORST_DROP_SWITCH_COST = 25 / 60;

describe('MATH.md §11.6 — the demand arm and the worst-drop mechanism', () => {
	/**
	 * Demand, the arm `burnout-risk.probe.ts` never walks. One pure cognitive
	 * task whose budget equals its duration, so the plan funds the whole day and
	 * only the demand moves.
	 */
	it('is monotone in demand at every duration', () => {
		for (const hours of [1, 2, 4, 8]) {
			const readings = Array.from(
				{
					length: 11,
				},
				(_, mental) => {
					const tasks = [task(1, mental, 0, 5)];

					return calculateBurnoutRisk(plan(tasks, hours, 0.25), hours, 0.25);
				},
			);

			let falls = 0;

			for (let i = 1; i < readings.length; i++) if (readings[i] < readings[i - 1]) falls++;

			console.log(
				`[§11.6 demand] ${hours}h, cognitive demand 0→10: ${readings.join('/')}% — ` +
					`${falls} of 10 steps FELL`,
			);
		}
	});

	/**
	 * The mechanism §11.6 and `calculation.test.ts` both narrate but neither
	 * measures. The blocks are rebuilt exactly as `calculateBurnoutRisk` builds
	 * them (interleaved order, switch costs as rest, overhang stretching the
	 * funded blocks pro-rata); the risk it would report is printed beside the
	 * reading the metric actually returns, so the reconstruction is checked
	 * rather than assumed.
	 */
	it('decomposes the 3.25h → 3.5h drop into work, rest and the binding reservoir', () => {
		for (const budget of [3.25, 3.5]) {
			const funded = calculateInterleavedOrder(
				plan(WORST_DROP_TASKS, budget, WORST_DROP_SWITCH_COST),
			);

			const gaps = funded.length > 1 ? funded.length - 1 : 0;
			const rest = gaps * WORST_DROP_SWITCH_COST;
			const allocated = funded.reduce((sum, t) => sum + t.suggestedHours, 0);
			const stretch = 1 + Math.max(0, budget - rest - allocated) / allocated;
			const blocks: ScheduleBlock[] = [];

			funded.forEach((t, i) => {
				if (i > 0)
					blocks.push({
						taskId: null,
						hours: WORST_DROP_SWITCH_COST,
					});

				blocks.push({
					taskId: t.id,
					hours: t.suggestedHours * stretch,
				});
			});

			const { endCog, endPhys } = simulateReservoirs(
				blocks,
				funded.map((t) => ({
					id: t.id,
					cognitiveDemand: t.mentalDifficulty / 10,
					physicalDemand: t.physicalDifficulty / 10,
				})),
				DEFAULT_ENERGY_PARAMS,
			);

			console.log(
				`[§11.6 drop] ${budget}h: ${funded.length} funded, allocated ${allocated.toFixed(2)}h, ` +
					`stretch ${stretch.toFixed(3)}, WORK ${(allocated * stretch).toFixed(2)}h, ` +
					`REST ${rest.toFixed(2)}h in ${gaps} gap(s); endCog ${endCog.toFixed(4)} / ` +
					`endPhys ${endPhys.toFixed(4)} → binds ${endCog <= endPhys ? 'COG' : 'PHYS'}, ` +
					`risk ${Math.round(100 * (1 - Math.min(endCog, endPhys)))}% ` +
					`(metric reads ${calculateBurnoutRisk(plan(WORST_DROP_TASKS, budget, WORST_DROP_SWITCH_COST), budget, WORST_DROP_SWITCH_COST)}%)`,
			);
		}
	});
});

describe('MATH.md §11.9 — overnight carry-over levels', () => {
	const rho = (rate: number) => rate * DEFAULT_ENERGY_PARAMS.restRecoveryMultiplier;

	const drainLog = (hours: number): DrainObservationRecord => ({
		date: '2026-08-05',
		taskId: 1,
		taskTitle: 't1',
		hours,
		cognitiveDemand: 1,
		physicalDemand: 1,
		mindDrain: 10,
		bodyDrain: 10,
		createdAt: 1,
	});

	it('reports the morning level at the recovery fit floor and at defaults', () => {
		const floor = {
			...DEFAULT_ENERGY_PARAMS,
			recoveryRate: RECOVERY_FIT_MIN,
		};

		for (const hours of [8, 16]) {
			const seeded = seedMorningReservoirs(floor, [drainLog(hours)]);

			console.log(
				`[§11.9 floor] r = ${RECOVERY_FIT_MIN} (ρ_rest ${rho(RECOVERY_FIT_MIN).toFixed(2)}/h), ` +
					`full-demand ${hours}h day, ${24 - hours}h gap: morning ` +
					`${(seeded.initialCog * 100).toFixed(1)}% cog / ` +
					`${(seeded.initialPhys * 100).toFixed(1)}% phys`,
			);
		}

		const healed = seedMorningReservoirs(DEFAULT_ENERGY_PARAMS, [drainLog(8)]);

		console.log(
			`[§11.9 defaults] ρ_rest ${rho(DEFAULT_ENERGY_PARAMS.recoveryRate).toFixed(2)}/h, ` +
				`full-demand 8h day: morning deficit ${(1 - healed.initialCog).toExponential(2)} cog ` +
				`(e^(−16.8) = ${Math.exp(-16.8).toExponential(2)}), ` +
				`two nights at the fit floor ≤ e^(−4.8) = ` +
				`${(Math.exp(-2 * rho(RECOVERY_FIT_MIN) * 16) * 100).toFixed(2)}%`,
		);
	});

	// ---- §11.9's "inherited approximations wash out" claim (header) ----

	const withRate = (rate: number): EnergyParams => ({
		...DEFAULT_ENERGY_PARAMS,
		recoveryRate: rate,
	});

	const RATES = [DEFAULT_ENERGY_PARAMS.recoveryRate, 0.3, RECOVERY_FIT_MIN];
	const TOTALS = [8, 12, 16, 19];
	const BREAK_HOURS = 2;

	/** Every order, in a fixed order — the sweep is exhaustive, so nothing to seed. */
	const permutations = <T>(xs: T[]): T[][] =>
		xs.length <= 1
			? [xs]
			: xs.flatMap((x, i) =>
					permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]),
				);

	/**
	 * Asymmetric demand mixes, each row [share of the worked hours, cognitive
	 * demand, physical demand]. An order effect IS the offset difference between
	 * unequal affine maps, so rows differing in both hours and demand are what
	 * makes it bite — a day of identical rows has no order effect at all.
	 */
	const MIXES: { name: string; rows: [number, number, number][] }[] = [
		{
			name: 'high-cog',
			rows: [
				[0.5, 1, 0.1],
				[0.3, 0.6, 0.2],
				[0.2, 0.2, 0.05],
			],
		},
		{
			name: 'mixed',
			rows: [
				[0.5, 1, 0.2],
				[0.3, 0.2, 1],
				[0.2, 0.5, 0.5],
			],
		},
		{
			name: 'low-cog/high-phys',
			rows: [
				[0.5, 0.1, 1],
				[0.3, 0.2, 0.6],
				[0.2, 0.05, 0.2],
			],
		},
		{
			name: 'mixed-4row',
			rows: [
				[0.4, 1, 0.1],
				[0.3, 0.1, 1],
				[0.2, 0.7, 0.7],
				[0.1, 0.2, 0.2],
			],
		},
	];

	const rowsFor = (mix: (typeof MIXES)[number], total: number): DrainObservationRecord[] =>
		mix.rows.map(([share, cog, phys], i) => ({
			...drainLog(share * total),
			taskId: i,
			cognitiveDemand: cog,
			physicalDemand: phys,
		}));

	const spread = (xs: number[]) => 100 * (Math.max(...xs) - Math.min(...xs));

	const describeRows = (rows: DrainObservationRecord[]) =>
		rows.map((r) => `${r.hours.toFixed(2)}h@${r.cognitiveDemand}/${r.physicalDemand}`).join(' → ');

	/** Today, from the seeded morning. A short budget attenuates least, so 1h leads. */
	const TODAY_BUDGETS = [1, 2, 4, 8];
	const TODAY_TASKS = [task(1, 9, 4, 5), task(2, 6, 8, 3), task(3, 4, 2, 7)];
	const TODAY_SWITCH_COST = 0.25;

	// The plan does not read energy params, so it is solved once per budget and
	// only `calculateBurnoutRisk` sees the seeded morning.
	const TODAY_PLANS = TODAY_BUDGETS.map((hours) => ({
		hours,
		funded: plan(TODAY_TASKS, hours, TODAY_SWITCH_COST),
	}));

	/** Enough of the worst pair for a reader to re-run it by hand. */
	const worstOrderDetail = (
		rate: number,
		total: number,
		mix: string,
		orders: DrainObservationRecord[][],
		budget: { hours: number; risks: number[] },
	) => {
		const hi = budget.risks.indexOf(Math.max(...budget.risks));
		const lo = budget.risks.indexOf(Math.min(...budget.risks));

		return (
			`r = ${rate}, previous day ${total}h worked / ${RESERVOIR_CYCLE_HOURS - total}h gap, ` +
			`mix ${mix}; today ${budget.hours}h, switch ${TODAY_SWITCH_COST}h, tasks ` +
			`(mental/physical/enjoyment) ` +
			`${TODAY_TASKS.map((t) => `${t.mentalDifficulty}/${t.physicalDifficulty}/${t.enjoyment}`).join(', ')}: ` +
			`${budget.risks[lo]}% for [${describeRows(orders[lo])}] vs ` +
			`${budget.risks[hi]}% for [${describeRows(orders[hi])}]`
		);
	};

	const seedSpread = (seeded: EnergyParams[]) => ({
		cog: spread(seeded.map((p) => p.initialCog)),
		phys: spread(seeded.map((p) => p.initialPhys)),
	});

	/** The displayed reading: integer risk points, per today-budget. */
	const riskSpread = (seeded: EnergyParams[]) =>
		TODAY_PLANS.map(({ hours, funded }) => {
			const risks = seeded.map((p) => calculateBurnoutRisk(funded, hours, TODAY_SWITCH_COST, p));

			return {
				hours,
				risks,
				points: Math.max(...risks) - Math.min(...risks),
			};
		});

	const worstBudget = (seeded: EnergyParams[]) =>
		riskSpread(seeded).reduce((worst, cell) => (cell.points > worst.points ? cell : worst));

	const cellLine = (
		rate: number,
		total: number,
		level: { cog: number; phys: number; mix: string },
		bound: number,
		risk: { points: number; hours: number },
	) =>
		`r = ${rate} (ρ_rest ${rho(rate).toFixed(2)}/h), ${total}h worked / ${RESERVOIR_CYCLE_HOURS - total}h gap: ` +
		`morning moves ${level.cog.toFixed(2)} pt cog / ${level.phys.toFixed(2)} pt phys ` +
		`(worst mix ${level.mix}) vs bound ${bound.toFixed(2)} pt; displayed ${risk.points} risk pt ` +
		`(worst over mixes, today ${risk.hours}h)`;

	it('bounds the as-logged order spread by the trailing rest, in morning and risk points', () => {
		let overBound = 0;
		let breaches = 0;
		let claim = '';
		let worstRisk = {
			points: 0,
			detail: 'none',
		};

		/** One (rate, total) cell over every mix and every one of its orders. */
		const cell = (rate: number, total: number) => {
			const params = withRate(rate);
			const gap = RESERVOIR_CYCLE_HOURS - total;
			const bound = 100 * Math.exp(-rho(rate) * gap);
			let level = {
				cog: 0,
				phys: 0,
				mix: '',
				orders: 0,
			};
			let risk = {
				points: 0,
				hours: TODAY_BUDGETS[0],
			};
			let overThreeRows = 0;

			for (const mix of MIXES) {
				const orders = permutations(rowsFor(mix, total));
				const seeded = orders.map((o) => seedMorningReservoirs(params, o));
				const { cog, phys } = seedSpread(seeded);
				const moved = Math.max(cog, phys);
				const budget = worstBudget(seeded);

				if (moved > Math.max(level.cog, level.phys))
					level = {
						cog,
						phys,
						mix: mix.name,
						orders: orders.length,
					};

				if (mix.rows.length === 3) overThreeRows = Math.max(overThreeRows, moved);

				overBound = Math.max(overBound, moved / bound);

				// Floating-point slack only — the bound is exact, not statistical.
				if (moved > bound + 1e-9) breaches++;

				if (budget.points > risk.points)
					risk = {
						points: budget.points,
						hours: budget.hours,
					};

				if (budget.points > worstRisk.points)
					worstRisk = {
						points: budget.points,
						detail: worstOrderDetail(rate, total, mix.name, orders, budget),
					};
			}

			return {
				bound,
				level,
				risk,
				overThreeRows,
			};
		};

		for (const rate of RATES)
			for (const total of TOTALS) {
				const { bound, level, risk, overThreeRows } = cell(rate, total);

				console.log(
					`[§11.9 order] ${cellLine(rate, total, level, bound, risk)}, over ${level.orders} orders`,
				);

				if (rate === RECOVERY_FIT_MIN && total === 16)
					claim =
						`${overThreeRows.toFixed(2)} pt over three rows, ` +
						`${Math.max(level.cog, level.phys).toFixed(2)} pt over all four mixes ` +
						`(bound ${bound.toFixed(2)} pt)`;
			}

		console.log(
			`[§11.9 order] measured spread against the analytic bound: ${breaches} breaches, ` +
				`worst ${(100 * overBound).toFixed(1)}% of the bound`,
		);

		console.log(
			`[§11.9 order] worst DISPLAYED spread ${worstRisk.points} risk pt — ${worstRisk.detail}`,
		);

		console.log(
			`[§11.9 claim] the uncommitted 2026-08-06 scratch probe claimed 8.4 pt from reordering ` +
				`three blocks over a 16h day at r = ${RECOVERY_FIT_MIN}; committed measurement ${claim}`,
		);
	});

	it('walks a 2h break out of the trailing gap — the same multiset, so the same mechanism', () => {
		/**
		 * `seedMorningReservoirs` cannot express an intraday break, so the cycle is
		 * built for `simulateReservoirs` exactly as it builds it: work from
		 * initialCog/initialPhys = 1, then rest out a fixed 24 h. `at === null` is
		 * the shipped reading (one trailing rest block); otherwise the break is
		 * taken OUT of that gap and inserted before row `at`, leaving the block
		 * multiset and the cycle total untouched.
		 */
		const cycle = (
			rows: DrainObservationRecord[],
			gap: number,
			at: number | null,
		): ScheduleBlock[] => {
			const work: ScheduleBlock[] = rows.map((r, i) => ({
				taskId: i,
				hours: r.hours,
			}));

			const tail = {
				taskId: null,
				hours: at === null ? gap : gap - BREAK_HOURS,
			};

			if (at === null) return [...work, tail];

			return [
				...work.slice(0, at),
				{
					taskId: null,
					hours: BREAK_HOURS,
				},
				...work.slice(at),
				tail,
			];
		};

		let claim = '';
		let overBound = 0;
		let breaches = 0;
		let worstRisk = {
			points: 0,
			detail: 'none',
		};

		const cell = (rate: number, total: number) => {
			const params = withRate(rate);
			const gap = RESERVOIR_CYCLE_HOURS - total;
			// Interior placements end on a trailing gap short by the break — a
			// different derivation from the order arm's, so it is checked too.
			const bound = 100 * Math.exp(-rho(rate) * (gap - BREAK_HOURS));
			let level = {
				cog: 0,
				phys: 0,
				mix: '',
			};
			let risk = {
				points: 0,
				hours: TODAY_BUDGETS[0],
			};
			let overThreeRows = 0;
			let tailSplit = 0;

			for (const mix of MIXES) {
				const rows = rowsFor(mix, total);

				const morning = (at: number | null) =>
					simulateReservoirs(
						cycle(rows, gap, at),
						rows.map((r, i) => ({
							id: i,
							cognitiveDemand: r.cognitiveDemand,
							physicalDemand: r.physicalDemand,
						})),
						{
							...params,
							initialCog: 1,
							initialPhys: 1,
						},
					);

				// Interior slots only. `at = rows.length` puts the break back at the end,
				// which merely splits the trailing rest in two — an identity, printed
				// below, and the reason the break is an ORDER question and not a second
				// approximation.
				const levels = [null, ...rows.map((_, i) => i).slice(1)].map(morning);

				const seeded = levels.map((l) => ({
					...params,
					initialCog: l.endCog,
					initialPhys: l.endPhys,
				}));

				const { cog, phys } = seedSpread(seeded);
				const moved = Math.max(cog, phys);
				const budget = worstBudget(seeded);

				if (moved > Math.max(level.cog, level.phys))
					level = {
						cog,
						phys,
						mix: mix.name,
					};

				if (mix.rows.length === 3) overThreeRows = Math.max(overThreeRows, moved);

				overBound = Math.max(overBound, moved / bound);

				if (moved > bound + 1e-9) breaches++;

				tailSplit = Math.max(tailSplit, Math.abs(levels[0].endCog - morning(rows.length).endCog));

				if (budget.points > risk.points)
					risk = {
						points: budget.points,
						hours: budget.hours,
					};

				if (budget.points > worstRisk.points)
					worstRisk = {
						points: budget.points,
						detail:
							`r = ${rate}, ${total}h worked / ${gap}h gap, mix ${mix.name}, a ${BREAK_HOURS}h break ` +
							`at every interior slot of [${describeRows(rows)}]; today ${budget.hours}h`,
					};
			}

			return {
				bound,
				level,
				risk,
				overThreeRows,
				tailSplit,
			};
		};

		for (const rate of RATES)
			for (const total of TOTALS) {
				const { bound, level, risk, overThreeRows, tailSplit } = cell(rate, total);

				console.log(
					`[§11.9 break] ${cellLine(rate, total, level, bound, risk)}; putting the break back at ` +
						`the end moves it ${tailSplit.toExponential(1)} on the worst of the four mixes`,
				);

				if (rate === RECOVERY_FIT_MIN && total === 16)
					claim =
						`${overThreeRows.toFixed(2)} pt over three rows, ` +
						`${Math.max(level.cog, level.phys).toFixed(2)} pt over all four mixes ` +
						`(bound ${bound.toFixed(2)} pt)`;
			}

		console.log(
			`[§11.9 break] measured spread against the analytic bound: ${breaches} breaches, ` +
				`worst ${(100 * overBound).toFixed(1)}% of the bound`,
		);

		console.log(
			`[§11.9 break] worst DISPLAYED spread ${worstRisk.points} risk pt — ${worstRisk.detail}`,
		);

		console.log(
			`[§11.9 claim] the same scratch probe claimed 2.4 pt from moving a 2h break to mid-day at ` +
				`r = ${RECOVERY_FIT_MIN} over a 16h day; committed measurement ${claim}`,
		);
	});
});

describe('MATH.md §12 — the classic objective spreads', () => {
	/**
	 * §12's premise, cited to a 2026-07-11 probe that is gone. The task spec is not
	 * stated with it, so the whole 10×10 difficulty × enjoyment grid is swept: the
	 * PROPERTY (Σ P̄ prefers the split) is what §12 rests on, and the two quoted
	 * numbers have to come from one cell of this grid or from none of them.
	 */
	it('scores two identical tasks split against concentrated on a 1h budget', () => {
		let spreads = 0;
		let cells = 0;
		let closest = '';
		let gap = Infinity;

		for (let difficulty = 1; difficulty <= 10; difficulty++) {
			for (let enjoyment = 1; enjoyment <= 10; enjoyment++) {
				const { a, p0, k } = calculateTaskParams(
					{
						title: 't',
						difficulty,
						enjoyment,
					},
					DEFAULT_USER_CONSTANTS,
				);

				const split = 2 * averageProductivity(0.5, a, p0, k);
				const concentrated = averageProductivity(1, a, p0, k);

				cells++;

				if (split > concentrated) spreads++;

				// Closest cell to the quoted split score of 1.955.
				if (Math.abs(split - 1.955) < gap) {
					gap = Math.abs(split - 1.955);
					closest = `difficulty/enjoyment ${difficulty}/${enjoyment}: split ${split.toFixed(3)} vs concentrated ${concentrated.toFixed(3)}`;
				}
			}
		}

		console.log(
			`[§12 spread] Σ P̄ prefers the split on ${spreads} of ${cells} difficulty × enjoyment cells`,
		);

		console.log(`[§12 spread] closest cell to the quoted 1.955 — ${closest}`);
	});
});
