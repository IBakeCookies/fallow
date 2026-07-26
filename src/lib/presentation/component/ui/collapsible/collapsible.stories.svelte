<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import * as Collapsible from '$lib/presentation/component/ui/collapsible';
	import CollapsibleRoot from './collapsible.svelte';

	const { Story } = defineMeta({
		title: 'UI/Collapsible',
		component: CollapsibleRoot,
		tags: ['autodocs'],
		args: { open: false },
		argTypes: { open: { control: 'boolean' } }
	});
</script>

<Story name="Default" asChild>
	<Collapsible.Root
		class="max-w-sm rounded-2xl border bg-surface-card p-box-md shadow-card backdrop-blur"
	>
		<Collapsible.Trigger class="text-sm text-ty-secondary hover:text-ty-primary">
			Model details ▾
		</Collapsible.Trigger>
		<Collapsible.Content class="mt-text-xs text-xs text-ty-silent">
			ϕ = c₁E + c₂β + c₃, fitted from 7 flow logs.
		</Collapsible.Content>
	</Collapsible.Root>
</Story>

<Story name="Open" asChild>
	<Collapsible.Root
		open
		class="max-w-sm rounded-2xl border bg-surface-card p-box-md shadow-card backdrop-blur"
	>
		<Collapsible.Trigger class="text-sm text-ty-secondary hover:text-ty-primary">
			Model details ▴
		</Collapsible.Trigger>
		<Collapsible.Content class="mt-text-xs text-xs text-ty-silent">
			ϕ = c₁E + c₂β + c₃, fitted from 7 flow logs.
		</Collapsible.Content>
	</Collapsible.Root>
</Story>
