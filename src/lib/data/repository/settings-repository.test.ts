import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { $readSetting, $updateSetting } from './settings-repository';

describe('settings-repository', () => {
	it('returns undefined for a key that was never written', async () => {
		expect(await $readSetting('never-written')).toBeUndefined();
	});

	it('round-trips a value', async () => {
		await $updateSetting('energyParams', { alphaCog: 0.6, recoveryRate: 1.2 });

		expect(await $readSetting('energyParams')).toEqual({ alphaCog: 0.6, recoveryRate: 1.2 });
	});

	it('upserts: writing the same key replaces the value', async () => {
		await $updateSetting('view', 'chart');
		await $updateSetting('view', 'schedule');

		expect(await $readSetting('view')).toBe('schedule');
	});
});
