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
	const REPO_URL = 'https://github.com/IBakeCookies/fallow';
	const KOFI_URL = 'https://ko-fi.com/ibakecookies';

	const faqs: { q: string; a: string; tail?: { pre: string; label: string; href: string } }[] = [
		{
			q: m.about_faq_q1(),
			a: m.about_faq_a1(),
			tail: {
				pre: m.about_faq_a1_support(),
				label: m.about_faq_a1_support_link(),
				href: KOFI_URL
			}
		},
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
			acceptedAnswer: {
				'@type': 'Answer',
				text: f.tail ? `${f.a} ${f.tail.pre}${f.tail.label}.` : f.a
			}
		}))
	};

	const linkClass = 'underline decoration-ty-ghost underline-offset-2 hover:text-ty-primary';
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- own message strings, JSON-encoded with "<" escaped -->
	{@html jsonLdScript(faqSchema)}
</svelte:head>

<section
	class="mt-16 space-y-10 rounded-2xl border bg-surface-card p-box-md text-ty-secondary backdrop-blur sm:p-box-xl shadow-card"
>
	<div class="max-w-3xl space-y-3">
		<h2 class="text-xl font-bold text-ty-primary">{m.about_hook_title()}</h2>
		<p class="text-sm leading-relaxed">{m.about_hook_body()}</p>
	</div>

	<div class="grid gap-8 md:grid-cols-2">
		<div class="space-y-3">
			<h3 class="text-lg font-semibold text-ty-primary">{m.about_how_title()}</h3>
			<p class="text-sm leading-relaxed">{m.about_how_body_1()}</p>
			<p class="rounded-lg border bg-surface-card px-4 py-3 font-mono text-sm text-ty-secondary">
				p(t) = (a·k·t + p₀) · e^(−kt)
			</p>
			<p class="text-sm leading-relaxed">{m.about_how_body_2()}</p>
		</div>

		<div class="space-y-3">
			<h3 class="text-lg font-semibold text-ty-primary">{m.about_different_title()}</h3>
			<p class="text-sm leading-relaxed">{m.about_different_body_1()}</p>
			<p class="text-sm leading-relaxed">
				{m.about_different_body_2()}
				{m.about_energy_pre()}<a class={linkClass} href={resolve('/energy')}>{m.nav_energy_lab()}</a
				>{m.about_energy_post()}
			</p>
		</div>
	</div>

	<div class="max-w-3xl space-y-grid-md">
		<h3 class="text-lg font-semibold text-ty-primary">{m.about_faq_title()}</h3>
		{#each faqs as faq (faq.q)}
			<div class="space-y-1">
				<h4 class="text-sm font-semibold text-ty-secondary">{faq.q}</h4>
				<p class="text-sm leading-relaxed">
					{faq.a}
					<!-- the only tail href is the external KOFI_URL constant; resolve() is for internal routes -->
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					{#if faq.tail}{faq.tail.pre}<a
							href={faq.tail.href}
							class={linkClass}
							target="_blank"
							rel="noopener">{faq.tail.label}</a
						>.{/if}
				</p>
			</div>
		{/each}

		<p class="text-xs text-ty-silent">
			<a class={linkClass} href={ARTICLE_URL} target="_blank" rel="noopener"
				>{m.about_link_article()}</a
			>
			·
			<a class={linkClass} href={REPO_URL} target="_blank" rel="noopener">{m.about_link_github()}</a
			>
		</p>
	</div>
</section>
