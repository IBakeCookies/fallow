import { describe, it, expect, vi, beforeEach } from 'vitest';
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

function mount(props: { initialTheme?: ThemeName; initialSceneryPaused?: boolean }): ThemeStore {
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
});
