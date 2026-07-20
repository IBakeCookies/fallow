import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { $updateRoutine, $readAllRoutines, $deleteRoutine } from './routine-repository';
import type { SavedRoutine } from '$lib/data/type';

function routine(id: string, name = 'Morning'): SavedRoutine {
	return { id, name, tasks: [], createdAt: 1 };
}

describe('routine-repository', () => {
	it('starts empty', async () => {
		expect(await $readAllRoutines()).toEqual([]);
	});

	it('creates and upserts by id', async () => {
		await $updateRoutine(routine('a', 'Old name'));
		await $updateRoutine(routine('a', 'New name'));
		await $updateRoutine(routine('b'));
		const all = await $readAllRoutines();
		expect(all).toHaveLength(2);
		expect(all.find((r) => r.id === 'a')?.name).toBe('New name');
	});

	it('deletes by id; deleting a missing id is a no-op', async () => {
		await $deleteRoutine('a');
		await $deleteRoutine('missing');
		expect((await $readAllRoutines()).map((r) => r.id)).toEqual(['b']);
	});
});
