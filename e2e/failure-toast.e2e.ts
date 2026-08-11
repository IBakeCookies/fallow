import { expect, test } from '@playwright/test';
import {
	AUTOSAVE_MS,
	addTask,
	installFailableIndexedDB,
	openDataMenu,
	setIndexedDBFailing,
	setIndexedDBStoreFailing,
	setIndexedDBTransactionsFailing,
} from './helpers';

/* The failures that used to be logged and nothing else. Each of these renders a
   screen that looks *fine* — an empty calendar, an empty year of history, sliders
   on their defaults — so the toast is the only thing distinguishing "broken" from
   "you have no data yet". None of it is reachable below the UI: the read has to
   fail inside a mounted store, on a page that has already painted. */

test('a calendar whose history will not load says so, once per outage', async ({ page }) => {
	await installFailableIndexedDB(page);
	await page.goto('/');
	await setIndexedDBFailing(page, true);
	await page.goto('/calendar');

	await expect(page.getByText("Couldn't load your calendar history.")).toBeVisible();

	// The range load re-runs per month step and every one of them fails. One
	// outage is one report — the regression was N toasts for N clicks. Counted by
	// message, not by toast: the Energy Lab's params read fails in this outage
	// too, and it is layout-scoped, so it reports here on its own account.
	const nextMonth = page.getByRole('button', {
		name: 'Next',
	});

	for (let step = 0; step < 3; step += 1) await nextMonth.click();

	await expect(page.getByText("Couldn't load your calendar history.")).toHaveCount(1);
});

/* The test above never reaches the range load — `initializeStorage()` rejects
   first and the gate swallows everything after it. This is the other path: the
   database opens, the first month renders, and a later step fails. */
test('a month step that fails to load reports it, and re-arms after a good step', async ({
	page,
}) => {
	await page.goto('/calendar');

	const nextMonth = page.getByRole('button', {
		name: 'Next',
	});

	await expect(nextMonth).toBeVisible();

	await setIndexedDBTransactionsFailing(page, true);
	await nextMonth.click();

	const message = page.getByText("Couldn't load your calendar history.");

	await expect(message).toBeVisible();

	// Re-armed on a success: the gate suppresses repeats within one outage, not
	// the report for the next one.
	await setIndexedDBTransactionsFailing(page, false);
	await nextMonth.click();
	await expect(message).toHaveCount(0);

	await setIndexedDBTransactionsFailing(page, true);
	await nextMonth.click();
	await expect(message).toBeVisible();
});

test('analytics says the empty charts are a failure, not an empty history', async ({ page }) => {
	await installFailableIndexedDB(page);
	await page.goto('/');
	await setIndexedDBFailing(page, true);
	await page.goto('/analytics');

	await expect(
		page.getByText("Couldn't load your history — the charts below are empty, not your data."),
	).toBeVisible();
});

/* The other half of that load: the history lands and only the model report fails,
   which raises no toast because the cards it feeds are already on screen. They
   must say so — "Needs finished days with 🪫 drain logs" is advice about the
   user's data, and the read that would have justified it never returned. */
test('a failed model report says so, not "no logs yet"', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await page.waitForTimeout(AUTOSAVE_MS);

	// Only the ☕ store: the history read does not touch it, so the page paints.
	await setIndexedDBStoreFailing(page, 'restObservations');

	// Client-side, so the patch above survives — it is not an init script.
	await page
		.getByRole('link', {
			name: 'Analytics',
		})
		.click();

	const adherence = page
		.locator('div', {
			has: page.getByRole('heading', {
				name: 'Plan adherence',
			}),
		})
		.last();

	await expect(adherence.getByText('Something went wrong')).toBeVisible({
		timeout: 15000,
	});

	await expect(page.getByText(/Needs finished days with/)).not.toBeVisible();

	// The history half succeeded: no toast, and the stats are real.
	await expect(page.getByText("Couldn't load your history")).not.toBeVisible();
	await expect(page.getByText('Nothing to analyze in this range yet.')).not.toBeVisible();
});

test('the Energy Lab says its saved parameters could not be read', async ({ page }) => {
	await installFailableIndexedDB(page);
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await setIndexedDBFailing(page, true);
	await page.goto('/energy');

	await expect(
		page.getByText("Couldn't load your Energy Lab parameters — showing the defaults."),
	).toBeVisible();
});

test('a failed export reports the failure instead of a phantom download', async ({ page }) => {
	await installFailableIndexedDB(page);
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await page.waitForTimeout(AUTOSAVE_MS);

	// The reload is required, not incidental: `openDatabase()` caches its handle
	// in module scope, so flipping the switch on a page that has already opened
	// the database changes nothing. A fresh document retries the open and fails.
	await setIndexedDBFailing(page, true);
	await page.reload();

	await openDataMenu(page);

	await page
		.getByRole('menuitem', {
			name: 'Export data',
		})
		.click();

	await expect(
		page.getByText("Couldn't create the backup file — nothing was written."),
	).toBeVisible();

	await expect(page.getByText('Backup downloaded.')).not.toBeVisible();
});

// The irreversible action: it must never reload as though the wipe succeeded,
// because the reload is the only thing the user reads as confirmation.
test('a failed wipe says nothing was removed and keeps the data', async ({ page }) => {
	await installFailableIndexedDB(page);
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await page.waitForTimeout(AUTOSAVE_MS);

	await setIndexedDBFailing(page, true);
	await page.reload();

	page.once('dialog', (dialog) => dialog.accept());
	await openDataMenu(page);

	await page
		.getByRole('menuitem', {
			name: 'Delete all data',
		})
		.click();

	await expect(page.getByText("Couldn't delete your data — nothing was removed.")).toBeVisible();
	await expect(page.getByText('All data deleted.')).not.toBeVisible();

	// Not "the task is still on screen" — reads are broken in this state, so the
	// page is empty either way. Repair storage and reload: the task coming back is
	// what proves the wipe really did nothing.
	await setIndexedDBFailing(page, false);
	await page.reload();
	await expect(page.getByText('Boxing training').first()).toBeVisible();
});
