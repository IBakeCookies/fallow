<script lang="ts">
	import { Button } from '$lib/presentation/component/ui/button';

	type Props = {
		accentClass?: string;
		oncancel: () => void;
	} & (
		| {
				ondelete?: undefined;
				deleteLabel?: undefined;
				deleteTitle?: undefined;
		  }
		| {
				ondelete: (() => void) | undefined;
				deleteLabel: string;
				deleteTitle: string;
		  }
	);

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
