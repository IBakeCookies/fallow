import { expect, test, type Page } from '@playwright/test';
import { AUTOSAVE_MS, addTask, logDrain } from './helpers';

/* The Energy Lab shares the daily session but owns its own params and
   measurements, so the flows worth covering here are the seams between them:
   what the Lab must see from the session, the day's hours it shares BOTH ways
   with the main page (settled 2026-07-29 — the Lab's params stay its own, the
   window does not), and the two measurement logs that live in
   EnergyObservationStore. */

// A stat tile renders as <p>value</p><p>label</p>, so the value is the label's
// preceding sibling — the only way to read one without a test id.
const statValue = (page: Page, label: string) =>
	page
		.getByText(label, {
			exact: true,
		})
		.locator('xpath=preceding-sibling::p[1]');

// Log a pre/post-rest pair (☕). Field order follows the form: duration, then
// mind/body before, then mind/body after.
async function logRest(
	page: Page,
	minutes: number,
	mindBefore: number,
	bodyBefore: number,
	mindAfter: number,
	bodyAfter: number,
) {
	await page
		.getByRole('button', {
			name: 'Log a rest',
		})
		.click();

	const form = page.locator('form').filter({
		hasText: 'rested',
	});

	const fields = form.locator('input[type="number"]');

	for (const [index, value] of [minutes, mindBefore, bodyBefore, mindAfter, bodyAfter].entries()) {
		await fields.nth(index).fill(String(value));
	}

	await form
		.getByRole('button', {
			name: '✓',
		})
		.click();
}

// The plan, the params and both calibration cards all sit behind a task, so an
// empty day shows the invitation instead — and the form there writes to the
// shared session like the main page's does.
test('an empty day offers the task form, and deploying one reveals the Lab', async ({ page }) => {
	await page.goto('/energy');
	await expect(page.getByText('No open tasks for today.')).toBeVisible();

	await addTask(page, 'Deep work');

	await expect(page.getByText('No open tasks for today.')).not.toBeVisible();
	await expect(page.getByLabel('Day window')).toBeVisible();

	// A fresh profile has no budget, and the window is that budget now — so the
	// Lab asks for it rather than planning an invented 8h day the main page does
	// not have (the old `|| 8` fallback). Setting it here is what starts the plan.
	await expect(page.getByLabel('Day window')).toHaveValue('0');
	await expect(page.getByText('Set a day window above 0 hours.')).toBeVisible();

	await page.getByLabel('Day window').fill('8');
	await page.getByLabel('Day window').blur();
	await expect(page.getByText('Set a day window above 0 hours.')).not.toBeVisible();
});

test('the Lab plans the task deployed on the main page', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.getByLabel('Available Hours').fill('8');
	await page.getByLabel('Available Hours').blur();
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/energy');

	// Same session store, so the task is here without re-entering it…
	await expect(page.getByText('Deep work').first()).toBeVisible();
	// …and the day window follows the budget it was given.
	await expect(page.getByLabel('Day window')).toHaveValue('8');
	// …and the optimizer actually funded it.
	await expect(statValue(page, 'Planned work')).toHaveText(/[1-9]/);

	// The comparison tile is the one reading switch cost and the pools reach, and
	// it says so on demand rather than in a `title` no touch device shows.
	await page.getByText('Output vs the classic plan, judged by this model').hover();

	await expect(
		page.getByText('It is the only reading here that uses your switch cost', {
			exact: false,
		}),
	).toBeVisible();
});

// Settled 2026-07-29: neither mode is the better one, so neither owns the day's
// hours. The window and Available Hours are one persisted value — the Lab's
// PARAMS stay its own, which the reload test below still pins.
test('the day window and the main page’s budget are one value', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.getByLabel('Available Hours').fill('8');
	await page.getByLabel('Available Hours').blur();
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/energy');
	await expect(page.getByLabel('Day window')).toHaveValue('8');

	await page.getByLabel('Day window').fill('5');
	await page.getByLabel('Day window').blur();
	await expect(statValue(page, 'Planned work')).toBeVisible();
	await page.waitForTimeout(AUTOSAVE_MS);

	// It reached the session, not just the Lab's own view of it.
	await page.goto('/');
	await expect(page.getByLabel('Available Hours')).toHaveValue('5');
});

// One value edited by two steppers, so they must agree on its granularity: the
// number input rounds to its own step's decimals, so a coarser step here would
// round a quarter-hour day set on the main page (6.25 → 6.75 → "6.8") and write
// that back. Neither page can afford to mangle the other's number.
test('the window stepper moves the shared budget in the main page’s increments', async ({
	page,
}) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.getByLabel('Available Hours').fill('6.25');
	await page.getByLabel('Available Hours').blur();
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/energy');
	await expect(page.getByLabel('Day window')).toHaveValue('6.25');

	// The steppers flank the input, so its grandparent is the one control.
	await page
		.locator('#window-hours')
		.locator('xpath=../..')
		.getByRole('button', {
			name: 'Increase',
		})
		.click();

	await expect(page.getByLabel('Day window')).toHaveValue('6.5');
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/');
	await expect(page.getByLabel('Available Hours')).toHaveValue('6.5');
});

// The session store's date reader belongs to the (app) layout and is route-blind,
// so `?date=` reached the Lab too — loading another day's tasks with live sliders
// under copy that promises today's session, while 🪫 logs still stamp today.
test('a dated URL collapses to the canonical Lab', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.getByLabel('Available Hours').fill('8');
	await page.getByLabel('Available Hours').blur();
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/energy?date=2026-01-15');

	await expect(page).toHaveURL(/\/energy$/);
	// Today's task is what the Lab plans — the dated day has none at all.
	await expect(page.getByText('Deep work').first()).toBeVisible();
});

// AGENTS.md §3: "A fit never writes params silently." The whole point of the
// Apply button is that the sliders stay the user's until it is pressed.
test('a drain rating fits α but only applies on demand', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	const cognitiveDrain = page.getByLabel('Cognitive drain');
	const defaultDrain = await cognitiveDrain.inputValue();

	await logDrain(page, 120, 9, 5);
	await expect(page.getByText('1 drain ratings recorded')).toBeVisible();

	// The fit ran — but the parameter is untouched.
	const apply = page.getByRole('button', {
		name: 'Apply fitted rates',
	});

	await expect(apply).toBeEnabled();
	await expect(cognitiveDrain).toHaveValue(defaultDrain);

	await apply.click();
	await expect(cognitiveDrain).not.toHaveValue(defaultDrain);
	await expect(page.getByText('Fitted rates applied')).toBeVisible();
});

// Both logs live in EnergyObservationStore now, which reads IndexedDB on its
// own mount — so a reload is what proves that read is wired up.
test('drain and rest logs survive a reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 5);
	await expect(page.getByText('1 drain ratings recorded')).toBeVisible();

	await logRest(page, 30, 9, 8, 3, 2);
	await expect(page.getByText('1 rest pairs recorded')).toBeVisible();

	await page.reload();

	await expect(page.getByText('1 drain ratings recorded')).toBeVisible();
	await expect(page.getByText('1 rest pairs recorded')).toBeVisible();

	// A rest pair identifies the recovery rate on its own (MATH.md §8.9), so its
	// own Apply appears alongside the drain one.
	await expect(
		page.getByRole('button', {
			name: 'Apply fitted rate',
			exact: true,
		}),
	).toBeEnabled();
});

// The params are model inputs, so R4 puts them in IndexedDB rather than
// localStorage — and the write is debounced, which is where they used to be lost.
test('a changed parameter survives a reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work'); // the params panel sits behind a task
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await page.getByLabel('Physical drain').fill('0.75');
	await page.getByLabel('Physical drain').blur();
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.reload();

	await expect(page.getByLabel('Physical drain')).toHaveValue('0.75');
});

// Deleting the last rating must take the calibration back to the defaults, not
// leave a stale fit applied to the params.
test('deleting the drain rating clears the calibration', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 5);

	// The log list is collapsed until its count is clicked.
	await page
		.getByRole('button', {
			name: '1 drain ratings recorded',
		})
		.click();

	await page
		.getByRole('button', {
			name: 'Delete this drain rating',
		})
		.click();

	// The card falls back to its empty state, and with nothing left to fit the
	// Apply button is gone rather than disabled.
	await expect(page.getByText(/No ratings yet\./)).toBeVisible();

	await expect(
		page.getByRole('button', {
			name: 'Apply fitted rates',
		}),
	).toHaveCount(0);
});
