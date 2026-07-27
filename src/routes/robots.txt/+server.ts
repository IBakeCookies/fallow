import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';

export const GET: RequestHandler = ({ url }) => {
	const origin = (env.PUBLIC_SITE_URL ?? url.origin).replace(/\/$/, '');
	const body = `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};

// Same build-time-origin condition as sitemap.xml — the `Sitemap:` line has
// to be absolute, so a prerender without PUBLIC_SITE_URL would point crawlers
// at `http://sveltekit-prerender/sitemap.xml`.
export const prerender = Boolean(env.PUBLIC_SITE_URL);
