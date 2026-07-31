<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
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

<Story name="With a denominator">
	{#snippet template(args)}
		<StatTile {...args}>
			{#snippet note()}64% of planned tasks{/snippet}
		</StatTile>
	{/snippet}
</Story>

<!-- A unit rather than a denominator: no slash -->
<Story
	name="With a unit"
	args={{
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

<!-- The note carries its own colour here, which is why it is a snippet: the sign
     of the delta is the reading, and green-vs-red must survive every theme -->
<Story
	name="Note with a coloured delta"
	args={{
		label: 'Avg completion rate',
		value: '71%',
		suffix: undefined,
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

<!-- Nothing to report: the placeholder must not read as loud as a real number -->
<Story
	name="Muted placeholder"
	args={{
		label: 'Best day',
		value: '—',
		suffix: undefined,
		muted: true,
	}}
>
	{#snippet template(args)}
		<StatTile {...args}>
			{#snippet note()}No tasks completed in this range{/snippet}
		</StatTile>
	{/snippet}
</Story>
