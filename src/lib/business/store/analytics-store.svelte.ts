/**
 * The analytics screen's data: a year of day summaries, the range the user is
 * looking at, and every statistic derived from that slice.
 *
 * Lives in the business layer because the folds are model reads, not view code
 * — which days count toward a streak, how a delta is defined, whether an empty
 * month keeps its slot in the chart. All of it was inline in the route, where
 * no `.test.ts` could reach it (AGENTS.md R2). The page keeps what is genuinely
 * presentation: labels, colors, locale formatting and the SVG geometry.
 */

import { getContext, onMount, setContext } from 'svelte';
import { browser } from '$app/environment';
import { logError } from '$lib/logger';
import {
	averageCompletionRate,
	completionRateDelta,
	countQuadrants,
	currentStreak,
	findBestDay,
	monthlyCompletionRates,
	type DaySummary,
	type MonthlyCompletion,
} from '$lib/business/model/metric/history';
import type { DailyQuadrant } from '$lib/business/model/metric/calculation';
import type { PlanAudit } from '$lib/business/model/plan-audit';
import { addDays } from '$lib/business/utils/date';
import { liveToday } from '$lib/business/state/today.svelte';
import {
	EMPTY_PLAN_AUDIT,
	initializeStorage,
	readDaySummaries,
	readModelReport,
	type CalibrationSnapshot,
} from '$lib/business/store/session-history';

const CONTEXT_KEY = Symbol();

/** Each range's length in days. The year view is the whole loaded history. */
export const ANALYTICS_RANGES = {
	week: 7,
	month: 30,
	year: 365,
} as const;

export type AnalyticsRange = keyof typeof ANALYTICS_RANGES;

/** One optimizer run per audited day (~60ms each) — cap the lookback. */
const AUDIT_DAY_CAP = 30;

/**
 * Says the year of history could not be read, so an empty page does not read as
 * an empty life. Injected for the same reason as `NotifyParamsLoadFailed`:
 * raising a toast is presentation (R1) and so is the copy (R2).
 */
export type NotifyHistoryLoadFailed = () => void;

export class AnalyticsStore {
	#range = $state<AnalyticsRange>('week');
	/** Every stored day with tasks in the last year, ascending by date. */
	#all = $state<DaySummary[]>([]);
	#isLoading = $state(true);
	/** Plan-adherence audit (MATH.md §12); null while loading. */
	#audit = $state<PlanAudit | null>(null);
	/** Calibration snapshot ("Your model" card); null while loading. */
	#calibration = $state<CalibrationSnapshot | null>(null);
	/** A load failure must not leave the card on the loading string forever. */
	#calibrationFailed = $state(false);

	#today = $derived(liveToday.value);
	#rangeDays = $derived(ANALYTICS_RANGES[this.#range]);
	#rangeStart = $derived(addDays(this.#today, -(this.#rangeDays - 1)));
	#summaries = $derived(this.#all.filter((s) => s.date >= this.#rangeStart));

	// The previous period of the same length. The year view has none: only the
	// last 365 days are ever loaded.
	#previous = $derived.by(() => {
		if (this.#range === 'year') return [];

		const start = addDays(this.#today, -(2 * this.#rangeDays - 1));
		const end = addDays(this.#today, -this.#rangeDays);

		return this.#all.filter((s) => s.date >= start && s.date <= end);
	});

	#totalTasks = $derived(this.#summaries.reduce((sum, s) => sum + s.totalTasks, 0));
	#completedTasks = $derived(this.#summaries.reduce((sum, s) => sum + s.completedTasks, 0));
	#plannedHours = $derived(
		Math.round(this.#summaries.reduce((sum, s) => sum + (Number(s.availableHours) || 0), 0) * 10) /
			10,
	);
	// Reads the whole loaded year, not the viewed range — a streak is not a
	// property of whichever window happens to be open.
	#streak = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup, never mutated after
		const active = new Set(this.#all.filter((s) => s.completedTasks > 0).map((s) => s.date));

		return currentStreak(active, this.#today);
	});

	// Two reads, deliberately not one try block: they fail into different
	// surfaces. A failed model report is already visible — #calibrationFailed
	// takes that card out of its loading string. A failed history read is not:
	// #all stays empty, so every chart renders as a year with nothing in it,
	// which is indistinguishable from a user who has never used the app.
	constructor(notifyHistoryLoadFailed: NotifyHistoryLoadFailed) {
		onMount(async () => {
			if (!browser) return;

			const today = this.#today;

			try {
				await initializeStorage();
				this.#all = await readDaySummaries(addDays(today, -(ANALYTICS_RANGES.year - 1)), today);
			} catch (e) {
				logError('Failed to load analytics history', e);
				notifyHistoryLoadFailed();
				this.#audit ??= EMPTY_PLAN_AUDIT;
				this.#calibrationFailed = true;
				this.#isLoading = false;

				return;
			}

			// The main view can paint before the audit's optimizer runs finish.
			this.#isLoading = false;

			try {
				const report = await readModelReport(today, AUDIT_DAY_CAP);
				this.#calibration = report.calibration;
				this.#audit = report.audit;
			} catch (e) {
				logError('Failed to load the analytics model report', e);
				this.#audit ??= EMPTY_PLAN_AUDIT;
				this.#calibrationFailed = this.#calibration === null;
			}
		});
	}

	// ----- The viewed range -----

	get range(): AnalyticsRange {
		return this.#range;
	}
	set range(value: AnalyticsRange) {
		this.#range = value;
	}
	/** Length of the viewed range in days — the denominator of "active days". */
	get rangeDays(): number {
		return this.#rangeDays;
	}
	get rangeStart(): string {
		return this.#rangeStart;
	}
	get today(): string {
		return this.#today;
	}
	/** The days in the viewed range that have tasks, ascending by date. */
	get summaries(): DaySummary[] {
		return this.#summaries;
	}

	// ----- Load state -----

	get isLoading(): boolean {
		return this.#isLoading;
	}
	get hasData(): boolean {
		return this.#summaries.length > 0;
	}

	// ----- Headline stats -----

	get totalTasks(): number {
		return this.#totalTasks;
	}
	get completedTasks(): number {
		return this.#completedTasks;
	}
	/** Share of planned tasks completed, 0 when nothing was planned. */
	get completedShare(): number {
		return this.#totalTasks > 0 ? Math.round((this.#completedTasks / this.#totalTasks) * 100) : 0;
	}
	get averageCompletionRate(): number {
		return averageCompletionRate(this.#summaries);
	}
	/** Change against the previous period of equal length; null when there is none. */
	get completionRateDelta(): number | null {
		return completionRateDelta(this.#summaries, this.#previous);
	}
	/** Declared budget across the range, to one decimal. */
	get plannedHours(): number {
		return this.#plannedHours;
	}
	get streak(): number {
		return this.#streak;
	}
	get activeDaysWithCompletion(): number {
		return this.#summaries.filter((s) => s.completedTasks > 0).length;
	}
	get bestDay(): DaySummary | null {
		return findBestDay(this.#summaries);
	}

	// ----- Distributions -----

	get quadrantCounts(): Record<DailyQuadrant, number> {
		return countQuadrants(this.#summaries);
	}
	/** Per-calendar-month averages for the year chart; empty months keep a slot. */
	get monthlyRates(): MonthlyCompletion[] {
		return monthlyCompletionRates(this.#summaries, this.#rangeStart, this.#today);
	}

	// ----- The model cards -----

	get audit(): PlanAudit | null {
		return this.#audit;
	}
	get calibration(): CalibrationSnapshot | null {
		return this.#calibration;
	}
	get calibrationFailed(): boolean {
		return this.#calibrationFailed;
	}
}

/**
 * Read by `/analytics` alone. The context is the guard, not a sharing
 * mechanism: `setContext` throws outside component initialisation, so no store
 * can be built in a `+page.ts` load and handed to a layout, where it would
 * outlive the request.
 */
export function setAnalyticsStore(
	notifyHistoryLoadFailed: NotifyHistoryLoadFailed,
): AnalyticsStore {
	return setContext<AnalyticsStore>(CONTEXT_KEY, new AnalyticsStore(notifyHistoryLoadFailed));
}

export function getAnalyticsStore(): AnalyticsStore {
	return getContext<AnalyticsStore>(CONTEXT_KEY);
}
