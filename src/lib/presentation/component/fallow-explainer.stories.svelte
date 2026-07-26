<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FallowExplainer from './fallow-explainer.svelte';

	const { Story } = defineMeta({
		title: 'Component/Fallow Explainer',
		component: FallowExplainer,
		tags: ['autodocs']
	});
</script>

<!-- The home page's crawlable content; also emits the FAQPage JSON-LD -->
<Story name="Default" />
