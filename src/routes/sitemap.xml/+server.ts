import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';

// Indexable app pages. /demo is deliberately absent (robots.txt disallows it).
const PATHS = ['/', '/analytics', '/calendar', '/energy'];

export const GET: RequestHandler = ({ url }) => {
	const origin = (env.PUBLIC_SITE_URL ?? url.origin).replace(/\/$/, '');
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PATHS.map((path) => `\t<url>\n\t\t<loc>${origin}${path}</loc>\n\t</url>`).join('\n')}
</urlset>
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};

// `<loc>` must be absolute, so this can only be a static file once the
// canonical origin is known at BUILD time. Prerendering without
// PUBLIC_SITE_URL bakes in SvelteKit's `http://sveltekit-prerender`
// placeholder — a sitemap Google would reject. Unset, we stay dynamic and
// answer off the request origin instead.
export const prerender = Boolean(env.PUBLIC_SITE_URL);
