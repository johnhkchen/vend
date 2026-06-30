import pkg from "../package.json";

// The build-embedded package version (T-061-02). `vend --version` reports THIS.
//
// EMBED, don't read: `import pkg from "../package.json"` is bundled into the
// single-file binary by `bun build --compile` (the JSON is inlined at build), so the
// value is correct post-compile — where a runtime manifest read would fail, because
// there is no `package.json` beside a compiled binary and `import.meta.dir` points
// into the virtual bundle. In dev (`bun run src/cli.ts`) the same import resolves the
// real file. Either way `VERSION` is the manifest semver T-061-01 pinned (0.1.0).
//
// `pkg.version` is typed `string` under the project tsconfig (no `resolveJsonModule`
// needed — `moduleResolution: "bundler"` resolves the JSON), so the annotation is
// honest, not a cast. Kept in its own BAML-free module so the compiled-binary test
// can target it without dragging the executor/BAML graph through `bun --compile`.
export const VERSION: string = pkg.version;
