import { expect, type Locator, type Page } from '@playwright/test';

/* All data lives in client-side IndexedDB; each test gets a fresh browser
   context, so every test starts on an empty profile. */

// SessionStore's trailing autosave debounce is 500ms; overshoot so a slow CI
// worker still flushes the IndexedDB write before the assertion.
export const AUTOSAVE_MS = 1000;

// local date, matching the app's toISODate (toISOString would drift near midnight)
export function isoDate(offsetDays: number): string {
	const d = new Date();
	d.setDate(d.getDate() + offsetDays);
	const pad = (n: number) => String(n).padStart(2, '0');

	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The Plan card — `card-shell` is the documented card surface (tokens.css) and this
 *  is the one that heads the list. Scoped, because the day's Load and Save read on
 *  this card's heading row and nowhere else on the page. */
export const taskCard = (page: Page) =>
	page.locator('.card-shell').filter({
		has: page.getByRole('heading', {
			name: 'Plan',
			exact: true,
		}),
	});

/** A task's row: the `<li>` holding both its lines and any editor it has open
 *  (`task-row-shell.svelte`). Scoped to the Plan card, because the Lab's schedule list
 *  carries the same titles in list items of its own. */
export const taskRow = (page: Page, title: string) =>
	taskCard(page).getByRole('listitem').filter({
		hasText: title,
	});

/** The row's three model-input readings — `P n · M n · E n`, on the line under the
 *  title with everything else the row says about the task. */
export async function expectTaskInputs(page: Page, title: string, inputs: number[]) {
	const row = taskRow(page, title);

	// Bounded: a bare `P 1` also reads inside `P 10`, so a slider off by a digit passes.
	for (const [index, value] of inputs.entries()) {
		await expect(row).toContainText(new RegExp(`\\b${'PME'[index]} ${value}\\b`));
	}
}

/** Step a range input to `target` with the arrow keys — `fill()` refuses a range.
 *  One press per attempt and retried on the VALUE, not a fixed count of presses: a
 *  press that lands in the same frame as a re-render of the form is swallowed, and
 *  a straight `for` loop then leaves the slider one step short. */
export async function setSlider(slider: Locator, target: number) {
	await expect(async () => {
		const value = Number(await slider.inputValue());

		if (value !== target) await slider.press(value < target ? 'ArrowRight' : 'ArrowLeft');

		expect(Number(await slider.inputValue())).toBe(target);
	}).toPass();
}

/**
 * Open the add-task dialog. The `+` in the Plan heading is always mounted and never
 * remounts, which is what this used to have to retry around: the form was keyed on
 * the loaded day, so a click could land on an opener the remount was about to
 * replace. Nothing here samples the day any more.
 */
export async function openTaskForm(page: Page) {
	await page
		.getByRole('button', {
			name: 'Add task',
			exact: true,
		})
		.click();

	// In the dialog: the row editor's title field carries the same placeholder.
	const field = page.getByRole('dialog').getByPlaceholder('e.g., Boxing training');

	await expect(field).toBeVisible();

	// The dialog moves focus here itself, a tick after it mounts, and `fill` inserts
	// its text into whatever is focused at that instant. Typing before the move lands
	// the next field's text in this one — under six workers a tag ended up appended to
	// the title, and the task deployed untagged.
	await expect(field).toBeFocused();

	return field;
}

/** Deploy one task and close the dialog again. Deploying does NOT close it — a day is
 *  typed in one sitting — so the close is here, or every caller would go on to click a
 *  page the scrim is over. */
export async function addTask(page: Page, title: string) {
	const field = await openTaskForm(page);

	await field.fill(title);

	await page
		.getByRole('button', {
			name: 'Deploy Task',
		})
		.click();

	await closeTaskForm(page);
}

export async function closeTaskForm(page: Page) {
	await page.keyboard.press('Escape');

	await expect(page.getByRole('dialog')).toBeHidden();
}

/** Save the day's whole list as a named routine, through the Plan card's Save menu.
 *  Shared because the Lab suite needs a routine saved on `/` before it can load one. */
export async function saveRoutine(page: Page, name: string) {
	// "Save" exact is the trigger; the form's own button is "Save routine". Page-level
	// and not form-scoped because the trigger is in no form — which holds only while no
	// measurement editor is open, the ✓ in those being "Save" exactly too.
	await page
		.getByRole('button', {
			name: 'Save',
			exact: true,
		})
		.click();

	await page.getByPlaceholder('Routine name...').fill(name);
	await page.getByPlaceholder('Routine name...').press('Enter');

	// The routine write is a real IndexedDB round trip, and navigating before it
	// lands loses the routine — the menu then opens with nothing in it. Not the
	// autosave debounce, but the same order of magnitude, so the constant moves
	// with it.
	await page.waitForTimeout(AUTOSAVE_MS);
}

/** The day's budget field. Spelled once: `getByLabel` matches substrings, so the
 *  bar's budget slider — whose own name must therefore not contain this one —
 *  would otherwise resolve two elements at every call site at once. */
export const budgetField = (page: Page) => page.getByLabel('Available Hours');

/** Set the day's budget. Typing already commits per keystroke; the blur is what
 *  clamps it into range, so both halves stay. */
export async function setBudget(page: Page, hours: number) {
	await budgetField(page).fill(String(hours));
	await budgetField(page).blur();
}

/** The Day Setup bar. A native `<details>`, so its own `open` attribute is the
 *  disclosure's state and the summary is what a click on it toggles. */
export const timeBudgetBar = (page: Page) =>
	page.locator('details').filter({
		has: page.getByText('Day Setup', {
			exact: true,
		}),
	});

/** Expand the Day Setup bar, which collapses itself on a day that has hours.
 *  Takes the summary the loaded day should read: the bar re-samples its default
 *  when that day's values land, discarding a click made before they did. */
export async function openTimeBudget(page: Page, loadedSummary: RegExp) {
	await expect(page.getByText(loadedSummary)).toBeVisible();

	await page
		.getByText('Day Setup', {
			exact: true,
		})
		.click();
}

/** Log a time-to-flow measurement (⚡) against the first task on screen. Shared because
 *  two suites drive it: the ⚡ editor on `/` and the ⚡ resets on `/analytics`. */
export async function logFlow(page: Page, minutes: number) {
	await page
		.getByRole('button', {
			name: 'Log time to flow',
		})
		.first()
		.click();

	const minutesField = page.getByPlaceholder('min');

	await minutesField.fill(String(minutes));

	// Form-scoped, the way `logDrain` is: on `/` the routine trigger is a second "Save".
	await page
		.locator('form')
		.filter({
			has: minutesField,
		})
		.getByRole('button', {
			name: 'Save',
		})
		.click();
}

/* A running timer with time already on it — and, given a length, counting down to
   one. Written the way `readSessionTimer` reads it back; the key is re-spelled here
   as an independent oracle (data/AGENTS.md's note on R8 step 4), and the only other
   route to a nonzero reading is 30 seconds of wall clock per test, since both fields
   take whole minutes. */
export const plantRunningTimer = (
	page: Page,
	minutes: number,
	targetMinutes: number | null = null,
	startedOn: string = isoDate(0),
) =>
	page.evaluate((timer) => localStorage.setItem('fallow:session-timer', JSON.stringify(timer)), {
		phase: 'running',
		startedOn,
		runningSince: Date.now(),
		accumulatedMs: minutes * 60_000,
		targetMs: targetMinutes === null ? null : targetMinutes * 60_000,
	});

/** The 🪫 append/correct editor, wherever a row has one open. */
export const drainForm = (page: Page) =>
	page.locator('form').filter({
		hasText: 'After the session',
	});

/** Open one task's 🪫 editor. Row-scoped: both screens can hold several open at once. */
export const openDrainEditor = (page: Page, title: string) =>
	taskRow(page, title)
		.getByRole('button', {
			name: 'Log end-of-session drain',
		})
		.click();

/** Log an end-of-session drain rating (🪫) against the first task on screen. Both
 *  screens' rows carry the button, and both suites drive it. */
export async function logDrain(page: Page, minutes: number, mind: number, body: number) {
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

	await fields.nth(0).fill(String(minutes));
	await fields.nth(1).fill(String(mind));
	await fields.nth(2).fill(String(body));

	await form
		.getByRole('button', {
			name: 'Save',
		})
		.click();
}

/** The 🪫 chips on a ledger row, one per stored rating. Published by
 *  EnergyObservationStore's own re-read, so a count here says the write committed —
 *  which is what three suites need now that the ratings' count reads on /analytics. */
export const drainChips = (page: Page) =>
	page.getByRole('button', {
		name: 'Correct this drain rating',
	});

/** Log a rest pair (☕) from the ledger's heading row. Two suites drive it: the Lab's
 *  own flow, and the one card left in the app that links to the log list. */
export async function logRest(
	page: Page,
	minutes: number,
	mindBefore: number,
	bodyBefore: number,
	mindAfter: number,
	bodyAfter: number,
) {
	await page
		.getByRole('button', {
			name: 'Log a rest',
		})
		.click();

	const form = page.locator('form').filter({
		hasText: 'rested',
	});

	const fields = form.locator('input[type="number"]');

	for (const [index, value] of [minutes, mindBefore, bodyBefore, mindAfter, bodyAfter].entries()) {
		await fields.nth(index).fill(String(value));
	}

	await form
		.getByRole('button', {
			name: 'Save',
		})
		.click();
}

/* Make IndexedDB fail on demand. `open()` wraps `indexedDB.open` in a Promise
   executor, so a synchronous throw there rejects it exactly like a real failure.
   The switch lives in sessionStorage because addInitScript re-runs on every
   navigation — a plain flag would reset itself on the reload under test.

   Lives here rather than in one suite because two need it: storage-error.e2e.ts
   drives the banner, failure-toast.e2e.ts the toasts. */
/* Both the backup round trip and the failure toasts drive the same menu. */
export const openDataMenu = (page: Page) =>
	page
		.getByRole('button', {
			name: 'Data menu',
		})
		.click();

const FAIL_SWITCH = 'e2e-fail-indexeddb';

export async function installFailableIndexedDB(page: Page) {
	await page.addInitScript((key) => {
		const realOpen = indexedDB.open.bind(indexedDB);

		indexedDB.open = ((name: string, version?: number) => {
			if (sessionStorage.getItem(key) === '1') {
				throw new DOMException('e2e-induced IndexedDB failure', 'UnknownError');
			}

			return realOpen(name, version);
		}) as typeof indexedDB.open;
	}, FAIL_SWITCH);
}

/* Break an already-open database instead of its `open()`. `openDatabase()` caches
   its handle in module scope, so the switch above cannot reach a read or write
   issued after the first successful open — which is exactly where a quota or
   InvalidState error shows up. Reversible, so a test can prove a store recovers. */
type PatchedDatabase = IDBDatabase & {
	realTransaction?: IDBDatabase['transaction'];
};

export const setIndexedDBTransactionsFailing = (page: Page, failing: boolean) =>
	page.evaluate((on) => {
		const proto = IDBDatabase.prototype as PatchedDatabase;
		proto.realTransaction ??= proto.transaction;

		proto.transaction = on
			? ((() => {
					throw new DOMException('e2e-induced transaction failure', 'InvalidStateError');
				}) as IDBDatabase['transaction'])
			: proto.realTransaction;
	}, failing);

/* Break transactions that touch ONE store, so a read the page already made can
   land while a later one fails. Analytics needs exactly that: its history read
   (sessions + ⚡ logs) must succeed and only the model report, which also reads
   the ☕ rest logs, may fail. Store-scoped, so it cannot be reversed the way the
   blanket switch above can — the test that needs it ends there. */
export const setIndexedDBStoreFailing = (page: Page, storeName: string) =>
	page.evaluate((broken) => {
		const proto = IDBDatabase.prototype as PatchedDatabase;
		proto.realTransaction ??= proto.transaction;
		const real = proto.realTransaction;

		proto.transaction = function (
			this: IDBDatabase,
			...args: Parameters<IDBDatabase['transaction']>
		): IDBTransaction {
			const [stores] = args;
			const touched = typeof stores === 'string' ? [stores] : [...stores];

			if (touched.includes(broken)) {
				throw new DOMException('e2e-induced transaction failure', 'InvalidStateError');
			}

			return real!.apply(this, args);
		};
	}, storeName);

export const setIndexedDBFailing = (page: Page, failing: boolean) =>
	page.evaluate(
		([key, on]) => (on === '1' ? sessionStorage.setItem(key, '1') : sessionStorage.removeItem(key)),
		[FAIL_SWITCH, failing ? '1' : '0'],
	);

/* Row-scoped: two rows can hold an open editor at once, which `drainForm` would both
   match. */
export const rowDrainForm = (page: Page, title: string) =>
	taskRow(page, title).locator('form').filter({
		hasText: 'After the session',
	});

// A parameter's fit reading, named off the stepper's own id — the fit sits on the
// row it fits, not on the calibration card.
export const paramFit = (page: Page, id: string) => page.locator(`#${id}-fit`);

// A stat tile renders as <p>value</p><p>label</p>, so the value is the label's
// preceding sibling — the only way to read one without a test id.
export const statValue = (page: Page, label: string) =>
	page
		.getByText(label, {
			exact: true,
		})
		.locator('xpath=preceding-sibling::p[1]');

/** A calibration card, by the title in its heading — never by its text: every card
 *  renders the same shell and the pending-log copy repeats between them, so a text
 *  match resolves the wrong card. */
export const calibrationCard = (page: Page, title: string) =>
	page.locator('.card-shell').filter({
		has: page.getByRole('heading', {
			name: title,
		}),
	});

/** Plan a day by typing into it. For a day that was planned WHEN it was today, see `seedPastDay`. */
export async function seedDay(page: Page, offset: number, titles: string[]) {
	await page.goto(offset === 0 ? '/' : `/?date=${isoDate(offset)}`);

	for (const title of titles) {
		await addTask(page, title);
	}

	await page.waitForTimeout(AUTOSAVE_MS);
}

/** Flush the autosave on a page whose clock is installed: the debounce runs on the
 *  page's faked clock, the IndexedDB write it fires on the real one. */
export async function flushAutosaveOnFakedClock(page: Page) {
	await page.clock.runFor(AUTOSAVE_MS);
	await page.waitForTimeout(AUTOSAVE_MS);
}

/** Plan a day `daysAgo` back the way a real one comes to exist — as today, with the
 *  page's clock then run past it — and open it. The runner's own clock stands still, so
 *  the returned date is `isoDate(0)`: the day the app now sees `daysAgo` behind. Leaves
 *  the page's clock installed. */
export async function seedPastDay(page: Page, daysAgo: number, titles: string[], hours?: number) {
	await page.clock.install();
	await page.goto('/');

	for (const title of titles) {
		await addTask(page, title);
	}

	if (hours !== undefined) await setBudget(page, hours);

	await flushAutosaveOnFakedClock(page);
	await page.clock.fastForward(daysAgo * 24 * 60 * 60 * 1000);

	const date = isoDate(0);

	await page.goto(`/?date=${date}`);
	await expect(page.getByText('Viewing a past day:')).toBeVisible();

	return date;
}

/** A second row of `storeName` dated `date`, copied off the first one logged. Written to
 *  the store directly rather than logged onto the day: faster, it sets `createdAt`, and it
 *  is all this needs — the row under test reads the log back out. */
async function copyFirstLogToDate(page: Page, storeName: string, date: string) {
	await page.evaluate(
		({ storeName, date }) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('zenith-db');
				request.onerror = () => reject(request.error);

				request.onsuccess = () => {
					const transaction = request.result.transaction(storeName, 'readwrite');
					const store = transaction.objectStore(storeName);
					const all = store.getAll();

					all.onerror = () => reject(all.error);

					all.onsuccess = () => {
						const [first] = all.result as Record<string, unknown>[];
						delete first.id;

						store.add({
							...first,
							date,
						});
					};

					transaction.onerror = () => reject(transaction.error);
					transaction.oncomplete = () => resolve();
				};
			}),
		{
			storeName,
			date,
		},
	);
}

export const copyFlowLogToDate = (page: Page, date: string) =>
	copyFirstLogToDate(page, 'flowObservations', date);

export const copyDrainLogToDate = (page: Page, date: string) =>
	copyFirstLogToDate(page, 'drainObservations', date);

/** The tag rows of the analytics breakdown card, in the order the card lists them. */
export const tagRows = (page: Page) =>
	page
		.locator('.card-shell')
		.filter({
			has: page.getByRole('heading', {
				name: 'Logged hours by tag',
			}),
		})
		.getByRole('listitem');

/** The rename editor on one tag's row: the ✎ opens it, and the field is the row's. */
export async function openRenameEditor(page: Page, tag: string) {
	await tagRows(page)
		.filter({
			hasText: tag,
		})
		.getByRole('button', {
			name: `Rename ${tag}`,
		})
		.click();

	return page.getByLabel('New tag name');
}
