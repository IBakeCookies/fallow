<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/presentation/component/ui/button';
	import MustDoToggle from '$lib/presentation/component/must-do-toggle.svelte';
	import TaskFormFields, {
		type TaskEdit,
	} from '$lib/presentation/component/task-form-fields.svelte';

	interface Props {
		seed: TaskEdit;
		withMustDoToday?: boolean;
		onsave: (edit: TaskEdit) => void;
		oncancel: () => void;
	}

	let { seed, withMustDoToday = true, onsave, oncancel }: Props = $props();

	// Why a copy, and why re-opening is a remount: presentation/AGENTS.md, "A seeded editor
	// copies its seed at mount".
	// svelte-ignore state_referenced_locally -- deliberately initial-value only
	let draft = $state({
		...seed,
	});

	function save() {
		const title = draft.title.trim();

		onsave({
			...draft,
			title,
		});
	}
</script>

<form
	class="mt-text-sm space-y-grid-md rounded-lg border bg-surface-page/40 p-box-md"
	onsubmit={(e) => (e.preventDefault(), save())}
>
	<label class="block text-xs font-medium text-ty-secondary">
		{m.task_title_label()}
		<input
			type="text"
			bind:value={draft.title}
			required
			class="mt-text-xs w-full rounded-lg border border-line-strong bg-input px-box-md py-box-xs text-sm text-ty-primary placeholder:text-ty-silent outline-none transition focus:border-brand/50 focus:ring-1 focus:ring-brand/50"
		/>
	</label>

	<TaskFormFields bind:draft />

	<!-- `justify-end` with the flag pushed out by its own margin, so the buttons keep their
	     corner in the mode that has no flag to show. -->
	<div class="flex flex-wrap items-center justify-end gap-grid-sm">
		{#if withMustDoToday}
			<MustDoToggle bind:mustDoToday={draft.mustDoToday} class="mr-auto" />
		{/if}
		<span class="flex items-center gap-grid-xs">
			<Button variant="ghost" type="button" onclick={oncancel}>
				{m.common_cancel()}
			</Button>
			<Button type="submit" disabled={!draft.title.trim()}>
				{m.common_save()}
			</Button>
		</span>
	</div>
</form>
