<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';

	interface Props {
		title: string;
		hint: string;
		action?: Snippet;
		children: Snippet;
	}

	let { title, hint, action, children }: Props = $props();
</script>

<div class="card-shell p-box-md sm:p-box-xl">
	<!-- Its own provider so the card stands alone; nesting inside a page-level one is
	     harmless. -->
	<Tooltip.Provider delayDuration={150}>
		<div class="flex items-baseline justify-between gap-grid-xs">
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<h3
							{...props}
							class="hint-underline w-fit text-xs font-semibold tracking-wider text-ty-secondary uppercase"
						>
							{title}
						</h3>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="left">
					<p>{hint}</p>
				</Tooltip.Content>
			</Tooltip.Root>
			{@render action?.()}
		</div>
		{@render children()}
	</Tooltip.Provider>
</div>
