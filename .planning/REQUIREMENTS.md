# Requirements: Moshpit (ComfyUI Autocanvas)

**Defined:** 2026-04-20
**Core Value:** Prove that spatial-sort-by-parameter is a valuable interaction for reasoning about generation output.

## v1 Requirements

### Workspace Shell

- [ ] **SHELL-01**: User can open Moshpit as a top-level workspace, peer of the workflow graph, not scoped to any open workflow
- [ ] **SHELL-02**: Moshpit renders a full-bleed PixiJS canvas with no node-style chrome around assets
- [ ] **SHELL-03**: Canvas pan, zoom, and selection behaviour is indistinguishable from the workflow canvas via a shared input composable
- [ ] **SHELL-04**: Left Settings panel is mounted via the sidebar tab extension system, open by default on workspace entry, and auto-collapses on first canvas interaction (pan / zoom / click)
- [ ] **SHELL-05**: User can exit Moshpit and resume their previous workflow graph unchanged

### Asset Ingestion and Thumbnails

- [ ] **ASSET-01**: Moshpit consumes the existing generated-output `AssetItem` stream; imported / user-uploaded assets are not included
- [ ] **ASSET-02**: A Web Worker generates one 512px WebP thumbnail per asset from full-res via `createImageBitmap` and OffscreenCanvas
- [ ] **ASSET-03**: Thumbnails persist in IndexedDB keyed by asset content hash, reused across sessions
- [ ] **ASSET-04**: Curation state (favourite, tags, folders, hidden) persists in the same IndexedDB store, content-hash keyed
- [ ] **ASSET-05**: Assets without parseable ComfyUI metadata are excluded entirely from the Moshpit (never rendered)
- [ ] **ASSET-06**: Settings panel surfaces a count of excluded assets so users understand why a file they expected is missing
- [ ] **ASSET-07**: Thumbnail generation is progressive and non-blocking — canvas stays at 60fps pan/zoom during processing
- [ ] **ASSET-08**: A docked progress indicator shows `Processing N / M` with a cancel affordance; cancelled processing is resumable on re-entry
- [ ] **ASSET-09**: Initial random-placement layout is computed up-front; after processing completes, layout re-packs to close holes from excluded assets
- [ ] **ASSET-10**: Warm IndexedDB cache skips the progress indicator entirely — canvas populates in one frame

### Filtering

- [ ] **FILTER-01**: Initial filter gate requires workflow selector + time range (today / week / month / all / custom) before canvas populates
- [x] **FILTER-02**: User can filter by model (checkpoint)
- [x] **FILTER-03**: User can filter by LoRA (name + weight)
- [x] **FILTER-04**: User can filter by CFG, steps, sampler, scheduler, seed, resolution (width × height)
- [x] **FILTER-05**: User can filter by prompt and negative prompt via substring / keyword match
- [ ] **FILTER-06**: User can filter by generation time
- [x] **FILTER-07**: User can filter by user-applied tags and favourite status
- [ ] **FILTER-08**: Filtering is subtractive — non-matching assets are hidden entirely, not dimmed
- [ ] **FILTER-09**: Assets lacking the filtered parameter are hidden
- [x] **FILTER-10**: Filter chips render in the Settings panel; clicking removes the chip
- [ ] **FILTER-11**: Default filter set hides soft-deleted (hidden) assets; a "show hidden" toggle reveals them

### Sorting

- [ ] **SORT-01**: User can apply 1D sort with vertical packing (parameter → X-axis columns, Y-axis packs to fit)
- [ ] **SORT-02**: User can apply 2D parameter scatter (parameter → X-axis, parameter → Y-axis)
- [ ] **SORT-03**: Assets lacking the sorted parameter are hidden
- [ ] **SORT-04**: User can configure grid spacing between assets
- [ ] **SORT-05**: All asset positioning is grid-snapped

### Canvas Navigation

- [ ] **NAV-01**: User can pan the canvas with `Space`-drag and zoom with scroll/pinch
- [ ] **NAV-02**: User can fit all assets to viewport (`F`) and zoom to selection (`Z`)
- [ ] **NAV-03**: User can multi-select via drag-rectangle marquee
- [ ] **NAV-04**: User can add to selection with `Shift`-click and toggle individual selection with `Cmd`/`Ctrl`-click
- [ ] **NAV-05**: User can select all visible assets with `Cmd`/`Ctrl`-A and clear selection with `Esc`

### Comparison Mode

- [ ] **COMPARE-01**: User can enter comparison mode from a selection of ≥2 assets via `Enter`
- [ ] **COMPARE-02**: User can switch between three comparison modes via `[` / `]`: side-by-side, overlap (opacity slider / wipe), A/B flip
- [ ] **COMPARE-03**: Navigation is pinned + rotating — the first-selected asset is pinned on the left, `←` / `→` rotate the right slot through the remaining selection
- [ ] **COMPARE-04**: `Space` triggers an A/B flip toggle in any comparison mode
- [ ] **COMPARE-05**: A synced metadata panel lists all parameters for both assets; matching parameters render plainly, differing parameters render highlighted
- [ ] **COMPARE-06**: List-valued parameters (LoRAs) render as a set diff — name-based, order-insensitive — with added / removed / weight-changed callouts
- [ ] **COMPARE-07**: User can exit comparison mode via `Esc`, canvas selection preserved
- [ ] **COMPARE-08**: Full-resolution assets load on comparison entry (not on hover, not on high zoom)

### Curation

- [ ] **CURATE-01**: User can favourite / unfavourite selected assets via right-click or `S`
- [ ] **CURATE-02**: User can add free-text tags to selected assets via right-click or `T`; tags become filterable
- [ ] **CURATE-03**: User can add selected assets to user-defined folders; folders are a curation layer, not filesystem moves
- [ ] **CURATE-04**: User can hide / unhide selected assets via right-click or `H`; hidden assets are filtered from default view but remain on disk
- [ ] **CURATE-05**: User can export selected assets at full resolution via right-click or `E`
- [ ] **CURATE-06**: Curation actions (tag, untag, hide, unhide, folder add/remove, bulk favourite) trigger a toast with an ~8s Undo button
- [ ] **CURATE-07**: `Cmd`/`Ctrl`-Z within the toast window undoes the last curation action; after the toast fades, actions are permanent

### Generate More Like This (Mocked)

- [ ] **GENMORE-01**: Right-clicking a single asset surfaces a "Generate more like this" action that opens a modal
- [ ] **GENMORE-02**: Modal live-parses the source asset's embedded workflow JSON via `getFromPngBuffer`
- [ ] **GENMORE-03**: Modal exposes tweakable parameters via heuristic (KSampler widgets, LoRA strengths) rendered as sliders / inputs / dropdowns initialised from the asset's values
- [ ] **GENMORE-04**: Modal shows a "queue N variations" input (default 4–8)
- [ ] **GENMORE-05**: Queue button is non-executing — no backend call, no event logging
- [ ] **GENMORE-06**: If the heuristic fails to parse tweakable parameters, the modal shows a fallback message rather than stubbed fake fields

### UX Edges and Performance

- [ ] **UX-01**: Canvas shows a "pick a workflow and time range to start" empty state before the initial filter is applied
- [ ] **UX-02**: Canvas shows a "no assets match this filter" empty state when the initial filter matches zero assets, with filter chips still editable
- [ ] **UX-03**: When filters narrow the set to zero mid-session, the canvas shows "no assets match" with the most recent filter chip highlighted and a one-click "remove last filter" affordance
- [ ] **UX-04**: When the current filter set includes `hidden:false` and all matching assets are hidden, the canvas shows "all matching assets are hidden" with a "show hidden" toggle
- [ ] **UX-05**: At 5,000 assets steady-state, pan/zoom sustains 60fps and zoom-to-detail transitions complete within 200ms
- [ ] **UX-06**: At 5,000 assets cold start, the first thumbnail is visible within 2s of the initial filter; all thumbnails render within 60s
- [ ] **UX-07**: At 5,000 assets warm start (full IndexedDB cache hit), the canvas is fully populated within 3s
- [ ] **UX-08**: Full-res asset load on comparison entry completes within 500ms on a warm HTTP cache, 2s cold
- [ ] **UX-09**: All user actions (filter, sort, compare, curate, export, "generate more") are keyboard-reachable and screen-reader-legible; canvas itself is a visual-only surface

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Scale and Persistence

- **V2-SCALE-01**: Graceful degradation beyond 5,000 assets
- **V2-SCALE-02**: Sidecar metadata database with re-indexing
- **V2-SCALE-03**: Cloud-synced curation state across devices
- **V2-SCALE-04**: Thumbnail cache eviction (LRU / size cap)

### Generation

- **V2-GEN-01**: Real "Generate more like this" wired to the queue backend
- **V2-GEN-02**: Variations queue UI with per-run progress

### Workflow Intelligence

- **V2-WF-01**: Workflow grouping that detects "same workflow, different era" via graph hash or node-count heuristics
- **V2-WF-02**: Semantic prompt search beyond substring match

### Interaction Expansion

- **V2-UX-01**: Saved filter/sort presets
- **V2-UX-02**: Contextual comparison-mode selection based on asset type and sort
- **V2-UX-03**: Real deletion with full undo stack

## Out of Scope

| Feature                                                        | Reason                                                                                              |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Assets without ComfyUI metadata                                | Moshpit is "the set of parameterised artefacts" — Assets sidebar already serves "browse all files"  |
| Imported / user-uploaded assets                                | Moshpit is cross-workflow generation curation; imports would mostly fail metadata filters anyway    |
| Mobile / touch-primary usage                                   | Desktop-first posture; 250MB thumbnail cache alone exceeds mobile browser quotas                    |
| Full canvas a11y parity                                        | Canvas is a visual-only surface — actions remain fully keyboard-reachable via Settings / comparison |
| Telemetry / product analytics in v1                            | Validation via qualitative dogfooding; event maintenance cost without a dashboard isn't justified   |
| Modifications to LGraphNode / LGraphCanvas / LGraph / Subgraph | ADR 0003 + 0008, extension ecosystem impact on 40+ custom node repos                                |
| Sharing the litegraph renderer                                 | Node-graph coupled, 2D Canvas API, not designed for 5k sprite scale — share input composable only   |
| Semantic prompt search                                         | Substring / keyword is sufficient for v1 validation of the sort/compare interaction                 |
| Performance targets beyond 5k assets                           | v1 proves the interaction, not the scale — degradation beyond 5k is unbounded and undocumented      |

## Traceability

| Requirement | Phase | Status  |
| ----------- | ----- | ------- |
| SHELL-01    | 1     | Pending |
| SHELL-02    | 1     | Pending |
| SHELL-03    | 1     | Pending |
| SHELL-04    | 1     | Pending |
| SHELL-05    | 1     | Pending |
| ASSET-01    | 2     | Pending |
| ASSET-02    | 2     | Pending |
| ASSET-03    | 2     | Pending |
| ASSET-04    | 2     | Pending |
| ASSET-05    | 2     | Pending |
| ASSET-06    | 2     | Pending |
| ASSET-07    | 2     | Pending |
| ASSET-08    | 2     | Pending |
| ASSET-09    | 2     | Pending |
| ASSET-10    | 2     | Pending |
| FILTER-01   | 3     | Pending |
| FILTER-02   | 3     | Complete |
| FILTER-03   | 3     | Complete |
| FILTER-04   | 3     | Complete |
| FILTER-05   | 3     | Complete |
| FILTER-06   | 3     | Pending |
| FILTER-07   | 3     | Complete |
| FILTER-08   | 3     | Pending |
| FILTER-09   | 3     | Pending |
| FILTER-10   | 3     | Complete |
| FILTER-11   | 3     | Pending |
| SORT-01     | 3     | Pending |
| SORT-02     | 3     | Pending |
| SORT-03     | 3     | Pending |
| SORT-04     | 3     | Pending |
| SORT-05     | 3     | Pending |
| NAV-01      | 1     | Pending |
| NAV-02      | 1     | Pending |
| NAV-03      | 1     | Pending |
| NAV-04      | 1     | Pending |
| NAV-05      | 1     | Pending |
| COMPARE-01  | 4     | Pending |
| COMPARE-02  | 4     | Pending |
| COMPARE-03  | 4     | Pending |
| COMPARE-04  | 4     | Pending |
| COMPARE-05  | 4     | Pending |
| COMPARE-06  | 4     | Pending |
| COMPARE-07  | 4     | Pending |
| COMPARE-08  | 4     | Pending |
| CURATE-01   | 5     | Pending |
| CURATE-02   | 5     | Pending |
| CURATE-03   | 5     | Pending |
| CURATE-04   | 5     | Pending |
| CURATE-05   | 5     | Pending |
| CURATE-06   | 5     | Pending |
| CURATE-07   | 5     | Pending |
| GENMORE-01  | 6     | Pending |
| GENMORE-02  | 6     | Pending |
| GENMORE-03  | 6     | Pending |
| GENMORE-04  | 6     | Pending |
| GENMORE-05  | 6     | Pending |
| GENMORE-06  | 6     | Pending |
| UX-01       | 7     | Pending |
| UX-02       | 7     | Pending |
| UX-03       | 7     | Pending |
| UX-04       | 7     | Pending |
| UX-05       | 7     | Pending |
| UX-06       | 7     | Pending |
| UX-07       | 7     | Pending |
| UX-08       | 7     | Pending |
| UX-09       | 7     | Pending |

**Coverage:**

- v1 requirements: 66 total (enumerated)
- Mapped to phases: 66 ✓
- Unmapped: 0 ✓

_Note: earlier draft header stated "65 total" — the enumerated list contains 66 (9 categories: SHELL 5 + ASSET 10 + FILTER 11 + SORT 5 + NAV 5 + COMPARE 8 + CURATE 7 + GENMORE 6 + UX 9). All 66 are mapped._

---

_Requirements defined: 2026-04-20_
_Last updated: 2026-04-20 after roadmap creation — traceability populated_
