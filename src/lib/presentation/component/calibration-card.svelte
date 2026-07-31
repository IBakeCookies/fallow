<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import { HINT_UNDERLINE_CLASS } from '$lib/presentation/component/hint-underline';

	/* The shell the three calibration cards share: a card, an explained heading, and
	   whatever that fit has to say. Deliberately only the shell — the bodies stay at
	   the call sites, because they are three different things (α has two fit rows and a
	   log list, r adds the ☕ editor, λ₀ has a censored state and no logs at all) and a
	   component that covered all three would be a config blob, not a card. */

	interface Props {
		title: string;
		/** Why this fit exists and what it reads — the heading's tooltip */
		hint: string;
		/** Sits opposite the heading. The recovery card's ☕ button is the only one. */
		action?: Snippet;
		children: Snippet;
	}

	let { title, hint, action, children }: Props = $props();
</script>

<div class="rounded-2xl border bg-surface-card p-box-md sm:p-box-xl shadow-card backdrop-blur">
	<!-- Its own provider so the card stands alone; nesting inside a page-level one is
	     harmless, the inner wins with the same delay. -->
	<Tooltip.Provider delayDuration={150}>
		<div class="flex items-baseline justify-between gap-grid-xs">
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<h3
							{...props}
							class="w-fit text-xs font-semibold tracking-wider text-ty-secondary uppercase {HINT_UNDERLINE_CLASS}"
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
