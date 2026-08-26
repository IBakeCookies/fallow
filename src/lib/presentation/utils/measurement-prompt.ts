/* Ticking a task done is the end of the session its measurements describe, so both
   measurement editors open themselves there rather than waiting to be found: ⚡
   time-to-flow and 🪫 end-of-session drain. Both live on both screens'
   rows now (task-row-shell.svelte), and completion asks both questions — they are
   answered from the same moment and stack as two forms under the row.

   The policy is shared because the two copies had already disagreed twice. First the
   Lab destroyed a rating being typed into another task's editor (R3); the fix — one
   page-level draft that any open editor blocks — then made the Lab's SECOND tick
   never prompt at all, while the main page prompted on every row. Each row now holds
   one editor PER MEASUREMENT and stacks them with that row's ✎, so nothing but this
   row's own open prompt can hold its own question back. The two calls differ only in
   `measured`, which is the real difference between the quantities: ⚡ is one number
   per day, 🪫 one per session. A predicate is also the only way this gets a unit
   test; the rest of it is a route, where nothing can reach it. */

import type { Persisted, DrainObservationRecord } from '$lib/business/type';

/** How an editor was opened. The caret keys on it: a button press asked for the
 *  editor, so it gets focus; an editor that opened itself must not take it. */
export type EditorSource = 'button' | 'completion';

export type CompletionPromptAction = 'open' | 'withdraw' | 'none';

export function completionPromptAction(input: {
	/** true when the click completes the task, false when it un-completes one */
	finishing: boolean;
	/** the task already carries the measurement being asked for — false for a
	 *  per-SESSION measurement like 🪫 drain, where finishing a task ends a
	 *  session an earlier rating says nothing about */
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

/** One open row editor — an open editor IS its draft, so `null` is "closed", and this
 *  is everything a draft carries whichever measurement it asks for. Both are the
 *  PAGE's, keyed by task, on both screens: 🪫 must be, because a chip opens one over a
 *  draft the row may already hold, and ⚡ is because one owner is what stops the
 *  two answering the row's own lifecycle differently — which is what they did while ⚡
 *  was the row's own state (✕ then undo closed the ⚡ editor and brought the 🪫 one
 *  back). A draft whose row leaves the screen (midnight rollover, visibility re-read)
 *  is inert, since it is keyed by that task; a DELETED task's is not, because the undo
 *  restores it under its original id — so ✕ drops both drafts on both screens. */
export type EditorDraft = {
	/** Whether the caret goes to the editor — see `EditorSource`. */
	focusMinutes: boolean;
	/** Opened by the completion prompt, so un-completing withdraws it again. */
	promptedByCompletion: boolean;
};

/** ⚡ asks for one number the row already reads the day's value of, so its draft is the
 *  policy above and nothing else: the editor seeds itself from the row. */
export const newEditorDraft = (source: EditorSource): EditorDraft => ({
	focusMinutes: source === 'button',
	promptedByCompletion: source === 'completion',
});

/** 🪫's draft carries the session as well, because a chip opens one on a STORED
 *  rating — the only opening with values to put in the fields. */
export type DrainDraft = EditorDraft & {
	/** The stored rating being corrected, or undefined when this is a new session. */
	recordId?: number;
	minutes: number | null;
	mind: number | null;
	body: number | null;
};

/** A draft for a new session, empty unless something measured THIS one — the stopped
 *  timer hands in the minutes it counted. Never seeded from an earlier rating: each 🪫
 *  log describes one session, so prefilling the last one invites
 *  re-saving hours the day already counts. Corrections seed their own draft. */
export const newDrainDraft = (source: EditorSource, minutes: number | null = null): DrainDraft => ({
	...newEditorDraft(source),
	minutes,
	mind: null,
	body: null,
});

const holdsPendingMinutes = (draft: DrainDraft) =>
	draft.recordId === undefined && draft.minutes !== null;

/** The minutes a newly opened 🪫 append editor may take from the stopped timer: the
 *  reading, unless an editor already open holds it. One stop funds one log and a draft
 *  carries a COPY of the number, so the reading lives in exactly one draft at a time —
 *  two rows ticked done each opened an editor holding the same 45, and each funded a
 *  log. Closing that editor releases it again. */
export const claimPendingMinutes = (
	drafts: Record<number, DrainDraft>,
	pendingMinutes: number | null,
): number | null => (Object.values(drafts).some(holdsPendingMinutes) ? null : pendingMinutes);

/** Whether saving this draft spends the reading: only the editor that claimed it, and
 *  only while the reading is still there — a correction rewrites a session already
 *  counted, and a clock counting again is a session of its own. */
export const spendsPendingMinutes = (draft: DrainDraft, pendingMinutes: number | null) =>
	pendingMinutes !== null && holdsPendingMinutes(draft);

/** The correction: a draft over a STORED rating, opened from that rating's own chip on
 *  the row. `recordId` is what makes ✓ rewrite the session instead of appending a
 *  second one, so this is the only way to build a draft that carries it — both screens
 *  offer the chip, and a page spelling the mapping itself is how the two would drift
 *  about which fields a correction pre-fills. Focused like any button press. */
export const drainDraftFromLog = (log: Persisted<DrainObservationRecord>): DrainDraft => ({
	...newEditorDraft('button'),
	recordId: log.id,
	minutes: Math.round(log.hours * 60),
	mind: log.mindDrain,
	body: log.bodyDrain,
});

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
