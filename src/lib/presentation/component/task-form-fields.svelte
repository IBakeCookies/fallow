<script module lang="ts">
	import type { Task, TaskImportance } from '$lib/business/type';

	/** `mustDoToday`, `importance` and `tags` are required here though optional on a
	 *  stored task: absence there means never flagged / normal / untagged, while a
	 *  control always answers the question. */
	export type TaskEdit = Pick<
		Task,
		'title' | 'physicalDifficulty' | 'mentalDifficulty' | 'enjoyment'
	> & { mustDoToday: boolean; importance: TaskImportance; tags: string[] };
</script>

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { ButtonSize } from '$lib/presentation/component/ui/button';
	import TaskImportanceSelect from '$lib/presentation/component/task-importance-select.svelte';

	interface Props {
		draft: TaskEdit;
		// Forwarded to the importance buttons only: the sliders have no size. It is
		// the caller's because the two forms disagree — the dialog is at the default
		// scale, the row editor is `xs` throughout.
		size?: ButtonSize;
		/** The user's own past tags, offered by the field's `<datalist>`. The row
		 *  editor offers none, like the title suggestions. */
		tagVocabulary?: string[];
	}

	let { draft = $bindable(), size = 'default', tagVocabulary = [] }: Props = $props();

	let entry = $state('');

	// `$props.id()` rather than a literal: both forms can be mounted at once, and one
	// shared list id would point the row editor's field at the dialog's options.
	const listId = $props.id();

	function addTag(raw: string) {
		const tag = raw.trim();

		// Trimmed only: normalizing is the write side's (`toStoredTags`), which a
		// component may not value-import.
		if (tag && !draft.tags.includes(tag)) draft.tags = [...draft.tags, tag];
	}

	function handleTagInput(e: Event & { currentTarget: HTMLInputElement }) {
		// One tag per comma, so a list typed or pasted in one go lands as a list;
		// what follows the last comma is still being typed.
		const fragments = e.currentTarget.value.split(',');

		entry = fragments.pop() ?? '';

		for (const fragment of fragments) addTag(fragment);

		// Written back rather than left to the binding: a lone comma leaves `entry`
		// unchanged, so nothing re-renders and the comma would stay in the field for
		// the next keystroke to file as a tag of its own.
		e.currentTarget.value = entry;
	}

	function handleTagKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;

		// The form must not see this Enter, or the first tag deploys the task.
		e.preventDefault();
		addTag(entry);
		entry = '';
	}

	// Typing a tag and going straight for the submit files it: the field is a
	// half-finished chip, not a draft the submit may drop — and an uncommitted one
	// would otherwise survive `emptyDraft()` and land on the NEXT task.
	function handleTagBlur() {
		addTag(entry);
		entry = '';
	}

	// Enjoyment's minimum is 1 because MATH.md §1 declares βᵤ ∈ [1,10]: a 0 puts β
	// outside [1,2], the range every fit was built on.
	const sliders = [
		{
			key: 'physicalDifficulty',
			label: m.form_physical_difficulty(),
			min: 0,
			accent: 'accent-body',
		},
		{
			key: 'mentalDifficulty',
			label: m.form_mental_difficulty(),
			min: 0,
			accent: 'accent-mind',
		},
		{
			key: 'enjoyment',
			label: m.form_enjoyment(),
			min: 1,
			accent: 'accent-brand',
		},
	] as const;
</script>

<div class="space-y-grid-md">
	<div class="grid gap-grid-md sm:grid-cols-3">
		{#each sliders as slider (slider.key)}
			<!-- The wrapping label is what names the range input -->
			<label class="block space-y-text-xs">
				<span class="flex justify-between text-xs font-medium">
					<span class="text-ty-secondary">{slider.label}</span>
					<span class="text-ty-primary">{draft[slider.key]}</span>
				</span>
				<input
					type="range"
					min={slider.min}
					max="10"
					bind:value={draft[slider.key]}
					class="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-inset {slider.accent}"
				/>
			</label>
		{/each}
	</div>

	<TaskImportanceSelect bind:importance={draft.importance} {size} />

	<div class="space-y-text-xs">
		<label class="block text-xs font-medium text-ty-secondary">
			{m.form_tags()}
			<input
				type="text"
				list={listId}
				value={entry}
				oninput={handleTagInput}
				onkeydown={handleTagKeydown}
				onblur={handleTagBlur}
				placeholder={m.form_tags_placeholder()}
				class="mt-text-xs w-full rounded-lg border border-line-strong bg-input px-box-md py-box-xs text-sm text-ty-primary placeholder:text-ty-silent outline-none transition focus:border-brand/50 focus:ring-1 focus:ring-brand/50"
			/>
		</label>
		<datalist id={listId}>
			{#each tagVocabulary as tag (tag)}
				<option value={tag}></option>
			{/each}
		</datalist>
		{#if draft.tags.length > 0}
			<div class="flex flex-wrap gap-grid-2xs">
				{#each draft.tags as tag (tag)}
					<span
						class="flex items-center gap-text-2xs rounded-full bg-surface-inset px-box-2xs py-text-3xs text-xs text-ty-secondary"
					>
						{tag}
						<button
							type="button"
							aria-label={m.form_tag_remove({
								tag,
							})}
							onclick={() => (draft.tags = draft.tags.filter((t) => t !== tag))}
							class="text-ty-silent transition hover:text-ty-primary"
						>
							&times;
						</button>
					</span>
				{/each}
			</div>
		{/if}
	</div>
</div>
