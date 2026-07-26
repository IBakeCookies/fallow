<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import type { DailySession, SavedRoutine, Task } from '$lib/business/type';
	import PageHeader from './page-header.svelte';

	const task = (id: number, title: string): Task => ({
		id,
		title,
		physicalDifficulty: 3,
		mentalDifficulty: 7,
		enjoyment: 6,
		createdAt: '2026-07-19',
		completed: false
	});

	const yesterdaySession: DailySession = {
		date: '2026-07-19',
		tasks: [task(1, 'boxing'), task(2, 'writing')],
		availableHours: 6,
		switchCost: 0.25,
		updatedAt: 1
	};

	const routines: SavedRoutine[] = [
		{
			id: 'r1',
			name: 'Morning',
			tasks: [{ title: 'stretch', physicalDifficulty: 4, mentalDifficulty: 1, enjoyment: 8 }],
			createdAt: 1
		}
	];

	const { Story } = defineMeta({
		title: 'Component/Page Header',
		component: PageHeader,
		tags: ['autodocs'],
		args: {
			completedTasks: 1,
			totalTasks: 3,
			selectedDate: '2026-07-20',
			today: '2026-07-20',
			yesterdaySession: null,
			routines: [],
			currentTasks: [],
			ondatechange: fn(),
			onimport: fn(),
			onimportdate: fn(() => Promise.resolve(0)),
			onsaveroutine: fn(),
			ondeleteroutine: fn()
		}
	});
</script>

<!-- Nothing to save yet; Load still offers "from a date" -->
<Story name="Today, empty" />

<Story
	name="Today with routines and yesterday"
	args={{
		yesterdaySession,
		routines,
		currentTasks: [task(1, 'boxing'), task(2, 'writing')]
	}}
/>

<!-- A past day hides both import menus and offers the return-to-today button -->
<Story name="Viewing a past day" args={{ selectedDate: '2026-07-14', completedTasks: 3 }} />
