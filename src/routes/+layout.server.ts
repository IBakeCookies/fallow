import type { LayoutServerLoad } from './$types';
import { randomScenerySeed, type ThemeName } from '$lib/business/store/theme-store.svelte';

export const load: LayoutServerLoad = async (event) => {
	// one seed per user varies the animated theme scenery; minted once,
	// then stable across visits (the reroll button rewrites the cookie)
	let scenerySeed = Number(event.cookies.get('scenerySeed'));

	if (!Number.isInteger(scenerySeed) || scenerySeed < 0) {
		scenerySeed = randomScenerySeed();
		event.cookies.set('scenerySeed', String(scenerySeed), {
			path: '/',
			maxAge: 31536000,
			sameSite: 'lax',
			httpOnly: false
		});
	}

	// undefined (no cookie yet) lets the client fall back to prefers-reduced-motion
	const sceneryMotion = event.cookies.get('sceneryMotion');
	const sceneryPaused =
		sceneryMotion === 'paused' ? true : sceneryMotion === 'on' ? false : undefined;

	return {
		theme: event.cookies.get('theme') as ThemeName | undefined,
		scenerySeed,
		sceneryPaused
	};
};
