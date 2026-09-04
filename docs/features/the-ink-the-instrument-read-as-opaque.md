# The ink the instrument read as opaque

**Kind:** repair · **Status:** landed 2026-09-04 · **Roadmap:** none — found by the
2026-09-04 sweep for what to build next, raised independently by its a11y and
verification lenses

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

`scripts/inset-contrast.mjs` measures two things per theme and gets one of them
wrong. The `step` reading composites correctly — both its sides are sampled
pixels. The `cr` reading takes the label's colour from `getComputedStyle` and
paints it on a bare canvas, which returns the **un-premultiplied** colour: the
label as if it were opaque. `--ty-secondary` is `--ty-primary` at 70% over
transparent, so every `cr` the script has ever printed was the label's best
case.

Composite the ink over the well it is actually drawn on, so the number means
what the file's own docblock already says it means — "measured from RENDERED
PIXELS, because computed style cannot answer the question".

## What the corrected instrument reads

Measured 2026-09-04 over all 46 themes, Storybook on :6006:

- The ratio the script printed overstated by **1.49 to 9.61 points** — worst
  `glass-light`, 17.46 read against 7.85 composited.
- Min goes **4.68 → 3.19**, median **10.94 → 5.76**.
- **Five light themes are under 4.5:1**: `blueprint` 3.19, `parchment` 4.15,
  `solarized-light` 4.26, `bubblegum` 4.34, `ukiyo` 4.44.
- `fallow` — the one theme the Storybook a11y gate runs — reads **4.52**.
- `orbit` reads 1.08 in a full sweep and 6.97 twice when re-run alone. That is
  the scenery flash the script's docblock already documents, not a finding.

The two prose sites that carried the old minimum said "worst row label 4.68:1,
no reading under the bound". Both were corrected: the claim was the bug's own
output.

## Claims

### Claim — the reading changes and the step reading does not

`scripts/inset-contrast.mjs`

- **Given** all 46 themes before and after the change
- **Then** every theme's `cr` falls and no theme's `step` moves beyond
  scenery noise (one theme, `synthwave`, 1.419 → 1.412)

### Claim — the gate this was supposed to be behind never covered it

`.storybook/preview.ts`, `docs/testing.md`

- **Given** `@storybook/addon-a11y` at `test: 'error'` and a toolbar defaulting
  to `DEFAULT_THEME`
- **Then** axe runs one theme (`fallow`) and never sees the 45 others, so five
  themes ship a sub-AA log-row label with CI green

## Out of scope

- **The colour repair.** Deliberately not in this commit. `--ty-secondary` is
  one derivation feeding `--muted-foreground` across the app, so the choice
  between a per-side derivation and named per-theme exceptions has to be sized
  from the corrected run — which did not exist until this commit. Shipping the
  instrument and the repair together would mean choosing the fix from the
  numbers the fix was supposed to be judged against.
- **Re-measuring `blueprint`'s historical 3.95:1 at step 0.14.** That figure
  describes a configuration that no longer ships and was read by the superseded
  method. It is left as it stands, with the method named where the numbers are
  quoted, rather than re-derived — a number nobody can re-run is not repaired by
  recomputing it from a different one.
- **Widening the a11y gate to every theme.** 46 themes × every story is a CI
  cost nobody has priced, and axe's `color-contrast` cannot resolve a background
  stack that reaches `--background-image` in any case. The narrower true
  statement went into `docs/testing.md` instead; what to do about the gate is a
  separate decision with its own measurement.
- **A second instrument.** This is the script that already owns the pair, and
  the `--surface-inset` derivation it regression-checks is unchanged.
- **`MIN_CR`.** The bound is 4.5 because that is AA. Five themes failing it is
  the finding; moving the bound to hide them is not a repair.

## Read before building

- `scripts/inset-contrast.mjs` — the docblock's "measured from RENDERED PIXELS"
  paragraph, and the `orbit` warning at the end of it
- `src/lib/presentation/style/base.css` — the 70% `color-mix` behind
  `--ty-secondary`, `--surface-card`'s alpha, and the `--surface-inset`
  derivation comment that carried the second copy of the old figure
- `src/lib/presentation/style/STYLE.md` — the ink note
- `docs/testing.md` — the a11y paragraph and what it claimed
