import { expect, test, type Page } from '@playwright/test';
import {
	addTask,
	AUTOSAVE_MS,
	closeTaskForm,
	drainChips,
	drainForm,
	isoDate,
	logDrain,
	openDrainEditor,
	openTaskForm,
	plantRunningTimer,
	setBudget,
	setSlider,
	taskCard,
} from './helpers';

/* The session clock's countdown. Only an e2e reaches the prefill: it is the stop
   advisor's own recommendation, read through a store the main page had never
   mounted, and the reading has to survive a reload and a navigation between the two
   screens that share the clock. */

const lengthField = (page: Page) => taskCard(page).getByLabel('Session length in minutes');

/** The Lab's stop advisor, whose printed session length the prefill must agree with. */
const advisorCard = (page: Page) =>
	page.locator('.card-shell').filter({
		has: page.getByRole('heading', {
			name: 'Stop advisor',
		}),
	});

/** `formatDuration`, re-spelled as this suite's oracle for the card's reading. */
function formatMinutes(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;

	if (hours === 0) return `${rest}m`;

	return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

test('the session length prefills from the stop advisor', async ({ page }) => {
	// The day is set up on `/`, where the budget field is, and worked on the Lab: the
	// prefill has to read the same advice from either screen.
	await page.goto('/');

	// Physical Diff 7, not the form's default 5: on the v2 curve a 5/5/5 task's best
	// next session IS one 45-min step, and a fixture whose advice equals the fallback
	// cannot tell the two apart below. 7 sits in the interior of the 90-min region —
	// every neighbour from Physical Diff 6 to 9 prices the same session.
	const form = page.getByRole('dialog');
	const field = await openTaskForm(page);

	await field.fill('Deep work');
	await setSlider(form.getByLabel('Physical Diff'), 7);

	await form
		.getByRole('button', {
			name: 'Deploy Task',
		})
		.click();

	await closeTaskForm(page);

	await setBudget(page, 10);
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/energy');
	await logDrain(page, 30, 5, 4);
	await expect(drainChips(page)).toHaveCount(1);
	await page.reload();

	const minutes = Number(await lengthField(page).inputValue());

	// The advisor's own printed length is the oracle: the field reads what the card is
	// recommending. Not 45, or the assertion would hold against the fallback too — and
	// a prefill taken before the day loaded reads exactly that.
	expect(minutes).not.toBe(45);
	await expect(advisorCard(page)).toContainText(formatMinutes(minutes));

	// A fresh load, not the nav link: `/` paints before the day its advice reads has loaded.
	await page.goto('/');
	await expect(lengthField(page)).toHaveValue(String(minutes));

	// And the Lab reached from a past day prices today, not the day it was left on.
	await page.goto(`/?date=${isoDate(-1)}`);

	await page
		.getByRole('navigation')
		.getByRole('link', {
			name: 'Energy Lab',
		})
		.click();

	await expect(lengthField(page)).toHaveValue(String(minutes));
});

// The example day is seeded under today's date, so leaving it changes no date at all.
test('leaving the example day drops the length priced on it', async ({ page }) => {
	await page.goto('/?demo');

	const banner = page.getByRole('alert');

	await expect(banner).toContainText('example day');

	await banner
		.getByRole('link', {
			name: 'Start my own day',
		})
		.click();

	await expect(page.getByText('No tasks deployed yet')).toBeVisible();

	await expect(lengthField(page)).toHaveValue('45');
});

test('a day the advisor cannot price prefills one model step', async ({ page }) => {
	await page.goto('/');

	await expect(lengthField(page)).toHaveValue('45');
});

/* A reload must not re-suggest over a session already counting: the field is what a
   change re-aims the clock with, so a field disagreeing with the countdown beside it
   would silently re-target on the next keystroke. */
test('the field follows the countdown a session is already running', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 20, 90);
	await page.reload();

	// Over an hour, so it reads the way every other length in the app does.
	await expect(taskCard(page)).toContainText('1h 10m left');
	await expect(lengthField(page)).toHaveValue('90');
});

test('a started countdown reads the time left', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await lengthField(page).fill('45');

	await page
		.getByRole('button', {
			name: 'Start timer',
		})
		.click();

	await expect(taskCard(page)).toContainText('45m left');
});

test('the elapsed reading is still there beside the time left', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 20, 45);
	await page.reload();

	// Both numbers, because the elapsed one is what fills the 🪫 editor at exactly the
	// moment the countdown is telling the user to decide whether to stop.
	await expect(
		taskCard(page).getByText('20m', {
			exact: true,
		}),
	).toBeVisible();

	await expect(taskCard(page)).toContainText('25m left');
});

test('pausing holds the time left', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 20, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Pause timer',
		})
		.click();

	await expect(taskCard(page)).toContainText('25m left');
});

test('the countdown survives a reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 20, 45);
	await page.reload();
	await page.reload();

	await expect(taskCard(page)).toContainText('25m left');
});

test('the countdown reads on the Energy Lab too', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 20, 45);
	await page.reload();

	await page.goto('/energy');

	await expect(taskCard(page)).toContainText('25m left');
});

/* Pin: a 🪫 measurement is today's alone, so the length that funds one is gated the
   way every other timer control on the strip is. */
test('a past day offers no session length', async ({ page }) => {
	await page.goto(`/?date=${isoDate(-3)}`);

	await expect(lengthField(page)).toHaveCount(0);
});

/* Pin: the seeded minutes are the minutes the clock counted and never the target —
   a session stopped at the number the user typed would feed λ₀ its own prior
   (MATH.md §8.10). */
test('a stop still seeds the 🪫 editor with the minutes worked', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 20, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await openDrainEditor(page, 'Write report');
	await expect(drainForm(page).locator('input[type="number"]').first()).toHaveValue('20');
});

/* Pin: discarding is still the one way back to a fresh clock, and it takes the
   countdown with the reading. */
test('a discarded session takes its length with it', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 20, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await page
		.getByRole('button', {
			name: 'Discard timed session',
		})
		.click();

	await expect(
		page.getByRole('button', {
			name: 'Start timer',
		}),
	).toBeVisible();
});
