<script lang="ts">
	// Test-only host: the writer registers onDestroy and an $effect, so it can
	// only be built inside component initialisation — the same constraint that
	// makes a store impossible to create in a `+page.ts` load.
	import {
		createDebouncedWrite,
		type DebouncedWrite,
	} from '$lib/business/store/debounced-write.svelte';

	let {
		onwriter,
		write,
		onerror,
		delayMs,
	}: {
		onwriter: (w: DebouncedWrite<string>) => void;
		write: (payload: string) => Promise<void>;
		onerror: (error: unknown, payload: string) => void;
		delayMs?: number;
	} = $props();

	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onwriter(createDebouncedWrite(write, onerror, delayMs));
</script>
