import { expect, test } from '@playwright/test';
import { addTask, isoDate } from './helpers';

test('past day is read-only with a banner', async ({ page }) => {
	await page.goto(`/?date=${isoDate(-3)}`);
	await expect(page.getByText('Viewing a past day:')).toBeVisible();
	await expect(page.getByPlaceholder('e.g., Boxing training')).not.toBeVisible();

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
});

test('future day shows the planning-ahead banner', async ({ page }) => {
	await page.goto(`/?date=${isoDate(3)}`);
	await expect(page.getByText('Planning ahead:')).toBeVisible();

	// planning is allowed: form stays available
	await expect(
		page.getByText('+ Add Task').or(page.getByPlaceholder('e.g., Boxing training')),
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

	const row = page.locator('li').filter({
		hasText: 'Boxing',
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
