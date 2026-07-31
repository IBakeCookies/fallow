<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	/* One fitted constant against the parameter it would replace: α cognitive, α
	   physical, the recovery rate, the stopping value. Four copies of the same row,
	   differing only in which capacity's ink the number takes. */

	const TONE_CLASS = {
		mind: 'text-mind-strong',
		body: 'text-body/90',
		info: 'text-info-strong',
	} as const;

	interface Props {
		/** The parameter this fit is for, in the model's own words */
		label: string;
		/** The fit, already formatted — including its ± and its n. Null when the logs
		 *  carry no signal for it: a fit that failed is not a fit of zero. */
		value: string | null;
		tone: keyof typeof TONE_CLASS;
	}

	let { label, value, tone }: Props = $props();
</script>

<div class="flex items-baseline justify-between gap-text-xs text-xs">
	<span class="text-ty-silent">{label}</span>
	{#if value === null}
		<span class="text-ty-silent">{m.energy_fit_no_signal()}</span>
	{:else}
		<span class="tabular-nums {TONE_CLASS[tone]}">{value}</span>
	{/if}
</div>
