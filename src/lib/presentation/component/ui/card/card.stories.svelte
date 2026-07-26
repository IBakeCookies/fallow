<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Button } from '$lib/presentation/component/ui/button';
	import * as Card from '$lib/presentation/component/ui/card';
	import CardRoot from './card.svelte';

	const { Story } = defineMeta({
		title: 'UI/Card',
		component: CardRoot,
		tags: ['autodocs'],
		args: { size: 'default' },
		argTypes: { size: { control: 'inline-radio', options: ['default', 'sm'] } }
	});
</script>

<Story name="Full" asChild>
	<Card.Root class="max-w-sm">
		<Card.Header class="border-b">
			<Card.Title>Time budget</Card.Title>
			<Card.Description>What the allocator has to spend today.</Card.Description>
			<Card.Action>
				<Button variant="ghost" size="icon-sm" aria-label="Edit">✎</Button>
			</Card.Action>
		</Card.Header>
		<Card.Content>
			<p class="text-ty-secondary">6.00 h available · 5.25 h planned · 0.75 h unplanned.</p>
		</Card.Content>
		<Card.Footer class="border-t pt-(--card-spacing)">
			<Button size="sm">Re-plan</Button>
		</Card.Footer>
	</Card.Root>
</Story>

<!-- size="sm" tightens --card-spacing, which every slot reads -->
<Story name="Compact" asChild>
	<Card.Root size="sm" class="max-w-sm">
		<Card.Header>
			<Card.Title>Flow log</Card.Title>
		</Card.Header>
		<Card.Content>
			<p class="text-ty-secondary">Personalized from 7 flow logs.</p>
		</Card.Content>
	</Card.Root>
</Story>
