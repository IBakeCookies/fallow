<script lang="ts">
	/* One reading on the analytics grid: a quiet label, the number, and a note line
	   under it.

	   `note` is a snippet rather than a string because one of the readings is
	   markup — the completion-rate delta colours its own sign — and a string prop
	   would have forced either `{@html}` or a second "note colour" prop. */

	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		/** The reading itself, already formatted in the reader's locale */
		value: string | number;
		/** Denominator or unit, set smaller beside the value ("/ 30", "h") */
		suffix?: string;
		/** There is no reading — the value is a placeholder, so it is not ink-loud */
		muted?: boolean;
		note: Snippet;
	}

	let { label, value, suffix, muted = false, note }: Props = $props();
</script>

<div class="card-shell rounded-xl p-box-md">
	<p class="text-xs text-ty-silent">{label}</p>
	<p class="mt-text-2xs text-2xl font-semibold {muted ? 'text-ty-silent' : 'text-ty-primary'}">
		{value}
		{#if suffix}
			<span class="text-base font-normal text-ty-silent">{suffix}</span>
		{/if}
	</p>
	<p class="mt-text-3xs text-xs text-ty-silent">{@render note()}</p>
</div>
