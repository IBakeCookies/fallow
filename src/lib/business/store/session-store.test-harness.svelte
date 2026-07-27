<script lang="ts">
	// Test-only host: the store needs a component context (onMount, $effect).
	import { setSessionStore, type SessionStore } from '$lib/business/store/session-store.svelte';
	import { mockPage } from '$lib/business/store/session-store.test-utils.svelte';

	let { onstore }: { onstore: (s: SessionStore) => void } = $props();

	// The store takes its date reader as an argument, so driving navigation in a
	// test is a plain reactive object — no $app/state module mock needed.
	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onstore(setSessionStore(() => mockPage.url.searchParams.get('date')));
</script>
