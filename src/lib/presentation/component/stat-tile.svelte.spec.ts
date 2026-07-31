import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import StatTile from '$lib/presentation/component/stat-tile.svelte';

const noteOf = (html: string) =>
	createRawSnippet(() => ({
		render: () => html,
	}));

describe('stat-tile.svelte', () => {
	it('shows the label, the reading and its suffix', async () => {
		render(StatTile, {
			label: 'Active days',
			value: 5,
			suffix: '/ 30',
			note: noteOf('<span>3 with at least one task done</span>'),
		});

		await expect.element(page.getByText('Active days')).toBeInTheDocument();
		await expect.element(page.getByText('/ 30')).toBeInTheDocument();
		await expect.element(page.getByText('3 with at least one task done')).toBeInTheDocument();
	});

	// The suffix is set smaller and quieter than the value; a tile with no unit must
	// not leave an empty one behind, which would show up as a stray space.
	it('draws no suffix when there is no unit', async () => {
		render(StatTile, {
			label: 'Avg completion rate',
			value: '71%',
			note: noteOf('<span>over the last 7 days</span>'),
		});

		await expect.element(page.getByText('71%')).toBeInTheDocument();
		expect(document.querySelectorAll('.text-base')).toHaveLength(0);
	});

	// The em-dash placeholder must not carry the ink weight of a real reading
	it('mutes a placeholder value', async () => {
		render(StatTile, {
			label: 'Best day',
			value: '—',
			muted: true,
			note: noteOf('<span>No tasks completed</span>'),
		});

		await expect.element(page.getByText('—')).toHaveClass(/text-ty-silent/);
	});

	it('keeps a real value at full ink', async () => {
		render(StatTile, {
			label: 'Best day',
			value: 'Jul 28',
			note: noteOf('<span>100% · 4 done</span>'),
		});

		await expect.element(page.getByText('Jul 28')).toHaveClass(/text-ty-primary/);
	});

	// The note is a snippet precisely so a caller can colour part of it — the
	// completion-rate delta signs itself green or red. A string prop could not.
	it('renders the note as markup, not as text', async () => {
		render(StatTile, {
			label: 'Avg completion rate',
			value: '71%',
			// createRawSnippet renders one root element, so the whole note is wrapped
			note: noteOf('<span><span class="text-success">+6%</span> vs the previous 7 days</span>'),
		});

		await expect.element(page.getByText('+6%')).toHaveClass(/text-success/);
		await expect.element(page.getByText(/vs the previous 7 days/)).toBeInTheDocument();
	});
});
