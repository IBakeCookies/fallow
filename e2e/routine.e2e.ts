import { expect, test, type Page } from '@playwright/test';
import { AUTOSAVE_MS, addTask, isoDate } from './helpers';

/* Routines and day-imports are the header's whole reason to exist, and both cross
   a day boundary: what is saved on one date has to reappear on another, read back
   out of IndexedDB by a store that mounted on a different URL. */

const ROUTINE_NAME = 'Morning block';

async function saveRoutine(page: Page, name: string) {
	// Only one "Save" button exists until the menu opens; submitting with Enter
	// then avoids competing with the form's own submit button.
	await page
		.getByRole('button', {
			name: 'Save',
			exact: true,
		})
		.click();

	await page.getByPlaceholder('Routine name...').fill(name);
	await page.getByPlaceholder('Routine name...').press('Enter');
}

test('a routine saved today loads onto another day', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await addTask(page, 'Write report');
	await page.waitForTimeout(AUTOSAVE_MS);

	await saveRoutine(page, ROUTINE_NAME);

	await page.goto(`/?date=${isoDate(2)}`);
	await expect(page.getByText('No tasks deployed yet')).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Load',
			exact: true,
		})
		.click();

	await expect(page.getByText('Saved Routines')).toBeVisible();

	await page
		.getByRole('button', {
			name: `${ROUTINE_NAME} (2)`,
		})
		.click();

	await expect(page.getByText('Boxing training').first()).toBeVisible();
	await expect(page.getByText('Write report').first()).toBeVisible();
});

test('a routine is deletable and stops being offered', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await saveRoutine(page, ROUTINE_NAME);

	await page
		.getByRole('button', {
			name: 'Load',
			exact: true,
		})
		.click();

	await page
		.getByRole('button', {
			name: `Delete routine ${ROUTINE_NAME}`,
		})
		.click();

	await expect(page.getByText('Saved Routines')).not.toBeVisible();

	// The delete is persisted, not just dropped from the in-memory list.
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Load',
			exact: true,
		})
		.click();

	await expect(page.getByText('Saved Routines')).not.toBeVisible();
});

test('loading from a day copies that day’s tasks into the viewed day', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto(`/?date=${isoDate(2)}`);

	await page
		.getByRole('button', {
			name: 'Load',
			exact: true,
		})
		.click();

	await page.getByLabel('Load from a day').fill(isoDate(0));

	await expect(page.getByText('Boxing training').first()).toBeVisible();
});

// importFromDate returns 0 for a day with no session, and the menu has to say so
// rather than close as though it had imported something.
test('loading from a day with nothing on it reports the empty day', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto(`/?date=${isoDate(2)}`);

	await page
		.getByRole('button', {
			name: 'Load',
			exact: true,
		})
		.click();

	await page.getByLabel('Load from a day').fill(isoDate(-40));

	await expect(page.getByText('No tasks on that day')).toBeVisible();
});
