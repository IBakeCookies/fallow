<script lang="ts">
	import { Button } from '$lib/presentation/component/ui/button';

	/* The ✓/✕ pair that closes every measurement editor — ⚡ time-to-flow, 🪫 drain and
	   😴 rest. It exists because the three forms were written separately and drifted:
	   two grew ghost buttons with a hover surface, one stayed a bare glyph with none, so
	   the same gesture looked disabled in one editor and live in the next. The only
	   difference that is real is the instrument's hue on ✓, which is a prop. */

	interface Props {
		/** The instrument's colour on ✓ — the same token its readings wear elsewhere. */
		accentClass?: string;
		oncancel: () => void;
	}

	let { accentClass = 'text-flow', oncancel }: Props = $props();
</script>

<span class="ml-auto flex items-center gap-grid-2xs">
	<Button variant="ghost" size="icon-xs" type="submit" class={accentClass}>✓</Button>
	<Button variant="ghost" size="icon-xs" type="button" onclick={oncancel} class="text-ty-silent">
		✕
	</Button>
</span>
