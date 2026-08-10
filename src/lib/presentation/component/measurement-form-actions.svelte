<script lang="ts">
	import { Button } from '$lib/presentation/component/ui/button';

	/* The ✓/✕ pair that closes every measurement editor — ⚡ time-to-flow, 🪫 drain and
	   😴 rest. It exists because the three forms were written separately and drifted:
	   two grew ghost buttons with a hover surface, one stayed a bare glyph with none, so
	   the same gesture looked disabled in one editor and live in the next. The only
	   difference that is real is the instrument's hue on ✓, which is a prop.

	   🗑 is the third verb and belongs here for the same reason: an editor opened on a
	   measurement that already exists is where dropping it is unambiguous — it is the
	   one on screen. Its copy is the caller's, because the thing being dropped is a
	   different measurement in each editor, and there is no glyph for "the row you can
	   no longer see". Absent unless the caller passes it: an editor filling in a
	   measurement for the first time has nothing to delete. */

	interface Props {
		/** The instrument's colour on ✓ — the same token its readings wear elsewhere. */
		accentClass?: string;
		oncancel: () => void;
		/** Absent → no 🗑, which is what a first measurement wants. */
		ondelete?: () => void;
		deleteLabel?: string;
		deleteTitle?: string;
	}

	let { accentClass = 'text-flow', oncancel, ondelete, deleteLabel, deleteTitle }: Props = $props();
</script>

<span class="ml-auto flex items-center gap-grid-2xs">
	{#if ondelete}
		<Button
			variant="ghost"
			size="icon-xs"
			type="button"
			onclick={ondelete}
			aria-label={deleteLabel}
			title={deleteTitle}
			class="text-ty-silent hover:text-danger"
		>
			🗑
		</Button>
	{/if}
	<Button variant="ghost" size="icon-xs" type="submit" class={accentClass}>✓</Button>
	<Button variant="ghost" size="icon-xs" type="button" onclick={oncancel} class="text-ty-silent">
		✕
	</Button>
</span>
