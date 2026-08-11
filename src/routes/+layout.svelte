<script lang="ts">
	import type { LayoutProps } from './$types';
	import '$lib/presentation/style/app.css';
	import { dev, browser } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { activeLocale } from '$lib/presentation/utils/locale.svelte';
	import { readClientAppearance } from '$lib/business/appearance';
	import { setThemeStore } from '$lib/business/store/theme-store.svelte';
	import { onMount } from 'svelte';
	import { sceneryStyle } from '$lib/presentation/utils/scenery-seed';
	import { dataSceneryStyle, nowInTimeZone } from '$lib/presentation/utils/scenery-time';

	let { children, data }: LayoutProps = $props();

	// Outside the {#key} below: a language switch recreates that subtree, and a
	// store owned by it would reset to the load-time cookie snapshot.
	// svelte-ignore state_referenced_locally
	const themeStore = setThemeStore(data.appearance, readClientAppearance());

	// The /_vercel/* scripts 404 anywhere but Vercel (e2e preview), and in dev
	// both inject a remote `script.debug.js` that measures nothing locally.
	// svelte-ignore state_referenced_locally
	if (!dev && data.isVercel) {
		injectAnalytics();
		injectSpeedInsights();
	}

	// Hydration never re-patches the SSR'd style attribute, so the mount below
	// re-derives from the client's real clock; a change after that does update it.
	// svelte-ignore state_referenced_locally
	let sceneryNow = $state(nowInTimeZone(data.timezone));

	onMount(() => {
		sceneryNow = nowInTimeZone();
		const id = setInterval(() => (sceneryNow = nowInTimeZone()), 60_000);

		return () => clearInterval(id);
	});

	// Two deriveds, not one expression in the style attribute: that re-runs the
	// whole seeded var table and both its SVG generators on every minute tick.
	const seedStyle = $derived(sceneryStyle(themeStore.scenerySeed));
	const clockStyle = $derived(dataSceneryStyle(sceneryNow));

	// A language switch is a client-side goto(), so the SSR'd <html lang> would
	// otherwise keep claiming the language the page was loaded in.
	$effect(() => {
		if (browser) document.documentElement.lang = activeLocale.value;
	});
</script>

<!-- Empty by design: display:none until a theme styles these helpers in
     style/scenery/. -->
<div class="theme-scenery" aria-hidden="true" style="{seedStyle}; {clockStyle}">
	<div class="theme-helper-1"></div>
	<div class="theme-helper-2"></div>
	<div class="theme-helper-3"></div>
	<div class="theme-helper-4"></div>
</div>
<!-- Keyed on the locale so a language switch re-renders the app in place
     (m.*() messages resolve at render time) instead of reloading the page -->
{#key activeLocale.value}
	{@render children()}
{/key}
