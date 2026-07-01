import { describe, expect, test } from "bun:test";
import { renderUserGuide, USER_GUIDE } from "./guide-core.ts";
import { VEND_WORKFLOW } from "../init/init-core.ts";

// T-066: `vend user-guide` renders the fresh-repo orientation. Pure-function test — guide-core
// imports only init-core (addon-free), so no BAML addon loads into this `bun test` process.

describe("USER_GUIDE — the fresh-repo orientation the command prints", () => {
  test("embeds the canonical workflow doc verbatim (one source of truth with `vend init`)", () => {
    expect(USER_GUIDE).toContain(VEND_WORKFLOW);
  });

  test("orients on the TWO engines and the loop — the reported friction", () => {
    expect(USER_GUIDE).toContain("vend clears intent into work");
    expect(USER_GUIDE).toContain("lisa builds the work into commits");
    expect(USER_GUIDE).toContain("The board is the contract between them");
    expect(USER_GUIDE).toContain('vend chain "<signal>"');
  });

  test("footer points at --help and both deeper docs, and the fresh-repo setup order", () => {
    expect(USER_GUIDE).toContain("vend --help");
    expect(USER_GUIDE).toContain("docs/knowledge/vend-workflow.md");
    expect(USER_GUIDE).toContain("docs/knowledge/rdspi-workflow.md");
    expect(USER_GUIDE).toContain("lisa init");
    expect(USER_GUIDE).toContain("vend init");
  });

  test("reflects the CURRENT loop — no retired `vend work`", () => {
    expect(USER_GUIDE).not.toContain("vend work");
  });

  test("renderUserGuide() returns the composed guide", () => {
    expect(renderUserGuide()).toBe(USER_GUIDE);
  });
});
