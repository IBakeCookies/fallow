import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DrainLogForm from '$lib/presentation/component/drain-log-form.svelte';

const submit = () =>
	page
		.getByRole('button', {
			name: '✓',
		})
		.click();

describe('drain-log-form.svelte', () => {
	// Minutes in, hours out: the store and the §8.8 α fit both work in hours, and
	// nobody logs a session as 1.5.
	it('reports the session in hours', async () => {
		const onsave = vi.fn();

		render(DrainLogForm, {
			onsave,
			oncancel: vi.fn(),
		});

		await page.getByPlaceholder('min').fill('90');
		await page.getByLabelText('Mind').fill('7');
		await page.getByLabelText('Body').fill('3');
		await submit();

		expect(onsave).toHaveBeenCalledExactlyOnceWith({
			hours: 1.5,
			mind: 7,
			body: 3,
		});
	});

	/* An empty rating is not a rating of 0: `Number(null)` is a finite 0, so ✓ with only
	   the minutes filled used to record "worked 90 minutes, felt entirely fresh" and
	   bias α toward no drain. Reachable by reflex now that completing a task opens this
	   form unbidden. */
	it('reports nothing when the ratings are blank', async () => {
		const onsave = vi.fn();

		render(DrainLogForm, {
			onsave,
			oncancel: vi.fn(),
		});

		await page.getByPlaceholder('min').fill('90');
		await submit();

		expect(onsave).not.toHaveBeenCalled();
	});

	// 0 is a legitimate rating — a session that drained nothing — so the refusal above
	// has to key on emptiness, not on falsiness.
	it('accepts a rating of zero', async () => {
		const onsave = vi.fn();

		render(DrainLogForm, {
			onsave,
			oncancel: vi.fn(),
		});

		await page.getByPlaceholder('min').fill('30');
		await page.getByLabelText('Mind').fill('0');
		await page.getByLabelText('Body').fill('0');
		await submit();

		expect(onsave).toHaveBeenCalledExactlyOnceWith({
			hours: 0.5,
			mind: 0,
			body: 0,
		});
	});

	it('reports nothing without a session length', async () => {
		const onsave = vi.fn();

		render(DrainLogForm, {
			onsave,
			oncancel: vi.fn(),
		});

		await page.getByLabelText('Mind').fill('7');
		await page.getByLabelText('Body').fill('3');
		await submit();

		expect(onsave).not.toHaveBeenCalled();
	});

	// Re-opening 🪫 on a task rated earlier today amends that rating rather than
	// starting from blank — the fit keeps one observation per task per day.
	it('opens on top of the rating already logged today', async () => {
		render(DrainLogForm, {
			seed: {
				minutes: 45,
				mind: 6,
				body: 2,
			},
			onsave: vi.fn(),
			oncancel: vi.fn(),
		});

		await expect.element(page.getByPlaceholder('min')).toHaveValue(45);
		await expect.element(page.getByLabelText('Mind')).toHaveValue(6);
		await expect.element(page.getByLabelText('Body')).toHaveValue(2);
	});

	/* The caret follows how the editor was opened. Completing a task opens it
	   unasked, and taking focus there means ticking tasks off with the keyboard lands
	   in a number field nobody asked for. */
	it('takes the caret only when the row asked for the editor', async () => {
		render(DrainLogForm, {
			focusMinutes: true,
			onsave: vi.fn(),
			oncancel: vi.fn(),
		});

		await expect.element(page.getByPlaceholder('min')).toHaveFocus();
	});

	it('leaves the caret alone when it opened itself', async () => {
		render(DrainLogForm, {
			onsave: vi.fn(),
			oncancel: vi.fn(),
		});

		await expect.element(page.getByPlaceholder('min')).not.toHaveFocus();
	});

	it('discards the draft on ✕ without reporting it', async () => {
		const onsave = vi.fn();
		const oncancel = vi.fn();

		render(DrainLogForm, {
			onsave,
			oncancel,
		});

		await page.getByPlaceholder('min').fill('90');

		await page
			.getByRole('button', {
				name: '✕',
			})
			.click();

		expect(oncancel).toHaveBeenCalledOnce();
		expect(onsave).not.toHaveBeenCalled();
	});
});
