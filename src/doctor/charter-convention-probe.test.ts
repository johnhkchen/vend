import { describe, expect, test } from "bun:test";
import { CHARTER_PATH } from "../play/project-context.ts";
import { EXIT_OK, renderDoctorReport } from "./doctor-core.ts";
import {
  CHARTER_CONVENTION_CHECK,
  CHARTER_CONVENTION_HOW_TO,
  charterConventionCheck,
  probeCharterConvention,
} from "./charter-convention-probe.ts";

// T-078-02-02 — plain charter bytes prove the shared detector mapping; the reader is injected so
// this suite stays filesystem-free. Amber is intentionally a passing Check: rendering it must keep
// exit zero, which is the story's N2 diagnostic-not-babysitting boundary.

describe("charterConventionCheck — shared label detector", () => {
  test("a labeled charter is green with the distinct invariant count", () => {
    const check = charterConventionCheck(`
      P1 — Author once, run forever.
      P2 — The run is two gestures.
      P2 appears again in prose.
    `);

    expect(check).toEqual({
      name: `${CHARTER_CONVENTION_CHECK}: green — 2 labeled invariants found`,
      ok: true,
    });
  });

  test("one label uses singular count wording", () => {
    expect(charterConventionCheck("P7 — Budget is a hard contract.").name).toBe(
      `${CHARTER_CONVENTION_CHECK}: green — 1 labeled invariant found`,
    );
  });

  test("an unlabeled charter is amber with the how-to and renders exit 0", () => {
    const check = charterConventionCheck(
      "Author once. Keep the run simple. Make quality enforceable through gates.",
    );

    expect(check.ok).toBe(true);
    expect(check.name).toContain(`${CHARTER_CONVENTION_CHECK}: amber`);
    expect(check.name).toContain("no labeled invariants found");
    expect(check.name).toContain(CHARTER_CONVENTION_HOW_TO);

    const report = renderDoctorReport([check]);
    expect(report.ok).toBe(true);
    expect(report.exitCode).toBe(EXIT_OK);
  });
});

describe("probeCharterConvention — injected charter read", () => {
  test("maps the injected charter bytes", async () => {
    const checks = await probeCharterConvention({
      readCharter: async () => "P3 — Gates are the contract.",
    });

    expect(checks).toEqual([
      {
        name: `${CHARTER_CONVENTION_CHECK}: green — 1 labeled invariant found`,
        ok: true,
      },
    ]);
  });

  test("a read fault resolves to actionable amber and remains exit 0", async () => {
    const checks = await probeCharterConvention({
      readCharter: async () => {
        throw new Error("permission denied");
      },
    });

    expect(checks).toHaveLength(1);
    expect(checks[0]?.ok).toBe(true);
    expect(checks[0]?.name).toContain(`${CHARTER_CONVENTION_CHECK}: amber`);
    expect(checks[0]?.name).toContain(CHARTER_PATH);
    expect(checks[0]?.name).toContain("permission denied");
    expect(checks[0]?.name).toContain(CHARTER_CONVENTION_HOW_TO);
    expect(renderDoctorReport(checks).exitCode).toBe(EXIT_OK);
  });
});
