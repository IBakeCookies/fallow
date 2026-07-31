import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EnergyTaskRow from '$lib/presentation/component/energy-task-row.svelte';

const props = {
	title: 'boxing',
	completed: false,
	physicalDifficulty: 8,
	mentalDifficulty: 3,
	enjoyment: 6,
	color: 'var(--series-1)',
	plannedHours: 2.5,
	measured: false,
	drainDraft: null,
	focusDrainMinutes: false,
	ontoggle: vi.fn(),
	onremove: vi.fn(),
	ondrainclick: vi.fn(),
	onchange: vi.fn(),
	ondrainsave: vi.fn(),
	ondraincancel: vi.fn(),
};

/* The three sliders are labelled by their own value ("P 8"), so they are addressed by
   position instead: physical, mental, enjoyment, in that order. */
const slider = (index: number) => page.getByRole('slider').nth(index);

describe('energy-task-row.svelte', () => {
	// Dragging a slider re-optimizes the plan, so the row reports a task patch rather
	// than a raw number — the page hands it straight to the session store.
	it.each([
		[0, 'physicalDifficulty'],
		[1, 'mentalDifficulty'],
		[2, 'enjoyment'],
	])('reports slider %i as a change to %s', async (index, key) => {
		const onchange = vi.fn();

		render(EnergyTaskRow, {
			...props,
			onchange,
		});

		await slider(index).fill('7');

		expect(onchange).toHaveBeenCalledExactlyOnceWith({
			[key]: 7,
		});
	});

	it('shows each input at its current value', async () => {
		render(EnergyTaskRow, props);

		await expect.element(slider(0)).toHaveValue('8');
		await expect.element(slider(1)).toHaveValue('3');
		await expect.element(slider(2)).toHaveValue('6');
	});

	/* A finished task has nothing left to tune, but it is the commonest way a session
	   ends — so the sliders go and the 🪫 button stays. It used to be dimmed along with
	   the title, which made the one control the row exists for look disabled. */
	it('hides the sliders on a completed task but keeps the drain button', async () => {
		render(EnergyTaskRow, {
			...props,
			completed: true,
		});

		expect(page.getByRole('slider').elements()).toHaveLength(0);

		await expect
			.element(
				page.getByRole('button', {
					name: 'Log end-of-session drain',
				}),
			)
			.toBeInTheDocument();
	});

	// The card's whole invitation is "drag a slider, watch the plan move", and the
	// timeline cannot answer for a task the optimizer funded zero.
	it.each([
		[2.5, '2h 30m'],
		[0, 'no hours'],
	])('reports %f planned hours as %s', async (plannedHours, expected) => {
		render(EnergyTaskRow, {
			...props,
			plannedHours,
		});

		await expect.element(page.getByText(expected)).toBeInTheDocument();
	});

	// No plan at all is not "no hours for this task" — that would be a claim the
	// optimizer never made, on every row at once.
	it('says nothing about hours when there is no plan', async () => {
		render(EnergyTaskRow, {
			...props,
			plannedHours: null,
		});

		expect(page.getByText('no hours').elements()).toHaveLength(0);
		await expect.element(page.getByText('boxing')).toBeInTheDocument();
	});

	// One hue per task across the timeline, the schedule list and this row
	it('marks the row with the plan colour for the task', async () => {
		render(EnergyTaskRow, props);

		// The dot is the title's preceding sibling — it has no text of its own to find
		const dot = page.getByText('boxing').element().previousElementSibling as HTMLElement;

		await expect.element(dot).toHaveAttribute('style', expect.stringContaining('var(--series-1)'));
	});

	it.each([
		['checkbox', 'Mark boxing complete', 'ontoggle'],
		['button', 'Delete task', 'onremove'],
		['button', 'Log end-of-session drain', 'ondrainclick'],
	] as const)('reports the %s "%s" to the page', async (role, name, handler) => {
		const spy = vi.fn();

		render(EnergyTaskRow, {
			...props,
			[handler]: spy,
		});

		await page
			.getByRole(role, {
				name,
			})
			.click();

		expect(spy).toHaveBeenCalledOnce();
	});

	// The editor is the page's, one for the whole list — the row only renders the one
	// handed to it, seeded with whatever was already logged today.
	it('renders the drain editor only while the page has a draft for this row', async () => {
		const ondrainsave = vi.fn();

		const { rerender } = render(EnergyTaskRow, {
			...props,
			ondrainsave,
		});

		expect(page.getByPlaceholder('min').elements()).toHaveLength(0);

		await rerender({
			...props,
			ondrainsave,
			drainDraft: {
				minutes: 45,
				mind: 6,
				body: 2,
			},
		});

		await expect.element(page.getByPlaceholder('min')).toHaveValue(45);

		await page
			.getByRole('button', {
				name: '✓',
			})
			.click();

		expect(ondrainsave).toHaveBeenCalledExactlyOnceWith({
			hours: 0.75,
			mind: 6,
			body: 2,
		});
	});
});
