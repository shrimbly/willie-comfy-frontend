---
phase: 06-curation-was-phase-5
plan: 03
subsystem: moshpit/curation-orchestrator
tags: [curation, undo, toast, keybindings, composable, i18n, tdd]
dependency_graph:
  requires:
    - 06-01 (moshpitCurationStore.applyManyOptimistic + moshpitFoldersStore)
    - 06-02 (folder ParamKey context — informational only)
  provides:
    - useMoshpitCuration — single authority for all curation verbs + undo + toast
    - useMoshpitCurationKeybindings — container-scoped S/T/H/E + Cmd-Z dispatcher
    - moshpit.curation.* i18n key block (17 keys)
  affects:
    - src/platform/moshpit/composables/useMoshpitCuration.ts
    - src/platform/moshpit/composables/useMoshpitCuration.test.ts
    - src/platform/moshpit/composables/useMoshpitCurationKeybindings.ts
    - src/platform/moshpit/composables/useMoshpitCurationKeybindings.test.ts
    - src/locales/en/main.json
tech_stack:
  added: []
  patterns:
    - Module-level singleton ref (lastUndoable) shared across all useMoshpitCuration callers — mirrors useToastStore pattern
    - Inverse-capture pattern — prior Map snapshot built BEFORE applyManyOptimistic, stored in closure
    - Captured-element pattern — attachedEl saved in onMounted to survive Vue template-ref teardown in onUnmounted
    - t() from '@/i18n' (not useI18n()) — composable called outside Vue setup in tests
    - TDD RED/GREEN sequence with fake-indexeddb + vi.useFakeTimers for 8s window
key_files:
  created:
    - src/platform/moshpit/composables/useMoshpitCuration.ts
    - src/platform/moshpit/composables/useMoshpitCuration.test.ts
    - src/platform/moshpit/composables/useMoshpitCurationKeybindings.ts
    - src/platform/moshpit/composables/useMoshpitCurationKeybindings.test.ts
  modified:
    - src/locales/en/main.json (moshpit.curation.* block added)
decisions:
  - "t() from '@/i18n' used instead of useI18n() — composable is called from test context outside Vue setup, useI18n() throws 'Must be called at the top of a setup function' outside component lifecycle"
  - 'Tag case preserved as-entered — no lowercasing; Pitfall 6/Assumption A5 resolved: case-sensitivity is keep-as-typed; Plan 04/05 note for consumers'
  - 'Module-level lastUndoable singleton ref — composable-as-singleton so all entry points (action bar, keybindings, context menu) share the single undo slot'
  - 'attachedEl captured at onMounted, not read from containerEl in onUnmounted — Vue clears template refs before onUnmounted fires, making containerEl.value null at teardown time'
  - 'hideMany bulk path always publishes undo (no single-asset exemption) — only favouriteMany has the single-asset-silent rule per CURATE-06'
requirements-completed:
  - CURATE-01
  - CURATE-02
  - CURATE-04
  - CURATE-05
  - CURATE-06
  - CURATE-07
duration: ~25 min
completed: '2026-04-23'
---

# Phase 6 Plan 03: Curation Orchestrator + Keybindings Summary

**useMoshpitCuration composable with inverse-capture undo (8s window), bulk-toast semantics, and container-scoped S/T/H/E + Cmd-Z keybindings dispatcher consuming the shared lastUndoable singleton**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-23T19:18:00Z
- **Completed:** 2026-04-23T19:30:00Z
- **Tasks:** 2
- **Files modified:** 5 (4 created + 1 modified)

## Accomplishments

- `useMoshpitCuration` is the single authority for all curation mutations with inverse-capture undo, bulk-toast emission (`group: 'moshpit-curation'`, `life: 8000`), and per-verb semantics (single-asset favourite silent per CURATE-06; export not undoable per CURATE-05)
- `useMoshpitCurationKeybindings` wires S/T/H/E + Cmd/Ctrl-Z to the orchestrator with three guards: tournament active, editable target (INPUT/TEXTAREA/SELECT/contentEditable), and empty selection
- Full `moshpit.curation.*` i18n block (17 keys) added including `nothingToUndo`, `exporting`, `invalidTag`, and all verb labels with `{count}` interpolation
- 28 unit tests across both composables green; 844 moshpit tests total green

## Task Commits

| Task      | Name                                            | Commit    | Type |
| --------- | ----------------------------------------------- | --------- | ---- |
| 1 (RED)   | Failing tests for useMoshpitCuration            | 525635cdd | test |
| 1 (GREEN) | useMoshpitCuration orchestrator + i18n keys     | f9992adcc | feat |
| 2 (RED)   | Failing tests for useMoshpitCurationKeybindings | c347270c8 | test |
| 2 (GREEN) | useMoshpitCurationKeybindings dispatcher        | b3f0811e8 | feat |

## Orchestrator API Surface

```typescript
// useMoshpitCuration.ts exports:
export const UNDO_WINDOW_MS = 8000
export const TAG_MAX_LENGTH = 64
export const TAGS_PER_ASSET_MAX = 50
export const FOLDER_NAME_MAX_LENGTH = 64

export interface UndoableAction {
  readonly id: string
  readonly label: string
  readonly expiresAt: number
  readonly undo: () => void | Promise<void>
}

export interface MoshpitCurationOptions {
  readonly resolveFullResUrl?: (hash: string) => string | null
}

export function useMoshpitCuration(options?: MoshpitCurationOptions): {
  favouriteMany(hashes: readonly string[], favourite?: boolean): void
  tagMany(hashes: readonly string[], tag: string): void
  untagMany(hashes: readonly string[], tag: string): void
  hideMany(hashes: readonly string[], hidden?: boolean): void
  unhideMany(hashes: readonly string[]): void
  addToFolderMany(hashes: readonly string[], folderId: string): void
  removeFromFolderMany(hashes: readonly string[], folderId: string): void
  exportMany(hashes: readonly string[]): void
  undoLast(): boolean
  lastUndoable: Ref<UndoableAction | null>
}

// useMoshpitCurationKeybindings.ts exports:
export interface MoshpitCurationKeybindingsOptions {
  readonly containerEl: Ref<HTMLElement | null>
  readonly openTagPopover: () => void
}
export function useMoshpitCurationKeybindings(
  options: MoshpitCurationKeybindingsOptions
): void
```

## i18n Keys Added (moshpit.curation.\*)

```
undo, undoHint, nothingToUndo,
favourited, unfavourited,
tagged, untagged,
hidden, unhidden,
addedToFolder, removedFromFolder, folderCreated,
exporting,
invalidTag, invalidFolder,
folderLimitReached, tagLimitReached
```

All use plain `{count}` / `{tag}` / `{folder}` interpolation (not ICU plural) — consistent with `moshpit.contextMenu.downloadStartedMulti` pattern.

## Key Decisions

### Tag Case Sensitivity (Pitfall 6 / Assumption A5)

Resolved: tags are kept as-entered (case preserved). No lowercasing at the orchestrator level. Implication for Plan 04/05: the tag popover and filter chip UI should display tags exactly as stored; case-insensitive deduplication is NOT applied at the store layer.

### Single Undo Slot (Pitfall 1)

`lastUndoable` is a module-level singleton ref — one slot for the most recent undoable action. Two bulk actions in sequence: the second overwrites the first. `undoLast()` only reverses the second. This is intentional and documented.

### favouriteMany Single-Asset Silence (CURATE-06)

Only `favouriteMany` has the single-asset-silent rule. All other verbs (`hideMany`, `tagMany`, etc.) publish undo toasts regardless of count. This is per spec and verified by test.

### Export Not Undoable (CURATE-05)

`exportMany` never touches `lastUndoable`. It fires an info toast (count of downloads started) but the action cannot be reversed.

## Fake-Timer Pattern for 8s Window Tests

```typescript
// In beforeEach:
vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] })

// In test body:
curation.favouriteMany(['h1', 'h2'], true)
vi.advanceTimersByTime(UNDO_WINDOW_MS + 100)
const ok = curation.undoLast()
expect(ok).toBe(false)

// In afterEach:
vi.useRealTimers()
```

Key: `toFake: ['Date', 'setTimeout']` — faking `Date` makes `Date.now()` advance with `advanceTimersByTime`, which is required for the `expiresAt` check in `undoLast`.

## Module-Level Singleton Caveat

`lastUndoable` is module-level and persists across tests. Each test suite `beforeEach` must reset it:

```typescript
function resetUndo(): void {
  const c = useMoshpitCuration()
  if (c.lastUndoable.value) c.undoLast()
}
```

Plan 04 tests that call `useMoshpitCuration` should follow this pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useI18n() replaced with t() from @/i18n**

- **Found during:** Task 1 (GREEN implementation)
- **Issue:** `useI18n()` throws "Must be called at the top of a setup function" when `useMoshpitCuration` is instantiated outside a Vue component setup context (i.e., in Vitest)
- **Fix:** Replaced `useI18n()` with `import { t } from '@/i18n'` — the module-level t function works in all contexts
- **Files modified:** `src/platform/moshpit/composables/useMoshpitCuration.ts`
- **Committed in:** f9992adcc

**2. [Rule 1 - Bug] containerEl captured at onMounted instead of read at onUnmounted**

- **Found during:** Task 2 (GREEN test run) — "listener is removed after unmount" test was failing
- **Issue:** Vue clears template refs (sets them to `null`) before `onUnmounted` fires. Reading `containerEl.value` in `onUnmounted` returned `null`, so `removeEventListener` was never called, and the listener persisted after unmount
- **Fix:** Added `let attachedEl: HTMLElement | null = null` captured at `onMounted` time; `onUnmounted` removes the listener from `attachedEl`
- **Files modified:** `src/platform/moshpit/composables/useMoshpitCurationKeybindings.ts`
- **Committed in:** b3f0811e8

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs found during implementation)
**Impact on plan:** Both fixes essential for correctness. No scope creep.

## Pointers for Downstream Plans

### Plan 04 (Toast mount + action bar)

- Import `useMoshpitCuration` for curation verbs; the `group: 'moshpit-curation'` toast routes to the Plan 04 `<Toast group="moshpit-curation">` mount
- The action bar's favourite/hide/export buttons call `favouriteMany`/`hideMany`/`exportMany` with the current selection
- `lastUndoable` is a reactive ref — the action bar can show an "Undo" button while it's non-null

### Plan 05 (Tag / folder popovers)

- `openTagPopover` is the callback wired to keybinding `T` — Plan 05 provides this implementation
- Popover calls `tagMany(selectedHashes, enteredTag)` / `addToFolderMany(selectedHashes, folderId)`
- Tag case is preserved as-entered; no lowercasing at the store layer

### Plan 06 (MoshpitView wiring)

- `useMoshpitCurationKeybindings` needs `containerEl` pointing at the Moshpit canvas container and `openTagPopover` wired to Plan 05's popover opener
- `exportMany` requires `resolveFullResUrl` option — pass `MoshpitView`'s `resolveFullResUrl` closure when constructing `useMoshpitCuration({ resolveFullResUrl })`

## Known Stubs

None — all verbs are fully wired to `curationStore.applyManyOptimistic`. The `exportMany` resolver is injected at call site (by design — Plan 06 wires it).

## Threat Flags

None — no new network endpoints, auth paths, or external data sources introduced. Input validation (tag/folder length) enforced at orchestrator per T-06-03-01 mitigation.

## Self-Check: PASSED

- FOUND: src/platform/moshpit/composables/useMoshpitCuration.ts
- FOUND: src/platform/moshpit/composables/useMoshpitCuration.test.ts
- FOUND: src/platform/moshpit/composables/useMoshpitCurationKeybindings.ts
- FOUND: src/platform/moshpit/composables/useMoshpitCurationKeybindings.test.ts
- FOUND: commit f9992adcc (Task 1 GREEN)
- FOUND: commit b3f0811e8 (Task 2 GREEN)
- FOUND: `export const UNDO_WINDOW_MS = 8000` in useMoshpitCuration.ts
- FOUND: `group: 'moshpit-curation'` in useMoshpitCuration.ts
- FOUND: `tournamentStore.isActive` in useMoshpitCurationKeybindings.ts
- FOUND: `"curation":` in src/locales/en/main.json
