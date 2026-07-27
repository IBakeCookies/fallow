<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Progress from './progress.svelte';

	const { Story } = defineMeta({
		title: 'UI/Progress',
		component: Progress,
		tags: ['autodocs'],
		args: { value: 60, max: 100, 'aria-label': 'Completion' },
		argTypes: {
			value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
			max: { control: 'number' }
		}
	});
</script>

<Story name="Default">
	{#snippet template(args)}
		<div class="max-w-sm"><Progress {...args} /></div>
	{/snippet}
</Story>

<Story name="Steps" asChild>
	<div class="flex max-w-sm flex-col gap-grid-sm">
		{#each [0, 25, 50, 75, 100] as value (value)}
			<Progress {value} aria-label="Completion" />
		{/each}
	</div>
</Story>
