import type { LayoutServerLoad } from './$types';
import { readOrMintScenerySeed, readRequestAppearance } from '$lib/business/appearance';

export const load: LayoutServerLoad = async (event) => {
	const appearance = readRequestAppearance(event.cookies);

	return {
		// undefined (unknown or absent) lets the client fall back to its defaults
		theme: appearance.theme,
		// undefined (no cookie yet) lets the client fall back to prefers-reduced-motion
		sceneryPaused: appearance.sceneryPaused,
		// one seed per user varies the animated theme scenery; minted once,
		// then stable across visits (the reroll button rewrites the cookie)
		scenerySeed: readOrMintScenerySeed(event.cookies),
		// IP-derived visitor timezone (set by Vercel) so the SSR-inlined
		// scenery clock state is the visitor's local time, not the server's
		timezone: event.request.headers.get('x-vercel-ip-timezone') ?? undefined
	};
};
