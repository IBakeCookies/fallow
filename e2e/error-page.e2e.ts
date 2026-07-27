import { expect, test } from '@playwright/test';

/* +error.svelte sits OUTSIDE the (app) group, so it renders without the nav, the
   footer or either store — which is also why nothing else in the suite exercises
   it. A 404 is the branch a real visitor hits (stale link, hand-typed URL); the
   copy has to reassure them their data survived, and the way back has to be
   localized. */

test('an unknown URL renders the 404 page with a way home', async ({ page }) => {
	const response = await page.goto('/no-such-page');

	expect(response?.status()).toBe(404);
	await expect(page).toHaveTitle('404 — Fallow');

	await expect(
		page.getByRole('heading', {
			name: 'Page not found',
			level: 1,
		}),
	).toBeVisible();

	await expect(page.getByText(/Your tasks are safe/)).toBeVisible();

	// 404 is not retryable, so the reload affordance must not be offered.
	await expect(
		page.getByRole('button', {
			name: 'Reload page',
		}),
	).toHaveCount(0);

	await page
		.getByRole('link', {
			name: 'Back to today',
		})
		.click();

	await expect(page).toHaveURL('http://localhost:4173/');

	await expect(
		page.getByRole('heading', {
			name: 'Fallow',
			exact: true,
		}),
	).toBeVisible();
});

// The error page is reached before any of the app's own routing runs, so its home
// link is the one localizeHref() call with nothing upstream to fall back on.
test('a German unknown URL keeps the visitor in German', async ({ page }) => {
	const response = await page.goto('/de/no-such-page');

	expect(response?.status()).toBe(404);
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');

	await expect(
		page.getByRole('heading', {
			name: 'Seite nicht gefunden',
			level: 1,
		}),
	).toBeVisible();

	await page
		.getByRole('link', {
			name: 'Zurück zu Heute',
		})
		.click();

	await expect(page).toHaveURL(/\/de\/?$/);
});
