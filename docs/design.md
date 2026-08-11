# Design vocabulary

The terms [AGENTS.md](../AGENTS.md) §0 uses, condensed from Ousterhout's _A
Philosophy of Software Design_; the last section is where this repo parts ways
with it. Read "class" as module — a file's exports, a store, a model, a
component.

Read this when you are arguing about where code should go, proposing a split,
or defending an abstraction. §0's six bullets are the rules; this is why.

## Name the complexity before removing it

Three symptoms. **Change amplification**: one feature needs edits in several
places. **Cognitive load**: how much you must know to finish the task.
**Unknown unknowns**: you cannot tell which code the task touches, or what you
needed to know — worst of the three, because nothing announces it.

Two causes. **Dependencies** — code that cannot be understood or changed alone.
**Obscurity** — important information that is not obvious.

Complexity arrives in small increments, never in one commit, so the only policy
that holds is zero tolerance per change. Note what is counted: complexity, not
lines. Short code can be dense and obscure; the goal is neither direction for
its own sake.

## Depth is the interface measured against the implementation

A module is **deep** when its interface is small relative to what it does, and
**shallow** when the interface is large relative to what it does. Depth pays
twice: a small interface imposes little on the rest of the system, and an
implementation nothing exposes can be rewritten without touching a caller.

- **Never split on line count. The test is interface arithmetic: a split pays
  only if it removes more public surface than it adds.** A large file whose
  helpers are private is a deep module; a small one exporting a member per
  fifteen lines, most called from one place, is a wide facade in a small file's
  clothes. Measure both sides before proposing one — the worked case is the
  deep-modules decision in
  [`business/model/AGENTS.md`](../src/lib/business/model/AGENTS.md).
- **A pass-through method is a shallow module**: it forwards to the same-named
  method one layer down and adds nothing. The interface to a piece of
  functionality belongs in the module that implements it. Duplicating an
  interface is fine only where the layer adds something — a dispatcher, or
  several implementations behind one shape.
- **A wrapper is shallow by default.** Before wrapping, ask whether the
  behaviour belongs in the wrapped module, in the single caller that wants it,
  or in a standalone module that wraps nothing. The honest case is adapting a
  third-party interface you cannot change.
- **Every function must be readable alone.** If you cannot understand one
  without reading the other, that is a red flag — whether they share a file or
  sit in different directories.
- **Depth is not a licence to write more code.** "Invest in depth" is the
  easiest idea here to abuse: it argues against false economy in interfaces,
  never for volume. §0 wins the tie — a deeper version that removes no leak, no
  unknown unknown and no duplicated decision does not go in on depth alone.

## Information hiding, and the ways it leaks

Hiding is what produces depth: a decision known to exactly one module can be
changed in exactly one place. **Leakage** is a decision reflected in more than
one. Anything in an interface is leaked by definition, which is why the
interface is kept small. Four leaks worth recognising by name:

- **Backdoor leakage** — two modules share a decision that appears in neither
  interface: a stored format one writes and the other reads, a key layout, an
  ordering assumption. Nothing marks the coupling, so one changes and the other
  silently breaks. R3 is the standing defence.
- **Temporal decomposition** — splitting modules by the order operations run
  (read the URL, then parse it) leaks that order to the caller, who must now
  call two things in sequence. Structure by what is known, not by when it
  happens.
- **Returning an internal structure** — hand back the map you store and the
  representation _is_ the interface. Return the answer the caller asked for.
- **Overexposure** — if using the common feature requires learning the rare
  one, the common case pays for the rare one. Design the interface so the
  common case is the simple one.

A **pass-through variable** — a parameter threaded through functions that never
read it — puts one caller's concern in every intermediate signature. Fold it
into something the layers already share, or restructure so the layers that do
not care never see it. Not into a global context bag (below).

Hiding applies inside a module too: fewer exports, fewer module-level values,
fewer things two functions must agree about.

## General interface, specific functionality

**Functionality reflects today's needs; the interface does not.** Build the
module _somewhat_ general — broad enough that the next need is a new caller,
not a new method.

Prefer the general module. It is deeper, it hides more, and it is genuinely
_less_ work than the pile of special-purpose methods it replaces — **on one
condition: that you can name the domain's natural operations.** That condition
is the rule, not a footnote on it. Find the operations that are about the
_thing_ rather than about the caller's gesture, and cover today's needs with
fewer of them; build those, even for a single caller. If you cannot find them —
if every candidate set is a guess about callers who do not exist — write the
specific thing and let the second caller show you where the seam really was.
Generality you can name is cheap. Generality you are guessing at is speculation
with better manners, and §0's first rule still applies to it.

The example is a text buffer. `backspace(cursor)` and `delete(cursor)` are
shallow and leak: the buffer now knows a UI decision (which characters a
backspace removes), and every new editing gesture needs a new buffer method.
`insert(position, text)`, `delete(start, end)` and
`changePosition(position, numChars)` make both gestures one line written by the
UI, which is where the decision belongs — and that set reads as obvious only
_after_ someone has found it. Text, positions and ranges are the domain's own
operations; naming them is what makes the general version cost _less_ code.

Three questions, asked at the **first** caller (R3 says why the first and not
the second):

1. **What is the simplest interface covering all my current needs?** Fewer
   operations with no loss of functionality is a more general module.
2. **In how many situations will this be used?** A method with one plausible
   caller, named after that caller's gesture, is the red flag.
3. **Is it easy to use for my current need?** If the caller needs glue — a loop
   to delete a range one character at a time — the interface is general in the
   wrong dimension. Generality that makes today's caller longer is a mistake,
   not an investment.

Two directions to push specialization out of a general core. **Up**: the buffer
offers positions and ranges, the UI decides what backspace means — R1's layer
direction is this argument at repo scale, and `task-row-shell.svelte`
([`presentation/AGENTS.md`](../src/lib/presentation/AGENTS.md)) is one
instance. **Down**: an OS defines "read a block" / "write a block" and each
driver implements it with its device's peculiarities.

**Eliminate special cases** so the common path handles them. A "text is
selected" flag disappears once an empty selection is a selection whose start
equals its end. Same move as "an action is present when its callback is" — no
mode flag, no branch, nothing for a caller to get wrong.

## Three the book gets wrong for this repo

- **The context object is rejected.** A per-instance bag of global state cures
  pass-through variables by making every dependency ambient and untypeable, and
  it collides with R1, with R5 (stores take what they need as arguments) and
  with models being pure functions of their inputs. Pass what is used; give a
  named type to parameters that genuinely travel together.
- **"Classitis" does not license fat components.** R1 and R2 are depth
  boundaries — logic goes where it can be tested — not the small-classes reflex
  the book warns about.
- **The book is OOP-shaped and this repo is not.** A component's interface is
  its props and snippets; a store's informal interface — what is reactive, who
  may write, what must be loaded first — is the part that leaks, which is why
  the store rules in
  [`business/AGENTS.md`](../src/lib/business/AGENTS.md) are as long as they
  are.
