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
	| 'nadir'
	| 'eclipse'
	| 'cathedral'
	| 'orbit'
	| 'tempest'
	| 'lantern-drift'
	| 'nacre'
	| 'pinwheel'
	| 'canopy'
	| 'meridian'
	| 'dunes'
	| 'synthwave'
	| 'firefly'
	| 'milkyway';

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
		css: ['fallow']
	},
	{
		name: 'solid-light',
		label: 'Classic Light',
		css: ['solid-light']
	},
	{
		name: 'solid-dark',
		label: 'Classic Dark',
		css: ['dark']
	},
	{
		name: 'glass-light',
		label: 'Morning Glass',
		css: ['glass-light']
	},
	{
		name: 'glass-dark',
		label: 'Night Glass',
		css: ['glass-dark', 'dark']
	},
	{
		name: 'cyber-punk',
		label: 'Cyberpunk',
		css: ['cyber-punk', 'dark']
	},
	{
		name: 'aurora',
		label: 'Aurora',
		css: ['aurora', 'dark']
	},
	{
		name: 'daybreak',
		label: 'Daybreak',
		css: ['daybreak']
	},
	{
		name: 'royal',
		label: 'Royal Velvet',
		css: ['royal', 'dark']
	},
	{
		name: 'terminal',
		label: 'Terminal',
		css: ['terminal', 'dark']
	},
	{
		name: 'blueprint',
		label: 'Blueprint',
		css: ['blueprint', 'dark']
	},
	{
		name: 'bubblegum',
		label: 'Bubblegum',
		css: ['bubblegum']
	},
	{
		name: 'ukiyo',
		label: 'Ukiyo-e',
		css: ['ukiyo']
	},
	{
		name: 'abyss',
		label: 'Abyss',
		css: ['abyss', 'dark']
	},
	{
		name: 'parchment',
		label: 'Parchment',
		css: ['parchment']
	},
	{
		name: 'noir',
		label: 'Noir',
		css: ['noir', 'dark']
	},
	{
		name: 'ember',
		label: 'Ember',
		css: ['ember', 'dark']
	},
	{
		name: 'glacier',
		label: 'Glacier',
		css: ['glacier']
	},
	{
		name: 'zenith',
		label: 'Zenith',
		css: ['zenith']
	},
	{
		name: 'nadir',
		label: 'Nadir',
		css: ['nadir', 'dark']
	},
	{
		name: 'eclipse',
		label: 'Eclipse',
		css: ['eclipse', 'dark']
	},
	{
		name: 'cathedral',
		label: 'Cathedral',
		css: ['cathedral', 'dark']
	},
	{
		name: 'orbit',
		label: 'Orbit',
		css: ['orbit', 'dark']
	},
	{
		name: 'tempest',
		label: 'Tempest',
		css: ['tempest', 'dark']
	},
	{
		name: 'lantern-drift',
		label: 'Lantern Drift',
		css: ['lantern-drift', 'dark']
	},
	{
		name: 'nacre',
		label: 'Nacre',
		css: ['nacre', 'dark']
	},
	{
		name: 'pinwheel',
		label: 'Pinwheel',
		css: ['pinwheel', 'dark']
	},
	{
		name: 'canopy',
		label: 'Canopy',
		css: ['canopy']
	},
	{
		name: 'meridian',
		label: 'Meridian',
		css: ['meridian', 'dark']
	},
	{
		name: 'dunes',
		label: 'Dunes',
		css: ['dunes']
	},
	{
		name: 'synthwave',
		label: 'Synthwave',
		css: ['synthwave', 'dark']
	},
	{
		name: 'firefly',
		label: 'Fireflies',
		css: ['firefly', 'dark']
	},
	{
		name: 'milkyway',
		label: 'Milky Way',
		css: ['milkyway', 'dark']
	}
] as const;

/* Defaults for first visit (no cookie). The pre-paint fallback in app.html's
   inline script hardcodes the dark default's classes — keep it in sync. */
export const DEFAULT_THEME: ThemeName = 'fallow';
export const DEFAULT_DARK_THEME: ThemeName = 'solid-dark';

const CONTEXT_KEY = Symbol();
const themeStorageKey = 'theme';
const sceneryStorageKey = 'scenerySeed';
const sceneryMotionStorageKey = 'sceneryMotion';

/* 32-bit scenery seed. The store only mints and persists the number;
   mapping it to CSS vars is presentation's job (utils/scenery-seed.ts). */
export function randomScenerySeed(): number {
	return Math.floor(Math.random() * 0x100000000);
}

export function getClassesToAdd(themeName: ThemeName): string[] {
	return themes.find((t) => t.name === themeName)?.css ?? [];
}

export class ThemeStore {
	#theme = $state<ThemeName>(DEFAULT_THEME);
	#themes: ThemeItem[] = themes;

	// per-user scenery seed: minted server-side (+layout.server.ts cookie),
	// identical on both ends so the SSR-inlined style never shifts
	#scenerySeed = $state<number>(0);

	// whether animated scenery motion is paused; cookie-backed like theme,
	// defaults to prefers-reduced-motion when no cookie says otherwise
	#sceneryPaused = $state<boolean>(false);

	#classesToAdd = $derived.by<string[]>(() => {
		return getClassesToAdd(this.#theme);
	});

	#classesToRemove = $derived.by<string[]>(() => {
		return themes.map((t) => t.css).flat();
	});

	constructor(
		initialTheme?: ThemeName,
		initialScenerySeed?: number,
		initialSceneryPaused?: boolean
	) {
		this.#scenerySeed = initialScenerySeed ?? 0;
		this.#sceneryPaused = initialSceneryPaused ?? false;

		$effect(() => {
			document.documentElement.classList.remove(...this.#classesToRemove);
			document.documentElement.classList.add(...this.#classesToAdd);
		});

		$effect(() => {
			document.documentElement.classList.toggle('scenery-paused', this.#sceneryPaused);
		});

		// no cookie means no explicit preference yet — honor the OS setting,
		// same onMount/matchMedia approach as the dark-theme default below
		if (initialSceneryPaused === undefined) {
			onMount(() => {
				const prefersReducedMotion =
					window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

				if (!prefersReducedMotion) return;

				this.#sceneryPaused = true;
			});
		}

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

	get scenerySeed() {
		return this.#scenerySeed;
	}

	get sceneryPaused() {
		return this.#sceneryPaused;
	}

	switchTheme(newTheme: ThemeName): void {
		this.#theme = newTheme;

		document.cookie = `${themeStorageKey}=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
	}

	rerollScenery(): void {
		this.#scenerySeed = randomScenerySeed();

		document.cookie = `${sceneryStorageKey}=${this.#scenerySeed}; path=/; max-age=31536000; SameSite=Lax`;
	}

	toggleSceneryMotion(): void {
		this.#sceneryPaused = !this.#sceneryPaused;

		document.cookie = `${sceneryMotionStorageKey}=${this.#sceneryPaused ? 'paused' : 'on'}; path=/; max-age=31536000; SameSite=Lax`;
	}
}

export function setThemeStore(
	initialTheme?: ThemeName,
	initialScenerySeed?: number,
	initialSceneryPaused?: boolean
): ThemeStore {
	return setContext<ThemeStore>(
		CONTEXT_KEY,
		new ThemeStore(initialTheme, initialScenerySeed, initialSceneryPaused)
	);
}

export function getThemeStore(): ThemeStore {
	return getContext<ThemeStore>(CONTEXT_KEY);
}
