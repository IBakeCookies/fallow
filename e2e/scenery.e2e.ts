import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/* Both scenery controls live in the theme menu and both write a cookie, because
   the SERVER stamps the arrangement and the paused class into the HTML before
   first paint — a browser-only preference would show the wrong scenery on every
   cold load. theme-store.svelte.spec.ts covers the store; nothing covered the two
   menu items that call it, or the round trip through the cookie. */

const ORIGIN = 'http://localhost:4173';

const openThemeMenu = (page: Page) =>
	page
		.getByRole('button', {
			name: 'Switch theme',
		})
		.click();

async function readCookie(context: BrowserContext, name: string) {
	const cookies = await context.cookies(ORIGIN);

	return cookies.find((cookie) => cookie.name === name)?.value;
}

/* One seeded var stands in for the whole arrangement: they all come off the same
   PRNG stream, and asserting on the full style attribute compares ~4KB of inline
   SVG that differs by a trailing semicolon between SSR and client renders. */
const seededVar = (page: Page) =>
	page
		.locator('.theme-scenery')
		.evaluate((element) => (element as HTMLElement).style.getPropertyValue('--abyss-pos'));

test('rerolling mints a new seed, restyles the scenery, and survives a reload', async ({
	page,
	context,
}) => {
	await page.goto('/');

	// The seed is minted server-side on a first visit, so it is already set.
	const seedBefore = await readCookie(context, 'scenerySeed');
	expect(seedBefore).toBeDefined();

	const varBefore = await seededVar(page);

	await openThemeMenu(page);

	// closeOnSelect={false} — the menu stays open so the reroll can be judged.
	await page
		.getByRole('menuitem', {
			name: 'Reroll scenery',
		})
		.click();

	await expect.poll(() => seededVar(page)).not.toBe(varBefore);
	const seedAfter = await readCookie(context, 'scenerySeed');
	expect(seedAfter).not.toBe(seedBefore);

	const varAfter = await seededVar(page);
	await page.keyboard.press('Escape');
	await page.reload();

	// Same seed in, same vars out — the whole point of deriving them server-side.
	expect(await seededVar(page)).toBe(varAfter);
	expect(await readCookie(context, 'scenerySeed')).toBe(seedAfter);
});

test('pausing scenery motion stamps the class, persists, and reverses', async ({
	page,
	context,
}) => {
	await page.goto('/');
	const html = page.locator('html');

	await expect(html).not.toHaveClass(/scenery-paused/);

	await openThemeMenu(page);

	await page
		.getByRole('menuitem', {
			name: 'Pause animations',
		})
		.click();

	await expect(html).toHaveClass(/scenery-paused/);

	// The item relabels in place rather than disappearing.
	await expect(
		page.getByRole('menuitem', {
			name: 'Resume animations',
		}),
	).toBeVisible();

	expect(await readCookie(context, 'sceneryMotion')).toBe('paused');

	await page.keyboard.press('Escape');
	await page.reload();
	await expect(html).toHaveClass(/scenery-paused/);

	await openThemeMenu(page);

	await page
		.getByRole('menuitem', {
			name: 'Resume animations',
		})
		.click();

	await expect(html).not.toHaveClass(/scenery-paused/);
	// 'on' is a recorded preference, distinct from an absent cookie — which means
	// "defer to prefers-reduced-motion".
	expect(await readCookie(context, 'sceneryMotion')).toBe('on');
});

/* style/scenery/index.css pauses motion under prefers-reduced-motion with
   !important, so the toggle could not honor a resume — it is hidden rather than
   left to mislabel a state it cannot change. The reroll is unaffected: a static
   arrangement still varies per user. */
test('under prefers-reduced-motion the motion toggle is absent, the reroll is not', async ({
	page,
}) => {
	await page.emulateMedia({
		reducedMotion: 'reduce',
	});

	await page.goto('/');

	await openThemeMenu(page);

	await expect(
		page.getByRole('menuitem', {
			name: 'Reroll scenery',
		}),
	).toBeVisible();

	await expect(
		page.getByRole('menuitem', {
			name: /animations/,
		}),
	).toHaveCount(0);
});

/* The focal object of a theme that anchors one — `moonphase`'s moon — is drawn in
   the transparent gutter beside the content column, or not drawn at all. Both
   halves need a real layout at a real viewport width, which is the one thing
   only a browser has; and `.theme-scenery` is `display: none` until a theme class
   sits on an ancestor, so there is no story to hang a `play` function on.

   The theme comes from the cookie the server reads, so the class is on the first
   paint and nothing waits for hydration. */
const seedTheme = (context: BrowserContext, theme: string) =>
	context.addCookies([
		{
			name: 'theme',
			value: theme,
			url: ORIGIN,
		},
	]);

const moon = (page: Page) => page.locator('.theme-scenery .theme-helper-2');

test.describe('the moon in the gutter', () => {
	// The gutter is `50vw − 43rem`, so 1888px leaves 15rem beside the column —
	// room for the 11rem moon the theme grows to. See STYLE.md, the scenery gutter.
	test.use({
		viewport: {
			width: 1888,
			height: 900,
		},
	});

	test('is drawn whole, clear of the app bar, the column, and the viewport edge', async ({
		page,
		context,
	}) => {
		await seedTheme(context, 'moonphase');
		await page.goto('/');

		const box = await moon(page).boundingBox();
		const header = await page.locator('header').boundingBox();
		const viewport = page.viewportSize();

		if (!box || !header || !viewport) throw new Error('no layout to measure');

		// The bar spans the full width, so clearing it is vertical.
		expect(box.y).toBeGreaterThanOrEqual(header.y + header.height);

		// Every card shares the column, so its right edge is the one to clear —
		// asserting on all of them keeps a wider card from sliding under the moon.
		const cardRights = await page
			.locator('main .card-shell')
			.evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().right));

		expect(cardRights.length).toBeGreaterThan(0);
		expect(box.x).toBeGreaterThanOrEqual(Math.max(...cardRights));

		// Whole, not bled off the edge: a sliver conveys no phase.
		expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
		expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
	});
});

test.describe('the moon below the gutter breakpoint', () => {
	test.use({
		viewport: {
			width: 1440,
			height: 900,
		},
	});

	// 1440px leaves 32px beside the column. There is nowhere on screen for a
	// 112px disc that is not occluded, so the honest output is none — not a
	// shrunken moon (16px conveys no phase) and not a bisected one.
	test('is not drawn at all', async ({ page, context }) => {
		await seedTheme(context, 'moonphase');
		await page.goto('/');

		await expect(page.locator('.theme-scenery')).toBeAttached();
		await expect(moon(page)).not.toBeVisible();
	});
});
