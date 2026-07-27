import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { AUTOSAVE_MS, addTask } from './helpers';

/* The data menu is the only path by which the whole database leaves and re-enters
   the browser, and every step of it is browser-only: a Blob download, a hidden
   file <input>, and the location.reload() the stores re-read IndexedDB on. Nothing
   below the UI can prove the round trip, because the repository tests never see
   the reload. */

function openDataMenu(page: Page) {
	return page
		.getByRole('button', {
			name: 'Data menu',
		})
		.click();
}

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

	// Wipe first and prove it took, or the restore assertion below would pass on
	// data that was never removed.
	page.once('dialog', (dialog) => dialog.accept());
	await openDataMenu(page);

	await page
		.getByRole('menuitem', {
			name: 'Delete all data',
		})
		.click();

	await expect(page.getByText('No tasks deployed yet')).toBeVisible();

	await page.locator('input[type="file"]').setInputFiles(backupPath);
	await expect(page.getByText('Boxing training').first()).toBeVisible();
	await expect(page.getByText('No tasks deployed yet')).not.toBeVisible();
});

// $importAllStores refuses anything without app: 'fallow' — and it must refuse it
// before the merge transaction opens, so the day already on screen is untouched.
test('a file that is not a backup is refused and changes nothing', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await page.waitForTimeout(AUTOSAVE_MS);

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

	await expect
		.poll(() => dialogs)
		.toContain("Import failed — this doesn't look like a Fallow backup file.");

	// No reload happened, so the task is still the one added above.
	await expect(page.getByText('Boxing training').first()).toBeVisible();
});
