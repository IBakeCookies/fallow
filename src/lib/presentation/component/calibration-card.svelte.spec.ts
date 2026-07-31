import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CalibrationCardHarness from '$lib/presentation/component/calibration-card.test-harness.svelte';

describe('calibration-card.svelte', () => {
	// A heading, not styled text: three of these are the page's section structure, and
	// the fit each one reports is only findable by its name.
	it('names the fit with a heading that advertises its explanation', async () => {
		render(CalibrationCardHarness, {
			title: 'Drain Calibration',
			hint: 'Fits the two drain rates to your 🪫 ratings',
		});

		const heading = page.getByRole('heading', {
			name: 'Drain Calibration',
		});

		await expect.element(heading).toBeInTheDocument();
		// The dotted underline is the only thing that says a tooltip is there — touch
		// shows a native `title` never, so the affordance has to be visible.
		await expect.element(heading).toHaveClass(/cursor-help/);
	});

	it('renders what the fit has to say', async () => {
		render(CalibrationCardHarness, {
			title: 'Drain Calibration',
			hint: 'Fits the two drain rates',
			body: 'no ratings yet',
		});

		await expect.element(page.getByText('no ratings yet')).toBeInTheDocument();
	});

	// Only the recovery card has one (☕), and it belongs beside the heading rather than
	// in the body — it opens the editor that produces the data the card reports on.
	it('puts an action opposite the heading when given one', async () => {
		render(CalibrationCardHarness, {
			title: 'Recovery Calibration',
			hint: 'Fits the recovery rate',
			action: 'Log a rest',
		});

		await expect
			.element(
				page.getByRole('button', {
					name: 'Log a rest',
				}),
			)
			.toBeInTheDocument();
	});

	it('leaves the header alone when there is no action', async () => {
		render(CalibrationCardHarness, {
			title: 'Stopping Calibration',
			hint: 'Fits the free-time value',
		});

		expect(page.getByRole('button').elements()).toHaveLength(0);
	});
});
