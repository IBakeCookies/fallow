import { getContext, setContext, onMount } from 'svelte';
import { browser } from '$app/environment';
// Namespace import: the $-prefixed controller methods can't be imported by
// name inside .svelte.ts files ($ is reserved for runes).
import * as appearanceRepository from '$lib/data/repository/appearance-repository';
import {
	allThemeClasses,
	DEFAULT_DARK_THEME,
	DEFAULT_THEME,
	getClassesToAdd,
	resolveThemeName,
	randomScenerySeed,
	themes,
	type ThemeName,
} from '$lib/business/model/theme';

const CONTEXT_KEY = Symbol();

/**
 * Appearance as shared reactive state: the active theme, the per-user scenery
 * seed, and whether scenery motion is paused — each mirrored into a cookie so
 * the SERVER can stamp the right classes into the HTML before first paint.
 *
 * The catalogue lives in `business/model/theme.ts` and the cookies in
 * `data/repository/appearance-repository.ts`; this class owns only the
 * reactive state and the initial-value reconciliation, which is the subtle
 * part (three sources: SSR payload, cookie, OS preference).
 */
export class ThemeStore {
	#theme = $state<ThemeName>(DEFAULT_THEME);

	// per-user scenery seed: minted server-side (+layout.server.ts cookie),
	// identical on both ends so the SSR-inlined style never shifts
	#scenerySeed = $state<number>(0);

	// whether animated scenery motion is paused; cookie-backed like theme,
	// defaults to prefers-reduced-motion when no cookie says otherwise
	#sceneryPaused = $state<boolean>(false);

	// the OS setting, tracked live: `scenery/index.css` pauses motion under it
	// with !important, so nothing the pause/resume control does can be honored
	#prefersReducedMotion = $state<boolean>(false);

	#classesToAdd = $derived.by<string[]>(() => {
		return getClassesToAdd(this.#theme);
	});

	constructor(
		initialTheme?: ThemeName,
		initialScenerySeed?: number,
		initialSceneryPaused?: boolean,
	) {
		// offline, the SW serves cached HTML whose serialized appearance may be
		// stale — the cookies are the source of truth, so they win over the SSR
		// payload for theme, motion and seed alike.
		const stored = browser ? appearanceRepository.$readAppearance() : undefined;
		const sceneryPaused = stored?.sceneryPaused ?? initialSceneryPaused;

		this.#scenerySeed = initialScenerySeed ?? 0;
		this.#sceneryPaused = sceneryPaused ?? false;

		// The seed repair waits for mount: hydration never re-patches the SSR'd
		// style attribute (see +layout.svelte's scenery clock), so a
		// constructor-time change would leave the DOM on the stale arrangement
		// while the state disagrees. Post-mount, the assignment reaches the DOM.
		onMount(() => {
			if (stored?.scenerySeed !== undefined && stored.scenerySeed !== this.#scenerySeed) {
				this.#scenerySeed = stored.scenerySeed;
			}
		});

		$effect(() => {
			document.documentElement.classList.remove(...allThemeClasses);
			document.documentElement.classList.add(...this.#classesToAdd);
		});

		$effect(() => {
			document.documentElement.classList.toggle('scenery-paused', this.#sceneryPaused);
		});

		// Tracked rather than read once: the OS setting can flip mid-session and
		// the CSS honors it immediately, so the control has to appear/disappear
		// with it. No cookie also means no explicit preference yet, in which
		// case the same query seeds the initial pause state.
		onMount(() => {
			if (!window.matchMedia) return;

			const query = window.matchMedia('(prefers-reduced-motion: reduce)');

			const sync = () => {
				this.#prefersReducedMotion = query.matches;
			};

			sync();

			if (sceneryPaused === undefined && query.matches) {
				this.#sceneryPaused = true;
			}

			query.addEventListener('change', sync);

			return () => query.removeEventListener('change', sync);
		});

		const cookieTheme = resolveThemeName(stored?.theme);

		if (cookieTheme) {
			this.#theme = cookieTheme;

			return;
		}

		// a stale cookie may still name a deleted theme — fall through to defaults
		const seededTheme = resolveThemeName(initialTheme);

		if (seededTheme) {
			this.#theme = seededTheme;

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
		return themes;
	}

	get scenerySeed() {
		return this.#scenerySeed;
	}

	get sceneryPaused() {
		return this.#sceneryPaused;
	}

	/** False while the OS asks for reduced motion — see `#prefersReducedMotion`. */
	get sceneryMotionToggleable() {
		return !this.#prefersReducedMotion;
	}

	switchTheme(newTheme: ThemeName): void {
		this.#theme = newTheme;

		appearanceRepository.$updateTheme(newTheme);
	}

	rerollScenery(): void {
		this.#scenerySeed = randomScenerySeed();

		appearanceRepository.$updateScenerySeed(this.#scenerySeed);
	}

	toggleSceneryMotion(): void {
		this.#sceneryPaused = !this.#sceneryPaused;

		appearanceRepository.$updateSceneryMotion(this.#sceneryPaused);
	}
}

export function setThemeStore(
	initialTheme?: ThemeName,
	initialScenerySeed?: number,
	initialSceneryPaused?: boolean,
): ThemeStore {
	return setContext<ThemeStore>(
		CONTEXT_KEY,
		new ThemeStore(initialTheme, initialScenerySeed, initialSceneryPaused),
	);
}

export function getThemeStore(): ThemeStore {
	return getContext<ThemeStore>(CONTEXT_KEY);
}
