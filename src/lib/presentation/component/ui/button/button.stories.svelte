<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Button, { type ButtonSize, type ButtonVariant } from './button.svelte';

	const variants: ButtonVariant[] = [
		'default',
		'outline',
		'secondary',
		'ghost',
		'destructive',
		'link',
	];
	const sizes: ButtonSize[] = ['xs', 'sm', 'default', 'lg'];
	const iconSizes: ButtonSize[] = ['icon-xs', 'icon-sm', 'icon', 'icon-lg'];

	const { Story } = defineMeta({
		title: 'UI/Button',
		component: Button,
		tags: ['autodocs'],
		args: {
			variant: 'default',
			size: 'default',
			disabled: false,
		},
		argTypes: {
			variant: {
				control: 'select',
				options: variants,
			},
			size: {
				control: 'select',
				options: [...sizes, ...iconSizes],
			},
			disabled: {
				control: 'boolean',
			},
			href: {
				control: 'text',
			},
		},
	});
</script>

<Story name="Default">Deploy task</Story>

<Story name="Variants" asChild>
	<div class="flex flex-wrap items-center gap-grid-sm">
		{#each variants as variant (variant)}
			<Button {variant}>{variant}</Button>
		{/each}
	</div>
</Story>

<Story name="Sizes" asChild>
	<div class="flex flex-wrap items-center gap-grid-sm">
		{#each sizes as size (size)}
			<Button {size}>{size}</Button>
		{/each}
		{#each iconSizes as size (size)}
			<Button {size} variant="outline" aria-label={size}>+</Button>
		{/each}
	</div>
</Story>

<Story
	name="Disabled"
	args={{
		disabled: true,
	}}>Deploy task</Story
>

<Story
	name="As link"
	args={{
		// href renders an <a>; disabled then only marks it, it cannot swallow clicks
		href: '/energy',
		variant: 'link',
	}}>Energy Lab</Story
>
