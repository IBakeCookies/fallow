<script lang="ts">
	// Test-only host: the store needs a component context (onMount, $effect).
	import { setSessionStore, type SessionStore } from '$lib/business/store/session-store.svelte';
	import {
		setStorageStatusStore,
		type StorageStatusStore,
	} from '$lib/business/store/storage-status.svelte';
	import { mockPage } from '$lib/business/store/session-store.test-utils.svelte';

	let {
		onstore,
		onstatus = () => {},
	}: {
		onstore: (s: SessionStore) => void;
		/** The banner store the session reports into — the spec asserts on it. */
		onstatus?: (s: StorageStatusStore) => void;
	} = $props();

	// The real store is the real one: the status store is the app's, not a stub,
	// because "which store raised the banner" is the thing under test.
	const status = setStorageStatusStore();

	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onstatus(status);

	// The store takes its date reader as an argument, so driving navigation in a
	// test is a plain reactive object — no $app/state module mock needed.
	// svelte-ignore state_referenced_locally -- deliberate one-shot handoff
	onstore(setSessionStore(() => mockPage.url.searchParams.get('date'), status));
</script>
