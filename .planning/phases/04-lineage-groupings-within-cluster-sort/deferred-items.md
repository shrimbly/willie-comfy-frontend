# Deferred Items — Phase 04

Out-of-scope issues observed during Plan 01 execution. Tracked for future
cleanup; NOT addressed in this plan per the scope-boundary rule (only fix
issues directly caused by the current task's changes).

## Pre-existing typecheck errors (on branch `moshpit`)

Present on HEAD before Plan 04-01 started. Running `pnpm typecheck`:

- `src/platform/moshpit/services/thumbRepository.ts(51,50)`: error TS2339:
  Property 'metadata' does not exist on type 'never'.
- `src/platform/moshpit/services/thumbRepository.ts(52,37)`: error TS2698:
  Spread types may only be created from object types.
- `src/platform/moshpit/services/thumbRepository.ts(58,21)`: error TS2339:
  Property 'contentHash' does not exist on type 'never'.
- `src/renderer/extensions/minimap/composables/useMinimap.test.ts(854,36)`:
  error TS2367: This comparison appears to be unintentional because the
  types 'keyof DedicatedWorkerGlobalScopeEventMap' and '"resize"' have no
  overlap.

These pre-date this plan. `thumbRepository` is scheduled for a v2→v3
migration edit in Plan 04-02 (D-11 — `saveNodeIdentity` re-derivation) so the
type errors will be addressed there. The minimap test error is unrelated to
Moshpit and should be filed separately.

## Husky pre-commit hook interaction

`lint-staged` runs `pnpm typecheck` as a global hook (not per-staged-file),
so every Plan 04-01 commit surfaces the pre-existing errors above. The
commits themselves land (git accepts them) because lint-staged's "revert
staging" only affects the index, not the already-created commit. Nothing
to fix in this plan.
