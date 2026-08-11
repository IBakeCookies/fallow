import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import {
	readOrMintScenerySeed,
	readRequestAppearance,
	type AppearanceSnapshot,
} from '$lib/business/appearance';

export const load: LayoutServerLoad = async (event) => {
	const appearance = readRequestAppearance(event.cookies);

	return {
		// Shaped as an AppearanceSnapshot so the root layout can hand it straight
		// to the theme store, next to the store's client-cookie snapshot.
		appearance: {
			// undefined (unknown or absent) lets the client fall back to its defaults
			theme: appearance.theme,
			// undefined (no cookie yet) lets the client fall back to prefers-reduced-motion
			sceneryPaused: appearance.sceneryPaused,
			// one seed per user varies the animated theme scenery; minted once,
			// then stable across visits (the reroll button rewrites the cookie)
			scenerySeed: readOrMintScenerySeed(event.cookies),
		} satisfies AppearanceSnapshot,
		// IP-derived visitor timezone (set by Vercel) so the SSR-inlined
		// scenery clock state is the visitor's local time, not the server's
		timezone: event.request.headers.get('x-vercel-ip-timezone') ?? undefined,
		// the /_vercel/* analytics scripts only exist when hosted on Vercel;
		// injecting them elsewhere (local preview, e2e) just 404s
		isVercel: Boolean(env.VERCEL),
	};
};
