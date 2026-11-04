/* The completion chart's x-axis is two different things: a date per bar for the
   week and month views, and a 7-day block per bar for the year, labelled once a
   calendar month. Both shapes,
   the today label and the empty slot used to live in
   `analytics/+page.svelte`, where none of them could be asserted — including the
   `null`-versus-`0` distinction the chart deliberately draws differently.

   The locale tag is a parameter for the reason `number-format.ts` gives. */

import * as m from '$lib/paraglide/messages.js';
import { addDays, fromISO } from '$lib/business/utils/date';
import type { DaySummary, WeeklyRollup } from '$lib/business/model/metric/history';
import type { AnalyticsRange } from '$lib/business/store/analytics-store.svelte';

export type ChartPoint = {
	/** Short x-axis label */
	label: string;
	/** Tooltip label */
	full: string;
	/** `null` = no data for this slot, which is not the same as 0% */
	value: number | null;
	/** The slot's yield reading; `null` = none, which the chart breaks its line at */
	line: number | null;
	/** Second tooltip line: what the slot is made of */
	sub: string;
	/** Whether the x-axis prints this slot's label */
	showLabel: boolean;
};

export interface CompletionChartInput {
	range: AnalyticsRange;
	summaries: DaySummary[];
	weeklyRollups: WeeklyRollup[];
	rangeStart: string;
	rangeDays: number;
	today: string;
	/** BCP-47 tag — `getDateLocale()` at the call site */
	locale: string;
}

/** One point per chart slot: a 7-day block for the year view, a day otherwise. */
export function completionChartPoints(input: CompletionChartInput): ChartPoint[] {
	const { range, locale, today } = input;

	if (range === 'year') {
		return input.weeklyRollups.map((week) => {
			const first = fromISO(week.start);

			return {
				// 52 labels do not fit the axis, so only a block that opens a calendar
				// month carries one — the density the year view already read at.
				label: week.isMonthStart
					? first.toLocaleDateString(locale, {
							month: 'short',
						})
					: '',
				full: m.ana_week_of({
					date: dayMonth(first, locale),
				}),
				value: week.average,
				line: week.yieldAverage,
				sub: activeDaysSub(week.dayCount),
				showLabel: week.isMonthStart,
			};
		});
	}

	const byDate = new Map(input.summaries.map((summary) => [summary.date, summary]));

	return Array.from(
		{
			length: input.rangeDays,
		},
		(_, i): ChartPoint => {
			const date = addDays(input.rangeStart, i);
			const summary = byDate.get(date);
			const day = fromISO(date);

			return {
				label: dayMonth(day, locale),
				full:
					date === today
						? m.ana_today_label({
								date: dayMonth(day, locale),
							})
						: day.toLocaleDateString(locale, {
								weekday: 'short',
								month: 'short',
								day: 'numeric',
							}),
				value: summary ? summary.completionRate : null,
				line: summary?.yieldIndex ?? null,
				sub: summary
					? m.ana_tasks_done_sub({
							completed: summary.completedTasks,
							total: summary.totalTasks,
						})
					: m.ana_no_data(),
				// 30 day labels do not fit the axis; every fifth keeps it readable.
				showLabel: range === 'week' || i % 5 === 0,
			};
		},
	);
}

function dayMonth(day: Date, locale: string): string {
	return day.toLocaleDateString(locale, {
		month: 'short',
		day: 'numeric',
	});
}

function activeDaysSub(dayCount: number): string {
	if (dayCount === 0) return m.ana_no_data();

	return dayCount === 1
		? m.ana_active_day_one()
		: m.ana_active_day_other({
				count: dayCount,
			});
}
