---
phase: 06-curation-was-phase-5
plan: 05
subsystem: moshpit/curation-ui-popovers
tags: [curation, popovers, folders, tags, tdd, storybook, reka-ui]
dependency_graph:
  requires:
    - 06-01 (moshpitCurationStore + moshpitFoldersStore)
    - 06-02 (folder ParamKey in filterStore.addChip)
    - 06-03 (useMoshpitCuration — tagMany/untagMany/addToFolderMany/removeFromFolderMany)
  provides:
    - MoshpitTagInputPopover (v-model:open + hashes prop, tag input + tri-state chip list)
    - MoshpitFolderPickerPopover (v-model:open + hashes prop, folder list + new folder + from selection)
    - MoshpitFoldersSection (sidebar folder list + create + rename/delete + row-click filter chip)
    - MoshpitSettingsPanel mounting MoshpitFoldersSection after chip row
    - moshpit.curation.tags.* and moshpit.curation.folders.* i18n key blocks
  affects:
    - src/platform/moshpit/components/MoshpitTagInputPopover.vue
    - src/platform/moshpit/components/MoshpitTagInputPopover.test.ts
    - src/platform/moshpit/components/MoshpitTagInputPopover.stories.ts
    - src/platform/moshpit/components/MoshpitFolderPickerPopover.vue
    - src/platform/moshpit/components/MoshpitFolderPickerPopover.test.ts
    - src/platform/moshpit/components/MoshpitFoldersSection.vue
    - src/platform/moshpit/components/MoshpitFoldersSection.test.ts
    - src/platform/moshpit/components/MoshpitFoldersSection.stories.ts
    - src/platform/moshpit/components/MoshpitSettingsPanel.vue
    - src/platform/moshpit/stores/moshpitFoldersStore.test.ts
    - src/locales/en/main.json
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN per task — RED commit before GREEN
    - Reka PopoverRoot + PopoverAnchor (no visible trigger — popover opened programmatically from action bar / keybindings)
    - Reka DropdownMenuRoot for rename/delete overflow in MoshpitFoldersSection
    - defineModel<boolean>('open') pattern — all popovers use v-model:open
    - window.confirm assigned directly in tests (happy-dom has no window.confirm)
    - vi.spyOn(store, 'method') pattern for asserting store calls from component tests
key_files:
  created:
    - src/platform/moshpit/components/MoshpitTagInputPopover.vue
    - src/platform/moshpit/components/MoshpitTagInputPopover.test.ts
    - src/platform/moshpit/components/MoshpitTagInputPopover.stories.ts
    - src/platform/moshpit/components/MoshpitFolderPickerPopover.vue
    - src/platform/moshpit/components/MoshpitFolderPickerPopover.test.ts
    - src/platform/moshpit/components/MoshpitFoldersSection.vue
    - src/platform/moshpit/components/MoshpitFoldersSection.test.ts
    - src/platform/moshpit/components/MoshpitFoldersSection.stories.ts
    - src/platform/moshpit/stores/moshpitFoldersStore.test.ts
  modified:
    - src/platform/moshpit/components/MoshpitSettingsPanel.vue (MoshpitFoldersSection import + mount)
    - src/locales/en/main.json (moshpit.curation.tags.* + moshpit.curation.folders.* blocks)
decisions:
  - PopoverAnchor used as a hidden anchor (pointer-events-none) — popovers are opened programmatically from keybindings/action-bar, not via an inline trigger button; Plan 06 may add coordinate prop if UAT shows awkward placement
  - window.confirm assigned directly in tests (not vi.spyOn) — happy-dom does not define window.confirm, so vi.spyOn throws "cannot spy on undefined"
  - Folder picker data-testid keyed by folder.name not folder.id — name is stable in tests since we control the seed; avoids exposing UUID in testids
  - MoshpitFoldersSection row data-testid also keyed by name for same reason
  - MoshpitSettingsPanel mounts MoshpitFoldersSection with v-if=filterStore.isGated — consistent with all other gated components in the panel
metrics:
  duration: ~15 min
  completed_date: '2026-04-23T08:03:11Z'
  tasks_completed: 3
  files_created: 9
  files_modified: 2
  tests_added: 39
---

# Phase 6 Plan 05: Tag + Folder Curation Popovers + Folders Sidebar Summary

**Three curation surface components: MoshpitTagInputPopover (tri-state tag chips + inline input), MoshpitFolderPickerPopover (folder list + new folder + from-selection), MoshpitFoldersSection (sidebar with counts + overflow menu + filter chip) — plus full i18n coverage and MoshpitSettingsPanel mount.**

## Tasks Completed

| Task      | Name                                                  | Commit    | Files   |
| --------- | ----------------------------------------------------- | --------- | ------- |
| 1 (RED)   | Failing tests for MoshpitTagInputPopover              | 83c81b0c0 | 1 file  |
| 1 (GREEN) | MoshpitTagInputPopover + stories + i18n keys          | d59b5b282 | 3 files |
| 1 (FIX)   | Remove unused inputEl ref + fix mock ref              | 053254367 | 2 files |
| 1 (FIX2)  | Fix vue/no-unused-refs + Tailwind class order         | d0248d24b | 1 file  |
| 2 (RED)   | Failing tests for MoshpitFolderPickerPopover          | acddca2d4 | 1 file  |
| 2 (GREEN) | MoshpitFolderPickerPopover                            | 581c2dae5 | 1 file  |
| 3 (RED)   | Failing tests for MoshpitFoldersSection               | 856e07b65 | 2 files |
| 3 (GREEN) | MoshpitFoldersSection + SettingsPanel mount + stories | 1f9c469e7 | 4 files |

## What Was Built

### MoshpitTagInputPopover

Reka `PopoverRoot` with `PopoverAnchor` (hidden, no visible trigger) + `PopoverContent`. Opened programmatically from the action bar `open-tag-popover` emit or keybinding `T`.

**Prop API:**

```typescript
const openModel = defineModel<boolean>('open', { required: true })
const { hashes } = defineProps<{ hashes: readonly string[] }>()
```

**Tri-state chip logic:**

- `tristate = 'all'` — every selected hash has this tag → `aria-pressed="true"`, styled as selected, click calls `untagMany`
- `tristate = 'some'` — some selected hashes have it → `aria-pressed="false"`, warning border, click calls `tagMany`
- `tristate = 'none'` — no selected hash has it → `aria-pressed="false"`, subtle border, click calls `tagMany`

**Popover stays open after chip click** — allows multi-tag apply in one session. Closes only on Enter (after typing) or Esc.

**maxlength="64"** on the input prevents browser-level entry beyond the cap. The orchestrator (`useMoshpitCuration.tagMany`) also validates and shows a toast for programmatic overflow.

### MoshpitFolderPickerPopover

Reka `PopoverRoot` with full folder list + inline create + create-from-selection flow.

**Folder row click semantics (isAllIn toggle):**

- If all selected hashes are already in the folder → `removeFromFolderMany`
- Otherwise → `addToFolderMany`
- Row shows `aria-pressed="true"` and a check icon when all-in

**New folder flow:** "+ New folder…" button expands an input; Enter calls `foldersStore.create(name)` then `addToFolderMany(hashes, newId)`.

**New folder from selection:** separate input; Enter calls `foldersStore.createFromSelection(name, hashes)` + toast + closes popover.

### MoshpitFoldersSection

Sidebar section component with:

- Header label + folder list with member counts
- Row click → `filterStore.addChip({ param: 'folder', value: { kind: 'categorical', values: [folderId] } })`
- "+ New folder…" inline input → `foldersStore.create(name)`
- Per-row Reka `DropdownMenu` with Rename (inline input → `foldersStore.rename`) and Delete (`window.confirm` guard → `foldersStore.remove`)
- Empty state with `data-testid="moshpit-folders-empty"`

**Mounted in MoshpitSettingsPanel:** inserted after `<MoshpitFilterChipRow />` and before `<MoshpitWithinClusterSort />`, gated by `v-if="filterStore.isGated"`.

### i18n Keys Added

Full blocks added to `moshpit.curation` in `src/locales/en/main.json`:

```json
"tags": {
  "placeholder": "Add a tag…",
  "inputLabel": "Tag input",
  "chipHintAll": "Applied to all selected",
  "chipHintSome": "Applied to some selected",
  "chipHintNone": "Not applied"
},
"folders": {
  "title": "Folders",
  "empty": "No folders yet",
  "newFolder": "New folder…",
  "newFromSelection": "New folder from selection",
  "newFolderPlaceholder": "Folder name",
  "inputLabel": "Folder name input",
  "memberCount": "{count} asset | {count} assets",
  "defaultName": "Shortlist {date}",
  "sectionLabel": "Folders list",
  "confirmDelete": "Delete folder \"{name}\"? Assets remain in place.",
  "rename": "Rename",
  "delete": "Delete"
}
```

## Test Coverage

| File                               | Tests  |
| ---------------------------------- | ------ |
| MoshpitTagInputPopover.test.ts     | 9      |
| MoshpitFolderPickerPopover.test.ts | 11     |
| MoshpitFoldersSection.test.ts      | 8      |
| MoshpitSettingsPanel.test.ts       | 11     |
| **Total (this plan)**              | **39** |

All 39 tests green. `pnpm typecheck` clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused `inputEl` ref caused vue/no-unused-refs lint error**

- **Found during:** Task 1 GREEN commit (lint hook)
- **Issue:** `const inputEl = ref<HTMLInputElement | null>(null)` was declared and bound as `ref="inputEl"` in the template, but never used in script logic — `vue/no-unused-refs` error
- **Fix:** Removed the `inputEl` ref and its template binding; auto-focus is not required by the plan spec
- **Files modified:** `src/platform/moshpit/components/MoshpitTagInputPopover.vue`
- **Commit:** 053254367, d0248d24b

**2. [Rule 1 - Bug] Stale `ref` import in test mock caused ReferenceError**

- **Found during:** Task 1 GREEN run after removing `ref` import from test
- **Issue:** The `useMoshpitCuration` mock used `ref(null)` for `lastUndoable` but `ref` was no longer imported (removed along with unused `openRef` variable)
- **Fix:** Changed mock to `lastUndoable: { value: null }` — a plain ref-shaped object; component only reads `.value`, doesn't call Vue reactivity
- **Files modified:** `src/platform/moshpit/components/MoshpitTagInputPopover.test.ts`
- **Commit:** 053254367

**3. [Rule 1 - Bug] Tailwind class order violations in chipClass function**

- **Found during:** Task 1 fix commit (ESLint `better-tailwindcss/enforce-consistent-class-order`)
- **Issue:** `rounded-full px-2 py-0.5 text-xs border` → correct order is `rounded-full border px-2 py-0.5 text-xs`; and `border-border-subtle ... hover:bg-...` → hover utilities should precede non-hover
- **Fix:** `pnpm exec eslint --fix` auto-corrected the ordering
- **Files modified:** `src/platform/moshpit/components/MoshpitTagInputPopover.vue`
- **Commit:** d0248d24b

**4. [Rule 1 - Bug] `vi.spyOn(window, 'confirm')` fails in happy-dom**

- **Found during:** Task 3 GREEN run
- **Issue:** happy-dom does not define `window.confirm`, so `vi.spyOn` throws "vi.spyOn() can only spy on a function. Received undefined"
- **Fix:** Replaced `vi.spyOn(window, 'confirm').mockReturnValue(true)` with direct assignment `window.confirm = vi.fn().mockReturnValue(true)` — mirrors the pattern for other browser API stubs in the moshpit test suite
- **Files modified:** `src/platform/moshpit/components/MoshpitFoldersSection.test.ts`
- **Committed inline in Task 3 GREEN** (1f9c469e7)

## Popover Open API (for Plan 06 Wiring)

Both popovers expose the same interface:

```typescript
// v-model:open
const openModel = defineModel<boolean>('open', { required: true })
// Hashes to operate on
const { hashes } = defineProps<{ hashes: readonly string[] }>()
```

Plan 06 (`MoshpitView.vue`) will:

1. Hold `tagPopoverOpen = ref(false)` and `folderPickerOpen = ref(false)` + `popoverHashes = ref<string[]>([])`
2. Wire `MoshpitFloatingActionBar @open-tag-popover="..."` and `@open-folder-picker="..."` handlers to set these refs
3. Wire `useMoshpitCurationKeybindings({ openTagPopover: () => { popoverHashes.value = ...; tagPopoverOpen.value = true } })`
4. Mount `<MoshpitTagInputPopover v-model:open="tagPopoverOpen" :hashes="popoverHashes" />` and `<MoshpitFolderPickerPopover v-model:open="folderPickerOpen" :hashes="popoverHashes" />`

## Folder-Chip Semantics

Folder filter chips added by `MoshpitFoldersSection.onRowClick` contain the folder **id** (UUID v4):

```typescript
filterStore.addChip({
  id: crypto.randomUUID(),
  param: 'folder',
  value: { kind: 'categorical', values: [folderId] }
})
```

The sidebar and picker render folder **names** by reading `foldersStore.orderedFolders` — this is a UI-layer translation, not data-layer. The filter chip UI (`MoshpitFilterChipRow`) will need to resolve the folder id to a display name via `foldersStore.folders.get(id)?.name` when rendering the chip label — this is a Plan 06 concern.

## Known Gap: Popover Anchor Positioning

`MoshpitTagInputPopover` and `MoshpitFolderPickerPopover` both use a `PopoverAnchor` wrapping a hidden zero-size div (`class="pointer-events-none"`). This means Reka positions the popover relative to the viewport edge rather than a specific screen coordinate.

The keybindings path (`T` key) and action bar path both open the popover without a natural anchor element. If UAT shows that the popover placement is awkward (e.g., covers the selection), Plan 06 may add a `anchorRect?: DOMRect` prop and use `PopoverAnchor` as-child on a positioned element at that rect.

## Self-Check: PASSED

- FOUND: src/platform/moshpit/components/MoshpitTagInputPopover.vue
- FOUND: src/platform/moshpit/components/MoshpitTagInputPopover.test.ts
- FOUND: src/platform/moshpit/components/MoshpitTagInputPopover.stories.ts
- FOUND: `PopoverRoot` in MoshpitTagInputPopover.vue
- FOUND: `defineModel` in MoshpitTagInputPopover.vue
- FOUND: `tagMany` in MoshpitTagInputPopover.vue
- FOUND: `untagMany` in MoshpitTagInputPopover.vue
- FOUND: `data-testid="moshpit-tag-popover-input"` in MoshpitTagInputPopover.vue
- FOUND: `maxlength="64"` in MoshpitTagInputPopover.vue
- FOUND: `"placeholder"` under `"tags"` in src/locales/en/main.json
- FOUND: src/platform/moshpit/components/MoshpitFolderPickerPopover.vue
- FOUND: `orderedFolders` in MoshpitFolderPickerPopover.vue
- FOUND: `createFromSelection` in MoshpitFolderPickerPopover.vue
- FOUND: `addToFolderMany` in MoshpitFolderPickerPopover.vue
- FOUND: `removeFromFolderMany` in MoshpitFolderPickerPopover.vue
- FOUND: `PopoverRoot` in MoshpitFolderPickerPopover.vue
- FOUND: `"folders"` subblock under `"curation"` in src/locales/en/main.json
- FOUND: `"newFromSelection"` in src/locales/en/main.json
- FOUND: src/platform/moshpit/components/MoshpitFoldersSection.vue
- FOUND: `orderedFolders` in MoshpitFoldersSection.vue
- FOUND: `foldersStore.create` in MoshpitFoldersSection.vue
- FOUND: `foldersStore.remove` in MoshpitFoldersSection.vue
- FOUND: `addChip` in MoshpitFoldersSection.vue
- FOUND: `data-testid="moshpit-folders-new"` in MoshpitFoldersSection.vue
- FOUND: `window.confirm` in MoshpitFoldersSection.vue
- FOUND: `MoshpitFoldersSection` in MoshpitSettingsPanel.vue
- FOUND: `import MoshpitFoldersSection` in MoshpitSettingsPanel.vue
- FOUND: src/platform/moshpit/components/MoshpitFoldersSection.test.ts
- FOUND: src/platform/moshpit/components/MoshpitFoldersSection.stories.ts
- FOUND: commit 83c81b0c0 (Task 1 RED)
- FOUND: commit d59b5b282 (Task 1 GREEN)
- FOUND: commit acddca2d4 (Task 2 RED)
- FOUND: commit 581c2dae5 (Task 2 GREEN)
- FOUND: commit 856e07b65 (Task 3 RED)
- FOUND: commit 1f9c469e7 (Task 3 GREEN)
- 39 new tests green
- pnpm typecheck clean
- pnpm lint clean
