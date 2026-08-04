/**
 * Calendar-date helpers shared across the business and presentation layers.
 *
 * All date math works on YYYY-MM-DD strings, anchored at local noon when a
 * Date object is needed — noon is immune to DST shifts and UTC off-by-one.
 * Days are keyed by the user's wall clock, not UTC, so "today" rolls over at
 * actual local midnight.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** First day of the week as an ISO weekday: Mon=1 … Sun=7. */
export type WeekStart = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Is this a real YYYY-MM-DD day? One definition (AGENTS.md R3): it decides both
 * whether a `?date=` URL param is usable and whether a stored record has a valid
 * day key, and the two must agree — a day the router accepts but the validator
 * drops would load blank forever. The shape alone is not enough: `Date` rolls
 * 2026-02-30 on to March 2, so a regex-only gate would key a day whose every
 * label renders as a different one. Round-tripping also rejects `Invalid Date`.
 */
export function isISODate(value: unknown): value is string {
	return typeof value === 'string' && ISO_DATE.test(value) && toISODate(fromISO(value)) === value;
}

/** Local calendar date (YYYY-MM-DD); defaults to now. */
export function toISODate(d: Date = new Date()): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(iso: string): Date {
	return new Date(`${iso}T12:00:00`);
}

/**
 * Whole calendar days from `from` to `to`, negative when `from` is later. Both
 * ends are anchored at local noon, so a DST boundary in between cannot round a
 * 23- or 25-hour day to the wrong count.
 */
export function daysBetween(from: string, to: string): number {
	return Math.round((fromISO(to).getTime() - fromISO(from).getTime()) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
	const d = fromISO(iso);
	d.setDate(d.getDate() + n);

	return toISODate(d);
}

/**
 * First day of the week containing `iso`. The week start is a caller's decision,
 * not a constant: it is locale data (Monday in de-DE, Sunday in en-US), and this
 * layer must not reach for the locale.
 */
export function startOfWeek(iso: string, weekStartsOn: WeekStart): string {
	const dow = fromISO(iso).getDay() || 7; // Mon=1 … Sun=7

	return addDays(iso, -((dow - weekStartsOn + 7) % 7));
}

/**
 * Full weeks covering a month, as ISO date strings, each starting on
 * `weekStartsOn`. Leading/trailing cells belong to the adjacent months.
 * `month` is 0-based to match Date#getMonth.
 */
export function monthGrid(year: number, month: number, weekStartsOn: WeekStart): string[][] {
	const lastDay = new Date(year, month + 1, 0).getDate();
	const lastOfMonth = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
	let cursor = startOfWeek(`${year}-${pad(month + 1)}-01`, weekStartsOn);
	const weeks: string[][] = [];

	while (cursor <= lastOfMonth) {
		const week: string[] = [];

		for (let i = 0; i < 7; i++) {
			week.push(cursor);
			cursor = addDays(cursor, 1);
		}

		weeks.push(week);
	}

	return weeks;
}
