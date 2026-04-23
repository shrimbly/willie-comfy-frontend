---
phase: 06-curation-was-phase-5
plan: 04
subsystem: moshpit/curation-ui
tags: [curation, toast, undo, action-bar, tdd, storybook]
dependency_graph:
  requires:
    - 06-03 (useMoshpitCuration — undoLast, favouriteMany, hideMany, exportMany verbs)
  provides:
    - MoshpitUndoToast — PrimeVue Toast group="moshpit-curation" mount + Undo button
    - MoshpitLayout — one authoritative MoshpitUndoToast mount
    - MoshpitFloatingActionBar — five curation buttons + open-tag-popover / open-folder-picker emits
  affects:
    - src/platform/moshpit/components/MoshpitUndoToast.vue
    - src/platform/moshpit/components/MoshpitUndoToast.test.ts
    - src/platform/moshpit/components/MoshpitUndoToast.stories.ts
    - src/views/layouts/MoshpitLayout.vue
    - src/platform/moshpit/components/MoshpitFloatingActionBar.vue
    - src/platform/moshpit/components/MoshpitFloatingActionBar.test.ts
    - src/locales/en/main.json
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN per task — RED commit before GREEN commit
    - vi.mock() + vi.hoisted() for composable spy injection (replaces vi.doMock pattern)
    - ToastSlotProps interface to type closeCallback from PrimeVue #message slot
    - resolveFullResUrl prop declared but wired externally (Plan 06 responsibility)
key_files:
  created:
    - src/platform/moshpit/components/MoshpitUndoToast.vue
    - src/platform/moshpit/components/MoshpitUndoToast.test.ts
    - src/platform/moshpit/components/MoshpitUndoToast.stories.ts
  modified:
    - src/views/layouts/MoshpitLayout.vue (MoshpitUndoToast import + mount)
    - src/platform/moshpit/components/MoshpitFloatingActionBar.vue (5 curation buttons + 2 emits + resolveFullResUrl prop)
    - src/platform/moshpit/components/MoshpitFloatingActionBar.test.ts (6 new tests + regression suite preserved)
    - src/locales/en/main.json (moshpit.actionBar.{favourite,tag,hide,folder,export})
decisions:
  - Toast portal-rendered by PrimeVue — DOM location in MoshpitLayout does not affect visual placement; position='bottom-center' is set on the component itself
  - ToastSlotProps interface explicit cast required — vue-tsc cannot infer closeCallback from PrimeVue generic slot shape without it
  - resolveFullResUrl declared as optional prop on MoshpitFloatingActionBar; exportMany is a no-op without it; Plan 06 wires this from MoshpitView
  - Action bar button order: count | Unpin Download | divider | Favourite Tag Hide Folder Export | divider | Clear
  - Tag and Folder emit events rather than calling curation verbs directly — these need popover UI (Plan 05) to collect the tag string / folder id before the verb can be invoked
requirements:
  - CURATE-01
  - CURATE-02
  - CURATE-04
  - CURATE-05
  - CURATE-06
  - CURATE-07
metrics:
  duration: ~20 min
  completed_date: '2026-04-23T07:44:00Z'
  tasks_completed: 2
  files_created: 3
  files_modified: 4
  tests_added: 18
---

# Phase 6 Plan 04: MoshpitUndoToast + MoshpitFloatingActionBar Curation Buttons Summary

**PrimeVue Toast with group-targeted Undo button mounted once in MoshpitLayout; floating action bar extended with Favourite / Tag / Hide / Folder / Export curation buttons**

## Tasks Completed

| Task      | Name                                                     | Commit    | Files   |
| --------- | -------------------------------------------------------- | --------- | ------- |
| 1 (RED)   | Failing tests for MoshpitUndoToast                       | acb1a0f64 | 1 file  |
| 1 (GREEN) | MoshpitUndoToast + MoshpitLayout mount + Storybook story | 67859bf32 | 4 files |
| 1 (FIX)   | Fix ToastSlotProps typecheck error                       | b8deb0031 | 1 file  |
| 2 (RED)   | Failing tests for MoshpitFloatingActionBar curation btns | 08860a981 | 1 file  |
| 2 (GREEN) | Five curation buttons + two emits + i18n keys            | b22afa5aa | 3 files |

## What Was Built

### MoshpitUndoToast.vue

```vue
<Toast group="moshpit-curation" position="bottom-center">
  <template #message="slotProps">
    <div class="flex items-center gap-3 px-2 py-1">
      <span>{{ (slotProps as ToastSlotProps).message.summary }}</span>
      <button data-testid="moshpit-undo-toast-button" @click="onUndo(...)">
        {{ t('moshpit.curation.undo') }}
      </button>
    </div>
  </template>
</Toast>
```

The `group="moshpit-curation"` prop routes only messages that have `group: 'moshpit-curation'` set in `toastStore.add()` — published by every verb in `useMoshpitCuration`. The `#message` slot exposes `closeCallback` from PrimeVue, which the Undo button invokes after calling `curation.undoLast()`.

**Toast portal behaviour:** PrimeVue's Toast component renders via a `<Teleport>` to a global portal — the component's position in the layout tree does not affect its on-screen placement. Position is controlled by `position="bottom-center"`. The only requirement is that it is mounted **exactly once** with the correct `group`.

### MoshpitLayout.vue

`<MoshpitUndoToast />` is mounted as a direct child of `<main>` (the layout root), peer of `<div class="relative flex-1">`. It sits outside the flex-1 container so it doesn't affect layout measurements. Because PrimeVue teleports the rendered toast to the document body, the DOM position is irrelevant to visual output.

### MoshpitFloatingActionBar.vue — Final Button Order

```
count | Unpin  Download | ─── | Favourite  Tag  Hide  Folder  Export | ─── | Clear
```

- **Favourite**: calls `curation.favouriteMany(selectionStore.selected)` directly
- **Tag**: emits `'open-tag-popover'` with `{ hashes: selected }` — Plan 05 popover wires the tag entry UI
- **Hide**: calls `curation.hideMany(selectionStore.selected)` directly
- **Folder**: emits `'open-folder-picker'` with `{ hashes: selected }` — Plan 05 popover wires the folder picker
- **Export**: calls `curation.exportMany(selectionStore.selected)` directly (requires `resolveFullResUrl` prop wired by Plan 06)

### Emit Payloads (for Plan 06 wiring)

```typescript
defineEmits<{
  'open-tag-popover': [payload: { hashes: readonly string[] }]
  'open-folder-picker': [payload: { hashes: readonly string[] }]
}>()
```

Both payloads carry `hashes: readonly string[]` — the current selection at the moment the button was clicked. Plan 05's popover receives this as the target set for `tagMany()` / `addToFolderMany()`.

### resolveFullResUrl Prop (for Plan 06 wiring)

```typescript
const { resolveFullResUrl } = defineProps<{
  resolveFullResUrl?: (hash: string) => string | null
}>()

const curation = useMoshpitCuration({ resolveFullResUrl })
```

`exportMany` is a no-op if `resolveFullResUrl` is undefined (logs `console.warn`). Plan 06 passes the closure from `MoshpitView.vue`.

### i18n Keys Added

`moshpit.actionBar.{favourite, tag, hide, folder, export}` — values: "Favourite", "Tag", "Hide", "Folder", "Export".

## Test Coverage

| File                             | Tests                              |
| -------------------------------- | ---------------------------------- |
| MoshpitUndoToast.test.ts         | 5 (structure + Undo button wiring) |
| MoshpitFloatingActionBar.test.ts | 13 (7 regression + 6 new curation) |
| **Total (this plan)**            | **18**                             |
| **Total (moshpit suite)**        | **855 green**                      |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ToastSlotProps explicit interface required for vue-tsc**

- **Found during:** Task 1 GREEN commit (typecheck hook)
- **Issue:** `vue-tsc` could not infer `closeCallback` from the PrimeVue Toast `#message` slot's generic shape — error `TS2339: Property 'closeCallback' does not exist on type '{ message: any }'`
- **Fix:** Added `interface ToastSlotProps { message: ToastMessageOptions; closeCallback: () => void }` in the component script, cast `slotProps` via `(slotProps as ToastSlotProps)`
- **Files modified:** `src/platform/moshpit/components/MoshpitUndoToast.vue`
- **Commit:** b8deb0031

**2. [Rule 1 - Bug] Duplicate `hideMany` key in RED test mock caused TS1117**

- **Found during:** Task 2 RED commit (typecheck hook)
- **Issue:** `hideMany` was listed twice in the `vi.mock` object literal — TypeScript TS1117 "An object literal cannot have multiple properties with the same name"
- **Fix:** Removed the duplicate `hideMany: hideManySpy` entry
- **Files modified:** `src/platform/moshpit/components/MoshpitFloatingActionBar.test.ts`
- **Committed inline as part of RED commit** (commit landed, fix applied before GREEN)

## Known Stubs

None — all implemented button wiring is fully functional:

- Favourite/Hide/Export call live `useMoshpitCuration` verbs
- Tag/Folder emit with the current selection for Plan 05 to wire
- `resolveFullResUrl` is undefined by default (by design — Plan 06 wires it); exportMany logs `console.warn` and returns without error

## Toast Mount Location Note

**For future maintainers:** The `<MoshpitUndoToast />` in `MoshpitLayout.vue` appears outside the `<div class="relative flex-1">` container. This is intentional — PrimeVue teleports the rendered toast to the document body via a global portal. The mount location in the Vue component tree affects only where the Vue instance lives, not where the toast appears visually. `position="bottom-center"` on the `<Toast>` component controls the visual placement.

**Exactly one mount:** `MoshpitUndoToast` must be mounted exactly once per threat model T-06-04-02. It lives in `MoshpitLayout` which is the one root component for the Moshpit route. Do not add a second mount in child components.

## Threat Coverage

| Threat ID  | Mitigation                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------- |
| T-06-04-01 | `{{ }}` mustache in #message slot escapes HTML; no `v-html` used                                    |
| T-06-04-02 | Single mount in MoshpitLayout enforced; test asserts the Toast stub renders with correct group      |
| T-06-04-03 | `isVisible` computed gates entire bar on `!tournamentStore.isActive` — all 5 new buttons inherit it |

## Self-Check: PASSED

- FOUND: src/platform/moshpit/components/MoshpitUndoToast.vue
- FOUND: src/platform/moshpit/components/MoshpitUndoToast.test.ts
- FOUND: src/platform/moshpit/components/MoshpitUndoToast.stories.ts
- FOUND: `group="moshpit-curation"` in MoshpitUndoToast.vue
- FOUND: `position="bottom-center"` in MoshpitUndoToast.vue
- FOUND: `data-testid="moshpit-undo-toast-root"` in MoshpitUndoToast.vue
- FOUND: `data-testid="moshpit-undo-toast-button"` in MoshpitUndoToast.vue
- FOUND: `import MoshpitUndoToast` in MoshpitLayout.vue
- FOUND: `<MoshpitUndoToast` in MoshpitLayout.vue
- FOUND: `data-testid="moshpit-action-bar-favourite"` in MoshpitFloatingActionBar.vue
- FOUND: `data-testid="moshpit-action-bar-tag"` in MoshpitFloatingActionBar.vue
- FOUND: `data-testid="moshpit-action-bar-hide"` in MoshpitFloatingActionBar.vue
- FOUND: `data-testid="moshpit-action-bar-folder"` in MoshpitFloatingActionBar.vue
- FOUND: `data-testid="moshpit-action-bar-export"` in MoshpitFloatingActionBar.vue
- FOUND: `open-tag-popover` emit in MoshpitFloatingActionBar.vue
- FOUND: `open-folder-picker` emit in MoshpitFloatingActionBar.vue
- FOUND: `"favourite"` in moshpit.actionBar in main.json
- FOUND: commit acb1a0f64 (Task 1 RED)
- FOUND: commit 67859bf32 (Task 1 GREEN)
- FOUND: commit b8deb0031 (Task 1 typefix)
- FOUND: commit 08860a981 (Task 2 RED)
- FOUND: commit b22afa5aa (Task 2 GREEN)
- 855 moshpit unit tests green
- pnpm typecheck clean
