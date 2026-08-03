import { expect, test, type Page } from '@playwright/test';
import { addTask, AUTOSAVE_MS, setBudget } from './helpers';

/* The ⚡ flow log is the only user input that feeds fitUserConstants, so it is the
   one place where editing a task changes the model rather than just the row. Both
   the badge (stamped on the task, saved with the session) and the fit (its own
   object store) have to come back after a reload. */

async function logFlow(page: Page, minutes: number) {
	await page
		.getByRole('button', {
			name: 'Log time to flow',
		})
		.click();

	await page.getByPlaceholder('min').fill(String(minutes));

	await page
		.getByRole('button', {
			name: '✓',
		})
		.click();
}

test('logging time-to-flow badges the task and personalizes the model', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await expect(page.getByText(/Model uses default constants/)).toBeVisible();

	await logFlow(page, 90);

	await expect(page.getByText('⚡ 90m').first()).toBeVisible();
	await expect(page.getByText(/Model personalized from 1 time-to-flow log/)).toBeVisible();

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(page.getByText('⚡ 90m').first()).toBeVisible();
	await expect(page.getByText(/Model personalized from 1 time-to-flow log/)).toBeVisible();
});

/* The ⚡ button is hover-revealed and the prompt for it sat behind the collapsed
   Time Budget disclosure, so the measurement that personalizes the model was
   reachable only by accident. Completing a task is when the user still knows the
   answer — so the whole path from "nothing logged" to a personalized fit has to
   work without ever pressing ⚡. */
test('completing a task asks for its time-to-flow', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');

	// The bar opens itself while the day's hours are unset — collapse it, so the
	// prompt is proving itself and not `isOpen`.
	await setBudget(page, 6);

	await page
		.getByRole('button', {
			name: /Time Budget/,
		})
		.click();

	await expect(page.getByText(/Model uses default constants/)).toBeVisible();

	await page
		.getByRole('checkbox', {
			name: 'Mark Boxing training complete',
		})
		.check();

	await page.getByPlaceholder('min').fill('40');

	await page
		.getByRole('button', {
			name: '✓',
		})
		.click();

	await expect(page.getByText('⚡ 40m').first()).toBeVisible();

	// The prompt has done its job and gets out of the way — a healthy fit is
	// reassurance, so it stays inside the disclosure with the logs.
	await expect(page.getByText(/Model uses default constants/)).toHaveCount(0);

	await page
		.getByRole('button', {
			name: /Time Budget/,
		})
		.click();

	await expect(page.getByText(/Model personalized from 1 time-to-flow log/)).toBeVisible();
});

// The constants are always derived from the logs, never stored — so deleting the
// logs is the only reset, and it has to take the badge with it.
test('resetting personalization reverts to the default constants', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await logFlow(page, 90);
	await expect(page.getByText(/Model personalized from 1/)).toBeVisible();

	// The log list is collapsed until its status line is clicked.
	await page
		.getByRole('button', {
			name: /Model personalized from 1/,
		})
		.click();

	await page
		.getByRole('button', {
			name: 'Reset personalization',
		})
		.click();

	await page
		.getByRole('button', {
			name: 'Reset',
			exact: true,
		})
		.click();

	await expect(page.getByText(/Model uses default constants/)).toBeVisible();
	await expect(page.getByText('⚡ 90m')).toHaveCount(0);
});

test('a single flow log is deletable from the list', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await logFlow(page, 90);

	await page
		.getByRole('button', {
			name: /Model personalized from 1/,
		})
		.click();

	await page
		.getByRole('button', {
			name: 'Delete this flow log',
		})
		.click();

	await expect(page.getByText(/Model uses default constants/)).toBeVisible();
});

/* Re-tuning a task after it is added is a different path from creating one: the
   editor seeds its draft from the task, and the new values have to reach both the
   allocator's inputs and the persisted session. */
test('editing a task rewrites its inputs and survives a reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await expect(page.getByText('P 5 · M 5 · E 5')).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Edit task',
		})
		.click();

	// The add-task form carries the same slider labels, so scope to the editor —
	// which is the only form with a "Title" field.
	const editor = page.locator('form').filter({
		has: page.getByLabel('Title'),
	});

	await editor.getByLabel('Title').fill('Boxing sparring');
	// Range inputs take keyboard steps; fill() refuses them.
	await editor.getByLabel('Mental Diff').press('ArrowRight');

	await editor
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	await expect(page.getByText('Boxing sparring').first()).toBeVisible();
	await expect(page.getByText('P 5 · M 6 · E 5')).toBeVisible();

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(page.getByText('Boxing sparring').first()).toBeVisible();
	await expect(page.getByText('P 5 · M 6 · E 5')).toBeVisible();
});
