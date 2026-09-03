import { expect, test, type Page } from '@playwright/test';
import {
	closeTaskForm,
	expectTaskInputs,
	isoDate,
	openTaskForm,
	setSlider,
	taskRow,
} from './helpers';

/* The whole path only exists in a browser: a stored day, the title memory the
   store boots with, the ranking the panel runs on mount, and the form a picked row
   fills. */

/** The add form, by the dialog it is the only thing in — the row editor carries
 *  the same field and slider labels. */
const addForm = (page: Page) => page.getByRole('dialog').locator('form');

/* Two rated titles on a past day. Written straight into IndexedDB because past
   days are read-only in the UI, and today's own titles are the ones the ranking
   deliberately filters out — so there is no path through the app to a history
   this feature can rank at all. */
async function seedRatedPastDay(page: Page) {
	await page.evaluate(
		(date) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('zenith-db');
				request.onerror = () => reject(request.error);

				request.onsuccess = () => {
					const transaction = request.result.transaction('sessions', 'readwrite');

					transaction.objectStore('sessions').put({
						date,
						availableHours: 6,
						switchCost: 0.25,
						updatedAt: 1,
						tasks: [
							{
								id: 1,
								title: 'Boxing training',
								physicalDifficulty: 8,
								mentalDifficulty: 2,
								enjoyment: 7,
								createdAt: date,
								completed: false,
							},
							{
								id: 2,
								title: 'Inbox sweep',
								physicalDifficulty: 1,
								mentalDifficulty: 4,
								enjoyment: 3,
								createdAt: date,
								completed: false,
							},
						],
					});

					transaction.onerror = () => reject(transaction.error);
					transaction.oncomplete = () => resolve();
				};
			}),
		isoDate(-3),
	);
}

/** An empty today with hours to spend, and the form open with its ranking settled.
 *  Today's budget is the prefill off the seeded day's own declared 6 h — nothing here
 *  has to set it, and the day holds no tasks, so every one of those hours is unspent.
 *  The panel ranks on mount, so there is no control to press: the wait IS the
 *  assertion that it ran. */
async function openRankedForm(page: Page) {
	await page.goto('/');

	// The app's own boot has to have opened the database: a bare `indexedDB.open`
	// against a name that does not exist yet creates one with no `sessions` store
	// in it, and the seed below would write into the wrong schema.
	await expect(
		page.getByRole('button', {
			name: 'Add task',
			exact: true,
		}),
	).toBeVisible();

	await seedRatedPastDay(page);
	await page.reload();
	await openTaskForm(page);

	await expect(addForm(page).getByRole('listitem').first()).toBeVisible();
}

test('a suggested title fills the form with the ratings it was saved under', async ({ page }) => {
	await openRankedForm(page);

	const form = addForm(page);

	await form
		.getByRole('button', {
			name: /Boxing training/,
		})
		.click();

	await expect(
		form.getByLabel('Title', {
			exact: true,
		}),
	).toHaveValue('Boxing training');

	await expect(form.getByLabel('Physical Diff')).toHaveValue('8');
	await expect(form.getByLabel('Mental Diff')).toHaveValue('2');
	await expect(form.getByLabel('Enjoyment')).toHaveValue('7');

	await closeTaskForm(page);
});

test('a picked suggestion is still the user’s to change before it is deployed', async ({
	page,
}) => {
	await openRankedForm(page);

	const form = addForm(page);

	await form
		.getByRole('button', {
			name: /Boxing training/,
		})
		.click();

	await setSlider(form.getByLabel('Enjoyment'), 6);

	await form
		.getByRole('button', {
			name: 'Deploy Task',
		})
		.click();

	await closeTaskForm(page);

	await expect(taskRow(page, 'Boxing training')).toBeVisible();
	await expectTaskInputs(page, 'Boxing training', [8, 2, 6]);
});

/* The dialog does NOT close on deploy — a day is typed in one sitting — so the
   panel is the one reading in the app that can watch the day change underneath
   it. The list it is holding was solved before the deploy, and the task just
   deployed is now on today's list. */
test('deploying a task re-ranks the panel instead of re-offering what was added', async ({
	page,
}) => {
	await openRankedForm(page);

	const form = addForm(page);

	await form
		.getByRole('button', {
			name: /Boxing training/,
		})
		.click();

	await form
		.getByRole('button', {
			name: 'Deploy Task',
		})
		.click();

	await expect(
		form.getByRole('button', {
			name: /Boxing training/,
		}),
	).toHaveCount(0);

	// And the panel still ranks — the other rated title is what is left to offer.
	await expect(
		form.getByRole('button', {
			name: /Inbox sweep/,
		}),
	).toBeVisible();

	await closeTaskForm(page);
});
