<script lang="ts">
	// Test-only host: the store needs a component context ($effect), and unmounting
	// this host is leaving `/energy`.
	import { EnergyPlanStore } from '$lib/business/store/energy-plan-store.svelte';
	import {
		mockObservations,
		mockSession,
	} from '$lib/business/store/layout-store-mock.test-utils.svelte';
	import type { EnergyLabStore } from '$lib/business/store/energy-lab-store.svelte';
	import type { SessionStore } from '$lib/business/store/session-store.svelte';
	import type { EnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';

	let {
		lab,
		onstore,
	}: {
		/** The layout's store, which outlives every visit. */
		lab: EnergyLabStore;
		onstore: (s: EnergyPlanStore) => void;
	} = $props();

	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onstore(
		new EnergyPlanStore(
			mockSession as unknown as SessionStore,
			mockObservations as unknown as EnergyObservationStore,
			lab,
		),
	);
</script>
