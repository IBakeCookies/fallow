import { browser } from '$app/environment';
import { toISODate } from '$lib/business/utils/date';

let current = $state(toISODate());

function refresh() {
	const now = toISODate();
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
		// On the server this module is a cross-request singleton, so `current`
		// would go stale on a warm instance — always read fresh there. In the
		// browser `current` is reactive and tracks midnight/wake rollovers.
		return browser ? current : toISODate();
	}
};
