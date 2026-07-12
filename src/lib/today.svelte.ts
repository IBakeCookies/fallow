import { browser } from '$app/environment';

// Local calendar date (YYYY-MM-DD). Days are keyed by the user's wall clock —
// matching the calendar grid's toISODate — not UTC, so "today" rolls over at
// actual local midnight.
export function localISODate(d: Date = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

let current = $state(localISODate());

function refresh() {
	const now = localISODate();
	if (now !== current) current = now;
}

// Timers are throttled or suspended in background tabs, so the midnight tick
// alone can fire late — also refresh whenever the tab wakes up.
if (browser) {
	const scheduleMidnightTick = () => {
		const now = new Date();
		const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
		setTimeout(() => {
			refresh();
			scheduleMidnightTick();
		}, nextMidnight.getTime() - now.getTime());
	};
	scheduleMidnightTick();
	document.addEventListener('visibilitychange', refresh);
	window.addEventListener('focus', refresh);
}

// The current day as a reactive source: read `liveToday.value` inside
// $derived/$effect to track rollovers, or anywhere for the value right now.
export const liveToday = {
	get value() {
		return current;
	}
};
