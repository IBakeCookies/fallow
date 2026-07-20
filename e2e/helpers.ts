import type { Page } from '@playwright/test';

/* All data lives in client-side IndexedDB; each test gets a fresh browser
   context, so every test starts on an empty profile. */

export const AUTOSAVE_MS = 600; // auto-save $effect debounce is ~400ms — overshoot

// local date, matching the app's toISODate (toISOString would drift near midnight)
export function isoDate(offsetDays: number): string {
	const d = new Date();
	d.setDate(d.getDate() + offsetDays);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function addTask(page: Page, title: string) {
	await page.getByPlaceholder('e.g., Boxing training').fill(title);
	await page.getByRole('button', { name: 'Deploy Task' }).click();
}
