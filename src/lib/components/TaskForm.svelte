<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	interface Props {
		onsubmit: (task: {
			title: string;
			physicalDifficulty: number;
			mentalDifficulty: number;
			enjoyment: number;
		}) => void;
	}

	let { onsubmit }: Props = $props();

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

<form
	class="rounded-2xl border border-white/10 bg-white/3 p-6 backdrop-blur-xl shadow-2xl"
	onsubmit={handleSubmit}
>
	<label class="text-xs font-medium text-zinc-400">
		Task Definition
		<input
			type="text"
			bind:value={draft.title}
			placeholder="e.g., Boxing training"
			required
			class="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
		/>
	</label>

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
