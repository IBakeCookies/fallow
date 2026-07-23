<script lang="ts">
	// Test-only host: the store needs a component context (onMount, $effect).
	import { setSessionStore, type SessionStore } from './session-store.svelte';

	let { onstore }: { onstore: (s: SessionStore) => void } = $props();

	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onstore(setSessionStore());
</script>
