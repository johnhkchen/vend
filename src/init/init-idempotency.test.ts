import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { countDemandRows, SCAFFOLD_MANIFEST } from "./init-core.ts";
import { runInit } from "./init-effect.ts";

// T-040-04 init-idempotency-and-validate (story S-040-02, epic E-040) — the closing slice's
// end-to-end PROOF of the epic's "done looks like": `vend init` turns a bare lisa project into a
// lisa-VALID vend+lisa project with an honestly-empty board, and a re-run converges to a no-op.
//
// GUARDED-LIVE: this is the one init test that drives the REAL `lisa` binary (build a genuine bare
// lisa project with `lisa init`, then prove `lisa validate` passes after `vend init`). It is gated
// on `lisa` being on PATH — absent (a CI box without it) the whole block SKIPS, never fails. The
// pure machinery it leans on (the manifest, the converge planner, no-clobber, idempotency,
// countDemandRows) is already exhaustively unit-tested in init-core.test.ts / init-effect.test.ts;
// this file adds ONLY the live lisa-validity dimension, so a skip loses no pure coverage. We drive
// `runInit` directly — it IS `vend init` (the CLI arm is `runInit(process.cwd())` + a printed tally)
// — the house "test the seam, not the import.meta.main shell" discipline.
//
// THE BARE-LISA SUBTLETY (go-and-see): `lisa validate` FAILS on a ticketless project ("no tickets
// found"); one ticket flips it to pass. So "bare lisa project" means a minimal VALID lisa project
// (≥1 real ticket) — `vend init` must PRESERVE that validity, never fabricate a ticket to reach it.
// The seed ticket is lisa work; the vend demand board stays empty. Proving BOTH is the whole point.

/** `lisa` on PATH, or null. Drives the skip — guarded-live per the AC. */
const LISA = Bun.which("lisa");

/** Run `lisa init` in `root`, asserting success — a broken fixture must fail loudly, not silently
 *  produce a bad tree (the head-build-core.test.ts `git()` throw-on-nonzero idiom). */
function lisaInit(root: string): void {
  const r = Bun.spawnSync(["lisa", "init"], { cwd: root });
  if (r.exitCode !== 0) {
    throw new Error(`lisa init failed (exit ${r.exitCode}): ${r.stderr.toString()}`);
  }
}

/** Validate the project at `root` and RETURN the exit code (0 = "All checks passed"). The exit code
 *  IS the thing under test, so it is returned as data and asserted — not thrown. No `--check-tools`:
 *  this proof is about the scaffold's lisa-validity, not the zellij/claude runtime (that is E-042). */
function lisaValidate(root: string): number {
  return Bun.spawnSync(["lisa", "validate", "--path", root]).exitCode;
}

/** stat→true / catch→false. Copied from init-effect.test.ts (the no-shared-util idiom). */
async function exists(abs: string): Promise<boolean> {
  try {
    await stat(abs);
    return true;
  } catch {
    return false;
  }
}

/** The one minimal VALID lisa ticket that makes the bare lisa project pass `lisa validate` to begin
 *  with. This is pre-existing LISA work — NOT vend demand (the demand board stays honestly empty). */
const SEED_TICKET = `---
id: T-001-01
story: S-001
title: seed
type: task
status: open
priority: high
phase: ready
depends_on: []
---

## Context

A seed ticket so the bare lisa project is valid before vend layers its board.

## Acceptance Criteria

- [ ] seed
`;

const TICKET_REL = "docs/active/tickets/T-001-01.md";

describe.skipIf(!LISA)("vend init → lisa-valid + idempotent (E-040 done-looks-like)", () => {
  test("first run scaffolds & validates; second run writes nothing & still validates", async () => {
    const root = await mkdtemp(join(tmpdir(), "vend-init-e2e-"));
    try {
      // A genuine bare-but-VALID lisa project: real `lisa init` + one seed ticket.
      lisaInit(root);
      await writeFile(join(root, TICKET_REL), SEED_TICKET, "utf8");
      expect(lisaValidate(root)).toBe(0); // the input is lisa-valid before vend touches it.

      // ── First `vend init` ──────────────────────────────────────────────────────────────────
      const first = await runInit(root);
      expect(first.kind).toBe("scaffolded");

      // (AC) the first run creates the tree — every manifest path now exists.
      for (const entry of SCAFFOLD_MANIFEST) {
        expect(await exists(join(root, entry.path))).toBe(true);
      }
      // (AC) `lisa validate` still passes — vend layered its tree without breaking lisa-validity.
      expect(lisaValidate(root)).toBe(0);
      // (AC) the seeded demand board contains no fabricated demand rows — board AND archive empty.
      expect(countDemandRows(await readFile(join(root, "docs/active/demand.md"), "utf8"))).toBe(0);
      expect(
        countDemandRows(await readFile(join(root, "docs/archive/demand-cleared.md"), "utf8")),
      ).toBe(0);

      // ── Second `vend init` — converges to a no-op ─────────────────────────────────────────────
      const second = await runInit(root);
      expect(second.kind).toBe("scaffolded");
      if (second.kind !== "scaffolded") throw new Error("unreachable");
      // (AC) the second run reports zero new writes — created nothing, skipped the whole manifest.
      expect(second.result.created).toEqual([]);
      expect(second.result.skipped.length).toBe(SCAFFOLD_MANIFEST.length);
      // (AC) `lisa validate` still passes after the idempotent re-run.
      expect(lisaValidate(root)).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("one-way to lisa: a pre-existing lisa ticket is left byte-identical", async () => {
    const root = await mkdtemp(join(tmpdir(), "vend-init-e2e-oneway-"));
    try {
      lisaInit(root);
      await writeFile(join(root, TICKET_REL), SEED_TICKET, "utf8");

      await runInit(root);

      // vend writes ONLY vend-owned paths — the lisa-owned ticket is untouched (no clobber of a
      // real lisa file, the headline one-way property proven beyond the CLAUDE.md marker).
      expect(await readFile(join(root, TICKET_REL), "utf8")).toBe(SEED_TICKET);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
