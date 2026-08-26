<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { TitleRating } from '$lib/business/model/title-memory';
	import { Button } from '$lib/presentation/component/ui/button';
	import MustDoToggle from '$lib/presentation/component/must-do-toggle.svelte';
	import TaskFormFields, {
		type TaskEdit,
	} from '$lib/presentation/component/task-form-fields.svelte';

	interface Props {
		onsubmit: (task: TaskEdit) => void;
		suggest: (query: string) => TitleRating[];
		withMustDoToday?: boolean;
	}

	let { onsubmit, suggest, withMustDoToday = true }: Props = $props();

	// The middle of every slider: what a task is rated when nothing says otherwise.
	const DEFAULT_RATING = 5;

	const emptyDraft = (): TaskEdit => ({
		title: '',
		physicalDifficulty: DEFAULT_RATING,
		mentalDifficulty: DEFAULT_RATING,
		enjoyment: DEFAULT_RATING,
		mustDoToday: false,
	});

	let draft = $state(emptyDraft());

	// The list is closed rather than filtered away after a pick: the chosen title
	// still matches itself, and re-offering what was just chosen is noise.
	let dismissed = $state(false);
	let active = $state(-1);

	let fromPick = $state(false);

	const suggestions = $derived(dismissed ? [] : suggest(draft.title));
	const listOpen = $derived(suggestions.length > 0);

	// An effect rather than a call beside each assignment: reopening the list
	// highlights a row whose `<li>` does not exist until the DOM has been patched.
	let options: (HTMLLIElement | null)[] = [];

	$effect(() => {
		if (active >= 0)
			options[active]?.scrollIntoView({
				block: 'nearest',
			});
	});

	let titleField: HTMLInputElement | null = $state(null);

	// `$props.id()` rather than a literal: unique per instance and stable across hydration.
	const listId = $props.id();
	const optionId = (index: number) => `${listId}-option-${index}`;

	function closeSuggestions() {
		dismissed = true;
		active = -1;
	}

	function pick(rating: TitleRating) {
		draft.title = rating.title;
		draft.physicalDifficulty = rating.physicalDifficulty;
		draft.mentalDifficulty = rating.mentalDifficulty;
		draft.enjoyment = rating.enjoyment;
		fromPick = true;
		closeSuggestions();
	}

	function handleTitleInput(e: Event & { currentTarget: HTMLInputElement }) {
		dismissed = false;
		active = -1;

		// An emptied field drops a pick's rating, or clearing the title and typing an
		// unrelated task deploys it under a rating nobody gave it. A pick's only:
		// sliders the user dragged themselves are theirs.
		if (!fromPick || e.currentTarget.value.trim()) return;

		fromPick = false;

		draft = {
			...emptyDraft(),
			title: e.currentTarget.value,
			mustDoToday: draft.mustDoToday,
		};
	}

	function handleTitleKeydown(e: KeyboardEvent) {
		if (!listOpen) {
			// An arrow key reopens a list Escape or blur closed. Everything else, Enter
			// included, has to reach the form, or the mouse is the only way to deploy a task.
			if (dismissed && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
				e.preventDefault();
				dismissed = false;

				// The derived recomputes on read, so the reopened list's length is known here.
				if (suggestions.length > 0) active = e.key === 'ArrowDown' ? 0 : suggestions.length - 1;
			}

			return;
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			active = (active + 1) % suggestions.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = (active <= 0 ? suggestions.length : active) - 1;
		} else if (e.key === 'Enter' && active >= 0) {
			e.preventDefault();
			pick(suggestions[active]);
		} else if (e.key === 'Escape') {
			// The list gets this Escape and the surrounding dialog must not: bits-ui's
			// escape layer listens on `document`, so stopping the bubble here is what
			// keeps the first Escape a "close the suggestions" and the second a
			// "close the form". Only while the list is open — this branch.
			e.stopPropagation();
			closeSuggestions();
		}
	}

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const title = draft.title.trim();

		if (!title) return;

		onsubmit({
			...draft,
			title,
		});

		// Left set, the next title being cleared would reset sliders the user had dragged.
		draft = emptyDraft();
		fromPick = false;

		// The dialog does not close on deploy — a day gets typed in one sitting — so the
		// caret goes back to the field the next task starts in, wherever the submit came
		// from. `{@attach}` cannot do this: the field never unmounts between deploys.
		titleField?.focus();
	}
</script>

<!-- A plain stack: the form has a dialog to itself, so nothing has to share a line
     and the DOM order IS the tab order — no `order-*`, and never a positive
     `tabindex`, which would hoist the field ahead of every `tabindex=0` on the page. -->
<form class="space-y-grid-md" onsubmit={handleSubmit}>
	<!-- The list sits outside the label: inside it, a click on an option would also be a
	     click on the label. -->
	<div class="relative">
		<label class="block text-xs font-medium text-ty-secondary">
			{m.form_task_definition()}
			<input
				type="text"
				bind:this={titleField}
				role="combobox"
				aria-expanded={listOpen}
				aria-controls={listId}
				aria-autocomplete="list"
				aria-activedescendant={active >= 0 ? optionId(active) : undefined}
				bind:value={draft.title}
				oninput={handleTitleInput}
				onkeydown={handleTitleKeydown}
				onblur={() => {
					// The list unmounts with the blur, so a highlight left behind would
					// point aria-activedescendant at an id that is no longer there.
					closeSuggestions();
				}}
				placeholder={m.form_task_placeholder()}
				required
				class="mt-text-xs w-full rounded-lg border border-line-strong bg-input px-box-md py-box-xs text-sm text-ty-primary placeholder:text-ty-silent outline-none transition focus:border-brand/50 focus:ring-1 focus:ring-brand/50"
			/>
		</label>
		{#if listOpen}
			<ul
				id={listId}
				role="listbox"
				aria-label={m.form_title_suggestions()}
				class="absolute z-30 mt-text-xs max-h-56 w-full overflow-y-auto rounded-lg border border-line-strong bg-popover py-box-xs text-sm text-popover-foreground shadow-card"
			>
				{#each suggestions as suggestion, index (suggestion.title)}
					<!-- Keyboard reaches these through the input (ARIA combobox); mousedown
				     is prevented so the click that picks one does not close the list. -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<li
						bind:this={options[index]}
						id={optionId(index)}
						role="option"
						aria-selected={index === active}
						onmousedown={(e) => e.preventDefault()}
						onclick={() => pick(suggestion)}
						class="cursor-pointer wrap-break-word px-box-md py-box-xs {index === active
							? 'bg-surface-hover'
							: ''} hover:bg-surface-hover"
					>
						{suggestion.title}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<TaskFormFields bind:draft />

	<!-- `task-edit-form`'s footer, so the two forms close the same way: the flag pushed
	     out by its own margin and the submit in the corner. -->
	<div class="flex flex-wrap items-center justify-end gap-grid-sm">
		{#if withMustDoToday}
			<MustDoToggle bind:mustDoToday={draft.mustDoToday} class="mr-auto" />
		{/if}
		<Button type="submit">{m.form_deploy_task()}</Button>
	</div>
</form>
