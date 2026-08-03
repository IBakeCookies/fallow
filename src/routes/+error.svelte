<script lang="ts">
	import type { Pathname } from '$app/types';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages.js';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head><title>{page.status} — Fallow</title></svelte:head>

<main class="flex min-h-screen items-center justify-center px-box-md text-ty-secondary antialiased">
	<div class="card-shell w-full max-w-md p-box-md text-center sm:p-box-xl">
		<p class="text-5xl font-semibold text-ty-ghost">{page.status}</p>
		<h1 class="mt-text-md text-2xl font-semibold text-ty-primary">
			{notFound ? m.error_404_title() : m.error_title()}
		</h1>
		<p class="mt-text-xs text-sm leading-relaxed">
			{notFound ? m.error_404_body() : m.error_body()}
		</p>
		<div class="mt-text-xl flex flex-wrap justify-center gap-grid-sm">
			{#if !notFound}
				<button
					onclick={() => location.reload()}
					class="rounded-xl border bg-surface-card px-box-sm py-box-2xs text-sm backdrop-blur transition-colors hover:bg-surface-hover hover:text-ty-primary"
				>
					{m.error_reload()}
				</button>
			{/if}
			<a
				href={resolve(localizeHref('/') as Pathname)}
				class="rounded-xl border bg-surface-card px-box-sm py-box-2xs text-sm backdrop-blur transition-colors hover:bg-surface-hover hover:text-ty-primary"
			>
				{m.error_home()}
			</a>
		</div>
	</div>
</main>
