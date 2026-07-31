import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SegmentedToggle from '$lib/presentation/component/segmented-toggle.svelte';

const items = [
	{
		value: 'week',
		label: 'Last 7 days',
	},
	{
		value: 'month',
		label: 'Last 30 days',
	},
];

const props = {
	items,
	value: 'week',
	label: 'Time range',
	onchange: () => {},
};

describe('segmented-toggle.svelte', () => {
	it('names the group, so the buttons are not three unrelated switches', async () => {
		render(SegmentedToggle, props);

		await expect
			.element(
				page.getByRole('group', {
					name: 'Time range',
				}),
			)
			.toBeInTheDocument();
	});

	// The pressed state is the only thing telling a screen reader which option is
	// live — the active pill is otherwise a fill.
	it('presses exactly the active option', async () => {
		render(SegmentedToggle, props);

		await expect
			.element(
				page.getByRole('button', {
					name: 'Last 7 days',
				}),
			)
			.toHaveAttribute('aria-pressed', 'true');

		await expect
			.element(
				page.getByRole('button', {
					name: 'Last 30 days',
				}),
			)
			.toHaveAttribute('aria-pressed', 'false');
	});

	it('reports the chosen value and leaves the writing to its caller', async () => {
		const onchange = vi.fn();

		render(SegmentedToggle, {
			...props,
			onchange,
		});

		await page
			.getByRole('button', {
				name: 'Last 30 days',
			})
			.click();

		expect(onchange).toHaveBeenCalledExactlyOnceWith('month');
	});

	// A page that ignores `onchange` must not appear to have switched
	it('shows the value it was given, not the last button clicked', async () => {
		render(SegmentedToggle, props);

		await page
			.getByRole('button', {
				name: 'Last 30 days',
			})
			.click();

		await expect
			.element(
				page.getByRole('button', {
					name: 'Last 7 days',
				}),
			)
			.toHaveAttribute('aria-pressed', 'true');
	});

	it('passes per-button classes through to every option', async () => {
		render(SegmentedToggle, {
			...props,
			itemClass: 'capitalize',
		});

		for (const name of ['Last 7 days', 'Last 30 days']) {
			await expect
				.element(
					page.getByRole('button', {
						name,
					}),
				)
				.toHaveClass(/capitalize/);
		}
	});
});
