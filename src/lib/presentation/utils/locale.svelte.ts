/**
 * Reload-free locale switching.
 *
 * Paraglide's setLocale() reloads the page by default, which blanks the app
 * for seconds. Instead we set the cookie/global without reloading and track
 * the active locale as reactive state — the root layout keys the app subtree
 * on it, so every component re-renders and re-evaluates its m.*() messages.
 *
 * SSR note: the $state below is module-level, but it is only ever written in
 * the browser (switchLocale). On the server it stays null and reads fall
 * through to getLocale(), which is request-scoped via the paraglide
 * middleware — so no locale can leak between SSR requests.
 */

import { browser } from '$app/environment';
import { getLocale, setLocale, type Locale } from '$lib/paraglide/runtime';

let current = $state<Locale | null>(null);

/** The active locale as a reactive source (read `.value` in $derived/$effect). */
export const activeLocale = {
	get value(): Locale {
		return (browser && current) || getLocale();
	}
};

/** Switch the UI language in place — no page reload. */
export function switchLocale(locale: Locale) {
	if (locale === activeLocale.value) return;
	setLocale(locale, { reload: false });
	current = locale;
}

/** BCP-47 tag for Intl date formatting, tracking the active locale. */
export function getDateLocale(): string {
	return activeLocale.value === 'de' ? 'de-DE' : 'en-US';
}
