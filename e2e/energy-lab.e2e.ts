import { expect, test, type Page } from '@playwright/test';
import { AUTOSAVE_MS, addTask, logDrain, openTimeBudget } from './helpers';

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

// The window field is the one thing standing between a fresh profile and a plan,
// and it is a card away on a desktop and three on a phone. The prompt in the
// empty plan card is the only thing pointing at it, so it has to go there.
test('the empty plan card sends you to the day window', async ({ page }) => {
	await page.goto('/energy');
	await addTask(page, 'Deep work');

	// The plan card carries no work/free summary and no chart/schedule switch yet:
	// both read a plan that does not exist.
	await expect(page.getByText('0m work · 0m free')).toHaveCount(0);

	await expect(
		page.getByRole('button', {
			name: 'Chart',
		}),
	).toHaveCount(0);

	await page
		.getByRole('button', {
			name: 'Set a day window above 0 hours.',
		})
		.click();

	await expect(page.getByLabel('Day window')).toBeFocused();
});

// The card invites you to drag a slider and watch the schedule re-optimize, so
// each row has to say what the plan gave it. A task funded zero is the reading
// the timeline above cannot show at all — it simply has no block there.
test('every task row reports the hours the plan gave it', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await addTask(page, 'Boxing');
	await addTask(page, 'Inbox');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	// One hour is one 45-minute block: room for exactly one of the three.
	await page.getByLabel('Day window').fill('1');
	await page.getByLabel('Day window').blur();

	await expect(page.getByText('45m').first()).toBeVisible();
	await expect(page.getByText('no hours')).toHaveCount(2);
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

	// It reached the session, not just the Lab's own view of it. The bar collapses
	// itself on a day that has hours, so open it to read the field.
	await page.goto('/');
	await openTimeBudget(page, /5h budget/);
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
	await openTimeBudget(page, /6\.5h budget/);
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
	await expect(page.getByText('Drain ratings · 1')).toBeVisible();

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

/* 🪫 rates the session that just ended, and finishing the task is the commonest
   way one ends — so the form opens itself there, and the button survives
   completion (the sliders beside it do not). Before this, completing a task
   removed the only way to rate it. */
test('completing a task opens its drain rating', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await page
		.getByRole('checkbox', {
			name: 'Mark Deep work complete',
		})
		.check();

	const form = page.locator('form').filter({
		hasText: 'After the session',
	});

	await expect(form).toBeVisible();

	// The completed look must not reach it: dimming the row faded the one control
	// that only exists for a finished session into looking disabled. Asserted on the
	// ROW, not the form — `opacity` does not inherit, so a child of an `opacity-50`
	// ancestor still computes 1 and an assertion on the form itself cannot fail.
	await expect(form.locator('xpath=ancestor::li[1]')).toHaveCSS('opacity', '1');

	const fields = form.locator('input[type="number"]');
	await fields.nth(0).fill('90');
	await fields.nth(1).fill('8');
	await fields.nth(2).fill('4');

	await form
		.getByRole('button', {
			name: '✓',
		})
		.click();

	await expect(page.getByText('Drain ratings · 1')).toBeVisible();

	// The completed row keeps its 🪫 button, so the rating stays editable
	await expect(
		page.getByRole('button', {
			name: 'Log end-of-session drain',
		}),
	).toBeAttached();
});

// Checking a task off is one click, so mis-clicking it is one click too.
test('un-completing a task withdraws its drain prompt', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	const checkbox = page.getByRole('checkbox', {
		name: 'Mark Deep work complete',
	});

	const form = page.locator('form').filter({
		hasText: 'After the session',
	});

	await checkbox.check();
	await expect(form).toBeVisible();

	await checkbox.uncheck();
	await expect(form).toHaveCount(0);
});

/* The draft is page-level, one editor at a time, so the prompt must yield to any
   open one — including another task's. Completing B used to replace A's draft and
   silently destroy a rating being typed into it. */
test('a rating being typed survives another task being completed', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await addTask(page, 'Gym session');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	// Hand-open Deep work's rating and half-fill it. Named by its row, not `.first()`
	// — `addTask` prepends, so the first 🪫 belongs to Gym session, the task this test
	// then completes, and the cross-task invariant would go untested.
	await page
		.locator('li')
		.filter({
			hasText: 'Deep work',
		})
		.getByRole('button', {
			name: 'Log end-of-session drain',
		})
		.click();

	const form = page.locator('form').filter({
		hasText: 'After the session',
	});

	const worked = form.locator('input[type="number"]').first();

	// The 🪫 button asked for the editor, so it gets the caret
	await expect(worked).toBeFocused();
	await worked.fill('45');

	await page
		.getByRole('checkbox', {
			name: 'Mark Gym session complete',
		})
		.check();

	await expect(form).toHaveCount(1);
	await expect(worked).toHaveValue('45');

	// …and un-completing Gym must not close an editor that was never its prompt
	await page
		.getByRole('checkbox', {
			name: 'Mark Gym session complete',
		})
		.uncheck();

	await expect(worked).toHaveValue('45');
});

// A prompt nobody asked for must not take the caret out of the task list, and an
// empty rating is not a rating of 0 — recording one would bias the α fit.
test('the drain prompt takes no focus and refuses an empty rating', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	const checkbox = page.getByRole('checkbox', {
		name: 'Mark Deep work complete',
	});

	await checkbox.check();

	const form = page.locator('form').filter({
		hasText: 'After the session',
	});

	// Asserted as "the checkbox still has it": `not.toBeFocused()` on the input would
	// also pass if a regression stole the caret one tick later.
	await expect(checkbox).toBeFocused();

	// Minutes alone is not a measurement: Mind and Body are still empty
	await form.locator('input[type="number"]').first().fill('90');

	await form
		.getByRole('button', {
			name: '✓',
		})
		.click();

	await expect(form).toBeVisible();
	await expect(page.getByText('Drain ratings · 1')).toHaveCount(0);
});

/* The draft is page-level and is the whole gate on the prompt, so one left pointing
   at a row that is gone would suppress the prompt for every task, with no form left
   on screen to close. Tick-then-✕ is two adjacent clicks; the midnight rollover and
   the visibility re-read get there without any click at all. */
test('deleting a task takes its open drain prompt with it', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await addTask(page, 'Gym session');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	const form = page.locator('form').filter({
		hasText: 'After the session',
	});

	await page
		.getByRole('checkbox', {
			name: 'Mark Deep work complete',
		})
		.check();

	await expect(form).toHaveCount(1);

	await page
		.locator('li')
		.filter({
			hasText: 'Deep work',
		})
		.getByRole('button', {
			name: 'Delete task',
		})
		.click();

	await expect(form).toHaveCount(0);

	// The prompt still works for what is left — this is what an orphaned draft killed
	await page
		.getByRole('checkbox', {
			name: 'Mark Gym session complete',
		})
		.check();

	await expect(form).toHaveCount(1);
});

// The ☕ editor is only ever opened by its own button, so it always takes the caret
test('the rest editor focuses when opened', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await page
		.getByRole('button', {
			name: 'Log a rest',
		})
		.click();

	const form = page.locator('form').filter({
		hasText: 'rested',
	});

	await expect(form.locator('input[type="number"]').first()).toBeFocused();
});

// The pair is read as a difference, so a missing half is not a zero half — but a
// real 0 is a legitimate rating, which is what separates emptiness from falsiness.
test('the rest editor refuses a half-filled pair but accepts a rating of 0', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await page
		.getByRole('button', {
			name: 'Log a rest',
		})
		.click();

	const form = page.locator('form').filter({
		hasText: 'rested',
	});

	const fields = form.locator('input[type="number"]');

	const save = form.getByRole('button', {
		name: '✓',
	});

	// Everything but Body after. Drain falls across the break, as a rest pair must
	// for MATH.md §8.9 to fit an r ≥ 0 from it.
	for (const [index, value] of [30, 8, 7, 3].entries()) {
		await fields.nth(index).fill(String(value));
	}

	await save.click();

	await expect(form).toBeVisible();
	await expect(page.getByText('Rest pairs · 1')).toHaveCount(0);

	await fields.nth(4).fill('0');
	await save.click();

	await expect(page.getByText('Rest pairs · 1')).toBeVisible();
});

// Both logs live in EnergyObservationStore now, which reads IndexedDB on its
// own mount — so a reload is what proves that read is wired up.
test('drain and rest logs survive a reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 5);
	await expect(page.getByText('Drain ratings · 1')).toBeVisible();

	await logRest(page, 30, 9, 8, 3, 2);
	await expect(page.getByText('Rest pairs · 1')).toBeVisible();

	await page.reload();

	await expect(page.getByText('Drain ratings · 1')).toBeVisible();
	await expect(page.getByText('Rest pairs · 1')).toBeVisible();

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
			name: 'Drain ratings · 1',
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
