/**
 * CRUD access to the `settings` object store — named singleton settings.
 *
 * Values are returned as-is (`unknown`): validating them is the job of the
 * business-layer owner of each key, which is the only place that knows the
 * shape. See `SettingRecord`.
 */

import type { SettingRecord } from '$lib/data/type';
import { withStore } from '$lib/data/storage/indexed-db';

/** Setting key for the Energy Lab's model parameters. */
export const ENERGY_PARAMS_SETTING = 'energyParams';

export async function $readSetting(key: string): Promise<unknown> {
	const record = await withStore('settings', 'readonly', (store) => store.get(key));

	return (record as SettingRecord | undefined)?.value;
}

/** Upsert: put() replaces the record for the same key, creating it if absent. */
export async function $updateSetting(key: string, value: unknown): Promise<void> {
	await withStore('settings', 'readwrite', (store) => {
		store.put({
			key,
			value,
			updatedAt: Date.now(),
		} satisfies SettingRecord);
	});
}
