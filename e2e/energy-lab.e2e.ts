import { expect, test, type Page } from '@playwright/test';
import { addTask, AUTOSAVE_MS, budgetField, logDrain, openTimeBudget, setBudget } from './helpers';

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
	await expect(page.getByText('No tasks deployed yet')).toBeVisible();

	await addTask(page, 'Deep work');

	await expect(page.getByText('No tasks deployed yet')).not.toBeVisible();
	await expect(page.getByLabel('Day window')).toBeVisible();

	// The card is one instance across both states, so the form that took the first
	// task is still open and takes the second — it used to be replaced by a
	// collapsed one, leaving no field on screen to type into.
	await addTask(page, 'Boxing');
	await expect(page.getByText('Boxing').first()).toBeVisible();

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

/* The list reads in schedule order, but the sort is a snapshot per visit: a live one
   re-ranked the rows on every re-optimization, so the row being edited moved out from
   under the cursor as the plan moved off it. */
test('re-tuning a task re-plans the day without reordering the list', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await addTask(page, 'Boxing');
	await addTask(page, 'Inbox');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await page.getByLabel('Day window').fill('1');
	await page.getByLabel('Day window').blur();

	// Row order, read off the one label every row has — and only rows: the add-task
	// form's must-do box is a checkbox on this card too.
	const order = () =>
		page
			.getByRole('checkbox', {
				name: /^Mark /,
			})
			.evaluateAll((rows) => rows.map((r) => r.getAttribute('aria-label')));

	const before = await order();

	// The one row the hour went to, pinned by name so it stays the same row after
	// the plan moves off it.
	const rows = page.locator('li').filter({
		has: page.getByRole('checkbox'),
	});

	const fundedName = await rows
		.filter({
			hasNotText: 'no hours',
		})
		.getByRole('checkbox')
		.getAttribute('aria-label');

	const funded = rows.filter({
		has: page.getByRole('checkbox', {
			name: fundedName ?? '',
		}),
	});

	// Its difficulties maxed through the row's own ✎: the same hour now buys less of
	// this task than of either other, so the optimizer funds one of them instead.
	await funded
		.getByRole('button', {
			name: 'Edit task',
		})
		.click();

	const editor = funded.locator('form').filter({
		has: page.getByLabel('Title'),
	});

	// Range inputs take keyboard steps; fill() refuses them.
	await editor.getByRole('slider').nth(0).press('End');
	await editor.getByRole('slider').nth(1).press('End');

	await editor
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	// The plan moved off it…
	await expect(funded).toContainText('no hours');
	// …and the rows did not move at all.
	expect(await order()).toEqual(before);
});

test('the Lab plans the task deployed on the main page', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);
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
	await page.getByText('Day value vs the classic plan, judged by this model').hover();

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
	await setBudget(page, 8);
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
	await expect(budgetField(page)).toHaveValue('5');
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
	await setBudget(page, 6.25);
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
	await expect(budgetField(page)).toHaveValue('6.5');
});

/* The live stop advisor (MATH.md §8.11) is the one surface where today's 🪫
   logs meet the params mid-day, so this pins the page wiring end to end: a
   fresh day with hours to spare prices a session of the task by name, and
   logging hours that fill the window flips the verdict. */
test('the stop advisor prices the fresh day and flips when logged hours fill the window', async ({
	page,
}) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/energy');

	// Fresh morning at the default free-time value: continuing wins, and the
	// recommendation names the task it priced.
	await expect(page.getByText('Worth continuing')).toBeVisible();
	// "next session", not just a duration: the budget curve beside this card prices
	// the whole WINDOW, so a bare "2h 15m of Deep work" reads as a rival day total.
	await expect(page.getByText(/Your next session — .*of Deep work/)).toBeVisible();

	// 7h45m logged: no whole 45-min block fits an 8-hour window any more.
	await logDrain(page, 465, 5, 5);
	await expect(page.getByText(/No whole work session fits/)).toBeVisible();
	await expect(page.getByText('Worth continuing')).not.toBeVisible();
});

// The budget curve costs a solve per step, so it is a click and not a `$derived`
// (MATH.md §8.12). What e2e can see that the store spec cannot: the button really
// reaches the sweep, and the recommendation it prints writes the SHARED budget.
// This fixture is ONE task, which satiates and so does cross — the multi-task
// "no crossing" branch and the "no window is worth working" branch are covered by
// budget-curve-card.stories.svelte, which can hand the card a curve directly.
test('the budget curve stays unasked until clicked, then prices the day’s length', async ({
	page,
}) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/energy');

	const check = page.getByRole('button', {
		name: 'How long should today be?',
	});

	// One button and nothing else until asked
	await expect(check).toBeVisible();
	await expect(page.getByText(/re-solved by the same optimizer/)).not.toBeVisible();

	await check.click();

	// ONE task satiates, so this day's curve really does reach break-even — zero,
	// NOT the λ₀ line, which `valuePerHour` already has charged out of it
	// (MATH.md §8.12). Unlike the 2–6 task days of §8.12's probe, which mostly run
	// to the cap.
	// The recommendation names the window AND what that window books, because a
	// window is not advice on its own.
	await expect(page.getByText(/another hour of your day adds nothing/)).toBeVisible();

	// The seam worth an e2e: the recommendation writes the SHARED budget, the same
	// value the main page's Available Hours holds (settled 2026-07-29).
	await page
		.getByRole('button', {
			name: /Set the day window/,
		})
		.click();

	const window = page.locator('#window-hours');
	await expect(window).not.toHaveValue('8');

	const applied = await window.inputValue();
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/');
	await expect(page.getByText(new RegExp(`${applied}h budget`))).toBeVisible();
});

// The session store's date reader belongs to the (app) layout and is route-blind,
// so `?date=` reached the Lab too — loading another day's tasks with live sliders
// under copy that promises today's session, while 🪫 logs still stamp today.
test('a dated URL collapses to the canonical Lab', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/energy?date=2026-01-15');

	await expect(page).toHaveURL(/\/energy$/);
	// Today's task is what the Lab plans — the dated day has none at all.
	await expect(page.getByText('Deep work').first()).toBeVisible();
});

// business/model/AGENTS.md: "A fit never writes params silently." The whole point of the
// Apply button is that the sliders stay the user's until it is pressed — and
// there is one button for all four fits, because their order is the math.
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
		name: 'Apply my fits',
	});

	await expect(apply).toBeEnabled();
	await expect(cognitiveDrain).toHaveValue(defaultDrain);

	await apply.click();
	await expect(cognitiveDrain).not.toHaveValue(defaultDrain);
	await expect(page.getByText('Fits applied')).toBeVisible();
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

	// The completed row keeps its 🪫 button, so a second session can still be logged
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

/* Ticking off a second task ends a second session, so it gets its own prompt —
   the same as the main page's ⚡, where every row owns its editor. The Lab's draft
   used to be one for the whole list, so only the first tick ever prompted. */
test('completing a second task opens its own drain rating', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await addTask(page, 'Gym session');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	const forms = page.locator('form').filter({
		hasText: 'After the session',
	});

	await page
		.getByRole('checkbox', {
			name: 'Mark Deep work complete',
		})
		.check();

	await expect(forms).toHaveCount(1);

	await page
		.getByRole('checkbox', {
			name: 'Mark Gym session complete',
		})
		.check();

	await expect(forms).toHaveCount(2);

	// …and un-completing one withdraws only its own
	await page
		.getByRole('checkbox', {
			name: 'Mark Gym session complete',
		})
		.uncheck();

	await expect(forms).toHaveCount(1);

	await expect(
		page
			.locator('li')
			.filter({
				hasText: 'Deep work',
			})
			.locator('form')
			.filter({
				hasText: 'After the session',
			}),
	).toBeVisible();
});

/* The prompt must never destroy a rating being typed — now by opening beside it
   rather than by staying quiet. Completing B used to replace A's draft. */
test('a rating being typed survives another task being completed', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await addTask(page, 'Gym session');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	// Hand-open Deep work's rating and half-fill it. Named by its row, not `.first()`
	// — `addTask` prepends, so the first 🪫 belongs to Gym session, the task this test
	// then completes, and the cross-task invariant would go untested.
	const deepWork = page.locator('li').filter({
		hasText: 'Deep work',
	});

	await deepWork
		.getByRole('button', {
			name: 'Log end-of-session drain',
		})
		.click();

	const form = deepWork.locator('form').filter({
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

	// Gym's own prompt opens beside it; Deep work's draft is untouched
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

	// And it does not come back with the task: the undo restores it under its ORIGINAL
	// id, which is the one the draft was keyed by. The Lab holds its own copy of the
	// drafts, so this is a second place the ✕ has to drop them.
	await page
		.getByRole('button', {
			name: 'Undo',
		})
		.click();

	await expect(
		page.getByRole('checkbox', {
			name: 'Mark Deep work complete',
		}),
	).toBeVisible();

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

	// A rest pair identifies the recovery rate on its own (MATH.md §8.9), and the
	// one Apply carries it — so this proves the reloaded pair reached the FIT, not
	// just the list's count.
	const recoveryRate = page.getByLabel('Recovery rate');
	const defaultRecovery = await recoveryRate.inputValue();

	await page
		.getByRole('button', {
			name: 'Apply my fits',
		})
		.click();

	await expect(recoveryRate).not.toHaveValue(defaultRecovery);
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
// MATH.md §18: a rating is one SESSION, so the row button always starts a new one
// and correcting an old one goes through its ✎. Logging the correction instead
// would count the session twice — the defect this replaced, from the other side.
test('correcting a rating edits its row, while a second session adds one', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 180, 9, 5);

	await page
		.getByRole('button', {
			name: 'Correct this drain rating',
		})
		.click();

	// The ✎ re-opens THAT session, so the editor carries its stored values.
	const form = page.locator('form').filter({
		hasText: 'After the session',
	});

	const fields = form.locator('input[type="number"]');
	await expect(fields.nth(0)).toHaveValue('180');
	await expect(fields.nth(1)).toHaveValue('9');

	await fields.nth(1).fill('6');

	await form
		.getByRole('button', {
			name: '✓',
		})
		.click();

	// Corrected in place: still one row, now reading M6.
	await expect(page.getByText('Drain ratings · 1')).toBeVisible();
	await expect(page.getByText('M6')).toBeVisible();

	// The row's own button is the other path: an empty form, and a second row.
	await logDrain(page, 90, 7, 4);
	await expect(page.getByText('Drain ratings · 2')).toBeVisible();
});

// The ✎ has to win over an editor already open on that row, and both halves of the
// draft have to move together: the fields the user sees AND the `recordId` that decides
// whether ✓ appends a session or rewrites one. They did not — the form read its seed at
// mount and the row never remounted it — so ✓ pointed at a stored rating while showing
// the blank one, which is a wrong write, not a stale display.
test('the ✎ re-seeds a drain editor the row already has open', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 180, 9, 5);

	// A second session, started and left open on the row
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
	await expect(fields.nth(0)).toHaveValue('');

	// The chip on the logged rating, while that blank editor is still up
	await page
		.getByRole('button', {
			name: 'Correct this drain rating',
		})
		.click();

	// The open editor now reads the stored session, not the blank one it replaced
	await expect(fields.nth(0)).toHaveValue('180');
	await expect(fields.nth(1)).toHaveValue('9');
	await expect(fields.nth(2)).toHaveValue('5');

	await fields.nth(1).fill('6');

	await form
		.getByRole('button', {
			name: '✓',
		})
		.click();

	// Corrected in place — the ✎'s save path, not the button's
	await expect(page.getByText('Drain ratings · 1')).toBeVisible();
	await expect(page.getByText('M6')).toBeVisible();
});

/* A break is the one measurement with no row anywhere: it belongs to no task, so
   neither screen's task list can carry its editor, and until 2026-08-10 it could only be
   deleted and re-logged. The analytics ✎ is its only correction, which this crosses two
   screens to prove: the fit the Lab applies has to move with what the list rewrote.

   ☕ is also where a correction re-deriving anything would be least visible — it has no
   covariates to re-derive — so the ⚡/🪫 cases are covered where their covariates are
   (the store specs, MATH.md §36). */
test('a break is correctable from the analytics history, and the fit follows', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	// A long break off a nearly-full drain recovers slowly; the correction below makes it
	// a short break off the same drain, which is a much faster recovery rate.
	await logRest(page, 120, 9, 8, 8, 7);

	const recoveryRate = page.getByLabel('Recovery rate');

	await page
		.getByRole('button', {
			name: 'Apply my fits',
		})
		.click();

	const slowFit = await recoveryRate.inputValue();

	await page.goto('/analytics');

	await page
		.getByRole('button', {
			name: /^Correct Break logged on/,
		})
		.click();

	const form = page.locator('form').filter({
		hasText: 'rested',
	});

	// Seeded from the record: the same five numbers the row prints, so a correction only
	// has to change the one that was wrong.
	await expect(form.locator('input[type="number"]').first()).toHaveValue('120');

	await form.locator('input[type="number"]').first().fill('15');

	await form
		.getByRole('button', {
			name: '✓',
		})
		.click();

	// The corrected reading, which is also what says the write landed — asserting the
	// count alone would pass on a save that never happened, and navigating into the
	// store's re-read aborts it.
	await expect(
		page.getByRole('listitem').filter({
			hasText: '15m',
		}),
	).toBeVisible();

	// Still ONE row: corrected in place, not appended. A second would fit r off the same
	// recovery twice.
	await expect(page.getByText('1 measurement')).toBeVisible();

	await page.goto('/energy');
	await expect(page.getByText('Rest pairs · 1')).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Apply my fits',
		})
		.click();

	await expect(recoveryRate).not.toHaveValue(slowFit);
});

test('deleting the drain rating clears the calibration', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 5);

	// Dropping one rating moved to /analytics with the listing (2026-08-10); this card
	// keeps the fit's own verbs. Crossing the two screens is the point: the ✕ there has
	// to take this calibration with it.
	await page.goto('/analytics');

	await page
		.getByRole('button', {
			name: /^Delete Session rating logged on/,
		})
		.click();

	// Wait for the drop to land before navigating. The store re-reads IndexedDB after the
	// delete, and a `goto` fired into that gap aborts the transaction — so without this
	// the test flaked on its own speed rather than on the behaviour it names.
	await expect(page.getByText('No measurements logged in this range.')).toBeVisible();

	await page.goto('/energy');

	// The card falls back to its empty state, and with no fit left anywhere the
	// Apply beside the parameters is gone rather than disabled — disabled reads as
	// "already applied", which would be a claim about a fit that no longer exists.
	await expect(page.getByText(/No ratings yet\./)).toBeVisible();

	await expect(
		page.getByRole('button', {
			name: 'Apply my fits',
		}),
	).toHaveCount(0);
});
