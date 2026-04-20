# Moshpit (ComfyUI Autocanvas)

## What This Is

Moshpit is a full-bleed spatial canvas inside ComfyUI for prosumer users to explore, compare, and curate generated image assets. It's a cross-workflow workspace — a peer of the workflow graph, not scoped to any open workflow — where users progressively filter and arrange outputs by embedded metadata (CFG, steps, LoRA, sampler, etc.), compare candidates across three comparison modes, and curate via favourites, tags, folders, hide, and export.

## Core Value

**Prove that spatial-sort-by-parameter is a valuable interaction for reasoning about generation output.** Every tradeoff resolves toward that: if the sort axis doesn't feel great on real parameter sweeps, nothing else matters.

## Requirements

### Validated

<!-- Capabilities already shipped on media-assets-1 that Moshpit leans on. These are locked. -->

- ✓ Unified `AssetItem` stream combining generated outputs (cloud history + OSS disk scan) and imported assets — media-assets-1
- ✓ PNG metadata extraction via `scripts/metadata/png.ts` (`getFromPngBuffer`) — pre-existing
- ✓ Asset detail panel for single-asset inspection — media-assets-1
- ✓ Filename-template rendering with autocomplete for output naming — media-assets-1
- ✓ Sidebar tab extension system (`sidebarTabStore`, `SidebarTabExtension`) — pre-existing
- ✓ Virtualized grid component (`VirtualGrid.vue`) for 5k+ item DOM rendering — pre-existing
- ✓ Idle scheduling utility (`runWhenGlobalIdle`) for non-blocking background work — pre-existing
- ✓ Workflow canvas pan/zoom/selection (litegraph via `useCanvasInteractions`) — pre-existing

### Active

<!-- Moshpit v1 scope. All are hypotheses until validated by dogfooding. -->

**Workspace shell**

- [ ] Moshpit as a top-level workspace (peer of workflow graph, cross-workflow)
- [ ] PixiJS-rendered full-bleed canvas
- [ ] Shared input composable for pan/zoom/selection reused from workflow canvas
- [ ] Left Settings panel via sidebar tab extension, open by default, auto-collapse on first canvas interaction

**Asset ingestion and thumbnails**

- [ ] Generated-only asset source via existing `AssetItem` stream
- [ ] Web Worker thumbnail pipeline: fetch → `createImageBitmap` → OffscreenCanvas downscale to 512px → WebP
- [ ] IndexedDB cache for thumbnails + curation state, keyed by asset content hash
- [ ] Progressive "processing" step with docked progress indicator and cancel affordance
- [ ] Layout re-pack after processing completes (close holes left by excluded assets)
- [ ] Excluded-count surface in Settings panel for assets without ComfyUI metadata

**Filtering**

- [ ] Initial filter gate: workflow selector + time range (today / week / month / all / custom)
- [ ] Subtractive filters across hardcoded parameter list (model, LoRA, CFG, steps, sampler, scheduler, seed, prompt substring, negative prompt substring, resolution, time, tags, favourite, hidden)
- [ ] Filter chips in Settings panel, click-to-remove
- [ ] Default filter set hides soft-deleted assets (`hidden:false`)

**Sorting**

- [ ] 1D sort with vertical packing (default)
- [ ] 2D parameter scatter
- [ ] User-configurable grid spacing
- [ ] Grid-snapped positioning

**Canvas navigation**

- [ ] Pan, zoom, fit-all, zoom-to-selection
- [ ] Drag-rectangle marquee, `Shift`-click add, `Cmd`/`Ctrl`-click toggle, `Cmd`/`Ctrl`-A select all visible, `Esc` clear

**Comparison mode**

- [ ] Enter with ≥2 selected via `Enter`, exit via `Esc`
- [ ] Three modes, switch with `[`/`]`: side-by-side, overlap (opacity/wipe), A/B flip
- [ ] Pinned + rotating navigation (`←`/`→`)
- [ ] `Space` triggers A/B flip in any mode
- [ ] Automatic metadata diff panel (differing parameters highlighted)
- [ ] LoRA set-diff rendering (name-based, order-insensitive, added/removed/weight-changed)

**Curation**

- [ ] Favourite / unfavourite (`S`)
- [ ] Free-text tags (`T`)
- [ ] User-defined folders (curation layer, not filesystem moves)
- [ ] Hide / unhide (`H`) — soft-delete, no real deletion in v1
- [ ] Export selection at full resolution (`E`)
- [ ] Toast-based undo with ~8s lifetime (`Cmd`/`Ctrl`-Z)

**Generate more like this (mocked)**

- [ ] Right-click → modal that live-parses source workflow JSON
- [ ] Heuristic param exposure (KSampler widgets, LoRA strengths)
- [ ] Queue button is non-executing (no backend call, no telemetry)
- [ ] Fallback message if parsing fails — no stubbed fake fields

**Empty states & UX edges**

- [ ] Four enumerated empty states (no initial filter / zero match / narrowed to zero / all hidden)
- [ ] Dogfood-ready perf at 5k assets: 60fps pan/zoom, <2s first thumb, <3s warm start

### Out of Scope

<!-- Explicit boundaries. Reasoning included to prevent re-adding. -->

- Saved filter/sort presets — validate the interaction before templating it
- Real implementation of "Generate more like this" — requires backend queue contract, out of prototype scope
- Sidecar metadata database / re-indexing — v1 relies on embedded PNG metadata only
- Multi-user or cloud-synced curation state — IndexedDB is per-browser by design
- Performance targets beyond 5,000 assets — v1 proves the interaction, not the scale
- Assets with missing or stripped metadata — excluded from Moshpit entirely, not rendered as second-class citizens
- Real deletion — soft-delete (hide) only; real delete needs backend + undo infra
- Semantic prompt search — substring/keyword match only in v1
- Contextual / auto-selected comparison modes — user picks explicitly
- Mobile or touch-primary usage — desktop-first posture; 250MB thumbnail cache alone disqualifies mobile
- Full canvas a11y parity — canvas is visual-only; actions (Settings, comparison, curation) remain keyboard-reachable
- Imported / user-uploaded assets in the Moshpit — generated-only to match "parameterised artefacts" framing
- Telemetry / product analytics — v1 validates via qualitative dogfooding
- Modifications to `LGraphNode` / `LGraphCanvas` / `LGraph` / `Subgraph` — ADR 0003/0008, extension ecosystem impact

## Context

**Project environment.** ComfyUI_frontend is a Vue 3.5 + TypeScript + Tailwind 4 app, Nx-orchestrated, pnpm-managed. Vite dev server. Vitest + Playwright for testing. Extensive litegraph-based workflow canvas. See `.planning/codebase/` for the full map (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS).

**Branch.** Development on the `moshpit` branch, forked from `media-assets-1` (active feature branch delivering asset-browser fundamentals). The `media-assets-1` work is the substrate Moshpit builds on — particularly the unified `AssetItem` stream and asset detail panel.

**PRD.** `temp/plans/moshpit_prd.md` is the product source of truth. This PROJECT.md is derived from it. When the PRD and PROJECT.md diverge, the PRD wins for product scope; PROJECT.md wins for GSD-workflow state.

**Extension ecosystem sensitivity.** ComfyUI has ~40+ custom node repos depending on stable entity APIs (`LGraphNode.widgets`, `onConnectionsChange`, `graph._version++`, etc.). Moshpit must not touch any of these surfaces — all new canvas logic lives in stores/composables/systems per ADR 0003 and ADR 0008.

**Research scope expectation.** Domain research before planning each phase is enabled. The domains worth researching are narrow and specific: PixiJS sprite batching, IndexedDB blob storage patterns, OffscreenCanvas/`createImageBitmap` workers, and WebP encoding performance. The ComfyUI codebase itself is already mapped.

**User profile.** Prosumer ComfyUI users — desktop-first, generating hundreds to thousands of images across workflows, care about parameter-level craft. Not hobbyists, not enterprise teams.

## Constraints

- **Tech stack**: Vue 3.5 Composition API, TypeScript, Tailwind 4, Pinia, Vite, pnpm — mandatory (project-wide conventions). No new PrimeVue usage, no `dark:` variant, no `:class="[]"`, no `!important`, no `any` / `as any`, no `--no-verify`.
- **Rendering**: PixiJS for Moshpit canvas. Shared input composable with litegraph canvas; do not share the renderer.
- **Entity architecture**: No modifications to `LGraphNode`, `LGraphCanvas`, `LGraph`, or `Subgraph`. ADR 0003 + 0008 — command pattern for mutations, ECS-style component access, no OOP inheritance for entities. Extension compatibility is non-negotiable.
- **Persistence**: IndexedDB only for v1. No backend storage, no sidecar DB, no settings-store piggyback for per-asset data.
- **Metadata**: Embedded PNG metadata only (`getFromPngBuffer`). Assets without parseable ComfyUI metadata are excluded.
- **Performance budget**: 5,000 assets target. 60fps pan/zoom, <2s first thumb cold, <3s full populate on warm cache, <500ms full-res on warm HTTP. No graceful degradation beyond 5k.
- **Platform**: Desktop-first. Mobile/touch is explicitly unsupported for v1 (IndexedDB quota, canvas density).
- **Accessibility posture**: Canvas is a visual-only surface. All _actions_ (filter, sort, compare, curate, export) must be keyboard-reachable and screen-reader-legible via the Settings panel and comparison mode.
- **Git conventions**: `prefix:` commit format (`feat:`, `fix:`, `test:`). PRs reference issues via "Fixes #n". No Claude/AI mentions in commits.

## Key Decisions

| Decision                                            | Rationale                                                                                                                      | Outcome   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------- |
| PixiJS for the canvas                               | Purpose-built for 2D sprite scale; raw WebGL is weeks of yak shave; litegraph renderer is node-graph coupled and ADR-sensitive | — Pending |
| Share input composable only, not renderer           | Preserves muscle-memory pan/zoom parity with workflow canvas without coupling the two canvases                                 | — Pending |
| Top-level workspace, not tab-on-workflow            | Moshpit is cross-workflow — workflow is a filter value, not ambient context                                                    | — Pending |
| Generated-only asset source                         | Matches "parameterised artefacts" framing; imported assets would mostly be filtered out anyway                                 | — Pending |
| IndexedDB for curation + thumbnail cache            | Prototype-friendly, self-contained, ~250MB fits desktop quotas; backend sidecar is out of v1 scope                             | — Pending |
| Frontend-generated thumbnails in Web Worker         | Self-contained on this branch; OSS and cloud behave identically; progressive populate is native to the approach                | — Pending |
| 512px WebP + Pixi mipmap for LOD                    | One thumb per asset (vs three tiers generated eagerly); GPU handles downsample smoothly; full-res lazy on compare/detail       | — Pending |
| Exclude assets without parseable metadata           | Keeps mental model clean — Moshpit is _the filterable set_; Assets sidebar serves "browse everything" use case                 | — Pending |
| Soft-delete only (hide flag)                        | Users need "get this out of my sight" affordance; real delete needs backend + undo infra                                       | — Pending |
| Live-parsed Generate More, non-executing            | Static mock fails validation the moment a workflow lacks expected fields; live parse tests the real interaction                | — Pending |
| Toast-based undo (8s window)                        | Covers 90% of "oh shit" bulk-curation cases; full undo stack over-builds v1                                                    | — Pending |
| LoRA diff is name-based, order-insensitive set diff | Matches developer intuition for list diffs; generalises to control nets / embeddings if added later                            | — Pending |
| No telemetry in v1                                  | Validate via qualitative dogfooding; event instrumentation is maintenance cost without a dashboard                             | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-04-20 after initialization_
