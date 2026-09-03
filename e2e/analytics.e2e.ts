import { expect, test, type Page } from '@playwright/test';
import { addTask, AUTOSAVE_MS, isoDate, logDrain, logFlow, logRest } from './helpers';

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

/** The "Active days" fold row — its denominator is the viewed range's length. */
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

/** A calibration card, by the title in its heading. */
const calibrationCard = (page: Page, title: string) =>
	page.locator('.card-shell').filter({
		has: page.getByRole('heading', {
			name: title,
		}),
	});

/* ☕'s card is the one left in the app that links to this list, and it links to it rather
   than to the top of the page the list is the last card on. Worth an e2e because the failure
   is invisible to a unit test and to the eye on a short page: the fragment scroll happens
   once, on arrival, so an element that appears only when IndexedDB answers is not there to
   be scrolled to and nothing retries. */
test('the recovery card’s link scrolls to the log list', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await logRest(page, 30, 9, 8, 3, 2);

	// The count comes off the store's re-read, so it says the write committed.
	await expect(page.getByText('Rest pairs · 1')).toBeVisible();

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

/* Both fits now read on the page that lists what they were fitted from. Seeded across
   midnight so both logs are behind the causal window and the cards read their settled
   state; the deferred spelling is the test below. */
test('both fits read side by side above the log list', async ({ page }) => {
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Deep work');
	await logFlow(page, 90);
	await page.clock.runFor(AUTOSAVE_MS);

	await logDrain(page, 120, 9, 5);
	await expect(page.getByText('Mind 9')).toBeVisible();

	await page.clock.fastForward('25:00:00');
	await page.goto('/analytics');

	const flow = calibrationCard(page, 'Flow Calibration');
	const drain = calibrationCard(page, 'Drain Calibration');

	await expect(
		drain.getByText('1', {
			exact: true,
		}),
	).toBeVisible();

	await expect(drain.getByText('drain rating')).toBeVisible();
	await expect(flow.getByText(/Model personalized from 1 time-to-flow log/)).toBeVisible();

	const flowBox = (await flow.boundingBox())!;
	const drainBox = (await drain.boundingBox())!;

	const listBox = (await page
		.getByRole('heading', {
			name: 'Your logs',
		})
		.boundingBox())!;

	// One row of two, above the list they describe.
	expect(drainBox.y).toBeCloseTo(flowBox.y, 0);
	expect(drainBox.x).toBeGreaterThan(flowBox.x + flowBox.width - 1);
	expect(listBox.y).toBeGreaterThan(flowBox.y + flowBox.height);
});

/* One destructive control per kind per screen, and it is the list's own foot (this page
   already draws three). A moved card keeps the sentence and drops both verbs — the link
   would point at the card it is drawn in, and the reset would be the second on the page. */
test('neither moved card offers a reset or a link to the logs', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await logFlow(page, 90);
	await page.waitForTimeout(AUTOSAVE_MS);

	await logDrain(page, 120, 9, 5);
	await expect(page.getByText('Mind 9')).toBeVisible();

	await page.goto('/analytics');

	const flow = calibrationCard(page, 'Flow Calibration');
	const drain = calibrationCard(page, 'Drain Calibration');

	// Both cards are on screen: the counts below would otherwise all be zero for the
	// wrong reason.
	await expect(flow.getByText(/1 ⚡ logged today/)).toBeVisible();
	await expect(drain.getByText('1 rating logged today, counted from tomorrow')).toBeVisible();

	await expect(
		flow.getByRole('link', {
			name: 'In your logs →',
		}),
	).toHaveCount(0);

	// By ROLE, not by name: the label this card used to carry is deleted, so naming it
	// would assert the absence of a string that cannot exist anywhere.
	await expect(flow.getByRole('button')).toHaveCount(0);

	await expect(
		drain.getByRole('link', {
			name: 'In your logs →',
		}),
	).toHaveCount(0);

	await expect(
		drain.getByRole('button', {
			name: 'Delete all ratings',
		}),
	).toHaveCount(0);

	// The list's foot still holds one per kind.
	await expect(
		page.getByRole('button', {
			name: 'Delete all logs',
		}),
	).toBeVisible();
});

/* /energy drew the drain card behind a task, because everything on that page is about the
   day's plan. This page has no notion of a task, so the gate does not come with the card —
   and the day you are most likely to be checking a fit's provenance is a day you booked
   nothing. */
test('the drain card reads on a day with no tasks', async ({ page }) => {
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.clock.runFor(AUTOSAVE_MS);

	await logDrain(page, 120, 9, 5);
	await expect(page.getByText('Mind 9')).toBeVisible();

	await page.clock.fastForward('25:00:00');
	await page.goto('/analytics');

	await expect(calibrationCard(page, 'Drain Calibration').getByText('drain rating')).toBeVisible();
});

/* α is identity, so it reads days strictly before today, on the same rule as the ϕ fit
   (`daily-plan-store.svelte.ts:42`). A rating logged now is counted by the headline and
   named by the sentence, never folded into the fit. */
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

	for (const tile of ['Tasks completed', 'Avg completion rate', 'Current streak', 'Logged hours'])
		await expect(
			page.getByText(tile, {
				exact: true,
			}),
		).toBeVisible();

	// The other five are one click away, not gone.
	const folded = ['Active days', 'Longest streak', 'Planned hours', 'Rest hours', 'Best day'];

	for (const tile of folded)
		await expect(
			page.getByText(tile, {
				exact: true,
			}),
		).not.toBeVisible();

	await page.getByText('5 more metrics').click();

	for (const tile of folded)
		await expect(
			page.getByText(tile, {
				exact: true,
			}),
		).toBeVisible();

	// One of two tasks done, priority-weighted — a real percentage reaches the copy
	await expect(page.getByText(/\d+% of planned tasks/)).toBeVisible();

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

/* Visiting analytics stamps today's fit. Read back out of the real IndexedDB
   rather than off the screen: today is the FIRST recorded day, so there is no
   second point to draw a sparkline from yet, and the write is the half that has
   to work for any of the history to accumulate.

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
	// covariance is dropped on read, so it would never reach the audit.
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

/* The all-time resets on the log card. Three kinds, three rows, each deleting every
   record of its kind — the same store calls the root page's and the Lab's buttons make,
   pressed from the screen that prints the ratings. Only a browser proves it: the counts
   come from two stores that answer after hydration, and the delete is IndexedDB's. */

/** A second ⚡ dated `date`, copied off the one already logged. No UI path dates a flow
 *  log in the past — the record carries the viewed day and past days are read-only — so
 *  the store is written directly, which is also all this needs: the row under test reads
 *  the log back out. */
async function copyFlowLogToDate(page: Page, date: string) {
	await page.evaluate(
		(date) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('zenith-db');
				request.onerror = () => reject(request.error);

				request.onsuccess = () => {
					const transaction = request.result.transaction('flowObservations', 'readwrite');
					const store = transaction.objectStore('flowObservations');
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
		date,
	);
}

/** One ⚡ dated today and one dated 90 days ago — outside every range but `year`, and
 *  outside `week`, which is what the page opens on. */
async function seedTwoFlowLogs(page: Page) {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await logFlow(page, 90);

	await expect(page.getByText('⚡ 90m').first()).toBeVisible();

	await copyFlowLogToDate(page, isoDate(-90));
	await page.goto('/analytics');
}

const flowRow = (page: Page) =>
	page.getByRole('button', {
		name: /^Delete Time to flow logged on/,
	});

const drainRow = (page: Page) =>
	page.getByRole('button', {
		name: /^Delete Session rating logged on/,
	});

test('the log card resets one kind and leaves the others', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await logFlow(page, 90);

	await expect(page.getByText('⚡ 90m').first()).toBeVisible();

	await logDrain(page, 120, 9, 5);

	await expect(
		page.getByRole('button', {
			name: 'Correct this drain rating',
		}),
	).toBeVisible();

	await page.goto('/analytics');
	await expect(flowRow(page)).toBeVisible();
	await expect(drainRow(page)).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Delete all logs',
		})
		.click();

	await page
		.getByRole('button', {
			name: 'Reset',
			exact: true,
		})
		.click();

	await expect(flowRow(page)).toHaveCount(0);

	// The 🪫 is a different store and a different button; wiping ⚡ must not reach it.
	await expect(drainRow(page)).toBeVisible();
});

test('a refused confirm leaves the ratings alone', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await logDrain(page, 120, 9, 5);

	await expect(
		page.getByRole('button', {
			name: 'Correct this drain rating',
		}),
	).toBeVisible();

	await page.goto('/analytics');
	await expect(drainRow(page)).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Delete all ratings',
		})
		.click();

	await page
		.getByRole('button', {
			name: 'Cancel',
		})
		.click();

	await expect(drainRow(page)).toBeVisible();
});

test('the ⚡ row counts every log, not the viewed range', async ({ page }) => {
	await seedTwoFlowLogs(page);

	// The list is on `week`, so it prints one of the two…
	await expect(flowRow(page)).toHaveCount(1);

	// …and the row still names what the button would delete.
	await expect(page.getByText('Time to flow · 2 logs')).toBeVisible();
});

test('the ⚡ reset ignores the viewed range', async ({ page }) => {
	await seedTwoFlowLogs(page);

	await expect(flowRow(page)).toHaveCount(1);

	await page
		.getByRole('button', {
			name: 'Delete all logs',
		})
		.click();

	await page
		.getByRole('button', {
			name: 'Reset',
			exact: true,
		})
		.click();

	await page
		.getByRole('button', {
			name: 'Show all time',
		})
		.click();

	await expect(page.getByText('No measurements logged yet.')).toBeVisible();
	await expect(flowRow(page)).toHaveCount(0);
});

test('a wipe closes an open correction', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await logDrain(page, 120, 9, 5);

	await expect(
		page.getByRole('button', {
			name: 'Correct this drain rating',
		}),
	).toBeVisible();

	await page.goto('/analytics');

	await page
		.getByRole('button', {
			name: /^Correct Session rating logged on/,
		})
		.click();

	const save = page.getByRole('button', {
		name: '✓',
	});

	await expect(save).toBeVisible();

	await page
		.getByRole('button', {
			name: 'Delete all ratings',
		})
		.click();

	await page
		.getByRole('button', {
			name: 'Reset',
			exact: true,
		})
		.click();

	await expect(save).toHaveCount(0);
});

test('a fresh profile offers nothing to reset', async ({ page }) => {
	await page.goto('/analytics');

	// The loaded branch, not the pending one: three rows are absent while the card is
	// still saying "Loading…" too, and that would pass for the wrong reason.
	await expect(page.getByText('No measurements logged in this range.')).toBeVisible();

	for (const name of ['Delete all logs', 'Delete all ratings', 'Delete all pairs'])
		await expect(
			page.getByRole('button', {
				name,
			}),
		).toHaveCount(0);
});

/* The ϕ skill sentence (MATH.md §5): the model card grades the fit against the
   defaults over the user's own back-dated ⚡ history. Six distinct past dates
   plus today give six predicted logs — the earliest block's fit had seen
   nothing and is not scored — and identical 90m logs on a mid-scale task sit
   far from the 45m default, so the fit is closer from the first scored block. */
test('the model card says how much closer the fit has predicted', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await logFlow(page, 90);

	await expect(page.getByText('⚡ 90m').first()).toBeVisible();

	for (const offset of [-6, -5, -4, -3, -2, -1]) {
		await copyFlowLogToDate(page, isoDate(offset));
	}

	await page.goto('/analytics');

	await expect(
		page.getByText(/fit \d+(\.\d)? min closer than default over 6 predicted logs/),
	).toBeVisible({
		timeout: 15000,
	});
});

/** One 🪫 dated `date` under `taskTitle`. No UI path dates a drain log in the past — the
 *  record carries the viewed day and past days are read-only — so the store is written
 *  directly, the way the ⚡ rows above are. Written whole rather than copied off a logged
 *  row, because the ratings and demands ARE the fixture. One row per date, which is what
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
