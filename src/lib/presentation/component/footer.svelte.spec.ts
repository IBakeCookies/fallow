import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Footer from './footer.svelte';

describe('footer.svelte', () => {
	it('links to imprint and privacy from every page', async () => {
		render(Footer);

		await expect.element(page.getByRole('link', { name: 'Imprint' })).toHaveAttribute(
			'href',
			'/imprint'
		);
		await expect
			.element(page.getByRole('link', { name: 'Privacy Policy' }))
			.toHaveAttribute('href', '/privacy');
	});

	it('links to Ko-fi in a new tab', async () => {
		render(Footer);

		const coffee = page.getByRole('link', { name: /Buy me a coffee/ });
		await expect.element(coffee).toHaveAttribute('href', expect.stringContaining('ko-fi.com'));
		await expect.element(coffee).toHaveAttribute('target', '_blank');
		await expect.element(coffee).toHaveAttribute('rel', 'noopener');
	});
});
