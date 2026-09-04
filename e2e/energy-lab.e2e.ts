import { expect, test, type Page } from '@playwright/test';
import {
	addTask,
	AUTOSAVE_MS,
	budgetField,
	closeTaskForm,
	drainChips,
	drainForm,
	isoDate,
	logDrain,
	logRest,
	openDrainEditor,
	openTaskForm,
	openTimeBudget,
	plantRunningTimer,
	saveRoutine,
	setBudget,
	setSlider,
	taskCard,
	taskRow,
} from './helpers';

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

/* The Lab is where the day is actually tuned, so the day's two menus read on its
   Tasks card as well — a routine saved on the main page had no way in here. */
test('the day’s Load and Save read on the Lab’s Tasks card', async ({ page }) => {
	await page.goto('/energy');
	await addTask(page, 'Deep work');

	const card = taskCard(page);

	await expect(
		card.getByRole('button', {
			name: 'Load',
			exact: true,
		}),
	).toBeVisible();

	await expect(
		card.getByRole('button', {
			name: 'Save',
			exact: true,
		}),
	).toBeVisible();
});

/* The session clock is one clock across both screens: the Lab is where a session is
   actually worked from, and the reading a stop leaves funds the 🪫 editor on whichever
   screen opens one first. Only an e2e sees the navigation, which is the whole point. */
test('the Lab’s Tasks card offers the timer', async ({ page }) => {
	await page.goto('/energy');
	await addTask(page, 'Deep work');

	await expect(
		taskCard(page).getByRole('button', {
			name: 'Start timer',
		}),
	).toBeVisible();
});

test('a session started on / is still counting on the Lab', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await page
		.getByRole('button', {
			name: 'Start timer',
		})
		.click();

	await page.goto('/energy');

	await expect(
		page.getByRole('button', {
			name: 'Pause timer',
		}),
	).toBeVisible();

	// Not merely "a control is there": a fresh clock would offer this one instead.
	await expect(
		page.getByRole('button', {
			name: 'Start timer',
		}),
	).toHaveCount(0);
});

test('a session started on the Lab is still counting on /', async ({ page }) => {
	await page.goto('/energy');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await page
		.getByRole('button', {
			name: 'Start timer',
		})
		.click();

	// The nav link, not a fresh load: a client-side navigation keeps the layout — and
	// so the store — mounted, which is the path a person actually takes between the
	// two screens, and the one no re-read of storage covers.
	await page
		.getByRole('link', {
			name: 'Today',
		})
		.click();

	await expect(
		page.getByRole('button', {
			name: 'Pause timer',
		}),
	).toBeVisible();
});

test('stopping on the Lab fills the Lab’s own drain editor', async ({ page }) => {
	await page.goto('/energy');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	// Planted rather than clocked: the length field takes whole minutes.
	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await openDrainEditor(page, 'Deep work');
	await expect(drainForm(page).locator('input[type="number"]').first()).toHaveValue('45');
});

/* One stop funds one log, and the two screens are one ledger: the log saved on `/`
   spends the reading, so the Lab's editor opens empty afterwards. */
test('a reading spent on / is gone on the Lab', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await logDrain(page, 45, 5, 3);

	await page.goto('/energy');
	await openDrainEditor(page, 'Deep work');
	await expect(drainForm(page).locator('input[type="number"]').first()).toHaveValue('');
});

test('a reading discarded on the Lab is gone on /', async ({ page }) => {
	await page.goto('/energy');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await page
		.getByRole('button', {
			name: 'Discard timed session',
		})
		.click();

	await page.goto('/');

	await expect(
		page.getByRole('button', {
			name: 'Start timer',
		}),
	).toBeVisible();
});

test('a routine loads onto the Lab’s list', async ({ page }) => {
	// Saved from a future day so today stays empty: routines are global, and loading
	// tasks onto a day that already holds them would assert nothing.
	await page.goto(`/?date=${isoDate(2)}`);
	await addTask(page, 'Boxing training');
	await addTask(page, 'Write report');

	await saveRoutine(page, 'Morning block');

	await page.goto('/energy');
	await expect(page.getByText('No tasks deployed yet')).toBeVisible();

	await taskCard(page)
		.getByRole('button', {
			name: 'Load',
			exact: true,
		})
		.click();

	await page
		.getByRole('menuitem', {
			name: 'Morning block (2)',
		})
		.click();

	await expect(taskRow(page, 'Boxing training')).toBeVisible();
	await expect(taskRow(page, 'Write report')).toBeVisible();
});

// Load with nothing loaded yet is the whole point of the pair being here; Save is
// what an empty day has nothing to offer.
test('an empty Lab day offers Load and nothing to save', async ({ page }) => {
	await page.goto('/energy');

	await expect(
		taskCard(page).getByRole('button', {
			name: 'Load',
			exact: true,
		}),
	).toBeVisible();

	await expect(
		page.getByRole('button', {
			name: 'Save',
			exact: true,
		}),
	).toHaveCount(0);
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
	// the plan moves off it.
	const rows = page.locator('table tbody').filter({
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
		name: 'Check the window',
	});

	// The card is on screen from the first paint; what waits is the reading.
	await expect(check).toBeVisible();
	await expect(page.getByText(/re-solved by the same optimizer/)).toBeVisible();

	await check.click();

	// ONE task satiates, so this day's curve really does reach break-even — zero,
	// NOT the λ₀ line, which `valuePerHour` already has charged out of it
	// (MATH.md §8.12). Unlike the 2–6 task days of §8.12's probe, which mostly run
	// to the cap.
	// The recommendation names the window AND what that window books, because a
	// window is not advice on its own.
	await expect(page.getByText(/another hour of your day adds nothing/)).toBeVisible();

	// The chart is too wide for the parameters card, so its card lands full width
	// under everything.
	const curve = page.locator('.card-shell').filter({
		has: page.getByRole('heading', {
			name: 'How long should today be?',
		}),
	});

	const recovery = page.locator('.card-shell').filter({
		has: page.getByRole('heading', {
			name: 'Recovery Calibration',
		}),
	});

	const curveBox = (await curve.boundingBox())!;
	const recoveryBox = (await recovery.boundingBox())!;

	expect(curveBox.y).toBeGreaterThan(recoveryBox.y + recoveryBox.height);

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

/* The Lab's page order: the plan is the screen's answer, so it reads first and full
   width. The ledger's adjacency to the parameters is not paid for by that — both sit
   in the wide column under it, the list directly above the rows that move it. */
test('the plan reads above the ledger', async ({ page }) => {
	await page.goto('/');

	for (const title of ['Deep work', 'Emails', 'Errand', 'Reading']) await addTask(page, title);

	await setBudget(page, 8);
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/energy');

	const chart = page.getByRole('img', {
		name: 'Energy levels and output rate over the day',
	});

	await expect(chart).toBeVisible();

	const row = await taskRow(page, 'Deep work').boundingBox();
	const plot = await chart.boundingBox();

	expect(plot!.y).toBeLessThan(row!.y);
});

/* One grid under the plan, not two: the ledger and the parameters share the wide
   column so the row being edited and the parameter that moves it are one scroll
   apart, and the four read-outs stack beside them rather than under. */
test('the ledger and the parameters read beside the calibration boxes', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/energy');

	const params = page.locator('.card-shell').filter({
		has: page.getByRole('heading', {
			name: 'Model Parameters',
		}),
	});

	const recovery = page.locator('.card-shell').filter({
		has: page.getByRole('heading', {
			name: 'Recovery Calibration',
		}),
	});

	const listBox = (await taskCard(page).boundingBox())!;
	const paramsBox = (await params.boundingBox())!;
	const recoveryBox = (await recovery.boundingBox())!;

	// The wide column: one left edge and one width for both of its cards.
	expect(paramsBox.x).toBeCloseTo(listBox.x, 0);
	expect(paramsBox.width).toBeCloseTo(listBox.width, 0);

	// The narrow column starts where the wide one ends, and the parameters are
	// directly under the list rather than beside it.
	expect(recoveryBox.x).toBeGreaterThan(paramsBox.x + paramsBox.width - 1);
	expect(paramsBox.y).toBeGreaterThan(listBox.y + listBox.height - 1);
});

// One control in one place: the card is on screen before the first click, so the
// sweep is asked for from the card's own header and the parameters card holds no
// second button for it (presentation/AGENTS.md).
test('the Lab opens with the curve card already on screen', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/energy');

	const curve = page.locator('.card-shell').filter({
		has: page.getByRole('heading', {
			name: 'How long should today be?',
		}),
	});

	const recovery = page.locator('.card-shell').filter({
		has: page.getByRole('heading', {
			name: 'Recovery Calibration',
		}),
	});

	await expect(page.getByText('No window has been priced for this day yet.')).toBeVisible();

	const curveBox = (await curve.boundingBox())!;
	const recoveryBox = (await recovery.boundingBox())!;

	expect(curveBox.y).toBeGreaterThan(recoveryBox.y + recoveryBox.height);

	const params = page.locator('.card-shell').filter({
		has: page.getByRole('heading', {
			name: 'Model Parameters',
		}),
	});

	await expect(
		params.getByRole('button', {
			name: 'Check the window',
		}),
	).toHaveCount(0);

	// One control, and one only: the defect being fixed was two buttons for one sweep.
	await expect(
		page.getByRole('button', {
			name: 'Check the window',
		}),
	).toHaveCount(1);

	await curve
		.getByRole('button', {
			name: 'Check the window',
		})
		.click();

	await expect(page.getByText('No window has been priced for this day yet.')).toBeHidden();
	await expect(curve.getByRole('img')).toBeVisible();
});

// The card offers a sweep, so it sits behind the same gate as everything else that
// describes a plan: a day with nothing to sweep stops at the task form.
test('an empty day stops before the curve card', async ({ page }) => {
	await page.goto('/energy');

	await expect(page.getByText('No tasks deployed yet')).toBeVisible();

	await expect(
		page.getByRole('heading', {
			name: 'How long should today be?',
		}),
	).toHaveCount(0);
});

/* The nav's active link already draws the page's name, so the `<h1>` is the
   document's and not the design's — it stays for the outline and takes no height. */
test('the Lab draws no page title', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/energy');

	const heading = page.getByRole('heading', {
		name: 'Energy Lab',
		exact: true,
	});

	await expect(heading).toBeAttached();

	const box = await heading.boundingBox();

	expect(box!.height).toBeLessThanOrEqual(1);
});

/* The route's only prose. In the heading tooltip it reached no crawler at all —
   bits-ui mounts `Tooltip.Content` on open — under a meta description that promises
   a day-value scheduler. Only the server response can catch that (`e2e/nav.e2e.ts`
   makes the same argument for the nav). */
test('the Lab’s explanation is server-rendered', async ({ request }) => {
	const html = await (await request.get('/energy')).text();

	expect(html).toContain('A different engine than the main page');
});

test('the Lab’s explanation reads with nothing hovered', async ({ page }) => {
	await page.goto('/energy');

	const intro = page.getByText(/A different engine than the main page/);

	await intro.scrollIntoViewIfNeeded();
	await expect(intro).toBeVisible();
});

// A calibration card, by the title in its heading: every card on this page renders
// the same shell, and the pending-log copy repeats between them.
const calibrationCard = (page: Page, title: string) =>
	page.locator('.card-shell').filter({
		hasText: title,
	});

// A parameter's fit reading, named off the stepper's own id — the fit sits on the
// row it fits, not on the calibration card.
const paramFit = (page: Page, id: string) => page.locator(`#${id}-fit`);

/* α and r are identity, so they fit logs dated strictly before today — the rating just
   logged does not move the row, and with no other log there is nothing to apply. What the
   rating IS counted by reads on /analytics, with the list it joined. */
test('a drain rating logged today does not move the fit reading', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 5);
	await expect(drainChips(page)).toHaveCount(1);

	await expect(paramFit(page, 'alpha-cog')).toHaveText('no informative ratings');

	await expect(
		page.getByRole('button', {
			name: 'Apply my fits',
		}),
	).toHaveCount(0);
});

/* 🪫's card moved to the page that lists its ratings; ☕'s and λ₀'s did not. ☕ is typed on
   the ledger and reachable on a day with no tasks, and λ₀ has no log store at all — neither
   has rows in that list to stand beside. */
test('the Lab keeps the recovery and stopping cards, and loses the drain card', async ({
	page,
}) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 5);
	await expect(drainChips(page)).toHaveCount(1);

	await expect(
		page.getByRole('heading', {
			name: 'Drain Calibration',
		}),
	).toHaveCount(0);

	await expect(
		page.getByRole('heading', {
			name: 'Recovery Calibration',
		}),
	).toBeVisible();

	await expect(
		page.getByRole('heading', {
			name: 'Stopping Calibration',
		}),
	).toBeVisible();
});

/* No logs at all is not "no signal": `no informative ratings` against a parameter
   nobody has rated is a claim about ratings the user never made, so the row carries
   no fit line until there is something to say. */
test('a parameter with no ratings behind it carries no fit reading', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/energy');

	await expect(page.getByLabel('Cognitive drain')).toBeVisible();
	await expect(paramFit(page, 'alpha-cog')).toHaveCount(0);
});

test('that same rating fits once the clock has passed midnight', async ({ page }) => {
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 5);
	await expect(drainChips(page)).toHaveCount(1);

	// Midnight: the rating now has a day behind it, which is all the fit was waiting for.
	// The new day needs a task of its own — the cards sit behind one.
	await page.clock.fastForward('25:00:00');
	await page.goto('/energy');
	await addTask(page, 'Deep work');

	await expect(paramFit(page, 'alpha-cog')).toHaveText(/≈ [\d.]+ ± [\d.]+ · n=1/);
});

/* MATH.md §8.10 (M42): a past day whose own 🪫 log moments describe a span with
   no room for another 45-min step ran out of wall clock, so its stop is no
   evidence about λ₀ — the fit drops it and the card says how many it dropped.
   The Stopping Calibration card's body is inline in `+page.svelte` (the
   calibration cards share a shell, not a body), so this copy is reachable here
   and nowhere below. */
test('a past day that ran out of clock is named on the stopping card, and never moves the fit', async ({
	page,
}) => {
	// A fixed morning: the day that runs out of clock is built by advancing six
	// hours between two ratings, which must not itself cross midnight.
	await page.clock.install({
		time: new Date('2026-08-19T08:00:00'),
	});

	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);
	await page.clock.runFor(AUTOSAVE_MS);

	await page.goto('/energy');
	await logDrain(page, 90, 8, 4);

	// One 90-min session inside an 8 h window leaves room for another step, so
	// yesterday reveals a two-sided bracket and the fit has a value.
	await page.clock.fastForward('20:00:00');
	await page.goto('/');

	// Both difficulty sliders at 0 put demand 0 on every rating this task carries,
	// and §8.7's α fit drops those — so the day built below is the ONLY thing that
	// differs between the two readings of λ₀ this test compares.
	await openTaskForm(page);
	await page.getByPlaceholder('e.g., Boxing training').fill('Errand');

	// Range inputs take keyboard steps, and `Home` is the minimum — 0 here.
	for (const label of ['Physical Diff', 'Mental Diff']) {
		await page.getByLabel(label).press('Home');
	}

	await page
		.getByRole('button', {
			name: 'Deploy Task',
		})
		.click();

	await closeTaskForm(page);

	await openTimeBudget(page, /8h budget/);
	await setBudget(page, 8);
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	const stopCard = calibrationCard(page, 'Stopping Calibration');
	const fitRow = paramFit(page, 'free-time-value');

	await expect(fitRow).toHaveText(/≈ [\d.]+ ± [\d.]+ · n=1/);
	const fitted = await fitRow.textContent();
	await expect(stopCard.getByText(/ran out of clock/)).toHaveCount(0);

	// The fit reads on the parameter row now; the card still has to say what it read,
	// or a day with nothing censored leaves a heading over an empty body.
	await expect(stopCard.getByText('Stop observations · 1')).toBeVisible();

	// 3 h worked across a 7.5 h span of an 8 h window: the wall clock ended it.
	await logDrain(page, 90, 7, 3);
	await page.clock.fastForward('06:00:00');
	await logDrain(page, 90, 9, 5);
	await page.clock.runFor(AUTOSAVE_MS);

	await page.clock.fastForward('20:00:00');
	await page.goto('/');
	await addTask(page, 'Deep work');
	await openTimeBudget(page, /8h budget/);
	await setBudget(page, 8);
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	const stopCardToday = calibrationCard(page, 'Stopping Calibration');

	await expect(
		stopCardToday.getByText('1 day ran out of clock, so its stop is not counted'),
	).toBeVisible();

	// The dropped day moves nothing: same fitted value, still one day used.
	await expect(paramFit(page, 'free-time-value')).toHaveText(fitted!);
});

/* MATH.md §8.10: a day whose 🪫 rows recover no break falls back to one
   contiguous session, so the fit reads it at its pre-2026-08-19 accuracy and
   `usedCount` cannot tell it from a day whose breaks were read. The card names
   how many, and the copy is inline in `+page.svelte` — reachable here and
   nowhere below. */
test('a past day logged in one batch is named on the stopping card', async ({ page }) => {
	await page.clock.install({
		time: new Date('2026-08-19T08:00:00'),
	});

	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);
	await page.clock.runFor(AUTOSAVE_MS);

	// Two sessions written down in one sitting: no clock moves between them, so
	// their moments recover no gap. 3 h inside an 8 h window still leaves room to
	// extend, so the day reveals a two-sided bracket and the fit uses it.
	await page.goto('/energy');
	await logDrain(page, 90, 8, 4);
	await logDrain(page, 90, 8, 4);
	await page.clock.runFor(AUTOSAVE_MS);

	await page.clock.fastForward('20:00:00');
	await page.goto('/');
	await addTask(page, 'Deep work');
	await openTimeBudget(page, /8h budget/);
	await setBudget(page, 8);
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	await expect(paramFit(page, 'free-time-value')).toHaveText(/≈ [\d.]+ ± [\d.]+ · n=1/);

	await expect(
		calibrationCard(page, 'Stopping Calibration').getByText(
			'1 day behind the fit had no readable breaks, so it was read as one unbroken stretch',
		),
	).toBeVisible();
});

test('a past day whose breaks were read is not named', async ({ page }) => {
	await page.clock.install({
		time: new Date('2026-08-19T08:00:00'),
	});

	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);
	await page.clock.runFor(AUTOSAVE_MS);

	// The same 3 h, two hours apart: the rows recover a 0.5 h break, and the 3.5 h
	// span still leaves the 8 h window room for another step, so the day is read
	// with its own structure rather than censored.
	await page.goto('/energy');
	await logDrain(page, 90, 8, 4);
	await page.clock.fastForward('02:00:00');
	await logDrain(page, 90, 8, 4);
	await page.clock.runFor(AUTOSAVE_MS);

	await page.clock.fastForward('18:00:00');
	await page.goto('/');
	await addTask(page, 'Deep work');
	await openTimeBudget(page, /8h budget/);
	await setBudget(page, 8);
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	await expect(paramFit(page, 'free-time-value')).toHaveText(/≈ [\d.]+ ± [\d.]+ · n=1/);

	await expect(
		calibrationCard(page, 'Stopping Calibration').getByText(/no readable breaks/),
	).toHaveCount(0);
});

test('a break logged today is named beside the recovery fit', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await logRest(page, 30, 9, 8, 3, 2);
	await expect(page.getByText('Rest pairs · 1')).toBeVisible();

	await expect(
		calibrationCard(page, 'Recovery Calibration').getByText(
			'1 break logged today, counted from tomorrow',
		),
	).toBeVisible();

	await expect(paramFit(page, 'recovery-rate')).toHaveText('no informative ratings');
});

// business/model/AGENTS.md: "A fit never writes params silently." The whole point of the
// Apply button is that the sliders stay the user's until it is pressed — and
// there is one button for all four fits, because their order is the math.
test('a drain rating fits α but only applies on demand', async ({ page }) => {
	// Logged today, then carried past midnight: only a rating with a day behind it
	// reaches the fit, and this test is about what Apply does with one.
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 5);
	await expect(drainChips(page)).toHaveCount(1);

	await page.clock.fastForward('25:00:00');
	await page.goto('/energy');
	await addTask(page, 'Deep work');

	const cognitiveDrain = page.getByLabel('Cognitive drain');
	const defaultDrain = await cognitiveDrain.inputValue();

	// The fit ran — but the parameter is untouched.
	const apply = page.getByRole('button', {
		name: 'Apply my fits',
	});

	await expect(apply).toBeEnabled();
	await expect(cognitiveDrain).toHaveValue(defaultDrain);

	const shown = (await paramFit(page, 'alpha-cog').textContent())!.match(/≈ ([\d.]+)/)![1];

	await apply.click();
	await expect(cognitiveDrain).not.toHaveValue(defaultDrain);
	// The row showed the number the button then wrote — `applyFits` rounds α to the
	// same two decimals the reading prints, so the stepper holds exactly it.
	await expect(cognitiveDrain).toHaveValue(String(Number(shown)));
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
	// ROW, not the form — `opacity` does not inherit, so a child of an `opacity-60`
	// ancestor still computes 1 and an assertion on the form itself cannot fail.
	await expect(form.locator('xpath=ancestor::tbody[1]')).toHaveCSS('opacity', '1');

	const fields = form.locator('input[type="number"]');
	await fields.nth(0).fill('90');
	await fields.nth(1).fill('8');
	await fields.nth(2).fill('4');

	await form
		.getByRole('button', {
			name: '✓',
		})
		.click();

	await expect(drainChips(page)).toHaveCount(1);

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
		taskRow(page, 'Deep work').locator('form').filter({
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
	const deepWork = taskRow(page, 'Deep work');

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
	await expect(drainChips(page)).toHaveCount(0);
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

	await taskRow(page, 'Deep work')
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

/* ☕ is a log of the day, like ⏱ and 🪫 — so it is typed where they are, on the
   ledger's heading row beside Load and Save, and the recovery card is left a
   read-out like the other two. */
test('a rest is logged from the ledger, not from the calibration card', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await expect(
		taskCard(page).getByRole('button', {
			name: 'Log a rest',
		}),
	).toBeVisible();

	const recovery = page.locator('.card-shell').filter({
		has: page.getByRole('heading', {
			name: 'Recovery Calibration',
		}),
	});

	await expect(
		recovery.getByRole('button', {
			name: 'Log a rest',
		}),
	).toHaveCount(0);

	await logRest(page, 30, 9, 8, 3, 2);

	// r reads pairs dated before today, so what the read-out card can say about a
	// pair logged now is that it holds it.
	await expect(recovery.getByText('Rest pairs · 1')).toBeVisible();
});

/* The day you are most likely to have rested is the day you booked nothing, and the
   card the editor used to live on is inside the page's `hasTasks` gate. */
test('a rest can be logged on a day with no tasks', async ({ page }) => {
	await page.goto('/energy');

	await logRest(page, 30, 9, 8, 3, 2);

	// An empty Lab shows no calibration cards at all, so the task that brings them
	// back is the proof the pair was stored without one.
	await addTask(page, 'Deep work');

	await expect(page.getByText('Rest pairs · 1')).toBeVisible();
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
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 5);
	await expect(drainChips(page)).toHaveCount(1);

	await logRest(page, 30, 9, 8, 3, 2);
	await expect(page.getByText('Rest pairs · 1')).toBeVisible();

	await page.reload();

	await expect(drainChips(page)).toHaveCount(1);
	await expect(page.getByText('Rest pairs · 1')).toBeVisible();

	// A rest pair identifies the recovery rate on its own (MATH.md §8.9), and the
	// one Apply carries it — so this proves the reloaded pair reached the FIT, not
	// just the list's count. Past midnight, because r reads pairs dated before
	// today, and the new day needs a task of its own to render the sliders.
	await page.clock.fastForward('25:00:00');
	await page.goto('/energy');
	await addTask(page, 'Deep work');
	await page.clock.runFor(AUTOSAVE_MS);

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
// A rating is one SESSION, so the row button always starts a new one
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

	// Corrected in place: still one row, now reading Mind 6.
	await expect(drainChips(page)).toHaveCount(1);
	await expect(page.getByText('Mind 6')).toBeVisible();

	// The row's own button is the other path: an empty form, and a second row.
	await logDrain(page, 90, 7, 4);
	await expect(drainChips(page)).toHaveCount(2);
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
	await expect(drainChips(page)).toHaveCount(1);
	await expect(page.getByText('Mind 6')).toBeVisible();
});

/* A break is the one measurement with no row anywhere: it belongs to no task, so
   neither screen's task list can carry its editor, and until 2026-08-10 it could only be
   deleted and re-logged. The analytics ✎ is its only correction, which this crosses two
   screens to prove: the fit the Lab applies has to move with what the list rewrote.

   ☕ is also where a correction re-deriving anything would be least visible — it has no
   covariates to re-derive — so the ⚡/🪫 cases are covered where their covariates are
   (the store specs). */
test('a break is correctable from the analytics history, and the fit follows', async ({ page }) => {
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	// A long break off a nearly-full drain recovers slowly; the correction below makes it
	// a short break off the same drain, which is a much faster recovery rate. Carried
	// past midnight, because r only reads pairs dated before today.
	await logRest(page, 120, 9, 8, 8, 7);
	await expect(page.getByText('Rest pairs · 1')).toBeVisible();

	await page.clock.fastForward('25:00:00');
	await page.goto('/energy');
	await addTask(page, 'Deep work');
	await page.clock.runFor(AUTOSAVE_MS);

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
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 5);

	// The count comes off the store's re-read, so it says the write committed — a `goto`
	// fired into the gap before it aborts the transaction and nothing is there to drop.
	await expect(drainChips(page)).toHaveCount(1);

	// Carried past midnight, so there is a fit to clear at all.
	await page.clock.fastForward('25:00:00');
	await page.goto('/energy');
	await addTask(page, 'Deep work');
	await page.clock.runFor(AUTOSAVE_MS);

	await expect(
		page.getByRole('button', {
			name: 'Apply my fits',
		}),
	).toBeVisible();

	// Dropping one rating moved to /analytics with the listing (2026-08-10), and the
	// card followed it there. Crossing the two screens is still the point: the ✕ there
	// has to take this Lab's calibration with it.
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

	// The card falls back to its empty state beside the emptied list — both readings
	// are on this page now, so the ✕ answers for itself.
	await expect(page.getByText(/No ratings yet\./)).toBeVisible();

	await page.goto('/energy');

	// With no fit left anywhere the Apply beside the parameters is gone rather than
	// disabled — disabled reads as "already applied", which would be a claim about a
	// fit that no longer exists.
	await expect(
		page.getByRole('button', {
			name: 'Apply my fits',
		}),
	).toHaveCount(0);
});

/* The Lab's form carries its own reading, and it is the OPTIMIZER's: a
   classic-allocator panel here would describe a day this screen does not show.
   One press, one solve — the reason it is a button and not a `$derived`. */
test('the Lab’s form prices a typed task into the optimized day', async ({ page }) => {
	await page.goto('/energy');
	await addTask(page, 'Deep work');

	await page.getByLabel('Day window').fill('8');
	await page.getByLabel('Day window').blur();

	const form = page.getByRole('dialog');
	const field = await openTaskForm(page);

	await field.fill('Boxing training');
	await setSlider(form.getByLabel('Physical Diff'), 9);

	// Nothing is priced until the press: the prompt line stands where the reading
	// will go.
	await expect(form.getByText(/Name the task/)).toBeVisible();

	await form
		.getByRole('button', {
			name: 'Price this day',
		})
		.click();

	// A StatTile is <p>label</p><p>value</p><p>note</p>, so the hours are the
	// label's next sibling — the only way to read one without a test id.
	await expect(
		form
			.getByText('Suggested hours', {
				exact: true,
			})
			.locator('xpath=following-sibling::p[1]'),
	).toHaveText(/\d/);

	await closeTaskForm(page);
});

// The page refuses to draw a plan without a window, and the panel agrees with it
// rather than printing zeroes off a plan the optimizer never made.
test('the Lab’s form says a windowless day cannot be priced', async ({ page }) => {
	await page.goto('/energy');
	await addTask(page, 'Deep work');

	await expect(page.getByLabel('Day window')).toHaveValue('0');

	const form = page.getByRole('dialog');

	await openTaskForm(page);

	await expect(form.getByText('Set a day window above 0 hours.')).toBeVisible();

	await expect(
		form.getByRole('button', {
			name: 'Price this day',
		}),
	).toHaveCount(0);

	await closeTaskForm(page);
});
