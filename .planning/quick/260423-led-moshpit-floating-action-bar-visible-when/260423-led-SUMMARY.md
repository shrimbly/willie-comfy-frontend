---
phase: 260423-led
plan: 01
subsystem: moshpit
tags: [moshpit, selection, overlay, action-bar, dry]
requires:
  - 260423-kx4 (sprite context menu — source of shared action logic)
provides:
  - MoshpitFloatingActionBar overlay (bulk Unpin / Download / Clear for selection)
  - useMoshpitSpriteActions composable (single source of truth for per-item actions)
affects:
  - MoshpitSpriteContextMenu (refactored to delegate to composable)
  - MoshpitView (mounts the new overlay)
tech-stack:
  added: []
  patterns:
    - 'Stateless composable accepting `{ getHitTester }` — avoids double-injection when two consumers both need hit-test access'
    - 'Pinia store direct property writes for test setup (`tournamentStore.isActive = true`)'
key-files:
  created:
    - src/platform/moshpit/composables/useMoshpitSpriteActions.ts
    - src/platform/moshpit/composables/useMoshpitSpriteActions.test.ts
    - src/platform/moshpit/components/MoshpitFloatingActionBar.vue
    - src/platform/moshpit/components/MoshpitFloatingActionBar.test.ts
  modified:
    - src/platform/moshpit/components/MoshpitSpriteContextMenu.vue
    - src/views/MoshpitView.vue
    - src/locales/en/main.json
decisions:
  - 'Action vocabulary centralised in useMoshpitSpriteActions rather than duplicating download/unpin/select-similar logic across context menu and action bar'
  - 'i18n keys for download toast kept under moshpit.contextMenu.* (shared copy) — new keys under moshpit.actionBar.* limited to bar-unique labels'
  - 'Action bar passes `getHitTester: () => null` because it never invokes pinHereMany; the composable no-ops + warns cleanly'
metrics:
  duration: ~12 min
  completed: 2026-04-23
---

# Phase 260423-led Plan 01: Moshpit Floating Action Bar Summary

Selection-driven bulk-action overlay pinned to the bottom-center of the Moshpit canvas, sharing its action vocabulary with the right-click context menu via a new `useMoshpitSpriteActions` composable.

## Commits

| Hash        | Message                                                                          |
| ----------- | -------------------------------------------------------------------------------- |
| `4d2995ecf` | refactor(260423-led): extract useMoshpitSpriteActions composable                 |
| `6cd4583d5` | feat(260423-led): add MoshpitFloatingActionBar for selection-driven bulk actions |

## Test Counts

- Moshpit suite before: 705 tests across 54 files (post-kx4 baseline)
- Moshpit suite after: **721 tests across 56 files** (delta +16: 13 composable + 7 action bar − 4 tests replaced by composable coverage; net +16)
- Full `pnpm test:unit src/platform/moshpit` green
- `pnpm typecheck` green

## Deviations from Plan

None. All plan tasks completed as written. Minor formatter-driven adjustments to test file after lint-staged (`render` destructuring → `screen.*` per `testing-library/prefer-screen-queries`) — a single linter fix re-run, no behavioural change.

## LoC Delta (non-test vs test)

| Kind            | Lines added | Notes                                                                                                                                 |
| --------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Non-test (src/) | ~170        | composable ~130, bar SFC ~85 (formatter-expanded), MoshpitView +2, locales +6; offset by ~80 lines removed from context menu refactor |
| Test            | ~370        | composable tests ~270, bar tests ~190 (mostly await/waitFor + helpers)                                                                |

Net non-test delta is well under the 300-line budget.

## Must-Haves Self-Check

### Truths

- [x] When selection is empty, the floating action bar is NOT rendered — `v-if="isVisible"` gated on `selectionStore.size > 0`. Covered by test "is not rendered when selection is empty".
- [x] When selection has >=1 item, the bar renders pinned to the bottom-center with a count badge — `absolute bottom-4 left-1/2 -translate-x-1/2` + `[data-testid="moshpit-action-bar-count"]`. Covered by "renders with count when selection > 0".
- [x] Clicking Clear empties the selection — `onClearClick` → `selectionStore.clear()`. Covered by "empties the selection and removes the bar from the DOM".
- [x] Download triggers one browser download per resolvable hash with toast — `downloadMany` in composable (spied, 2 anchor clicks for 2 resolvable hashes). Covered by "triggers one anchor click per resolvable hash" + composable-level toast assertions.
- [x] Unpin removes pinned overrides and is disabled when none pinned — `canUnpin = actions.someSelectedArePinned(selectionStore.selected)`. Covered by "is disabled when none of the selection is pinned" + "is enabled and unpins when at least one hash is pinned".
- [x] Context menu and action bar invoke the same action implementations — both call `useMoshpitSpriteActions({ getHitTester })`. Covered by running the kx4 suite (9/9 pass) after the refactor.
- [x] Bar is not rendered during tournament mode — `!tournamentStore.isActive` in `isVisible`. Covered by "is hidden while tournament mode is active".

### Artifacts

- [x] `src/platform/moshpit/composables/useMoshpitSpriteActions.ts` exports the composable.
- [x] `src/platform/moshpit/composables/useMoshpitSpriteActions.test.ts` provides 13 behavioural tests.
- [x] `src/platform/moshpit/components/MoshpitFloatingActionBar.vue` renders the overlay.
- [x] `src/platform/moshpit/components/MoshpitFloatingActionBar.test.ts` provides 7 behavioural tests.
- [x] `src/locales/en/main.json` contains `moshpit.actionBar.{selectedCount,unpin,download,clear}`.

### Key Links

- [x] `MoshpitSpriteContextMenu.vue` → `useMoshpitSpriteActions` (import + call).
- [x] `MoshpitFloatingActionBar.vue` → `useMoshpitSpriteActions` (import + call).
- [x] `MoshpitView.vue` mounts `<MoshpitFloatingActionBar />` alongside `<MoshpitMarqueeOverlay />`.

## Verification

- `pnpm test:unit src/platform/moshpit/composables/useMoshpitSpriteActions.test.ts src/platform/moshpit/components/MoshpitSpriteContextMenu.test.ts` → 22/22 passing
- `pnpm test:unit src/platform/moshpit/components/MoshpitFloatingActionBar.test.ts` → 7/7 passing
- `pnpm test:unit src/platform/moshpit` → 721/721 passing (56 files)
- `pnpm typecheck` → clean (vue-tsc --noEmit exit 0)
- No `any`, `as any`, `dark:`, `:class="[]"`, `!important`, arbitrary percentages, or new PrimeVue imports introduced.

## Self-Check: PASSED
