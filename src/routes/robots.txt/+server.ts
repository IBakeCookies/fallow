import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';

export const GET: RequestHandler = ({ url }) => {
	const origin = (env.PUBLIC_SITE_URL ?? url.origin).replace(/\/$/, '');
	const body = `User-agent: *
Disallow: /demo

Sitemap: ${origin}/sitemap.xml
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
