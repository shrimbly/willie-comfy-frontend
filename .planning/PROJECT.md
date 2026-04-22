# Moshpit (ComfyUI Autocanvas)

## What This Is

Moshpit is a full-bleed spatial canvas inside ComfyUI for prosumer users to explore, compare, and curate generated image assets. It's a cross-workflow workspace — a peer of the workflow graph, not scoped to any open workflow — where users scope by workflow + time range, organise assets into nested lineage clusters (same workflow, save node, prompt, model, type), progressively narrow with subtractive filters, shortlist candidates via favourites or selection, and pick winners through a pairwise tournament mode. Curation persists across sessions via favourites, tags, folders, hide, and export.

## Core Value

**Prove that a lineage-grouped spatial canvas with shortlist-then-tournament curation is a faster, more intuitive way to pick the best generations from a large set.** Every tradeoff resolves toward that: if clustering by prompt/workflow/save-node doesn't make comparable assets easier to find, and tournament doesn't make picking winners faster than scrolling a grid, nothing else matters.

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
- ✓ Moshpit workspace shell, PixiJS canvas, pan/zoom/selection parity, Settings panel — Phase 1
- ✓ Worker thumbnail pipeline, IndexedDB cache, content-hash keying, progressive populate — Phase 2
- ✓ Initial filter gate (workflow + time range), subtractive filter chips across hardcoded param list — Phase 3

### Active

<!-- Moshpit v1 scope under the curation pivot. All are hypotheses until validated by dogfooding. -->

**Lineage groupings (new)**

- [ ] Multi-axis non-exclusive grouping toggles: workflow, save node, prompt, model, type (aspect / resolution bucket)
- [ ] Auto-nested cluster hierarchy: axis with largest average bucket size nests outermost, applied recursively
- [ ] Groupings separate from filters — filters cull, groups organise
- [ ] Assets missing a grouped parameter fall into an "(other)" cluster at that level, not hidden
- [ ] Cluster layout recompute + animation under 400ms at 5k assets on grouping toggle

**Filter refactor (on top of shipped Phase 3)**

- [ ] Primary filter surface is lineage-first: workflow, prompt, save node, model, time, favourite, hidden, tag
- [ ] Secondary filters (CFG, steps, seed, sampler, scheduler, resolution, LoRA, negative prompt) live behind an **Advanced** disclosure
- [ ] Parameter-axis spatial sort (1D packing / 2D scatter) removed — shipped in Phase 3, deprecated by pivot

**Within-cluster sort**

- [ ] Single Settings-panel dropdown: newest first (default), oldest first, alphabetical by filename
- [ ] Applies globally to all leaf clusters

**Tournament mode (replaces old Comparison Mode framing)**

- [ ] Enter with ≥2 selected via `Enter`, exit via `Esc` (selection preserved)
- [ ] Three display modes preserved: side-by-side, overlap (opacity/wipe), A/B flip — switch with `[`/`]`
- [ ] Pairwise winner selection: `←` picks left, `→` picks right, `↓` skips
- [ ] `Space` triggers A/B flip in any mode
- [ ] Tournament is **ephemeral** — no persisted scores, no elo, no leaderboards across sessions
- [ ] Output: winners selected on canvas, user exports or folders them manually
- [ ] Metadata peek overlay hidden by default, toggle with `M` — shows automatic metadata diff (including LoRA set-diff rendering)

**Curation (unchanged primitives, reframed roles)**

- [ ] Favourite / unfavourite (`S`) — also the persistent shortlist mark
- [ ] Free-text tags (`T`) — orthogonal to lineage grouping, becomes filterable
- [ ] User-defined folders — the way to persist a shortlist for later tournamenting
- [ ] Hide / unhide (`H`) — soft-delete, no real deletion in v1
- [ ] Export selection at full resolution (`E`)
- [ ] Toast-based undo with ~8s lifetime (`Cmd`/`Ctrl`-Z)

**Empty states & UX edges (unchanged)**

- [ ] Four enumerated empty states (no initial filter / zero match / narrowed to zero / all hidden)
- [ ] Dogfood-ready perf at 5k assets: 60fps pan/zoom, <2s first thumb, <3s warm start, <400ms grouping recompute

### Out of Scope

<!-- Explicit boundaries. Reasoning included to prevent re-adding. -->

- **Parameter-axis spatial sort (1D / 2D scatter)** — shipped in Phase 3, invalidated by the curation pivot; lineage groupings replace it
- **"Generate more like this" (mocked or real)** — cut from v1 scope; natural next step but out of prototype scope
- **Persisted tournament scores / elo / leaderboards** — tournaments are per-session; the artefact is the export, not a ranking
- **Semantic prompt grouping** — v1 uses exact / normalised-exact prompt match only; fuzzy/embedding-based grouping deferred
- Saved filter/group presets — validate the interaction before templating it
- Sidecar metadata database / re-indexing — v1 relies on embedded PNG metadata only
- Multi-user or cloud-synced curation state — IndexedDB is per-browser by design
- Performance targets beyond 5,000 assets — v1 proves the interaction, not the scale
- Assets with missing or stripped metadata — excluded from Moshpit entirely, not rendered as second-class citizens
- Real deletion — soft-delete (hide) only; real delete needs backend + undo infra
- Semantic prompt search — substring/keyword match only in v1
- Contextual / auto-selected comparison modes — user picks explicitly
- Mobile or touch-primary usage — desktop-first posture; 250MB thumbnail cache alone disqualifies mobile
- Full canvas a11y parity — canvas is visual-only; actions (Settings, tournament, curation) remain keyboard-reachable
- Imported / user-uploaded assets in the Moshpit — generated-only to match "parameterised artefacts" framing
- Telemetry / product analytics — v1 validates via qualitative dogfooding
- Modifications to `LGraphNode` / `LGraphCanvas` / `LGraph` / `Subgraph` — ADR 0003/0008, extension ecosystem impact

## Context

**Project environment.** ComfyUI_frontend is a Vue 3.5 + TypeScript + Tailwind 4 app, Nx-orchestrated, pnpm-managed. Vite dev server. Vitest + Playwright for testing. Extensive litegraph-based workflow canvas. See `.planning/codebase/` for the full map (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS).

**Branch.** Development on the `moshpit` branch, forked from `media-assets-1` (active feature branch delivering asset-browser fundamentals). The `media-assets-1` work is the substrate Moshpit builds on — particularly the unified `AssetItem` stream and asset detail panel.

**PRD.** `temp/plans/moshpit_prd.md` is the product source of truth. Current version is **v3 (curation pivot)**; PROJECT.md is derived from it. When the PRD and PROJECT.md diverge, the PRD wins for product scope; PROJECT.md wins for GSD-workflow state.

**Pivot (2026-04-21).** The v2 PRD's Core Value — "prove spatial-sort-by-parameter is valuable" — was rejected. Parameters are means to an end; users care whether a generation is good, not what its CFG was. v3 reframes around lineage clustering + shortlist/tournament curation. Phases 1 and 2 survive unchanged. Phase 3 shipped but its sort axes are deprecated (kept in code, removed from UI). New phases replace the old Phases 4–6.

**Extension ecosystem sensitivity.** ComfyUI has ~40+ custom node repos depending on stable entity APIs (`LGraphNode.widgets`, `onConnectionsChange`, `graph._version++`, etc.). Moshpit must not touch any of these surfaces — all new canvas logic lives in stores/composables/systems per ADR 0003 and ADR 0008.

**Research scope expectation.** Domain research before planning each phase is enabled. The domains worth researching are narrow and specific: cluster layout algorithms (nested rectangles, force-directed clustering), PixiJS sprite batching at cluster boundaries, tournament bracket shapes for small-N comparison, IndexedDB migration patterns for persisted curation state. The ComfyUI codebase itself is already mapped.

**User profile.** Prosumer ComfyUI users — desktop-first, generating hundreds to thousands of images across workflows, care about picking winners from large comparable sets.

## Constraints

- **Tech stack**: Vue 3.5 Composition API, TypeScript, Tailwind 4, Pinia, Vite, pnpm — mandatory (project-wide conventions). No new PrimeVue usage, no `dark:` variant, no `:class="[]"`, no `!important`, no `any` / `as any`, no `--no-verify`.
- **Rendering**: PixiJS for Moshpit canvas. Shared input composable with litegraph canvas; do not share the renderer.
- **Entity architecture**: No modifications to `LGraphNode`, `LGraphCanvas`, `LGraph`, or `Subgraph`. ADR 0003 + 0008 — command pattern for mutations, ECS-style component access, no OOP inheritance for entities. Extension compatibility is non-negotiable.
- **Persistence**: IndexedDB only for v1. No backend storage, no sidecar DB, no settings-store piggyback for per-asset data.
- **Metadata**: Embedded PNG metadata only (`getFromPngBuffer`). Assets without parseable ComfyUI metadata are excluded.
- **Performance budget**: 5,000 assets target. 60fps pan/zoom, <2s first thumb cold, <3s full populate on warm cache, <500ms full-res on warm HTTP, <400ms grouping recompute. No graceful degradation beyond 5k.
- **Platform**: Desktop-first. Mobile/touch is explicitly unsupported for v1 (IndexedDB quota, canvas density).
- **Accessibility posture**: Canvas is a visual-only surface. All _actions_ (filter, group, tournament, curate, export) must be keyboard-reachable and screen-reader-legible via the Settings panel and tournament mode.
- **Git conventions**: `prefix:` commit format (`feat:`, `fix:`, `test:`). PRs reference issues via "Fixes #n". No Claude/AI mentions in commits.

## Key Decisions

| Decision                                                   | Rationale                                                                                                                      | Outcome      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| PixiJS for the canvas                                      | Purpose-built for 2D sprite scale; raw WebGL is weeks of yak shave; litegraph renderer is node-graph coupled and ADR-sensitive | ✓ Shipped    |
| Share input composable only, not renderer                  | Preserves muscle-memory pan/zoom parity with workflow canvas without coupling the two canvases                                 | ✓ Shipped    |
| Top-level workspace, not tab-on-workflow                   | Moshpit is cross-workflow — workflow is a filter value, not ambient context                                                    | ✓ Shipped    |
| Generated-only asset source                                | Matches "parameterised artefacts" framing; imported assets would mostly be filtered out anyway                                 | ✓ Shipped    |
| IndexedDB for curation + thumbnail cache                   | Prototype-friendly, self-contained, ~250MB fits desktop quotas; backend sidecar is out of v1 scope                             | ✓ Shipped    |
| Frontend-generated thumbnails in Web Worker                | Self-contained on this branch; OSS and cloud behave identically; progressive populate is native to the approach                | ✓ Shipped    |
| 512px WebP + Pixi mipmap for LOD                           | One thumb per asset (vs three tiers generated eagerly); GPU handles downsample smoothly; full-res lazy on compare/detail       | ✓ Shipped    |
| Exclude assets without parseable metadata                  | Keeps mental model clean — Moshpit is _the filterable set_; Assets sidebar serves "browse everything" use case                 | ✓ Shipped    |
| **Pivot from param-sort to lineage-grouping + tournament** | v2 Core Value invalidated pre-dogfooding: params are means, quality is the end. v3 reframes around clustering + curation       | — 2026-04-21 |
| **Auto-nested cluster hierarchy by bucket density**        | User doesn't have to rank grouping axes; bigger buckets naturally sit outside (5 workflows outside, 20 prompts inside)         | — Pending    |
| **Non-exclusive multi-axis groupings**                     | Multiple simultaneous group-bys compose into nested clusters; filters and groups are independent concerns                      | — Pending    |
| **Tournament is ephemeral, no persisted scores**           | The artefact is the export, not a leaderboard; persisted elo is over-engineering for v1                                        | — Pending    |
| **Tournament input = current selection**                   | Matches the canvas's spatial/selection feel; favourites/folders can feed it via "select all in filter view"                    | — Pending    |
| **Metadata peek collapsed to on-demand (`M`)**             | Pure curation is about pixels; diff panel is informative but not primary. Free toggle for power users                          | — Pending    |
| **Keep all three comparison display modes**                | Zero cost to preserve, different quality-perception styles benefit from different modes                                        | — Pending    |
| **Cut "Generate more like this"**                          | Out of v1 scope; the pivot tightens focus to filter → group → shortlist → tournament → export                                  | — 2026-04-21 |
| Soft-delete only (hide flag)                               | Users need "get this out of my sight" affordance; real delete needs backend + undo infra                                       | ✓ Shipped    |
| Toast-based undo (8s window)                               | Covers 90% of "oh shit" bulk-curation cases; full undo stack over-builds v1                                                    | — Pending    |
| LoRA diff is name-based, order-insensitive set diff        | Matches developer intuition for list diffs; generalises to control nets / embeddings if added later                            | — Pending    |
| No telemetry in v1                                         | Validate via qualitative dogfooding; event instrumentation is maintenance cost without a dashboard                             | ✓ Shipped    |

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

_Last updated: 2026-04-21 — curation pivot (PRD v3). Phases 1–3 marked Validated; param-sort moved to Out of Scope; new lineage grouping + tournament requirements added._
