<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { TitleRating } from '$lib/business/model/title-memory';
	import type { DraftTask } from '$lib/business/model/metric/draft-impact';
	import { Button } from '$lib/presentation/component/ui/button';
	import MustDoToggle from '$lib/presentation/component/must-do-toggle.svelte';
	import TaskFormFields, {
		type TaskEdit,
	} from '$lib/presentation/component/task-form-fields.svelte';

	interface Props {
		onsubmit: (task: TaskEdit) => void;
		suggest: (query: string) => TitleRating[];
		tagVocabulary?: string[];
		withMustDoToday?: boolean;
		/** The second column: each screen's own reading of the draft, rendered with
		 *  `pick` because the panel's next-task buttons fill the title field and only
		 *  this form can. Absent, there is no second column. */
		preview?: Snippet<[(rating: TitleRating) => void]>;
		/** The footer's left slot, where `/` puts the must-do toggle. */
		action?: Snippet;
		/** What a solve reads off the draft, published on every edit — `null` while it
		 *  is unnamed. Both screens price it, one live and one on a press. */
		ondraftchange?: (draft: DraftTask | null) => void;
		/** Closes the dialog this is mounted in. Absent, there is no Cancel — the
		 *  row actions' rule: the button is there when its callback is. */
		oncancel?: () => void;
	}

	let {
		onsubmit,
		suggest,
		tagVocabulary = [],
		withMustDoToday = true,
		preview,
		action,
		ondraftchange,
		oncancel,
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

		// `required` counts three spaces as a title, and Enter submits past a
		// disabled Deploy.
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

<!-- Two columns: the fields, and what they would do to today. 2fr/1fr and not an
     even split — the fields set their own widths (three slider tracks, a tag
     field), the reading is label-and-number rows that wrap — and one column
     wherever a caller passes no `preview`. A panel's only controls fill the field
     beside it (`/`'s next-task buttons), and they follow the fields in source
     order, so the tab order is the column as written: no `order-*`, and never a
     positive `tabindex`. -->
<form
	class="grid gap-grid-xl {preview === undefined ? '' : 'md:grid-cols-[2fr_1fr]'}"
	onsubmit={handleSubmit}
>
	<!-- Framed only when there is a reading to be told apart from; a form with no
	     second column is already the dialog's own box. -->
	<div
		class="min-w-0 space-y-grid-lg {preview === undefined
			? ''
			: 'rounded-md border border-line-soft bg-surface-card p-box-lg backdrop-blur'}"
	>
		<!-- The list sits outside the label: inside it, a click on an option would also be a
	     click on the label. -->
		<div class="relative">
			<label class="block text-xs font-medium text-ty-secondary">
				{m.task_title_label()}
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
					class="field-input"
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

		<!-- One footer, the row editor's, and ONE left slot in it however much a
		     screen puts there — presentation/AGENTS.md has the whole row. -->
		<div class="flex flex-wrap items-center justify-end gap-grid-sm">
			{#if withMustDoToday || action}
				<span class="mr-auto flex items-center gap-grid-sm">
					{#if withMustDoToday}
						<MustDoToggle bind:mustDoToday={draft.mustDoToday} />
					{/if}
					{#if action}{@render action()}{/if}
				</span>
			{/if}
			<span class="flex items-center gap-grid-xs">
				{#if oncancel}
					<Button variant="ghost" type="button" onclick={oncancel}>{m.common_cancel()}</Button>
				{/if}
				<Button type="submit" disabled={!draft.title.trim()}>{m.form_deploy_task()}</Button>
			</span>
		</div>
	</div>

	{#if preview !== undefined}
		<!-- Both columns are cards and the BORDER is what separates them: the
		     `surface-card` fill carries alpha on 36 of the 44 themes that set it, so
		     the rule is what makes each a box on all 46 (STYLE.md, "A borderless
		     panel nested inside a card"). This one stacks under the fields on a
		     phone. -->
		<div class="min-w-0 rounded-md border border-line-soft bg-surface-card p-box-md backdrop-blur">
			{@render preview(pick)}
		</div>
	{/if}
</form>
