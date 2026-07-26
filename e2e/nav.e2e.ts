import { expect, test } from '@playwright/test';

test('nav reaches all four sections and back to Today', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Fallow', exact: true })).toBeVisible();

	await page.getByRole('link', { name: 'Calendar' }).click();
	await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();

	await page.getByRole('link', { name: 'Analytics' }).click();
	await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();

	await page.getByRole('link', { name: 'Energy Lab' }).click();
	await expect(page.getByRole('heading', { name: 'Energy Lab' })).toBeVisible();

	await page.getByRole('link', { name: 'Today' }).click();
	await expect(page.getByRole('heading', { name: 'Fallow', exact: true })).toBeVisible();
});
