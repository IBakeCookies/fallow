<script lang="ts">
	// Test-only host: the store is constructed inside a component tree like every other.
	import { SessionTimerStore } from '$lib/business/store/session-timer-store.svelte';
	import type { SessionTimer } from '$lib/business/utils/session-timer';

	let {
		onstore,
		stored,
		persist,
	}: {
		onstore: (store: SessionTimerStore) => void;
		stored: SessionTimer | null;
		persist: (timer: SessionTimer | null) => void;
	} = $props();

	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onstore(new SessionTimerStore(stored, persist));
</script>
