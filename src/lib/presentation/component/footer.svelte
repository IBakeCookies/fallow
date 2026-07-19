<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	// § 5 DDG requires the imprint (and by extension the privacy policy) to be
	// easily recognizable and directly reachable from every page — hence a
	// footer in the shared layout rather than links on individual pages.
	const links = [
		{ href: '/imprint', label: () => m.footer_imprint() },
		{ href: '/privacy', label: () => m.footer_privacy() }
	];
</script>

<footer class="mt-auto pt-8 pb-1 text-xs text-ty-silent">
	<div
		class="flex w-max items-center gap-4 rounded-xl border bg-surface-card px-3 py-1.5 backdrop-blur"
	>
		{#each links as link (link.href)}
			<a href={link.href} class="transition-colors hover:text-ty-secondary">{link.label()}</a>
		{/each}
	</div>
</footer>
