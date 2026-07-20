import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import {
	$exportAllStores,
	$importAllStores,
	$deleteAllStores,
	type BackupFile
} from './backup-repository';
import { $updateSession, $readSessionByDate } from './session-repository';
import { $updateFlowObservation, $readAllFlowObservations } from './flow-observation-repository';
import { DB_VERSION } from '$lib/data/storage/indexed-db';
import type { DailySession } from '$lib/data/type';

function session(date: string, overrides: Partial<DailySession> = {}): DailySession {
	return { date, tasks: [], updatedAt: 0, ...overrides } as DailySession;
}

describe('backup-repository', () => {
	it('exports every store with the schema version', async () => {
		await $updateSession(session('2026-01-01'));
		await $updateFlowObservation({
			date: '2026-01-01',
			taskId: 1,
			taskTitle: 'write',
			difficulty: 5,
			enjoyment: 5,
			E: 3,
			beta: 1.5,
			phiHours: 0.5
		});

		const backup = await $exportAllStores();

		expect(backup.app).toBe('fallow');
		expect(backup.schemaVersion).toBe(DB_VERSION);
		expect(Object.keys(backup.stores).sort()).toEqual([
			'drainObservations',
			'flowObservations',
			'restObservations',
			'routines',
			'sessions'
		]);
		expect(backup.stores.sessions).toHaveLength(1);
		expect(backup.stores.flowObservations).toHaveLength(1);
	});

	it('round-trips: import merges records back, preserving keys', async () => {
		const backup = await $exportAllStores();
		await $updateSession(session('2026-01-02'));

		await $importAllStores(backup);

		// merged: the record added after export survives, exported ones restored
		expect(await $readSessionByDate('2026-01-01')).not.toBeNull();
		expect(await $readSessionByDate('2026-01-02')).not.toBeNull();
		const flows = await $readAllFlowObservations();
		expect(flows).toHaveLength(1);
		expect(flows[0].id).toBe((backup.stores.flowObservations[0] as { id: number }).id);
	});

	it('import overwrites records sharing a key', async () => {
		const backup = await $exportAllStores();
		(backup.stores.sessions[0] as DailySession).updatedAt = 999;

		await $importAllStores(backup);

		expect((await $readSessionByDate('2026-01-01'))?.updatedAt).toBe(999);
	});

	it('rejects files that are not a Fallow backup', async () => {
		await expect($importAllStores(null)).rejects.toThrow('Not a Fallow backup file');
		await expect($importAllStores({ foo: 1 })).rejects.toThrow('Not a Fallow backup file');
		await expect($importAllStores({ app: 'fallow' })).rejects.toThrow('Not a Fallow backup file');
	});

	it('wipes every store', async () => {
		await $updateSession(session('2026-01-03'));

		await $deleteAllStores();

		const backup = await $exportAllStores();
		for (const records of Object.values(backup.stores)) expect(records).toHaveLength(0);
	});

	it('ignores unknown store names instead of failing', async () => {
		const backup = (await $exportAllStores()) as BackupFile & {
			stores: Record<string, unknown[]>;
		};
		backup.stores.futureStore = [{ id: 1 }];
		await expect($importAllStores(backup)).resolves.toBeUndefined();
	});
});
