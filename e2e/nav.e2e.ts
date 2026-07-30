import { expect, test } from '@playwright/test';

test('nav reaches all four sections and back to Today', async ({ page }) => {
	await page.goto('/');

	await expect(
		page.getByRole('heading', {
			name: 'Fallow',
			exact: true,
		}),
	).toBeVisible();

	await page
		.getByRole('link', {
			name: 'Calendar',
		})
		.click();

	await expect(
		page.getByRole('heading', {
			name: 'Calendar',
		}),
	).toBeVisible();

	await page
		.getByRole('link', {
			name: 'Analytics',
		})
		.click();

	await expect(
		page.getByRole('heading', {
			name: 'Analytics',
		}),
	).toBeVisible();

	await page
		.getByRole('link', {
			name: 'Energy Lab',
		})
		.click();

	await expect(
		page.getByRole('heading', {
			name: 'Energy Lab',
		}),
	).toBeVisible();

	await page
		.getByRole('link', {
			name: 'Today',
		})
		.click();

	await expect(
		page.getByRole('heading', {
			name: 'Fallow',
			exact: true,
		}),
	).toBeVisible();
});

/* Raw HTML, so JS never runs: the path the nav matches on has to be a route path
   in both locales. `deLocalizeHref` returns an ABSOLUTE url during SSR, which
   matches nothing — every item renders inactive and the viewed day reads "Today"
   until hydration repairs it. Only the server response can catch that. */
test('the server-rendered nav marks the section and the viewed day in both locales', async ({
	request,
}) => {
	const english = await (await request.get('/?date=2020-01-01')).text();

	expect(english).toContain('aria-current="page"');
	expect(english).toContain('Viewing Jan 1 — return to today');

	const german = await (await request.get('/de?date=2020-01-01')).text();

	expect(german).toContain('aria-current="page"');
	expect(german).toContain('1. Jan. wird angezeigt — zurück zu heute');
});

/* § 5 DDG: the imprint (and with it the privacy policy) must be directly reachable
   from every page — which is why the footer is in the shared layout. A page that
   drops it is a legal defect, not a styling one. */
test('the footer reaches the imprint and the privacy policy from a subpage', async ({ page }) => {
	await page.goto('/analytics');

	await page
		.getByRole('link', {
			name: 'Imprint',
		})
		.click();

	await expect(
		page.getByRole('heading', {
			name: 'Imprint',
			level: 1,
		}),
	).toBeVisible();

	await expect(page.getByText('Information pursuant to § 5 DDG')).toBeVisible();

	await page
		.getByRole('link', {
			name: 'Privacy Policy',
		})
		.click();

	await expect(
		page.getByRole('heading', {
			name: 'Privacy Policy',
			level: 1,
		}),
	).toBeVisible();

	await expect(page.getByText('Your data stays in your browser')).toBeVisible();
});
