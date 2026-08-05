/**
 * What a task title was rated last time it was used, and which of those titles a
 * part-typed one could be — so a task the user has done before is added by
 * picking it, with all three sliders already set, instead of re-rating it.
 *
 * Enjoyment is in, and the reasoning that first left it out was a unit error
 * worth recording: the "0.052% per enjoyment point" figure is one point on one
 * task, and it was compared against a ϕ anchor measured as +0.5 h on *every*
 * task. Planning a whole day with enjoyment at its default and the difficulties
 * true costs a median 1.16% / mean 2.02% of Σ P̄ — 85% of what the two
 * difficulties are worth, and never negative on 400 probe days, where defaulting
 * the difficulties actually helped on 19. Per-point figures do not price a
 * slider that resets on every task (ROADMAP items 15 and 24).
 */

import type { DailySession } from '$lib/data/type';

export interface TitleRating {
	/**
	 * The title as it was last typed. The map's key is normalized, so this is the
	 * only spelling there is to show the user or to fill their field with.
	 */
	title: string;
	physicalDifficulty: number;
	mentalDifficulty: number;
	enjoyment: number;
}

/**
 * Characters before a part-typed title is treated as a search for one. Two, not
 * one: the match is a substring, so a single character matches most of a history
 * ("a" finds `Gym admin` and `Tax return` alike) and the list would cover the
 * sliders on every new task. Two is the first length that discriminates, and it
 * is shorter than the shortest titles anyone writes (`Gym`, `Run`), so no title
 * needs a third keystroke to be findable. A judgement, not a measurement — there
 * is no instrument for it short of real histories.
 */
export const TITLE_QUERY_MIN = 2;

/**
 * The one definition of "the same task title" (AGENTS.md R3) — the map is keyed
 * with it, every lookup goes through it, and it is what makes a query match in
 * any case or spacing. A second spelling of this rule would make a remembered
 * rating unreachable from the title that produced it.
 */
export function normalizeTitle(title: string): string {
	return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The latest rating per title across the given days, latest last. Sorted here
 * rather than trusting the caller's order: "latest" is the whole content of the
 * answer, and the repository's ascending order is a documented convenience, not
 * something a pure function should silently depend on.
 *
 * Within a day the tasks are walked **backwards**, because a day's `tasks` array
 * is newest-first — every writer in `SessionStore` prepends — so plain array order
 * would hand a title used twice in one day the rating the user had already
 * superseded. Reversed rather than sorted by `id`: ids are a clock for tasks added
 * one at a time, but an import assigns them ascending across a batch that is
 * prepended as a block, which runs opposite to the array.
 */
export function latestRatingsByTitle(sessions: DailySession[]): Map<string, TitleRating> {
	const ratings = new Map<string, TitleRating>();
	const ascending = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

	for (const session of ascending)
		for (const task of [...session.tasks].reverse()) {
			const key = normalizeTitle(task.title);

			if (!key) continue;

			ratings.set(key, {
				title: task.title,
				physicalDifficulty: task.physicalDifficulty,
				mentalDifficulty: task.mentalDifficulty,
				enjoyment: task.enjoyment,
			});
		}

	return ratings;
}

/**
 * Every rated title the query could be naming, alphabetically. Substring rather
 * than prefix because the word the user reaches for is often not the first one
 * ("gym" for "Morning gym session"), and uncapped because a cap would hide
 * titles they rated with no way to know it happened — the honest answer to a
 * list too long to read is a shorter query, or deleting this feature (ROADMAP
 * item 24's gate), not a silent top-N.
 */
export function suggestTitles(ratings: Map<string, TitleRating>, query: string): TitleRating[] {
	const needle = normalizeTitle(query);

	if (needle.length < TITLE_QUERY_MIN) return [];

	return [...ratings.entries()]
		.filter(([key]) => key.includes(needle))
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([, rating]) => rating);
}
