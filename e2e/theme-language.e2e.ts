import { expect, test } from '@playwright/test';

/* Regression: the root layout keys the app subtree on the locale, so a
   language switch destroys and recreates everything inside it. The theme
   store must live OUTSIDE that boundary (root +layout.svelte) — when it was
   owned by the keyed subtree, a language switch rebuilt it from the
   load-time cookie snapshot and reset any theme picked since page load. */
test('theme picked at runtime survives a language switch', async ({ page }) => {
	await page.context().addCookies([{ name: 'theme', value: 'glass-dark', url: 'http://localhost:4173' }]);
	await page.goto('/');

	const html = page.locator('html');
	await expect(html).toHaveClass(/glass-dark/);

	// switch theme in-app: cookie now says terminal, but layout data still says glass-dark
	await page.getByRole('button', { name: 'Switch theme' }).click();
	await page.getByRole('menuitemradio', { name: 'Terminal' }).click();
	await expect(html).toHaveClass(/terminal/);

	await page.getByRole('button', { name: 'Switch language: DE' }).click();
	await expect(html).toHaveAttribute('lang', 'de');

	// the keyed remount must not reset the theme to the load-time snapshot
	await expect(html).toHaveClass(/terminal/);
	await expect(html).not.toHaveClass(/glass-dark/);
});
