/**
 * UI-only types: shapes that exist for rendering, not for the model or
 * persistence.
 */

/** One row/tile in the metrics dashboard. */
export interface Metric {
	/** starts a new visual section (rendered with a separator above) */
	section?: boolean;
	/** promoted out of the list to a large tile — the day's headline readings */
	headline?: boolean;
	label: string;
	value: string;
	description: string;
	valStyle: string;
}
