<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { TaskType } from '$lib/types/business/taskType';

	interface Props {
		id: number;
		title: string;
		difficulty: number;
		enjoyment: number;
		taskType: TaskType;
		completed: boolean;
		priorityScore: number;
		suggestedHours: number;
		ontoggle: (id: number) => void;
		onremove: (id: number) => void;
	}

	let {
		id,
		title,
		difficulty,
		enjoyment,
		taskType,
		completed,
		priorityScore,
		suggestedHours,
		ontoggle,
		onremove
	}: Props = $props();

	function decimalHourToMinutes(decimalHour: number): string {
		const hours = Math.floor(decimalHour);
		const minutes = Math.round((decimalHour - hours) * 60);
		return `${hours}h ${minutes}m`;
	}

	const badges = $derived([
		{ label: 'Diff', value: difficulty },
		{ label: 'Engagement', value: enjoyment },
		{ label: 'Priority', value: priorityScore },
		{ label: null, value: decimalHourToMinutes(suggestedHours) }
	]);
</script>

<div
	class="group flex items-center justify-between rounded-lg border border-transparent bg-transparent p-3 transition hover:border-white/5 hover:bg-white/[0.02]"
>
	<div class="flex items-center gap-4">
		<input
			type="checkbox"
			checked={completed}
			onchange={() => ontoggle(id)}
			class="h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500/20"
		/>
		<div class="flex items-center gap-2">
			<span
				class="text-xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded {taskType ===
				'Cognitive'
					? 'bg-blue-500/20 text-blue-400'
					: taskType === 'Physical'
						? 'bg-emerald-500/20 text-emerald-400'
						: 'bg-violet-500/20 text-violet-400'}"
				title={taskType || 'Cognitive'}
			>
				{taskType === 'Cognitive' ? 'COG' : taskType === 'Physical' ? 'PHY' : 'HYB'}
			</span>
			<h3
				class:text-zinc-500={completed}
				class:line-through={completed}
				class="text-sm font-medium text-zinc-100 capitalize"
			>
				{title}
			</h3>
		</div>
	</div>

	<div class="flex items-center gap-2">
		{#each badges as badge}
			<span
				class="rounded border border-zinc-800 bg-white/3 px-2 py-0.5 text-xs font-medium text-zinc-400"
			>
				{#if badge.label}{badge.label}:
				{/if}{badge.value}
			</span>
		{/each}

		<Button
			variant="ghost"
			size="icon-xs"
			onclick={() => onremove(id)}
			class="ml-2 text-zinc-600 hover:text-red-400"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</Button>
	</div>
</div>
