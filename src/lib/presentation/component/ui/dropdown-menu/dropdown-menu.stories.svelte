<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import * as DropdownMenu from '$lib/presentation/component/ui/dropdown-menu';
	import DropdownMenuRoot from './dropdown-menu.svelte';

	const { Story } = defineMeta({
		title: 'UI/Dropdown Menu',
		component: DropdownMenuRoot,
		tags: ['autodocs'],
	});
</script>

<script lang="ts">
	// Story-local so the checked/selected states are actually clickable
	let includeCompleted = $state(true);
	let range = $state('7d');

	// <Story name="Trigger"> — The trigger IS a Button: `variant` and `size` are Button's own, and
	// default to outline/sm so every dropdown in the app matches.

	// <Story name="Icon trigger"> — Icon-only, as the layout's data menu
</script>

<Story name="Trigger" asChild>
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>Load</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-64">
			<DropdownMenu.Item>
				Yesterday (3)
				<DropdownMenu.Shortcut>⌘Y</DropdownMenu.Shortcut>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Label>Saved routines</DropdownMenu.Label>
			<DropdownMenu.Item>Morning (2)</DropdownMenu.Item>
			<DropdownMenu.Item disabled>Deep work (0)</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</Story>

<Story name="Icon trigger" asChild>
	<DropdownMenu.Root>
		<DropdownMenu.Trigger size="icon-sm" aria-label="Data menu">☰</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-48">
			<DropdownMenu.Item>Export backup</DropdownMenu.Item>
			<DropdownMenu.Item>Import backup</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item variant="destructive">Delete all data</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</Story>

<Story name="Checkbox, radio and submenu" asChild>
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>View</DropdownMenu.Trigger>
		<DropdownMenu.Content align="start" class="w-56">
			<DropdownMenu.CheckboxItem bind:checked={includeCompleted}>
				Include completed
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.Separator />
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading>Range</DropdownMenu.GroupHeading>
				<DropdownMenu.RadioGroup bind:value={range}>
					<DropdownMenu.RadioItem value="7d">7 days</DropdownMenu.RadioItem>
					<DropdownMenu.RadioItem value="30d">30 days</DropdownMenu.RadioItem>
					<DropdownMenu.RadioItem value="all">All time</DropdownMenu.RadioItem>
				</DropdownMenu.RadioGroup>
			</DropdownMenu.Group>
			<DropdownMenu.Separator />
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>Export as</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item>JSON</DropdownMenu.Item>
					<DropdownMenu.Item>CSV</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</Story>
