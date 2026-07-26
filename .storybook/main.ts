import type { StorybookConfig } from '@storybook/sveltekit';
import { fileURLToPath } from 'node:url';

const config: StorybookConfig = {
	// Stories live beside the component they document.
	stories: ['../src/**/*.stories.svelte'],
	addons: [
		'@storybook/addon-svelte-csf',
		'@chromatic-com/storybook',
		'@storybook/addon-vitest',
		'@storybook/addon-a11y',
		'@storybook/addon-docs'
	],
	framework: '@storybook/sveltekit',

	// $env/dynamic/public is filled in by the SvelteKit server, which Storybook
	// has no equivalent of — its virtual module throws on import here. seo-head
	// reads PUBLIC_SITE_URL through it, so point it at an empty stub instead.
	viteFinal: (config) => ({
		...config,
		resolve: {
			...config.resolve,
			alias: {
				...config.resolve?.alias,
				'$env/dynamic/public': fileURLToPath(new URL('./env-dynamic-public.ts', import.meta.url))
			}
		}
	})
};
export default config;
