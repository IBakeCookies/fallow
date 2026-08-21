import { expect, test, type Page } from '@playwright/test';
import { addTask, AUTOSAVE_MS, logDrain, setBudget } from './helpers';

/* The ⚡ flow log is the only user input that feeds fitUserConstants, so it is the
   one place where editing a task changes the model rather than just the row —
   from the NEXT day, since a plan reads only the logs that precede it (MATH.md
   §33). The badge and the log are one record in one object store since 2026-08-10, and
   it has to come back after a reload. */

async function logFlow(page: Page, minutes: number) {
	await page
		.getByRole('button', {
			name: 'Log time to flow',
		})
		.click();

	await page.getByPlaceholder('min').fill(String(minutes));

	await page
		.getByRole('button', {
			name: '✓',
		})
		.click();
}

/* MATH.md §33: a plan for the viewed day reads only logs dated before it, so what
   the UI can show today is the badge, the deferral, and that both survive a
   reload. That the log then MOVES the constants is a unit claim
   (`session-store.svelte.spec.ts`) rather than an e2e one, because ⚡ is
   today-only and no UI path produces a log dated yesterday. */
test('logging time-to-flow badges the task and defers the model update', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await expect(page.getByText(/Model uses default constants/)).toBeVisible();

	await logFlow(page, 90);

	await expect(page.getByText('⚡ 90m').first()).toBeVisible();
	await expect(page.getByText(/1 ⚡ logged today/)).toBeVisible();
	// …and the invitation is gone, rather than asking for the log just made.
	await expect(page.getByText(/to start personalizing/)).toHaveCount(0);

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(page.getByText('⚡ 90m').first()).toBeVisible();
	await expect(page.getByText(/1 ⚡ logged today/)).toBeVisible();
});

/* The ⚡ button is hover-revealed and the prompt for it sat behind the collapsed
   Time Budget disclosure, so the measurement that personalizes the model was
   reachable only by accident. Completing a task is when the user still knows the
   answer — so the whole path from "nothing logged" to a personalized fit has to
   work without ever pressing ⚡. */
test('completing a task asks for its time-to-flow', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');

	// The bar opens itself while the day's hours are unset — collapse it, so the
	// prompt is proving itself and not `isOpen`.
	await setBudget(page, 6);

	await page
		.getByRole('button', {
			name: /Time Budget/,
		})
		.click();

	await expect(page.getByText(/Model uses default constants/)).toBeVisible();

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
			name: '✓',
		})
		.click();

	await expect(page.getByText('⚡ 40m').first()).toBeVisible();

	// The prompt has done its job and gets out of the way. What replaces it does
	// NOT go quiet: the deferral is the line that answers "I logged that, why did
	// nothing move?" (MATH.md §33), so unlike a settled fit it stays readable
	// while collapsed — and is the log list's toggle once opened.
	await expect(page.getByText(/Model uses default constants/)).toHaveCount(0);
	await expect(page.getByText(/1 ⚡ logged today/)).toBeVisible();

	await page
		.getByRole('button', {
			name: /Time Budget/,
		})
		.click();

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
		page
			.locator('li')
			.filter({
				hasText: 'Boxing training',
			})
			.locator('form')
			.filter({
				hasText: 'Minutes to reach flow',
			}),
	).toBeVisible();
});

// The constants are always derived from the logs, never stored — so deleting the
// logs is the only reset, and it has to take the badge with it.
test('resetting personalization reverts to the default constants', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await logFlow(page, 90);
	await expect(page.getByText(/1 ⚡ logged today/)).toBeVisible();

	// The card states the fit and offers its two verbs directly: since 2026-08-10 it
	// lists no logs, so there is nothing to expand first.
	await page
		.getByRole('button', {
			name: 'Reset personalization',
		})
		.click();

	await page
		.getByRole('button', {
			name: 'Reset',
			exact: true,
		})
		.click();

	await expect(page.getByText(/Model uses default constants/)).toBeVisible();
	await expect(page.getByText('⚡ 90m')).toHaveCount(0);
});

/* Dropping one bad point moved to /analytics with the listing itself (2026-08-10): the
   three calibration cards each listed their own kind, so none could show a neighbouring
   kind or a day outside its own fit. Crossing the two screens is the test: the ✕ there
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

	await page.goto('/');
	await expect(page.getByText(/Model uses default constants/)).toBeVisible();
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

/* The other half of that list's two verbs, added 2026-08-10: the ✎ corrects in place
   rather than linking to the day, which is possible because a correction rewrites the
   quantities the user rated and re-derives nothing from a task (MATH.md §36). Crossing
   the screens is again the test — the badge on `/` reads the day's observation, so it is
   what says the write landed on the right day and task. */
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
			name: '✓',
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

/* Both records copy the task's title at logging time, and a rename left that copy
   behind — the history printed a name the task no longer has, with nothing to say the
   two rows were the same task. It reads the live title by `taskId` now (MATH.md §36),
   off the year of days the page already loads. Crossing the screens is the test: the
   rename happens on `/` and only the list can say which name it prints. */
test('the log history follows a renamed task', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await logFlow(page, 90);
	await logDrain(page, 60, 7, 3);

	await page
		.getByRole('button', {
			name: 'Edit task',
		})
		.click();

	const editor = page.locator('form').filter({
		has: page.getByLabel('Title'),
	});

	await editor.getByLabel('Title').fill('Boxing sparring');

	await editor
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	await expect(page.getByText('Boxing sparring').first()).toBeVisible();
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/analytics');

	// Both measurements, under the name the task carries now
	await expect(page.getByText('2 measurements')).toBeVisible();

	await expect(
		page.getByRole('listitem').filter({
			hasText: 'Boxing sparring',
		}),
	).toHaveCount(2);

	await expect(
		page.getByRole('listitem').filter({
			hasText: 'Boxing training',
		}),
	).toHaveCount(0);
});

/* Re-tuning a task after it is added is a different path from creating one: the
   editor seeds its draft from the task, and the new values have to reach both the
   allocator's inputs and the persisted session. */
test('editing a task rewrites its inputs and survives a reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await expect(page.getByText('P 5 · M 5 · E 5')).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Edit task',
		})
		.click();

	// The add-task form carries the same slider labels, so scope to the editor —
	// which is the only form with a "Title" field.
	const editor = page.locator('form').filter({
		has: page.getByLabel('Title'),
	});

	await editor.getByLabel('Title').fill('Boxing sparring');
	// Range inputs take keyboard steps; fill() refuses them.
	await editor.getByLabel('Mental Diff').press('ArrowRight');

	await editor
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	await expect(page.getByText('Boxing sparring').first()).toBeVisible();
	await expect(page.getByText('P 5 · M 6 · E 5')).toBeVisible();

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(page.getByText('Boxing sparring').first()).toBeVisible();
	await expect(page.getByText('P 5 · M 6 · E 5')).toBeVisible();
});

/* The same editor, opened from the Lab's row. It is the same task and the same
   store, so a title was never one screen's to own — the Lab could not rename one at
   all until the editor was shared. */
test('the Lab edits a task with the same editor as the main page', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await setBudget(page, 6);
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/energy');

	await page
		.getByRole('button', {
			name: 'Edit task',
		})
		.click();

	const editor = page.locator('form').filter({
		has: page.getByLabel('Title'),
	});

	await editor.getByLabel('Title').fill('Boxing sparring');

	await editor
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	await expect(page.getByText('Boxing sparring').first()).toBeVisible();

	// Saving closes the editor, and the rename reached the shared session — the main
	// page reads it without a reload.
	await expect(page.getByLabel('Title')).toHaveCount(0);

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/');
	await expect(page.getByText('Boxing sparring').first()).toBeVisible();
});

/* Both measurements are on this page now, and the 🪫 half is the one that was
   unreachable here: worked hours are what λ₀ (MATH.md §8.10), the §12 adherence
   audit and overnight carry-over (§11.9) read finished days off, and every one of
   them came up empty for a user who never opened the Lab (ROADMAP item 11). The
   observations are one store, so what is logged here is what the Lab fits. */
test('a drain rating logged from the main page feeds the Lab', async ({ page }) => {
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 6);

	await logDrain(page, 120, 9, 5);
	await page.clock.runFor(AUTOSAVE_MS);

	await page.goto('/energy');

	await expect(page.getByText('Drain ratings · 1')).toBeVisible();

	// …and it is a real fit, not just a stored row — which the rating reaches the
	// day after it was logged (MATH.md §33), on a day with a task of its own.
	await page.clock.fastForward('25:00:00');
	await page.goto('/energy');
	await addTask(page, 'Deep work');
	await page.clock.runFor(AUTOSAVE_MS);

	const cognitiveDrain = page.getByLabel('Cognitive drain');
	const defaultDrain = await cognitiveDrain.inputValue();

	await page
		.getByRole('button', {
			name: 'Apply my fits',
		})
		.click();

	await expect(cognitiveDrain).not.toHaveValue(defaultDrain);
});
