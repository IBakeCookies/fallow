<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import MeasurementFormActions from '$lib/presentation/component/measurement-form-actions.svelte';
	import {
		MEASUREMENT_FORM_CLASS,
		MEASUREMENT_MINUTES_CLASS,
		RATING_INPUT_CLASS,
	} from '$lib/presentation/utils/measurement-prompt';

	interface Props {
		/** The rating this editor opened on, when it opened on a stored one. The fields and
		 *  nothing else: append-vs-rewrite is `DrainDraft.recordId`, which the CALLER reads
		 *  to decide both the save and whether there is a 🗑 at all, so a copy of it here
		 *  would be a second statement of a decision this form does not take. ✓ emits the
		 *  same entry either way. */
		seed?: {
			minutes: number | null;
			mind: number | null;
			body: number | null;
		};
		focusMinutes?: boolean;
		/** The end of a session, in the units MATH.md §8.7 fits α from: hours worked,
		 *  and both capacities rated 0–10 as they feel now. */
		onsave: (entry: { hours: number; mind: number; body: number }) => void;
		oncancel: () => void;
		ondelete?: () => void;
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
		ondelete,
	}: Props = $props();

	// Why a copy, and why re-opening is a remount: presentation/AGENTS.md, "A seeded editor
	// copies its seed at mount".
	// svelte-ignore state_referenced_locally -- deliberately initial-value only
	let draft = $state({
		...seed,
	});

	// The caret goes to the first question still open: the length when nothing has
	// measured it, the first rating when something has (the stopped timer), and back
	// to the length when a correction seeds all three — landing it on a rating that
	// already reads 6 would turn a corrected 7 into 67. Decided at mount like the draft,
	// or a field being typed in would lose focus mid-entry.
	// svelte-ignore state_referenced_locally -- deliberately initial-value only
	const focusField = !focusMinutes
		? null
		: seed.minutes === null
			? 'minutes'
			: seed.mind === null
				? 'mind'
				: 'minutes';

	function save() {
		const minutes = Number(draft.minutes);
		const { mind, body } = draft;

		if (!minutes || minutes <= 0) return;

		// `Number(null)` is a finite 0 and 0 is a legitimate rating, so the test is emptiness,
		// not falsiness; `required` on the fields is what makes the silent refusal visible.
		if (mind === null || body === null) return;

		onsave({
			hours: minutes / 60,
			mind,
			body,
		});
	}
</script>

<!-- Its own provider, like task-item.svelte's: a component that cannot mount without an
     ancestor providing one costs every caller a wrapper. Nesting is harmless — the inner
     one wins, with the same delay. -->
<Tooltip.Provider>
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
					if (focusField === 'minutes') node.focus();
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
							{@attach (node) => {
								if (focusField === 'mind') node.focus();
							}}
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
		<MeasurementFormActions
			{oncancel}
			{ondelete}
			deleteLabel={m.energy_delete_drain_log_aria()}
			deleteTitle={m.energy_delete_drain_log_title()}
		/>
	</form>
</Tooltip.Provider>
