<!-- Below-the-fold explainer on the home page. This is the page's crawlable
     content: the app UI above is stateful and mostly meaningless to a search
     engine, so the pitch, model explanation, and FAQ (mirrored as FAQPage
     structured data) live here, always server-rendered. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { jsonLdScript } from '$lib/presentation/utils/json-ld';

	const ARTICLE_URL =
		'https://thequantasticjournal.com/how-to-over-engineer-a-todo-app-the-zenith-gradient-algorithm-67712737135e';
	const REPO_URL = 'https://github.com/IBakeCookies/Zenith';

	const faqs = [
		{ q: m.about_faq_q1(), a: m.about_faq_a1() },
		{ q: m.about_faq_q2(), a: m.about_faq_a2() },
		{ q: m.about_faq_q3(), a: m.about_faq_a3() }
	];

	// Must mirror the visible FAQ text 1:1 — Google cross-checks the schema
	// against the rendered page.
	const faqSchema = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faqs.map((f) => ({
			'@type': 'Question',
			name: f.q,
			acceptedAnswer: { '@type': 'Answer', text: f.a }
		}))
	};

	const linkClass = 'underline decoration-white/30 underline-offset-2 hover:text-zinc-200';
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- own message strings, JSON-encoded with "<" escaped -->
	{@html jsonLdScript(faqSchema)}
</svelte:head>

<section class="mt-16 space-y-10 border-t border-white/10 pt-12 text-zinc-400">
	<div class="max-w-3xl space-y-3">
		<h2 class="text-xl font-bold text-zinc-100">{m.about_hook_title()}</h2>
		<p class="text-sm leading-relaxed">{m.about_hook_body()}</p>
	</div>

	<div class="grid gap-8 md:grid-cols-2">
		<div class="space-y-3">
			<h3 class="text-lg font-semibold text-zinc-200">{m.about_how_title()}</h3>
			<p class="text-sm leading-relaxed">{m.about_how_body_1()}</p>
			<p
				class="rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-zinc-300"
			>
				p(t) = (a·k·t + p₀) · e^(−kt)
			</p>
			<p class="text-sm leading-relaxed">{m.about_how_body_2()}</p>
		</div>

		<div class="space-y-3">
			<h3 class="text-lg font-semibold text-zinc-200">{m.about_different_title()}</h3>
			<p class="text-sm leading-relaxed">{m.about_different_body_1()}</p>
			<p class="text-sm leading-relaxed">
				{m.about_different_body_2()}
				{m.about_energy_pre()}<a class={linkClass} href={resolve('/energy')}
					>{m.nav_energy_lab()}</a
				>{m.about_energy_post()}
			</p>
		</div>
	</div>

	<div class="max-w-3xl space-y-4">
		<h3 class="text-lg font-semibold text-zinc-200">{m.about_faq_title()}</h3>
		{#each faqs as faq (faq.q)}
			<div class="space-y-1">
				<h4 class="text-sm font-semibold text-zinc-300">{faq.q}</h4>
				<p class="text-sm leading-relaxed">{faq.a}</p>
			</div>
		{/each}

		<p class="text-xs text-zinc-500">
			<a class={linkClass} href={ARTICLE_URL} target="_blank" rel="noopener"
				>{m.about_link_article()}</a
			>
			·
			<a class={linkClass} href={REPO_URL} target="_blank" rel="noopener">{m.about_link_github()}</a
			>
		</p>
	</div>
</section>
