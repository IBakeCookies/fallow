import { expect, test } from '@playwright/test';
import {
	addTask,
	AUTOSAVE_MS,
	calibrationCard,
	closeTaskForm,
	copyDrainLogToDate,
	copyFlowLogToDate,
	drainChips,
	isoDate,
	logDrain,
	logFlow,
	logRest,
	openTaskForm,
	openTimeBudget,
	paramFit,
	seedDay,
	setBudget,
} from './helpers';

/* α and r are identity, so they fit logs dated strictly before today — the rating just
   logged does not move the row, and with no other log there is nothing to apply. What the
   rating IS counted by reads on /analytics, with the list it joined. */
test('a drain rating logged today does not move the fit reading', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 5);
	await expect(drainChips(page)).toHaveCount(1);

	await expect(paramFit(page, 'alpha-cog')).toHaveText('no informative ratings');

	await expect(
		page.getByRole('button', {
			name: 'Apply my fits',
		}),
	).toHaveCount(0);
});

/* 🪫's card moved to the page that lists its ratings; ☕'s and λ₀'s did not. ☕ is typed on
   the ledger and reachable on a day with no tasks, and λ₀ has no log store at all — neither
   has rows in that list to stand beside. */
test('the Lab keeps the recovery and stopping cards, and loses the drain card', async ({
	page,
}) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 5);
	await expect(drainChips(page)).toHaveCount(1);

	await expect(
		page.getByRole('heading', {
			name: 'Drain Calibration',
		}),
	).toHaveCount(0);

	await expect(
		page.getByRole('heading', {
			name: 'Recovery Calibration',
		}),
	).toBeVisible();

	await expect(
		page.getByRole('heading', {
			name: 'Stopping Calibration',
		}),
	).toBeVisible();
});

/* No logs at all is not "no signal": `no informative ratings` against a parameter
   nobody has rated is a claim about ratings the user never made, so the row carries
   no fit line until there is something to say. */
test('a parameter with no ratings behind it carries no fit reading', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/energy');

	await expect(page.getByLabel('Cognitive drain')).toBeVisible();
	await expect(paramFit(page, 'alpha-cog')).toHaveCount(0);
});

test('that same rating fits once the clock has passed midnight', async ({ page }) => {
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 5);
	await expect(drainChips(page)).toHaveCount(1);

	// Midnight: the rating now has a day behind it, which is all the fit was waiting for.
	// The new day needs a task of its own — the cards sit behind one.
	await page.clock.fastForward('25:00:00');
	await page.goto('/energy');
	await addTask(page, 'Deep work');

	await expect(paramFit(page, 'alpha-cog')).toHaveText(/≈ [\d.]+ ± [\d.]+ · n=1/);
});

/* MATH.md §8.10 (M42): a past day whose own 🪫 log moments describe a span with
   no room for another 45-min step ran out of wall clock, so its stop is no
   evidence about λ₀ — the fit drops it and the card says how many it dropped.
   The Stopping Calibration card's body is inline in `+page.svelte` (the
   calibration cards share a shell, not a body), so this copy is reachable here
   and nowhere below. */
test('a past day that ran out of clock is named on the stopping card, and never moves the fit', async ({
	page,
}) => {
	// A fixed morning: the day that runs out of clock is built by advancing six
	// hours between two ratings, which must not itself cross midnight.
	await page.clock.install({
		time: new Date('2026-08-19T08:00:00'),
	});

	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);
	await page.clock.runFor(AUTOSAVE_MS);

	await page.goto('/energy');
	await logDrain(page, 90, 8, 4);

	// One 90-min session inside an 8 h window leaves room for another step, so
	// yesterday reveals a two-sided bracket and the fit has a value.
	await page.clock.fastForward('20:00:00');
	await page.goto('/');

	// Both difficulty sliders at 0 put demand 0 on every rating this task carries,
	// and §8.7's α fit drops those — so the day built below is the ONLY thing that
	// differs between the two readings of λ₀ this test compares.
	await openTaskForm(page);
	await page.getByPlaceholder('e.g., Boxing training').fill('Errand');

	// Range inputs take keyboard steps, and `Home` is the minimum — 0 here.
	for (const label of ['Physical Diff', 'Mental Diff']) {
		await page.getByLabel(label).press('Home');
	}

	await page
		.getByRole('button', {
			name: 'Deploy Task',
		})
		.click();

	await closeTaskForm(page);

	await openTimeBudget(page, /8h budget/);
	await setBudget(page, 8);
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	const stopCard = calibrationCard(page, 'Stopping Calibration');
	const fitRow = paramFit(page, 'free-time-value');

	await expect(fitRow).toHaveText(/≈ [\d.]+ · spread [\d.]+ · n=1/);
	const fitted = await fitRow.textContent();
	await expect(stopCard.getByText(/ran out of clock/)).toHaveCount(0);

	// The fit reads on the parameter row now; the card still has to say what it read,
	// or a day with nothing censored leaves a heading over an empty body.
	await expect(stopCard.getByText('Stop observations · 1')).toBeVisible();

	// MATH.md §8.10: the spread is blind to an error every day shares, and the
	// approximations the section lists are all one — so a card with a number to show
	// says that a tighter spread is not a closer number, however many days are behind it.
	await expect(stopCard.getByText(/tighten the spread/)).toBeVisible();

	// 3 h worked across a 7.5 h span of an 8 h window: the wall clock ended it.
	await logDrain(page, 90, 7, 3);
	await page.clock.fastForward('06:00:00');
	await logDrain(page, 90, 9, 5);
	await page.clock.runFor(AUTOSAVE_MS);

	await page.clock.fastForward('20:00:00');
	await page.goto('/');
	await addTask(page, 'Deep work');
	await openTimeBudget(page, /8h budget/);
	await setBudget(page, 8);
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	const stopCardToday = calibrationCard(page, 'Stopping Calibration');

	await expect(
		stopCardToday.getByText('1 day ran out of clock, so its stop is not counted'),
	).toBeVisible();

	// The dropped day moves nothing: same fitted value, still one day used.
	await expect(paramFit(page, 'free-time-value')).toHaveText(fitted!);
});

/* MATH.md §8.10: a day whose 🪫 rows recover no break falls back to one
   contiguous session, so the fit reads it at its pre-2026-08-19 accuracy and
   `usedCount` cannot tell it from a day whose breaks were read. The card names
   how many, and the copy is inline in `+page.svelte` — reachable here and
   nowhere below. */
test('a past day logged in one batch is named on the stopping card', async ({ page }) => {
	await page.clock.install({
		time: new Date('2026-08-19T08:00:00'),
	});

	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);
	await page.clock.runFor(AUTOSAVE_MS);

	// Two sessions written down in one sitting: no clock moves between them, so
	// their moments recover no gap. 3 h inside an 8 h window still leaves room to
	// extend, so the day reveals a two-sided bracket and the fit uses it.
	await page.goto('/energy');
	await logDrain(page, 90, 8, 4);
	await logDrain(page, 90, 8, 4);
	await page.clock.runFor(AUTOSAVE_MS);

	await page.clock.fastForward('20:00:00');
	await page.goto('/');
	await addTask(page, 'Deep work');
	await openTimeBudget(page, /8h budget/);
	await setBudget(page, 8);
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	await expect(paramFit(page, 'free-time-value')).toHaveText(/≈ [\d.]+ · spread [\d.]+ · n=1/);

	await expect(
		calibrationCard(page, 'Stopping Calibration').getByText(
			'1 day behind the fit had no readable breaks, so it was read as one unbroken stretch',
		),
	).toBeVisible();
});

test('a past day whose breaks were read is not named', async ({ page }) => {
	await page.clock.install({
		time: new Date('2026-08-19T08:00:00'),
	});

	await page.goto('/');
	await addTask(page, 'Deep work');
	await setBudget(page, 8);
	await page.clock.runFor(AUTOSAVE_MS);

	// The same 3 h, two hours apart: the rows recover a 0.5 h break, and the 3.5 h
	// span still leaves the 8 h window room for another step, so the day is read
	// with its own structure rather than censored.
	await page.goto('/energy');
	await logDrain(page, 90, 8, 4);
	await page.clock.fastForward('02:00:00');
	await logDrain(page, 90, 8, 4);
	await page.clock.runFor(AUTOSAVE_MS);

	await page.clock.fastForward('18:00:00');
	await page.goto('/');
	await addTask(page, 'Deep work');
	await openTimeBudget(page, /8h budget/);
	await setBudget(page, 8);
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	await expect(paramFit(page, 'free-time-value')).toHaveText(/≈ [\d.]+ · spread [\d.]+ · n=1/);

	await expect(
		calibrationCard(page, 'Stopping Calibration').getByText(/no readable breaks/),
	).toHaveCount(0);
});

test('a break logged today is named beside the recovery fit', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await logRest(page, 30, 9, 8, 3, 2);
	await expect(page.getByText('Rest pairs · 1')).toBeVisible();

	await expect(
		calibrationCard(page, 'Recovery Calibration').getByText(
			'1 break logged today, counted from tomorrow',
		),
	).toBeVisible();

	await expect(paramFit(page, 'recovery-rate')).toHaveText('no informative ratings');
});

// business/model/AGENTS.md: "A fit never writes params silently." The whole point of the
// Apply button is that the sliders stay the user's until it is pressed — and
// there is one button for all four fits, because their order is the math.
test('a drain rating fits α but only applies on demand', async ({ page }) => {
	// Logged today, then carried past midnight: only a rating with a day behind it
	// reaches the fit, and this test is about what Apply does with one.
	await page.clock.install();
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.clock.runFor(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 5);
	await expect(drainChips(page)).toHaveCount(1);

	await page.clock.fastForward('25:00:00');
	await page.goto('/energy');
	await addTask(page, 'Deep work');

	const cognitiveDrain = page.getByLabel('Cognitive drain');
	const defaultDrain = await cognitiveDrain.inputValue();

	// The fit ran — but the parameter is untouched.
	const apply = page.getByRole('button', {
		name: 'Apply my fits',
	});

	await expect(apply).toBeEnabled();
	await expect(cognitiveDrain).toHaveValue(defaultDrain);

	const shown = (await paramFit(page, 'alpha-cog').textContent())!.match(/≈ ([\d.]+)/)![1];

	await apply.click();
	await expect(cognitiveDrain).not.toHaveValue(defaultDrain);
	// The row showed the number the button then wrote — `applyFits` rounds α to the
	// same two decimals the reading prints, so the stepper holds exactly it.
	await expect(cognitiveDrain).toHaveValue(String(Number(shown)));
	await expect(page.getByText('Fits applied')).toBeVisible();
});

// The params are model inputs, so R4 puts them in IndexedDB rather than
// localStorage — and the write is debounced, which is where they used to be lost.
test('a changed parameter survives a reload', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work'); // the params panel sits behind a task
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await page.getByLabel('Physical drain').fill('0.75');
	await page.getByLabel('Physical drain').blur();
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.reload();

	await expect(page.getByLabel('Physical drain')).toHaveValue('0.75');
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
	await expect(drain.getByText(/Drain rates personalized from 1 rating/)).toBeVisible();
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

	// The model table resolved: its Default column is headed, so the rows landed
	await expect(
		page.getByText('Default', {
			exact: true,
		}),
	).toBeVisible({
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

	await expect(
		page.getByText('Default', {
			exact: true,
		}),
	).toBeVisible({
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

/* Goal — on the analytics "Your model" card, the recovery row and both drain rows
   say, the way the flow row does, whether the fitted rate has predicted my ☕ and
   🪫 ratings better than the default would have: rating points, over the ratings
   it predicted. */
test('the model card says how much closer the drain fit has predicted', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Deep work');
	await page.waitForTimeout(AUTOSAVE_MS);
	await page.goto('/energy');

	await logDrain(page, 120, 9, 8);
	await expect(drainChips(page)).toHaveCount(1);

	// A past day gives today a fitted α to be predicted by, and four more of today's
	// session make five predicted ratings — the floor.
	await copyDrainLogToDate(page, isoDate(-1));

	for (let copy = 0; copy < 4; copy++) {
		await copyDrainLogToDate(page, isoDate(0));
	}

	await page.goto('/analytics');

	await expect(
		page
			.getByRole('listitem')
			.filter({
				hasText: 'Cognitive drain rate',
			})
			.getByText(/fit \d+\.\d points closer than default over 5 predicted ratings/),
	).toBeVisible({
		timeout: 15000,
	});
});

// The constants are always derived from the logs, never stored — so deleting the
// logs is the only reset, and it has to take the badge with it.
test('resetting personalization reverts to the default constants', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await logFlow(page, 90);
	await expect(page.getByText('⚡ 90m').first()).toBeVisible();
	await page.waitForTimeout(AUTOSAVE_MS);

	// One destructive control per kind, at the log list's own foot — the card above it
	// states the fit and offers no verb at all.
	await page.goto('/analytics');
	await expect(page.getByText(/1 ⚡ logged today/)).toBeVisible();

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

	await expect(page.getByText(/Model uses default constants/)).toBeVisible();

	// …and it took the badge with it.
	await page.goto('/');
	await expect(page.getByText('⚡ 90m')).toHaveCount(0);
});
