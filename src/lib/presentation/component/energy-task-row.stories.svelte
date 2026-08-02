<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fireEvent, fn } from 'storybook/test';
	import EnergyTaskRow from '$lib/presentation/component/energy-task-row.svelte';

	const { Story } = defineMeta({
		title: 'Component/Energy Task Row',
		component: EnergyTaskRow,
		tags: ['autodocs'],
		args: {
			title: 'write the calibration section',
			completed: false,
			physicalDifficulty: 2,
			mentalDifficulty: 8,
			enjoyment: 7,
			color: 'var(--series-1)',
			plannedHours: 1.75,
			measured: false,
			drainDraft: null,
			focusDrainMinutes: false,
			ontoggle: fn(),
			onremove: fn(),
			ondrainclick: fn(),
			onchange: fn(),
			ondrainsave: fn(),
			ondraincancel: fn(),
		},
	});
</script>

<!-- The row is an <li>: the list is what makes it one. The play covers what the row
     reports to the page: each slider as a task patch keyed by position (P, M, E),
     the planned hours, the plan colour on the dot, and the three controls. -->
<Story
	name="Default"
	play={async ({ args, canvas, userEvent }) => {
		// Each input shows its current value: physical, mental, enjoyment, in order
		const sliders = canvas.getAllByRole('slider');
		await expect(sliders[0]).toHaveValue('2');
		await expect(sliders[1]).toHaveValue('8');
		await expect(sliders[2]).toHaveValue('7');

		// Dragging a slider re-optimizes the plan, so the row reports a task patch
		// rather than a raw number — the page hands it straight to the session store
		await fireEvent.input(sliders[0], {
			target: {
				value: '7',
			},
		});

		await expect(args.onchange).toHaveBeenCalledWith({
			physicalDifficulty: 7,
		});

		await fireEvent.input(sliders[1], {
			target: {
				value: '7',
			},
		});

		await expect(args.onchange).toHaveBeenCalledWith({
			mentalDifficulty: 7,
		});

		await fireEvent.input(sliders[2], {
			target: {
				value: '7',
			},
		});

		await expect(args.onchange).toHaveBeenCalledWith({
			enjoyment: 7,
		});

		await expect(args.onchange).toHaveBeenCalledTimes(3);

		// What the plan gave the task, in the app's one duration spelling
		await expect(canvas.getByText('1h 45m')).toBeInTheDocument();

		// One hue per task across the timeline, the schedule list and this row —
		// the dot is the title's preceding sibling, with no text of its own to find
		const dot = canvas.getByText(args.title).previousElementSibling;
		await expect(dot).toHaveAttribute('style', expect.stringContaining('var(--series-1)'));

		// The row reports its three controls to the page
		await userEvent.click(
			canvas.getByRole('checkbox', {
				name: `Mark ${args.title} complete`,
			}),
		);

		await expect(args.ontoggle).toHaveBeenCalledOnce();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Delete task',
			}),
		);

		await expect(args.onremove).toHaveBeenCalledOnce();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Log end-of-session drain',
			}),
		);

		await expect(args.ondrainclick).toHaveBeenCalledOnce();

		// No draft from the page: no 🪫 editor under the row
		await expect(canvas.queryByPlaceholderText('min')).not.toBeInTheDocument();
	}}
>
	{#snippet template(args)}
		<ul class="max-w-2xl space-y-text-2xs"><EnergyTaskRow {...args} /></ul>
	{/snippet}
</Story>

<!-- Funded nothing this plan: said out loud, because the timeline cannot say it -->
<Story
	name="Unfunded"
	args={{
		title: 'reorganize the garage',
		physicalDifficulty: 9,
		mentalDifficulty: 1,
		enjoyment: 2,
		plannedHours: 0,
		color: 'var(--series-3)',
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('no hours')).toBeInTheDocument();
	}}
>
	{#snippet template(args)}
		<ul class="max-w-2xl space-y-text-2xs"><EnergyTaskRow {...args} /></ul>
	{/snippet}
</Story>

<!-- No plan at all is not "no hours for this task" — that would be a claim the
     optimizer never made, on every row at once -->
<Story
	name="No plan"
	args={{
		plannedHours: null,
	}}
	play={async ({ args, canvas }) => {
		await expect(canvas.queryByText('no hours')).not.toBeInTheDocument();
		await expect(canvas.getByText(args.title)).toBeInTheDocument();
	}}
>
	{#snippet template(args)}
		<ul class="max-w-2xl space-y-text-2xs"><EnergyTaskRow {...args} /></ul>
	{/snippet}
</Story>

<!-- Finished, and rated: the sliders are gone, the 🪫 stays lit -->
<Story
	name="Completed and rated"
	args={{
		completed: true,
		measured: true,
	}}
	play={async ({ canvas }) => {
		// Nothing left to tune, but the one control the row exists for stays
		await expect(canvas.queryByRole('slider')).not.toBeInTheDocument();

		await expect(
			canvas.getByRole('button', {
				name: 'Log end-of-session drain',
			}),
		).toBeInTheDocument();
	}}
>
	{#snippet template(args)}
		<ul class="max-w-2xl space-y-text-2xs"><EnergyTaskRow {...args} /></ul>
	{/snippet}
</Story>

<!-- The 🪫 editor open under the row, seeded with today's rating -->
<Story
	name="Rating the session"
	args={{
		measured: true,
		drainDraft: {
			minutes: 45,
			mind: 6,
			body: 2,
		},
	}}
	play={async ({ args, canvas, userEvent }) => {
		// Seeded with what was already logged today, not blank
		await expect(canvas.getByPlaceholderText('min')).toHaveValue(45);

		// ✓ reports the amended session through the row, in hours
		await userEvent.click(
			canvas.getByRole('button', {
				name: '✓',
			}),
		);

		await expect(args.ondrainsave).toHaveBeenCalledExactlyOnceWith({
			hours: 0.75,
			mind: 6,
			body: 2,
		});
	}}
>
	{#snippet template(args)}
		<ul class="max-w-2xl space-y-text-2xs"><EnergyTaskRow {...args} /></ul>
	{/snippet}
</Story>
