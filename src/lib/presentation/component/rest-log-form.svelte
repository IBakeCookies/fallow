<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { RATING_INPUT_CLASS } from '$lib/presentation/utils/measurement-prompt';

	interface Props {
		/** A completed pre/post pair, in the units MATH.md §8.9 fits r from: hours
		 *  rested, and both capacities rated 0–10 before and after. */
		onsave: (entry: {
			hours: number;
			mindBefore: number;
			mindAfter: number;
			bodyBefore: number;
			bodyAfter: number;
		}) => void;
		oncancel: () => void;
	}

	let { onsave, oncancel }: Props = $props();

	// The ☕ editor's own draft, unlike the 🪫 one: a break has no task row to hang off
	// and no completion that opens it, so nothing outside this form gates on it.
	let draft = $state<{
		minutes: number | null;
		mindBefore: number | null;
		mindAfter: number | null;
		bodyBefore: number | null;
		bodyAfter: number | null;
	}>({
		minutes: null,
		mindBefore: null,
		mindAfter: null,
		bodyBefore: null,
		bodyAfter: null,
	});

	function save() {
		const minutes = Number(draft.minutes);
		const { mindBefore, mindAfter, bodyBefore, bodyAfter } = draft;

		if (!minutes || minutes <= 0) return;

		// An empty rating is not a rating of 0 — `Number(null)` is a finite 0. MATH.md
		// §8.9 reads the pair as a decay (`d_after = d_before · e^(−r·m·g)`), so a blank
		// "after" invents "the break left me at zero", which fits r → ∞ and drags the
		// estimate to its upper bound. 0 is legitimate, so the test is emptiness, not
		// falsiness. `required` on the fields is what makes the refusal visible.
		if (mindBefore === null || mindAfter === null || bodyBefore === null || bodyAfter === null)
			return;

		const rating = (value: number) => Math.min(10, Math.max(0, value));

		onsave({
			hours: minutes / 60,
			mindBefore: rating(mindBefore),
			mindAfter: rating(mindAfter),
			bodyBefore: rating(bodyBefore),
			bodyAfter: rating(bodyAfter),
		});
	}
</script>

<form
	class="mt-text-sm flex flex-wrap items-center gap-x-grid-xs gap-y-grid-2xs rounded-lg border border-info/20 bg-surface-page/40 px-box-xs py-box-2xs text-2xs text-ty-silent"
	onsubmit={(e) => (e.preventDefault(), save())}
>
	<label class="flex items-center gap-grid-2xs">
		{m.energy_rest_rested_label()}
		<!-- Always focuses: the ☕ button is the only way in, so the caret is always
		     asked for. Not `autofocus` — the document's autofocus-processed flag is set
		     at load, so the attribute is inert on any node inserted afterwards. -->
		<input
			type="number"
			min="1"
			max="480"
			placeholder={m.task_minutes_placeholder()}
			{@attach (node) => node.focus()}
			bind:value={draft.minutes}
			required
			class="w-14 rounded-sm border border-info/30 bg-input px-box-3xs py-text-3xs text-xs text-ty-primary outline-none focus:border-info/60"
		/>
	</label>
	<span class="flex items-center gap-grid-2xs">
		{m.energy_rest_before_label()}
		<label class="flex items-center gap-grid-2xs" title={m.energy_rest_mind_title()}>
			<span class="font-medium text-mind/80">{m.energy_drain_mind_label()}</span>
			<input
				type="number"
				min="0"
				max="10"
				step="1"
				bind:value={draft.mindBefore}
				required
				class={RATING_INPUT_CLASS.mind}
			/>
		</label>
		<label class="flex items-center gap-grid-2xs" title={m.energy_rest_body_title()}>
			<span class="font-medium text-body/80">{m.energy_drain_body_label()}</span>
			<input
				type="number"
				min="0"
				max="10"
				step="1"
				bind:value={draft.bodyBefore}
				required
				class={RATING_INPUT_CLASS.body}
			/>
		</label>
	</span>
	<span class="flex items-center gap-grid-2xs">
		{m.energy_rest_after_label()}
		<label class="flex items-center gap-grid-2xs" title={m.energy_rest_mind_title()}>
			<span class="font-medium text-mind/80">{m.energy_drain_mind_label()}</span>
			<input
				type="number"
				min="0"
				max="10"
				step="1"
				bind:value={draft.mindAfter}
				required
				class={RATING_INPUT_CLASS.mind}
			/>
		</label>
		<label class="flex items-center gap-grid-2xs" title={m.energy_rest_body_title()}>
			<span class="font-medium text-body/80">{m.energy_drain_body_label()}</span>
			<input
				type="number"
				min="0"
				max="10"
				step="1"
				bind:value={draft.bodyAfter}
				required
				class={RATING_INPUT_CLASS.body}
			/>
		</label>
	</span>
	<span class="ml-auto flex items-center gap-grid-2xs">
		<button type="submit" class="px-text-2xs text-info hover:text-info-strong">✓</button>
		<button
			type="button"
			class="px-text-2xs text-ty-silent hover:text-ty-secondary"
			onclick={oncancel}
		>
			✕
		</button>
	</span>
</form>
