<script lang="ts">
	// Test-only host: the store needs a component context (onMount, $effect).
	import { CalendarStore } from '$lib/business/store/calendar-store.svelte';

	let {
		onstore,
		start,
		end,
		onloadfailed = () => {},
	}: {
		onstore: (s: CalendarStore) => void;
		start: string;
		end: string;
		/** Stands in for the route's toast, so a spec can assert the store raised it. */
		onloadfailed?: () => void;
	} = $props();

	// The thunk is what a range step arrives through: `rerender` moves the props
	// and the store's own effect re-reads them, exactly as the page's grid does.
	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onstore(new CalendarStore(() => [start, end] as const, onloadfailed));
</script>
