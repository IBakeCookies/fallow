<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import TooltipRoot from './tooltip.svelte';

	const { Story } = defineMeta({
		title: 'UI/Tooltip',
		component: TooltipRoot,
		tags: ['autodocs'],
	});

	// <Story name="Default"> — The metric-label pattern: a dotted-underline trigger, tooltip to the
	// side

	// <Story name="Open"> — Open on mount, so the content itself is reviewable without hovering

	// <Story name="Delayed, custom trigger element"> — delayDuration on the provider, longer than its
	// 150 default; `child` lets the trigger be any element
</script>

<Story name="Default" asChild>
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger>
				<span class="hint-underline text-xs text-ty-secondary"> Yield Index </span>
			</Tooltip.Trigger>
			<Tooltip.Content side="right">
				<p>Share of the planned output the current allocation actually reaches.</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</Story>

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

<Story name="Delayed, custom trigger element" asChild>
	<Tooltip.Provider delayDuration={600}>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<h1 {...props} class="hint-underline text-2xl font-bold text-ty-primary">Fallow</h1>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" align="start" class="max-w-md">
				<p>Plan the day around when you are actually able to do the work.</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</Story>
