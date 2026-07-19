<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getDateLocale } from '$lib/presentation/utils/locale.svelte';

	// Bump this date whenever the policy's content changes.
	const updated = new Date('2026-07-19T12:00:00').toLocaleDateString(getDateLocale(), {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});

	// One entry per processing activity. The order is deliberate: the
	// local-first story leads (it is the app's actual privacy posture), then
	// the three server-side processings, then transfers and rights.
	const sections = [
		{ heading: m.privacy_local_heading, body: m.privacy_local_body },
		{ heading: m.privacy_hosting_heading, body: m.privacy_hosting_body },
		{ heading: m.privacy_analytics_heading, body: m.privacy_analytics_body },
		{ heading: m.privacy_speed_heading, body: m.privacy_speed_body },
		{ heading: m.privacy_transfer_heading, body: m.privacy_transfer_body },
		{ heading: m.privacy_rights_heading, body: m.privacy_rights_body }
	];
</script>

<svelte:head><title>{m.privacy_title()} — Zenith</title></svelte:head>

<article class="max-w-2xl text-sm leading-relaxed text-zinc-400">
	<header>
		<h1 class="text-2xl font-semibold text-zinc-100">{m.privacy_title()}</h1>
		<p class="mt-1 text-xs text-zinc-500">{m.privacy_updated({ date: updated })}</p>
	</header>

	<section class="mt-8">
		<h2 class="mb-2 text-base font-semibold text-zinc-200">{m.privacy_controller_heading()}</h2>
		<p>{m.privacy_controller_body()}</p>
		<!-- TODO: replace the placeholders below with your real name and address
		     before going live (must match the imprint). -->
		<p class="mt-2 text-zinc-300">
			Shadi Muma<br />
			
			
			muma.shadi@gmail.com
		</p>
	</section>

	{#each sections as section (section.heading)}
		<section class="mt-8">
			<h2 class="mb-2 text-base font-semibold text-zinc-200">{section.heading()}</h2>
			<p>{section.body()}</p>
		</section>
	{/each}
</article>
