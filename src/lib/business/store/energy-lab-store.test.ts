import { describe, it, expect } from 'vitest';
import { sanitizeEnergyParams } from '$lib/business/store/energy-lab-store.svelte';
import { DEFAULT_ENERGY_PARAMS, type EnergyParams } from '$lib/business/model/zenith-energy';

const KEYS = Object.keys(DEFAULT_ENERGY_PARAMS) as (keyof EnergyParams)[];
/** Everything a hand-edited or restored blob can carry that is not a number. */
const CORRUPT_VALUES = ['abc', '0.5', NaN, Infinity, -Infinity, null, undefined, true, {}, []];

describe('sanitizeEnergyParams (R4: validate persisted params on read)', () => {
	it.each([null, undefined, 42, 'nope', true, []])(
		'falls back to the defaults for non-object input %o',
		(raw) => {
			expect(sanitizeEnergyParams(raw)).toEqual(DEFAULT_ENERGY_PARAMS);
		},
	);

	it('defaults every key an older backup did not have', () => {
		expect(sanitizeEnergyParams({})).toEqual(DEFAULT_ENERGY_PARAMS);

		expect(
			sanitizeEnergyParams({
				alphaCog: 0.42,
			}),
		).toEqual({
			...DEFAULT_ENERGY_PARAMS,
			alphaCog: 0.42,
		});
	});

	// The named threat in the doc comment: `{"recoveryRate":"abc"}` reaching the
	// model would poison every reservoir integral with NaN.
	it.each(KEYS)('rejects a corrupt %s and keeps the default', (key) => {
		for (const value of CORRUPT_VALUES) {
			const params = sanitizeEnergyParams({
				[key]: value,
			});

			expect(params[key], `${key} = ${String(value)}`).toBe(DEFAULT_ENERGY_PARAMS[key]);
		}
	});

	it('drops keys the model does not own', () => {
		const params = sanitizeEnergyParams({
			alphaCog: 0.7,
			alphaCognitive: 9,
			evil: 1,
		});

		expect(Object.keys(params).sort()).toEqual([...KEYS].sort());
		expect(params.alphaCog).toBe(0.7);
	});

	it('round-trips a fully valid object unchanged', () => {
		const stored = {
			...DEFAULT_ENERGY_PARAMS,
		};

		KEYS.forEach((key, index) => {
			stored[key] = DEFAULT_ENERGY_PARAMS[key] + (index + 1) / 100;
		});

		expect(sanitizeEnergyParams(stored)).toEqual(stored);
	});

	// Out-of-range is NOT clamped on purpose: satietyScale ≤ 0 is the documented
	// way to recover pure total output (business/model/AGENTS.md), so a clamp would delete a
	// supported configuration. Finiteness is the whole contract.
	it('preserves out-of-range but finite values', () => {
		expect(
			sanitizeEnergyParams({
				satietyScale: -1,
				terminalEnergyValue: 1e6,
			}),
		).toMatchObject({
			satietyScale: -1,
			terminalEnergyValue: 1e6,
		});
	});

	it('returns a fresh object, so editing a slider cannot mutate the defaults', () => {
		const params = sanitizeEnergyParams({});
		params.alphaCog = 99;
		expect(DEFAULT_ENERGY_PARAMS.alphaCog).not.toBe(99);
		expect(sanitizeEnergyParams({}).alphaCog).toBe(DEFAULT_ENERGY_PARAMS.alphaCog);
	});
});
