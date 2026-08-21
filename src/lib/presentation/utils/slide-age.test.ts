import { describe, expect, it } from 'vitest';
import { addDays } from '$lib/business/utils/date';
import { CHRONIC_SLIDE_MIN_DAYS, getSlideDay } from '$lib/presentation/utils/slide-age';

const VIEWED = '2026-07-23';

describe('getSlideDay', () => {
	it('names the day a task carried for three days is on', () => {
		expect(getSlideDay('2026-07-20', VIEWED)).toBe(4);
	});

	it('says nothing about a task carried for two days', () => {
		expect(getSlideDay('2026-07-21', VIEWED)).toBeNull();
	});

	it('says nothing about a task added on the day in view', () => {
		expect(getSlideDay(VIEWED, VIEWED)).toBeNull();
	});

	// A browsed past day reading a task drafted for a later one: an age it never had.
	it('says nothing about a task created after the day in view', () => {
		expect(getSlideDay('2026-07-24', VIEWED)).toBeNull();
	});

	it('keeps counting past the month it started in', () => {
		expect(getSlideDay('2026-06-23', VIEWED)).toBe(31);
	});

	// The printed number is positional, never a duration: day 1 is the day the task
	// was added, so it can never contradict the calendar.
	it('prints the age plus one at every age at or above the gate', () => {
		for (let age = CHRONIC_SLIDE_MIN_DAYS; age <= 400; age++) {
			expect(getSlideDay(addDays(VIEWED, -age), VIEWED)).toBe(age + 1);
		}
	});
});
