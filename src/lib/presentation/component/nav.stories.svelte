<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, waitFor, within } from 'storybook/test';
	import { Button } from '$lib/presentation/component/ui/button';
	import Nav from '$lib/presentation/component/nav.svelte';

	/* Nav reads the current route from $app/state; @storybook/sveltekit's mock
	   takes it from this parameter. */
	const atUrl = (path: string) => ({
		sveltekit_experimental: {
			state: {
				page: {
					url: new URL(`http://localhost${path}`),
				},
			},
		},
	});

	const { Story } = defineMeta({
		title: 'Component/Nav',
		component: Nav,
		tags: ['autodocs'],
		parameters: atUrl('/'),
	});

	// <Story name="Viewing a past day"> — Viewing another day: the first item shows that date instead
	// of "Today", amber for the past and sky for a future plan
</script>

<Story
	name="Today"
	play={async ({ canvas, canvasElement, userEvent }) => {
		// The brand mark answers "what is this app", on every route the nav renders on
		await userEvent.hover(
			canvas.getByRole('link', {
				name: 'Fallow',
			}),
		);

		const body = within(canvasElement.ownerDocument.body);

		await waitFor(() => expect(body.getByText(/^Splits your daily time budget/)).toBeVisible());
	}}
/>

<Story name="Analytics active" parameters={atUrl('/analytics')} />

<Story name="Viewing a past day" parameters={atUrl('/?date=2020-01-01')} />

<Story name="Viewing a future day" parameters={atUrl('/?date=2099-01-01')} />

<Story name="With layout actions">
	{#snippet template()}
		<Nav>
			{#snippet actions()}
				<div class="flex items-center gap-grid-xs">
					<Button variant="outline" size="sm">Theme</Button>
					<Button variant="outline" size="sm">Data</Button>
				</div>
			{/snippet}
		</Nav>
	{/snippet}
</Story>
