import { page } from 'vitest/browser';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { SuggestedTask } from '$lib/business/model/metric/calculation';
import TaskList from '$lib/presentation/component/task-list.svelte';

const task = (id: number, title: string): SuggestedTask => ({
	id,
	title,
	physicalDifficulty: 5,
	mentalDifficulty: 5,
	enjoyment: 5,
	nature: 'balanced',
	createdAt: '2026-07-20',
	completed: false,
	suggestedHours: 1,
	priorityScore: 10,
	flowStateTime: 0.5,
	trueEffort: 6,
	trueEnjoyability: 1.5,
	peakProductivity: 1,
	avgProductivity: 0.8,
	optimalHours: 2,
});

const noop = {
	ontoggle: vi.fn(),
	onremove: vi.fn(),
};

describe('task-list.svelte', () => {
	it('shows the empty state when there are no tasks', async () => {
		render(TaskList, {
			suggestedTasks: [],
			runOrder: new Map(),
			...noop,
		});

		await expect.element(page.getByText('No tasks deployed yet')).toBeInTheDocument();
		await expect.element(page.getByText('Add a task above to begin tracking')).toBeInTheDocument();
	});

	it('renders one item per task with its run order', async () => {
		render(TaskList, {
			suggestedTasks: [task(1, 'boxing'), task(2, 'writing')],
			runOrder: new Map([
				[1, 1],
				[2, 2],
			]),
			...noop,
		});

		await expect
			.element(
				page.getByRole('heading', {
					name: 'Tasks',
				}),
			)
			.toBeInTheDocument();

		// A list, so a screen reader announces how many tasks the day holds and can
		// navigate them as items.
		await expect.element(page.getByRole('list')).toBeInTheDocument();
		expect(page.getByRole('listitem').elements()).toHaveLength(2);

		await expect.element(page.getByText('boxing')).toBeInTheDocument();
		await expect.element(page.getByText('writing')).toBeInTheDocument();
		await expect.element(page.getByText('#1')).toBeInTheDocument();
		await expect.element(page.getByText('#2')).toBeInTheDocument();
	});

	// An empty <ul> would announce "list, 0 items" over the empty-state copy.
	it('renders no list when there are no tasks', async () => {
		render(TaskList, {
			suggestedTasks: [],
			runOrder: new Map(),
			...noop,
		});

		expect(page.getByRole('list').elements()).toHaveLength(0);
	});

	// The add-task form lives in this card so adding and reading the plan are one
	// place. A read-only day passes no snippet and must not pay a gap for it.
	it('renders the add-task form above the list when one is supplied', async () => {
		render(TaskList, {
			suggestedTasks: [task(1, 'boxing')],
			runOrder: new Map([[1, 1]]),
			form: createRawSnippet(() => ({
				render: () => '<p>add a task</p>',
			})),
			...noop,
		});

		const heading = page
			.getByRole('heading', {
				name: 'Tasks',
			})
			.element();

		await expect.element(page.getByText('add a task')).toBeInTheDocument();

		expect(heading.compareDocumentPosition(document.querySelector('p')!)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		);
	});

	it('adds no form slot at all when none is supplied', async () => {
		render(TaskList, {
			suggestedTasks: [task(1, 'boxing')],
			runOrder: new Map([[1, 1]]),
			...noop,
		});

		const heading = page
			.getByRole('heading', {
				name: 'Tasks',
			})
			.element();

		// The list starts immediately after the heading: nothing — not even the
		// wrapper the snippet would sit in — stands between them.
		expect(heading.nextElementSibling?.textContent).toContain('boxing');
	});
});
