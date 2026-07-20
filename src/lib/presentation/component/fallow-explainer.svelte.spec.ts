import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FallowExplainer from './fallow-explainer.svelte';

describe('fallow-explainer.svelte', () => {
	it('renders the pitch, FAQ, and external links', async () => {
		render(FallowExplainer);

		await expect
			.element(page.getByRole('heading', { level: 2 }))
			.toHaveTextContent("A to-do app that does calculus so you don't have to");
		await expect
			.element(page.getByRole('heading', { name: 'Frequently asked questions' }))
			.toBeInTheDocument();

		const article = document.querySelector('a[href*="thequantasticjournal.com"]');
		const repo = document.querySelector('a[href*="github.com/IBakeCookies/fallow"]');
		expect(article).not.toBeNull();
		expect(repo).not.toBeNull();
	});

	it('injects FAQPage JSON-LD mirroring the visible FAQ', async () => {
		render(FallowExplainer);

		const script = document.head.querySelector('script[type="application/ld+json"]');
		expect(script).not.toBeNull();
		const schema = JSON.parse(script!.textContent!);
		expect(schema['@type']).toBe('FAQPage');
		expect(schema.mainEntity).toHaveLength(3);
		// Google cross-checks schema against rendered text — assert one pair matches
		const first = schema.mainEntity[0];
		await expect.element(page.getByRole('heading', { name: first.name })).toBeInTheDocument();
		await expect.element(page.getByText(first.acceptedAnswer.text)).toBeInTheDocument();
	});
});
