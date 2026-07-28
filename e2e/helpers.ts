import type { Page } from '@playwright/test';

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

export async function addTask(page: Page, title: string) {
	await page.getByPlaceholder('e.g., Boxing training').fill(title);

	await page
		.getByRole('button', {
			name: 'Deploy Task',
		})
		.click();
}

/** Log an end-of-session drain rating (🪫) on /energy against the first task. */
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
			name: '✓',
		})
		.click();
}
