# Deferred Items — Phase 04

Out-of-scope issues observed during Plan execution. Tracked for future
cleanup; NOT addressed in this plan per the scope-boundary rule (only fix
issues directly caused by the current task's changes).

## Pre-existing typecheck errors (on branch `moshpit`)

Present on HEAD before Plan 04-01 started. Running `pnpm typecheck`:

- ~~`src/platform/moshpit/services/thumbRepository.ts(51,50)`: TS2339~~
  — **RESOLVED in Plan 04-02** (dfabb5259). v1→v2 cursor narrowed via
  `as unknown as { contentHash, metadata }` to unblock the v2→v3 branch.
- ~~`src/platform/moshpit/services/thumbRepository.ts(52,37)`: TS2698~~
  — **RESOLVED in Plan 04-02** (dfabb5259). Spread now targets the
  narrowed legacy shape.
- ~~`src/platform/moshpit/services/thumbRepository.ts(58,21)`: TS2339~~
  — **RESOLVED in Plan 04-02** (dfabb5259).
- ~~`src/renderer/extensions/minimap/composables/useMinimap.test.ts(854,36)`:
  error TS2367~~ — **RESOLVED in Plan 04-03** (`327797c88`). Narrowed
  `call[0]` to `string` via cast. Unrelated to Moshpit domain but
  materially blocking every hook-gated commit on this branch under the
  current husky config; fixed inline as Plan 04-03 Task 4 Rule 3 blocker.

## Husky pre-commit hook interaction

`lint-staged` runs `pnpm typecheck` as a global hook (not per-staged-file),
so every Plan 04-01 commit surfaces the pre-existing errors above. The
commits themselves land (git accepts them) because lint-staged's "revert
staging" only affects the index, not the already-created commit. Nothing
to fix in this plan.

## Plan 04-06 Task 5 deferred — `typecheck:browser` pre-existing failures

`pnpm typecheck:browser` fails on `moshpit` branch with these errors
(present identically on `main` — pre-existing, not caused by Phase 4):

- `src/composables/useGlobalLitegraph.ts(17,3)`: TS2578 Unused
  '@ts-expect-error' directive
- `src/composables/useGlobalLitegraph.ts(33,3)`: TS2578 Unused
  '@ts-expect-error' directive
- `browser_tests/tests/moshpit/moshpit-shell.spec.ts` lines 56/60/71/75:
  TS2578 Unused '@ts-expect-error' directive

The main `tsconfig.json` and `browser_tests/tsconfig.json` disagree on
whether `window['LiteGraph'] = LiteGraph` needs an `@ts-expect-error`
directive (main: required; browser: unused). Removing directives 17+33
fixes `typecheck:browser` but breaks `pnpm typecheck`, and vice versa.
Root cause is a tsconfig strictness mismatch between the two configs
that is out of scope for Plan 04-06.

`lint-staged.config.ts` only triggers `pnpm typecheck:browser` when a
file under `browser_tests/` is staged — so every prior Plan 04 commit
was unaffected. Staging `browser_tests/tests/moshpit/lineage-groupings.spec.ts`
(Task 5 deliverable) hits this latent hook branch and blocks the commit.

**Deferral justified by D-21**: "No Playwright E2E fixture blocks Phase 4
acceptance. A @moshpit spec may cover grouping-toggle state ... (best
effort, not a blocker for acceptance)." Task 5 is explicitly discretionary
scope.

**Follow-up work** (not Phase 4):

1. Reconcile the tsconfig mismatch so both typechecks pass simultaneously.
   Most likely path: in `browser_tests/tsconfig.json`, tighten `include`
   so only `browser_tests/**/*.ts` + the declared `.d.ts` paths are
   compiled (currently transitively picks up `src/composables/` via
   import graph resolution), OR relax `noUnusedLocals`/no-unused rules
   for cross-boundary files.
2. Once fixed, write the @moshpit Playwright spec per Plan 04-06 Task 5
   specs (5 UI-chrome tests already designed; see Plan 04-06-SUMMARY.md
   "Deferred Task 5" section for the full test list).
