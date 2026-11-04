import { expect, test, type Page } from '@playwright/test';
import { AUTOSAVE_MS, addTask, taskCard, taskRow, timeBudgetBar } from './helpers';

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

/* The `?demo` param is not the only way out: every nav link is a client-side
   navigation to another route under the same layout — and so the same store —
   which is what scopes the demo to the planner (`page.route.id`). */
test('a nav link leaves the example day', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'My own task');
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/?demo');
	await expect(taskRow(page, DEMO_TASKS[0])).toBeVisible();

	// Through the nav landmark: the page prose links to the Lab too.
	const nav = page.getByRole('navigation');

	await nav
		.getByRole('link', {
			name: 'Energy Lab',
		})
		.click();

	await expect(page.getByRole('alert')).toHaveCount(0);

	await nav
		.getByRole('link', {
			name: 'Today',
		})
		.click();

	await expect(taskRow(page, 'My own task')).toBeVisible();
	await expect(taskRow(page, DEMO_TASKS[0])).toHaveCount(0);
});

/* A visitor who leaves the example day lands on a day of their own, and nothing the
   example day did follows them there: not a row it deleted, and not the Day Setup it
   kept closed for its own hours.

   Tests: e2e/demo-day.e2e.ts — "an undo from the example day does not reach their own
     day", "their own day opens Day Setup after the example day";
     src/lib/business/store/session-store.svelte.spec.ts — "reports no loaded day until
     their own day replaces the example day"
   Pins: src/lib/business/store/energy-lab-store.svelte.spec.ts — "sorts the real day by
     its plan when the example day is left for the Lab", "holds the stop advice unready
     on the example day"; src/lib/business/store/energy-observation-store.svelte.spec.ts
     — "writes nothing while no day is loaded"
   The one test edit the build makes: `ReadLoadedDay` loses its flag, so
   energy-observation-store.svelte.spec.ts's `setup` loses its `isShowingDemo` parameter
   and "refuses a rating on the example day" goes. The example day is then a null date,
   which "writes nothing while no day is loaded" already pins.
   Out of scope:
   - S11, the edit inside the auto-save debounce that `#seedDemoDay` drops (ROADMAP).
   - The "what tomorrow already holds" effect: it reads the private flag and stays (M123).
   - A12 and A13, and any move of the Lab's state.
   - `+page.svelte`: its `{#key session.loadedDate}` and `isOpen` need no edit.
   Read before building:
   - src/lib/business/store/session-store.svelte.ts — the public `loadedDate` getter, the
     `isShowingDemo` getter, `#seedDemoDay`, and `removeTask`'s undo, which compares the
     private `#loadedDate` that the seed stamps with the viewed date (S9).
   - src/lib/business/store/energy-lab-store.svelte.ts — the order-snapshot `$effect` and
     `isStopAdviceReady`, the two Lab reads of `isShowingDemo`.
   - src/routes/(app)/+layout.svelte — the `ReadLoadedDay` thunk hands `logDrain` the flag.
   - src/lib/business/store/energy-observation-store.svelte.ts — `ReadLoadedDay` and
     `logDrain`'s two guards, which become one: the `!date` refusal.
   - src/lib/business/store/energy-lab-store.test-utils.svelte.ts — `MockSession`'s
     `loadedDate` type widens to `string | null`; its `isShowingDemo` field goes.
   - src/routes/(app)/+page.svelte — the constraints bar's `{#key session.loadedDate}`,
     which S10 needs to change when their own day lands.
   - src/lib/business/AGENTS.md — "`SessionStore` has a second day source" (the
     `#isShowingDemo` list and the "Editing still works" paragraph) and the drain
     store's "(`loadedDate`, `tasks` and `isShowingDemo` …)" line. Both shorten; the
     file is at its budget (`scripts/brief-size.mjs`).
   - ROADMAP.md — "Findings from the 2026-11-04 architecture review": A10, S9, S10, M123.
   Decisions:
   - The public `loadedDate` answers which stored day is on screen, so it reads null
     while the fixture shows, and `isShowingDemo` becomes private. Its readers then need
     no flag: `logDrain` refuses a null date already, and the Lab's guards compare dates.
   - `removeTask`'s undo captures the public `loadedDate` at removal and refuses when it
     differs, beside the existing mid-load guard. That refuses both directions, fixture
     to real day and real day to fixture, with one comparison.
   - The private `#loadedDate`, `#canEditPlan` and the auto-save keep the viewed date
     while the fixture shows, so editing the example day still works (M119's refusal).
   - The bar reads closed throughout the example day, as it does now: its `isOpen` is
     false on a null date, and the fixture has hours.
   - Rejected: a second getter beside `loadedDate` for "a stored day". It leaves two
     names for one question, and each reader still has to pick the right one.
   Roadmap: A10, S9, S10, M123 */
test('an undo from the example day does not reach their own day', async ({ page }) => {
	await page.goto('/?demo');

	await taskRow(page, DEMO_TASKS[0])
		.getByRole('button', {
			name: 'Delete task',
		})
		.click();

	await page
		.getByRole('alert')
		.getByRole('link', {
			name: 'Start my own day',
		})
		.click();

	await expect(page.getByText('No tasks deployed yet')).toBeVisible();

	// The toast is not dismissed by the navigation, so its Undo is still one click away.
	await page
		.getByRole('button', {
			name: 'Undo',
		})
		.click();

	// Through storage: the undo writes into whatever day is on screen.
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	// The empty state shows while the day loads; the bar opens only once it has landed.
	await expect(timeBudgetBar(page)).toHaveAttribute('open', '');
	await expect(taskRow(page, DEMO_TASKS[0])).toHaveCount(0);
});

test('their own day opens Day Setup after the example day', async ({ page }) => {
	await page.goto('/?demo');
	await expect(taskRow(page, DEMO_TASKS[0])).toBeVisible();

	await page
		.getByRole('alert')
		.getByRole('link', {
			name: 'Start my own day',
		})
		.click();

	await expect(page.getByText('No tasks deployed yet')).toBeVisible();

	// A fresh profile has no hours, so the bar opens to ask for them, as a fresh `/` does.
	await expect(timeBudgetBar(page)).toHaveAttribute('open', '');
});
