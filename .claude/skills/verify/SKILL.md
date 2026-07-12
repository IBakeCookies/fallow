---
name: verify
description: How to build, launch, and drive the Zenith app to verify changes end-to-end in a real browser.
---

# Verifying Zenith changes

## Launch

Dev server: `npm run dev` (Vite, http://localhost:5173). Often already
running — check first: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/`.

## Drive (Playwright)

Playwright is a devDependency; chromium is installed under
`~/.cache/ms-playwright`. **Gotcha:** the headless shell fails with
`libnspr4.so: cannot open shared object file` because NSS/NSPR aren't
installed system-wide and there's no sudo. Fix without root — download
the debs and point `LD_LIBRARY_PATH` at the extracted libs:

```bash
mkdir -p "$SCRATCH/libs" && cd "$SCRATCH/libs"
apt-get download libnspr4 libnss3
for f in *.deb; do dpkg-deb -x "$f" extracted/; done
LD_LIBRARY_PATH="$SCRATCH/libs/extracted/usr/lib/x86_64-linux-gnu" node script.mjs
```

In the script, resolve playwright from the project (scripts live in the
scratchpad, outside the repo):

```js
import { createRequire } from 'module';
const require = createRequire('/home/shadi/hobby/zenith/package.json');
const { chromium } = require('playwright');
```

## Flows worth driving

- All data is client-side IndexedDB — a fresh headless profile starts
  empty. Seed today via the UI: fill `getByPlaceholder('e.g., Boxing training')`,
  click `Deploy Task`, then wait ~400ms for the auto-save `$effect`.
- The viewed day derives from the URL: `/` = today, `/?date=YYYY-MM-DD` =
  history (invalid/future dates fall back to today). Past-day view shows
  the "Viewing a past day" banner and an amber date label in the nav.
- Useful assertions: nav first item text (`Today` vs e.g. `Jul 10`),
  banner presence, task title visibility (note: a task title matches
  twice — task list + "Primary Bottleneck" metric).
- Persistence probe: full page reload and re-check the task survived.
- Midnight rollover ("today" is reactive via `src/lib/today.svelte.ts`): use
  Playwright's clock API — `page.clock.install({time})` ONCE per page,
  before the first `goto`, then `page.clock.fastForward('10:00')` across
  midnight. Re-installing mid-session or fast-forwarding to exactly the
  timer's deadline gives flaky results; overshoot by a few minutes.
