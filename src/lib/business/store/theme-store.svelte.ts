import { getContext, setContext, onMount } from 'svelte';
// Namespace import: the $-prefixed controller methods can't be imported by
// name inside .svelte.ts files ($ is reserved for runes).
import * as appearanceRepository from '$lib/data/repository/appearance-repository';
import type { AppearanceSnapshot } from '$lib/business/appearance';
import {
	allSceneryMotionClasses,
	allThemeClasses,
	DEFAULT_DARK_THEME,
	DEFAULT_THEME,
	getClassesToAdd,
	getSceneryMotionClasses,
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
 * reactive state and the reconciliation, which is the subtle part (three
 * sources: SSR payload, cookie, OS preference). Both snapshots are
 * constructor arguments — `business/appearance.ts` reads them — so the only
 * source this class reaches for itself is the OS one, and only after mount.
 */
export class ThemeStore {
	#theme = $state<ThemeName>(DEFAULT_THEME);

	// per-user scenery seed: minted server-side (+layout.server.ts cookie),
	// identical on both ends so the SSR-inlined style never shifts
	#scenerySeed = $state<number>(0);

	// the recorded choice; undefined means none was made and stamps neither
	// class, leaving `scenery/index.css`'s guarded query the only thing deciding
	#sceneryPaused = $state<boolean | undefined>(undefined);

	// the OS setting, tracked live: it resolves `sceneryPaused` while no choice
	// is recorded, so the control labels the state the visitor is actually in
	#prefersReducedMotion = $state<boolean>(false);

	#classesToAdd = $derived.by<string[]>(() => {
		return getClassesToAdd(this.#theme);
	});

	/**
	 * @param ssr what the server rendered as — a request-time snapshot of the
	 * same cookies, which the service worker can serve back stale.
	 * @param cookies what the cookies say now. Offline that is the trustworthy
	 * one, so it wins over `ssr` for theme, motion and seed alike. Both are
	 * passed in: reading either is the layout's job, not the store's.
	 */
	constructor(ssr: AppearanceSnapshot, cookies: AppearanceSnapshot) {
		this.#scenerySeed = ssr.scenerySeed ?? 0;
		this.#sceneryPaused = cookies.sceneryPaused ?? ssr.sceneryPaused;

		// The seed repair waits for mount: hydration never re-patches the SSR'd
		// style attribute (see +layout.svelte's scenery clock), so a
		// constructor-time change would leave the DOM on the stale arrangement
		// while the state disagrees. Post-mount, the assignment reaches the DOM.
		onMount(() => {
			if (cookies.scenerySeed !== undefined && cookies.scenerySeed !== this.#scenerySeed) {
				this.#scenerySeed = cookies.scenerySeed;
			}
		});

		$effect(() => {
			document.documentElement.classList.remove(...allThemeClasses);
			document.documentElement.classList.add(...this.#classesToAdd);
		});

		$effect(() => {
			document.documentElement.classList.remove(...allSceneryMotionClasses);
			document.documentElement.classList.add(...getSceneryMotionClasses(this.#sceneryPaused));
		});

		// Tracked rather than read once: the OS setting can flip mid-session and
		// the CSS honors it immediately, so the control's label has to follow it.
		onMount(() => {
			if (!window.matchMedia) return;

			const query = window.matchMedia('(prefers-reduced-motion: reduce)');

			const sync = () => {
				this.#prefersReducedMotion = query.matches;
			};

			sync();

			query.addEventListener('change', sync);

			return () => query.removeEventListener('change', sync);
		});

		// Both arrive already resolved against the catalogue, so a snapshot naming
		// a theme this deploy deleted reads as undefined and falls through.
		const theme = cookies.theme ?? ssr.theme;

		if (theme) {
			this.#theme = theme;

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

	/** The recorded choice, or the OS setting while none is recorded. */
	get sceneryPaused() {
		return this.#sceneryPaused ?? this.#prefersReducedMotion;
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
		const isPaused = !this.sceneryPaused;

		this.#sceneryPaused = isPaused;

		appearanceRepository.$updateSceneryMotion(isPaused);
	}
}

export function setThemeStore(ssr: AppearanceSnapshot, cookies: AppearanceSnapshot): ThemeStore {
	return setContext<ThemeStore>(CONTEXT_KEY, new ThemeStore(ssr, cookies));
}

export function getThemeStore(): ThemeStore {
	return getContext<ThemeStore>(CONTEXT_KEY);
}
