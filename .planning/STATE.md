---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
last_updated: "2026-04-20T23:53:00.371Z"
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 29
  completed_plans: 29
  percent: 100
---

# Project State

**Last updated:** 2026-04-20

## Project Reference

**Project:** Moshpit (ComfyUI Autocanvas)
**Core Value:** Prove that spatial-sort-by-parameter is a valuable interaction for reasoning about generation output.
**Current Focus:** Phase 01 — workspace-shell-canvas-navigation

## Current Position

Phase: 01 (workspace-shell-canvas-navigation) — EXECUTING
Plan: 1 of 6

- **Milestone:** v1
- **Phase:** 3
- **Plan:** Not started
- **Status:** Ready to plan

Progress: `[░░░░░░░░░░] 0 / 7 phases`

## Performance Metrics

- Phases complete: 0 / 7
- Plans complete: 0 / ?
- Requirements mapped: 66 / 66

## Accumulated Context

### Decisions

- PixiJS chosen for the canvas (2D sprite scale; litegraph renderer is node-graph coupled and ADR-sensitive).
- Share the input composable only, not the renderer (preserves pan/zoom muscle memory without coupling the two canvases).
- Moshpit is a top-level workspace, not a tab on a workflow.
- Generated-only asset source (imported assets excluded to match "parameterised artefacts" framing).
- IndexedDB for curation + thumbnail cache (prototype-friendly; ~250MB fits desktop quotas).
- One 512px WebP thumbnail per asset + Pixi mipmap for LOD; full-res lazy on compare/detail.
- Exclude assets without parseable ComfyUI metadata entirely (count surfaced in Settings).
- Soft-delete only (hide flag) — no real deletion in v1.
- Live-parsed Generate More, non-executing Queue (validates interaction, not execution).
- Toast-based undo with ~8s window for bulk curation actions.
- LoRA diff is name-based, order-insensitive set diff.
- No telemetry in v1; validation via qualitative dogfooding.
- [Phase 03]: emitted<unknown[]>() typing pattern required to satisfy vue-tsc on @testing-library/vue emitted() return type
- [Phase 03]: Module-level pinia instance pattern for tests that seed store state before component mount
- [Phase 03]: role=option on param picker <li> items enables reliable userEvent.click() in happy-dom
- [Phase 03]: defineExpose selectX/selectY in MoshpitSortControls — Reka PopoverPortal unreliable in happy-dom for this component; tests use direct vm invocation instead
- [Phase 03]: onSliderChange typed as number[] | undefined to match SliderRootEmits payload type from Reka
- [Phase 03]: shallowRef required for Viewport injection key — Vue ref() deep-unwraps complex classes causing TS2345; shallowRef preserves class type
- [Phase 03]: transformTick void pattern for 60fps overlay updates — void transformTick.value in style functions registers reactive dep without lint-triggering unused variable
- [Phase 03-filter-sort-core-validation]: MOSHPIT_LAYOUT_INJECTION_KEY co-located in useMoshpitSpriteLayer.ts (option A) — avoids new module, keeps key adjacent to SpriteLayerOptions type
- [Phase 03-filter-sort-core-validation]: Phase 3 integration complete — HUMAN-UAT checkpoint returned; Phase 4 go/no-go pending user sign-off on 03-HUMAN-UAT.md

### Active Todos

- Create Phase 1 plan via `/gsd-plan-phase 1`.

### Blockers

None.

## Session Continuity

**Last session:** 2026-04-20T23:53:00.367Z

**Context for next session:**

- Read `.planning/PROJECT.md` for scope and constraints.
- Read `.planning/REQUIREMENTS.md` for the 66 v1 requirements and their phase mappings.
- Read `.planning/ROADMAP.md` for phase structure and success criteria.
- Read `temp/plans/moshpit_prd.md` for product-level reasoning.
- Next step: `/gsd-plan-phase 1` to decompose Workspace Shell & Canvas Navigation into executable plans.

**Open questions carried forward** (from PRD §9):

- Chaos-state visual treatment (pure random vs. jittered grid vs. physics settle) — design discretion.
- Workflow grouping drift (same filename, different era) — v1 accepts filename-based grouping.
- Diff visual treatment in compare metadata panel — deferred to design.
- IndexedDB eviction — v1 accepts unbounded; LRU / size cap is v2.

---

_State initialized: 2026-04-20_
