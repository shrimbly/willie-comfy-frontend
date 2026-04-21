---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 04-03-PLAN.md
last_updated: '2026-04-21T17:27:00.502Z'
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 35
  completed_plans: 32
  percent: 91
---

# Project State

**Last updated:** 2026-04-21

## Project Reference

**Project:** Moshpit (ComfyUI Autocanvas)
**Core Value:** Prove that a lineage-grouped spatial canvas with shortlist-then-tournament curation is a faster, more intuitive way to pick the best generations from a large set.
**Current Focus:** Phase 04 — lineage-groupings-within-cluster-sort

## Current Position

Phase: 04 (lineage-groupings-within-cluster-sort) — EXECUTING
Plan: 4 of 6

- **Milestone:** v1
- **Phase:** 4
- **Plan:** 04-03 complete; 04-04 next
- **Status:** Executing Phase 04

Progress: `[█████████░] 3 / 7 phases`

## Performance Metrics

- Phases complete: 3 / 7
- Plans complete: 30 / 35 (across phases 1–3 + Phase 4 Plan 01)
- Requirements mapped: 74 / 74 (v1 total post-pivot)

| Phase-Plan   | Duration | Tasks   | Files                  |
| ------------ | -------- | ------- | ---------------------- |
| 04-01        | ~10 min  | 2       | 4 created + 1 modified |
| Phase 04 P02 | ~7 min   | 2 tasks | 5 modified files       |
| Phase 04 P03 | 75 min   | 4 tasks | 13 files               |

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

### Active Todos

- Execute Plan 04-04 (moshpitFilterStore saveNode axis wiring — popover tier routing).
- Follow with Plan 04-05 (cluster overlay — reads `clusterTree` from `useMoshpitFilteredAssets`), Plan 04-06 (grouping toggle UI + chip tier popover using `PRIMARY_FILTER_PARAMS` / `ADVANCED_FILTER_PARAMS`).
- Plan 06 retargeting notes are in `.planning/phases/04-lineage-groupings-within-cluster-sort/04-03-SUMMARY.md` ("Notes for Plan 06 Executor"): Task 3 deletions are done, Task 2 target should be MoshpitView.vue.

### Blockers

None.

## Session Continuity

**Last session:** 2026-04-21T17:26:36.551Z
**Stopped at:** Completed 04-03-PLAN.md

**Context for next session:**

- Read `.planning/PROJECT.md` for scope and constraints (v3-pivot-aware).
- Read `.planning/REQUIREMENTS.md` for the 74 v1 requirements and their phase mappings; note SORT-01/02/03 are deprecated post-ship.
- Read `.planning/ROADMAP.md` for the reorganised phase structure (Phase 4 = Lineage Groupings, Phase 5 = Tournament Mode, Phase 6 = Curation, Phase 7 = UX).
- Read `temp/plans/moshpit_prd.md` v3 for the curation pivot reasoning and full product spec.
- Next step: `/gsd-plan-phase 4` (or `/gsd-discuss-phase 4` first if design questions want surfacing).

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
