import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/**
 * The Lab is a today-only instrument: 🪫/☕ measurements are stamped with the
 * live clock and the λ₀ fit reads FINISHED days out of history, so there is no
 * such thing as the Lab "viewing" another day. The session store's date reader
 * belongs to the (app) layout and is route-blind, though, so a hand-typed or
 * stale `/energy?date=…` would load that day's tasks under copy that promises
 * today's session (business/model/AGENTS.md).
 *
 * Refused here rather than in the page: this runs BEFORE the layout hands the
 * store a date, so the wrong day is never read at all, nothing renders under the
 * wrong session, and it holds with JS disabled — none of which a `$effect` plus a
 * render gate can do.
 */
export const load: PageLoad = ({ url }) => {
	if (!url.searchParams.has('date')) return;

	const canonical = new URL(url);
	canonical.searchParams.delete('date');

	// `url.pathname` and not `resolve('/energy')`: the locale prefix (`/de/energy`)
	// is part of it, and `reroute` already stripped it from the route id.
	redirect(307, `${canonical.pathname}${canonical.search}`);
};
