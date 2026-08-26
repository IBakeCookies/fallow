# The moon that lost its sky

**Kind:** feature · **Status:** landed 2026-08-26 · **Roadmap:** item `none`

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

On a wide viewport, `moonphase`'s moon is drawn whole in the transparent gutter
beside the content column, instead of bisected — the app bar over the top of it,
the first card under it. Below the width where that gutter fits it, it is not
drawn at all rather than drawn broken. `eclipse` reaches the same goal by a
different route and stays over the column (see Decisions); `cathedral` is out of
scope.

Consequence of the chrome shipped in
[the-header-that-only-held-a-title](the-header-that-only-held-a-title.md) and
item 6 of [docs/redesign/README.md](../redesign/README.md): `.theme-scenery` is
`position: fixed; inset: 0`, so a theme anchoring its focal object to viewport
top-centre was drawing into a band that the floating-pill nav used to leave
empty and the full-bleed bar does not.

## Why the gutter, and how wide it is

Arithmetic on two constants, not a measurement. The column is `max-w-layout`
(`--container-layout: 90rem`) with `lg:px-page` (`--spacer-page: 2rem`), so the
card's right edge sits at `50% + 43rem` and

**gutter = `50vw − 43rem`**, which is `0` below `90rem` because the column stops
growing there and only its padding is left.

| viewport | gutter | fits a 7rem object + 1rem buffer |
| -------- | ------ | -------------------------------- |
| 1440px   | 32px   | no                               |
| 1600px   | 112px  | no                               |
| 1632px   | 128px  | yes, exactly                     |
| 1888px   | 256px  | yes                              |

`7rem` is `moonphase`'s existing `--moon-size`, so the breakpoint is
`min-width: 102rem` (1632px). A second step at `min-width: 110rem` (1760px)
takes the moon to `11rem`: the same arithmetic run backwards — `55rem − 43rem`
is a 12rem gutter, which is `11rem` plus the one-rem buffer. Two steps, both
exact, because a fluid `min()` would have to put a percentage inside
`--moon-size`, and that property is also read by the shadow disc's `translate`,
where a percentage resolves against the disc instead of the viewport.

## Scenarios

The acceptance criteria, and the R6 tests — written here _before_ the
implementation, so the implementer transcribes them rather than inventing them
after the fact ([docs/testing.md](../testing.md)).

`e2e` is the level for both: `.theme-scenery` lives in the **root** layout
and is `display: none` until a theme class sits on an ancestor, so there is no
story to hang a `play` function on — and the assertion is a real layout at a
real viewport width, which is the one thing only a browser has.

The theme is chosen by seeding the `theme` cookie before `goto`, the way
`scenery.e2e.ts` already reads `scenerySeed` — server-stamped, so the class is
on the first paint and nothing has to wait for hydration.

### Scenario — the moon clears both occluders

`e2e/scenery.e2e.ts`

- **Given** the `theme` cookie is `moonphase` and the viewport is 1888×900
- **When** `/` loads
- **Then** `.theme-helper-2`'s box does not intersect the `<header>`'s box
- **Then** `.theme-helper-2`'s box does not intersect the first `.card-shell`'s box
- **Then** `.theme-helper-2`'s box lies entirely inside the viewport

### Scenario — below the breakpoint the moon is not drawn

`e2e/scenery.e2e.ts`

- **Given** the `theme` cookie is `moonphase` and the viewport is 1440×900
- **When** `/` loads
- **Then** `.theme-helper-2` is not visible

There is no `eclipse` scenario. Both of its helpers now overlap the column on
purpose, so a non-intersection assertion would fail by design — the same reason
the 42rem streamer wheel was never going to be asserted on.

The first scenario clears **every** `.card-shell`, not only the first: they all
share the column, so the assertion costs nothing extra and it catches a later
card that grows wider than the one above it.

No MATH.md section changes, and there is no Claim: nothing here is a formula, a
bound or a number that moves.

## Out of scope

- **`cathedral`.** Its rose window is 20rem _of detail_ — twelve lancet petals, a
  roundel ring, eight jewel circles, a hub — and at the ~11rem the gutter allows
  the petals are ~30px and the jewels ~13px. It also cannot take the `hourglass`
  treatment, because it is a hard-edged SVG over an opaque `#17121f` backing
  circle, not a wash. Its price is a **redraw** — fewer, larger elements and
  thicker strokes at the smaller size — which is design work that should not set
  the schedule for the two themes that are a relocation. It ships still bisected;
  the finding gets a ROADMAP line.
- **A narrow-viewport composition.** Nothing is drawn below the breakpoint
  instead. `moonphase` degrades to night sky + starfield and `eclipse` to its
  360° horizon sunset and streamer wheel; both are still coherent themes.
- **Making the bar transparent at scroll-top.** It would work, and it is what
  the artboards originally drew, but item 6 of
  [docs/redesign/README.md](../redesign/README.md) already settled the bar as
  `surface-float` + `backdrop-blur`. The gutter makes it unnecessary above the
  breakpoint and irrelevant below it.
- **Reserving a transparent band on `/`.** The redesign's density stands; the
  `<h1>` that used to leave that band is not coming back.
- **A `scripts/scenery-occlusion.mjs` sweep** over all themes. The two e2e
  scenarios already gate the behaviour, and unlike `ink-contrast.mjs` and
  `hover-contrast.mjs` — which are pure colour arithmetic — an occlusion sweep
  needs a browser to have any layout to measure. Second mechanism, same fact
  (§0).
- **Every other theme.** `hourglass` already lives at the right edge under its
  own `clamp()` rules and overlaps the column on purpose; it is not touched.

## Read before building

- `src/lib/presentation/style/scenery/moonphase.css` — the moon's `top`/`left`
  anchor, and the shadow disc whose `oklch(0.14 0.03 265)` is a second copy of
  the sky's flat band colour
- `src/lib/presentation/style/scenery/eclipse.css` — corona and streamer wheel,
  both pinned by comment to the background gradient's disc at `(50%, -3rem)`
- `src/lib/presentation/style/themes.css`, the `.moonphase` and `.eclipse`
  blocks — the sky's `linear-gradient(... 0 28%)` flat band, and the eclipse
  disc's `radial-gradient(circle at 50% -3rem, ...)`
- `src/lib/presentation/style/base.css`, the `:root` spacer block — where
  `--spacer-layout` and the gutter anchor seed, beside the existing `--spacer-*`
- `src/lib/presentation/style/tokens.css:79` — `--container-layout`,
  inside `@theme inline`
- `src/lib/presentation/style/scenery/index.css` — the `.theme-scenery` fixed
  layer every theme positions against
- `src/lib/presentation/style/STYLE.md` — the theme and scenery rules; the
  gutter rule is added here, next to the "adding a theme touches four places"
  bullet
- `src/routes/(app)/+layout.svelte` — the content column that sets the gutter:
  `max-w-layout` + `px-page-sm sm:px-page-md lg:px-page`
- `e2e/scenery.e2e.ts` — the two scenarios land here; it already locates
  `.theme-scenery` and reads a helper's inline var
- `src/lib/data/repository/appearance-repository.ts:19` — `THEME_COOKIE = 'theme'`,
  which is how a scenario picks its theme
- `ROADMAP.md` — add `cathedral`'s finding; do not renumber anything

## Decisions

- **The gutter anchor is one custom property, seeded in `base.css` as
  `--spacer-layout: 90rem` and referenced by `tokens.css`'s
  `--container-layout`** — the pattern every `--spacing-*` token already
  follows. Rejected: reading `--container-layout` straight from `@theme inline`,
  because STYLE.md's own note on `@theme default inline reference` says
  `reference` inlines at build time, and the anchor should not depend on which
  of those two words governs emission. Rejected: writing
  `calc(50% + 43rem)` in each scenery file, because that is R3.
- **Anchor to the card edge (`45rem − 2rem`), not the column edge (`45rem`).**
  Rejected the column edge: the page padding then silently becomes part of the
  buffer, so tuning the buffer moves the object relative to a boundary nobody
  named.
- **`50%`, not `50vw`.** The layer is `position: fixed; inset: 0`, so they are
  equivalent — except `50vw` includes the scrollbar and would sit ~8px right of
  true centre.
- **Below `102rem` the focal object is not drawn.** Rejected auto-shrink via
  `min()`: at 1440px it yields a **16px** moon, which conveys no phase.
  Rejected letting it bleed off the right edge: at 1440px that is a 16px
  sliver. Below the breakpoint there is nowhere on screen for a 112px object
  that is not occluded, so the honest output is none.
- **The moon grows with the gutter — `7rem` at the breakpoint, `11rem` from
  110rem — rather than staying at `7rem` everywhere.** A 7rem disc in a 15rem
  gutter reads as a badge parked in the corner; the presence a focal object
  needs is why the wide themes that get this right (`sundial`, `ukiyo`) draw
  large. Rejected growing it fluidly (see the arithmetic above), and rejected a
  third step: 11rem clears the widest common desktop with room to spare.
- **Only `moonphase` moves to the gutter. `eclipse` instead drops its whole
  stack — background disc, corona, streamer wheel — to `12rem` at top-centre,
  and stays over the column.** Superseded the plan below to cut its disc to
  `moonphase`'s envelope. Totality reads as a _black_ disc: darkening the card
  it sits behind costs contrast where a lit moon would have destroyed it, and
  the corona ring wants the width. Measured on `/` at 1440px and 1888px: 11
  labels over the object already failed WCAG AA before the move (worst 1.98:1)
  and 14 fail after (worst 1.78:1) — a deepening of an existing failure, not a
  new one, and the failure's real cause is `--surface-card` at 6% white, not the
  disc's address. Rejected asserting the three e2e non-intersection scenarios on
  `eclipse`: it now overlaps by design, so they are `moonphase`'s alone.
- **The 42rem streamer wheel stays wide and overlapping.** Rejected shrinking
  it: 42rem would need a 2720px viewport, and it is already a masked conic at
  5–7% alpha, which is a watermark by the rules `hourglass` already plays by.
- **`moonphase`'s sky-band colour becomes one custom property
  (`--moonphase-sky-band`) read by both `themes.css` and the scenery file.** R3:
  the shadow disc must be the flat band's exact colour, and two copies of a
  colour that must agree is a mismatch waiting for whichever gets retuned.
- **The flat band's end becomes a length (`22rem`), not `28%`.** Sharing the
  colour does not retire the geometric constraint — the shadow disc only
  disappears while it is inside the band, and the band was a percentage of the
  viewport because the background is `bg-fixed`. The moon's bottom now sits at
  `21rem`, so on a short viewport `28%` ended above it. Measured at new moon
  (`--moon-shadow: 0`, where a matching shadow makes the moon invisible), worst
  sRGB channel mismatch between the disc and the sky beside it: with `28%`,
  6/255 at 1888×700 and 3/255 at 1888×900; with `22rem`, 1/255 at 700, 900 and
  1200 tall. Small, and asymmetric in cost — a length is free and cannot drift
  with viewport height.
- **A focal object drawn in two layers gets one custom property for its
  address, declared on the theme class — above both readers, never on
  `.theme-scenery`.** `eclipse`'s disc is painted by a gradient in `themes.css`
  and ringed by two helpers in the scenery file; `cathedral`'s window is drawn
  in the scenery file and haloed by a gradient in `themes.css`. So
  `--eclipse-disc-y` and `--cathedral-window-y` both live in `themes.css`.
  Rejected declaring them on `.theme-scenery`, which is where the first attempt
  put `eclipse`'s: custom properties inherit **downward only**, so a value on
  the scenery layer cannot be read by the page background above it — the copy in
  the gradient stays a copy, and the pair looks shared without being shared.
- **`cathedral`'s halo moves to the window's centre and follows it.** It was at
  `50% 2%` of the viewport while the window sat at a rem offset, so the two were
  never registered and the vertical nudge pulled them further apart — a bloom
  around nothing. Now `calc(var(--cathedral-window-y) + 10rem)`, one 10rem
  radius below the window's top edge. Measured cost at 1440px and 1888px: three
  of the seven failing labels lose ≤0.05 of their ratio (1.91→1.86, 1.98→1.94,
  1.09→1.07) and the four at ~1.00:1 do not move — noise against a 4.5:1
  threshold, and none of it is what makes `cathedral` fail.
- **Both objects drop vertically as well as sideways.** The bar's right cluster
  (date · language · theme · data menu) is directly over the right gutter and
  is the busiest chrome in the app, and an object pinned to the top-right corner
  reads as a UI badge rather than sky.
- **`eclipse` becomes a whole disc for the first time.** `top: -3rem` on a
  13.5rem circle put its centre 48px above the viewport, so only the lower third
  was ever visible. Dropping it to `12rem` is a change of intent, not only of
  address — recorded here rather than discovered later.
- **`cathedral`'s redraw is excluded**, for the reason in Out of scope. It
  takes only the two changes that are not a redraw: the vertical nudge that
  hides its brightest ring behind the app bar, and the halo registration above.
  Both mitigate; neither closes the finding, which is why it also gets a ROADMAP
  line.

## Open questions

None.
