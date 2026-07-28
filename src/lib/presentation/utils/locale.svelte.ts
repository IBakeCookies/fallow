/**
 * Reload-free locale switching.
 *
 * German is a real route now (`url` strategy → `/de/*`), so switching language
 * is a navigation, not a cookie write. goto() keeps it client-side and the root
 * layout keys the app subtree on the locale, so every m.*() message re-resolves
 * without blanking the app.
 *
 * The active locale is read back off `page.url` rather than tracked in module
 * state: the URL is the only thing that survives back/forward, a shared link and
 * SSR, and reading it keeps this reactive on both. `$app/navigation` is fine
 * here — R5 forbids routing imports in `business`, not in `presentation`.
 */

import { goto } from '$app/navigation';
import { page } from '$app/state';
import { extractLocaleFromUrl, getLocale, localizeHref, type Locale } from '$lib/paraglide/runtime';

/** The active locale as a reactive source (read `.value` in $derived/$effect). */
export const activeLocale = {
	get value(): Locale {
		return extractLocaleFromUrl(page.url) ?? getLocale();
	},
};

/** Switch the UI language in place — no page reload. */
export function switchLocale(locale: Locale) {
	if (locale === activeLocale.value) return;

	goto(
		localizeHref(page.url.pathname + page.url.search, {
			locale,
		}),
	);
}

/** Language names in their own language — identical in every UI locale. */
const localeLabels: Record<Locale, string> = {
	en: 'English',
	de: 'Deutsch',
};

export const localeLabel = (locale: Locale) => localeLabels[locale];

/** BCP-47 tag for Intl date formatting, tracking the active locale. */
export function getDateLocale(): string {
	return activeLocale.value === 'de' ? 'de-DE' : 'en-US';
}
