# T-059-02 — Plan

Ordered, independently-verifiable steps. The change is DATA + tests; the merge/effect
machinery is reused untouched. One atomic commit's worth of work.

## Testing strategy (decided up front)

- **Pure layer (`init-core.test.ts`)** owns the overlay-as-data + merge-override pins —
  no fs, matches the house pure-test discipline. This is the high-leverage coverage: it
  proves the tuned charter is in the registry and wins over the stub via `mergeManifests`.
- **Effect layer (`init-effect.test.ts`)** owns the write/override/no-clobber temp-dir pins
  plus the **drift guard** against the authored seed file.
- **No live model.** End-to-end metered proof is T-059-03.
- **Verification gate:** `bun run check` (`baml:gen` no-op + `tsc --noEmit` + `bun test`).

## Step 1 — Generate the byte-exact `HACKATHON_CHARTER` literal

**Do:** mechanically derive the constant from the authored source so it is byte-identical
(no hand transcription). From repo root, escape the file's `` ` `` → `` \` `` and `${` →
`\${` (the file has no `${`, but escape defensively), wrapping in a template literal.
Produce the exact text to paste into `init-core.ts`.

**Verify:** the generated literal, when evaluated, `=== readFile(seed charter)`. (Step 4's
drift guard is the durable proof; here, a one-off check that the escape is correct.)

**Why first:** the constant's byte-fidelity is the foundation; everything else asserts on it.

## Step 2 — Edit `src/init/init-core.ts`

**Do:**
1. Insert `const HACKATHON_CHARTER = \`…\`;` (from Step 1) after `HACKATHON_SEED_STUB`,
   with the JSDoc from `structure.md` (tuned value function, overlaid at `CHARTER_PATH`,
   overrides `CHARTER_STUB`, byte-equal to the seed file, honest-empty, vend-owned).
2. Add `{ kind: "file", path: "docs/knowledge/charter.md", contents: HACKATHON_CHARTER }`
   to `TEMPLATE_REGISTRY.hackathon` (after the SEED.md entry).
3. (Optional, non-load-bearing) tighten the `TEMPLATE_REGISTRY` JSDoc forward-reference so
   it no longer says the tuned charter is "T-058-02/03" deferred — it landed here.

**Verify:** `tsc --noEmit` clean (the constant is a plain string; the registry type is
unchanged). `resolveTemplate("hackathon")` now has 2 entries.

## Step 3 — Pure pins in `src/init/init-core.test.ts`

**Do:** add `describe("hackathon overlay — the tuned charter override (T-059-02)")` with:
- charter entry present in `resolveTemplate("hackathon")`, contents `!== CHARTER_STUB`,
  includes tuned markers (`"demonstrable runnable slice"`, `"Demo-advancing"`).
- `mergeManifests(SCAFFOLD_MANIFEST, overlay)` carries the tuned charter at the
  `docs/knowledge/charter.md` slot (NOT the stub); merged length === base + 1 (only SEED.md
  is overlay-only).
- `planTemplate([], SCAFFOLD_MANIFEST, overlay)` creates the charter with tuned contents.
- `countDemandRows(charter entry contents) === 0` (explicit honest-empty).
- the BASE `SCAFFOLD_MANIFEST` charter slot is still `CHARTER_STUB` (bare-init regression).

Note `CHARTER_STUB` is NOT exported — assert "not the stub" via a stable substring of the
stub (e.g. `"author your project's"`) being ABSENT from the tuned charter and present in the
base entry, OR compare against the base `SCAFFOLD_MANIFEST` entry's contents directly (the
base entry IS reachable). Prefer the latter: `const baseCharter = SCAFFOLD_MANIFEST.find(e
=> e.path === "docs/knowledge/charter.md")` → assert overlay charter `!==` base charter.

**Verify:** `bun test src/init/init-core.test.ts` green.

## Step 4 — Effect pins + drift guard in `src/init/init-effect.test.ts`

**Do:**
1. Add `resolveTemplate` to the `./init-core.ts` import.
2. Inside (or beside) `describe("runInit — template overlay (T-058-01)")` add:
   - **tuned charter written:** `runInit(root, "hackathon")` → `readFile(join(root,
     "docs/knowledge/charter.md"))` equals the overlay charter; in `result.created`.
   - **bare writes the stub:** `runInit(root)` → that file equals the base `CHARTER_STUB`
     (reach it via `SCAFFOLD_MANIFEST.find(...)`).
   - **idempotent:** second `runInit(root, "hackathon")` → charter in `skipped`, unchanged.
   - **no-clobber:** pre-write a user charter (mkdir parent first), `runInit(root,
     "hackathon")`, assert the user bytes survive.
   - **drift guard:** `readFile("examples/templates/hackathon-seed/charter.md")` ===
     the `docs/knowledge/charter.md` entry's contents in `resolveTemplate("hackathon")`.

**Verify:** `bun test src/init/init-effect.test.ts` green; drift guard passes (proves the
inline literal matches the authored source byte-for-byte).

## Step 5 — Full gate

**Do:** `bun run check`.

**Verify:** `baml:gen` zero diff (no BAML touched); `tsc --noEmit` clean; full `bun test`
green (≥1316 pass, the T-059-01 baseline, + the new pins; 0 fail). Then a manual sanity:
`runInit` on a scratch temp root with `--template hackathon` leaves a `docs/knowledge/
charter.md` whose first line is `# Charter — **your hackathon project`.

## Rollback / risk notes

- **Single-file behavior change** (`init-core.ts` data) — trivially revertable.
- **Drift guard couples a test to `examples/…/charter.md`.** If that file is later removed,
  the test fails loudly — the correct signal (the overlay would be orphaned). Documented in
  `review.md` as a known coupling, not a defect.
- **No effect/merge code changed**, so the no-clobber/idempotency guarantees are the already-
  proven `wx` writer — the new tests confirm they extend to the charter, they don't re-derive.
- **Escape correctness** is the one transcription hazard; Step 1 makes it mechanical and
  Step 4's drift guard makes any error a red test, not a silent ship.

## Commit (when Lisa commits — not in this session)

Suggested message:
`feat(init): overlay the tuned hackathon charter at docs/knowledge/charter.md (T-059-02)`
— body: the coupled-charter gap closed; steer now grades the seed against the demonstrable-
slice value function, not the generic stub; data-only override via `mergeManifests`,
no-clobber held, drift-guarded against the authored seed charter.
