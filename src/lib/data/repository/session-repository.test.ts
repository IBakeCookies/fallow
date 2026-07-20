import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import {
	$updateSession,
	$readSessionByDate,
	$readSessionsByDateRange
} from './session-repository';
import type { DailySession } from '$lib/data/type';

function session(date: string, overrides: Partial<DailySession> = {}): DailySession {
	return { date, tasks: [], availableHours: 8, switchCost: 0.5, updatedAt: 0, ...overrides };
}

describe('session-repository', () => {
	it('returns null for a missing date', async () => {
		expect(await $readSessionByDate('1999-01-01')).toBeNull();
	});

	it('round-trips a session and stamps updatedAt', async () => {
		const before = Date.now();
		await $updateSession(session('2026-01-01', { availableHours: 6 }));
		const read = await $readSessionByDate('2026-01-01');
		expect(read?.availableHours).toBe(6);
		expect(read?.updatedAt).toBeGreaterThanOrEqual(before);
	});

	it('upserts: same date replaces the record', async () => {
		await $updateSession(session('2026-01-02', { availableHours: 4 }));
		await $updateSession(session('2026-01-02', { availableHours: 7 }));
		const read = await $readSessionByDate('2026-01-02');
		expect(read?.availableHours).toBe(7);
	});

	it('reads a date range inclusively, sorted ascending', async () => {
		for (const date of ['2026-02-03', '2026-02-01', '2026-02-05', '2026-01-31']) {
			await $updateSession(session(date));
		}
		const range = await $readSessionsByDateRange('2026-02-01', '2026-02-05');
		expect(range.map((s) => s.date)).toEqual(['2026-02-01', '2026-02-03', '2026-02-05']);
	});

	it('returns [] for an empty range', async () => {
		expect(await $readSessionsByDateRange('1990-01-01', '1990-12-31')).toEqual([]);
	});
});
