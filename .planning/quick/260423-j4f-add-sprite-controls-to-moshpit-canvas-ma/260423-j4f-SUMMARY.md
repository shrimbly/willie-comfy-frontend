---
phase: 260423-j4f
plan: 01
subsystem: moshpit/sprite-layer
tags: [moshpit, pinia, pixi, sprite-layer, overrides]
requires:
  - moshpitAssetRegistry (existing)
  - moshpitSelectionStore (existing)
  - layoutMath.GridSlot (existing)
provides:
  - useMoshpitOverrideStore (Pinia store)
  - OverrideRecord (type)
  - resolveSlot, resolveSpriteScale (internal pure helpers, @internal export)
affects:
  - src/platform/moshpit/composables/useMoshpitSpriteLayer.ts
tech_stack:
  added: []
  patterns:
    - store-centric override injection into existing watchEffects (no new watchers)
    - pure-helper extraction pattern for happy-dom-unreachable Pixi code
key_files:
  created:
    - src/platform/moshpit/stores/moshpitOverrideStore.ts
    - src/platform/moshpit/stores/moshpitOverrideStore.test.ts
    - src/platform/moshpit/composables/useMoshpitSpriteLayer.test.ts
  modified:
    - src/platform/moshpit/composables/useMoshpitSpriteLayer.ts
decisions:
  - Extracted resolveSlot / resolveSpriteScale as @internal exports rather than a sibling file — keeps the logic co-located with its sole caller (syncSprites) while still being unit-testable under happy-dom.
  - Selection-effect rings are destroy+recreated on every pass to pick up scale changes; documented as a bounded cost (small selection sets). Cache-and-skip is a named follow-up if perf profiles show churn.
  - Coarse reactive coupling via `void overrides.size` inside the selection watchEffect — avoids a second watcher while ensuring scale-only mutations retrigger ring rebuild.
metrics:
  duration: ~15 min
  tasks: 2
  files_created: 3
  files_modified: 1
  tests_added: 26
  tests_passed: 26
  non_test_loc_delta: ~196 (store +111, sprite-layer net +64)
completed: 2026-04-23
---

# Quick Task 260423-j4f: Sprite Controls Foundation — Summary

Landed the per-asset override data model (`moshpitOverrideStore`) and wired it through `useMoshpitSpriteLayer` so pinned world-position and scale overrides already work end-to-end before any UI ships. No context menu, no action bar, no drag-to-pin yet — just the hot path, de-risked.

## Final Store Surface (`moshpitOverrideStore.ts`)

Exported symbols:

- `useMoshpitOverrideStore` — Pinia Setup store, id `'moshpitOverride'`.
- `OverrideRecord` — readonly type `{ pinnedWorldPos?: {x,y}, scale?, pinnedAt }`.

Public API on the store instance:

| Member                  | Shape                              | Semantics                                                                                                   |
| ----------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `records`               | `Ref<Map<string, OverrideRecord>>` | Underlying reactive container. Exposed so the sprite-layer effect can track `records.size` as a coarse dep. |
| `size`                  | `ComputedRef<number>`              | Count of records.                                                                                           |
| `get(hash)`             | `OverrideRecord \| undefined`      | Returns `undefined` for unknown hash.                                                                       |
| `isPinned(hash)`        | `boolean`                          | True iff a `pinnedWorldPos` is set.                                                                         |
| `setPin(hash, {x,y})`   | `void`                             | Creates or updates record; **preserves existing scale**; defensively copies the payload.                    |
| `setScale(hash, scale)` | `void`                             | Creates or updates record; **preserves existing pinnedWorldPos**.                                           |
| `unpin(hash)`           | `void`                             | Strips `pinnedWorldPos`; deletes the record entirely if no scale remains.                                   |
| `clearScale(hash)`      | `void`                             | Strips `scale`; deletes the record entirely if no pin remains.                                              |
| `clear(hash)`           | `void`                             | Removes the record regardless of contents.                                                                  |
| `clearAll()`            | `void`                             | Empties the map.                                                                                            |
| `reset()`               | `void`                             | Alias for `clearAll()` (matches curation/tournament reset convention).                                      |

Reactivity contract: every mutation assigns a **new** `Map` to `records.value`, so `records`-tracking watchers and `size`-tracking computeds re-fire on every change. Verified by a behavioural test that captures `store.$state.records` identity before / after each mutation.

## Exact Changes to `useMoshpitSpriteLayer.ts`

| Location                                                  | Change                                                                                                                                           | Reason                                                                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Header block (lines 1–43)                                 | Added bullet documenting `useMoshpitOverrideStore` consumption and updated the Reactivity contract to list `overrides.records` as a tracked dep. | Keep the contract doc truthful about the new reactive input.                                                                         |
| Imports (lines 45–58)                                     | Added `useMoshpitOverrideStore` import, alphabetised.                                                                                            | Store instantiation.                                                                                                                 |
| Pure-helper block (lines 100–130)                         | Added `resolveSlot(overrides, hash, provided)` and `resolveSpriteScale(overrides, hash)` as `@internal` exports.                                 | Testable under happy-dom (Pixi requires WebGL/canvas and isn't instantiable there).                                                  |
| Composable body (line ~147)                               | Instantiated `const overrides = useMoshpitOverrideStore()`.                                                                                      | Access from inside both watchEffects.                                                                                                |
| `applySlot` (lines 209–218)                               | Changed signature to `applySlot(entry, slot, scale)`; now calls `entry.sprite.scale.set(scale)` after position assignment.                       | Scale composes with the existing `anchor(0.5)`; keeps a single update path for both sprite branches.                                 |
| `syncSprites` existing-sprite branch (lines ~249–257)     | Calls `resolveSlot` + `resolveSpriteScale` before `applySlot`.                                                                                   | Single read-site inside the registry watchEffect — auto-tracks override mutations.                                                   |
| `syncSprites` newly-loaded-sprite branch (lines ~263–281) | Same `resolveSlot` + `resolveSpriteScale` call at texture-arrival time, using the latest provider slot.                                          | Texture loads race override mutations; resolve fresh.                                                                                |
| Selection watchEffect (lines ~318–347)                    | `void overrides.size` for reactive coupling; rings are destroy+recreated on every pass.                                                          | Picks up scale changes (which affect `sprite.width/height` the ring is drawn from) without patching individual `Graphics` instances. |

No new `watch` / `watchEffect` blocks were added — the whole point was to fold the override read into the existing reactive graph.

## Deviations from the Plan

1. **Helpers exported `@internal` from the same file rather than extracted to a sibling file.** The plan offered both options; co-location won because the helpers are trivial (2–6 lines each) and their sole caller is 10 lines away. JSDoc `@internal` + absence of barrel re-export keeps the module's public surface as the two composable-level exports (`DEFAULT_CELL_SIZE`, `MOSHPIT_LAYOUT_INJECTION_KEY`, `SpriteLayerOptions`, `SpriteLayerHandle`, `useMoshpitSpriteLayer`) plus the two internal helpers.
2. **Test strategy pivoted to pure-helper coverage.** Pixi's `Sprite` / `Container` / `Graphics` constructors require a WebGL context that happy-dom doesn't provide, so the plan's "integration sprite-layer test" was replaced with exhaustive unit coverage of `resolveSlot` + `resolveSpriteScale` (the only non-Pixi logic Task 2 adds). The behaviour bullets from `<behavior>` still map 1:1: pinned coords, scale=1 default, unpin-reverts, clear-removes-both.
3. **RED-commit pattern skipped for Task 1.** Husky's lint-staged step rejects an import pointing at a not-yet-created module (`import-x/no-unresolved`), which the plan's prescribed RED step requires. Rather than stub the module with placeholder exports, RED+GREEN were committed together in `d504842e0` — the test file still ran first locally and failed cleanly before the implementation was added.

No deviations from Rules 1–4 were required during execution.

## Verification Results

- `pnpm test:unit -- src/platform/moshpit/stores/moshpitOverrideStore.test.ts src/platform/moshpit/composables/useMoshpitSpriteLayer.test.ts` → **26 / 26 passed** (16 store + 10 helper tests).
- `pnpm typecheck` → clean.
- `pnpm exec eslint` on the four touched files → clean.
- lint-staged on commit → clean (oxfmt, oxlint, eslint, typecheck all green in the husky gate).

## Commits

| Hash        | Message                                                                   |
| ----------- | ------------------------------------------------------------------------- |
| `d504842e0` | feat(260423-j4f): add moshpitOverrideStore for per-asset sprite overrides |
| `248b8a71e` | feat(260423-j4f): layer sprite overrides into useMoshpitSpriteLayer       |

## Follow-up Hooks

This store is the mutation endpoint for every future sprite-control UI:

- **Floating action bar / context menu** — `setPin(hash, pos)`, `unpin(hash)`, `clear(hash)`.
- **Drag-to-pin gesture** — `setPin` on pointer-up with current world coords.
- **Resize handles** — `setScale(hash, scale)` driven by handle drag delta.
- **Copy / paste offset application** — read `record.pinnedWorldPos`, write offsetted copies via `setPin`.
- **"Reset to auto layout" action** — `clear(hash)` or `clearAll()`.
- **Phase reset hook** — `reset()` alias so phase-boundary callsites (curation clear, filter reset) can drop overrides uniformly.

Next quick task should build the floating action bar + context menu against this store.

## Self-Check: PASSED

- `src/platform/moshpit/stores/moshpitOverrideStore.ts` → FOUND
- `src/platform/moshpit/stores/moshpitOverrideStore.test.ts` → FOUND
- `src/platform/moshpit/composables/useMoshpitSpriteLayer.test.ts` → FOUND
- `src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` → modified (verified via `git diff --stat HEAD~2`)
- Commit `d504842e0` → FOUND in git log
- Commit `248b8a71e` → FOUND in git log
