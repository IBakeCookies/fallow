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

/* Appearance is stamped into the HTML from these cookies server-side, so seeding
   one puts the class on the FIRST paint and nothing waits for hydration. */
const seedCookie = (context: BrowserContext, name: string, value: string) =>
	context.addCookies([
		{
			name,
			value,
			url: ORIGIN,
		},
	]);

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

/* An OS asking for reduced motion decides the FIRST visit and no more: the
   guarded media query in style/scenery/index.css stands aside once a choice is
   recorded, so the control is offered to everyone and honored both ways.

   Each abyss glow runs two animations (drift and breathe), so the computed value
   is a comma-separated list — the distinct set is what these assert on. */
const sceneryPlayState = async (page: Page) => {
	const raw = await page
		.locator('.theme-scenery .theme-helper-1')
		.evaluate((element) => getComputedStyle(element).animationPlayState);

	return [...new Set(raw.split(', '))];
};

const reduceMotion = (page: Page) =>
	page.emulateMedia({
		reducedMotion: 'reduce',
	});

test('the motion control is offered on a reduced-motion browser', async ({ page }) => {
	await reduceMotion(page);
	await page.goto('/');

	await openThemeMenu(page);

	// Frozen for them right now, so the control offers the way out of it.
	await expect(
		page.getByRole('menuitem', {
			name: 'Resume animations',
		}),
	).toBeVisible();

	// The reroll never depended on motion: a static arrangement still varies.
	await expect(
		page.getByRole('menuitem', {
			name: 'Reroll scenery',
		}),
	).toBeVisible();
});

test('resuming motion overrules the OS preference and records the choice', async ({
	page,
	context,
}) => {
	await reduceMotion(page);
	await page.goto('/');

	await openThemeMenu(page);

	await page
		.getByRole('menuitem', {
			name: 'Resume animations',
		})
		.click();

	await expect(page.locator('html')).toHaveClass(/scenery-motion-on/);
	expect(await readCookie(context, 'sceneryMotion')).toBe('on');
});

test('a recorded resume animates the scenery on a reduced-motion browser', async ({
	page,
	context,
}) => {
	await reduceMotion(page);
	await seedCookie(context, 'theme', 'abyss');
	await seedCookie(context, 'sceneryMotion', 'on');

	await page.goto('/');

	expect(await sceneryPlayState(page)).toEqual(['running']);
});

test('pausing still works on a reduced-motion browser', async ({ page, context }) => {
	await reduceMotion(page);
	await seedCookie(context, 'sceneryMotion', 'on');

	await page.goto('/');

	await openThemeMenu(page);

	await page
		.getByRole('menuitem', {
			name: 'Pause animations',
		})
		.click();

	await expect(page.locator('html')).toHaveClass(/scenery-paused/);
});

/* Both pins. What must not move is whether a visit that has recorded nothing
   animates; the class on <html> for that visit does move, which is why these
   read the computed play state instead. */
test('a first visit on a reduced-motion browser is still frozen', async ({ page, context }) => {
	await reduceMotion(page);
	await seedCookie(context, 'theme', 'abyss');

	await page.goto('/');

	expect(await sceneryPlayState(page)).toEqual(['paused']);
});

test('a first visit on an ordinary browser animates', async ({ page, context }) => {
	await page.emulateMedia({
		reducedMotion: 'no-preference',
	});

	await seedCookie(context, 'theme', 'abyss');

	await page.goto('/');

	expect(await sceneryPlayState(page)).toEqual(['running']);
});

/* The focal object of a theme that anchors one — `moonphase`'s moon — is drawn in
   the transparent gutter beside the content column, or not drawn at all. Both
   halves need a real layout at a real viewport width, which is the one thing
   only a browser has; and `.theme-scenery` is `display: none` until a theme class
   sits on an ancestor, so there is no story to hang a `play` function on. */
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
		await seedCookie(context, 'theme', 'moonphase');
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
		await seedCookie(context, 'theme', 'moonphase');
		await page.goto('/');

		await expect(page.locator('.theme-scenery')).toBeAttached();
		await expect(moon(page)).not.toBeVisible();
	});
});
