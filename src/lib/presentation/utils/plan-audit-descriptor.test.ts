import { describe, expect, it } from 'vitest';
import type { PlanAudit } from '$lib/business/model/plan-audit';
import { adherenceVerdict } from '$lib/presentation/utils/plan-audit-descriptor';

/** An audit whose only interesting fields are the two overlaps and the day count. */
const audit = (classicOverlap: number, energyOverlap: number, usedCount = 4): PlanAudit => ({
	usedCount,
	days: [],
	classicOverlap,
	energyOverlap,
	actualTaskSpread: 2,
	classicTaskSpread: 2,
	energyTaskSpread: 2,
});

describe('adherenceVerdict', () => {
	it('has no verdict before the audit has loaded', () => {
		expect(adherenceVerdict(null)).toBeNull();
	});

	it('has no verdict when no day could be scored', () => {
		expect(adherenceVerdict(audit(0, 0, 0))).toBeNull();
	});

	it('names the energy model when it leads by more than the tie band', () => {
		expect(adherenceVerdict(audit(0.4, 0.7))).toMatch(/energy model more closely/);
	});

	it('names the classic plan when it leads by more than the tie band', () => {
		expect(adherenceVerdict(audit(0.7, 0.4))).toMatch(/classic plan more closely/);
	});

	it('calls two equal overlaps a tie', () => {
		expect(adherenceVerdict(audit(0.5, 0.5))).toMatch(/about equally well/);
	});

	// The band is exclusive at both edges, and these assert against the measured
	// width as a LITERAL: written against the constant they would hold at any
	// value and pin none (docs/testing.md, "Writing a probe"). Built off 0 so the
	// difference is the band exactly and no float slop decides the test.
	it('calls a gap of exactly the tie band a tie, energy ahead', () => {
		expect(adherenceVerdict(audit(0, 0.2))).toMatch(/about equally well/);
	});

	it('calls a gap of exactly the tie band a tie, classic ahead', () => {
		expect(adherenceVerdict(audit(0.2, 0))).toMatch(/about equally well/);
	});

	it('names the energy model one point past the band', () => {
		expect(adherenceVerdict(audit(0, 0.21))).toMatch(/energy model more closely/);
	});

	it('names the classic plan one point past the band', () => {
		expect(adherenceVerdict(audit(0.21, 0))).toMatch(/classic plan more closely/);
	});
});
