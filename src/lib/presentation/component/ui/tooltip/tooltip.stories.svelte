<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import TooltipRoot from './tooltip.svelte';

	const { Story } = defineMeta({
		title: 'UI/Tooltip',
		component: TooltipRoot,
		tags: ['autodocs']
	});
</script>

<!-- The metric-label pattern: a dotted-underline trigger, tooltip to the side -->
<Story name="Default" asChild>
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger>
				<span
					class="cursor-help text-xs text-ty-secondary underline decoration-ty-ghost decoration-dotted underline-offset-4"
				>
					Yield Index
				</span>
			</Tooltip.Trigger>
			<Tooltip.Content side="right">
				<p>Share of the planned output the current allocation actually reaches.</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</Story>

<!-- Open on mount, so the content itself is reviewable without hovering -->
<Story name="Open" asChild>
	<Tooltip.Provider>
		<Tooltip.Root open>
			<Tooltip.Trigger>
				<span class="text-sm text-ty-secondary">Momentum</span>
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" align="start" class="max-w-md">
				<p>Yesterday's completion rate against the day before it.</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</Story>

<!-- delayDuration on the provider; `child` lets the trigger be any element -->
<Story name="Delayed, custom trigger element" asChild>
	<Tooltip.Provider delayDuration={150}>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<h1
						{...props}
						class="cursor-help text-2xl font-bold text-ty-primary underline decoration-ty-ghost decoration-dotted underline-offset-4"
					>
						Fallow
					</h1>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" align="start" class="max-w-md">
				<p>Plan the day around when you are actually able to do the work.</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</Story>
