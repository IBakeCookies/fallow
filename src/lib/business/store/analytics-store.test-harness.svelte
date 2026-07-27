<script lang="ts">
	// Test-only host: the store needs a component context (onMount, $derived).
	import { AnalyticsStore } from './analytics-store.svelte';

	let { onstore }: { onstore: (s: AnalyticsStore) => void } = $props();

	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onstore(new AnalyticsStore());
</script>
