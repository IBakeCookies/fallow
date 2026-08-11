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
		/** The rating this editor opened on, when it opened on a stored one. `recordId` is the
		 *  caller's append-vs-rewrite key; ✓ here emits the same entry either way. */
		seed?: {
			recordId?: number;
			minutes: number | null;
			mind: number | null;
			body: number | null;
		};
		focusMinutes?: boolean;
		/** The end of a session, in the units MATH.md §8.8 fits α from. */
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

	// A copy taken at MOUNT — as is `focusMinutes` below. A caller that re-seeds without
	// remounting gets stale fields; `task-row-shell.svelte` keys this on the draft for that.
	// svelte-ignore state_referenced_locally -- deliberately initial-value only
	let draft = $state({
		...seed,
	});

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
		<MeasurementFormActions
			{oncancel}
			ondelete={draft.recordId === undefined ? undefined : ondelete}
			deleteLabel={m.energy_delete_drain_log_aria()}
			deleteTitle={m.energy_delete_drain_log_title()}
		/>
	</form>
</Tooltip.Provider>
