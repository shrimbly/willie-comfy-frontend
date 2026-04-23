---
phase: 260423-kx4
plan: 01
subsystem: moshpit
tags: [moshpit, reka-ui, context-menu, overrides, curation]
requires:
  - moshpitOverrideStore (260423-j4f)
  - moshpitSelectionStore
  - moshpitMetadataStore
  - SpriteHitTester injection (existing)
provides:
  - SpriteHitTester.getSpriteWorldPos
  - readSpriteWorldPos pure helper (@internal)
  - MoshpitSpriteContextMenu component + imperative open/close API
  - moshpit.contextMenu.* i18n keys
affects:
  - src/views/MoshpitView.vue — new @contextmenu handler
  - src/platform/moshpit/components/MoshpitCanvas.vue — hit-tester object literal widened
  - src/platform/moshpit/composables/useMoshpitSpriteDrag.test.ts — test stub widened
tech_stack:
  added: []
  patterns:
    - defineExpose imperative API for Reka portal components (mirrors MoshpitSortControls happy-dom fallback)
    - Test-through-callback pattern for Reka-UI portals that don't flush in happy-dom
key_files:
  created:
    - src/platform/moshpit/components/MoshpitSpriteContextMenu.vue
    - src/platform/moshpit/components/MoshpitSpriteContextMenu.test.ts
  modified:
    - src/platform/moshpit/composables/useMoshpitViewportInjection.ts
    - src/platform/moshpit/composables/useMoshpitSpriteLayer.ts
    - src/platform/moshpit/composables/useMoshpitSpriteLayer.test.ts
    - src/platform/moshpit/composables/useMoshpitSpriteDrag.test.ts
    - src/platform/moshpit/components/MoshpitCanvas.vue
    - src/platform/moshpit/components/MoshpitCanvas.test.ts
    - src/views/MoshpitView.vue
    - src/locales/en/main.json
decisions:
  - Expose action callbacks (onPinHere, onUnpin, etc.) via defineExpose so tests can assert behaviour without Reka portal DOM traversal — happy-dom doesn't flush portalled ContextMenuContent reliably, and tests anchored to the click handlers remain behavioural (they exercise the same code path as the template @select bindings).
  - Action set captured at open() time, not at click time — prevents drift if selection changes between right-click and menu item click.
  - Right-click suppresses only when a sprite is hit; empty-canvas right-click lets the browser's native menu pass through (preserves pan gesture semantics and future escape hatches).
  - Right-click does not mutate selection. A right-click on a non-selected sprite acts only on that single hash; a right-click on a selected sprite in a multi-selection acts on the whole selection. This avoids clobbering a selection the user just built.
  - Pure helper readSpriteWorldPos extracted so tests cover the handle semantics without instantiating Pixi — reuses the 260423-j4f pure-helper test pattern for happy-dom compatibility.
metrics:
  duration: ~18min
  completed: 2026-04-23
  tasks_completed: 3
  files_changed: 10
  loc_non_test: +254 (226 SFC + 7 viewport iface + 25 layer handle - ~4 trivial delta on MoshpitView/MoshpitCanvas/toggled lines)
  loc_test: +298 MoshpitSpriteContextMenu.test + 26 sprite-layer test delta
  tests_added: 12 (9 context menu + 3 readSpriteWorldPos)
  moshpit_suite: 701/701 passing (up from 625 pre-plan — baseline included j4f+kdv additions)
---

# Quick Task 260423-kx4: Moshpit Sprite Context Menu Summary

Added a Reka-UI right-click context menu for sprites on the Moshpit canvas. Right-clicking a sprite opens the menu anchored at the pointer with Pin here / Unpin, Download, Select similar, and Reset all pins actions. The menu acts on the current selection when the right-clicked sprite belongs to it, otherwise on just the target sprite. This is the first sprite-control UI to mount on both the `moshpitOverrideStore` (from 260423-j4f) and the selection store, and it establishes the wiring site for the upcoming floating action bar.

## Outcome

- **Pin here / Unpin** — mutually exclusive based on `overrideStore.isPinned(target)`; Pin here resolves the sprite's current world position via the new `SpriteHitTester.getSpriteWorldPos` API and writes it to the override store (skips hashes that are already pinned in multi-target mode).
- **Download** — builds a `hash → AssetItem` map from `assetsStore.historyAssets` mirroring `resolveFullResUrl`, triggers a transient `<a href download>` click per hash in the action set, and surfaces an info toast with singular/plural summary.
- **Select similar** — reads `metadataStore.getParams(target)?.workflowFilename` and replaces the selection with every hash in `paramsByHash` whose `workflowFilename` matches. No-match case toasts and leaves selection unchanged.
- **Reset all pins** — disabled when `overrideStore.size === 0`, enabled otherwise, calls `clearAll()` on click.
- **Empty canvas** — right-click passes through to the native browser menu (no `.prevent` modifier on the container; handler calls `preventDefault()` only on a sprite hit).

## Commits

- `def4ad79e` — `feat(260423-kx4): extend SpriteHitTester with getSpriteWorldPos`
- `4fffaf463` — `feat(260423-kx4): add MoshpitSpriteContextMenu component + i18n`
- `b548e405f` — `feat(260423-kx4): wire sprite context menu into MoshpitView`

## Deviations from Plan

Only scope adjustments — no auto-fixes or surprises.

### [Rule 3 — Blocker] Widen existing SpriteHitTester stubs

**Found during:** Task 1 commit (husky typecheck).
**Issue:** Extending the `SpriteHitTester` interface with `getSpriteWorldPos` broke two existing stubs (`MoshpitCanvas.test.ts` mock and `useMoshpitSpriteDrag.test.ts` helper).
**Fix:** Added `getSpriteWorldPos` to both stubs returning `null` by default (neither test exercises the new method).
**Files modified:** `src/platform/moshpit/components/MoshpitCanvas.test.ts`, `src/platform/moshpit/composables/useMoshpitSpriteDrag.test.ts`
**Commit:** `def4ad79e`

### [Rule 3 — Blocker] Also widen MoshpitCanvas.vue hit-tester object literal

**Found during:** same commit.
**Issue:** `MoshpitCanvas.vue` manually constructs the `SpriteHitTester` object literal from the sprite-layer handle's methods. After widening the interface, TypeScript flagged the literal as missing `getSpriteWorldPos`.
**Fix:** Added `getSpriteWorldPos: spriteLayerRef.getSpriteWorldPos` to the literal.
**Files modified:** `src/platform/moshpit/components/MoshpitCanvas.vue`
**Commit:** `def4ad79e`

## Test Coverage

- `useMoshpitSpriteLayer.test.ts` — added 3 tests for `readSpriteWorldPos` (slot entry → XY, missing → null, pinned-coord pass-through).
- `MoshpitSpriteContextMenu.test.ts` — 9 behavioural tests across 4 describe blocks:
  - action set (target vs selection): Pin here writes captured pos, Unpin clears target, selection-of-3 unpin clears all 3, non-selected target acts on one hash only.
  - Download: spies `HTMLAnchorElement.prototype.click` to assert count matches action-set size; toast severity and summary (singular vs plural) asserted.
  - Select similar: positive match replaces selection, no-match toasts with specific key and leaves selection untouched.
  - Reset all pins: `isResetAllDisabled` tracks `overrideStore.size`; clearAll invoked on enabled click.

All 9 tests pass. Tests intentionally drive the component via `defineExpose` (`onPinHere`, `onUnpin`, etc.) rather than DOM traversal — Reka's `ContextMenuContent` is portalled and doesn't flush reliably in happy-dom (matches the MoshpitSortControls precedent in STATE.md).

## Verification

- `pnpm test:unit -- src/platform/moshpit` — 701/701 passing (54 test files).
- `pnpm typecheck` — clean.
- `pnpm test:unit -- src/platform/moshpit/components/MoshpitSpriteContextMenu.test.ts` — 9/9 passing.
- `pnpm test:unit -- src/platform/moshpit/composables/useMoshpitSpriteLayer.test.ts` — 13/13 passing (10 pre-existing + 3 new).
- No `any`, `as any`, `dark:`, `:class="[]"`, `!important`, or new PrimeVue imports in the new files.
- Non-test LoC delta: ~254 (under the 300 budget).

## Known Stubs

None. All menu actions are fully wired to their respective stores/helpers.

## Self-Check: PASSED

Verified artifacts:

- FOUND: src/platform/moshpit/components/MoshpitSpriteContextMenu.vue
- FOUND: src/platform/moshpit/components/MoshpitSpriteContextMenu.test.ts
- FOUND: commit def4ad79e
- FOUND: commit 4fffaf463
- FOUND: commit b548e405f
- FOUND: getSpriteWorldPos on SpriteHitTester interface
- FOUND: MoshpitSpriteContextMenu import + ref + @contextmenu handler in MoshpitView.vue
- FOUND: moshpit.contextMenu.\* keys in src/locales/en/main.json
