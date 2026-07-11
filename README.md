# Zenith

**A to-do app that does calculus so you don't have to.**

Zenith answers a question every productive day poses: _you have N tasks and only
so many hours — how should you split your time to get the most out of the day?_
Instead of guessing (or splitting time equally), Zenith models each task's
productivity curve and solves for the time allocation that maximizes your total
output, subject to your real limits: the hours in your day and how much
mental and physical energy you can actually sustain.

It's a faithful, over-engineered implementation of the
[Zenith Gradient Algorithm](https://thequantasticjournal.com/how-to-over-engineer-a-todo-app-the-zenith-gradient-algorithm-67712737135e),
extended with a dual energy-pool model, context-switching costs, and a
personalization loop that learns your constants from measured data.

---

## The idea in one picture

For any task, productivity over time isn't flat — it ramps up as you get into
the zone, peaks at **flow state**, then decays as you tire:

```text
p(t) = (a + p₀) · k · t · e^(−kt)      k = 1/ϕ
```

Each task is described by three things you feel intuitively:

- **Effort / difficulty** (`E`) — how demanding the task is
- **Enjoyment** (`β`) — how much you like doing it
- **Time to flow** (`ϕ`) — how long before you hit the zone

These shape the curve: enjoyable, low-effort tasks start productive and rise
fast; hard, unpleasant ones start slow but peak higher. There's a mathematically
optimal point to stop each task (≈ 1.79 × ϕ) — work past it and your _average_
productivity for that task actually falls.

Zenith takes your whole task list and finds the allocation `⟨t₁, t₂, … tₙ⟩` that
maximizes the sum of average productivities, using **Lagrange multipliers** under
your time budget — then reports how much better that is than an equal split.

## What Zenith adds on top of the article

- **Dual energy pools.** Cognitive and physical fatigue are separate systems.
  "6h of coding" saturates your ~4h/day of intense mental work, but "4h coding +
  2h gym" fits — the physical hours draw on a different pool. The allocator
  solves a three-constraint problem (time + cognitive pool + physical pool) via
  Lagrangian duality with cyclic coordinate descent, so plans never schedule an
  unsustainable day.
- **Context-switching costs.** Every task you juggle costs ~15 minutes of
  overhead. Zenith charges switches only between tasks that actually get time,
  and will _drop_ a weak task when the switch it costs outweighs its value.
- **Personalization from your own data.** Log how long a task really took to
  reach flow (the ⚡ button, stopwatch-style) and Zenith refits your personal
  constants (`c₁, c₂, c₃`) with a ridge-regularized least-squares fit — anchored
  to the article's defaults, sharpening as you log more.
- **A dashboard of derived metrics.** Zenith Gain, Burnout Risk, Flow Coverage,
  Cognitive/Physical Load, Energy Balance, Friction Index, Recovery Ratio, and
  more — each computed from the same underlying model.
- **Suggested run order.** Alternates cognitive and physical tasks so the
  resting energy system recovers while the clock keeps running.
- **History & routines.** Sessions are saved per day (browse past days
  read-only) and you can save task templates as reusable routines. Everything
  lives locally in IndexedDB — no account, no server.

## How you use it

1. Add tasks. For each, set **physical difficulty**, **mental difficulty**, and
   **enjoyment** on 1–10 sliders.
2. Set your **available hours** for the day, and optionally tune your
   cognitive/physical capacity pools and switch cost.
3. Zenith suggests how many hours to give each task, what order to do them in,
   and surfaces a live dashboard of what your day looks like.
4. Optionally log your actual time-to-flow on tasks to personalize the model.

## Tech stack

- [SvelteKit 2](https://svelte.dev/docs/kit) + [Svelte 5](https://svelte.dev/) (runes)
- [Tailwind CSS 4](https://tailwindcss.com/) with shadcn-svelte / bits-ui components
- TypeScript, [Vite](https://vite.dev/)
- IndexedDB for local persistence
- [Vitest](https://vitest.dev/) (unit) + [Playwright](https://playwright.dev/) (e2e), [Storybook](https://storybook.js.org/) for components
- Deployed on Vercel (`@sveltejs/adapter-vercel`)

The productivity math lives in [`src/lib/zenith.ts`](src/lib/zenith.ts) (pure,
dependency-free functions) and the task/dashboard logic in
[`src/lib/metrics/calculations.ts`](src/lib/metrics/calculations.ts).

## Getting started

```sh
npm install
npm run dev          # start the dev server (add -- --open to open a tab)
```

### Other commands

```sh
npm run build        # production build
npm run preview      # preview the production build
npm run test         # unit tests (vitest) + e2e (playwright)
npm run test:unit    # unit tests only
npm run check        # svelte-check type checking
npm run storybook    # component explorer on :6006
```

## Credits

Based on
["How to Over-Engineer a To-Do App: The Zenith Gradient Algorithm"](https://thequantasticjournal.com/how-to-over-engineer-a-todo-app-the-zenith-gradient-algorithm-67712737135e)
from The Quantastic Journal.
</content>
