import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	dataSceneryStyle,
	nowInTimeZone,
	type WallClock,
} from '$lib/presentation/utils/scenery-time';

/** 2026-07-28 22:30 UTC — a Tuesday, and past midnight in Tokyo. */
const INSTANT = Date.UTC(2026, 6, 28, 22, 30);

function at(instant: number, timeZone?: string) {
	vi.setSystemTime(instant);

	return nowInTimeZone(timeZone);
}

function vars(clock: WallClock): Record<string, number> {
	return Object.fromEntries(
		dataSceneryStyle(clock)
			.split('; ')
			.map((declaration) => {
				const [name, value] = declaration.split(': ');

				return [name, Number(value)];
			}),
	);
}

describe('nowInTimeZone', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('reads the wall clock of the requested zone', () => {
		vi.useFakeTimers();

		expect(at(INSTANT, 'UTC').hours).toBeCloseTo(22.5, 10);
		// UTC+9: the same instant is 07:30 the next morning.
		expect(at(INSTANT, 'Asia/Tokyo').hours).toBeCloseTo(7.5, 10);
		// UTC−7 in July: the previous evening.
		expect(at(INSTANT, 'America/Los_Angeles').hours).toBeCloseTo(15.5, 10);
	});

	it('rolls the date with the zone, not just the hour', () => {
		vi.useFakeTimers();

		const utc = at(INSTANT, 'UTC');
		const tokyo = at(INSTANT, 'Asia/Tokyo');

		// Tuesday in UTC, already Wednesday in Tokyo.
		expect(utc.dayOfWeek).toBe(2);
		expect(tokyo.dayOfWeek).toBe(3);
		expect(Math.floor(tokyo.dayOfYear) - Math.floor(utc.dayOfYear)).toBe(1);
	});

	// The old implementation shifted a Date's epoch to fake the local zone, which
	// moved the absolute instant with it and skewed the moon phase by up to ±12h.
	it('keeps the absolute instant unshifted in every zone', () => {
		vi.useFakeTimers();

		expect(at(INSTANT, 'UTC').epochMs).toBe(INSTANT);
		expect(at(INSTANT, 'Asia/Tokyo').epochMs).toBe(INSTANT);
		expect(at(INSTANT, 'Pacific/Kiritimati').epochMs).toBe(INSTANT);
	});

	// x-vercel-ip-timezone is absent off Vercel and arbitrary text from anywhere
	// else, so a bad zone must degrade to the runtime's clock, never throw into
	// the layout's initialisation.
	it.each(['', 'Not/AZone'])('falls back to the runtime clock for %s', (timeZone) => {
		vi.useFakeTimers();

		expect(at(INSTANT, timeZone)).toEqual(at(INSTANT));
	});

	it('counts the day of the year from the local January 1st', () => {
		vi.useFakeTimers();

		expect(at(Date.UTC(2026, 0, 1, 12, 0), 'UTC').dayOfYear).toBeCloseTo(0.5, 10);
		// 2026 is not a leap year: Dec 31 is day 364, zero-based.
		expect(at(Date.UTC(2026, 11, 31, 0, 0), 'UTC').dayOfYear).toBeCloseTo(364, 10);
	});
});

describe('dataSceneryStyle', () => {
	const clock = (hours: number, overrides: Partial<WallClock> = {}): WallClock => ({
		hours,
		dayOfWeek: 2,
		dayOfYear: 208.5,
		epochMs: INSTANT,
		...overrides,
	});

	// A NaN in a CSS var is not an error the browser reports — the declaration is
	// dropped and the layer silently falls back, or worse, half falls back.
	it.each([0, 3, 6, 12, 20.5, 23, 23.99])('emits a finite number for every var at %sh', (hours) => {
		const emitted = vars(clock(hours));

		expect(Object.keys(emitted).length).toBeGreaterThan(0);

		for (const [name, value] of Object.entries(emitted)) {
			expect(Number.isFinite(value), name).toBe(true);
		}
	});

	// The fade and the water level are read straight into opacity and a height, so
	// out-of-range values would render as an inverted or overflowing layer.
	it.each([0, 5, 6, 12, 20, 21, 23.99])('keeps the clamped vars within [0, 1] at %sh', (hours) => {
		const emitted = vars(clock(hours));

		for (const name of [
			'--sundial-t',
			'--sundial-vis',
			'--tide-level',
			'--city-dark',
			'--hourglass-level',
			'--circuit-heat',
			'--foliage-buds',
			'--foliage-summer',
			'--foliage-autumn',
		]) {
			expect(emitted[name], `${name} at ${hours}h`).toBeGreaterThanOrEqual(0);
			expect(emitted[name], `${name} at ${hours}h`).toBeLessThanOrEqual(1);
		}
	});

	it('sleeps the sundial at night and wakes the star clock', () => {
		expect(vars(clock(3))['--sundial-vis']).toBe(0);
		expect(vars(clock(3))['--polaris-vis']).toBe(1);
		expect(vars(clock(12))['--sundial-vis']).toBe(1);
		expect(vars(clock(12))['--polaris-vis']).toBe(0);
	});

	// The glass is full on the hour and runs out by :59 — the flip is the jump
	// back to 1 at the next :00, so both endpoints matter.
	it('drains the hourglass over each hour and refills on the hour mark', () => {
		expect(vars(clock(10))['--hourglass-level']).toBe(1);
		expect(vars(clock(10.5))['--hourglass-level']).toBeCloseTo(0.5, 3);
		expect(vars(clock(10 + 59 / 60))['--hourglass-level']).toBeCloseTo(1 / 60, 3);
		expect(vars(clock(11))['--hourglass-level']).toBe(1);
	});

	it('peaks the circuit heat at noon and cools it to zero at midnight', () => {
		expect(vars(clock(0))['--circuit-heat']).toBe(0);
		expect(vars(clock(12))['--circuit-heat']).toBe(1);
		// symmetric shoulders: 06:00 and 18:00 sit at the same warmth
		expect(vars(clock(6))['--circuit-heat']).toBeCloseTo(vars(clock(18))['--circuit-heat'], 10);
	});

	// The layers tell the year: buds alone in early spring, the full canopy in
	// July, the warm layer in October, a bare branch in January.
	it('walks the foliage layers through the seasons', () => {
		const season = (dayOfYear: number) =>
			vars(
				clock(12, {
					dayOfYear,
				}),
			);

		const january = season(14);
		expect(january['--foliage-buds']).toBe(0);
		expect(january['--foliage-summer']).toBe(0);
		expect(january['--foliage-autumn']).toBe(0);

		const april = season(100);
		expect(april['--foliage-buds']).toBe(1);
		expect(april['--foliage-autumn']).toBe(0);

		const july = season(208);
		expect(july['--foliage-buds']).toBe(0);
		expect(july['--foliage-summer']).toBe(1);
		expect(july['--foliage-autumn']).toBe(0);

		const october = season(290);
		expect(october['--foliage-autumn']).toBe(1);
		expect(october['--foliage-summer']).toBeLessThan(0.5);
		expect(october['--foliage-buds']).toBe(0);
	});

	// The whole field is one hour hand, so it reads as a clock only if it keeps a
	// clock's convention: up at 12, right at 3, and wrapping at noon rather than
	// at midnight. The half-hour case is the one that would pass a step function.
	it('turns the vanes to the hour hand', () => {
		expect(vars(clock(12))['--vane-angle']).toBe(0);
		expect(vars(clock(0))['--vane-angle']).toBe(0);
		expect(vars(clock(3))['--vane-angle']).toBe(90);
		expect(vars(clock(15))['--vane-angle']).toBe(90);
		expect(vars(clock(4.5))['--vane-angle']).toBe(135);
	});

	// Monday 00:00 sits at the top of the dial; the outer planet laps once a week.
	it('puts the orrery week hand at the top on Monday midnight', () => {
		expect(
			vars(
				clock(0, {
					dayOfWeek: 1,
				}),
			)['--orrery-week'],
		).toBe(0);

		expect(
			vars(
				clock(0, {
					dayOfWeek: 0,
				}),
			)['--orrery-week'],
		).toBeCloseTo((6 / 7) * 360, 1);
	});
});
