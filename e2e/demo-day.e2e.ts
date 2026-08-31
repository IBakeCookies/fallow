import { expect, test, type Page } from '@playwright/test';
import { AUTOSAVE_MS, addTask, taskCard, taskRow } from './helpers';

/* The example day a shared link opens on. Every title here is a literal because
   Playwright cannot import app code (helpers.ts) — the fixture's own titles are
   paraglide messages, and these are their English values. */
const DEMO_TASKS = [
	'Write the search feature',
	'Design the system architecture',
	'Read the statistics textbook',
	'Strength training',
	'Swim training',
	'Learn to plaster the hallway',
];

const gainTile = (page: Page) =>
	page
		.locator('div')
		.filter({
			has: page.getByText('Fallow Gain', {
				exact: true,
			}),
		})
		.last();

test('a shared link opens on a solved plan', async ({ page }) => {
	await page.goto('/?demo');

	for (const title of DEMO_TASKS) await expect(taskRow(page, title)).toBeVisible();

	// The split is the whole point of the day: one task the plan refuses to fund,
	// under its own heading, and every other row carrying hours. `exact`, or `0m`
	// matches every `30m` in the Planned column too.
	await expect(taskCard(page).getByText('No time today')).toBeVisible();

	await expect(
		taskCard(page).getByText('0m', {
			exact: true,
		}),
	).toHaveCount(1);

	await expect(
		taskRow(page, DEMO_TASKS[5]).getByText('0m', {
			exact: true,
		}),
	).toBeVisible();

	// Signed from the value in the dashboard, so a plus is the claim that the
	// allocator beat the equal split.
	await expect(gainTile(page)).toContainText(/\+\d/);
});

test('an edit in the demo does not survive a reload', async ({ page }) => {
	await page.goto('/?demo');
	await expect(taskRow(page, DEMO_TASKS[0])).toBeVisible();

	const checkbox = taskRow(page, DEMO_TASKS[0]).getByRole('checkbox');

	await checkbox.check();
	await expect(checkbox).toBeChecked();

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/?demo');

	for (const title of DEMO_TASKS) await expect(taskRow(page, title)).toBeVisible();

	await expect(taskRow(page, DEMO_TASKS[0]).getByRole('checkbox')).not.toBeChecked();

	// And their own day, which is where a leaked write would have landed: the demo
	// re-seeds whatever is stored, so reloading `/?demo` alone proves nothing.
	await page.goto('/');
	await expect(page.getByText('No tasks deployed yet')).toBeVisible();
});

test('an existing user’s saved day is shadowed, not touched', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'My own task');
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/?demo');

	await expect(taskRow(page, DEMO_TASKS[0])).toBeVisible();
	await expect(taskRow(page, 'My own task')).toHaveCount(0);
});

test('dropping the param returns them to their own day', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'My own task');
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/?demo');
	await expect(taskRow(page, DEMO_TASKS[0])).toBeVisible();

	await page.goto('/');

	await expect(taskRow(page, 'My own task')).toBeVisible();
	await expect(taskRow(page, DEMO_TASKS[0])).toHaveCount(0);
});

test('the banner starts their own day', async ({ page }) => {
	await page.goto('/?demo');

	const banner = page.getByRole('alert');

	await expect(banner).toContainText('example day');

	await banner
		.getByRole('link', {
			name: 'Start my own day',
		})
		.click();

	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByText('No tasks deployed yet')).toBeVisible();
	await expect(banner).toHaveCount(0);
});

test('the example day comes and goes without a reload', async ({ page }) => {
	await page.goto('/');

	// Both hops client-side: a full load re-boots the store, and that is what made
	// every other test here pass over a store that never restored the real day.
	await page
		.getByRole('link', {
			name: 'See an example day',
		})
		.click();

	await expect(taskRow(page, DEMO_TASKS[0])).toBeVisible();

	await page
		.getByRole('alert')
		.getByRole('link', {
			name: 'Start my own day',
		})
		.click();

	await expect(page.getByText('No tasks deployed yet')).toBeVisible();
	await expect(taskRow(page, DEMO_TASKS[0])).toHaveCount(0);
});

test('the empty state offers the example day', async ({ page }) => {
	await page.goto('/');

	await page
		.getByRole('link', {
			name: 'See an example day',
		})
		.click();

	await expect(taskRow(page, DEMO_TASKS[0])).toBeVisible();
});
