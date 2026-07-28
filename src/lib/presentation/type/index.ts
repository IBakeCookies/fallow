/**
 * UI-only types: shapes that exist for rendering, not for the model or
 * persistence.
 */

import type { Band } from '$lib/presentation/utils/band';

/** One row/tile in the metrics dashboard. */
export interface Metric {
	/** starts a new visual section (rendered with a separator above) */
	section?: boolean;
	/** promoted out of the list to a large tile — the day's headline readings */
	headline?: boolean;
	label: string;
	value: string;
	description: string;
	/** How the reading judges; the component owns the colour and the wording. */
	band: Band;
}
