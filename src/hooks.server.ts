import type { Handle } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { sequence } from '@sveltejs/kit/hooks';
import { readRequestAppearance } from '$lib/business/appearance';
import {
	DEFAULT_DARK_THEME,
	DEFAULT_THEME,
	getClassesToAdd,
	getSceneryMotionClasses,
} from '$lib/business/model/theme';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale)),
		});
	});

// app.html's pre-paint script swaps the default theme's classes for the dark
// default's; injecting them as JS array literals keeps the catalogue in
// business/model/theme.ts the single source of both.
const defaultThemeClasses = JSON.stringify(getClassesToAdd(DEFAULT_THEME));
const defaultDarkThemeClasses = JSON.stringify(getClassesToAdd(DEFAULT_DARK_THEME));

const handleTheme: Handle = async ({ event, resolve }) => {
	const { themeClass } = readRequestAppearance(event.cookies);

	const response = await resolve(event, {
		transformPageChunk: ({ html }) =>
			html
				.replace('%theme%', themeClass)
				.replace('%theme.default%', defaultThemeClasses)
				.replace('%theme.default-dark%', defaultDarkThemeClasses),
	});

	return response;
};

// no cookie yet leaves the placeholder empty — the guarded reduced-motion query
// in style/scenery/index.css then decides, with no cookie read and no script
const handleSceneryMotion: Handle = async ({ event, resolve }) => {
	const sceneryMotionClass = getSceneryMotionClasses(
		readRequestAppearance(event.cookies).sceneryPaused,
	).join(' ');

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%scenery-motion%', sceneryMotionClass),
	});

	return response;
};

export const handle: Handle = sequence(handleParaglide, handleTheme, handleSceneryMotion);
