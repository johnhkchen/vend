// Ambient text-module declarations for the kitchen seed's text imports (T-062-02-01).
//
// `kitchen-overlay.ts` embeds the authored seed via `import x from "…/f.ext" with { type: "text" }`
// so `bun build --compile` inlines the bytes into the binary (see that file's header). Bun resolves
// such imports natively, but `tsc` needs a module declaration for the seed's non-`.json`/`.md`/`.svg`
// extensions. These four wildcards declare those modules as `string` (the text-import shape).
//
// SCOPE: these exist SOLELY for the kitchen seed's text imports. The repo has NO other `.mjs` /
// `.astro` / `.yml` / `.gitignore` value imports (grep-verified), so the wildcards collide with
// nothing. Note `src/env.d.ts` is NOT covered here — `tsc` refuses to value-import a `.d.ts`
// (TS2846), so that one trivial file is inlined as a constant in `kitchen-overlay.ts` instead.

declare module "*.mjs" {
  const content: string;
  export default content;
}
declare module "*.astro" {
  const content: string;
  export default content;
}
declare module "*.yml" {
  const content: string;
  export default content;
}
declare module "*.gitignore" {
  const content: string;
  export default content;
}
declare module "*.md" {
  const content: string;
  export default content;
}
declare module "*.svg" {
  const content: string;
  export default content;
}
declare module "*.toml" {
  const content: string;
  export default content;
}
declare module "*.lock" {
  const content: string;
  export default content;
}
