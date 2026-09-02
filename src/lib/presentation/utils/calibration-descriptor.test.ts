import { describe, expect, it } from 'vitest';
import type { CalibrationSnapshot } from '$lib/business/session-history';
import { calibrationRows } from '$lib/presentation/utils/calibration-descriptor';

/** Only the four parameters the rows read; the rest of `EnergyParams` is not the
 *  descriptor's business. */
const defaults = {
	recoveryRate: 0.1,
	alphaCog: 0.2,
	alphaPhys: 0.3,
	freeTimeValue: 0.4,
} as CalibrationSnapshot['defaults'];

/** One point per row, so nothing is plottable unless a test says otherwise. */
const flatTrend: CalibrationSnapshot['trend'] = {
	phiHours: [0.5],
	recoveryRate: [0.11],
	alphaCog: [0.22],
	alphaPhys: [0.33],
	stoppingValue: [0.44],
};

/** Every fit rejected, every value distinct from its default — so a row printing
 *  the wrong one of the two cannot pass by coincidence. */
const unfitted: CalibrationSnapshot = {
	flow: {
		fitted: false,
		usedCount: 0,
		pendingCount: 0,
		phiHours: 0.5,
		defaultPhiHours: 0.75,
		skill: null,
	},
	energy: {
		params: defaults,
		pendingRestCount: 0,
		pendingDrainCount: 0,
		recovery: {
			fitted: false,
			usedCount: 0,
			rate: 0.11,
		},
		cognitiveDrain: {
			fitted: false,
			usedCount: 0,
			alpha: 0.22,
		},
		physicalDrain: {
			fitted: false,
			usedCount: 0,
			alpha: 0.33,
		},
	},
	stopping: {
		fitted: false,
		usedCount: 0,
		clockCensoredCount: 0,
		unreadBreaksCount: 0,
		value: 0.44,
		todayPending: false,
	},
	defaults,
	trend: flatTrend,
};

describe('calibrationRows', () => {
	it('has no rows before the snapshot has loaded', () => {
		expect(calibrationRows(null, 'en-US')).toEqual([]);
	});

	it('reports every calibrated parameter, in fit order', () => {
		expect(calibrationRows(unfitted, 'en-US').map((row) => row.label)).toEqual([
			'Time to flow · typical task',
			'Recovery rate',
			'Cognitive drain rate',
			'Physical drain rate',
			'Free-time value',
		]);
	});

	// An unfitted row must not wear ≈ or ±: that is the whole signal that the
	// number on screen is the default rather than the reader's own measurement.
	it('prints a rejected fit as a bare number with no ≈ or ±', () => {
		const rows = calibrationRows(unfitted, 'en-US');

		expect(rows[0].value).toBe('30 min');
		expect(rows[1].value).toBe('0.11 /h');
		expect(rows[3].value).toBe('0.33 /h');
		expect(rows[4].value).toBe('0.44 out/h');
	});

	it('prints a successful fit with ≈ and its posterior std', () => {
		const rows = calibrationRows(
			{
				...unfitted,
				flow: {
					fitted: true,
					usedCount: 6,
					pendingCount: 0,
					phiHours: 0.4,
					defaultPhiHours: 0.75,
					skill: null,
				},
				energy: {
					...unfitted.energy,
					recovery: {
						fitted: true,
						usedCount: 9,
						rate: 0.125,
						rateStd: 0.02,
					},
					cognitiveDrain: {
						fitted: true,
						usedCount: 7,
						alpha: 0.25,
						alphaStd: 0.05,
					},
				},
				stopping: {
					fitted: true,
					usedCount: 3,
					clockCensoredCount: 0,
					unreadBreaksCount: 0,
					value: 0.6,
					valueStd: 0.15,
					todayPending: false,
				},
			},
			'en-US',
		);

		expect(rows[0].value).toBe('≈ 24 min');
		expect(rows[1].value).toBe('≈ 0.13 ± 0.02 /h');
		expect(rows[2].value).toBe('≈ 0.25 ± 0.05 /h');
		expect(rows[4].value).toBe('≈ 0.60 ± 0.15 out/h');
	});

	// A fit reported without a std would otherwise print "± undefined"
	it('falls back to a zero std on a fit that reports none', () => {
		const rows = calibrationRows(
			{
				...unfitted,
				stopping: {
					fitted: true,
					usedCount: 3,
					clockCensoredCount: 0,
					unreadBreaksCount: 0,
					value: 0.6,
					todayPending: false,
				},
			},
			'en-US',
		);

		expect(rows[4].value).toBe('≈ 0.60 ± 0.00 out/h');
	});

	it('anchors each row to its default and the count that moved it', () => {
		const rows = calibrationRows(unfitted, 'en-US');

		expect(rows[0].note).toBe('default 45 min · 0.0 ⚡ logs, recency-weighted');
		expect(rows[1].note).toBe('default 0.10 · 0 ratings');
		expect(rows[4].note).toBe('default 0.40 · 0 days');
	});

	/* The prequential skill sentence (MATH.md §5): whether trusting the fit has
	   ever paid, in minutes per predicted ⚡ log. The gap arrives in hours and
	   signed — positive when the fit was closer — and the descriptor's whole job
	   is the spelling: one decimal of minutes, the direction said out loud. */
	it('says how much closer the fit has predicted than the default', () => {
		const rows = calibrationRows(
			{
				...unfitted,
				flow: {
					fitted: true,
					usedCount: 14,
					pendingCount: 0,
					phiHours: 0.4,
					defaultPhiHours: 0.75,
					skill: {
						gapHours: 0.1,
						scoredCount: 12,
					},
				},
			},
			'en-US',
		);

		expect(rows[0].note).toBe(
			'default 45 min · 14.0 ⚡ logs, recency-weighted · fit 6.0 min closer than default over 12 predicted logs',
		);
	});

	// A losing fit says so in the same form — never hidden, never clamped to zero.
	it('says when the fit has predicted further than the default', () => {
		const rows = calibrationRows(
			{
				...unfitted,
				flow: {
					fitted: true,
					usedCount: 14,
					pendingCount: 0,
					phiHours: 0.4,
					defaultPhiHours: 0.75,
					skill: {
						gapHours: -0.05,
						scoredCount: 8,
					},
				},
			},
			'en-US',
		);

		expect(rows[0].note).toBe(
			'default 45 min · 14.0 ⚡ logs, recency-weighted · fit 3.0 min further than default over 8 predicted logs',
		);
	});

	// Below the floor the business layer sends null, and the row reads exactly as
	// it does today — on a young fit and on a fresh profile alike.
	it('renders no skill sentence below the floor or on a fresh profile', () => {
		const young = calibrationRows(
			{
				...unfitted,
				flow: {
					fitted: true,
					usedCount: 3.5,
					pendingCount: 0,
					phiHours: 0.4,
					defaultPhiHours: 0.75,
					skill: null,
				},
			},
			'en-US',
		);

		expect(young[0].note).toBe('default 45 min · 3.5 ⚡ logs, recency-weighted');

		const fresh = calibrationRows(unfitted, 'en-US');

		expect(fresh[0].note).toBe('default 45 min · 0.0 ⚡ logs, recency-weighted');
	});

	// The ϕ row alone is recency-weighted (MATH.md §5.2), so its count is an
	// effective one — fractional, and below the ⚡ logs the user actually has.
	// The other rows count whole observations and must keep saying so.
	it('prints the flow count as a fractional weighted total', () => {
		const rows = calibrationRows(
			{
				...unfitted,
				flow: {
					fitted: true,
					usedCount: 3.5,
					pendingCount: 0,
					phiHours: 0.4,
					defaultPhiHours: 0.75,
					skill: null,
				},
			},
			'en-US',
		);

		expect(rows[0].note).toBe('default 45 min · 3.5 ⚡ logs, recency-weighted');
		expect(rows[1].note).toBe('default 0.10 · 0 ratings');
	});

	// A log made today is in neither count — Σw is what the fit read,
	// and the fit has not read it. Naming it is the difference between "your ⚡ did
	// nothing" and "your ⚡ lands tomorrow".
	it('names the logs no fit has counted yet, rather than folding them in', () => {
		const rows = calibrationRows(
			{
				...unfitted,
				flow: {
					fitted: true,
					usedCount: 3.5,
					pendingCount: 2,
					phiHours: 0.4,
					defaultPhiHours: 0.75,
					skill: null,
				},
			},
			'en-US',
		);

		expect(rows[0].note).toBe(
			'default 45 min · 3.5 ⚡ logs, recency-weighted · 2 logged today, counted from tomorrow',
		);

		// One row's concern only — the other four count whole observations.
		expect(rows[1].note).toBe('default 0.10 · 0 ratings');
	});

	// The other four rows defer their logs on the same rule the ϕ row does, and
	// were silent about it: a ☕ logged this morning left the Recovery row's count
	// unmoved, which reads as a log that was dropped.
	it('names a ☕ logged today on the recovery row', () => {
		const rows = calibrationRows(
			{
				...unfitted,
				energy: {
					...unfitted.energy,
					pendingRestCount: 1,
				},
			},
			'en-US',
		);

		expect(rows[1].note).toBe(
			'default 0.10 · 0 ratings · 1 ☕ logged today, counted from tomorrow',
		);
	});

	// Both α fits read the same 🪫 rows, so both rows name the same number.
	it('names the 🪫 logged today on both drain rows', () => {
		const rows = calibrationRows(
			{
				...unfitted,
				energy: {
					...unfitted.energy,
					pendingDrainCount: 2,
				},
			},
			'en-US',
		);

		expect(rows[2].note).toBe(
			'default 0.20 · 0 ratings · 2 🪫 logged today, counted from tomorrow',
		);

		expect(rows[3].note).toBe(
			'default 0.30 · 0 ratings · 2 🪫 logged today, counted from tomorrow',
		);
	});

	// λ₀ reads whole DAYS, and the only date that can be deferred is today — so
	// this row names the day rather than a count that can never reach two.
	it('names today on the free-time row when the day will become an observation', () => {
		const rows = calibrationRows(
			{
				...unfitted,
				stopping: {
					...unfitted.stopping,
					todayPending: true,
				},
			},
			'en-US',
		);

		expect(rows[4].note).toBe('default 0.40 · 0 days · today counts from tomorrow');
	});

	// A pin: with nothing deferred the four notes are the strings the card
	// already prints, so the clause cannot leak onto a row that has nothing to say.
	it('leaves a row with nothing deferred printing the note it prints today', () => {
		const rows = calibrationRows(unfitted, 'en-US');

		expect(rows[1].note).toBe('default 0.10 · 0 ratings');
		expect(rows[2].note).toBe('default 0.20 · 0 ratings');
		expect(rows[3].note).toBe('default 0.30 · 0 ratings');
		expect(rows[4].note).toBe('default 0.40 · 0 days');
	});

	it('renders the numbers in the reader locale', () => {
		expect(calibrationRows(unfitted, 'de-DE')[1].value).toBe('0,11 /h');
	});

	// The sparkline of each fit over the recorded days.
	describe('trend', () => {
		it('offers no line until there are two recorded days to join', () => {
			expect(calibrationRows(unfitted, 'en-US').map((row) => row.trend)).toEqual([
				null,
				null,
				null,
				null,
				null,
			]);
		});

		it('carries each row its own series, anchored to that row default', () => {
			const rows = calibrationRows(
				{
					...unfitted,
					trend: {
						phiHours: [0.6, 0.5],
						recoveryRate: [0.09, 0.11],
						alphaCog: [0.2, 0.22],
						alphaPhys: [0.3, 0.33],
						stoppingValue: [0.4, 0.44],
					},
				},
				'en-US',
			);

			expect(rows[0].trend?.values).toEqual([0.6, 0.5]);
			// ϕ is anchored to the DEFAULT ϕ, not to a raw EnergyParams field
			expect(rows[0].trend?.defaultValue).toBe(0.75);
			expect(rows[1].trend?.values).toEqual([0.09, 0.11]);
			expect(rows[1].trend?.defaultValue).toBe(0.1);
			expect(rows[3].trend?.defaultValue).toBe(0.3);
			expect(rows[4].trend?.values).toEqual([0.4, 0.44]);
			expect(rows[4].trend?.defaultValue).toBe(0.4);
		});

		// A line with no numbers tells a screen reader nothing, so the label says
		// where the fit started, where it is now, and over how many days.
		it('names the series in the row unit, first value to last', () => {
			const rows = calibrationRows(
				{
					...unfitted,
					trend: {
						...flatTrend,
						phiHours: [0.6, 0.55, 0.5],
						recoveryRate: [0.09, 0.1, 0.11],
					},
				},
				'en-US',
			);

			expect(rows[0].trend?.ariaLabel).toBe(
				'Time to flow · typical task over the last 3 recorded days: 36 min to 30 min',
			);

			expect(rows[1].trend?.ariaLabel).toBe(
				'Recovery rate over the last 3 recorded days: 0.09 /h to 0.11 /h',
			);
		});
	});
});
