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
