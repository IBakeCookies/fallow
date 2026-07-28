import { expect, test, type Page } from '@playwright/test';
import { addTask, AUTOSAVE_MS, isoDate } from './helpers';

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

	await expect(page.locator('svg path[fill="var(--brand)"]')).not.toHaveCount(0);

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
