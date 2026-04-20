---
phase: 03-filter-sort-core-validation
plan: 08
subsystem: moshpit-filter-ui
tags: [moshpit, filter-chip, popover, ui, reka-ui, value-editors]
dependency_graph:
  requires: [03-06, 03-07]
  provides: [MoshpitFilterChipRow, MoshpitAddFilterPopover, useMoshpitParamValueOptions, MoshpitNumericFilterEditor, MoshpitCategoricalFilterEditor, MoshpitTextFilterEditor, MoshpitResolutionFilterEditor, MoshpitBooleanFilterEditor]
  affects: [moshpitFilterStore, moshpitMetadataStore, moshpitCurationStore]
tech_stack:
  added: [reka-ui PopoverRoot/PopoverContent/PopoverTrigger/PopoverPortal, fuse.js for param picker + categorical editor]
  patterns: [defineModel, MaybeRefOrGetter+toValue, module-level pinia isolation pattern, emitted<unknown[]> typing]
key_files:
  created:
    - src/platform/moshpit/composables/useMoshpitParamValueOptions.ts
    - src/platform/moshpit/composables/useMoshpitParamValueOptions.test.ts
    - src/platform/moshpit/components/MoshpitFilterChipRow.vue
    - src/platform/moshpit/components/MoshpitFilterChipRow.test.ts
    - src/platform/moshpit/components/MoshpitAddFilterPopover.vue
    - src/platform/moshpit/components/MoshpitAddFilterPopover.test.ts
    - src/platform/moshpit/components/MoshpitNumericFilterEditor.vue
    - src/platform/moshpit/components/MoshpitNumericFilterEditor.test.ts
    - src/platform/moshpit/components/MoshpitCategoricalFilterEditor.vue
    - src/platform/moshpit/components/MoshpitCategoricalFilterEditor.test.ts
    - src/platform/moshpit/components/MoshpitTextFilterEditor.vue
    - src/platform/moshpit/components/MoshpitTextFilterEditor.test.ts
    - src/platform/moshpit/components/MoshpitResolutionFilterEditor.vue
    - src/platform/moshpit/components/MoshpitResolutionFilterEditor.test.ts
    - src/platform/moshpit/components/MoshpitBooleanFilterEditor.vue
    - src/platform/moshpit/components/MoshpitBooleanFilterEditor.test.ts
  modified: []
decisions:
  - "emitted<unknown[]>() typing pattern required to avoid TS2571 on @testing-library/vue emitted() return type"
  - "Module-level pinia instance (let pinia = createPinia()) shared between setActivePinia and global plugins for tests that seed store state before mount"
  - "role=option on <li> items in param picker enables user.click() via findByRole — avoids fragile text-child targeting"
  - "Editor stubs use inner <span>name-text</span> rather than data-testid to avoid fallthrough attr collision with parent data-testid on <component :is>"
  - "fuse.js used for both param picker search (step 1) and categorical value editor search"
metrics:
  duration: "~4 hours (across 2 sessions)"
  completed: "2026-04-21"
  tasks_completed: 3
  files_created: 16
  tests_passed: 52
---

# Phase 03 Plan 08: Filter Chip Row + Add-Filter Popover + Value Editors Summary

**One-liner:** Reka UI two-step add-filter popover with 5 typed value-editor sub-components wired to moshpitFilterStore via crypto.randomUUID chip IDs.

## What Was Built

### Task 1: useMoshpitParamValueOptions + MoshpitFilterChipRow

`useMoshpitParamValueOptions(paramSource: MaybeRefOrGetter<ParamKey | null>)` derives categorical option lists and resolution pairs from the live asset set (paramsByHash from moshpitMetadataStore, tags from moshpitCurationStore). Returns `{ options: ComputedRef<ValueOption[]>, resolutionPairs: ComputedRef<[number,number][]> }`. Options are sorted descending by occurrence count so most-used values surface first.

`MoshpitFilterChipRow` renders `filterStore.chips` as dismissible chip badges. Each chip shows a parameter label (i18n) and a value summary formatted per ChipValue kind: numeric shows `6–8` or `= 20`; categorical shows `euler +1`; text shows `"masterpiece"`; resolution shows `512×512 +1`; boolean shows `Favourite`. A trailing `+ Add filter` button hosts `<MoshpitAddFilterPopover />`. An `aria-live="polite"` region announces the current chip count.

**Commit:** `84be74d94`

### Task 2: MoshpitAddFilterPopover shell + 5 editor SFCs

`MoshpitAddFilterPopover` is a two-step Reka UI `PopoverRoot`. Step 1 shows a search input (fuse.js) over 12 `PARAM_ENTRIES` (each `<li role="option">`). Params already active in `filterStore.chips` render with `aria-disabled="true"`. Selecting a param transitions to step 2, which renders `<component :is="editorFor(draftEntry.kind)" v-model="draftValue" :param="draftEntry.key" />`. Apply calls `filterStore.addChip({ id: crypto.randomUUID(), param, value: draftValue })`.

Five value editors:
- `MoshpitNumericFilterEditor` — exact toggle; range (min/max) or single exact number input; emits `{ kind: 'numeric', min, max, exact }` or null.
- `MoshpitCategoricalFilterEditor` — fuse.js search over `useMoshpitParamValueOptions` options; checkbox list; emits `{ kind: 'categorical', values }` or null.
- `MoshpitTextFilterEditor` — textarea with substring hint; watcher trims and emits `{ kind: 'text', substring }` or null.
- `MoshpitResolutionFilterEditor` — checkbox list from `resolutionPairs` + custom W×H number inputs with `+` button; emits `{ kind: 'resolution', pairs }` or null.
- `MoshpitBooleanFilterEditor` — single checkbox defaulting checked; immediate watcher emits `{ kind: 'boolean', value }`.

**Commit:** `c215f43d4`

### Task 3: Test suite for 5 value editors

52 tests across 8 test files, all passing. Includes behavioral coverage for: emit shapes per interaction, null-on-empty/clear, fuzzy search narrowing, metadata-store-driven option rendering, custom resolution pair addition, checkbox toggle sequences, and immediate boolean emission on mount.

**Commits:** `0cbdf8fbd`, `3ec1b0a34` (type fix for `emitted<unknown[]>`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing correctness] emitted<unknown[]> typing for vue-tsc**
- **Found during:** Task 3 commit
- **Issue:** `emitted('update:modelValue')` returns `unknown[][]` in `@testing-library/vue`; indexing yields `unknown`, causing TS2571 under `vue-tsc --noEmit`
- **Fix:** Added `<unknown[]>` generic to all `emitted()` calls that index into the result
- **Files modified:** All 5 editor test files
- **Commit:** `3ec1b0a34`

**2. [Rule 1 - Bug] Pinia two-instance isolation bug in store-seeding tests**
- **Found during:** Tasks 1 and 3
- **Issue:** `beforeEach(() => setActivePinia(createPinia()))` then `render(..., { global: { plugins: [createPinia(), i18n] } })` created two separate pinia instances; store mutations seeded before mount were invisible to the component
- **Fix:** Module-level `let pinia = createPinia()` reassigned in `beforeEach`, passed to both `setActivePinia` and `global.plugins`
- **Files modified:** MoshpitFilterChipRow.test.ts, MoshpitCategoricalFilterEditor.test.ts, MoshpitResolutionFilterEditor.test.ts

**3. [Rule 1 - Bug] Param picker click not transitioning to step 2**
- **Found during:** Task 2
- **Issue:** `findByText(label)` returned inner `<span>` child of `<li>`; click was technically on the text node and didn't reliably propagate Vue's `@click` on the `<li>` in happy-dom
- **Fix:** Added `role="option"` to `<li>` items; tests use `findByRole('option', { name: label })` which targets the interactive element directly
- **Files modified:** MoshpitAddFilterPopover.vue, MoshpitAddFilterPopover.test.ts

**4. [Rule 1 - Bug] data-testid collision on dynamic `<component :is>`**
- **Found during:** Task 2 testing
- **Issue:** Parent passes `data-testid="moshpit-add-filter-editor"` as fallthrough attr to `<component :is="editor" />`; stub's own `data-testid` was overwritten by the fallthrough, making `getByTestId('moshpit-numeric-editor')` fail
- **Fix:** Changed editor stubs to render `<span>numeric-editor</span>` inner text; tests assert via `screen.getByText('numeric-editor')` and `screen.findByTestId('moshpit-add-filter-editor')` (the parent attr, which is preserved)
- **Files modified:** MoshpitAddFilterPopover.test.ts

**5. [Rule 2 - Missing validation] ESLint testing-library/prefer-user-event**
- **Found during:** Task 2 commit hook
- **Issue:** `fireEvent.click()` used in MoshpitAddFilterPopover.test.ts; rejected by `testing-library/prefer-user-event` ESLint rule
- **Fix:** Converted all `fireEvent.click()` to `await user.click()` after confirming `role="option"` items work with userEvent
- **Files modified:** MoshpitAddFilterPopover.test.ts
- **Commit:** `0cbdf8fbd` (included in Task 3 commit)

## Known Stubs

None — all editor components emit real ChipValue objects; no placeholder data flows to the UI.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced. All data is local (IndexedDB-backed metadata store, in-memory filter store).

## Self-Check: PASSED

Files created:
- src/platform/moshpit/composables/useMoshpitParamValueOptions.ts — FOUND
- src/platform/moshpit/components/MoshpitFilterChipRow.vue — FOUND
- src/platform/moshpit/components/MoshpitAddFilterPopover.vue — FOUND
- src/platform/moshpit/components/MoshpitNumericFilterEditor.vue — FOUND
- src/platform/moshpit/components/MoshpitCategoricalFilterEditor.vue — FOUND
- src/platform/moshpit/components/MoshpitTextFilterEditor.vue — FOUND
- src/platform/moshpit/components/MoshpitResolutionFilterEditor.vue — FOUND
- src/platform/moshpit/components/MoshpitBooleanFilterEditor.vue — FOUND

Commits:
- 84be74d94 — FOUND
- c215f43d4 — FOUND
- 0cbdf8fbd — FOUND
- 3ec1b0a34 — FOUND

Tests: 52 / 52 passing
