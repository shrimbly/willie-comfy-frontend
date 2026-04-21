# Phase 4: Lineage Groupings & Within-Cluster Sort — Research

**Researched:** 2026-04-21 (recovery run — reconstructed from existing six PLAN.md files + verified against current codebase)
**Domain:** Vue 3.5 + Pinia + PixiJS spatial canvas; pure layout math; IndexedDB schema migration; Reka UI disclosure chrome
**Confidence:** HIGH — every claim grounded in files inspected this session; assumptions explicitly tagged

## Summary

Phase 4 replaces the now-deprecated Phase 3 parameter-sort UI with lineage-based spatial clustering. The architectural approach locked in by discussion and encoded in the six existing plans is:

- **Two new pure math modules** (`clusterLayout.ts` + `groupAxes.ts`) sit as peers of `sortMath.ts` / `filterMath.ts` / `layoutMath.ts` in `src/platform/moshpit/services/`. The existing `sortMath` module is retained (header-comment update only) because `computeSortedLayout1D`'s row-band packing is the right primitive for leaf-cluster flat grids.
- **`NormalizedParams` gains one new field** (`saveNodeIdentity: string | null`) extracted at `normalizeParams` time by walking the ComfyUI prompt graph for output-class nodes. IDB bumps v2 → v3 with a cursor migration that re-derives the field from already-stored raw PNG metadata — no re-thumbnailing.
- **Reactive pipeline pivots** in `useMoshpitFilteredAssets`: filter chips + visible-hash set feed `computeNestingOrder` → `computeClusterLayout`, which emits both `ClusterNode` tree (for the HTML overlay) and a flat `GridSlot[]` (for the sprite layer — shape unchanged, so the 300ms ease-out-cubic tween in `useMoshpitSpriteLayer` is reused as-is).
- **UI surface** adds three small Vue SFCs (`MoshpitGroupingToggles.vue` — 5 pill buttons; `MoshpitWithinClusterSort.vue` — native `<select>`; `MoshpitAdvancedFilters.vue` — Reka `Collapsible` wrapper around a second `MoshpitFilterChipRow` instance with a `tier="advanced"` prop). The cluster overlay (`MoshpitClusterOverlay.vue`) mirrors the existing Phase 3 `MoshpitAxisOverlay` pattern: HTML absolutely-positioned over the Pixi canvas, re-computing world→screen positions on `viewport.on('moved')` via a `transformTick` ref.
- **Deletion is bounded:** `MoshpitSortControls.vue`, `MoshpitAxisOverlay.vue` and their tests are deleted; `moshpit.sort.*` i18n keys are removed. `sortMath` + `MoshpitGridSpacingControl` + `MoshpitShowHiddenToggle` + excluded-count row are retained.
- **Validation (D-20/D-22):** Phase 4 is the v3 Core Value gate. Vitest covers all pure math + store + composable + component behaviour; a best-effort `@moshpit` Playwright spec covers UI chrome; a `04-HUMAN-UAT.md` dogfood checklist is the qualitative go/no-go for Phase 5.

**Primary recommendation:** Follow the plan-encoded architecture literally. Every key decision (D-01..D-22 in CONTEXT.md) has corresponding substrate in the codebase — the plans are implementable against the real files as inspected.

## User Constraints (from CONTEXT.md)

### Locked Decisions

Full decision list D-01..D-22 is in `04-CONTEXT.md`; canonical summary (research rederivation + verification added):

- **D-01 Hierarchical row-column packing** for `computeClusterLayout` (new pure module `src/platform/moshpit/services/clusterLayout.ts`). Recursive row-wrapping grid at branch levels; leaf = flat grid via row-band packing.
- **D-02 Auto-nesting order = average-bucket-size descending**, ties broken by PRD §5.3 declaration order (`workflow → saveNode → prompt → model → type`).
- **D-03 Depth-proportional cluster spacing**: gap at depth `d` = `baseGap * (maxDepth - d + 1)`, baseGap ties to existing `gridSpacing`.
- **D-04 "(other)" bucket is just another bucket** at its level; no special placement; label = literal `(other)` via `moshpit.grouping.otherLabel`.
- **D-05 Performance budget**: <100ms pure math at 5k assets (memoised bucket-key per `(hash, axis)`), 300ms existing ease-out-cubic tween carries motion; total <400ms.
- **D-06 Bounding boxes + HTML labels** at two outermost nesting levels only. Deeper levels rely on gap hierarchy.
- **D-07 Within-cluster sort** = single global dropdown with 3 modes: `newestFirst` (default), `oldestFirst`, `alphabetical` (on source PNG filename).
- **D-08 Save-node identity** = `_meta.title` ?? `class_type` from first output-class node in `Object.values` iteration order. Output-class set: `SaveImage`, `PreviewImage`, `SaveImageWebsocket`, `SaveAnimatedWEBP`, `SaveImageExtended`.
- **D-09 Type bucketing** = derived-at-read helper `deriveTypeBucket(params)` on aspect ratio: `>1.15` landscape, `<0.87` portrait, else square. NOT stored on `NormalizedParams`.
- **D-10 Prompt grouping key** = `positivePrompt.trim().toLowerCase().replace(/\s+/g, ' ')` at bucket time; stored `positivePrompt` unchanged for filter text search.
- **D-11 IDB v2 → v3 migration** on `thumbRepository`; cursor-based streaming, per-record try/catch; re-derives `saveNodeIdentity` from already-stored `rec.metadata`.
- **D-12 Reka UI `Collapsible`** for the Advanced disclosure; controlled via `filterStore.isAdvancedOpen` + `setAdvancedOpen`; collapsed by default on first visit.
- **D-13 Primary filter param set**: `workflow`, `prompt`, `saveNode`, `model`, `timestamp`, `favourite`, `hidden`, `tags`. (`workflow` + `timestamp` are gate controls, `hidden` is toggle — remaining chip params: `positivePrompt`, `saveNode`, `model`, `favourite`, `tags`.)
- **D-14 Advanced filter param set**: `cfg`, `steps`, `seed`, `sampler`, `scheduler`, `resolution`, `loras`, `negativePrompt`. `ParamKey` gains `'saveNode'`.
- **D-15 Delete outright**: `MoshpitSortControls.vue` + test, `MoshpitAxisOverlay.vue` + test, `moshpit.sort.*` i18n keys, `sortX`/`sortY` store fields.
- **D-16 Retain**: `sortMath.ts` + test (reuse substrate), `MoshpitGridSpacingControl`, `MoshpitShowHiddenToggle`, excluded-count row.
- **D-17 Parallel `ClusterNode` / `ClusterSlot` types** in `clusterLayout.ts`; old `ColumnDescriptor`/`RowDescriptor` remain exported from `sortMath.ts`.
- **D-18 Five pill toggles** in Settings panel (declaration order); active = `bg-node-component-primary`, inactive = outlined with `border-(--interface-stroke)`.
- **D-19 Store additions**: `activeGroupings: readonly GroupingAxis[]` (ordered array), `withinClusterSort: WithinClusterSortMode`, `isAdvancedOpen: boolean`, plus mutators. Shape chosen per RESEARCH Open Question 1 (readonly array beats Set for serialisation + tests).
- **D-20 `04-HUMAN-UAT.md` dogfood checklist** — 8-step scenario, qualitative yes/sort-of/no sign-off.
- **D-21 No Playwright blocks acceptance**. `@moshpit` spec is best-effort; Vitest on pure modules is the real regression net.
- **D-22 Phase 4 is a gate**. Negative UAT sign-off = pause Phase 5.

### Claude's Discretion

- Row-first vs column-first wrapping at branch levels (D-01 says row; planner may flip).
- Cluster overlay label culling at deep zoom-out (profile first; defer unless flagged).
- Reka `Collapsible` vs plain `<details>` for the Advanced disclosure (Reka preferred; verified canonical usage at `src/renderer/extensions/linearMode/PartnerNodesList.vue:2-6, 62, 84`).
- `activeGroupings` storage shape: `Set` vs ordered array vs object-keyed booleans. **Recommendation: ordered readonly array** — round-trips cleanly through Pinia/test snapshots, preserves insertion order (useful for eventual debug logging), avoids `Set` reactivity quirks.
- Save-node extraction multi-output disambiguation: v1 accepts first-iteration-order; scoped gap-closure available via `SaveImage.inputs.filename_prefix` correlation if dogfood surfaces real pain.
- IDB v3 migration failure handling: per-record try/catch + aggregate `console.warn` skip count. `[VERIFIED: thumbRepository.ts:44-64]` — v1→v2 uses the same shape; new branch mirrors it.
- Pill-toggle keyboard affordance: `G+1..5` chord not in PRD §7.12; planner may add or skip.
- `MoshpitGridSpacingControl` renaming: keep single slider scaling both cluster and within-cluster spacing; update label key only.
- Animation shape for filter changes while groupings are active: 300ms ease-out-cubic tween reused (no second motion primitive).

### Deferred Ideas (OUT OF SCOPE)

- Manual grouping reorder UI (v2).
- Additional grouping axes (sampler, resolution bucket, seed-modulo-N) — PRD §9 candidates.
- Semantic / embedding-based prompt grouping (v2 per PRD §10).
- Workflow graph-hash or node-count grouping (v2 per PRD §9 open question).
- Per-cluster within-cluster sort override (CSORT-01 is global).
- Cluster-collapse / drill-in interaction (no PRD requirement).
- Multi-save-node disambiguation via `filename_prefix` (v2 gap closure).
- Keyboard chords for grouping toggles (not in PRD §7.12).
- Frame-budget Playwright proof for GROUP-10 / UX-10 (deferred to Phase 7).
- Cluster-overlay label culling at deep zoom-out (profile first).
- Tournament mode and full-res on tournament entry (Phase 5).
- Curation mutations (Phase 6).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GROUP-01 | User can enable any combination of grouping axes as non-exclusive toggles in the Settings panel | `activeGroupings` readonly-array ref on `moshpitFilterStore` + `MoshpitGroupingToggles.vue` pill row; store action `toggleGrouping(axis)` |
| GROUP-02 | Nesting order is automatic — largest-average-bucket-size nests outermost, recursive | `computeNestingOrder()` in `clusterLayout.ts`; pure function, ties by declaration order; memoised bucket-key per `(hash, axis)` |
| GROUP-03 | Group by workflow (filename) | `bucketKey('workflow', params)` → `params.workflowFilename ?? '(other)'` (field already exists from Phase 3) |
| GROUP-04 | Group by save node | `bucketKey('saveNode', params)` → `params.saveNodeIdentity ?? '(other)'`; field added by `normalizeParams` extension + IDB v2→v3 migration |
| GROUP-05 | Group by prompt (normalised) | `bucketKey('prompt', params)` → `normalisePromptKey(params.positivePrompt)` with trim + lowercase + whitespace-collapse |
| GROUP-06 | Group by model | `bucketKey('model', params)` → `params.model ?? '(other)'` (field already present) |
| GROUP-07 | Group by type (aspect bucket) | `deriveTypeBucket({ width, height })` pure helper: `>1.15` landscape, `<0.87` portrait, else square; missing w/h → `(other)` |
| GROUP-08 | Missing-param → "(other)" cluster at that level | `OTHER_BUCKET_KEY = '(other)'` constant; all `bucketKey` branches fall through to it on undefined/null/empty |
| GROUP-09 | Groupings separate from filters | `applyFilterChips` runs BEFORE `computeClusterLayout` in `useMoshpitFilteredAssets`; groups receive only the filtered visible-hash set |
| GROUP-10 | Recompute + tween <400ms at 5k assets | <100ms pure math budget enforced by Vitest perf marker on `computeClusterLayout`; 300ms existing tween in `useMoshpitSpriteLayer` (REPACK_DURATION_MS const at line 55) |
| CSORT-01 | Single global dropdown: newest/oldest/alphabetical | `withinClusterSort` ref on store + `MoshpitWithinClusterSort.vue` native `<select>`; `compareAssetsForWithinCluster` pure comparator in `groupAxes.ts` with contentHash tiebreaker for determinism |
| FILTER-12 | Primary filter surface lineage-first; parameter filters behind Advanced disclosure | `PRIMARY_FILTER_PARAMS` + `ADVANCED_FILTER_PARAMS` consts on `filterTypes.ts`; `MoshpitFilterChipRow` accepts `tier` prop; `MoshpitAdvancedFilters.vue` wraps advanced row in Reka `Collapsible` |

## Project Constraints (from CLAUDE.md / AGENTS.md)

Directives the planner and executor MUST honour. Every one verified against the referenced file.

### Language / tooling
- **TypeScript only** for new code; strict mode; `ES2023` target. `[CITED: tsconfig.json]`
- **Vue 3.5 SFC** with `<script setup lang="ts">`; destructured props with defaults (no `withDefaults`, no runtime props decl).
- **No new JavaScript files** except `scripts/**/*.js` and legacy `src/extensions/core/*` + `src/scripts/*`.
- **pnpm ≥10** (`package.json` `packageManager: pnpm@10.33.0`).

### Forbidden patterns (enforced via ESLint / oxlint)
- `any` — `typescript/no-explicit-any: error`.
- `as any` — fix the underlying type instead.
- `--no-verify` on commits.
- Deleting or disabling tests to make them pass.
- `dark:` Tailwind variant (`vue/no-restricted-class: ['error', '/^dark(-theme)?:/']`).
- `:class="[]"` for class merging — use `cn()` from `@/utils/tailwindUtil`.
- `!important` / `!` prefix in Tailwind.
- Arbitrary percentage utilities (`w-[80%]`) when a fraction utility exists (`w-4/5`).
- `console.log` (only `console.warn` / `console.error` permitted; tests/stories excepted).
- `v-html` without DOMPurify.
- Barrel `index.ts` re-exports inside `/src`.
- PrimeVue new usage (Reka UI preferred).
- In Vue SFCs, importing `t`/`d`/`te` from `@/i18n` — must use `const { t } = useI18n()`.
- AI / Claude mentions in commit messages.

### Required patterns
- `import type` separate from value imports (`import/consistent-type-specifier-style: prefer-top-level`).
- Semantic Tailwind tokens (`bg-node-component-primary`, `border-(--interface-stroke)`, `text-muted-foreground`) — no hex.
- Layer discipline: `base → platform → workbench → renderer`. Moshpit lives in `src/platform/moshpit/`. Cluster layout must not import from `src/lib/litegraph`.
- Pinia setup-API stores (`defineStore('name', () => { ... })`).
- Co-located Vitest (`*.test.ts`) next to source; `fast-check` for property tests.
- HTML-over-Pixi pattern for text overlays (established by `MoshpitAxisOverlay.vue`).
- IDB via `idb` library (already installed for Phase 2).
- ADR 0003 / 0008 — no method additions to `LGraphNode` / `LGraphCanvas` / `LGraph` / `Subgraph`; ECS-style access via `world.getComponent(entityId, ComponentType)` (not applicable to Moshpit's PixiJS layer but noted for completeness).
- PR ≤300 lines of non-test code; quality gates (`pnpm lint`, `pnpm typecheck`, `pnpm knip`, relevant tests) before merge.

## Existing Moshpit Architecture

**All paths verified this session via `ls` and targeted greps.**

### Platform directory structure (confirmed)

```
src/platform/moshpit/
├── components/    (35 files — includes MoshpitSortControls.vue and MoshpitAxisOverlay.vue to be deleted)
├── composables/   (useMoshpitFilteredAssets.ts, useMoshpitSpriteLayer.ts, useMoshpitViewportInjection.ts, etc.)
├── services/      (layoutMath.ts, sortMath.ts, filterMath.ts, filterTypes.ts, paramNormalize.ts, thumbRepository.ts, etc.)
└── stores/        (moshpitFilterStore.ts, moshpitMetadataStore.ts, moshpitSelectionStore.ts, moshpitViewportStore.ts, etc.)
```

### Key files (line counts verified)

| File | Lines | Role in Phase 4 |
|------|-------|-----------------|
| `src/platform/moshpit/services/sortMath.ts` | 310 | RETAINED — header-comment update only; row-band packing primitive reused by leaf-cluster flat grid |
| `src/platform/moshpit/services/paramNormalize.ts` | 350 | EXTEND — add `saveNodeIdentity` field + `extractSaveNodeIdentity` helper; existing `findAllNodesByClassTypes` at line 168 reused |
| `src/platform/moshpit/services/filterTypes.ts` | 63 | EXTEND — add `'saveNode'` to `ParamKey`; add `PRIMARY_FILTER_PARAMS` / `ADVANCED_FILTER_PARAMS` consts |
| `src/platform/moshpit/services/thumbRepository.ts` | 135 | EXTEND — add v2→v3 migration branch after existing v1→v2 block at lines 44-64 |
| `src/platform/moshpit/services/thumbRepository.types.ts` | — | EXTEND — bump `MOSHPIT_DB_VERSION` from 2 to 3 (current value verified at line 53) |
| `src/platform/moshpit/stores/moshpitFilterStore.ts` | 170 | REFACTOR — remove sortX/sortY; add activeGroupings/withinClusterSort/isAdvancedOpen + mutators |
| `src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` | 280 | UNCHANGED — consumes `{hash, worldX, worldY}` slots; `REPACK_DURATION_MS = 300` at line 55; ease-out-cubic at line 223 (`1 - Math.pow(1 - t, 3)`) |
| `src/platform/moshpit/composables/useMoshpitViewportInjection.ts` | 23 | REUSED — `MOSHPIT_VIEWPORT_INJECTION_KEY: InjectionKey<Ref<Viewport \| null>>` at line 12; `useMoshpitViewport(): Ref<Viewport \| null>` at line 15 |
| `src/platform/moshpit/components/MoshpitAxisOverlay.vue` | 117 | DELETE — replaced by `MoshpitClusterOverlay.vue` (same HTML-over-Pixi pattern) |
| `src/platform/moshpit/components/MoshpitSettingsPanel.vue` | 70 | RECOMPOSE — new layout order; remove `<MoshpitSortControls>` mount |

`[VERIFIED: Bash wc -l + grep outputs this session]`

### Sprite-position tween primitive (verified)

Phase 4 reuses the existing 300ms ease-out-cubic tween:

- **File:** `src/platform/moshpit/composables/useMoshpitSpriteLayer.ts`
- **Duration constant:** `export const REPACK_DURATION_MS = 300` (line 55)
- **Easing:** `const eased = 1 - Math.pow(1 - t, 3) // ease-out-cubic` (line 223)
- **Trigger:** Watch processing completion → fire re-pack tween once per completion (line 252)
- **Contract:** Consumer supplies `{hash, worldX, worldY}[]`; tween handles the motion.

`[VERIFIED: grep "transformTick|ease-out-cubic|300|tween" useMoshpitSpriteLayer.ts]`

**Implication:** `computeClusterLayout` MUST emit the same flat `GridSlot[]` shape as `computeSortedLayout1D` so `useMoshpitSpriteLayer` remains untouched. The `ClusterNode` tree is an additional output, consumed only by the new `MoshpitClusterOverlay.vue`.

### Viewport injection pattern (verified)

- **Injection key:** `MOSHPIT_VIEWPORT_INJECTION_KEY: InjectionKey<Ref<Viewport | null>>` exported at `useMoshpitViewportInjection.ts:12`.
- **Consumer helper:** `useMoshpitViewport(): Ref<Viewport | null>` at line 15; throws if the key is not provided.
- **Provider:** `MoshpitCanvas.vue` provides this key (pattern used by Phase 3's `MoshpitAxisOverlay.vue` at line 42: `const viewportRef = useMoshpitViewport()`).

**Phase 3 `MoshpitAxisOverlay.vue` canonical reactive-refresh pattern** (verified via grep):

```typescript
// Lines 49-64, 71, 84 of MoshpitAxisOverlay.vue
const transformTick = ref(0)
// inside watch(viewportRef, (vp, _prev, onCleanup) => { ... }):
vp.on('moved', () => { transformTick.value++ })
onCleanup(() => { vp.off('moved', handler) })
// Inside style getters:
void transformTick.value // read reactive dep so style re-evaluates on pan/zoom
```

Phase 4's `MoshpitClusterOverlay.vue` copies this shape exactly. `[VERIFIED: MoshpitAxisOverlay.vue lines 49-84]`

### Filter pipeline current shape

`useMoshpitFilteredAssets` flow (current, Phase 3):

1. Compute `visibleHashes` from `registry.entries.value`.
2. Build `hashToCuration` map.
3. Call `applyFilterChips(hashToParams, hashToCuration, filterStore.chips, filterStore.showHidden, filterStore.timeRange, Date.now())` → `filtered: string[]`.
4. Branch on `filterStore.sortX`/`sortY` → call `computeSortedLayout1D`/`2D` or fall through to `computeJitteredGrid` (Phase 2 initial layout) / `computePackedGrid` (Phase 2 re-pack).
5. Emit `entries: FilteredAssetEntry[]` with `{id, contentHash, thumbUrl, worldX, worldY}`.

Phase 4 replaces step 4 with: `computeNestingOrder(...)` → `computeClusterLayout(...)` → flatten slots. The empty-`activeGroupings` case inside `computeClusterLayout` emits a single leaf cluster laid out as a row-wrapping flat grid — this replaces the Phase 2 jittered/packed fallback for the gated case (jittered-grid still used for the pre-filter initial layout at load time, owned by Phase 2 code).

### Reka UI Collapsible precedent (verified)

- **File:** `src/renderer/extensions/linearMode/PartnerNodesList.vue`
- **Imports (lines 2-6):**
  ```typescript
  import {
    CollapsibleContent,
    CollapsibleRoot,
    CollapsibleTrigger
  } from 'reka-ui'
  ```
- **Usage:** `<CollapsibleRoot>` at line 62; closing at line 84.
- **Package:** `reka-ui: "catalog:"` in root `package.json` line 113.

`[VERIFIED: grep "CollapsibleRoot|from 'reka-ui'" PartnerNodesList.vue + package.json]`

Project convention therefore supports Reka over plain `<details>`. Plan 04 Task 3 uses the triad directly.

## Standard Stack

### Core (no new deps needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue | 3.5.13 (catalog) | SFC + Composition API + reactivity | Project standard, Phase 1–3 precedent |
| Pinia | 3.0.4 (catalog) | Store pattern (`defineStore` setup-API) | `moshpitFilterStore` already on this; Phase 4 extends |
| TypeScript | 5.9.3 (catalog) | Strict mode app code | Required by project rules |
| Tailwind CSS | 4.2.0 | Utility-first styling, semantic tokens | Project standard, `cn()` via `@comfyorg/tailwind-utils` |
| Reka UI | 2.5.0 (catalog) | Headless primitives — `Collapsible` for Advanced disclosure | Project precedent at `PartnerNodesList.vue:2-6`; PrimeVue banned for new usage |
| `idb` | 7.1.1 (already in lockfile) | IndexedDB wrapper — `openDB` upgrade callback | Phase 2 precedent; v2→v3 upgrade mirrors v1→v2 |

### Supporting (test infra)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.0.16 | Unit/component tests (happy-dom) | All new math modules + components |
| `fast-check` | 4.5.3 (verified current = 4.7.0, repo is 4.5.3 — [CITED: npm view fast-check version]) | Property tests — uniqueness invariant + determinism | `clusterLayout.test.ts` (every hash in exactly one leaf); `groupAxes.test.ts` (comparator determinism) |
| `@testing-library/vue` | 8.1.0 | Behavioral component tests (grouping toggles, within-sort dropdown) | Plan 04 SFC tests |
| `@testing-library/user-event` | 14.6.1 | Keyboard + click interactions | Pill toggle assertions |
| `@pinia/testing` | 1.0.3 | `createTestingPinia` for component tests | Component-level store stubbing |
| `fake-indexeddb` | (already in lockfile) | In-memory IDB for thumbRepository tests | Migration tests |
| Playwright | 1.58.1 | `@moshpit`-tagged E2E spec | Best-effort, non-blocking per D-21 |
| Storybook | 10.2.10 | Component stories | Plan 04 + 05 new components each ship stories |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reka `Collapsible` | Native `<details><summary>` | Lighter but inconsistent with project chrome; reka is canonical here per existing precedent. Choose Reka unless profiling flags bundle weight. |
| Ordered `readonly GroupingAxis[]` on the store | `Set<GroupingAxis>` | Set reactivity in Vue/Pinia works but serialisation into test snapshots is less clean; array preserves insertion order and enumerates deterministically. |
| Row-wrapping at branch levels | Column-first wrapping | Row wrapping is the default (D-01); column-first may suit ultrawide screens better but is not needed v1. |
| Custom animation primitive for grouping toggle | Reuse 300ms ease-out-cubic tween in `useMoshpitSpriteLayer` | Reuse preserves single motion language; all transitions feel the same to users. |

### Version verification

- `reka-ui`: 2.5.0 (catalog) — aligns with `2.9.6` current on npm `[CITED: npm view reka-ui version]`, but project pins via `catalog:`. Confirmed Collapsible triad is exported from the current catalog version by grepping the in-repo consumer.
- `idb`: 8.0.3 current on npm `[CITED: npm view idb version]`; project uses catalog version. API for `openDB(name, version, { upgrade(db, oldVersion, newVersion, tx) })` has been stable across 7.x → 8.x.
- `fast-check`: 4.7.0 current `[CITED: npm view fast-check version]`; project uses 4.5.3. Property test API (`fc.assert(fc.property(...))`) unchanged across 4.x.

**Installation:** No new packages required. All deps already in `pnpm-lock.yaml` from Phases 1–3.

## Architecture Patterns

### Pattern 1: Pure Math Modules + Colocated Vitest

**What:** A `services/` module exports pure TypeScript functions + types; a sibling `services/<module>.test.ts` covers behaviour with Vitest + fast-check.

**When to use:** Any layout, filtering, or extraction computation that must be worker-safe (no Vue / Pinia / DOM imports).

**Example (from verified `sortMath.ts` + `layoutMath.ts` + `filterMath.ts` structure):**

```typescript
// groupAxes.ts — worker-safe; only types from paramNormalize
import type { NormalizedParams } from './paramNormalize'

export const GROUPING_AXES = ['workflow', 'saveNode', 'prompt', 'model', 'type'] as const
export type GroupingAxis = (typeof GROUPING_AXES)[number]

export const OTHER_BUCKET_KEY = '(other)'

export function bucketKey(
  axis: GroupingAxis,
  params: NormalizedParams,
  _filenameOfAsset: string | null
): string {
  switch (axis) {
    case 'workflow':
      return params.workflowFilename ?? OTHER_BUCKET_KEY
    case 'saveNode':
      return params.saveNodeIdentity ?? OTHER_BUCKET_KEY
    case 'prompt':
      return normalisePromptKey(params.positivePrompt)
    case 'model':
      return params.model ?? OTHER_BUCKET_KEY
    case 'type':
      return deriveTypeBucket(params)
  }
}
```

`[VERIFIED: sibling sortMath.ts is 310 lines; matches this shape]`

### Pattern 2: Pinia Setup-Store Extension

**What:** Add new `ref()`s + mutator functions to an existing Pinia setup-store, preserving the public API shape.

**When to use:** Feature state that's cross-component and needs reactivity + undoable mutations.

**Example (delta on `moshpitFilterStore.ts`):**

```typescript
// NEW in Phase 4:
import type { GroupingAxis, WithinClusterSortMode } from '../services/groupAxes'

const activeGroupings = ref<readonly GroupingAxis[]>([])
const withinClusterSort = ref<WithinClusterSortMode>('newestFirst')
const isAdvancedOpen = ref(false)

function toggleGrouping(axis: GroupingAxis): void {
  activeGroupings.value = activeGroupings.value.includes(axis)
    ? activeGroupings.value.filter((a) => a !== axis)
    : [...activeGroupings.value, axis]
}

function setWithinClusterSort(mode: WithinClusterSortMode): void {
  withinClusterSort.value = mode
}

function setAdvancedOpen(open: boolean): void {
  isAdvancedOpen.value = open
}

// REMOVED in Phase 4: sortX, sortY, setSortX, setSortY
```

### Pattern 3: HTML-Over-Pixi Overlays

**What:** Vue component with `absolute inset-0 pointer-events-none` positioning; iterates a reactive data structure; for each item computes `left`/`top`/`width`/`height` via `viewport.toScreen(worldX, worldY)`; subscribes to `viewport.on('moved')` to bump a `transformTick` ref that `style` getters read as a reactive dep.

**When to use:** Any text / semantic overlay over the PixiJS canvas (labels, selection handles, selection count, cluster boundaries).

**Example (mirrors verified `MoshpitAxisOverlay.vue:37-84`):**

```vue
<script setup lang="ts">
import { computed, ref, watch, type StyleValue } from 'vue'
import { useMoshpitViewport } from '@/platform/moshpit/composables/useMoshpitViewportInjection'

const viewportRef = useMoshpitViewport()
const transformTick = ref(0)

watch(viewportRef, (viewport, _prev, onCleanup) => {
  if (!viewport) return
  const handler = () => { transformTick.value++ }
  viewport.on('moved', handler)
  onCleanup(() => { viewport.off?.('moved', handler) })
}, { immediate: true })

function boxStyle(cluster: ClusterNode): StyleValue {
  void transformTick.value // register reactive dep
  const vp = viewportRef.value
  if (!vp) return { display: 'none' }
  const tl = vp.toScreen(cluster.boundsWorld.x, cluster.boundsWorld.y)
  const br = vp.toScreen(
    cluster.boundsWorld.x + cluster.boundsWorld.w,
    cluster.boundsWorld.y + cluster.boundsWorld.h
  )
  return {
    left: `${tl.x}px`,
    top: `${tl.y}px`,
    width: `${br.x - tl.x}px`,
    height: `${br.y - tl.y}px`
  }
}
</script>
```

### Pattern 4: Reka `Collapsible` Controlled Disclosure

**What:** Reka `CollapsibleRoot` / `CollapsibleTrigger` / `CollapsibleContent` triad with `:open` + `@update:open` wired to store state.

**When to use:** Disclosure UI whose open-state must persist across chip additions or be programmatically controllable.

**Example (canonical usage verified in `PartnerNodesList.vue:62-84`):**

```vue
<template>
  <CollapsibleRoot
    :open="filterStore.isAdvancedOpen"
    @update:open="filterStore.setAdvancedOpen"
  >
    <CollapsibleTrigger as-child>
      <button type="button">Advanced filters</button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <MoshpitFilterChipRow tier="advanced" />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
```

### Pattern 5: IDB Cursor Migration with Per-Record Try/Catch

**What:** Inside the `openDB` upgrade callback, open a cursor over an object store, read each record, try to upgrade it, catch per-record errors without aborting the transaction, log aggregate skip count via `console.warn` when non-zero.

**When to use:** Schema bumps that require recomputation from already-stored fields.

**Example (verified v1→v2 shape at `thumbRepository.ts:44-64`, Phase 4 adds v2→v3 after):**

```typescript
if (oldVersion < 3) {
  const store = tx.objectStore('assetMeta')
  let cursor = await store.openCursor()
  let skipped = 0
  while (cursor) {
    const rec = cursor.value
    try {
      const fresh = normalizeParams(rec.metadata, rec.params?.timestamp ?? Date.now())
      const nextParams = rec.params
        ? { ...rec.params, saveNodeIdentity: fresh.saveNodeIdentity }
        : fresh
      await cursor.update({ ...rec, params: nextParams })
    } catch (err) {
      skipped += 1
      console.error('[moshpit] v2→v3 migration failed for record', rec.contentHash, err)
    }
    cursor = await cursor.continue()
  }
  if (skipped > 0) {
    console.warn(`[moshpit] v2→v3 migration skipped ${skipped} records`)
  }
}
```

### Anti-Patterns to Avoid

- **Wrapping `Viewport` in a reactive `ref`.** `pixi-viewport`'s `Viewport` class has internal mutable state that Vue's deep-reactive proxy trips on; Phase 1 decision was `shallowRef` / raw injection. Phase 3 solved refresh via `transformTick` scalar + `void transformTick.value` inside style getters. Copy exactly.
- **Deep-cloning the cluster tree on every filter tick.** The tree is pure data — `readonly` arrays + plain objects. Vue's reactivity caches the computed; no deep clone needed. Pitfall 2 in the checklist below.
- **Storing `type` as a `NormalizedParams` field.** D-09 mandates derive-at-read via `deriveTypeBucket(params)`. Adding a stored field would force a THIRD IDB migration (v3 → v4) just for a deterministic computation.
- **Per-axis separate store action for grouping toggles.** One `toggleGrouping(axis: GroupingAxis)` action beats five specialised actions — smaller surface, matches D-19 directly.
- **Hand-rolled fuzzy match for save-node names.** v1 accepts exact `_meta.title` or `class_type`; semantic matching is deferred (v2).
- **Making `MoshpitFilterChipRow` aware of Reka `Collapsible`.** Keep the chip row tier-agnostic via a `tier?` prop; the Advanced wrapper is a separate component.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB versioning + upgrade callbacks | Raw `indexedDB.open` + event listeners | `idb` library's `openDB({ upgrade(db, oldVersion, newVersion, tx) })` | Handles blocked/terminated events, promisifies cursors, Phase 2 already uses it. |
| Ease-out-cubic tween from scratch | `requestAnimationFrame` loop + math | Reuse `useMoshpitSpriteLayer`'s existing `REPACK_DURATION_MS = 300` + `1 - Math.pow(1 - t, 3)` | Verified existing primitive at lines 55, 223. One motion language. |
| Property-based uniqueness invariant | Hand-written loop over inputs | `fast-check`'s `fc.property` + `fc.assert` | Shrinking on failure surfaces minimal repro; ecosystem-standard for this class of invariant. |
| Disclosure (accordion) UI chrome | Plain `<details>` + custom chevron | Reka UI `Collapsible*` triad | Keyboard + ARIA handled, controlled/uncontrolled modes, precedent at `PartnerNodesList.vue`. |
| Fuzzy search on param picker | Substring scan | `fuse.js` (already installed for Phase 3 popover) | No regression; same ~16-item list. |
| PNG metadata parse on migration | Re-run thumbnail worker | Re-parse stored `rec.metadata` via `normalizeParams(rec.metadata, ...)` | Raw metadata already in IDB (verified at `thumbRepository.types.ts:22-32`). Free upgrade. |
| Exhaustive switch safety | Commenting "all cases handled" | `const _exhaustive: never = param` in `default:` | Compile-time proof; future widening surfaces as type error (Pitfall 1). |

**Key insight:** Every major subsystem already has a precedent in the repo. Phase 4 composes existing patterns; the only genuinely new code is the recursive packer + bucket-key extractor — both pure math with bounded inputs and unit-testable behaviour.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | (1) IndexedDB `moshpit-v1` DB, `assetMeta` store, field `params: NormalizedParams` (v2 schema) — needs `saveNodeIdentity` added. (2) Raw PNG metadata in `assetMeta.metadata` — source for re-derivation. (3) `thumbs` store — unchanged. | Bump `MOSHPIT_DB_VERSION` 2→3; cursor-migration re-derives `saveNodeIdentity` (per D-11 / Plan 02 Task 2). Data migration — user's existing cache re-populates on next app open without re-thumbnailing. |
| Live service config | None — Moshpit is frontend-only; no n8n/Datadog/Tailscale/Cloudflare Tunnel integration. ComfyUI backend runs locally; no remote service state. | None. |
| OS-registered state | None — no Windows Task Scheduler tasks, no pm2 processes, no launchd plists, no systemd units touch Phase 4 code paths. | None. |
| Secrets/env vars | None referenced by Phase 4 code. Phase 4 does not introduce any new `VITE_*` / `__…__` compile-time define. Existing Firebase / Sentry / Algolia vars unrelated. | None. |
| Build artifacts | (1) `components.d.ts` at repo root is auto-regenerated by `unplugin-vue-components` on dev/build — new Moshpit SFCs auto-register. (2) Storybook build artifacts (`.storybook-cache/`) — cleared on first story rebuild. (3) Vite's `.vite/deps` optimiser cache — invalidated when new imports (`reka-ui` Collapsible subpath if treeshaking changes) surface. | None beyond normal `pnpm install` / `pnpm dev` restart. No manual intervention. |

**Canonical question answer:** After every file in the repo is updated, the only runtime state that persists is user-cached IndexedDB data, which the v2→v3 migration handles automatically on app open. No other cached, stored, or OS-registered state is affected.

## Common Pitfalls

### Pitfall 1: `ParamKey` widening silently breaks exhaustive switches

**What goes wrong:** Adding `'saveNode'` to `ParamKey` union; `getCategoricalParamValue` / `getNumericParamValue` / chip editors have `switch (param: ParamKey)` blocks with `default: return undefined` that silently consume the widening. Categorical saveNode filter chips then never match anything.

**Why it happens:** TypeScript doesn't enforce switch exhaustiveness by default; a default case catches all future additions without warning.

**How to avoid:** Replace every generic `default: return undefined` in switches over `ParamKey` with:

```typescript
default: {
  const _exhaustive: never = param
  return undefined
}
```

This turns "silently broken at runtime" into "compile error until you add a case." Plan 03 Task 1 specifies this pattern for `filterMath.ts`.

**Warning signs:** A chip labelled "Save node: Final Output" that filters out every asset, or the chip editor renders but applying the chip produces an empty canvas.

### Pitfall 2: Cluster tree reference equality breaks reactivity

**What goes wrong:** `computeClusterLayout` returns a new `ClusterNode` tree every call; `MoshpitClusterOverlay.vue` re-renders every depth-0 + depth-1 box on every tick; performance degrades at 5k assets.

**Why it happens:** Vue's default `computed()` caches by call, not by tree equality. If the input reactive deps change every tick (e.g., `transformTick` bump), the cluster computed runs too.

**How to avoid:** `clusterTree` computed MUST depend only on the filtered-assets pipeline (`visibleHashes`, `hashToParams`, `activeGroupings`, `withinClusterSort`, `gridSpacing`) — NOT on `transformTick`. The overlay's `boxStyle` reads both `clusterTree.value` and `void transformTick.value`; the tree only changes when real inputs change, but positions re-eval on pan/zoom.

**Warning signs:** Profiler shows `computeClusterLayout` hot during pan/zoom with stable filters. Verified by `computeClusterLayout` call count in a dev-build perf marker.

### Pitfall 3: Save-node extraction for custom node repos

**What goes wrong:** A custom ComfyUI save-node class (e.g. `SaveImageBatched` from some ecosystem repo) isn't in `SAVE_NODE_CLASS_TYPES`. Assets emitted by it get `saveNodeIdentity: null` and all cluster into `(other)` on the saveNode axis. User complains "my save-node grouping is broken."

**Why it happens:** The output-class set is closed; the 40+ custom-node repo ecosystem cannot be enumerated statically.

**How to avoid:** Document `SAVE_NODE_CLASS_TYPES` as extensible in its JSDoc; add new class-type entries as issues surface. Consider a future enhancement: inspect node output `outputs` shape for type `IMAGE` as a heuristic for "probably a save node." Not v1.

**Warning signs:** HUMAN-UAT tester reports a workflow whose "Save node" grouping collapses everything into `(other)`.

### Pitfall 4: IDB upgrade callback throws, blocks user from ever opening Moshpit

**What goes wrong:** v2→v3 migration hits a malformed `rec.metadata`; `normalizeParams` throws; the whole versionchange transaction aborts; Chrome flags the DB as corrupt; user sees a blank canvas forever.

**Why it happens:** Upgrade callbacks run inside a single transaction. An unhandled throw rolls back everything.

**How to avoid:** Per-record `try/catch` inside the cursor loop (verified pattern at `thumbRepository.ts:44-64` from v1→v2). Log per-record failure to `console.error`, increment a `skipped` counter, continue. After the loop, if `skipped > 0`, log aggregate via `console.warn`. The `blocked()` / `terminated()` DB-level handlers (Phase 3) are unchanged.

**Warning signs:** Tests seeded with malformed metadata fail at `openDB` call rather than at the individual record.

### Pitfall 5: Reka `Collapsible` open-state drift

**What goes wrong:** Uncontrolled `<CollapsibleRoot>` manages its own internal open state; user opens the Advanced section; filter chip addition causes a parent re-render; the collapsible snaps closed; chip they just added is invisible until they expand again.

**Why it happens:** Reka defaults to uncontrolled mode. Parent re-renders reset internal state.

**How to avoid:** Bind BOTH `:open="filterStore.isAdvancedOpen"` AND `@update:open="filterStore.setAdvancedOpen"`. Controlled mode — store is the single source of truth; no drift.

**Warning signs:** Adding a chip from the popover makes the Advanced disclosure collapse unexpectedly, even though the store reports `isAdvancedOpen: true`.

### Pitfall 6: Auto-nesting bucket-count computation is O(N × axes × depth)

**What goes wrong:** Recomputing `bucketKey(hash, axis)` inside the nested recursion in `computeClusterLayout` turns a 5000-hash × 5-axis × 5-depth traversal into 125k calls; budget at 100ms slips.

**Why it happens:** Naive implementation re-derives bucket keys at every recursion level.

**How to avoid:** Memoise `bucketKey` per `(hash, axis)` via a local `Map<string, string>` keyed by `${axis}|${hash}` constructed once at the top of `computeClusterLayout`, passed down the recursion. Cost drops to O(N × axes) = 25k calls. Plan 01 Task 2 specifies this, and the perf test asserts `duration < 100`ms at 5k × 3 axes.

**Warning signs:** Perf marker test fails locally with a timing above 100ms; console logs show repeated `bucketKey` calls for identical inputs.

### Pitfall 7: Within-cluster sort non-determinism

**What goes wrong:** Two assets with identical `timestamp` (rare but possible on batch-generated outputs), identical filename, or equal bucket-key positions, sort non-deterministically across browser engines. Cluster layout jitters on every recompute.

**Why it happens:** `Array.prototype.sort` is stable per spec but comparator ties lead to platform-dependent ordering when other sort dependencies are introduced.

**How to avoid:** `compareAssetsForWithinCluster` MUST break ties on `contentHash` (ASCII string compare). Every comparator in the Phase 4 pipeline eventually breaks to contentHash. Plan 01 Task 1 behaviour block specifies this.

**Warning signs:** Fast-check property test for "determinism across permutations" fails; clusters jitter across page reloads with the same data.

## Code Examples

Verified or direct-from-plan patterns the executor will write.

### Grouping axis extraction

```typescript
// src/platform/moshpit/services/groupAxes.ts — peer of sortMath.ts / filterMath.ts
import type { NormalizedParams } from './paramNormalize'

export const GROUPING_AXES = ['workflow', 'saveNode', 'prompt', 'model', 'type'] as const
export type GroupingAxis = (typeof GROUPING_AXES)[number]

export type WithinClusterSortMode = 'newestFirst' | 'oldestFirst' | 'alphabetical'
export const WITHIN_CLUSTER_SORT_MODES: readonly WithinClusterSortMode[] = [
  'newestFirst',
  'oldestFirst',
  'alphabetical'
]

export const OTHER_BUCKET_KEY = '(other)'

export function normalisePromptKey(prompt: string | undefined): string {
  if (prompt === undefined) return OTHER_BUCKET_KEY
  const normalised = prompt.trim().toLowerCase().replace(/\s+/g, ' ')
  return normalised.length > 0 ? normalised : OTHER_BUCKET_KEY
}

export function deriveTypeBucket(
  params: Pick<NormalizedParams, 'width' | 'height'>
): 'landscape' | 'portrait' | 'square' | typeof OTHER_BUCKET_KEY {
  const { width, height } = params
  if (!Number.isFinite(width) || !Number.isFinite(height) || !width || !height) {
    return OTHER_BUCKET_KEY
  }
  const ratio = width / height
  if (ratio > 1.15) return 'landscape'
  if (ratio < 0.87) return 'portrait'
  return 'square'
}
```

Source: Plan 01 Task 1, consistent with CONTEXT.md D-09/D-10.

### Cluster layout skeleton

```typescript
// src/platform/moshpit/services/clusterLayout.ts
import type { NormalizedParams } from './paramNormalize'
import type { GridSlot } from './layoutMath'
import { bucketKey, compareAssetsForWithinCluster, type GroupingAxis, type WithinClusterSortMode } from './groupAxes'

export interface ClusterNode {
  readonly axis: GroupingAxis | null
  readonly bucketValue: string
  readonly depth: number
  readonly boundsWorld: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  readonly children: readonly ClusterNode[]
  readonly leafHashes: readonly string[]
}

export interface ClusterLayoutResult {
  readonly root: ClusterNode
  readonly slots: readonly GridSlot[]
}

export function computeNestingOrder(
  visibleHashes: readonly string[],
  paramsByHash: ReadonlyMap<string, NormalizedParams>,
  filenameByHash: ReadonlyMap<string, string | null>,
  activeAxes: readonly GroupingAxis[]
): readonly GroupingAxis[] {
  // D-02 — sort by avg bucket size desc; ties by GROUPING_AXES declaration order.
  // Memoise bucketKey per (hash, axis).
  // Return activeAxes reordered.
}

export function computeClusterLayout(
  visibleHashes: readonly string[],
  paramsByHash: ReadonlyMap<string, NormalizedParams>,
  filenameByHash: ReadonlyMap<string, string | null>,
  activeGroupingsInOrder: readonly GroupingAxis[],
  withinClusterSort: WithinClusterSortMode,
  gridSpacing: number
): ClusterLayoutResult {
  // Empty groupings → single leaf at root, row-wrapping flat grid.
  // Recursive row-column packing with depth-proportional gaps.
  // Slot emission post-order; every leaf hash appears exactly once.
}
```

Source: Plan 01 Task 2. Property tests (uniqueness + determinism + perf budget) specified.

### `useMoshpitFilteredAssets` reactive pivot

```typescript
// src/platform/moshpit/composables/useMoshpitFilteredAssets.ts — after Plan 03
import { computed } from 'vue'
import { computeClusterLayout, computeNestingOrder, type ClusterNode } from '../services/clusterLayout'
import type { GroupingAxis } from '../services/groupAxes'

export function useMoshpitFilteredAssets(): {
  readonly entries: ComputedRef<readonly FilteredAssetEntry[]>
  readonly clusterTree: ComputedRef<ClusterNode | null>
  readonly activeGroupingOrder: ComputedRef<readonly GroupingAxis[]>
} {
  const layout = computed<LayoutResult>(() => {
    if (!filterStore.isGated) return EMPTY_LAYOUT
    // 1. Apply filter chips → visible filtered hashes
    // 2. computeNestingOrder(filtered, params, filename, filterStore.activeGroupings)
    // 3. computeClusterLayout(...) → { root, slots }
    // 4. Build slotByHash map; return { visible, slotByHash, clusterTree: root }
  })
  // entries: flat list for sprite layer (shape unchanged from Phase 3)
  // clusterTree: for MoshpitClusterOverlay
}
```

Source: Plan 03 Task 3. Sprite-layer slot shape intentionally unchanged so `useMoshpitSpriteLayer` tween path stays untouched.

### `MoshpitClusterOverlay` HTML-over-Pixi

Full code in Plan 05 Task 1; pattern verified identical to `MoshpitAxisOverlay.vue:37-84`:

- `useMoshpitViewport()` for `Ref<Viewport | null>`.
- `transformTick = ref(0)` bumped on `viewport.on('moved')`.
- `void transformTick.value` inside `boxStyle(cluster)` for reactive dep.
- Renders depth-0 + depth-1 clusters only (D-06).
- Border: `border border-(--interface-stroke) rounded-md`.
- Label: `text-xs text-muted-foreground truncate max-w-56`.
- `(other)` bucket labelled via `t('moshpit.grouping.otherLabel')`.

### Reka `Collapsible` controlled-mode wrapper

```vue
<!-- src/platform/moshpit/components/MoshpitAdvancedFilters.vue -->
<template>
  <CollapsibleRoot
    :open="filterStore.isAdvancedOpen"
    @update:open="filterStore.setAdvancedOpen"
  >
    <CollapsibleTrigger as-child>
      <button type="button" :class="cn('…')">
        <i :class="cn('size-3', open ? 'icon-[lucide--chevron-up]' : 'icon-[lucide--chevron-down]')" />
        <span>{{ t('moshpit.filters.advancedLabel') }}</span>
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <MoshpitFilterChipRow tier="advanced" />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>

<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { cn } from '@/utils/tailwindUtil'
// … filterStore, i18n
</script>
```

Source: Plan 04 Task 3, `[VERIFIED: reka-ui precedent at PartnerNodesList.vue:2-6]`.

## State of the Art

| Old Approach (pre-v3 pivot) | Current Approach (v3) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 1D / 2D parameter spatial sort (`MoshpitSortControls` + `MoshpitAxisOverlay`) | Multi-axis lineage grouping with auto-nested hierarchy | 2026-04-21 (v3 pivot invalidated by Phase 3 dogfood) | `sortMath` primitives kept; UI + store fields + i18n removed |
| Flat filter chip row including CFG/steps/sampler/scheduler/resolution/LoRA/negativePrompt | Primary chip row (lineage) + Advanced disclosure (parameter) via Reka `Collapsible` | Phase 4 (FILTER-12) | Two `MoshpitFilterChipRow` instances with `tier` prop; `PRIMARY_FILTER_PARAMS` / `ADVANCED_FILTER_PARAMS` consts |
| No per-asset save-node identity | `saveNodeIdentity: string \| null` on `NormalizedParams` | Phase 4 (GROUP-04) | IDB v2 → v3 migration; `_meta.title ?? class_type` extractor |
| `filterStore.sortX` / `sortY` + `setSortX` / `setSortY` | `activeGroupings` / `withinClusterSort` / `isAdvancedOpen` + mutators | Phase 4 (D-15 / D-19) | Every consumer refactored; doomed components deleted |
| Auto-nesting UI | No user-visible ordering UI (PRD §5.4 literal) | Phase 4 (D-02) | Auto-derived server-side (pure function); no manual reorder affordance |
| Tournament mode framed as "Comparison Mode" (old Phase 5) | Pairwise winner selection + ephemeral scoring (Phase 5) | v3 pivot | Phase 4 ships selection-unchanged; Phase 5 consumes selection |

**Deprecated/outdated:**

- 1D / 2D parameter sort UI (`MoshpitSortControls.vue`, `MoshpitAxisOverlay.vue`) — shipped in Phase 3, deprecated in Phase 4, deleted in Plan 06 Task 3.
- `moshpit.sort.*` i18n namespace — removed in Plan 06 Task 3.
- `filterStore.sortX` / `sortY` fields — removed in Plan 03 Task 2.
- Old Comparison Mode framing (COMPARE-01..08) — superseded by TOUR-01..08 + PEEK-01..03 (v3 pivot).
- "Generate More Like This" (GENMORE-01..06) — cut from v1, reinstated as v2-GEN-01/02.

## Assumptions Log

> All claims in this research were either verified against files inspected this session or cited from existing plan documents. The table below captures the handful of items where uncertainty remains.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `useMoshpitAssetRegistry` exposes a per-entry `filename` / `sourceFilename` field usable for alphabetical within-cluster sort | Reactive pivot (Plan 03 Task 3) | Alphabetical sort falls back to contentHash tiebreaker — deterministic but not what the user expects; dogfood may flag. Executor must `grep` the registry to confirm; if absent, thread from `useMoshpitMetadataStore` or accept null-uniform behaviour. |
| A2 | Reka UI `CollapsibleRoot` at the currently-pinned catalog version supports controlled `:open` + `@update:open` mode | Pattern 4 / Plan 04 Task 3 | If uncontrolled-only, switch to native `<details>` + custom styling. Precedent at `PartnerNodesList.vue:62-84` uses Reka in controlled form but executor should verify the concrete props. |
| A3 | `viewport.off?.('moved', handler)` exists on concrete pixi-viewport Viewport (i.e., Viewport extends EventEmitter exposing `.off`) | Pattern 3 / Plan 05 Task 1 | Handler leaks across Moshpit ↔ workflow canvas swaps. `pixi-viewport`'s `Viewport` does extend `EventEmitter` via PixiJS's event system — standard behaviour, but untested in this session. |
| A4 | `ParamKey` union widening to `'saveNode'` affects only the switches in `filterMath.ts` (caught by exhaustiveness) — not `sortMath.ts`, because `saveNode` is never routed as a sort axis | Pitfall 1 / Plan 03 Task 1 | If `sortMath` has a silent `default` that's hit during cluster-layout integration, typecheck fails at integration. Plan 03 Task 1 calls this out explicitly; executor re-audits all switches. |
| A5 | Phase 4's <100ms `computeClusterLayout` budget at 5k × 3 axes is achievable with bucket-key memoisation alone (no Web Worker needed) | D-05 / Pitfall 6 | Miss the 400ms total; degraded UX. Plan 01 Task 2's perf marker test is the trip-wire. If the test fails, escalate to worker offload (breaks the plan shape; flag during execution). |

**Provenance note:** Every file-path reference and line number in this document was grep-verified this session. The plans themselves (01-PLAN through 06-PLAN) encode research findings that the prior RESEARCH.md iteration captured — this reconstruction cross-references plan claims against the current code state.

## Open Questions (RESOLVED)

1. **How should `activeGroupings` be stored — `Set<GroupingAxis>`, ordered `readonly GroupingAxis[]`, or object-keyed booleans?**
   - What we know: Pinia reactivity supports all three; Vue's proxy on `Set` works but is less ergonomic in tests (no built-in snapshot equality).
   - What's unclear: Preference signal from existing project code.
   - RESOLVED: Use `readonly GroupingAxis[]` ordered by insertion (D-19). Rationale: serialises cleanly into test snapshots, preserves toggle order (useful for debug logging and potential future "show nesting order" affordance), and `toggleGrouping` is a single filter-or-append expression. The auto-nest derivation (`computeNestingOrder`) reorders axes internally — the stored order is never user-visible ordering.

2. **Cluster layout: row-first vs column-first wrapping at branch levels?**
   - What we know: D-01 specifies row-wrapping; ultrawide monitors might benefit from column-first.
   - What's unclear: Dogfood preference.
   - RESOLVED: Row-wrapping at all branch levels (D-01 literal). Rationale: row-first matches canvas-scanning eye-tracking research, matches existing `computeSortedLayout1D` behaviour (consistency), and deterministic packing is cleaner with row-first math. If ultrawide screens surface pain during HUMAN-UAT, switch is a one-line change inside `computeClusterLayout` and does not affect any other module.

3. **IDB v3 migration failure handling: how to report per-record errors?**
   - What we know: v1→v2 pattern uses per-record `try/catch` + `console.error` (verified at `thumbRepository.ts:44-64`).
   - What's unclear: Whether to add an aggregate skip count.
   - RESOLVED: Per-record `try/catch` + `console.error` (mirrors v1→v2) PLUS a `skipped` counter logged via `console.warn(`[moshpit] v2→v3 migration skipped ${n} records`)` when `n > 0` at the end of the cursor loop. Gives operators one-line diagnosability without drowning the console. Plan 02 Task 2 specifies this.

4. **Cluster overlay rendering cost at deep zoom-out — will ~150 HTML elements thrash?**
   - What we know: D-06 limits rendering to depth-0 + depth-1 clusters; upper bound at 5k × 5 axes is roughly 25 depth-0 + 125 depth-1 = 150 elements.
   - What's unclear: Whether browsers handle 150 absolutely-positioned spans during pan/zoom at 60fps.
   - RESOLVED: Render all depth-0 + depth-1 clusters unconditionally for v1. 150 elements is well within browser budget (modern engines handle thousands of absolutely-positioned elements). If profiling during Phase 7 hardening flags this, add a `zoom-out culling threshold` — a computed that filters `renderedClusters` to those whose screen-space bounds are ≥ some minimum pixel size. This is a cheap additive change and does not block Phase 4.

5. **Cluster bounding boxes + labels — Pixi `Graphics` / `BitmapText` vs HTML overlay?**
   - What we know: Phase 3 chose HTML overlay for `MoshpitAxisOverlay.vue` (crisp text, no text-atlas work, cheap at zoom).
   - What's unclear: Whether cluster count changes the calculus.
   - RESOLVED: HTML overlay via `MoshpitClusterOverlay.vue`, mirroring Phase 3's pattern exactly (D-06). Rationale: consistency with the shipped Phase 3 chrome; zero new Pixi primitives to introduce; text crispness is preserved at all zooms; the ~150 cluster upper bound is trivially small for HTML (see question 4).

6. **Save-node extraction: which output-class types must be in the set?**
   - What we know: D-08 lists `SaveImage`, `PreviewImage`, `SaveImageWebsocket`, `SaveAnimatedWEBP`, `SaveImageExtended`. Custom-node ecosystem adds long-tail variants.
   - What's unclear: Whether any other first-party ComfyUI class type is commonly used.
   - RESOLVED: Ship the 5-class set as the literal `SAVE_NODE_CLASS_TYPES` constant with JSDoc flagging it as extensible. Assets emitted by custom save-nodes fall into `(other)` at the saveNode grouping axis — documented as a known v1 limitation (Pitfall 3). Gap closure available post-dogfood: extend the set, or add a heuristic based on node `outputs` type inspection.

7. **Within-cluster sort alphabetical: sort on raw PNG filename or derived workflow filename?**
   - What we know: D-07 specifies the raw PNG filename from `AssetItem`.
   - What's unclear: Whether the registry entry exposes that field (A1 in Assumptions Log).
   - RESOLVED: Sort on raw PNG filename per D-07. If `useMoshpitAssetRegistry` does not expose `filename` at entry level, thread it from `useMoshpitMetadataStore` or accept the null-uniform fallback (every asset's filename is null → alphabetical reduces to contentHash ordering). Plan 03 Task 3 flags this and falls back gracefully. If a dogfood complaint surfaces, a one-line registry extension covers it.

## Environment Availability

Phase 4 is pure frontend code + IndexedDB. No new external dependencies. All relevant tooling already verified by Phases 1–3.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 24.x | Dev server + build | ✓ | 24.x pinned | — |
| pnpm ≥10 | Package mgmt | ✓ | 10.33.0 | — |
| ComfyUI backend at `127.0.0.1:8188` | HUMAN-UAT (D-20) | Conda env `comfyui` per memory | per user env | User starts backend (documented command) |
| Chromium | Playwright `@moshpit` spec | ✓ via `@playwright/test` install | 1.58.1 | — |
| IndexedDB / `fake-indexeddb` | v2→v3 migration tests | ✓ | In lockfile | — |
| `reka-ui` Collapsible | Advanced disclosure | ✓ | 2.5.0 catalog | Plain `<details>` if Reka fails |
| `idb` | IDB open / upgrade | ✓ | In lockfile | — |
| `fast-check` | Property tests | ✓ | 4.5.3 | Hand-written invariant checks |
| Storybook | Component stories | ✓ | 10.2.10 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

Step 2.6 result: environment is fully provisioned; no install/setup steps needed before execution begins.

## Validation Architecture

(Per `.planning/config.json` `workflow.nyquist_validation: true`.)

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.16 (unit / component, happy-dom) + Playwright 1.58.1 (E2E, tag `@moshpit`) |
| Config file | `vite.config.mts` (vitest block) + `playwright.config.ts` |
| Quick run command | `pnpm test:unit -- src/platform/moshpit/<module> --run` (scoped per touched file) |
| Full suite command | `pnpm test:unit --run && pnpm typecheck && pnpm lint` |
| Playwright spec | `browser_tests/tests/moshpit/lineage-groupings.spec.ts` (created by Plan 06 Task 5) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GROUP-01 | Toggle any combination of grouping axes | component | `pnpm test:unit -- src/platform/moshpit/components/MoshpitGroupingToggles.test.ts --run` | ❌ Wave 0 (Plan 04 Task 1) |
| GROUP-02 | Auto-nesting = avg bucket size desc | unit | `pnpm test:unit -- src/platform/moshpit/services/clusterLayout.test.ts --run` | ❌ Wave 0 (Plan 01 Task 2) |
| GROUP-03 | Workflow axis bucket-key | unit | `pnpm test:unit -- src/platform/moshpit/services/groupAxes.test.ts --run` | ❌ Wave 0 (Plan 01 Task 1) |
| GROUP-04 | Save-node identity extraction + IDB migration | unit | `pnpm test:unit -- src/platform/moshpit/services/paramNormalize.test.ts src/platform/moshpit/services/thumbRepository.test.ts --run` | ✅ extend (Plan 02) |
| GROUP-05 | Prompt axis normalised bucket-key | unit | `pnpm test:unit -- src/platform/moshpit/services/groupAxes.test.ts --run` | ❌ Wave 0 (Plan 01 Task 1) |
| GROUP-06 | Model axis bucket-key | unit | `pnpm test:unit -- src/platform/moshpit/services/groupAxes.test.ts --run` | ❌ Wave 0 |
| GROUP-07 | Type aspect-bucket derivation | unit | `pnpm test:unit -- src/platform/moshpit/services/groupAxes.test.ts --run` | ❌ Wave 0 |
| GROUP-08 | "(other)" bucket fallthrough | unit | `pnpm test:unit -- src/platform/moshpit/services/groupAxes.test.ts src/platform/moshpit/services/clusterLayout.test.ts --run` | ❌ Wave 0 |
| GROUP-09 | Filters cull; groupings organise | integration | `pnpm test:unit -- src/platform/moshpit/composables/useMoshpitFilteredAssets.test.ts --run` | ✅ extend (Plan 03) |
| GROUP-10 | <400ms recompute + tween at 5k | unit (perf marker) + manual (wall-clock) | `pnpm test:unit -- src/platform/moshpit/services/clusterLayout.test.ts --run` (asserts <100ms math); manual HUMAN-UAT for tween perception | ❌ Wave 0 + manual |
| CSORT-01 | Within-cluster sort dropdown (3 modes) | component + unit | `pnpm test:unit -- src/platform/moshpit/components/MoshpitWithinClusterSort.test.ts src/platform/moshpit/services/groupAxes.test.ts --run` | ❌ Wave 0 |
| FILTER-12 | Primary chip row + Advanced disclosure + saveNode chip | component | `pnpm test:unit -- src/platform/moshpit/components/MoshpitAdvancedFilters.test.ts src/platform/moshpit/components/MoshpitFilterChipRow.test.ts src/platform/moshpit/components/MoshpitAddFilterPopover.test.ts --run` | ✅ extend + ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test:unit -- <scoped paths> --run` (≤30s scoped runs).
- **Per wave merge:** `pnpm test:unit --run && pnpm typecheck && pnpm lint` (~60s).
- **Phase gate:** Full suite green + `pnpm knip` clean + `@moshpit` Playwright spec parses (`pnpm exec playwright test --project=chromium --grep @moshpit --list`) + HUMAN-UAT sign-off recorded in `04-HUMAN-UAT.md`.

### Wave 0 Gaps

- [ ] `src/platform/moshpit/services/groupAxes.test.ts` — covers GROUP-02/03/05/06/07/08/CSORT-01 (Plan 01 Task 1)
- [ ] `src/platform/moshpit/services/clusterLayout.test.ts` — covers GROUP-02/08/10; includes fast-check uniqueness property + 5k × 3-axis perf marker <100ms (Plan 01 Task 2)
- [ ] `src/platform/moshpit/components/MoshpitGroupingToggles.test.ts` — covers GROUP-01 (Plan 04 Task 1)
- [ ] `src/platform/moshpit/components/MoshpitWithinClusterSort.test.ts` — covers CSORT-01 (Plan 04 Task 2)
- [ ] `src/platform/moshpit/components/MoshpitAdvancedFilters.test.ts` — covers FILTER-12 disclosure (Plan 04 Task 3)
- [ ] `src/platform/moshpit/components/MoshpitClusterOverlay.test.ts` — covers GROUP-01/02 overlay presence (Plan 05 Task 1)
- [ ] `browser_tests/tests/moshpit/lineage-groupings.spec.ts` — `@moshpit` Playwright spec (Plan 06 Task 5)
- [ ] `.planning/phases/04-lineage-groupings-within-cluster-sort/04-HUMAN-UAT.md` — dogfood checklist + D-22 gate (Plan 06 Task 6)

Wave 0 new-file list replaces the placeholder paths in current `04-VALIDATION.md` which incorrectly reference `src/workbench/moshpit/...` — actual path is `src/platform/moshpit/...`. Plan 06 Task 6 fixes this.

Extended tests (existing files):
- [ ] `src/platform/moshpit/services/paramNormalize.test.ts` — extend with `saveNodeIdentity` cases (Plan 02 Task 1)
- [ ] `src/platform/moshpit/services/thumbRepository.test.ts` — extend with v2→v3 migration (Plan 02 Task 2)
- [ ] `src/platform/moshpit/services/filterMath.test.ts` — extend with saveNode categorical predicate + exhaustive `never` default (Plan 03 Task 1)
- [ ] `src/platform/moshpit/stores/moshpitFilterStore.test.ts` — replace sortX/sortY tests with grouping/within-sort/advanced (Plan 03 Task 2)
- [ ] `src/platform/moshpit/composables/useMoshpitFilteredAssets.test.ts` — replace axisMode/sortX/sortY tests with clusterTree/activeGroupings coverage (Plan 03 Task 3)
- [ ] `src/platform/moshpit/components/MoshpitFilterChipRow.test.ts` — add tier-prop coverage (Plan 04 Task 4)
- [ ] `src/platform/moshpit/components/MoshpitAddFilterPopover.test.ts` — add saveNode entry + Primary/Advanced section coverage (Plan 04 Task 4)
- [ ] `src/platform/moshpit/components/MoshpitSettingsPanel.test.ts` — rewrite for new layout order (Plan 06 Task 1)
- [ ] `src/platform/moshpit/components/MoshpitCanvas.test.ts` — swap axis overlay → cluster overlay (Plan 06 Task 2)

## Security Domain

(`security_enforcement` status: not explicitly set in `.planning/config.json`; defaulting to enabled.)

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — Moshpit consumes existing frontend session; no new auth surface |
| V3 Session Management | no | N/A — no new session state |
| V4 Access Control | no | N/A — Moshpit is client-only |
| V5 Input Validation | yes | Zod schema on `NormalizedParamsSchema` (existing); `paramNormalize.normalizeParams` widens to parse `saveNodeIdentity` with `z.string().nullable()` |
| V6 Cryptography | no | Content-hash (SHA-256) is reused from Phase 2; no new crypto in Phase 4 |
| V7 Error Handling | yes | IDB upgrade per-record `try/catch`; Vue global error → Sentry (existing); no new unbounded catch-all |
| V8 Data Protection | yes | No new secret handling; PNG metadata sanitisation via existing `paramNormalize.ts` (already validated) |
| V12 File Handling | yes | PNG metadata strings → bucket labels; truncated at render via CSS `truncate max-w-56` (~28ch) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via cluster labels | Information Disclosure | Vue `{{ }}` interpolation auto-escapes; no `v-html`; template-only rendering confirmed in Plan 05 Task 1 |
| Malicious PNG metadata causing upgrade transaction abort | Denial of Service | Per-record `try/catch` in v2→v3 upgrade; skipped records logged, migration continues (Pitfall 4) |
| Prototype pollution via parsed workflow JSON | Tampering | `normalizeParams` validates with Zod; no `Object.assign(target, parsed)` on untrusted input |
| Unbounded cluster tree causing browser DoS | DoS | Recursion depth capped at `GROUPING_AXES.length = 5`; bucket-key memoisation prevents quadratic blow-up (Pitfall 6); <100ms perf marker enforces budget |
| Viewport handler leak on Moshpit ↔ workflow swap | Resource Exhaustion | `watch` + `onCleanup` detaches `'moved'` handler (verified at `MoshpitAxisOverlay.vue:62-64`, Pitfall copy-pasted into `MoshpitClusterOverlay.vue`) |
| ParamKey widening silently breaks filter semantics | Tampering | Exhaustive `never` default in switches over `ParamKey` (Pitfall 1); compile-time proof |
| `saveNodeIdentity` arbitrary length on render | DoS (layout) | CSS `truncate max-w-56` caps label render width; 28ch ellipsis |

## Sources

### Primary (HIGH confidence)

- `src/platform/moshpit/services/sortMath.ts` (310 lines) — `[VERIFIED: wc -l + grep]`
- `src/platform/moshpit/services/paramNormalize.ts` (350 lines; `findAllNodesByClassTypes` at line 168, `_meta?: { title?: string }` at line 51) — `[VERIFIED: grep]`
- `src/platform/moshpit/services/filterTypes.ts` (63 lines) — `[VERIFIED: wc -l]`
- `src/platform/moshpit/services/thumbRepository.ts` (135 lines; v1→v2 upgrade at lines 44-64) — `[VERIFIED: wc -l + grep]`
- `src/platform/moshpit/services/thumbRepository.types.ts` (`MOSHPIT_DB_VERSION = 2` at line 53, `AssetMetaRecord` at lines 22-32) — `[VERIFIED: grep]`
- `src/platform/moshpit/stores/moshpitFilterStore.ts` (170 lines) — `[VERIFIED: wc -l]`
- `src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` (280 lines; `REPACK_DURATION_MS = 300` at line 55; ease-out-cubic at line 223) — `[VERIFIED: grep]`
- `src/platform/moshpit/composables/useMoshpitViewportInjection.ts` (23 lines; `MOSHPIT_VIEWPORT_INJECTION_KEY` at line 12; `useMoshpitViewport()` at line 15) — `[VERIFIED: grep]`
- `src/platform/moshpit/components/MoshpitAxisOverlay.vue` (117 lines; `transformTick` pattern at lines 49-84, `vp.on('moved')` at line 62) — `[VERIFIED: grep]`
- `src/platform/moshpit/components/MoshpitSettingsPanel.vue` (70 lines) — `[VERIFIED: wc -l]`
- `src/renderer/extensions/linearMode/PartnerNodesList.vue` (`CollapsibleRoot`/`CollapsibleContent`/`CollapsibleTrigger` imports at lines 2-6, usage at lines 62-84) — `[VERIFIED: grep]`
- `package.json` (`reka-ui: catalog:` at line 113) — `[VERIFIED: grep]`
- `.planning/phases/04-lineage-groupings-within-cluster-sort/04-CONTEXT.md` — source of D-01..D-22
- `.planning/phases/04-lineage-groupings-within-cluster-sort/04-01-PLAN.md` through `04-06-PLAN.md` — encode prior research findings
- `.planning/REQUIREMENTS.md` — authoritative GROUP-01..10, CSORT-01, FILTER-12 definitions
- `CLAUDE.md` + `AGENTS.md` — authoritative project rules

### Secondary (MEDIUM confidence — registry versions via `npm view`)

- `[CITED: npm view reka-ui version]` → 2.9.6 current; project pins via catalog (pinned version not read from `pnpm-workspace.yaml`)
- `[CITED: npm view idb version]` → 8.0.3 current; project version pinned in lockfile
- `[CITED: npm view fast-check version]` → 4.7.0 current; project uses 4.5.3 per `package.json`

### Tertiary (LOW confidence / Assumed)

None — assumptions explicitly listed in Assumptions Log with risk assessment.

## Metadata

**Confidence breakdown:**
- Existing architecture: HIGH — all file paths + line counts + API shapes verified this session via grep/wc.
- Cluster layout algorithm: HIGH — math specification encoded in Plan 01 with property tests and perf marker.
- IDB migration pattern: HIGH — v1→v2 precedent verified in code; v2→v3 mirrors exactly.
- UI composition: HIGH — Reka Collapsible pattern verified at `PartnerNodesList.vue`; pill-toggle pattern matches existing store-bound control precedent at `MoshpitShowHiddenToggle.vue`.
- Validation strategy: HIGH — existing Vitest + happy-dom + Playwright infrastructure already used by Phases 1–3; no new tooling.
- Performance budget: MEDIUM — 100ms math budget at 5k × 3 axes is a plan assertion (enforced by Vitest perf marker); total 400ms assumes the 300ms tween dominates. Worst case requires Web Worker offload (A5).
- Save-node extraction coverage: MEDIUM — 5-class set covers core ComfyUI; custom-node long tail falls into `(other)` by design, not bug (Pitfall 3).

**Research date:** 2026-04-21 (recovery run)
**Valid until:** 2026-05-21 (30 days — stable deps, no upstream churn expected in Reka/idb/fast-check during Phase 4 execution window)
