<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SeoHead from './seo-head.svelte';

	const { Story } = defineMeta({
		title: 'Component/SEO Head',
		component: SeoHead,
		tags: ['autodocs'],
		args: {
			title: 'Fallow — plan the day around your energy',
			description: 'A planner that allocates your hours with the Zenith Gradient algorithm.'
		},
		parameters: {
			sveltekit_experimental: { state: { page: { url: new URL('http://localhost/') } } }
		}
	});
</script>

<Story name="Default">
	{#snippet template(args)}
		<SeoHead {...args} />
		<p class="text-sm text-ty-secondary">
			Nothing renders in the page — inspect the document head for the title, canonical link, Open
			Graph and Twitter tags.
		</p>
	{/snippet}
</Story>

<Story
	name="With structured data"
	args={{
		jsonLd: {
			'@context': 'https://schema.org',
			'@type': 'WebApplication',
			name: 'Fallow',
			applicationCategory: 'BusinessApplication'
		}
	}}
>
	{#snippet template(args)}
		<SeoHead {...args} />
		<p class="text-sm text-ty-secondary">
			Adds a JSON-LD &lt;script&gt; to the head alongside the meta tags.
		</p>
	{/snippet}
</Story>
