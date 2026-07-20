import type { LayoutServerLoad } from './$types';
import type { ThemeName } from '$lib/business/store/theme-store.svelte';

export const load: LayoutServerLoad = async (event) => {
	return {
		theme: event.cookies.get('theme') as ThemeName | undefined
	};
};
