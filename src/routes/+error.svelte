<script lang="ts">
	import type { Pathname } from '$app/types';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages.js';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head><title>{page.status} — Fallow</title></svelte:head>

<main class="flex min-h-screen items-center justify-center px-4 text-ty-secondary antialiased">
	<div
		class="w-full max-w-md rounded-2xl border bg-surface-card p-box-md text-center backdrop-blur sm:p-box-xl"
	>
		<p class="text-5xl font-semibold text-ty-ghost">{page.status}</p>
		<h1 class="mt-4 text-2xl font-semibold text-ty-primary">
			{notFound ? m.error_404_title() : m.error_title()}
		</h1>
		<p class="mt-2 text-sm leading-relaxed">
			{notFound ? m.error_404_body() : m.error_body()}
		</p>
		<div class="mt-6 flex flex-wrap justify-center gap-3">
			{#if !notFound}
				<button
					onclick={() => location.reload()}
					class="rounded-xl border bg-surface-card px-3 py-2 text-sm backdrop-blur transition-colors hover:bg-surface-hover hover:text-ty-primary"
				>
					{m.error_reload()}
				</button>
			{/if}
			<a
				href={resolve(localizeHref('/') as Pathname)}
				class="rounded-xl border bg-surface-card px-3 py-2 text-sm backdrop-blur transition-colors hover:bg-surface-hover hover:text-ty-primary"
			>
				{m.error_home()}
			</a>
		</div>
	</div>
</main>
