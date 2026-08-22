/* Decimal hours are the model's unit (MATH.md), so every screen showing a length
   of time renders the same number. Two spellings had already drifted: `/energy`'s
   `formatDuration` rounded total minutes, `task-item.svelte`'s `formatHours`
   floored the hours and rolled a rounded-up 60 over — same output from different
   arithmetic, which is R3's "mirrors" case. One rounding, in one place. */

/** A length of time: "45m", "2h", "1h 30m". */
export function formatDuration(hours: number): string {
	const totalMinutes = Math.round(hours * 60);
	const h = Math.floor(totalMinutes / 60);
	const m = totalMinutes % 60;

	if (h === 0) return `${m}m`;

	return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Hours elapsed since the start of the day window, not a wall-clock time: the
 * MODEL has no notion of when the day begins (the session does — `formatClock`
 * below), and the old `0:00`–`10:00` form read as midnight to breakfast.
 * Matches the chart's own `0h` axis.
 */
export function formatOffset(hours: number): string {
	return hours === 0 ? '0h' : formatDuration(hours);
}

/**
 * A wall-clock time, 24-hour and locale-free — what `<input type="time">` reads
 * and writes on the wire, so the field and the strip's range never disagree.
 * Wraps past midnight, so a late start's end still reads as a clock time.
 */
export function formatClock(hours: number): string {
	const totalMinutes = Math.round(hours * 60);
	const h = Math.floor(totalMinutes / 60) % 24;
	const m = totalMinutes % 60;

	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** `formatClock`'s inverse; `null` on an empty or unparseable field. */
export function parseClock(value: string): number | null {
	const match = /^(\d{1,2}):(\d{2})$/.exec(value);

	if (!match) return null;

	return Number(match[1]) + Number(match[2]) / 60;
}
