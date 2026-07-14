# T-057-02 — Review

_Handoff document. What changed, how it's tested, what a reviewer should know — without reading
every diff._

## What this ticket did

Threaded the annotation provenance (the `Annotation` type + `renderAnnotationProvenance` shipped
pure in T-057-01) through expand-fragment's EXISTING cast/effect, so a cleared annotation now
STAGES one Signal under `docs/active/pm/staged/` carrying the provenance trailer + back-link —
reusing the inherited clearing, gates, pricing, and one-way-authority staging, rebuilding none of
them. This is the inbound half of E-057's round-trip wiring; the `vend annotate` CLI seam is the
separate next slice (T-057-03), deliberately out of scope.

## Files changed

| File | Change |
|---|---|
| `src/play/expand-effect.ts` | `ExpandFragmentInputs` gained `readonly annotation?: Annotation`. `renderStagedSignal` gained an optional `annotation?` param and appends `renderAnnotationProvenance(signal, annotation)` after the origin trailer when present. `expandFragmentEffect` now writes `renderStagedSignal(signal, ctx.inputs.annotation)`. |
| `src/play/expand-fragment.ts` | Imported `type Annotation`. `ExpandFragmentOptions` gained `readonly annotation?: Annotation`. `assembleExpandFragmentInputs` copies `opts.annotation` into the returned inputs — the cast is now annotation-capable end to end. |
| `src/play/expand-effect.test.ts` | Hoisted `FULL_ANNOTATION` to module scope (removed the inner duplicate). Added `annotatedCtxFor`. Added the AC effect test. |

Four production lines of behavior + one test + a fixture hoist. One atomic commit (`94598be`).

## How it works

The annotation rides `ctx.inputs` — the engine's established side-channel into the effect — so
the `Play.effect` signature stays exactly `(signal, ctx)` and `castPlay` is untouched. The
document stays a single PURE function: `renderStagedSignal` composes the already-pure
`renderAnnotationProvenance`, so determinism, fs-freedom, and BAML-freedom all hold. `render`
(BAML) never sees the annotation — provenance is staging-time metadata, not prompt input.

The trailer is **additive**: the machine origin trailer ("_Staged by Vend's `expand-fragment`
play — not promoted_") stays, and the human origin trailer ("_Provenance: … raised by **seat** …_"
+ back-link) stacks below it. With no annotation, the staged file is byte-identical to before.

## Test coverage

- **AC#1 effect test (new)** — `expandFragmentEffect(FULL_SIGNAL, annotatedCtxFor(root))` against
  a `mkdtemp` projectRoot (stubbing the cast exactly as the sibling tests do). Asserts the staged
  `<slug>.md` contains the trailer (`Provenance:`, the seat, the nodeId), the back-link
  (`Back to the annotated work item`, ``[`T-055-01`]``, `../../tickets/T-055-01.md`), and the
  origin trailer is still present; then asserts NO write to `demand.md`/`epic`/`stories`/`tickets`
  and that `STAGING_DIR` exists. This is the AC verbatim.
- **Regression** — the existing `renderStagedSignal` and effect tests (no annotation) stay green,
  proving the optional param did not perturb the `vend expand` path. The T-057-01
  `renderAnnotationProvenance` pure block still pins the trailer's content.
- **Gate** — `bun run check`: `tsc --noEmit` clean; `bun test` **1287 pass / 0 fail** (1286 prior
  + 1 new). File-scoped: 14 pass / 0 fail.

### Coverage gaps (intentional)

- `assembleExpandFragmentInputs` / `castExpandFragment` carrying the annotation end-to-end is NOT
  unit-tested — these are the project's untested impure assemble/cast verbs by convention (their
  logic is the pure formatter + thin fs reads + the engine's tested core). The thread is a single
  field copy, type-checked. Acceptable per house pattern; an integration test arrives naturally
  with the `vend annotate` CLI (T-057-03).

## Open concerns / notes for the reviewer

- **No new write target** — the only fs verb is still the one `writeFile` into `STAGING_DIR`. The
  one-way-authority invariant is asserted directly in the new test, not just argued. ✓
- **Forward references** — `ExpandFragmentInputs` (top of `expand-effect.ts`) references
  `Annotation` (declared lower); `renderStagedSignal` calls `renderAnnotationProvenance` (also
  lower). Both resolve fine (types hoist; `renderAnnotationProvenance` is a hoisted function
  declaration). `tsc` confirms.
- **Scope discipline** — stopped at `assembleExpandFragmentInputs`; did NOT add the `vend
  annotate` gesture/flag surface (T-057-03) nor any live comment-fetch MCP stage (named E-057
  follow-on). No invariant regressed.
- **Nothing for a human to unblock** — the slice is self-contained and green. The next ticket
  builds the CLI on top of this now-annotation-capable cast.
