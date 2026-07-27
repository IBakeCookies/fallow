/**
 * CRUD access to the appearance cookies: theme, scenery seed, scenery motion.
 *
 * The three cookie NAMES and their parsing live here and nowhere else — they
 * are read on the server (`hooks.server.ts`, `+layout.server.ts`) and written
 * in the browser (the theme store), and used to be spelled out at each site.
 *
 * Parsing only. Whether a stored theme still exists, and whether a missing
 * seed should be minted, are model decisions — see `business/model/theme.ts`.
 */

import {
	COOKIE_WRITE_OPTIONS,
	documentCookies,
	writeCookie,
	type CookieSource,
} from '$lib/data/storage/cookie';

const THEME_COOKIE = 'theme';
const SCENERY_SEED_COOKIE = 'scenerySeed';
const SCENERY_MOTION_COOKIE = 'sceneryMotion';

export interface StoredAppearance {
	/** Raw identifier — may name a theme that no longer exists. */
	theme: string | undefined;
	/** Undefined when absent or malformed; the caller mints a replacement. */
	scenerySeed: number | undefined;
	/** Undefined means "no preference recorded" — defer to prefers-reduced-motion. */
	sceneryPaused: boolean | undefined;
}

/**
 * Read all three at once. Pass `event.cookies` on the server; omit the
 * argument in the browser to read `document.cookie`.
 */
export function $readAppearance(source: CookieSource = documentCookies()): StoredAppearance {
	// `Number('')` is 0, so an empty-valued cookie would otherwise read as a
	// perfectly valid seed 0 — pinning every such visitor to one arrangement,
	// which is the opposite of what the seed is for.
	const rawSeed = source.get(SCENERY_SEED_COOKIE);
	const seed = rawSeed ? Number(rawSeed) : Number.NaN;
	const motion = source.get(SCENERY_MOTION_COOKIE);

	return {
		theme: source.get(THEME_COOKIE),
		scenerySeed: Number.isInteger(seed) && seed >= 0 ? seed : undefined,
		sceneryPaused: motion === 'paused' ? true : motion === 'on' ? false : undefined,
	};
}

export function $updateTheme(theme: string): void {
	writeCookie(THEME_COOKIE, theme);
}

export function $updateScenerySeed(seed: number): void {
	writeCookie(SCENERY_SEED_COOKIE, String(seed));
}

export function $updateSceneryMotion(paused: boolean): void {
	writeCookie(SCENERY_MOTION_COOKIE, paused ? 'paused' : 'on');
}

/**
 * Server-side seed mint — the one appearance cookie the server writes, so a
 * first visit already renders its own scenery arrangement. `sink` is
 * SvelteKit's `event.cookies`, typed structurally like `CookieSource`.
 */
export function $createScenerySeedCookie(
	sink: { set(name: string, value: string, options: typeof COOKIE_WRITE_OPTIONS): void },
	seed: number,
): void {
	sink.set(SCENERY_SEED_COOKIE, String(seed), COOKIE_WRITE_OPTIONS);
}
