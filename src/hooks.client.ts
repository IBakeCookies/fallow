import type { HandleClientError } from '@sveltejs/kit';

// Central client-side error hook: unexpected load/render errors land here
// before +error.svelte shows. Plug an error-reporting service in here.
export const handleError: HandleClientError = ({ error, message }) => {
	console.error(error);

	return { message };
};
