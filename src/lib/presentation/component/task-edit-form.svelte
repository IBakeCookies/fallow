<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/presentation/component/ui/button';
	import TaskFormFields, {
		type TaskEdit,
	} from '$lib/presentation/component/task-form-fields.svelte';

	/* Re-tune a task after it is added. One editor for both screens: the fields are the
	   task's definition, not either screen's reading of it, and the Lab could rename
	   nothing until this was shared. The three sliders and the flag are the add form's
	   too — task-form-fields.svelte; what is this form's own is the plain title input and
	   a Save that refuses an empty one. */

	interface Props {
		/** The task's stored values, seeding the draft. */
		seed: TaskEdit;
		/** Off in the Energy Lab — see task-form-fields.svelte. The draft still carries
		 *  the seed's value through to `onsave`: hiding it must not clear the flag. */
		showMustDoToday?: boolean;
		onsave: (edit: TaskEdit) => void;
		oncancel: () => void;
	}

	let { seed, showMustDoToday = true, onsave, oncancel }: Props = $props();

	// Mounted only while open — every caller renders it behind an `{#if}` — so a fresh
	// draft per opening is the mount, not a reset.
	// svelte-ignore state_referenced_locally -- deliberately initial-value only
	let draft = $state({
		...seed,
	});

	function save() {
		const title = draft.title.trim();

		if (!title) return;

		onsave({
			...draft,
			title,
		});
	}
</script>

<form
	class="mt-text-sm ml-7 space-y-grid-md rounded-lg border bg-surface-page/40 p-box-md"
	onsubmit={(e) => (e.preventDefault(), save())}
>
	<label class="block text-xs font-medium text-ty-secondary">
		{m.task_title_label()}
		<input
			type="text"
			bind:value={draft.title}
			required
			class="mt-text-xs w-full rounded-lg border border-line-strong bg-input px-box-sm py-box-2xs text-sm text-ty-primary placeholder:text-ty-silent outline-none transition focus:border-brand/50 focus:ring-1 focus:ring-brand/50"
		/>
	</label>

	<TaskFormFields bind:draft {showMustDoToday}>
		{#snippet footer()}
			<span class="flex items-center gap-grid-xs">
				<Button variant="ghost" size="xs" type="button" onclick={oncancel}>
					{m.common_cancel()}
				</Button>
				<Button size="xs" type="submit" disabled={!draft.title.trim()}>
					{m.common_save()}
				</Button>
			</span>
		{/snippet}
	</TaskFormFields>
</form>
