<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Badge, { type BadgeVariant } from './badge.svelte';

	const variants: BadgeVariant[] = [
		'default',
		'secondary',
		'destructive',
		'outline',
		'ghost',
		'link',
	];

	const { Story } = defineMeta({
		title: 'UI/Badge',
		component: Badge,
		tags: ['autodocs'],
		args: {
			variant: 'default',
		},
		argTypes: {
			variant: {
				control: 'select',
				options: variants,
			},
			href: {
				control: 'text',
			},
		},
	});

	// <Story name="Momentum tones"> — How the metrics dashboard tints momentum: variant for the
	// shape, tokens for the tone
</script>

<Story name="Default">Upward</Story>

<Story name="Variants" asChild>
	<div class="flex flex-wrap items-center gap-grid-sm">
		{#each variants as variant (variant)}
			<Badge {variant}>{variant}</Badge>
		{/each}
	</div>
</Story>

<Story name="Momentum tones" asChild>
	<div class="flex flex-wrap items-center gap-grid-sm">
		<Badge class="bg-success/20 text-success-strong">Upward</Badge>
		<Badge variant="destructive" class="bg-warning/20 text-warning-strong">Reset Reqd</Badge>
		<Badge variant="secondary">Stable</Badge>
	</div>
</Story>

<Story
	name="As link"
	args={{
		href: '/analytics',
		variant: 'outline',
	}}>Analytics</Story
>
