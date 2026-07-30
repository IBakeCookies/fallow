<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import LogList from '$lib/presentation/component/log-list.svelte';

	/* The component is generic over the row shape; this is the flow-log one. */
	interface FlowRow {
		id: number;
		date: string;
		taskTitle: string;
		phiHours: number;
	}

	const items: FlowRow[] = [
		{
			id: 1,
			date: '2026-07-18',
			taskTitle: 'boxing',
			phiHours: 0.5,
		},
		{
			id: 2,
			date: '2026-07-19',
			taskTitle: 'writing',
			phiHours: 0.75,
		},
		{
			id: 3,
			date: '2026-07-20',
			taskTitle: 'inbox',
			phiHours: 0.25,
		},
	];

	const onreset = fn();

	const { Story } = defineMeta({
		title: 'Component/Log List',
		component: LogList,
		tags: ['autodocs'],
	});
</script>

{#snippet row(log: FlowRow)}
	<span class="truncate">
		<span class="text-ty-silent">{log.date}</span>
		<span class="capitalize"> · {log.taskTitle}</span>
	</span>
	<span class="shrink-0 font-medium text-flow/90">⚡ {Math.round(log.phiHours * 60)}m</span>
{/snippet}

<!-- Click the label to expand; the reset row is a two-step confirm -->
<Story name="With items">
	{#snippet template()}
		<LogList
			label="Personalized from 3 flow logs"
			title="Time-to-flow measurements feeding the ϕ fit"
			{items}
			{row}
			confirmLabel="Delete all 3 logs?"
			resetLabel="Reset personalization"
			resetTitle="Drop every logged data point"
			{onreset}
		/>
	{/snippet}
</Story>

<!-- Nothing logged yet: the toggle is disabled and there is no chevron -->
<Story name="Empty">
	{#snippet template()}
		<LogList
			label="Using default constants"
			items={[]}
			{row}
			confirmLabel="Delete all 0 logs?"
			resetLabel="Reset personalization"
		/>
	{/snippet}
</Story>

<!-- Omitting onreset hides the reset row entirely -->
<Story name="Without reset">
	{#snippet template()}
		<LogList
			label="Personalized from 3 flow logs"
			{items}
			{row}
			confirmLabel="Delete all 3 logs?"
			resetLabel="Reset personalization"
		/>
	{/snippet}
</Story>
