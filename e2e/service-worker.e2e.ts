import { expect, test, type Page } from '@playwright/test';
import { addTask, AUTOSAVE_MS } from './helpers';

/* The service worker only exists in a production build, so `npm run check` is the
   only thing that has ever looked at it — it type-checks and is never executed.
   Its whole contract is a behaviour no unit test can see: pages are network-first
   (so the SSR'd theme and locale stay live) with the last cached copy, or the
   requested locale's shell, as the offline fallback. */

// The config blocks service workers, so no other suite pays for an install it
// never asserts on. This is the one suite that is about the worker.
test.use({
	serviceWorkers: 'allow',
});

/** Resolves once the worker has activated AND claimed this page. */
async function waitForServiceWorker(page: Page) {
	await page.waitForFunction(async () => {
		await navigator.serviceWorker.ready;

		return navigator.serviceWorker.controller !== null;
	});
}

test('a visited page still works after going offline', async ({ page, context }) => {
	// Seeded first because every KPI on /analytics is folded out of IndexedDB, which
	// the server cannot read: the cached HTML paints the empty state no matter what
	// is stored, and only a hydrated page replaces it with the day's numbers.
	await page.goto('/');
	await addTask(page, 'Boxing training');
	await page.waitForTimeout(AUTOSAVE_MS);

	await page.goto('/analytics');
	await waitForServiceWorker(page);
	// The fetch handler caches on the way through, so the copy it will fall back
	// to is only stored once this navigation has been served by the worker.
	await page.reload();

	await context.setOffline(true);
	await page.reload();

	await expect(
		page.getByRole('heading', {
			name: 'Analytics',
		}),
	).toBeVisible();

	// Painting is the cheap half: the cached HTML renders that heading whether or not
	// a line of JS ran. The chart is drawn from the stored day, so it is what proves
	// the precached bundle loaded. The failure it guards against is a live-looking
	// page with dead controls — which `npm run dev` reproduces, since `build` is
	// empty there and nothing that hydrates gets precached.
	await expect(
		page.getByRole('heading', {
			name: 'Completion rate',
		}),
	).toBeVisible();
});

/* ASSETS includes '/' precisely so a route the visitor has never opened still gets
   an app shell offline — all data is client-side, so the shell can render any
   route once it hydrates. */
test('a never-visited route falls back to the cached shell offline', async ({ page, context }) => {
	await page.goto('/');
	await waitForServiceWorker(page);

	await context.setOffline(true);
	// Hard navigation, not a client-side goto — the request has to reach the
	// worker's navigate branch.
	const response = await page.goto('/calendar');

	expect(response?.status()).toBe(200);

	// The shell is '/' HTML answering another URL, so its nav and planner paint
	// before any JS runs — at that point the page is the WRONG route. Only the
	// calendar's own heading proves the client router took the shell over.
	await expect(
		page.getByRole('heading', {
			name: 'Calendar',
		}),
	).toBeVisible();
});

/* The shell is per-locale: locale lives in the URL, so an offline '/de/*'
   navigation served the English '/' shell would first-paint English copy with
   lang="en" — the raw response pins the pre-hydration language. */
test('a never-visited German route falls back to the German shell offline', async ({
	page,
	context,
}) => {
	await page.goto('/de/');
	await waitForServiceWorker(page);

	await context.setOffline(true);
	const response = await page.goto('/de/calendar');

	expect(response?.status()).toBe(200);
	expect(await response?.text()).toContain('lang="de"');

	await expect(
		page.locator('nav').getByRole('link', {
			name: 'Kalender',
		}),
	).toBeVisible();
});

// Network-first is the load-bearing half: a cached page must never win over a live
// one, or the SSR'd theme and locale freeze at whatever was cached first.
test('coming back online serves the live page, not the cached copy', async ({ page, context }) => {
	await page.goto('/');
	await waitForServiceWorker(page);

	await context.setOffline(true);
	await page.reload();

	// `/`'s <h1> is `sr-only`, so attached is all "the home page painted" can assert
	await expect(
		page.getByRole('heading', {
			name: 'Fallow',
			exact: true,
		}),
	).toBeAttached();

	await context.setOffline(false);

	// A cookie only the server can act on: if this response came from the cache it
	// would still be the English page stamped with the default theme.
	await context.addCookies([
		{
			name: 'theme',
			value: 'terminal',
			url: 'http://localhost:4173',
		},
	]);

	await page.goto('/de/');

	await expect(page.locator('html')).toHaveClass(/terminal/);
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');

	await expect(
		page.getByRole('link', {
			name: 'Kalender',
		}),
	).toBeVisible();
});
