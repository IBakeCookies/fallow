import { describe, it, expect } from 'vitest';
import {
	DEFAULT_DARK_THEME,
	DEFAULT_THEME,
	getClassesToAdd,
	randomScenerySeed,
	resolveThemeName,
	themes,
} from '$lib/business/model/theme';

describe('theme catalogue', () => {
	it('has a unique, non-empty identifier and class list per theme', () => {
		const names = themes.map((t) => t.name);

		expect(new Set(names).size).toBe(names.length);

		for (const theme of themes) {
			expect(theme.label.length).toBeGreaterThan(0);
			expect(theme.css.length).toBeGreaterThan(0);
		}
	});

	it('resolves both defaults — a default naming a deleted theme renders unstyled', () => {
		expect(resolveThemeName(DEFAULT_THEME)).toBe(DEFAULT_THEME);
		expect(resolveThemeName(DEFAULT_DARK_THEME)).toBe(DEFAULT_DARK_THEME);
		expect(getClassesToAdd(DEFAULT_DARK_THEME)).toContain('dark');
	});

	// A dark-theme stamp is what carries the 400-level state fills and the
	// heavier card shadow; a catalogue entry that forgets it renders its own
	// seeds over the light ones.
	it('stamps understory with .dark', () => {
		expect(resolveThemeName('understory')).toBe('understory');
		expect(getClassesToAdd('understory')).toEqual(['understory', 'dark']);
	});
});

describe('resolveThemeName', () => {
	it('accepts a known identifier', () => {
		expect(resolveThemeName('abyss')).toBe('abyss');
	});

	// Cookies outlive deploys: one written before a theme was removed still
	// names it, and casting instead of resolving renders the app unstyled.
	it('rejects an unknown or absent identifier', () => {
		expect(resolveThemeName('theme-removed-two-deploys-ago')).toBeUndefined();
		expect(resolveThemeName(undefined)).toBeUndefined();
		expect(resolveThemeName('')).toBeUndefined();
	});
});

describe('randomScenerySeed', () => {
	it('mints a non-negative 32-bit integer, as the cookie reader requires', () => {
		for (let i = 0; i < 200; i++) {
			const seed = randomScenerySeed();
			expect(Number.isInteger(seed)).toBe(true);
			expect(seed).toBeGreaterThanOrEqual(0);
			expect(seed).toBeLessThan(0x100000000);
		}
	});
});
