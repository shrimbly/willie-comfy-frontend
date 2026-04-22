---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 05-06-PLAN.md (Phase 05 shipped, HUMAN-UAT approved)
last_updated: '2026-04-22T16:43:28.873Z'
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 41
  completed_plans: 41
  percent: 100
---

# Project State

**Last updated:** 2026-04-23

## Project Reference

**Project:** Moshpit (ComfyUI Autocanvas)
**Core Value:** Prove that a lineage-grouped spatial canvas with shortlist-then-tournament curation is a faster, more intuitive way to pick the best generations from a large set.
**Current Focus:** Phase 06 — Curation (next)

## Current Position

Phase: 05 (tournament-mode-replaces-old-comparison-mode-framing) — COMPLETE
Plan: 6 of 6 complete

- **Milestone:** v1
- **Phase:** 6
- **Plan:** Not started
- **Status:** Ready to plan

Progress: `[██████████] 5 / 7 phases`

## Performance Metrics

- Phases complete: 3 / 7
- Plans complete: 34 / 35 (across phases 1–3 + Phase 4 Plans 01–05)
- Requirements mapped: 74 / 74 (v1 total post-pivot)

| Phase-Plan   | Duration | Tasks   | Files                   |
| ------------ | -------- | ------- | ----------------------- |
| 04-01        | ~10 min  | 2       | 4 created + 1 modified  |
| Phase 04 P02 | ~7 min   | 2 tasks | 5 modified files        |
| Phase 04 P03 | 75 min   | 4 tasks | 13 files                |
| Phase 04 P04 | ~29 min  | 4 tasks | 16 files                |
| Phase 04 P05 | ~10min   | 1 tasks | 3 files                 |
| Phase 04 P06 | 55min    | 6 tasks | 10 files                |
| Phase 05 P01 | ~30min   | 2 tasks | 2 files                 |
| Phase 05 P02 | ~3min    | 2 tasks | 2 files                 |
| Phase 05 P03 | ~7min    | 3 tasks | 4 files                 |
| Phase 05 P04 | ~6min    | 2 tasks | 4 files                 |
| Phase 05 P05 | ~7min    | 1 tasks | 2 files                 |
| Phase 05 P06 | ~95min   | 5 tasks | 6 created + 15 modified |

## Accumulated Context

### Decisions

**Foundational (shipped in Phases 1–3):**

- PixiJS chosen for the canvas (2D sprite scale; litegraph renderer is node-graph coupled and ADR-sensitive).
- Share the input composable only, not the renderer (preserves pan/zoom muscle memory without coupling the two canvases).
- Moshpit is a top-level workspace, not a tab on a workflow.
- Generated-only asset source (imported assets excluded to match "parameterised artefacts" framing).
- IndexedDB for curation + thumbnail cache (prototype-friendly; ~250MB fits desktop quotas).
- One 512px WebP thumbnail per asset + Pixi mipmap for LOD; full-res lazy on compare/detail.
- Exclude assets without parseable ComfyUI metadata entirely (count surfaced in Settings).
- Soft-delete only (hide flag) — no real deletion in v1.

**v3 pivot (2026-04-21):**

- Core Value reframed from "spatial-sort-by-parameter is valuable" to "lineage-grouped canvas + shortlist/tournament curation is valuable". Params are means; quality is the end.
- Lineage groupings (workflow, save node, prompt, model, type) replace parameter-axis sort as the primary spatial organiser. Non-exclusive, stackable, auto-nested by bucket density (bigger buckets outermost).
- Filters and groups are independent concerns — filters cull the set, groups organise what remains.
- Tournament mode replaces old Comparison Mode framing. Pairwise winner selection, three display modes preserved, ephemeral scoring (no persisted elo).
- Tournament input = current canvas selection. Folders are the way to persist a shortlist for repeat tournamenting.
- Metadata peek collapsed to on-demand (`M` key) — tournament is pure pixels by default.
- "Generate more like this" cut from v1; reinstated as v2-GEN-01/02.
- Parameter filters (CFG, steps, seed, sampler, scheduler, resolution, LoRA, negative prompt) demoted behind an "Advanced" disclosure in the Settings panel.
- Within-cluster sort is a single dropdown: newest first (default), oldest first, alphabetical.

**Phase 4 Plan 01 (2026-04-21) — cluster math substrate:**

- `computeClusterLayout` recursive row-wrapping packer lives in `src/platform/moshpit/services/clusterLayout.ts`; worker-safe (no Vue / Pinia / DOM).
- `computeNestingOrder` decides outer → inner axis ordering by avg bucket size descending (ties broken by GROUPING_AXES declaration order). Separate entry point from the packer so the Pinia store can memoise the order without re-packing.
- Bucket-key memoisation keyed by `${axis}|${hash}` inside both `computeNestingOrder` and `computeClusterLayout` keeps 5 k × 3-axis math at ~18 ms locally (budget 100 ms; GROUP-10 / D-05).
- `groupAxes.ts` houses five axis-extraction primitives + `compareAssetsForWithinCluster` (CSORT-01). `deriveTypeBucket` is derived at read time; not persisted.
- Forward-compatibility pattern: `saveNodeIdentity` consumed via structural widening on `NormalizedParams` so Plan 01 / Plan 02 remain independently shippable.
- TDD RED commits collide with husky's global `pnpm typecheck` step because pre-existing `thumbRepository.ts` errors surface on every commit; commits still land (git accepts them — lint-staged only reverts the staged index).
- fast-check property assertions established as the regression guard for both the within-cluster comparator (determinism) and the cluster packer (hash-uniqueness invariant — Pitfall 2).

**Phase 3 engineering notes (retained for Phase 4 reuse):**

- `emitted<unknown[]>()` typing pattern required to satisfy vue-tsc on @testing-library/vue `emitted()` return type
- Module-level pinia instance pattern for tests that seed store state before component mount
- `role=option` on param picker `<li>` items enables reliable `userEvent.click()` in happy-dom
- `defineExpose selectX/selectY` in MoshpitSortControls — Reka `PopoverPortal` unreliable in happy-dom; tests use direct vm invocation
- `onSliderChange` typed as `number[] | undefined` to match Reka `SliderRootEmits` payload type
- `shallowRef` required for Viewport injection key — Vue `ref()` deep-unwraps complex classes causing TS2345
- `transformTick` void pattern for 60fps overlay updates — `void transformTick.value` registers reactive dep without lint-triggering unused variable
- `MOSHPIT_LAYOUT_INJECTION_KEY` co-located in `useMoshpitSpriteLayer.ts` — avoids new module, keeps key adjacent to `SpriteLayerOptions` type
- `sortMath` primitives remain available in the codebase for Phase 4 cluster layout reuse (pure functions, no UI coupling)
- [Phase 04]: Plan 04-02 — saveNodeIdentity materialised in NormalizedParamsSchema + IDB v2→v3 cursor migration. GROUP-04 data layer complete. Plan 04-03 can now read real saveNodeIdentity buckets via Plan 01's clusterLayout
- [Phase 04]: Plan 04-03: moshpitFilterStore + useMoshpitFilteredAssets flipped onto computeClusterLayout. ParamKey widened with saveNode; PRIMARY/ADVANCED tier constants exported; exhaustive never-guards added to filterMath switches (Pitfall 1). Legacy MoshpitSortControls + MoshpitAxisOverlay deleted. Full-project typecheck now green (pre-existing useMinimap.test.ts TS2367 resolved inline as Rule 3 blocker).
- [Phase 04]: Plan 04-04: Settings-panel UI building blocks shipped — MoshpitGroupingToggles (5 pills), MoshpitWithinClusterSort (native select), MoshpitAdvancedFilters (Reka Collapsible). MoshpitFilterChipRow gained tier prop; MoshpitAddFilterPopover split into Primary/Advanced sections with saveNode entry. useMoshpitParamValueOptions.saveNode case derives from params.saveNodeIdentity. 59 tests across 6 files green.
- [Phase 04]: [Phase 04]: Plan 04-05: MoshpitClusterOverlay shipped — HTML-over-Pixi bounding-box + label overlay at depths 0 and 1 (D-06). Subscribes to viewport 'moved' via transformTick scalar bump; (other) bucket renders via t('moshpit.grouping.otherLabel'); display:none fallback when viewport is null. 8 tests green, ready for Plan 06 to mount into MoshpitView.vue.
- [Phase 04]: Plan 04-06: MoshpitClusterOverlay mounted in src/views/MoshpitView.vue (not MoshpitCanvas.vue) — matches Plan 03 SUMMARY executor note. Cluster overlay replaces the removed MoshpitAxisOverlay parallel to the sprite layer.
- [Phase 04]: Plan 04-06: moshpit.sort.\* i18n block fully removed (12 keys); showHiddenLabel relocated to moshpit.filters.showHiddenLabel; grid-spacing label now lives in moshpit.grouping.spacingLabel + spacingValue.
- [Phase 04]: Plan 04-06 Task 5 (Playwright @moshpit spec) deferred per D-21 — pre-existing typecheck:browser tsconfig mismatch on main blocks browser_tests/ commits. Full rationale + 5-test design logged to deferred-items.md.
- [Phase 05]: Phase 05 Plan 01 — tournamentBracket pure module shipped with applyPick/generateNextRound split locked; RED commit requires a stub for ESLint import-x; happy-dom strips file: scheme so pure-module invariant test uses process.cwd().
- [Phase 05]: Phase 05 Plan 02: metadataDiff pure module — diffParams missing-value semantics treat undefined/null/'' alike; diffLoras duplicate-name = last-weight-wins; sortBy(state,name); 22 tests, 2 fast-check permutation properties (PEEK-03).
- [Phase 05]: Plan 05-03: tournament store uses injected fullResUrlResolver (not assetsStore direct coupling); currentRoundWinnersInOrder lives as internal Setup-scope ref; preload is uncapped fire-and-forget; D-08 collapses esc+complete into one rule (>=1 win => apply); VNode-prop ref unreliable under happy-dom — tests use callback ref.
- [Phase 05]: Plan 05-04: Tournament visual primitives shipped — AssetFrame uses Image() preloader + Tailwind opacity transition for crossfade (no JS tween). Pair applies dynamic clip-path via inline :style; divider drag updates store.wipePosition via getBoundingClientRect. Semantic tokens verified vs style.css — use bg-base-background / bg-base-foreground / ring-(--focus-ring) / bg-interface-panel-surface (plan-suggested bg-background / bg-foreground / ring-primary don't exist). TDD RED commits skipped for UI glue per plan — vue/no-unused-properties and testing-library/no-container linters forced single feat: commits with tests-first in working tree.
- [Phase 05]: Plan 05-05: MoshpitMetadataPeekPanel shipped — Tailwind transition-[transform] duration-200 ease-out slide gated by store.isPeekOpen (no JS tween); scalar diff rows highlighted bg-node-component-surface; LoRA rows text-success/text-danger/text-warning; i18n via moshpit.peek._ keys; Plan 06 drops moshpit.peek.lora.state_ keys (state conveyed by colour alone).
- [Phase 05]: Plan 05-06: Phase 05 shipped. Overlay + Enter gate + i18n + UAT signed off 2026-04-23. Post-UAT work in-scope: canvas selection gestures (click/ctrl+click/shift+click/marquee with Cmd/Ctrl gate) added because MoshpitCanvas had none; tournament keybindings moved from DialogContent template-ref (Reka returns component instance, not HTMLElement) to window capture phase gated on isActive; overlap clipPath inverted so divider IS the A↔B seam; pick-pulse feedback (CSS gradient, pickPulseId scalar); winner screen on tournament completion with Enter/Esc/Space ack; modal framing reframed as bounded dialog with stronger backdrop + z-50 above MoshpitLayout. 625/625 moshpit unit tests green, typecheck clean. @moshpit Playwright spec still deferred (Phase 4 tsconfig:browser blocker).

### Active Todos

- Execute Plan 04-04 (moshpitFilterStore saveNode axis wiring — popover tier routing).
- Follow with Plan 04-05 (cluster overlay — reads `clusterTree` from `useMoshpitFilteredAssets`), Plan 04-06 (grouping toggle UI + chip tier popover using `PRIMARY_FILTER_PARAMS` / `ADVANCED_FILTER_PARAMS`).
- Plan 06 retargeting notes are in `.planning/phases/04-lineage-groupings-within-cluster-sort/04-03-SUMMARY.md` ("Notes for Plan 06 Executor"): Task 3 deletions are done, Task 2 target should be MoshpitView.vue.

### Blockers

None.

## Session Continuity

**Last session:** 2026-04-23T00:00:00.000Z
**Stopped at:** Completed 05-06-PLAN.md (Phase 05 shipped, HUMAN-UAT approved)

**Context for next session:**

- Read `.planning/PROJECT.md` for scope and constraints (v3-pivot-aware).
- Read `.planning/REQUIREMENTS.md` for the 74 v1 requirements and their phase mappings; note SORT-01/02/03 are deprecated post-ship. TOUR-01..08 and PEEK-01..03 are now closed.
- Read `.planning/ROADMAP.md` for the reorganised phase structure (Phase 4 = Lineage Groupings ✓, Phase 5 = Tournament Mode ✓, Phase 6 = Curation, Phase 7 = UX).
- Read `temp/plans/moshpit_prd.md` v3 for the curation pivot reasoning and full product spec.
- Next step: `/gsd-plan-phase 6` (Curation — folders, tags, favourites, hide, export) — depends on the winner-set selection primitive demonstrated in Phase 5.

**Open questions carried forward** (from PRD v3 §9):

- **Tournament bracket shape**: single-elimination vs short round-robin vs swiss — open for Phase 5; round-robin default for small sets (<8), single-elim for larger.
- **Prompt normalisation for grouping**: trim + lowercase + collapse-whitespace minimum; semantic similarity is v2.
- **Cluster visual treatment**: bounding boxes, labels, padding, collapse/expand — deferred to design.
- **"(other)" cluster handling**: exact placement and labelling — design detail for Phase 4.
- **Workflow grouping drift**: filename-based grouping accepted for v1; graph-hash heuristics are v2.
- **Diff visual treatment** in metadata peek overlay — deferred to design.
- **Thumbnail cache eviction**: v1 accepts unbounded; LRU / size cap is v2.
- **Additional grouping axes**: v1 ships with workflow/save-node/prompt/model/type; sampler, resolution bucket, seed-modulo-N are candidates for later.

---

_State initialized: 2026-04-20_
_Pivoted: 2026-04-21 — PRD v3 (curation pivot). Phases 1–3 marked complete; Phase 4 reframed as Lineage Groupings; Phase 5 as Tournament; Phase 6 as Curation; old Phase 6 Generate More cut._
