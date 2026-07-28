import { describe, expect, it } from 'vitest';
import { buildAdviceDisplay } from '$lib/presentation/utils/plan-advice-descriptor';
import type { AdviceLever, AdviceOption, PlanAdvice } from '$lib/business/model/metric/plan-advice';

function option(planValueDeltaPercent: number | null, lever: AdviceLever): AdviceOption {
	return {
		lever,
		after: 50,
		quadrant: 'grind',
		// Only the delta is read for the cost column; the absolute value is not.
		planValue: 1,
		planValueDeltaPercent,
	};
}

function defer(taskId: number, deltaPercent: number | null): AdviceOption {
	return option(deltaPercent, {
		kind: 'defer-task',
		taskId,
		title: `T${taskId}`,
	});
}

function setBudget(hours: number, deltaPercent: number | null): AdviceOption {
	return option(deltaPercent, {
		kind: 'set-budget',
		hours,
	});
}

/** Burnout Risk at 90% is out of band, so the row survives the band filter. */
function advice(options: AdviceOption[], unpriced: AdviceOption | null = null): PlanAdvice {
	return {
		planValue: 10,
		quadrant: 'grind',
		findings: [
			{
				axis: 'burnoutRisk',
				before: 90,
				options,
				unpriced,
			},
		],
		unfundedTaskIds: [],
		candidatesEvaluated: options.length,
	};
}

describe('buildAdviceDisplay', () => {
	// MATH.md §14.1-4: the frontier rises in plan value, so its last row is the
	// cheapest — the one a frontier exists to surface. Truncating from the end
	// dropped exactly that.
	it('keeps the cheapest option when the frontier is longer than the cap', () => {
		const display = buildAdviceDisplay(
			advice([defer(1, -30), defer(2, -20), defer(3, -10), defer(4, -2)]),
			3,
		);

		const actions = display.rows[0].options.map((row) => row.action);

		expect(actions).toHaveLength(3);
		expect(actions[0]).toContain('T1');
		// T3 is dropped from the middle; T4, the cheapest, is kept.
		expect(actions[2]).toContain('T4');
	});

	it('leaves a frontier at or under the cap untouched', () => {
		const display = buildAdviceDisplay(advice([defer(1, -30), defer(2, -10)]), 3);

		expect(display.rows[0].options).toHaveLength(2);
	});

	// MATH.md §14.1-1: Σ P̄ rises when the budget does, so printing that rise as
	// the cost would read as the extra hour being free.
	it('prices the unpriced budget increase in hours, last, not in plan value', () => {
		const display = buildAdviceDisplay(advice([defer(1, -30)], setBudget(9, 4.2)), 3);
		const rows = display.rows[0].options;

		expect(rows).toHaveLength(2);
		expect(rows[1].action).toContain('9');
		expect(rows[1].cost).toBe('costs an extra hour of your day');
		expect(rows[1].cost).not.toContain('%');
	});

	it('renders an axis only the extra hour improves', () => {
		const display = buildAdviceDisplay(advice([], setBudget(9, 4.2)), 3);

		expect(display.rows[0].options).toHaveLength(1);
	});

	// MATH.md §14.1-3.
	it('renders a null delta as N/A rather than as free', () => {
		const display = buildAdviceDisplay(advice([defer(1, null)]), 3);

		expect(display.rows[0].options[0].cost).toBe('N/A');
	});

	it('still calls a genuinely value-free lever free', () => {
		const display = buildAdviceDisplay(advice([defer(1, 0)]), 3);

		expect(display.rows[0].options[0].cost).toBe('costs no plan value');
	});

	// MATH.md §14: Human Capacity reads Infinity when a pool holds 0 hours with
	// demand on it. "N/A" coloured red — and announced as critical to a screen
	// reader — judges a number that does not exist; the metric rows render every
	// N/A neutral for the same reason.
	it('gives a reading that is not a number no band', () => {
		const display = buildAdviceDisplay(
			{
				planValue: 10,
				quadrant: 'grind',
				findings: [
					{
						axis: 'humanCapacity',
						before: Infinity,
						options: [
							{
								...setBudget(9, -4),
								after: Infinity,
							},
							setBudget(10, -8),
						],
						unpriced: null,
					},
				],
				unfundedTaskIds: [],
				candidatesEvaluated: 2,
			},
			3,
		);

		const row = display.rows[0];

		expect(row.before).toBe('N/A');
		expect(row.beforeBand).toBe('neutral');

		expect(row.options[0].after).toBe('N/A');
		expect(row.options[0].afterBand).toBe('neutral');
		// A finite option on the same row still bands normally.
		expect(row.options[1].after).toBe('50%');
		expect(row.options[1].afterBand).toBe('success');
	});

	// MATH.md §14.1-2: the lever carries the exact trim; only the label rounds.
	it('rounds the budget label to two decimals without touching the lever', () => {
		const exact = 8 - 1 / 3;
		const display = buildAdviceDisplay(advice([setBudget(exact, 0)]), 3);

		expect(display.rows[0].options[0].action).toContain('7.67');

		expect(display.rows[0].options[0].lever).toEqual({
			kind: 'set-budget',
			hours: exact,
		});
	});
});
