# Phase 4: Lineage Groupings & Within-Cluster Sort - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the deprecated parameter-sort UI (Phase 3 SORT-01/02) with lineage-based spatial clustering. Ship multi-axis non-exclusive grouping toggles (workflow, save node, prompt, model, type) with deterministic auto-nested hierarchy, an "(other)" cluster for missing grouped parameters, a global within-cluster sort dropdown, and the FILTER-12 primary/Advanced filter disclosure refactor. Remove the `MoshpitSortControls` / `MoshpitAxisOverlay` chrome and its i18n surface. Sort-math primitives (`sortMath.ts`) are retained as reuse substrate for within-cluster and cluster-level layout.

**Requirements in-scope:** GROUP-01..10, CSORT-01, FILTER-12. Deprecated UI removal closes out the Phase 3 sort surface (SORT-01/02/03 UI only; SORT-04/05 survive as cluster-spacing and grid-snap invariants).

**Out of scope:**

- Tournament mode and full-res on tournament entry (Phase 5) — Phase 4 ships selection-unchanged and lineage-grouped layout only.
- Curation mutations (Phase 6).
- Empty-state polish beyond what Phase 3 already ships (Phase 7 owns mid-session zero-match, all-hidden, and 5k-asset perf proof).
- Additional grouping axes beyond the v1 launch set (sampler / resolution bucket / seed-modulo-N deferred to v2 per PRD §9).
- Per-cluster within-cluster sort — `CSORT-01` is literal "applies globally across all leaf clusters."
- Semantic / embedding-based prompt grouping (v2). Prompt grouping uses exact normalised match only.
- Workflow grouping by graph-hash / node-count (v2). Filename-based grouping accepted, limits documented.

</domain>

<decisions>
## Implementation Decisions

### Cluster Layout Algorithm (the core-value-proof area)

- **D-01:** **Hierarchical row-column packing.** A new pure module `src/platform/moshpit/services/clusterLayout.ts` (sibling to `sortMath.ts`) implements a deterministic recursive packer. At each nesting level, child clusters are laid out in a row-wrapping grid whose cell size is the child's computed bounding rectangle; at a leaf cluster, assets arrange in a flat grid using `computeSortedLayout1D`-style packing driven by the within-cluster sort (D-07). Preserves Moshpit's grid-snap invariant (SORT-05 spirit), preserves thumbnail size (non-negotiable for quality judgment), deterministic and testable, GPU-cheap (same per-sprite position tween primitive). Treemap / nested-rectangles rejected: scales thumbnails. Force-directed rejected: non-deterministic, fails <400ms budget at 5k.
- **D-02:** **Auto-nesting order = average bucket size descending (PRD §5.4 literal).** For each enabled grouping axis, compute `avg_bucket_size = total_visible_assets / unique_bucket_count_for_axis`. Sort axes by avg_bucket_size descending; largest average nests outermost. Ties broken by PRD §5.3 declaration order (workflow → save_node → prompt → model → type). Recomputed whenever filter set or active-toggle set changes. No user-visible ordering UI.
- **D-03:** **Cluster spacing is depth-proportional.** Gap between sibling clusters at nesting depth `d` = `baseGap * (maxDepth - d + 1)`. `baseGap` ties to the existing `gridSpacing` control (SORT-04 survives). Outer clusters are visually separated more than inner ones; users read the hierarchy through whitespace even when labels are absent.
- **D-04:** **"(other)" cluster is just another bucket** at its level — no special placement logic. Auto-nesting rule applies: if "(other)" bucket is the smallest at its level (typical case), it sorts last within its row. Label is the literal string `(other)` (i18n key `moshpit.grouping.otherLabel`). No special styling. This keeps the math clean and avoids a bespoke edge case every level of the recursion.
- **D-05:** **Performance budget allocation.** <400ms end-to-end per GROUP-10. Planner targets: pure clusterLayout math <100ms at 5k (single-threaded, no reactive deps inside the loop — same discipline as `sortMath`), existing 300ms ease-out-cubic tween in `useMoshpitSpriteLayer` carries the motion. No new animation primitive. If profile shows math >100ms, first mitigation is memoising bucket-key computation per (assetHash, axisKey) pair.

### Cluster Visual Treatment

- **D-06:** **Bounding boxes + HTML-overlay labels, at the two outermost nesting levels only.**
  - Outer & second-outer clusters: 1px border in `border-(--interface-stroke)` (semantic token), no fill, rounded corners matching existing Moshpit chrome.
  - Label: HTML overlay anchored to world-space top-left of the cluster bounding rect, `text-xs text-muted-foreground` with truncation (ellipsis at max ~28 chars). This follows the Phase 3 `MoshpitAxisOverlay` precedent — HTML-over-Pixi for text, cheap at zoom, no text-atlas work.
  - Deeper levels (3rd onwards) rely on D-03 depth-proportional gap hierarchy alone. Cap at 5 axes = 5 levels max; 2 labelled is the right balance between clarity and visual noise.
  - Labels show the bucket value verbatim: workflow filename, save-node title/class, normalised prompt (truncated), model filename, type bucket (`landscape` / `portrait` / `square` / `(other)`).
  - Box + label overlay is a single Vue component (`MoshpitClusterOverlay.vue`) that reads a tree of `ClusterNode` descriptors from a new composable and uses `pixi-viewport` world-to-screen math identical to `MoshpitAxisOverlay` (Phase 3 pattern).

### Grouping Axis Extraction (save node, type)

- **D-07:** **Within-cluster sort** is a single global dropdown with three options — `newestFirst` (default), `oldestFirst`, `alphabetical`. Matches CSORT-01 literal. Alphabetical compares on the source PNG filename from `AssetItem` (NOT the normalised workflow filename derived in `paramNormalize`). Newest/oldest sorts on `NormalizedParams.timestamp`. Ordering is applied once per leaf-cluster bucket, deterministic.
- **D-08:** **Save-node identity = `_meta.title` ?? `class_type`.** Extraction walks the ComfyUI `prompt` graph (already parsed in `paramNormalize`) to find nodes whose `class_type` is in a known output-class set (`SaveImage`, `PreviewImage`, `SaveImageWebsocket`, `SaveAnimatedWEBP`, `SaveImageExtended`). For each such node, identity = `node._meta.title` when present (users name their save nodes meaningfully), falling back to `node.class_type`. When a workflow has multiple output nodes, v1 uses the first in deterministic iteration order and accepts the limitation (a single asset has a unique emitting node in practice; multi-output workflows are rare and v1 is a validation milestone, not a correctness proof). Field added to `NormalizedParams` as `saveNodeIdentity: string | null`.
- **D-09:** **Type bucketing uses 3 fixed aspect buckets** derived from existing `width`/`height` fields. Ratio = `width / height`. Thresholds: `>1.15` → `landscape`, `<0.87` → `portrait`, otherwise → `square`. Missing width or height → bucket is `null` → falls into `(other)` at the type-grouping level. Type is **derived at read time** via a pure helper `deriveTypeBucket(params)` in a new `groupAxes.ts` module — NOT stored as a NormalizedParams field. This avoids a second storage migration and keeps the schema compact.
- **D-10:** **Prompt grouping key = normalised `positivePrompt`.** Normalisation: `trim().toLowerCase().replace(/\s+/g, ' ')`. Applied only to the grouping bucket key; the stored `positivePrompt` remains verbatim for filter text search (FILTER-05). Missing `positivePrompt` → `(other)` at the prompt-grouping level. Semantic similarity is explicitly v2 (PRD §9).
- **D-11:** **IDB migration: v2 → v3 bump** on `thumbRepository`. Upgrade callback re-derives `saveNodeIdentity` for every existing `assetMeta` record by re-running the extraction against the already-stored `rec.metadata` (raw PNG tEXt map). Pattern mirrors the v1→v2 `normalizeParams` re-parse in `thumbRepository.ts:44-64`. Cursor-based streaming, per-record try/catch, skipped records re-populate on next write. `type` is derived lazily at read time (D-09) — no storage changes for type.

### Advanced Filter Disclosure (FILTER-12)

- **D-12:** **Reka UI `Collapsible` below the primary chip row.** Single trigger row labelled "Advanced filters" with chevron indicator. Collapsed by default on first visit; open-state persists in `moshpitFilterStore` (same session only — no IDB persistence of UI-chrome state). Chip component is unchanged; the settings panel renders two `MoshpitFilterChipRow` instances — one for primary-tier chips, one inside the collapsible for advanced-tier chips. The `+ Add filter` popover's parameter list splits into two labelled sections ("Primary" / "Advanced"). When a chip is added, the store routes it to the correct tier based on the param's membership in `PRIMARY_FILTER_PARAMS` / `ADVANCED_FILTER_PARAMS` constants.
- **D-13:** **Primary filter param set** (PRD §5.5 literal): `workflow`, `prompt` (text), `saveNode`, `model`, `timestamp` (time range), `favourite`, `hidden`, `tags`. Note: `workflow` and `timestamp` (initial gate) remain pinned above the chip row — they're not chips, they're the gate controls from Phase 3. The primary chip row hosts the remaining primary params (`prompt`, `saveNode`, `model`, `favourite`, `tags`) plus `hidden` (exposed via the existing `MoshpitShowHiddenToggle` rather than as a chip).
- **D-14:** **Advanced filter param set** (PRD §5.5 literal): `cfg`, `steps`, `seed`, `sampler`, `scheduler`, `resolution` (width×height), `loras` (name + LoRA chip), `negativePrompt`. These are the Phase 3 chip params minus those moved to primary. `ParamKey` gets `saveNode` added; `filterMath` and the `+ Add filter` popover gain the save-node editor (categorical multi-select, same pattern as model/sampler — D-11 Phase 3).

### Sort-UI Removal Scope

- **D-15:** **Delete outright:**
  - `src/platform/moshpit/components/MoshpitSortControls.vue` + `MoshpitSortControls.test.ts`
  - `src/platform/moshpit/components/MoshpitAxisOverlay.vue` + `MoshpitAxisOverlay.test.ts`
  - `src/platform/moshpit/composables/useMoshpitViewportInjection.ts` IFF not used by cluster overlay — planner verifies; if the overlay reuses the same injection key, keep the composable and only remove the sort-specific wiring.
  - i18n keys under `moshpit.sort.*` in `src/locales/en/main.json`.
  - `sortX`, `sortY` fields on `moshpitFilterStore` (removed from state, mutations, getters, and consumers).
  - Sort-related calls in `useMoshpitFilteredAssets` and any Playwright `@moshpit` specs that exercise the sort UI.
- **D-16:** **Retain:**
  - `src/platform/moshpit/services/sortMath.ts` + `sortMath.test.ts` — reuse substrate for leaf-cluster grids and cluster-level row-column packing. Top-of-file comment updated to flag Phase 4 reuse intent.
  - `src/platform/moshpit/components/MoshpitGridSpacingControl.vue` — SORT-04 survives as cluster-and-within-cluster spacing control. Label updated (`moshpit.grouping.spacingLabel`) but mechanism unchanged.
  - `src/platform/moshpit/components/MoshpitShowHiddenToggle.vue` — FILTER-11 still carries.
  - Excluded-count row — ASSET-06 unchanged.
- **D-17:** **Sort-math type bleed.** Several Phase 3 types (`ColumnDescriptor`, `RowDescriptor`, `SortedGridSlot`) are grid-axis shaped, not cluster shaped. Phase 4 introduces parallel `ClusterNode` / `ClusterSlot` types in `clusterLayout.ts`. The old types remain exported from `sortMath.ts` because the within-cluster flat-grid case reuses `computeSortedLayout1D` as-is (clone the slot list under a new worldX/worldY offset computed by the cluster layout).

### Grouping Toggle UI

- **D-18:** **Five pill toggles in the Settings panel**, rendered as a horizontal wrapping row above the filter chip area (below the workflow / time-range gate, above the Advanced disclosure). One pill per axis in PRD §5.3 declaration order (`workflow`, `saveNode`, `prompt`, `model`, `type`). Active = filled with `bg-node-component-primary` token; inactive = outlined with `border-(--interface-stroke)`. Labels via `moshpit.grouping.axis.<key>` i18n keys. No visible indicator of current auto-nesting order (PRD §5.4 literal: "No user-visible ordering UI"). Toggling any pill triggers a cluster-layout recompute + 300ms tween.
- **D-19:** **State lives on `moshpitFilterStore`** as `activeGroupings: Set<GroupingAxis>` (ordered) plus a `withinClusterSort: 'newestFirst' | 'oldestFirst' | 'alphabetical'` field. Store gains: `toggleGrouping(axis)`, `setWithinClusterSort(mode)`, `activeGroupingOrder` computed (applies D-02 auto-nesting rule against current visible-asset set). Filter-store tests extend to cover grouping toggles + within-cluster-sort persistence across chip adds/removes.

### Validation Strategy (Core Value Proof, take 2)

- **D-20:** **Phase 4 ships with a `04-HUMAN-UAT.md` dogfood checklist** — this is the v3 Core Value validation milestone. Scenario:
  1. Populate a real ComfyUI backend with outputs across ≥2 workflows with shared models, overlapping prompts, and ≥2 save nodes per workflow.
  2. Open Moshpit, apply the initial filter (workflow: all, time: all).
  3. Toggle workflow grouping alone — verify visible clusters match workflow filenames, order by bucket density descending.
  4. Add prompt grouping — verify nesting reorders automatically based on bucket sizes and labels render correctly.
  5. Add save_node + model + type groupings one at a time — verify depth-proportional spacing and that `(other)` clusters render where expected.
  6. Change within-cluster sort — verify only leaf-cluster order changes, cluster boundaries stable.
  7. Collapse/expand Advanced filters — verify added chips land in the correct tier.
  8. Qualitative sign-off: "Do the clusters make comparable assets easier to find than a flat grid? Is the auto-nesting order predictable?" — binary answer + notes.
- **D-21:** **No Playwright E2E fixture blocks Phase 4 acceptance.** A `@moshpit` spec may cover grouping-toggle state, auto-nesting order stability under filter changes, and the Advanced disclosure, but the Core Value answer is qualitative. Regression protection for `clusterLayout` is via Vitest on the pure module — high-coverage, fast, deterministic. Frame-budget sampling is deferred to Phase 7.
- **D-22:** **Phase 4 is a gate.** If HUMAN-UAT returns a negative or "sort of" sign-off, **pause Phase 5** per the roadmap (`Phase 4 is the new validation milestone. Phase 5 and beyond are only worth building if Phase 4 clicks on real dogfooding.`). Treat Phase 4 as the project's second go/no-go after Phase 3.

### Claude's Discretion

The following are deliberately unlocked — researcher investigates, planner picks, executor documents.

- **Cluster layout: row-first vs column-first wrapping at branch levels.** D-01 specifies row-wrapping; planner may flip to column-first if dogfood screenshots show better use of ultrawide displays. Either way, deterministic.
- **Cluster overlay rendering cost at zoom.** HTML overlay cost scales with cluster count, not asset count — fine up to ~200 clusters (5k assets × 2 outer-level labels). Planner may cull labels at deep zoom-out if profiling flags it.
- **Reka UI `Collapsible` vs plain `<details>`** for the Advanced disclosure. Reka preferred for chrome consistency, but if no other Reka primitives are adjacent in the Settings panel, native `<details>` is acceptable — planner picks on CONVENTIONS.md guidance.
- **`activeGroupings` storage shape** (`Set` vs ordered array vs object-keyed booleans). Pinia/Vue reactivity with `Set` is workable but `readonly GroupingAxis[]` serialises cleaner for tests. Planner's call.
- **Save-node extraction when workflow has multiple outputs.** D-08 defers to first-iteration-order node as v1. If dogfood surfaces real multi-output workflows, the asset-to-node match can be improved by correlating the asset's saved filename against `SaveImage.inputs.filename_prefix` — scoped gap-closure.
- **IDB v3 migration failure handling.** D-11 mirrors the v1→v2 per-record try/catch pattern; planner confirms per-cursor error paths and decides whether to log aggregate migration counts at the end.
- **Pill-toggle keyboard affordance.** PRD §7.12 does not specify a shortcut for grouping toggles. Planner may add `G+1..5` style chords or skip — v1 validation does not block on this.
- **`MoshpitGridSpacingControl` renaming.** Mechanically unchanged, but the label now governs both cluster gap (D-03 `baseGap`) and within-cluster grid spacing. Planner picks one: rename label only, or split into two controls. Default direction: keep single slider, scale both from it.
- **Animation shape for filter changes while groupings are active.** 300ms ease-out-cubic tween reused. No second motion primitive; filter add/remove + grouping toggle + within-sort change all share one tween.

### Folded Todos

None — STATE.md's "consider running /gsd-discuss-phase" is satisfied by this document.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ADRs (entity architecture constraints)

- `docs/adr/0001-merge-litegraph-into-frontend.md` — litegraph is vendored; cluster layout code must not import from `src/lib/litegraph`.
- `docs/adr/0003-crdt-based-layout-system.md` — command pattern; grouping/within-cluster-sort state changes on `moshpitFilterStore` must be serialisable.
- `docs/adr/0008-entity-component-system.md` — no methods on god-object entities; cluster layout math lives in pure modules, state in a dedicated store.

### Project-level specs

- `.planning/PROJECT.md` §Active / §Constraints / §Key Decisions (v3 pivot) — lineage-grouping + tournament framing; 5k-asset budget; IDB v1; no `dark:` / `!important` / `any`.
- `.planning/REQUIREMENTS.md` §Lineage Groupings (GROUP-01..10), §Within-Cluster Sort (CSORT-01), §Filtering (FILTER-12) — authoritative scope list. GROUP-10 + UX-10 carry the 400ms budget.
- `.planning/ROADMAP.md` §Phase 4 Success Criteria (6 items) — what must be TRUE at phase exit. Phase 4 is the new validation gate for the v3 pivot.
- `temp/plans/moshpit_prd.md` §5.3 (lineage groupings), §5.4 (auto-nest rule), §5.5 (filters cull / groups organise), §5.6 (within-cluster sort literal list), §7.1 (Settings panel), §7.4 (grouping toggles), §7.5 (primary vs Advanced filter split), §9 (open questions — "(other)" cluster placement, workflow drift, cluster visual treatment all addressed in this doc).

### Phase 1 / 2 / 3 carry-forward

- `.planning/phases/01-workspace-shell-canvas-navigation/01-CONTEXT.md` — Settings panel mount, Moshpit platform domain (`src/platform/moshpit/`), injection-key patterns.
- `.planning/phases/02-asset-pipeline/02-CONTEXT.md` — 300ms ease-out-cubic tween primitive (D-04), content-hash keying, worker message contract. Cluster layout drives the same sprite-position tween.
- `.planning/phases/03-filter-sort-core-validation/03-CONTEXT.md` — D-01 (normalisation in worker), D-05 (NormalizedParams shape — Phase 4 extends with `saveNodeIdentity`), D-11 (chip value editors — Phase 4 adds save-node categorical), D-18 (tween primitive shared), D-20/21 (HUMAN-UAT pattern reused), and the full moshpitFilterStore / sortMath / filterMath module map.
- `.planning/phases/03-filter-sort-core-validation/03-VALIDATION.md` — task-to-requirement map conventions Phase 4 inherits.

### Codebase maps

- `.planning/codebase/STRUCTURE.md` — `base → platform → workbench → renderer`; Moshpit lives in `src/platform/moshpit/`.
- `.planning/codebase/ARCHITECTURE.md` — Pinia setup-API + composable patterns.
- `.planning/codebase/CONVENTIONS.md` — Vue 3.5 destructured props, Tailwind semantic tokens, `cn()` only, no `dark:` / `:class="[]"` / `!important`.
- `.planning/codebase/TESTING.md` — Vitest + happy-dom for unit, Playwright `@moshpit` tag for E2E.

### Existing code to extend / consume

- `src/platform/moshpit/services/paramNormalize.ts` — add `saveNodeIdentity` to `NormalizedParamsSchema` + extraction logic; `workflowFilename` / `workflowFingerprint` already present.
- `src/platform/moshpit/services/thumbRepository.ts` — IDB v2 → v3 migration callback (re-derive `saveNodeIdentity` per record); pattern at lines 44-64 is the model.
- `src/platform/moshpit/services/thumbRepository.types.ts` — bump `MOSHPIT_DB_VERSION` to 3; extend `AssetMetaRecord.params` shape.
- `src/platform/moshpit/services/sortMath.ts` — RETAINED. Update module header to reflect Phase 4 reuse intent; `computeSortedLayout1D` is consumed as the leaf-cluster flat-grid primitive.
- `src/platform/moshpit/services/layoutMath.ts` — `computePackedGrid` / `computeJitteredGrid` reused for the "no groupings enabled" flat-grid fallback (PRD §7.4: "flat grid (post-filter), sorted by within-cluster sort").
- `src/platform/moshpit/services/filterTypes.ts` — add `saveNode` to `ParamKey`; add `GroupingAxis` type + `GROUPING_AXES` constant; add `WithinClusterSortMode`.
- `src/platform/moshpit/services/filterMath.ts` — add save-node categorical predicate.
- `src/platform/moshpit/stores/moshpitFilterStore.ts` — REMOVE `sortX` / `sortY`; ADD `activeGroupings`, `withinClusterSort`, `isAdvancedOpen`, `toggleGrouping()`, `setWithinClusterSort()`, `toggleAdvanced()`, `activeGroupingOrder` computed.
- `src/platform/moshpit/composables/useMoshpitFilteredAssets.ts` — replace sort-layout call with cluster-layout call; output shape changes from flat slot list to cluster-tree + flattened slot list for the sprite layer.
- `src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` — consumes the new per-sprite position targets; tween path unchanged.
- `src/platform/moshpit/composables/useMoshpitViewportInjection.ts` — world-to-screen math reused by the cluster overlay.
- `src/platform/moshpit/components/MoshpitSettingsPanel.vue` — inject grouping-toggle pill row + Advanced-filter collapsible; remove `<MoshpitSortControls>` mount.
- `src/platform/moshpit/components/MoshpitFilterChipRow.vue` — reused twice (primary + advanced); may need a prop to scope the chip list.
- `src/platform/moshpit/components/MoshpitAddFilterPopover.vue` — split parameter list into Primary / Advanced sections; add save-node entry.
- `src/platform/moshpit/components/MoshpitGridSpacingControl.vue` — retained; label updates.
- `src/platform/moshpit/components/MoshpitShowHiddenToggle.vue` — retained.
- `src/platform/moshpit/components/MoshpitCanvas.vue` — cluster overlay injection alongside sprite layer (parallel to Phase 3 axis overlay).
- `src/locales/en/main.json` — new `moshpit.grouping.*` namespace; REMOVE `moshpit.sort.*`; new `moshpit.filters.advancedLabel` / `moshpit.filters.primaryLabel`.

### New modules to create

- `src/platform/moshpit/services/clusterLayout.ts` + `clusterLayout.test.ts` — pure recursive packer (D-01).
- `src/platform/moshpit/services/groupAxes.ts` + `groupAxes.test.ts` — axis extraction (save node, type), bucket-key derivation, normalised-prompt key (D-08, D-09, D-10).
- `src/platform/moshpit/components/MoshpitGroupingToggles.vue` + test + story — five-pill row (D-18).
- `src/platform/moshpit/components/MoshpitWithinClusterSort.vue` + test + story — dropdown (D-07 / CSORT-01).
- `src/platform/moshpit/components/MoshpitAdvancedFilters.vue` + test + story — Reka `Collapsible` wrapping second chip-row instance (D-12).
- `src/platform/moshpit/components/MoshpitClusterOverlay.vue` + test + story — HTML-over-Pixi bounding boxes + labels (D-06).

### Files to delete

- `src/platform/moshpit/components/MoshpitSortControls.vue` + `MoshpitSortControls.test.ts` + story if present.
- `src/platform/moshpit/components/MoshpitAxisOverlay.vue` + `MoshpitAxisOverlay.test.ts` + story if present.
- Sort-specific Playwright spec coverage in the `@moshpit` suite.

### Guidance docs

- `docs/guidance/typescript.md` — no `any`, Zod for schema, type-assertion hierarchy; `NormalizedParamsSchema` extension validates the v3 shape.
- `docs/guidance/vue-components.md` — Vue 3.5 destructured props, `<script setup>`, `defineModel` for v-model, no `:class="[]"`.
- `docs/guidance/design-standards.md` — check Comfy Design Standards Figma for Moshpit cluster / grouping-toggle / Advanced-disclosure tokens before hardcoding colours.

### External library docs (fetch via Context7 when planning)

- `reka-ui` — `Collapsible` primitive for the Advanced filter disclosure; `ToggleGroup` or plain `button` for the grouping pills.
- `pixi.js` v8 — cluster overlay positioning is HTML-anchored; no new Pixi primitives needed beyond the existing sprite layer.
- `pixi-viewport` — world-to-screen transforms for HTML-anchored cluster overlay labels (reused from `MoshpitAxisOverlay` Phase 3 pattern).

### Domain references

- ComfyUI prompt-graph output node class set: `SaveImage`, `PreviewImage`, `SaveImageWebsocket`, `SaveAnimatedWEBP`, `SaveImageExtended` (D-08). Each has an `inputs.filename_prefix` field (optional `_meta.title`). Custom-node output classes exist but are the long tail; planner treats the set as extensible and documents how to extend.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`paramNormalize.extractWorkflowFilename` / `computeWorkflowFingerprint`** — workflow grouping axis is already implemented; Phase 4 consumes the output for the `workflow` grouping bucket.
- **`paramNormalize.positivePrompt`** — prompt grouping consumes this (D-10 normalisation at read-time).
- **`paramNormalize.model`** — model grouping consumes this directly.
- **`paramNormalize.width` / `paramNormalize.height`** — type grouping consumes both (D-09 aspect thresholds).
- **`sortMath.computeSortedLayout1D`** — leaf-cluster flat-grid layout reuses this directly. Cluster offset applied post-hoc (add `(offsetX, offsetY)` to every slot).
- **`layoutMath.computePackedGrid`** — "no groupings enabled" flat-grid fallback reuses this (PRD §7.4).
- **`useMoshpitSpriteLayer`** — 300ms ease-out-cubic tween path unchanged. Cluster layout produces the same `{hash, worldX, worldY}[]` shape consumed today.
- **`thumbRepository` v1→v2 upgrade callback** (lines 44-64) — the model for the v2→v3 migration (D-11).
- **`MoshpitFilterChipRow.vue`** — rendered twice (primary + advanced-inside-collapsible). Minimal prop extension needed.
- **`useMoshpitViewportInjection`** — world-to-screen math reused by cluster overlay.

### Established Patterns

- **Pure math modules + colocated Vitest** — `clusterLayout.ts` + `clusterLayout.test.ts` + `groupAxes.ts` + `groupAxes.test.ts` follow the Phase 2/3 pattern (`layoutMath` / `sortMath` / `filterMath`).
- **Pinia setup-API store** — `moshpitFilterStore` extension pattern, not a new store.
- **HTML-over-Pixi for text overlays** — Phase 3 `MoshpitAxisOverlay` established this; `MoshpitClusterOverlay` copies the shape.
- **IDB version bump + cursor-migration** — Phase 3 v1→v2 set precedent; Phase 4 v2→v3 follows.
- **i18n namespace `moshpit.*`** — new `moshpit.grouping.*`; deleted `moshpit.sort.*`.
- **Reka UI over new PrimeVue** — `Collapsible` and `ToggleGroup` consumed from Reka.
- **Tailwind semantic tokens + `cn()`** — all new chrome; no `:class="[]"`, no `dark:`, no `!important`.

### Integration Points

- **`MoshpitSettingsPanel.vue`** — replace the `<MoshpitSortControls>` mount with `<MoshpitGroupingToggles>` + `<MoshpitWithinClusterSort>` + `<MoshpitAdvancedFilters>`. Layout order: initial filter gate → grouping toggles → primary chip row → within-cluster sort dropdown → Advanced disclosure → grid spacing → show-hidden → excluded count.
- **`MoshpitCanvas.vue`** — overlay mount: `<MoshpitClusterOverlay>` parallel to the existing sprite layer (remove `<MoshpitAxisOverlay>`).
- **`useMoshpitFilteredAssets`** — call path shifts from "filter predicates → sortMath" to "filter predicates → groupAxes.bucket → clusterLayout". Output: `{ clusters: ClusterNode[], slots: LayoutSlot[] }`.
- **`moshpitFilterStore`** — field surface tightens (sortX/sortY removed) and expands (groupings + withinClusterSort + isAdvancedOpen added). Tests extend.
- **`thumbWorker` / `workerBridge`** — `saveNodeIdentity` added to `thumbReady` payload; worker extracts during `normalizeParams` call.
- **`src/locales/en/main.json`** — surgical edit: remove `moshpit.sort`, add `moshpit.grouping`, `moshpit.filters.advanced*`, `moshpit.grouping.axis.*`, `moshpit.grouping.withinSort.*`.

### Constraints Surfaced by the Scout

- **Raw PNG metadata IS stored** in `assetMeta.metadata` (confirmed via `thumbRepository.ts:51`). This unlocks lazy re-derivation of `saveNodeIdentity` on IDB v2→v3 migration without re-thumbnailing.
- **`sortMath` types bleed into the slot shape consumed by the sprite layer.** Phase 4's `clusterLayout` emits a superset — the flat slot list for the sprite layer looks identical, but a parallel `ClusterNode[]` tree is needed for the overlay. Two outputs, one call.
- **`ParamKey` union is consumed in 30+ places across filterTypes / filterMath / filterStore / filter chip editors.** Adding `saveNode` is an additive change but the exhaustiveness checks in `extractSortValue` etc. must be audited for the removed sort fields (`sortX/sortY` deletion) at the same time.
- **PRD §5.5 literal "hidden" is primary-tier but rendered via toggle, not chip.** Easy to mistake — documented here so planner doesn't accidentally add a "hidden" chip to the Primary popover section.
- **Auto-nesting computation has a subtle cost** — for every filter change, we must recompute bucket counts per active axis before we can order them. Planner memoises per-(filterHash, axisKey) to stay inside the 100ms math budget at 5k.

</code_context>

<specifics>
## Specific Ideas

- **Phase 4 is the v3 Core Value validation milestone.** This is the re-proof after the Phase 3 sort dogfood invalidated v2. D-22 treats it as a go/no-go gate — if clustering doesn't make comparison faster than a flat grid, pause Phase 5.
- **Preserve thumbnail size.** Non-negotiable. Treemap / scaled rectangles are rejected because pixel-level comparison is the whole point of the canvas.
- **Reuse the tween primitive, don't invent a new one.** 300ms ease-out-cubic covers filter change, grouping toggle, and within-cluster sort change. One motion language.
- **Auto-nesting is PRD §5.4 literal.** Average bucket size descending, ties by declaration order, no user-visible ordering UI. Do not accept scope creep requesting manual reorder — v2 idea.
- **Single dropdown for within-cluster sort, global.** CSORT-01 literal. No per-cluster override in v1.
- **HUMAN-UAT, not Playwright.** Qualitative sign-off drives acceptance. Vitest covers `clusterLayout` / `groupAxes` unit semantics.

</specifics>

<deferred>
## Deferred Ideas

- **Manual grouping reorder UI** — PRD §5.4 locks auto-nesting; a manual override is a v2 idea if auto-nesting proves wrong in dogfood.
- **Additional grouping axes** (sampler, resolution bucket, seed-modulo-N) — PRD §9 candidates, not v1.
- **Semantic / embedding-based prompt grouping** — v2 per PRD §10 and PROJECT.md Out of Scope.
- **Workflow graph-hash or node-count grouping** — PRD §9 open question; v1 accepts filename as imperfect. Revisit post-validation.
- **Per-cluster within-cluster sort override** — CSORT-01 is global; per-cluster is a v2 polish if needed.
- **Cluster-collapse / drill-in interaction** — no PRD requirement; stay out of v1 unless dogfood demands it.
- **Multi-save-node disambiguation via `SaveImage.inputs.filename_prefix`** — D-08 scoped gap-closure for future iterations if dogfood surfaces multi-output workflows.
- **Keyboard chords for grouping toggles** (`G+1..5`) — not in PRD §7.12; planner may add if cheap, else defer.
- **Frame-budget Playwright proof for GROUP-10 / UX-10** — deferred to Phase 7 perf hardening.
- **Cluster-overlay label culling at deep zoom-out** — profile first; defer unless flagged.
- **Reviewed Todos (not folded).** None — no pending todos matched Phase 4 scope.

</deferred>

---

_Phase: 04-lineage-groupings-within-cluster-sort_
_Context gathered: 2026-04-21_
