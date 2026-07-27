/* Read by svelte-check and eslint-plugin-svelte — NOT by the build: `sveltekit()`
   in vite.config.ts passes its options inline, which makes SvelteKit ignore this
   file (and warn that it does). It exists so the two compile components in the
   same mode the build forces; keep `runes` here in step with vite.config.ts. */

/** @type {import('@sveltejs/kit').Config} */
export default {
	compilerOptions: {
		runes: true,
	},
};
