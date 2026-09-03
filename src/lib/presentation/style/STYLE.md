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
  clears the bound on every theme. **`--control-hover` moves TWO channels, alpha and lightness,
  and the lightness sign is the page's.** Alpha alone dies at both ends: it is a
  no-op on an OPAQUE fill, which is why ten themes plus the two classics used to
  set it themselves, and it is nearly a no-op where a light theme writes
  `--input` as white at high alpha, since more white over a near-white page goes
  nowhere — `glass-light` measured a step of exactly 1.000, no hover at all, with
  `daybreak`, `bubblegum`, `glacier`, `sundial`, `hourglass`, `foliage` and
  `fallow` all under the 1.03 bound. (`weathervane` had already dodged it locally
  by tinting its `--input` slate rather than white.) Stepping lightness away from
  the page as well gives one channel or the other somewhere to go on every theme:
  measured after, min 1.089, none under 1.03, and all 12 hand-set
  `--control-hover` overrides deleted. **`--secondary-hover` does NOT get the same
  treatment, and trying it was a mistake worth recording**: its worst step was
  already 1.044, over the bound, so there was no bug to fix — and a lightness
  channel there is harmful, because `--secondary` is a wash of the primary whose
  label is `ty-primary`, so lifting the fill on a dark theme walks it toward its
  own near-white label. It stays alpha-only, and the opaque themes still set it
  themselves.
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
- **`--surface-inset` is DERIVED from the card, and its direction flips with the
  page.** An inset is a well cut into a card, and on a light theme that means
  darker while on a dark theme it means LIGHTER — the same thing `.solid-dark`
  says of its three rungs, and the same sense `-strong` carries above: more
  contrast against this theme's own background, not a fixed direction. 45 themes
  used to hand-set it and 22 of the 25 dark ones set it to black at alpha, which
  over a page already at L 0.09-0.16 is a well in a floor that is already the
  bottom — the range track and `log-row` measured 1.013-1.079 against their own
  card, invisible. Now one rule per side in `base.css` (`:root` and `.dark`),
  ΔL 0.1 receding on the light side and 0.1 climbing on the dark one — the sign
  is the point, and the ALPHA gains are what differ by side — and both channels
  move for the reason
  `--surface-card-hover` moves both: an opaque card has no alpha to scale, a
  white-at-6% card has no lightness left to raise, and every theme is one or the
  other. The alpha gains differ (0.4 light, 0.06 dark) because white-on-white
  buys almost nothing per point of alpha and white-on-near-black buys almost
  everything. `scripts/inset-contrast.mjs` measures each side against its own
  card. Both sides were 0.14 when the derivation landed and both came down to
  0.1, because 0.14 drops `blueprint`'s row label to 3.95:1 on its own well —
  under AA, and a pair nothing measured until that script existed. `ukiyo` is the
  one theme 0.1 does not carry: it measures 1.007, under the 1.03 bound and back
  to invisible, because a near-white translucent card (L 0.98 at alpha 0.6) is
  the white-on-white limit where alpha has no room and only lightness moves. It
  overrides the rule with 0.14 in `themes.css` — a per-theme exception is the
  right shape for one outlier, where re-raising the whole light side would cost
  `blueprint` its label. Shipped, over all 46: light min 1.081 and median 1.195,
  dark min 1.249 and median 1.405, worst row label 4.68:1, no reading under the
  bound. These dark figures do NOT reproduce
  337aad1's (min 1.381, median 1.521): that run is ~0.10 higher on both and its
  sample area is not recoverable, so this script's numbers replace them rather
  than reconcile with them. `.solid-light` is
  the one block that still sets it by hand, and deliberately: it is a flattening
  read off rendered pixels whose well is only 0.06 deep, so the derived rule
  would deepen the colour it exists to preserve. `.solid-dark`'s flattening sits
  where the derived rule already lands, so that block no longer sets it.
- **`--ring` is derived too and a theme almost never needs to say so.** `:root`
  has `color-mix(in oklch, var(--primary) 50%, transparent)`, which computes to
  exactly `oklch(... / 0.5)` on the primary — verified against the literal — so
  the 18 themes that restated it were writing the value they already had. What
  survives is the 5 that genuinely differ: a different alpha (`zenith`,
  `kintsugi` at 0.55), a different colour (`royal`, `verdigris`), or a ring that
  is deliberately not the primary at all (`brutalist`, whose ring is its ink).
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
  wash, exactly the mush the colour-role rule above warns about. (The measured
  range that stood here was taken when `--danger` was red-600; the step down to
  red-700 moved both the ink and the wash, so it is deleted rather than
  re-derived — no instrument covers this pair.) And a translucent `bg-destructive/10` inherits whatever is
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
- **`scrim` is the one surface NOT derived from `--ty-primary`, and has no
  per-theme override.** A modal scrim dims toward black on a light and a dark
  theme alike, so an ink-derived wash — the recipe every other surface here
  follows — would brighten the 25 dark themes instead of dimming them. One
  value in base.css, and `dialog-overlay.svelte` is its only caller. The dialog
  PANEL is a separate question and follows the toast: `bg-popover`
  (→ `--surface-page`), never `surface-card`, for the reason under sonner below.
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
  look. **Two carve-outs**: `must-do-toggle.svelte` and the three radios in
  `task-importance-select.svelte`. The toggle reads as a button with a
  toggle state, so its `<input>` is a transparent full-size overlay inside a
  `<label>` carrying `buttonVariants` — `outline` unset, `secondary` set, which
  is the emphasis ladder keeping it below the submit beside it. The input stays
  a real checkbox rather than a `<button aria-pressed>` because the value is
  submitted with the form, and it is an overlay rather than `sr-only` because
  Playwright clicks the box it is given and a shrunk one is intercepted by the
  label. The focus ring is `has-[:focus-visible]:`, not `peer-*`: the input is
  a child of the label, never its sibling. `task-importance-select.svelte`
  takes that recipe three times for a 3-level scale, inside a `<fieldset>`
  whose `<legend>` is **visible and above** the three options, styled like the
  slider labels beside it — three bare buttons in a form say nothing about what
  they set, and a `<legend>` cannot be a flex item in its own fieldset anyway.
  Its `name` is `$props.id()`, because the add dialog and a row's editor can be
  mounted at once and one shared name would merge them into a single group.
  The plugin paints a hardcoded `fill='white'` checkmark over
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
  `banner-shell` is the newest, over the `ledger-cell` / `ledger-numeric` /
  `ledger-wide` set. A `<td>` cannot be
  wrapped: an element between `<tr>` and its cells is not a table cell, so a
  component per cell would either break the table model or add a `<div>` inside
  every one of twelve columns. Same argument as `hint-underline`'s, arrived at
  from the other direction — there the wrapper would cost the heading level or
  the label association.
  `ledger-numeric` is `text-right` + `tabular-nums` together on purpose: either
  alone leaves a column that cannot be compared down its own length, which is
  the only reason the ledger is a table.
- **The hand cursor marks anything clickable** — Tailwind v4's Preflight gives
  buttons `cursor: default` (the spec reading, where the hand means "link");
  `base.css` puts `cursor: pointer` back on every enabled `button` and
  `[role=button]`, uniformly, so no component argues about whether its own hover
  state is loud enough. Two `cursor-*` utilities on one element are resolved by
  Tailwind's sort order, not the class attribute's, so never fix a wrong cursor
  by adding a second one — `hint-underline` scopes its `cursor: help` to
  `:not(:any-link, button, [role=button])` for exactly that reason.
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
- **`scenery-motion-on` on `<html>` is how a recorded choice outranks the OS**,
  which is why `scenery/index.css`'s `@media (prefers-reduced-motion: reduce)`
  block is _guarded_ by `html:not(.scenery-motion-on)` instead of deleted in
  favour of `.scenery-paused` alone. Deleting it is the smaller diff and an
  accessibility regression: the query is the only gate left for a visitor who
  has recorded nothing — with JavaScript off, nothing is stamped and no store
  mounts — and for an OS setting that flips mid-session. The guard repeats flat
  across the three selectors, matching the `.scenery-paused` triple below them,
  so the Tailwind pipeline is never handed a nested `@media`. Both classes come
  from `getSceneryMotionClasses` in `business/model/theme.ts` — the server
  stamp and the store's toggle are one mapping — and a visit with nothing
  recorded stamps neither, which is what leaves the query deciding.
- **The scenery gutter: a theme's focal object goes beside the content column,
  never behind it.** `.theme-scenery` is `position: fixed; inset: 0`, so a theme
  anchoring a bright, hard-edged object to viewport top-centre draws it under
  the app bar and the first card — bisected, and washing out the labels over it.
  The transparent strip beside the column is where such an object belongs. Its
  left edge is `--spacer-gutter` in `base.css` (`50% + 43rem`, the card's edge,
  plus a rem), which is one property rather than a `calc()` per scenery file;
  `50%` and not `50vw` because the layer is fixed, so they agree except that
  `50vw` counts the scrollbar and sits ~8px right of true centre. **Below the
  width where the gutter fits the object, do not draw it.** Shrinking it to fit
  is the tempting answer and the wrong one: an object small enough for a narrow
  gutter no longer carries what it was drawn to carry, and bleeding it off the
  right edge leaves a sliver. No gutter means nowhere unoccluded on screen, so
  none is the honest output — `moonphase` degrades to sky and starfield, which
  is still a coherent theme. Two exemptions, both deliberate: an object that is
  a soft low-alpha wash with no edge to cut (`hourglass`, `sundial`) overlaps
  the column on purpose, and a light theme's ink survives a bright backdrop that
  a dark theme's does not. `scripts/ink-contrast.mjs` cannot police any of this
  — it samples token fills, not scenery — so the gate is the boundingBox
  scenarios in `e2e/scenery.e2e.ts`.
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
