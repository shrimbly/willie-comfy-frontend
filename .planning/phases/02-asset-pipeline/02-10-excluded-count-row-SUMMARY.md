---
phase: 02-asset-pipeline
plan: 10
subsystem: moshpit-settings-panel
tags: [ui, settings-panel, excluded-count, wave-4, a11y]
dependency_graph:
  requires: [02-07]
  provides: [ASSET-05-surface, ASSET-06]
  affects: [MoshpitSettingsPanel.vue]
tech_stack:
  added: []
  patterns: [v-tooltip directive, useId composable, pinia store subscription]
key_files:
  created:
    - src/platform/moshpit/components/MoshpitSettingsPanel.test.ts
  modified:
    - src/platform/moshpit/components/MoshpitSettingsPanel.vue
decisions:
  - v-tooltip is globally registered via PrimeVue; no new import required (grep confirmed 5+ existing usages in sidebar components)
  - useId() (Vue 3.5) used for stable SSR-safe excludedDescId instead of manual ID generation
  - computed() wrapper used for excludedCount to maintain reactivity contract with test pinia
metrics:
  duration: 8m
  completed: 2026-04-20T17:09:30Z
  tasks: 1
  files: 2
---

# Phase 02 Plan 10: Excluded-Count Row Summary

**One-liner:** Reactive excluded-count row in MoshpitSettingsPanel with v-tooltip.top info icon, aria-describedby linkage, and 4-case Vitest coverage.

## What Was Built

Added the ASSET-06 user-visible signal to `MoshpitSettingsPanel.vue`: a `v-if="excludedCount > 0"` row showing `"{N} asset(s) excluded: no metadata"` with a `lucide--info` icon that triggers a `v-tooltip.top` tooltip on hover. The row is bound to `moshpitMetadataStore.excludedCount` via a computed ref.

## Tasks Completed

| Task | Name                                     | Commit    | Files                                                  |
| ---- | ---------------------------------------- | --------- | ------------------------------------------------------ |
| 1    | Add excluded-count row + component tests | 927e84e96 | MoshpitSettingsPanel.vue, MoshpitSettingsPanel.test.ts |

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written. The i18n keys (`moshpit.assets.*`) were already present in `src/locales/en/main.json` from prior Plan 09 execution, so no deviation was needed.

## v-tooltip Registration Evidence

`grep -rn "v-tooltip" src/components/sidebar` confirmed global directive usage without import in 5+ sidebar components:

- `src/components/sidebar/tabs/BaseWorkflowsSidebarTab.vue:13: v-tooltip.bottom`
- `src/components/sidebar/tabs/modelLibrary/DownloadItem.vue:32: v-tooltip.top`
- `src/components/sidebar/tabs/ModelLibrarySidebarTab.vue:5: v-tooltip.bottom`

The directive is globally registered via PrimeVue. No `import Tooltip from 'primevue/tooltip'` was needed in `MoshpitSettingsPanel.vue`. Test stubs it with a no-op `mounted` handler.

## Known Stubs

None — the excluded-count row is fully wired to `moshpitMetadataStore.excludedCount` (a real store ref, not hardcoded).

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- [x] `src/platform/moshpit/components/MoshpitSettingsPanel.vue` exists with excluded-count row
- [x] `src/platform/moshpit/components/MoshpitSettingsPanel.test.ts` exists with 4 tests
- [x] Commit 927e84e96 exists
- [x] 4/4 tests GREEN
- [x] No dark: usage
- [x] Phase 3 mount-point comment present
