import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Harness from '$lib/business/store/theme-store.test-harness.svelte';
import * as appearanceRepository from '$lib/data/repository/appearance-repository';
import type { ThemeStore } from '$lib/business/store/theme-store.svelte';
import type { ThemeName } from '$lib/business/model/theme';

vi.mock('$lib/data/repository/appearance-repository', () => ({
	$readAppearance: vi.fn(() => ({
		theme: undefined,
		scenerySeed: undefined,
		sceneryPaused: undefined,
	})),
	$updateTheme: vi.fn(),
	$updateScenerySeed: vi.fn(),
	$updateSceneryMotion: vi.fn(),
}));

const readAppearanceMock = vi.mocked(appearanceRepository.$readAppearance);

const storeCookie = (appearance: Partial<appearanceRepository.StoredAppearance>) =>
	readAppearanceMock.mockReturnValue({
		theme: undefined,
		scenerySeed: undefined,
		sceneryPaused: undefined,
		...appearance,
	});

function mount(props: {
	initialTheme?: ThemeName;
	initialScenerySeed?: number;
	initialSceneryPaused?: boolean;
}): ThemeStore {
	let store!: ThemeStore;

	render(Harness, {
		...props,
		onstore: (created: ThemeStore) => (store = created),
	});

	return store;
}

/* The service worker can serve cached HTML whose SSR'd appearance is stale, so
   the cookie — not the payload — decides what the page renders as. */
describe('ThemeStore appearance reconciliation', () => {
	beforeEach(() => {
		storeCookie({});
	});

	it('lets the cookie override a stale SSR theme', async () => {
		storeCookie({
			theme: 'abyss',
		});

		expect(
			mount({
				initialTheme: 'parchment',
			}).theme,
		).toBe('abyss');
	});

	it('lets the cookie override a stale SSR scenery-motion setting', async () => {
		storeCookie({
			sceneryPaused: false,
		});

		expect(
			mount({
				initialSceneryPaused: true,
			}).sceneryPaused,
		).toBe(false);

		storeCookie({
			sceneryPaused: true,
		});

		expect(
			mount({
				initialSceneryPaused: false,
			}).sceneryPaused,
		).toBe(true);
	});

	it('keeps the SSR value when no cookie records a preference', async () => {
		expect(
			mount({
				initialSceneryPaused: true,
			}).sceneryPaused,
		).toBe(true);
	});

	it('lets the cookie override a stale SSR scenery seed once mounted', () => {
		storeCookie({
			scenerySeed: 42,
		});

		expect(
			mount({
				initialScenerySeed: 7,
			}).scenerySeed,
		).toBe(42);
	});

	it('keeps the SSR seed when no cookie records one', () => {
		expect(
			mount({
				initialScenerySeed: 7,
			}).scenerySeed,
		).toBe(7);
	});

	it('falls back to the SSR theme when the cookie names a deleted theme', () => {
		storeCookie({
			theme: 'retired-theme',
		});

		expect(
			mount({
				initialTheme: 'abyss',
			}).theme,
		).toBe('abyss');
	});
});

describe('ThemeStore reduced-motion seeding', () => {
	const stubReducedMotion = (matches: boolean) =>
		vi.spyOn(window, 'matchMedia').mockReturnValue({
			matches,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		} as unknown as MediaQueryList);

	beforeEach(() => {
		storeCookie({});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('pauses scenery when the OS prefers reduced motion and no preference is stored', () => {
		stubReducedMotion(true);

		const store = mount({
			initialTheme: 'fallow',
		});

		expect(store.sceneryPaused).toBe(true);
		expect(store.sceneryMotionToggleable).toBe(false);
	});

	it('keeps a stored preference over the OS setting', () => {
		stubReducedMotion(true);

		storeCookie({
			sceneryPaused: false,
		});

		expect(
			mount({
				initialTheme: 'fallow',
			}).sceneryPaused,
		).toBe(false);
	});
});

describe('ThemeStore persistence', () => {
	beforeEach(() => {
		storeCookie({});
	});

	it('writes each control change through the repository', () => {
		const store = mount({});

		store.switchTheme('abyss');
		expect(store.theme).toBe('abyss');
		expect(appearanceRepository.$updateTheme).toHaveBeenCalledWith('abyss');

		store.rerollScenery();
		expect(appearanceRepository.$updateScenerySeed).toHaveBeenCalledWith(store.scenerySeed);

		store.toggleSceneryMotion();
		expect(store.sceneryPaused).toBe(true);
		expect(appearanceRepository.$updateSceneryMotion).toHaveBeenCalledWith(true);
	});
});
