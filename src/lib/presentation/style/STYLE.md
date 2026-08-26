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
(&:is(.dark *))` in `tokens.css`, and about half the catalogue stamps `.dark`
  (`abyss`, `noir`, `meridian`, `terminal` among them) — and that is the
  problem: a **binary** over dozens of distinct palettes bakes one hardcoded
  dark look across every dark theme (which `themes.css` then contradicts per
  theme) and does nothing on the light ones. Any light/dark difference must come
  from a token the themes already swap. `-strong` is not "darker" — it means
  _more contrast against this theme's own background_: lighter on every dark
  theme, darker on every light one. Never use it as a fill under light-coloured
  content.
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
  `node scripts/ink-contrast.mjs` (dev server on :5173): every theme × 9 fills,
  and it prints the current tallies rather than asking you to trust one written
  here. Worst case in the catalogue is `solarized-light`'s published red at
  4.21:1, and a few percent of pairs cannot reach 4.5:1 with _any_ ink (a
  mid-luminance chromatic fill caps out) — one more reason solid fills are for
  labels and the tinted recipe is for prose.
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
  (Storybook on :6006) re-runs it over every theme × the 5 variants that carry
  a hover fill (`link` carries none) and prints the residue that no hover token
  can reach, most of it the danger palette cap below. It judges a step by
  CONTRAST RATIO and not by a difference of luminances, because relative
  luminance is compressed near black: one 6% tint measures ΔL 0.129 over white
  and 0.0048 over black, so a ΔL bound calls a token that does not vary broken on
  every dark theme. As a ratio that same tint reads 1.14 and 1.10, and `ghost`
  clears the bound on every theme. Both alpha-scaling hovers (`--control-hover`,
  `--secondary-hover`) are no-ops on an OPAQUE fill — measured step 1.000 — so
  every theme whose `--input` is opaque sets that pair itself.
  `hover:bg-surface-card` on an element already sitting on a card is a no-op —
  easy to miss, and on an opaque theme it is a no-op even when the element is
  NOT on a card, since nothing composites. **`hover:border-line-strong` is the
  same trap on the border side**: `--color-line-strong` IS `--border`, which is
  what a bare `border` already resolves to, so it re-sets the colour the element
  had — measured 1.000 on every theme. A border hover needs `border-line-soft`
  at rest to have anywhere to go (soft -> strong measures 1.15–1.94). The
  calendar's day cells hit both halves at once: filled, so their
  `hover:bg-surface-hover` replaced the fill instead of tinting it, and
  bare-bordered, so the border hover did nothing either — no hover at all on a
  dark theme, and a panel vanishing to bare page on an opaque one. They now use
  `hover:bg-surface-card-hover`, the card's own paired token.
- **A card hovers by LIFTING, which is why `--surface-card-hover` is neither of
  the two derivations above.** A card is lighter than its page on every theme, so
  raising lightness is the only direction that always widens the separation
  making a card read as a card; alpha carries the translucent ones, where L is
  already 1. Tinting toward `ty-primary` — the intuitive choice — is worse here
  than for a control: a light theme's card sits near the L ceiling, so a dark
  tint walks it THROUGH its page (a 6% mix left `solarized-light` at 1.014 and
  `parchment` at 1.031 against their own pages, i.e. a hovered card that stops
  reading as filled). Alpha moves by its remaining headroom rather than by a
  factor, since a factor overshoots — `alpha * 1.9` clamped 14 translucent cards
  to opaque, a glass card losing its blur on hover. No theme hand-sets it, and
  separation from the page rises on every theme, so a hovered card can never stop
  reading as a card. **It cannot give an even step, though, and nothing can**: the
  same delta swings 2.05 over a near-black page and 1.017 over a pale one,
  because the step depends on the page luminance behind the card. A hover that
  must be visible on every theme therefore needs a page-independent channel
  alongside it — the calendar ramps its border, which is what carries the eight
  light translucent themes.
- **`bg-control` is the neutral control fill; `bg-input` is a form field.** They
  hold the same value (`--control: var(--input)` — one per-theme knob, and every
  theme turns it), but a button naming `input` was a lie that made every
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
  wash — measured at 1.97–3.42:1, exactly the mush the colour-role rule above
  warns about. And a translucent `bg-destructive/10` inherits whatever is
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
- **A translucent surface sitting on the page needs `backdrop-blur`.**
  `surface-card` carries alpha in most themes, and `input` in most of those;
  without it the background image shows through unblurred while every card
  around it is frosted. Missed before on: the toolbar buttons, the calendar
  arrows, both segmented-toggle pills. Controls _nested inside_ an
  already-blurred card do not need their own — they sit on a blurred plane
  already. Bare `backdrop-blur` is theme-aware (`terminal` → 0,
  `lantern-drift` → 2rem); `backdrop-blur-sm` is not.
- **A borderless panel nested inside a card uses `surface-inset`, not
  `surface-card`.** Card-on-card separates only by compositing the same alpha
  twice, so on an opaque theme it is one flat ink and the nested panel
  disappears — `log-row` did, in the analytics log list. A nested panel that
  keeps `surface-card` (the task-definition panel) carries a border, which is
  what still separates it there. The third way out is to drop the fill: the
  metrics dashboard's headline tiles were bordered cards and are now bare, each
  marked by a 2px rule down its left in its own band colour, so there is no
  second surface to separate.
- **Chrome that floats over scrolling content uses `surface-float`, not
  `surface-card`.** One site today, the sticky nav bar. The two hold the same
  value everywhere but one theme; they differ where a theme is translucent _and_
  sets `--blur: 0`, which makes the blur a no-op and lets page text read straight
  through the bar. `terminal` is that theme, on purpose — its scanlines
  crossing a card is the theme — so it alone re-points `--surface-float` at an
  opaque ink. Every other blur-0 theme avoids the trap by being opaque
  throughout (base.css `.solid-light`/`.solid-dark`, and themes.css's "the
  set-square themes" and "the rounded opaque themes", which between them also
  cover blueprint and parchment).
- **`component/ui/sonner/sonner.svelte` deviates from its registry version in
  four ways, and `shadcn add sonner` undoes all four** — check the file after
  ever re-running the CLI. (1) No `mode-watcher`: the registry passes
  `theme={mode.current}`, a light/dark **binary** over dozens of palettes — the same
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
  alpha on most themes and `terminal` pairs that with `--blur: 0`, so
  page text reads straight through the toast.
- **`component/ui/tooltip/tooltip-provider.svelte` defaults `delayDuration` to
  150 where the registry defaults it to 0, and `shadcn add tooltip` undoes
  that** — check the file after re-running the CLI. Every call site wants the
  same delay, and it was hand-copied at eleven of them while
  `metrics-dashboard.svelte` was left on the registry default, so one card's
  tooltips fired on a pointer that was only crossing the trigger on its way
  somewhere else. Pass the prop only to deviate from the app's delay.
- Checkboxes use `appearance-auto accent-brand`, not the `@tailwindcss/forms`
  look. **One carve-out**: `must-do-toggle.svelte` reads as a button with a
  toggle state, so its `<input>` is a transparent full-size overlay inside a
  `<label>` carrying `buttonVariants` — `outline` unset, `secondary` set, which
  is the emphasis ladder keeping it below the submit beside it. The input stays
  a real checkbox rather than a `<button aria-pressed>` because the value is
  submitted with the form, and it is an overlay rather than `sr-only` because
  Playwright clicks the box it is given and a shrunk one is intercepted by the
  label. The focus ring is `has-[:focus-visible]:`, not `peer-*`: the input is
  a child of the label, never its sibling. The plugin paints a hardcoded `fill='white'` checkmark over
  `background-color: currentColor`, so the fill has to be dark — impossible
  here: on a dark theme every accent token is light by design. `accent-color`
  hands checkmark contrast to the browser, the only thing that holds across
  every theme. The plugin is still loaded in `app.css` and **cannot just be
  dropped**: the two bare-`border` inputs in `day-actions.svelte` inherit their
  border colour from its base layer. Give them explicit token borders first,
  then remove it.
- **An overflowing panel scrolls with `nice-scrollbar` (`base.css`), never the
  native bar** — the theme dropdown, the analytics log history and the two task
  screens' ledger are all it. No palette reaches a UA scrollbar, so it renders as
  the same grey slab on every theme. The ledger's container also carries
  `tabindex="0"`, because a region that only scrolls is unreachable by keyboard
  otherwise (axe `scrollable-region-focusable`), which is why it holds a scoped
  `svelte-ignore` for `a11y_no_noninteractive_tabindex`.
- **A repeated cluster becomes an `@utility`, not a wrapper component** —
  `ledger-cell`, `ledger-numeric` and `ledger-wide` are the newest set. A `<td>` cannot be
  wrapped: an element between `<tr>` and its cells is not a table cell, so a
  component per cell would either break the table model or add a `<div>` inside
  every one of twelve columns. Same argument as `hint-underline`'s, arrived at
  from the other direction — there the wrapper would cost the heading level or
  the label association.
  `ledger-numeric` is `text-right` + `tabular-nums` together on purpose: either
  alone leaves a column that cannot be compared down its own length, which is
  the only reason the ledger is a table.
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
  per-task chart series, and the one token family with **exactly two values and
  no per-theme swap**: the `:root` half (the hues at 300, dark ink) and the
  `.dark` half (the same eight at 900, white ink). Label them with `series-ink`,
  never `ty-primary` — the ink is paired with the fill, and a theme's own text
  colour is not. A theme that re-declares a series colour breaks the pairing
  for every reading below; `node scripts/series-ink-contrast.mjs` (dev server
  on :5173) fails on a third scale and prints both halves' ratios.
- **A series fill under a label is opaque.** `series-ink` is fixed per side
  rather than derived per fill (the `-ink` recipe above), which only works
  because the fill under it is fixed too — so alpha on it is the same bug as a
  new hue: a translucent fill composites toward the theme's surface, and the
  pair goes under 4.5:1 on the dark themes while still reading on the light
  ones. That is what the timeline bar shipped (blocks at 70%, rest at 40%).
  Wash out a fill only where nothing is written on it.
- **Each half's tier trades three readings against each other**, and both halves
  are tuned the same way: away from the page. Going further from the ink (300
  lighter, 900 darker) buys label contrast and spends two things — the block's
  contrast against the surface behind it, and the spacing between the eight hues,
  which is the whole point of a categorical scale. Amber and orange are the
  tightest pair and set that budget: against the shipped light half, 700 keeps
  about half their separation and 900 about a quarter, so on a dark theme a plan
  funding all eight tasks has two blocks that are hard to tell apart. 700 is the
  dark floor regardless — the lightest tier where white clears 4.5:1 on all nine
  (600 fails on five, lime worst). `rest` tracks the middle of its band rather
  than an end (`zinc-300` / `zinc-700`), so it stays a block rather than a hole.
  Both halves' fills now sit close to their surface — under 2:1 for most of them
  — so the container border and the `series-ink/40` dividers, not the fill, are
  what make a block an edge. Keep them.
- **A categorical scale needs hues that differ in every theme, which the state
  and domain accents do not guarantee.** `--flow` and `--warning` are both amber
  in `base.css` and stay amber through most of `themes.css`, so a chart giving
  two categories those two tokens draws one colour twice on a dozen themes (that
  is why the day profiles colour Grind `--danger`). Check a new pairing against
  `themes.css`, not against the token names.
- Adding a theme touches four places: the catalogue in
  `business/model/theme.ts`, a `@custom-variant` in `tokens.css`, a palette
  block in `themes.css`, and (if animated) a file under `style/scenery/`. A
  scenery file that reads a seeded var needs a fifth: its own PRNG stream in
  `presentation/utils/scenery-seed.ts` — `themeRandom(seed, '<name>')`, one per
  theme, and the streams there are exactly the scenery files that read one.
  Per-theme streams are the point: draw order only has to stay stable
  _within_ a theme, so adding or retuning one theme can never reshuffle
  another's arrangement. The stream key is a plain string we keep equal to the
  theme name, so **renaming a theme is a choice**: update the string too and
  that theme's scenery shifts for every existing seed (palette unchanged, but
  drifts and phases move), or leave it and the key stops matching the
  catalogue. Neither is wrong; pick one deliberately.
- **No catalogue tallies in prose.** Comments and docs here say "most themes",
  "every theme", "an opaque theme" — never "33 of the 44" or "the opaque four".
  Every such count was a lie one theme later, and the sweep to correct them
  spanned a dozen files that had nothing else to do with the change. The
  instruments print the current numbers on demand
  (`scripts/ink-contrast.mjs`, `scripts/hover-contrast.mjs`), so a tally in a
  comment is a stale copy of something already available. Numbers that a NAMED
  theme or a design constant owns are different and stay: `terminal`'s
  `--blur: 0`, the 0.58 ink threshold, `--secondary`'s 22% cap, the 1.03 hover
  bound. Those rot only when the thing they describe changes, which is the
  commit that should be touching them anyway.
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
