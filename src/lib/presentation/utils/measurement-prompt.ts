/* Ticking a task done is the end of the session its measurements describe, so both
   measurement editors open themselves there rather than behind a hover-revealed
   button: ⚡ time-to-flow on the main page (task-item.svelte) and 🪫 end-of-session
   drain in the Energy Lab (`/energy`).

   The policy is shared because the two copies had already disagreed twice. First the
   Lab destroyed a rating being typed into another task's editor (R3); the fix — one
   page-level draft that any open editor blocks — then made the Lab's SECOND tick
   never prompt at all, while the main page prompted on every row. Both screens now
   hold one measurement editor per row and stack it with that row's ✎, so nothing but
   this row's own open prompt can hold the question back. A predicate is also the only
   way the Lab's half gets a unit test; the rest of it is a route, where nothing can
   reach it. */

/** How an editor was opened. The caret keys on it: a button press asked for the
 *  editor, so it gets focus; an editor that opened itself must not take it. */
export type EditorSource = 'button' | 'completion';

export type CompletionPromptAction = 'open' | 'withdraw' | 'none';

export function completionPromptAction(input: {
	/** true when the click completes the task, false when it un-completes one */
	finishing: boolean;
	/** the task already carries the measurement being asked for — false for a
	 *  per-SESSION measurement like 🪫 drain, where finishing a task ends a
	 *  session an earlier rating says nothing about (MATH.md §18) */
	measured: boolean;
	/** this prompt's own editor is already open on the row being toggled, where
	 *  opening again would reseed the draft. Only that one: the ✎ editor stacks
	 *  with it, and another row's is a session of its own. */
	editorOpenOnThisRow: boolean;
	/** an editor this prompt itself opened is showing for the task being toggled */
	promptOpenForThisTask: boolean;
}): CompletionPromptAction {
	// Never over work in progress: the row holds one editor, so opening REPLACES
	// what was being typed into the one already there.
	if (input.finishing) return input.measured || input.editorOpenOnThisRow ? 'none' : 'open';

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

/* The 0–10 rating fields are the same field in two paints — mind and body — and the
   capacity is spelled into three classes each. Six copies of that pair had to be
   kept in step by hand across the 🪫 editor (two) and the ☕ pre/post pairs (four).
   Full literal strings and never `border-${channel}/30`: Tailwind's scanner cannot
   see an interpolated class name, so the tinted variants would emit nothing. */
export const RATING_INPUT_CLASS = {
	mind: 'w-12 rounded-sm border border-mind/30 bg-input px-box-3xs py-text-3xs text-xs text-ty-primary outline-none focus:border-mind/60',
	body: 'w-12 rounded-sm border border-body/30 bg-input px-box-3xs py-text-3xs text-xs text-ty-primary outline-none focus:border-body/60',
} as const;
