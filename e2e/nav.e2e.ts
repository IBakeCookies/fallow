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
