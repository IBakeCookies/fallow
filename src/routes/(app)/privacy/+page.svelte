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

<svelte:head><title>{m.privacy_title()} — Fallow</title></svelte:head>

<article
	class="max-w-2xl rounded-2xl border bg-surface-card p-box-md text-sm leading-relaxed text-ty-secondary backdrop-blur sm:p-box-xl"
>
	<header>
		<h1 class="text-2xl font-semibold text-ty-primary">{m.privacy_title()}</h1>
		<p class="mt-text-2xs text-xs text-ty-silent">{m.privacy_updated({ date: updated })}</p>
	</header>

	<section class="mt-text-2xl">
		<h2 class="mb-text-xs text-base font-semibold text-ty-primary">
			{m.privacy_controller_heading()}
		</h2>
		<p>{m.privacy_controller_body()}</p>
		<p class="mt-text-xs text-ty-secondary">
			Shadi Muma<br />
			muma.shadi@gmail.com
		</p>
	</section>

	{#each sections as section (section.heading)}
		<section class="mt-text-2xl">
			<h2 class="mb-text-xs text-base font-semibold text-ty-primary">{section.heading()}</h2>
			<p>{section.body()}</p>
		</section>
	{/each}
</article>
