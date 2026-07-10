<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import type { TaskType } from '$lib/types/business/taskType';

	interface Props {
		onsubmit: (task: {
			title: string;
			difficulty: number;
			enjoyment: number;
			taskType: TaskType;
		}) => void;
	}

	let { onsubmit }: Props = $props();

	const taskTypes: TaskType[] = ['Cognitive', 'Physical', 'Hybrid'];

	let draft = $state({
		title: '',
		difficulty: 5,
		enjoyment: 5,
		taskType: 'Cognitive' as TaskType
	});

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const title = draft.title.trim();
		if (!title) return;

		onsubmit({
			title,
			difficulty: draft.difficulty,
			enjoyment: draft.enjoyment,
			taskType: draft.taskType
		});

		draft = { title: '', difficulty: 5, enjoyment: 5, taskType: 'Cognitive' };
	}
</script>

<form
	class="rounded-2xl border border-white/10 bg-white/3 p-6 backdrop-blur-xl shadow-2xl"
	onsubmit={handleSubmit}
>
	<div class="flex gap-3 items-end">
		<label class="text-xs font-medium text-zinc-400 flex-1">
			Task Definition
			<input
				type="text"
				bind:value={draft.title}
				placeholder="Enter task parameters..."
				class="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
			/>
		</label>

		<div class="flex flex-col gap-1">
			<span class="text-xs font-medium text-zinc-400">Type</span>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					<Button variant="outline" class="w-32 justify-between">
						{draft.taskType}
						<svg class="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</Button>
				</DropdownMenu.Trigger>

				<DropdownMenu.Content>
					{#each taskTypes as type}
						<DropdownMenu.Item onclick={() => (draft.taskType = type)}>
							{type}
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>

	<div class="text-sm mt-5 grid gap-5 sm:grid-cols-2">
		<div class="space-y-2">
			<div class="flex justify-between text-xs font-medium">
				<span class="text-zinc-400">Difficulty Factor</span>
				<span class="text-zinc-100">{draft.difficulty}</span>
			</div>
			<input
				type="range"
				min="1"
				max="10"
				bind:value={draft.difficulty}
				class="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-indigo-400"
			/>
		</div>

		<div class="space-y-2">
			<div class="flex justify-between text-xs font-medium">
				<span class="text-zinc-400">Engagement / Enjoyment</span>
				<span class="text-zinc-100">
					{draft.enjoyment}
				</span>
			</div>
			<input
				type="range"
				min="1"
				max="10"
				bind:value={draft.enjoyment}
				class="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-indigo-400"
			/>
		</div>
	</div>

	<div class="mt-6 flex justify-end">
		<Button type="submit">Deploy Task</Button>
	</div>
</form>
