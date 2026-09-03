<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { TitleRating } from '$lib/business/model/title-memory';
	import type { DraftImpact, DraftTask } from '$lib/business/model/metric/draft-impact';
	import { Button } from '$lib/presentation/component/ui/button';
	import MustDoToggle from '$lib/presentation/component/must-do-toggle.svelte';
	import TaskFormPreview from '$lib/presentation/component/task-form-preview.svelte';
	import TaskFormFields, {
		type TaskEdit,
	} from '$lib/presentation/component/task-form-fields.svelte';

	interface Props {
		onsubmit: (task: TaskEdit) => void;
		suggest: (query: string) => TitleRating[];
		tagVocabulary?: string[];
		withMustDoToday?: boolean;
		/** What the draft would do to the day, `null` while it is unnamed. Absent —
		 *  the Lab, whose plan is the energy optimizer's — renders no second column
		 *  and no `ondraftchange`. */
		impact?: DraftImpact | null;
		ondraftchange?: (draft: DraftTask | null) => void;
	}

	let {
		onsubmit,
		suggest,
		tagVocabulary = [],
		withMustDoToday = true,
		impact,
		ondraftchange,
	}: Props = $props();

	// The middle of every slider: what a task is rated when nothing says otherwise.
	const DEFAULT_RATING = 5;

	const emptyDraft = (): TaskEdit => ({
		title: '',
		physicalDifficulty: DEFAULT_RATING,
		mentalDifficulty: DEFAULT_RATING,
		enjoyment: DEFAULT_RATING,
		mustDoToday: false,
		importance: 'normal',
		tags: [],
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

	// The panel's reading is a solve, so it is the store's (R2) and the draft has
	// to leave the form to be priced. Only what an allocation reads: a title, its
	// tags and the must-do flag reach no solve — and an unnamed draft is not
	// priced at all, since the reading would describe a task nobody is typing.
	$effect(() => {
		ondraftchange?.(
			draft.title.trim()
				? {
						physicalDifficulty: draft.physicalDifficulty,
						mentalDifficulty: draft.mentalDifficulty,
						enjoyment: draft.enjoyment,
						importance: draft.importance,
					}
				: null,
		);
	});

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
			importance: draft.importance,
			tags: draft.tags,
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

<!-- The footer of both forms: the flag pushed out by its own margin and the submit
     in the corner — `task-edit-form`'s too, so the two close the same way. It sits
     at the foot of the reading when there is one, which is where the design's
     Cancel would have been: nothing here is cancelled, since the dialog's own ✕
     closes the form and a draft is never written until it is deployed. -->
{#snippet actions()}
	<div class="flex items-center justify-between gap-grid-sm">
		{#if withMustDoToday}
			<MustDoToggle bind:mustDoToday={draft.mustDoToday} />
		{/if}
		<Button type="submit">{m.form_deploy_task()}</Button>
	</div>
{/snippet}

<!-- Two columns: the fields, and what they would do to today. Each is a plain
     stack, so the DOM order IS the tab order — no `order-*`, and never a positive
     `tabindex`, which would hoist the field ahead of every `tabindex=0` on the
     page. The reading carries no control of its own, so the tab order is the
     fields' and then the footer's, whichever column that footer is in. -->
<form class="flex flex-col gap-grid-lg md:flex-row" onsubmit={handleSubmit}>
	<div class="min-w-0 flex-1 space-y-grid-md">
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

		<TaskFormFields bind:draft {tagVocabulary} />

		{#if impact === undefined}
			{@render actions()}
		{/if}
	</div>

	{#if impact !== undefined}
		<!-- A card, and the BORDER is what separates it: the reading is a panel
		     inside a dialog, whose own surface is the page's, so `surface-card` is
		     the right rung — but it carries alpha on 36 of the 44 themes (white at
		     0.05-0.07 on the dark ones), so the fill alone composites to nothing
		     over the page and the panel only read on the opaque themes. The rule is
		     what makes it a box on all 46 (STYLE.md, "A borderless panel nested
		     inside a card"), and `backdrop-blur` is what a translucent surface on
		     the page always needs. It stacks under the fields on a phone, where the
		     dialog is one column wide. -->
		<div
			class="flex flex-col gap-grid-md rounded-md border border-line-soft bg-surface-card p-box-md backdrop-blur"
		>
			<TaskFormPreview {impact} />
			<div class="mt-auto">{@render actions()}</div>
		</div>
	{/if}
</form>
