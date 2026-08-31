import { expect, test } from '@playwright/test';
import { AUTOSAVE_MS, addTask, isoDate, saveRoutine, taskCard, taskRow } from './helpers';

/* Routines and day-imports are what the day's two menus exist for, and both cross
   a day boundary: what is saved on one date has to reappear on another, read back
   out of IndexedDB by a store that mounted on a different URL. */

const ROUTINE_NAME = 'Morning block';

test('the day’s Load and Save read on the Tasks card', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');

	const card = taskCard(page);

	await expect(
		card.getByRole('button', {
			name: 'Load',
			exact: true,
		}),
	).toBeVisible();

	await expect(
		card.getByRole('button', {
			name: 'Save',
			exact: true,
		}),
	).toBeVisible();

	// One of each on the page: the card is where they read now, not a second copy of
	// the pair the page header used to carry.
	await expect(
		page.getByRole('button', {
			name: 'Load',
			exact: true,
		}),
	).toHaveCount(1);
});

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
		.getByRole('menuitem', {
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

	// Two presses: the first only arms the delete, since it cannot be undone.
	await page
		.getByRole('menuitem', {
			name: `Delete routine ${ROUTINE_NAME}`,
		})
		.click();

	await page
		.getByRole('menuitem', {
			name: `Delete ${ROUTINE_NAME}?`,
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

/* Importance travels, and `mustDoToday` does not — the two sit beside each other in
   the same form, so which one a routine carries is the distinction worth proving.
   The level is a property of the task ("the invoice is always high"); the flag is a
   statement about today, and `sanitizeTask` drops it on purpose. */
test('a routine carries the importance its tasks were saved with', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Send the invoice');

	const row = taskRow(page, 'Send the invoice');

	await row
		.getByRole('button', {
			name: 'Edit task',
		})
		.click();

	await row
		.getByRole('group', {
			name: 'Importance',
		})
		.getByRole('radio', {
			name: 'High',
			exact: true,
		})
		.check();

	await row
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	await page.waitForTimeout(AUTOSAVE_MS);
	await saveRoutine(page, 'Invoice day');

	await page.goto(`/?date=${isoDate(3)}`);
	await expect(page.getByText('No tasks deployed yet')).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Load',
			exact: true,
		})
		.click();

	await page
		.getByRole('menuitem', {
			name: 'Invoice day (1)',
		})
		.click();

	await expect(taskRow(page, 'Send the invoice').getByText('High importance')).toBeVisible();
});
