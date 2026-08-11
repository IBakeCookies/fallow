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
- **Two hover families, chosen by what the rest state is.** `surface-hover` is a
  6% `ty-primary` tint on _transparent_ — right when the element has no fill of
  its own (`ghost`, list rows) or when it is a child painting over its parent's
  fill (the number-input steppers). When the element itself already has a fill,
  the hover class _replaces_ that fill, so use the fill's own paired token —
  `bg-control` → `hover:bg-control-hover`, and likewise for
  `secondary`/`primary`. Each is derived _from_ the fill it hovers, so it follows
  a theme that re-tints the base, and the derivation differs by fill type: a
  **translucent** fill scales its own alpha (proportional, so a faint fill gains a
  little and an assertive one a lot), a **solid** one steps away from its own ink
  (the only direction that both reads as stronger and cannot cost label
  contrast). Do not restate a fixed value and do not fade: `surface-hover` on a
  filled element _inverts_ the hover (the outline button went 55% white → 6%
  black on the light-glass themes and receded), an alpha fade
  (`hover:bg-primary/80`) moves the fill _toward_ the surface, and mixing a
  fixed tint in moved a 0.09-alpha fill by ΔL 0.012 while moving a 0.65-alpha one
  by 0.13. All three were measured and rejected — `node scripts/hover-contrast.mjs`
  (Storybook on :6006) re-runs it over all 37 themes × 4 variants and records the
  residue that no hover token can reach. `hover:bg-surface-card` on an element
  already sitting on a card is a no-op — easy to miss.
- **`bg-control` is the neutral control fill; `bg-input` is a form field.** They
  hold the same value (`--control: var(--input)` — one per-theme knob, and 35
  themes turn it), but a button naming `input` was a lie that made every
  reader check, and a theme can now split them by overriding `--control` alone.
  Note `--color-control` also generates `border-control`/`outline-control`; only
  `bg-control` is meant.
- `secondary` is the **tinted** low-emphasis fill (`--primary` mixed into
  `--control`), not a neutral grey — the emphasis ladder is `default` (solid
  primary) > `secondary` > `outline` (neutral) > `ghost` (bare). It was 10%
  `ty-primary`, identical to `:root`'s `--input`, so it and `outline` differed
  only by a border while themes re-tinted `--input` out from under it. For an
  inert or neutral state (a "stable" badge) reach for `outline`; `secondary`
  reads as accent now. The tint is capped at 22% for contrast, not for taste:
  `secondary-foreground` is `ty-primary`, and on a dark theme whose primary is a
  light hue a stronger wash lifts the composited fill until white label text
  falls under 4.5:1 (3.59:1 at 45%).
- **A danger control uses `bg-destructive-soft`, the one OPAQUE fill in the
  system**, with `text-destructive-foreground` (which resolves to `-strong`) on
  it. Both halves are load-bearing. `text-destructive` on it is red ink on a red
  wash — 1.97–3.42:1 across 20 themes, exactly the mush the colour-role rule
  above warns about. And a translucent `bg-destructive/10` inherits whatever is
  behind it, so on the themes with a photographic or gradient backdrop the same
  pair measured anywhere from 1.87:1 to 4.4:1 depending on where the button
  happened to sit; mixing into `--surface-page` instead makes the pairing a
  property of the palette rather than the wallpaper. Opaque also means **no
  `backdrop-blur`** on it, and it is the one fill that cannot use the
  alpha-scaling hover rule. How faint it is, is the one thing in the system that
  had to split light from dark (in `.dark`, which already swaps `--danger`
  itself): the fill travels toward `--destructive` while the ink is a
  neighbouring shade of the same hue, so over a light page anything past ~18%
  costs more contrast than it buys, while over a dark page 18% of a colour that
  dark is within ΔL 0.004 of the page — a fill and a hover you cannot see.
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
- **`component/ui/tooltip/tooltip-provider.svelte` defaults `delayDuration` to
  150 where the registry defaults it to 0, and `shadcn add tooltip` undoes
  that** — check the file after re-running the CLI. Every call site wants the
  same delay, and it was hand-copied at eleven of them while
  `metrics-dashboard.svelte` was left on the registry default, so one card's
  tooltips fired on a pointer that was only crossing the trigger on its way
  somewhere else. Pass the prop only to deviate from the app's delay.
- Checkboxes use `appearance-auto accent-brand`, not the `@tailwindcss/forms`
  look. The plugin paints a hardcoded `fill='white'` checkmark over
  `background-color: currentColor`, so the fill has to be dark — impossible
  here: on a dark theme every accent token is light by design. `accent-color`
  hands checkmark contrast to the browser, the only thing that holds across all
  37 themes. The plugin is still loaded in `app.css` and **cannot just be
  dropped**: the two bare-`border` inputs in `page-header.svelte` inherit their
  border colour from its base layer. Give them explicit token borders first,
  then remove it.
- **An overflowing panel scrolls with `nice-scrollbar` (`base.css`), never the
  native bar** — the theme dropdown and the analytics log history are both it. No
  palette reaches a UA scrollbar, so it renders as the same grey slab on all 37
  themes.
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
  block in `themes.css`, and (if animated) a file under `style/scenery/`. A
  scenery file that reads a seeded var needs a fifth: its own PRNG stream in
  `presentation/utils/scenery-seed.ts` — `themeRandom(seed, '<name>')`, one per
  theme, and the 12 streams there are exactly the 12 scenery files that read
  one. Per-theme streams are the point: draw order only has to stay stable
  _within_ a theme, so adding or retuning one theme can never reshuffle
  another's arrangement. The stream key is a plain string we keep equal to the
  theme name, so **renaming a theme is a choice**: update the string too and
  that theme's scenery shifts for every existing seed (palette unchanged, but
  drifts and phases move), or leave it and the key stops matching the
  catalogue. Neither is wrong; pick one deliberately.
- **First paint is the page's frame, not a loading string and never a blank
  screen.** Every page's readings come from IndexedDB after mount, so the server
  renders with empty stores and the four routes each answered that differently:
  `/` painted the whole frame at its defaults, `/calendar` painted its
  date-derived grid, `/analytics` painted the words "Loading…", and `/energy`
  painted _nothing_ — its `<h1>` was inside the load gate. The rule now: markup
  that depends on no read (headings, range toggles, the calendar grid) renders
  unconditionally, and a region that would otherwise show a **claim** — zeroed
  metrics, "no open tasks", "No tasks" — gets a gate whose `{:else}` is
  `skeleton-block` bars inside the real card shells, sized to what will land
  there. Two things are load-bearing about that shape. The bars carry
  `aria-hidden`, because empty boxes announce nothing and a screen reader wants
  the sentence instead — keep an `sr-only` copy of it wherever one already
  existed. And the sizes are **measured off the loaded page**, not guessed —
  drive it in a browser and read the heights back. Where the height is a
  property of the layout the match is exact and worth having: the analytics
  skeleton reproduces the loaded card heights to the pixel, and its trend body
  is `aspect-[800/240]` because that chart is a fixed viewBox at `w-full`, so
  its height is a function of the container's width and no `h-*` can track it.
  Where the height is a property of the user's data — how many tasks are in the
  Lab's list, whether a day window is set — the skeleton is a plausible frame
  and a few px of settle is the honest outcome; do not pixel-fit it to one
  profile.
- Use the `cn` helper (tailwind-merge + clsx) for conditional classes.
- Avoid `<style>` blocks; prefer Tailwind.
