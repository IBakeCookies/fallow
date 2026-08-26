<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import StatTile from '$lib/presentation/component/stat-tile.svelte';

	const { Story } = defineMeta({
		title: 'Component/Stat Tile',
		component: StatTile,
		tags: ['autodocs'],
		args: {
			label: 'Tasks completed',
			value: 14,
			suffix: '/ 22',
		},
	});
</script>

<Story
	name="With a denominator"
	play={async ({ canvas }) => {
		// Label, reading and suffix all show; a real value keeps full ink
		await expect(canvas.getByText('Tasks completed')).toBeInTheDocument();
		await expect(canvas.getByText('14')).toHaveClass('text-ty-primary');
		await expect(canvas.getByText('/ 22')).toBeInTheDocument();
		await expect(canvas.getByText('64% of planned tasks')).toBeInTheDocument();
	}}
>
	{#snippet template(args)}
		<StatTile {...args}>
			{#snippet note()}64% of planned tasks{/snippet}
		</StatTile>
	{/snippet}
</Story>

<Story
	name="With a unit"
	args={{
		// A unit rather than a denominator: no slash
		label: 'Planned hours',
		value: '31.5',
		suffix: 'h',
	}}
>
	{#snippet template(args)}
		<StatTile {...args}>
			{#snippet note()}Declared day windows across the range{/snippet}
		</StatTile>
	{/snippet}
</Story>

<Story
	name="Note with a coloured delta"
	args={{
		label: 'Avg completion rate',
		value: '71%',
		suffix: undefined,
	}}
	play={async ({ canvas, canvasElement }) => {
		// The note carries its own colour here, which is why it is a snippet: the sign of the delta is
		// the reading, and green-vs-red must survive every theme
		// No unit: no empty suffix span may be left behind as a stray space
		await expect(canvas.getByText('71%')).toBeInTheDocument();
		await expect(canvasElement.querySelectorAll('.text-base')).toHaveLength(0);

		// The note is markup, not text — the delta colours its own sign
		await expect(canvas.getByText('+6%')).toHaveClass('text-success');
		await expect(canvas.getByText(/vs the previous 7 days/)).toBeInTheDocument();
	}}
>
	{#snippet template(args)}
		<StatTile {...args}>
			{#snippet note()}
				<span class="text-success">+6%</span>
				vs the previous 7 days
			{/snippet}
		</StatTile>
	{/snippet}
</Story>

<Story
	name="Muted placeholder"
	args={{
		label: 'Best day',
		value: '—',
		suffix: undefined,
		muted: true,
	}}
	play={async ({ canvas }) => {
		// Nothing to report: the placeholder must not read as loud as a real number
		// The em-dash must not carry the ink weight of a real reading
		await expect(canvas.getByText('—')).toHaveClass('text-ty-silent');
	}}
>
	{#snippet template(args)}
		<StatTile {...args}>
			{#snippet note()}No tasks completed in this range{/snippet}
		</StatTile>
	{/snippet}
</Story>
