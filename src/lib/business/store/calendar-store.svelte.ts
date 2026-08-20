/**
 * The calendar screen's reads: the stored day summaries for whichever range is
 * on screen, and whether that read has returned.
 *
 * Lives in the business layer because stepping months is a read protocol, not
 * view code — which range is in flight, which response is still the current
 * one, whether a repeated failure is one outage or many. All of it was inline
 * in `calendar/+page.svelte`, where no spec could reach it (AGENTS.md R2). The
 * page keeps what is genuinely presentation: the grid geometry, the weekday
 * labels, the locale's week start and the copy.
 */

import { onMount, setContext } from 'svelte';
import { logError } from '$lib/logger';
import type { DaySummary } from '$lib/business/model/metric/history';
import { initializeStorage, readDaySummaries } from '$lib/business/session-history';

const CONTEXT_KEY = Symbol();

/**
 * The visible range as `[start, end]` ISO dates, read reactively: the store
 * follows the page's month/week stepping rather than being told to reload, so
 * "which range" has one owner and no caller can forget to announce a step.
 */
export type VisibleRange = () => readonly [string, string];

/**
 * Says the range could not be read, so an empty grid does not read as an empty
 * history. Injected because raising a toast is presentation (R1) and so is the
 * copy (R2).
 */
export type NotifyCalendarLoadFailed = () => void;

export class CalendarStore {
	#days = $state<DaySummary[]>([]);

	// A grid asks by date, 42 cells at a time. Derived rather than assembled in
	// the read so `#days` stays a plain array: the Map is replaced wholesale and
	// never mutated, which is the case `prefer-svelte-reactivity` is not about.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- see above
	#byDate = $derived(new Map(this.#days.map((day) => [day.date, day])));
	#isLoading = $state(true);

	// Storage is opened once, and until it is there is nothing to read from: a
	// range read fired before this would fail on every visit's first paint.
	#isReady = $state(false);

	// Rapid prev/next clicks leave several reads in flight. The version is what
	// makes a superseded response — or a superseded rejection — drop instead of
	// painting over the month the user is now looking at.
	#version = 0;

	// The range read re-runs on every month/week step, and one broken database
	// fails all of them. Report the first failure only, and re-arm on a success,
	// so the user gets one toast per outage instead of one per click.
	#failureReported = false;

	#notifyLoadFailed: NotifyCalendarLoadFailed;

	constructor(visibleRange: VisibleRange, notifyLoadFailed: NotifyCalendarLoadFailed) {
		this.#notifyLoadFailed = notifyLoadFailed;

		onMount(async () => {
			try {
				await initializeStorage();
			} catch (e) {
				this.#reportFailure(e, 'Failed to initialize the calendar');
			} finally {
				this.#isReady = true;
			}
		});

		// Both reads are tracked, and the range is read first on purpose: a step
		// taken before storage opened is still the range that loads once it does.
		$effect(() => {
			const [start, end] = visibleRange();

			if (this.#isReady) void this.#load(start, end);
		});
	}

	async #load(start: string, end: string) {
		const version = ++this.#version;

		try {
			const days = await readDaySummaries(start, end);

			if (version !== this.#version) return;

			this.#days = days;
			this.#isLoading = false;
			this.#failureReported = false;
		} catch (e) {
			if (version !== this.#version) return;

			// Cleared even on failure, or the empty-state copy stays suppressed and
			// the four-second toast is the only explanation the user ever gets.
			this.#isLoading = false;
			this.#reportFailure(e, 'Failed to load sessions');
		}
	}

	#reportFailure(e: unknown, message: string) {
		logError(message, e);

		if (this.#failureReported) return;

		this.#failureReported = true;
		this.#notifyLoadFailed();
	}

	/** False once the read for the visible range has returned, failure included. */
	get isLoading(): boolean {
		return this.#isLoading;
	}

	/** The stored summary for one ISO date, or `undefined` if that day has none. */
	summaryFor(date: string): DaySummary | undefined {
		return this.#byDate.get(date);
	}

	/**
	 * Whether the loaded range holds any stored day at all. Reports on the data,
	 * not on the read, so it only means what it says once `isLoading` is false.
	 */
	get hasAnyData(): boolean {
		return this.#days.length > 0;
	}
}

/**
 * Read by `/calendar` alone and built there rather than in the `(app)` layout,
 * for the reason `setAnalyticsStore` gives: its reads are the route's, and the
 * day summaries it holds are written by the main page all day, so a surviving
 * instance would go stale behind its own back. Arriving is the refresh.
 *
 * No `getCalendarStore` — the route that sets it holds the only reference, and
 * components take props rather than reaching into stores
 * ([presentation/AGENTS.md](../../presentation/AGENTS.md)). The context is the
 * guard rather than a sharing mechanism: `setContext` throws outside component
 * initialisation, so no instance can be built in a `+page.ts` load and outlive
 * the request.
 */
export function setCalendarStore(
	visibleRange: VisibleRange,
	notifyLoadFailed: NotifyCalendarLoadFailed,
): CalendarStore {
	return setContext<CalendarStore>(CONTEXT_KEY, new CalendarStore(visibleRange, notifyLoadFailed));
}
