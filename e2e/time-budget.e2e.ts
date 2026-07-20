import { expect, test } from '@playwright/test';
import { addTask } from './helpers';

test('setting the time budget feeds the plan', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');

	// budget defaults to 0 so the card starts open
	await page.getByLabel('Available Hours').fill('8');
	await page.getByLabel('Available Hours').blur();

	// metrics leave N/A once tasks + budget exist: Zenith Gain shows +X%
	await expect(page.getByText(/^\+[\d.]+%$/).first()).toBeVisible();

	// summary renders only while the card is collapsed
	await page.getByRole('button', { name: 'Time Budget' }).click();
	await expect(page.getByText(/8h budget/)).toBeVisible();
});
