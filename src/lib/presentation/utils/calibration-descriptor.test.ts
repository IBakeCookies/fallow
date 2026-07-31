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

/** Every fit rejected, every value distinct from its default — so a row printing
 *  the wrong one of the two cannot pass by coincidence. */
const unfitted: CalibrationSnapshot = {
	flow: {
		fitted: false,
		usedCount: 0,
		phiHours: 0.5,
		defaultPhiHours: 0.75,
	},
	energy: {
		params: defaults,
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
		value: 0.44,
	},
	defaults,
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
					phiHours: 0.4,
					defaultPhiHours: 0.75,
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
					value: 0.6,
					valueStd: 0.15,
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
					value: 0.6,
				},
			},
			'en-US',
		);

		expect(rows[4].value).toBe('≈ 0.60 ± 0.00 out/h');
	});

	it('anchors each row to its default and the count that moved it', () => {
		const rows = calibrationRows(unfitted, 'en-US');

		expect(rows[0].note).toBe('default 45 min · 0 ⚡ logs');
		expect(rows[1].note).toBe('default 0.10 · 0 ratings');
		expect(rows[4].note).toBe('default 0.40 · 0 days');
	});

	it('renders the numbers in the reader locale', () => {
		expect(calibrationRows(unfitted, 'de-DE')[1].value).toBe('0,11 /h');
	});
});
