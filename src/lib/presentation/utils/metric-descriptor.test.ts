import { describe, expect, it } from 'vitest';
import type { DailyMetrics } from '$lib/business/model/metric/daily-metrics';
import type { RemainingDay } from '$lib/business/model/metric/remaining-day';
import * as m from '$lib/paraglide/messages.js';
import { AXIS_BAND, type Band } from '$lib/presentation/utils/band';
import { buildMetrics } from '$lib/presentation/utils/metric-descriptor';

const pools = {
	cognitiveHours: 8,
	physicalHours: 4,
};

/** Only the length is read here; a full SuggestedTask would be fifteen fields of noise. */
const activeTasks = (count: number) =>
	Array.from({
		length: count,
	}) as unknown as DailyMetrics['activeTasks'];

/** An empty day, from which each test moves only what it is about. */
function dailyMetrics(overrides: Partial<DailyMetrics> = {}): DailyMetrics {
	return {
		suggestedTasks: [],
		activeTasks: [],
		runOrder: new Map(),
		planSlackHours: 0,
		remainingSuggestedHours: 0,
		totalTasks: 0,
		completedTasks: 0,
		budgetHours: 0,
		zenithGain: {
			optimized: 0,
			naive: 0,
			gainPercent: 0,
		},
		completionRate: 0,
		yieldIndex: 0,
		flowCoverage: {
			reached: 0,
			total: 0,
		},
		humanCapacity: {
			percent: 0,
			limitType: 'none',
		},
		bottleneckTask: null,
		longestWarmUp: null,
		timeScarcity: 0,
		burnoutRisk: 0,
		cognitiveLoad: 0,
		physicalLoad: 0,
		energyBalance: 50,
		frictionIndex: 0,
		dailyQuadrant: 'routine',
		scheduleIntegrity: 0,
		momentum: 0,
		deepWorkRatio: 0,
		quickWins: 0,
		grindDensity: {
			grinds: 0,
			funded: 0,
			percent: 0,
		},
		rewardDensity: null,
		recoveryRatio: null,
		averagePhysicalDifficulty: 0,
		averageMentalDifficulty: 0,
		averageEnjoyment: 0,
		...overrides,
	};
}

/** A full day: tasks, a budget, and one task already done. */
const plannedDay: Partial<DailyMetrics> = {
	totalTasks: 3,
	completedTasks: 1,
	budgetHours: 8,
	activeTasks: activeTasks(2),
};

/** Only the burn-down is read here; the rest of the re-plan renders on the task rows. */
const remainingDay = (capacity: RemainingDay['capacity']) =>
	({
		capacity,
	}) as RemainingDay;

function reading(metrics: DailyMetrics, label: string, remainingDay: RemainingDay | null = null) {
	const row = buildMetrics(metrics, pools, remainingDay).find(
		(candidate) => candidate.label === label,
	);

	if (!row) throw new Error(`no metric row labelled ${label}`);

	return row;
}

describe('buildMetrics', () => {
	// The model answers for a day with nothing in it — 0% completion, a degenerate
	// 100% time scarcity — and every one of those answers is a claim about a plan
	// that does not exist. A screen of red zeroes on first open is what makes every
	// later warning easy to ignore.
	it('shows no numbers at all, and no judgement, on an empty day', () => {
		const rows = buildMetrics(dailyMetrics(), pools);

		// The shipped shape, pinned so a 25th reading fails here rather than silently
		// rotting the docs that count these rows.
		expect(rows).toHaveLength(24);
		expect(rows.filter((row) => row.headline)).toHaveLength(4);

		for (const row of rows) {
			expect(row.value, row.label).not.toMatch(/\d/);
			expect(row.band, row.label).toBe('neutral');
		}
	});

	// Every budget-gated reading short-circuits to a degenerate extreme at budget
	// 0 — true, and an alarm about nothing.
	it.each([
		m.metric_time_scarcity(),
		m.metric_schedule_integrity(),
		m.metric_burnout_risk(),
		m.metric_human_capacity(),
		m.metric_friction_index(),
		m.metric_flow_coverage(),
	])('reads %s as N/A with tasks but no budget', (label) => {
		const row = reading(
			dailyMetrics({
				...plannedDay,
				budgetHours: 0,
				timeScarcity: 100,
				scheduleIntegrity: 0,
				burnoutRisk: 82,
				frictionIndex: 60,
				humanCapacity: {
					percent: 130,
					limitType: 'cognitive',
				},
			}),
			label,
		);

		expect(row.value).toBe(m.na_value());
		expect(row.band).toBe('neutral');
	});

	// Tasks and a budget are not enough for the two allocation-shape readings: a
	// budget too small to fund ANY task short-circuits both to the same 0
	// sentinel, which reads as a red 0% schedule and a green 0% friction — an
	// alarm and a promise about a plan that books nothing.
	it.each([m.metric_schedule_integrity(), m.metric_friction_index()])(
		'reads %s as N/A when the budget funds no task',
		(label) => {
			const row = reading(
				dailyMetrics({
					...plannedDay,
					budgetHours: 0.25,
					scheduleIntegrity: 0,
					frictionIndex: 0,
					grindDensity: {
						grinds: 0,
						funded: 0,
						percent: 0,
					},
				}),
				label,
			);

			expect(row.value).toBe(m.na_value());
			expect(row.band).toBe('neutral');
		},
	);

	// The gates are not interchangeable, and a swapped one is invisible on a day
	// that satisfies all of them. A finished day is the case that separates them:
	// tasks and a budget, but nothing left active. Only the next-up rows may go
	// quiet — a plan-scoped reading has to survive its last task being checked
	// off, which is the entire reason those metrics are computed
	// over the full plan rather than the remaining one.
	it('keeps the plan-scoped readings once every task is done, silencing only next-up', () => {
		const finished = dailyMetrics({
			totalTasks: 2,
			completedTasks: 2,
			budgetHours: 8,
			activeTasks: activeTasks(0),
			completionRate: 100,
			flowCoverage: {
				reached: 2,
				total: 2,
			},
			quickWins: 0,
			grindDensity: {
				grinds: 1,
				funded: 2,
				percent: 50,
			},
			yieldIndex: 90,
		});

		expect(reading(finished, m.metric_quick_wins()).value).toBe(m.na_value());

		for (const [label, value] of [
			[m.metric_flow_coverage(), '2/2'],
			[m.metric_grind_density(), '50% (1/2)'],
			// And the two that are about the work already done.
			[m.metric_completion_rate(), '100%'],
			[m.metric_yield_index(), '90%'],
		]) {
			expect(reading(finished, label).value, label).toBe(value);
		}
	});

	// The advice card decides which findings to surface from
	// `isOutOfBand`, so Flow Coverage's thresholds move into `AXIS_BAND` when it
	// becomes an axis — and this row must read them from there. Two spellings of
	// one threshold is the R3 failure `band.ts` exists to prevent
	// (presentation/AGENTS.md).
	it.each([
		[3, 5],
		[2, 5],
		[5, 5],
		[1, 4],
	])('bands a flow coverage of %i/%i from the same call the advice card uses', (reached, total) => {
		const day = dailyMetrics({
			...plannedDay,
			flowCoverage: {
				reached,
				total,
			},
		});

		expect(reading(day, m.metric_flow_coverage()).band).toBe(
			AXIS_BAND.flowCoverage((reached / total) * 100),
		);
	});

	// A pin (docs/features/the-headline-the-advisor-never-searched.md): the card
	// prints this axis as a percentage and the tile must not follow it. Green on
	// first run is this test's pass condition.
	it('still prints the tile as a fraction, not the share the card shows', () => {
		const day = dailyMetrics({
			...plannedDay,
			flowCoverage: {
				reached: 3,
				total: 5,
			},
		});

		expect(reading(day, m.metric_flow_coverage()).value).toBe('3/5');
	});

	// Sustainable Work divides by the hours the plan books, so a
	// plan that funded nothing has no denominator. 0% would call a day with no
	// work a day of pure grind.
	it.each([
		[null, m.na_value()],
		[66.67, '67%'],
	])('reads a sustainable work of %s as %s', (rewardDensity, value) => {
		const day = dailyMetrics({
			...plannedDay,
			rewardDensity,
		});

		expect(reading(day, m.metric_sustainable_work()).value).toBe(value);
	});

	// Yield Index divides by completed work, so it needs a completion, not a task.
	it('withholds the yield index until something has been completed', () => {
		const untouched = dailyMetrics({
			...plannedDay,
			completedTasks: 0,
			yieldIndex: 0,
		});

		expect(reading(untouched, m.metric_yield_index()).value).toBe(m.na_value());
	});

	// A pool of 0 hours carrying demand saturates to Infinity.
	// "Infinity%" is not a reading, and banding it critical judges a number that
	// does not exist.
	it('reads an infinite capacity as N/A rather than printing it', () => {
		const row = reading(
			dailyMetrics({
				...plannedDay,
				humanCapacity: {
					percent: Infinity,
					limitType: 'physical',
				},
			}),
			m.metric_human_capacity(),
		);

		expect(row.value).toBe(m.na_value());
		expect(row.band).toBe('neutral');
	});

	// The reading is honest at 0%; the band is not. An untouched day is the
	// starting state, not a critical one.
	it('reports an untouched day as 0% complete without calling it critical', () => {
		const row = reading(
			dailyMetrics({
				...plannedDay,
				completedTasks: 0,
				completionRate: 0,
			}),
			m.metric_completion_rate(),
		);

		expect(row.value).toBe('0%');
		expect(row.band).toBe('neutral');
	});

	it('bands completion once the day is under way', () => {
		const row = reading(
			dailyMetrics({
				...plannedDay,
				completedTasks: 2,
				completionRate: 80,
			}),
			m.metric_completion_rate(),
		);

		expect(row.value).toBe('80%');
		expect(row.band).toBe('success');
	});

	// AGENTS.md R3: the row's colour and the advice card's filter must come from
	// the same call. A second copy of these thresholds is the failure that made
	// `AXIS_BAND` shared in the first place.
	it('bands every advice axis by the shared policy', () => {
		const readings = {
			burnoutRisk: 82,
			cognitiveLoad: 85,
			physicalLoad: 40,
			energyBalance: 72,
			frictionIndex: 60,
			grindDensity: 30,
			timeScarcity: 90,
			scheduleIntegrity: 35,
		};

		const label: Record<keyof typeof readings, string> = {
			burnoutRisk: m.metric_burnout_risk(),
			cognitiveLoad: m.metric_cognitive_load(),
			physicalLoad: m.metric_physical_load(),
			energyBalance: m.metric_energy_balance(),
			frictionIndex: m.metric_friction_index(),
			grindDensity: m.metric_grind_density(),
			timeScarcity: m.metric_time_scarcity(),
			scheduleIntegrity: m.metric_schedule_integrity(),
		};

		const metrics = dailyMetrics({
			...plannedDay,
			...readings,
			// Same reading, in the shape the model returns it.
			grindDensity: {
				grinds: 3,
				funded: 10,
				percent: readings.grindDensity,
			},
			humanCapacity: {
				percent: 130,
				limitType: 'cognitive',
			},
		});

		for (const [axis, value] of Object.entries(readings) as [keyof typeof readings, number][]) {
			expect(reading(metrics, label[axis]).band, axis).toBe(AXIS_BAND[axis](value));
		}

		expect(reading(metrics, m.metric_human_capacity()).band).toBe(AXIS_BAND.humanCapacity(130));
	});

	// The pools are the sentence the capacity reading is measured against, so the
	// description has to name the one that actually binds.
	it('describes capacity against the pool that binds', () => {
		const physical = reading(
			dailyMetrics({
				...plannedDay,
				humanCapacity: {
					percent: 90,
					limitType: 'physical',
				},
			}),
			m.metric_human_capacity(),
		);

		expect(physical.description).toContain(String(pools.physicalHours));
		expect(physical.description).not.toContain(String(pools.cognitiveHours));
	});

	// The bottleneck names ITS OWN axis, which is the one its (active) list
	// binds — not Human Capacity's, which describes the day as planned. Mid-day
	// the two can differ, and the row that would be wrong is this one.
	it('names the bottleneck against its own axis, not the capacity axis', () => {
		const row = reading(
			dailyMetrics({
				...plannedDay,
				humanCapacity: {
					percent: 90,
					limitType: 'physical',
				},
				bottleneckTask: {
					title: 'Design error boundary',
					limitType: 'cognitive',
				},
			}),
			m.metric_bottleneck(),
		);

		expect(row.value).toBe('Design error boundary');
		expect(row.description).toContain(m.metric_type_cognitive());
		expect(row.description).not.toContain(m.metric_type_physical());
	});

	// The row reports the warm-up ϕ itself, and bands it on Flow Coverage's own
	// criterion narrowed to this one task: the plan has to fund at least ϕ, or
	// the hours booked never reach flow. Equality funds it exactly, so it passes.
	it.each<[number, Band]>([
		[2, 'success'],
		[1.5, 'warning'],
	])('reads a 2h warm-up funded with %sh as %s', (suggestedHours, band) => {
		const row = reading(
			dailyMetrics({
				...plannedDay,
				longestWarmUp: {
					title: 'Design error boundary',
					flowStateTime: 2,
					suggestedHours,
				},
			}),
			m.metric_longest_warm_up(),
		);

		expect(row.value).toBe('2.0h');
		expect(row.band).toBe(band);
	});

	// A day funds its own recovery only if the easy tasks hold their own against
	// the hard ones. One easy task against thirty is not a recovery ratio, and
	// banding on "easy > 0" called that day optimal.
	it.each<[DailyMetrics['recoveryRatio'], string, Band]>([
		[null, m.na_value(), 'neutral'],
		[
			{
				easy: 3,
				hard: 0,
			},
			m.metric_no_strain(),
			'neutral',
		],
		[
			{
				easy: 0,
				hard: 45,
			},
			'0:45',
			'warning',
		],
		[
			{
				easy: 1,
				hard: 30,
			},
			'1:30',
			'warning',
		],
		[
			{
				easy: 2,
				hard: 2,
			},
			'2:2',
			'success',
		],
	])('reads a recovery ratio of %j as %s', (recoveryRatio, value, band) => {
		const row = reading(
			dailyMetrics({
				...plannedDay,
				recoveryRatio,
			}),
			m.metric_recovery_ratio(),
		);

		expect(row.value).toBe(value);
		expect(row.band).toBe(band);
	});

	// Next-up, and its input is a 🪫 log: before the first one nothing has
	// been spent to report, and a full pool is a claim about a day that may be
	// half gone. A pool of 0 carrying a draw saturates to Infinity,
	// which the description would print as "Infinity%".
	it.each([
		['today has logged no hours', null],
		[
			'the drawn pool is 0 hours',
			remainingDay({
				limitType: 'cognitive',
				percentSpent: Infinity,
			}),
		],
	])('reads capacity left as N/A when %s', (_case, remaining) => {
		const row = reading(dailyMetrics(plannedDay), m.metric_capacity_left(), remaining);

		expect(row.value).toBe(m.na_value());
		expect(row.band).toBe('neutral');
	});

	// A share, not a duration: the pool is spent at the task's difficulty weight, so
	// minutes of pool per hour worked read as clock time the user has left.
	it('reads what the logged hours left of the pool they load hardest', () => {
		const row = reading(
			dailyMetrics(plannedDay),
			m.metric_capacity_left(),
			remainingDay({
				limitType: 'physical',
				percentSpent: 62.5,
			}),
		);

		expect(row.value).toBe('37%');
		// One rounding for both halves: 62.5 spent must not read as 38% left over a
		// sentence that says 63% is gone.
		expect(row.description).toContain('63%');
		expect(row.band).toBe(AXIS_BAND.humanCapacity(62.5));
		expect(row.description).toContain(String(pools.physicalHours));
		expect(row.description).not.toContain(String(pools.cognitiveHours));
	});

	// The reading Human Capacity cannot give: the allocator enforces the pools, so
	// a PLAN saturates at 100 and the critical band above it is unreachable from
	// allocator output. Hours actually worked reach it.
	it('bands a day worked past its pool critical, with nothing left', () => {
		const row = reading(
			dailyMetrics(plannedDay),
			m.metric_capacity_left(),
			remainingDay({
				limitType: 'cognitive',
				percentSpent: 128,
			}),
		);

		expect(row.value).toBe('0%');
		expect(row.band).toBe('critical');
	});
});
