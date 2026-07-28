import type { HandleClientError } from '@sveltejs/kit';
import { logError } from '$lib/logger';

// Central client-side error hook: unexpected load/render errors land here
// before +error.svelte shows.
//
// This is also where an error-reporting service is plugged in — call
// `setLogSink` from `$lib/logger` once here and every diagnostic in the app,
// not just this hook, is routed to it.
export const handleError: HandleClientError = ({ error, message }) => {
	logError('Unhandled client error', error);

	return {
		message,
	};
};
