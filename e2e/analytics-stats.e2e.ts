import { expect, test, type Page } from '@playwright/test';
import { AUTOSAVE_MS, isoDate, seedDay, setIndexedDBStoreFailing } from './helpers';

/* The analytics screen reads a year of stored days through AnalyticsStore, whose
   whole job happens after hydration: load, slice by range, fold. None of it runs
   during SSR, so only a real browser proves it. */

/** The "Active days" row — its denominator is the viewed range's length. */
function activeDaysTile(page: Page) {
	return page
		.locator('div', {
			hasText: /^Active days/,
		})
		.last();
}

test('empty profile shows the empty state, not a stuck spinner', async ({ page }) => {
	await page.goto('/analytics');
	await expect(page.getByText('Nothing to analyze in this range yet.')).toBeVisible();
	await expect(page.getByText('Loading…')).not.toBeVisible();

	// The logs card is outside that empty state, because "nothing to analyze" is about day
	// SUMMARIES and the logs come from two other stores. It is also the only place a ☕ can
	// be corrected or dropped from at all — a user whose day summaries failed to load
	// still has to be able to reach their measurements.
	await expect(
		page.getByRole('heading', {
			name: 'Your logs',
		}),
	).toBeVisible();

	await expect(page.getByText('No measurements logged in this range.')).toBeVisible();
});

test('stats and chart come off the stored days', async ({ page }) => {
	await seedDay(page, 0, ['write the calibration section', 'inbox sweep']);

	// Named: the task form's "must do today" checkbox sits above the list, so the
	// first checkbox on the page is no longer a task's completion box.
	await page
		.getByRole('checkbox', {
			name: /^Mark /,
		})
		.first()
		.check();

	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/analytics');

	for (const tile of ['Tasks completed', 'Avg completion rate', 'Current streak', 'Logged hours'])
		await expect(
			page.getByText(tile, {
				exact: true,
			}),
		).toBeVisible();

	// One of two tasks done, priority-weighted — a real percentage reaches the copy
	await expect(page.getByText(/\d+% of planned tasks/)).toBeVisible();

	// The chart drew the seeded day
	await expect(
		page.getByRole('heading', {
			name: 'Completion & yield',
		}),
	).toBeVisible();

	// One recorded day is a run of one on both series, so each draws a dot rather
	// than a path — the reading a polyline-only chart would drop.
	await expect(page.locator('svg path.stroke-brand, svg circle.fill-brand')).not.toHaveCount(0);

	await expect(
		page.getByRole('heading', {
			name: 'Day profiles',
		}),
	).toBeVisible();
});

/** A day with one of two tasks done, viewed on /analytics. */
async function seedCompletedDay(page: Page) {
	await seedDay(page, 0, ['write the calibration section', 'inbox sweep']);

	await page
		.getByRole('checkbox', {
			name: /^Mark /,
		})
		.first()
		.check();

	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/analytics');
}

/** One reading's tile: the label `<p>`'s parent, which is what `stat-tile.svelte` draws. */
const statTile = (page: Page, label: string) =>
	page
		.getByText(label, {
			exact: true,
		})
		.locator('xpath=..');

/** A tile's bar as a whole percentage — the share the reader actually sees. */
async function fillPercent(page: Page, label: string) {
	const fill = statTile(page, label).locator('.band-track > div');

	await expect(fill).toHaveCount(1);

	return Math.round(parseFloat(await fill.evaluate((node) => (node as HTMLElement).style.width)));
}

/* A range the four readings can be read against: 23 planned tasks over six days, six
   of them done, 20.8 declared hours, one 🪫 session of 1.5 h — and a five-day run of
   completed days a fortnight back, which is the streak's own denominator. Written
   straight into IndexedDB, the way `task-tags.e2e.ts` seeds its days: a plan this size
   is not typeable through the UI. */
const RANGE_DAYS = [
	{
		offset: -6,
		tasks: 5,
		completed: 2,
		hours: 4,
	},
	{
		offset: -5,
		tasks: 4,
		completed: 2,
		hours: 4,
	},
	{
		offset: -4,
		tasks: 4,
		completed: 2,
		hours: 4,
	},
	{
		offset: -3,
		tasks: 4,
		completed: 0,
		hours: 4,
	},
	{
		offset: -2,
		tasks: 3,
		completed: 0,
		hours: 2.4,
	},
	// Nothing completed on the last three days, so the current streak really is 0.
	{
		offset: -1,
		tasks: 3,
		completed: 0,
		hours: 2.4,
	},
];

const STREAK_DAYS = [-12, -11, -10, -9, -8].map((offset) => ({
	offset,
	tasks: 1,
	completed: 1,
	hours: 4,
}));

/** Ids unique across days and never negative, so the 🪫 row below can name one. */
const taskId = (offset: number, index: number) => (30 + offset) * 100 + index;
const LOGGED_TASK = taskId(-6, 0);

async function seedRange(page: Page) {
	await page.goto('/');
	// The planner settles onto the loaded day after hydration, and a navigation
	// mid-`evaluate` destroys the context the write is running in.
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.evaluate(
		({ days, drainDate, drainTask }) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('zenith-db');
				request.onerror = () => reject(request.error);

				request.onsuccess = () => {
					const transaction = request.result.transaction(
						['sessions', 'drainObservations'],
						'readwrite',
					);

					for (const day of days) {
						transaction.objectStore('sessions').put({
							date: day.date,
							availableHours: day.hours,
							switchCost: 0.25,
							updatedAt: 1,
							tasks: day.tasks,
						});
					}

					transaction.objectStore('drainObservations').add({
						date: drainDate,
						taskId: drainTask,
						taskTitle: 'deep work',
						hours: 1.5,
						cognitiveDemand: 0.5,
						physicalDemand: 0.3,
						mindDrain: 6,
						bodyDrain: 2,
						createdAt: 100,
					});

					transaction.onerror = () => reject(transaction.error);
					transaction.oncomplete = () => resolve();
				};
			}),
		{
			days: [...STREAK_DAYS, ...RANGE_DAYS].map((day) => ({
				date: isoDate(day.offset),
				hours: day.hours,
				tasks: Array.from(
					{
						length: day.tasks,
					},
					(_, index) => ({
						id: taskId(day.offset, index),
						title: `task ${day.offset}.${index}`,
						physicalDifficulty: 3,
						mentalDifficulty: 5,
						enjoyment: 5,
						createdAt: isoDate(day.offset),
						completed: index < day.completed,
					}),
				),
			})),
			drainDate: isoDate(-6),
			drainTask: LOGGED_TASK,
		},
	);
}

test('tasks completed reads against what was planned', async ({ page }) => {
	await seedRange(page);
	await page.goto('/analytics');

	// 6 of 23: the denominator the reader would otherwise have to hold.
	await expect(statTile(page, 'Tasks completed')).toContainText('/ 23');
	expect(await fillPercent(page, 'Tasks completed')).toBe(26);
});

test('logged hours reads against the hours planned', async ({ page }) => {
	await seedRange(page);
	await page.goto('/analytics');

	await expect(page.getByText('of 20.8 h planned')).toBeVisible();
	expect(await fillPercent(page, 'Logged hours')).toBe(7);
});

test('the streak reads against the longest one in the range', async ({ page }) => {
	await seedRange(page);
	await page.goto('/analytics');

	const streak = statTile(page, 'Current streak');

	await expect(streak).toContainText('longest 5 days');

	// One pip per day of the record, none of them reached: a bar would say 0 with no
	// sense of how far off it is.
	await expect(streak.locator('span.band-fill')).toHaveCount(5);
	await expect(streak.locator('span.band-fill.bg-ty-secondary')).toHaveCount(0);
});

// The previous week holds the five-day run, every task done, so this week's rate is a drop.
test('a completion rate below the previous range reads its drop in danger ink', async ({
	page,
}) => {
	await seedRange(page);
	await page.goto('/analytics');

	await expect(statTile(page, 'Avg completion rate').getByText(/^-\d+%$/)).toHaveClass(
		/\btext-danger\b/,
	);
});

test('a tile with no reading has no scale', async ({ page }) => {
	await seedRange(page);

	// Only the ☕ store: the history read does not touch it, so the page paints and
	// only the model report — which is where the logged hours come from — fails.
	await setIndexedDBStoreFailing(page, 'restObservations');

	// Client-side, so the patch above survives — it is not an init script.
	await page
		.getByRole('link', {
			name: 'Analytics',
		})
		.click();

	await expect(statTile(page, 'Logged hours')).toContainText('—');
	await expect(statTile(page, 'Logged hours').locator('.band-track')).toHaveCount(0);

	// The control: the readings the history read answers keep their scale, so the
	// absence above is the missing reading's doing and not a page that drew none.
	await expect(statTile(page, 'Tasks completed').locator('.band-track')).toHaveCount(1);
});

test('the three remaining readings need no click', async ({ page }) => {
	await seedCompletedDay(page);

	for (const reading of ['Active days', 'Rest hours', 'Best day'])
		await expect(
			page.getByText(reading, {
				exact: true,
			}),
		).toBeVisible();

	// The two the tiles absorbed as their own denominators are not rows any more,
	// and with three readings left there is nothing worth folding.
	await expect(page.getByText(/more metrics/)).toHaveCount(0);

	for (const gone of ['Longest streak', 'Planned hours'])
		await expect(
			page.getByText(gone, {
				exact: true,
			}),
		).toHaveCount(0);
});

test('one card holds both readings', async ({ page }) => {
	await seedCompletedDay(page);

	await expect(
		page.getByRole('heading', {
			name: 'Completion & yield',
		}),
	).toBeVisible();

	// The second card is gone, not renamed around a chart that still draws twice.
	await expect(
		page.getByRole('heading', {
			name: 'Yield and completion',
		}),
	).toHaveCount(0);

	// Its own accessible name: an <svg role="img"> has no other one.
	await expect(
		page.getByRole('img', {
			name: 'Line chart of completion rate and yield index over the last 7 days',
		}),
	).toHaveCount(1);
});

test('the merged card names both series', async ({ page }) => {
	await seedCompletedDay(page);

	// Exact: the card's heading is "Completion & yield", not either label.
	await expect(
		page.getByText('Yield Index', {
			exact: true,
		}),
	).toBeVisible();

	await expect(
		page.getByText('Completion Rate', {
			exact: true,
		}),
	).toBeVisible();
});

test('the year view keeps both series on weekly slots', async ({ page }) => {
	await seedCompletedDay(page);

	await page
		.getByRole('button', {
			name: 'Last 12 months',
		})
		.click();

	await expect(page.getByText(/Weekly average of the priority-weighted/)).toBeVisible();

	// Drawn, not merely legended. One recorded week has no neighbour to draw a
	// line to, so the run of one is a dot — the same reading the trend chart plots.
	await expect(
		page.locator('svg path.stroke-brand-counter, svg circle.fill-brand-counter'),
	).not.toHaveCount(0);
});

test('the range toggle reslices the stats', async ({ page }) => {
	await seedDay(page, 0, ['write the calibration section']);
	await page.goto('/analytics');

	const activeDays = activeDaysTile(page);
	await expect(activeDays).toContainText('/ 7');

	await page
		.getByRole('button', {
			name: 'Last 30 days',
		})
		.click();

	await expect(activeDays).toContainText('/ 30');

	await page
		.getByRole('button', {
			name: 'Last 12 months',
		})
		.click();

	await expect(activeDays).toContainText('/ 365');

	// The year view switches the chart from days to weekly averages
	await expect(page.getByText(/Weekly average of the priority-weighted/)).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Last 7 days',
		})
		.click();

	await expect(activeDays).toContainText('/ 7');

	await expect(page.getByText(/Priority-weighted completion rate per day/)).toBeVisible();
});

test('a planned future day is not counted as an active day', async ({ page }) => {
	await seedDay(page, 0, ['today task']);
	await seedDay(page, 4, ['future task']);

	await page.goto('/analytics');
	// Every range looks backward from today, so only today counts
	await expect(activeDaysTile(page)).toContainText('1 /');
});

test('the calendar reads the same day summaries', async ({ page }) => {
	await seedDay(page, 0, ['write the calibration section']);
	await page.goto('/calendar');

	await expect(
		page.getByRole('heading', {
			name: 'Calendar',
		}),
	).toBeVisible();

	await expect(page.getByText('write the calibration section')).toBeVisible();
});

/* Both fit cards read two client-side stores, so the server cannot know what was logged
   — and must not guess. Guessing zero tells a user with a year of ratings that they have
   never rated anything, which is what every other placeholder on this page exists to
   avoid ("A placeholder, never a claim"). They are absent until the read lands, like the
   drain ranking above them, rather than empty. */
test.describe('server-rendered, before the logs are read', () => {
	test.use({
		javaScriptEnabled: false,
	});

	test('neither fit card claims an empty fit', async ({ page }) => {
		await page.goto('/analytics');

		await expect(page.getByText(/No ratings yet/)).toHaveCount(0);
		await expect(page.getByText(/Model uses default constants/)).toHaveCount(0);

		// …and the card that DOES render before the read says it is waiting.
		await expect(page.getByText('Loading…').first()).toBeVisible();
	});
});

/* The model table on a phone: five columns folded to three lines per row, none of
   them dropped. Width-dependent, so a browser at 390px is the only level that can
   assert it — the same pin `task-list.e2e.ts` holds for the day's list. */
test.describe('the model table on a phone', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({
			width: 390,
			height: 900,
		});

		await seedDay(page, 0, ['write the calibration section']);
		await page.goto('/analytics');
	});

	/** The Recovery rate row: the head is not a list item, so this is the row alone. */
	const recoveryRow = (page: Page) =>
		page.locator('li').filter({
			hasText: 'Recovery rate',
		});

	test('keeps every column, the evidence included', async ({ page }) => {
		await expect(recoveryRow(page).getByText('0 ratings')).toBeVisible({
			timeout: 15000,
		});
	});

	test('stacks the fit over the default it is anchored to', async ({ page }) => {
		const row = recoveryRow(page);

		// Nothing logged, so the fitted cell prints the default itself, bare.
		const fitted = row.getByText('0.70 /h', {
			exact: true,
		});

		await expect(fitted).toBeVisible({
			timeout: 15000,
		});

		const fallback = row.getByText(/^default 0\.70$/);

		await expect(fallback).toBeVisible();

		const [fittedBox, fallbackBox] = await Promise.all([
			fitted.boundingBox(),
			fallback.boundingBox(),
		]);

		expect(fallbackBox!.y).toBeGreaterThanOrEqual(fittedBox!.y + fittedBox!.height);

		expect(
			Math.abs(fallbackBox!.x + fallbackBox!.width - (fittedBox!.x + fittedBox!.width)),
		).toBeLessThan(1);
	});

	test('names the default the head no longer can', async ({ page }) => {
		// Below `sm` there is no head over the column, so the cell names itself:
		// the word, then the number.
		await expect(recoveryRow(page).getByText(/^default 0\.70$/)).toBeVisible({
			timeout: 15000,
		});
	});

	test('does not drag the page sideways', async ({ page }) => {
		await expect(recoveryRow(page).getByText('0 ratings')).toBeVisible({
			timeout: 15000,
		});

		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			390,
		);
	});
});
