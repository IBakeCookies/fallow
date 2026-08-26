<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import FallowExplainer from '$lib/presentation/component/fallow-explainer.svelte';

	const { Story } = defineMeta({
		title: 'Component/Fallow Explainer',
		component: FallowExplainer,
		tags: ['autodocs'],
	});
</script>

<Story
	name="Default"
	play={async ({ canvas, canvasElement }) => {
		// The home page's crawlable content: pitch, FAQ, and the external links. (The FAQPage JSON-LD
		// it emits into <head> is asserted in the spec — a story canvas can't reach head injection.)
		await expect(
			canvas.getByRole('heading', {
				level: 2,
			}),
		).toHaveTextContent("A to-do app that does calculus so you don't have to");

		await expect(
			canvas.getByRole('heading', {
				name: 'Frequently asked questions',
			}),
		).toBeVisible();

		expect(canvasElement.querySelector('a[href*="thequantasticjournal.com"]')).not.toBeNull();
		expect(canvasElement.querySelector('a[href*="github.com/IBakeCookies/fallow"]')).not.toBeNull();
	}}
/>
