<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	/* No component: these stories exist to look at a whole theme. The page
	   background is bg-fixed and the scenery layers are position:fixed, so
	   neither reads correctly inside the few hundred pixels a component story
	   occupies — they need height, and the toolbar's theme picker does the rest.

	   Deliberately NOT in style/: Tailwind's auto source detection skips the
	   directory holding the CSS entry point, so a class only used there (the
	   fixed height below) is never generated. */
	const { Story } = defineMeta({
		title: 'Theme',
		parameters: { layout: 'fullscreen' }
	});

	/* Literal class strings — Tailwind's scanner is textual, so anything
	   assembled at runtime would not exist. */
	const surfaces = [
		'bg-surface-page',
		'bg-surface-card',
		'bg-surface-inset',
		'bg-surface-hover',
		'bg-input'
	];
	/* Each fill with its paired ink, so the "Aa" doubles as the legibility check
	   the ink tokens exist for — they are derived from the fill, so a theme that
	   swaps a fill silently changes these and this row is where it shows. */
	const states = [
		['bg-brand', 'text-brand-ink'],
		['bg-success', 'text-success-ink'],
		['bg-warning', 'text-warning-ink'],
		['bg-danger', 'text-danger-ink'],
		['bg-info', 'text-info-ink'],
		['bg-mind', 'text-mind-ink'],
		['bg-body', 'text-body-ink'],
		['bg-flow', 'text-flow-ink'],
		['bg-mixed', 'text-mixed-ink']
	];
	const textTones = ['text-ty-primary', 'text-ty-secondary', 'text-ty-silent', 'text-ty-ghost'];
	const series = [
		'bg-series-1',
		'bg-series-2',
		'bg-series-3',
		'bg-series-4',
		'bg-series-5',
		'bg-series-6',
		'bg-series-7',
		'bg-series-8',
		'bg-series-rest'
	];
</script>

<!-- Two viewports tall, so a gradient, a bg-fixed image and a drifting scenery
     layer are all judgeable — and so scrolling shows they stay put. -->
<Story name="Background">
	{#snippet template()}
		<div class="flex h-[100rem] flex-col justify-between p-page">
			<p class="text-sm text-ty-secondary">
				Top of 100rem. Switch themes in the toolbar; the background and the scenery are fixed, so
				scrolling should not move them.
			</p>
			<p class="text-sm text-ty-silent">Bottom of 100rem.</p>
		</div>
	{/snippet}
</Story>

<Story name="Swatches" asChild>
	<div class="flex min-h-screen flex-col gap-section p-page">
		<section class="space-y-text-sm">
			<h2 class="text-lg font-bold text-ty-primary">Surfaces</h2>
			<div class="flex flex-wrap gap-grid-sm">
				{#each surfaces as surface (surface)}
					<div class="w-40 rounded-lg border {surface} p-box-sm text-xs text-ty-secondary">
						{surface}
					</div>
				{/each}
			</div>
		</section>

		<section class="space-y-text-sm">
			<h2 class="text-lg font-bold text-ty-primary">States and domain tones</h2>
			<div class="flex flex-wrap gap-grid-sm">
				{#each states as [fill, ink] (fill)}
					<div class="w-28 space-y-text-2xs">
						<div class="flex h-10 items-center justify-center rounded-lg {fill}">
							<span class="text-xs font-semibold {ink}">Aa</span>
						</div>
						<p class="text-xs text-ty-secondary">{fill}</p>
					</div>
				{/each}
			</div>
		</section>

		<!-- Deliberately not swapped per theme: the hues only stay apart if their
		     lightness holds, so series-ink is the only label colour that survives
		     on the fills — the "Aa" inside each swatch is that pairing. -->
		<section class="space-y-text-sm">
			<h2 class="text-lg font-bold text-ty-primary">Categorical series</h2>
			<div class="flex flex-wrap gap-grid-sm">
				{#each series as swatch (swatch)}
					<div class="w-24 space-y-text-2xs">
						<div class="flex h-10 items-center justify-center rounded-lg {swatch}">
							<span class="text-xs text-series-ink">Aa</span>
						</div>
						<p class="text-xs text-ty-secondary">{swatch}</p>
					</div>
				{/each}
			</div>
		</section>

		<section class="space-y-text-sm">
			<h2 class="text-lg font-bold text-ty-primary">Text</h2>
			{#each textTones as tone (tone)}
				<p class="text-sm {tone}">{tone} — the quick brown fox jumps over the lazy dog</p>
			{/each}
		</section>

		<!-- What every card in the app is: translucent surface + backdrop-blur -->
		<section
			class="space-y-text-xs rounded-2xl border bg-surface-card p-box-xl backdrop-blur shadow-card"
		>
			<h2 class="text-lg font-bold text-ty-primary">A card on this theme</h2>
			<p class="text-sm text-ty-secondary">
				surface-card is translucent in about twenty themes — without backdrop-blur the background
				shows through unblurred here.
			</p>
			<hr class="border-line-soft" />
			<p class="text-xs text-ty-silent">line-soft above, line-strong on the card border.</p>
		</section>
	</div>
</Story>
