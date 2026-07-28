# STYLE.md — styling rules for Fallow

Read this before touching markup, classes, or anything under
`src/lib/presentation/style/`. It is the styling half of
[AGENTS.md](../../../../AGENTS.md) §2 and binds the same way.

- Stylesheets live in `src/lib/presentation/style/`, never in `src/routes/`.
  `app.css` is the only entry (imported by the root layout); its import order
  is the cascade order and is load-bearing:

  | File            | Owns                                                       |
  | --------------- | ---------------------------------------------------------- |
  | `scenery/*.css` | one decorative layer per animated theme                    |
  | `tokens.css`    | `@custom-variant` + `@theme inline` — what utilities exist |
  | `base.css`      | `:root` defaults, `@layer base`, `.dark`                   |
  | `themes.css`    | one palette class per theme, overriding `base.css`         |

- Semantic Tailwind tokens from `tokens.css` only — no raw palette classes
  (`text-zinc-400`) in components, including class strings built in `.ts`
  helpers.
- **Never `dark:` in a component.** It does match — `@custom-variant dark
(&:is(.dark *))` in `tokens.css`, and 21 of the 37 themes stamp `.dark`
  (`abyss`, `noir`, `meridian`, `terminal` among them) — and that is the
  problem: a **binary** over 37 distinct palettes bakes one hardcoded dark look
  across all 21 (which `themes.css` then contradicts per theme) and does
  nothing on the other 16. Any light/dark difference must come from a token the
  themes already swap. `-strong` is not "darker" — it means _more contrast
  against this theme's own background_: lighter on every dark theme, darker on
  every light one. Never use it as a fill under light-coloured content.
- **A state or domain colour has three roles; picking the wrong one is the
  usual contrast bug.** Bare (`bg-danger`, `border-danger`) is the fill.
  `-strong` (`text-danger-strong`) is text on a _tinted_ background — the
  `bg-danger/5` + `text-danger-strong` + `border-danger/20` recipe every
  callout uses, and the right choice for anything longer than a label. `-ink`
  (`text-danger-ink`) is text on the _solid_ fill, and exists only for short
  bold labels: chips, badges, chart annotations. `-strong` on a solid fill is
  the same hue twice and reads as mush. `-ink` is derived in `base.css` from
  the fill's own lightness — not the theme's, because the two diverge (on a
  light theme white reads on `danger` but fails on `warning`) — so a theme that
  overrides a fill silently changes its ink, and `themes.css` overrides fills
  200+ times. After touching a state or domain fill, run
  `node scripts/ink-contrast.mjs` (dev server on :5173): all 37 themes × 9
  fills. Worst case in the catalogue is 4.28:1, and 18 of the 333 pairs cannot
  reach 4.5:1 with _any_ ink (a mid-luminance chromatic fill caps out) — one
  more reason solid fills are for labels and the tinted recipe is for prose.
- A hover/active surface is `surface-hover`. `hover:bg-surface-card` on an
  element already sitting on a card is a no-op — easy to miss.
- **A translucent surface sitting on the page needs `backdrop-blur`.** Both
  `surface-card` and `input` are translucent in 35 of the 37 themes; without it
  the background image shows through unblurred while every card around it is
  frosted. Missed before on: the toolbar buttons, the calendar arrows, both
  segmented-toggle pills. Controls _nested inside_ an already-blurred card do
  not need their own — they sit on a blurred plane already. Bare
  `backdrop-blur` is theme-aware (`terminal` → 0,
  `lantern-drift` → 2rem); `backdrop-blur-sm` is not.
- **`component/ui/sonner/sonner.svelte` deviates from its registry version in
  four ways, and `shadcn add sonner` undoes all four** — check the file after
  ever re-running the CLI. (1) No `mode-watcher`: the registry passes
  `theme={mode.current}`, a light/dark **binary** over 37 palettes — the same
  mistake as `dark:`. Every colour comes from tokens instead, so sonner's own
  `theme` never shows and the dependency is not installed. (2) The four
  severity tints are added — the registry sets only `--normal-*`, and
  `richColors` is load-bearing rather than decorative: without it sonner
  ignores `--error-*`/`--success-*`/`--warning-*`/`--info-*` and paints every
  severity alike. (3) `--border-radius` follows `--radius`, which the
  registry's trio also leaves out. (4) The `loadingIcon` snippet is dropped —
  nothing raises a promise toast, and the registry's `icons/loader-2` is an
  alias with no `.svelte` entry, so `npm run depcheck` fails on it as
  unresolvable. The base surface is **not** a deviation: the registry's
  `--color-popover` exists here and `tokens.css` already maps it to
  `--surface-page` for exactly this reason ("popovers float over arbitrary
  content"). A floating overlay must not sit on `--surface-card` — it carries
  alpha on 35 of the 37 themes and `terminal` pairs that with `--blur: 0`, so
  page text reads straight through the toast.
- Checkboxes use `appearance-auto accent-brand`, not the `@tailwindcss/forms`
  look. The plugin paints a hardcoded `fill='white'` checkmark over
  `background-color: currentColor`, so the fill has to be dark — impossible
  here: on a dark theme every accent token is light by design. `accent-color`
  hands checkmark contrast to the browser, the only thing that holds across all
  37 themes. The plugin is still loaded in `app.css` and **cannot just be
  dropped**: the two bare-`border` inputs in `page-header.svelte` inherit their
  border colour from its base layer. Give them explicit token borders first,
  then remove it.
- Tailwind's scanner is **textual and runs at build time** — a name assembled
  at runtime does not exist. This bites twice: class names (`bg-{x}-500`), and
  `@theme` custom properties, which are tree-shaken to the ones the scanner
  literally saw (even one inside a _comment_ is enough to emit it).
  Hand-authored `:root` declarations in `base.css` are never tree-shaken, so
  build a dynamic `var()` name over those (`--series-N`), never over a `@theme`
  alias (`--color-series-N`). See `energy/+page.svelte`'s `PALETTE`.
- **Two namespaces, and only one of them is yours to declare.** `base.css` and
  `themes.css` own the _unprefixed_ names (`--danger`, `--ty-primary`,
  `--surface-page`, `--series-1`); `tokens.css` maps each to a `--color-*`
  entry purely to generate the utility. So `bg-danger` is the normal way to
  reach it, and any raw `var()` — JS, inline styles, SVG `fill`/`stroke` —
  names the unprefixed one. Never declare a `--color-*` yourself.
  `--color-danger: var(--color-danger)` used to be the idiom here and is gone
  on purpose: it only worked because `app.css` imports `tokens.css` before
  `base.css`, so the real value won on source order. Flip that import order and
  every such token silently becomes a self-referential cycle resolving to
  invalid — no error, just transparent. `--radius` and `--blur` are the two
  deliberate exceptions (next bullet); leave them alone.
- The scanner also **skips the directory holding the CSS entry point**, so a
  class whose only occurrence is inside `presentation/style/` is never
  emitted — markup belongs anywhere else. (Cost an hour: an `h-[100rem]` in a
  story file parked in `style/` silently had no height.)
- Bare `rounded` and `blur` are declared in a _deprecated_ block in Tailwind's
  own `theme.css` marked `@theme default inline reference`, and `reference`
  inlines the value at build time — so both need re-declaring in `tokens.css`
  (they are), or they bake in Tailwind's v3-compat literals (`0.25rem`, `8px`)
  and no theme can reach them.
- `--series-1…8` + `--series-rest` (`base.css`) are the categorical scale for
  per-task chart series, deliberately _not_ swapped per theme: the hues only
  stay distinguishable if their lightness holds. Label them with `series-ink`,
  never `ty-primary`, which flips to white and vanishes on the fills.
- Adding a theme touches four places: the catalogue in
  `business/model/theme.ts`, a `@custom-variant` in `tokens.css`, a palette
  block in `themes.css`, and (if animated) a file under `style/scenery/`.
- Use the `cn` helper (tailwind-merge + clsx) for conditional classes.
- Avoid `<style>` blocks; prefer Tailwind.
