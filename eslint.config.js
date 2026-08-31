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
// `no-restricted-syntax` is not additive across flat-config blocks either, so a
// block that adds one selector for a subtree has to re-state these or silently
// drop them for those files.
const restrictedSyntax = [
	{
		selector: 'ExportDefaultDeclaration',
		message: 'Named exports only; default exports are for Svelte components.',
	},
	{
		selector: 'UnaryExpression[operator="!"] > UnaryExpression[operator="!"]',
		message: 'Coerce with Boolean(x), never !!x.',
	},
];

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
			'@typescript-eslint/no-unused-vars': 'error',
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{
					prefer: 'type-imports',
				},
			],

			// AGENTS.md: named exports only, default exports are for Svelte
			// components. `import/no-default-export` would mean a whole plugin for
			// one rule; the core selector says the same thing.
			'no-restricted-syntax': ['error', ...restrictedSyntax],
			'no-restricted-imports': [
				'error',
				{
					patterns: [noRelativeImports],
				},
			],

			// `$lib/logger` is the only console caller; everything else goes through
			// it, so a reporting service is one `setLogSink` call away.
			'no-console': 'error',
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
		// The `$` + verb convention (data/AGENTS.md), enforced rather than asserted.
		// The verb set is the seven actually in use across the 36 exported
		// repository functions, not the four CRUD ones the brief used to claim:
		// backup adds `$export`/`$import`, and undo adds `$restore`. Constants are
		// untouched — `ENERGY_PARAMS_SETTING` is not a writer.
		files: ['src/lib/data/repository/**'],
		rules: {
			'no-restricted-syntax': [
				'error',
				...restrictedSyntax,
				{
					selector: String.raw`ExportNamedDeclaration > FunctionDeclaration[id.name!=/^\$(create|read|update|delete|export|import|restore)/]`,
					message:
						'Repository functions are `$` + a verb: $create, $read, $update, $delete, $export, $import, $restore.',
				},
			],
		},
	},
	{
		// None of these resolves `$lib`: Playwright runs the e2e specs through its
		// own loader with no Vite aliases, .storybook sits outside `src`, and
		// `eval/` is a Node CLI that Vite never loads at all.
		files: ['e2e/**', '.storybook/**', 'eval/**'],
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
						{
							// R5. `$app/environment` is exempt: a module that genuinely runs
							// in both places may read `browser` — but never in an `$effect`,
							// which no selector can see.
							group: ['$app/*', '$app/**', '!$app/environment'],
							message:
								'Business code does not import SvelteKit routing; take what you need as an argument.',
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
		// R2's other half. dependency-cruiser enforces direction — a route may not
		// value-import `$lib/business/model/*` — but importing a store is legal, so
		// the logic drifts into the `$effect` rather than into the import list, and
		// that is the half no checker was watching. An `await` or a `.then()` inside
		// a route or component effect is that drift in its commonest form: the file
		// is now sequencing reads and holding the results, which nothing can
		// unit-test. Read in a store and hand the page the value.
		files: ['src/routes/**/*.svelte', 'src/lib/presentation/**/*.svelte'],
		rules: {
			'no-restricted-syntax': [
				'error',
				...restrictedSyntax,
				{
					selector:
						"CallExpression[callee.name='$effect'] :matches(AwaitExpression, MemberExpression[property.name='then'])",
					message:
						'R2: a route or component effect does not read or persist. Move the sequencing into a store (business/store/*.svelte.ts) and give this file the result.',
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
		// The only four places `console` is allowed. `logger.ts` is the default
		// sink — one that could not write to the console would leave the app
		// silent until a reporting service is wired up. `scripts/` and `eval/`
		// are Node CLI tools whose console output is the whole point of running
		// them, and a `.claude/hooks/` script talks to the agent exclusively by
		// writing stderr and exiting non-zero.
		files: ['src/lib/logger.ts', 'scripts/**', 'eval/**', '.claude/hooks/**'],
		rules: {
			'no-console': 'off',
		},
	},
	{
		// `neighbors` yields each move family under its own guard, four deep at
		// the innermost one. Both ways out cost the hill climb real time — a
		// `.filter()` allocates an array per block index, a `yield*` helper pays
		// delegation on every yield — so the depth is capped here rather than
		// exempted: a fifth level is still an error, and every other file,
		// `zenith.ts` and `zenith.test.ts` included, stays at 3.
		files: ['src/lib/business/model/zenith-energy.ts'],
		rules: {
			'max-depth': ['error', 4],
		},
	},
);
