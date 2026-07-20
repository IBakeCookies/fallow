import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Task, DailySession, SavedRoutine } from '$lib/business/type';
import PageHeader from './page-header.svelte';

const task = (id: number, title: string): Task => ({
	id,
	title,
	physicalDifficulty: 3,
	mentalDifficulty: 7,
	enjoyment: 6,
	createdAt: '2026-07-19',
	completed: false
});

const yesterdaySession: DailySession = {
	date: '2026-07-19',
	tasks: [task(1, 'boxing'), task(2, 'writing')],
	availableHours: 6,
	switchCost: 0.25,
	updatedAt: 1
};

const routine: SavedRoutine = {
	id: 'r1',
	name: 'Morning',
	tasks: [{ title: 'stretch', physicalDifficulty: 4, mentalDifficulty: 1, enjoyment: 8 }],
	createdAt: 1
};

const baseProps = {
	completedTasks: 1,
	totalTasks: 3,
	selectedDate: '2026-07-20',
	today: '2026-07-20',
	ondatechange: vi.fn(),
	yesterdaySession: null as DailySession | null,
	routines: [] as SavedRoutine[],
	currentTasks: [] as Task[],
	onimport: vi.fn(),
	onsaveroutine: vi.fn(),
	ondeleteroutine: vi.fn()
};

describe('page-header.svelte', () => {
	it('shows the completed/total count and no actions when empty on today', async () => {
		render(PageHeader, baseProps);

		await expect.element(page.getByRole('heading', { name: 'Fallow' })).toBeInTheDocument();
		await expect.element(page.getByText('tasks')).toBeInTheDocument();
		await expect.element(page.getByText('1', { exact: true })).toBeInTheDocument();
		expect(page.getByRole('button', { name: 'Load' }).elements()).toHaveLength(0);
		expect(page.getByRole('button', { name: 'Save' }).elements()).toHaveLength(0);
	});

	it('offers "Return to Today" when viewing another date', async () => {
		const ondatechange = vi.fn();
		render(PageHeader, { ...baseProps, selectedDate: '2026-07-21', ondatechange });

		await page.getByRole('button', { name: 'Return to Today' }).click();

		expect(ondatechange).toHaveBeenCalledExactlyOnceWith('2026-07-20');
	});

	it('hides load/save entirely when viewing the past', async () => {
		render(PageHeader, {
			...baseProps,
			selectedDate: '2026-07-19',
			yesterdaySession,
			routines: [routine],
			currentTasks: [task(3, 'now')]
		});

		expect(page.getByRole('button', { name: 'Load' }).elements()).toHaveLength(0);
		expect(page.getByRole('button', { name: 'Save' }).elements()).toHaveLength(0);
		await expect.element(page.getByRole('button', { name: 'Return to Today' })).toBeInTheDocument();
	});

	it("imports yesterday's tasks stripped to their definition", async () => {
		const onimport = vi.fn();
		render(PageHeader, { ...baseProps, yesterdaySession, onimport });

		// the bits-ui trigger button wraps the visual Button — take the outer one
		await page.getByRole('button', { name: 'Load' }).first().click();
		await page.getByRole('menuitem', { name: /Yesterday \(2 tasks\)/ }).click();

		expect(onimport).toHaveBeenCalledExactlyOnceWith([
			{ title: 'boxing', physicalDifficulty: 3, mentalDifficulty: 7, enjoyment: 6 },
			{ title: 'writing', physicalDifficulty: 3, mentalDifficulty: 7, enjoyment: 6 }
		]);
	});

	it('imports and deletes saved routines from the load menu', async () => {
		const onimport = vi.fn();
		const ondeleteroutine = vi.fn();
		render(PageHeader, { ...baseProps, routines: [routine], onimport, ondeleteroutine });

		await page.getByRole('button', { name: 'Load' }).first().click();
		await expect.element(page.getByText('Saved Routines')).toBeInTheDocument();
		await page.getByRole('button', { name: 'Morning (1)' }).click();
		expect(onimport).toHaveBeenCalledExactlyOnceWith(routine.tasks);

		await page.getByRole('button', { name: 'Load' }).first().click();
		await page.getByRole('button', { name: 'Delete routine Morning' }).click();
		expect(ondeleteroutine).toHaveBeenCalledExactlyOnceWith('r1');
	});

	it('saves the current tasks as a named routine', async () => {
		const onsaveroutine = vi.fn();
		render(PageHeader, { ...baseProps, currentTasks: [task(3, 'now')], onsaveroutine });

		await page.getByRole('button', { name: 'Save' }).first().click();
		await page.getByPlaceholder('Routine name...').fill('  Deep work  ');
		await page.getByRole('button', { name: 'Save', exact: true }).last().click();

		expect(onsaveroutine).toHaveBeenCalledExactlyOnceWith('Deep work');
	});

	it('ignores saving a routine with a blank name', async () => {
		const onsaveroutine = vi.fn();
		render(PageHeader, { ...baseProps, currentTasks: [task(3, 'now')], onsaveroutine });

		await page.getByRole('button', { name: 'Save' }).first().click();
		await page.getByRole('button', { name: 'Save', exact: true }).last().click();

		expect(onsaveroutine).not.toHaveBeenCalled();
	});
});
