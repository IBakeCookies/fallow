<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import type { SuggestedTask } from '$lib/business/model/metric/calculation';
	import TaskList from './task-list.svelte';

	const task = (id: number, title: string, overrides: Partial<SuggestedTask> = {}) =>
		({
			id,
			title,
			physicalDifficulty: 3,
			mentalDifficulty: 7,
			enjoyment: 6,
			createdAt: '2026-07-20',
			completed: false,
			suggestedHours: 1.5,
			priorityScore: 10,
			flowStateTime: 0.5,
			trueEffort: 4,
			trueEnjoyability: 1.5,
			peakProductivity: 1,
			avgProductivity: 0.8,
			optimalHours: 2,
			...overrides
		}) satisfies SuggestedTask;

	const tasks: SuggestedTask[] = [
		task(1, 'write the calibration section', { suggestedHours: 1.75, priorityScore: 12.4 }),
		task(2, 'boxing', { physicalDifficulty: 8, mentalDifficulty: 2, enjoyment: 9 }),
		task(3, 'inbox', { suggestedHours: 0, priorityScore: 1.2, completed: true })
	];

	const { Story } = defineMeta({
		title: 'Component/Task List',
		component: TaskList,
		tags: ['autodocs'],
		args: {
			suggestedTasks: tasks,
			runOrder: new Map([
				[1, 1],
				[2, 2]
			]),
			ontoggle: fn(),
			onremove: fn(),
			onlogflow: fn(),
			onupdate: fn()
		}
	});
</script>

<Story name="Default" />

<Story name="Empty" args={{ suggestedTasks: [], runOrder: new Map() }} />
