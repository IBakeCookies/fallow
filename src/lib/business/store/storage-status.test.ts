/**
 * The banner's own state. No component context needed: this store holds no
 * lifecycle hooks, which is exactly why the banner could be lifted out of the
 * session store in the first place.
 */

import { describe, it, expect, vi } from 'vitest';
import { StorageStatusStore } from '$lib/business/store/storage-status.svelte';

describe('StorageStatusStore', () => {
	it('starts quiet', () => {
		expect(new StorageStatusStore().error).toBeNull();
	});

	it('shows the most recent failure', () => {
		const status = new StorageStatusStore();

		status.report('load-failed');
		expect(status.error).toBe('load-failed');

		status.report('save-failed');
		expect(status.error).toBe('save-failed');
	});

	// A read that works again proves the data is reachable; a write that failed
	// has already lost its edit, and nothing later makes that untrue.
	it('clears a load failure on a successful read but never a save failure', () => {
		const status = new StorageStatusStore();

		status.report('load-failed');
		status.clearLoadFailure();
		expect(status.error).toBeNull();

		status.report('save-failed');
		status.clearLoadFailure();
		expect(status.error).toBe('save-failed');
	});

	// The point of the registration: the layout no longer names the stores to
	// retry, so a store that can fail a read is covered by having registered.
	it('retries every registered store and clears the banner first', () => {
		const status = new StorageStatusStore();
		const first = vi.fn();
		const second = vi.fn();

		status.registerRetry(first);
		status.registerRetry(second);
		status.report('load-failed');

		status.retry();

		expect(status.error).toBeNull();
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
	});

	it('leaves a re-failed retry able to raise the banner again', () => {
		const status = new StorageStatusStore();
		status.registerRetry(() => status.report('load-failed'));

		status.report('load-failed');
		status.retry();

		expect(status.error).toBe('load-failed');
	});
});
