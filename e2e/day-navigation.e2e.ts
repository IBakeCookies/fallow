import { expect, test } from '@playwright/test';
import { isoDate } from './helpers';

test('past day is read-only with a banner', async ({ page }) => {
	await page.goto(`/?date=${isoDate(-3)}`);
	await expect(page.getByText('Viewing a past day:')).toBeVisible();
	await expect(page.getByPlaceholder('e.g., Boxing training')).not.toBeVisible();
	// nav label switches from "Today" to the viewed date
	await expect(page.getByRole('link', { name: 'Today', exact: true })).not.toBeVisible();
	await expect(page.getByRole('link', { name: /return to today/ })).toBeVisible();
});

test('future day shows the planning-ahead banner', async ({ page }) => {
	await page.goto(`/?date=${isoDate(3)}`);
	await expect(page.getByText('Planning ahead:')).toBeVisible();
	// planning is allowed: form stays available
	await expect(
		page.getByText('+ Add Task').or(page.getByPlaceholder('e.g., Boxing training'))
	).toBeVisible();
});

test('invalid date param falls back to today', async ({ page }) => {
	await page.goto('/?date=not-a-date');
	await expect(page.getByRole('link', { name: 'Today' })).toBeVisible();
	await expect(page.getByText('Viewing a past day:')).not.toBeVisible();
});

test('date param equal to today collapses to /', async ({ page }) => {
	await page.goto(`/?date=${isoDate(0)}`);
	await expect(page).toHaveURL('http://localhost:4173/');
});
