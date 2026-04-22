# Phase 3: Filter & Sort (Core Validation) - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the full filter→sort loop on top of the Phase 2 asset pipeline. Ship the initial filter gate (single workflow + time range), subtractive filter chips across the hardcoded parameter list, and two spatial sort modes (1D-with-packing + optional 2D scatter). Prove — or falsify — that spatial-sort-by-parameter is a valuable reasoning surface on real parameter sweeps.

**Requirements in-scope:** FILTER-01..11, SORT-01..05.

**Out of scope:**

- Comparison entry (Phase 4) — filter/sort UI does not open compare.
- Curation mutations (Phase 5) — Phase 3 _reads_ `moshpitCurationStore` for favourite/tag/hidden filters but does not mutate.
- Polished empty states for mid-session zero-match, all-hidden, and full-workflow perf — Phase 7 owns those. Phase 3 ships the "pick a workflow + time range" gate state only.
- Imported / user-uploaded assets; semantic prompt search; saved presets; multi-workflow selection.

</domain>

<decisions>
## Implementation Decisions

### Parameter Extraction & Normalization (the core-validation-risk area)

- **D-01:** Normalization runs **in the Web Worker** at metadata-parse time. The worker writes a typed `params` object to IndexedDB `assetMeta` alongside the raw PNG tEXt chunks. Filter/sort math reads the typed fields directly — zero main-thread parsing cost on warm cache, zero cost per filter/sort change. Schema changes to the heuristic require a stored-version bump + re-parse migration; planner decides the exact migration strategy.
- **D-02:** `prompt` chunk (ComfyUI API format — inputs-by-name object) is the **authoritative source**. It's stable across ComfyUI UI reorderings; `node.inputs.cfg` / `node.inputs.steps` etc. can be queried by name. The `workflow` chunk (UI graph, `widgets_values` in positional order) is fragile across ComfyUI versions and is **not** walked in v1. If Phase 3 dogfooding surfaces real outputs the `prompt`-only path misses, adding a `workflow` fallback is a Phase 7 (or Phase 3 gap-closure) call.
- **D-03:** Extraction is **best-effort, silently null**. Missing/unparseable parameters resolve to `undefined` on the normalized record. Assets stay in the Moshpit but drop out of any filter/sort that queries the missing field — this is consistent with FILTER-09 ("assets lacking the filtered parameter are hidden") and SORT-03 ("assets lacking the sorted parameter are hidden"). No second counter, no "partial metadata" surface, no user-facing noise.
- **D-04:** LoRAs normalize to `loras: { name: string, weight: number }[]`. Filter UX: "has LoRA {name}" (name match, any weight, OR-combined across names in a single chip). Sort UX: by `loras.length` (count). Sort-by-weight is **not** shipped in v1 — it would require per-LoRA axis selection which balloons the sort UI; name+weight as a sweep dimension is a v2 idea.
- **D-05:** Normalized parameter shape (v1 target):
  ```
  {
    model: string | undefined          // CheckpointLoaderSimple.ckpt_name
    loras: { name: string, weight: number }[]  // any LoraLoader*-shaped node's strength_model
    cfg: number | undefined            // KSampler*.cfg
    steps: number | undefined          // KSampler*.steps
    sampler: string | undefined        // KSampler*.sampler_name
    scheduler: string | undefined      // KSampler*.scheduler
    seed: number | undefined           // KSampler*.seed
    positivePrompt: string | undefined // CLIPTextEncode text from positive conditioning path (heuristic)
    negativePrompt: string | undefined // CLIPTextEncode text from negative conditioning path (heuristic)
    width: number | undefined          // EmptyLatentImage.width (or equivalent)
    height: number | undefined         // EmptyLatentImage.height
    timestamp: number                  // source AssetItem.created_at mirror — always defined
  }
  ```
  Tags / favourite / hidden come from `moshpitCurationStore`, not from normalized params — they are filter sources, not extracted metadata.

### Initial Filter Gate UX

- **D-06:** Gate is **Settings-panel-only**. No modal overlay, no full-canvas hero card. Workflow + time-range controls render at the top of `MoshpitSettingsPanel.vue` (above the filter chip slot Phase 2 already reserved). The canvas renders a centered empty-state message ("Pick a workflow and time range to start.") until both are set. Matches UX-01 and avoids a new modal pattern.
- **D-07:** Workflow picker is a **single-select searchable combobox of workflow filenames with asset counts**. Format: `workflow_name (1,247 assets)`. Implementation uses Reka UI / Tailwind — no new PrimeVue surface. Handles 100+ filenames without a scrolly list.
- **D-08:** Workflow selection is **single**, not multi. Aligns with PRD §7.2 and keeps the core validation signal clean. Multi-workflow was considered and reverted — spatial sort across heterogeneous KSampler shapes dilutes the validation answer and leaves sparse 2D scatters. Multi-workflow is a v2 idea.
- **D-09:** Time-range presets ship as **Today / This week / This month / All time + custom range**. Matches PRD §7.2 and FILTER-01 literally. The existing `src/platform/assets/types/metadataFilter.ts` has a superset (`yesterday`, `lastWeek`, `lastMonth`) — Phase 3 does **not** ship the extras (scope discipline). Custom range uses a Moshpit-local date-range control to avoid introducing new PrimeVue DatePicker surface; planner decides whether to adapt `DateRangeFilter.vue` or ship a new Tailwind/Reka control.

### Filter Chip Authoring

- **D-10:** Adding a filter chip is a **"+ Add filter" button → two-step popover picker**. Click "+ Add filter" → popover lists filterable parameters (Model, LoRA, CFG, Steps, Sampler, Scheduler, Seed, Prompt, Negative prompt, Resolution, Generation time, Tags, Favourite). Selecting a parameter opens its inline value editor. Matches Notion / Linear / Airtable pattern. Keyboard: `/` focuses the "+ Add filter" button (PRD §7.12).
- **D-11:** Per-parameter value editors:
  - **Numeric** (CFG, steps, seed): min–max dual input with an `=` toggle for exact-value matches.
  - **Categorical** (model, sampler, scheduler, LoRA name, tags): multi-select chip-list with fuzzy search over values discovered in the current asset set.
  - **Text** (prompt, negative prompt): substring input; case-insensitive; single substring per chip (OR additional chips to broaden).
  - **Resolution**: `width×height` presets (from discovered values) + custom `width × height` dual input.
  - **Boolean** (favourite): simple checkbox / toggle.
- **D-12:** Duplicate-parameter chips merge **values OR-combined within one chip**. Adding "Sampler: euler" then "Sampler: dpmpp_2m" produces one chip with `OR` semantics. Different parameters AND together across chips. Models the user's natural phrasing: "show me euler OR dpmpp, filtered to Model X". No operator toggle per chip in v1.
- **D-13:** The `hidden:false` default is **implicit, with an explicit "Show hidden" toggle in the Settings panel footer** (near the excluded-count row). Toggling it removes the implicit filter. No persistent "Hidden: false" chip cluttering the chip row. Matches FILTER-11.
- **D-14:** Filter chip click-to-remove (FILTER-10) removes the chip entirely, which re-admits the hidden assets with the 300ms ease-out-cubic tween (see D-18).

### Sort Controls & Spatial Arrangement

- **D-15:** Sort UX is an **X-axis picker always visible, Y-axis picker optional**. In the Settings panel under the chip list:
  ```
  Sort — X: [ param ▾ ]   Y: [ + Add axis ]
  ```
  Selecting a Y parameter flips the canvas to 2D scatter. Clearing Y returns to 1D-with-packing. There is **no explicit 1D/2D mode toggle** — axis state IS the mode.
- **D-16:** Bucketing is **column-per-unique-value** for both discrete and continuous parameters. CFG values `6.5, 7.0, 7.5, 8.0` → four columns in declared (sorted) order. Categorical params (sampler, model) → one column per unique value, alphabetically sorted. This matches how users actually sweep parameters (they pick discrete values; sparse columns are fine). No auto-bucketing heuristic. Values are `JSON.stringify`-comparable for grouping so numeric and string compare cleanly.
- **D-17:** Assets lacking the sorted parameter are hidden (SORT-03). Rendering and tween treat this identically to a filter exclusion.
- **D-18:** Position changes — applying/changing/clearing a sort, adding/removing a filter chip — **animate with a 300ms ease-out-cubic tween**, same primitive as Phase 2 D-04 re-pack. `useMoshpitSpriteLayer` already owns the tween path; Phase 3 extends its input (new layout targets) without changing the animation shape.
- **D-19:** Removing the last sort **returns sprites to the chaos (jittered-grid) layout** — the same seeded jittered grid computed at filter-apply time (Phase 2 D-02). Filter-hash-seeded determinism means the user sees the same spatial arrangement they saw pre-sort. Sprites tween back.

### Claude's Discretion

The following are deliberately unlocked. Researcher investigates; planner picks; executor documents.

- **Grid-spacing control UX.** SORT-04 requires user-configurable grid spacing. Options: numeric input with +/- steppers, compact slider, or a "compact / normal / wide" three-step picker. Planner picks — lean toward a compact slider in the Settings panel footer near the excluded-count row.
- **Axis-label / legend rendering on canvas.** When 1D/2D sort is active, should axis labels render on the canvas surface (PixiJS-drawn) or as an overlay HTML layer? How are the bucketed column headers labeled (e.g., "CFG 7", "euler")? Designer / researcher should check Comfy Design Standards Figma for any Moshpit axis legend tokens. Default direction: overlay HTML labels anchored to world-space column/row coordinates (keeps text crisp at any zoom without PixiJS text atlas pain).
- **Filter chip active-filter state storage.** New Pinia store (`moshpitFilterStore`) vs extending `moshpitSidebarStore`? Planner finalizes against layering rules. Default direction: new dedicated store — filter and sort state is complex enough to warrant its own domain module. Store holds `{ workflow: string | null, timeRange: {...}, chips: FilterChip[], sortX: ParamKey | null, sortY: ParamKey | null, gridSpacing: number, showHidden: boolean }`.
- **Workflow filename grouping under drift.** PRD §9 flags workflow-filename grouping as imperfect when the same filename has evolved. v1 accepts filename-as-group. Planner does not need to solve graph-hash grouping — leave as a known limitation.
- **"+ Add filter" picker scroll/filter behaviour.** If we ship 13 parameters, does the popover need search? Probably yes for keyboard affordance. Researcher confirms against Reka UI / existing codebase picker patterns.
- **Performance budget at 5k assets.** Every filter/sort recompute touches up to 5,000 sprites. Layout math is pure; budget is CPU. Tween is GPU. Planner keeps filter/sort math in a pure module (no Pinia reactivity on tight loops) so the 5k case stays well inside 16ms frame budget. Researcher verifies at 5k fixture.
- **Reuse vs adapt of `DateRangeFilter.vue`.** Current implementation uses PrimeVue DatePicker which project-wide conventions discourage for new code. Options: wrap existing, adapt in place, or ship a Moshpit-local Tailwind+Reka control. Planner decides based on scope discipline.
- **Active-filter URL/query-param sync.** Out of scope for v1 — PRD is silent on shareable-filter URLs. Noted here so planner doesn't accidentally add it.

### Validation Strategy (Core Value Proof)

- **D-20:** Phase 3 ships with a **`03-HUMAN-UAT.md` checklist** that documents a real-world parameter-sweep dogfood scenario:
  1. Run a CFG sweep workflow in a real ComfyUI backend (CFG stepping e.g. 3→12 by 1, fixed seed/sampler/steps).
  2. Load Moshpit, pick the workflow + time range.
  3. Add a sort on CFG (X-axis only).
  4. Capture screenshot showing legible column arrangement of sprites.
  5. Qualitative sign-off on "does the arrangement make it easier to pick the best CFG than scrolling a flat grid would?" — binary answer with notes.
- **D-21:** **No Playwright E2E fixture** blocks Phase 3 acceptance. Phase 3 may ship a `@moshpit` spec for filter/sort state (chip add, chip remove, sort-axis change, tween frame-budget sampling) but the core-value proof is qualitative. Regression protection for the filter/sort math is via **Vitest unit tests on the pure layout/bucketing module** — high coverage, fast, deterministic. Playwright smoke on a seeded fixture can follow in Phase 7 perf validation.
- **D-22:** If Phase 3 HUMAN-UAT returns a negative or "sort of" sign-off, **pause roadmap execution** before planning Phase 4. The Phase 3 validation answer gates Phases 4–7 per the roadmap's own framing ("Phases 4–7 are only worth building if Phase 3 lands").

### Folded Todos

None — no pending todos matched Phase 3 scope.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ADRs (entity architecture constraints)

- `docs/adr/0001-merge-litegraph-into-frontend.md` — litegraph is vendored; Moshpit must not touch `src/lib/litegraph`.
- `docs/adr/0003-crdt-based-layout-system.md` — command pattern for entity mutations; Moshpit sort/filter layout writes must be serializable commands, not imperative mutations.
- `docs/adr/0008-entity-component-system.md` — no methods/properties added to god-object entity classes; Moshpit sort/filter state lives in a dedicated Pinia store, filter/sort math lives in pure modules.

### Project-level specs

- `.planning/PROJECT.md` §Constraints, §Key Decisions — PixiJS, IndexedDB v1, desktop-first, 5k budget, no `dark:` / `!important` / `any` / `as any` / `--no-verify`.
- `.planning/REQUIREMENTS.md` §Filtering (FILTER-01..11), §Sorting (SORT-01..05) — authoritative scope list.
- `.planning/ROADMAP.md` §Phase 3 Success Criteria — what must be TRUE at phase exit. Note: Phase 3 is the Core Value validation milestone; Phases 4–7 depend on a positive Phase 3 answer.
- `temp/plans/moshpit_prd.md` §5.4 (subtractive filter framing), §5.6 (1D/2D sort modes), §7.1–7.6 (Settings panel, initial filter, processing step, parameter list, filter behaviour, sort behaviour), §7.12 (keymap including `/` for filter focus), §7.14 (empty states — only "no initial filter" is Phase 3), §8.5 (embedded PNG metadata only), §9 (open questions: chaos-state visual, workflow grouping drift — both carry forward unchanged).

### Phase 1 & 2 carry-forward

- `.planning/phases/01-workspace-shell-canvas-navigation/01-CONTEXT.md` — Settings panel mount point, Moshpit platform-layer domain (`src/platform/moshpit/`), sidebar tab extension reuse / parallel decision.
- `.planning/phases/02-asset-pipeline/02-CONTEXT.md` — normalized param shape in IDB `assetMeta` is an extension of the Phase 2 store contract; filter-hash seed determinism (D-02) drives the "return to chaos on sort clear" behaviour; 300ms ease-out-cubic re-pack tween (D-04) is the single animation primitive for filter/sort transitions.
- `.planning/phases/02-asset-pipeline/02-VALIDATION.md` — task-to-requirement mapping conventions Phase 3 inherits.

### Codebase maps

- `.planning/codebase/STRUCTURE.md` — layer rules (`base → platform → workbench → renderer`); Moshpit lives in `src/platform/moshpit/`.
- `.planning/codebase/ARCHITECTURE.md` — Pinia setup-API store pattern, composable conventions.
- `.planning/codebase/CONVENTIONS.md` — Vue 3.5 destructured props, Tailwind semantic tokens, no `dark:`, `cn()` only, no `:class="[]"`.
- `.planning/codebase/TESTING.md` — Vitest + happy-dom for unit; Playwright `@moshpit` tag for E2E.

### Existing code to extend / consume

- `src/platform/moshpit/stores/moshpitMetadataStore.ts` — `metaByHash: Map<string, Record<string, string>>`; Phase 3 **extends** by storing a normalized `params` alongside raw meta, or (planner's call) adds a sibling store.
- `src/platform/moshpit/stores/moshpitCurationStore.ts` — Phase 2 scaffold; Phase 3 reads `favourite`, `tags`, `hidden` flags for filter sources.
- `src/platform/moshpit/composables/useMoshpitAssetRegistry.ts` — currently returns all assets with a thumb URL; Phase 3 adds a filter layer on top (likely a new composable `useMoshpitFilteredAssets` that wraps this).
- `src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` — owns the tween path; Phase 3 adds new position target inputs (filter/sort-driven).
- `src/platform/moshpit/services/layoutMath.ts` — `computeJitteredGrid` + `computePackedGrid`; Phase 3 **adds** `computeSortedLayout1D` and `computeSortedLayout2D` pure functions in the same module (or a sibling `sortMath.ts`).
- `src/platform/moshpit/services/thumbWorker.ts` — **extends** the `processAsset` flow: after `parseMetadata`, call a new pure `normalizeParams(rawMeta)` and post both `metadata` and `params` on `thumbReady`.
- `src/platform/moshpit/services/thumbRepository.ts` — **extends** the `assetMeta` object store schema to include `params` on each record. Planner decides whether to bump the IDB version (re-parse migration on read) or add a sibling store.
- `src/platform/moshpit/components/MoshpitSettingsPanel.vue` — Phase 3 injects the initial-filter section, chip row, sort controls, grid-spacing control, and show-hidden toggle above the existing excluded-count row.
- `src/platform/moshpit/components/MoshpitCanvas.vue` — Phase 3 adds the axis-label overlay layer (HTML anchored to world-space) when a sort is active.
- `src/platform/assets/components/DateRangeFilter.vue` — reference for a date range control; v1 uses PrimeVue DatePicker which project-wide conventions discourage. Planner's call on adapt vs wrap vs replace.
- `src/platform/assets/types/metadataFilter.ts` — `DatePreset` enum reference; Phase 3 ships a strict subset (today / thisWeek / thisMonth / all + custom) to match PRD §7.2.
- `src/stores/assetsStore.ts` — `outputJobAssets` stream (Phase 2 input); Phase 3 reads the same stream for the workflow picker's "group by filename" (derive workflow list from `asset.metadata.workflow_filename` or equivalent).
- `src/scripts/metadata/png.ts` — `getFromPngBuffer` returns `Record<string, string>`; the `prompt` key holds the ComfyUI API-format JSON string that D-02 normalizes from.

### Guidance docs

- `docs/guidance/typescript.md` — no `any`, no `as any`, type assertion hierarchy; normalized params are a typed Zod schema.
- `docs/guidance/vue-components.md` — Vue 3.5 destructured props, `<script setup>`, `defineModel` for v-model.
- `docs/guidance/design-standards.md` — check Comfy Design Standards Figma for Moshpit-specific filter chip / sort control / axis label tokens before hardcoding.

### External library docs (fetch via Context7 when planning)

- `reka-ui` — combobox / popover primitives for the workflow picker and "+ Add filter" popover.
- `@tanstack/vue-virtual` — if the workflow picker or "+ Add filter" categorical multi-selects exceed virtualization threshold (say 200 items). Lazy.
- `pixi.js` v8 — world-space text overlay coordinates for axis labels (if we go PixiJS-drawn instead of HTML).
- `pixi-viewport` — world-to-screen transform for HTML-anchored axis labels.

### Domain references

- ComfyUI API-format prompt JSON reference — the shape `D-02` normalizes from. The prompt chunk is `{<nodeId>: { class_type, inputs, _meta? }, ...}`. KSampler-family nodes have `inputs.cfg / steps / sampler_name / scheduler / seed`. CheckpointLoaderSimple has `inputs.ckpt_name`. LoraLoader / LoraLoaderModelOnly / LoraTagLoader variants have `inputs.lora_name` + `inputs.strength_model`. CLIPTextEncode has `inputs.text` — positive vs negative resolved by walking the graph from KSampler's `positive` / `negative` input refs. EmptyLatentImage has `inputs.width` / `inputs.height`.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`moshpitMetadataStore.metaByHash`** — already populated by Phase 2's worker; Phase 3 extends the worker output (D-01) to add a typed `params` sibling field on the same IDB record.
- **`moshpitCurationStore`** — Phase 2 scaffold keyed by content hash; Phase 3 reads `{ favourite, tags, hidden }` into the filter pipeline.
- **`useMoshpitSpriteLayer`** — the 300ms ease-out-cubic tween path is built. Phase 3 drives new layout targets through this existing primitive (no new animation code).
- **`layoutMath.computePackedGrid` / `computeJitteredGrid`** — the coordinate-system primitives. Phase 3 adds `computeSortedLayout1D` (groups by param value, packs vertically per column) and `computeSortedLayout2D` (groups by param-pair, one asset per cell or stacks within cell) in the same style — pure, deterministic, testable.
- **`useMoshpitAssetRegistry`** — current source of the sprite stream. Phase 3 wraps it with a filter/sort layer, probably via a new `useMoshpitFilteredAssets` composable.
- **`MoshpitSettingsPanel.vue`** — has a comment at line 10 reserving the Phase 3 chip/sort injection slot above the excluded-count row. Phase 3 fills this in.
- **`src/platform/assets/types/metadataFilter.ts`** — `DatePreset` enum + `getDateRangeForPreset` are close to what Phase 3 needs; ship the PRD-literal subset only.
- **`assetsStore.outputJobAssets`** — Phase 2 consumer is the same stream Phase 3 derives the workflow picker options from.

### Established Patterns

- **Pinia setup-API stores** — Moshpit follows this universally; `moshpitFilterStore` (new) uses the same pattern.
- **Platform-layer domain** — `src/platform/moshpit/{stores,composables,components,services}` is the home; Phase 3 adds to all four.
- **Pure math modules with colocated Vitest** — Phase 2 established `layoutMath.ts + layoutMath.test.ts` and `contentHash.ts + contentHash.test.ts`. Phase 3 follows: `paramNormalize.ts` (worker-safe leaf), `sortMath.ts`, `filterMath.ts`, each with `.test.ts`.
- **Worker message contract** — Phase 2's `workerMessages.ts` discriminated union; Phase 3 extends `thumbReady` with a `params` field (breaking change to the worker contract — planner handles the bump).
- **IDB repository** — `thumbRepository.ts` + `thumbRepository.types.ts`. Phase 3 extends the `assetMeta` store schema with a `params` field. IDB version bump + migration strategy is the planner's call.
- **vue-i18n `moshpit.*` namespace** — Phase 3 adds `moshpit.filters.*` and `moshpit.sort.*` keys under `src/locales/en/main.json`.
- **Tailwind semantic tokens + `cn()`** — all new chrome (chip pill, sort picker, axis overlay) uses semantic tokens; no `:class="[]"`, no `dark:`, no `!important`.
- **Reka UI primitives** — prefer over new PrimeVue; the combobox + popover patterns have precedent in the codebase (search for `reka-ui` imports before writing new).

### Integration Points

- **`MoshpitSettingsPanel.vue`** — inject initial-filter section, chip row, sort picker, grid-spacing control, show-hidden toggle above the existing `moshpit-excluded-count` row.
- **`MoshpitCanvas.vue`** — optional overlay layer for axis labels when sort is active (default direction: HTML anchored to world-space).
- **`thumbWorker.ts` `processAsset`** — extend `parseMetadata` → `normalizeParams` → post both on `thumbReady` (D-01).
- **`workerBridge.ts`** — handle the new `params` payload on `thumbReady`; write to `moshpitMetadataStore` + IDB.
- **`thumbRepository.ts`** — `assetMeta` schema bump; read path returns both raw and normalized.
- **`useMoshpitAssetRegistry.ts`** — new wrapping composable `useMoshpitFilteredAssets` reads filter/sort store, applies filter predicate + sort layout math, emits the final `AssetEntry[]` the sprite layer consumes.
- **`src/locales/en/main.json`** — new `moshpit.filters.*` and `moshpit.sort.*` namespace.
- **`moshpitFilterStore.ts`** (new, `src/platform/moshpit/stores/`) — Pinia setup-API store owning filter/sort/grid-spacing/show-hidden state.

### Constraints Surfaced by the Scout

- **Normalized-param extraction has no precedent in this codebase.** Phase 3 establishes it. Worker-side, pure-function, Zod-validated shape. Treat the heuristic as a living document — plan for schema bumps.
- **`DateRangeFilter.vue` is PrimeVue DatePicker-based.** Project conventions discourage new PrimeVue usage. Phase 3 needs a date-range control; planner decides adapt / wrap / ship-local.
- **IDB schema version bump risk.** Phase 3 extends `assetMeta` with `params`. Planner chooses: (a) version bump + one-time re-parse migration on open, (b) sibling `assetParams` store keyed by same content hash, or (c) lazy re-parse on first read of any record that predates the new schema. Recommended direction: (a) — clean migration, bounded cost, surfaced during dogfood.
- **Workflow filename discovery.** The "workflow" filter value lives on `AssetItem` — planner should confirm the exact field name (likely `asset.user_metadata.workflow_filename` or similar — check during RESEARCH phase). If the field isn't reliably populated, workflow selection needs a fallback (e.g., grouping by ComfyUI `prompt.workflow_name` if embedded).
- **Axis label overlay alignment.** HTML-over-Pixi means DOM elements must track world-to-screen transforms on every viewport change. `pixi-viewport` emits a `moved`/`zoomed` event; planner confirms the cheap subscription path.

</code_context>

<specifics>
## Specific Ideas

- **Single-workflow only in v1.** User initially picked multi-workflow, then reverted on the downstream-implications follow-up. The reversion is deliberate — spatial sort across heterogeneous KSampler shapes dilutes the core-value validation answer. Multi-workflow is explicitly v2.
- **`prompt`-only extraction, no `workflow` fallback.** User chose the recommended single-source path. If dogfooding surfaces real outputs the prompt chunk misses, adding a `workflow` fallback is a scoped gap-closure or Phase 7 call — not a v1 blocker.
- **Column-per-unique-value bucketing.** User explicitly chose deterministic grouping over auto-bucketing heuristics. Parameter sweeps (the core use case) produce discrete values by construction; this bucketing reflects the actual user mental model.
- **300ms ease-out-cubic tween everywhere.** User chose animation consistency with Phase 2. Filter add/remove and sort change/clear all use the same primitive. No snap-on-some, tween-on-others split.
- **Validation is qualitative + documented, not automated.** User explicitly chose the HUMAN-UAT + screenshot path over Playwright fixtures. The Core Value answer is a human judgement call; automated fixtures would only measure code correctness, not the interaction's value.
- **Roadmap gate after Phase 3.** If HUMAN-UAT returns negative, Phases 4–7 pause per the roadmap's own framing. Phase 3 is the milestone that proves or disproves the project.

</specifics>

<deferred>
## Deferred Ideas

- **Multi-workflow selection.** Considered and explicitly rejected for v1. v2 idea; revisit after Phase 3 validation lands and the core interaction is proven.
- **Sort-by-LoRA-weight.** Excluded from v1 sort axes — would require per-LoRA axis selection which balloons the UI. Name-based filter + count-based sort only in v1.
- **`workflow` chunk fallback for parameter extraction.** Only if Phase 3 dogfooding shows the `prompt`-only path misses real outputs.
- **Auto-bucketing heuristic for truly-continuous parameter sweeps.** v1 uses column-per-unique-value. If users generate with continuously-varying CFG (rare), bucketing becomes a v2 polish.
- **Playwright E2E fixture for filter/sort regression.** Not required for Phase 3 acceptance. Phase 7 may pick up a perf-validation fixture that also covers filter/sort regression.
- **Saved filter/sort presets.** Out of scope for v1 per PROJECT.md and PRD §4.
- **Semantic prompt search.** Out of scope for v1 — substring only.
- **Shareable filter URL / query-param sync.** Not in PRD; noted here so planner doesn't accidentally add it.
- **Workflow grouping by graph hash / node-count heuristics.** PRD §9 open question — v1 accepts filename-as-group. Revisit in v2.
- **Thumbnail cache eviction.** Already deferred from Phase 2; still v2.
- **Figma design reference check.** No Moshpit-specific filter chip / sort picker / axis legend Figma node was referenced during discussion. Before implementing chrome, check Comfy Design Standards for any Moshpit Phase 3 tokens.
- **Reviewed Todos (not folded).** None — no pending todos matched Phase 3 scope.

</deferred>

---

_Phase: 03-filter-sort-core-validation_
_Context gathered: 2026-04-21_
