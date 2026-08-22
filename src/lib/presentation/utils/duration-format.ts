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
 * MODEL has no notion of when the day begins, and the old `0:00`–`10:00` form
 * read as midnight to breakfast.
 * Matches the chart's own `0h` axis.
 */
export function formatOffset(hours: number): string {
	return hours === 0 ? '0h' : formatDuration(hours);
}
