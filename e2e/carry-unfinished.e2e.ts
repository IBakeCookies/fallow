import { expect, test, type Page } from '@playwright/test';
import {
	AUTOSAVE_MS,
	expectTaskInputs,
	isoDate,
	taskCard,
	taskRow,
	timeBudgetBar,
} from './helpers';

/* Carrying the day's unfinished work to tomorrow COPIES it. The day it left is
   untouched: its rows keep their hours, keep counting toward burnout risk and every
   other reading, and carry no badge — the user has not finished them, and pressing a
   button does not say they have. The control offers only what tomorrow does not
   already hold, so a second press is not a second copy. `createdAt` still travels, so
   the slide badge keeps counting. */

type SeededTask = {
	id: number;
	title: string;
	physicalDifficulty: number;
	mentalDifficulty: number;
	enjoyment: number;
	createdAt: string;
	completed: boolean;
	mustDoToday?: boolean;
	importance?: 'low' | 'normal' | 'high';
	tags?: string[];
};

const seeded = (id: number, title: string, extra: Partial<SeededTask> = {}): SeededTask => ({
	id,
	title,
	physicalDifficulty: 3,
	mentalDifficulty: 6,
	enjoyment: 4,
	createdAt: isoDate(0),
	completed: false,
	...extra,
});

/** A day's record written straight into IndexedDB: importance, tags and a back-dated
 *  `createdAt` are slower to type than to seed. The app's own boot must have landed
 *  first — the Day Setup bar opens only once it has — or a bare `indexedDB.open` racing
 *  the app's first open creates a database with no `sessions` store, and the data layer
 *  reads the version it finds as a newer build's and reloads the page. */
async function seedDay(page: Page, date: string, tasks: SeededTask[]) {
	await page.goto('/');
	await expect(timeBudgetBar(page)).toHaveAttribute('open', '');

	await page.evaluate(
		({ date, tasks }) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('zenith-db');
				request.onerror = () => reject(request.error);

				request.onsuccess = () => {
					const transaction = request.result.transaction('sessions', 'readwrite');

					transaction.objectStore('sessions').put({
						date,
						tasks,
						availableHours: 6,
						switchCost: 0.25,
						updatedAt: 1,
					});

					transaction.onerror = () => reject(transaction.error);
					transaction.oncomplete = () => resolve();
				};
			}),
		{
			date,
			tasks,
		},
	);

	await page.goto(date === isoDate(0) ? '/' : `/?date=${date}`);
}

/** Tomorrow's stored tasks, read back out: the row prints no tag, so what travelled
 *  is checked on the record. */
async function readTasks(page: Page, date: string): Promise<SeededTask[]> {
	return page.evaluate(
		(date) =>
			new Promise((resolve, reject) => {
				const request = indexedDB.open('zenith-db');
				request.onerror = () => reject(request.error);

				request.onsuccess = () => {
					const read = request.result.transaction('sessions').objectStore('sessions').get(date);
					read.onerror = () => reject(read.error);
					read.onsuccess = () => resolve(read.result?.tasks ?? []);
				};
			}),
		date,
	);
}

const carryControl = (page: Page, count: number) =>
	taskCard(page).getByRole('button', {
		name: `Carry ${count} to tomorrow`,
	});

const anyCarryControl = (page: Page) =>
	page.getByRole('button', {
		name: /Carry \d+ to tomorrow/,
	});

test('one press sends the day’s unfinished work to tomorrow, whole', async ({ page }) => {
	await seedDay(page, isoDate(0), [
		seeded(1, 'Write the spec', {
			importance: 'high',
			tags: ['writing'],
		}),
		seeded(2, 'Boxing training', {
			physicalDifficulty: 8,
			mentalDifficulty: 2,
			enjoyment: 7,
		}),
		seeded(3, 'Inbox sweep', {
			completed: true,
		}),
	]);

	await carryControl(page, 2).click();
	await expect(anyCarryControl(page)).toHaveCount(0);

	// The day it left keeps all three rows: what it planned is what it has to answer for.
	await expect(taskRow(page, 'Write the spec')).toBeVisible();
	await expect(taskRow(page, 'Boxing training')).toBeVisible();
	await expect(taskRow(page, 'Inbox sweep')).toBeVisible();

	// Let the day's own autosave land before navigating.
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto(`/?date=${isoDate(1)}`);

	await expect(taskRow(page, 'Write the spec')).toBeVisible();
	await expect(taskRow(page, 'Write the spec').getByText('High importance')).toBeVisible();
	await expectTaskInputs(page, 'Boxing training', [8, 2, 7]);

	const tomorrow = await readTasks(page, isoDate(1));

	expect(tomorrow.map((t) => t.title)).toEqual(['Write the spec', 'Boxing training']);

	expect(tomorrow[0]).toMatchObject({
		importance: 'high',
		tags: ['writing'],
		completed: false,
	});
});

/** The Completion Rate tile on the dashboard. The label reads twice — a tile, and again
 *  in the lower card under the question it answers — so this takes the one drawing its
 *  value in a `<p>` that is a DIRECT child (e2e/time-budget.e2e.ts says why). */
const completionRate = (page: Page) =>
	page
		.locator('div:has(> p)')
		.filter({
			has: page.getByText('Completion Rate', {
				exact: true,
			}),
		})
		.getByText(/^\d+%$/);

/** The Primary Bottleneck row in the metrics dashboard. It is not promoted to a headline
 *  tile, so — unlike `completionRate` — it reads once, and its value sits in a
 *  direct-child `<span>` (metrics-dashboard.svelte). It names a task only while the
 *  day's plan still funds one, so it is where "this row is still part of today" reads. */
const bottleneckRow = (page: Page) =>
	page.locator('div:has(> span)').filter({
		has: page.getByText('Primary Bottleneck', {
			exact: true,
		}),
	});

/* Nothing on the row says the user did anything to it: they pressed a button about
   tomorrow, and tomorrow is where the result is. */
test('a carried task stays on the day it left, unmarked', async ({ page }) => {
	await seedDay(page, isoDate(0), [seeded(1, 'Write the spec')]);

	await carryControl(page, 1).click();
	await expect(anyCarryControl(page)).toHaveCount(0);

	await expect(taskRow(page, 'Write the spec')).toBeVisible();
	await expect(taskCard(page).getByText('Moved to tomorrow')).toHaveCount(0);
});

/* A day that finished 1 of 3 and carried the rest must not read back as a finished
   day. It never could once the row stayed — this is the reading that says so. */
test('carrying does not flatter the day it left', async ({ page }) => {
	await seedDay(page, isoDate(0), [
		seeded(1, 'Write the spec'),
		seeded(2, 'Boxing training'),
		seeded(3, 'Inbox sweep', {
			completed: true,
		}),
	]);

	await carryControl(page, 2).click();

	// The control empties as the carry lands; without waiting on it every assertion here
	// can resolve against the frame before the write.
	await expect(anyCarryControl(page)).toHaveCount(0);

	// The day finished one of the three tasks it was planned with, and pressing a button
	// on it is not finishing the other two.
	await expect(completionRate(page)).not.toHaveText('100%');
});

/* The point of the whole change: sending a copy forward does not unfund the row here.
   The day still has to be worked, so it still costs hours, still loads the pools and
   still counts toward burnout risk — Primary Bottleneck names a task only while the
   plan funds one, so it goes silent the moment a row leaves the plan. */
test('a carried task still draws on today’s capacity', async ({ page }) => {
	await seedDay(page, isoDate(0), [
		seeded(1, 'Boxing training', {
			physicalDifficulty: 8,
			mentalDifficulty: 2,
			enjoyment: 7,
		}),
	]);

	await expect(bottleneckRow(page)).toContainText('Boxing training');

	await carryControl(page, 1).click();
	await expect(anyCarryControl(page)).toHaveCount(0);

	await expect(bottleneckRow(page)).toContainText('Boxing training');
});

/* The row stays, so the count has to stop counting it some other way — otherwise the
   control keeps offering a carry that already happened, and pressing it duplicates
   tomorrow. */
test('a day cannot carry the same work twice', async ({ page }) => {
	await seedDay(page, isoDate(0), [seeded(1, 'Write the spec'), seeded(2, 'Boxing training')]);

	await carryControl(page, 2).click();

	await expect(anyCarryControl(page)).toHaveCount(0);
});

/* And it is tomorrow that decides, not a mark on today: a task already sitting there —
   carried yesterday, or typed into tomorrow by hand — is work the day does not need
   sending again. */
test('the count does not offer work tomorrow already holds', async ({ page }) => {
	await seedDay(page, isoDate(1), [seeded(10, 'Write the spec')]);
	await seedDay(page, isoDate(0), [seeded(1, 'Write the spec'), seeded(2, 'Boxing training')]);

	await expect(carryControl(page, 1)).toBeVisible();
});

/* Reversible while the toast lives, the way a deleted task is: tomorrow gives the
   copies back and the control offers them again. */
test('the carry offers one way back', async ({ page }) => {
	await seedDay(page, isoDate(0), [seeded(1, 'Write the spec'), seeded(2, 'Boxing training')]);

	await carryControl(page, 2).click();
	await expect(anyCarryControl(page)).toHaveCount(0);

	await page
		.getByRole('button', {
			name: 'Undo',
		})
		.click();

	await expect(carryControl(page, 2)).toBeVisible();

	await page.waitForTimeout(AUTOSAVE_MS);

	expect(await readTasks(page, isoDate(1))).toEqual([]);
});

test('a must-do-today task stays, and the count never promised it', async ({ page }) => {
	await seedDay(page, isoDate(0), [
		seeded(1, 'Tax return', {
			mustDoToday: true,
		}),
		seeded(2, 'Boxing training'),
	]);

	await carryControl(page, 1).click();
	await expect(anyCarryControl(page)).toHaveCount(0);

	await expect(taskRow(page, 'Tax return')).toBeVisible();

	await page.waitForTimeout(AUTOSAVE_MS);

	expect((await readTasks(page, isoDate(1))).map((t) => t.title)).toEqual(['Boxing training']);
});

test('the day count keeps running across a carry', async ({ page }) => {
	await seedDay(page, isoDate(0), [
		seeded(1, 'Fix the shed', {
			createdAt: isoDate(-4),
		}),
	]);

	await expect(taskRow(page, 'Fix the shed').getByText('day 5')).toBeVisible();

	await carryControl(page, 1).click();
	await expect(anyCarryControl(page)).toHaveCount(0);
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto(`/?date=${isoDate(1)}`);

	await expect(taskRow(page, 'Fix the shed').getByText('day 6')).toBeVisible();
});

test('a finished day sends nothing on', async ({ page }) => {
	const lastWeek = isoDate(-7);

	await seedDay(page, lastWeek, [seeded(1, 'Fix the shed'), seeded(2, 'Inbox sweep')]);

	await expect(page.getByText('Viewing a past day:')).toBeVisible();
	await expect(taskRow(page, 'Fix the shed')).toBeVisible();
	await expect(anyCarryControl(page)).toHaveCount(0);
});

test('the example day sends nothing on', async ({ page }) => {
	await page.goto('/?demo');

	await expect(taskCard(page).getByRole('listitem').first()).toBeVisible();
	await expect(anyCarryControl(page)).toHaveCount(0);
});
