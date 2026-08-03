import { expect, test } from '@playwright/test';
import { addTask, AUTOSAVE_MS, budgetField, isoDate, setBudget } from './helpers';

test('setting the time budget feeds the plan', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');

	// budget defaults to 0 so the card starts open
	await setBudget(page, 8);

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

/* The budget has a slider so the day can be explored by dragging it. The whole
   plan is one `$derived`, so each step re-solves it — which is the thing only an
   e2e can see: the store and the allocator have to be in the loop, and the drag
   commits nothing but the value the field already holds. */
test('the budget slider re-solves the plan live', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);

	const allocated = page.getByText(/^Allocated: /);
	await expect(allocated).not.toHaveText('Allocated: 0.00h');

	// No blur: the plan follows the drag itself, and the field is the same value.
	await page.getByLabel('Budget hours').fill('0');

	await expect(budgetField(page)).toHaveValue('0');
	await expect(allocated).toHaveText('Allocated: 0.00h');
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

		await expect(budgetField(page)).toBeHidden();
	});
});

/* The bar opens itself while the viewed day's hours are unset, so the input that
   fixes that is never hidden behind a disclosure. That has to track the day on
   screen: it used to be a snapshot of whichever day the tab booted on, which
   outlived every date change for the life of the session. */
test('the bar follows the day on screen, not the day the tab booted on', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);
	await page.waitForTimeout(AUTOSAVE_MS);

	// Boot on a day with no session at all: hours unset, so the bar opens itself.
	await page.goto(`/?date=${isoDate(1)}`);
	await expect(budgetField(page)).toHaveValue('0');

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
