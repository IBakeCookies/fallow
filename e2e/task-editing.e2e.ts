import { expect, test, type Page } from '@playwright/test';
import { addTask, AUTOSAVE_MS, setBudget } from './helpers';

/* The ⚡ flow log is the only user input that feeds fitUserConstants, so it is the
   one place where editing a task changes the model rather than just the row —
   from the NEXT day, since a plan reads only the logs that precede it (MATH.md
   §33). Both the badge (stamped on the task, saved with the session) and the log
   itself (its own object store) have to come back after a reload. */

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

	await page.getByPlaceholder('min').fill('40');

	await page
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
			.locator('form'),
	).toBeVisible();
});

// The constants are always derived from the logs, never stored — so deleting the
// logs is the only reset, and it has to take the badge with it.
test('resetting personalization reverts to the default constants', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await logFlow(page, 90);
	await expect(page.getByText(/1 ⚡ logged today/)).toBeVisible();

	// The log list is collapsed until its status line is clicked.
	await page
		.getByRole('button', {
			name: /1 ⚡ logged today/,
		})
		.click();

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

test('a single flow log is deletable from the list', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await logFlow(page, 90);

	await page
		.getByRole('button', {
			name: /1 ⚡ logged today/,
		})
		.click();

	await page
		.getByRole('button', {
			name: 'Delete this flow log',
		})
		.click();

	await expect(page.getByText(/Model uses default constants/)).toBeVisible();
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
