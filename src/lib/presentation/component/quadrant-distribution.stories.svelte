<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import QuadrantDistribution from '$lib/presentation/component/quadrant-distribution.svelte';

	const { Story } = defineMeta({
		title: 'Component/Quadrant Distribution',
		component: QuadrantDistribution,
		tags: ['autodocs'],
		args: {
			counts: {
				flow: 9,
				cruise: 6,
				grind: 3,
				routine: 4,
			},
			total: 22,
		},
	});
</script>

<Story name="All four profiles">
	{#snippet template(args)}
		<div class="max-w-3xl rounded-xl border bg-surface-card p-box-lg backdrop-blur shadow-card">
			<QuadrantDistribution {...args} />
		</div>
	{/snippet}
</Story>

<!-- One profile fills the bar, and the other three still appear in the legend at 0:
     the reader has to be able to see which profiles exist, not only which they hit -->
<Story
	name="One profile only"
	args={{
		counts: {
			flow: 0,
			cruise: 0,
			grind: 7,
			routine: 0,
		},
		total: 7,
	}}
>
	{#snippet template(args)}
		<div class="max-w-3xl rounded-xl border bg-surface-card p-box-lg backdrop-blur shadow-card">
			<QuadrantDistribution {...args} />
		</div>
	{/snippet}
</Story>

<!-- A single day per profile: the count copy goes singular -->
<Story
	name="One day each"
	args={{
		counts: {
			flow: 1,
			cruise: 1,
			grind: 1,
			routine: 1,
		},
		total: 4,
	}}
>
	{#snippet template(args)}
		<div class="max-w-3xl rounded-xl border bg-surface-card p-box-lg backdrop-blur shadow-card">
			<QuadrantDistribution {...args} />
		</div>
	{/snippet}
</Story>

<!-- No day has a profile yet: an empty bar, a legend of zeros, and no division by
     `total` reaching the width -->
<Story
	name="No days"
	args={{
		counts: {
			flow: 0,
			cruise: 0,
			grind: 0,
			routine: 0,
		},
		total: 0,
	}}
>
	{#snippet template(args)}
		<div class="max-w-3xl rounded-xl border bg-surface-card p-box-lg backdrop-blur shadow-card">
			<QuadrantDistribution {...args} />
		</div>
	{/snippet}
</Story>
