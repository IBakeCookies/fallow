import { expect, test } from '@playwright/test';
import { AUTOSAVE_MS, addTask } from './helpers';

test('fresh profile shows the empty state', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('No tasks deployed yet')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Today' })).toBeVisible();
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

	const checkbox = page.getByRole('checkbox');
	await checkbox.check();
	await expect(checkbox).toBeChecked();

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();
	await expect(page.getByRole('checkbox')).toBeChecked();
});

test('removing a task restores the empty state', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Throwaway');
	await expect(page.getByText('Throwaway').first()).toBeVisible();

	await page.getByRole('button', { name: 'Delete task' }).click();
	await expect(page.getByText('No tasks deployed yet')).toBeVisible();
});
