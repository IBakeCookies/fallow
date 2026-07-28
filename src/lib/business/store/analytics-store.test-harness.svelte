<script lang="ts">
	// Test-only host: the store needs a component context (onMount, $derived).
	import { AnalyticsStore } from '$lib/business/store/analytics-store.svelte';

	let {
		onstore,
		onhistoryloadfailed = () => {},
	}: {
		onstore: (s: AnalyticsStore) => void;
		/** Stands in for the route's toast, so a spec can assert the store raised it. */
		onhistoryloadfailed?: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onstore(new AnalyticsStore(onhistoryloadfailed));
</script>
