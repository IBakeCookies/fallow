import { expect, test } from '@playwright/test';
import {
	addTask,
	AUTOSAVE_MS,
	closeTaskForm,
	expectTaskInputs,
	isoDate,
	logDrain,
	logFlow,
	openTaskForm,
	setBudget,
	setSlider,
	taskCard,
	taskRow,
	timeBudgetBar,
} from './helpers';

test('fresh profile shows the empty state', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('No tasks deployed yet')).toBeVisible();

	await expect(
		page.getByRole('link', {
			name: 'Today',
		}),
	).toBeVisible();
});

test('the page keeps its heading without drawing one', async ({ page }) => {
	await page.goto('/');

	const heading = page.getByRole('heading', {
		name: 'Fallow',
		exact: true,
	});

	// The document needs an <h1> above the explainer's <h2> and the app bar already
	// draws the name, so it is attached and unpainted — never a second title.
	await expect(heading).toBeAttached();
	await expect(heading).toHaveClass('sr-only');
});

test('added task appears and survives a reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');

	// The row, not the title: the Bottleneck metric names the same task once the plan
	// funds it, from inside the collapsed disclosure above the ledger.
	await expect(taskRow(page, 'Boxing training')).toBeVisible();
	await expect(page.getByText('No tasks deployed yet')).not.toBeVisible();

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();
	await expect(taskRow(page, 'Boxing training')).toBeVisible();
});

test('completing a task persists across reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');

	// Named, not the only one on the page: the task form carries a "must do today"
	// checkbox above the list, so a bare checkbox role is ambiguous.
	const checkbox = page.getByRole('checkbox', {
		name: 'Mark Write report complete',
	});

	await checkbox.check();
	await expect(checkbox).toBeChecked();

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(
		page.getByRole('checkbox', {
			name: 'Mark Write report complete',
		}),
	).toBeChecked();
});

/* The day is drawn once: the ledger's rows carry their own rails, and nothing above
   the ledger repeats a row's title, position, hours or verdict. `#1 Deep work` is the
   row's own title line and nothing else's. */
test('the Plan card lists no strip above the ledger', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 3);

	await expect(page.getByText('#1 Deep work')).toHaveCount(1);
});

/* The rail and the axis stay on a phone: a thin line costs no height and is the one
   reading a phone can afford after the readings hide. What has to hold with them is
   that the document still does not scroll sideways on a day long enough to crowd the
   axis, since the strip's own scroll region is what these replaced. */
test('the document never scrolls sideways, on a long day on a phone', async ({ page }) => {
	await page.setViewportSize({
		width: 390,
		height: 900,
	});

	await page.goto('/');
	await setBudget(page, 12);

	for (const title of ['Deep work', 'Write the PDF solution', 'Review 1 PR API', 'Boxing']) {
		await addTask(page, title);
	}

	await expect(taskRow(page, 'Deep work').getByText('warming up')).toBeAttached();

	const document = await page.evaluate(() => ({
		content: window.document.documentElement.scrollWidth,
		box: window.document.documentElement.clientWidth,
	}));

	expect(document.content).toBe(document.box);
});

/* The rail is the plan and the checkbox is the day: a box ticked on the row dims the
   rail on the same row, and the plan under it does not move. */
test('ticking a task off dims its rail', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 3);

	// The segment's `sr-only` name, up to the track that holds it.
	const rail = taskRow(page, 'Deep work').getByText('warming up').locator('../..');

	await expect(rail).toBeVisible();
	await expect(rail).not.toHaveClass(/opacity-60/);

	await page
		.getByRole('checkbox', {
			name: 'Mark Deep work complete',
		})
		.check();

	await expect(rail).toHaveClass(/opacity-60/);
});

test('removing a task restores the empty state', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Throwaway');
	await expect(taskRow(page, 'Throwaway')).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Delete task',
		})
		.click();

	await expect(page.getByText('No tasks deployed yet')).toBeVisible();
});

/* The ✕ is one click next to the ✎ and takes the task's sliders and ⚡ logs with
   it, so the delete is immediate and the toast is the way back. */
test('a deleted task comes back from the undo toast', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Throwaway');
	await addTask(page, 'Keep me');

	// The row, not its title: the title is also in the toast that reports the delete.
	const row = page.getByRole('checkbox', {
		name: 'Mark Throwaway complete',
	});

	await taskRow(page, 'Throwaway')
		.getByRole('button', {
			name: 'Delete task',
		})
		.click();

	await expect(row).toHaveCount(0);
	await expect(page.getByText('Deleted “Throwaway”.')).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Undo',
		})
		.click();

	await expect(row).toBeVisible();
	await expect(taskRow(page, 'Keep me')).toBeVisible();

	// The restored task has to survive the autosave that follows it — the removal was
	// already persisted by the time the undo ran.
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(row).toBeVisible();
});

/* The row's editors are the PAGE's state, keyed by task id, and the undo restores the
   task under its ORIGINAL id (`removeTask`) — so a draft the ✕ left behind is reachable
   again, and comes back as an editor nobody opened. Both measurements in one test:
   they are two paints of one editor policy and must not drift apart. */
test('undo brings a deleted task back with no editor open', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Throwaway');

	const row = taskRow(page, 'Throwaway');

	await row
		.getByRole('button', {
			name: 'Log time to flow',
		})
		.click();

	await row
		.getByRole('button', {
			name: 'Log end-of-session drain',
		})
		.click();

	await expect(page.getByText('⚡ Minutes to reach flow:')).toBeVisible();
	await expect(page.getByText('🪫 After the session:')).toBeVisible();

	await row
		.getByRole('button', {
			name: 'Delete task',
		})
		.click();

	await page
		.getByRole('button', {
			name: 'Undo',
		})
		.click();

	await expect(
		page.getByRole('checkbox', {
			name: 'Mark Throwaway complete',
		}),
	).toBeVisible();

	await expect(page.getByText('⚡ Minutes to reach flow:')).toHaveCount(0);
	await expect(page.getByText('🪫 After the session:')).toHaveCount(0);
});

// ROADMAP items 15 and 24. Only an e2e covers the whole path this feature is: a
// stored day, the history read the store boots with, and the form that offers it
// back as you type.
test('a title picked from the suggestions brings its ratings with it', async ({ page }) => {
	await page.goto('/');

	// The task editor carries the same field and slider labels, so scope to the add
	// form by the dialog it is the only thing in.
	const form = page.getByRole('dialog').locator('form');

	await openTaskForm(page);

	await form
		.getByLabel('Title', {
			exact: true,
		})
		.fill('Gym session');

	await setSlider(form.getByLabel('Physical Diff'), 8);
	await setSlider(form.getByLabel('Mental Diff'), 2);
	await setSlider(form.getByLabel('Enjoyment'), 8);

	await form
		.getByRole('button', {
			name: 'Deploy Task',
		})
		.click();

	await closeTaskForm(page);

	await expectTaskInputs(page, 'Gym session', [8, 2, 8]);
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(taskRow(page, 'Gym session')).toBeVisible();

	// The dialog is gone with the reload; the title it stored is what the reopened
	// form has to offer back.
	await openTaskForm(page);

	// Typed, not filled: the suggestions answer to input events, and two
	// characters of the wrong case are all it takes.
	await form
		.getByLabel('Title', {
			exact: true,
		})
		.pressSequentially('GY');

	await form
		.getByRole('option', {
			name: 'Gym session',
		})
		.click();

	await expect(
		form.getByLabel('Title', {
			exact: true,
		}),
	).toHaveValue('Gym session');

	await expect(form.getByLabel('Physical Diff')).toHaveValue('8');
	await expect(form.getByLabel('Mental Diff')).toHaveValue('2');
	await expect(form.getByLabel('Enjoyment')).toHaveValue('8');

	// Two Escapes, two different closes — the list first, the dialog second. One
	// Escape taking the whole form is what an unstopped keydown does, since bits-ui
	// listens for it on `document`.
	await form
		.getByLabel('Title', {
			exact: true,
		})
		.pressSequentially('X');

	await expect(form.getByRole('option')).toHaveCount(0);

	await form
		.getByLabel('Title', {
			exact: true,
		})
		.press('Backspace');

	await expect(
		form.getByRole('option', {
			name: 'Gym session',
		}),
	).toBeVisible();

	await page.keyboard.press('Escape');

	await expect(form.getByRole('option')).toHaveCount(0);
	await expect(page.getByRole('dialog')).toBeVisible();

	await page.keyboard.press('Escape');

	await expect(page.getByRole('dialog')).toBeHidden();
});

/* A task the user has done before is added by picking its title, and the tags they
   filed it under last time come back with the sliders — so a recurring task keeps
   its labels without being re-tagged every morning. The pick REPLACES the draft's
   tags, the way it already replaces the sliders. */
test('a picked title brings its tags back with it', async ({ page }) => {
	await page.goto('/');

	// The row editor carries the same field labels, so scope to the add form by the
	// dialog it is the only thing in.
	const form = page.getByRole('dialog').locator('form');

	const titleField = form.getByLabel('Title', {
		exact: true,
	});

	await openTaskForm(page);
	await titleField.fill('Gym session');
	await form.getByLabel('Tags').fill('strength,morning');

	// The arrange, asserted: the comma files the first tag and the deploy's blur the
	// second, so a red below is the recall failing and not the tagging.
	await expect(
		form.getByRole('button', {
			name: 'Remove tag strength',
		}),
	).toBeVisible();

	await form
		.getByRole('button', {
			name: 'Deploy Task',
		})
		.click();

	await closeTaskForm(page);
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(taskRow(page, 'Gym session')).toBeVisible();

	// The dialog is gone with the reload; the tags it stored are what the reopened
	// form has to offer back.
	await openTaskForm(page);

	// Typed, not filled: the suggestions answer to input events.
	await titleField.pressSequentially('GY');

	await form
		.getByRole('option', {
			name: 'Gym session',
		})
		.click();

	await expect(
		form.getByRole('button', {
			name: 'Remove tag strength',
		}),
	).toBeVisible();

	await expect(
		form.getByRole('button', {
			name: 'Remove tag morning',
		}),
	).toBeVisible();
});

/* The badge is the page's only wiring of the mid-day re-plan's position 1 — a story
   can pass `nextTaskId` itself, so only an e2e sees `/` reading it off
   `remainingDay.nextTask`. The two orders are read from different bases and the
   morning `#N` beside it is not moved to agree, which is what the tooltip explains. */
test('"Next" badges the row to pick up, not the card heading', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await addTask(page, 'Gym session');

	// A fresh profile has no hours, and an unfunded remainder has no position 1.
	await setBudget(page, 6);
	await logDrain(page, 60, 5, 3);

	const next = taskCard(page).getByRole('button', {
		name: 'Next',
	});

	await expect(next).toBeVisible();

	// Inside a row, and inside the one row the re-plan names: the heading no longer
	// prints the title a second time.
	await expect(
		taskCard(page)
			.getByRole('listitem')
			.filter({
				// Page-relative: `has` re-queries inside each row, so a card-scoped locator
				// here matches nothing.
				has: page.getByRole('button', {
					name: 'Next',
				}),
			}),
	).toHaveCount(1);

	await expect(
		taskCard(page)
			.getByRole('heading', {
				name: 'Plan',
				exact: true,
			})
			.locator('..'),
	).not.toContainText('Next');
});

/* ROADMAP item 14. The row's own arithmetic is a unit test (`remaining-day`,
   `metric-descriptor`); what only an e2e can see is the wiring — the page handing
   the mid-day re-plan to `buildMetrics` at all — so both halves of the gate are
   asserted here, before and after the day's first 🪫 log. */
test('capacity left reads N/A until a session is rated, then names what is spent', async ({
	page,
}) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await setBudget(page, 6);

	const row = page
		.locator('div')
		.filter({
			has: page.getByText('Capacity Left', {
				exact: true,
			}),
		})
		.last();

	await expect(row).toContainText('N/A');

	const form = page.locator('form').filter({
		hasText: 'After the session',
	});

	await page
		.getByRole('button', {
			name: 'Log end-of-session drain',
		})
		.click();

	const fields = form.locator('input[type="number"]');

	// 2 h on a 5/5 task draws 1 h of the 4-hour cognitive pool: three quarters left.
	await fields.nth(0).fill('120');
	await fields.nth(1).fill('5');
	await fields.nth(2).fill('3');

	await form
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	// A share, not a duration: pool hours are weighted ones.
	await expect(row).toContainText('75%');
});

/* A phone reads the plan and drops the row's detail line: seven figures at `text-2xs`
   wrapped to three lines buried the one thing the screen is for. Both halves are the
   test — what stays is on screen AND the document still does not scroll, since hiding a
   line is only correct while nothing else widens the page. */
test('a phone reads the plan and hides the row detail', async ({ page }) => {
	await page.setViewportSize({
		width: 390,
		height: 900,
	});

	await page.goto('/');
	await setBudget(page, 6);
	await addTask(page, 'Design the error boundary');
	await addTask(page, 'Write the PDF solution');
	await addTask(page, 'Review 1 PR API');

	const row = taskRow(page, 'Design the error boundary');
	await expect(row).toBeVisible();

	// The run order, the hours the plan gave it, and the four controls
	await expect(row.getByText(/^#\d+$/)).toBeVisible();
	await expect(row.locator('.font-semibold.text-ty-primary')).toBeVisible();

	for (const name of ['Edit task', 'Delete task']) {
		await expect(
			row.getByRole('button', {
				name,
			}),
		).toBeVisible();
	}

	// And not the readings — ✎ is where a phone re-reads the three sliders. Counted
	// first: `toBeHidden` also passes on a locator that matches nothing, so on its own
	// it would still pass if the reading were renamed rather than hidden.
	const readings = row.getByText(/^effort /);

	await expect(readings).toHaveCount(1);
	await expect(readings).toBeHidden();

	const document = await page.evaluate(() => ({
		content: window.document.documentElement.scrollWidth,
		box: window.document.documentElement.clientWidth,
	}));

	expect(document.content).toBe(document.box);
});

/* The verdict on the day comes before the setup that produces it; the list still
   reads before the full readings. What put the first task past the fold at every
   desktop size was the whole metrics grid, and that is what stayed underneath. */
test('the verdict reads above the ledger and the full readings below it', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Write report');
	await setBudget(page, 8);

	const verdict = await page.getByText(/^Momentum:/).boundingBox();
	const ledger = await taskRow(page, 'Write report').boundingBox();

	const readings = await page
		.getByText('Does the day fit?', {
			exact: true,
		})
		.boundingBox();

	expect(verdict?.y).toBeLessThan(ledger?.y ?? 0);
	expect(ledger?.y).toBeLessThan(readings?.y ?? 0);
});

/* Both records copy the task's title at logging time, and a rename left that copy
   behind — the history printed a name the task no longer has, with nothing to say the
   two rows were the same task. It reads the live title by `taskId` now, off the year of
   days the page already loads. Crossing the screens is the test: the rename happens on
   `/` and only the list can say which name it prints. */
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

	await expect(taskRow(page, 'Boxing sparring')).toBeVisible();
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
	await expectTaskInputs(page, 'Boxing training', [5, 5, 5]);

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
	await setSlider(editor.getByLabel('Mental Diff'), 6);

	await editor
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	await expect(taskRow(page, 'Boxing sparring')).toBeVisible();
	await expectTaskInputs(page, 'Boxing sparring', [5, 6, 5]);

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.reload();

	await expect(taskRow(page, 'Boxing sparring')).toBeVisible();
	await expectTaskInputs(page, 'Boxing sparring', [5, 6, 5]);
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

	await expect(taskRow(page, 'Boxing sparring')).toBeVisible();

	// Saving closes the editor, and the rename reached the shared session — the main
	// page reads it without a reload.
	await expect(page.getByLabel('Title')).toHaveCount(0);

	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/');
	await expect(taskRow(page, 'Boxing sparring')).toBeVisible();
});

/* ✎ is seeded from what the row was handed, and the Lab's editor shows no flag at all,
   so a save that changes nothing must hand every field it was not shown back as it came. */
test('saving ✎ unchanged keeps the flag, the level and the tags, on both screens', async ({
	page,
}) => {
	await page.goto('/');

	const title = await openTaskForm(page);
	const form = page.getByRole('dialog').locator('form');

	await title.fill('Send the invoice');
	await form.getByLabel('Keep on today').check();

	await form
		.getByRole('group', {
			name: 'Importance',
		})
		.getByRole('radio', {
			name: 'High',
			exact: true,
		})
		.check();

	await form.getByLabel('Tags').fill('admin,');

	await expect(
		form.getByRole('button', {
			name: 'Remove tag admin',
		}),
	).toBeVisible();

	await form
		.getByRole('button', {
			name: 'Deploy Task',
		})
		.click();

	await closeTaskForm(page);
	await setBudget(page, 6);
	await page.waitForTimeout(AUTOSAVE_MS);

	const editor = page.locator('form').filter({
		has: page.getByLabel('Title'),
	});

	for (const path of ['/energy', '/']) {
		await page.goto(path);

		await page
			.getByRole('button', {
				name: 'Edit task',
			})
			.click();

		await editor
			.getByRole('button', {
				name: 'Save',
			})
			.click();

		await expect(page.getByLabel('Title')).toHaveCount(0);
		await page.waitForTimeout(AUTOSAVE_MS);
	}

	await page.reload();

	const row = taskRow(page, 'Send the invoice');

	await expect(row.getByText('Stays today')).toBeVisible();
	await expect(row.getByText('High importance')).toBeVisible();

	await row
		.getByRole('button', {
			name: 'Edit task',
		})
		.click();

	await expect(
		row.getByRole('button', {
			name: 'Remove tag admin',
		}),
	).toBeVisible();
});

/* A stored task answers none of the three optional questions until someone sets one
   (`Task`), and the sanitizer drops a false flag on every read. Both rows must read the
   absence as the default, never as a level nobody chose. */
test('a task stored with no flag, level or tags reads as the defaults on both screens', async ({
	page,
}) => {
	const date = isoDate(0);

	// Seeded once the app's boot has opened the database — see `carry-unfinished.e2e.ts`.
	await page.goto('/');
	await expect(timeBudgetBar(page)).toHaveAttribute('open', '');

	await page.evaluate(
		(date) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('zenith-db');
				request.onerror = () => reject(request.error);

				request.onsuccess = () => {
					const transaction = request.result.transaction('sessions', 'readwrite');

					transaction.objectStore('sessions').put({
						date,
						tasks: [
							{
								id: 1,
								title: 'Morning run',
								physicalDifficulty: 7,
								mentalDifficulty: 1,
								enjoyment: 6,
								createdAt: date,
								completed: false,
							},
						],
						availableHours: 6,
						switchCost: 0.25,
						updatedAt: 1,
					});

					transaction.onerror = () => reject(transaction.error);
					transaction.oncomplete = () => resolve();
				};
			}),
		date,
	);

	const normal = page
		.getByRole('group', {
			name: 'Importance',
		})
		.getByRole('radio', {
			name: 'Normal',
			exact: true,
		});

	await page.reload();

	const row = taskRow(page, 'Morning run');

	await expect(row).toBeVisible();
	await expect(row.getByText(/importance|Stays today/)).toHaveCount(0);

	await row
		.getByRole('button', {
			name: 'Edit task',
		})
		.click();

	await expect(normal).toBeChecked();
	await expect(page.getByLabel('Keep on today')).not.toBeChecked();

	await expect(
		page.getByRole('button', {
			name: /^Remove tag /,
		}),
	).toHaveCount(0);

	await page.goto('/energy');

	await page
		.getByRole('button', {
			name: 'Edit task',
		})
		.click();

	await expect(normal).toBeChecked();

	await expect(
		page.getByRole('button', {
			name: /^Remove tag /,
		}),
	).toHaveCount(0);
});

/* Importance is the one task field with no slider and no default worth showing on the
   row: `Normal` is silent, and only a level the user chose gets a badge. The edit form
   is where a task already deployed changes level, so it has to seed from what is
   stored — otherwise saving any other edit would quietly reset the level to Normal. */
test('a task’s importance is editable after it is deployed', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');

	const row = taskRow(page, 'Boxing training');

	// Nothing badged: a task nobody rated is Normal, and Normal says nothing.
	await expect(row.getByText(/importance/)).toHaveCount(0);

	await row
		.getByRole('button', {
			name: 'Edit task',
		})
		.click();

	// Seeded from the stored level, which is what a save must not overwrite.
	await expect(
		row
			.getByRole('group', {
				name: 'Importance',
			})
			.getByRole('radio', {
				name: 'Normal',
				exact: true,
			}),
	).toBeChecked();

	await row
		.getByRole('group', {
			name: 'Importance',
		})
		.getByRole('radio', {
			name: 'Low',
			exact: true,
		})
		.check();

	await row
		.getByRole('button', {
			name: 'Save',
		})
		.click();

	await expect(row.getByText('Low importance')).toBeVisible();
});
