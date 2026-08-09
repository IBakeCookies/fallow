import { describe, expect, it, vi } from 'vitest';
import {
	activeLocale,
	getDateLocale,
	getWeekStartsOn,
	localeLabel,
} from '$lib/presentation/utils/locale.svelte';

const mock = vi.hoisted(() => ({
	url: new URL('http://localhost/'),
}));

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return mock.url;
		},
	},
}));

describe('locale', () => {
	// The URL is the only thing that survives back/forward, a shared link and SSR,
	// so the active locale is read off it rather than tracked in module state.
	it.each([
		['http://localhost/', 'en'],
		['http://localhost/calendar', 'en'],
		['http://localhost/de', 'de'],
		['http://localhost/de/calendar', 'de'],
		['http://localhost/es', 'es'],
		['http://localhost/zh/calendar', 'zh'],
	])('reads %s as the %s locale', (url, locale) => {
		mock.url = new URL(url);

		expect(activeLocale.value).toBe(locale);
	});

	// A date rendered with the wrong tag is not an obvious failure — it is a real
	// date in the wrong language, on a German page, indefinitely.
	it.each([
		['http://localhost/', 'en-US'],
		['http://localhost/de', 'de-DE'],
		['http://localhost/es', 'es-ES'],
		['http://localhost/zh', 'zh-CN'],
	])('formats dates for %s with %s', (url, tag) => {
		mock.url = new URL(url);

		expect(getDateLocale()).toBe(tag);
	});

	// Week start is locale data, not a constant: a German calendar starts Monday,
	// an American one Sunday, and the column headers follow the same number.
	it.each([
		['http://localhost/', 7],
		['http://localhost/de', 1],
		['http://localhost/es', 1],
		['http://localhost/zh', 7],
	])('starts the week for %s on ISO day %i', (url, day) => {
		mock.url = new URL(url);

		expect(getWeekStartsOn()).toBe(day);
	});

	// Language names stay in their own language in every UI locale, so the picker
	// is readable to whoever needs to switch away from a language they cannot read.
	it('names each language in its own language', () => {
		mock.url = new URL('http://localhost/de');

		expect(localeLabel('en')).toBe('English');
		expect(localeLabel('de')).toBe('Deutsch');
		expect(localeLabel('es')).toBe('Español');
		expect(localeLabel('zh')).toBe('中文');
	});
});
