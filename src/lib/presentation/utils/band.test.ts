import { describe, expect, it } from 'vitest';
import {
	AXIS_BAND,
	BAND_BAR_CLASS,
	BAND_TEXT_CLASS,
	BANDS,
	bandLabel,
	getBandBiggerBetter,
	getBandSmallerBetter,
	isOutOfBand,
	type Band,
} from '$lib/presentation/utils/band';

/** Every axis the advisor can search on, spelled out rather than derived from
 *  AXIS_BAND — the point is to notice when the model gains one. */
const AXES = [
	'burnoutRisk',
	'humanCapacity',
	'cognitiveLoad',
	'physicalLoad',
	'energyBalance',
	'frictionIndex',
	'grindDensity',
	'timeScarcity',
	'scheduleIntegrity',
] as const;

describe('band policy', () => {
	// AGENTS.md R3: the advice card filters findings by exactly the call that
	// colours the metric rows. Two copies of these thresholds is the failure this
	// shared table exists to prevent, so pin that they cannot disagree.
	it('surfaces advice for exactly the readings a row would colour as judged', () => {
		for (const axis of AXES) {
			for (let value = -20; value <= 200; value += 1) {
				const band = AXIS_BAND[axis](value);

				expect(isOutOfBand(axis, value), `${axis} at ${value}`).toBe(
					band === 'warning' || band === 'critical',
				);
			}
		}
	});

	it('covers every advice axis', () => {
		expect(Object.keys(AXIS_BAND).sort()).toEqual([...AXES].sort());
	});

	// The boundaries are inclusive on the good side, which is what makes exactly
	// 75% "optimal" rather than "nominal".
	it.each([
		[100, 'success'],
		[75, 'success'],
		[74.9, 'neutral'],
		[50, 'neutral'],
		[49.9, 'warning'],
		[25, 'warning'],
		[24.9, 'critical'],
		[0, 'critical'],
	])('bigger-better %s reads %s', (value, band) => {
		expect(getBandBiggerBetter(value)).toBe(band);
	});

	it.each([
		[0, 'success'],
		[25, 'success'],
		[25.1, 'neutral'],
		[50, 'neutral'],
		[50.1, 'warning'],
		[75, 'warning'],
		[75.1, 'critical'],
		[100, 'critical'],
	])('smaller-better %s reads %s', (value, band) => {
		expect(getBandSmallerBetter(value)).toBe(band);
	});

	// Human Capacity is deliberately unclamped: a plan asking for more than the
	// pools hold must read as over 100% and as critical, not saturate at nominal.
	it('calls any capacity over 100% critical, however far over', () => {
		expect(AXIS_BAND.humanCapacity(75)).toBe('success');
		expect(AXIS_BAND.humanCapacity(100)).toBe('neutral');
		expect(AXIS_BAND.humanCapacity(101)).toBe('critical');
		expect(AXIS_BAND.humanCapacity(240)).toBe('critical');
	});

	// A day's shape is not a problem in itself: load reads as 0 until it passes
	// 70%, so the band steps straight from optimal to a judgement — there is no
	// nominal middle on the way up, which is the point of masking it.
	it.each(['cognitiveLoad', 'physicalLoad'] as const)('%s stays optimal up to 70%%', (axis) => {
		expect(AXIS_BAND[axis](0)).toBe('success');
		expect(AXIS_BAND[axis](70)).toBe('success');
		expect(AXIS_BAND[axis](70.1)).toBe('warning');
		expect(AXIS_BAND[axis](76)).toBe('critical');
	});

	it('reads energy balance as a problem only when the day leans hard', () => {
		expect(AXIS_BAND.energyBalance(50)).toBe('success');
		expect(AXIS_BAND.energyBalance(60)).toBe('success');
		expect(AXIS_BAND.energyBalance(61)).toBe('warning');
		expect(AXIS_BAND.energyBalance(39)).toBe('warning');
	});

	// A missing entry would render `class="undefined"` — a value with no colour,
	// which is invisible rather than wrong-looking.
	it('has a text and a bar class for every band', () => {
		for (const band of BANDS) {
			expect(BAND_TEXT_CLASS[band]).toMatch(/^text-/);
			expect(BAND_BAR_CLASS[band]).toMatch(/^bg-/);
		}
	});

	// Colour alone cannot carry a judgement (WCAG 1.4.1), so every judged band
	// has words — and neutral, the default value colour, deliberately has none.
	it('names every judged band and stays silent on the neutral one', () => {
		expect(bandLabel('neutral')).toBeNull();

		for (const band of BANDS.filter((candidate): candidate is Band => candidate !== 'neutral')) {
			expect(bandLabel(band), band).toBeTruthy();
		}
	});
});
