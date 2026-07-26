import type { Handle } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { sequence } from '@sveltejs/kit/hooks';
import { readRequestAppearance } from '$lib/business/appearance';

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
	const { themeClass } = readRequestAppearance(event.cookies);

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%theme%', themeClass)
	});

	return response;
};

// no cookie yet leaves the placeholder empty — app.html's inline script then
// decides from prefers-reduced-motion before first paint
const handleSceneryMotion: Handle = async ({ event, resolve }) => {
	const sceneryPausedClass = readRequestAppearance(event.cookies).sceneryPaused
		? 'scenery-paused'
		: '';

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%scenery-paused%', sceneryPausedClass)
	});

	return response;
};

export const handle: Handle = sequence(handleParaglide, handleTheme, handleSceneryMotion);
