<script lang="ts">
	import TaskItem from './TaskItem.svelte';
	import type { SuggestedTask } from '$lib/metrics/calculations';

	interface Props {
		suggestedTasks: SuggestedTask[];
		runOrder: Map<number, number>; // task id → 1-based position in suggested sequence
		ontoggle: (id: number) => void;
		onremove: (id: number) => void;
		onlogflow?: (id: number, minutes: number) => void;
	}

	let { suggestedTasks, runOrder, ontoggle, onremove, onlogflow }: Props = $props();
</script>

<div class="space-y-2 rounded-xl border border-white/10 bg-white/3 p-5 backdrop-blur-xl shadow-sm">
	<h2 class="text-lg font-bold text-zinc-200">Tasks</h2>
	{#if suggestedTasks.length === 0}
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="text-zinc-600 mb-2">
				<svg class="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
					/>
				</svg>
			</div>
			<p class="text-sm text-zinc-400">No tasks deployed yet</p>
			<p class="text-xs text-zinc-500 mt-1">Add a task above to begin tracking</p>
		</div>
	{/if}
	{#each suggestedTasks as task, i (task.id)}
		{#if i > 0}
			<hr class="border-white/5" />
		{/if}
		<TaskItem
			id={task.id}
			title={task.title}
			physicalDifficulty={task.physicalDifficulty}
			mentalDifficulty={task.mentalDifficulty}
			enjoyment={task.enjoyment}
			completed={task.completed}
			priorityScore={task.priorityScore}
			suggestedHours={task.suggestedHours}
			trueEffort={task.trueEffort}
			flowStateTime={task.flowStateTime}
			runOrder={runOrder.get(task.id)}
			flowMinutes={task.flowMinutes}
			{ontoggle}
			{onremove}
			{onlogflow}
		/>
	{/each}
</div>
