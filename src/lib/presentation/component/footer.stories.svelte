<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import Footer from '$lib/presentation/component/footer.svelte';

	const { Story } = defineMeta({
		title: 'Component/Footer',
		component: Footer,
		tags: ['autodocs'],
	});
</script>

<!-- Imprint and privacy must be directly reachable from every page (§5 DDG);
     the Ko-fi link leaves the app, so it opens a new tab -->
<Story
	name="Default"
	play={async ({ canvas }) => {
		await expect(
			canvas.getByRole('link', {
				name: 'Imprint',
			}),
		).toHaveAttribute('href', '/imprint');

		await expect(
			canvas.getByRole('link', {
				name: 'Privacy Policy',
			}),
		).toHaveAttribute('href', '/privacy');

		const coffee = canvas.getByRole('link', {
			name: /Buy me a coffee/,
		});

		await expect(coffee).toHaveAttribute('href', expect.stringContaining('ko-fi.com'));
		await expect(coffee).toHaveAttribute('target', '_blank');
		await expect(coffee).toHaveAttribute('rel', 'noopener');
	}}
/>
