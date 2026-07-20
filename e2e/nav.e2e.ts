import { expect, test } from '@playwright/test';

test('nav reaches Calendar, Analytics and Energy Lab', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('link', { name: 'Calendar' }).click();
	await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();

	await page.getByRole('link', { name: 'Analytics' }).click();
	await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();

	await page.getByRole('link', { name: 'Energy Lab' }).click();
	await expect(page.getByRole('heading').first()).toBeVisible();
});
