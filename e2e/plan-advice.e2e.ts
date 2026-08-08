import { expect, test, type Page } from '@playwright/test';
import { AUTOSAVE_MS, budgetField, isoDate, setBudget } from './helpers';

/* The advice card is the one place the app says what to CHANGE rather than what
   the day reads. Every option it shows is a full re-solve of the day (MATH.md
   §14), which is why it is a button and not a live number — so the flow under
   test is: nothing until asked, then priced options, then stale once the day
   moves. */

/* Two hard, joyless tasks against more hours than the plan wants: burnout risk
   lands in the critical band and trimming the unspendable hours fixes it at
   little or no cost, which is the advice worth proving end to end. (Not "for
   free" — on a pool-bound day the trim re-solves the same hours into a worse
   arrangement, MATH.md §14.1-2.) */
async function addDrainingTask(page: Page, title: string, mustDoToday = false) {
	const form = page.locator('form').filter({
		has: page.getByPlaceholder('e.g., Boxing training'),
	});

	await form.getByPlaceholder('e.g., Boxing training').fill(title);
	await form.getByLabel(/Mental Diff/).fill('10');
	await form.getByLabel(/Physical Diff/).fill('2');
	await form.getByLabel(/Enjoyment/).fill('1');

	if (mustDoToday) await form.getByLabel("Don't move off today").check();

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

	await setBudget(page, 10);

	// Nothing is computed until the user asks for it — and until then the feature
	// is one button, not a card with a heading advertising an empty panel.
	await expect(
		page.getByRole('button', {
			name: 'Check my day',
		}),
	).toBeVisible();

	await expect(page.getByText('Adjust the plan')).toBeHidden();
	await expect(page.getByText(/plan value/)).toBeHidden();

	await page
		.getByRole('button', {
			name: 'Check my day',
		})
		.click();

	await expect(page.getByText('Adjust the plan')).toBeVisible();

	// A lever with the reading it produces and its price: an improvement shown
	// without its cost is the advice this feature exists to avoid.
	await expect(
		page.getByText(/Set the budget to [\d.]+h|Move “.+” off today/).first(),
	).toBeVisible();

	await expect(page.getByText(/plan value/).first()).toBeVisible();

	// The budget's shadow price, from a real solve (MATH.md §14.2): either the
	// next block goes somewhere, or the budget is not what limits this day.
	await expect(
		page.getByText(/The next \d+ minutes would go to “.+”|would get nothing more done/),
	).toBeVisible();

	// The declared switch cost, priced by two more real solves (MATH.md §14.3):
	// either this plan reserves hours for switching, or it pays for none.
	await expect(
		page.getByText(/Switching reserves .+ of today|pays for no switching/),
	).toBeVisible();

	// Editing the day must not silently leave the last solve's numbers on screen.
	await setBudget(page, 6);

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

	// Exact: the badge says the day is fixed, not that hours are reserved — the
	// card's unfunded line carries the same words in a sentence.
	await expect(
		page.getByText('Stays today', {
			exact: true,
		}),
	).toBeVisible();

	await setBudget(page, 10);

	await page
		.getByRole('button', {
			name: 'Check my day',
		})
		.click();

	await expect(page.getByText(/plan value/).first()).toBeVisible();
	await expect(page.getByText('Move “Tax return” off today')).toBeHidden();
});

// The one advice the card can perform itself (MATH.md §14 / AGENTS.md §6):
// the button names the task it moves, so the test reads it back rather than
// assuming which lever survives the frontier.
test('applying a deferral moves the task to tomorrow’s plan', async ({ page }) => {
	await page.goto('/');
	await addDrainingTask(page, 'Write the spec');
	await addDrainingTask(page, 'Migrate the database');
	await addDrainingTask(page, 'Refactor the auth flow');

	// Tight on purpose: with slack in the budget, the trim lever costs so much
	// less than any deferral that it dominates every axis and no defer survives
	// the frontier.
	await setBudget(page, 4);

	await page
		.getByRole('button', {
			name: 'Check my day',
		})
		.click();

	const apply = page
		.getByRole('button', {
			name: /Move “.+” to tomorrow/,
		})
		.first();

	await expect(apply).toBeVisible();
	const title = (await apply.getAttribute('aria-label'))!.match(/“(.+)”/)![1];

	await apply.click();

	// Gone from today…
	await expect(
		page.getByRole('checkbox', {
			name: `Mark ${title} complete`,
		}),
	).toBeHidden();

	// …and the removal is a debounced autosave; let it land before navigating.
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto(`/?date=${isoDate(1)}`);

	await expect(
		page.getByRole('checkbox', {
			name: `Mark ${title} complete`,
		}),
	).toBeVisible();
});

/* The other performable lever (MATH.md §14 rules the budget a choice about the
   day, which is why it is a lever at all where the switch cost is only a
   diagnostic). What the button buys over retyping the label: the trim lever is
   `budget − planSlack` and carries UNROUNDED hours, so a user copying the two
   decimals the card prints lands on a budget the model never priced. */
test('applying a budget lever declares the hours the model priced', async ({ page }) => {
	await page.goto('/');
	await addDrainingTask(page, 'Write the spec');
	await addDrainingTask(page, 'Migrate the database');

	// More hours than this plan wants, so the slack the trim lever spends exists.
	await setBudget(page, 10);

	await page
		.getByRole('button', {
			name: 'Check my day',
		})
		.click();

	// Read the lever off the card rather than assuming which one survives the
	// frontier — the label carries the same rounding the button must not.
	const action = page.getByText(/Set the budget to [\d.]+h/).first();
	await expect(action).toBeVisible();
	const labelled = Number((await action.textContent())!.match(/([\d.]+)h/)![1]);

	// `.first()`: the same trim lever wins on more than one axis, so the card draws
	// the same button per row it improves. Identical words for an identical
	// declaration, unlike two deferrals, which name their own task.
	await page
		.getByRole('button', {
			name: `Set ${labelled}h`,
		})
		.first()
		.click();

	const applied = Number(await budgetField(page).inputValue());

	expect(applied).not.toBe(10);
	// The field took the lever's own hours: equal to the label once rounded the way
	// the label rounds, and free to carry more decimals than it showed.
	expect(Math.round(applied * 100) / 100).toBe(labelled);

	// A declaration the day now reads from, so the last solve's numbers are stale.
	await expect(page.getByText('Your day has changed since this was calculated.')).toBeVisible();
});

test('the advice card stays out of the way on a past day', async ({ page }) => {
	await page.goto('/');
	await addDrainingTask(page, 'Write the spec');

	const check = page.getByRole('button', {
		name: 'Check my day',
	});

	await expect(check).toBeVisible();

	// Past days are read-only, so there is nothing to adjust.
	await page.goto('/?date=2026-01-02');

	await expect(check).toBeHidden();
});
