import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SeoHead from './seo-head.svelte';

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/energy') }
}));

// The real virtual module reads a SvelteKit runtime global that doesn't
// exist under vitest; empty env falls back to page.url.origin.
vi.mock('$env/dynamic/public', () => ({ env: {} }));

const meta = (selector: string) => document.head.querySelector(selector)?.getAttribute('content');

describe('seo-head.svelte', () => {
	it('sets title, description, canonical, and social tags', async () => {
		render(SeoHead, { title: 'Energy Lab — Fallow', description: 'Calibrate your energy model.' });

		expect(document.title).toBe('Energy Lab — Fallow');
		expect(meta('meta[name="description"]')).toBe('Calibrate your energy model.');
		expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
			'http://localhost/energy'
		);
		expect(meta('meta[property="og:title"]')).toBe('Energy Lab — Fallow');
		expect(meta('meta[property="og:url"]')).toBe('http://localhost/energy');
		expect(meta('meta[property="og:locale"]')).toBe('en_US');
		expect(meta('meta[property="og:locale:alternate"]')).toBe('de_DE');
		expect(meta('meta[property="og:image"]')).toBe(
			'http://localhost/fallow-daily-time-allocation.png'
		);
		expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image');
	});

	it('injects JSON-LD only when provided', async () => {
		const { unmount } = render(SeoHead, { title: 't', description: 'd' });
		expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull();
		unmount();

		render(SeoHead, {
			title: 't',
			description: 'd',
			jsonLd: { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Fallow' }
		});
		const script = document.head.querySelector('script[type="application/ld+json"]');
		expect(script).not.toBeNull();
		expect(JSON.parse(script!.textContent!)['@type']).toBe('WebApplication');
	});
});
