import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Probes only (`npm run probe`), deliberately its own config so they can never
 * join `npm test`: a sweep prints numbers that legitimately move whenever the
 * allocator changes, and in the suite that is a red build carrying no
 * regression. Assertions are not required here — the output IS the result
 * (AGENTS.md §4).
 */
export default defineConfig({
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
		},
	},
	test: {
		name: 'probe',
		environment: 'node',
		include: ['scripts/**/*.probe.ts'],
		testTimeout: 600_000,
	},
});
