# Phase 3: Filter & Sort (Core Validation) — Research

**Researched:** 2026-04-21
**Domain:** In-memory filter/sort pipeline on top of PixiJS/Pinia asset layer (Vue 3.5, TypeScript, Pinia, IndexedDB, PixiJS v8 + pixi-viewport)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Normalization runs in the Web Worker at metadata-parse time. The worker writes a typed `params` object to IndexedDB `assetMeta` alongside the raw PNG tEXt chunks.
- **D-02:** `prompt` chunk (ComfyUI API format) is the authoritative source. `workflow` chunk is NOT walked in v1.
- **D-03:** Extraction is best-effort, silently null. Missing parameters resolve to `undefined`. Assets stay in Moshpit but drop from any filter/sort querying the missing field.
- **D-04:** LoRAs normalize to `loras: { name: string, weight: number }[]`. Filter: "has LoRA {name}" (name match, any weight, OR across names in a single chip). Sort: by `loras.length` (count). Sort-by-weight is NOT shipped in v1.
- **D-05:** Normalized parameter shape (v1):
  ```typescript
  {
    model: string | undefined
    loras: { name: string, weight: number }[]
    cfg: number | undefined
    steps: number | undefined
    sampler: string | undefined
    scheduler: string | undefined
    seed: number | undefined
    positivePrompt: string | undefined
    negativePrompt: string | undefined
    width: number | undefined
    height: number | undefined
    timestamp: number   // always defined; mirrors AssetItem.created_at
  }
  ```
- **D-06:** Gate is Settings-panel-only. No modal. Canvas renders centered empty-state until workflow + time-range are set.
- **D-07:** Workflow picker is single-select searchable combobox of workflow filenames with asset counts.
- **D-08:** Single workflow selection only (not multi).
- **D-09:** Time-range presets: Today / This week / This month / All time + custom range. Strict PRD subset (no "yesterday", "last week", "last month").
- **D-10:** Adding a filter chip: "+ Add filter" button → two-step popover picker → inline value editor.
- **D-11:** Per-parameter value editors: numeric (dual min/max + `=` toggle), categorical (multi-select chip-list with fuzzy search), text (substring), resolution (presets + custom dual input), boolean (toggle).
- **D-12:** Duplicate-parameter chips merge values OR-combined within one chip. Different parameters AND across chips.
- **D-13:** `hidden:false` is implicit default with explicit "Show hidden" toggle in footer. No persistent "Hidden: false" chip.
- **D-14:** Filter chip click-to-remove removes chip entirely; re-admits assets with 300ms ease-out-cubic tween.
- **D-15:** Sort UX: X-axis picker always visible, Y-axis picker optional. No explicit 1D/2D toggle — axis state IS the mode.
- **D-16:** Bucketing: column-per-unique-value for both discrete and continuous. CFG 6.5/7.0/7.5/8.0 → four columns, sorted order. Categorical → one column per unique value, alphabetically sorted.
- **D-17:** Assets lacking the sorted parameter are hidden (same treatment as filter exclusion).
- **D-18:** Position changes animate with 300ms ease-out-cubic tween (same primitive as Phase 2 D-04 re-pack).
- **D-19:** Removing the last sort returns sprites to chaos (jittered-grid) layout using the same filter-hash seed. Sprites tween back.
- **D-20:** Phase 3 ships a `03-HUMAN-UAT.md` checklist for real-world dogfood parameter sweep.
- **D-21:** No Playwright E2E fixture blocks Phase 3 acceptance. Regression protection via Vitest unit tests on pure layout/bucketing module. Playwright smoke can follow in Phase 7.
- **D-22:** If Phase 3 HUMAN-UAT returns negative or "sort of" — pause roadmap execution before Phase 4.

### Claude's Discretion

- **Grid-spacing control UX.** Options: numeric input with +/- steppers, compact slider, or three-step picker. Default direction: compact slider in Settings panel footer.
- **Axis-label / legend rendering on canvas.** Default direction: overlay HTML labels anchored to world-space column/row coordinates (not PixiJS-drawn).
- **Filter chip active-filter state storage.** Default direction: new dedicated `moshpitFilterStore` — store holds `{ workflow, timeRange, chips, sortX, sortY, gridSpacing, showHidden }`.
- **Workflow filename grouping under drift.** v1 accepts filename-as-group. No graph-hash grouping.
- **"+ Add filter" picker scroll/filter behaviour.** Researcher confirms against Reka UI / existing patterns.
- **Performance budget at 5k assets.** Keep filter/sort math in pure module (no Pinia reactivity on tight loops).
- **Reuse vs adapt of `DateRangeFilter.vue`.** Current uses PrimeVue DatePicker. Planner decides.
- **Active-filter URL/query-param sync.** Out of scope for v1.

### Deferred Ideas (OUT OF SCOPE)

- Multi-workflow selection
- Sort-by-LoRA-weight
- `workflow` chunk fallback for parameter extraction
- Auto-bucketing heuristic for truly-continuous parameter sweeps
- Playwright E2E fixture for filter/sort regression
- Saved filter/sort presets
- Semantic prompt search
- Shareable filter URL
- Workflow grouping by graph hash
- Thumbnail cache eviction
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FILTER-01 | Initial filter gate: workflow selector + time range before canvas populates | D-06/D-07/D-09; piggybacks `queue.setFilter()` call path from Plan 02-08 |
| FILTER-02 | Filter by model (checkpoint) | D-05 `model` field from `CheckpointLoaderSimple.ckpt_name`; categorical chip editor |
| FILTER-03 | Filter by LoRA (name + weight) | D-04/D-05 `loras[]` array; name-match chip with OR semantics (D-12) |
| FILTER-04 | Filter by CFG, steps, sampler, scheduler, seed, resolution | D-05 numeric + categorical + resolution chip editors (D-11) |
| FILTER-05 | Filter by prompt/negative prompt substring | D-05 `positivePrompt`/`negativePrompt`; text chip editor (D-11) |
| FILTER-06 | Filter by generation time | D-09/D-05 `timestamp` field; time-range chip |
| FILTER-07 | Filter by tags and favourite status | Reads `moshpitCurationStore` (favourite, tags); boolean chip for favourite |
| FILTER-08 | Filtering is subtractive — non-matching assets hidden entirely | `useMoshpitFilteredAssets` computed predicate; removes entries from sprite layer input |
| FILTER-09 | Assets lacking the filtered parameter are hidden | D-03 silent-null; predicate returns false for `undefined` fields |
| FILTER-10 | Filter chips render in Settings panel; click removes chip | MoshpitSettingsPanel chip row; chip click dispatches `removeChip` action on moshpitFilterStore |
| FILTER-11 | Default filter hides soft-deleted; "show hidden" toggle reveals them | D-13; reads `moshpitCurationStore.hidden`; implicit predicate unless toggled |
| SORT-01 | 1D sort: parameter → X-axis columns, Y packs to fit | `computeSortedLayout1D` in sortMath.ts; column-per-unique-value (D-16) |
| SORT-02 | 2D scatter: parameter → X, parameter → Y | `computeSortedLayout2D`; same bucketing model on both axes |
| SORT-03 | Assets lacking sorted parameter are hidden | D-17; same treatment as filter exclusion |
| SORT-04 | User-configurable grid spacing | `gridSpacing` in moshpitFilterStore; slider control in Settings panel footer |
| SORT-05 | All asset positioning is grid-snapped | `computeSortedLayout1D`/`2D` outputs are grid-aligned (column×gridSpacing, row×gridSpacing) |
</phase_requirements>

---

## Summary

Phase 3 builds the filter → sort loop entirely within the `src/platform/moshpit/` platform layer, on top of a solid Phase 2 foundation. The five new pure-math modules (`paramNormalize.ts`, `filterMath.ts`, `sortMath.ts` and the extended `workerMessages.ts`/`thumbRepository.types.ts`) form the testable core. A new `moshpitFilterStore.ts` holds all UI state. A new `useMoshpitFilteredAssets.ts` composable wraps `useMoshpitAssetRegistry` with the filter predicate and sort layout, feeding the existing sprite tween path.

The most important architectural insight: **the sprite tween path in `useMoshpitSpriteLayer` is already built**. Phase 3 does not replace it — it changes the *inputs* to that tween. The sprite layer currently calls `computeJitteredGrid(hashes, seed, cellSize)` to produce target positions. Phase 3 makes the layout function conditional on filter/sort state. When a sort is active, positions come from `computeSortedLayout1D` or `computeSortedLayout2D` instead. When sort is cleared, positions return to `computeJitteredGrid`. The 300ms ease-out-cubic runs in both cases through the exact same Ticker handler.

The second architectural insight: **workflow identification lives in the embedded PNG metadata, not in AssetItem fields**. The `prompt` PNG tEXt chunk encodes a JSON object keyed by node ID. `getFromPngBuffer` returns this as a raw string in `metadata["prompt"]`. The normalized `params` object (written to IDB by the extended worker) will contain the workflow filename as extracted from the `"workflow"` key in the same PNG metadata — ComfyUI embeds `extra_pnginfo.workflow.extra.workflow_filename` in the workflow chunk, but since D-02 disallows walking the `workflow` chunk, the workflow-filename grouping must derive from the `prompt` chunk's node graph or fall back to `AssetItem.name` (which encodes the output filename). The planner needs to confirm the fallback strategy; the recommended approach is to derive the "workflow group" from the `AssetItem.name` basename, which is the output filename (e.g., `ComfyUI_00042_.png` maps to no workflow; but if the user named the output with a workflow hint, that helps). More practically: the ComfyUI prompt chunk often contains a `"workflow"` key at the top level of the PNG metadata — this is the workflow JSON itself, not a filename. The embedded metadata does NOT contain a stable workflow filename in the `prompt` chunk. Therefore workflow grouping must be inferred from `AssetItem.user_metadata.workflow_filename` (if populated by the backend), or derived by finding a `"note"` key in the `workflow` chunk's `extra_data`, or — most robustly — from a summary hash of the node graph topology. Since v1 accepts filename-as-group (D-CONTEXT.md specifics) and D-02 locks prompt-only extraction, the planner's call is: extract workflow identifier from `AssetItem.name` → workflow-derived-display-name, or treat each unique `AssetItem.user_metadata` workflow_id as a group. The research section below documents the exact field.

**Primary recommendation:** Decompose Phase 3 into three clean waves: (1) pure math modules + IDB schema bump + worker extension + store; (2) filter pipeline + chip UI + Settings panel injection; (3) sort pipeline + axis overlay + HUMAN-UAT checklist.

---

## Standard Stack

### Core (all already in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pixi.js` | `^8.x` (installed) | Sprite layer tween targets | Already the canvas renderer [VERIFIED: codebase] |
| `pixi-viewport` | installed | World-to-screen transforms for axis label overlay | Already the viewport adapter [VERIFIED: codebase] |
| `pinia` | `^3.0.4` | `moshpitFilterStore` state | Project-wide standard [VERIFIED: codebase] |
| `idb` | `^7.x` (installed) | IDB schema bump (add `params` to `assetMeta`) | Phase 2 already uses it [VERIFIED: codebase] |
| `zod` | `^3.23.8` | Validated `NormalizedParams` schema | Project-wide standard; no `z.any()` [VERIFIED: codebase] |
| `reka-ui` | `^2.5.0` | Popover (add-filter picker), ComboboxRoot (workflow picker) | Project convention — no new PrimeVue [VERIFIED: codebase] |
| `es-toolkit` | `^1.39.9` | Utility functions inside filter/sort math | Project-wide preference over lodash [VERIFIED: codebase] |
| `vue-i18n` | `^9.14.5` | All new user-facing strings | Required by lint rule [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/vue-virtual` | installed | Virtual list for categorical value picker (if >200 items) | Only if workflow picker or categorical multi-select overflows DOM budget |
| `fuse.js` | `^7.0.0` | Fuzzy search for "Add filter" popover and categorical value picker | Fuzzy-match over 13 param names + discovered values |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTML overlay for axis labels | PixiJS `Text` drawn objects | PixiJS Text requires texture atlas, looks blurry at non-native zoom; HTML is crisper and already tracks transforms via pixi-viewport's `moved` event |
| Dedicated `sortMath.ts` | Extending `layoutMath.ts` | Either works; separate file keeps the existing module under 150 lines and makes testing boundaries cleaner |
| Zod schema for NormalizedParams | Raw TypeScript interface | Zod gives free validation + inference; required by `docs/guidance/typescript.md` conventions (no `any`) |

**Installation:** No new packages required. All dependencies are already present. [VERIFIED: codebase — `idb`, `zod`, `reka-ui`, `pixi.js`, `pixi-viewport`, `fuse.js` all in `pnpm-lock.yaml`]

---

## Architecture Patterns

### Recommended Module Layout (new files)
```
src/platform/moshpit/
├── stores/
│   └── moshpitFilterStore.ts          # new — filter/sort/grid-spacing/show-hidden state
├── composables/
│   └── useMoshpitFilteredAssets.ts    # new — wraps useMoshpitAssetRegistry + filter predicate + sort
├── services/
│   ├── paramNormalize.ts              # new — worker-safe, Zod-validated NormalizedParams extractor
│   ├── paramNormalize.test.ts         # new
│   ├── filterMath.ts                  # new — applyFilterChips(assets, chips, curation) → hashes
│   ├── filterMath.test.ts             # new
│   ├── sortMath.ts                    # new — computeSortedLayout1D, computeSortedLayout2D
│   └── sortMath.test.ts               # new
├── components/
│   ├── MoshpitSettingsPanel.vue       # extend — inject filter gate, chips, sort, grid-spacing
│   ├── MoshpitCanvas.vue              # extend — add axis-label overlay slot
│   ├── MoshpitWorkflowPicker.vue      # new — Reka ComboboxRoot single-select
│   ├── MoshpitTimeRangePicker.vue     # new — preset buttons + custom date input (Tailwind/Reka)
│   ├── MoshpitFilterChipRow.vue       # new — chip row + "+ Add filter" button
│   ├── MoshpitAddFilterPopover.vue    # new — two-step popover (param picker → value editor)
│   ├── MoshpitSortControls.vue        # new — X/Y axis picker
│   └── MoshpitAxisOverlay.vue         # new — HTML overlay with world-to-screen tracking
```

### Pattern 1: Worker Extension — Add `params` to `thumbReady`

The worker's `processAsset` currently calls `parseMetadata(buffer)` and posts raw `metadata: Record<string, string>`. Phase 3 extends this to also call `normalizeParams(metadata)` and include `params: NormalizedParams` in the `ThumbReadyMessage`. The `normalizeParams` function is a pure leaf module, importable from a Worker context (no Vue/Pinia/DOM imports).

```typescript
// Source: CONTEXT.md D-01; workerMessages.ts pattern [VERIFIED: codebase]

// workerMessages.ts — extend ThumbReadyMessage
export interface ThumbReadyMessage {
  readonly type: 'thumbReady'
  readonly id: string
  readonly filterId: string
  readonly contentHash: string
  readonly blob: Blob
  readonly width: number
  readonly height: number
  readonly metadata: Record<string, string>
  readonly assetId: string
  readonly params: NormalizedParams   // NEW
}

// paramNormalize.ts — worker-safe pure function
export interface NormalizedParams {
  readonly model: string | undefined
  readonly loras: readonly { readonly name: string; readonly weight: number }[]
  readonly cfg: number | undefined
  readonly steps: number | undefined
  readonly sampler: string | undefined
  readonly scheduler: string | undefined
  readonly seed: number | undefined
  readonly positivePrompt: string | undefined
  readonly negativePrompt: string | undefined
  readonly width: number | undefined
  readonly height: number | undefined
  readonly timestamp: number          // always defined
}

export function normalizeParams(
  rawMeta: Record<string, string>,
  createdAt: number
): NormalizedParams { ... }
```

**IDB schema bump:** `MOSHPIT_DB_VERSION` bumps from `1` → `2`. The `upgrade` callback adds `params` to the `assetMeta` store. Existing records without `params` are re-parsed lazily on first `getAssetMeta` read (or force-migrated on open — planner decides between (a) version-bump + full re-parse migration on `openMoshpitDB` upgrade, vs (b) lazy-add on first read). Recommended: option (a) — bounded cost, predictable, surfaces at dogfood time.

```typescript
// thumbRepository.types.ts — extend AssetMetaRecord
export interface AssetMetaRecord {
  readonly contentHash: string
  readonly metadata: Readonly<Record<string, string>>
  readonly curation: CurationRecord
  readonly params: NormalizedParams   // NEW — added in MOSHPIT_DB_VERSION 2
}
```

### Pattern 2: `moshpitFilterStore` — Single Source of Filter/Sort UI State

```typescript
// Source: CONTEXT.md D-15 + discretion section [ASSUMED shape; CITED: project conventions]

// moshpitFilterStore.ts
export interface TimeRange {
  readonly preset: 'today' | 'thisWeek' | 'thisMonth' | 'all' | 'custom'
  readonly from: number | null   // epoch ms; null if preset != 'custom'
  readonly to: number | null
}

export type ParamKey =
  | 'model' | 'loras' | 'cfg' | 'steps' | 'sampler' | 'scheduler'
  | 'seed' | 'positivePrompt' | 'negativePrompt' | 'width' | 'height'
  | 'timestamp' | 'favourite' | 'tags'

export type ChipValue =
  | { kind: 'numeric'; min: number | null; max: number | null; exact: number | null }
  | { kind: 'categorical'; values: readonly string[] }   // OR-combined
  | { kind: 'text'; substring: string }
  | { kind: 'resolution'; pairs: readonly [number, number][] }
  | { kind: 'boolean'; value: boolean }

export interface FilterChip {
  readonly id: string          // crypto.randomUUID() or nanoid-equivalent
  readonly param: ParamKey
  readonly value: ChipValue
}

const useMoshpitFilterStore = defineStore('moshpitFilter', () => {
  const workflow = ref<string | null>(null)
  const timeRange = ref<TimeRange>({ preset: 'all', from: null, to: null })
  const chips = ref<FilterChip[]>([])
  const sortX = ref<ParamKey | null>(null)
  const sortY = ref<ParamKey | null>(null)
  const gridSpacing = ref(DEFAULT_CELL_SIZE)   // inherits Phase 2 constant
  const showHidden = ref(false)

  const isGated = computed(() => workflow.value !== null)

  // actions: setWorkflow, setTimeRange, addChip, removeChip(id), updateChip,
  //          setSortX, setSortY, setGridSpacing, setShowHidden, reset
  ...
})
```

The store is intentionally flat. Filter application is a pure function (not a computed) to keep the 5k-asset loop off Pinia's reactivity graph.

### Pattern 3: `useMoshpitFilteredAssets` — Filter + Sort Composable

The composable sits between `useMoshpitAssetRegistry` (all assets with thumbs) and `useMoshpitSpriteLayer` (position targets). It applies filter predicates then sort layout.

```typescript
// Source: CONTEXT.md integration-points section [ASSUMED shape; built on VERIFIED codebase patterns]

export interface FilteredAssetEntry {
  readonly id: string
  readonly contentHash: string
  readonly thumbUrl: string | undefined
  readonly hasMetadata: boolean
  readonly worldX: number        // computed by layout function
  readonly worldY: number
}

export function useMoshpitFilteredAssets(): {
  readonly entries: ComputedRef<readonly FilteredAssetEntry[]>
  readonly axisColumns: ComputedRef<readonly AxisColumn[]>  // for label overlay
  readonly axisRows: ComputedRef<readonly AxisRow[]>        // for 2D label overlay
} { ... }
```

**The critical performance decision:** The `entries` computed must NOT be a deep reactive watch over 5k `NormalizedParams`. Instead:
1. `useMoshpitFilteredAssets` reads `moshpitFilterStore` state (shallow refs).
2. On filter/sort state change, it calls pure functions: `applyFilterChips(allEntries, chips, curation, showHidden) → ContentHash[]` then `computeSortedLayout1D(filteredHashes, params, sortX, gridSpacing) → GridSlot[]` (or `computeSortedLayout2D` for two-axis sort).
3. The result is a new `FilteredAssetEntry[]` with position fields added.
4. This replaces the `syncSprites` input in `useMoshpitSpriteLayer`.

Filter recomputation at 5k assets is O(N) linear scan over NormalizedParams objects — trivially within 16ms. The params are already deserialized into memory (stored in `moshpitMetadataStore` or a new `moshpitParamsStore`). No IndexedDB read on filter change.

### Pattern 4: `computeSortedLayout1D` and `computeSortedLayout2D`

```typescript
// Source: CONTEXT.md D-15/D-16 [ASSUMED implementation; based on existing layoutMath.ts pattern - VERIFIED]

// sortMath.ts — pure, deterministic, testable
export interface SortedGridSlot extends GridSlot {
  readonly columnIndex: number
  readonly rowIndex: number
}

export interface ColumnDescriptor {
  readonly paramValue: string       // JSON.stringify-comparable label
  readonly columnIndex: number
  readonly worldX: number
}

/**
 * D-16: column-per-unique-value bucketing.
 * Hashes with no value for sortX are excluded (D-17).
 * Returns slots sorted by column then packed row-by-row.
 */
export function computeSortedLayout1D(
  hashes: readonly string[],
  paramsByHash: ReadonlyMap<string, NormalizedParams>,
  sortX: ParamKey,
  gridSpacing: number
): { slots: SortedGridSlot[], columns: ColumnDescriptor[] }

export function computeSortedLayout2D(
  hashes: readonly string[],
  paramsByHash: ReadonlyMap<string, NormalizedParams>,
  sortX: ParamKey,
  sortY: ParamKey,
  gridSpacing: number
): { slots: SortedGridSlot[], columns: ColumnDescriptor[], rows: RowDescriptor[] }
```

**Bucketing mechanics for `computeSortedLayout1D`:**
1. Group hashes by `JSON.stringify(getParamValue(params, sortX))` — handles numeric and string values uniformly.
2. Sort groups: numeric params sort numerically; categorical params sort alphabetically.
3. Assign column index per group. Within each column, pack rows top-to-bottom in deterministic order (sort by content hash for stability).
4. World position = `(columnIndex * columnWidth, rowIndex * gridSpacing)` where `columnWidth = maxColumnHeight * gridSpacing` or simply `gridSpacing` with label labels at multiples.

**For `computeSortedLayout2D`:** Same bucketing on both axes. Asset position = `(colIndex * gridSpacing, rowIndex * gridSpacing)`. If multiple assets share the same (X-value, Y-value) cell, stack them vertically within the cell (increment row by 1 per asset in cell). Assets lacking either axis param are excluded.

### Pattern 5: Axis Label HTML Overlay

The axis labels (column headers for X axis, row labels for Y axis) must track viewport pan/zoom. The pixi-viewport's `moved` event fires on every pan/zoom frame and provides the current transform.

```typescript
// Source: MoshpitCanvas.vue existing moved event handler [VERIFIED: codebase]
// pixi-viewport: viewport.toScreen(worldX, worldY) → { x, y }

// MoshpitAxisOverlay.vue approach
// 1. Listens to the same 'moved' event MoshpitCanvas already subscribes to
// 2. On each 'moved', calls viewport.toScreen(worldX, 0) for each column descriptor
// 3. Updates CSS left/top on overlay <div> elements
// 4. Labels hidden when sort is inactive
```

The `viewport` instance is owned by `MoshpitCanvas`. To avoid prop-drilling the viewport ref, provide it via an injection key (same pattern as `MOSHPIT_QUEUE_INJECTION_KEY`). Planner decides whether to add `MOSHPIT_VIEWPORT_INJECTION_KEY` or pass `viewport` as a prop to `MoshpitAxisOverlay`.

### Pattern 6: Workflow Identifier Discovery

`AssetItem` from `assetsStore.outputJobAssets` has:
- `id: string` — job ID (not workflow-scoped)
- `name: string` — output filename (e.g., `ComfyUI_00042_.png`)
- `user_metadata: Record<string, unknown> | undefined` — contains `{ jobId, nodeId, subfolder, executionTimeInSeconds, format, create_time }` from `mapTaskOutputToAssetItem` [VERIFIED: assetMappers.ts]

`user_metadata` does NOT contain a workflow filename. [VERIFIED: assetMappers.ts lines 30-51]

The ComfyUI PNG `workflow` chunk (the full workflow JSON) contains `extra.workflow_filename` or similar — but D-02 prohibits walking the `workflow` chunk in v1.

**Consequence:** Workflow grouping must derive from the `prompt` chunk. The ComfyUI `prompt` chunk is a JSON object `{ [nodeId]: { class_type, inputs, _meta } }`. There is NO stable workflow-filename field in the `prompt` chunk alone. [ASSUMED: based on ComfyUI prompt format documentation; verify by inspecting real PNG output during dogfood]

**Recommended fallback:** Group assets by `AssetItem.user_metadata.workflow_id` if the backend populates it (from `mapTaskOutputToAssetItem`, field `jobId`); otherwise, derive a workflow fingerprint from the `prompt` chunk's node-class-type set (sorted alphabetically, joined) — this is a stable fingerprint for the same workflow topology. Display label: auto-generated from class types (e.g., "KSampler + CheckpointLoaderSimple"). This is a planner-level decision; the researcher flags it as a gap that needs a concrete answer before Plan writing.

**Alternative (simpler):** Surface all unique "workflow signatures" computed from the `prompt` chunk's node-class-type fingerprint as workflow picker options. Show count alongside. This is deterministic and requires no `workflow` chunk walking.

### Pattern 7: Reka UI Combobox for Workflow Picker

`SearchAutocomplete.vue` already uses `ComboboxRoot/ComboboxInput/ComboboxContent/ComboboxItem` from `reka-ui`. [VERIFIED: codebase]. The workflow picker can build directly on the same primitives.

```typescript
// Pattern from SearchAutocomplete.vue [VERIFIED: codebase]
import {
  ComboboxAnchor, ComboboxContent, ComboboxInput,
  ComboboxItem, ComboboxRoot
} from 'reka-ui'
```

`MoshpitWorkflowPicker.vue` is a simpler version: no generic type parameter needed, options are `{ name: string; count: number }[]`, display format `"workflow_name (1,247 assets)"`.

### Pattern 8: Reka UI Popover for "+ Add Filter"

`Popover.vue` in `src/components/ui/Popover.vue` already wraps `PopoverRoot/PopoverContent/PopoverPortal/PopoverArrow` from `reka-ui`. [VERIFIED: codebase]. The add-filter picker popover can reuse this component or build directly on the Reka primitives for richer content control.

### Anti-Patterns to Avoid

- **Reactive loops in 5k filter math.** Do NOT use `watchEffect` or `computed` that reads all `NormalizedParams` individually. Read params from a `Map<contentHash, NormalizedParams>` in a single O(N) loop inside a pure function called once per filter state change.
- **Storing params in a separate Pinia store with per-asset reactivity.** The `moshpitMetadataStore` already holds `metaByHash: Map<hash, Record<string, string>>`. Phase 3 stores `NormalizedParams` in the same IDB record. Load them once at warm-cache init into a local `Map<hash, NormalizedParams>` — not into a reactive Pinia map that re-renders on every update.
- **Calling `computeJitteredGrid` from inside `watchEffect`.** The sprite layer already does this. Phase 3 passes new layout targets *into* the existing tween path rather than re-implementing tweens.
- **New PrimeVue components.** DateRangeFilter.vue is PrimeVue-based. Do NOT copy it into Phase 3. Ship a Moshpit-local Tailwind+Reka date-range control.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy search in categorical value picker | Custom string distance | `fuse.js` | Already in package.json; handles Unicode, short-string edge cases |
| PRNG for sorted-layout determinism | Custom LCG | `mulberry32` from `contentHash.ts` | Already exists and tested; seeded by filter-hash |
| CSS transform tracking for overlay | Manual matrix math | `pixi-viewport.toScreen(worldX, worldY)` | Viewport already computes the transform; calling `toScreen` is O(1) |
| Virtual list for large categorical pickers | Custom list slicing | `@tanstack/vue-virtual` | Already in package.json; handles variable heights |
| IDB version migrations | Custom migration runner | `idb` v7 `openDB` `upgrade` callback | Already the pattern (Plan 02-04); version bump + `if (newVersion >= 2)` branch |

---

## Common Pitfalls

### Pitfall 1: Worker import of `paramNormalize.ts` pulls in non-Worker-safe deps
**What goes wrong:** `paramNormalize.ts` is imported by `thumbWorker.ts`. If it imports from Vue, Pinia, or DOM-only libs, the worker bundle fails at runtime.
**Why it happens:** Vite's `?worker` bundling respects tree-shaking but not always implicit DOM globals.
**How to avoid:** `paramNormalize.ts` must be a strict leaf module: only imports from `./workerMessages` (for types) and no external deps. The `normalizeParams` function parses JSON strings — all standard JS, no DOM.
**Warning signs:** TypeScript reports `window is not defined` or Pinia store access inside the worker.

### Pitfall 2: IDB schema bump without migration drops existing Phase 2 cached data
**What goes wrong:** Bumping `MOSHPIT_DB_VERSION` to 2 without adding an `upgrade` handler for the `assetMeta` store's new `params` field causes existing records to be read with `params: undefined`. Filter/sort math then sees all `undefined` params.
**Why it happens:** `idb`'s `openDB` only fires the `upgrade` callback for new version numbers; it does not auto-migrate existing records.
**How to avoid:** In the `upgrade` callback for `newVersion === 2`, iterate all existing `assetMeta` records and re-parse `params` from their `metadata` field using `normalizeParams`. This is a one-time bounded cost.
**Warning signs:** All assets show as "lacking sorted parameter" immediately after upgrading to Phase 3.

### Pitfall 3: `useMoshpitSpriteLayer`'s `computeLayoutSlots` is called inside `watchEffect` — Phase 3 must not break this
**What goes wrong:** `useMoshpitSpriteLayer.syncSprites` calls `computeLayoutSlots(hashes)` which calls `computeJitteredGrid`. If Phase 3 replaces `computeLayoutSlots` with a conditional layout function that reads filter store state, this watchEffect callback must also track filter store deps — or it will not re-run on filter changes.
**Why it happens:** `watchEffect` only tracks reactive deps accessed during execution. If the layout function switch is conditional on a ref that isn't accessed inside `watchEffect`, reactivity is broken.
**How to avoid:** The cleanest solution is to extend `useMoshpitSpriteLayer` to accept layout targets from *outside* (passed by `useMoshpitFilteredAssets`) rather than computing them internally. The sprite layer becomes purely a tween executor. `useMoshpitFilteredAssets` computes the targets reactively and passes them in.
**Alternative:** Pass `layoutFn: () => GridSlot[]` as an option to the sprite layer, ensuring it is called *inside* `watchEffect`. Either approach works; the first is architecturally cleaner.

### Pitfall 4: Workflow picker options derived from live `outputJobAssets` include in-progress assets
**What goes wrong:** `assetsStore.outputJobAssets` is a live stream. Assets currently being processed (no metadata yet) have no `params.workflow` identifier. The workflow picker would show unstable option counts during processing.
**Why it happens:** Phase 2's pipeline adds assets to `outputJobAssets` before metadata is parsed.
**How to avoid:** Derive workflow picker options only from assets that have completed `moshpitMetadataStore.metaByHash` entries. Filter `outputJobAssets` to those with a populated `metaByHash` entry before grouping.

### Pitfall 5: `pixi-viewport.toScreen` called before viewport is initialized
**What goes wrong:** `MoshpitAxisOverlay.vue` is mounted inside `MoshpitCanvas.vue` template but the viewport is created asynchronously (after `Application.init()`). If the overlay tries to call `viewport.toScreen()` before init completes, it throws.
**Why it happens:** `Application.init()` is async; viewport is null until init resolves.
**How to avoid:** The overlay should only render (and track) when the viewport injection key is non-null. Initialize the injection key ref as `null` and set it only after `await pending.init()` completes — same timing as when `spriteLayerRef` is created in `MoshpitCanvas.vue`.

### Pitfall 6: OR semantics within a chip vs AND semantics across chips — filter math edge cases
**What goes wrong:** A chip with `param: 'sampler'`, `values: ['euler', 'dpmpp_2m']` must match assets where sampler is EITHER euler OR dpmpp_2m. A second chip with `param: 'model'`, `values: ['model_x.safetensors']` must AND with the sampler chip. Getting the logic inverted (ANDing values within a chip, ORing across chips) silently produces wrong results.
**Why it happens:** Developer copies the outer AND loop and applies it to the inner values loop.
**How to avoid:** `filterMath.ts` unit tests MUST cover multi-value single-chip (OR) vs multi-chip (AND) cases explicitly. The filter predicate function signature should make the semantics explicit: `matchesChip(params, chip) → boolean` (OR within chip); `allChipsMatch(params, chips) → boolean` (AND across chips).

### Pitfall 7: `timestamp` field for time-range filter needs consistent units
**What goes wrong:** `AssetItem.created_at` is an ISO string. `NormalizedParams.timestamp` mirrors it as epoch ms. The time-range filter computes start/end in epoch ms from `getDateRangeForPreset`. If `timestamp` stores seconds instead of milliseconds, the comparison is off by 1000×.
**Why it happens:** `new Date(isoString).getTime()` returns ms; confusion arises if the raw `created_at` value is already numeric.
**How to avoid:** In `paramNormalize.ts`, always derive `timestamp` via `new Date(assetItem.created_at ?? 0).getTime()` — epoch ms. The time-range predicate compares `params.timestamp >= rangeStart && params.timestamp < rangeEnd` where `rangeStart` and `rangeEnd` are also `Date.getTime()` values.

---

## Code Examples

### Example 1: `normalizeParams` — ComfyUI API format extraction

```typescript
// Source: CONTEXT.md D-05 + ComfyUI prompt format domain ref [VERIFIED: pattern; ASSUMED: specific node class names]
// thumbWorker.ts calls: normalizeParams(metadata, createdAtMs)

type PromptNode = {
  class_type: string
  inputs: Record<string, unknown>
  _meta?: { title?: string }
}

export function normalizeParams(
  rawMeta: Record<string, string>,
  createdAtMs: number
): NormalizedParams {
  const promptRaw = rawMeta['prompt']
  if (!promptRaw) {
    return emptyParams(createdAtMs)
  }

  let graph: Record<string, PromptNode>
  try {
    graph = JSON.parse(promptRaw) as Record<string, PromptNode>
  } catch {
    return emptyParams(createdAtMs)
  }

  // Find KSampler-family nodes
  const samplerNode = findNodeByClassTypes(graph, [
    'KSampler', 'KSamplerAdvanced', 'KSamplerSelect'
  ])
  // Find checkpoint node
  const checkpointNode = findNodeByClassTypes(graph, [
    'CheckpointLoaderSimple', 'CheckpointLoader'
  ])
  // Find LoRA nodes
  const loraNodes = findAllNodesByClassTypes(graph, [
    'LoraLoader', 'LoraLoaderModelOnly', 'LoraTagLoader'
  ])
  // Find latent dimensions
  const latentNode = findNodeByClassTypes(graph, [
    'EmptyLatentImage', 'EmptySD3LatentImage', 'EmptyHunyuanLatentVideo'
  ])

  // Resolve positive/negative prompts by walking conditioning refs
  const { positivePrompt, negativePrompt } = resolvePrompts(graph, samplerNode)

  return {
    model: checkpointNode?.inputs['ckpt_name'] as string | undefined,
    loras: loraNodes.map((n) => ({
      name: (n.inputs['lora_name'] ?? n.inputs['lora_tag']) as string,
      weight: ((n.inputs['strength_model'] ?? n.inputs['strength']) as number) ?? 1
    })).filter(l => l.name),
    cfg: samplerNode?.inputs['cfg'] as number | undefined,
    steps: samplerNode?.inputs['steps'] as number | undefined,
    sampler: samplerNode?.inputs['sampler_name'] as string | undefined,
    scheduler: samplerNode?.inputs['scheduler'] as string | undefined,
    seed: samplerNode?.inputs['seed'] as number | undefined,
    positivePrompt,
    negativePrompt,
    width: latentNode?.inputs['width'] as number | undefined,
    height: latentNode?.inputs['height'] as number | undefined,
    timestamp: createdAtMs
  }
}
```

**Note on `resolvePrompts`:** KSampler's `inputs.positive` is either a string (literal) or an array `[nodeId, outputIndex]` reference. Following the reference → find the CLIPTextEncode node → read `inputs.text`. The heuristic: KSampler.positive ref → CLIPTextEncode.text = positivePrompt; KSampler.negative ref → CLIPTextEncode.text = negativePrompt.

### Example 2: `filterMath.ts` — apply filter chips

```typescript
// Source: CONTEXT.md D-11/D-12 [ASSUMED implementation]

export function applyFilterChips(
  hashToParams: ReadonlyMap<string, NormalizedParams>,
  hashToCuration: ReadonlyMap<string, CurationRecord>,
  chips: readonly FilterChip[],
  showHidden: boolean,
  timeRange: TimeRange
): readonly string[] {
  const visible: string[] = []
  for (const [hash, params] of hashToParams) {
    if (!matchesTimeRange(params.timestamp, timeRange)) continue
    const curation = hashToCuration.get(hash)
    if (!showHidden && (curation?.hidden ?? false)) continue
    if (!chips.every((chip) => matchesChip(params, curation ?? defaultCuration(), chip))) continue
    visible.push(hash)
  }
  return visible
}

// Within-chip semantics: OR for multi-value categorical chips
function matchesChip(params: NormalizedParams, curation: CurationRecord, chip: FilterChip): boolean {
  switch (chip.value.kind) {
    case 'categorical': {
      const paramVal = getParamValue(params, curation, chip.param)
      if (paramVal === undefined) return false
      // OR within chip: any value in the chip matches
      return chip.value.values.some(v => matchesCategorical(paramVal, v))
    }
    case 'numeric': { ... }
    case 'text': { ... }
    case 'boolean': { ... }
    case 'resolution': { ... }
  }
}
```

### Example 3: `computeSortedLayout1D` — column bucketing

```typescript
// Source: CONTEXT.md D-16 [ASSUMED implementation; builds on layoutMath.ts pattern - VERIFIED]

export function computeSortedLayout1D(
  visibleHashes: readonly string[],
  paramsByHash: ReadonlyMap<string, NormalizedParams>,
  sortX: ParamKey,
  gridSpacing: number
): { slots: SortedGridSlot[]; columns: ColumnDescriptor[] } {
  // Group by serialized param value
  const groups = new Map<string, string[]>()
  for (const hash of visibleHashes) {
    const params = paramsByHash.get(hash)
    const val = params ? getParamValue(params, sortX) : undefined
    if (val === undefined) continue   // D-17: exclude assets lacking the sorted param
    const key = JSON.stringify(val)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(hash)
  }

  // Sort columns: numeric by value, string alphabetically
  const sortedKeys = [...groups.keys()].sort(compareParamKeys)
  const slots: SortedGridSlot[] = []
  const columns: ColumnDescriptor[] = []

  sortedKeys.forEach((key, colIdx) => {
    const colHashes = groups.get(key)!.sort()  // deterministic row order within column
    columns.push({ paramValue: key, columnIndex: colIdx, worldX: colIdx * gridSpacing })
    colHashes.forEach((hash, rowIdx) => {
      slots.push({ hash, worldX: colIdx * gridSpacing, worldY: rowIdx * gridSpacing, columnIndex: colIdx, rowIndex: rowIdx })
    })
  })

  return { slots, columns }
}
```

### Example 4: `useMoshpitSpriteLayer` integration — passing layout targets in

Phase 3's cleanest integration: extend `SpriteLayerOptions` to accept an optional external layout provider.

```typescript
// Source: CONTEXT.md integration-points; extends existing useMoshpitSpriteLayer [VERIFIED: codebase pattern]

export interface SpriteLayerOptions {
  readonly viewport: Viewport
  readonly ticker: Ticker
  readonly queue: ProcessingQueueState
  readonly cellSize?: number
  /** Phase 3: if provided, overrides internal computeLayoutSlots. Returns [GridSlot[], fromChaos?] */
  readonly layoutProvider?: () => readonly GridSlot[]
}
```

When `layoutProvider` is provided, `syncSprites` calls `layoutProvider()` instead of `computeLayoutSlots(hashes)`. The tween fires on any layout target change (detected by comparing new vs old positions). This keeps the sprite layer's tween logic untouched while Phase 3 drives new position targets.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual IDB queries per filter change | In-memory Map over pre-loaded NormalizedParams | Phase 3 (new) | O(1) param lookup vs O(N) IDB transactions on every filter change |
| `getFromPngBuffer` called each time | Worker normalizes once, stores params in IDB | Phase 3 (new) | Zero main-thread parse cost on warm cache |
| Linear filter scan with DOM-reactive ops | Pure function filter + decoupled reactive trigger | Phase 3 (new) | 5k assets filter << 1ms, no frame drop |

**Deprecated/outdated for Phase 3:**
- `DateRangeFilter.vue` using PrimeVue DatePicker: do not reuse; ship a Moshpit-local Tailwind+Reka control.
- Any `v-for` loop directly over `paramsByHash` in Vue template: use pure function filter before template; never render 5k reactive bindings.

---

## Open Questions (RESOLVED)

1. **Workflow identifier for the picker**
   - What we know: `AssetItem.user_metadata` does NOT contain a workflow filename (verified: assetMappers.ts). The `prompt` PNG chunk contains no filename. The `workflow` chunk contains filename but D-02 prohibits walking it.
   - What's unclear: What stable workflow identifier should the v1 picker group by?
   - Recommendation: Derive a fingerprint from the sorted set of `class_type` values in the `prompt` graph. Include this as `workflowFingerprint: string` in `NormalizedParams`. Picker displays as `"[KSampler + Checkpoint + LoRA] (42 assets)"`. User can distinguish sweep configs even without filenames. **This is a planner-level decision that must be resolved before writing the param-extraction plan.**
   - **RESOLVED** in Plan 01 (workflowFilename + workflowFingerprint in NormalizedParams) + Plan 07 (picker displayName)

2. **IDB migration strategy: force-on-open vs lazy-per-read**
   - What we know: Version bump to 2 fires the upgrade callback. Iterating all records and re-parsing during upgrade is O(N) in worker. Lazy-per-read means `params` is undefined until next processing run.
   - What's unclear: How many Phase 2 IDB records will exist at Phase 3 dogfood time? (likely < 100 during dev; could be thousands at real user time)
   - Recommendation: Force migration in upgrade callback — bounded, predictable, user sees it as a one-time "migrating..." state. Bounded to the number of cached assets.
   - **RESOLVED** in Plan 04 (force-on-open v1→v2 migration)

3. **`useMoshpitSpriteLayer` extension strategy**
   - What we know: Current `computeLayoutSlots` is called inside `watchEffect`. Phase 3 layout is conditional on filter/sort state.
   - What's unclear: Whether to (a) pass `layoutProvider` option, (b) move layout computation entirely outside the sprite layer, or (c) add filter store reads inside the sprite layer itself.
   - Recommendation: (b) — `useMoshpitFilteredAssets` is the single source of `{ entries, layoutSlots }`. The sprite layer accepts `layoutSlots` alongside `entries` (or derives positions from entries that now carry `worldX/worldY`). This most cleanly separates concerns: sprite layer handles PixiJS; filtered assets handles filter/sort math.
   - **RESOLVED** in Plan 06 (layoutProvider option on useMoshpitSpriteLayer)

4. **Grid spacing range and default**
   - What we know: D-04 uses `DEFAULT_CELL_SIZE = 560` (Phase 2 constant). SORT-04 requires user-configurable spacing.
   - What's unclear: Min/max bounds for the slider. Too small → sprites overlap; too large → canvas becomes unusable.
   - Recommendation: min = 200px (thumbnail ~180px + 20px padding), max = 1200px, step = 50px, default = 560.
   - **RESOLVED** in Plan 06 (GRID_SPACING_MIN=200, GRID_SPACING_MAX=1200, GRID_SPACING_STEP=50, GRID_SPACING_DEFAULT=560)

---

## Environment Availability

Step 2.6: All dependencies are already installed in the project. No external services are required. No new packages needed.

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| `idb` v7 | IDB schema bump | ✓ | Phase 2 installed [VERIFIED: codebase] |
| `zod` | NormalizedParams schema | ✓ | Project-wide [VERIFIED: codebase] |
| `reka-ui` | Workflow picker + popover | ✓ | SearchAutocomplete.vue already uses it [VERIFIED: codebase] |
| `fuse.js` | Categorical fuzzy search | ✓ | In package.json [VERIFIED: codebase] |
| `pixi.js` v8 | Sprite tween | ✓ | Phase 1/2 installed [VERIFIED: codebase] |
| `pixi-viewport` | Axis overlay transforms | ✓ | Phase 1 installed [VERIFIED: codebase] |

**No missing dependencies.**

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (unit/component, happy-dom) + Playwright 1.58 (E2E) |
| Config file | `vite.config.mts` (unit), `playwright.config.ts` (E2E) |
| Quick run command | `pnpm test:unit --run src/platform/moshpit` |
| Full suite command | `pnpm test:unit && pnpm typecheck && pnpm lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | New File? |
|--------|----------|-----------|-------------------|-----------|
| FILTER-01 | Canvas empty state until workflow+range set; `setFilter` called on gate entry | unit (filterStore) + manual UAT | `pnpm test:unit --run moshpitFilterStore` | ❌ Wave 0 |
| FILTER-02 | Model chip predicate: assets matching model pass, others excluded | unit (filterMath) | `pnpm test:unit --run filterMath` | ❌ Wave 0 |
| FILTER-03 | LoRA chip OR semantics: asset with lora "A" matches chip with values ["A","B"] | unit (filterMath) | `pnpm test:unit --run filterMath` | ❌ Wave 0 |
| FILTER-04 | Numeric range chips: CFG 7.0 inside [6,8] passes; 5.0 excluded | unit (filterMath) | `pnpm test:unit --run filterMath` | ❌ Wave 0 |
| FILTER-05 | Substring text chip: "masterpiece" matches "beautiful masterpiece" | unit (filterMath) | `pnpm test:unit --run filterMath` | ❌ Wave 0 |
| FILTER-06 | Time-range filter: timestamp within range passes | unit (filterMath) | `pnpm test:unit --run filterMath` | ❌ Wave 0 |
| FILTER-07 | Favourite chip: `curation.favourite === true` passes boolean chip | unit (filterMath) | `pnpm test:unit --run filterMath` | ❌ Wave 0 |
| FILTER-08 | Subtractive: filtered-out assets absent from `entries` (not dimmed) | unit (useMoshpitFilteredAssets) | `pnpm test:unit --run useMoshpitFilteredAssets` | ❌ Wave 0 |
| FILTER-09 | Asset with `model: undefined` excluded when model filter active | unit (filterMath) | `pnpm test:unit --run filterMath` | ❌ Wave 0 |
| FILTER-10 | `removeChip(id)` removes chip from store; entries recomputed | unit (moshpitFilterStore) | `pnpm test:unit --run moshpitFilterStore` | ❌ Wave 0 |
| FILTER-11 | `showHidden: false` (default) excludes `curation.hidden: true` assets | unit (filterMath) | `pnpm test:unit --run filterMath` | ❌ Wave 0 |
| SORT-01 | 1D sorted layout: 4 CFG values → 4 columns, assets in correct columns | unit (sortMath) | `pnpm test:unit --run sortMath` | ❌ Wave 0 |
| SORT-02 | 2D scatter: sampler × CFG produces correct (col, row) for each asset | unit (sortMath) | `pnpm test:unit --run sortMath` | ❌ Wave 0 |
| SORT-03 | Asset with `cfg: undefined` absent from sorted layout output | unit (sortMath) | `pnpm test:unit --run sortMath` | ❌ Wave 0 |
| SORT-04 | gridSpacing=200 → column separation = 200px | unit (sortMath) | `pnpm test:unit --run sortMath` | ❌ Wave 0 |
| SORT-05 | All positions are multiples of gridSpacing (grid-snapped) | unit (sortMath) | `pnpm test:unit --run sortMath` | ❌ Wave 0 |
| NormalizedParams | KSampler cfg/steps/sampler/scheduler/seed extracted correctly | unit (paramNormalize) | `pnpm test:unit --run paramNormalize` | ❌ Wave 0 |
| NormalizedParams | LoRA array populated from LoraLoader node | unit (paramNormalize) | `pnpm test:unit --run paramNormalize` | ❌ Wave 0 |
| NormalizedParams | Empty `{}` metadata returns `emptyParams` with all fields undefined except timestamp | unit (paramNormalize) | `pnpm test:unit --run paramNormalize` | ❌ Wave 0 |
| Core value (qualitative) | CFG sweep on real workflow produces legible column arrangement | HUMAN-UAT (03-HUMAN-UAT.md) | manual | N/A |

### Sampling Rate
- **Per task commit:** `pnpm test:unit --run src/platform/moshpit`
- **Per wave merge:** `pnpm test:unit && pnpm typecheck && pnpm lint`
- **Phase gate:** Full suite green + 03-HUMAN-UAT.md completed before `/gsd-verify-work`

### Wave 0 Gaps (must exist before implementation waves)

- [ ] `src/platform/moshpit/services/paramNormalize.test.ts` — RED stubs covering FILTER-02/03/04/05/06/07/09 + NormalizedParams extraction
- [ ] `src/platform/moshpit/services/filterMath.test.ts` — RED stubs for all FILTER-* unit cases
- [ ] `src/platform/moshpit/services/sortMath.test.ts` — RED stubs for all SORT-* unit cases
- [ ] `src/platform/moshpit/stores/moshpitFilterStore.test.ts` — RED stubs for FILTER-01, FILTER-10
- [ ] `src/platform/moshpit/composables/useMoshpitFilteredAssets.test.ts` — RED stub for FILTER-08 integration
- [ ] `03-HUMAN-UAT.md` — qualitative CFG-sweep dogfood checklist (D-20)

Phase 2's three `test.skip` E2E scaffolds in `asset-pipeline.spec.ts` should be **un-skipped** as part of Phase 3's filter gate wiring — they are blocked on `queue.setFilter()` being called, which Phase 3's filter gate supplies.

### Nyquist Compliance Note

Phase 2's `nyquist_compliant: false` flips to `true` in Phase 3 once:
1. The three `test.skip` Playwright scenarios in `asset-pipeline.spec.ts` are un-skipped and passing
2. All Wave 0 Vitest stubs above turn GREEN
3. `03-HUMAN-UAT.md` returns a PASS sign-off

---

## Security Domain

> `security_enforcement` not explicitly set to false in config.json — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — local only, no auth surface in Phase 3 |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | yes | `normalizeParams` uses Zod for `NormalizedParams` shape; `JSON.parse` wrapped in try/catch; all `Record<string, unknown>` fields narrowed before use |
| V6 Cryptography | no | No new crypto; content hash is Phase 2 |

### Known Threat Patterns for Phase 3 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed `prompt` JSON in PNG metadata | Tampering | `try/catch` around `JSON.parse(rawMeta['prompt'])` → return `emptyParams`. Already pattern in `processAsset` [VERIFIED: thumbWorker.ts] |
| Prototype pollution via `JSON.parse` of prompt chunk | Tampering | Validate parsed result as `Record<string, PromptNode>` via Zod before accessing properties; never spread unknown objects into store state |
| XSS via LoRA name / model name rendered in axis labels | XSS | All axis label content rendered via Vue text interpolation (not `v-html`); Tailwind text classes; no `innerHTML` |
| IDB stored `NormalizedParams` with injected script strings | Stored XSS | `NormalizedParams` fields are string primitives rendered via text interpolation only; no eval or innerHTML in filter chip or axis label components |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ComfyUI prompt chunk contains KSampler node with `inputs.cfg`, `inputs.steps`, `inputs.sampler_name`, `inputs.scheduler`, `inputs.seed` | Code Examples §1 | Params extraction returns undefined for those fields; sort/filter by those params won't work until extraction is fixed |
| A2 | `CLIPTextEncode` node is referenced by KSampler's `positive`/`negative` inputs as `[nodeId, outputIndex]` arrays | Code Examples §1 (resolvePrompts) | Positive/negative prompt extraction fails; text filter returns no matches |
| A3 | LoRA nodes have `class_type` containing "Lora" (LoraLoader, LoraLoaderModelOnly, LoraTagLoader) with inputs `lora_name` + `strength_model` | Code Examples §1 | LoRA filter/sort doesn't populate; returns empty arrays |
| A4 | `AssetItem.user_metadata` does NOT contain a stable workflow filename | Architecture §Pattern 6 | If it does contain one, the recommended workflow-fingerprint approach is unnecessary; use the field directly instead |
| A5 | Grid spacing range [200, 1200] with default 560 is ergonomically sensible | Open Questions §4 | Default or bounds may feel off; fixable post-dogfood |
| A6 | `normalizeParams` run in the worker at parse time is fast enough to not impact 5k-asset cold-start time | Performance pitfall note | If slow, move to lazy-load from IDB on filter-store init; likely not an issue given O(1) JSON parse per asset |

---

## Sources

### Primary (HIGH confidence)
- `src/platform/moshpit/services/layoutMath.ts` — coordinate system, GridSlot interface, `computeJitteredGrid`/`computePackedGrid` patterns
- `src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` — tween path, watchEffect contract, `SpriteLayerOptions`
- `src/platform/moshpit/services/workerMessages.ts` — discriminated union message contract
- `src/platform/moshpit/services/thumbRepository.types.ts` — `AssetMetaRecord`, `MOSHPIT_DB_VERSION`, IDB schema
- `src/platform/moshpit/stores/moshpitMetadataStore.ts` — metadata store pattern
- `src/platform/moshpit/composables/useMoshpitAssetRegistry.ts` — `AssetEntry` interface, composition pattern
- `src/platform/moshpit/components/MoshpitSettingsPanel.vue` — injection slot comment
- `src/platform/moshpit/components/MoshpitCanvas.vue` — viewport lifecycle, `moved` event subscription
- `src/components/ui/search-input/SearchAutocomplete.vue` — Reka ComboboxRoot usage pattern
- `src/components/ui/Popover.vue` — Reka PopoverRoot usage pattern
- `src/components/ui/slider/Slider.vue` — Reka SliderRoot usage pattern
- `src/platform/assets/types/metadataFilter.ts` — `DatePreset` enum + `getDateRangeForPreset`
- `src/platform/assets/composables/media/assetMappers.ts` — `AssetItem.user_metadata` shape (confirmed no workflow_filename)
- `src/scripts/metadata/png.ts` — `getFromPngBuffer` returns `Record<string, string>` keyed by tEXt/iTXt chunk keyword
- `.planning/phases/02-asset-pipeline/02-11-canvas-sprites-and-tween-SUMMARY.md` — follow-up items Phase 3 must address (queue.setFilter call, 3 skipped Playwright specs)

### Secondary (MEDIUM confidence)
- CONTEXT.md canonical refs — ComfyUI API-format prompt JSON structure (class_type, inputs.cfg etc.)
- Phase 2 plan summaries (02-04, 02-05, 02-06, 02-07, 02-08) — confirmed final shapes of all IDB/worker/store APIs

### Tertiary (LOW confidence)
- Specific ComfyUI node class names (KSampler, CheckpointLoaderSimple, LoraLoader, CLIPTextEncode, EmptyLatentImage) — based on training knowledge of ComfyUI prompt format; should be verified against a real ComfyUI PNG output during Wave 0/1 implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in codebase
- Architecture patterns: HIGH — built directly on VERIFIED Phase 2 APIs; integration points confirmed
- Normalization logic: MEDIUM — class names and input field names are ASSUMED from ComfyUI documentation; verify with real PNG during implementation
- Pitfalls: HIGH — directly derived from existing codebase code reading
- Performance: HIGH — O(N) pure function analysis; no new reactive complexity

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable dependencies; pixi.js v8 API is stable)
