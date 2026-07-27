<script lang="ts">
	// Test-only host: the store's $derived fields need a component context.
	import { DailyPlanStore } from '$lib/business/store/daily-plan-store.svelte';
	import {
		mockObservations,
		mockSession,
	} from '$lib/business/store/energy-lab-store.test-utils.svelte';
	import type { SessionStore } from '$lib/business/store/session-store.svelte';
	import type { EnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';

	let { onstore }: { onstore: (s: DailyPlanStore) => void } = $props();

	// Same reactive stand-ins the Lab's spec uses — this store reads both through
	// plain getters too.
	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onstore(
		new DailyPlanStore(
			mockSession as unknown as SessionStore,
			mockObservations as unknown as EnergyObservationStore,
		),
	);
</script>
