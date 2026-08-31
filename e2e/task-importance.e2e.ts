import { expect, test, type Page } from '@playwright/test';
import { AUTOSAVE_MS, closeTaskForm, openTaskForm, setBudget, taskRow } from './helpers';

/* Importance (ROADMAP item 23) is the one task field that changes nothing about the
   task and everything about the day: `v` scales the whole block menu, so it redivides
   the budget across tasks while leaving every per-task figure alone. The flow worth
   driving end to end is therefore the pair — a task gains hours and another loses
   them in the same re-solve. */

const IMPORTANCE_GROUP = 'Importance';

/* The two tasks the model test contests at the same 0.5h budget
   (`zenith.test.ts`, "funds the important task over the cheap one"): a hard joyless
   invoice against an easy enjoyable errand, which is exactly the ordering the plan
   gets wrong without a weight. */
const INVOICE = {
	title: 'Send the invoice',
	mental: '8',
	physical: '2',
	enjoyment: '3',
};

const ERRAND = {
	title: 'Tidy the desk',
	mental: '2',
	physical: '3',
	enjoyment: '9',
};

async function addTask(page: Page, task: typeof INVOICE, importance?: 'Low' | 'Normal' | 'High') {
	await openTaskForm(page);

	const form = page.locator('form').filter({
		has: page.getByPlaceholder('e.g., Boxing training'),
	});

	await form.getByPlaceholder('e.g., Boxing training').fill(task.title);
	await form.getByLabel(/Mental Diff/).fill(task.mental);
	await form.getByLabel(/Physical Diff/).fill(task.physical);
	await form.getByLabel(/Enjoyment/).fill(task.enjoyment);

	if (importance)
		await form
			.getByRole('group', {
				name: IMPORTANCE_GROUP,
			})
			.getByRole('radio', {
				name: importance,
				exact: true,
			})
			.check();

	await form
		.getByRole('button', {
			name: 'Deploy Task',
		})
		.click();

	await closeTaskForm(page);
}

/** The row's `Planned` cell — index 10 of `getTaskColumns()`, and NOT the last cell:
 *  `Actions` (the ✎/✕ strip) is. Indexed the way `expectTaskInputs` indexes the three
 *  ratings, because the column list is one definition and this reads off it. */
const plannedHours = (page: Page, title: string) => taskRow(page, title).getByRole('cell').nth(10);

test('a task deployed at high importance is badged as one', async ({ page }) => {
	await page.goto('/');
	await addTask(page, INVOICE, 'High');

	await expect(taskRow(page, INVOICE.title).getByText('High importance')).toBeVisible();
});

test('importance survives a reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, INVOICE, 'High');

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(taskRow(page, INVOICE.title).getByText('High importance')).toBeVisible();
});

/* Both halves of the same re-solve, in one test because the second Then is a
   statement about the state the first leaves behind: on a budget this tight the day
   funds one task or the other, so the hours the invoice gains are the errand's. */
test('a tight day funds the important task, and the cheap one loses the hours', async ({
	page,
}) => {
	await page.goto('/');
	await addTask(page, INVOICE);
	await addTask(page, ERRAND);
	await setBudget(page, 0.5);

	// Unweighted, the plan buys the cheap task: higher average productivity per hour.
	await expect(plannedHours(page, ERRAND.title)).not.toHaveText('0m');
	await expect(plannedHours(page, INVOICE.title)).toHaveText('0m');

	await taskRow(page, INVOICE.title)
		.getByRole('button', {
			name: 'Edit task',
		})
		.click();

	await taskRow(page, INVOICE.title)
		.getByRole('group', {
			name: IMPORTANCE_GROUP,
		})
		.getByRole('radio', {
			name: 'High',
			exact: true,
		})
		.check();

	await taskRow(page, INVOICE.title)
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	await expect(plannedHours(page, INVOICE.title)).not.toHaveText('0m');
	await expect(plannedHours(page, ERRAND.title)).toHaveText('0m');
});
