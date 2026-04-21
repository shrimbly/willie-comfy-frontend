# Roadmap: Moshpit (ComfyUI Autocanvas)

**Created:** 2026-04-20
**Pivoted:** 2026-04-21 (PRD v3 — curation-first framing)
**Granularity:** standard
**Core Value:** Prove that a lineage-grouped spatial canvas with shortlist-then-tournament curation is a faster, more intuitive way to pick the best generations from a large set.

## Phases

- [x] **Phase 1: Workspace Shell & Canvas Navigation** — Full-bleed Moshpit workspace mounts, pan/zoom/selection feel identical to workflow canvas, Settings panel slot is wired (completed 2026-04-20)
- [x] **Phase 2: Asset Pipeline** — Worker thumbnails + IndexedDB cache + progressive populate turn a filtered AssetItem stream into sprites on the canvas (completed 2026-04-20)
- [x] **Phase 3: Filter & Sort (Core Validation)** — Initial filter gate, subtractive filter chips, 1D and 2D spatial sort shipped; sort axes _superseded_ by the v3 pivot and slated for removal in Phase 4 (completed 2026-04-20)
- [ ] **Phase 4: Lineage Groupings & Within-Cluster Sort** _(new, replaces old Phase 4)_ — Multi-axis non-exclusive grouping toggles with auto-nested density-based hierarchy; within-cluster sort dropdown; Advanced-filter disclosure refactor; deprecated param-sort UI removal
- [ ] **Phase 5: Tournament Mode** _(replaces old "Comparison Mode")_ — Pairwise winner selection over a selected set, three display modes preserved, ephemeral scoring, opt-in metadata peek
- [ ] **Phase 6: Curation** _(was Phase 5)_ — Favourite, tag, folder, hide, export with toast-based undo; curation state persisted to IndexedDB
- [ ] **Phase 7: UX Edges & Performance Validation** _(was Phase 7; old Phase 6 Generate More Like This cut)_ — Empty states, perf hardening to 5k-asset budgets, keyboard/a11y sweep

## Phase Details

### Phase 1: Workspace Shell & Canvas Navigation

**Goal**: User can enter Moshpit as a peer workspace and pan/zoom/select on a full-bleed PixiJS canvas with pan/zoom parity matching the workflow canvas; Settings panel slot is mounted and behaves correctly.
**Depends on**: Nothing (first phase)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, NAV-01, NAV-02, NAV-03, NAV-04, NAV-05
**Success Criteria** (what must be TRUE):

1. User can open Moshpit as a top-level workspace (peer of the workflow graph) and the workflow graph is unchanged when they return to it
2. User can pan with `Space`-drag, zoom with scroll/pinch, `F` fits the viewport, `Z` zooms to selection — behaviour is indistinguishable from the workflow canvas
3. User can multi-select with drag-rectangle marquee, `Shift`-click (add), `Cmd`/`Ctrl`-click (toggle), `Cmd`/`Ctrl`-A (select all visible), `Esc` (clear)
4. Left Settings panel is open by default on workspace entry and auto-collapses on the first canvas interaction (pan / zoom / click)

**Plans:** 6 plans (5 core + 1 gap closure)

- [x] 01-01-PLAN.md — Regression harness + extract pure `useCanvasInput` composable (D-07/D-08)
- [x] 01-02-PLAN.md — Install Pixi deps, `/moshpit` route, MoshpitLayout, `<keep-alive>` wiring, menu entries
- [x] 01-03-PLAN.md — Moshpit Pinia stores (viewport/selection/sidebar) + PixiJS Application + pixi-viewport adapter
- [x] 01-04-PLAN.md — Marquee composable + Moshpit keybindings (F/Z/Cmd+A/Esc) + keyboard-scoped commands
- [x] 01-05-PLAN.md — MoshpitSideRail + Settings panel + Storybook + `@moshpit` Playwright specs (SHELL-05 proof)
- [x] 01-06-PLAN.md — Gap closure: rename `useMoshpitCanvasInput` → `useMoshpitSpacePan`, remove dead `useCanvasInput` wiring, record SC-2 resolution in CONTEXT.md / VERIFICATION.md (SHELL-03)

**UI hint**: yes

### Phase 2: Asset Pipeline

**Goal**: The generated-only `AssetItem` stream is converted into 512px WebP thumbnails via a Web Worker, cached in IndexedDB by content hash, and progressively rendered onto the canvas without blocking interaction; assets without ComfyUI metadata are excluded and surfaced as a count.
**Depends on**: Phase 1
**Requirements**: ASSET-01, ASSET-02, ASSET-03, ASSET-04, ASSET-05, ASSET-06, ASSET-07, ASSET-08, ASSET-09, ASSET-10
**Success Criteria** (what must be TRUE):

1. After an initial filter is set, sprites appear progressively on the canvas; canvas stays interactive (60fps pan/zoom) during processing
2. A docked `Processing N / M` indicator with a cancel affordance is visible during cold-cache processing; re-entering the workspace resumes cancelled work
3. On a warm cache, the canvas populates in a single frame with no processing indicator
4. After processing completes, the layout re-packs to close holes left by metadata-excluded assets; a "N assets excluded: no metadata" count is visible in the Settings panel
5. Curation state (favourite/tag/folder/hidden) and thumbnail blobs persist in IndexedDB keyed by asset content hash and are reused across sessions

**Plans:** 12 plans

- [x] 02-01-foundation-PLAN.md — Install `idb` + `fake-indexeddb`, register in vitest setup, ship 5 Wave-0 RED test stubs
- [x] 02-02-content-hash-PLAN.md — Pure hash + PRNG utilities (`fnv1a`, `mulberry32`, `layoutSeedHash`, `sha256Hex`) — worker-safe leaf module
- [x] 02-03-layout-math-PLAN.md — Jittered-grid + packed-grid pure functions (D-01, D-03, D-04 math)
- [x] 02-04-thumb-repository-PLAN.md — IndexedDB repository with `thumbs` + `assetMeta` stores (idb v7; Phase 5 curation-ready)
- [x] 02-05-thumb-worker-PLAN.md — Web Worker: fetch → metadata parse → resize → WebP encode → SHA-256 (ASSET-02/05/07); discriminated-union message contract
- [x] 02-06-worker-bridge-PLAN.md — Main-thread bridge: IDB write routing + stale-filter guard + `runWhenGlobalIdle` dispatch
- [x] 02-07-pinia-stores-PLAN.md — `moshpitThumbStore` (object-URL cache) + `moshpitMetadataStore` (excludedCount) + `moshpitCurationStore` (Phase 5 scaffold)
- [x] 02-08-processing-queue-PLAN.md — `useMoshpitProcessingQueue` composable (diff, enqueue, cancel, filter-change) + `useMoshpitAssetRegistry`
- [x] 02-09-processing-indicator-PLAN.md — `MoshpitProcessingIndicator.vue` pill (ASSET-07/08) + six `moshpit.assets.*` i18n keys + `MoshpitLayout.vue` wire
- [x] 02-10-excluded-count-row-PLAN.md — `MoshpitSettingsPanel.vue` excluded-count row + info tooltip (ASSET-05/06)
- [x] 02-11-canvas-sprites-and-tween-PLAN.md — `useMoshpitSpriteLayer` composable: sprites under viewport + 300ms ease-out-cubic re-pack tween (ASSET-02/07/09) [human checkpoint]
- [x] 02-12-e2e-and-validation-map-PLAN.md — `@moshpit` Playwright spec + helper extension + VALIDATION.md Per-Task Verification Map populated [human checkpoint]

**UI hint**: yes

### Phase 3: Filter & Sort (Core Validation) — _Shipped, Sort Superseded_

**Goal** _(original)_: User can gate the canvas with an initial workflow + time-range filter, progressively add subtractive filter chips across the hardcoded parameter list, and arrange the visible set spatially via 1D-with-packing or 2D-scatter sort — proving whether spatial-sort-by-parameter is a valuable reasoning surface.

**Outcome**: Filter gate + subtractive chips shipped and validated. Spatial parameter sort shipped but invalidated by dogfooding — led to the v3 curation pivot (2026-04-21). Sort UI is deprecated and will be removed in Phase 4; sort math primitives (`sortMath`) remain in the codebase for potential reuse by grouping layout.

**Depends on**: Phase 2
**Requirements**: FILTER-01..11, SORT-01..05 (SORT-01..03 deprecated post-ship)

**Plans:** 11/11 plans complete

- [x] 03-01-PLAN.md — Pure paramNormalize + NormalizedParamsSchema + extractWorkflowFilename (FILTER-02/03/04/05/06/09 foundation)
- [x] 03-02-PLAN.md — Pure filterMath predicates + filterTypes domain (FILTER-02/03/04/05/06/07/08/09/11)
- [x] 03-03-PLAN.md — Pure sortMath 1D/2D layout with row-band accumulation (SORT-01/02/03/04/05)
- [x] 03-04-PLAN.md — IDB schema v2 bump + v1→v2 migration (FILTER-02..09)
- [x] 03-05-PLAN.md — Worker/bridge/store wiring for params + AssetItem timestamp overwrite (FILTER-02..09)
- [x] 03-06-PLAN.md — moshpitFilterStore + useMoshpitFilteredAssets + sprite layer layoutProvider (FILTER-01/08/10/11, SORT-01..05)
- [x] 03-07-PLAN.md — i18n + MoshpitWorkflowPicker (ICU-only labels, workflowFilename displayName) + MoshpitTimeRangePicker (FILTER-01, FILTER-06)
- [x] 03-08-PLAN.md — MoshpitFilterChipRow + MoshpitAddFilterPopover shell + 5 value editor sub-components (FILTER-02/03/04/05/07/10)
- [x] 03-09-PLAN.md — MoshpitSortControls + grid spacing + show-hidden toggle (SORT-01/02/04, FILTER-11)
- [x] 03-10-PLAN.md — MoshpitAxisOverlay + viewport injection key (SORT-01/02)
- [x] 03-11-PLAN.md — Settings panel composition + Playwright + HUMAN-UAT + VALIDATION map [human checkpoint]

**UI hint**: yes

### Phase 4: Lineage Groupings & Within-Cluster Sort _(new — replaces old Phase 4 Comparison Mode)_

**Goal**: Replace the deprecated parameter-sort UI with lineage-based spatial clustering. User can enable any combination of grouping axes (workflow, save node, prompt, model, type), see clusters auto-nest by bucket density, and control within-cluster order via a single dropdown. Primary filter surface is lineage-first; parameter filters move behind an Advanced disclosure. The old 1D/2D sort controls are removed.
**Depends on**: Phase 3 (filter pipeline, sort math primitives available for reuse)
**Requirements**: GROUP-01..10, CSORT-01, FILTER-12
**Success Criteria** (what must be TRUE):

1. User can toggle any combination of `workflow`, `save node`, `prompt`, `model`, `type` groupings in the Settings panel; toggling instantly recomputes cluster layout with an animated transition under 400ms at 5k assets
2. When multiple groupings are active, nesting order is deterministic and auto-derived — the axis with the largest average bucket size nests outermost, applied recursively at every level
3. Assets missing a grouped parameter fall into an "(other)" cluster at that level rather than being hidden
4. Within each leaf cluster, assets arrange in a grid ordered by a user-selected within-cluster sort (newest first default, oldest first, alphabetical by filename)
5. Primary filter surface shows lineage filters (workflow, prompt, save node, model, time, favourite, hidden, tag); parameter filters (CFG, steps, seed, sampler, scheduler, resolution, LoRA, negative prompt) live behind an Advanced disclosure
6. The deprecated 1D/2D parameter sort UI (MoshpitSortControls axis pickers, MoshpitAxisOverlay) is removed from the Settings panel; sort math primitives remain available for reuse by cluster layout

**Plans:** 6 plans

- [x] 04-01-PLAN.md — Pure math: groupAxes + clusterLayout + sortMath Phase 4 reuse note (GROUP-02/03/05/06/07/08/10, CSORT-01 math)
- [x] 04-02-PLAN.md — paramNormalize.saveNodeIdentity + IDB v2→v3 migration (GROUP-04, D-08, D-11)
- [x] 04-03-PLAN.md — filterTypes saveNode + moshpitFilterStore refactor + useMoshpitFilteredAssets cluster wiring (GROUP-01/09, CSORT-01, FILTER-12)
- [x] 04-04-PLAN.md — Settings-panel UI: MoshpitGroupingToggles + MoshpitWithinClusterSort + MoshpitAdvancedFilters + chip-row tier prop + popover split + i18n (GROUP-01, CSORT-01, FILTER-12)
- [x] 04-05-PLAN.md — MoshpitClusterOverlay HTML-over-Pixi bounding boxes + labels (GROUP-01/02)
- [ ] 04-06-PLAN.md — Settings panel composition + canvas overlay swap + sort-UI deletions + i18n cleanup + HUMAN-UAT + VALIDATION + @moshpit spec [human checkpoint]

**UI hint**: yes

### Phase 5: Tournament Mode _(replaces old Comparison Mode framing)_

**Goal**: User can enter tournament mode from a selection of ≥2 assets, step through pairwise comparisons using three display modes ([/] cycles side-by-side / overlap / A/B flip), pick winners with `←`/`→` (or skip with `↓`), and exit with the winner set selected on the canvas for export or foldering. Scores are ephemeral; no persisted elo or leaderboards. An optional metadata peek (`M`) surfaces parameter diffs on demand.
**Depends on**: Phase 4 (canvas selection, cluster layout stable)
**Requirements**: TOUR-01..08, PEEK-01..03
**Success Criteria** (what must be TRUE):

1. With ≥2 assets selected, `Enter` opens tournament mode; `Esc` exits with the canvas selection preserved
2. Three display modes accessible via `[` / `]`: side-by-side, overlap (opacity / wipe), A/B flip; `Space` triggers an A/B flip in any mode
3. User picks the winner of each pair via `←` (left/A) or `→` (right/B); `↓` advances without picking
4. Exit produces a winner set selected on the canvas — user can immediately export (`E`), favourite (`S`), tag (`T`), or folder-assign the winners
5. No tournament scores, elo, or bracket state persist across sessions — tournaments are per-session only
6. Metadata peek is hidden by default; `M` toggles an overlay showing automatic parameter diff including LoRA set-diff (name-based, order-insensitive)
7. Full-resolution assets load on tournament entry within the Phase 7 perf budget

**Plans**: TBD
**UI hint**: yes

### Phase 6: Curation _(was Phase 5)_

**Goal**: User can favourite, tag, folder-assign, soft-delete (hide), and export selected assets via right-click or keyboard shortcuts; every bulk curation action produces an ~8s toast undo. Folders become the way to persist shortlists for later tournamenting.
**Depends on**: Phase 2 (IndexedDB store), Phase 1 (selection), Phase 5 (tournament winner set feeds export / folder)
**Requirements**: CURATE-01, CURATE-02, CURATE-03, CURATE-04, CURATE-05, CURATE-06, CURATE-07
**Success Criteria** (what must be TRUE):

1. User can favourite/unfavourite (`S`), tag (`T`), hide/unhide (`H`), add to user-defined folders, and export at full resolution (`E`) via right-click or keyboard — actions apply to the current selection
2. Tag, untag, hide, unhide, folder add/remove, and bulk favourite each fire a toast with an Undo button; `Cmd`/`Ctrl`-Z within the ~8s toast window reverses the action
3. Curation state persists across sessions (content-hash keyed in IndexedDB) and is respected by the filter system (tags become filterable, hidden defaults off)
4. Hidden assets remain on disk — no real deletion in v1
5. Folders can be created from a tournament winner set in one action

**Plans**: TBD
**UI hint**: yes

### Phase 7: UX Edges & Performance Validation _(unchanged from old Phase 7; old Phase 6 cut)_

**Goal**: All four empty states render correctly, user-facing actions are keyboard-reachable and screen-reader-legible, and the 5k-asset performance budget is demonstrably met (60fps pan/zoom, <2s first thumb cold, <3s warm populate, <500ms warm full-res, <400ms grouping recompute).
**Depends on**: Phases 1–6 (validation is end-to-end)
**Requirements**: UX-01..10
**Success Criteria** (what must be TRUE):

1. User sees the correct empty state in each condition: no initial filter, zero-match initial filter, narrowed-to-zero mid-session (with "remove last filter" affordance on the most recent chip), and all-hidden (with "show hidden" toggle)
2. At 5,000 assets steady-state, pan/zoom sustains 60fps and zoom-to-detail transitions complete within 200ms
3. At 5,000 assets cold start, the first thumbnail is visible within 2s of the initial filter and all thumbnails render within 60s; warm start populates within 3s; tournament entry full-res loads within 500ms warm / 2s cold
4. Grouping toggle recompute + animation completes within 400ms at 5k assets
5. All user actions (filter, group, tournament, curate, export) are reachable and legible via keyboard and screen reader through the Settings panel, tournament UI, and curation dialogs

**Plans**: TBD
**UI hint**: yes

## Progress

| Phase                                      | Plans Complete | Status                     | Completed  |
| ------------------------------------------ | -------------- | -------------------------- | ---------- |
| 1. Workspace Shell & Canvas Navigation     | 6/6            | Complete                   | 2026-04-20 |
| 2. Asset Pipeline                          | 12/12          | Complete                   | 2026-04-20 |
| 3. Filter & Sort (Core Validation)         | 11/11          | Complete (sort deprecated) | 2026-04-20 |
| 4. Lineage Groupings & Within-Cluster Sort | 0/?            | Not started                | -          |
| 5. Tournament Mode                         | 0/?            | Not started                | -          |
| 6. Curation                                | 0/?            | Not started                | -          |
| 7. UX Edges & Performance Validation       | 0/?            | Not started                | -          |

## Coverage

- v1 requirements: 74 total (SHELL 5 + NAV 5 + ASSET 10 + FILTER 12 + SORT 5 + GROUP 10 + CSORT 1 + TOUR 8 + PEEK 3 + CURATE 7 + UX 10)
- Mapped to phases: 74 ✓
- Unmapped: 0 ✓
- Deprecated post-ship: 3 (SORT-01, SORT-02, SORT-03)

## Notes

- **v3 pivot (2026-04-21).** The Core Value was reframed from "spatial-sort-by-parameter is valuable" to "lineage-grouped canvas + shortlist/tournament curation is valuable" after Phase 3 shipped. See `temp/plans/moshpit_prd.md` v3 for the full PRD. Phases 1 and 2 survive unchanged; Phase 3 shipped but sort axes are deprecated; Phases 4–7 are reorganised (old Comparison Mode → Tournament Mode, old Curation renumbered, old Generate More Like This cut).
- **Phase 4 is the new validation milestone.** Lineage groupings + within-cluster sort is where the v3 Core Value is answered or falsified. Phase 5 and beyond are only worth building if Phase 4 clicks on real dogfooding.
- **PixiJS is shipped.** Viewport, sprite layer, mipmap LOD, and pan/zoom parity are established in Phases 1–2.
- **No entity-class modifications.** `LGraphNode`, `LGraphCanvas`, `LGraph`, `Subgraph` are off-limits (ADR 0003/0008). The shared input composable is an extraction of reusable pointer/viewport math out of `useCanvasInteractions`, not a modification of litegraph.
- **Curation relies on Phase 2 IndexedDB.** Phase 6 builds on the IndexedDB store already shipped in Phase 2 (thumbs + curation scaffold already in place via `moshpitCurationStore`).
- **Generate More Like This cut from v1.** Reinstated as v2-GEN-01/02 for a future milestone; out of v1 scope to keep the pivot focused on filter → group → shortlist → tournament → export.
- **Tournament math primitives shipped.** The `sortMath` module from Phase 3 is deprecated in terms of UI but its pure-function layout primitives may be reused by Phase 4's cluster layout.

---

_Roadmap created: 2026-04-20_
_Updated: 2026-04-20 — Phase 2 plan list populated (12 plans across 5 waves)_
_Pivoted: 2026-04-21 — v3 curation pivot. Phases 4–7 reorganised; old Comparison Mode → Tournament Mode; old Curation renumbered to Phase 6; old Generate More Like This phase cut._
