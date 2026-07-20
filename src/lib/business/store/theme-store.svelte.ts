import { getContext, setContext } from 'svelte';
import { onMount } from 'svelte';
import { browser } from '$app/environment';

export type ThemeName =
	| 'fallow'
	| 'solid-light'
	| 'solid-dark'
	| 'glass-light'
	| 'glass-dark'
	| 'cyber-punk'
	| 'aurora'
	| 'daybreak'
	| 'royal'
	| 'terminal'
	| 'blueprint'
	| 'bubblegum'
	| 'ukiyo'
	| 'abyss'
	| 'parchment'
	| 'noir'
	| 'ember'
	| 'glacier'
	| 'zenith'
	| 'nadir';

interface ThemeItem {
	name: ThemeName;
	/* display name for the UI; name stays the cookie/CSS identifier */
	label: string;
	css: string[];
}

export const themes: ThemeItem[] = [
	{
		name: 'fallow',
		label: 'Fallow',
		css: ['glass', 'fallow']
	},
	{
		name: 'solid-light',
		label: 'Classic Light',
		css: ['solid', 'solid-light']
	},
	{
		name: 'solid-dark',
		label: 'Classic Dark',
		css: ['solid', 'solid-dark', 'dark']
	},
	{
		name: 'glass-light',
		label: 'Morning Glass',
		css: ['glass', 'glass-light']
	},
	{
		name: 'glass-dark',
		label: 'Night Glass',
		css: ['glass', 'glass-dark', 'dark']
	},
	{
		name: 'cyber-punk',
		label: 'Cyberpunk',
		css: ['cyber-punk', 'dark']
	},
	{
		name: 'aurora',
		label: 'Aurora',
		css: ['glass', 'aurora', 'dark']
	},
	{
		name: 'daybreak',
		label: 'Daybreak',
		css: ['glass', 'daybreak']
	},
	{
		name: 'royal',
		label: 'Royal Velvet',
		css: ['glass', 'royal', 'dark']
	},
	{
		name: 'terminal',
		label: 'Terminal',
		css: ['terminal', 'dark']
	},
	{
		name: 'blueprint',
		label: 'Blueprint',
		css: ['glass', 'blueprint', 'dark']
	},
	{
		name: 'bubblegum',
		label: 'Bubblegum',
		css: ['glass', 'bubblegum']
	},
	{
		name: 'ukiyo',
		label: 'Ukiyo-e',
		css: ['glass', 'ukiyo']
	},
	{
		name: 'abyss',
		label: 'Abyss',
		css: ['glass', 'abyss', 'dark']
	},
	{
		name: 'parchment',
		label: 'Parchment',
		css: ['glass', 'parchment']
	},
	{
		name: 'noir',
		label: 'Noir',
		css: ['glass', 'noir', 'dark']
	},
	{
		name: 'ember',
		label: 'Ember',
		css: ['glass', 'ember', 'dark']
	},
	{
		name: 'glacier',
		label: 'Glacier',
		css: ['glass', 'glacier']
	},
	{
		name: 'zenith',
		label: 'Zenith',
		css: ['glass', 'zenith']
	},
	{
		name: 'nadir',
		label: 'Nadir',
		css: ['glass', 'nadir', 'dark']
	}
] as const;

/* Defaults for first visit (no cookie). The pre-paint fallback in app.html's
   inline script hardcodes the dark default's classes — keep it in sync. */
export const DEFAULT_THEME: ThemeName = 'fallow';
export const DEFAULT_DARK_THEME: ThemeName = 'solid-dark';

const CONTEXT_KEY = Symbol();
const themeStorageKey = 'theme';

export function getClassesToAdd(themeName: ThemeName): string[] {
	return themes.find((t) => t.name === themeName)?.css ?? [];
}

export class ThemeStore {
	#theme = $state<ThemeName>(DEFAULT_THEME);
	#themes: ThemeItem[] = themes;

	#classesToAdd = $derived.by<string[]>(() => {
		return getClassesToAdd(this.#theme);
	});

	#classesToRemove = $derived.by<string[]>(() => {
		return themes.map((t) => t.css).flat();
	});

	constructor(initialTheme?: ThemeName) {
		$effect(() => {
			document.documentElement.classList.remove(...this.#classesToRemove);
			document.documentElement.classList.add(...this.#classesToAdd);
		});

		// offline, the SW serves cached HTML whose serialized theme may be stale —
		// the cookie is the source of truth, so it wins over initialTheme
		if (browser) {
			const cookieTheme = document.cookie.match(/(?:^|; )theme=([^;]+)/)?.[1];
			const known = themes.find((t) => t.name === cookieTheme);

			if (known) {
				this.#theme = known.name;

				return;
			}
		}

		if (initialTheme) {
			this.#theme = initialTheme;

			return;
		}

		onMount(() => {
			const isDarkThemePreferred =
				window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

			if (!isDarkThemePreferred) {
				return;
			}

			this.#theme = DEFAULT_DARK_THEME;
		});
	}

	get theme() {
		return this.#theme;
	}

	get label() {
		return themes.find((t) => t.name === this.#theme)?.label ?? this.#theme;
	}

	get themes() {
		return this.#themes;
	}

	switchTheme(newTheme: ThemeName): void {
		this.#theme = newTheme;

		document.cookie = `${themeStorageKey}=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
	}
}

export function setThemeStore(initialTheme?: ThemeName): ThemeStore {
	return setContext<ThemeStore>(CONTEXT_KEY, new ThemeStore(initialTheme));
}

export function getThemeStore(): ThemeStore {
	return getContext<ThemeStore>(CONTEXT_KEY);
}
