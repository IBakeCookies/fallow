<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import type { FlowObservationRecord } from '$lib/business/type';
	import DayConstraintsBar from '$lib/presentation/component/day-constraints-bar.svelte';

	const log = (id: number, date: string, taskTitle: string, phiHours: number) =>
		({
			id,
			date,
			taskId: id,
			taskTitle,
			difficulty: 7,
			enjoyment: 6,
			E: 4,
			beta: 1.5,
			phiHours,
			createdAt: id,
		}) satisfies FlowObservationRecord;

	const flowLogs: FlowObservationRecord[] = [
		log(1, '2026-07-18', 'boxing', 0.5),
		log(2, '2026-07-19', 'writing', 0.75),
		log(3, '2026-07-20', 'inbox', 0.25),
	];

	const { Story } = defineMeta({
		title: 'Component/Day Constraints Bar',
		component: DayConstraintsBar,
		tags: ['autodocs'],
		args: {
			availableHours: 6,
			switchCost: 0.25,
			cognitivePool: 8,
			physicalPool: 4,
			remainingSuggestedHours: '5.25',
			planSlackHours: 0,
			constantsFitted: true,
			flowLogs,
			ondeletelog: fn(),
			onresetlogs: fn(),
			startOpen: true,
		},
	});
</script>

<Story name="Open" />

<!-- Slack above 0.05 h adds the unplanned-time warning line -->
<Story
	name="With unplanned time"
	args={{
		remainingSuggestedHours: '4.00',
		planSlackHours: 2,
	}}
/>

<!-- Collapsed it is one line: budget · planned · slack · pools · switch -->
<Story
	name="Collapsed"
	args={{
		startOpen: false,
		remainingSuggestedHours: '4.00',
		planSlackHours: 2,
	}}
/>

<!-- Logs present but the fit was rejected: the only model state that surfaces
     while collapsed -->
<Story
	name="Collapsed with a rejected fit"
	args={{
		startOpen: false,
		constantsFitted: false,
	}}
/>

<Story
	name="No logs yet"
	args={{
		constantsFitted: false,
		flowLogs: [],
		onresetlogs: undefined,
	}}
/>
