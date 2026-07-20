import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TaskForm from './task-form.svelte';

describe('task-form.svelte', () => {
	it('starts collapsed when startOpen is false and expands on click', async () => {
		render(TaskForm, { onsubmit: vi.fn(), startOpen: false });

		const addButton = page.getByRole('button', { name: '+ Add Task' });
		await expect.element(addButton).toBeInTheDocument();
		await addButton.click();

		await expect.element(page.getByLabelText('Task Definition')).toBeInTheDocument();
	});

	it('collapses back to the add row', async () => {
		render(TaskForm, { onsubmit: vi.fn() });

		await page.getByRole('button', { name: 'Collapse task form' }).click();

		await expect.element(page.getByRole('button', { name: '+ Add Task' })).toBeInTheDocument();
	});

	it('submits trimmed title with slider values and resets the draft', async () => {
		const onsubmit = vi.fn();
		render(TaskForm, { onsubmit });

		const title = page.getByLabelText('Task Definition');
		await title.fill('  Boxing training  ');
		await page.getByRole('button', { name: 'Deploy Task' }).click();

		expect(onsubmit).toHaveBeenCalledExactlyOnceWith({
			title: 'Boxing training',
			physicalDifficulty: 5,
			mentalDifficulty: 5,
			enjoyment: 5
		});
		await expect.element(title).toHaveValue('');
	});

	it('does not submit an empty title', async () => {
		const onsubmit = vi.fn();
		render(TaskForm, { onsubmit });

		await page.getByRole('button', { name: 'Deploy Task' }).click();

		expect(onsubmit).not.toHaveBeenCalled();
	});
});
