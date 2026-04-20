# Project State

**Last updated:** 2026-04-20

## Project Reference

**Project:** Moshpit (ComfyUI Autocanvas)
**Core Value:** Prove that spatial-sort-by-parameter is a valuable interaction for reasoning about generation output.
**Current Focus:** Awaiting Phase 1 plan creation.

## Current Position

- **Milestone:** v1
- **Phase:** Not started (Phase 1 queued)
- **Plan:** None
- **Status:** Roadmap complete; ready for `/gsd-plan-phase 1`

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

### Active Todos

- Create Phase 1 plan via `/gsd-plan-phase 1`.

### Blockers

None.

## Session Continuity

**Last session:** Project initialization + roadmap creation (2026-04-20).

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
