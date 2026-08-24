import { expect, test, type Page } from '@playwright/test';
import { addTask, AUTOSAVE_MS, budgetField, isoDate, openTimeBudget, setBudget } from './helpers';

test('setting the time budget feeds the plan', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');

	// a fresh profile has no history to prefill from, so the day opens on 0 — and
	// the card, having something to ask for, opens with it
	await setBudget(page, 8);

	// Metrics leave N/A once tasks + budget exist. Human Capacity is the witness:
	// it is one of the four headline tiles, so it is on screen without opening
	// anything, and it is undefined without both inputs. Fallow Gain used to
	// stand in for this and no longer can — it judges the allocator rather than
	// the day, so it is not a tile and renders hidden inside the disclosure.
	const humanCapacity = page
		.locator('div')
		.filter({
			has: page.getByText('Human Capacity', {
				exact: true,
			}),
		})
		.last();

	await expect(humanCapacity.getByText(/^\d+%$/)).toBeVisible();

	// summary renders only while the card is collapsed
	await page
		.getByRole('button', {
			name: 'Time Budget',
		})
		.click();

	await expect(page.getByText(/8h budget/)).toBeVisible();
});

/* The budget has a slider so the day can be explored by dragging it. The whole
   plan is one `$derived`, so each step re-solves it — which is the thing only an
   e2e can see: the store and the allocator have to be in the loop, and the drag
   commits nothing but the value the field already holds. */
test('the budget slider re-solves the plan live', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);

	const allocated = page.getByText(/^Allocated: /);
	await expect(allocated).not.toHaveText('Allocated: 0.00h');

	// No blur: the plan follows the drag itself, and the field is the same value.
	await page.getByLabel('Budget hours').fill('0');

	await expect(budgetField(page)).toHaveValue('0');
	await expect(allocated).toHaveText('Allocated: 0.00h');
});

/* The session lives in client-side IndexedDB, so the server cannot know whether
   the day has hours — and must not guess. Guessing "unset" opened the panel in
   the SSR'd HTML for every visitor, including one whose day is set, who then
   watched it collapse once the read landed. */
test.describe('server-rendered, before the day is read', () => {
	test.use({
		javaScriptEnabled: false,
	});

	test('the time budget bar is collapsed', async ({ page }) => {
		await page.goto('/');

		await expect(
			page.getByRole('button', {
				name: 'Time Budget',
			}),
		).toHaveAttribute('aria-expanded', 'false');

		await expect(budgetField(page)).toBeHidden();
	});
});

/* The bar opens itself while the viewed day has no hours, so the input that fixes
   that is never hidden behind a disclosure. That has to track the day on screen:
   it used to be a snapshot of whichever day the tab booted on, which outlived
   every date change for the life of the session.

   Since ROADMAP item 16 a day with no session of its own is not such a day — it
   opens on what that weekday's hours usually are — so the day that still has
   something to ask for is one whose 0 the user typed. Staging it is what proves
   the prefill reaches the page at all. */
test('the bar follows the day on screen, not the day the tab booted on', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);
	await page.waitForTimeout(AUTOSAVE_MS);

	// Tomorrow has no session, so it opens on today's 8h and stays collapsed.
	await page.goto(`/?date=${isoDate(1)}`);
	await openTimeBudget(page, /8h budget/);
	await expect(budgetField(page)).toHaveValue('8');

	// A 0 the user typed, which no prefill overwrites.
	await addTask(page, 'Nothing planned');
	await setBudget(page, 0);
	await page.waitForTimeout(AUTOSAVE_MS);

	// Boot on that day: hours at 0, so the bar opens itself.
	await page.goto(`/?date=${isoDate(1)}`);
	await expect(budgetField(page)).toHaveValue('0');

	// Today has 8h — the bar has nothing left to ask for, so it gets out of the way.
	// The nav's first item is the way back: it shows the viewed date and returns.
	await page
		.getByRole('link', {
			name: /return to today/,
		})
		.click();

	await expect(
		page.getByRole('button', {
			name: 'Time Budget',
		}),
	).toHaveAttribute('aria-expanded', 'false');
});

/** One of the bar's stepper fields, set the way the user does: type, then blur. */
async function setConstraint(page: Page, id: string, value: number) {
	const field = page.locator(id);

	await field.fill(String(value));
	await field.blur();
}

/* ROADMAP item 32: the switch cost and the pools carry over to a day with no
   session of its own, the way item 16's hours do — from the last day that
   declared them, not from that weekday. Staging a second day is what proves the
   fold reaches the page, and the collapsed summary is where a day the user has
   not opened shows all three. */
test('an unseen day opens on the last declared switch cost and pools', async ({ page }) => {
	await page.goto('/');
	// No task: touching a constraint is itself what saves the day, which is the
	// half of the rule the store's spec states as "saved for a reason of its own".
	await setBudget(page, 8);
	await setConstraint(page, '#switch-cost', 45);
	await setConstraint(page, '#cognitive-pool', 3);
	await setConstraint(page, '#physical-pool', 7);
	await page.waitForTimeout(AUTOSAVE_MS);

	// Tomorrow has no session, so it opens on today's constraints and stays
	// collapsed — 8h is the overall median, tomorrow's own weekday having none.
	await page.goto(`/?date=${isoDate(1)}`);

	await expect(page.getByText(/3h mind · 7h body · 45m switch/)).toBeVisible();
});

/* Fallow allocates durations, not appointments: the model has no notion of when
   the day begins, so the strip prints no time of day at all. It once carried a
   per-day start time that anchored one label and nothing else
   (docs/features/the-plan-that-had-no-clock.md); the field and the label are
   both gone. `availableHours` is intended work, not a span of the clock, so any
   clock read off the strip is one nobody computed (presentation/AGENTS.md). */
test('the day strip prints no clock', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);

	const timeline = page.locator('section').filter({
		has: page.getByRole('heading', {
			name: 'The day',
			exact: true,
		}),
	});

	await expect(timeline.getByText('#1 Deep work')).toBeVisible();
	await expect(timeline.getByText(/\d{2}:\d{2}/)).toHaveCount(0);
});
