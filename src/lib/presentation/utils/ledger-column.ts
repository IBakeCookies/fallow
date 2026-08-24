/**
 * The two task screens' column lists — labels and alignment, one definition each.
 * The header cells are rendered from these (`task-list-card.svelte`) and the
 * spanning editor row's `colspan` is their length (`task-row-shell.svelte`), so
 * the two cannot disagree about how wide the table is.
 *
 * Messages are read on each call, not baked into a module-scope table, so the
 * header follows a locale switch — the same reason `task-nature.ts` is a function.
 */

import * as m from '$lib/paraglide/messages.js';

export interface LedgerColumn {
	label: string;
	/** Right-aligned and `tabular-nums`, which is what makes a column comparable. */
	isNumeric?: boolean;
	/** The column is dropped below `sm` (`ledger-wide`), so a phone reads the ledger
	 *  without scrolling it sideways. The cell carrying the same reading takes the same
	 *  utility — `task-row-shell.svelte` for the three ratings, each screen's own
	 *  `meta` snippet for what it computes. */
	isWideOnly?: boolean;
	/** The column shows no heading by design — the Lab's hue lead and both ✎/✕ strips.
	 *  The `<th>` still carries the label for a screen reader: a header cell with no
	 *  accessible name announces an anonymous column (axe `empty-table-header`). */
	isLabelHidden?: boolean;
}

/**
 * How many leading columns are pinned when the ledger scrolls sideways (`ledger-pin`).
 * Both lists lead with the same pair — a narrow identifier, then `Task` — and it is the
 * pair rather than the identifier alone because what has to stay beside `Planned` is the
 * task's name. The header pins this many `<th>` (`task-list-card.svelte`) and the row
 * pins the matching cells (`task-row-shell.svelte`).
 */
export const PINNED_LEDGER_COLUMN_COUNT = 2;

/** `/`'s ledger: the plan's own readings, run order first. */
export function getTaskColumns(): LedgerColumn[] {
	return [
		{
			label: m.list_column_order(),
		},
		{
			label: m.list_column_task(),
		},
		{
			label: m.list_column_physical(),
			isWideOnly: true,
			isNumeric: true,
		},
		{
			label: m.list_column_mental(),
			isWideOnly: true,
			isNumeric: true,
		},
		{
			label: m.list_column_enjoyment(),
			isWideOnly: true,
			isNumeric: true,
		},
		{
			label: m.list_column_effort(),
			isWideOnly: true,
			isNumeric: true,
		},
		{
			label: m.list_column_priority(),
			isWideOnly: true,
			isNumeric: true,
		},
		{
			label: m.list_column_flow(),
			isWideOnly: true,
			isNumeric: true,
		},
		{
			label: m.list_column_stop(),
			isWideOnly: true,
			isNumeric: true,
		},
		{
			label: m.list_column_logged(),
		},
		{
			label: m.list_column_planned(),
			isNumeric: true,
		},
		{
			label: m.list_column_actions(),
			isLabelHidden: true,
		},
	];
}

/**
 * The Lab's: a peer model, so it heads only what it computes. `Prio`, `Flow @`
 * and `Stop by` are absent rather than blank — an empty cell would assert a
 * reading this mode never made (docs/features/the-row-that-became-a-table.md).
 */
export function getEnergyTaskColumns(): LedgerColumn[] {
	return [
		{
			label: m.list_column_color(),
			isLabelHidden: true,
		},
		{
			label: m.list_column_task(),
		},
		{
			label: m.list_column_physical(),
			isWideOnly: true,
			isNumeric: true,
		},
		{
			label: m.list_column_mental(),
			isWideOnly: true,
			isNumeric: true,
		},
		{
			label: m.list_column_enjoyment(),
			isWideOnly: true,
			isNumeric: true,
		},
		{
			label: m.list_column_effort(),
			isWideOnly: true,
			isNumeric: true,
		},
		{
			label: m.list_column_logged(),
		},
		{
			label: m.list_column_planned(),
			isNumeric: true,
		},
		{
			label: m.list_column_actions(),
			isLabelHidden: true,
		},
	];
}
