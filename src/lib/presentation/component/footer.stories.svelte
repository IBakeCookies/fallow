<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Footer from '$lib/presentation/component/footer.svelte';

	const { Story } = defineMeta({
		title: 'Component/Footer',
		component: Footer,
		tags: ['autodocs'],
	});
</script>

<Story name="Default" />
