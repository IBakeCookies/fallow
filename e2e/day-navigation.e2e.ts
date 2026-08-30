import { expect, test } from '@playwright/test';
import { addTask, AUTOSAVE_MS, isoDate, logFlow, setBudget, taskRow } from './helpers';

/** `Flow at` in `/`'s ledger — `getTaskColumns`' eighth column. */
const FLOW_CELL = 7;

test('past day is read-only with a banner', async ({ page }) => {
	await page.goto(`/?date=${isoDate(-3)}`);
	await expect(page.getByText('Viewing a past day:')).toBeVisible();

	// No `form` reaches the card on a past day, so there is no way IN to assert
	// against — not a closed form, no `+` at all.
	await expect(
		page.getByRole('button', {
			name: 'Add task',
			exact: true,
		}),
	).toHaveCount(0);

	// nav label switches from "Today" to the viewed date
	await expect(
		page.getByRole('link', {
			name: 'Today',
			exact: true,
		}),
	).not.toBeVisible();

	await expect(
		page.getByRole('link', {
			name: /return to today/,
		}),
	).toBeVisible();

	// Neither day-action reads on a day that cannot be changed
	await expect(
		page.getByRole('button', {
			name: 'Load',
			exact: true,
		}),
	).toHaveCount(0);

	await expect(
		page.getByRole('button', {
			name: 'Save',
			exact: true,
		}),
	).toHaveCount(0);

	// Nor the timer that fills a 🪫 editor: a new measurement is today's alone.
	await expect(
		page.getByRole('button', {
			name: 'Start timer',
		}),
	).toHaveCount(0);

	// The nav item is the only way back now, so it is the one this asserts through
	await page
		.getByRole('link', {
			name: /return to today/,
		})
		.click();

	await expect(page).toHaveURL('http://localhost:4173/');
});

test('future day shows the planning-ahead banner', async ({ page }) => {
	await page.goto(`/?date=${isoDate(3)}`);
	await expect(page.getByText('Planning ahead:')).toBeVisible();

	// planning is allowed: the way into the form stays on the card
	await expect(
		page.getByRole('button', {
			name: 'Add task',
			exact: true,
		}),
	).toBeVisible();
});

test('invalid date param falls back to today', async ({ page }) => {
	await page.goto('/?date=not-a-date');

	await expect(
		page.getByRole('link', {
			name: 'Today',
		}),
	).toBeVisible();

	await expect(page.getByText('Viewing a past day:')).not.toBeVisible();
});

test('date param equal to today collapses to /', async ({ page }) => {
	await page.goto(`/?date=${isoDate(0)}`);
	await expect(page).toHaveURL('http://localhost:4173/');
});

/* Both measurement editors are open only while the PAGE holds a draft for that task id,
   and the page survives a day change — so what keeps a draft from re-opening as an editor
   nobody asked for is that `nextTaskId` is `Date.now()`-based and monotonic ACROSS days:
   no other day holds the id the draft is keyed by. That is load-bearing and invisible, and
   it carries more weight since ⚡ and 🪫 became correctable on any day the page shows,
   because ✓ on a stale draft would then have a record on the NEW day to overwrite. Pinned
   here, at midnight, which is the only way the day changes with the page still mounted.
   Both editors in one test: one policy, two paints. */
test('a rollover leaves no editor open on the new day', async ({ page }) => {
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Boxing');

	const row = taskRow(page, 'Boxing');

	await row
		.getByRole('button', {
			name: 'Log time to flow',
		})
		.click();

	await row
		.getByRole('button', {
			name: 'Log end-of-session drain',
		})
		.click();

	await page.getByLabel('⚡ Minutes to reach flow:').fill('90');
	await expect(page.getByText('🪫 After the session:')).toBeVisible();

	// Midnight: the live clock moves and the page follows it onto a day that holds
	// neither the task nor the session those two editors were opened about.
	await page.clock.fastForward('25:00:00');
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));
	await expect(row).not.toBeVisible();

	// The new day's first task takes id 1 again, which is what a surviving draft
	// would re-open on.
	await addTask(page, 'Inbox');

	await expect(page.getByText('⚡ Minutes to reach flow:')).not.toBeVisible();
	await expect(page.getByText('🪫 After the session:')).not.toBeVisible();
});

/* `today` is live, so a page left open crosses midnight with its timer still running —
   and minutes counted yesterday cannot fill today's 🪫 log. Only a mounted page reaches
   this: a reload drops the stored timer on read. */
test('a rollover drops a timer left running overnight', async ({ page }) => {
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Boxing');

	await page
		.getByRole('button', {
			name: 'Start timer',
		})
		.click();

	await expect(
		page.getByRole('button', {
			name: 'Stop timer',
		}),
	).toBeVisible();

	await page.clock.fastForward('25:00:00');
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));

	await expect(
		page.getByRole('button', {
			name: 'Start timer',
		}),
	).toBeVisible();

	// And it seeds nothing on the new day either.
	await addTask(page, 'Inbox');

	await taskRow(page, 'Inbox')
		.getByRole('button', {
			name: 'Log end-of-session drain',
		})
		.click();

	await expect(
		page
			.locator('form')
			.filter({
				hasText: 'After the session',
			})
			.locator('input[type="number"]')
			.first(),
	).toHaveValue('');
});

/* The day strip is not a today-only reading — a past day draws the plan it was
   made under. Seeded through the clock, since the only way onto a read-only day
   is to plan it while it is today. */
test('a past day draws the strip it was planned under', async ({ page }) => {
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);

	// The autosave debounce runs on the page's own clock, which is now faked.
	await page.clock.runFor(AUTOSAVE_MS);
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.clock.fastForward('25:00:00');
	await page.goto(`/?date=${isoDate(0)}`);
	await expect(page.getByText('Viewing a past day:')).toBeVisible();

	// The strip is what has to redraw, so assert the block inside it — the ledger
	// row would read the same on a day that funded nothing.
	const timeline = page.locator('section').filter({
		has: page.getByRole('heading', {
			name: 'The day',
			exact: true,
		}),
	});

	await expect(timeline.getByText('#1 Deep work')).toBeVisible();

	// The strip carries no time of day, on a past day as on today.
	await expect(timeline.getByText(/\d{2}:\d{2}/)).toHaveCount(0);

	// A past day saves its completions as a WHOLE record, so every field that
	// write does not carry is a field it erases — the budget the strip is drawn
	// against included.
	await taskRow(page, 'Deep work').getByRole('checkbox').check();
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	// The title alone: a finished block prints no `#N` (presentation/AGENTS.md).
	await expect(timeline.getByText('Deep work')).toBeVisible();
});

/* The ± beside ϕ is the fit's own spread, so it can only appear once a fit has read a
   log — and no plan reads the ⚡ dated on its own day (`#fittedFlowObservations`). That
   makes midnight the only place a browser can watch the band arrive, and these two
   tests are the same arc: nothing to be unsure about, then something. */
test('a fresh profile plans with no ± beside the flow time', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing');

	await expect(taskRow(page, 'Boxing').locator('td').nth(FLOW_CELL)).not.toContainText('±');
});

test('a ⚡ logged today shows its ± on the next day', async ({ page }) => {
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Boxing');
	await logFlow(page, 90);

	await page.clock.fastForward('25:00:00');
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));

	// The new day holds none of yesterday's tasks, so the band needs one of its own.
	await addTask(page, 'Inbox');

	await expect(taskRow(page, 'Inbox').locator('td').nth(FLOW_CELL)).toContainText('±');
});
