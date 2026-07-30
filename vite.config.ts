import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

const dirname =
	typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
			},
			adapter: adapter(),
		}),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			// `url` first: German needs its own indexable `/de/*` URLs, and the URL
			// has to outrank the cookie or two visitors get different copy at the
			// same address. The base locale stays unprefixed, so every existing
			// English URL is unchanged.
			strategy: ['url', 'cookie', 'baseLocale'],
		}),
	],
	server: {
		// Dev serves ~180 unbundled client modules and transforms each on its
		// first request, which gates hydration — and the app only reads
		// IndexedDB once hydrated, so a cold graph shows an empty page for
		// seconds. Transforming the route entries at server start (imports
		// cascade via preTransformRequests) moves that cost off the first load.
		warmup: {
			// Route entries only: a `**/*.svelte` glob would pull in the
			// `*.stories.svelte` files, whose Storybook deps then trip the dep
			// optimizer into a mid-load full reload.
			clientFiles: ['./src/routes/**/+*.svelte'],
		},
	},
	test: {
		expect: {
			requireAssertions: true,
		},
		reporters: ['default', 'html'],
		outputFile: {
			html: 'test-result/unit/index.html',
		},
		coverage: {
			enabled: true,
			provider: 'v8',
			include: [
				'src/lib/business/**/*.ts',
				'src/lib/data/**/*.ts',
				'src/lib/presentation/**/*.{ts,svelte}',
			],
			// Setting `exclude` replaces Vitest's defaults, so the test files
			// themselves have to be listed back or they are measured as source.
			exclude: ['**/*.{test,spec}.ts', '**/*.stories.svelte'],
			reportsDirectory: 'test-result/coverage',
			reporter: ['text', 'html'],
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [
							{
								browser: 'chromium',
								headless: true,
							},
						],
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
				},
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
				},
			},
			{
				extends: true,
				plugins: [
					// The plugin will run tests for the stories defined in your Storybook config
					// See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
					storybookTest({
						configDir: path.join(dirname, '.storybook'),
					}),
				],
				test: {
					name: 'storybook',
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({}),
						instances: [
							{
								browser: 'chromium',
							},
						],
					},
				},
			},
		],
	},
});
