import { expect, test, type Page } from '@playwright/test';
import { addTask, AUTOSAVE_MS, isoDate, logDrain } from './helpers';

/* The analytics screen reads a year of stored days through AnalyticsStore, whose
   whole job happens after hydration: load, slice by range, fold. None of it runs
   during SSR, so only a real browser proves it. */

/** Plan a day. Past days are read-only, so seeding uses today or a day ahead. */
async function seedDay(page: Page, offset: number, titles: string[]) {
	await page.goto(offset === 0 ? '/' : `/?date=${isoDate(offset)}`);

	for (const title of titles) {
		await addTask(page, title);
	}

	await page.waitForTimeout(AUTOSAVE_MS);
}

/** The "Active days" KPI tile — its denominator is the viewed range's length. */
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

/* The three calibration cards link to this list, not to the top of the page it is the last
   card on. Worth an e2e because the failure is invisible to a unit test and to the eye on a
   short page: the fragment scroll happens once, on arrival, so an element that appears only
   when IndexedDB answers is not there to be scrolled to and nothing retries. */
test('the calibration card’s link scrolls to the log list', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	// The Lab's drain card is the cheapest of the three to give a fit to. With no ☕ logged
	// the recovery card offers no link, so there is exactly one to click.
	await logDrain(page, 120, 9, 5);

	await page
		.getByRole('link', {
			name: 'In your logs →',
		})
		.click();

	const list = page.getByRole('heading', {
		name: 'Your logs',
	});

	await expect(list).toBeVisible();
	await expect(list).toBeInViewport();
});

/* The ✕ has no confirmation step, so the toast is the whole of the safety net — and a
   measurement is not a task: putting it back means the same record under the same id and
   stamp, written into IndexedDB by a second write (`$restoreDrainObservation`). The
   reload is what makes this worth an e2e: a restore that only patched the store's array
   would look identical until the next visit, and the fits would have refit off the
   dropped record in the meantime. */
test('undo brings a dropped measurement back, past a reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await logDrain(page, 120, 9, 5);

	// The row's chip is drawn from the store's re-read, which lands only once the write
	// committed — so it is what says the rating is in IndexedDB. A `goto` fired before
	// it aborts that transaction, and the measurement never reaches the list.
	await expect(
		page.getByRole('button', {
			name: 'Correct this drain rating',
		}),
	).toBeVisible();

	await page.goto('/analytics');

	const row = page.getByRole('button', {
		name: /^Correct Session rating logged on/,
	});

	await expect(row).toBeVisible();

	await page
		.getByRole('button', {
			name: /^Delete Session rating logged on/,
		})
		.click();

	await expect(page.getByText('No measurements logged in this range.')).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Undo',
		})
		.click();

	await expect(row).toBeVisible();

	await page.reload();

	await expect(row).toBeVisible();
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

	for (const tile of [
		'Tasks completed',
		'Avg completion rate',
		'Active days',
		'Current streak',
		'Planned hours',
		'Best day',
	]) {
		await expect(
			page.getByText(tile, {
				exact: true,
			}),
		).toBeVisible();
	}

	// One of two tasks done, priority-weighted — a real percentage reaches the copy
	await expect(page.getByText(/\d+% of planned tasks/)).toBeVisible();
	await expect(page.getByText(/1 with at least one task done/)).toBeVisible();

	// The chart drew a bar for the seeded day
	await expect(
		page.getByRole('heading', {
			name: 'Completion rate',
		}),
	).toBeVisible();

	await expect(page.locator('svg path.fill-brand')).not.toHaveCount(0);

	await expect(
		page.getByRole('heading', {
			name: 'Day profiles',
		}),
	).toBeVisible();
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

	// The year view switches the chart from days to monthly averages
	await expect(
		page.getByText('Monthly average of the priority-weighted daily completion rate'),
	).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Last 7 days',
		})
		.click();

	await expect(activeDays).toContainText('/ 7');

	await expect(
		page.getByText('Priority-weighted completion rate per day — hover a bar for details'),
	).toBeVisible();
});

test('a planned future day is not counted as an active day', async ({ page }) => {
	await seedDay(page, 0, ['today task']);
	await seedDay(page, 4, ['future task']);

	await page.goto('/analytics');
	// Every range looks backward from today, so only today counts
	await expect(activeDaysTile(page)).toContainText('1 /');
});

test('plan adherence and the model card resolve without calibration logs', async ({ page }) => {
	await seedDay(page, 0, ['write the calibration section']);
	await page.goto('/analytics');

	await expect(
		page.getByRole('heading', {
			name: 'Plan adherence',
		}),
	).toBeVisible();

	await expect(
		page.getByRole('heading', {
			name: 'Your model',
		}),
	).toBeVisible();

	// The audit has no finished day to score, and says so instead of hanging
	await expect(page.getByText(/Needs finished days with/)).toBeVisible({
		timeout: 15000,
	});

	// Every model row shows its fitted value next to the default it is anchored to
	await expect(page.getByText(/default \d/).first()).toBeVisible({
		timeout: 15000,
	});

	await expect(page.getByText('Loading…')).not.toBeVisible();
	await expect(page.getByText('Something went wrong')).not.toBeVisible();
});

/* Visiting analytics stamps today's fit (MATH.md §12.1). Read back out of the
   real IndexedDB rather than off the screen: today is the FIRST recorded day, so
   there is no second point to draw a sparkline from yet, and the write is the
   half that has to work for any of the history to accumulate.

   A Playwright profile starts empty, so this exercises store CREATION at v6, not
   the v5 → v6 upgrade an existing user takes — that path is pinned in
   `indexed-db.test.ts`, where a v5 database can actually be stood up first. */
test("visiting analytics records today's fitted params", async ({ page }) => {
	await seedDay(page, 0, ['write the calibration section']);
	await page.goto('/analytics');

	await expect(page.getByText(/default \d/).first()).toBeVisible({
		timeout: 15000,
	});

	const recorded = await page.evaluate(
		() =>
			new Promise<Record<string, unknown>[]>((resolve, reject) => {
				const request = indexedDB.open('zenith-db');
				request.onerror = () => reject(request.error);

				request.onsuccess = () => {
					const all = request.result
						.transaction('fitSnapshots', 'readonly')
						.objectStore('fitSnapshots')
						.getAll();

					all.onerror = () => reject(all.error);
					all.onsuccess = () => resolve(all.result);
				};
			}),
	);

	expect(recorded).toHaveLength(1);

	expect(recorded[0]).toMatchObject({
		date: isoDate(0),
	});

	// Every value a fit can move, plus the posterior — a record missing the
	// covariance is dropped on read (§13.1), so it would never reach the audit.
	for (const field of [
		'c1',
		'c2',
		'c3',
		'sigma2',
		'alphaCog',
		'alphaPhys',
		'recoveryRate',
		'stoppingValue',
	])
		expect(typeof recorded[0][field]).toBe('number');

	expect(recorded[0].covariance).toHaveLength(3);
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
