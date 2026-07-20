<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';

	// § 5 DDG requires the imprint (and by extension the privacy policy) to be
	// easily recognizable and directly reachable from every page — hence a
	// footer in the shared layout rather than links on individual pages.
	const links = [
		{ href: resolve('/imprint'), label: () => m.footer_imprint() },
		{ href: resolve('/privacy'), label: () => m.footer_privacy() },
		{ href: 'https://ko-fi.com/ibakecookies', label: () => m.footer_coffee(), external: true }
	];
</script>

<footer class="mt-auto pt-page pb-1 text-xs text-ty-silent">
	<div
		class="flex w-max items-center gap-text-md rounded-xl border bg-surface-card px-3 py-1.5 backdrop-blur"
	>
		{#each links as link (link.href)}
			<!-- internal hrefs are resolve()d in the links array; the rule can't trace through it -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a
				href={link.href}
				target={link.external ? '_blank' : undefined}
				rel={link.external ? 'noopener' : undefined}
				class="transition-colors hover:text-ty-secondary">{link.label()}</a
			>
		{/each}
	</div>
</footer>
