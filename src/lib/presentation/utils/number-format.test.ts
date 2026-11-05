/* A signed percent prints one way wherever it appears — the dashboard's Fallow
   Gain, the Lab's vs-classic tile, /analytics' completion-rate delta and the
   advice card's prices: "+" or "−" on a change, nothing on a tie, the decimal in
   the reader's locale. */

import { describe, expect, it } from 'vitest';
import { formatSignedPercent } from '$lib/presentation/utils/number-format';

describe('formatSignedPercent', () => {
	it('signs a gain with a plus', () => {
		expect(formatSignedPercent(3.1, 'en-US')).toBe('+3.1%');
	});

	it('signs a loss with U+2212, not a hyphen-minus', () => {
		expect(formatSignedPercent(-6.2, 'en-US')).toBe('−6.2%');
	});

	it('signs a tie with nothing', () => {
		expect(formatSignedPercent(0, 'en-US')).toBe('0%');
	});

	// `Math.round` hands vs-classic -0 for a small loss.
	it('signs a rounded-away loss with nothing', () => {
		expect(formatSignedPercent(-0, 'en-US')).toBe('0%');
	});

	it('prints a whole percent with no decimal', () => {
		expect(formatSignedPercent(8, 'en-US')).toBe('+8%');
	});

	it('prints at most one decimal', () => {
		expect(formatSignedPercent(3.14, 'en-US')).toBe('+3.1%');
	});

	it("prints the decimal in the reader's locale", () => {
		expect(formatSignedPercent(3.1, 'de-DE')).toBe('+3,1%');
	});
});
