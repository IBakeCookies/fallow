/* The completion chart's x-axis is three different things: a weekday per bar for
   the week view, a date per bar for the month, and a calendar month per bar for
   the year. All three shapes, the today label and the empty slot used to live in
   `analytics/+page.svelte`, where none of them could be asserted — including the
   `null`-versus-`0` distinction the chart deliberately draws differently.

   The locale tag is a parameter for the reason `number-format.ts` gives. */

import * as m from '$lib/paraglide/messages.js';
import { addDays, fromISO } from '$lib/business/utils/date';
import type { DaySummary, MonthlyCompletion } from '$lib/business/model/metric/history';
import type { AnalyticsRange } from '$lib/business/store/analytics-store.svelte';

export type ChartPoint = {
	/** Short x-axis label */
	label: string;
	/** Tooltip label */
	full: string;
	/** `null` = no data for this slot, which is not the same as 0% */
	value: number | null;
	/** Second tooltip line: what the slot is made of */
	sub: string;
	/** Whether the x-axis prints this slot's label */
	showLabel: boolean;
};

export interface CompletionChartInput {
	range: AnalyticsRange;
	summaries: DaySummary[];
	monthlyRates: MonthlyCompletion[];
	rangeStart: string;
	rangeDays: number;
	today: string;
	/** BCP-47 tag — `getDateLocale()` at the call site */
	locale: string;
}

/** One point per chart slot: a calendar month for the year view, a day otherwise. */
export function completionChartPoints(input: CompletionChartInput): ChartPoint[] {
	const { range, locale, today } = input;

	if (range === 'year') {
		return input.monthlyRates.map((month) => {
			const first = fromISO(`${month.month}-01`);

			return {
				label: first.toLocaleDateString(locale, {
					month: 'short',
				}),
				full: first.toLocaleDateString(locale, {
					month: 'long',
					year: 'numeric',
				}),
				value: month.average,
				sub: monthSub(month.dayCount),
				showLabel: true,
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
				label:
					range === 'week'
						? day.toLocaleDateString(locale, {
								weekday: 'short',
							})
						: dayMonth(day, locale),
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

function monthSub(dayCount: number): string {
	if (dayCount === 0) return m.ana_no_data();

	return dayCount === 1
		? m.ana_active_day_one()
		: m.ana_active_day_other({
				count: dayCount,
			});
}
