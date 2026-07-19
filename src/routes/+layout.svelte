<script lang="ts">
	import type { Pathname } from '$app/types';
	import { dev, browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import { activeLocale } from '$lib/presentation/utils/locale.svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	injectAnalytics({ mode: dev ? 'development' : 'production' });
	injectSpeedInsights();

	// Reload-free language switching: setLocale() runs with reload:false, so
	// keep <html lang> in sync ourselves.
	$effect(() => {
		if (browser) document.documentElement.lang = activeLocale.value;
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<!-- Keyed on the locale so a language switch re-renders the app in place
     (m.*() messages resolve at render time) instead of reloading the page -->
{#key activeLocale.value}
	{@render children()}
{/key}

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={resolve(localizeHref(page.url.pathname, { locale }) as Pathname)}>
			{locale}
		</a>
	{/each}
</div>
