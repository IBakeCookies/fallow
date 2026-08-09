import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { baseLocale, type Locale, locales, localizeUrl } from '$lib/paraglide/runtime';

// Indexable app pages, de-localized. Every one exists in every locale.
const PATHS = ['/', '/analytics', '/calendar', '/energy', '/imprint', '/privacy'];

export const GET: RequestHandler = ({ url }) => {
	const origin = (env.PUBLIC_SITE_URL || url.origin).replace(/\/$/, '');

	// A URL object, not a string: localizeUrl() only consults getUrlOrigin() for
	// string input, and this endpoint runs outside any request-scoped origin.
	const localized = (path: string, locale: Locale) =>
		localizeUrl(new URL(origin + path), {
			locale,
		}).href;

	// Each locale's URL is listed as its own <url>, and every entry repeats the
	// full alternate set including itself — that is what Google's spec asks for.
	const entries = PATHS.flatMap((path) => {
		const alternates = locales
			.map(
				(locale) =>
					`\t\t<xhtml:link rel="alternate" hreflang="${locale}" href="${localized(path, locale)}" />`,
			)
			.concat(
				`\t\t<xhtml:link rel="alternate" hreflang="x-default" href="${localized(path, baseLocale)}" />`,
			)
			.join('\n');

		return locales.map(
			(locale) => `\t<url>\n\t\t<loc>${localized(path, locale)}</loc>\n${alternates}\n\t</url>`,
		);
	});

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, max-age=3600',
		},
	});
};

// `<loc>` must be absolute, so this can only be a static file once the
// canonical origin is known at BUILD time. Prerendering without
// PUBLIC_SITE_URL bakes in SvelteKit's `http://sveltekit-prerender`
// placeholder — a sitemap Google would reject. Unset, we stay dynamic and
// answer off the request origin instead.
export const prerender = Boolean(env.PUBLIC_SITE_URL);
