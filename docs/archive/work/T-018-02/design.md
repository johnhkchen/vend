# T-018-02 Design — register-steer-and-gesture

Decisions, with rationale, grounded in the research. The shape is fixed by precedent: this is
the **sixth play**, register/effect/gesture exactly as Survey (T-017-02) did, with the one
genuine new dimension — the **forks** — threaded through the effect and the staged artifact.
Where a choice is forced by the codebase reality, the precedent IS the rationale; the design
work is the handful of places steer genuinely diverges from survey.

## D1 — Module layout: three files, mirroring Survey's three

**Decision.** Create `src/play/steer-effect.ts` (addon-free effect + `SteerInputs`),
`src/play/steer.ts` (the BAML-loading registered play + `castSteer`), and
`src/play/steer-effect.test.ts` (the AC#3 offline proof). The pure core, the BAML bridge, and
their tests already exist from T-018-01.

**Why.** This is the house split every play follows (core / effect / shell), proven five times
(decompose, propose, note, expand, survey). `steer.ts` value-imports `b` (the native addon), so
no `bun test` may value-import it; the effect must therefore live in its own addon-free module so
`steer-effect.test.ts` can exercise it as an ordinary temp-dir test. **Rejected:** folding the
effect into `steer.ts` — it would make the AC#3 end-to-end staging proof impossible to write
offline (the addon's once-per-process limit hangs the second native call), breaking the very test
the ticket requires.

## D2 — `parseSteer`: NO try/catch (the divergence from `parseSurvey`)

**Decision.** `parseSteer(text) = b.parse.SteerProject(text)` — a thin, total wrapper with **no**
`try/catch` and **no** `EMPTY_STEER` coercion closure. Keep it as a named, doc-commented exported
function (not inlined) so the *reason it has no catch* is documented at the call site.

**Why.** `steer.test.ts` pins (probed live, T-018-01 Step 5) that `Steer` — a two-array class like
`WorkPlan` — makes the SAP parser **degrade** BOTH an object-shaped reply lacking the fields AND a
bare unstructured string to `{signals:[], forks:[]}`; it **never throws**. The gates clear an empty
steer as a clean honest-empty abstention on both sides. So the `parseSurvey` catch (Board is
single-array and throws on a bare string) has no analogue here — adding one would be dead code that
misleads a reader into thinking Steer can throw. **Rejected:** mirroring `parseSurvey`'s catch for
"symmetry" — symmetry to a different parse contract is a bug, not consistency. Documenting the
divergence in the doc-comment is the correct parity.

## D3 — The effect stages BOTH halves: board (reused) + forks (reused)

**Decision.** `renderStagedSteer(steer)` composes:
- **the board half** via survey-core's `renderBoard` (which maps expand-core's `renderSignalRow`
  over the signals) — passing `{ signals: steer.signals }` so the staged board is **byte-identical**
  to a Survey board (same demand.md table);
- **the fork half** via steer-core's `renderForks` under a `## Forks` heading.

Three render branches (design D5 of survey, extended):
1. **Fully empty steer** (`signals:[]`, `forks:[]`) → a single honest "steered, nothing to stage"
   abstention note (IA-4 language, both sides), no table, no forks section. A success leaves a trace.
2. **Board, no forks** (`signals` non-empty, `forks:[]`) → the `# Steer` heading + demand table +
   `## Pull these` block, then a one-line "no forks — the path is clear" note in place of the forks
   section (the clear-path abstention is legible, not a silent omission).
3. **Board + forks** → heading + table + `## Pull these` + `## Forks` (the `renderForks` blocks) +
   origin trailer.

**Why.** The headline of the ticket is "the ranked board **and** the real forks in one gesture" —
the staged artifact must show both. Reusing `renderBoard`/`renderForks` keeps the board row a single
shared contract (no drift from Survey) and the fork block the single shared contract from
steer-core. `{ signals: steer.signals }` is the explicit Board view; passing `steer` directly would
also typecheck (Steer is structurally a Board) but the explicit projection reads clearer and signals
intent. **Rejected:** re-implementing the row/fork rendering here — that is exactly the drift the
shared-contract reuse prevents; **rejected:** omitting the "no forks" note when forks are empty — a
silent gap reads as a bug, and the clear-path abstention is a *positive* result worth stating.

## D4 — Idempotent overwrite to a fixed stem `steer.md`

**Decision.** Stage to a fixed `STEER_STEM = "steer"` → `docs/active/pm/staged/steer.md`,
overwriting on re-steer.

**Why.** A steer has no id and no DAG identity (the survey-board D4 reasoning, board+forks). It is a
draft you iterate on, not an artifact with identity, so re-steering overwrites rather than
accumulating. Distinct stem from `survey-board.md` so the two plays' drafts coexist in the inbox.
**Rejected:** a per-run timestamped name — that accumulates stale drafts (overproduction); the human
reviews the latest.

## D5 — `SteerInputs = { project, charter }`; assemble like Survey (`srcFiles: []`)

**Decision.** `SteerInputs {project, charter}` (defined in `steer-effect.ts`, the survey-effect
placement). `assembleSteerInputs` reads the real charter + lists stories/tickets +
`buildProjectSnapshot({root, srcFiles: [], stories, tickets})` — identical to `assembleSurveyInputs`.

**Why.** `SteerProject(project, charter)` takes the same two inputs as `Survey`. The snapshot is a
thin go-and-see *listing*; the heaviness of steer's read is the model's agentic file-reading during
the live cast, not the snapshot. Mirroring survey keeps one assembly contract and a sane prompt
size. **Rejected:** walking `src/**` into the snapshot — survey deliberately reads board state, not
the src tree, and the forks are steered off the same demand gradient; a src walk bloats the prompt
for no gain (the model reads files itself).

## D6 — Budget: `{ timeMs: 2_400_000, tokens: 400_000 }` (above Survey's 300k)

**Decision.** Pre-fill `steerProjectPlay.budget = { timeMs: 2_400_000, tokens: 400_000 }` (40 min /
400k tokens), inlined (never imported from the shelf — that edge would cycle), with a
`// recalibrate from the log (E-013)` note.

**Why.** The ticket is explicit: the heaviest read yet (board **and** forks), pre-fill **above**
Survey's 300k (which held). 400k tokens is a generous measured **floor**, +33% over survey for the
fork-surfacing work; 40 min wall-clock gives the deeper read room. Heed E-016/E-017: expand
under-shot (100k ceiling, 211k spent), survey corrected by going generous — steer continues that.
A fallback only; the gesture passes an explicit budget, and the live cast at sweep is the
calibration source. **Rejected:** copying survey's 300k — the ticket forbids it (steer does more);
**rejected:** a cold-start guess far above — overshooting wastes the latch budget; 400k is a
reasoned floor, not a guess.

## D7 — Card, name, gesture shape

**Decision.** `PLAY = "steer"`. `card: { color: ["blue","green"], type: "permanent", rarity:
"rare" }` (the Survey card). The gesture is `vend steer [--budget <ms>,<tokens>]` — **flags-only**,
no positional subject, exactly `parseSurveyArgs`.

**Why.** Steer is a reusable articulation play (Blue planning + Green ramp), cast forever — the same
classification as Survey, one rung up. Like Survey it reads the WHOLE project, so there is no
subject to type; reading the project IS the gesture (read-never-invent is the gate, not a per-row
pull). Reusing `parseSurveyArgs`'s shape (a fresh `parseSteerArgs` with identical logic — the
no-shared-util idiom: copy the five lines, don't couple two commands' parsers) keeps the CLI
uniform. **Rejected:** a positional subject — there is none; **rejected:** adding White to the card
for the fork-genuineness gate — Survey already carries gates without White; parity wins over
fine-tuning.

## D8 — Dispatch arm mirrors the Survey arm

**Decision.** In `import.meta.main`, add a `parsed.cmd === "steer"` arm that lazy-imports
`{ castSteer, steerProjectPlay }` from `./play/steer.ts`, resolves `budget = parsed.budget ??
steerProjectPlay.budget`, casts, prints the run line, and `process.exit(summary.outcome ===
"success" ? 0 : 1)`.

**Why.** Identical to every other gesture arm — the lazy import keeps the BAML addon off the
pure-parse path; the success→exit-0 / andon→exit-1 contract is the house rule so a shell/CI sees the
andon. A read-never-invent / fork-genuineness refusal halts inside `castPlay` as a `gate-failed`
outcome → exit 1, nothing staged (AC#2). **Rejected:** a non-lazy import — it would load the addon
whenever the CLI parses any command.

## Acceptance-criteria trace

- **AC#1** (registered play + `castSteer`): D2, D6, D7 — `steerProjectPlay` registered with the
  generous budget; `castSteer({budget,…})` casts via `castPlay`.
- **AC#2** (`vend steer` stages board+forks; refusal halts with andon): D3, D8 — the effect stages
  both halves; a gate STOP → `gate-failed`, nothing staged.
- **AC#3** (fixture/canned test proves project→staged steer; staging not live): D1, D3, D4 —
  `steer-effect.test.ts` against a temp-dir root.
- **AC#4** (`bun run check:*` green): the implementation/plan phases.
