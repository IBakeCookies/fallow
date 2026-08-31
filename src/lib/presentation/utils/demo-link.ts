import type { DemoTaskTitles } from '$lib/business/demo-day';
import * as m from '$lib/paraglide/messages.js';
import { localizeHref } from '$lib/paraglide/runtime';

/**
 * The example day's address, in one place: the `(app)` layout reads the param to
 * put the store in demo mode, and the planner's empty state links to it
 * (AGENTS.md R3). A query param and not a route, because the demo is the planner
 * over different data — see `docs/features/demo-day.md`.
 */
export const DEMO_SEARCH_PARAM = 'demo';

/** Localized, so a reader on `/de/` stays there on the way into the example day. */
export function getDemoHref(): string {
	return localizeHref(`/?${DEMO_SEARCH_PARAM}`);
}

/** The fixture's six titles, in fixture order — the copy half of the demo day. */
export function getDemoTaskTitles(): DemoTaskTitles {
	return [
		m.demo_task_feature(),
		m.demo_task_architecture(),
		m.demo_task_textbook(),
		m.demo_task_strength(),
		m.demo_task_swim(),
		m.demo_task_plaster(),
	];
}
