import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import storybook from 'eslint-plugin-storybook';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

// Relative imports are banned everywhere in favour of the `$lib` alias, but
// `no-restricted-imports` is not additive across flat-config blocks: the last
// block that matches a file wins the whole rule. The layer-boundary blocks
// below therefore have to re-state this alongside their own patterns.
// `./$types` is generated per-route by `svelte-kit sync` and has no alias, so
// it is the one relative specifier the app cannot write any other way.
const noRelativeImports = {
	group: ['./*', '../*', '!./$types'],
	message: 'Import through the $lib alias, not a relative path.',
};

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	storybook.configs['flat/recommended'],
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',

			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/ban-ts-comment': 'off',
			'@typescript-eslint/no-unused-vars': 'warn',
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{
					prefer: 'type-imports',
				},
			],

			// AGENTS.md: named exports only, default exports are for Svelte
			// components. `import/no-default-export` would mean a whole plugin for
			// one rule; the core selector says the same thing.
			'no-restricted-syntax': [
				'error',
				{
					selector: 'ExportDefaultDeclaration',
					message: 'Named exports only; default exports are for Svelte components.',
				},
			],
			'no-restricted-imports': [
				'error',
				{
					patterns: [noRelativeImports],
				},
			],

			'no-console': 'warn',
			'no-debugger': 'error',
			'no-eval': 'error',
			'no-alert': 'error',
			'no-var': 'error',
			'no-return-await': 'error',
			'prefer-template': 'error',
			'max-depth': ['error', 3],
			'no-else-return': [
				'error',
				{
					allowElseIf: false,
				},
			],

			'comma-dangle': ['error', 'always-multiline'],
			'arrow-parens': ['error', 'always'],
			'eol-last': ['error', 'always'],
			'object-curly-newline': [
				'error',
				{
					ObjectExpression: {
						multiline: true,
						minProperties: 1,
					},
				},
			],
			'padding-line-between-statements': [
				'error',
				{
					blankLine: 'always',
					prev: ['if'],
					next: ['*'],
				},
				{
					blankLine: 'always',
					prev: ['*'],
					next: ['if'],
				},
				{
					blankLine: 'always',
					prev: ['*'],
					next: ['return'],
				},
				{
					blankLine: 'always',
					prev: ['import'],
					next: ['*'],
				},
				{
					blankLine: 'never',
					prev: ['import'],
					next: ['import'],
				},
				{
					blankLine: 'never',
					prev: ['const', 'let'],
					next: ['const', 'let'],
				},
				{
					blankLine: 'always',
					prev: [
						'block',
						'block-like',
						'multiline-block-like',
						'multiline-expression',
						'multiline-const',
					],
					next: ['const', 'let'],
				},
				{
					blankLine: 'always',
					prev: ['const', 'let'],
					next: [
						'block',
						'block-like',
						'multiline-block-like',
						'multiline-expression',
						'multiline-const',
					],
				},
				{
					blankLine: 'always',
					prev: ['*'],
					next: [
						'block',
						'block-like',
						'multiline-block-like',
						'multiline-expression',
						'multiline-const',
						'export',
					],
				},
				{
					blankLine: 'always',
					prev: [
						'block',
						'block-like',
						'multiline-block-like',
						'multiline-expression',
						'multiline-const',
						'export',
					],
					next: ['*'],
				},
			],
		},
	},
	{
		// Config files are loaded by their tool by default export; that is the
		// tool's contract, not our export style.
		files: ['*.config.{js,ts}', '.storybook/**'],
		rules: {
			'no-restricted-syntax': 'off',
		},
	},
	{
		// Neither of these resolves `$lib`: Playwright runs the e2e specs through
		// its own loader with no Vite aliases, and .storybook sits outside `src`.
		files: ['e2e/**', '.storybook/**'],
		rules: {
			'no-restricted-imports': 'off',
		},
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
			},
		},
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
			'svelte/no-unused-svelte-ignore': 'off',
		},
	},

	// ---- Layer boundaries (presentation → business → data, one direction) ----
	{
		files: ['src/lib/data/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						noRelativeImports,
						{
							group: [
								'$lib/business/*',
								'$lib/business/**',
								'$lib/presentation/*',
								'$lib/presentation/**',
							],
							message: 'The data layer must not import from the business or presentation layers.',
						},
					],
				},
			],
		},
	},
	{
		files: ['src/lib/business/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						noRelativeImports,
						{
							group: ['$lib/presentation/*', '$lib/presentation/**'],
							message: 'The business layer must not import from the presentation layer.',
						},
					],
				},
			],
		},
	},
	{
		// hooks/service-worker are app-shell code, not domain code: they render
		// and cache, so they go through the business layer like any route would.
		// 'src/hooks*.ts' covers both src/hooks.ts (reroute) and src/hooks.server.ts
		files: ['src/lib/presentation/**', 'src/routes/**', 'src/hooks*.ts', 'src/service-worker.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						noRelativeImports,
						{
							group: ['$lib/data/*', '$lib/data/**'],
							message:
								'Presentation code must go through the business layer (stores in $lib/business/store, types via $lib/business/type).',
						},
					],
				},
			],
		},
	},
	{
		// shadcn generates these barrels with relative re-exports and rewrites them
		// on every `shadcn add`, so the alias rule would be undone by the CLI. The
		// layer boundary still applies.
		files: ['src/lib/presentation/component/ui/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['$lib/data/*', '$lib/data/**'],
							message:
								'Presentation code must go through the business layer (stores in $lib/business/store, types via $lib/business/type).',
						},
					],
				},
			],
		},
	},
	{
		// The scheduler's loops are nested the way MATH.md specifies them.
		// Unnesting them is a deliberate, test-covered refactor, not a lint fixup:
		// warn here so the error still applies to every other file.
		files: ['src/lib/business/model/zenith*.ts'],
		rules: {
			'max-depth': ['warn', 3],
		},
	},
);
