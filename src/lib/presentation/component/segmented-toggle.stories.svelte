<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import SegmentedToggle from '$lib/presentation/component/segmented-toggle.svelte';

	const { Story } = defineMeta({
		title: 'Component/Segmented Toggle',
		component: SegmentedToggle,
		tags: ['autodocs'],
		args: {
			items: [
				{
					value: 'week',
					label: 'Last 7 days',
				},
				{
					value: 'month',
					label: 'Last 30 days',
				},
				{
					value: 'year',
					label: 'Last 12 months',
				},
			],
			value: 'week',
			label: 'Time range',
			onchange: fn(),
		},
	});
</script>

<!-- The analytics range picker: on the page, so its own backdrop-blur -->
<Story name="Segment tone" />

<!-- axe only ever sees a story's REST state, so the middle option being selected is
     not cosmetic: it puts an inactive pill on either side of an active one, which is
     the pairing whose contrast the addon then checks on every theme. -->
<Story
	name="Segment tone, middle selected"
	args={{
		value: 'month',
	}}
/>

<!-- The Energy Lab's chart/schedule switch: nested inside an already-blurred card,
     so a step off the card fill rather than a second blur -->
<Story
	name="Plan tone"
	args={{
		tone: 'plan',
		label: 'Plan view',
		value: 'chart',
		items: [
			{
				value: 'chart',
				label: 'Chart',
			},
			{
				value: 'schedule',
				label: 'Schedule',
			},
		],
	}}
/>

<!-- The calendar's view names are lowercase copy, capitalized in the markup -->
<Story
	name="Two options, capitalized"
	args={{
		label: 'Calendar view',
		itemClass: 'capitalize',
		value: 'month',
		items: [
			{
				value: 'month',
				label: 'month',
			},
			{
				value: 'week',
				label: 'week',
			},
		],
	}}
/>
