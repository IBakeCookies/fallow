import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Probes only (`npm run probe`), deliberately its own config so they can never
 * join `npm test`: a sweep prints numbers that legitimately move whenever the
 * allocator changes, and in the suite that is a red build carrying no
 * regression. Assertions are not required here — the output IS the result
 * (docs/testing.md).
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
		// The search-gap probe's enumerated tiers land just over 10 minutes since
		// the §8.6 pair seeds; a probe that reports a timeout instead of its
		// numbers is worse than a slow one.
		testTimeout: 1_200_000,
	},
});
