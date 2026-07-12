<script lang="ts">
	import { page } from '$app/state';
	import Nav from '$lib/presentation/component/nav.svelte';
	import { setSessionStore } from '$lib/business/store/session-store.svelte';

	let { children } = $props();

	// The shared daily session (tasks, budget, pools + persistence) lives in
	// context, created per component tree — never at module scope, so nothing
	// can leak across SSR requests. Pages grab it with getSessionStore().
	setSessionStore();

	// Calendar is the one full-viewport page: it must never scroll, so its grid
	// rows split the leftover height instead of growing the page.
	const fullViewport = $derived(page.route.id?.endsWith('/calendar') ?? false);
</script>

<main
	class="bg-black/70 text-zinc-300 antialiased selection:bg-emerald-500/30 selection:text-emerald-200 font-sans
	       {fullViewport ? 'flex h-dvh flex-col overflow-hidden' : 'min-h-screen'}"
>
	<div class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex min-h-0 flex-1 flex-col">
		<Nav />
		{@render children()}
	</div>
</main>
