# T-059-01 — Research

**Ticket:** thread-seed-intent-into-the-project-snapshot
**Goal (descriptive):** make `vend steer` (and `vend survey`) read the seed's stated
intent from a root `SEED.md` by threading it into the existing go-and-see project
snapshot. No BAML change, no regen.

This is a map of what exists today and how the pieces connect. No solutions proposed.

## The make-or-break finding (why this ticket exists)

`examples/templates/hackathon-seed/EXPECTED-OUTCOME.md` is the E-058 gold master: a real
live metered drive of the shipped seed flow (copy seed → `lisa init` → `vend init
--template hackathon` → `vend steer`). It records honestly that the flow produces an
**honest-empty steer**, not a board. Root cause (its headline verdict): `vend steer` reads
its steering context from `docs/knowledge/charter.md` + a board-ids snapshot, and the
seed's product idea lives in a root `SEED.md` that **no code reads** — so steer sees an
empty board + a generic charter + no idea, and the honest-empty rule fires correctly. A
diagnostic re-steer (with the intent placed where steer reads it) produced a coherent
4-signal board + 2 forks — so the **articulation engine is sound; the gap is input wiring**.

E-059 closes that gap. This ticket (T-059-01) is the build half: thread intent into the
snapshot. T-059-02 (sibling) enriches the template overlay to write the tuned charter.
T-059-03 (S-059-02) re-drives live.

## The pure formatter — `src/play/project-context.ts`

`buildProjectSnapshot(parts: SnapshotParts): string` (line 49) is the **single PURE
go-and-see formatter**. It takes gathered parts and emits a deterministic markdown string:

```
# Project snapshot — {root}

## Source modules (src/**)
- ...            (sorted; "- (none)" when empty)

## Existing stories
- ...

## Existing tickets
- ...
```

`SnapshotParts` (line 35) is `{ root, srcFiles, stories, tickets }` — all readonly. The
formatter sorts each list (deterministic = reproducible prompt input) and uses relative
paths only (no absolute-path leakage). House comment (lines 42–48) states the design
intent: "a listing, not the file contents (overproduced context is waste, charter
criterion 1)". **This is the rule the intent section is a deliberate exception to** — SEED
*is* the intent doc, so its one line is content-as-signal, not file-body noise.

Purity discipline (lines 8–11): `buildProjectSnapshot` is PURE and **test-pinned** for
shape + determinism; `assembleInputs` is the IMPURE read verb and is deliberately NOT
unit-tested (its logic is the pure formatter + thin fs reads).

### All callers of `buildProjectSnapshot` (grep-verified, 6 total)

| Caller | File:line | Passes intent today? | After this ticket |
| --- | --- | --- | --- |
| `assembleInputs` (decompose) | project-context.ts:166 | no | unchanged (intent undefined ⇒ no section) |
| `assembleExpandFragmentInputs` | expand-fragment.ts:146 | no | unchanged |
| `assembleNoteInputs` | note.ts:112 | no | unchanged |
| `assembleSteerInputs` | steer.ts:116 | no | **wires intent** |
| `assembleSurveyInputs` | survey.ts:127 | no | **wires intent** |
| `assembleProposeEpicInputs` | propose-epic.ts:155 | no | unchanged |

Because `intent` is optional and only steer + survey pass it, the other four callers (and
any project with no `SEED.md`) emit a byte-identical snapshot. This is the safety the
optional field buys.

### The tolerant-read precedent — `listIdsIn` (line 92)

`listIdsIn(dir)` reads `*.md` ids under a dir and **tolerates a missing dir → `[]`, never
throws** (try/catch around `readdir`). `listFilesRel` (line 69) does the same for the src
walk. This is the house "absence ⇒ empty, never throw" idiom the SEED read must follow:
`readFile(...).catch(() => undefined)`.

## The two impure verbs that must change

### `assembleSteerInputs` — `src/play/steer.ts:109`

```ts
export async function assembleSteerInputs(opts: SteerOptions): Promise<SteerInputs> {
  const root = opts.projectRoot ?? process.cwd();
  const [charter, stories, tickets] = await Promise.all([
    readFile(join(root, CHARTER_PATH), "utf8"),
    listIdsIn(`${root}/docs/active/stories`),
    listIdsIn(`${root}/docs/active/tickets`),
  ]);
  const project = buildProjectSnapshot({ root, srcFiles: [], stories, tickets });
  return { project, charter };
}
```

Returns `SteerInputs = { project, charter }` (defined in `steer-effect.ts:44`). `srcFiles`
is deliberately `[]` — a steer reads the board state, not the src tree. The charter read is
NOT tolerant (it uses bare `readFile`) — charter is required; the bounds gate greps it. The
SEED read, by contrast, must be tolerant (absence is the honest-empty case).

### `assembleSurveyInputs` — `src/play/survey.ts:120`

Byte-for-byte identical body to `assembleSteerInputs` (survey takes the same two inputs).
Same `SurveyInputs = { project, charter }` shape (`survey-effect.ts`). Both reuse the
exact same snapshot assembly — the ticket calls this "the identical gap; both reuse
`buildProjectSnapshot`".

## The BAML prompt — `baml_src/steer.baml` (NO CHANGE)

`SteerProject(project, charter) -> Steer` (line 53). The prompt body at line 114 already
contains:

```
## The project's current state (go-and-see — read the whole demand gradient AND the forks off THIS)
{{ project }}
```

The model is *already instructed* to ground demand against `{{ project }}`. Threading the
intent **inside** the snapshot string means the prompt needs no edit and no `baml-cli
generate` regen. The honest-empty contract (baml_src/steer.baml:71) is the rule that
correctly fires today on the empty input — preserving byte-identical absence keeps it
firing for vend-on-itself.

## Where `SEED.md` comes from — `src/init/init-core.ts`

`HACKATHON_SEED_STUB` (line 129) is the stub written by `vend init --template hackathon`
via `TEMPLATE_REGISTRY.hackathon` (line 174): a single overlay entry
`{ kind: "file", path: "SEED.md", contents: HACKATHON_SEED_STUB }`. The stub itself says
"`vend steer` reads it to propose a ranked board" — a promise this ticket makes true.
`SEED.md` lands at the **project root** (`<root>/SEED.md`), so the read target is
`join(root, "SEED.md")`. The example seed at `examples/templates/hackathon-seed/SEED.md`
is the richer authored version under proof.

## The test surface — `src/play/project-context.test.ts`

Pins `buildProjectSnapshot` for: headed sections (line 12), sorted lists (line 28), and
`(none)` placeholders (line 38, exactly 3 occurrences). The intent-present and
intent-absent cases must be added here. `assembleSteerInputs`/`assembleSurveyInputs` stay
un-unit-tested per the house purity rule (their logic is the pure formatter + thin fs).

The check gate is `bun run check` = `baml:gen` + `check:typecheck` (`tsc --noEmit`) +
`check:test` (`bun test`). AC requires `check:*` green. No BAML change ⇒ `baml:gen` is a
no-op for this ticket.

## Constraints & assumptions surfaced

- **Byte-identical-when-absent is load-bearing** — it's what preserves honest-empty for
  vend-on-itself and every non-seed project. The optional field must add nothing when absent.
- **One line by design** — the intent section is the deliberate exception to "names, not
  contents". The SEED content is emitted verbatim (the ticket says "content verbatim").
  Assumption: SEED.md may be multi-line in practice (the example seed); "verbatim" means
  emit whatever is there, trimmed or not — a Design decision.
- **Tolerant read, never throws** — absent SEED ⇒ `undefined` ⇒ no section. Matches the
  `listIdsIn` tolerance precedent.
- **No new exports leak** beyond `SEED_PATH = "SEED.md"` (ticket asks for this constant)
  and the optional `intent?` field on `SnapshotParts`.
- **Section placement** is unspecified by the ticket (only that the section exists). A
  Design decision — placement does not affect byte-identical-absence but does affect prompt
  legibility.
