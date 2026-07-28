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

/**
 * Is this a YYYY-MM-DD day string? One definition (AGENTS.md R3): it decides both
 * whether a `?date=` URL param is usable and whether a stored record has a valid
 * day key, and the two must agree — a day the router accepts but the validator
 * drops would load blank forever.
 */
export function isISODate(value: unknown): value is string {
	return typeof value === 'string' && ISO_DATE.test(value);
}

/** Local calendar date (YYYY-MM-DD); defaults to now. */
export function toISODate(d: Date = new Date()): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(iso: string): Date {
	return new Date(`${iso}T12:00:00`);
}

export function addDays(iso: string, n: number): string {
	const d = fromISO(iso);
	d.setDate(d.getDate() + n);

	return toISODate(d);
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
	const dow = (fromISO(iso).getDay() + 6) % 7; // Mon=0 … Sun=6

	return addDays(iso, -dow);
}

/**
 * Full weeks (Mon–Sun) covering a month, as ISO date strings.
 * Leading/trailing cells belong to the adjacent months.
 * `month` is 0-based to match Date#getMonth.
 */
export function monthGrid(year: number, month: number): string[][] {
	const lastDay = new Date(year, month + 1, 0).getDate();
	const lastOfMonth = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
	let cursor = startOfWeek(`${year}-${pad(month + 1)}-01`);
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
