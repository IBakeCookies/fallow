import { page } from 'vitest/browser';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Nav from './nav.svelte';

const mock = vi.hoisted(() => ({ url: new URL('http://localhost/') }));

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return mock.url;
		}
	}
}));

describe('nav.svelte', () => {
	beforeEach(() => {
		mock.url = new URL('http://localhost/');
	});

	it('renders all section links and marks the current page', async () => {
		mock.url = new URL('http://localhost/calendar');
		render(Nav);

		await expect
			.element(page.getByRole('link', { name: 'Calendar' }))
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(page.getByRole('link', { name: 'Today' }))
			.not.toHaveAttribute('aria-current');
		await expect.element(page.getByRole('link', { name: 'Analytics' })).toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'Energy Lab' })).toBeInTheDocument();
	});

	it('shows the viewed date instead of "Today" when browsing another day', async () => {
		mock.url = new URL('http://localhost/?date=2020-01-01');
		render(Nav);

		const link = page.getByRole('link', { name: 'Viewing Jan 1 — return to today' });
		await expect.element(link).toHaveAttribute('href', '/');
		await expect.element(link).toHaveAttribute('title', 'Return to today');
	});

	it('renders a language switcher with the active locale marked', async () => {
		render(Nav);

		await expect
			.element(page.getByRole('button', { name: 'Switch language: EN' }))
			.toHaveAttribute('aria-current', 'true');
		await expect
			.element(page.getByRole('button', { name: 'Switch language: DE' }))
			.not.toHaveAttribute('aria-current');
	});
});
