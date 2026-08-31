# The two primitives nothing imported

**Kind:** repair · **Status:** landed 2026-08-31 · **Roadmap:** the 2026-08-31
audit of the app against native HTML

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is the area `AGENTS.md`. When later work changes
the behaviour, it writes its own feature file; it does not edit this one.

## The question

`component/ui/progress` and `component/ui/collapsible` had no caller anywhere in
`src` — only their own stories. `progress.svelte` was the sharper case: a bits-ui
root and a `translateX` indicator rebuilding `<progress value max>`, an element
the browser ships.

## What was decided

**Both deleted.** Nothing imported them, so nothing changed. The bar the app does
draw — the day strip's flow bar — is not one of them and was left alone.

If a progress bar is ever asked for, it starts as `<progress>` or `<meter>` and
earns a wrapper only when a second caller needs the same one (R3).

## What was deliberately not done

- **The other `ui/` primitives were not audited for the same thing.** `dialog`,
  `tooltip`, `dropdown-menu`, `tabs`, `card`, `badge`, `button`, `number-input`
  and `sonner` all have callers.
