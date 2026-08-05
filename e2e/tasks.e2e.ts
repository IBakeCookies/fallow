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

// ROADMAP items 15 and 24. Only an e2e covers the whole path this feature is: a
// stored day, the history read the store boots with, and the form that offers it
// back as you type.
test('a title picked from the suggestions brings its ratings with it', async ({ page }) => {
	await page.goto('/');

	// The task editor carries the same slider labels, so scope to the add form —
	// the only one with a "Task Definition" field.
	const form = page.locator('form').filter({
		has: page.getByLabel('Task Definition'),
	});

	await form.getByLabel('Task Definition').fill('Gym session');

	// Range inputs take keyboard steps; fill() refuses them.
	for (let step = 0; step < 3; step++) {
		await form.getByLabel('Physical Diff').press('ArrowRight');
		await form.getByLabel('Mental Diff').press('ArrowLeft');
		await form.getByLabel('Enjoyment').press('ArrowRight');
	}

	await form
		.getByRole('button', {
			name: 'Deploy Task',
		})
		.click();

	await expect(page.getByText('P 8 · M 2 · E 8')).toBeVisible();
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	// The form is still open: it samples `isOpen` once, at mount, and the stored
	// day has not landed yet at that point.
	await expect(page.getByText('Gym session').first()).toBeVisible();

	// Typed, not filled: the suggestions answer to input events, and two
	// characters of the wrong case are all it takes.
	await form.getByLabel('Task Definition').pressSequentially('GY');

	await form
		.getByRole('option', {
			name: 'Gym session',
		})
		.click();

	await expect(form.getByLabel('Task Definition')).toHaveValue('Gym session');
	await expect(form.getByLabel('Physical Diff')).toHaveValue('8');
	await expect(form.getByLabel('Mental Diff')).toHaveValue('2');
	await expect(form.getByLabel('Enjoyment')).toHaveValue('8');
});
