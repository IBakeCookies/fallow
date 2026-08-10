<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import MeasurementFormActions from '$lib/presentation/component/measurement-form-actions.svelte';
	import {
		MEASUREMENT_FORM_CLASS,
		MEASUREMENT_MINUTES_CLASS,
	} from '$lib/presentation/utils/measurement-prompt';

	interface Props {
		/** The reading this editor opened on, when it opened on one: ⚡ is one number per
		 *  day (MATH.md §18), so re-opening amends it rather than adding to it. The viewed
		 *  day's from a task's row; from the analytics ✎, the record's own — that caller
		 *  views no day. */
		seed?: number | null;
		/** Only when a click asked for this editor — the row's ⚡ button, or the analytics
		 *  ✎. An editor that opened itself on completion must not yank the caret out of
		 *  the list. */
		focusMinutes?: boolean;
		onsave: (minutes: number) => void;
		oncancel: () => void;
		/** Drop the measurement this editor opened on. A task's row passes it
		 *  unconditionally and lets the seed decide; the analytics ✎ passes none, because
		 *  the row it sits on carries its own ✕. */
		ondelete?: () => void;
	}

	let { seed = null, focusMinutes = false, onsave, oncancel, ondelete }: Props = $props();

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
	<MeasurementFormActions
		{oncancel}
		ondelete={seed === null ? undefined : ondelete}
		deleteLabel={m.budget_delete_log_aria()}
		deleteTitle={m.budget_delete_log_title()}
	/>
</form>
