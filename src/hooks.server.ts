import type { Handle } from '@sveltejs/kit';
import type { ThemeName } from '$lib/business/store/theme-store.svelte';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { sequence } from '@sveltejs/kit/hooks';
import { DEFAULT_THEME, getClassesToAdd, themes } from '$lib/business/store/theme-store.svelte';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		});
	});

const handleTheme: Handle = async ({ event, resolve }) => {
	const { cookies } = event;
	const cookieTheme = cookies.get('theme') as ThemeName;
	const theme = themes.find((t) => t.name === cookieTheme) ? cookieTheme : DEFAULT_THEME;

	const themeClass = getClassesToAdd(theme).join(' ');

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%theme%', themeClass)
	});

	return response;
};

export const handle: Handle = sequence(handleParaglide, handleTheme);
