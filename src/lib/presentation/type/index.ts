/**
 * UI-only types: shapes that exist for rendering, not for the model or
 * persistence.
 */

/** One row/tile in the metrics dashboard. */
export interface Metric {
	/** starts a new visual section (rendered with a separator above) */
	section?: boolean;
	label: string;
	value: string;
	description: string;
	valStyle: string;
}
