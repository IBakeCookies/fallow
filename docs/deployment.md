# Rendering, caching, locales, deployment

Settled decisions about how pages are served. Read with the root
[AGENTS.md](../AGENTS.md); do not re-litigate these.

## No page is prerendered, including `imprint` and `privacy`

Every page goes through a root layout that personalises the response
per-cookie, so a build-time render bakes the defaults in. Measured on a real
build via `vite preview` with `theme=abyss; scenerySeed=42` (2026-07-26):
prerendered `/imprint` serves `class="fallow "` / `lang="en"` / an `Imprint`
`<h1>` where today's `/de/imprint` serves `class="abyss dark"` / `lang="de"` /
`Impressum`, and a cold load gets the seed baked at build time, not the
visitor's cookie.

Locale living in the URL makes the case stronger, not weaker: 30 indexable
URLs, every one still cookie-personalised for theme and seed. Hydration repairs
the class, the copy and (since 2026-08-01) the seed, so it costs a FOUC rather
than a wrong page — but avoiding exactly that FOUC is why the theme is stamped
server-side, and it would hit precisely the cold arrivals (search results,
shared links) these pages exist for. Two trivial CDN renders do not pay for
that.

## The service worker caches per-cookie personalised HTML, and every personalised input is repaired

2026-08-01. The cache is bounded (keyed on pathname), its failures are not
silent, and pages are network-first — a cached page only ever wins offline.
What a stale copy can then get wrong, and what fixes it:

- **Theme and scenery motion** reconcile against their cookies in
  `ThemeStore`'s constructor (against the snapshot `+layout.svelte` reads for
  it — see R5).
- **The scenery seed** reconciles in its `onMount`, not the constructor,
  because hydration never re-patches the SSR'd style attribute (the
  `+layout.svelte` scenery-clock comment is the precedent) — only a post-mount
  state change reaches the DOM.
- **Locale** is URL-addressed (`/de/*`), so a cached page's language always
  matches its cache key; the one wrong-language path was the offline shell
  fallback, and the worker now caches one shell per locale (`SHELLS`, derived
  from the paraglide runtime's `locales`/`baseLocale`, never spelled by hand)
  and picks it by pathname prefix.
- **The rendered route**, for the shell fallback only: that shell is another
  route's HTML, and SvelteKit hydrates whatever the inlined payload describes,
  so an offline `/calendar` came up as the planner — interactive, correct URL,
  wrong page, and no client-side navigation fixed it (2026-08-14). The server
  load stamps the `pathname` it rendered for; the root layout's mount compares
  it to `location.pathname` and `goto`s the real URL once when they differ.
  Pathname, not href: the worker's cache key is the pathname, so that is exactly
  the granularity at which the payload can be the wrong one.

Residual cost by design: a stale cached page repairs with a FOUC, and
`x-vercel-ip-timezone` in the serialized payload is repaired by the layout's
own clock re-derivation at mount. Pinned by the `German shell` e2e (raw
response HTML asserts `lang="de"` pre-hydration) and the seed-reconciliation
store specs.

## `app.html`'s inline pre-paint script no longer hardcodes theme names

2026-08-01: `hooks.server.ts` fills the `%theme.default%` /
`%theme.default-dark%` placeholders with JS array literals from the catalogue
in `business/model/theme.ts`, so a default-theme change is a one-place edit
again. The script still only swaps the classes it owns (assigning `className`
would wipe the server-stamped scenery-paused class). Pinned by the
`dark-preferring first visit` e2e.

## `sitemap.xml` and `robots.txt` prerender only when `PUBLIC_SITE_URL` is set

`export const prerender = Boolean(env.PUBLIC_SITE_URL)`. Both must emit
absolute URLs; an unconditional prerender bakes in SvelteKit's
`http://sveltekit-prerender` placeholder. The sitemap lists every route in
**every** locale with `xhtml:link` alternates, `/imprint` and `/privacy`
included.

## `PUBLIC_SITE_URL` is set on Vercel in the Production scope only

The one environment variable the app reads (see `.env.example`).
Production-scoped on purpose: preview deploys fall back to their own request
origin instead of claiming to be canonical. Consequences of the scope choice,
both intended — previews serve dynamic (not prerendered) crawler files, and
their SEO tags point at themselves.

## `/de/*`, `/es/*`, `/fr/*`, `/zh/*` are real, indexable URLs, not a cookie state

The paraglide strategy is `['url', 'cookie', 'baseLocale']`; `en` stays
unprefixed. Three consequences that are easy to get wrong:

- Every internal `href` goes through `localizeHref`, and every comparison
  against a pathname goes through `deLocalizeHref`. A raw `===` on
  `page.url.pathname` is wrong on every prefixed locale.
- Adding a locale is four edits and no new component: the catalogue
  (`messages/<locale>.json`, key-for-key with `en.json`), `locales` in
  `project.inlang/settings.json`, `LOCALE_DISPLAY` in
  `presentation/utils/locale.svelte.ts` (total record — it fails to compile
  until label, `Intl` tag and week start are filled in) and `OG_LOCALES` in
  `seo-head.svelte`. Everything else — nav picker, sitemap, hreflang, the
  offline shells — is derived from the runtime's `locales`.
- The strategy is declared **twice** — in `vite.config.ts` for
  build/dev/vitest, and in the `paraglide` npm script for `check`/`prepare`.
  paraglide 2.x has no config file for it, so this is a deliberate, documented
  exception to R3; change one and you must change the other.
