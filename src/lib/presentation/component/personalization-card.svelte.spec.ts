import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { FlowObservationRecord } from '$lib/business/type';
import PersonalizationCard from './personalization-card.svelte';

const log = (id: number, taskTitle: string, phiHours: number): FlowObservationRecord => ({
	id,
	date: '2026-07-19',
	taskId: id,
	taskTitle,
	difficulty: 6,
	enjoyment: 7,
	E: 3,
	beta: 1.7,
	phiHours,
	createdAt: id
});

const logs = [log(1, 'boxing', 0.5), log(2, 'writing', 0.25)];

describe('personalization-card.svelte', () => {
	it('is inert without flow logs', async () => {
		render(PersonalizationCard, { modelStatus: 'Using article defaults' });

		await expect
			.element(page.getByRole('button', { name: 'Using article defaults' }))
			.toBeDisabled();
	});

	it('expands to list logs newest-first with measured flow minutes', async () => {
		render(PersonalizationCard, { modelStatus: 'Personalized from 2 flow logs', flowLogs: logs });

		await page.getByRole('button', { name: /Personalized from 2 flow logs/ }).click();

		await expect.element(page.getByText('· boxing')).toBeInTheDocument();
		await expect.element(page.getByText('⚡ 30m')).toBeInTheDocument();
		const titles = [...document.querySelectorAll('li')].map((li) => li.textContent);
		expect(titles[0]).toContain('writing');
		expect(titles[1]).toContain('boxing');
	});

	it('deletes a single log by id', async () => {
		const ondeletelog = vi.fn();
		render(PersonalizationCard, { modelStatus: 'status', flowLogs: logs, ondeletelog });

		await page.getByRole('button', { name: /status/ }).click();
		await page.getByRole('button', { name: 'Delete this flow log' }).first().click();

		// list is newest-first, so the first ✕ belongs to log id 2
		expect(ondeletelog).toHaveBeenCalledExactlyOnceWith(2);
	});

	it('resets all logs only after confirmation', async () => {
		const onresetlogs = vi.fn();
		render(PersonalizationCard, { modelStatus: 'status', flowLogs: logs, onresetlogs });

		await page.getByRole('button', { name: /status/ }).click();
		await page.getByRole('button', { name: 'Reset personalization' }).click();
		expect(onresetlogs).not.toHaveBeenCalled();

		await expect
			.element(page.getByText('Delete all 2 logs and revert to defaults?'))
			.toBeInTheDocument();
		await page.getByRole('button', { name: 'Reset', exact: true }).click();

		expect(onresetlogs).toHaveBeenCalledOnce();
	});
});
