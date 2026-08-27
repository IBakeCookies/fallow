import { describe, it, expect, vi, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import { render } from 'vitest-browser-svelte';
import Harness from '$lib/business/store/theme-store.test-harness.svelte';
import * as appearanceRepository from '$lib/data/repository/appearance-repository';
import type { AppearanceSnapshot } from '$lib/business/appearance';
import type { ThemeStore } from '$lib/business/store/theme-store.svelte';

// Only the write side is mocked: the store no longer reads cookies at all — it
// is handed both snapshots — but its writes still go through the repository.
vi.mock('$lib/data/repository/appearance-repository', () => ({
	$updateTheme: vi.fn(),
	$updateScenerySeed: vi.fn(),
	$updateSceneryMotion: vi.fn(),
}));

const snapshot = (appearance: Partial<AppearanceSnapshot> = {}): AppearanceSnapshot => ({
	theme: undefined,
	scenerySeed: undefined,
	sceneryPaused: undefined,
	...appearance,
});

function mount(ssr: Partial<AppearanceSnapshot>, cookies: Partial<AppearanceSnapshot> = {}) {
	let store!: ThemeStore;

	render(Harness, {
		ssr: snapshot(ssr),
		cookies: snapshot(cookies),
		onstore: (created: ThemeStore) => (store = created),
	});

	return store;
}

/* The service worker can serve cached HTML whose SSR'd appearance is stale, so
   the cookie — not the payload — decides what the page renders as. */
describe('ThemeStore appearance reconciliation', () => {
	it('lets the cookie override a stale SSR theme', () => {
		expect(
			mount(
				{
					theme: 'parchment',
				},
				{
					theme: 'abyss',
				},
			).theme,
		).toBe('abyss');
	});

	it('lets the cookie override a stale SSR scenery-motion setting', () => {
		expect(
			mount(
				{
					sceneryPaused: true,
				},
				{
					sceneryPaused: false,
				},
			).sceneryPaused,
		).toBe(false);

		expect(
			mount(
				{
					sceneryPaused: false,
				},
				{
					sceneryPaused: true,
				},
			).sceneryPaused,
		).toBe(true);
	});

	it('keeps the SSR value when no cookie records a preference', () => {
		expect(
			mount({
				sceneryPaused: true,
			}).sceneryPaused,
		).toBe(true);
	});

	it('lets the cookie override a stale SSR scenery seed once mounted', () => {
		expect(
			mount(
				{
					scenerySeed: 7,
				},
				{
					scenerySeed: 42,
				},
			).scenerySeed,
		).toBe(42);
	});

	it('keeps the SSR seed when no cookie records one', () => {
		expect(
			mount({
				scenerySeed: 7,
			}).scenerySeed,
		).toBe(7);
	});

	/* A cookie naming a theme this deploy deleted reaches the store as
	   undefined — appearance.ts resolves it — and must not blank the payload. */
	it('falls back to the SSR theme when the cookie contributes none', () => {
		expect(
			mount(
				{
					theme: 'abyss',
				},
				{
					theme: undefined,
				},
			).theme,
		).toBe('abyss');
	});
});

const motionClasses = () =>
	['scenery-paused', 'scenery-motion-on'].filter((name) =>
		document.documentElement.classList.contains(name),
	);

describe('ThemeStore reduced-motion seeding', () => {
	const stubReducedMotion = (matches: boolean) =>
		vi.spyOn(window, 'matchMedia').mockReturnValue({
			matches,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		} as unknown as MediaQueryList);

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('pauses scenery when the OS prefers reduced motion and no preference is stored', () => {
		stubReducedMotion(true);

		expect(
			mount({
				theme: 'fallow',
			}).sceneryPaused,
		).toBe(true);
	});

	/* No recorded choice stamps NEITHER class, leaving the guarded media query in
	   style/scenery/index.css as the only thing deciding. A store that collapsed
	   "no choice" to "not paused" would stamp the override here and unfreeze the
	   scenery for the moment before the OS reading corrects it. */
	it('stamps neither motion class when nothing is stored', () => {
		stubReducedMotion(true);

		mount({
			theme: 'fallow',
		});

		flushSync();

		expect(motionClasses()).toEqual([]);
	});

	it('stamps the override once motion is resumed against the OS preference', () => {
		stubReducedMotion(true);

		mount({
			theme: 'fallow',
		}).toggleSceneryMotion();

		flushSync();

		expect(motionClasses()).toEqual(['scenery-motion-on']);
	});

	it('keeps a stored preference over the OS setting', () => {
		stubReducedMotion(true);

		expect(
			mount(
				{
					theme: 'fallow',
				},
				{
					sceneryPaused: false,
				},
			).sceneryPaused,
		).toBe(false);
	});
});

describe('ThemeStore persistence', () => {
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
