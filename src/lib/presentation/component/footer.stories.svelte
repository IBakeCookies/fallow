<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Footer from './footer.svelte';

	const { Story } = defineMeta({
		title: 'Component/Footer',
		component: Footer,
		tags: ['autodocs']
	});
</script>

<Story name="Default" />
