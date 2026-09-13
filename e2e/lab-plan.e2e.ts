import { expect, test, type Page } from '@playwright/test';
import { addTask, AUTOSAVE_MS, setBudget, statValue, taskCard } from './helpers';

/* The Energy Lab shares the daily session but owns its own params and
   measurements, so the flows worth covering here are the seams between them:
   what the Lab must see from the session, the day's hours it shares BOTH ways
   with the main page (settled 2026-07-29 — the Lab's params stay its own, the
   window does not), and the two measurement logs that live in
   EnergyObservationStore. */

// The plan, the params and the two calibration cards all sit behind a task, so an
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

/* A carried task has NOT left the day's plan, and the Lab plans the same day: its row
   keeps the block and the hours the plan gave it, exactly as it does on `/`. */
test('a carried task keeps its row and its hours on the Lab', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await addTask(page, 'Boxing');

	await page
		.getByRole('checkbox', {
			name: 'Mark Deep work complete',
		})
		.check();

	await page.waitForTimeout(AUTOSAVE_MS);

	await taskCard(page)
		.getByRole('button', {
			name: 'Carry 1 to tomorrow',
		})
		.click();

	await expect(
		taskCard(page).getByRole('button', {
			name: /Carry \d+ to tomorrow/,
		}),
	).toHaveCount(0);

	// The mark is a debounced autosave; let it land before the Lab reloads the day.
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await page.getByLabel('Day window').fill('8');
	await page.getByLabel('Day window').blur();

	await expect(page.getByTitle(/^Boxing/).first()).toBeVisible();
	await expect(page.getByText('no hours')).toHaveCount(0);
});

// Ticking a task off is the one edit that must mark the plan without moving it: the
// allocator never sees `completed`.
test('ticking a task off marks its block in the plan', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await addTask(page, 'Boxing');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await page.getByLabel('Day window').fill('8');
	await page.getByLabel('Day window').blur();

	// The block, by the tooltip that names it — the label itself is what changes.
	await expect(page.getByTitle(/^Deep work/).first()).toHaveText('Deep work');

	await page
		.getByRole('checkbox', {
			name: 'Mark Deep work complete',
		})
		.check();

	await expect(page.getByTitle(/^Deep work \(done\)/).first()).toHaveText('✓Deep work');
});

// Mis-clicking a checkbox is one click, so the plan has to read as unfinished again.
test('un-ticking a task restores its block', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await addTask(page, 'Boxing');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await page.getByLabel('Day window').fill('8');
	await page.getByLabel('Day window').blur();

	const checkbox = page.getByRole('checkbox', {
		name: 'Mark Deep work complete',
	});

	await checkbox.check();
	await expect(page.getByTitle(/^Deep work \(done\)/).first()).toBeVisible();

	await checkbox.uncheck();
	await expect(page.getByTitle(/^Deep work/).first()).toHaveText('Deep work');
});

/* A day with every task ticked is the day you finished, not a day with nothing on
   it: the plan stays, struck through, and the ledger below is the un-check. */
const setUpAllDoneDay = async (page: Page) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await page.getByLabel('Day window').fill('8');
	await page.getByLabel('Day window').blur();

	await page
		.getByRole('checkbox', {
			name: 'Mark Deep work complete',
		})
		.check();
};

test('an all-done day still draws its plan', async ({ page }) => {
	await setUpAllDoneDay(page);

	await expect(
		page.getByRole('heading', {
			name: 'Optimized Day',
		}),
	).toBeVisible();
});

test('an all-done day reads its block as finished', async ({ page }) => {
	await setUpAllDoneDay(page);

	await expect(page.getByTitle(/^Deep work \(done\)/).first()).toHaveText('\u2713Deep work');
});

test('an all-done day still reports its hours', async ({ page }) => {
	await setUpAllDoneDay(page);

	await expect(page.getByText(/work \u00b7 /).first()).toBeVisible();
});

// Pin: the ledger is the affordance the deleted hint pointed at, so it stays.
test('an all-done day keeps the ledger to un-check from', async ({ page }) => {
	await setUpAllDoneDay(page);

	await expect(
		page.getByRole('checkbox', {
			name: 'Mark Deep work complete',
		}),
	).toBeChecked();
});

// Pin: nothing to plan is a different emptiness from a plan you finished.
test('a day with no tasks at all still shows no plan', async ({ page }) => {
	await page.goto('/energy');
	// The skeleton behind `isLoading` has no heading either, so read the loaded
	// empty state first or the count below resolves before the stores land.
	await expect(page.getByText('No tasks deployed yet')).toBeVisible();

	await expect(
		page.getByRole('heading', {
			name: 'Optimized Day',
		}),
	).toHaveCount(0);
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
	// the plan moves off it. Filtered on the checkbox, because the Lab's schedule
	// list holds the same titles in list items of its own.
	const rows = taskCard(page)
		.getByRole('listitem')
		.filter({
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
