import { expect, test } from '@playwright/test';
import { AUTOSAVE_MS, addTask, setBudget } from './helpers';

test('fresh profile shows the empty state', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('No tasks deployed yet')).toBeVisible();

	await expect(
		page.getByRole('link', {
			name: 'Today',
		}),
	).toBeVisible();
});

test('added task appears and survives a reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');

	// title also appears in the Bottleneck metric once the plan funds the task
	// (MATH.md §23.1) — scope to first match, which is the task list: the metrics
	// card renders after it, and Bottleneck sits inside the closed disclosure
	await expect(page.getByText('Boxing training').first()).toBeVisible();
	await expect(page.getByText('No tasks deployed yet')).not.toBeVisible();

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();
	await expect(page.getByText('Boxing training').first()).toBeVisible();
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
	await expect(page.getByText('Throwaway').first()).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Delete task',
		})
		.click();

	await expect(page.getByText('No tasks deployed yet')).toBeVisible();
});

/* The ✕ is one hover-revealed click next to the ✎ and takes the task's sliders and
   ⚡ logs with it, so the delete is immediate and the toast is the way back. */
test('a deleted task comes back from the undo toast', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Throwaway');
	await addTask(page, 'Keep me');

	// The row, not its title: the title is also in the toast that reports the delete.
	const row = page.getByRole('checkbox', {
		name: 'Mark Throwaway complete',
	});

	await page
		.locator('li')
		.filter({
			hasText: 'Throwaway',
		})
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
	await expect(page.getByText('Keep me').first()).toBeVisible();

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

	const row = page.locator('li').filter({
		hasText: 'Throwaway',
	});

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

	await expect(page.getByText('P 8 · M 2 · E 8')).toBeVisible();
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	// The form is still open: it samples `isOpen` once, at mount, and the stored
	// day has not landed yet at that point.
	await expect(page.getByText('Gym session').first()).toBeVisible();

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

/* "Next" (MATH.md §35) carries a `nowrap` title, and a grid item's automatic
   minimum is its content's min-content width — so before `min-w-0` on the task
   column the longest task name sized the column and the whole page scrolled
   sideways on a phone, with the title running off the card instead of eliding.

   BOTH halves are asserted, and neither alone is the test. Drop the column's
   `min-w-0` and the page widens, but the title is still clipped by its own
   `truncate` — the first assertion is the only one that notices. Drop `truncate`
   and the title wraps instead: a wrapping box's min-content is its longest WORD,
   so the page stays 390 wide and the first assertion passes a line that no longer
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

	// First match is the header row's copy — the card's heading precedes its rows,
	// and the task row below renders the same title again. Clipped, not merely
	// narrow: a box only overflows its own content box while it refuses to wrap.
	const title = page
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

	// A reference reading, not a headline tile, so it starts inside the disclosure.
	await page.getByText(/more metrics/).click();

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
