<script lang="ts">
	// Test-only host: the store needs a component context (onMount).
	import {
		EnergyObservationStore,
		type ReadTasks,
	} from '$lib/business/store/energy-observation-store.svelte';
	import type { StorageStatusStore } from '$lib/business/store/storage-status.svelte';

	let {
		onstore,
		readTasks,
		status,
	}: {
		onstore: (s: EnergyObservationStore) => void;
		readTasks: ReadTasks;
		/** The real banner store — the spec reads `error` off it. */
		status: StorageStatusStore;
	} = $props();

	// Both dependencies are injected, so a spec drives the store with a plain
	// function and a real status store — no session store and no module mocks.
	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onstore(new EnergyObservationStore(readTasks, status));
</script>
