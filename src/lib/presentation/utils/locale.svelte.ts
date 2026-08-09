/**
 * Reload-free locale switching.
 *
 * Every non-base locale is a real route (`url` strategy → `/de/*`, `/es/*`,
 * `/fr/*`, `/zh/*`), so switching language is a navigation, not a cookie write.
 * goto() keeps it client-side and the root layout keys the app subtree on the
 * locale, so every m.*() message re-resolves without blanking the app.
 *
 * The active locale is read back off `page.url` rather than tracked in module
 * state: the URL is the only thing that survives back/forward, a shared link and
 * SSR, and reading it keeps this reactive on both. `$app/navigation` is fine
 * here — R5 forbids routing imports in `business`, not in `presentation`.
 */

import type { WeekStart } from '$lib/business/utils/date';
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

/**
 * Per-locale display data: the language's own name (identical in every UI
 * locale), its BCP-47 tag for `Intl` date formatting, and the day its calendars
 * start on. One total record, so adding a locale fails to compile until all
 * three are filled in — a ternary defaulting to `en-US` would have shipped
 * English dates silently. The week start is spelled out rather than read from
 * `Intl.Locale#getWeekInfo`, which Node 22 and older Safari do not have.
 */
const LOCALE_DISPLAY: Record<Locale, { label: string; dateTag: string; weekStartsOn: WeekStart }> =
	{
		en: {
			label: 'English',
			dateTag: 'en-US',
			weekStartsOn: 7,
		},
		de: {
			label: 'Deutsch',
			dateTag: 'de-DE',
			weekStartsOn: 1,
		},
		es: {
			label: 'Español',
			dateTag: 'es-ES',
			weekStartsOn: 1,
		},
		fr: {
			label: 'Français',
			dateTag: 'fr-FR',
			weekStartsOn: 1,
		},
		zh: {
			label: '中文',
			dateTag: 'zh-CN',
			// CLDR puts mainland China on Sunday (日一二三四五六), like the US
			weekStartsOn: 7,
		},
	};

export const localeLabel = (locale: Locale) => LOCALE_DISPLAY[locale].label;

/** BCP-47 tag for Intl date formatting, tracking the active locale. */
export function getDateLocale(): string {
	return LOCALE_DISPLAY[activeLocale.value].dateTag;
}

/** First day of the week for the active locale (Mon=1 … Sun=7). */
export function getWeekStartsOn(): WeekStart {
	return LOCALE_DISPLAY[activeLocale.value].weekStartsOn;
}
