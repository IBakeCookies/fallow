import { expect, test, type Page } from '@playwright/test';
import { addTask, AUTOSAVE_MS, drainChips, isoDate, logDrain, openTaskForm } from './helpers';

/* Tags are typed on the task and read on /analytics, which is two stores and a join
   apart — nothing below the browser exercises the whole path. */

/** The tag rows of the breakdown card, in the order the card lists them. */
const tagRows = (page: Page) =>
	page
		.locator('.card-shell')
		.filter({
			has: page.getByRole('heading', {
				name: 'Logged hours by tag',
			}),
		})
		.getByRole('listitem');

/** A stored day carrying one tagged task, and the 🪫 session logged against it. No UI
 *  path dates either in the past — past days are read-only — so both are written
 *  straight into IndexedDB, the way `analytics.e2e.ts` seeds its drain rows. */
async function writeTaggedDay(page: Page, date: string, tag: string, hours: number) {
	await page.evaluate(
		({ date, tag, hours }) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('zenith-db');
				request.onerror = () => reject(request.error);

				request.onsuccess = () => {
					const transaction = request.result.transaction(
						['sessions', 'drainObservations'],
						'readwrite',
					);

					transaction.objectStore('sessions').put({
						date,
						tasks: [
							{
								id: 1,
								title: 'Morning run',
								physicalDifficulty: 7,
								mentalDifficulty: 1,
								enjoyment: 6,
								createdAt: date,
								completed: true,
								tags: [tag],
							},
						],
						availableHours: 4,
						switchCost: 0.25,
						updatedAt: 1,
					});

					transaction.objectStore('drainObservations').add({
						date,
						taskId: 1,
						taskTitle: 'Morning run',
						hours,
						cognitiveDemand: 0.1,
						physicalDemand: 0.7,
						mindDrain: 3,
						bodyDrain: 7,
						createdAt: 100,
					});

					transaction.onerror = () => reject(transaction.error);
					transaction.oncomplete = () => resolve();
				};
			}),
		{
			date,
			tag,
			hours,
		},
	);
}

test('the breakdown follows the range the page is on', async ({ page }) => {
	// A day today so the ranged cards render on `week` at all, and the tagged log
	// outside it — the card must answer to the page's own range selector.
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await writeTaggedDay(page, isoDate(-20), 'exercise', 2);

	await page.goto('/analytics');

	await expect(
		page.getByRole('heading', {
			name: 'Logged hours by tag',
		}),
	).toBeVisible();

	// The card's own empty line, not a bare count of nothing: it says the model report
	// landed, so the absent row is the range's answer and not a read still in flight.
	await expect(page.getByText('No hours logged in this range.')).toBeVisible({
		timeout: 15000,
	});

	await expect(
		tagRows(page).filter({
			hasText: 'exercise',
		}),
	).toHaveCount(0);

	await page
		.getByRole('button', {
			name: 'Last 30 days',
		})
		.click();

	await expect(
		tagRows(page).filter({
			hasText: 'exercise',
		}),
	).toHaveCount(1);
});

test('a tag reaches the card from the day it was typed on', async ({ page }) => {
	await page.goto('/');

	const title = await openTaskForm(page);
	await title.fill('Morning run');
	await page.getByLabel('Tags').fill('exercise');
	await page.getByLabel('Tags').press('Enter');

	await page
		.getByRole('button', {
			name: 'Deploy Task',
		})
		.click();

	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).toBeHidden();
	await page.waitForTimeout(AUTOSAVE_MS);

	await logDrain(page, 60, 4, 8);

	// The chip is published by the store's own re-read, so it says the write committed.
	await expect(drainChips(page)).toBeVisible();

	await page.goto('/analytics');

	const row = tagRows(page).filter({
		hasText: 'exercise',
	});

	await expect(row).toContainText('1');
});
