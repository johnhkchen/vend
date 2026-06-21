import { describe, expect, test } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Signal, SignalTier } from "../../baml_client/index.ts";
import type { CastContext } from "../engine/play.ts";
import { classify } from "../engine/cast-core.ts";
import { clear, EXPAND_GATE_NAMES, renderSignalRow, type ExpandClearContext } from "./expand-core.ts";
import {
  STAGING_DIR,
  expandFragmentEffect,
  renderAnnotationProvenance,
  renderStagedSignal,
  slugify,
  type Annotation,
  type ExpandFragmentInputs,
} from "./expand-effect.ts";

// T-016-02: the OFFLINE demonstration of the ExpandFragment cast — the AC#3 proof that does not need
// a live model. Every BAML import is TYPE-ONLY (erased at runtime) and the enum field is a
// string-literal cast (`b.parse` returns exactly the member string "Keystone"), so NO native addon
// loads into this `bun test` process (the propose-effect.test.ts / expand-core.test.ts discipline).
// We prove the two halves the cast plugs in beyond the already-pinned pure core:
//   (1) the impure effect STAGES the signal under docs/active/pm/staged/<slug>.md on a real temp-dir
//       projectRoot — and writes NOTHING to demand.md or the board (the staging contract), and
//   (2) the clear→classify wiring — a grounded signal materializes (the effect would run); an
//       honest-empty or ungrounded signal is a gate-failed andon that stages nothing.

// A complete, clearing Signal — the shape `b.parse` yields (built directly, no model call). Grounded
// (cites real state), names a real invariant, non-empty what/why → clears all three gates.
const FULL_SIGNAL: Signal = {
  what: "Register expandFragmentPlay and the vend expand gesture",
  why: "Lets a felt 'this is rough' become a staged, priced signal in one gesture (O1).",
  tier: "Keystone" as SignalTier,
  budget: "~1 block (≈2h)",
  advances: ["P2"],
  grounding: "TODO in docs/active/pm/proposed-batch.md #1; the E-016 demand.md row",
  readiness: "ready",
};

const CHARTER = "P1 author-once. P2 two-gestures. P7 budget-hard. N1 not-a-copilot. N4 not-an-executor.";

// A complete Annotation — the non-dev feedback the expand clearing prices into FULL_SIGNAL. Module
// scope so BOTH the effect-threading test and the pure renderAnnotationProvenance block reference it.
const FULL_ANNOTATION: Annotation = {
  text: "this card's blocked edge is hard to spot on the board",
  nodeId: "T-055-01",
  seat: "designer",
};

const inputsFor = (fragment: string): ExpandFragmentInputs => ({
  fragment,
  charter: CHARTER,
  project: "# Project snapshot",
});

const ctxFor = (root: string): CastContext<ExpandFragmentInputs> => ({
  inputs: inputsFor("this is rough"),
  projectRoot: root,
});

/** A cast context whose inputs carry an annotation — the E-057 round-trip threaded through the
 *  same effect: the staged signal must then carry the provenance trailer + back-link. */
const annotatedCtxFor = (root: string): CastContext<ExpandFragmentInputs> => ({
  inputs: { ...inputsFor("this is rough"), annotation: FULL_ANNOTATION },
  projectRoot: root,
});

const clearCtx: ExpandClearContext = { charter: CHARTER };

/** A throwaway projectRoot — the effect creates docs/active/pm/staged/ under it on demand. */
async function seedRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "vend-expand-"));
}

/** True iff `path` exists. The negative assertion for "nothing was written to the board". */
async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("expandFragmentEffect — stages the signal under the PM desk, never the board", () => {
  test("writes docs/active/pm/staged/<slug>.md carrying the demand row + the pull string", async () => {
    const root = await seedRoot();
    try {
      const res = await expandFragmentEffect(FULL_SIGNAL, ctxFor(root));
      expect(res.ok).toBe(true);
      expect(res.outcome).toBeUndefined();

      const expected = join(root, STAGING_DIR, `${slugify(FULL_SIGNAL.what)}.md`);
      expect(res.artifacts).toEqual([expected]);
      // parity with the other effects: `produced` (the threadable handle) == artifacts[0].
      expect(res.produced).toBe(expected);
      expect(res.produced).toBe(res.artifacts?.[0]);

      const written = await readFile(expected, "utf8");
      // the structured signal IS the demand.md row (every Signal field round-trips via expand-core).
      expect(written).toContain(renderSignalRow(FULL_SIGNAL));
      expect(written).toContain("| Signal | Value | Budget (envelope) | Status |");
      // the pull-ready signal string a human hands to `vend chain` (the staging unit).
      expect(written).toContain(`vend chain "${FULL_SIGNAL.what} — ${FULL_SIGNAL.why}"`);
      // honest about its origin + un-promoted status.
      expect(written).toContain("expand-fragment");
      expect(written).toContain("not promoted");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("writes ONLY under docs/active/pm/ — never demand.md or the board (epic/stories/tickets)", async () => {
    const root = await seedRoot();
    try {
      await expandFragmentEffect(FULL_SIGNAL, ctxFor(root));
      // the staging contract: the active board is untouched by an expand cast.
      expect(await exists(join(root, "docs/active/demand.md"))).toBe(false);
      expect(await exists(join(root, "docs/active/epic"))).toBe(false);
      expect(await exists(join(root, "docs/active/stories"))).toBe(false);
      expect(await exists(join(root, "docs/active/tickets"))).toBe(false);
      // the staged draft is the only thing written.
      expect(await exists(join(root, STAGING_DIR))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  // AC#1 (T-057-02): an annotated cast — provenance threaded through the SAME effect — stages the
  // trailer + back-link, and STILL writes nothing to the board (one-way authority holds, inherited
  // not weakened). Stubs the cast exactly as the tests above do: a direct effect call on a temp root.
  test("an annotated cast stages the provenance trailer + back-link, board untouched", async () => {
    const root = await seedRoot();
    try {
      const res = await expandFragmentEffect(FULL_SIGNAL, annotatedCtxFor(root));
      expect(res.ok).toBe(true);

      const written = await readFile(
        join(root, STAGING_DIR, `${slugify(FULL_SIGNAL.what)}.md`),
        "utf8",
      );
      // the provenance trailer names the human source (seat X on node Y) quoting the priced signal.
      expect(written).toContain("Provenance:");
      expect(written).toContain(FULL_ANNOTATION.seat); // "designer"
      expect(written).toContain(FULL_ANNOTATION.nodeId); // "T-055-01"
      // the back-link references the annotated work item with a board-relative href.
      expect(written).toContain("Back to the annotated work item");
      expect(written).toContain(`[\`${FULL_ANNOTATION.nodeId}\`]`);
      expect(written).toContain("../../tickets/T-055-01.md");
      // additive, not a replacement: the machine origin trailer is still present.
      expect(written).toContain("not promoted");

      // one-way authority STILL holds with an annotation in play — nothing reaches the board.
      expect(await exists(join(root, "docs/active/demand.md"))).toBe(false);
      expect(await exists(join(root, "docs/active/epic"))).toBe(false);
      expect(await exists(join(root, "docs/active/stories"))).toBe(false);
      expect(await exists(join(root, "docs/active/tickets"))).toBe(false);
      expect(await exists(join(root, STAGING_DIR))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("clear → classify wiring — a grounded signal stages; a refusal stages nothing", () => {
  const inBudget = { status: "ok", spent: 100, ceiling: 12000, remaining: 11900 } as const;

  test("a cleared signal → success + materialize (the effect would run), three passed gate rows", () => {
    const v = classify({ timedOut: false, budgetOutcome: inBudget, gateVerdict: clear(FULL_SIGNAL, clearCtx) });
    expect(v.outcome).toBe("success");
    expect(v.materialize).toBe(true);
    expect(v.gateLog).toEqual([...EXPAND_GATE_NAMES].map((gate) => ({ gate, passed: true })));
  });

  test("an honest-empty signal (blank what+why) → gate-failed + no materialize (the andon)", () => {
    const empty: Signal = { ...FULL_SIGNAL, what: "", why: "" };
    const stop = clear(empty, clearCtx);
    const v = classify({ timedOut: false, budgetOutcome: inBudget, gateVerdict: stop });
    expect(v.outcome).toBe("gate-failed");
    expect(v.materialize).toBe(false);
    expect(v.gateLog.some((r) => r.gate === "honest-empty" && !r.passed)).toBe(true);
  });

  test("an ungrounded signal (blank grounding) → read-never-invent gate-failed + no materialize", () => {
    const ungrounded: Signal = { ...FULL_SIGNAL, grounding: "" };
    const stop = clear(ungrounded, clearCtx);
    const v = classify({ timedOut: false, budgetOutcome: inBudget, gateVerdict: stop });
    expect(v.outcome).toBe("gate-failed");
    expect(v.materialize).toBe(false);
    expect(v.gateLog.some((r) => r.gate === "read-never-invent" && !r.passed)).toBe(true);
  });
});

describe("slugify + renderStagedSignal — pure helpers", () => {
  test("slugify lowercases, collapses non-alnum, and falls back to 'signal'", () => {
    expect(slugify("Register expandFragmentPlay and the vend expand gesture")).toBe(
      "register-expandfragmentplay-and-the-vend-expand-gesture",
    );
    expect(slugify("  Trim — Me!  ")).toBe("trim-me");
    expect(slugify("!@#$%")).toBe("signal");
  });

  test("slugify caps the stem so a full-sentence `what` can't overflow the filename (ENAMETOOLONG)", () => {
    const longWhat =
      "recalibrate the other registered plays token budgets from measured run data and extend the empirical envelope treatment decompose got to the rest of the play surface";
    const stem = slugify(longWhat);
    expect(stem.length).toBeLessThanOrEqual(60);
    expect(stem.endsWith("-")).toBe(false);
    expect(stem.startsWith("recalibrate-the-other-registered-plays-token-budgets")).toBe(true);
  });

  test("renderStagedSignal embeds exactly one demand row for the signal", () => {
    const body = renderStagedSignal(FULL_SIGNAL);
    expect(body.startsWith(`# ${FULL_SIGNAL.what}`)).toBe(true);
    expect(body).toContain(renderSignalRow(FULL_SIGNAL));
  });
});

describe("renderAnnotationProvenance — provenance trailer + back-link (pure)", () => {
  test("the provenance line names the seat and the annotated node id (AC clause a)", () => {
    const out = renderAnnotationProvenance(FULL_SIGNAL, FULL_ANNOTATION);
    expect(out).toContain("Provenance:");
    expect(out).toContain("designer"); // the seat
    expect(out).toContain("T-055-01"); // the node id
  });

  test("the back-link references the annotated work item with a board-relative href (AC clause b)", () => {
    const out = renderAnnotationProvenance(FULL_SIGNAL, FULL_ANNOTATION);
    expect(out).toContain("Back to the annotated work item");
    expect(out).toContain("[`T-055-01`]"); // the link names the work item
    expect(out).toContain("../../tickets/T-055-01.md"); // a `T-…` id resolves under tickets/
  });

  test("uses the Signal param — the trailer quotes the priced signal's `what`", () => {
    const out = renderAnnotationProvenance(FULL_SIGNAL, FULL_ANNOTATION);
    expect(out).toContain(FULL_SIGNAL.what);
  });

  test("is deterministic across repeat calls (no clock, no random)", () => {
    expect(renderAnnotationProvenance(FULL_SIGNAL, FULL_ANNOTATION)).toBe(
      renderAnnotationProvenance(FULL_SIGNAL, FULL_ANNOTATION),
    );
  });

  test("the back-link href maps the id prefix to its board dir; unknown prefix → an anchor", () => {
    const onEpic = renderAnnotationProvenance(FULL_SIGNAL, { ...FULL_ANNOTATION, nodeId: "E-057" });
    expect(onEpic).toContain("../../epic/E-057.md");
    const onStory = renderAnnotationProvenance(FULL_SIGNAL, { ...FULL_ANNOTATION, nodeId: "S-057-01" });
    expect(onStory).toContain("../../stories/S-057-01.md");
    const onUnknown = renderAnnotationProvenance(FULL_SIGNAL, { ...FULL_ANNOTATION, nodeId: "node42" });
    expect(onUnknown).toContain("(#node42)"); // unrecognized prefix falls back to an in-doc anchor
  });
});
