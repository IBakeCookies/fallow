import { expect, test, type Page } from '@playwright/test';
import {
	AUTOSAVE_MS,
	addTask,
	expectTaskInputs,
	isoDate,
	logDrain,
	openTaskForm,
	setBudget,
	taskCard,
	taskRow,
} from './helpers';

/* A running timer with time already on it, written the way `session-timer.ts` reads
   it back. The key is re-spelled here as an independent oracle (data/AGENTS.md's
   note on R8 step 4); the only other route to a nonzero reading is 30 seconds of
   wall clock per test, since the field takes whole minutes. */
const plantRunningTimer = (page: Page, minutes: number) =>
	page.evaluate((timer) => localStorage.setItem('fallow:session-timer', JSON.stringify(timer)), {
		phase: 'running',
		startedOn: isoDate(0),
		runningSince: Date.now(),
		accumulatedMs: minutes * 60_000,
	});

const drainForm = (page: Page) =>
	page.locator('form').filter({
		hasText: 'After the session',
	});

/* Row-scoped: two rows can hold an open editor at once, which `drainForm` would both
   match. */
const rowDrainForm = (page: Page, title: string) =>
	taskRow(page, title).locator('form').filter({
		hasText: 'After the session',
	});

const openDrainEditor = (page: Page, title: string) =>
	taskRow(page, title)
		.getByRole('button', {
			name: 'Log end-of-session drain',
		})
		.click();

test('fresh profile shows the empty state', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('No tasks deployed yet')).toBeVisible();

	await expect(
		page.getByRole('link', {
			name: 'Today',
		}),
	).toBeVisible();
});

test('the page keeps its heading without drawing one', async ({ page }) => {
	await page.goto('/');

	const heading = page.getByRole('heading', {
		name: 'Fallow',
		exact: true,
	});

	// The document needs an <h1> above the explainer's <h2> and the app bar already
	// draws the name, so it is attached and unpainted — never a second title.
	await expect(heading).toBeAttached();
	await expect(heading).toHaveClass('sr-only');
});

test('added task appears and survives a reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');

	// The row, not the title: the Bottleneck metric names the same task once the plan
	// funds it (MATH.md §23.1), from inside the collapsed disclosure above the ledger.
	await expect(taskRow(page, 'Boxing training')).toBeVisible();
	await expect(page.getByText('No tasks deployed yet')).not.toBeVisible();

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();
	await expect(taskRow(page, 'Boxing training')).toBeVisible();
});

test('completing a task persists across reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');

	// Named, not the only one on the page: the task form carries a "must do today"
	// checkbox above the list, so a bare checkbox role is ambiguous.
	const checkbox = page.getByRole('checkbox', {
		name: 'Mark Write report complete',
	});

	await checkbox.check();
	await expect(checkbox).toBeChecked();

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(
		page.getByRole('checkbox', {
			name: 'Mark Write report complete',
		}),
	).toBeChecked();
});

test('removing a task restores the empty state', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Throwaway');
	await expect(taskRow(page, 'Throwaway')).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Delete task',
		})
		.click();

	await expect(page.getByText('No tasks deployed yet')).toBeVisible();
});

/* The ✕ is one click next to the ✎ and takes the task's sliders and ⚡ logs with
   it, so the delete is immediate and the toast is the way back. */
test('a deleted task comes back from the undo toast', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Throwaway');
	await addTask(page, 'Keep me');

	// The row, not its title: the title is also in the toast that reports the delete.
	const row = page.getByRole('checkbox', {
		name: 'Mark Throwaway complete',
	});

	await taskRow(page, 'Throwaway')
		.getByRole('button', {
			name: 'Delete task',
		})
		.click();

	await expect(row).toHaveCount(0);
	await expect(page.getByText('Deleted “Throwaway”.')).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Undo',
		})
		.click();

	await expect(row).toBeVisible();
	await expect(taskRow(page, 'Keep me')).toBeVisible();

	// The restored task has to survive the autosave that follows it — the removal was
	// already persisted by the time the undo ran.
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(row).toBeVisible();
});

/* The row's editors are the PAGE's state, keyed by task id, and the undo restores the
   task under its ORIGINAL id (`removeTask`) — so a draft the ✕ left behind is reachable
   again, and comes back as an editor nobody opened. Both measurements in one test:
   they are two paints of one editor policy and must not drift apart. */
test('undo brings a deleted task back with no editor open', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Throwaway');

	const row = taskRow(page, 'Throwaway');

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

	await expect(page.getByText('⚡ Minutes to reach flow:')).toBeVisible();
	await expect(page.getByText('🪫 After the session:')).toBeVisible();

	await row
		.getByRole('button', {
			name: 'Delete task',
		})
		.click();

	await page
		.getByRole('button', {
			name: 'Undo',
		})
		.click();

	await expect(
		page.getByRole('checkbox', {
			name: 'Mark Throwaway complete',
		}),
	).toBeVisible();

	await expect(page.getByText('⚡ Minutes to reach flow:')).toHaveCount(0);
	await expect(page.getByText('🪫 After the session:')).toHaveCount(0);
});

// ROADMAP items 15 and 24. Only an e2e covers the whole path this feature is: a
// stored day, the history read the store boots with, and the form that offers it
// back as you type.
test('a title picked from the suggestions brings its ratings with it', async ({ page }) => {
	await page.goto('/');

	// The task editor carries the same slider labels, so scope to the add form —
	// the only one with a "Task Definition" field.
	const form = page.locator('form').filter({
		has: page.getByLabel('Task Definition'),
	});

	await form.getByLabel('Task Definition').fill('Gym session');

	// Range inputs take keyboard steps; fill() refuses them.
	for (let step = 0; step < 3; step++) {
		await form.getByLabel('Physical Diff').press('ArrowRight');
		await form.getByLabel('Mental Diff').press('ArrowLeft');
		await form.getByLabel('Enjoyment').press('ArrowRight');
	}

	await form
		.getByRole('button', {
			name: 'Deploy Task',
		})
		.click();

	await expectTaskInputs(page, 'Gym session', [8, 2, 8]);
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(taskRow(page, 'Gym session')).toBeVisible();

	// The stored day has landed, so the form remounted closed behind its opener.
	await openTaskForm(page);

	// Typed, not filled: the suggestions answer to input events, and two
	// characters of the wrong case are all it takes.
	await form.getByLabel('Task Definition').pressSequentially('GY');

	await form
		.getByRole('option', {
			name: 'Gym session',
		})
		.click();

	await expect(form.getByLabel('Task Definition')).toHaveValue('Gym session');
	await expect(form.getByLabel('Physical Diff')).toHaveValue('8');
	await expect(form.getByLabel('Mental Diff')).toHaveValue('2');
	await expect(form.getByLabel('Enjoyment')).toHaveValue('8');
});

/* "Next" (MATH.md §35) carries a `nowrap` title, and `next-up-line.svelte` is a
   flex item of the card's header row — so without its `min-w-0` the longest task
   name sizes the row and the whole page scrolls sideways on a phone, with the
   title running off the card instead of eliding.

   BOTH halves are asserted, and neither alone is the test. Drop that `min-w-0`
   and the page widens, but the title is still clipped by its own `truncate` —
   the first assertion is the only one that notices. Drop `truncate` and the
   title wraps instead: a wrapping box's min-content is its longest WORD, so the
   page stays 390 wide and the first assertion passes a line that no longer
   elides at all. Together they pin the pair; either alone silently permits the
   other's removal. */
test('a long next-up title is clipped, never widening the page', async ({ page }) => {
	await page.setViewportSize({
		width: 390,
		height: 900,
	});

	await page.goto('/');
	await addTask(page, 're-derive the stopping-inversion margin from the measured distributions');
	await addTask(page, 'Gym session');

	// A fresh profile has no hours, and an unfunded remainder has no position 1.
	await setBudget(page, 6);

	// A 🪫 log is what gates the mid-day re-plan, and completing a task opens the
	// form by itself — leaving the long-titled one to be named as next. Filled in
	// place rather than through `logDrain`, whose first act is to open the form.
	await page
		.getByRole('checkbox', {
			name: 'Mark Gym session complete',
		})
		.check();

	const form = page.locator('form').filter({
		hasText: 'After the session',
	});

	const fields = form.locator('input[type="number"]');

	await fields.nth(0).fill('60');
	await fields.nth(1).fill('5');
	await fields.nth(2).fill('3');

	await form
		.getByRole('button', {
			name: '✓',
		})
		.click();

	await expect(
		page.getByRole('button', {
			name: 'Next',
		}),
	).toBeVisible();

	const overflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
	expect(overflow).toBeLessThanOrEqual(0);

	// Scoped to the card, and its FIRST match there: the heading's next-up line precedes
	// the rows, and the task row below renders the same title again. Page-wide, the
	// metrics grid names the same task as its bottleneck. Clipped, not merely narrow: a
	// box only overflows its own content box while it refuses to wrap.
	const title = taskCard(page)
		.getByText('re-derive the stopping-inversion margin from the measured distributions')
		.first();

	const width = await title.evaluate((el) => ({
		content: el.scrollWidth,
		box: el.clientWidth,
	}));

	expect(width.content).toBeGreaterThan(width.box);
});

/* ROADMAP item 14. The row's own arithmetic is a unit test (`remaining-day`,
   `metric-descriptor`); what only an e2e can see is the wiring — the page handing
   the mid-day re-plan to `buildMetrics` at all — so both halves of the gate are
   asserted here, before and after the day's first 🪫 log. */
test('capacity left reads N/A until a session is rated, then names what is spent', async ({
	page,
}) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await setBudget(page, 6);

	const row = page
		.locator('div')
		.filter({
			has: page.getByText('Capacity Left', {
				exact: true,
			}),
		})
		.last();

	await expect(row).toContainText('N/A');

	const form = page.locator('form').filter({
		hasText: 'After the session',
	});

	await page
		.getByRole('button', {
			name: 'Log end-of-session drain',
		})
		.click();

	const fields = form.locator('input[type="number"]');

	// 2 h on a 5/5 task draws 1 h of the 4-hour cognitive pool: three quarters left.
	await fields.nth(0).fill('120');
	await fields.nth(1).fill('5');
	await fields.nth(2).fill('3');

	await form
		.getByRole('button', {
			name: '✓',
		})
		.click();

	// A share, not a duration: pool hours are weighted ones (MATH.md §35).
	await expect(row).toContainText('75%');
});

/* Below `sm` the ledger drops the seven readings `ledger-wide` marks and keeps five —
   the lead, `Task`, `Logged`, `Planned` and the ✎/✕ strip — so a phone reads the plan's
   answer without dragging the table sideways. Both halves are the test: the columns are
   gone AND the document still does not scroll, since hiding cells is only correct while
   nothing else widens the page. The container keeps its `overflow-x: auto` — between
   `sm` and the twelve columns' own width it is still the thing that scrolls. */
test("a phone reads five of the ledger's columns, and the page does not scroll", async ({
	page,
}) => {
	await page.setViewportSize({
		width: 390,
		height: 900,
	});

	await page.goto('/');
	await setBudget(page, 6);
	await addTask(page, 'Design the error boundary');
	await addTask(page, 'Write the PDF solution');
	await addTask(page, 'Review 1 PR API');

	const table = page.locator('table').first();
	await expect(table).toBeVisible();

	const header = table.locator('thead th');

	for (const label of ['Phys', 'Ment', 'Enjoy', 'Effort', 'Prio', 'Flow at', 'Stop by']) {
		await expect(
			header.getByText(label, {
				exact: true,
			}),
		).toBeHidden();
	}

	for (const label of ['#', 'Task', 'Logged', 'Planned']) {
		await expect(
			header.getByText(label, {
				exact: true,
			}),
		).toBeVisible();
	}

	const overflowX = await table.evaluate(
		(element) => getComputedStyle(element.parentElement!).overflowX,
	);

	expect(overflowX).toBe('auto');

	const document = await page.evaluate(() => ({
		content: window.document.documentElement.scrollWidth,
		box: window.document.documentElement.clientWidth,
	}));

	expect(document.content).toBe(document.box);
});

/* The timer's whole point: the minutes reach the 🪫 form without being recalled.
   Only an e2e sees the path — the control on the card's heading row, the reading
   `localStorage` carries, and the editor on a row that never heard of either. */
test('stopping the timer fills the next drain editor', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await openDrainEditor(page, 'Write report');
	await expect(drainForm(page).locator('input[type="number"]').first()).toHaveValue('45');
});

/* MATH.md §18 — one 🪫 row per session. The reading funds the log that spends it and
   no other, or the second row re-saves hours the day already counts. */
test('one stop funds one log', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await addTask(page, 'Gym session');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await openDrainEditor(page, 'Write report');
	const fields = drainForm(page).locator('input[type="number"]');
	await expect(fields.first()).toHaveValue('45');
	await fields.nth(1).fill('5');
	await fields.nth(2).fill('3');

	await drainForm(page)
		.getByRole('button', {
			name: '✓',
		})
		.click();

	await openDrainEditor(page, 'Gym session');
	await expect(drainForm(page).locator('input[type="number"]').first()).toHaveValue('');
});

/* The reading outlives the tab, which is why it is written at all: a session ends
   with a reload as often as with a click. */
test('the stopped reading survives a reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await page.reload();

	await openDrainEditor(page, 'Write report');
	await expect(drainForm(page).locator('input[type="number"]').first()).toHaveValue('45');
});

/* Correcting a rating rewrites a session already counted (MATH.md §18), so it never
   spends the timed one — the reading is still there for the log it belongs to. */
test('a correction does not spend the stopped reading', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await logDrain(page, 60, 5, 3);
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await taskRow(page, 'Write report')
		.getByRole('button', {
			name: 'Correct this drain rating',
		})
		.click();

	await drainForm(page)
		.getByRole('button', {
			name: '✓',
		})
		.click();

	await openDrainEditor(page, 'Write report');
	await expect(drainForm(page).locator('input[type="number"]').first()).toHaveValue('45');
});

/* Several rows hold an open 🪫 editor at once — ticking two tasks done opens two — and
   the stopped reading is one session's (MATH.md §18). The first editor opened claims it;
   any other opens empty and spends nothing, and closing the claim hands it back. */
test('a second drain editor opened over the reading opens empty', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await addTask(page, 'Gym session');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await openDrainEditor(page, 'Write report');
	await openDrainEditor(page, 'Gym session');

	const claimed = rowDrainForm(page, 'Write report').locator('input[type="number"]');
	const unclaimed = rowDrainForm(page, 'Gym session').locator('input[type="number"]');

	await expect(claimed.first()).toHaveValue('45');
	await expect(unclaimed.first()).toHaveValue('');

	// The row that opened empty rates its own session and leaves the reading where it was.
	await unclaimed.first().fill('30');
	await unclaimed.nth(1).fill('5');
	await unclaimed.nth(2).fill('3');

	await rowDrainForm(page, 'Gym session')
		.getByRole('button', {
			name: '✓',
		})
		.click();

	await rowDrainForm(page, 'Write report')
		.getByRole('button', {
			name: '✕',
		})
		.click();

	await openDrainEditor(page, 'Write report');
	await expect(claimed.first()).toHaveValue('45');
});

/* The ledger is what the page is for, so it reads before the day's readings: the metrics
   grid above it put the table's header past the fold at every desktop size. */
test('the ledger reads above the day metrics', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');

	const ledger = await page
		.getByRole('columnheader', {
			name: 'Task',
			exact: true,
		})
		.boundingBox();

	const readings = await page
		.getByText('Momentum', {
			exact: true,
		})
		.boundingBox();

	expect(ledger?.y).toBeLessThan(readings?.y ?? 0);
});

/* One reading, one rule, on both screens that hold a 🪫 editor: the Lab seeds from the
   stopped reading and spends it, so a session rated there cannot be rated again here. */
test('the Lab seeds and spends the same stopped reading', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await page.goto('/energy');
	await openDrainEditor(page, 'Write report');

	const fields = rowDrainForm(page, 'Write report').locator('input[type="number"]');
	await expect(fields.first()).toHaveValue('45');
	await fields.nth(1).fill('5');
	await fields.nth(2).fill('3');

	await rowDrainForm(page, 'Write report')
		.getByRole('button', {
			name: '✓',
		})
		.click();

	await page.goto('/');
	await openDrainEditor(page, 'Write report');

	await expect(
		rowDrainForm(page, 'Write report').locator('input[type="number"]').first(),
	).toHaveValue('');
});
