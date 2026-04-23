---
phase: 06-curation-was-phase-5
plan: 06
subsystem: moshpit/curation-wiring
tags: [curation, context-menu, tournament, keybindings, popovers, playwright, tdd]
dependency_graph:
  requires:
    - 06-01 (moshpitCurationStore + moshpitFoldersStore)
    - 06-02 (folder ParamKey)
    - 06-03 (useMoshpitCuration + useMoshpitCurationKeybindings)
    - 06-04 (MoshpitUndoToast + MoshpitFloatingActionBar)
    - 06-05 (MoshpitTagInputPopover + MoshpitFolderPickerPopover + MoshpitFoldersSection)
  provides:
    - MoshpitSpriteContextMenu extended with 5 curation items + 2 emits
    - MoshpitTournamentWinner Save as folder flow
    - MoshpitView fully wired (keybindings + popovers + action bar + context menu emits + resolveFullResUrl)
    - @moshpit Phase 6 curation Playwright spec (deferred)
  affects:
    - src/platform/moshpit/components/MoshpitSpriteContextMenu.vue
    - src/platform/moshpit/components/MoshpitSpriteContextMenu.test.ts
    - src/platform/moshpit/components/MoshpitTournamentWinner.vue
    - src/platform/moshpit/components/MoshpitTournamentWinner.test.ts
    - src/views/MoshpitView.vue
    - src/locales/en/main.json
    - browser_tests/tests/moshpit/phase-06-curation.spec.ts
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN per task (Tasks 1+2)
    - useMoshpitCuration called at MoshpitView top-level to bind resolveFullResUrl to module singleton
    - defineExpose extended on MoshpitSpriteContextMenu to expose curation handlers for test access
    - savingFolder ref pattern for inline form expansion (no new component needed)
    - test.fixme pattern for Playwright spec deferral per Phase 4 precedent
key_files:
  created:
    - browser_tests/tests/moshpit/phase-06-curation.spec.ts
  modified:
    - src/platform/moshpit/components/MoshpitSpriteContextMenu.vue (5 new items + 2 emits + curation wiring)
    - src/platform/moshpit/components/MoshpitSpriteContextMenu.test.ts (10 new curation tests)
    - src/platform/moshpit/components/MoshpitTournamentWinner.vue (Save as folder form)
    - src/platform/moshpit/components/MoshpitTournamentWinner.test.ts (7 new folder tests)
    - src/views/MoshpitView.vue (keybindings + popovers + emit handlers + resolveFullResUrl)
    - src/locales/en/main.json (9 new keys)
decisions:
  - useMoshpitCuration called at MoshpitView script setup top-level so module-singleton lastUndoable has resolveFullResUrl bound for export; context menu and keybindings share this resolver automatically
  - MoshpitSpriteContextMenu.onExport uses the already-initialised composable singleton (no options needed at call site)
  - "Save as folder" inline form uses savingFolder ref + watch to seed default name on expansion — no separate component needed
  - Playwright spec all tests marked test.fixme per pre-existing Phase 4 typecheck:browser tsconfig mismatch on main (same deferral rationale as Phase 04 Plan 06 Task 5)
  - anchorX/anchorY included in open-tag-popover + open-folder-picker emit payloads for future popover anchor positioning improvement (Plan 05 known gap)
metrics:
  duration: ~25 min
  completed_date: '2026-04-23'
  tasks_completed: 4
  tasks_pending: 1 (Task 5 HUMAN-UAT checkpoint)
  files_created: 1
  files_modified: 6
  tests_added: 17 (10 context menu + 7 tournament winner)
---

# Phase 6 Plan 06: Final Wiring + Validation Summary (partial — awaiting HUMAN-UAT)

**Extended MoshpitSpriteContextMenu with 5 curation items, added Save as folder to tournament winner screen, wired MoshpitView with keybindings + popovers + action bar + context menu emits, and shipped a deferred @moshpit Playwright spec.**

## Tasks Completed

| Task      | Name                                                      | Commit    | Files   |
| --------- | --------------------------------------------------------- | --------- | ------- |
| 1 (RED)   | Failing tests for MoshpitSpriteContextMenu curation items | 0d23f0203 | 1 file  |
| 1 (GREEN) | Extend MoshpitSpriteContextMenu with 5 curation items     | de0e834c7 | 2 files |
| 2 (RED)   | Failing tests for MoshpitTournamentWinner Save as folder  | b7ea1bf77 | 1 file  |
| 2 (GREEN) | Add Save as folder button to MoshpitTournamentWinner      | a23be1f02 | 2 files |
| 3         | Wire MoshpitView keybindings + popovers + emits           | 1ca96ac11 | 1 file  |
| 4         | @moshpit Phase 6 curation Playwright spec                 | d0bc842b9 | 1 file  |
| 5         | **HUMAN-UAT checkpoint** — PENDING                        | —         | —       |

## What Was Built

### MoshpitSpriteContextMenu — 5 curation items

Five new items inserted after "Select similar" and before "Reset all pins":

- **Favourite / Unfavourite** — toggles based on `allFavourited` computed; calls `curation.favouriteMany(actionSet, !allFavourited)`. Keyboard hint: `S`.
- **Tag…** — emits `open-tag-popover` with `{ hashes, anchorX, anchorY }`. Keyboard hint: `T`.
- **Hide / Unhide** — toggles based on `allHidden` computed; calls `curation.hideMany(actionSet, !allHidden)`. Keyboard hint: `H`.
- **Add to folder…** — emits `open-folder-picker` with `{ hashes, anchorX, anchorY }`.
- **Export full-resolution…** — calls `curation.exportMany(actionSet)`. Keyboard hint: `E`.

Toggle labels (`allFavourited`, `allHidden`) are computed from `useMoshpitCurationStore` and exposed via `defineExpose` for test-driving through the component's behavioural surface.

### MoshpitTournamentWinner — Save as folder

A "Save as folder" button in the winner screen footer expands an inline form:

- Default name seeded via `t('moshpit.tournament.winner.saveAsFolderDefault', { date: now.toLocaleString() })`.
- Submit calls `foldersStore.createFromSelection(name, winnerHashes)`.
- Info toast on success; warn toast on empty / >64-char name.
- Cancel collapses back to button without creating a folder.
- Does NOT call `tournamentStore.exit()` — user remains on winner screen.

### MoshpitView — Full curation wiring

```typescript
// Module-singleton resolver binding (top-level in <script setup>)
useMoshpitCuration({ resolveFullResUrl })

// Keybindings composable
useMoshpitCurationKeybindings({
  containerEl,
  openTagPopover: () => openTagPopover()
})

// Popover state
const tagPopoverOpen = ref(false)
const folderPopoverOpen = ref(false)
const popoverHashes = ref<readonly string[]>([])
```

Template mounts `MoshpitTagInputPopover` and `MoshpitFolderPickerPopover` at the canvas root. Both `MoshpitFloatingActionBar` and `MoshpitSpriteContextMenu` have `@open-tag-popover` + `@open-folder-picker` handlers wired to the same `openTagPopover`/`openFolderPopover` helpers. `:resolve-full-res-url="resolveFullResUrl"` prop passed to `MoshpitFloatingActionBar`.

### i18n Keys Added

Under `moshpit.contextMenu`:

- `favourite`, `unfavourite`, `tag`, `hide`, `unhide`, `addToFolder`, `export`

Under `moshpit.tournament.winner`:

- `saveAsFolder`, `saveAsFolderDefault`

### Playwright Spec

`browser_tests/tests/moshpit/phase-06-curation.spec.ts` — 4 scenarios:

1. `favourite-and-undo` — S key, undo toast, Cmd-Z
2. `tag-flow` — T key, popover, Enter
3. `hide-and-show` — H key, show-hidden toggle
4. `folder-create-from-selection` — tournament winner Save as folder

All marked `test.fixme` per Phase 4 typecheck:browser deferral precedent.

## Test Coverage

| File                             | Tests (new) |
| -------------------------------- | ----------- |
| MoshpitSpriteContextMenu.test.ts | 10          |
| MoshpitTournamentWinner.test.ts  | 7           |
| **Total new**                    | **17**      |
| **Moshpit suite total**          | **900**     |

All 900 moshpit unit tests green. `pnpm typecheck` clean.

## Deviations from Plan

None — plan executed exactly as written. All `must_haves.truths`, `artifacts`, and `key_links` satisfied for Tasks 1–4.

## Known Stubs

None. All five context menu items fully wired to live curation verbs. The `exportMany` resolver is the module-singleton bound via `useMoshpitCuration({ resolveFullResUrl })` in MoshpitView's setup.

## Threat Coverage

| Threat ID  | Status    | Notes                                                                                        |
| ---------- | --------- | -------------------------------------------------------------------------------------------- |
| T-06-06-01 | Monitored | Rapid E key presses: browser throttles; UAT step 6 validates                                 |
| T-06-06-02 | Mitigated | tagPopoverOpen + folderPopoverOpen are independent refs; both can open, Reka handles z-order |
| T-06-06-03 | Mitigated | useMoshpitCurationKeybindings guards tournamentStore.isActive (Plan 03)                      |
| T-06-06-04 | Mitigated | isEditableTarget guard short-circuits when focus is in a popover input (Plan 03)             |
| T-06-06-05 | Mitigated | 64-char + empty reject + trim enforced in onSaveFolder; invalidFolder toast shown            |

## PENDING: Task 5 — HUMAN-UAT

The HUMAN-UAT checkpoint (Task 5) must be approved by the user before this plan is marked complete. See the plan's `<how-to-verify>` section for the 8-step UAT script.

UAT approval date: **PENDING**

## Self-Check: PASSED

- FOUND: src/platform/moshpit/components/MoshpitSpriteContextMenu.vue (onFavourite, onTag, onHide, onFolder, onExport)
- FOUND: `open-tag-popover` and `open-folder-picker` emits in MoshpitSpriteContextMenu.vue
- FOUND: `allFavourited` and `allHidden` computed in MoshpitSpriteContextMenu.vue
- FOUND: `moshpit-tournament-winner-save-folder` testid in MoshpitTournamentWinner.vue
- FOUND: `createFromSelection` in MoshpitTournamentWinner.vue
- FOUND: `winnerHashes` consumed in MoshpitTournamentWinner.vue
- FOUND: `"saveAsFolder"` in src/locales/en/main.json
- FOUND: `moshpit.curation.invalidFolder` referenced in MoshpitTournamentWinner.vue
- FOUND: `useMoshpitCurationKeybindings` in src/views/MoshpitView.vue
- FOUND: `useMoshpitCuration({ resolveFullResUrl })` in src/views/MoshpitView.vue
- FOUND: `<MoshpitTagInputPopover` in src/views/MoshpitView.vue
- FOUND: `<MoshpitFolderPickerPopover` in src/views/MoshpitView.vue
- FOUND: `openTagPopover` and `openFolderPopover` in src/views/MoshpitView.vue
- FOUND: `:resolve-full-res-url="resolveFullResUrl"` in src/views/MoshpitView.vue
- FOUND: `@open-tag-popover=` in src/views/MoshpitView.vue (×2)
- FOUND: `@open-folder-picker=` in src/views/MoshpitView.vue (×2)
- FOUND: `v-model:open="tagPopoverOpen"` in src/views/MoshpitView.vue
- FOUND: `v-model:open="folderPopoverOpen"` in src/views/MoshpitView.vue
- FOUND: browser_tests/tests/moshpit/phase-06-curation.spec.ts
- FOUND: `@moshpit` in phase-06-curation.spec.ts
- FOUND: `comfyPageFixture as test` in phase-06-curation.spec.ts
- FOUND: `moshpit-undo-toast-button` in phase-06-curation.spec.ts
- NO `waitForTimeout` in phase-06-curation.spec.ts
- FOUND: commit 0d23f0203 (Task 1 RED)
- FOUND: commit de0e834c7 (Task 1 GREEN)
- FOUND: commit b7ea1bf77 (Task 2 RED)
- FOUND: commit a23be1f02 (Task 2 GREEN)
- FOUND: commit 1ca96ac11 (Task 3)
- FOUND: commit d0bc842b9 (Task 4)
- 900 moshpit unit tests green
- pnpm typecheck clean
- pnpm lint clean on Plan 06 files (5 pre-existing errors in unrelated files)
  </content>
  </invoke>
