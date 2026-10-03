import { expect, test } from '@playwright/test';
import {
	addTask,
	AUTOSAVE_MS,
	calibrationCard,
	logFlow,
	seedPastDay,
	setBudget,
	taskRow,
} from './helpers';

/* The ⚡ flow log is the only user input that feeds fitUserConstants, so it is the
   one place where editing a task changes the model rather than just the row —
   from the NEXT day, since a plan reads only the logs that precede it. The badge and
   the log are one record in one object store since 2026-08-10, and it has to come back
   after a reload. */

/* A plan for the viewed day reads only logs dated before it, so what
   the UI can show today is the badge, the deferral, and that both survive a
   reload. That the log then MOVES the constants is a unit claim
   (`session-store.svelte.spec.ts`) rather than an e2e one: a fitted constant is not a
   number a browser assertion can read off a row. */
test('logging time-to-flow badges the task and defers the model update', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');

	await logFlow(page, 90);

	await expect(page.getByText('⚡ 90m').first()).toBeVisible();

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(page.getByText('⚡ 90m').first()).toBeVisible();

	// The deferral reads with the log, on /analytics, rather than on the page the log
	// was made from — and the invitation is gone, rather than asking for the log just
	// made.
	await page.goto('/analytics');

	await expect(page.getByText(/1 ⚡ logged today/)).toBeVisible();
	await expect(page.getByText(/to start personalizing/)).toHaveCount(0);
});

/* A ⚡ typed onto a day already worked is a measurement taken late, not one taken today:
   it carries the viewed day, so the history lists it there and the fit counts it at once
   instead of holding it until tomorrow. */
test('a ⚡ logged onto a past day carries that day and is not deferred', async ({ page }) => {
	const day = await seedPastDay(page, 3, ['Boxing training']);

	await logFlow(page, 90);

	await expect(page.getByText('⚡ 90m').first()).toBeVisible();

	await page.goto('/analytics');

	await expect(
		page.getByRole('button', {
			name: `Delete Time to flow logged on ${day}`,
		}),
	).toBeVisible();

	const flow = calibrationCard(page, 'Flow Calibration');

	await expect(flow).toBeVisible();
	await expect(flow.getByText(/counted from tomorrow/)).toHaveCount(0);
});

/* The prompt for the ⚡ button once sat behind the collapsed Day Setup disclosure,
   so the measurement that personalizes the model was reachable only by accident; it
   is a card of its own now. Completing a task is when the user still knows the answer — so the whole path
   from "nothing logged" to a personalized fit has to work without ever pressing ⚡. */
test('completing a task asks for its time-to-flow', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');

	await setBudget(page, 6);

	await page
		.getByRole('checkbox', {
			name: 'Mark Boxing training complete',
		})
		.check();

	// Completing asks BOTH measurements, since it is the moment both are knowable —
	// so every locator here has to name the editor it means.
	const flowForm = page.locator('form').filter({
		hasText: 'Minutes to reach flow',
	});

	await expect(
		page.locator('form').filter({
			hasText: 'After the session',
		}),
	).toBeVisible();

	await flowForm.getByPlaceholder('min').fill('40');

	await flowForm
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	await expect(page.getByText('⚡ 40m').first()).toBeVisible();

	// The prompt has done its job and gets out of the way. What replaces it is the line
	// that answers "I logged that, why did nothing move?" — read where the logs are.
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/analytics');

	await expect(page.getByText(/Model uses default constants/)).toHaveCount(0);
	await expect(page.getByText(/1 ⚡ logged today/)).toBeVisible();
});

/* Every row owns its own ⚡ editor, so a second tick prompts as readily as the
   first — the invariant the Lab's 🪫 prompt had to be brought in line with. */
test('completing a second task opens its own time-to-flow prompt', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await addTask(page, 'Deep work');
	await setBudget(page, 6);

	const forms = page.locator('form').filter({
		hasText: 'Minutes to reach flow',
	});

	await page
		.getByRole('checkbox', {
			name: 'Mark Boxing training complete',
		})
		.check();

	await expect(forms).toHaveCount(1);

	await page
		.getByRole('checkbox', {
			name: 'Mark Deep work complete',
		})
		.check();

	await expect(forms).toHaveCount(2);

	// …and un-completing one withdraws only its own
	await page
		.getByRole('checkbox', {
			name: 'Mark Deep work complete',
		})
		.uncheck();

	await expect(forms).toHaveCount(1);

	await expect(
		taskRow(page, 'Boxing training').locator('form').filter({
			hasText: 'Minutes to reach flow',
		}),
	).toBeVisible();
});

/* Dropping one bad point moved to /analytics with the listing itself (2026-08-10), back
   when each calibration card listed its own kind and so could show neither a neighbouring
   kind nor a day outside its own fit. Crossing the two screens is the test: the ✕ there
   has to reach the fit here, which is the whole reason the reading lives in one place. */
test('a single flow log is deletable from the analytics history', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await logFlow(page, 90);
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/analytics');

	await page
		.getByRole('button', {
			name: /^Delete Time to flow logged on/,
		})
		.click();

	await expect(page.getByText('No measurements logged in this range.')).toBeVisible();
	await expect(page.getByText(/Model uses default constants/)).toBeVisible();

	await page.goto('/');
	await expect(page.getByText('⚡ 90m')).toHaveCount(0);
});

/* The 🗑 in the row's own editor is the other address the same record is dropped by, and
   since 2026-08-11 it opens the same undo window: a drop reversible on /analytics and
   permanent on the row is the two screens disagreeing about one verb. The reload is what
   makes it worth an e2e — a restore that only patched the store's array would look
   identical until the next visit, with the fits refitted without the record meanwhile. */
test('a flow log dropped from its own row comes back on undo', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await logFlow(page, 90);

	const badge = page.getByRole('button', {
		name: 'Correct this time to flow',
	});

	await expect(badge).toBeVisible();

	// The badge re-opens the editor on the measurement; 🗑 drops the one it opened on.
	await badge.click();

	await page
		.getByRole('button', {
			name: 'Delete this flow log',
		})
		.click();

	await expect(badge).toHaveCount(0);

	await page
		.getByRole('button', {
			name: 'Undo',
		})
		.click();

	await expect(badge).toBeVisible();

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(badge).toBeVisible();
});

/* The Lab holds its own ⚡ drafts and forwards its row's 🗑 to them, and no other e2e
   drives that path: the same drop as above, on the Lab's row. No reload — the screen's
   own wiring is what is under test, not the store's re-read. */
test('a flow log dropped from the Lab’s row comes back on undo', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');
	await logFlow(page, 90);

	const badge = page.getByRole('button', {
		name: 'Correct this time to flow',
	});

	await expect(badge).toBeVisible();

	await badge.click();

	await page
		.getByRole('button', {
			name: 'Delete this flow log',
		})
		.click();

	await expect(badge).toHaveCount(0);

	await page
		.getByRole('button', {
			name: 'Undo',
		})
		.click();

	await expect(badge).toBeVisible();
});

/* The other half of that list's two verbs, added 2026-08-10: the ✎ corrects in place
   rather than linking to the day, which is possible because a correction rewrites the
   quantities the user rated and re-derives nothing from a task. Crossing the screens is
   again the test — the badge on `/` reads the day's observation, so it is what says the
   write landed on the right day and task. */
test('a flow log is correctable from the analytics history', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await logFlow(page, 90);
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/analytics');

	await page
		.getByRole('button', {
			name: /^Correct Time to flow logged on/,
		})
		.click();

	const minutes = page.locator('form input[type="number"]').first();

	// Seeded with the reading, in the unit it was measured in
	await expect(minutes).toHaveValue('90');

	await minutes.fill('45');

	await page
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	// One measurement still: ⚡ is one number per day, and a correction amends it
	await expect(page.getByText('1 measurement')).toBeVisible();

	// …and the row reads the new number. The count alone holds before the save too, while
	// the reading comes off the store's re-read and so lands only once the write
	// committed — the `goto` below aborts that transaction if it goes first.
	await expect(
		page.getByRole('listitem').filter({
			hasText: 'Boxing training',
		}),
	).toContainText('45m');

	await page.goto('/');
	await expect(page.getByText('⚡ 45m')).toBeVisible();
	await expect(page.getByText('⚡ 90m')).toHaveCount(0);
});
