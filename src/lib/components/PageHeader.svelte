<script lang="ts">
	interface Props {
		completedTasks: number;
		totalTasks: number;
	}

	let { completedTasks, totalTasks }: Props = $props();
</script>

<div class="flex items-center justify-between mb-6">
	<div class="flex items-center gap-4">
		<h1 class="text-2xl font-bold text-zinc-100">Zenith</h1>
		<div class="flex items-center gap-2 text-sm text-zinc-400">
			<span class="font-medium text-zinc-200">{completedTasks}</span>/<span>{totalTasks}</span>
			tasks
		</div>
	</div>
</div>
