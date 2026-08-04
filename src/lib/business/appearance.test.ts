import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readClientAppearance } from '$lib/business/appearance';

describe('readClientAppearance', () => {
	/* The root layout calls it during SSR too, where there is no cookie jar —
	   an empty snapshot is what lets the SSR payload stand unopposed. */
	it('reads an empty snapshot with no document to read', () => {
		expect(readClientAppearance()).toEqual({
			theme: undefined,
			scenerySeed: undefined,
			sceneryPaused: undefined,
		});
	});

	describe('with a cookie jar', () => {
		const jar = (cookie: string) =>
			vi.stubGlobal('document', {
				cookie,
			});

		beforeEach(() => {
			jar('');
		});

		afterEach(() => vi.unstubAllGlobals());

		it('resolves the stored theme against the catalogue', () => {
			jar('theme=abyss; scenerySeed=42; sceneryMotion=paused');

			expect(readClientAppearance()).toEqual({
				theme: 'abyss',
				scenerySeed: 42,
				sceneryPaused: true,
			});
		});

		// Cookies outlive deploys, so the store must not be handed a dead name.
		it('drops a theme this deploy no longer has', () => {
			jar('theme=retired-theme; scenerySeed=7');

			expect(readClientAppearance()).toMatchObject({
				theme: undefined,
				scenerySeed: 7,
			});
		});
	});
});
