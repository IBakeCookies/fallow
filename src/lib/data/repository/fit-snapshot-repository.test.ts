import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	$updateFitSnapshot,
	$readFitSnapshotsByDateRange,
} from '$lib/data/repository/fit-snapshot-repository';
import type { FitSnapshotRecord } from '$lib/data/type';

function snapshot(
	date: string,
	overrides: Partial<FitSnapshotRecord> = {},
): Omit<FitSnapshotRecord, 'createdAt'> {
	return {
		date,
		c1: 0.56,
		c2: -0.24,
		c3: 0.5,
		covariance: [
			[1, 0, 0],
			[0, 1, 0],
			[0, 0, 1],
		],
		sigma2: 0.0625,
		alphaCog: 0.35,
		alphaPhys: 0.3,
		recoveryRate: 0.7,
		stoppingValue: 0.5,
		...overrides,
	};
}

describe('fit-snapshot-repository', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('upserts on the date: re-recording the same day replaces it', async () => {
		await $updateFitSnapshot(
			snapshot('2026-01-01', {
				alphaCog: 0.4,
			}),
		);

		await $updateFitSnapshot(
			snapshot('2026-01-01', {
				alphaCog: 0.9,
			}),
		);

		const all = await $readFitSnapshotsByDateRange('2026-01-01', '2026-01-01');
		expect(all).toHaveLength(1);
		expect(all[0].alphaCog).toBe(0.9);
	});

	// Unlike the drain log's upsert, a re-record is a NEW belief about today rather
	// than a correction of one measurement, so its moment moves with it.
	it('re-recording a day refreshes createdAt', async () => {
		const first = Date.parse('2026-01-02T08:00:00Z');
		const second = Date.parse('2026-01-02T20:00:00Z');

		vi.spyOn(Date, 'now').mockReturnValue(first);
		await $updateFitSnapshot(snapshot('2026-01-02'));

		vi.spyOn(Date, 'now').mockReturnValue(second);
		await $updateFitSnapshot(snapshot('2026-01-02'));

		const [record] = await $readFitSnapshotsByDateRange('2026-01-02', '2026-01-02');
		expect(record.createdAt).toBe(second);
	});

	it('reads an inclusive date range, ascending', async () => {
		for (const date of ['2026-02-01', '2026-02-02', '2026-02-05', '2026-02-09'])
			await $updateFitSnapshot(snapshot(date));

		const range = await $readFitSnapshotsByDateRange('2026-02-02', '2026-02-05');
		expect(range.map((r) => r.date)).toEqual(['2026-02-02', '2026-02-05']);
	});

	it('is empty when the range holds no snapshot', async () => {
		expect(await $readFitSnapshotsByDateRange('1999-01-01', '1999-12-31')).toEqual([]);
	});
});
