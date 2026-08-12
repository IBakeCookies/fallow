<script lang="ts">
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import InfoIcon from '@lucide/svelte/icons/info';
	import OctagonXIcon from '@lucide/svelte/icons/octagon-x';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	import { Toaster as Sonner, type ToasterProps as SonnerProps } from 'svelte-sonner';

	let { ...restProps }: SonnerProps = $props();
</script>

<!--
	Four deliberate deviations from `shadcn add sonner`. Re-running the CLI undoes
	all four, so check this file after.

	1. No `mode-watcher`. The registry version imports it for `theme={mode.current}`,
	   which is a light/dark *binary* over a catalogue of 40 palettes — the exact
	   thing STYLE.md bans `dark:` for. Every colour below comes from a token
	   the themes already swap, so sonner's own `theme` (default `light`) never
	   shows and the dependency is dead weight.
	2. The registry sets only the `--normal-*` trio; the four severity tints are
	   added on top of it (so every severity would otherwise paint alike — see
	   `richColors` below).
	3. `--border-radius: var(--radius)`, also missing from the registry's trio,
	   which leaves sonner on its own 8px corner while every card follows the token.
	4. The `loadingIcon` snippet is dropped: `showToast` has no loading severity,
	   nothing raises a promise toast, and the registry's `icons/loader-2` is an
	   alias with no `.svelte` entry, so `npm run depcheck` fails on it as
	   unresolvable.

	What is NOT a deviation: the base surface. The registry's `--color-popover`
	already exists here — `tokens.css` maps it to `--surface-page` precisely
	because "popovers float over arbitrary content", so it resolves to the same
	value this writes. `--surface-page` is named directly only because a raw
	`var()` should name the unprefixed token. Do not "fix" this to
	`--surface-card`: it carries alpha on 33 of the 40 themes, and `terminal`
	pairs that with `--blur: 0` on purpose, so page text shows straight through a
	floating toast — verified by screenshot. An opaque fill also leaves nothing
	for a `backdrop-blur` to blur, which is why there isn't one.

	`richColors` is required, not decorative: without it sonner ignores
	`--error-*`/`--success-*`/`--warning-*`/`--info-*` and paints every severity
	the same.
	The tinted recipe (fill at 5%, border at 20%, `-strong` ink) is the one every
	callout in the app uses — right for a sentence, where a solid fill with
	`-ink` would only suit a short label.
-->
<Sonner
	richColors
	class="toaster group"
	style="--border-radius: var(--radius);
	       --normal-bg: var(--surface-page);
	       --normal-text: var(--ty-primary);
	       --normal-border: var(--border);
	       --error-bg: color-mix(in oklch, var(--danger) 5%, var(--surface-page));
	       --error-border: color-mix(in oklch, var(--danger) 20%, transparent);
	       --error-text: var(--danger-strong);
	       --success-bg: color-mix(in oklch, var(--success) 5%, var(--surface-page));
	       --success-border: color-mix(in oklch, var(--success) 20%, transparent);
	       --success-text: var(--success-strong);
	       --warning-bg: color-mix(in oklch, var(--warning) 5%, var(--surface-page));
	       --warning-border: color-mix(in oklch, var(--warning) 20%, transparent);
	       --warning-text: var(--warning-strong);
	       --info-bg: color-mix(in oklch, var(--info) 5%, var(--surface-page));
	       --info-border: color-mix(in oklch, var(--info) 20%, transparent);
	       --info-text: var(--info-strong);"
	{...restProps}
	>{#snippet successIcon()}
		<CircleCheckIcon class="size-4" />
	{/snippet}
	{#snippet errorIcon()}
		<OctagonXIcon class="size-4" />
	{/snippet}
	{#snippet infoIcon()}
		<InfoIcon class="size-4" />
	{/snippet}
	{#snippet warningIcon()}
		<TriangleAlertIcon class="size-4" />
	{/snippet}
</Sonner>
