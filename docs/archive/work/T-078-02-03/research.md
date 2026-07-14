# Research — T-078-02-03

## Assignment and phase

- Ticket: `T-078-02-03` — `init-charter-template-ships-p-labels`.
- Parent story: `S-078-02` — `charter-convention-teaches-itself`.
- The ticket starts in `phase: research`.
- The assignment requires all six RDSPI phases in one continuous pass.
- Attempt artifacts belong under `.lisa/attempts/T-078-02-03/1/work/`.
- Lisa, not this worker, publishes admitted artifacts to `docs/active/work/T-078-02-03/`.
- Ticket frontmatter phase and status are Lisa-owned and must not be edited.
- Source commits must use `lisa commit-ticket` with exact ticket-owned include paths.

## Story contract

- The story addresses how a newcomer learns the charter P-label convention.
- The convention has three intentionally separate surfaces.
- `T-078-02-01` owns clearing-gate detection and refusal wording.
- `T-078-02-02` owns the doctor diagnostic.
- This ticket owns the generic init charter and its tests.
- The story explicitly leaves gate verdict logic unchanged.
- The story explicitly leaves the epic schema unchanged.
- The story explicitly leaves the charter schema unchanged.
- The hackathon and kitchen overlay charters are out of this slice.
- Existing real projects are not migrated or rewritten.
- The proof is fixture- and temp-directory-based, with no metered cast.

## Product grounding

- Vend is local-first and turns reusable agent work into named playbooks.
- Gates are the contract that makes probabilistic work dependable.
- Charter labels are stable references used to ground work in named invariants.
- A fresh scaffold is the earliest point at which the convention can be taught.
- The ticket advances P3: gates should teach the contract, not leave tribal knowledge.
- Init already authors the generic knowledge stubs for a fresh Vend workspace.
- Therefore the init charter is a direct newcomer-facing teaching surface.

## Existing pure init core

- `src/init/init-core.ts` is the pure half of `vend init`.
- It imports no filesystem, clock, process, network, engine, or BAML runtime.
- It defines `ScaffoldEntry`, the value shape for directories and seeded files.
- It defines `SCAFFOLD_MANIFEST`, the canonical ordered base scaffold.
- Each file entry carries its complete seed bytes in `contents`.
- The manifest includes `docs/knowledge/charter.md` as a file entry.
- That entry's contents come from module-private `CHARTER_STUB`.
- `CHARTER_STUB` currently contains a title and one short italicized instruction.
- The current stub contains no token shaped like `P` followed by digits.
- The current stub contains no comment explaining how casts cite labels.
- `CHARTER_STUB` is intentionally module-private.
- Tests can reach its value through the exported `SCAFFOLD_MANIFEST`.
- This avoids adding a public API solely for a seed constant.

## Existing scaffold planning

- `planInit(existing, manifest)` takes plain values and returns plain values.
- The default manifest is `SCAFFOLD_MANIFEST`.
- The planner partitions every manifest entry into create or skip actions.
- It does not inspect or transform file contents.
- An absent charter path is created with the manifest's exact contents.
- A present charter path is skipped and never rewritten.
- Updating `CHARTER_STUB` changes only future, absent charter files.
- Existing workspaces retain no-clobber semantics automatically.
- Manifest order and entry count are unaffected by a content-only seed edit.

## Existing effect shell

- `src/init/init-effect.ts` is the filesystem-writing shell.
- `applyInitScaffold` scans manifest-relative paths under a project root.
- It delegates create-versus-skip decisions to the pure planner.
- It writes absent files with the exclusive `wx` flag.
- It leaves existing files byte-identical.
- `runInit` composes template resolution, the Lisa-project gate, and the writer.
- Bare `vend init` uses `SCAFFOLD_MANIFEST` directly.
- Named templates merge an overlay manifest over the base manifest.
- No effect code needs to understand charter labels.
- No effect code needs to change for this ticket.

## Existing templates

- The hackathon overlay replaces the generic charter slot with `HACKATHON_CHARTER`.
- Its tests deliberately distinguish the tuned charter from the base stub.
- The kitchen overlay is sourced from a sibling module.
- The story declares these overlay charters out of scope.
- A base-stub content edit must not alter overlay merge behavior.
- The hackathon test currently calls the base charter a generic stub.
- Its assertion checks the generic authoring phrase and absence of hackathon-specific prose.
- Those checks can remain valid if the generic stub retains its authoring guidance.

## Existing pure init tests

- `src/init/init-core.test.ts` imports only the pure init core today.
- It already derives base charter contents from `SCAFFOLD_MANIFEST` for overlay tests.
- That derived `baseCharter` is a file entry narrowed by path and kind.
- A new import of `matchIds` from `src/gate/gates.ts` remains addon-free.
- `gates.ts` uses only type-only BAML imports at runtime.
- The predecessor ticket exported `matchIds` as the shared detector seam.
- A pure test can pass `baseCharter.contents` to `matchIds(..., "P")`.
- This directly proves the scaffold seed is legible to the same detector gates use.
- The acceptance criterion requires at least one resolved P-label.
- It also requires pinning the comment line about casts citing labels.
- The existing base-charter fixture is an appropriate single source for both assertions.

## Shared detector behavior

- `src/gate/gates.ts` exports `matchIds(text, prefix)`.
- The prefix type is the closed union `"P" | "N"`.
- It matches word-boundary tokens of the form `P\d+` or `N\d+`.
- It returns a `Set<string>` and deduplicates repeated labels.
- It preserves first-seen order because JavaScript sets are insertion ordered.
- It does not require a particular Markdown heading or bullet format.
- A Markdown invariant such as `P1 — ...` is detected.
- The detector is the required shared seam; a new local regex would duplicate policy.

## Existing effect tests

- `src/init/init-effect.test.ts` uses real temporary directories.
- `seedBareLisa` creates a fresh root containing only `CLAUDE.md`.
- The main scaffold test applies the base manifest to that root.
- It already checks every file lands byte-for-byte from the manifest.
- A later no-clobber test explicitly reads the generated charter.
- The ticket asks for an effect test that shows a fresh init workspace carries the labeled charter.
- A direct assertion in the fresh-scaffold test makes that property visible and local.
- The effect test can read `docs/knowledge/charter.md` after apply.
- It can use the exported detector to assert at least one P-label on disk.
- It can also compare disk bytes to the base manifest charter entry.
- The temp root is removed in `finally`, matching existing cleanup discipline.

## Exact scope of likely source ownership

- `src/init/init-core.ts`: modify `CHARTER_STUB` only.
- `src/init/init-core.test.ts`: add the shared-detector import and pure assertions.
- `src/init/init-effect.test.ts`: add direct on-disk labeled-charter proof.
- `src/init/init-effect.ts`: no change expected.
- `src/gate/gates.ts`: no change expected; predecessor already exported the detector.
- `src/gate/gates.test.ts`: no change expected.
- Template overlay files: no change expected.
- Ticket/story/epic frontmatter: no worker edits.

## Constraints and risks

- The comment must be an actual one-line Markdown comment, not only prose nearby.
- Its bytes should be pinned so future edits do not silently remove the teaching cue.
- The seed should remain a stub rather than pretending to know a new project's values.
- Labels need useful placeholder descriptions while inviting project-specific authorship.
- The generic phrase `author your project's` should remain for existing test intent.
- A content-only change should preserve manifest entry count and order.
- Existing charters must remain untouched because init is no-clobber.
- The overlay charters must continue to win at the same manifest slot.
- Tests must use `matchIds`; a second regex would weaken the shared contract.
- Full `bun run check` is required before the source commit.
- Unrelated Lisa-managed ticket/provenance changes are already present and must be preserved.

## Research conclusion

- The repository already has every architectural seam needed by the ticket.
- The pure source of truth is `CHARTER_STUB` as exposed through `SCAFFOLD_MANIFEST`.
- The shared interpretation seam is exported `matchIds`.
- The effect automatically writes the new bytes without production effect changes.
- The smallest complete slice is one seed edit plus one pure test and one effect test.
- No schema, CLI, doctor, gate-verdict, template-overlay, or migration work is required.
