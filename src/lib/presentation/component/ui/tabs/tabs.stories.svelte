<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import * as Tabs from '$lib/presentation/component/ui/tabs';
	import TabsRoot from './tabs.svelte';

	const { Story } = defineMeta({
		title: 'UI/Tabs',
		component: TabsRoot,
		tags: ['autodocs'],
	});
</script>

<Story name="Default" asChild>
	<Tabs.Root value="plan" class="max-w-md">
		<Tabs.List>
			<Tabs.Trigger value="plan">Plan</Tabs.Trigger>
			<Tabs.Trigger value="energy">Energy</Tabs.Trigger>
			<Tabs.Trigger value="logs">Logs</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="plan" class="text-sm text-ty-secondary">
			5.25 h allocated across 3 tasks.
		</Tabs.Content>
		<Tabs.Content value="energy" class="text-sm text-ty-secondary">
			Cognitive reservoir ends the window at 0.42.
		</Tabs.Content>
		<Tabs.Content value="logs" class="text-sm text-ty-secondary">7 flow logs.</Tabs.Content>
	</Tabs.Root>
</Story>

<!-- variant="line" swaps the filled pill for an underline on the active trigger -->
<Story name="Line" asChild>
	<Tabs.Root value="energy" class="max-w-md">
		<Tabs.List variant="line">
			<Tabs.Trigger value="plan">Plan</Tabs.Trigger>
			<Tabs.Trigger value="energy">Energy</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="plan" class="text-sm text-ty-secondary">Plan panel.</Tabs.Content>
		<Tabs.Content value="energy" class="text-sm text-ty-secondary">Energy panel.</Tabs.Content>
	</Tabs.Root>
</Story>

<Story name="Vertical" asChild>
	<Tabs.Root value="plan" orientation="vertical" class="max-w-md">
		<Tabs.List>
			<Tabs.Trigger value="plan">Plan</Tabs.Trigger>
			<Tabs.Trigger value="energy">Energy</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="plan" class="text-sm text-ty-secondary">Plan panel.</Tabs.Content>
		<Tabs.Content value="energy" class="text-sm text-ty-secondary">Energy panel.</Tabs.Content>
	</Tabs.Root>
</Story>
