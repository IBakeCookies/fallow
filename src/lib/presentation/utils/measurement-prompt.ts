/* Ticking a task done is the end of the session its measurements describe, so both
   measurement editors open themselves there rather than behind a hover-revealed
   button: ⚡ time-to-flow on the main page (task-item.svelte) and 🪫 end-of-session
   drain in the Energy Lab (`/energy`).

   The policy is shared because the two copies had already disagreed (R3): the Lab's
   declined to prompt only over the SAME task's open editor, so completing a second
   task destroyed a rating being typed into the first — its draft is page-level, one
   at a time. A predicate is also the only way the Lab's half gets a unit test; the
   rest of it is a route, where nothing can reach it. */

/** How an editor was opened. The caret keys on it: a button press asked for the
 *  editor, so it gets focus; an editor that opened itself must not take it. */
export type EditorSource = 'button' | 'completion';

export type CompletionPromptAction = 'open' | 'withdraw' | 'none';

export function completionPromptAction(input: {
	/** true when the click completes the task, false when it un-completes one */
	finishing: boolean;
	/** the task already carries the measurement being asked for */
	measured: boolean;
	/** any editor is open that this prompt would replace — including one on
	 *  another task, and including a different editor on the same row */
	anyEditorOpen: boolean;
	/** an editor this prompt itself opened is showing for the task being toggled */
	promptOpenForThisTask: boolean;
}): CompletionPromptAction {
	// Never over work in progress: opening reseeds the draft from stored values, so
	// prompting across an open editor silently discards what was typed into it.
	if (input.finishing) return input.measured || input.anyEditorOpen ? 'none' : 'open';

	// Un-completing un-asks the question. Only the prompt's own editor — one the user
	// opened by hand is theirs to keep.
	return input.promptOpenForThisTask ? 'withdraw' : 'none';
}

/* The two forms are the same object on screen, and their classes were already
   character-for-character identical under a comment saying "mirrors" — R3's own
   example of the thing to export. What differs stays inline: ⚡ asks for one
   number, 🪫 for three. */

export const MEASUREMENT_FORM_CLASS =
	'mt-text-xs ml-7 flex flex-wrap items-center gap-x-grid-xs gap-y-grid-2xs rounded-lg border border-flow/20 bg-surface-page/40 px-box-xs py-box-2xs text-2xs text-ty-silent';

export const MEASUREMENT_MINUTES_CLASS =
	'w-14 rounded-sm border border-flow/30 bg-input px-box-3xs py-text-3xs text-xs text-ty-primary outline-none focus:border-flow/60';
