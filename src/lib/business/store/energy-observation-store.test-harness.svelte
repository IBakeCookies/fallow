<script lang="ts">
	// Test-only host: the store needs a component context (onMount).
	import {
		EnergyObservationStore,
		type ReadTasks,
		type ReportStorageError,
	} from '$lib/business/store/energy-observation-store.svelte';

	let {
		onstore,
		readTasks,
		reportStorageError,
	}: {
		onstore: (s: EnergyObservationStore) => void;
		readTasks: ReadTasks;
		reportStorageError: ReportStorageError;
	} = $props();

	// Both dependencies are injected, so a spec drives the store with two plain
	// functions — no session store and no module mocks.
	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onstore(new EnergyObservationStore(readTasks, reportStorageError));
</script>
