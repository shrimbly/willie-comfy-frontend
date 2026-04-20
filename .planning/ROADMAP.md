# Roadmap: Moshpit (ComfyUI Autocanvas)

**Created:** 2026-04-20
**Granularity:** standard
**Core Value:** Prove that spatial-sort-by-parameter is a valuable interaction for reasoning about generation output.

## Phases

- [ ] **Phase 1: Workspace Shell & Canvas Navigation** — Full-bleed Moshpit workspace mounts, pan/zoom/selection feel identical to workflow canvas, Settings panel slot is wired
- [ ] **Phase 2: Asset Pipeline** — Worker thumbnails + IndexedDB cache + progressive populate turn a filtered AssetItem stream into sprites on the canvas
- [ ] **Phase 3: Filter & Sort (Core Validation)** — Initial filter gate, subtractive filter chips, 1D and 2D spatial sort; this is the milestone that proves or disproves the core value
- [ ] **Phase 4: Comparison Mode** — Three compare modes with pinned+rotating navigation and automatic metadata/LoRA diff
- [ ] **Phase 5: Curation** — Favourite, tag, folder, hide, export with toast-based undo; curation state persisted to IndexedDB
- [ ] **Phase 6: Generate More Like This (Mocked)** — Live-parsed workflow modal with heuristic param exposure and a non-executing queue button
- [ ] **Phase 7: UX Edges & Performance Validation** — Empty states, perf hardening to 5k-asset budgets, keyboard/a11y sweep

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
   **Plans**: TBD
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
   **Plans**: TBD

### Phase 3: Filter & Sort (Core Validation)

**Goal**: User can gate the canvas with an initial workflow + time-range filter, progressively add subtractive filter chips across the hardcoded parameter list, and arrange the visible set spatially via 1D-with-packing or 2D-scatter sort — proving whether spatial-sort-by-parameter is a valuable reasoning surface.
**Depends on**: Phase 2
**Requirements**: FILTER-01, FILTER-02, FILTER-03, FILTER-04, FILTER-05, FILTER-06, FILTER-07, FILTER-08, FILTER-09, FILTER-10, FILTER-11, SORT-01, SORT-02, SORT-03, SORT-04, SORT-05
**Success Criteria** (what must be TRUE):

1. User must pick a workflow + time range before the canvas populates; the initial filter gate is the entry into the moshpit
2. User can add filter chips across model, LoRA, CFG, steps, sampler, scheduler, seed, prompt/negative-prompt substring, resolution, time, tags, favourite, and hidden — non-matching assets vanish from the canvas (subtractive, not dimmed)
3. User can sort by a parameter on X (with vertical packing) or by two parameters as a 2D scatter; assets lacking the sorted parameter are hidden, all positioning is grid-snapped, grid spacing is user-configurable
4. Filter chips are click-to-remove in the Settings panel; default view hides soft-deleted assets and can reveal them via a "show hidden" toggle
5. Running a parameter sweep (e.g. CFG on X) on a real workflow produces a visibly legible spatial arrangement of the filtered set
   **Plans**: TBD
   **UI hint**: yes

### Phase 4: Comparison Mode

**Goal**: User can enter comparison mode from a selection of ≥2 assets, navigate candidates via pinned+rotating arrows, switch between three comparison modes, and read an automatic metadata diff (including LoRA set-diff) at full resolution.
**Depends on**: Phase 3
**Requirements**: COMPARE-01, COMPARE-02, COMPARE-03, COMPARE-04, COMPARE-05, COMPARE-06, COMPARE-07, COMPARE-08
**Success Criteria** (what must be TRUE):

1. With ≥2 assets selected, `Enter` opens comparison; `Esc` exits with the canvas selection preserved
2. User can switch between side-by-side, overlap (opacity/wipe), and A/B flip via `[`/`]`; `Space` triggers an A/B flip in any mode
3. First-selected asset is pinned on the left; `←`/`→` rotate the right slot through the rest of the selection
4. A synced metadata panel lists all parameters for both assets, matching parameters render plainly, differing parameters render highlighted, and LoRAs render as an order-insensitive set diff with added / removed / weight-changed callouts
5. Full-resolution assets load on comparison entry — not on hover, not on high zoom
   **Plans**: TBD
   **UI hint**: yes

### Phase 5: Curation

**Goal**: User can favourite, tag, folder-assign, soft-delete (hide), and export selected assets via right-click or keyboard shortcuts; every bulk curation action produces an ~8s toast undo.
**Depends on**: Phase 2 (IndexedDB store), Phase 1 (selection)
**Requirements**: CURATE-01, CURATE-02, CURATE-03, CURATE-04, CURATE-05, CURATE-06, CURATE-07
**Success Criteria** (what must be TRUE):

1. User can favourite/unfavourite (`S`), tag (`T`), hide/unhide (`H`), add to user-defined folders, and export at full resolution (`E`) via right-click or keyboard — actions apply to the current selection
2. Tag, untag, hide, unhide, folder add/remove, and bulk favourite each fire a toast with an Undo button; `Cmd`/`Ctrl`-Z within the ~8s toast window reverses the action
3. Curation state persists across sessions (content-hash keyed in IndexedDB) and is respected by the filter system (tags become filterable, hidden defaults off)
4. Hidden assets remain on disk — no real deletion in v1
   **Plans**: TBD
   **UI hint**: yes

### Phase 6: Generate More Like This (Mocked)

**Goal**: Right-clicking a single asset opens a modal that live-parses the source workflow JSON, exposes tweakable parameters heuristically, and presents a non-executing "queue N variations" button — proving the interaction on real workflows without wiring a backend.
**Depends on**: Phase 5 (right-click context surface)
**Requirements**: GENMORE-01, GENMORE-02, GENMORE-03, GENMORE-04, GENMORE-05, GENMORE-06
**Success Criteria** (what must be TRUE):

1. Right-clicking a single asset surfaces "Generate more like this" and opens a modal
2. Modal reads the embedded workflow JSON via `getFromPngBuffer` and renders tweakable controls (sliders / inputs / dropdowns) initialised from the asset's KSampler widgets and LoRA strengths
3. Modal includes a "queue N variations" input (default 4–8) and a Queue button that does nothing — no backend call, no event logging
4. When the heuristic cannot identify tweakable parameters, the modal shows a fallback message rather than stubbed fake fields
   **Plans**: TBD
   **UI hint**: yes

### Phase 7: UX Edges & Performance Validation

**Goal**: All four empty states render correctly, user-facing actions are keyboard-reachable and screen-reader-legible, and the 5k-asset performance budget is demonstrably met (60fps pan/zoom, <2s first thumb cold, <3s warm populate, <500ms warm full-res).
**Depends on**: Phases 1–6 (validation is end-to-end)
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09
**Success Criteria** (what must be TRUE):

1. User sees the correct empty state in each condition: no initial filter, zero-match initial filter, narrowed-to-zero mid-session (with "remove last filter" affordance on the most recent chip), and all-hidden (with "show hidden" toggle)
2. At 5,000 assets steady-state, pan/zoom sustains 60fps and zoom-to-detail transitions complete within 200ms
3. At 5,000 assets cold start, the first thumbnail is visible within 2s of the initial filter and all thumbnails render within 60s; warm start populates within 3s; comparison entry full-res loads within 500ms warm / 2s cold
4. All user actions (filter, sort, compare, curate, export, "generate more") are reachable and legible via keyboard and screen reader through the Settings panel, comparison UI, and curation dialogs
   **Plans**: TBD
   **UI hint**: yes

## Progress

| Phase                                  | Plans Complete | Status      | Completed |
| -------------------------------------- | -------------- | ----------- | --------- |
| 1. Workspace Shell & Canvas Navigation | 0/?            | Not started | -         |
| 2. Asset Pipeline                      | 0/?            | Not started | -         |
| 3. Filter & Sort (Core Validation)     | 0/?            | Not started | -         |
| 4. Comparison Mode                     | 0/?            | Not started | -         |
| 5. Curation                            | 0/?            | Not started | -         |
| 6. Generate More Like This (Mocked)    | 0/?            | Not started | -         |
| 7. UX Edges & Performance Validation   | 0/?            | Not started | -         |

## Coverage

- v1 requirements: 66 total (SHELL 5 + ASSET 10 + FILTER 11 + SORT 5 + NAV 5 + COMPARE 8 + CURATE 7 + GENMORE 6 + UX 9)
- Mapped to phases: 66 ✓
- Unmapped: 0 ✓

**Note:** REQUIREMENTS.md header states "65 total" but the actual enumerated list contains 66 requirements. All 66 are mapped.

## Notes

- **Phase 3 is the validation milestone.** The Core Value question — does spatial-sort-by-parameter feel good on real parameter sweeps — is answered or falsified at the end of Phase 3. Phases 4–7 are only worth building if Phase 3 lands.
- **PixiJS is net-new.** Expect dependency installation, viewport setup, sprite loading, and mipmap LOD to be scoped into Phase 1 and/or Phase 2 research.
- **No entity-class modifications.** `LGraphNode`, `LGraphCanvas`, `LGraph`, `Subgraph` are off-limits (ADR 0003/0008). The shared input composable is an extraction of reusable pointer/viewport math out of `useCanvasInteractions`, not a modification of litegraph.
- **Curation relies on Phase 2 IndexedDB.** Phase 5 cannot start until Phase 2 has shipped a stable IndexedDB store keyed by content hash.
- **Generate More is intentionally isolated.** It can slot in after Phase 5 or in parallel with Phase 7 — it does not block other phases.

---

_Roadmap created: 2026-04-20_
