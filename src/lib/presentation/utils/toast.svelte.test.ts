/**
 * Runs in the `client` (real chromium) project — hence the `.svelte.` in the
 * name — because the queue's whole contract is real `sessionStorage` behaviour.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast } from 'svelte-sonner';
import {
	flushPendingToasts,
	showToast,
	showToastAfterReload,
	TOAST_SEVERITIES,
} from '$lib/presentation/utils/toast';

// Spelled out rather than imported, deliberately: an independent oracle for the
// key, the way R8 step 4 keeps the store-name lists literal.
const PENDING_KEY = 'fallow:pending-toasts';

// Nothing in production calls `warning` or `info` yet, so without this a
// mis-wire (`warning` → `toast.info`) would fail no test at all.
describe('severity mapping', () => {
	it.for([
		['danger', 'error'],
		['warning', 'warning'],
		['success', 'success'],
		['info', 'info'],
	] as const)('%s raises a sonner %s toast', ([severity, method]) => {
		const spy = vi.spyOn(toast, method).mockImplementation(() => '');

		showToast[severity]('a message');

		expect(spy).toHaveBeenCalledExactlyOnceWith('a message');
		spy.mockRestore();
	});

	it('covers every severity in TOAST_SEVERITIES', () => {
		expect(TOAST_SEVERITIES).toEqual(['danger', 'warning', 'success', 'info']);
	});
});

describe('the toast queue across a reload', () => {
	beforeEach(() => {
		sessionStorage.removeItem(PENDING_KEY);
		vi.spyOn(toast, 'success').mockImplementation(() => '');
		vi.spyOn(toast, 'error').mockImplementation(() => '');
	});

	afterEach(() => {
		vi.restoreAllMocks();
		sessionStorage.removeItem(PENDING_KEY);
	});

	it('fires a queued toast on the next flush and clears it', () => {
		showToastAfterReload('success', 'Backup restored.');
		flushPendingToasts();

		expect(toast.success).toHaveBeenCalledWith('Backup restored.');
		expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
	});

	// A second flush is a real path: the `(app)` layout stays mounted across
	// client-side navigation, but every full document load runs its mount again —
	// so an unconsumed entry would fire on whatever the user opens next.
	it('does not replay after the first flush', () => {
		showToastAfterReload('success', 'All data deleted.');
		flushPendingToasts();
		flushPendingToasts();

		expect(toast.success).toHaveBeenCalledTimes(1);
	});

	// The reason the queue is an array: two actions can both need a confirmation.
	// Asserted through invocation order, not two independent spies — those pass
	// even if the flush walks the queue backwards.
	it('keeps every queued message, in queue order', () => {
		showToastAfterReload('success', 'first');
		showToastAfterReload('danger', 'second');
		flushPendingToasts();

		expect(toast.success).toHaveBeenCalledExactlyOnceWith('first');
		expect(toast.error).toHaveBeenCalledExactlyOnceWith('second');

		expect(vi.mocked(toast.success).mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(toast.error).mock.invocationCallOrder[0],
		);
	});

	it('flushes nothing when the queue is empty', () => {
		flushPendingToasts();

		expect(toast.success).not.toHaveBeenCalled();
		expect(toast.error).not.toHaveBeenCalled();
	});

	// sessionStorage is hand-editable, so an unknown severity must not reach
	// showToast[severity] — and the bad payload must not wedge every later mount.
	it('drops an entry with an unknown severity and clears the queue', () => {
		sessionStorage.setItem(
			PENDING_KEY,
			JSON.stringify([
				{
					severity: 'catastrophe',
					message: 'nope',
				},
				{
					severity: 'success',
					message: 'yes',
				},
			]),
		);

		expect(() => flushPendingToasts()).not.toThrow();
		expect(toast.success).toHaveBeenCalledExactlyOnceWith('yes');
		expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
	});

	it('drops a payload that is not an array and clears the queue', () => {
		sessionStorage.setItem(PENDING_KEY, '"not an array"');

		expect(() => flushPendingToasts()).not.toThrow();
		expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
	});

	it('drops unparseable JSON and clears the queue', () => {
		sessionStorage.setItem(PENDING_KEY, '{oh no');

		expect(() => flushPendingToasts()).not.toThrow();
		expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
	});

	// Private-mode storage throws on write; losing the confirmation must not fail
	// the action it was confirming.
	it('swallows a sessionStorage write failure', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('QuotaExceededError');
		});

		expect(() => showToastAfterReload('success', 'Backup restored.')).not.toThrow();
	});

	// The regression: the append path used to read-and-clear, so a write that
	// threw took the already-queued entries down with it — silently losing a
	// confirmation for an action that had already completed.
	it('leaves an already-queued message intact when the write fails', () => {
		showToastAfterReload('success', 'All data deleted.');

		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('QuotaExceededError');
		});

		showToastAfterReload('success', 'Backup restored.');
		vi.mocked(Storage.prototype.setItem).mockRestore();
		flushPendingToasts();

		expect(toast.success).toHaveBeenCalledExactlyOnceWith('All data deleted.');
	});
});
