/**
 * The theme catalogue: every theme's identifier, display label and CSS
 * classes, plus the pure helpers over it.
 *
 * Deliberately free of runes and of any storage concern, so the SSR path
 * (`hooks.server.ts` stamps the theme class into the HTML before first paint)
 * can import it without pulling in the client-reactive store.
 */

export type ThemeName =
	| 'fallow'
	| 'fallow-dark'
	| 'solid-light'
	| 'solid-dark'
	| 'glass-light'
	| 'glass-dark'
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
	| 'eclipse'
	| 'cathedral'
	| 'orbit'
	| 'lantern-drift'
	| 'canopy'
	| 'meridian'
	| 'dunes'
	| 'synthwave'
	| 'sundial'
	| 'moonphase'
	| 'tide'
	| 'breath'
	| 'polaris'
	| 'city-windows'
	| 'orrery'
	| 'hourglass'
	| 'foliage'
	| 'circuit'
	| 'brutalist'
	| 'riso'
	| 'eink'
	| 'kintsugi'
	| 'solarized-light'
	| 'graph-pad'
	| 'verdigris'
	| 'weathervane'
	| 'vectorframe';

export interface ThemeItem {
	name: ThemeName;
	/* display name for the UI; name stays the cookie/CSS identifier */
	label: string;
	css: string[];
}

export const themes: ThemeItem[] = [
	{
		name: 'fallow',
		label: 'Fallow',
		css: ['fallow'],
	},
	{
		name: 'fallow-dark',
		label: 'Fallow Dark',
		css: ['fallow-dark', 'dark'],
	},
	{
		name: 'solid-light',
		label: 'Classic Light',
		css: ['solid-light'],
	},
	/* Two classes, because `.dark` alone is the seed every dark theme shares:
	   classic dark cannot BE it, so its opaque surfaces live in `.solid-dark`
	   (base.css). Keep name/label/css adjacent — scripts/ink-contrast.mjs and
	   hover-contrast.mjs parse this file rather than duplicate the list. */
	{
		name: 'solid-dark',
		label: 'Classic Dark',
		css: ['dark', 'solid-dark'],
	},
	{
		name: 'glass-light',
		label: 'Morning Glass',
		css: ['glass-light'],
	},
	{
		name: 'glass-dark',
		label: 'Night Glass',
		css: ['glass-dark', 'dark'],
	},
	{
		name: 'aurora',
		label: 'Aurora',
		css: ['aurora', 'dark'],
	},
	{
		name: 'daybreak',
		label: 'Daybreak',
		css: ['daybreak'],
	},
	{
		name: 'royal',
		label: 'Royal Velvet',
		css: ['royal', 'dark'],
	},
	{
		name: 'terminal',
		label: 'Terminal',
		css: ['terminal', 'dark'],
	},
	{
		name: 'blueprint',
		label: 'Blueprint',
		css: ['blueprint', 'dark'],
	},
	{
		name: 'bubblegum',
		label: 'Bubblegum',
		css: ['bubblegum'],
	},
	{
		name: 'ukiyo',
		label: 'Ukiyo-e',
		css: ['ukiyo'],
	},
	{
		name: 'abyss',
		label: 'Abyss',
		css: ['abyss', 'dark'],
	},
	{
		name: 'parchment',
		label: 'Parchment',
		css: ['parchment'],
	},
	{
		name: 'noir',
		label: 'Noir',
		css: ['noir', 'dark'],
	},
	{
		name: 'ember',
		label: 'Ember',
		css: ['ember', 'dark'],
	},
	{
		name: 'glacier',
		label: 'Glacier',
		css: ['glacier'],
	},
	{
		name: 'zenith',
		label: 'Zenith',
		css: ['zenith'],
	},
	{
		name: 'eclipse',
		label: 'Eclipse',
		css: ['eclipse', 'dark'],
	},
	{
		name: 'cathedral',
		label: 'Cathedral',
		css: ['cathedral', 'dark'],
	},
	{
		name: 'orbit',
		label: 'Orbit',
		css: ['orbit', 'dark'],
	},
	{
		name: 'lantern-drift',
		label: 'Lantern Drift',
		css: ['lantern-drift', 'dark'],
	},
	{
		name: 'canopy',
		label: 'Canopy',
		css: ['canopy'],
	},
	{
		name: 'meridian',
		label: 'Meridian',
		css: ['meridian', 'dark'],
	},
	{
		name: 'dunes',
		label: 'Dunes',
		css: ['dunes'],
	},
	{
		name: 'synthwave',
		label: 'Synthwave',
		css: ['synthwave', 'dark'],
	},
	{
		name: 'sundial',
		label: 'Sundial',
		css: ['sundial'],
	},
	{
		name: 'moonphase',
		label: 'Moonphase',
		css: ['moonphase', 'dark'],
	},
	{
		name: 'tide',
		label: 'Tide',
		css: ['tide'],
	},
	{
		name: 'breath',
		label: 'Breath',
		css: ['breath', 'dark'],
	},
	{
		name: 'polaris',
		label: 'Polaris',
		css: ['polaris', 'dark'],
	},
	{
		name: 'city-windows',
		label: 'City Windows',
		css: ['city-windows', 'dark'],
	},
	{
		name: 'orrery',
		label: 'Orrery',
		css: ['orrery', 'dark'],
	},
	{
		name: 'hourglass',
		label: 'Hourglass',
		css: ['hourglass'],
	},
	{
		name: 'foliage',
		label: 'Foliage',
		css: ['foliage'],
	},
	{
		name: 'circuit',
		label: 'Circuit',
		css: ['circuit', 'dark'],
	},
	{
		name: 'brutalist',
		label: 'Brutalist',
		css: ['brutalist'],
	},
	{
		name: 'riso',
		label: 'Riso',
		css: ['riso'],
	},
	{
		name: 'eink',
		label: 'E-ink',
		css: ['eink'],
	},
	{
		name: 'kintsugi',
		label: 'Kintsugi',
		css: ['kintsugi', 'dark'],
	},
	{
		name: 'solarized-light',
		label: 'Solarized Light',
		css: ['solarized-light'],
	},
	{
		name: 'graph-pad',
		label: 'Graph Pad',
		css: ['graph-pad'],
	},
	{
		name: 'verdigris',
		label: 'Verdigris',
		css: ['verdigris', 'dark'],
	},
	{
		name: 'weathervane',
		label: 'Weathervane',
		css: ['weathervane'],
	},
	{
		name: 'vectorframe',
		label: 'Vectorframe',
		css: ['vectorframe', 'dark'],
	},
] as const;

/* Defaults for first visit (no cookie). hooks.server.ts injects both as class
   literals for app.html's pre-paint script, so this stays the only spelling. */
export const DEFAULT_THEME: ThemeName = 'fallow';

export const DEFAULT_DARK_THEME: ThemeName = 'solid-dark';

/* 32-bit scenery seed. The store only mints and persists the number;
   mapping it to CSS vars is presentation's job (utils/scenery-seed.ts).

   The one nondeterministic function in `business/model/` — everything else here
   is pure, which is what lets the models be pinned by a `.test.ts` asserting an
   identity or a bound. It earns the exception because minting is the whole
   point and there is nothing to assert but the range; keep any new randomness
   out of the model layer, or the seam that makes the math testable goes with
   it. */
export function randomScenerySeed(): number {
	return Math.floor(Math.random() * 0x100000000);
}

export function getClassesToAdd(themeName: ThemeName): string[] {
	return themes.find((t) => t.name === themeName)?.css ?? [];
}

/** Every theme class in the catalogue — what a theme switch must strip. */
export const allThemeClasses: string[] = themes.flatMap((t) => t.css);

/**
 * What an explicit scenery-motion choice stamps on `<html>` — nothing when no
 * choice is recorded, which leaves the guarded reduced-motion query in
 * `style/scenery/index.css` deciding. The server stamp and the store's toggle
 * are one mapping (R3); the classes are priced in STYLE.md.
 */
export function getSceneryMotionClasses(isSceneryPaused: boolean | undefined): string[] {
	if (isSceneryPaused === undefined) return [];

	return [isSceneryPaused ? 'scenery-paused' : 'scenery-motion-on'];
}

/** Both motion classes — what a motion change must strip. */
export const allSceneryMotionClasses: string[] = [
	...getSceneryMotionClasses(true),
	...getSceneryMotionClasses(false),
];

/**
 * A stored/untrusted theme identifier → a known theme, or undefined.
 *
 * Cookies outlive deploys: one written before a theme was removed still names
 * it. Every read path must go through here rather than casting, or a deleted
 * theme resolves to no CSS classes and the app renders unstyled.
 */
export function resolveThemeName(candidate: string | undefined): ThemeName | undefined {
	return themes.find((t) => t.name === candidate)?.name;
}
