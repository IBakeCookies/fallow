import { expect, test } from '@playwright/test';
import {
	AUTOSAVE_MS,
	addTask,
	installFailableIndexedDB,
	logDrain,
	setIndexedDBFailing,
	setIndexedDBTransactionsFailing,
} from './helpers';

/* The storage banner is the app's only report that persistence broke, and its two
   kinds behave differently on purpose: a failed READ is retryable, a failed WRITE
   has already lost the edit. Each store's own spec covers its `storageError`
   field, but the wiring the banner depends on lives in the (app) layout — most
   importantly that one retry click re-runs BOTH stores' retryLoad(), which
   AGENTS.md §5 flags as the thing that rots when a store is added. */

test('one retry click recovers both stores after a failed read', async ({ page }) => {
	await installFailableIndexedDB(page);

	// Seed something each store owns: the session owns the task, and
	// EnergyObservationStore owns the drain rating.
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');
	await logDrain(page, 120, 9, 5);
	await expect(page.getByText('1 drain ratings recorded')).toBeVisible();

	await setIndexedDBFailing(page, true);
	await page.reload();

	// A failed read is retryable, so the banner says so and offers the action.
	const banner = page.getByRole('alert');
	await expect(banner).toContainText('An unexpected error occurred');

	const retry = banner.getByRole('button', {
		name: 'Reload page',
	});

	await expect(retry).toBeVisible();
	// Neither store loaded: no task for the Lab to plan, and no rating.
	await expect(page.getByText('No open tasks for today.')).toBeVisible();

	await setIndexedDBFailing(page, false);
	await retry.click();

	await expect(banner).toHaveCount(0);
	// The session store recovered…
	await expect(page.getByText('Boxing training').first()).toBeVisible();
	// …and so did the observation store, which only its own retryLoad() restores.
	await expect(page.getByText('1 drain ratings recorded')).toBeVisible();
});

/* The write path fails on the cached database handle, long after any open() —
   so breaking `transaction` is what a real quota or InvalidState error looks
   like here. A lost write is not retryable: the banner states it and is only
   dismissable. */
test('a failed write says the edit may be lost and offers no retry', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await page.waitForTimeout(AUTOSAVE_MS);

	await setIndexedDBTransactionsFailing(page, true);

	// Any task mutation arms the autosave the broken transaction then fails.
	await addTask(page, 'Write report');
	await page.waitForTimeout(AUTOSAVE_MS);

	const banner = page.getByRole('alert');
	const message = "Couldn't save your latest changes — they may be lost if you close this tab.";

	await expect(banner).toContainText(message);

	await expect(
		banner.getByRole('button', {
			name: 'Reload page',
		}),
	).toHaveCount(0);

	// Dismissable, and it stays dismissed — the ✕ is labelled with the message.
	await banner
		.getByRole('button', {
			name: message,
		})
		.click();

	await expect(banner).toHaveCount(0);
});
