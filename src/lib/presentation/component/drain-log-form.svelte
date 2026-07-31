<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import {
		MEASUREMENT_FORM_CLASS,
		MEASUREMENT_MINUTES_CLASS,
		RATING_INPUT_CLASS,
	} from '$lib/presentation/utils/measurement-prompt';

	interface Props {
		/** Today's rating for this task, when there is one to re-open and amend. */
		seed?: {
			minutes: number | null;
			mind: number | null;
			body: number | null;
		};
		/** Only when the row's own 🪫 button opened this. An editor that opened itself
		 *  on completion must not yank the caret out of the task list. */
		focusMinutes?: boolean;
		/** The end of a session, in the units MATH.md §8.8 fits α from. */
		onsave: (entry: { hours: number; mind: number; body: number }) => void;
		oncancel: () => void;
	}

	let {
		seed = {
			minutes: null,
			mind: null,
			body: null,
		},
		focusMinutes = false,
		onsave,
		oncancel,
	}: Props = $props();

	// Mounted only while open — the parent renders it behind an `{#if}` — so a fresh
	// draft per opening is the mount, not a reset. What must NOT live here is whether
	// the editor is open: the completion prompt refuses to open over any editor, on any
	// task, and only the page can see all of them.
	// svelte-ignore state_referenced_locally -- deliberately initial-value only
	let draft = $state({
		...seed,
	});

	function save() {
		const minutes = Number(draft.minutes);
		const { mind, body } = draft;

		if (!minutes || minutes <= 0) return;

		// An empty rating is not a rating of 0 — `Number(null)` is a finite 0, so ✓ with
		// only the minutes filled used to record "worked 90 minutes, felt entirely fresh"
		// and bias the α fit toward no drain. 0 is legitimate, so the test is emptiness,
		// not falsiness. `required` on the fields is what makes the refusal visible.
		if (mind === null || body === null) return;

		onsave({
			hours: minutes / 60,
			mind: Math.min(10, Math.max(0, mind)),
			body: Math.min(10, Math.max(0, body)),
		});
	}
</script>

<!-- Its own provider, like task-item.svelte's: the two rating labels are explained by
     tooltip, and a component that cannot mount without an ancestor providing one is a
     component every caller has to keep a wrapper for. Nesting inside the page's region
     provider is harmless — the inner one wins, with the same delay. -->
<Tooltip.Provider delayDuration={150}>
	<form class={MEASUREMENT_FORM_CLASS} onsubmit={(e) => (e.preventDefault(), save())}>
		<span class="text-ty-secondary">{m.energy_drain_form_title()}</span>
		<label class="flex items-center gap-grid-2xs">
			{m.energy_drain_worked_label()}
			<input
				type="number"
				min="1"
				max="960"
				placeholder={m.task_minutes_placeholder()}
				{@attach (node) => {
					if (focusMinutes) node.focus();
				}}
				bind:value={draft.minutes}
				required
				class={MEASUREMENT_MINUTES_CLASS}
			/>
		</label>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<label {...props} class="flex items-center gap-grid-2xs">
						<span class="font-medium text-mind/80">{m.energy_drain_mind_label()}</span>
						<input
							type="number"
							min="0"
							max="10"
							step="1"
							bind:value={draft.mind}
							required
							class={RATING_INPUT_CLASS.mind}
						/>
					</label>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="top">
				<p>{m.energy_drain_mind_title()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<label {...props} class="flex items-center gap-grid-2xs">
						<span class="font-medium text-body/80">{m.energy_drain_body_label()}</span>
						<input
							type="number"
							min="0"
							max="10"
							step="1"
							bind:value={draft.body}
							required
							class={RATING_INPUT_CLASS.body}
						/>
					</label>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="top">
				<p>{m.energy_drain_body_title()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
		<span class="ml-auto flex items-center gap-grid-2xs">
			<button type="submit" class="px-text-2xs text-flow hover:text-flow">✓</button>
			<button
				type="button"
				class="px-text-2xs text-ty-silent hover:text-ty-secondary"
				onclick={oncancel}
			>
				✕
			</button>
		</span>
	</form>
</Tooltip.Provider>
