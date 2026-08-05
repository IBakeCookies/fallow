<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { TitleRating } from '$lib/business/model/title-memory';
	import { Button } from '$lib/presentation/component/ui/button';

	interface Props {
		onsubmit: (task: {
			title: string;
			physicalDifficulty: number;
			mentalDifficulty: number;
			enjoyment: number;
			mustDoToday: boolean;
		}) => void;
		/** Rated titles a part-typed one could be naming; empty until it is a query. */
		suggest: (query: string) => TitleRating[];
		// Collapsed, the form is a single "+ Add Task" row so the task list
		// stays above the fold; adding happens in bursts, so it stays open
		// once expanded until collapsed again.
		isOpen?: boolean;
	}

	let { onsubmit, suggest, isOpen = true }: Props = $props();

	// svelte-ignore state_referenced_locally -- deliberately initial-value only
	let open = $state(isOpen);

	// The middle of every slider: what a task is rated when nothing says otherwise.
	const DEFAULT_RATING = 5;

	const emptyDraft = () => ({
		title: '',
		physicalDifficulty: DEFAULT_RATING,
		mentalDifficulty: DEFAULT_RATING,
		enjoyment: DEFAULT_RATING,
		mustDoToday: false,
	});

	let draft = $state(emptyDraft());

	// The sliders only ever move on an explicit pick, so nothing here has to guess
	// whether the user meant the title they have half-typed (ROADMAP item 24). The
	// list is closed rather than filtered away after a pick: the chosen title still
	// matches itself, and re-offering what was just chosen is noise over the form.
	let dismissed = $state(false);
	let active = $state(-1);

	// Whether the three numbers on screen came from a pick rather than from the
	// user's own drags. Emptying the field undoes a pick, and only a pick: sliders
	// somebody set by hand are theirs, and a title they are retyping is not a
	// reason to take them away.
	let fromPick = $state(false);

	const suggestions = $derived(dismissed ? [] : suggest(draft.title));
	const listOpen = $derived(suggestions.length > 0);

	// The highlight only means something if the highlighted row is on screen, and
	// the list is deliberately uncapped: with more matches than the box shows,
	// arrowing past the fold would move a highlight nobody can see. An effect rather
	// than a call beside each assignment because reopening the list highlights a row
	// whose `<li>` does not exist until the DOM has been patched.
	let options: (HTMLLIElement | null)[] = [];

	$effect(() => {
		if (active >= 0)
			options[active]?.scrollIntoView({
				block: 'nearest',
			});
	});

	// The ARIA combobox pattern needs ids to point aria-controls and
	// aria-activedescendant at, and a component cannot know it is the only
	// instance on the page — `$props.id()` is unique per instance and stable
	// across hydration, which a hand-written literal is not.
	const listId = $props.id();
	const optionId = (index: number) => `${listId}-option-${index}`;

	function pick(rating: TitleRating) {
		draft.title = rating.title;
		draft.physicalDifficulty = rating.physicalDifficulty;
		draft.mentalDifficulty = rating.mentalDifficulty;
		draft.enjoyment = rating.enjoyment;
		fromPick = true;
		dismissed = true;
		active = -1;
	}

	function handleTitleInput(e: Event & { currentTarget: HTMLInputElement }) {
		dismissed = false;
		active = -1;

		// An emptied field is a draft with nothing in it, so a pick's rating goes with
		// it: otherwise clearing the title and typing an unrelated task deploys that
		// task under a rating nobody gave it. Only a pick's, though — undoing drags
		// the user made themselves is a loss, not a reset. Editing a picked title
		// short of emptying it deliberately keeps the rating: a picked task being
		// renamed is still that task, the three numbers are on screen next to the
		// sliders, and any of them can be dragged. Trimmed rather than normalized
		// because this asks whether the field is empty, not whether two titles are
		// the same thing.
		if (!fromPick || e.currentTarget.value.trim()) return;

		fromPick = false;
		draft.physicalDifficulty = DEFAULT_RATING;
		draft.mentalDifficulty = DEFAULT_RATING;
		draft.enjoyment = DEFAULT_RATING;
	}

	function handleTitleKeydown(e: KeyboardEvent) {
		if (!listOpen) {
			// Escape and blur close a list the query still matches, so an arrow key
			// reopens it — the combobox pattern's own way back, and without it the
			// only one is editing the field. Everything else, Enter included, has to
			// reach the form: otherwise the mouse is the only way to deploy a task.
			if (dismissed && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
				e.preventDefault();
				dismissed = false;

				// The derived recomputes on read, so the reopened list's length is known
				// here — and the key that opened it also says which end to highlight, so
				// a suggestion is one keystroke away rather than two.
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
			dismissed = true;
			active = -1;
		}
	}

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const title = draft.title.trim();

		if (!title) return;

		onsubmit({
			title,
			physicalDifficulty: draft.physicalDifficulty,
			mentalDifficulty: draft.mentalDifficulty,
			enjoyment: draft.enjoyment,
			mustDoToday: draft.mustDoToday,
		});

		// The next task's rating is nobody's pick yet: leaving the flag set would let
		// this task's title being cleared reset sliders the user had since dragged.
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
	<!-- Nested inside the task-list card: no own shadow/blur, it already sits on a
	     blurred plane. -->
	<form class="rounded-xl border border-line-soft p-box-md" onsubmit={handleSubmit}>
		<div class="flex items-start justify-between gap-grid-sm">
			<!-- The suggestion list sits outside the label — inside it, a click on an
			     option would also be a click on the label — and the wrapper is what it
			     is positioned against. -->
			<div class="relative min-w-0 flex-1">
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
							dismissed = true;
							active = -1;
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
							<!-- Keyboard reaches these through the input, which is the ARIA
							     combobox pattern; mousedown is prevented so the click that
							     picks one does not blur the field first and close the list. -->
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<li
								bind:this={options[index]}
								id={optionId(index)}
								role="option"
								aria-selected={index === active}
								onmousedown={(e) => e.preventDefault()}
								onclick={() => pick(suggestion)}
								class="cursor-pointer break-words px-box-md py-box-xs {index === active
									? 'bg-surface-hover'
									: ''} hover:bg-surface-hover"
							>
								{suggestion.title}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
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

		<div class="text-sm mt-text-lg grid gap-grid-lg sm:grid-cols-3">
			<!-- The wrapping label is what names each range input -->
			<label class="block space-y-text-xs">
				<span class="flex justify-between text-xs font-medium">
					<span class="text-ty-secondary">{m.form_physical_difficulty()}</span>
					<span class="text-ty-primary">{draft.physicalDifficulty}</span>
				</span>
				<input
					type="range"
					min="0"
					max="10"
					bind:value={draft.physicalDifficulty}
					class="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-inset accent-body"
				/>
			</label>

			<label class="block space-y-text-xs">
				<span class="flex justify-between text-xs font-medium">
					<span class="text-ty-secondary">{m.form_mental_difficulty()}</span>
					<span class="text-ty-primary">{draft.mentalDifficulty}</span>
				</span>
				<input
					type="range"
					min="0"
					max="10"
					bind:value={draft.mentalDifficulty}
					class="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-inset accent-mind"
				/>
			</label>

			<label class="block space-y-text-xs">
				<span class="flex justify-between text-xs font-medium">
					<span class="text-ty-secondary">{m.form_enjoyment()}</span>
					<span class="text-ty-primary">{draft.enjoyment}</span>
				</span>
				<input
					type="range"
					min="1"
					max="10"
					bind:value={draft.enjoyment}
					class="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-inset accent-brand"
				/>
			</label>
		</div>

		<div class="mt-text-xl flex flex-wrap items-center justify-between gap-grid-sm">
			<label
				class="flex items-center gap-text-xs text-xs font-medium text-ty-secondary"
				title={m.form_must_do_today_title()}
			>
				<input
					type="checkbox"
					bind:checked={draft.mustDoToday}
					class="size-4 appearance-auto accent-brand"
				/>
				{m.form_must_do_today()}
			</label>
			<Button type="submit">{m.form_deploy_task()}</Button>
		</div>
	</form>
{/if}
