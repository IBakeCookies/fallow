import { expect, test } from '@playwright/test';
import {
	addTask,
	AUTOSAVE_MS,
	expectTaskInputs,
	flushAutosaveOnFakedClock,
	isoDate,
	logFlow,
	openTimeBudget,
	seedDay,
	seedPastDay,
	setBudget,
	setSlider,
	taskCard,
	taskRow,
} from './helpers';

test('a past day keeps its banner, and the banner no longer calls it read-only', async ({
	page,
}) => {
	await page.goto(`/?date=${isoDate(-3)}`);
	await expect(page.getByText('Viewing a past day:')).toBeVisible();

	// The body used to end "adding or editing tasks is only possible on today",
	// which stopped being true (docs/features/the-day-you-could-not-correct.md).
	await expect(page.getByText(/only possible on today/)).toHaveCount(0);

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

	// The timer that fills a 🪫 editor stays today's: minutes are counted on today
	// alone, even though a 🪫 may be typed onto a past day.
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

/* A day already worked takes a measurement as today does — a session forgotten on
   the day is still a session — so completing a task there asks both questions. A day
   ahead has been worked by nobody and keeps refusing both. */
test('ticking a task done on a past day asks both questions', async ({ page }) => {
	await seedPastDay(page, 3, ['Deep work']);

	const row = taskRow(page, 'Deep work');

	await row.getByRole('checkbox').check();

	await expect(
		row.locator('form').filter({
			hasText: 'Minutes to reach flow',
		}),
	).toBeVisible();

	await expect(
		row.locator('form').filter({
			hasText: 'After the session',
		}),
	).toBeVisible();
});

/* A past day is an ordinary day to correct: the ✎, ✕, `+` and hours today has, on the
   day the user got wrong. Only acting on a future stays withheld — the defer and the
   advice card — because a past day's tomorrow is another day that already happened
   (docs/features/the-day-you-could-not-correct.md). Every write here is the debounced
   autosave, on the page's faked clock. */
test('a past task’s ratings can be corrected', async ({ page }) => {
	await seedPastDay(page, 7, ['Deep work']);
	await expectTaskInputs(page, 'Deep work', [5, 5, 5]);

	await taskRow(page, 'Deep work')
		.getByRole('button', {
			name: 'Edit task',
		})
		.click();

	const editor = page.locator('form').filter({
		has: page.getByLabel('Title'),
	});

	await setSlider(editor.getByLabel('Mental Diff'), 8);

	await editor
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	await expectTaskInputs(page, 'Deep work', [5, 8, 5]);

	await flushAutosaveOnFakedClock(page);
	await page.reload();

	await expectTaskInputs(page, 'Deep work', [5, 8, 5]);
});

test('a past task can be deleted', async ({ page }) => {
	await seedPastDay(page, 7, ['Deep work', 'Inbox']);

	await taskRow(page, 'Deep work')
		.getByRole('button', {
			name: 'Delete task',
		})
		.click();

	await expect(taskRow(page, 'Deep work')).toHaveCount(0);

	await flushAutosaveOnFakedClock(page);
	await page.reload();

	await expect(taskRow(page, 'Inbox')).toBeVisible();
	await expect(taskRow(page, 'Deep work')).toHaveCount(0);
});

/* The house rule for every delete but a routine's: no confirm step, the toast is the
   way back — on a past day as on today. */
test('a past deletion is undone from its toast', async ({ page }) => {
	await seedPastDay(page, 7, ['Deep work', 'Inbox']);

	// Two tied rows draw newest-first; whatever the order, the undo must keep it.
	const rows = taskCard(page).getByRole('listitem');

	await expect(rows).toContainText(['Inbox', 'Deep work']);

	await taskRow(page, 'Deep work')
		.getByRole('button', {
			name: 'Delete task',
		})
		.click();

	await expect(page.getByText('Deleted “Deep work”.')).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Undo',
		})
		.click();

	await expect(rows).toContainText(['Inbox', 'Deep work']);
});

test('a task can be added to a past day', async ({ page }) => {
	await seedPastDay(page, 7, ['Deep work']);

	await addTask(page, 'what I forgot to write down');
	await expect(taskRow(page, 'what I forgot to write down')).toBeVisible();

	await flushAutosaveOnFakedClock(page);
	await page.reload();

	await expect(taskRow(page, 'what I forgot to write down')).toBeVisible();
});

/* The case that motivated the whole change: a budget declared wrong, noticed the
   morning after. */
test('a past day’s declared hours can be corrected', async ({ page }) => {
	await seedPastDay(page, 7, ['Deep work'], 3);

	await openTimeBudget(page, /3h budget/);
	await setBudget(page, 2);

	await flushAutosaveOnFakedClock(page);
	await page.reload();

	await expect(page.getByText(/2h budget/)).toBeVisible();
});

/* The one asymmetry with today, and it is deliberate. The defer's only home is the
   advice card, so one test pins both absences. */
test('a past day offers neither the defer nor the plan advice', async ({ page }) => {
	await seedPastDay(page, 7, ['Deep work'], 3);
	await expect(taskRow(page, 'Deep work')).toBeVisible();

	await expect(page.getByText('Adjust the plan')).toHaveCount(0);

	await expect(
		page.getByRole('button', {
			name: /to tomorrow/i,
		}),
	).toHaveCount(0);
});

test('a day ahead offers neither measurement', async ({ page }) => {
	await seedDay(page, 3, ['Deep work']);

	await expect(taskRow(page, 'Deep work')).toBeVisible();

	await expect(
		page.getByRole('button', {
			name: 'Log time to flow',
		}),
	).toHaveCount(0);

	await expect(
		page.getByRole('button', {
			name: 'Log end-of-session drain',
		}),
	).toHaveCount(0);
});

/* The rails are not a today-only reading — a past day draws the plan it was made
   under. Seeded through the clock, so the plan was made on the day itself. */
test('a past day draws the rails it was planned under', async ({ page }) => {
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

	// The rail is what has to redraw — the row's title would read the same on a day
	// that funded nothing.
	const rail = taskRow(page, 'Deep work').getByText('warming up');

	await expect(rail).toBeAttached();

	// No time of day, on a past day as on today.
	await expect(page.getByText(/\d{2}:\d{2}/)).toHaveCount(0);

	// A past day saves its completions as a WHOLE record, so every field that
	// write does not carry is a field it erases — the budget the rail is drawn
	// against included.
	await taskRow(page, 'Deep work').getByRole('checkbox').check();
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(rail).toBeAttached();
});

/* The ± beside ϕ is the fit's own spread, so it can only appear once a fit has read a
   log — and no plan reads the ⚡ dated on its own day (`fitFrom`). That
   makes midnight the only place a browser can watch the band arrive, and these two
   tests are the same arc: nothing to be unsure about, then something. */
test('a fresh profile plans with no ± beside the flow time', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing');

	await expect(taskRow(page, 'Boxing')).not.toContainText('±');
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

	await expect(taskRow(page, 'Inbox')).toContainText('±');
});
