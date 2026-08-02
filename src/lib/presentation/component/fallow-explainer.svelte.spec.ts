import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FallowExplainer from '$lib/presentation/component/fallow-explainer.svelte';

// Only the <head> injection lives here — a story canvas can't reach document.head.
// The rendered pitch, FAQ, and links are asserted in fallow-explainer.stories.svelte.
describe('fallow-explainer.svelte', () => {
	it('injects FAQPage JSON-LD mirroring the visible FAQ', async () => {
		render(FallowExplainer);

		const script = document.head.querySelector('script[type="application/ld+json"]');
		expect(script).not.toBeNull();
		const schema = JSON.parse(script!.textContent!);
		expect(schema['@type']).toBe('FAQPage');
		expect(schema.mainEntity).toHaveLength(3);
		// Google cross-checks schema against rendered text — assert one pair matches
		const first = schema.mainEntity[0];

		await expect
			.element(
				page.getByRole('heading', {
					name: first.name,
				}),
			)
			.toBeInTheDocument();

		await expect.element(page.getByText(first.acceptedAnswer.text)).toBeInTheDocument();
	});
});
