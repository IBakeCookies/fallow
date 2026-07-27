<script lang="ts">
	// Test-only host: the store's $derived fields need a component context.
	import { DailyPlanStore } from './daily-plan-store.svelte';
	import { mockObservations, mockSession } from './energy-lab-store.test-utils.svelte';
	import type { SessionStore } from './session-store.svelte';
	import type { EnergyObservationStore } from './energy-observation-store.svelte';

	let { onstore }: { onstore: (s: DailyPlanStore) => void } = $props();

	// Same reactive stand-ins the Lab's spec uses — this store reads both through
	// plain getters too.
	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onstore(
		new DailyPlanStore(
			mockSession as unknown as SessionStore,
			mockObservations as unknown as EnergyObservationStore
		)
	);
</script>
