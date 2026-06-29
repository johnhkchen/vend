# T-059-01 — Review

Handoff for a human reviewer. The make-or-break E-059 wire: `vend steer`/`vend survey` now
read the seed's stated intent from a root `SEED.md` into the existing go-and-see snapshot,
so a fresh hackathon seed steers to a real board instead of an honest-empty abstention.

## What changed (4 files, all additive)

| File | Change |
| --- | --- |
| `src/play/project-context.ts` | `export const SEED_PATH = "SEED.md"`; `intent?: string` added to `SnapshotParts`; `buildProjectSnapshot` emits a `## Stated intent (SEED.md)` section (verbatim, trimmed) **first**, gated on a non-blank `intent` |
| `src/play/steer.ts` | `assembleSteerInputs` reads root `SEED.md` tolerantly (`.catch(() => undefined)`) and threads it as `intent` |
| `src/play/survey.ts` | `assembleSurveyInputs` — identical change (same gap, same fix) |
| `src/play/project-context.test.ts` | +3 pins: intent present / absent-byte-identical / blank-as-absent |

No files created or deleted. No BAML change, no `baml_client` regen diff. `src/init/init-core.ts`
(the charter overlay) and the live re-drive are deliberately out of scope (T-059-02 / T-059-03).

## How it works

The seed's product idea rides **inside the existing `{{ project }}` block** the steer prompt
already instructs the model to ground demand against (`baml_src/steer.baml:114`) — so no
prompt, class, or function edit was needed. `buildProjectSnapshot` stays the single pure
formatter the whole shelf shares; the intent is one optional field on its parts. The two
impure verbs gain one tolerant read each, folded into their existing `Promise.all`.

The design's load-bearing property is **byte-identical-when-absent**: when `intent` is
`undefined` or whitespace-only, the array spread is `[]`, so the joined string is identical
to today's. That is what preserves honest-empty for vend-on-itself and every non-seed
project, and what keeps the other four `buildProjectSnapshot` callers (decompose, expand,
note, propose-epic) completely unaffected.

## Test coverage

`bun run check` green: `tsc --noEmit` clean; **1316 pass / 0 fail** (3742 assertions);
`baml:gen` zero diff.

- **Intent present** — pins the section header, the verbatim content, and that it leads
  (`## Stated intent` index `<` `## Source modules` index).
- **Intent absent** — pins no `Stated intent` substring AND
  `buildProjectSnapshot(parts) === buildProjectSnapshot({ ...parts, intent: undefined })`,
  i.e. the optional field is a true no-op when absent.
- **Blank intent** — pins that whitespace-only intent produces a snapshot identical to the
  no-intent one (no fabricated empty section).
- **Regression guard** — the pre-existing shape/sort/`(none)`-count pins pass unchanged;
  their continued green is itself the byte-identical guarantee in force.

**Coverage gaps (by design, not omission):** `assembleSteerInputs` / `assembleSurveyInputs`
are not unit-tested — the house purity rule is "pure formatter owns shape (tested), impure
verb owns reads (untested)". Their added logic is a single tolerant read matching the
`listIdsIn` precedent plus a pass-through to the tested formatter. The behavior-bearing
normalization (trim + blank-as-absent) lives in the pure formatter precisely so it is
covered by unit tests rather than in the untested impure layer.

## Open concerns / notes for the reviewer

1. **Not committed.** Per the session's "Lisa handles the rest" instruction and the
   commit-only-when-asked rule, the code + artifacts sit in the working tree for Lisa to
   commit and advance the phase. Suggested commit messages are in `plan.md`.
2. **Unrelated working-tree changes are Lisa's.** `docs/active/pm/staged/steer.md` and
   `docs/active/tickets/T-059-01.md` show as modified from concurrent Lisa activity
   (a staged steer / artifact detection), not from this ticket. My change set is exactly
   the 4 files above + `docs/active/work/T-059-01/`. My test run writes only to temp dirs.
3. **End-to-end proof is deferred to T-059-03 (LIVE).** This ticket proves the wire at the
   unit level (formatter emits the section when intent is present; tolerant read threads
   it). That a *real metered* `vend steer` on the fresh seed now stages a coherent grounded
   board — the actual make-or-break outcome — is T-059-03's live re-drive, which also
   re-captures `EXPECTED-OUTCOME.md` as a positive gold master. No code here blocks that.
4. **"Verbatim" semantics.** The section emits the SEED content verbatim **trimmed** of
   leading/trailing whitespace (the example/stub SEED is multi-line markdown, not literally
   one line). Trimming keeps the surrounding string deterministic and does not alter author
   wording — only an incidental trailing newline. Flagged in case a reviewer expects the
   raw file bytes including EOF newline.
5. **Coupled charter gap is NOT closed here.** Steer still grades the seed against whatever
   sits at `docs/knowledge/charter.md`; T-059-02 enriches the template overlay to write the
   *tuned* hackathon charter there. Until T-059-02 lands, a fresh seed steers against the
   generic `CHARTER_STUB` (still a real improvement over today's no-idea-at-all).

## Verdict

Complete and gate-green. The change is the lightest honest touch the epic asked for — an
optional field + two tolerant reads — with the honest-empty safety pinned in both
directions. Ready for Lisa to commit and advance.
