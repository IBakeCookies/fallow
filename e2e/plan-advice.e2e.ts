import { expect, test, type Page } from '@playwright/test';

/* The advice card is the one place the app says what to CHANGE rather than what
   the day reads. Every option it shows is a full re-solve of the day (MATH.md
   §14), which is why it is a button and not a live number — so the flow under
   test is: nothing until asked, then priced options, then stale once the day
   moves. */

/* Two hard, joyless tasks against more hours than the plan wants: burnout risk
   lands in the critical band and trimming the unspendable hours fixes it for
   free, which is the advice worth proving end to end. */
async function addDrainingTask(page: Page, title: string, mustDoToday = false) {
	const form = page.locator('form').filter({
		has: page.getByPlaceholder('e.g., Boxing training'),
	});

	await form.getByPlaceholder('e.g., Boxing training').fill(title);
	await form.getByLabel(/Mental Diff/).fill('10');
	await form.getByLabel(/Physical Diff/).fill('2');
	await form.getByLabel(/Enjoyment/).fill('1');

	if (mustDoToday) await form.getByLabel('Must do today').check();

	await form
		.getByRole('button', {
			name: 'Deploy Task',
		})
		.click();
}

test('advice prices real adjustments and goes stale when the day changes', async ({ page }) => {
	await page.goto('/');
	await addDrainingTask(page, 'Write the spec');
	await addDrainingTask(page, 'Migrate the database');

	await page.getByLabel('Available Hours').fill('10');
	await page.getByLabel('Available Hours').blur();

	// Nothing is computed until the user asks for it.
	await expect(page.getByText('Adjust the plan')).toBeVisible();
	await expect(page.getByText(/plan value/)).toBeHidden();

	await page
		.getByRole('button', {
			name: 'Check my day',
		})
		.click();

	// A lever with the reading it produces and its price: an improvement shown
	// without its cost is the advice this feature exists to avoid.
	await expect(
		page.getByText(/Set the budget to [\d.]+h|Move “.+” off today/).first(),
	).toBeVisible();

	await expect(page.getByText(/plan value/).first()).toBeVisible();

	// Editing the day must not silently leave the last solve's numbers on screen.
	await page.getByLabel('Available Hours').fill('6');
	await page.getByLabel('Available Hours').blur();

	await expect(page.getByText('Your day has changed since this was calculated.')).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Recheck',
		})
		.click();

	await expect(page.getByText('Your day has changed since this was calculated.')).toBeHidden();
});

// The flag is the only thing the model knows about obligation (MATH.md §14), so
// what it has to buy the user is silence about that particular task.
test('a task that must happen today is never offered as a deferral', async ({ page }) => {
	await page.goto('/');
	await addDrainingTask(page, 'Tax return', true);
	await addDrainingTask(page, 'Migrate the database');

	// Exact: the form's "Must do today" label is a substring match otherwise.
	await expect(
		page.getByText('Must do', {
			exact: true,
		}),
	).toBeVisible();

	await page.getByLabel('Available Hours').fill('10');
	await page.getByLabel('Available Hours').blur();

	await page
		.getByRole('button', {
			name: 'Check my day',
		})
		.click();

	await expect(page.getByText(/plan value/).first()).toBeVisible();
	await expect(page.getByText('Move “Tax return” off today')).toBeHidden();
});

test('the advice card stays out of the way on a past day', async ({ page }) => {
	await page.goto('/');
	await addDrainingTask(page, 'Write the spec');

	await expect(page.getByText('Adjust the plan')).toBeVisible();

	// Past days are read-only, so there is nothing to adjust.
	await page.goto('/?date=2026-01-02');

	await expect(page.getByText('Adjust the plan')).toBeHidden();
});
