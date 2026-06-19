# T-021-07 — Review: one-way-authority-guarantee

_Handoff. What changed, test coverage, open concerns — what a reviewer needs without the diffs._

## What this delivers

E-021's non-negotiable boundary, now **enforced** rather than merely intended: the
projection/render path **reads** the canonical board and **never writes** it. Two complementary
guarantees, both failing `bun run check`:

- **G2 (static):** a pure classifier scans every presentation module's source; the build fails if
  any module imports/calls a writer aimed at `docs/active`.
- **G1 (runtime):** an E2E snapshots `docs/active/**` byte-hashes, runs `load → project → render`,
  and asserts every source file is byte-identical afterward.

Defense in depth: G2 stops a writer at the source before it can run; G1 proves the bytes on disk are
untouched at runtime. The same belt-and-suspenders posture `model.ts` takes (`readonly` types **and**
`deepFreeze`).

## Files changed

| File | Change | Notes |
|---|---|---|
| `src/present/authority-guard.ts` | **new (~110 lines)** | Pure classifier core (G2). |
| `src/present/authority-guard.test.ts` | **new (~90 lines)** | Classifier unit tests + real-source scan. |
| `src/present/one-way-authority.test.ts` | **new (~80 lines)** | Byte-hash E2E (G1) + companions. |

No existing source modified. No `package.json` change — enforcement rides `check:test`, so a
violation fails `bun run check` with zero new plumbing (the live-board smoke-test precedent). No new
dependency. Committed as `3385cb2`.

## How the AC is satisfied

> An end-to-end test snapshots docs/active/** byte-hashes, runs load→project→render, and asserts
> every source file is byte-unchanged; a static check fails the build if any presentation module
> imports a writer/fs-write against docs/active.

- **Byte-hash E2E** — `one-way-authority.test.ts`: `hashTree` SHA-256s every file under
  `docs/active`, the pipeline runs (`loadWorkGraph` → `projectGraph` under DESIGNER/DEV/regrouped
  specs + `loadSeatSpec` → `JSON.stringify` render), then a re-hash is asserted byte-equal with a
  named drift report on any add/remove/change.
- **Static check** — `authority-guard.ts` + its real-source scan test: a module offends iff its
  comment-stripped code BOTH carries a write capability AND references `docs/active`. The scan reads
  every non-test `src/present/*.ts` and asserts zero violations; a violation fails `check:test` →
  fails the build.

## The two design subtleties that make it correct (not a blunt instrument)

1. **`presets.ts` writes the filesystem and must stay clean.** It imports `writeFile`/`mkdir` but
   targets `.vend/presets` (the spec store, the legitimate "edit the spec, never the data" write).
   The **conjunction** (writer AND `docs/active`-in-code) is what distinguishes it from a real
   offense — a pinned negative test case.
2. **Every present module names `docs/active/...` in header comments.** The path scan runs on
   **comment-stripped** code, so provenance pointers don't false-positive. A unit test asserts the
   stripped code no longer contains the token.

Plus the **E-012 lesson made structural**: the guard names the forbidden primitives as string
*data*, but detection is **import/call-shaped**, so the guard passes its own scan — proven by a
self-check test, not assumed (the inverse of the committed-gate's old self-exemption blind spot).

## Test coverage

- **My new tests: 10 pass / 0 fail / 26 expect()** (`bun test` on the two files). `tsc --noEmit`
  reports **zero errors in my three files**.
- G2 unit cases: write-to-board positive; presets-shaped writer-to-`.vend` negative; comment-only
  `docs/active` negative; `Bun.write` positive + negative; namespace-import write; guard self-check.
- G2 integration: real `src/present/*.ts` scan, with a non-vacuous "known modules covered" assertion
  so a mis-globbed empty read can't pass.
- G1: byte-hash equality over the live board (asserted non-empty first); graph reference-unchanged +
  `Object.isFrozen`; the loader (`src/graph/load.ts` — the one module naming `docs/active` in code)
  classified clean.

### Coverage gaps (honest)

- The byte-hash test brackets the **read path that exists** (no renderer yet). The render leg is
  `JSON.stringify` (design D3); when a real renderer lands it slots into the same bracket.
- `stripComments` is a pragmatic regex, not a tokenizer. A `//` inside a string literal could
  over-strip — but that only risks a *false negative* on `docs/active`, which G1's byte-hash still
  catches at runtime. Behavior is pinned by unit tests; accepted (consistent with the house
  pragmatic-string posture in `committed-core`).

## ⚠ Flag for human attention — concurrent-thread breakage in the shared check

`bun run check` is **currently red**, but **not from this work**. Two **untracked** files —
`src/present/paper.ts` / `src/present/paper.test.ts`, the **T-021-06 paper renderer** from a
concurrent Lisa thread on this branch — fail typecheck (`paper.test.ts` can't resolve `./paper.ts`;
an implicit `any`). That thread owns committing/fixing them. **I committed only my three files**, so
*committed HEAD* typechecks clean (paper.* stay outside HEAD). The check goes green for everyone once
the T-021-06 thread lands its renderer. Confirm before relying on a green shared gate.

One forward note: T-021-06's `paper.render` is the eventual real "render" leg for G1's E2E — a
trivial one-line swap from `JSON.stringify` once it lands, at which point this guarantee covers the
true render path end-to-end.

## Bottom line

Both AC teeth are implemented, tested, and green in isolation; committed HEAD builds clean. The only
red in the shared gate is a sibling thread's uncommitted in-progress renderer, flagged above.
