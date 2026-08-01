<script lang="ts">
	// Test-only host: the store needs a component context (onMount, $effect).
	import { ThemeStore } from '$lib/business/store/theme-store.svelte';
	import type { ThemeName } from '$lib/business/model/theme';

	let {
		onstore,
		initialTheme,
		initialScenerySeed,
		initialSceneryPaused,
	}: {
		onstore: (store: ThemeStore) => void;
		initialTheme?: ThemeName;
		initialScenerySeed?: number;
		initialSceneryPaused?: boolean;
	} = $props();

	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onstore(new ThemeStore(initialTheme, initialScenerySeed ?? 0, initialSceneryPaused));
</script>
