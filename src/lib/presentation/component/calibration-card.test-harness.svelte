<script lang="ts">
	import CalibrationCard from '$lib/presentation/component/calibration-card.svelte';

	/* The card takes two snippets, and `render()` cannot pass one — so the spec drives
	   it through here, with plain strings standing in for the bodies. */

	interface Props {
		title: string;
		hint: string;
		body?: string;
		action?: string;
	}

	let { title, hint, body = 'the fit', action }: Props = $props();
</script>

<CalibrationCard {title} {hint} action={action ? actionButton : undefined}>
	<p>{body}</p>
</CalibrationCard>

{#snippet actionButton()}
	<button type="button">{action}</button>
{/snippet}
