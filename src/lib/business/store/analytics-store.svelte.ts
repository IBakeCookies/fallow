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
import { logError } from '$lib/logger';
import * as fitSnapshotRepository from '$lib/data/repository/fit-snapshot-repository';
import { rankDrainByTask, type DrainRanking } from '$lib/business/model/energy-calibration';
import { tagHours, type TagHoursBreakdown } from '$lib/business/model/tags';
import {
	averageCompletionRate,
	calculateMetricTrend,
	completionRateDelta,
	countQuadrants,
	currentStreak,
	findBestDay,
	loggedHours,
	longestStreak,
	monthlyCompletionRates,
	restSummary,
	type DaySummary,
	type MetricTrendPoint,
	type MonthlyCompletion,
	type RestSummary,
} from '$lib/business/model/metric/history';
import type { EnergyParams } from '$lib/business/model/zenith-energy';
import type { DrainObservationRecord, RestObservationRecord } from '$lib/data/type';
import type { DailyQuadrant } from '$lib/business/model/metric/calculation';
import type { PlanAudit } from '$lib/business/model/plan-audit';
import { addDays } from '$lib/business/utils/date';
import { liveToday } from '$lib/business/state/today.svelte';
import {
	initializeStorage,
	readDaySummaries,
	readModelReport,
	type CalibrationSnapshot,
	type ModelReport,
} from '$lib/business/session-history';

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
	/** Plan-adherence audit; null while loading or failed. */
	#audit = $state<PlanAudit | null>(null);
	/** Calibration snapshot ("Your model" card); null while loading or failed. */
	#calibration = $state<CalibrationSnapshot | null>(null);
	/** The fitted energy params the trend is read through; null until they land. */
	#energyParams = $state<EnergyParams | null>(null);
	/** The 🪫 rows the trend seeds each morning from; empty until they land. */
	#drain = $state<DrainObservationRecord[]>([]);
	/** The ☕ rows the rest totals fold; empty until they land. */
	#rest = $state<RestObservationRecord[]>([]);
	/**
	 * Whether the 🪫/☕ rows above are an answer or an absence of one — the two
	 * hour readings they feed are the only ones on the page that cannot tell an
	 * empty log store from an unfinished read, and 0 h beside a real declared
	 * budget is a claim about the user's own logs.
	 */
	#isModelReportLoaded = $state(false);
	/** A load failure must not leave the two cards on the loading string forever. */
	#hasModelReportFailed = $state(false);

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
		Math.round(this.#summaries.reduce((sum, s) => sum + s.availableHours, 0) * 10) / 10,
	);
	/** 🪫 hours over the viewed range — the logged side of planned vs logged. */
	#loggedHours = $derived(
		this.#isModelReportLoaded ? loggedHours(this.#drain, this.#rangeStart) : null,
	);
	#restStats = $derived(
		this.#isModelReportLoaded ? restSummary(this.#rest, this.#rangeStart) : null,
	);
	/** What `loggedHours` breaks down into, by the tags on the tasks it counted. */
	#tagHours = $derived(
		this.#isModelReportLoaded ? tagHours(this.#drain, this.#all, this.#rangeStart) : null,
	);
	// Reads the whole loaded year, not the viewed range — a streak is not a
	// property of whichever window happens to be open.
	#activeDates = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- rebuilt whole, never mutated after
		return new Set(this.#all.filter((s) => s.completedTasks > 0).map((s) => s.date));
	});
	#streak = $derived(currentStreak(this.#activeDates, this.#today));
	#longestStreak = $derived(longestStreak(this.#activeDates));

	/**
	 * What each task is CALLED now, by id, over the whole loaded year — how the log
	 * history names a measurement instead of trusting the title frozen onto the
	 * record when it was logged. Rename a task and that copy drifts; this one cannot,
	 * and it repairs the ones that already drifted.
	 *
	 * Free rather than a fifth read: `#all` is the year of days and a `DaySummary`
	 * carries its `tasks`, so this is a fold over what the page has already loaded.
	 * One id is one task on one day — ids come off the clock and are not recycled
	 * (`nextTaskId`), so a recurring task's Tuesday instance is a different id and
	 * keeps Tuesday's name. This is the only join in the app addressed by `taskId`
	 * with no date beside it; `#all` is ascending, so if two days ever did share an
	 * id the newer name would win, and the cost is a misprinted label.
	 *
	 * Not exhaustive, deliberately: a task deleted since, or one older than the year,
	 * is absent, and the frozen title is the only name its measurement has left.
	 */
	#taskTitles = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup, never mutated after
		const titles = new Map<number, string>();

		for (const day of this.#all) {
			for (const task of day.tasks) titles.set(task.id, task.title);
		}

		return titles;
	});

	/**
	 * Burnout Risk and the two Loads per day in the viewed range.
	 * `null` until the model report lands, because the series is read through the
	 * user's own calibrated energy params and yesterday's 🪫 rows — a trend on the
	 * defaults would contradict today's tile for a reason nothing on the page
	 * explains.
	 *
	 * `$derived.by` and not a plain getter: the fold runs one energy simulation
	 * per day in the range, and the page reads this twice per derivation (once to
	 * test for null, once to build the series).
	 */
	#metricTrend = $derived.by(() =>
		this.#energyParams === null
			? null
			: calculateMetricTrend(this.#summaries, this.#energyParams, this.#drain),
	);

	/**
	 * Which task title drains each reservoir fastest per hour, and which slowest
	 * (MATH.md §8.14). `null` on the same two states as `metricTrend`, and for the
	 * same reason: the reading anchors every title's fit to the user's own global
	 * α̂, which a report that has not landed does not have.
	 *
	 * `$derived.by` like `metricTrend`, and cached for the same reason: the fold
	 * runs two fits for every title in the range, then gates.
	 */
	#drainRanking = $derived.by(() =>
		this.#energyParams === null
			? null
			: rankDrainByTask(this.#drain, this.#rangeStart, this.#today, this.#energyParams),
	);

	// Two reads, deliberately not one try block: they fail into different
	// surfaces. A failed model report is already visible — #hasModelReportFailed
	// takes every card it feeds out of its loading string, and each says the read
	// failed rather than reporting a count. An audit of no days is a claim about
	// the user's logs ("needs finished days with drain logs"), which a read that
	// never returned cannot support. A failed history read is not visible at all:
	// #all stays empty, so every chart renders as a year with nothing in it, which
	// is indistinguishable from a user who has never used the app.
	constructor(notifyHistoryLoadFailed: NotifyHistoryLoadFailed) {
		onMount(async () => {
			const today = this.#today;

			try {
				await initializeStorage();
				this.#all = await readDaySummaries(addDays(today, -(ANALYTICS_RANGES.year - 1)), today);
			} catch (e) {
				logError('Failed to load analytics history', e);
				notifyHistoryLoadFailed();
				// The report is never attempted — its transaction would fail too.
				this.#hasModelReportFailed = true;
				this.#isLoading = false;

				return;
			}

			// The main view can paint before the audit's optimizer runs finish.
			this.#isLoading = false;

			let todaysFit: ModelReport['todaysFit'];

			try {
				const report = await readModelReport(today, AUDIT_DAY_CAP);
				this.#calibration = report.calibration;
				this.#energyParams = report.calibration.energy.params;
				this.#drain = report.drain;
				this.#rest = report.rest;
				this.#audit = report.audit;
				this.#isModelReportLoaded = true;
				todaysFit = report.todaysFit;
			} catch (e) {
				logError('Failed to load the analytics model report', e);
				this.#hasModelReportFailed = true;

				return;
			}

			// Stamping today's fit fails silently — the quietest case of R1's third
			// surface, "already visible in the failing component", except that here
			// there is nothing to be visible: losing it costs one point of the trend
			// and one day the audit will score on the live fit instead, so the screen
			// is identical either way. Its own try so a failed WRITE never puts the
			// two cards, which have already published, into the state that says their
			// READ failed.
			try {
				await fitSnapshotRepository.$updateFitSnapshot(todaysFit);
			} catch (e) {
				logError('Failed to record the day fit snapshot', e, {
					date: today,
				});
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
	/** Live task names by id, for the log history — the whole loaded year, not the
	 *  viewed range: the history's "all time" scope reads past it. */
	get taskTitles(): ReadonlyMap<number, string> {
		return this.#taskTitles;
	}

	// ----- Load state -----

	get isLoading(): boolean {
		return this.#isLoading;
	}
	/**
	 * Whether the range holds anything — a statement about the data, so it only
	 * means what it says once `isLoading` is false. Read alone it reports "no
	 * history" for a read still in flight (business/AGENTS.md, loaded-ness is a field).
	 */
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
	get longestStreak(): number {
		return this.#longestStreak;
	}
	get bestDay(): DaySummary | null {
		return findBestDay(this.#summaries);
	}
	/**
	 * 🪫 hours logged in the viewed range, beside `plannedHours` (logged vs
	 * declared); `null` until the model report lands, and on a failed one.
	 */
	get loggedHours(): number | null {
		return this.#loggedHours;
	}
	/** `null` on the same two states as `loggedHours`, for the same reason. */
	get restSummary(): RestSummary | null {
		return this.#restStats;
	}
	/** `null` on the same two states as `loggedHours`, for the same reason. */
	get tagHours(): TagHoursBreakdown | null {
		return this.#tagHours;
	}
	/** `null` on the same two states as `metricTrend`, for the same reason. */
	get drainRanking(): DrainRanking | null {
		return this.#drainRanking;
	}

	// ----- Distributions -----

	get quadrantCounts(): Record<DailyQuadrant, number> {
		return countQuadrants(this.#summaries);
	}
	/** Per-calendar-month averages for the year chart; empty months keep a slot. */
	get monthlyRates(): MonthlyCompletion[] {
		return monthlyCompletionRates(this.#summaries, this.#rangeStart, this.#today);
	}
	get metricTrend(): MetricTrendPoint[] | null {
		return this.#metricTrend;
	}

	// ----- The model cards -----

	get audit(): PlanAudit | null {
		return this.#audit;
	}
	get calibration(): CalibrationSnapshot | null {
		return this.#calibration;
	}
	/** Covers every card the report feeds: none may report a count instead. */
	get hasModelReportFailed(): boolean {
		return this.#hasModelReportFailed;
	}
}

/**
 * Read by `/analytics` alone, and built there rather than in the (app) layout
 * where the other single-route store now lives. Two reasons, and the second is
 * the one that settles it. The constructor's read is a year of summaries plus a
 * 30-day audit running both planners per day, which a store in the layout would
 * spend at app boot on behalf of someone who only opens the main page. And the
 * day summaries it folds are written by the main page all day, so a surviving
 * instance would go stale behind its own back — on the route, arriving _is_ the
 * refresh, which is what a layout-scoped one would need a method to do.
 *
 * The price is the empty window on the way in, and the page's placeholder frame
 * is what covers it. Not to be paid down with a lazy `load()` the route calls:
 * that hides from the caller that a fresh store is inert (business/AGENTS.md).
 *
 * The context is the guard, not a sharing mechanism: `setContext` throws
 * outside component initialisation, so no store can be built in a `+page.ts`
 * load and handed to a layout, where it would outlive the request.
 */
export function setAnalyticsStore(
	notifyHistoryLoadFailed: NotifyHistoryLoadFailed,
): AnalyticsStore {
	return setContext<AnalyticsStore>(CONTEXT_KEY, new AnalyticsStore(notifyHistoryLoadFailed));
}

export function getAnalyticsStore(): AnalyticsStore {
	return getContext<AnalyticsStore>(CONTEXT_KEY);
}
