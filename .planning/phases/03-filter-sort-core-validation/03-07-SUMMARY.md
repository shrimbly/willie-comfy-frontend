---
phase: 03-filter-sort-core-validation
plan: '07'
subsystem: moshpit/filter-ui
tags: [moshpit, filter-gate, ui, i18n, reka-ui, composable]
dependency_graph:
  requires:
    - src/platform/moshpit/services/filterTypes.ts (TimePreset, TimeRange, TIME_PRESETS)
    - src/platform/moshpit/services/paramNormalize.ts (NormalizedParams, workflowFilename)
    - src/platform/moshpit/composables/useMoshpitAssetRegistry.ts (AssetEntry list)
    - src/platform/moshpit/stores/moshpitMetadataStore.ts (paramsByHash computed added here)
  provides:
    - src/platform/moshpit/stores/moshpitFilterStore.ts (workflow, timeRange, setWorkflow, setTimeRange stub)
    - src/platform/moshpit/composables/useMoshpitWorkflowOptions.ts (WorkflowOption groupings)
    - src/platform/moshpit/components/MoshpitWorkflowPicker.vue (Reka combobox, ICU labels)
    - src/platform/moshpit/components/MoshpitTimeRangePicker.vue (5 presets + custom date range)
    - src/locales/en/main.json (moshpit.filters.* 40 keys + moshpit.sort.* 12 keys)
  affects:
    - 03-06 (will extend moshpitFilterStore stub with chips, sort, gridSpacing, showHidden)
    - 03-08 (MoshpitFilterChipRow consumes filterStore.chips)
    - 03-09 (MoshpitSortControls consumes filterStore.sortX/sortY)
    - 03-11 (MoshpitSettingsPanel mounts WorkflowPicker + TimeRangePicker at top of panel body)
tech_stack:
  added: []
  patterns:
    - Reka UI ComboboxRoot with ignore-filter + v-model:open for custom trigger button
    - ICU pipe plural via t(key, params, count) — no ad-hoc English literals in templates
    - paramsByHash computed on moshpitMetadataStore: derives NormalizedParams from raw metaByHash
    - workflowFilename ?? 'unnamed-<short fingerprint>' displayName strategy (OQ-3 resolution)
    - Native type="date" inputs for custom range (no PrimeVue DatePicker — per D-09)
    - radiogroup + role="radio" + aria-checked for accessible preset pills
key_files:
  created:
    - src/platform/moshpit/stores/moshpitFilterStore.ts
    - src/platform/moshpit/composables/useMoshpitWorkflowOptions.ts
    - src/platform/moshpit/composables/useMoshpitWorkflowOptions.test.ts
    - src/platform/moshpit/components/MoshpitWorkflowPicker.vue
    - src/platform/moshpit/components/MoshpitWorkflowPicker.test.ts
    - src/platform/moshpit/components/MoshpitTimeRangePicker.vue
    - src/platform/moshpit/components/MoshpitTimeRangePicker.test.ts
  modified:
    - src/locales/en/main.json (added moshpit.filters.* + moshpit.sort.* namespaces)
    - src/platform/moshpit/stores/moshpitMetadataStore.ts (added paramsByHash computed + NormalizedParams import)
decisions:
  - workflowOptionCount i18n key uses {count} (simple interpolation) not {count, number} — vue-i18n pipe-plural format does not support ICU number formatting inside the plural string
  - moshpitFilterStore created as Wave 2 stub (workflow + timeRange only) — Plan 03-06 (Wave 4) extends with chips, sort axes, gridSpacing, showHidden
  - paramsByHash added to moshpitMetadataStore as a computed Map<string, NormalizedParams> — re-parses raw metaByHash on demand; avoids duplicating parse logic in composable
  - ignore-filter on ComboboxRoot + isOpen ref — Reka's built-in filter hides items when ComboboxInput is empty; ignore-filter ensures all options render without needing search input text
metrics:
  duration_minutes: 45
  completed_date: '2026-04-21'
  tasks_completed: 2
  tasks_total: 2
  files_created: 7
  files_modified: 2
---

# Phase 03 Plan 07: Filter Gate UI + i18n Keys

**One-liner:** Reka-driven workflow combobox (ICU-plural labels, workflowFilename displayName) + radiogroup time-range picker + complete Phase 3 i18n namespace (40 filter + 12 sort keys), unblocking Plans 03-08/09/10/11.

## What Was Built

### i18n Keys (Task 1)

Added two new namespaces under `moshpit` in `src/locales/en/main.json`:

- **`moshpit.filters`** — 40 keys covering workflow picker, time range presets, custom date range, filter chip labels, param display names, chip editor labels, and empty state copy
- **`moshpit.sort`** — 12 keys covering sort section label, X/Y axis labels, placeholders, clear axis, announcements for screen readers, grid spacing label/value/tooltip, show-hidden toggle

All downstream Wave 3 plans (03-08 through 03-11) can now import these keys without waiting.

### moshpitFilterStore stub (Task 1)

Created `moshpitFilterStore.ts` with `workflow`, `timeRange`, `isGated`, `setWorkflow`, `setTimeRange`, and `reset`. This is the minimal surface needed by Wave 2 components. Plan 03-06 (Wave 4) will extend this stub with `chips`, `sortX`, `sortY`, `gridSpacing`, `showHidden`, `addChip`, `removeChip`, `updateChip`, and all sort/spacing actions.

### paramsByHash on moshpitMetadataStore (Task 1 — deviation)

Added `paramsByHash: ComputedRef<ReadonlyMap<string, NormalizedParams>>` to `moshpitMetadataStore`. This derived computed re-parses all raw `metaByHash` entries via `normalizeParams` on demand, giving filter/sort composables direct access to typed params without storing the parsed form separately. Reactive: any `setMetadata` mutation triggers recompute.

### useMoshpitWorkflowOptions composable (Task 1)

Groups the asset registry by `workflowFingerprint`, collects per-group counts and a representative `workflowFilename` (first non-null wins within a fingerprint group), and sorts by count descending then displayName ascending.

**OQ-3 resolution:** `displayName = workflowFilename ?? 'unnamed-' + fingerprint.slice(0, 12) + '…'`

### MoshpitWorkflowPicker (Task 2)

Reka `ComboboxRoot` with `ignore-filter` (so options render without requiring search text) and `v-model:open` wired to a local `isOpen` ref toggled by the trigger button's `@click`. Item labels use **only** the ICU plural key `moshpit.filters.workflowOptionCount` — zero ad-hoc English string literals in the template.

Trigger displays `selectedDisplayName` (looked up from the options list by fingerprint), not the raw pipe-joined fingerprint string. Placeholder renders when `filterStore.workflow === null`.

### MoshpitTimeRangePicker (Task 3)

Five preset pills rendered as `role="radiogroup"` / `role="radio"` buttons iterating `TIME_PRESETS`. Active pill uses `bg-secondary-background-selected`; inactive uses `bg-secondary-background hover:bg-secondary-background-hover`. Custom date range section (`v-if="preset === 'custom'"`) renders two native `type="date"` inputs with `isoDateToEpoch` null-guarding invalid strings (T-03-07-01 mitigation).

## OQ-3 Closure

Open Question 3 is fully resolved:

- `workflowFilename` derived by `extractWorkflowFilename(sourceFilename)` in `paramNormalize.ts` (Plan 03-01)
- `paramsByHash` on `moshpitMetadataStore` exposes the parsed value per contentHash
- `useMoshpitWorkflowOptions` reads `params.workflowFilename` and falls back to `'unnamed-' + fingerprint.slice(0, 12) + '…'`
- `MoshpitWorkflowPicker` trigger renders the `displayName`, not the raw fingerprint

## Blocker-1 Closure

The ICU plural is the exclusive path for option label rendering:

- `t('moshpit.filters.workflowOptionCount', { name: opt.displayName, count: opt.count }, opt.count)`
- `grep -E "'assets?'" src/.../MoshpitWorkflowPicker.vue` → 0 matches
- Exactly 1 call to `moshpit.filters.workflowOptionCount` in the SFC

## Integration Note for Plan 03-11

`MoshpitSettingsPanel` should mount `MoshpitWorkflowPicker` and `MoshpitTimeRangePicker` at the top of the panel body (above the filter chip rail and sort section), unconditionally visible. Both components are entirely store-driven — no props required.

```vue
<MoshpitWorkflowPicker />
<MoshpitTimeRangePicker />
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] paramsByHash not present on moshpitMetadataStore**

- **Found during:** Task 1 — composable needed `metaStore.paramsByHash.get(hash)`
- **Issue:** Plan specified `metaStore.paramsByHash` but moshpitMetadataStore only stored raw `Record<string, string>` in `metaByHash`, with no parsed NormalizedParams map
- **Fix:** Added `paramsByHash: ComputedRef<ReadonlyMap<string, NormalizedParams>>` as a computed on the store, derived from `metaByHash` via `normalizeParams`
- **Files modified:** `src/platform/moshpit/stores/moshpitMetadataStore.ts`
- **Commit:** `06be455ee`

**2. [Rule 2 - Missing functionality] moshpitFilterStore did not exist for Wave 2 components**

- **Found during:** Task 2 — SFCs need `filterStore.setWorkflow` / `filterStore.setTimeRange`
- **Issue:** moshpitFilterStore is planned for Wave 4 (Plan 03-06); this Wave 2 plan needs the interface
- **Fix:** Created minimal stub `moshpitFilterStore.ts` with `workflow`, `timeRange`, `isGated`, `setWorkflow`, `setTimeRange`, `reset`. Plan 03-06 will extend.
- **Files modified:** `src/platform/moshpit/stores/moshpitFilterStore.ts` (created)
- **Commit:** `06be455ee`

**3. [Rule 1 - Bug] workflowOptionCount i18n key used `{count, number}` ICU format incompatible with vue-i18n pipe plural**

- **Found during:** Task 2 test run — vue-i18n message compiler threw "Unterminated closing brace" on `{count, number}` inside parentheses
- **Issue:** `{count, number}` is ICU message format; vue-i18n pipe-plural uses simple `{count}` interpolation
- **Fix:** Changed key value from `"{name} ({count, number} asset) | {name} ({count, number} assets)"` to `"{name} ({count} asset) | {name} ({count} assets)"`
- **Files modified:** `src/locales/en/main.json`
- **Commit:** `32ea9e2ff`

**4. [Rule 1 - Bug] Reka ComboboxRoot without ignore-filter hides all items when search input is empty**

- **Found during:** Task 2 test run — `findByText('cfg_sweep (1 asset)')` timed out after combobox opened
- **Issue:** Reka's default filter behavior removes all items when `ComboboxInput` value is empty string (no search text)
- **Fix:** Added `ignore-filter` prop to `ComboboxRoot`; custom filtering via `ComboboxInput` text still works visually but Reka doesn't hide items pre-emptively
- **Files modified:** `src/platform/moshpit/components/MoshpitWorkflowPicker.vue`
- **Commit:** `32ea9e2ff`

## Known Stubs

- `moshpitFilterStore.ts` is a stub — exposes only `workflow`, `timeRange`, `setWorkflow`, `setTimeRange`, `isGated`, `reset`. Plan 03-06 will add `chips`, `sortX`, `sortY`, `gridSpacing`, `showHidden` and all chip actions. This stub is intentional and does not block this plan's goal (FILTER-01 gate UI + FILTER-06 time range UI).

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or trust boundary crossings introduced. All rendering via Vue text interpolation (T-03-07-02: XSS auto-escaped). Date string parsed with `Number.isFinite` guard (T-03-07-01: NaN epoch → null).

## Self-Check: PASSED

- [x] `src/locales/en/main.json` — FOUND (40 filter + 12 sort keys)
- [x] `src/platform/moshpit/composables/useMoshpitWorkflowOptions.ts` — FOUND
- [x] `src/platform/moshpit/composables/useMoshpitWorkflowOptions.test.ts` — FOUND (7 tests)
- [x] `src/platform/moshpit/stores/moshpitFilterStore.ts` — FOUND
- [x] `src/platform/moshpit/components/MoshpitWorkflowPicker.vue` — FOUND
- [x] `src/platform/moshpit/components/MoshpitWorkflowPicker.test.ts` — FOUND (5 tests)
- [x] `src/platform/moshpit/components/MoshpitTimeRangePicker.vue` — FOUND
- [x] `src/platform/moshpit/components/MoshpitTimeRangePicker.test.ts` — FOUND (7 tests)
- [x] Commit `06be455ee` — FOUND (Task 1)
- [x] Commit `32ea9e2ff` — FOUND (Task 2)
- [x] 19 tests pass (7 composable + 7 TimeRangePicker + 5 WorkflowPicker)
- [x] ESLint 0 errors on both SFCs
- [x] No `any` / `as any` in any new file
- [x] No `dark:` variants in any new file
- [x] No `:class="[]"` in any new file
- [x] No `primevue` imports in any new file
- [x] `moshpit.filters.workflowOptionCount` appears exactly 1 time in WorkflowPicker SFC
- [x] No `'asset'` or `'assets'` string literals in WorkflowPicker SFC
