import { expect, test, type Page } from '@playwright/test';
import { AUTOSAVE_MS, addTask } from './helpers';

/* The Energy Lab reads the shared daily session but owns its own params and
   measurements, so the flows worth covering here are the seams between them:
   what the Lab must see from the session, what it must never write back, and
   the two measurement logs that live in EnergyObservationStore. */

// A stat tile renders as <p>value</p><p>label</p>, so the value is the label's
// preceding sibling — the only way to read one without a test id.
const statValue = (page: Page, label: string) =>
	page
		.getByText(label, {
			exact: true,
		})
		.locator('xpath=preceding-sibling::p[1]');

// Log an end-of-session drain rating (🪫) against the first task.
async function logDrain(page: Page, minutes: number, mind: number, body: number) {
	await page
		.getByRole('button', {
			name: 'Log end-of-session drain',
		})
		.first()
		.click();

	const form = page.locator('form').filter({
		hasText: 'After the session',
	});

	const fields = form.locator('input[type="number"]');
	await fields.nth(0).fill(String(minutes));
	await fields.nth(1).fill(String(mind));
	await fields.nth(2).fill(String(body));

	await form
		.getByRole('button', {
			name: '✓',
		})
		.click();
}

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
});

// AGENTS.md §3: "The Lab never writes to the daily session." Its params are its
// own; the main page's budget must not move when the Lab's window does.
test('editing the Lab’s day window leaves the session budget alone', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.getByLabel('Available Hours').fill('8');
	await page.getByLabel('Available Hours').blur();
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/energy');
	await page.getByLabel('Day window').fill('5');
	await page.getByLabel('Day window').blur();
	await expect(statValue(page, 'Planned work')).toBeVisible();
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/');
	await expect(page.getByLabel('Available Hours')).toHaveValue('8');
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
