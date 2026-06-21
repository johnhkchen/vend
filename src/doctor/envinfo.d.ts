// Ambient declaration for `envinfo` (T-042-02) — the package ships no `types` field, so this
// shim types the SINGLE surface the doctor probe touches: `envinfo.helpers.which`, a
// PATH-resolution primitive that resolves to the binary's absolute path or `undefined` when it
// is not found (it does not reject for a missing binary — verified empirically). The catch-all
// index keeps the rest of `helpers` accessible-but-opaque without pretending to type envinfo's
// whole (large, untyped) surface. Scoped under `src/` so the project's `tsc` (include: ["src"])
// picks it up.

declare module "envinfo" {
  interface EnvinfoHelpers {
    /** Resolve a binary on PATH → its absolute path, or `undefined` when not found. Async;
     *  does not reject for a missing binary. */
    which(binary: string): Promise<string | undefined>;
    [key: string]: unknown;
  }

  interface Envinfo {
    helpers: EnvinfoHelpers;
    run(targets: Record<string, unknown>, options?: Record<string, unknown>): Promise<string>;
  }

  const envinfo: Envinfo;
  export default envinfo;
}
