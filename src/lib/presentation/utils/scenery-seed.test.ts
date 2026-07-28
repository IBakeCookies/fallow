import { describe, expect, it } from 'vitest';
import { sceneryStyle } from '$lib/presentation/utils/scenery-seed';

function vars(seed: number): Map<string, string> {
	return new Map(
		sceneryStyle(seed)
			.split('; ')
			.map((declaration) => {
				const separator = declaration.indexOf(': ');

				return [declaration.slice(0, separator), declaration.slice(separator + 2)];
			}),
	);
}

describe('sceneryStyle', () => {
	// The style is inlined by SSR and never re-patched on hydration, so server and
	// client must derive character-for-character the same thing from one seed.
	// Anything non-deterministic here is a FOUC or a hydration shift.
	it('derives the same style from the same seed, every time', () => {
		expect(sceneryStyle(123456789)).toBe(sceneryStyle(123456789));
		expect(sceneryStyle(0)).toBe(sceneryStyle(0));
	});

	it('gives different seeds different arrangements', () => {
		expect(sceneryStyle(1)).not.toBe(sceneryStyle(2));
	});

	// A theme draws from its own name-keyed stream so that retuning one theme
	// cannot reshuffle another's arrangement — but the table as a whole has to
	// move with the seed, or a user would see one fixed look.
	//
	// A bound, not "every var differs": the rounded jitters have only a few
	// hundred discrete outcomes each, so some var coinciding between two given
	// seeds is expected, and demanding zero collisions would go red on a retune
	// while reading like a real regression.
	it.each([
		[1, 2],
		[7, 9_999],
		[42, 2_147_483_647],
		[123_456_789, 987_654_321],
	])('varies the table between seeds %s and %s', (left, right) => {
		const first = vars(left);
		const second = vars(right);

		expect(first.size).toBeGreaterThan(0);

		const differing = [...first].filter(([name, value]) => second.get(name) !== value);

		expect(differing.length / first.size).toBeGreaterThan(0.9);
	});

	// NaN or undefined reaching a var is silent: the declaration is dropped and
	// the layer falls back to its hand-tuned default, which looks like the seed
	// simply having no effect.
	it.each([0, 1, 2 ** 31, 4294967295])('emits a usable value for every var at seed %s', (seed) => {
		for (const [name, value] of vars(seed)) {
			expect(name, value).toMatch(/^--[a-z0-9-]+$/);
			expect(value, name).not.toMatch(/NaN|undefined|Infinity/);
			expect(value.length, name).toBeGreaterThan(0);
		}
	});

	// The two whole-SVG vars are the one place the seed drives geometry rather
	// than timing, so a malformed path or an unescaped '#' would blank the layer.
	it.each(['--meridian-ribbons', '--dunes-ridges'])('renders %s as an inline SVG url', (name) => {
		const value = vars(987654321).get(name);

		expect(value).toMatch(/^url\("data:image\/svg\+xml,<svg /);
		expect(value).toMatch(/<\/svg>"\)$/);
		// Raw '#' would terminate the data URI; the colours are %23-escaped.
		expect(value).not.toContain('#');
		expect(value).not.toMatch(/NaN/);
	});
});
