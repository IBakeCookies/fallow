import { browser } from '$app/environment';
import { toISODate } from '$lib/business/utils/date';

const MINUTE_MS = 60_000;
let current = $state(toISODate());
let now = $state(Date.now());

function refresh() {
	const today = toISODate();

	if (today !== current) current = today;

	now = Date.now();
}

// Timers are throttled or suspended in background tabs, so the midnight tick
// alone can fire late — also refresh whenever the tab wakes up.
if (browser) {
	const scheduleMidnightTick = () => {
		const start = new Date();

		const nextMidnight = new Date(
			start.getFullYear(),
			start.getMonth(),
			start.getDate() + 1,
			0,
			0,
			1,
		);

		setTimeout(() => {
			refresh();
			scheduleMidnightTick();
		}, nextMidnight.getTime() - start.getTime());
	};

	scheduleMidnightTick();
	setInterval(refresh, MINUTE_MS);
	document.addEventListener('visibilitychange', refresh);
	window.addEventListener('focus', refresh);
}

// The current day as a reactive source: read `liveToday.value` inside
// $derived/$effect to track rollovers, or anywhere for the value right now.
export const liveToday = {
	get value() {
		// On the server this module is a cross-request singleton, so `current`
		// would go stale on a warm instance — always read fresh there. In the
		// browser `current` is reactive and tracks midnight/wake rollovers.
		return browser ? current : toISODate();
	},
};

// The wall clock as a reactive source, in epoch ms: read `liveNow.value` inside
// $derived/$effect to re-read as the minute turns. Fresh on the server for the
// same reason `liveToday` is.
export const liveNow = {
	get value() {
		return browser ? now : Date.now();
	},
};
