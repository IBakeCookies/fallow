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
		isOpen?: boolean;
		withMustDoToday?: boolean;
	}

	let { onsubmit, suggest, isOpen = true, withMustDoToday = true }: Props = $props();

	// svelte-ignore state_referenced_locally -- deliberately initial-value only
	let open = $state(isOpen);

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

	// Below `sm` the flag and Deploy share one line and wrap their own labels rather than
	// stacking: at 360px the German and French pair overflows the 260px the row has, and a
	// fourth line costs more height than the whole layout saves.
	const ACTION_CLASS = 'min-w-0 flex-1 whitespace-normal sm:flex-none sm:whitespace-nowrap';

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
	}
</script>

{#if !open}
	<button
		type="button"
		onclick={() => (open = true)}
		class="w-full rounded-xl border border-dashed border-line-strong p-box-sm text-sm text-ty-secondary transition hover:border-brand/40 hover:text-ty-primary"
	>
		{m.form_add_task()}
	</button>
{:else}
	<!-- One wrapping flex line, not a stack: the sliders take `w-full` and so wrap to
	     their own line, which is what puts the title, the flag and Deploy on one row and
	     saves the form a third row. Deploy is LAST in the DOM and `order-3` visually, so
	     the sliders are tabbed before it without a `tabindex` anywhere — a positive one
	     would hoist the whole form ahead of every `tabindex=0` element on the page. -->
	<form
		class="relative flex flex-wrap items-end gap-x-grid-sm gap-y-grid-md rounded-xl border border-line-soft p-box-md"
		onsubmit={handleSubmit}
	>
		<!-- The list sits outside the label: inside it, a click on an option would
		     also be a click on the label. Full-width below `sm`, where the row cannot
		     hold a usable field and two buttons at once; `basis-0` above it, or `flex-1`
		     grows off the intrinsic width and Deploy wraps to a line of its own. -->
		<div class="relative order-1 min-w-0 flex-1 basis-full sm:basis-0">
			<label class="block text-xs font-medium text-ty-secondary">
				{m.form_task_definition()}
				<input
					type="text"
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

		{#if withMustDoToday}
			<MustDoToggle bind:mustDoToday={draft.mustDoToday} class="order-2 {ACTION_CLASS}" />
		{/if}

		<div class="order-4 w-full">
			<TaskFormFields bind:draft />
		</div>

		<Button class="order-3 {ACTION_CLASS}" type="submit">{m.form_deploy_task()}</Button>

		<!-- The form's own corner rather than a fourth control in the row. It clears
		     Deploy because the title carries a label line the buttons do not, so the
		     row's top edge is empty above them. -->
		<button
			type="button"
			aria-label={m.form_collapse()}
			title={m.form_collapse_title()}
			onclick={() => (open = false)}
			class="absolute top-1 right-1 text-lg leading-none text-ty-silent transition hover:text-ty-secondary"
		>
			▴
		</button>
	</form>
{/if}
