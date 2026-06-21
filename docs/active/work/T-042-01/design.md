# T-042-01 — Design: doctor-check-report-model

_Decisions, grounded in research.md. One choice per question, with what was rejected._

## The shape of the thing

A pure module `src/doctor/doctor-core.ts` exporting:
- a `Check` data shape (name, ok, optional fix-it hint),
- two small constructors (`passed` / `failed`) so the probe and tests mint canonical checks,
- a pure `renderDoctorReport(checks)` → `{ ok, exitCode, report }`,
- the exit-code constants as an R12 shared contract.

Every decision below serves: *the core decides what a set of check results MEANS; the probe
(T-042-02) and CLI (T-042-03) never re-derive it.*

## D1 — `Check`: optional hint, or required-on-failure?

**Decision: `hint?: string`, optional, conventionally present iff `ok === false`.**

TypeScript can't ergonomically enforce "hint required exactly when ok is false" without a
discriminated union (`{ ok: true }` | `{ ok: false; hint: string }`). I considered that
union — it would make a hintless failure un-constructable.

**Rejected** because: (a) the existing cores model their result shapes as flat interfaces
with optional fields (`PrecommitRun.stderr?`, `CommitResult.summary?`), not discriminated
unions, and consistency matters more than a marginal type win here; (b) the probe builds
checks programmatically and a flat shape is simpler to map into; (c) the renderer must be
robust to a hintless failure anyway (a probe bug shouldn't crash the renderer — house rule:
returned data, never thrown). The `passed`/`failed` constructors enforce the convention at
the *construction* site instead (`failed` requires a hint argument), which is where it's
natural. A green check carries no hint.

## D2 — List all checks, or only offenders?

**Decision: the report lists EVERY check — green and red — each marked.**

This is the deliberate divergence from history-core / committed-core, which surface only
offenders (an audit wants the red list). The AC is explicit: an all-green set "renders each
dep green"; the epic's "Done looks like" says "reports each dep green and exits 0". Doctor
is a **preflight status checklist** a human reads to confirm the environment — they want the
full green checklist as positive confirmation, not silence. So every check renders as a
line; a failing check additionally carries its hint.

**Rejected:** offenders-only (would satisfy the failing-case AC but violate "renders each
dep green"). **Rejected:** greens silent + a "N passed" tally (loses the per-dep
confirmation the preflight exists to give).

## D3 — Exit code: where does the number live, and what is it?

**Decision: the core computes `exitCode` (0 all-green, 1 any-fail) and exports the two
values as `EXIT_OK`/`EXIT_FAILED` R12 constants.** The CLI reads `report.exitCode` and calls
`process.exit` — it never literals `0`/`1` itself.

`1` (not `2`) for failure: `2` is reserved for *usage* errors in `cli.ts`; a failed dep is
an operational andon, which the dispatch uniformly maps to `1`. This keeps doctor consistent
with `chain`/`work`/`select` (`exit(outcome === "success" ? 0 : 1)`).

**Rejected:** returning only the `ok` boolean and letting the CLI pick the number — that
would re-locate the contract in the shell, the exact R12 anti-pattern the cores avoid.

## D4 — The empty check set

**Decision: empty set → `ok: true`, `exitCode: 0`, but an HONEST report line ("no checks to
run"), never a misleading "all green".**

Mirrors history-core's honest-empty (empty range → `anyRed: false` + "no commits in range").
Vacuously, zero failures ⇒ ok. But the report text must not claim "all deps green" when
nothing was checked — so the empty branch prints a distinct, truthful line. In practice the
probe always supplies ~3 checks, so empty is a degenerate/test-only input; modelling it
honestly (rather than throwing) is the house rule.

**Rejected:** throw on empty (violates returned-data-never-thrown; an empty set is a valid,
if degenerate, input). **Rejected:** empty → non-zero (a renderer given nothing hasn't
*found* a broken dep; the brokenness, if any, is the probe's to report — the core stays a
faithful function of its input).

## D5 — Report format

**Decision: a header tally line, then one indented marked line per check.**

```
doctor: ok — 3 check(s) passed
  ✓ lisa on PATH
  ✓ claude on PATH
  ✓ BAML native addon loadable
```

On any failure:
```
doctor: FAILED — 1 of 3 check(s) failed
  ✓ lisa on PATH
  ✗ claude on PATH — install Claude Code and put `claude` on your PATH
  ✓ BAML native addon loadable
```

- Glyphs `✓` / `✗` mark each line (matches the andon/tally vocabulary used across the repo's
  renderers). The header NAMES the count of failures, the E-008 "name the failure" style.
- The failing line is `✗ <name> — <hint>`, with the hint whitespace-collapsed to one line
  (the `tail`/`summarySuffix` idiom) and guarded so a missing hint never prints `undefined`.
- **Plain text, no color.** The pure core stays presentation-minimal; color is a CLI concern
  (T-042-03, mirroring `renderReceipt`'s `{ color }` option which lives in the play layer).
  Keeping color out keeps this core's output deterministic and trivially assertable.

**Rejected:** a single-line summary (loses the per-dep checklist D2 requires). **Rejected:**
JSON output (the CLI prints human text; a `--json` mode, if ever wanted, is a later concern).

## D6 — Constructors `passed` / `failed`

**Decision: export `passed(name)` and `failed(name, hint)`.** They mint canonical `Check`
values so the probe (T-042-02) and tests never hand-build the object shape (and so the
hint-on-failure convention from D1 is enforced at construction: `failed` *requires* a hint).
Cheap, and it keeps the `Check` shape's single source of truth in the core.

**Rejected:** no constructors (callers spell out `{ name, ok: false, hint }` — more
duplication, easier to mint an inconsistent check, e.g. `ok: false` with no hint).

## D7 — Module/dir placement

**Decision: new `src/doctor/` dir; `doctor-core.ts` + `doctor-core.test.ts`.** Mirrors
`src/init/` (E-040) and `src/ci/` — one dir per capability, `*-core` + `*-core.test`. The
T-042-02 probe effect will sit beside it as `doctor-probe.ts` (or `*-effect.ts`), the CLI
arm extends `src/cli.ts`. Nothing in this ticket touches `cli.ts` or adds a dep.

## Surface summary (frozen for Structure)

```ts
export interface Check { readonly name: string; readonly ok: boolean; readonly hint?: string; }
export interface DoctorReport { readonly ok: boolean; readonly exitCode: number; readonly report: string; }
export const EXIT_OK = 0; export const EXIT_FAILED = 1;
export function passed(name: string): Check;
export function failed(name: string, hint: string): Check;
export function renderDoctorReport(checks: readonly Check[]): DoctorReport;
```
