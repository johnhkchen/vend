# T-021-07 — Design: one-way-authority-guarantee

_Options, tradeoffs, decision with rationale. Grounded in research.md._

## What we must deliver

Two independent guarantees, both failing the build (`bun run check`) when violated:

- **G1 (runtime):** running the read path leaves `docs/active/**` byte-for-byte unchanged.
- **G2 (static):** no presentation module writes against `docs/active`.

These are complementary: G1 catches a write that *happens at runtime* through any path (even one a
static scan misses); G2 catches a write capability *introduced in source* before it can ever run.
Defense in depth — the same belt-and-suspenders posture model.ts takes (`readonly` types **and**
`deepFreeze`).

---

## D1 — Where does enforcement live: `bun test` vs a `check:*` script + hook?

- **Option A — `bun test` files.** Both guarantees run as ordinary tests. Reading `docs/active/**`
  and reading `src/present/*.ts` are pure fs *reads*; a test can do them. A failing test fails
  `check:test`, which fails `check`. Zero package.json/hook plumbing.
- **Option B — a `check:authority` script + lisa hook**, mirroring `check:committed`.

**Decision: A.** The `check:committed`/`check:head` scripts live outside `bun test` *only because*
they inspect host **git** state a normal test can't reach (research.md). This guard inspects
**repo files on disk** — exactly what a test does. Option B would add a script, an `import.meta.main`
verb, an exit-code vocabulary, and a hook for no benefit the test surface doesn't already give. The
live-board smoke test (`load.test.ts`) is the precedent: an in-repo invariant proven by a test.
Rejected B.

## D2 — The static check: detection strategy

The hard part (research.md): `presets.ts` legitimately imports `writeFile`/`mkdir` (writes to
`.vend/presets/`), and **every** present module names `docs/active/...` in header comments. So
neither "imports a writer" alone nor "mentions docs/active" alone is the offense.

- **Option A — AST parse** each module, resolve write-call arguments to paths, flag a literal under
  `docs/active`. Most precise; heaviest. No AST dependency in the repo; can't resolve a path built
  from a variable. Over-engineered for the house "pragmatic string classifier" idiom.
- **Option B — comment-stripped conjunction.** Strip line/block comments, then flag a module iff it
  **(a)** imports a write primitive from `node:fs`/`node:fs/promises` (or calls `Bun.write(` /
  `createWriteStream(`) **AND (b)** references a `docs/active` path literal **in code**. presets.ts:
  writer present, but no `docs/active` in code (only `.vend/presets`) → **not flagged**. project.ts /
  translate.ts: `docs/active` only in comments (stripped) and no writer → **not flagged**.
- **Option C — blanket "no present module imports any fs writer," allowlist presets.ts.** Simple,
  but (i) contradicts the AC's explicit "against docs/active" scoping, (ii) an allowlist is the
  E-012 self-exemption smell, (iii) forbids a *future* legitimate non-graph write in the present
  layer.

**Decision: B.** It matches the AC wording exactly ("a writer/fs-write **against docs/active**"),
mirrors `committed-core`'s pragmatic-string philosophy ("over-flag a weird path beats missing it"),
and needs no new dependency. The conjunction is what makes it precise *and* honest about presets.ts.

Detection details (the teeth that avoid false positives **and** the E-012 self-exemption trap):

- **Writer detection is import/call-shaped, not mention-shaped.** A write primitive counts only when
  it appears as an **import specifier** from a `node:fs*` module, or as a **call** `Bun.write(` /
  `createWriteStream(`. The guard's own core lists `"writeFile"` etc. as **string-array data** — not
  an import, not a call — so the guard module is **not self-flagged**, and needs **no exclusion**
  from its own scan. (This is the deliberate inverse of the E-012 blind spot: we make the guard pass
  its own check *by construction*, then prove it with a test, rather than exempting it.)
- **`docs/active` detection is on comment-stripped code**, substring `docs/active`. (A path built via
  `join(root, "docs/active", …)` still contains the literal — caught; full path resolution is out of
  scope, consistent with committed-core.)
- **Shared contract (R12).** `WRITE_PRIMITIVES` and the protected token `PROTECTED_PATH =
  "docs/active"` are exported consts — the single source every consumer derives from.

## D3 — The runtime check: what is "render" with no renderer?

No renderer module exists (research.md). Options for the third leg:

- **Option A — `load → project` only**, document render as deferred.
- **Option B — `load → project → JSON.stringify(projection)`** as a trivial textual render.
- **Option C — block on the renderer epic.** Rejected: the ticket is `depends_on: [T-021-01,
  T-021-05]` (both landed); it is not blocked on a future epic, and the *guarantee* is exactly what
  must exist *before* a renderer is written, so a future renderer inherits a tested invariant.

**Decision: B.** Serializing the projection is an honest stand-in for "render" — it exercises the
full read path producing output — and the byte-hash assertion **brackets the entire pipeline**
regardless of what "render" becomes. When the real renderer lands, swapping it into this test is a
one-line change and the guarantee already holds. We run the pipeline under **multiple specs/seats**
(designer + dev presets, two `groupBy` axes) plus `loadSeatSpec` (which reads `.vend`, never
docs/active) so the test exercises the *calibration* read path too, not just one projection.

## D4 — Byte-snapshot mechanism

- Walk `docs/active/**` recursively → a sorted `Map<relpath, hash>`.
- Hash with **`node:crypto` SHA-256** over file bytes (collision-safe; `Bun.hash` is non-crypto but
  would also suffice — SHA-256 is the unambiguous "byte-unchanged" proof the AC asks for).
- Snapshot **before**, run the pipeline, snapshot **after**, assert the two maps are deep-equal
  (same key set, same hashes). A new/deleted file or any byte change fails with a named diff.
- The snapshot is **read-only**; the test itself must not write under `docs/active` (it writes
  nothing — projection is in-memory; any preset I/O in the test is redirected to a `mkdtemp` dir).

## D5 — File layout

- **`src/present/authority-guard.ts`** — the PURE classifier (core of G2). No fs, no imports beyond
  types. Exports `WRITE_PRIMITIVES`, `PROTECTED_PATH`, `stripComments`, `importsWriter`,
  `referencesProtectedPath`, and `classifyAuthorityViolations(sources) → Violation[]`.
- **`src/present/authority-guard.test.ts`** — (a) unit tests of the classifier over fabricated
  sources (positive: a module that writes to docs/active; negatives: presets-shaped writer-to-.vend,
  pure-module-with-docs/active-in-comments, the guard's own source); (b) the **real-source scan**:
  read every `src/present/*.ts` (non-test) from disk and assert zero violations.
- **`src/present/one-way-authority.test.ts`** — G1: the byte-hash E2E over the live board.

Two test files (static vs runtime) keep each concern's failure message unambiguous — house
one-concern-per-file leaning. The classifier gets its own pure core so its judgment is unit-testable
in isolation, exactly as `committed-core` is split from `check-committed`.

## D6 — Rejected alternatives (summary)

- Enforce only at runtime (G1) — misses a writer added to source that a given test path doesn't
  exercise. Kept G2.
- Enforce only statically (G2) — a string scan can't prove *bytes* are untouched at runtime. Kept G1.
- Put the guard in `src/ci/` next to the other gates — it polices the **present layer's** invariant
  and runs as a test, not a host-git hook; co-locating with the layer it guards (`src/present/`) is
  clearer. Rejected `src/ci/` home.

## Open questions (resolved by decisions above)

- *Does presets.ts violate one-way authority?* No — it writes the **spec store** (`.vend/presets`),
  the calibration persistence, never the graph. This is the canonical negative test case for G2.
- *Is freezing already enough?* In-memory yes (`deepFreeze`); but freeze does not prove **on-disk**
  bytes are untouched, nor prevent a *new* module importing a writer. G1+G2 close both.
