/**
 * Cookie storage — the second persistence backend after IndexedDB.
 *
 * Cookies (not IndexedDB) hold the handful of preferences the SERVER must know
 * before it can render: the theme class and scenery state are stamped into the
 * HTML by `hooks.server.ts` so the first paint is already correct. Everything
 * else belongs in IndexedDB, where backup covers it.
 *
 * The write attributes live here once. They used to be re-typed at every call
 * site, which is how a `SameSite` or `max-age` change silently applies to two
 * of three cookies.
 */

/** One year: a preference should survive a long absence, not a session. */
const MAX_AGE_SECONDS = 31_536_000;

/**
 * Anything that can hand back a cookie by name — SvelteKit's `event.cookies`
 * on the server, `documentCookies()` in the browser. Structural on purpose:
 * the data layer must not depend on the framework.
 */
export interface CookieSource {
	get(name: string): string | undefined;
}

/** Reads the browser's own cookie jar. Browser-only; call it inside a read. */
export function documentCookies(): CookieSource {
	return {
		get(name) {
			if (typeof document === 'undefined') return undefined;
			const match = document.cookie.match(
				new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`)
			);
			return match ? decodeURIComponent(match[1]) : undefined;
		}
	};
}

/** Browser-side write. Server-side writes go through SvelteKit's `cookies`. */
export function writeCookie(name: string, value: string): void {
	if (typeof document === 'undefined') return;
	document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

/** The same attributes as an option object, for SvelteKit's `cookies.set`. */
export const COOKIE_WRITE_OPTIONS = {
	path: '/',
	maxAge: MAX_AGE_SECONDS,
	sameSite: 'lax',
	httpOnly: false
} as const;
