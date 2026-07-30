import { expect, test } from '@playwright/test';
import { addTask, AUTOSAVE_MS, isoDate } from './helpers';

test('setting the time budget feeds the plan', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');

	// budget defaults to 0 so the card starts open
	await page.getByLabel('Available Hours').fill('8');
	await page.getByLabel('Available Hours').blur();

	// metrics leave N/A once tasks + budget exist: Zenith Gain shows +X%
	await expect(page.getByText(/^\+[\d.]+%$/).first()).toBeVisible();

	// summary renders only while the card is collapsed
	await page
		.getByRole('button', {
			name: 'Time Budget',
		})
		.click();

	await expect(page.getByText(/8h budget/)).toBeVisible();
});

/* The session lives in client-side IndexedDB, so the server cannot know whether
   the day has hours — and must not guess. Guessing "unset" opened the panel in
   the SSR'd HTML for every visitor, including one whose day is set, who then
   watched it collapse once the read landed. */
test.describe('server-rendered, before the day is read', () => {
	test.use({
		javaScriptEnabled: false,
	});

	test('the time budget bar is collapsed', async ({ page }) => {
		await page.goto('/');

		await expect(
			page.getByRole('button', {
				name: 'Time Budget',
			}),
		).toHaveAttribute('aria-expanded', 'false');

		await expect(page.getByLabel('Available Hours')).toBeHidden();
	});
});

/* The bar opens itself while the viewed day's hours are unset, so the input that
   fixes that is never hidden behind a disclosure. That has to track the day on
   screen: it used to be a snapshot of whichever day the tab booted on, which
   outlived every date change for the life of the session. */
test('the bar follows the day on screen, not the day the tab booted on', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.getByLabel('Available Hours').fill('8');
	await page.getByLabel('Available Hours').blur();
	await page.waitForTimeout(AUTOSAVE_MS);

	// Boot on a day with no session at all: hours unset, so the bar opens itself.
	await page.goto(`/?date=${isoDate(1)}`);
	await expect(page.getByLabel('Available Hours')).toHaveValue('0');

	// Today has 8h — the bar has nothing left to ask for, so it gets out of the way.
	await page
		.getByRole('button', {
			name: 'Return to Today',
		})
		.click();

	await expect(
		page.getByRole('button', {
			name: 'Time Budget',
		}),
	).toHaveAttribute('aria-expanded', 'false');
});
