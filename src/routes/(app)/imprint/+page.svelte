<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
</script>

<SeoHead title="{m.imprint_title()} — Fallow" description={m.imprint_ddg_heading()} />

<article
	class="max-w-2xl rounded-2xl border bg-surface-card p-box-md text-sm leading-relaxed text-ty-secondary backdrop-blur sm:p-box-xl shadow-card"
>
	<h1 class="text-2xl font-semibold text-ty-primary">{m.imprint_title()}</h1>

	<section class="mt-text-2xl">
		<h2 class="mb-text-xs text-base font-semibold text-ty-primary">{m.imprint_ddg_heading()}</h2>
		<p class="text-ty-secondary">Shadi Muma</p>
	</section>

	<section class="mt-text-2xl">
		<h2 class="mb-text-xs text-base font-semibold text-ty-primary">
			{m.imprint_contact_heading()}
		</h2>
		<p class="text-ty-secondary">
			<a
				href="mailto:muma.shadi@gmail.com"
				class="underline decoration-ty-ghost underline-offset-4 transition-colors hover:text-ty-primary"
			>
				muma.shadi@gmail.com
			</a>
		</p>
	</section>
</article>
