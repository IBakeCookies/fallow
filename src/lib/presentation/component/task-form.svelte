<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/presentation/component/ui/button';

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
		class="w-full rounded-2xl border border-dashed border-line-strong bg-surface-card p-box-md text-sm text-ty-secondary backdrop-blur transition hover:border-brand/40 hover:text-ty-primary shadow-card"
	>
		{m.form_add_task()}
	</button>
{:else}
	<form
		class="rounded-2xl border bg-surface-card p-box-md sm:p-box-xl backdrop-blur "
		onsubmit={handleSubmit}
	>
		<div class="flex items-start justify-between gap-3">
			<label class="min-w-0 flex-1 text-xs font-medium text-ty-secondary">
				{m.form_task_definition()}
				<input
					type="text"
					bind:value={draft.title}
					placeholder={m.form_task_placeholder()}
					required
					class="mt-2 w-full rounded-lg border border-line-strong bg-input px-4 py-2.5 text-sm text-ty-primary placeholder:text-ty-silent outline-none transition focus:border-brand/50 focus:ring-1 focus:ring-brand/50"
				/>
			</label>
			<button
				type="button"
				aria-label={m.form_collapse()}
				title={m.form_collapse_title()}
				onclick={() => (open = false)}
				class="shrink-0 text-lg leading-none text-ty-silent transition hover:text-ty-secondary"
			>
				▴
			</button>
		</div>

		<div class="text-sm mt-5 grid gap-grid-lg sm:grid-cols-3">
			<div class="space-y-2">
				<div class="flex justify-between text-xs font-medium">
					<span class="text-ty-secondary">{m.form_physical_difficulty()}</span>
					<span class="text-ty-primary">{draft.physicalDifficulty}</span>
				</div>
				<input
					type="range"
					min="0"
					max="10"
					bind:value={draft.physicalDifficulty}
					class="h-1 w-full cursor-pointer appearance-none rounded-full bg-line-strong accent-body"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between text-xs font-medium">
					<span class="text-ty-secondary">{m.form_mental_difficulty()}</span>
					<span class="text-ty-primary">{draft.mentalDifficulty}</span>
				</div>
				<input
					type="range"
					min="0"
					max="10"
					bind:value={draft.mentalDifficulty}
					class="h-1 w-full cursor-pointer appearance-none rounded-full bg-line-strong accent-mind"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between text-xs font-medium">
					<span class="text-ty-secondary">{m.form_enjoyment()}</span>
					<span class="text-ty-primary">{draft.enjoyment}</span>
				</div>
				<input
					type="range"
					min="1"
					max="10"
					bind:value={draft.enjoyment}
					class="h-1 w-full cursor-pointer appearance-none rounded-full bg-line-strong accent-brand"
				/>
			</div>
		</div>

		<div class="mt-6 flex justify-end">
			<Button type="submit">{m.form_deploy_task()}</Button>
		</div>
	</form>
{/if}
