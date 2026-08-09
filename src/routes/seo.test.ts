/**
 * The two crawler-facing endpoints. Both must emit ABSOLUTE URLs, which is the
 * whole reason they are only prerendered when PUBLIC_SITE_URL is set at build
 * time — see the comment on each `prerender` export.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';

const { env } = vi.hoisted(() => ({
	env: {} as Record<string, string | undefined>,
}));

vi.mock('$env/dynamic/public', () => ({
	env,
}));

const { GET: robots } = await import('./robots.txt/+server');
const { GET: sitemap } = await import('./sitemap.xml/+server');

/** Only `url` is read; the rest of RequestEvent never gets touched. */
const request = (origin: string) =>
	({
		url: new URL(origin),
	}) as unknown as Parameters<typeof robots>[0] & Parameters<typeof sitemap>[0];

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

	it('disallows nothing — every route in the sitemap must stay crawlable', async () => {
		const body = await (await robots(request('https://preview.vercel.app'))).text();

		expect(body).not.toContain('Disallow');
	});
});

describe('sitemap.xml', () => {
	it('lists every indexable page as an absolute URL', async () => {
		env.PUBLIC_SITE_URL = 'https://fallow.app';

		const body = await (await sitemap(request('https://preview.vercel.app'))).text();

		expect(body).toContain('<loc>https://fallow.app/</loc>');
		expect(body).toContain('<loc>https://fallow.app/energy</loc>');
		// the two pages that exist for cold arrivals from search
		expect(body).toContain('<loc>https://fallow.app/imprint</loc>');
		expect(body).toContain('<loc>https://fallow.app/privacy</loc>');
	});

	it('lists the prefixed URLs too — /de/*, /es/*, /fr/*, /zh/* are what make them indexable', async () => {
		env.PUBLIC_SITE_URL = 'https://fallow.app';

		const body = await (await sitemap(request('https://preview.vercel.app'))).text();

		expect(body).toContain('<loc>https://fallow.app/de/</loc>');
		expect(body).toContain('<loc>https://fallow.app/de/privacy</loc>');
		expect(body).toContain('<loc>https://fallow.app/es/</loc>');
		expect(body).toContain('<loc>https://fallow.app/fr/</loc>');
		expect(body).toContain('<loc>https://fallow.app/zh/privacy</loc>');
	});

	it('pairs every entry with the full hreflang alternate set', async () => {
		env.PUBLIC_SITE_URL = 'https://fallow.app';

		const body = await (await sitemap(request('https://preview.vercel.app'))).text();
		const entries = body.match(/<url>[\s\S]*?<\/url>/g) ?? [];

		// 6 indexable pages × 5 locales
		expect(entries).toHaveLength(30);

		for (const entry of entries) {
			const href = (hreflang: string) =>
				entry.match(new RegExp(`hreflang="${hreflang}" href="([^"]+)"`))?.[1];

			for (const locale of ['de', 'es', 'fr', 'zh']) {
				expect(href(locale)).toBe(href('en')?.replace('fallow.app/', `fallow.app/${locale}/`));
			}

			// x-default is the unprefixed base locale, never a prefixed URL
			expect(href('x-default')).toBe(href('en'));
		}
	});

	it('never emits a relative loc, even with no canonical origin configured', async () => {
		const body = await (await sitemap(request('https://preview.vercel.app'))).text();

		for (const loc of body.match(/<loc>(.*?)<\/loc>/g) ?? []) {
			expect(loc).toContain('https://preview.vercel.app/');
		}
	});
});
