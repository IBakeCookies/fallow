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
