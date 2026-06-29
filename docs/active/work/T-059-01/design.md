# T-059-01 — Design

Decisions, with rejected alternatives, grounded in Research. The ticket already prescribes
the shape (optional `intent?` on `SnapshotParts`; tolerant SEED read in steer + survey;
`SEED_PATH` constant; no BAML change). Design's job is to settle the open choices the ticket
leaves: **where** the section goes, **how** the content is rendered, and **how** it is
test-pinned — and to confirm the prescribed shape is the right one against codebase reality.

## D1 — Add an optional field vs a new parameter vs a new formatter

**Decision: optional `intent?: string` on `SnapshotParts`** (as the ticket prescribes).

- *Optional field (chosen):* `buildProjectSnapshot` stays one function with one parts
  object. Absent ⇒ `undefined` ⇒ no section ⇒ byte-identical. The other 5 callers don't
  even mention `intent`, so they compile and behave unchanged (optional field). This is the
  lightest touch and preserves the single pure formatter the whole shelf shares.
- *Rejected — a second `buildProjectSnapshotWithIntent`:* duplicates the formatter, splits
  the test-pinned shape into two, and invites drift. Violates the "single place the intent
  section is added" intent in E-059's context notes.
- *Rejected — a positional second arg `buildProjectSnapshot(parts, intent?)`:* the codebase
  passes a single parts object everywhere; a positional add is a less honest signature than
  folding it into the parts it belongs to. The intent is *part of the snapshot's input*, so
  it belongs in `SnapshotParts`.

Grounded in Research: 6 callers, only 2 change; optionality is what makes the other 4 +
non-seed projects byte-identical.

## D2 — Where the intent section goes in the snapshot

**Decision: first, immediately after the `# Project snapshot — {root}` title line, before
`## Source modules`.**

```
# Project snapshot — {root}

## Stated intent (SEED.md)
<verbatim content>

## Source modules (src/**)
...
```

- *First (chosen):* the intent is the thing the steer prompt grounds demand *against* — the
  most load-bearing line in the whole snapshot for a cold seed. Putting it at the top makes
  it the first thing the model reads, ahead of the board listing. It reads as "here is the
  idea; here is the current state" — the natural go-and-see order.
- *Rejected — last (after tickets):* buries the single most important signal under two
  mostly-empty list sections on a fresh seed. The model reads the `(none)` boards first and
  the idea last — backwards for a cold-start steer.
- *Rejected — interleaved among the lists:* no natural home; breaks the existing three-
  section rhythm the tests pin.

Placement does **not** affect byte-identical-absence (the section is absent entirely when
intent is undefined), so this is purely a legibility choice. First wins.

## D3 — How the content is rendered (verbatim, trimming, blank handling)

**Decision: emit the SEED content verbatim inside the section, trimmed of leading/trailing
whitespace; treat a present-but-blank SEED as absent (no section).**

- The ticket says "content verbatim (one line by design)". The example/stub SEED is
  actually *multi-line markdown* (a `# Seed` heading + a paragraph). "Verbatim" = emit what
  is there; do not parse or extract a single line (that would need a heuristic and could
  drop the user's real wording). The model is good at reading a short markdown blurb.
- *Trim:* `readFile` yields a trailing newline; trimming keeps the section's spacing stable
  and matches how `charter`/`epic` content is consumed (whole-file). The verbatim guarantee
  is about *content*, not about preserving an incidental trailing `\n`.
- *Blank-as-absent:* if SEED exists but is empty/whitespace-only, emitting a `## Stated
  intent` header with no body is worse than honest-empty — it fabricates a section with
  nothing in it. So `intent` that trims to `""` is treated as no intent (no section). The
  caller passes `undefined` in that case (see D5). This keeps the honest-empty contract
  whole: an empty SEED is the same as no SEED.
- *Rejected — emit raw including trailing newline:* makes the section's trailing spacing
  depend on the file's incidental EOF, hurting determinism of the surrounding string.
- *Rejected — strip markdown to one line:* loses author wording; needs a fragile heuristic;
  the ticket's "verbatim" forbids it.

## D4 — Tolerant SEED read in the impure verbs

**Decision: `readFile(join(root, SEED_PATH), "utf8").catch(() => undefined)` in both
`assembleSteerInputs` and `assembleSurveyInputs`; pass the result as `intent`.**

- Matches the `listIdsIn` tolerance precedent (Research): absence ⇒ a benign empty value,
  never a throw. The charter read stays NON-tolerant (charter is required; bounds gate greps
  it) — only SEED is optional.
- Add the read into the existing `Promise.all` so it stays one concurrent batch (no extra
  await latency). The tuple gains a fourth element.
- The trim/blank-as-absent normalization (D3) lives in the **pure formatter**, not the
  caller — the caller passes the raw file contents (or `undefined`), and
  `buildProjectSnapshot` decides whether a non-empty section results. Rationale: keeping the
  "is there really intent here" rule in the pure, test-pinned function means it's covered by
  unit tests, not by the un-unit-tested impure verb. The caller's only job is the tolerant
  read.

  *Counter-considered:* normalize in the caller (trim there, pass `undefined` if blank).
  Rejected because it pushes a behavior-bearing rule into the un-tested impure layer; the
  house pattern is "pure formatter owns shape, impure verb owns reads".

## D5 — `SEED_PATH` constant

**Decision: export `const SEED_PATH = "SEED.md"` from `project-context.ts`**, alongside
`CHARTER_PATH`. Both steer and survey import it (they already import `CHARTER_PATH` from
this module). One source of truth for the root SEED filename, mirroring the charter
precedent exactly. The ticket asks for this explicitly.

## D6 — Test strategy

**Decision: extend `project-context.test.ts` with two pins on the pure formatter:**

1. **intent present** — `buildProjectSnapshot({..., intent: "build a team-finder"})`
   contains `## Stated intent (SEED.md)` and the verbatim content, positioned before
   `## Source modules`.
2. **intent absent ⇒ byte-identical** — assert `buildProjectSnapshot(partsWithoutIntent)`
   `===` `buildProjectSnapshot({...partsWithoutIntent, intent: undefined})` AND that neither
   contains `Stated intent`. The strongest form: snapshot the no-intent output and assert it
   equals the pre-change output. Since we can't diff against a deleted version in one test,
   pin it as: a fixed-parts call produces a string with **no** `Stated intent` substring and
   exactly the 3 existing `(none)` placeholders (the existing test already pins the latter —
   it must still pass unchanged, which is itself the byte-identical guarantee).
3. **blank intent ⇒ no section** — `intent: "   \n"` produces no `Stated intent` section
   (D3 blank-as-absent).

The impure `assembleSteerInputs`/`assembleSurveyInputs` stay un-unit-tested (house rule).
Their correctness is: tolerant read (a one-liner matching the `listIdsIn` precedent) +
passing through to the pure formatter, which IS tested. The AC's "fresh seed's steer input
contains the one-line idea" is covered transitively (formatter emits it when present) and
end-to-end by T-059-03's live drive.

## D7 — Confirm no BAML / no regen

The intent rides inside the existing `{{ project }}` block (Research: steer.baml:114). No
class, function, or prompt edit. `baml:gen` stays a no-op. Confirmed against the prompt body
— the model is already told to read demand off `{{ project }}`.

## Summary of the chosen design

Optional `intent?` on `SnapshotParts`; pure formatter emits a `## Stated intent (SEED.md)`
section **first**, content **verbatim-trimmed**, **only when intent is non-blank**; both
impure verbs read root `SEED.md` **tolerantly** into it; export `SEED_PATH`. No BAML.
Byte-identical when absent — the honest-empty safety — is preserved by optionality +
blank-as-absent and pinned by the unchanged existing test.
