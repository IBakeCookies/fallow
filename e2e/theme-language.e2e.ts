import { expect, test } from '@playwright/test';

test('theme switch applies the chosen theme to <html>', async ({ page }) => {
	await page.goto('/');
	const html = page.locator('html');

	await page
		.getByRole('button', {
			name: 'Switch theme',
		})
		.click();

	await page
		.getByRole('menuitemradio', {
			name: 'Terminal',
		})
		.click();

	await expect(html).toHaveClass(/terminal/);
});

test('language switch moves between the unprefixed and the /de URL', async ({ page }) => {
	await page.goto('/');
	const html = page.locator('html');
	await expect(html).toHaveAttribute('lang', 'en');

	await page
		.getByRole('button', {
			name: 'Switch language: DE',
		})
		.click();

	await expect(page).toHaveURL(/\/de\/?$/);
	await expect(html).toHaveAttribute('lang', 'de');

	await expect(
		page.getByRole('link', {
			name: 'Kalender',
		}),
	).toBeVisible();

	// switch back — the label is German now ("Sprache wechseln: EN")
	await page
		.getByRole('button', {
			name: 'Sprache wechseln: EN',
		})
		.click();

	await expect(page).toHaveURL(/:\d+\/$/);
	await expect(html).toHaveAttribute('lang', 'en');

	await expect(
		page.getByRole('link', {
			name: 'Calendar',
		}),
	).toBeVisible();
});

/* The point of the `url` strategy: German is a URL a crawler can index, not a
   cookie state. A cold GET must serve German copy and a self-consistent set of
   canonical/hreflang tags — before this, /de/analytics 200'd with English. */
test('/de/* is a real German page with honest canonical and hreflang', async ({ page }) => {
	const response = await page.goto('/de/analytics');

	expect(response?.status()).toBe(200);
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');

	await expect(
		page.getByRole('heading', {
			name: 'Analysen',
		}),
	).toBeVisible();

	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/de\/analytics$/);
	await expect(page.locator('link[hreflang="de"]')).toHaveAttribute('href', /\/de\/analytics$/);
	await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', /\/analytics$/);
	await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute('href', /\/analytics$/);
});

/* Regression: the root layout keys the app subtree on the locale, so a
   language switch destroys and recreates everything inside it. The theme
   store must live OUTSIDE that boundary (root +layout.svelte) — when it was
   owned by the keyed subtree, a language switch rebuilt it from the
   load-time cookie snapshot and reset any theme picked since page load. */
test('theme picked at runtime survives a language switch', async ({ page }) => {
	await page.context().addCookies([
		{
			name: 'theme',
			value: 'glass-dark',
			url: 'http://localhost:4173',
		},
	]);

	await page.goto('/');

	const html = page.locator('html');
	await expect(html).toHaveClass(/glass-dark/);

	// switch theme in-app: cookie now says terminal, but layout data still says glass-dark
	await page
		.getByRole('button', {
			name: 'Switch theme',
		})
		.click();

	await page
		.getByRole('menuitemradio', {
			name: 'Terminal',
		})
		.click();

	await expect(html).toHaveClass(/terminal/);

	await page
		.getByRole('button', {
			name: 'Switch language: DE',
		})
		.click();

	await expect(html).toHaveAttribute('lang', 'de');

	// the keyed remount must not reset the theme to the load-time snapshot —
	// and the switch must stay a client-side goto(), not a document reload
	await expect(html).toHaveClass(/terminal/);
	await expect(html).not.toHaveClass(/glass-dark/);
});
