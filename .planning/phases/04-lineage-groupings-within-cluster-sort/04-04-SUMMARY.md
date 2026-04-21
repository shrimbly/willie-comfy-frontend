---
phase: 04-lineage-groupings-within-cluster-sort
plan: 04
subsystem: moshpit
tags: [settings-panel, vue-component, tailwind-4, reka-collapsible, tdd, i18n, tier-filtering, save-node]

requires:
  - phase: 04-lineage-groupings-within-cluster-sort
    plan: 03
    provides: moshpitFilterStore grouping surface (activeGroupings / withinClusterSort / isAdvancedOpen + mutators), PRIMARY_FILTER_PARAMS / ADVANCED_FILTER_PARAMS tier constants, ParamKey widened with saveNode
  - phase: 04-lineage-groupings-within-cluster-sort
    plan: 02
    provides: NormalizedParams.saveNodeIdentity materialised in schema + IDB (v2→v3 migration)
  - phase: 04-lineage-groupings-within-cluster-sort
    plan: 01
    provides: GROUPING_AXES / WITHIN_CLUSTER_SORT_MODES constants
provides:
  - MoshpitGroupingToggles.vue — 5-pill role=group toggle row for activeGroupings (D-18 / GROUP-01)
  - MoshpitWithinClusterSort.vue — native select bound to withinClusterSort (CSORT-01 / D-07)
  - MoshpitAdvancedFilters.vue — controlled Reka Collapsible wrapping advanced-tier chip row (D-12 / FILTER-12)
  - MoshpitFilterChipRow tier prop (primary | advanced; default primary) with tier-aware chipCount live-region
  - MoshpitAddFilterPopover Primary / Advanced section split + saveNode categorical entry
  - useMoshpitParamValueOptions.saveNode case (reads NormalizedParams.saveNodeIdentity, null-identity excluded)
  - i18n: moshpit.grouping.* (axis, withinSort, otherLabel, spacingLabel, sectionLabel), moshpit.filters.primaryLabel / advancedLabel / paramSaveNode
affects: [04-05 cluster overlay (no direct API overlap), 04-06 MoshpitSettingsPanel wiring + legacy chrome removal]

tech-stack:
  added: []
  patterns:
    - Tier-filtered chip list via defineProps destructuring with default (`const { tier = 'primary' } = defineProps<{ tier?: 'primary' | 'advanced' }>()`) + `computed(() => filterStore.chips.filter((c) => TIER_PARAMS.includes(c.param)))`
    - Two-section popover picker using `filteredParams.filter(PRIMARY)` / `filteredParams.filter(ADVANCED)` computeds — fuse.js search still runs on the full PARAM_ENTRIES list so each section's visible count narrows together
    - Reka Collapsible controlled pattern (Pitfall 5 guard): `:open="filterStore.isAdvancedOpen"` + `@update:open="filterStore.setAdvancedOpen"` — both directions wired, no uncontrolled drift
    - Storybook Pinia seeding via `beforeEach` hooks that call `setActivePinia(createPinia())` then mutate the store before render

key-files:
  created:
    - src/platform/moshpit/components/MoshpitGroupingToggles.vue
    - src/platform/moshpit/components/MoshpitGroupingToggles.test.ts
    - src/platform/moshpit/components/MoshpitGroupingToggles.stories.ts
    - src/platform/moshpit/components/MoshpitWithinClusterSort.vue
    - src/platform/moshpit/components/MoshpitWithinClusterSort.test.ts
    - src/platform/moshpit/components/MoshpitWithinClusterSort.stories.ts
    - src/platform/moshpit/components/MoshpitAdvancedFilters.vue
    - src/platform/moshpit/components/MoshpitAdvancedFilters.test.ts
    - src/platform/moshpit/components/MoshpitAdvancedFilters.stories.ts
  modified:
    - src/platform/moshpit/components/MoshpitFilterChipRow.vue (tier prop + tierChips filter + conditional popover mount)
    - src/platform/moshpit/components/MoshpitFilterChipRow.test.ts (retargeted advanced-param cases to tier='advanced'; 5 new tier-behaviour tests)
    - src/platform/moshpit/components/MoshpitAddFilterPopover.vue (saveNode entry, Primary/Advanced section split with headers)
    - src/platform/moshpit/components/MoshpitAddFilterPopover.test.ts (4 new tests for section headers + saveNode flow)
    - src/platform/moshpit/composables/useMoshpitParamValueOptions.ts (saveNode case derived from params.saveNodeIdentity)
    - src/platform/moshpit/composables/useMoshpitParamValueOptions.test.ts (1 new saveNode test)
    - src/locales/en/main.json (moshpit.grouping.* block + moshpit.filters.{primaryLabel,advancedLabel,paramSaveNode})

key-decisions:
  - "MoshpitFilterChipRow uses Vue 3.5 destructured-props-with-default rather than a separate Props interface, matching CLAUDE.md guidance and the project's existing chip row style. Default is 'primary' so all legacy call sites (zero in Plan 03's codebase since Plan 03 already deleted the only consumer) continue to behave identically."
  - "MoshpitWithinClusterSort uses a native <select> rather than Reka Select — Reka Select in happy-dom requires virtual-listbox plumbing that duplicates `<option>` discoverability. Native select gives free keyboard (Space/Enter/Arrow), screen-reader, and focus management, and the design token surface reduces to two semantic classes (border + bg). The one narrow type cast `as WithinClusterSortMode` on the event target value is constrained by the DOM-enumerated option values — not a safety hole."
  - "MoshpitAdvancedFilters uses a Reka Collapsible controlled binding with `:open` + `@update:open` against the store (Pitfall 5). The trigger is `<CollapsibleTrigger as-child>` wrapping a native <button> so Reka stamps aria-expanded without us redeclaring semantics. Chevron class flips off the scoped `open` slot prop."
  - "saveNode option list is derived from metaStore.paramsByHash.saveNodeIdentity (populated by Plan 02's v2→v3 migration). Null identities are excluded — categorical editor never shows an empty-string entry. No new editor component needed; MoshpitCategoricalFilterEditor routes via its existing `param` prop."
  - "Popover sections use per-section `<ul>`s with independent max-height scroll regions (140px each, vs old single 280px). Fuse.js search filters the flat PARAM_ENTRIES first, then each section recomputes from the filtered list — typing 'cfg' leaves the Primary section empty (auto-hidden by `v-if="primaryEntries.length > 0"`) and shows only the matching Advanced entry. Empty sections hide cleanly."

patterns-established:
  - "Tier-aware filter components: Tier constants (PRIMARY_FILTER_PARAMS / ADVANCED_FILTER_PARAMS) exported from filterTypes.ts are the single routing source for both the chip row's `tierChips` computed and the popover's `primaryEntries` / `advancedEntries` computeds. Adding a new ParamKey requires adding it to one of the two tier arrays — compile-time exhaustive never guards in filterMath.ts force the author to touch the filter side too."
  - "Popover section-header + empty-section-hide pattern ready for Plan 05/06 if additional groupings (e.g. saved filter presets) ever need to appear in the picker."
  - "Storybook stories for Pinia-bound components seed the store in `beforeEach` rather than per-story `render` decorators — cleaner than inline, and matches the pattern Plan 06 will use for MoshpitSettingsPanel stories."

requirements-completed:
  - GROUP-01
  - CSORT-01
  - FILTER-12

duration: ~29min
completed: 2026-04-21
---

# Phase 04 Plan 04: Settings-Panel UI Building Blocks Summary

**Shipped the three new Settings-panel components — grouping pills, within-cluster sort dropdown, and advanced-filters Collapsible — plus the tier-aware chip row + Primary/Advanced popover split with a saveNode entry. Plan 06 can now wire these into `MoshpitSettingsPanel.vue` and retire the legacy sort chrome with zero code overlap.**

## Performance

- **Started:** 2026-04-21T17:30:21Z
- **Completed:** 2026-04-21T17:59:42Z
- **Duration:** ~29 min
- **Tasks:** 4 (TDD red → green for Task 1; Tasks 2–4 test-first single commits)
- **Files created:** 9 (3 SFCs + 3 tests + 3 stories)
- **Files modified:** 7 (2 component extensions + 2 test extensions + 1 composable + 1 composable test + 1 i18n)

## Accomplishments

### Task 1 — MoshpitGroupingToggles + i18n (commit `b5b6b08bb`)

- 5 pill buttons in GROUPING_AXES declaration order (workflow / saveNode / prompt / model / type). Active pill uses `bg-node-component-primary`; inactive uses `border border-(--interface-stroke)`.
- `role="group"` container with aria-labelled section label; native `<button type="button">` per pill with `aria-pressed` mirroring `filterStore.activeGroupings.includes(axis)`.
- 8 Vitest assertions (render count, order, aria-pressed initial + after toggle, click + keyboard activation, full-active render).
- 3 Storybook stories (Default, WithOneActive, AllActive).
- i18n: new `moshpit.grouping.*` block (sectionLabel, axis.{workflow,saveNode,prompt,model,type}, withinSort.{label,newestFirst,oldestFirst,alphabetical}, otherLabel, spacingLabel) plus `moshpit.filters.primaryLabel / advancedLabel / paramSaveNode`.

### Task 2 — MoshpitWithinClusterSort (commit `a3a406e86`)

- Native `<select>` with three `<option>` entries (`newestFirst` / `oldestFirst` / `alphabetical`), bound to `filterStore.withinClusterSort` via `:value`, mutated via `@change → setWithinClusterSort(target.value as WithinClusterSortMode)`.
- Label `<label :for="selectId">` associated with the select via `useId()`.
- 6 Vitest assertions (label, option count, option labels, default selection, change → spy, label-for association).
- 3 Storybook stories (NewestFirst, OldestFirst, Alphabetical).

### Task 3 — MoshpitAdvancedFilters (commit `d10d003a9`)

- Reka Collapsible controlled-mode: `:open="filterStore.isAdvancedOpen"` + `@update:open="filterStore.setAdvancedOpen"`.
- Trigger: full-width `<button>` with chevron (`icon-[lucide--chevron-down]` closed, `icon-[lucide--chevron-up]` open — gate on the Reka slot `open` prop).
- Content slot renders `<MoshpitFilterChipRow tier="advanced" />` so the advanced chip row is gated behind the disclosure.
- 6 Vitest assertions (trigger label, closed-by-default no-content render, open renders chip row with data-tier="advanced", click invokes setAdvancedOpen, chevron swap open/closed).
- 3 Storybook stories (Closed, Open, OpenWithChips).

### Task 4 — tier-aware chip row + popover split + saveNode (commit `4732a18e7`)

- **MoshpitFilterChipRow**: adds `tier?: 'primary' | 'advanced'` prop (default `'primary'`). `tierParams` computed picks PRIMARY_FILTER_PARAMS vs ADVANCED_FILTER_PARAMS, `tierChips` computed filters `filterStore.chips` accordingly. `<MoshpitAddFilterPopover v-if="tier === 'primary'" />` — advanced tier never renders the add-popover (filters are added from the primary row). chipCount live-region reads from `tierChips.length`.
- **MoshpitAddFilterPopover**: PARAM_ENTRIES grew one row (`saveNode` / categorical). Single `<ul>` replaced by two sections with labelled headers (`moshpit.filters.primaryLabel` / `moshpit.filters.advancedLabel`) and independent 140px scroll regions. `primaryEntries` / `advancedEntries` computeds filter from `filteredParams` (itself fuse-filtered by `paramSearch`), so empty sections cleanly vanish via `v-if=".length > 0"`.
- **useMoshpitParamValueOptions**: new `case 'saveNode'` derives counts from `params.saveNodeIdentity`; null identities are excluded (no empty-string option).
- Tests: 5 new tier-behaviour cases in MoshpitFilterChipRow (defaults to primary, tier='primary' renders primary chips + popover, tier='advanced' renders advanced chips and no popover, chipCount per tier); 4 new cases in MoshpitAddFilterPopover (section headers render, saveNode entry present, saveNode → categorical editor, saveNode apply invokes addChip with param='saveNode'); 1 new case in useMoshpitParamValueOptions (saveNode counts, null-identity exclusion, sort order).
- Existing MoshpitFilterChipRow test cases that used advanced-tier params (cfg / sampler / steps / resolution) were retargeted to mount with `tier="advanced"` so their chips still render — test assertions untouched. Net: 13 existing + 5 new = 18 tests green.

## Task Commits

1. **Task 1 — MoshpitGroupingToggles + i18n** — `b5b6b08bb` (feat)
2. **Task 2 — MoshpitWithinClusterSort dropdown** — `a3a406e86` (feat)
3. **Task 3 — MoshpitAdvancedFilters Collapsible wrapper** — `d10d003a9` (feat)
4. **Task 4 — tier-aware chip row + popover split + saveNode** — `4732a18e7` (feat)

## Final Prop Surface — MoshpitFilterChipRow

```ts
defineProps<{
  tier?: 'primary' | 'advanced' // default 'primary'
}>()
```

`tier` is the only addition. No `emit` changes; the store remains the source of truth for chips, the row never emits.

## saveNode wiring in useMoshpitParamValueOptions

**Yes — extended.** Added a `case 'saveNode'` to the existing switch in `useMoshpitParamValueOptions`:

```ts
case 'saveNode': {
  const identity = params.saveNodeIdentity
  if (identity) counts.set(identity, (counts.get(identity) ?? 0) + 1)
  break
}
```

- **Shape:** Minimal — reuses the existing counts/options pipeline, no new return value.
- **Null handling:** Null identity values are excluded from the option list (categorical editor never offers an empty entry). Assets with `saveNodeIdentity: null` still flow through the saveNode grouping axis as `(other)` per Plan 01's `bucketKey` behaviour.
- **Test file extended:** Yes — 1 new `it(...)` covering two identities (count 2 + count 1), null exclusion, descending-count sort order.

## Reused Editors vs New Editors

**None created.** The saveNode entry routes to the existing `MoshpitCategoricalFilterEditor` via the popover's `editorFor('categorical')` switch — the editor already accepts `param: ParamKey` and delegates option fetching to `useMoshpitParamValueOptions`. No new editor component was needed.

## Deviations from D-18 Styling

**None substantive.** The pill styling matches D-18 (active = `bg-node-component-primary`, inactive = `border border-(--interface-stroke)`). One minor structural choice: the pill row is wrapped in an outer `flex flex-col gap-1` with a small uppercase section-label span above the pills (matching MoshpitTimeRangePicker's existing precedent). The section label doubles as the `role="group"` container's `aria-label`, which is rendered visibly so sighted users see the same cue as screen-reader users — a small accessibility win over a pure `aria-label`-only approach.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed `document.activeElement` assertion from keyboard-activation test**

- **Found during:** Task 1 commit — husky pre-commit ESLint run
- **Issue:** `expect(document.activeElement).toBe(pill)` tripped `testing-library/no-node-access` (bans direct Node queries in favour of testing-library helpers).
- **Fix:** Dropped the assertion — `pill.focus()` followed by `await user.keyboard('{Enter}')` still exercises the behavioural path (keyboard activation toggles the store), and the store assertion proves the keystroke reached the focused element. No behavioural loss.
- **Files modified:** `src/platform/moshpit/components/MoshpitGroupingToggles.test.ts`
- **Verification:** 8/8 Task 1 tests green; ESLint clean.
- **Committed in:** `b5b6b08bb` (Task 1)

**2. [Rule 3 - Blocking] Replaced `container.querySelector` chevron checks with `trigger.innerHTML` contains**

- **Found during:** Task 3 commit — husky pre-commit ESLint run
- **Issue:** `container.querySelector('.icon-\\[lucide--chevron-up\\]')` tripped `testing-library/no-container` and `testing-library/no-node-access`. There is no accessible-name selector for the icon (it's `aria-hidden`), and Reka's slot scope is the only way to read the open state.
- **Fix:** Use `screen.getByTestId('moshpit-advanced-filters-trigger').innerHTML.toContain('icon-[lucide--chevron-{up|down}]')`. The trigger element is a first-class testing-library target (has data-testid), and checking its serialised HTML for the icon class is a black-box assertion rather than a Node traversal.
- **Files modified:** `src/platform/moshpit/components/MoshpitAdvancedFilters.test.ts`
- **Verification:** 6/6 Task 3 tests green; ESLint clean.
- **Committed in:** `d10d003a9` (Task 3)

**3. [Rule 1 - Bug] Retargeted existing MoshpitFilterChipRow tests to tier='advanced' where their chips were advanced-tier**

- **Found during:** Task 4 initial test run — 7 existing assertions broke because default `tier='primary'` filters out cfg/sampler/steps/resolution chips.
- **Issue:** The existing tests predated the tier prop and added chips from both tiers to exercise the `chipValueSummary` switch cases. Default-primary filtering dropped every chip they asserted against.
- **Fix:** Added `mountChipRow({ tier: 'advanced' })` to the 7 test cases whose chip params are advanced-tier (cfg, sampler, steps, resolution). Left primary-tier cases (positivePrompt, favourite) unchanged. Also swapped the multi-tier "renders one chip per entry" test to assert that default-primary mounts render only the positivePrompt chip (1 of 3), which is the new expected behaviour.
- **Files modified:** `src/platform/moshpit/components/MoshpitFilterChipRow.test.ts`
- **Verification:** 18/18 tests green (13 existing + 5 new).
- **Committed in:** `4732a18e7` (Task 4)

**No architectural (Rule 4) deviations required.**

**Total deviations:** 3 auto-fixed (2 Rule 3 lint-blocking, 1 Rule 1 test-setup bug surfaced by the tier-prop addition).

## Issues Encountered

- **Husky pre-commit cycle ~90s:** The full `pnpm typecheck` + lint chain runs on every commit. No way around it on this branch without `--no-verify` (forbidden). Task commits were staggered via background-commit pattern to keep the executor responsive.
- **testing-library strictness on direct DOM access:** ESLint plugin bans both `container.querySelector` and `document.activeElement`, forcing `data-testid` or accessible-name selectors. Not blocking, just worth noting for Plan 05/06 component tests.
- **No test infrastructure issues:** Vitest + happy-dom + Pinia + vue-i18n + Reka Collapsible + @testing-library/user-event all co-operate cleanly. Reka Collapsible in happy-dom does render content conditionally (closed → content element absent, open → present), which is exactly what Task 3's tests depend on.

## Threat Flags

None. This plan introduced no new network endpoints, no new auth paths, no new storage. All rendered text flows through `{{ t(...) }}` interpolation (Vue auto-escaped); no `v-html` added. Reka Collapsible controlled mode is correctly bidirectional (`:open` + `@update:open`). Popover param list is bounded at 13 entries (5 primary + 8 advanced) — fuse.js on a 13-item list is O(n) per keystroke and not a DoS surface.

## Forward Readiness

- **Plan 04-05 (cluster overlay):** No file overlap with Plan 04 outputs. The overlay reads `clusterTree` from `useMoshpitFilteredAssets` (Plan 03) and renders independently of the Settings panel.
- **Plan 04-06 (MoshpitSettingsPanel wiring + legacy chrome removal):** Components are ready to import. The panel should:
  1. Import and mount `MoshpitGroupingToggles`, `MoshpitWithinClusterSort`, `MoshpitFilterChipRow` (defaults to primary tier — renders the primary chip row + Add Filter popover), and `MoshpitAdvancedFilters` (which itself renders the advanced chip row inside a Reka Collapsible).
  2. Remove the legacy `moshpit.sort.*` i18n keys (Plan 06 Task 3 scope — this plan left them in place).
  3. Consider whether the section labels should be merged. The grouping section and the within-cluster sort section both use `text-2xs tracking-wide text-muted-foreground uppercase` labels; Plan 06 may want to group them under a single "Organise" heading.

## Self-Check: PASSED

- `src/platform/moshpit/components/MoshpitGroupingToggles.vue` — FOUND
- `src/platform/moshpit/components/MoshpitGroupingToggles.test.ts` — FOUND
- `src/platform/moshpit/components/MoshpitGroupingToggles.stories.ts` — FOUND
- `src/platform/moshpit/components/MoshpitWithinClusterSort.vue` — FOUND
- `src/platform/moshpit/components/MoshpitWithinClusterSort.test.ts` — FOUND
- `src/platform/moshpit/components/MoshpitWithinClusterSort.stories.ts` — FOUND
- `src/platform/moshpit/components/MoshpitAdvancedFilters.vue` — FOUND
- `src/platform/moshpit/components/MoshpitAdvancedFilters.test.ts` — FOUND
- `src/platform/moshpit/components/MoshpitAdvancedFilters.stories.ts` — FOUND
- `src/platform/moshpit/components/MoshpitFilterChipRow.vue` — modified: `tier` prop + `tierChips` computed + `v-if="tier === 'primary'"` popover mount — VERIFIED via grep
- `src/platform/moshpit/components/MoshpitAddFilterPopover.vue` — modified: saveNode entry + primaryEntries/advancedEntries computeds + section headers — VERIFIED via grep
- `src/platform/moshpit/composables/useMoshpitParamValueOptions.ts` — modified: `case 'saveNode'` — VERIFIED via grep
- `src/locales/en/main.json` — modified: `moshpit.grouping.*` + `moshpit.filters.{primaryLabel,advancedLabel,paramSaveNode}` — VERIFIED; JSON parses cleanly (`node -e "JSON.parse(...)"` exits 0)
- Commit `b5b6b08bb` (Task 1) — FOUND in git log
- Commit `a3a406e86` (Task 2) — FOUND in git log
- Commit `d10d003a9` (Task 3) — FOUND in git log
- Commit `4732a18e7` (Task 4) — FOUND in git log
- All 6 plan-scoped test files green: 59 / 59 passing (8 + 6 + 6 + 18 + 13 + 8)
- No `dark:`, no `:class="[]"`, no `!important`, no `as any` in any new file
- No new `any` type usage; single `as WithinClusterSortMode` narrowing on HTMLSelectElement value is documented in the plan and constrained by the DOM-enumerated option values

---

_Phase: 04-lineage-groupings-within-cluster-sort_
_Completed: 2026-04-21_
