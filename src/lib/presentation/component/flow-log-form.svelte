<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import MeasurementFormActions from '$lib/presentation/component/measurement-form-actions.svelte';
	import {
		MEASUREMENT_FORM_CLASS,
		MEASUREMENT_MINUTES_CLASS,
	} from '$lib/presentation/utils/measurement-prompt';

	interface Props {
		/** Today's time-to-flow, when one is measured: ⚡ is one number per day
		 *  (MATH.md §18), so re-opening the editor amends it rather than adding to it. */
		seed?: number | null;
		/** Only when the row's own ⚡ button opened this. An editor that opened itself on
		 *  completion must not yank the caret out of the list. */
		focusMinutes?: boolean;
		onsave: (minutes: number) => void;
		oncancel: () => void;
	}

	let { seed = null, focusMinutes = false, onsave, oncancel }: Props = $props();

	// A copy, read once — same contract as drain-log-form.svelte: a fresh draft per
	// opening is a fresh MOUNT, which is the caller's promise to keep, not this
	// component's. `focusMinutes` is mount-only for the same reason.
	// svelte-ignore state_referenced_locally -- deliberately initial-value only
	let minutes = $state<number | null>(seed);

	function save() {
		const value = Number(minutes);

		if (!value || value <= 0) return;

		onsave(value);
	}
</script>

<form class={MEASUREMENT_FORM_CLASS} onsubmit={(e) => (e.preventDefault(), save())}>
	<label class="flex items-center gap-grid-2xs">
		<span class="text-ty-secondary">{m.task_flow_form_title()}</span>
		<input
			type="number"
			min="1"
			max="960"
			placeholder={m.task_minutes_placeholder()}
			{@attach (node) => {
				if (focusMinutes) node.focus();
			}}
			bind:value={minutes}
			required
			class={MEASUREMENT_MINUTES_CLASS}
		/>
	</label>
	<MeasurementFormActions {oncancel} />
</form>
