# Requirements: Moshpit (ComfyUI Autocanvas)

**Defined:** 2026-04-20
**Pivoted:** 2026-04-21 (PRD v3 — curation-first framing)
**Core Value:** Prove that a lineage-grouped spatial canvas with shortlist-then-tournament curation is a faster, more intuitive way to pick the best generations from a large set.

## v1 Requirements

### Workspace Shell

- [x] **SHELL-01**: User can open Moshpit as a top-level workspace, peer of the workflow graph, not scoped to any open workflow
- [x] **SHELL-02**: Moshpit renders a full-bleed PixiJS canvas with no node-style chrome around assets
- [x] **SHELL-03**: Canvas pan, zoom, and selection behaviour is indistinguishable from the workflow canvas via a shared input composable
- [x] **SHELL-04**: Left Settings panel is mounted via the sidebar tab extension system, open by default on workspace entry, and auto-collapses on first canvas interaction (pan / zoom / click)
- [x] **SHELL-05**: User can exit Moshpit and resume their previous workflow graph unchanged

### Asset Ingestion and Thumbnails

- [x] **ASSET-01**: Moshpit consumes the existing generated-output `AssetItem` stream; imported / user-uploaded assets are not included
- [x] **ASSET-02**: A Web Worker generates one 512px WebP thumbnail per asset from full-res via `createImageBitmap` and OffscreenCanvas
- [x] **ASSET-03**: Thumbnails persist in IndexedDB keyed by asset content hash, reused across sessions
- [x] **ASSET-04**: Curation state (favourite, tags, folders, hidden) persists in the same IndexedDB store, content-hash keyed
- [x] **ASSET-05**: Assets without parseable ComfyUI metadata are excluded entirely from the Moshpit (never rendered)
- [x] **ASSET-06**: Settings panel surfaces a count of excluded assets so users understand why a file they expected is missing
- [x] **ASSET-07**: Thumbnail generation is progressive and non-blocking — canvas stays at 60fps pan/zoom during processing
- [x] **ASSET-08**: A docked progress indicator shows `Processing N / M` with a cancel affordance; cancelled processing is resumable on re-entry
- [x] **ASSET-09**: Initial random-placement layout is computed up-front; after processing completes, layout re-packs to close holes from excluded assets
- [x] **ASSET-10**: Warm IndexedDB cache skips the progress indicator entirely — canvas populates in one frame

### Filtering (Phase 3 shipped; refactor planned for Phase 4)

- [x] **FILTER-01**: Initial filter gate requires workflow selector + time range (today / week / month / all / custom) before canvas populates
- [x] **FILTER-02**: User can filter by model (checkpoint)
- [x] **FILTER-03**: User can filter by LoRA (name + weight)
- [x] **FILTER-04**: User can filter by CFG, steps, sampler, scheduler, seed, resolution (width × height)
- [x] **FILTER-05**: User can filter by prompt and negative prompt via substring / keyword match
- [x] **FILTER-06**: User can filter by generation time
- [x] **FILTER-07**: User can filter by user-applied tags and favourite status
- [x] **FILTER-08**: Filtering is subtractive — non-matching assets are hidden entirely, not dimmed
- [x] **FILTER-09**: Assets lacking the filtered parameter are hidden
- [x] **FILTER-10**: Filter chips render in the Settings panel; clicking removes the chip
- [x] **FILTER-11**: Default filter set hides soft-deleted (hidden) assets; a "show hidden" toggle reveals them
- [x] **FILTER-12** _(new)_: Primary filter surface shows lineage-first filters (workflow, prompt, save node, model, time, favourite, hidden, tag); parameter filters (CFG, steps, seed, sampler, scheduler, resolution, LoRA, negative prompt) move behind an **Advanced** disclosure

### Sorting — Deprecated by v3 Pivot

SORT-01..05 shipped in Phase 3 but are superseded by lineage groupings. The UI will be removed as part of Phase 4; the math primitives remain available for potential reuse.

- [~] **SORT-01**: 1D parameter sort with vertical packing — _shipped, UI to be removed in Phase 4_
- [~] **SORT-02**: 2D parameter scatter — _shipped, UI to be removed in Phase 4_
- [~] **SORT-03**: Assets lacking the sorted parameter are hidden — _N/A under groupings; "(other)" cluster instead_
- [x] **SORT-04**: User can configure grid spacing between assets — _survives as cluster-spacing control_
- [x] **SORT-05**: All asset positioning is grid-snapped — _survives_

### Lineage Groupings _(new in v3)_

- [x] **GROUP-01**: User can enable any combination of grouping axes as non-exclusive toggles in the Settings panel
- [x] **GROUP-02**: Grouping nesting order is automatic — the axis with the largest average bucket size nests outermost, applied recursively at every level
- [x] **GROUP-03**: User can group by **workflow** (workflow filename from embedded metadata)
- [x] **GROUP-04**: User can group by **save node** (node id / name within the workflow that emitted the asset)
- [x] **GROUP-05**: User can group by **prompt** (normalised positive-prompt text — trim, lowercase, collapse whitespace)
- [x] **GROUP-06**: User can group by **model** (checkpoint)
- [x] **GROUP-07**: User can group by **type** (aspect class / resolution bucket — landscape / portrait / square)
- [x] **GROUP-08**: Assets missing a grouped parameter fall into an "(other)" cluster at that level (not hidden)
- [x] **GROUP-09**: Groupings are separate from filters — filters cull the set, groups organise what remains
- [x] **GROUP-10**: Cluster layout recompute and tween complete within 400ms on grouping toggle at 5k assets

### Within-Cluster Sort _(new in v3)_

- [x] **CSORT-01**: Settings panel offers a single dropdown controlling within-cluster order: newest first (default), oldest first, alphabetical by filename; applies globally across all leaf clusters

### Canvas Navigation

- [x] **NAV-01**: User can pan the canvas with `Space`-drag and zoom with scroll/pinch
- [x] **NAV-02**: User can fit all assets to viewport (`F`) and zoom to selection (`Z`)
- [x] **NAV-03**: User can multi-select via drag-rectangle marquee
- [x] **NAV-04**: User can add to selection with `Shift`-click and toggle individual selection with `Cmd`/`Ctrl`-click
- [x] **NAV-05**: User can select all visible assets with `Cmd`/`Ctrl`-A and clear selection with `Esc`

### Tournament Mode _(replaces old Comparison Mode)_

- [ ] **TOUR-01**: User can enter tournament mode from a selection of ≥2 assets via `Enter`
- [x] **TOUR-02**: User can switch between three display modes via `[` / `]`: side-by-side, overlap (opacity slider / wipe), A/B flip
- [x] **TOUR-03**: User picks winner of each pair via `←` (left/A) or `→` (right/B); `↓` skips/advances without picking
- [ ] **TOUR-04**: `Space` triggers an A/B flip toggle in any display mode
- [x] **TOUR-05**: Tournament is **ephemeral** — no scores, elo, or leaderboards persist across sessions
- [x] **TOUR-06**: Tournament exit produces a winner set selected on the canvas; user exports or folders them manually
- [x] **TOUR-07**: User can exit tournament mode via `Esc`, canvas selection preserved
- [ ] **TOUR-08**: Full-resolution assets load on tournament entry (not on hover, not on high zoom)

### Metadata Peek _(replaces auto-open metadata panel)_

- [ ] **PEEK-01**: Tournament mode shows no metadata panel by default — pure pixels for quality judgment
- [ ] **PEEK-02**: `M` toggles an overlay showing all parameters for both assets; matching parameters render plainly, differing parameters render highlighted
- [ ] **PEEK-03**: List-valued parameters (LoRAs) render as a set diff — name-based, order-insensitive — with added / removed / weight-changed callouts

### Curation

- [ ] **CURATE-01**: User can favourite / unfavourite selected assets via right-click or `S`
- [ ] **CURATE-02**: User can add free-text tags to selected assets via right-click or `T`; tags become filterable
- [ ] **CURATE-03**: User can add selected assets to user-defined folders; folders are a curation layer, not filesystem moves — and the way to persist a shortlist for later tournamenting
- [ ] **CURATE-04**: User can hide / unhide selected assets via right-click or `H`; hidden assets are filtered from default view but remain on disk
- [ ] **CURATE-05**: User can export selected assets at full resolution via right-click or `E`
- [ ] **CURATE-06**: Curation actions (tag, untag, hide, unhide, folder add/remove, bulk favourite) trigger a toast with an ~8s Undo button
- [ ] **CURATE-07**: `Cmd`/`Ctrl`-Z within the toast window undoes the last curation action; after the toast fades, actions are permanent

### UX Edges and Performance

- [ ] **UX-01**: Canvas shows a "pick a workflow and time range to start" empty state before the initial filter is applied
- [ ] **UX-02**: Canvas shows a "no assets match this filter" empty state when the initial filter matches zero assets, with filter chips still editable
- [ ] **UX-03**: When filters narrow the set to zero mid-session, the canvas shows "no assets match" with the most recent filter chip highlighted and a one-click "remove last filter" affordance
- [ ] **UX-04**: When the current filter set includes `hidden:false` and all matching assets are hidden, the canvas shows "all matching assets are hidden" with a "show hidden" toggle
- [ ] **UX-05**: At 5,000 assets steady-state, pan/zoom sustains 60fps and zoom-to-detail transitions complete within 200ms
- [ ] **UX-06**: At 5,000 assets cold start, the first thumbnail is visible within 2s of the initial filter; all thumbnails render within 60s
- [ ] **UX-07**: At 5,000 assets warm start (full IndexedDB cache hit), the canvas is fully populated within 3s
- [ ] **UX-08**: Full-res asset load on tournament entry completes within 500ms on a warm HTTP cache, 2s cold
- [ ] **UX-09**: All user actions (filter, group, tournament, curate, export) are keyboard-reachable and screen-reader-legible; canvas itself is a visual-only surface
- [ ] **UX-10** _(new)_: Grouping toggle recompute + animation completes within 400ms at 5k assets (duplicates GROUP-10 for UX-bucket tracking)

## Removed in v3 Pivot

### Comparison Mode — Superseded by Tournament

The original COMPARE-01..08 requirements are reframed as TOUR-01..08 + PEEK-01..03. The key shifts:

- Pinned + rotating navigation (old COMPARE-03) is replaced with pairwise winner selection (TOUR-03)
- Auto-open metadata panel (old COMPARE-05/06) is replaced with opt-in peek (PEEK-01..03)

### Generate More Like This — Cut from v1

GENMORE-01..06 are removed from v1 scope entirely. The "generate more from winners" interaction is a natural next step but out of prototype scope; re-admit post-v1 if dogfooding validates demand.

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Scale and Persistence

- **V2-SCALE-01**: Graceful degradation beyond 5,000 assets
- **V2-SCALE-02**: Sidecar metadata database with re-indexing
- **V2-SCALE-03**: Cloud-synced curation state across devices
- **V2-SCALE-04**: Thumbnail cache eviction (LRU / size cap)

### Generation _(reinstated post-pivot as v2)_

- **V2-GEN-01**: "Generate more like this" modal with live-parsed workflow JSON and heuristic parameter exposure
- **V2-GEN-02**: Real queue wiring for variations; per-run progress

### Tournament Evolution

- **V2-TOUR-01**: Persisted elo / ranking scores across sessions
- **V2-TOUR-02**: Named/saveable tournament brackets for repeat runs
- **V2-TOUR-03**: Cross-cluster tournament scoping (per-cluster "best of" instead of global)

### Workflow Intelligence

- **V2-WF-01**: Workflow grouping that detects "same workflow, different era" via graph hash or node-count heuristics
- **V2-WF-02**: Semantic prompt grouping (embedding-based similarity instead of exact/normalised match)
- **V2-WF-03**: Semantic prompt search beyond substring match

### Interaction Expansion

- **V2-UX-01**: Saved filter/group presets
- **V2-UX-02**: Contextual comparison-mode selection based on asset type
- **V2-UX-03**: Real deletion with full undo stack

## Out of Scope

| Feature                                                        | Reason                                                                                              |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Parameter-axis spatial sort (1D / 2D)                          | Shipped in Phase 3 but invalidated by v3 pivot — lineage groupings replace the framing entirely     |
| "Generate more like this" (mocked or real)                     | Cut from v1 scope; reinstated as v2-GEN-01                                                          |
| Persisted tournament scores / leaderboards                     | Tournaments are per-session; artefact is the export, not a ranking                                  |
| Assets without ComfyUI metadata                                | Moshpit is "the set of parameterised artefacts" — Assets sidebar already serves "browse all files"  |
| Imported / user-uploaded assets                                | Moshpit is cross-workflow generation curation; imports would mostly fail metadata filters anyway    |
| Mobile / touch-primary usage                                   | Desktop-first posture; 250MB thumbnail cache alone exceeds mobile browser quotas                    |
| Full canvas a11y parity                                        | Canvas is a visual-only surface — actions remain fully keyboard-reachable via Settings / tournament |
| Telemetry / product analytics in v1                            | Validation via qualitative dogfooding; event maintenance cost without a dashboard isn't justified   |
| Modifications to LGraphNode / LGraphCanvas / LGraph / Subgraph | ADR 0003 + 0008, extension ecosystem impact on 40+ custom node repos                                |
| Sharing the litegraph renderer                                 | Node-graph coupled, 2D Canvas API, not designed for 5k sprite scale — share input composable only   |
| Semantic prompt search / grouping                              | Normalised-exact match is sufficient for v1 validation                                              |
| Performance targets beyond 5k assets                           | v1 proves the interaction, not the scale — degradation beyond 5k is unbounded and undocumented      |

## Traceability

| Requirement | Phase | Status                |
| ----------- | ----- | --------------------- |
| SHELL-01    | 1     | Complete              |
| SHELL-02    | 1     | Complete              |
| SHELL-03    | 1     | Complete              |
| SHELL-04    | 1     | Complete              |
| SHELL-05    | 1     | Complete              |
| NAV-01      | 1     | Complete              |
| NAV-02      | 1     | Complete              |
| NAV-03      | 1     | Complete              |
| NAV-04      | 1     | Complete              |
| NAV-05      | 1     | Complete              |
| ASSET-01    | 2     | Complete              |
| ASSET-02    | 2     | Complete              |
| ASSET-03    | 2     | Complete              |
| ASSET-04    | 2     | Complete              |
| ASSET-05    | 2     | Complete              |
| ASSET-06    | 2     | Complete              |
| ASSET-07    | 2     | Complete              |
| ASSET-08    | 2     | Complete              |
| ASSET-09    | 2     | Complete              |
| ASSET-10    | 2     | Complete              |
| FILTER-01   | 3     | Complete              |
| FILTER-02   | 3     | Complete              |
| FILTER-03   | 3     | Complete              |
| FILTER-04   | 3     | Complete              |
| FILTER-05   | 3     | Complete              |
| FILTER-06   | 3     | Complete              |
| FILTER-07   | 3     | Complete              |
| FILTER-08   | 3     | Complete              |
| FILTER-09   | 3     | Complete              |
| FILTER-10   | 3     | Complete              |
| FILTER-11   | 3     | Complete              |
| FILTER-12   | 4     | Complete              |
| SORT-01     | 3     | Complete (deprecated) |
| SORT-02     | 3     | Complete (deprecated) |
| SORT-03     | 3     | Complete (deprecated) |
| SORT-04     | 3     | Complete              |
| SORT-05     | 3     | Complete              |
| GROUP-01    | 4     | Complete              |
| GROUP-02    | 4     | Complete              |
| GROUP-03    | 4     | Complete              |
| GROUP-04    | 4     | Complete              |
| GROUP-05    | 4     | Complete              |
| GROUP-06    | 4     | Complete              |
| GROUP-07    | 4     | Complete              |
| GROUP-08    | 4     | Complete              |
| GROUP-09    | 4     | Complete              |
| GROUP-10    | 4     | Complete              |
| CSORT-01    | 4     | Complete              |
| TOUR-01     | 5     | Pending               |
| TOUR-02     | 5     | Complete              |
| TOUR-03     | 5     | Complete              |
| TOUR-04     | 5     | Pending               |
| TOUR-05     | 5     | Complete              |
| TOUR-06     | 5     | Complete              |
| TOUR-07     | 5     | Complete              |
| TOUR-08     | 5     | Pending               |
| PEEK-01     | 5     | Pending               |
| PEEK-02     | 5     | Pending               |
| PEEK-03     | 5     | Pending               |
| CURATE-01   | 6     | Pending               |
| CURATE-02   | 6     | Pending               |
| CURATE-03   | 6     | Pending               |
| CURATE-04   | 6     | Pending               |
| CURATE-05   | 6     | Pending               |
| CURATE-06   | 6     | Pending               |
| CURATE-07   | 6     | Pending               |
| UX-01       | 7     | Pending               |
| UX-02       | 7     | Pending               |
| UX-03       | 7     | Pending               |
| UX-04       | 7     | Pending               |
| UX-05       | 7     | Pending               |
| UX-06       | 7     | Pending               |
| UX-07       | 7     | Pending               |
| UX-08       | 7     | Pending               |
| UX-09       | 7     | Pending               |
| UX-10       | 7     | Pending               |

**Coverage:**

- v1 requirements: 74 total (SHELL 5 + NAV 5 + ASSET 10 + FILTER 12 + SORT 5 + GROUP 10 + CSORT 1 + TOUR 8 + PEEK 3 + CURATE 7 + UX 10)
- Mapped to phases: 74 ✓
- Unmapped: 0 ✓
- Deprecated (shipped, superseded): 3 (SORT-01, SORT-02, SORT-03)
- Cut from v1 (moved to v2 or out of scope): 8 (old COMPARE-03 dropped; GENMORE-01..06 cut; the remaining COMPARE requirements reframed as TOUR / PEEK)

---

_Requirements defined: 2026-04-20_
_Pivoted: 2026-04-21 — PRD v3 (lineage grouping + tournament). Phases 1–3 marked Complete; SORT axes marked deprecated; GROUP, CSORT, TOUR, PEEK categories added; GENMORE cut; COMPARE reframed._
