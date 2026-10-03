import { expect, test, type Page } from '@playwright/test';
import {
	addTask,
	AUTOSAVE_MS,
	calibrationCard,
	drainChips,
	drainForm,
	isoDate,
	logDrain,
	logRest,
	openDrainEditor,
	plantRunningTimer,
	rowDrainForm,
	seedDay,
	seedPastDay,
	setBudget,
	taskRow,
} from './helpers';

test('stopping on the Lab fills the Lab’s own drain editor', async ({ page }) => {
	await page.goto('/energy');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	// Planted rather than clocked: the length field takes whole minutes.
	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await openDrainEditor(page, 'Deep work');
	await expect(drainForm(page).locator('input[type="number"]').first()).toHaveValue('45');
});

/* One stop funds one log, and the two screens are one ledger: the log saved on `/`
   spends the reading, so the Lab's editor opens empty afterwards. */
test('a reading spent on / is gone on the Lab', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await logDrain(page, 45, 5, 3);

	await page.goto('/energy');
	await openDrainEditor(page, 'Deep work');
	await expect(drainForm(page).locator('input[type="number"]').first()).toHaveValue('');
});

test('a reading discarded on the Lab is gone on /', async ({ page }) => {
	await page.goto('/energy');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 45);
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

	await page.goto('/');

	await expect(
		page.getByRole('button', {
			name: 'Start timer',
		}),
	).toBeVisible();
});

/* 🪫 rates the session that just ended, and finishing the task is the commonest
   way one ends — so the form opens itself there, and the button survives
   completion (the sliders beside it do not). Before this, completing a task
   removed the only way to rate it. */
test('completing a task opens its drain rating', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await page
		.getByRole('checkbox', {
			name: 'Mark Deep work complete',
		})
		.check();

	const form = page.locator('form').filter({
		hasText: 'After the session',
	});

	await expect(form).toBeVisible();

	// The completed look must not reach it: dimming the row faded the one control
	// that only exists for a finished session into looking disabled. Asserted on the
	// ROW, not the form — `opacity` does not inherit, so a child of an `opacity-60`
	// ancestor still computes 1 and an assertion on the form itself cannot fail.
	await expect(form.locator('xpath=ancestor::li[1]')).toHaveCSS('opacity', '1');

	const fields = form.locator('input[type="number"]');
	await fields.nth(0).fill('90');
	await fields.nth(1).fill('8');
	await fields.nth(2).fill('4');

	await form
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	await expect(drainChips(page)).toHaveCount(1);

	// The completed row keeps its 🪫 button, so a second session can still be logged
	await expect(
		page.getByRole('button', {
			name: 'Log end-of-session drain',
		}),
	).toBeAttached();
});

// Checking a task off is one click, so mis-clicking it is one click too.
test('un-completing a task withdraws its drain prompt', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	const checkbox = page.getByRole('checkbox', {
		name: 'Mark Deep work complete',
	});

	const form = page.locator('form').filter({
		hasText: 'After the session',
	});

	await checkbox.check();
	await expect(form).toBeVisible();

	await checkbox.uncheck();
	await expect(form).toHaveCount(0);
});

/* Ticking off a second task ends a second session, so it gets its own prompt —
   the same as the main page's ⚡, where every row owns its editor. The Lab's draft
   used to be one for the whole list, so only the first tick ever prompted. */
test('completing a second task opens its own drain rating', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await addTask(page, 'Gym session');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	const forms = page.locator('form').filter({
		hasText: 'After the session',
	});

	await page
		.getByRole('checkbox', {
			name: 'Mark Deep work complete',
		})
		.check();

	await expect(forms).toHaveCount(1);

	await page
		.getByRole('checkbox', {
			name: 'Mark Gym session complete',
		})
		.check();

	await expect(forms).toHaveCount(2);

	// …and un-completing one withdraws only its own
	await page
		.getByRole('checkbox', {
			name: 'Mark Gym session complete',
		})
		.uncheck();

	await expect(forms).toHaveCount(1);

	await expect(
		taskRow(page, 'Deep work').locator('form').filter({
			hasText: 'After the session',
		}),
	).toBeVisible();
});

/* The prompt must never destroy a rating being typed — now by opening beside it
   rather than by staying quiet. Completing B used to replace A's draft. */
test('a rating being typed survives another task being completed', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await addTask(page, 'Gym session');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	// Hand-open Deep work's rating and half-fill it. Named by its row, not `.first()`
	// — `addTask` prepends, so the first 🪫 belongs to Gym session, the task this test
	// then completes, and the cross-task invariant would go untested.
	const deepWork = taskRow(page, 'Deep work');

	await deepWork
		.getByRole('button', {
			name: 'Log end-of-session drain',
		})
		.click();

	const form = deepWork.locator('form').filter({
		hasText: 'After the session',
	});

	const worked = form.locator('input[type="number"]').first();

	// The 🪫 button asked for the editor, so it gets the caret
	await expect(worked).toBeFocused();
	await worked.fill('45');

	await page
		.getByRole('checkbox', {
			name: 'Mark Gym session complete',
		})
		.check();

	// Gym's own prompt opens beside it; Deep work's draft is untouched
	await expect(worked).toHaveValue('45');

	// …and un-completing Gym must not close an editor that was never its prompt
	await page
		.getByRole('checkbox', {
			name: 'Mark Gym session complete',
		})
		.uncheck();

	await expect(worked).toHaveValue('45');
});

// A prompt nobody asked for must not take the caret out of the task list, and an
// empty rating is not a rating of 0 — recording one would bias the α fit.
test('the drain prompt takes no focus and refuses an empty rating', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	const checkbox = page.getByRole('checkbox', {
		name: 'Mark Deep work complete',
	});

	await checkbox.check();

	const form = page.locator('form').filter({
		hasText: 'After the session',
	});

	// Asserted as "the checkbox still has it": `not.toBeFocused()` on the input would
	// also pass if a regression stole the caret one tick later.
	await expect(checkbox).toBeFocused();

	// Minutes alone is not a measurement: Mind and Body are still empty
	await form.locator('input[type="number"]').first().fill('90');

	await form
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	await expect(form).toBeVisible();
	await expect(drainChips(page)).toHaveCount(0);
});

/* The draft is page-level and is the whole gate on the prompt, so one left pointing
   at a row that is gone would suppress the prompt for every task, with no form left
   on screen to close. Tick-then-✕ is two adjacent clicks; the midnight rollover and
   the visibility re-read get there without any click at all. */
test('deleting a task takes its open drain prompt with it', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await addTask(page, 'Gym session');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	const form = page.locator('form').filter({
		hasText: 'After the session',
	});

	await page
		.getByRole('checkbox', {
			name: 'Mark Deep work complete',
		})
		.check();

	await expect(form).toHaveCount(1);

	await taskRow(page, 'Deep work')
		.getByRole('button', {
			name: 'Delete task',
		})
		.click();

	await expect(form).toHaveCount(0);

	// And it does not come back with the task: the undo restores it under its ORIGINAL
	// id, which is the one the draft was keyed by. The Lab holds its own copy of the
	// drafts, so this is a second place the ✕ has to drop them.
	await page
		.getByRole('button', {
			name: 'Undo',
		})
		.click();

	await expect(
		page.getByRole('checkbox', {
			name: 'Mark Deep work complete',
		}),
	).toBeVisible();

	await expect(form).toHaveCount(0);

	// The prompt still works for what is left — this is what an orphaned draft killed
	await page
		.getByRole('checkbox', {
			name: 'Mark Gym session complete',
		})
		.check();

	await expect(form).toHaveCount(1);
});

// Both logs live in EnergyObservationStore now, which reads IndexedDB on its
// own mount — so a reload is what proves that read is wired up.
test('drain and rest logs survive a reload', async ({ page }) => {
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 5);
	await expect(drainChips(page)).toHaveCount(1);

	await logRest(page, 30, 9, 8, 3, 2);
	await expect(page.getByText('Rest pairs · 1')).toBeVisible();

	await page.reload();

	await expect(drainChips(page)).toHaveCount(1);
	await expect(page.getByText('Rest pairs · 1')).toBeVisible();

	// A rest pair identifies the recovery rate on its own (MATH.md §8.9), and the
	// one Apply carries it — so this proves the reloaded pair reached the FIT, not
	// just the list's count. Past midnight, because r reads pairs dated before
	// today, and the new day needs a task of its own to render the sliders.
	await page.clock.fastForward('25:00:00');
	await page.goto('/energy');
	await addTask(page, 'Deep work');
	await page.clock.runFor(AUTOSAVE_MS);

	const recoveryRate = page.getByLabel('Recovery rate');
	const defaultRecovery = await recoveryRate.inputValue();

	await page
		.getByRole('button', {
			name: 'Apply my fits',
		})
		.click();

	await expect(recoveryRate).not.toHaveValue(defaultRecovery);
});

// Deleting the last rating must take the calibration back to the defaults, not
// leave a stale fit applied to the params.
// A rating is one SESSION, so the row button always starts a new one
// and correcting an old one goes through its ✎. Logging the correction instead
// would count the session twice — the defect this replaced, from the other side.
test('correcting a rating edits its row, while a second session adds one', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 180, 9, 5);

	await page
		.getByRole('button', {
			name: 'Correct this drain rating',
		})
		.click();

	// The ✎ re-opens THAT session, so the editor carries its stored values.
	const form = page.locator('form').filter({
		hasText: 'After the session',
	});

	const fields = form.locator('input[type="number"]');
	await expect(fields.nth(0)).toHaveValue('180');
	await expect(fields.nth(1)).toHaveValue('9');

	await fields.nth(1).fill('6');

	await form
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	// Corrected in place: still one row, now reading Mind 6.
	await expect(drainChips(page)).toHaveCount(1);
	await expect(page.getByText('Mind 6')).toBeVisible();

	// The row's own button is the other path: an empty form, and a second row.
	await logDrain(page, 90, 7, 4);
	await expect(drainChips(page)).toHaveCount(2);
});

/* Each screen forwards its row's 🪫 🗑 to its own drafts and nothing else drives it, so
   the drop is walked on both: the chip goes, the editor goes with it, and Undo brings the
   rating back. */
for (const path of ['/', '/energy']) {
	test(`a 🪫 rating dropped from its own row comes back on undo (${path})`, async ({ page }) => {
		await page.goto('/');
		await addTask(page, 'Deep work');
		await page.waitForTimeout(AUTOSAVE_MS);
		await page.goto(path);

		await logDrain(page, 60, 5, 3);
		await expect(drainChips(page)).toHaveCount(1);

		// The chip re-opens the editor on that rating; 🗑 drops the one it opened on.
		await drainChips(page).click();

		await page
			.getByRole('button', {
				name: 'Delete this drain rating',
			})
			.click();

		await expect(drainChips(page)).toHaveCount(0);
		await expect(drainForm(page)).toHaveCount(0);

		await page
			.getByRole('button', {
				name: 'Undo',
			})
			.click();

		await expect(drainChips(page)).toHaveCount(1);
	});
}

// The ✎ has to win over an editor already open on that row, and both halves of the
// draft have to move together: the fields the user sees AND the `recordId` that decides
// whether ✓ appends a session or rewrites one. They did not — the form read its seed at
// mount and the row never remounted it — so ✓ pointed at a stored rating while showing
// the blank one, which is a wrong write, not a stale display.
test('the ✎ re-seeds a drain editor the row already has open', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 180, 9, 5);

	// A second session, started and left open on the row
	await page
		.getByRole('button', {
			name: 'Log end-of-session drain',
		})
		.first()
		.click();

	const form = page.locator('form').filter({
		hasText: 'After the session',
	});

	const fields = form.locator('input[type="number"]');
	await expect(fields.nth(0)).toHaveValue('');

	// The chip on the logged rating, while that blank editor is still up
	await page
		.getByRole('button', {
			name: 'Correct this drain rating',
		})
		.click();

	// The open editor now reads the stored session, not the blank one it replaced
	await expect(fields.nth(0)).toHaveValue('180');
	await expect(fields.nth(1)).toHaveValue('9');
	await expect(fields.nth(2)).toHaveValue('5');

	await fields.nth(1).fill('6');

	await form
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	// Corrected in place — the ✎'s save path, not the button's
	await expect(drainChips(page)).toHaveCount(1);
	await expect(page.getByText('Mind 6')).toBeVisible();
});

test('deleting the drain rating clears the calibration', async ({ page }) => {
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 5);

	// The count comes off the store's re-read, so it says the write committed — a `goto`
	// fired into the gap before it aborts the transaction and nothing is there to drop.
	await expect(drainChips(page)).toHaveCount(1);

	// Carried past midnight, so there is a fit to clear at all.
	await page.clock.fastForward('25:00:00');
	await page.goto('/energy');
	await addTask(page, 'Deep work');
	await page.clock.runFor(AUTOSAVE_MS);

	await expect(
		page.getByRole('button', {
			name: 'Apply my fits',
		}),
	).toBeVisible();

	// Dropping one rating moved to /analytics with the listing (2026-08-10), and the
	// card followed it there. Crossing the two screens is still the point: the ✕ there
	// has to take this Lab's calibration with it.
	await page.goto('/analytics');

	await page
		.getByRole('button', {
			name: /^Delete Session rating logged on/,
		})
		.click();

	// Wait for the drop to land before navigating. The store re-reads IndexedDB after the
	// delete, and a `goto` fired into that gap aborts the transaction — so without this
	// the test flaked on its own speed rather than on the behaviour it names.
	await expect(page.getByText('No measurements logged in this range.')).toBeVisible();

	// The card falls back to its empty state beside the emptied list — both readings
	// are on this page now, so the ✕ answers for itself.
	await expect(page.getByText(/No ratings yet\./)).toBeVisible();

	await page.goto('/energy');

	// With no fit left anywhere the Apply beside the parameters is gone rather than
	// disabled — disabled reads as "already applied", which would be a claim about a
	// fit that no longer exists.
	await expect(
		page.getByRole('button', {
			name: 'Apply my fits',
		}),
	).toHaveCount(0);
});

/* The timer's whole point: the minutes reach the 🪫 form without being recalled.
   Only an e2e sees the path — the control on the card's heading row, the reading
   `localStorage` carries, and the editor on a row that never heard of either. */
test('stopping the timer fills the next drain editor', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await openDrainEditor(page, 'Write report');
	await expect(drainForm(page).locator('input[type="number"]').first()).toHaveValue('45');
});

/* One 🪫 row per session. The reading funds the log that spends it and no other, or
   the second row re-saves hours the day already counts. */
test('one stop funds one log', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await addTask(page, 'Gym session');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await openDrainEditor(page, 'Write report');
	const fields = drainForm(page).locator('input[type="number"]');
	await expect(fields.first()).toHaveValue('45');
	await fields.nth(1).fill('5');
	await fields.nth(2).fill('3');

	await drainForm(page)
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	await openDrainEditor(page, 'Gym session');
	await expect(drainForm(page).locator('input[type="number"]').first()).toHaveValue('');
});

/* The reading outlives the tab, which is why it is written at all: a session ends
   with a reload as often as with a click. */
test('the stopped reading survives a reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await page.reload();

	await openDrainEditor(page, 'Write report');
	await expect(drainForm(page).locator('input[type="number"]').first()).toHaveValue('45');
});

/* Correcting a rating rewrites a session already counted, so it never spends the
   timed one — the reading is still there for the log it belongs to. */
test('a correction does not spend the stopped reading', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await logDrain(page, 60, 5, 3);
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await taskRow(page, 'Write report')
		.getByRole('button', {
			name: 'Correct this drain rating',
		})
		.click();

	await drainForm(page)
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	await openDrainEditor(page, 'Write report');
	await expect(drainForm(page).locator('input[type="number"]').first()).toHaveValue('45');
});

/* Several rows hold an open 🪫 editor at once — ticking two tasks done opens two — and
   the stopped reading is one session's. The first editor opened claims it; any other
   opens empty and spends nothing, and closing the claim hands it back. */
test('a second drain editor opened over the reading opens empty', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await addTask(page, 'Gym session');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await openDrainEditor(page, 'Write report');
	await openDrainEditor(page, 'Gym session');

	const claimed = rowDrainForm(page, 'Write report').locator('input[type="number"]');
	const unclaimed = rowDrainForm(page, 'Gym session').locator('input[type="number"]');

	await expect(claimed.first()).toHaveValue('45');
	await expect(unclaimed.first()).toHaveValue('');

	// The row that opened empty rates its own session and leaves the reading where it was.
	await unclaimed.first().fill('30');
	await unclaimed.nth(1).fill('5');
	await unclaimed.nth(2).fill('3');

	await rowDrainForm(page, 'Gym session')
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	await rowDrainForm(page, 'Write report')
		.getByRole('button', {
			name: 'Cancel',
		})
		.click();

	await openDrainEditor(page, 'Write report');
	await expect(claimed.first()).toHaveValue('45');
});

/* One reading, one rule, on both screens that hold a 🪫 editor: the Lab seeds from the
   stopped reading and spends it, so a session rated there cannot be rated again here. */
test('the Lab seeds and spends the same stopped reading', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await page.waitForTimeout(AUTOSAVE_MS);

	await plantRunningTimer(page, 45);
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await page.goto('/energy');
	await openDrainEditor(page, 'Write report');

	const fields = rowDrainForm(page, 'Write report').locator('input[type="number"]');
	await expect(fields.first()).toHaveValue('45');
	await fields.nth(1).fill('5');
	await fields.nth(2).fill('3');

	await rowDrainForm(page, 'Write report')
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	await page.goto('/');
	await openDrainEditor(page, 'Write report');

	await expect(
		rowDrainForm(page, 'Write report').locator('input[type="number"]').first(),
	).toHaveValue('');
});

/* Both measurements are on this page now, and the 🪫 half is the one that was
   unreachable here: worked hours are what λ₀ (MATH.md §8.10), the adherence audit
   and overnight carry-over read finished days off, and every one of them came up
   empty for a user who never opened the Lab (ROADMAP item 11). The observations
   are one store, so what is logged here is what the Lab fits. */
test('a drain rating logged from the main page feeds the Lab', async ({ page }) => {
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 6);

	await logDrain(page, 120, 9, 5);

	// The chip comes off the store's re-read, so it says the write committed — a `goto`
	// fired into the gap before it aborts the transaction.
	await expect(drainChips(page)).toHaveCount(1);

	await page.clock.runFor(AUTOSAVE_MS);

	// …and it is a real fit, not just a stored row — which the rating reaches the
	// day after it was logged, on a day with a task of its own.
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

/* α is identity, so it reads days strictly before today, on the same rule as the ϕ fit
   (`DailyPlanStore`'s `#fitObservations`). A rating logged now is counted by the
   headline and named by the sentence, never folded into the fit. */
test('a rating logged today is named as deferred', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await logDrain(page, 120, 9, 5);
	await expect(page.getByText('Mind 9')).toBeVisible();

	await page.goto('/analytics');

	const drain = calibrationCard(page, 'Drain Calibration');

	await expect(
		drain.getByText('1', {
			exact: true,
		}),
	).toBeVisible();

	await expect(drain.getByText('1 rating logged today, counted from tomorrow')).toBeVisible();
});

/* The 🪫 twin of the past-day ⚡ in flow-log.e2e.ts: stamped with the viewed day, listed
   there and counted at once — and read back off that day after a reload, which is what
   says the day the record carries is the day the row shows. */
test('a 🪫 logged onto a past day carries that day and is not deferred', async ({ page }) => {
	const day = await seedPastDay(page, 3, ['Deep work']);

	await logDrain(page, 120, 9, 5);

	await expect(drainChips(page)).toHaveCount(1);

	await page.goto('/analytics');

	await expect(
		page.getByRole('button', {
			name: `Delete Session rating logged on ${day}`,
		}),
	).toBeVisible();

	const drain = calibrationCard(page, 'Drain Calibration');

	await expect(drain).toBeVisible();
	await expect(drain.getByText(/logged today, counted from tomorrow/)).toHaveCount(0);

	await page.goto(`/?date=${day}`);

	await expect(drainChips(page)).toHaveCount(1);
});

/* The minutes a stopped timer holds were counted today, so only today's 🪫 may spend
   them: a past day's editor opens empty even while the reading is waiting. The clock
   runs three days ahead here, so the timer is planted on the app's today, not the
   runner's. */
test('a past day’s 🪫 editor does not take today’s stopped reading', async ({ page }) => {
	const day = await seedPastDay(page, 3, ['Deep work']);

	await page.goto('/');
	await plantRunningTimer(page, 45, null, isoDate(3));
	await page.reload();

	await page
		.getByRole('button', {
			name: 'Stop timer',
		})
		.click();

	await page.goto(`/?date=${day}`);
	await openDrainEditor(page, 'Deep work');

	await expect(drainForm(page).locator('input[type="number"]').first()).toHaveValue('');
});

/** One 🪫 dated `date` under `taskTitle`. Written to the store directly rather than
 *  logged onto each day: faster, it sets `createdAt`, and the ratings and demands ARE the
 *  fixture, so it is written whole rather than copied off a logged row. One row per date, which is what
 *  makes each of them its day's first session (MATH.md §8.14). */
async function writeDrainLog(page: Page, date: string, taskTitle: string, mindDrain: number) {
	await page.evaluate(
		({ date, taskTitle, mindDrain }) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('zenith-db');
				request.onerror = () => reject(request.error);

				request.onsuccess = () => {
					const transaction = request.result.transaction('drainObservations', 'readwrite');

					transaction.objectStore('drainObservations').add({
						date,
						taskId: 1,
						taskTitle,
						hours: 2,
						cognitiveDemand: 0.8,
						physicalDemand: 0,
						mindDrain,
						bodyDrain: 0,
						createdAt: 100,
					});

					transaction.onerror = () => reject(transaction.error);
					transaction.oncomplete = () => resolve();
				};
			}),
		{
			date,
			taskTitle,
			mindDrain,
		},
	);
}

/* Six past days, one 🪫 each, under two titles rated far enough apart to clear §8.14's
   separation gate. Every date is inside the week the page opens on. The task is what
   gives the day a summary to analyze at all. */
async function seedRankableDrainLogs(page: Page) {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	for (const offset of [-1, -2, -3]) await writeDrainLog(page, isoDate(offset), 'Inbox', 2);

	for (const offset of [-4, -5, -6]) await writeDrainLog(page, isoDate(offset), 'Deep work', 8);
}

/* A day, so the gated cards render and the ranking's OWN gate is what is under test —
   against an empty range the page's empty state would hide it either way. */
test('a profile with no 🪫 ratings is offered no drain ranking', async ({ page }) => {
	await seedDay(page, 0, ['write the calibration section']);
	await page.goto('/analytics');

	await expect(
		page.getByRole('heading', {
			name: 'Your model',
		}),
	).toBeVisible();

	await expect(
		page.getByRole('heading', {
			name: 'Most draining per hour',
		}),
	).toHaveCount(0);
});

test('the ranking names the fastest and the slowest task to drain', async ({ page }) => {
	await seedRankableDrainLogs(page);
	await page.goto('/analytics');

	await expect(
		page.getByRole('heading', {
			name: 'Most draining per hour',
		}),
	).toBeVisible({
		timeout: 15000,
	});

	await expect(page.getByText('Deep work fastest · Inbox slowest')).toBeVisible({
		timeout: 15000,
	});
});

test('the ranking says how many of today’s ratings it has not counted', async ({ page }) => {
	await seedRankableDrainLogs(page);
	// Two rows dated today, so the line has to read the count and not "1".
	await writeDrainLog(page, isoDate(0), 'Deep work', 8);
	await writeDrainLog(page, isoDate(0), 'Inbox', 2);
	await page.goto('/analytics');

	// Card-scoped: the drain calibration card above prints the same sentence off the
	// same count, so an unscoped locator matches two elements.
	await expect(
		page
			.locator('.card-shell')
			.filter({
				has: page.getByRole('heading', {
					name: 'Most draining per hour',
				}),
			})
			.getByText('2 ratings logged today, counted from tomorrow'),
	).toBeVisible({
		timeout: 15000,
	});
});
