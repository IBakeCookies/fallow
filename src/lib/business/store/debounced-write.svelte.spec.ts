/**
 * The autosave mechanism the session store and the Energy Lab share. Every case
 * here is one that was a real bug in one of the copies before this file existed:
 * flushing from an effect teardown (so the debounce never held), cancelling on
 * teardown (so the last edit was dropped on navigation), and a tab discarded
 * while hidden with a write still queued.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from 'vitest-browser-svelte';
import Harness from '$lib/business/store/debounced-write.test-harness.svelte';
import {
	AUTOSAVE_DEBOUNCE_MS,
	type DebouncedWrite,
} from '$lib/business/store/debounced-write.svelte';

function setup(write: (payload: string) => Promise<void> = vi.fn(async () => {})) {
	const errors: { error: unknown; payload: string }[] = [];
	let writer!: DebouncedWrite<string>;

	render(Harness, {
		onwriter: (w: DebouncedWrite<string>) => (writer = w),
		write,
		onerror: (error: unknown, payload: string) =>
			errors.push({
				error,
				payload,
			}),
	});

	return {
		writer,
		errors,
	};
}

function setHidden(hidden: boolean) {
	Object.defineProperty(document, 'hidden', {
		value: hidden,
		configurable: true,
	});

	document.dispatchEvent(new Event('visibilitychange'));
}

describe('createDebouncedWrite', () => {
	afterEach(() => {
		vi.useRealTimers();
		delete (document as { hidden?: boolean }).hidden; // restore prototype getter
		cleanup();
	});

	it('collapses a burst into one write carrying the last payload', () => {
		vi.useFakeTimers({
			toFake: ['setTimeout', 'clearTimeout'],
		});

		const write = vi.fn(async () => {});
		const { writer } = setup(write);

		writer.schedule('first');
		writer.schedule('second');
		writer.schedule('third');

		vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 1);
		expect(write).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(write).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledWith('third');
	});

	it('flushes on destroy rather than cancelling — the old dropped-edit bug', () => {
		vi.useFakeTimers({
			toFake: ['setTimeout', 'clearTimeout'],
		});

		const write = vi.fn(async () => {});
		const { writer } = setup(write);

		writer.schedule('unsaved edit');
		cleanup(); // the user navigates away inside the debounce window

		expect(write).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledWith('unsaved edit');
	});

	it('flushes the instant the tab hides, since a discard may beat the timer', () => {
		vi.useFakeTimers({
			toFake: ['setTimeout', 'clearTimeout'],
		});

		const write = vi.fn(async () => {});
		const { writer } = setup(write);

		writer.schedule('queued');
		setHidden(true);

		expect(write).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledWith('queued');
	});

	it('writes a payload once, however many flushes race for it', () => {
		vi.useFakeTimers({
			toFake: ['setTimeout', 'clearTimeout'],
		});

		const write = vi.fn(async () => {});
		const { writer } = setup(write);

		writer.schedule('once');
		writer.flush();
		writer.flush();
		setHidden(true);
		vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);

		expect(write).toHaveBeenCalledTimes(1);
	});

	it('reports `pending` until the payload is handed to the write', () => {
		vi.useFakeTimers({
			toFake: ['setTimeout', 'clearTimeout'],
		});

		const { writer } = setup();

		expect(writer.pending).toBe(false);
		writer.schedule('edit');
		expect(writer.pending).toBe(true);

		vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
		expect(writer.pending).toBe(false);
	});

	it('reports a rejected write with its payload instead of rejecting', async () => {
		const failure = new Error('QuotaExceededError');

		const { writer, errors } = setup(async () => {
			throw failure;
		});

		writer.schedule('lost edit');
		writer.flush();

		await vi.waitFor(() =>
			expect(errors).toEqual([
				{
					error: failure,
					payload: 'lost edit',
				},
			]),
		);
	});

	it('does nothing when there is nothing pending', () => {
		const write = vi.fn(async () => {});
		const { writer } = setup(write);

		writer.flush();
		setHidden(true);
		cleanup();

		expect(write).not.toHaveBeenCalled();
	});
});
