import { describe, expect, it } from 'vitest';
import {
	buildAdviceDisplay,
	describeDeferDestination,
} from '$lib/presentation/utils/plan-advice-descriptor';
import type {
	AdviceLever,
	AdviceOption,
	BudgetMarginal,
	PlanAdvice,
	SwitchCostPrice,
} from '$lib/business/model/metric/plan-advice';

/** A 15-minute block going to "Tax return", unless a test says otherwise. */
function marginal(overrides: Partial<BudgetMarginal> = {}): BudgetMarginal {
	return {
		blockHours: 0.25,
		planValueGain: 0.12,
		planValueGainPercent: 2.4,
		recipient: {
			taskId: 1,
			title: 'Tax return',
		},
		...overrides,
	};
}

function option(planValueDeltaPercent: number | null, lever: AdviceLever): AdviceOption {
	return {
		lever,
		after: 50,
		quadrantFlip: null,
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

/** 15 minutes a switch, three funded tasks, on an 8-hour day. */
function switchCostPrice(overrides: Partial<SwitchCostPrice> = {}): SwitchCostPrice {
	return {
		declared: 0.25,
		reservedHours: 0.5,
		reservedShare: 0.0625,
		alternatives: [
			{
				switchCost: 0,
				planValue: 11,
				planValueDeltaPercent: 10.4,
			},
			{
				switchCost: 0.5,
				planValue: 9,
				planValueDeltaPercent: -8.7,
			},
		],
		...overrides,
	};
}

/** Burnout Risk at 90% is out of band, so the row survives the band filter. */
function advice(options: AdviceOption[], unpriced: AdviceOption | null = null): PlanAdvice {
	return {
		planValue: 10,
		findings: [
			{
				axis: 'burnoutRisk',
				before: 90,
				options,
				unpriced,
			},
		],
		unfundedTaskIds: [],
		unfundedMustDoTaskIds: [],
		budgetMarginal: marginal(),
		switchCostPrice: switchCostPrice(),
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
			'en-GB',
		);

		const actions = display.rows[0].options.map((row) => row.action);

		expect(actions).toHaveLength(3);
		expect(actions[0]).toContain('T1');
		// T3 is dropped from the middle; T4, the cheapest, is kept.
		expect(actions[2]).toContain('T4');
	});

	it('leaves a frontier at or under the cap untouched', () => {
		const display = buildAdviceDisplay(advice([defer(1, -30), defer(2, -10)]), 'en-GB');

		expect(display.rows[0].options).toHaveLength(2);
	});

	// MATH.md §14.1-1: Σ P̄ rises when the budget does, so printing that rise as
	// the cost would read as the extra hour being free.
	it('prices the unpriced budget increase in hours, last, not in plan value', () => {
		const display = buildAdviceDisplay(advice([defer(1, -30)], setBudget(9, 4.2)), 'en-GB');
		const rows = display.rows[0].options;

		expect(rows).toHaveLength(2);
		expect(rows[1].action).toContain('9');
		expect(rows[1].cost).toBe('costs an extra hour of your day');
		expect(rows[1].cost).not.toContain('%');
		// Flagged, so the card can rule it off the frontier instead of listing it as
		// one more comparable option — and its button says what it spends rather than
		// naming hours: every axis's unpriced lever is the same `budget + 1`.
		expect(rows[1].isUnpriced).toBe(true);
		expect(rows[1].applyLabel).toBe('Add the hour');
		expect(rows[0].isUnpriced).toBe(false);
		// A deferral's button needs the task title, which only the card has.
		expect(rows[0].applyLabel).toBeNull();
	});

	it('renders an axis only the extra hour improves', () => {
		const display = buildAdviceDisplay(advice([], setBudget(9, 4.2)), 'en-GB');

		expect(display.rows[0].options).toHaveLength(1);
	});

	// MATH.md §14.1-3.
	it('renders a null delta as N/A rather than as free', () => {
		const display = buildAdviceDisplay(advice([defer(1, null)]), 'en-GB');

		expect(display.rows[0].options[0].cost).toBe('N/A');
	});

	it('still calls a genuinely value-free lever free', () => {
		const display = buildAdviceDisplay(advice([defer(1, 0)]), 'en-GB');

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
				unfundedMustDoTaskIds: [],
				budgetMarginal: marginal(),
				switchCostPrice: switchCostPrice(),
				candidatesEvaluated: 2,
			},
			'en-GB',
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

	// MATH.md §14.4. The model reports every axis now, so "no options" no longer
	// means "in band" — an axis that reads badly and has nothing to offer is the
	// one the card must still show, since the day really is that lopsided.
	it('keeps the row for an axis that reads badly and nothing improves', () => {
		const display = buildAdviceDisplay(advice([]), 'en-GB');

		expect(display.rows).toHaveLength(1);
		expect(display.rows[0].before).toBe('90%');
		expect(display.rows[0].options).toEqual([]);
	});

	// The other half of the same change: a NaN sentinel bands `critical` under
	// `getBandBiggerBetter` (nothing about it is ≥ 25), so an unfiltered model
	// would put "N/A · nothing improves this" on a day with no budget — the
	// alarm-about-nothing MATH.md §14.1-5 introduced the sentinel to prevent.
	// Infinity WITH options stays (the row above): there the levers are the point.
	it('drops an axis whose reading is not a number and has nothing to offer', () => {
		const display = buildAdviceDisplay(
			{
				...advice([]),
				findings: [
					{
						axis: 'scheduleIntegrity',
						before: NaN,
						options: [],
						unpriced: null,
					},
				],
			},
			'en-GB',
		);

		expect(display.rows).toEqual([]);
	});

	// Energy Balance reads as a direction AND the share behind it, through
	// `energyBalanceReading` — the words come from the same `energyBalanceSkew`
	// call `AXIS_BAND.energyBalance` bands the row with, and a second copy of
	// `> 60 / < 40` here is how a day gets labelled "Balanced" and coloured a
	// warning. The share is printed because the word alone is three buckets over a
	// continuous reading: 61.6% of this axis's options moved inside one bucket and
	// rendered as no change at all (MATH.md §25).
	// The lever's `after` and not the row's `before`: only a skewed reading is out
	// of band, so a balanced 50 never survives the row filter — reached as the
	// reading a lever PRODUCES, which is where the third branch actually renders.
	it.each([
		[75, 'Cognitive Heavy 75%'],
		[25, 'Physical Heavy 25%'],
		[50, 'Balanced 50%'],
	])('reads an energy balance of %i as a direction and a share', (after, expected) => {
		const display = buildAdviceDisplay(
			{
				...advice([defer(1, -30)]),
				findings: [
					{
						axis: 'energyBalance',
						before: 90,
						options: [
							{
								...defer(1, -30),
								after,
							},
						],
						unpriced: null,
					},
				],
			},
			'en-GB',
		);

		expect(display.rows[0].options[0].after).toBe(expected);
	});

	// The flip is the reason a lever can be worth taking at a cost: the reading
	// moves AND the day stops being a grind.
	it('names the Day Profile a lever flips the day to', () => {
		const flipping = {
			...defer(1, -30),
			quadrantFlip: 'cruise' as const,
		};

		const display = buildAdviceDisplay(advice([flipping, defer(2, -10)]), 'en-GB');

		expect(display.rows[0].options[0].profileFlip).toBe('Day Profile → Cruise');
		// No flip, or one the model judged too thin to claim (MATH.md §29).
		expect(display.rows[0].options[1].profileFlip).toBeNull();
	});

	// The badge fixes the day, not the hours, so a flagged task funded nothing gets
	// its own sentence — the plain unfunded line reads as something the menu below
	// can fix, and for these there is no lever.
	it('reports unfunded must-do tasks as a separate sentence', () => {
		const display = buildAdviceDisplay(
			{
				...advice([defer(1, -30)]),
				unfundedTaskIds: [2],
				unfundedMustDoTaskIds: [3],
			},
			'en-GB',
		);

		expect(display.unfunded).toBe('1 task gets no hours in this plan.');

		expect(display.unfundedMustDo).toBe(
			'1 task stays today but gets no hours — add hours or let it move.',
		);
	});

	it('says nothing about must-do tasks when the plan funds them all', () => {
		expect(buildAdviceDisplay(advice([defer(1, -30)]), 'en-GB').unfundedMustDo).toBeNull();
	});

	// Both counts have a singular message beside the `{count}` one, and only the
	// singular was ever rendered — a placeholder typo in either plural shipped
	// silent.
	it('counts more than one unfunded task, in both sentences', () => {
		const display = buildAdviceDisplay(
			{
				...advice([defer(1, -30)]),
				unfundedTaskIds: [2, 4],
				unfundedMustDoTaskIds: [3, 5, 6],
			},
			'en-GB',
		);

		expect(display.unfunded).toBe('2 tasks get no hours in this plan.');

		expect(display.unfundedMustDo).toBe(
			'3 tasks stay today but get no hours — add hours or let them move.',
		);
	});

	// MATH.md §14.3: the declared switch cost, priced. Conditional on purpose —
	// each alternative is what the plan would be worth if the declaration were
	// that number, never a claim the user can go and switch tasks faster.
	describe('the price of the switch cost', () => {
		const displayFor = (price: SwitchCostPrice) =>
			buildAdviceDisplay(
				{
					...advice([defer(1, -30)]),
					switchCostPrice: price,
				},
				'en-GB',
			).switchCost;

		it('reports the reservation and brackets it either way', () => {
			expect(displayFor(switchCostPrice())).toBe(
				'Switching reserves 30m of today, 6% of the budget, at 15m a switch. ' +
					'At no switch cost this plan reads +10.4% plan value; at 30m a switch, −8.7% plan value.',
			);
		});

		// The share ROUNDS rather than truncating, which the two cases above cannot
		// tell apart (0.0625 → 6 and 0.00208 → 0 either way). `Math.floor` here would
		// under-report every share by up to a point and passed the whole suite.
		it('rounds the share rather than truncating it', () => {
			expect(
				displayFor(
					switchCostPrice({
						reservedHours: 1.25,
						reservedShare: 0.208,
					}),
				),
			).toContain('reserves 1h 15m of today, 21% of the budget');
		});

		// One task takes no switches, so `(m−1)·s` is 0 and both alternatives can
		// only reproduce this plan. Stating "+0%" twice is noise about a day where
		// the constant provably did nothing.
		it('says the plan pays for no switching when it funds one task', () => {
			expect(
				displayFor(
					switchCostPrice({
						reservedHours: 0,
						reservedShare: 0,
						alternatives: [
							{
								switchCost: 0,
								planValue: 10,
								planValueDeltaPercent: 0,
							},
							{
								switchCost: 0.5,
								planValue: 10,
								planValueDeltaPercent: 0,
							},
						],
					}),
				),
			).toBe('At 15m a switch, this plan pays for no switching.');
		});

		// A declared 0 collapses both candidates onto the declaration itself
		// (MATH.md §14.3), so there is nothing left to bracket against.
		it('says the same when the day declares no switch cost at all', () => {
			expect(
				displayFor(
					switchCostPrice({
						declared: 0,
						reservedHours: 0,
						reservedShare: 0,
						alternatives: [],
					}),
				),
			).toBe('At 0m a switch, this plan pays for no switching.');
		});

		// The defect the union condition shipped: a plan can reserve nothing BECAUSE
		// the declaration priced every task but one out of it, and suppressing the
		// bracket there discards the one reading both extra solves existed to
		// produce, on the day the constant did the most damage — which is the generic
		// 3-task day at budget 0.5 h and s = 15 min, median +41.9% at s = 0 and up to
		// +63.4% (MATH.md §14.3). The 41.8 below is a representative input, not a
		// reading: this test's subject is the suppression, not the number.
		it('keeps the bracket when the declaration starved the plan to one task', () => {
			expect(
				displayFor(
					switchCostPrice({
						reservedHours: 0,
						reservedShare: 0,
						alternatives: [
							{
								switchCost: 0,
								planValue: 14.2,
								planValueDeltaPercent: 41.8,
							},
							{
								switchCost: 0.5,
								planValue: 10,
								planValueDeltaPercent: 0,
							},
						],
					}),
				),
			).toBe(
				'At 15m a switch, this plan pays for no switching. ' +
					'At no switch cost this plan reads +41.8% plan value; at 30m a switch, 0% plan value.',
			);
		});

		// The other half of the same defect: a sub-minute declaration reserves real
		// hours while `MIN_HOUR_STEP` collapses both candidates, and the union
		// condition then stated "pays for no switching" about a plan that reserves.
		// Reachable because `NumberInput` never snaps typed input to its step.
		it('still reports the reservation when there is no bracket to show', () => {
			expect(
				displayFor(
					switchCostPrice({
						declared: 0.5 / 60,
						reservedHours: 1 / 60,
						reservedShare: 1 / 60 / 8,
						alternatives: [],
					}),
				),
			).toBe('Switching reserves 1m of today, 0% of the budget, at 1m a switch.');
		});

		// A day with no hours entered yet. The two states arrive together and cannot
		// be separated: a null percentage means Σ P̄ is 0 (MATH.md §14.1-3), which
		// takes at most one funded task, which reserves nothing — so the sentence
		// that has no share to report is the one that reports no switching either.
		it('says the same on a day with no budget, which has no share to report', () => {
			expect(
				displayFor(
					switchCostPrice({
						reservedHours: 0,
						reservedShare: null,
						alternatives: [
							{
								switchCost: 0,
								planValue: 0,
								planValueDeltaPercent: null,
							},
							{
								switchCost: 0.5,
								planValue: 0,
								planValueDeltaPercent: null,
							},
						],
					}),
				),
			).toBe('At 15m a switch, this plan pays for no switching.');
		});
	});

	// MATH.md §14.2: the budget's shadow price, in the same "% plan value" the
	// cost column is spelled in — but signed +, because this one is a gain.
	describe('the marginal of the budget', () => {
		const displayFor = (budgetMarginal: BudgetMarginal) =>
			buildAdviceDisplay(
				{
					...advice([defer(1, -30)]),
					budgetMarginal,
				},
				'en-GB',
			).marginal;

		it('names the task the next block goes to and prices it', () => {
			expect(displayFor(marginal())).toBe(
				'The next 15 minutes would go to “Tax return” · +2.4% plan value',
			);
		});

		// Scoped to output, not to the whole worth of the time (MATH.md §14.2): on
		// these same days the unpriced `budget + 1` lever is still correct advice,
		// because Load is `weightedHours / budget` and slack is real relief. A
		// sentence reading "the time is useless" would contradict the row below it.
		it('says the next block gets nothing more done when no task takes it', () => {
			expect(
				displayFor(
					marginal({
						planValueGain: 0,
						planValueGainPercent: 0,
						recipient: null,
					}),
				),
			).toBe('Another 15 minutes would get nothing more done.');
		});

		// The pooled heuristic can hand a task the block while the day's value nets
		// out flat (MATH.md §14.2/§13.3). "Goes to X · +0% plan value" is the same
		// non-advice as no recipient, so it reads as the same sentence.
		it('says the same when a task takes the block but the value nets out flat', () => {
			expect(
				displayFor(
					marginal({
						planValueGain: 0,
						planValueGainPercent: 0,
					}),
				),
			).toBe('Another 15 minutes would get nothing more done.');
		});

		// A day with no hours entered yet: the block still goes somewhere, but
		// there is no plan value to state it as a fraction of (MATH.md §14.1-3).
		it('drops the percentage when the plan has no value to compare against', () => {
			expect(
				displayFor(
					marginal({
						planValueGainPercent: null,
					}),
				),
			).toBe('The next 15 minutes would go to “Tax return” · N/A');
		});
	});

	// Every decimal the card prints follows the reader's locale, like the dates
	// beside it: a German card reading "7.67h · −8.7% plan value" is the bug
	// `number-format.ts` exists for. Whole hours stay whole — `maximumFractionDigits`,
	// not the padding `formatDecimals` does.
	//
	// The surrounding words stay English here: paraglide resolves the MESSAGE from
	// its own runtime locale, which this parameter does not touch. That separation
	// is the point — the assertions below can only pass if the numbers were
	// formatted with the tag that was passed in.
	it('writes its decimals in the reader’s locale', () => {
		const display = buildAdviceDisplay(
			advice([setBudget(8 - 1 / 3, -8.7), setBudget(6, -2)]),
			'de-DE',
		);

		expect(display.rows[0].options[0].action).toContain('7,67');
		expect(display.rows[0].options[0].cost).toContain('8,7');
		expect(display.rows[0].options[1].action).toContain('6h');
		// Including the button's own words, which is why this file builds them: the
		// card has no locale to round with.
		expect(display.rows[0].options[0].applyLabel).toContain('7,67');
	});

	// MATH.md §14.1-2: the lever carries the exact trim; only the label rounds.
	it('rounds the budget label to two decimals without touching the lever', () => {
		const exact = 8 - 1 / 3;
		const display = buildAdviceDisplay(advice([setBudget(exact, 0)]), 'en-GB');

		expect(display.rows[0].options[0].action).toContain('7.67');

		expect(display.rows[0].options[0].lever).toEqual({
			kind: 'set-budget',
			hours: exact,
		});
	});
});

// ROADMAP item 21. Counts and hours only: no Δ% pair and nothing about what the
// deferred task itself would get there (item 8).
describe('describeDeferDestination', () => {
	it('reads a populated destination as its counts and its hours', () => {
		expect(
			describeDeferDestination({
				taskCount: 4,
				budgetHours: 6,
				fundedCount: 3,
			}),
		).toBe('Tomorrow: 4 tasks, 6h to spend — 3 of them funded.');
	});

	// An empty tomorrow is what the user wants to know before deferring, not a dead
	// row — so it reads as a destination, and still says what it opens on.
	it('reads an empty destination as the hours it opens on', () => {
		expect(
			describeDeferDestination({
				taskCount: 0,
				budgetHours: 6.5,
				fundedCount: 0,
			}),
		).toBe('Tomorrow: nothing planned yet, 6h 30m to spend.');
	});

	/* Nothing on it and no hours is the dead row item 21's own kill criterion names,
	   and only a user with no budgeted day in history can reach it (item 16). */
	it('says nothing about a day that is empty and unbudgeted', () => {
		expect(
			describeDeferDestination({
				taskCount: 0,
				budgetHours: 0,
				fundedCount: 0,
			}),
		).toBeNull();
	});

	// An over-subscribed unseen day is the most useful thing the line says, so the
	// suppression above is the PAIR and never the hours alone.
	it('still reads a day with tasks and no hours', () => {
		expect(
			describeDeferDestination({
				taskCount: 2,
				budgetHours: 0,
				fundedCount: 0,
			}),
		).toBe('Tomorrow: 2 tasks, 0m to spend — 0 of them funded.');
	});

	it('does not pluralize a single task', () => {
		expect(
			describeDeferDestination({
				taskCount: 1,
				budgetHours: 2,
				fundedCount: 1,
			}),
		).toBe('Tomorrow: 1 task, 2h to spend — 1 funded.');
	});

	// The read is refused mid-navigation, on a past day, and when it fails; the
	// card prints no line at all rather than an empty one.
	it('says nothing about a destination it has none of', () => {
		expect(describeDeferDestination(null)).toBeNull();
	});
});
