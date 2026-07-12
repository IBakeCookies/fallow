<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	interface Props {
		onsubmit: (task: {
			title: string;
			physicalDifficulty: number;
			mentalDifficulty: number;
			enjoyment: number;
		}) => void;
		// Collapsed, the form is a single "+ Add Task" row so the task list
		// stays above the fold; adding happens in bursts, so it stays open
		// once expanded until collapsed again.
		startOpen?: boolean;
	}

	let { onsubmit, startOpen = true }: Props = $props();

	// svelte-ignore state_referenced_locally -- deliberately initial-value only
	let open = $state(startOpen);

	let draft = $state({
		title: '',
		physicalDifficulty: 5,
		mentalDifficulty: 5,
		enjoyment: 5
	});

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const title = draft.title.trim();
		if (!title) return;

		onsubmit({
			title,
			physicalDifficulty: draft.physicalDifficulty,
			mentalDifficulty: draft.mentalDifficulty,
			enjoyment: draft.enjoyment
		});

		draft = { title: '', physicalDifficulty: 5, mentalDifficulty: 5, enjoyment: 5 };
	}
</script>

{#if !open}
	<button
		type="button"
		onclick={() => (open = true)}
		class="w-full rounded-2xl border border-dashed border-white/15 bg-white/3 p-3.5 text-sm text-zinc-400 backdrop-blur-xl transition hover:border-indigo-500/40 hover:text-zinc-200"
	>
		+ Add Task
	</button>
{:else}
	<form
		class="rounded-2xl border border-white/10 bg-white/3 p-4 sm:p-6 backdrop-blur-xl shadow-2xl"
		onsubmit={handleSubmit}
	>
		<div class="flex items-start justify-between gap-3">
			<label class="min-w-0 flex-1 text-xs font-medium text-zinc-400">
				Task Definition
				<input
					type="text"
					bind:value={draft.title}
					placeholder="e.g., Boxing training"
					required
					class="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
				/>
			</label>
			<button
				type="button"
				aria-label="Collapse task form"
				title="Collapse"
				onclick={() => (open = false)}
				class="shrink-0 text-xs text-zinc-600 transition hover:text-zinc-300"
			>
				▴
			</button>
		</div>

	<div class="text-sm mt-5 grid gap-5 sm:grid-cols-3">
		<div class="space-y-2">
			<div class="flex justify-between text-xs font-medium">
				<span class="text-zinc-400">Physical Diff</span>
				<span class="text-zinc-100">{draft.physicalDifficulty}</span>
			</div>
			<input
				type="range"
				min="0"
				max="10"
				bind:value={draft.physicalDifficulty}
				class="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-emerald-400"
			/>
		</div>

		<div class="space-y-2">
			<div class="flex justify-between text-xs font-medium">
				<span class="text-zinc-400">Mental Diff</span>
				<span class="text-zinc-100">{draft.mentalDifficulty}</span>
			</div>
			<input
				type="range"
				min="0"
				max="10"
				bind:value={draft.mentalDifficulty}
				class="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-blue-400"
			/>
		</div>

		<div class="space-y-2">
			<div class="flex justify-between text-xs font-medium">
				<span class="text-zinc-400">Enjoyment</span>
				<span class="text-zinc-100">{draft.enjoyment}</span>
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
{/if}
