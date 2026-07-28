/**
 * The banner's own state. No component context needed: this store holds no
 * lifecycle hooks, which is exactly why the banner could be lifted out of the
 * session store in the first place.
 */

import { describe, it, expect, vi } from 'vitest';
import { StorageStatusStore } from '$lib/business/store/storage-status.svelte';

describe('StorageStatusStore', () => {
	it('starts quiet', () => {
		const status = new StorageStatusStore();

		expect(status.error).toBeNull();
		expect(status.canRetry).toBe(false);
	});

	it('offers Retry for a failed read and not for a failed write', () => {
		const status = new StorageStatusStore();
		const reader = status.register('reader', vi.fn());

		reader.report('load-failed');
		expect(status.error).toBe('load-failed');
		expect(status.canRetry).toBe(true);

		reader.report('save-failed');
		expect(status.error).toBe('save-failed');
		expect(status.canRetry).toBe(false);
	});

	// A read failure is already visible as a wrong or empty screen; an unsurfaced
	// lost edit reads as success, so it takes the message.
	it('shows the lost write over the failed read, but still offers the retry', () => {
		const status = new StorageStatusStore();
		const first = status.register('first', vi.fn());
		const second = status.register('second', vi.fn());

		first.report('load-failed');
		second.report('save-failed');

		expect(status.error).toBe('save-failed');
		expect(status.canRetry).toBe(true);
	});

	// The bug the per-store keying exists for: one flag meant a store that read
	// successfully hid another store's unrecovered failure — so the banner went
	// away while half the app's data was still unreadable.
	it('does not let one store’s recovery clear another store’s failure', () => {
		const status = new StorageStatusStore();
		const session = status.register('session', vi.fn());
		const observations = status.register('observations', vi.fn());

		observations.report('load-failed');
		session.report('load-failed');

		session.clearLoadFailure();

		expect(status.error).toBe('load-failed');
		expect(status.canRetry).toBe(true);

		observations.clearLoadFailure();
		expect(status.error).toBeNull();
	});

	// A read that works again proves that store's data is reachable; a write that
	// failed has already lost its edit, and nothing later makes that untrue.
	it('clears its own load failure on a successful read but never its save failure', () => {
		const status = new StorageStatusStore();
		const reporter = status.register('reporter', vi.fn());

		reporter.report('load-failed');
		reporter.clearLoadFailure();
		expect(status.error).toBeNull();

		reporter.report('save-failed');
		reporter.clearLoadFailure();
		expect(status.error).toBe('save-failed');
	});

	// The point of registering: the layout no longer names the stores to retry, so
	// a store that can fail a read is covered by having registered.
	it('retries every registered store', () => {
		const status = new StorageStatusStore();
		const first = vi.fn();
		const second = vi.fn();

		status.register('first', first);
		status.register('second', second);
		status.register('reports-only'); // no retryLoad: must not be called

		status.retry();

		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
	});

	it('drops load failures on retry but keeps a lost write', () => {
		const status = new StorageStatusStore();
		const reader = status.register('reader', vi.fn());
		const writer = status.register('writer');

		reader.report('load-failed');
		writer.report('save-failed');

		status.retry();

		// Re-reading cannot un-lose the write, so its message stays…
		expect(status.error).toBe('save-failed');
		// …and the read is no longer outstanding, so nothing offers Retry for it.
		expect(status.canRetry).toBe(false);
	});

	it('leaves a re-failed retry able to raise the banner again', () => {
		const status = new StorageStatusStore();
		const reporter = status.register('reporter', () => reporter.report('load-failed'));

		reporter.report('load-failed');
		status.retry();

		expect(status.error).toBe('load-failed');
		expect(status.canRetry).toBe(true);
	});

	it('dismisses everything the user has seen', () => {
		const status = new StorageStatusStore();
		const reader = status.register('reader', vi.fn());
		const writer = status.register('writer');

		reader.report('load-failed');
		writer.report('save-failed');

		status.clear();

		expect(status.error).toBeNull();
		expect(status.canRetry).toBe(false);
	});
});
