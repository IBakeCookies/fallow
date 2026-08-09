<!-- Central <head> block for every page: title, description, canonical,
     hreflang alternates, Open Graph, Twitter card, and optional JSON-LD.
     Canonical/og URLs prefer PUBLIC_SITE_URL so preview deployments and
     *.vercel.app aliases point Google at the production domain. -->
<script lang="ts">
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import * as m from '$lib/paraglide/messages.js';
	import {
		baseLocale,
		deLocalizeHref,
		getLocale,
		locales,
		localizeHref,
	} from '$lib/paraglide/runtime';
	import { jsonLdScript } from '$lib/presentation/utils/json-ld';

	interface Props {
		title: string;
		description: string;
		jsonLd?: Record<string, unknown>;
	}

	let { title, description, jsonLd }: Props = $props();

	const OG_LOCALES: Record<string, string> = {
		en: 'en_US',
		de: 'de_DE',
		es: 'es_ES',
		fr: 'fr_FR',
		zh: 'zh_CN',
	};

	const origin = $derived((env.PUBLIC_SITE_URL ?? page.url.origin).replace(/\/$/, ''));

	// Every locale is indexable (`/…` English, `/de/…`, `/es/…`, `/fr/…`, `/zh/…`), so each page
	// declares its own URL as canonical and every sibling as an alternate.
	// Without the pair they compete as duplicate content.
	const basePath = $derived(deLocalizeHref(page.url.pathname));
	const alternates = $derived(
		Object.fromEntries(
			locales.map((locale) => [
				locale,
				origin +
					localizeHref(basePath, {
						locale,
					}),
			]),
		),
	);
	const canonical = $derived(alternates[getLocale()]);
	const ogImage = $derived(`${origin}/fallow-daily-time-allocation.png`);
	const ogLocale = $derived(OG_LOCALES[getLocale()] ?? 'en_US');

	const jsonLdTag = $derived(jsonLd ? jsonLdScript(jsonLd) : null);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	{#each locales as locale (locale)}
		<link rel="alternate" hreflang={locale} href={alternates[locale]} />
	{/each}
	<!-- the base locale is the unprefixed URL, so it is also the fallback -->
	<link rel="alternate" hreflang="x-default" href={alternates[baseLocale]} />

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
