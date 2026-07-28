import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { AUTOSAVE_MS, addTask, openDataMenu } from './helpers';

/* The data menu is the only path by which the whole database leaves and re-enters
   the browser, and every step of it is browser-only: a Blob download, a hidden
   file <input>, and the location.reload() the stores re-read IndexedDB on. Nothing
   below the UI can prove the round trip, because the repository tests never see
   the reload. */

test('export writes a backup that import restores after a wipe', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await page.waitForTimeout(AUTOSAVE_MS);

	await openDataMenu(page);

	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page
			.getByRole('menuitem', {
				name: 'Export data',
			})
			.click(),
	]);

	expect(download.suggestedFilename()).toMatch(/^fallow-backup-\d{4}-\d{2}-\d{2}\.json$/);
	const backupPath = (await download.path())!;
	const backup = JSON.parse(await readFile(backupPath, 'utf8'));
	expect(backup.app).toBe('fallow');
	expect(JSON.stringify(backup.stores.sessions)).toContain('Boxing training');

	// Export is the one action of the three that does not reload, so its toast is
	// the live one.
	await expect(page.getByText('Backup downloaded.')).toBeVisible();

	// Wipe first and prove it took, or the restore assertion below would pass on
	// data that was never removed.
	page.once('dialog', (dialog) => dialog.accept());
	await openDataMenu(page);

	await page
		.getByRole('menuitem', {
			name: 'Delete all data',
		})
		.click();

	// Delete and import both end in location.reload(), which destroys the live
	// toaster — so seeing these two proves the sessionStorage hand-off, which is
	// the only part of the queue no unit test can reach.
	await expect(page.getByText('All data deleted.')).toBeVisible();
	await expect(page.getByText('No tasks deployed yet')).toBeVisible();

	await page.locator('input[type="file"]').setInputFiles(backupPath);
	await expect(page.getByText('Backup restored.')).toBeVisible();
	await expect(page.getByText('Boxing training').first()).toBeVisible();
	await expect(page.getByText('No tasks deployed yet')).not.toBeVisible();

	// The queue is consumed, not replayed. A bare `not.toBeVisible()` after a
	// goto proves nothing — it passes on its first poll, before hydration has run
	// the flush at all. So raise a fresh toast on the new page first: once THAT
	// is on screen the flush has demonstrably run, and the toaster holding
	// exactly one toast is a real assertion.
	await page.goto('/');
	await openDataMenu(page);

	await Promise.all([
		page.waitForEvent('download'),
		page
			.getByRole('menuitem', {
				name: 'Export data',
			})
			.click(),
	]);

	await expect(page.getByText('Backup downloaded.')).toBeVisible();
	await expect(page.locator('[data-sonner-toast]')).toHaveCount(1);
});

// $importAllStores refuses anything without app: 'fallow' — and it must refuse it
// before the merge transaction opens, so the day already on screen is untouched.
test('a file that is not a backup is refused and changes nothing', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await page.waitForTimeout(AUTOSAVE_MS);

	// A native dialog would block the run; the failure is a toast now, so any
	// dialog appearing here is itself the regression.
	const dialogs: string[] = [];

	page.on('dialog', (dialog) => {
		dialogs.push(dialog.message());

		return dialog.accept();
	});

	await page.locator('input[type="file"]').setInputFiles({
		name: 'holiday-photos.json',
		mimeType: 'application/json',
		buffer: Buffer.from('{"app":"something-else","stores":{}}'),
	});

	await expect(
		page.getByText("Import failed — this doesn't look like a Fallow backup file."),
	).toBeVisible();

	expect(dialogs).toEqual([]);

	// No reload happened, so the task is still the one added above.
	await expect(page.getByText('Boxing training').first()).toBeVisible();
});
