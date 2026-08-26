/* The categorical scale for one plan: the timeline bar, the schedule list and the
   task rows all colour the same task the same way, so the assignment is made once
   and handed to all three.

   The scale itself lives in the token layer (base.css --series-*), not here, so it
   is themeable in one place and pairs with --series-ink.

   These reference the raw --series-N properties from base.css :root, NOT the
   --color-series-N @theme aliases: @theme variables are tree-shaken to the ones
   Tailwind can statically see, and a name built in a template literal is invisible
   to its scanner, so the alias form would resolve to nothing here. The :root
   properties are plain CSS and always emitted. */

const REST = 'var(--series-rest)';

const PALETTE = Array.from(
	{
		length: 8,
	},
	(_, i) => `var(--series-${i + 1})`,
);

export interface SeriesColors {
	/** `null` is a rest block — not one of the tasks, and never given a hue. */
	colorOf: (taskId: number | null) => string;
}

/** Colours for one plan's tasks, assigned in plan order and wrapping past eight. */
export function seriesColors(taskIds: number[]): SeriesColors {
	const byTask = new Map(taskIds.map((id, i) => [id, PALETTE[i % PALETTE.length]]));

	return {
		colorOf: (taskId: number | null) => (taskId === null ? REST : (byTask.get(taskId) ?? REST)),
	};
}
