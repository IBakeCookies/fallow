import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { SuggestedTask } from '$lib/business/model/metric/calculation';
import TaskList from './task-list.svelte';

const task = (id: number, title: string): SuggestedTask => ({
	id,
	title,
	physicalDifficulty: 5,
	mentalDifficulty: 5,
	enjoyment: 5,
	createdAt: '2026-07-20',
	completed: false,
	suggestedHours: 1,
	priorityScore: 10,
	flowStateTime: 0.5,
	trueEffort: 6,
	trueEnjoyability: 1.5,
	peakProductivity: 1,
	avgProductivity: 0.8,
	optimalHours: 2
});

const noop = { ontoggle: vi.fn(), onremove: vi.fn() };

describe('task-list.svelte', () => {
	it('shows the empty state when there are no tasks', async () => {
		render(TaskList, { suggestedTasks: [], runOrder: new Map(), ...noop });

		await expect.element(page.getByText('No tasks deployed yet')).toBeInTheDocument();
		await expect.element(page.getByText('Add a task above to begin tracking')).toBeInTheDocument();
	});

	it('renders one item per task with its run order', async () => {
		render(TaskList, {
			suggestedTasks: [task(1, 'boxing'), task(2, 'writing')],
			runOrder: new Map([
				[1, 1],
				[2, 2]
			]),
			...noop
		});

		await expect.element(page.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument();
		await expect.element(page.getByText('boxing')).toBeInTheDocument();
		await expect.element(page.getByText('writing')).toBeInTheDocument();
		await expect.element(page.getByText('#1')).toBeInTheDocument();
		await expect.element(page.getByText('#2')).toBeInTheDocument();
	});
});
