/**
 * The two crawler-facing endpoints. Both must emit ABSOLUTE URLs, which is the
 * whole reason they are only prerendered when PUBLIC_SITE_URL is set at build
 * time — see the comment on each `prerender` export.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';

const { env } = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/public', () => ({ env }));

const { GET: robots } = await import('./robots.txt/+server');
const { GET: sitemap } = await import('./sitemap.xml/+server');

/** Only `url` is read; the rest of RequestEvent never gets touched. */
const request = (origin: string) =>
	({ url: new URL(origin) }) as unknown as Parameters<typeof robots>[0] &
		Parameters<typeof sitemap>[0];

afterEach(() => delete env.PUBLIC_SITE_URL);

describe('robots.txt', () => {
	it('points crawlers at the sitemap on the request origin', async () => {
		const body = await (await robots(request('https://preview.vercel.app'))).text();

		expect(body).toContain('Sitemap: https://preview.vercel.app/sitemap.xml');
	});

	it('prefers the canonical origin over the request origin', async () => {
		env.PUBLIC_SITE_URL = 'https://fallow.app/';

		const body = await (await robots(request('https://preview.vercel.app'))).text();

		// trailing slash stripped — `https://fallow.app//sitemap.xml` is a 404
		expect(body).toContain('Sitemap: https://fallow.app/sitemap.xml');
	});
});

describe('sitemap.xml', () => {
	it('lists every indexable page as an absolute URL', async () => {
		env.PUBLIC_SITE_URL = 'https://fallow.app';

		const body = await (await sitemap(request('https://preview.vercel.app'))).text();

		expect(body).toContain('<loc>https://fallow.app/</loc>');
		expect(body).toContain('<loc>https://fallow.app/energy</loc>');
		// /demo is disallowed in robots.txt, so it must not be advertised here
		expect(body).not.toContain('/demo');
	});

	it('never emits a relative loc, even with no canonical origin configured', async () => {
		const body = await (await sitemap(request('https://preview.vercel.app'))).text();

		for (const loc of body.match(/<loc>(.*?)<\/loc>/g) ?? []) {
			expect(loc).toContain('https://preview.vercel.app/');
		}
	});
});
