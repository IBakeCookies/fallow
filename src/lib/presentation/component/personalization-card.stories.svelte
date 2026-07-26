<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import type { FlowObservationRecord } from '$lib/business/type';
	import PersonalizationCard from './personalization-card.svelte';

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
			createdAt: id
		}) satisfies FlowObservationRecord;

	const flowLogs: FlowObservationRecord[] = [
		log(1, '2026-07-18', 'boxing', 0.5),
		log(2, '2026-07-19', 'writing', 0.75),
		log(3, '2026-07-20', 'inbox', 0.25)
	];

	const { Story } = defineMeta({
		title: 'Component/Personalization Card',
		component: PersonalizationCard,
		tags: ['autodocs'],
		args: {
			modelStatus: 'Personalized from 3 flow logs',
			flowLogs,
			ondeletelog: fn(),
			onresetlogs: fn()
		}
	});
</script>

<Story name="Personalized" />

<!-- No ondeletelog: rows lose their ✕ -->
<Story name="Without per-row delete" args={{ ondeletelog: undefined }} />

<Story
	name="No logs yet"
	args={{ modelStatus: 'Using default constants', flowLogs: [], onresetlogs: undefined }}
/>
