import { expect, test } from "bun:test";
import {
  FORMULA_CLASS,
  FORMULA_DESC,
  HOMEPAGE,
  LICENSE_SPDX,
  releaseAssetUrl,
  renderFormula,
} from "./formula-core.ts";

// Unit tests for the pure formula core (T-063-01). Addon-free and fast — they pin the exact
// formula strings + the release-asset URL shape with no I/O. The end-to-end render-and-`ruby -c`
// proof is the sibling formula.smoke.test.ts.

const SHA = "a".repeat(64);
const TARBALL = "vend-cli-aarch64-apple-darwin.tar.xz";

test("releaseAssetUrl is the exact GitHub release-download URL (v-prefixed tag)", () => {
  expect(releaseAssetUrl({ version: "0.1.0", tarball: TARBALL })).toBe(
    `https://github.com/johnhkchen/vend/releases/download/v0.1.0/${TARBALL}`,
  );
});

test("renderFormula carries every required field, sourced from its inputs (no hand-typed sha)", () => {
  const url = releaseAssetUrl({ version: "0.1.0", tarball: TARBALL });
  const rb = renderFormula({ version: "0.1.0", url, sha256: SHA });
  expect(rb).toContain(`class ${FORMULA_CLASS} < Formula`);
  expect(rb).toContain(`desc "${FORMULA_DESC}"`);
  expect(rb).toContain(`homepage "${HOMEPAGE}"`);
  expect(rb).toContain(`version "0.1.0"`);
  expect(rb).toContain(`url "${url}"`);
  expect(rb).toContain(`sha256 "${SHA}"`);
  expect(rb).toContain(`license "${LICENSE_SPDX}"`);
  expect(rb).toContain(`bin.install "vend"`);
  // The `test do` block encodes the AC's `vend --version` reports the real semver.
  expect(rb).toContain("test do");
  expect(rb).toContain("vend --version");
});

test("renderFormula is collapsed to ONE arm64-mac branch — no livecheck, no cargo-dist scaffolding", () => {
  const rb = renderFormula({ version: "0.1.0", url: "https://example/x.tar.xz", sha256: SHA });
  // Exactly one platform branch → exactly one url + one sha256.
  expect(rb.match(/^\s*url /gm)?.length).toBe(1);
  expect(rb.match(/^\s*sha256 /gm)?.length).toBe(1);
  expect(rb).toContain("if OS.mac? && Hardware::CPU.arm?");
  // Per the ticket: no livecheck. And no dead cargo-dist alias/pkgshare scaffolding.
  expect(rb).not.toContain("livecheck");
  expect(rb).not.toContain("BINARY_ALIASES");
  expect(rb).not.toContain("pkgshare");
});
