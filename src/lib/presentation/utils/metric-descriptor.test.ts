import { describe, expect, it } from 'vitest';
import type { DailyMetrics } from '$lib/business/model/metric/daily-metrics';
import * as m from '$lib/paraglide/messages.js';
import { AXIS_BAND } from '$lib/presentation/utils/band';
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
		bottleneckTask: 'None Detected',
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
		taskVariety: 0,
		grindDensity: 0,
		rewardDensity: 0,
		recoveryRatio: 'N/A',
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

function reading(metrics: DailyMetrics, label: string) {
	const row = buildMetrics(metrics, pools).find((candidate) => candidate.label === label);

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

		expect(rows.length).toBeGreaterThan(0);

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

	// The four gates are not interchangeable, and a swapped one is invisible on a
	// day that satisfies all of them. A finished day is the case that separates
	// them: tasks and a budget, but nothing left active, so anything measured over
	// the remaining work is undefined again.
	it('reads the remaining-work metrics as N/A once every task is done', () => {
		const finished = dailyMetrics({
			totalTasks: 2,
			completedTasks: 2,
			budgetHours: 8,
			activeTasks: activeTasks(0),
			completionRate: 100,
			flowCoverage: {
				reached: 0,
				total: 0,
			},
			quickWins: 0,
			taskVariety: 0,
			grindDensity: 0,
			yieldIndex: 90,
		});

		for (const label of [
			m.metric_flow_coverage(),
			m.metric_quick_wins(),
			m.metric_task_variety(),
			m.metric_grind_density(),
		]) {
			expect(reading(finished, label).value, label).toBe(m.na_value());
		}

		// The two that are about work already done still read.
		expect(reading(finished, m.metric_completion_rate()).value).toBe('100%');
		expect(reading(finished, m.metric_yield_index()).value).toBe('90%');
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

	// A pool of 0 hours carrying demand saturates to Infinity (MATH.md §14).
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

	// "0:xx" is the ratio the model emits when a day funds no recovery at all.
	it.each([
		['No strain', 'neutral'],
		['N/A', 'neutral'],
		['0:45', 'warning'],
		['1:30', 'success'],
	])('bands a recovery ratio of %s as %s', (recoveryRatio, band) => {
		expect(
			reading(
				dailyMetrics({
					...plannedDay,
					recoveryRatio,
				}),
				m.metric_recovery_ratio(),
			).band,
		).toBe(band);
	});
});
