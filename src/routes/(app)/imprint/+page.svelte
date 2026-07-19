<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
</script>

<svelte:head><title>{m.imprint_title()} — Zenith</title></svelte:head>

<article class="max-w-2xl text-sm leading-relaxed text-zinc-400">
	<h1 class="text-2xl font-semibold text-zinc-100">{m.imprint_title()}</h1>

	<section class="mt-8">
		<h2 class="mb-2 text-base font-semibold text-zinc-200">{m.imprint_ddg_heading()}</h2>
		<!-- TODO: replace the placeholders below with your real name and address
		     before going live — an imprint with placeholders does not satisfy
		     § 5 DDG. -->
		<p class="text-zinc-300">
			Shadi Muma<br />
			
			
			Deutschland
		</p>
	</section>

	<section class="mt-8">
		<h2 class="mb-2 text-base font-semibold text-zinc-200">{m.imprint_contact_heading()}</h2>
		<p class="text-zinc-300">
			<a
				href="mailto:muma.shadi@gmail.com"
				class="underline decoration-zinc-700 underline-offset-4 transition-colors hover:text-zinc-100"
			>
				muma.shadi@gmail.com
			</a>
		</p>
	</section>
</article>
