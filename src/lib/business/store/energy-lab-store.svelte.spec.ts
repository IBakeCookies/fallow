import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from 'vitest-browser-svelte';
import { flushSync } from 'svelte';
import Harness from '$lib/business/store/energy-lab-store.test-harness.svelte';
import {
	drainRecord,
	mockObservations,
	mockSession,
	restRecord,
} from '$lib/business/store/energy-lab-store.test-utils.svelte';
import * as settingsRepository from '$lib/data/repository/settings-repository';
import * as sessionHistory from '$lib/business/store/session-history';
import type { EnergyLabStore } from '$lib/business/store/energy-lab-store.svelte';
import {
	DEFAULT_ENERGY_PARAMS,
	fitDrainRate,
	type StopObservation,
} from '$lib/business/model/zenith-energy';
import { toCognitiveDrainObservations } from '$lib/business/model/energy-calibration';

vi.mock('$lib/data/repository/settings-repository', () => ({
	ENERGY_PARAMS_SETTING: 'energyParams',
	$readSetting: vi.fn(async () => undefined),
	$updateSetting: vi.fn(async () => {}),
}));

vi.mock('$lib/business/store/session-history', () => ({
	readStopObservations: vi.fn(async () => []),
}));

const readSettingMock = vi.mocked(settingsRepository.$readSetting);
const updateSettingMock = vi.mocked(settingsRepository.$updateSetting);
const readStopObservationsMock = vi.mocked(sessionHistory.readStopObservations);

const stopObservation = (windowHours: number): StopObservation => ({
	tasks: [],
	windowHours,
	workedHours: [],
});

/**
 * Mount the Lab and settle the load. Reading the persisted params re-arms the
 * autosave effect, so the initial write is awaited and dropped here — every
 * test below asserts on writes it caused itself.
 */
async function setup(): Promise<EnergyLabStore> {
	let store!: EnergyLabStore;

	render(Harness, {
		onstore: (s: EnergyLabStore) => (store = s),
	});

	await vi.waitFor(() => expect(store.isLoaded).toBe(true));

	await vi.waitFor(() => expect(updateSettingMock).toHaveBeenCalled(), {
		timeout: 3000,
	});

	updateSettingMock.mockClear();

	return store;
}

function useFakeTimers() {
	vi.useFakeTimers({
		toFake: ['setTimeout', 'clearTimeout'],
	});
}

describe('EnergyLabStore', () => {
	beforeEach(() => {
		mockSession.reset();
		mockObservations.reset();
		readSettingMock.mockReset().mockResolvedValue(undefined);
		updateSettingMock.mockReset().mockResolvedValue(undefined);
		readStopObservationsMock.mockReset().mockResolvedValue([]);
	});

	afterEach(() => {
		vi.useRealTimers();
		delete (document as { hidden?: boolean }).hidden; // restore the prototype getter
	});

	it('loads the persisted params through the sanitizer', async () => {
		readSettingMock.mockResolvedValue({
			alphaCog: 0.9,
			recoveryRate: 'abc',
		});

		const store = await setup();

		expect(store.params.alphaCog).toBe(0.9);
		expect(store.params.recoveryRate).toBe(DEFAULT_ENERGY_PARAMS.recoveryRate);
	});

	// AGENTS.md §3: "A fit never writes params silently." The whole point of the
	// Apply buttons is that the sliders stay the user's.
	it('computes the fits without touching the params', async () => {
		const store = await setup();

		mockObservations.drainObservations = [
			drainRecord(),
			drainRecord({
				hours: 2,
				mindDrain: 8,
			}),
		];

		mockObservations.restObservations = [restRecord()];
		flushSync();

		expect(store.cognitiveDrainFit.fitted).toBe(true);
		expect(store.recoveryFit.fitted).toBe(true);
		// The fits genuinely moved, so the assertions below are not vacuous.
		expect(store.cognitiveDrainFit.alpha).not.toBeCloseTo(DEFAULT_ENERGY_PARAMS.alphaCog, 2);
		expect(store.recoveryFit.rate).not.toBeCloseTo(DEFAULT_ENERGY_PARAMS.recoveryRate, 2);

		expect(store.params.alphaCog).toBe(DEFAULT_ENERGY_PARAMS.alphaCog);
		expect(store.params.alphaPhys).toBe(DEFAULT_ENERGY_PARAMS.alphaPhys);
		expect(store.params.recoveryRate).toBe(DEFAULT_ENERGY_PARAMS.recoveryRate);
		expect(store.drainFitApplied).toBe(false);
		expect(store.recoveryFitApplied).toBe(false);
	});

	it('copies a fit into the manual inputs only when its Apply is pressed', async () => {
		const store = await setup();

		mockObservations.drainObservations = [
			drainRecord(),
			drainRecord({
				hours: 2,
				mindDrain: 8,
			}),
		];

		mockObservations.restObservations = [restRecord()];
		readStopObservationsMock.mockResolvedValue([stopObservation(8), stopObservation(6)]);
		flushSync();
		await vi.waitFor(() => expect(store.stopObservationCount).toBe(2));

		const round2 = (x: number) => Math.round(x * 100) / 100;

		store.applyDrainFit();
		flushSync();
		expect(store.params.alphaCog).toBe(round2(store.cognitiveDrainFit.alpha));
		expect(store.params.alphaPhys).toBe(round2(store.physicalDrainFit.alpha));
		expect(store.drainFitApplied).toBe(true);

		store.applyRecoveryFit();
		flushSync();
		expect(store.params.recoveryRate).toBe(round2(store.recoveryFit.rate));
		expect(store.recoveryFitApplied).toBe(true);

		store.applyStoppingFit();
		flushSync();
		expect(store.stoppingFitApplied).toBe(true);

		if (store.stoppingFit.fitted) {
			expect(store.params.freeTimeValue).toBe(round2(store.stoppingFit.value));
		}
	});

	// R3: the Lab and the Burnout Risk facade must read identical logs the same
	// way — only their fit SEQUENCE differs.
	it('maps drain records through the shared calibration mapping', async () => {
		const store = await setup();

		const records = [
			drainRecord(),
			drainRecord({
				hours: 2,
				cognitiveDemand: 0.6,
				mindDrain: 7,
			}),
		];

		mockObservations.drainObservations = records;
		flushSync();

		expect(store.cognitiveDrainFit).toEqual(
			fitDrainRate(
				toCognitiveDrainObservations(records),
				DEFAULT_ENERGY_PARAMS.alphaCog,
				store.params,
			),
		);
	});

	it('debounces the param autosave into a single write of the last value', async () => {
		const store = await setup();
		useFakeTimers();

		store.setParam('alphaCog', 0.4);
		flushSync();
		store.setParam('alphaCog', 0.6);
		flushSync();
		expect(updateSettingMock).not.toHaveBeenCalled();

		vi.advanceTimersByTime(499);
		expect(updateSettingMock).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(updateSettingMock).toHaveBeenCalledTimes(1);

		expect(updateSettingMock.mock.calls[0][1]).toMatchObject({
			alphaCog: 0.6,
		});
	});

	// The regression: /energy builds its own store, so leaving the page inside
	// the debounce window used to drop the edit outright.
	it('flushes the pending param write when the page is left', async () => {
		const store = await setup();
		useFakeTimers();

		store.setParam('satietyScale', 0.9);
		flushSync();
		expect(updateSettingMock).not.toHaveBeenCalled();

		cleanup();

		expect(updateSettingMock).toHaveBeenCalledTimes(1);

		expect(updateSettingMock.mock.calls[0][1]).toMatchObject({
			satietyScale: 0.9,
		});

		// …and the flushed write is not repeated by the timer that was pending.
		vi.advanceTimersByTime(1000);
		expect(updateSettingMock).toHaveBeenCalledTimes(1);
	});

	it('flushes the pending param write when the tab hides', async () => {
		const store = await setup();
		useFakeTimers();

		// Must differ from the default, or the assignment is not a state change and
		// the autosave effect never re-runs — the test would pass vacuously.
		expect(DEFAULT_ENERGY_PARAMS.terminalEnergyValue).not.toBe(2.5);
		store.setParam('terminalEnergyValue', 2.5);
		flushSync();
		expect(updateSettingMock).not.toHaveBeenCalled();

		Object.defineProperty(document, 'hidden', {
			value: true,
			configurable: true,
		});

		document.dispatchEvent(new Event('visibilitychange'));

		expect(updateSettingMock).toHaveBeenCalledTimes(1);

		expect(updateSettingMock.mock.calls[0][1]).toMatchObject({
			terminalEnergyValue: 2.5,
		});
	});

	it('surfaces a failed param write on the session store', async () => {
		const store = await setup();
		updateSettingMock.mockRejectedValueOnce(new Error('QuotaExceededError'));

		store.setParam('alphaPhys', 0.5);
		flushSync();

		await vi.waitFor(() => expect(mockSession.storageErrors).toBe(1));
	});

	// The stop-observation read is async and re-runs whenever the drain logs
	// change, so completions can land out of order.
	it('drops a stale stop-observation load that resolves after a newer one', async () => {
		let resolveStale!: (value: StopObservation[]) => void;

		readStopObservationsMock.mockReturnValueOnce(
			new Promise<StopObservation[]>((resolve) => (resolveStale = resolve)),
		);

		const store = await setup();

		readStopObservationsMock.mockResolvedValue([stopObservation(8), stopObservation(6)]);
		mockObservations.drainObservations = [drainRecord()]; // re-triggers the read
		flushSync();
		await vi.waitFor(() => expect(store.stopObservationCount).toBe(2));

		resolveStale([stopObservation(4)]);
		await vi.waitFor(() => expect(readStopObservationsMock).toHaveBeenCalledTimes(2));
		expect(store.stopObservationCount).toBe(2);
	});
});
