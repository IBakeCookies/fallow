import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RestLogForm from '$lib/presentation/component/rest-log-form.svelte';

/* "before" and "after" are visual grouping, not accessible grouping, so both Mind
   fields answer to the same name — first is before, second after. */
const rate = async (label: 'Mind' | 'Body', before: string, after: string) => {
	await page.getByLabelText(label).nth(0).fill(before);
	await page.getByLabelText(label).nth(1).fill(after);
};

const fillPair = async () => {
	await page.getByPlaceholder('min').fill('30');
	await rate('Mind', '8', '3');
	await rate('Body', '6', '2');
};

const submit = () =>
	page
		.getByRole('button', {
			name: '✓',
		})
		.click();

describe('rest-log-form.svelte', () => {
	// Minutes in, hours out: the store and the §8.9 fit both work in hours, and the
	// form asks in minutes because nobody logs a break as 0.5.
	it('reports the pair in hours', async () => {
		const onsave = vi.fn();

		render(RestLogForm, {
			onsave,
			oncancel: vi.fn(),
		});

		await fillPair();
		await submit();

		expect(onsave).toHaveBeenCalledExactlyOnceWith({
			hours: 0.5,
			mindBefore: 8,
			mindAfter: 3,
			bodyBefore: 6,
			bodyAfter: 2,
		});
	});

	/* An empty rating is not a rating of 0. §8.9 reads the pair as a decay, so a blank
	   "after" would enter the fit as "the break left me at zero" — recovery in the
	   wrong direction, fitting r to its upper bound. */
	it('reports nothing when the pair is missing its after ratings', async () => {
		const onsave = vi.fn();

		render(RestLogForm, {
			onsave,
			oncancel: vi.fn(),
		});

		await page.getByPlaceholder('min').fill('30');
		await page.getByLabelText('Mind').nth(0).fill('8');
		await page.getByLabelText('Body').nth(0).fill('6');
		await submit();

		expect(onsave).not.toHaveBeenCalled();
	});

	// A break of no length is not a break, and 0 hours divides into the fit's rate
	it('reports nothing without a length', async () => {
		const onsave = vi.fn();

		render(RestLogForm, {
			onsave,
			oncancel: vi.fn(),
		});

		await rate('Mind', '8', '3');
		await rate('Body', '6', '2');
		await submit();

		expect(onsave).not.toHaveBeenCalled();
	});

	// The ☕ button is the only way in, so the caret is always asked for. An
	// `autofocus` attribute is inert on a node inserted after load.
	it('puts the caret in the length field', async () => {
		render(RestLogForm, {
			onsave: vi.fn(),
			oncancel: vi.fn(),
		});

		await expect.element(page.getByPlaceholder('min')).toHaveFocus();
	});

	it('discards the draft on ✕ without reporting it', async () => {
		const onsave = vi.fn();
		const oncancel = vi.fn();

		render(RestLogForm, {
			onsave,
			oncancel,
		});

		await fillPair();

		await page
			.getByRole('button', {
				name: '✕',
			})
			.click();

		expect(oncancel).toHaveBeenCalledOnce();
		expect(onsave).not.toHaveBeenCalled();
	});
});
