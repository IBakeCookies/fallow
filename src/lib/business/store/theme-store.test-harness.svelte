<script lang="ts">
	// Test-only host: the store needs a component context (onMount, $effect).
	import { ThemeStore } from '$lib/business/store/theme-store.svelte';
	import type { AppearanceSnapshot } from '$lib/business/appearance';

	let {
		onstore,
		ssr,
		cookies,
	}: {
		onstore: (store: ThemeStore) => void;
		ssr: AppearanceSnapshot;
		cookies: AppearanceSnapshot;
	} = $props();

	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onstore(new ThemeStore(ssr, cookies));
</script>
