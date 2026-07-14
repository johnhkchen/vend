# T-059-02 — Research

**Ticket:** overlay-the-tuned-charter-where-steer-reads-it
**Goal (descriptive):** make `vend init --template hackathon` write the seed's *tuned*
charter to `docs/knowledge/charter.md` (the path steer/decompose read), so a fresh seed
is graded against the demonstrable-slice value function, not the generic `CHARTER_STUB`.

A map of what exists today and how the pieces connect. No solutions proposed. The sibling
T-059-01 (intent → snapshot, `phase: done`) is the other half of E-059; this ticket is the
coupled-charter half its review §5 explicitly deferred here.

## The coupled-charter gap (why this ticket exists)

Three facts, all grep-verified, that together form the gap:

1. **Steer reads `docs/knowledge/charter.md`.** `CHARTER_PATH = "docs/knowledge/charter.md"`
   (`src/play/project-context.ts:18`). `assembleSteerInputs` (`steer.ts`) does a bare
   (non-tolerant) `readFile(join(root, CHARTER_PATH))` — the charter is *required*; the
   bounds gate greps it for live P#/N# ids, so it must be the REAL value function.
2. **The tuned charter ships at the seed ROOT, not where steer reads.** The rich
   demonstrable-slice charter lives at `examples/templates/hackathon-seed/charter.md`
   (73 lines, 3235 bytes — the 5 criteria: demo-advancing, grounded, session-sized,
   in-bounds, showable; gates H1–H3; the one-line value "*a demonstrable runnable slice
   over polish*"). It is a sibling example file, copied into the user's project tree by the
   seed copy step — but it is NOT what `vend init` overlays.
3. **`vend init --template hackathon` overlays only a SEED stub.** `TEMPLATE_REGISTRY.hackathon`
   (`init-core.ts:174`) is a single entry: `{ kind:"file", path:"SEED.md", contents:
   HACKATHON_SEED_STUB }`. The base manifest's `docs/knowledge/charter.md` slot carries the
   generic `CHARTER_STUB` (`init-core.ts:105`, 158). No overlay overrides it.

Net: even after T-059-01 wires the seed's *idea* into the snapshot, steer grades that idea
against the **generic stub** (the wrong value function). T-059-01's review §5 names this
exact gap and hands it to this ticket. The intended-but-unbuilt T-058-03 enrichment.

## The pure overlay/merge machinery — `src/init/init-core.ts`

This file is PURE (no fs, no addon — the first `node:fs` import is the sibling effect).
The pieces this ticket touches:

- **`CHARTER_STUB`** (line 105) — the generic base charter ("_Stub — author your project's
  value function here…_"). Lives in the base `SCAFFOLD_MANIFEST` at the
  `docs/knowledge/charter.md` slot (line 158). Bare `vend init` ships this; unchanged.
- **`HACKATHON_SEED_STUB`** (line 129) — the SEED stub the hackathon overlay already writes.
  Stays in the overlay (T-058-01 contract).
- **`TEMPLATE_REGISTRY`** (line 173) — `Readonly<Record<string, readonly ScaffoldEntry[]>>`.
  The single source of valid template names. Today `hackathon: [SEED.md entry]`. Adding the
  charter override is **one more entry** in this array.
- **`mergeManifests(base, overlay)`** (line 245) — the load-bearing function. An overlay
  entry at the SAME normalized path OVERRIDES the base entry **in the base's slot** (keeps
  position, takes the overlay's kind+contents); overlay-only entries append. So an overlay
  `docs/knowledge/charter.md` entry wins over the base `CHARTER_STUB` **before the disk is
  consulted**. Its header comment states exactly this: "what lets a template's tuned file
  win over the base stub BEFORE the disk is consulted". This is precisely the mechanism the
  ticket relies on — no new merge logic needed.
- **`planTemplate(existing, base, overlay)`** (line 273) — `planInit(existing,
  mergeManifests(base, overlay))`. The converge over the merged manifest; no-clobber +
  idempotency fall out of `planInit` over the effective manifest.

The existing pure tests (`init-core.test.ts:175–248`) already pin: overlay overrides a
same-path base file keeping its slot (`mergeManifests` "x/a.md" case), override does not
grow the list, `planTemplate` carries the override content, idempotent re-run → zero creates,
and the registry honest-empty/one-way-to-lisa invariants loop over **every** overlay entry.
That last loop (line 230, 241) means a new charter entry is automatically swept by the
honest-empty (`countDemandRows === 0`) and vend-owned-path guards — free coverage.

## The write effect — `src/init/init-effect.ts` (NO CHANGE)

`runInit(root, "hackathon")` (line 151) resolves the overlay via `resolveTemplate`, then
calls `applyInitScaffold(root, mergeManifests(SCAFFOLD_MANIFEST, overlay))` (line 157). The
overlay's charter rides the IDENTICAL write-if-absent / `wx` / no-clobber path as SEED.md —
**no effect code changes**. A user-edited `docs/knowledge/charter.md` is left byte-identical
by the same `wx`/EEXIST net that already protects SEED.md (init-effect.ts:101–110).

The existing effect tests (`init-effect.test.ts:225–315`, "runInit — template overlay")
already assert: known template applies base+overlay, idempotent second run, **a user-edited
overlay file is left byte-identical** (the SEED.md no-clobber case, line 263 — the same
guarantee now must hold for the charter), unknown-template writes nothing, lisa gate
precedes resolution, bare runInit unchanged (no SEED.md). The charter override needs the
analogous assertions added.

## Where the charter content comes from — the drift question

`init-core.ts` is PURE, so `HACKATHON_CHARTER` must be a **string literal** inlined in the
module (the `CHARTER_STUB` / `HACKATHON_SEED_STUB` precedent — all seed content is inline
template literals with escaped backticks). The canonical source is the seed file
`examples/templates/hackathon-seed/charter.md`. No code currently reads that path
(grep: zero references in `src/`). So inlining creates a **second copy** → a drift risk
between the shipped overlay constant and the example file.

Byte facts (verified): the seed charter is 3235 bytes, ends with a single `\n` (`...steer
by.\n`), starts `# Charter — **your hackathon project\n\n`, and contains backticks
(`` `vend steer` ``, `` `npm run build` ``, `` `docs/knowledge/charter.md` ``) that a TS
template literal must escape as `` \` ``. It contains no `${` sequences.

## The check gate

`bun run check` = `baml:gen` (no-op here — no BAML touched) + `check:typecheck`
(`tsc --noEmit`) + `check:test` (`bun test`). AC requires `check:*` green. The full suite
is 1316 pass / 0 fail as of T-059-01. No BAML change ⇒ no regen diff.

## Constraints & assumptions surfaced

- **`mergeManifests` already does the work.** This ticket adds DATA (one registry entry +
  one constant), not logic. No new pure function; no effect change. This is the lightest
  possible touch — the design space is mostly "where does the constant live + how is drift
  guarded", not "how does the override work".
- **Bare `vend init` must stay byte-identical to E-040.** The overlay is only reached via
  `--template hackathon`; the base manifest's `CHARTER_STUB` slot is untouched. The existing
  "bare runInit unchanged" test (line 304) guards this.
- **No-clobber on the charter is the safety.** A user who already edited
  `docs/knowledge/charter.md` (e.g. re-running init after tuning) must keep their edit. The
  `wx` flag already guarantees this; a test must pin it for the charter specifically.
- **Drift between the inlined constant and the example file is the one new risk.** A guard
  test (in the fs-capable effect test) reading the example file and asserting equality keeps
  them in sync, or the inlining must be mechanical (generate the literal from the file).
- **Honest-empty held by construction.** The overlay adds structure (SEED) + knowledge
  (charter) only — `countDemandRows(HACKATHON_CHARTER)` must be 0 (it's prose, no
  `vend chain "…"` / `- **E-NN`), and the existing registry loop test enforces it.
- **One-way-to-lisa held.** `docs/knowledge/charter.md` is a vend-owned path (base manifest
  already owns it); the overlay names no lisa marker. The existing one-way loop test enforces.
- **Section/format of the charter is the seed's, verbatim.** The ticket says "the tuned
  charter — the demonstrable-slice value function"; the source is the seed file as-is. No
  re-authoring — copy fidelity is the contract.
