import { expect, test } from '@playwright/test';
import { AUTOSAVE_MS, addTask, isoDate } from './helpers';

/* The calendar reads a whole visible range out of IndexedDB and reloads on every
   view/anchor change, none of which happens during SSR. Its cells are also the
   only links that carry a ?date= back to the planner. */

test('an empty profile shows the hint, not a blank grid', async ({ page }) => {
	await page.goto('/calendar');

	await expect(
		page.getByRole('heading', {
			name: 'Calendar',
		}),
	).toBeVisible();

	await expect(page.getByText(/No data in this month yet/)).toBeVisible();
});

test('a planned day shows on the grid and links back to that day', async ({ page }) => {
	// A future day, so its cell href carries ?date= rather than collapsing to /.
	const planned = isoDate(2);
	await page.goto(`/?date=${planned}`);
	await addTask(page, 'Boxing training');
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/calendar');

	// The month grid is padded to whole weeks, which is not the same as showing the
	// next two days: on the last days of a month the planned day belongs to the next
	// one, and July 2026 stops at Aug 1. One step at most — `planned` is two days out.
	if (planned.slice(0, 7) !== isoDate(0).slice(0, 7))
		await page
			.getByRole('button', {
				name: 'Next',
			})
			.click();

	await expect(page.getByText(/No data in this month yet/)).not.toBeVisible();

	const cell = page.locator(`a[href$="?date=${planned}"]`);
	await expect(cell).toContainText('Boxing training');
	// Future days are plans: a count, and no completion bar to read yet.
	await expect(cell).toContainText('planned');

	await cell.click();
	await expect(page).toHaveURL(new RegExp(`\\?date=${planned}$`));
	await expect(page.getByText('Boxing training').first()).toBeVisible();
});

test('the week view reslices the same range', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/calendar');

	await page
		.getByRole('button', {
			name: 'week',
			exact: true,
		})
		.click();

	// Week cells carry the per-day detail the month cells drop.
	await expect(page.getByText('Nothing planned').first()).toBeVisible();

	await expect(
		page.getByRole('button', {
			name: 'Next week',
		}),
	).toBeVisible();
});

test('paging away from the seeded month empties the grid, and Today returns', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/calendar');
	await expect(page.getByText('Boxing training').first()).toBeVisible();

	// Two months back is unambiguously outside the seeded range, whatever day of
	// the month the test runs on.
	await page
		.getByRole('button', {
			name: 'Previous month',
		})
		.click();

	await page
		.getByRole('button', {
			name: 'Previous month',
		})
		.click();

	await expect(page.getByText(/No data in this month yet/)).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Today',
			exact: true,
		})
		.click();

	await expect(page.getByText('Boxing training').first()).toBeVisible();
});
