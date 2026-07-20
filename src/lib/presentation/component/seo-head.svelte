<!-- Central <head> block for every page: title, description, canonical,
     Open Graph, Twitter card, and optional JSON-LD structured data.
     Canonical/og URLs prefer PUBLIC_SITE_URL so preview deployments and
     *.vercel.app aliases point Google at the production domain. -->
<script lang="ts">
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale, locales } from '$lib/paraglide/runtime';
	import { jsonLdScript } from '$lib/presentation/utils/json-ld';

	interface Props {
		title: string;
		description: string;
		jsonLd?: Record<string, unknown>;
	}

	let { title, description, jsonLd }: Props = $props();

	const OG_LOCALES: Record<string, string> = { en: 'en_US', de: 'de_DE' };

	const origin = $derived((env.PUBLIC_SITE_URL ?? page.url.origin).replace(/\/$/, ''));
	const canonical = $derived(origin + page.url.pathname);
	const ogImage = $derived(origin + '/fallow-daily-time-allocation.png');
	const ogLocale = $derived(OG_LOCALES[getLocale()] ?? 'en_US');

	const jsonLdTag = $derived(jsonLd ? jsonLdScript(jsonLd) : null);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta name="theme-color" content="#000000" />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={m.app_name()} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:locale" content={ogLocale} />
	{#each locales.filter((l) => l !== getLocale()) as locale (locale)}
		<meta property="og:locale:alternate" content={OG_LOCALES[locale] ?? locale} />
	{/each}
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={m.seo_image_alt()} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImage} />
	<meta name="twitter:image:alt" content={m.seo_image_alt()} />

	{#if jsonLdTag}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- own message strings, JSON-encoded with "<" escaped -->
		{@html jsonLdTag}
	{/if}
</svelte:head>
