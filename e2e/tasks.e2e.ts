import { expect, test } from '@playwright/test';
import { AUTOSAVE_MS, addTask } from './helpers';

test('fresh profile shows the empty state', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('No tasks deployed yet')).toBeVisible();

	await expect(
		page.getByRole('link', {
			name: 'Today',
		}),
	).toBeVisible();
});

test('added task appears and survives a reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');

	// title also appears in the Bottleneck metric — scope to first match
	await expect(page.getByText('Boxing training').first()).toBeVisible();
	await expect(page.getByText('No tasks deployed yet')).not.toBeVisible();

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();
	await expect(page.getByText('Boxing training').first()).toBeVisible();
});

test('completing a task persists across reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');

	// Named, not the only one on the page: the task form carries a "must do today"
	// checkbox above the list, so a bare checkbox role is ambiguous.
	const checkbox = page.getByRole('checkbox', {
		name: 'Mark Write report complete',
	});

	await checkbox.check();
	await expect(checkbox).toBeChecked();

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(
		page.getByRole('checkbox', {
			name: 'Mark Write report complete',
		}),
	).toBeChecked();
});

test('removing a task restores the empty state', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Throwaway');
	await expect(page.getByText('Throwaway').first()).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Delete task',
		})
		.click();

	await expect(page.getByText('No tasks deployed yet')).toBeVisible();
});

/* The ✕ is one hover-revealed click next to the ✎ and takes the task's sliders and
   ⚡ logs with it, so the delete is immediate and the toast is the way back. */
test('a deleted task comes back from the undo toast', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Throwaway');
	await addTask(page, 'Keep me');

	// The row, not its title: the title is also in the toast that reports the delete.
	const row = page.getByRole('checkbox', {
		name: 'Mark Throwaway complete',
	});

	await page
		.locator('li')
		.filter({
			hasText: 'Throwaway',
		})
		.getByRole('button', {
			name: 'Delete task',
		})
		.click();

	await expect(row).toHaveCount(0);
	await expect(page.getByText('Deleted “Throwaway”.')).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Undo',
		})
		.click();

	await expect(row).toBeVisible();
	await expect(page.getByText('Keep me').first()).toBeVisible();

	// The restored task has to survive the autosave that follows it — the removal was
	// already persisted by the time the undo ran.
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(row).toBeVisible();
});
