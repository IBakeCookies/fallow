<script lang="ts">
	// Test-only host: the store needs a component context (onMount, $effect).
	import { EnergyLabStore } from '$lib/business/store/energy-lab-store.svelte';
	import {
		mockObservations,
		mockSession,
	} from '$lib/business/store/energy-lab-store.test-utils.svelte';
	import type { SessionStore } from '$lib/business/store/session-store.svelte';
	import type { EnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';

	let { onstore }: { onstore: (s: EnergyLabStore) => void } = $props();

	// The Lab reads both stores through plain getters, so reactive stand-ins are
	// enough — and keep six repository mocks out of this spec.
	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onstore(
		new EnergyLabStore(
			mockSession as unknown as SessionStore,
			mockObservations as unknown as EnergyObservationStore,
		),
	);
</script>
