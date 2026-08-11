<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import MeasurementFormActions from '$lib/presentation/component/measurement-form-actions.svelte';
	import {
		MEASUREMENT_FORM_CLASS,
		MEASUREMENT_MINUTES_CLASS,
	} from '$lib/presentation/utils/measurement-prompt';

	interface Props {
		seed?: number | null;
		focusMinutes?: boolean;
		onsave: (minutes: number) => void;
		oncancel: () => void;
		ondelete?: () => void;
	}

	let { seed = null, focusMinutes = false, onsave, oncancel, ondelete }: Props = $props();

	// A copy, read once: a fresh draft per opening is a fresh MOUNT, which the caller
	// keeps, not this component. `focusMinutes` is mount-only for the same reason.
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
	<MeasurementFormActions
		{oncancel}
		ondelete={seed === null ? undefined : ondelete}
		deleteLabel={m.budget_delete_log_aria()}
		deleteTitle={m.budget_delete_log_title()}
	/>
</form>
