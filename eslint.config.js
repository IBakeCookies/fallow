import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// Override or add rule settings here, such as:
		// 'svelte/button-has-type': 'error'
		rules: {
			// Every hit is a false positive the code had annotated (external-URL
			// constants, caller-supplied hrefs, resolve()+query string): off.
			'svelte/no-navigation-without-resolve': 'off',
			// The plugin's compiler pass misses warnings svelte-check does emit
			// (e.g. state_referenced_locally), so it flags ignores that are in
			// fact load-bearing: off.
			'svelte/no-unused-svelte-ignore': 'off'
		}
	},

	// ---- Layer boundaries (presentation → business → data, one direction) ----
	{
		files: ['src/lib/data/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: [
								'$lib/business/*',
								'$lib/business/**',
								'$lib/presentation/*',
								'$lib/presentation/**'
							],
							message: 'The data layer must not import from the business or presentation layers.'
						}
					]
				}
			]
		}
	},
	{
		files: ['src/lib/business/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['$lib/presentation/*', '$lib/presentation/**'],
							message: 'The business layer must not import from the presentation layer.'
						}
					]
				}
			]
		}
	},
	{
		files: ['src/lib/presentation/**', 'src/routes/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['$lib/data/*', '$lib/data/**'],
							message:
								'Presentation code must go through the business layer (stores in $lib/business/store, types via $lib/business/type).'
						}
					]
				}
			]
		}
	}
);
