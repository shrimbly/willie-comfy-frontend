# Phase 2: Asset Pipeline - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the generated-only `AssetItem` stream into 512px WebP sprites on the Moshpit PixiJS canvas. A Web Worker fetches full-res, downscales via `createImageBitmap` + OffscreenCanvas, encodes WebP, and writes the blob to an IndexedDB store keyed by content hash. Sprites drop into pre-computed jittered-grid slots as thumbs arrive. A bottom-left "Processing N / M" pill surfaces progress with a cancel affordance. Warm cache populates in one frame; cold cache processes progressively without blocking 60fps pan/zoom. Assets without parseable ComfyUI metadata are excluded entirely and surfaced as a count in the Settings panel. After processing, the layout re-packs (300ms tween) to close holes.

Requirements in-scope: ASSET-01..10.

Out of scope (explicitly): filter gate and filter chips (Phase 3), sort (Phase 3), curation state mutation UI (Phase 5) — but the IndexedDB store schema and content-hash contract MUST accommodate Phase 5 curation state from day one.

</domain>

<decisions>
## Implementation Decisions

### Chaos Placement (initial layout)

- **D-01:** Placement algorithm is a **jittered grid**. Assign each asset to a grid cell via a deterministic hash-to-cell mapping; jitter within the cell by a bounded offset less than `cellSize/2` so no overlap. Dense, scannable, and trivially compatible with SORT-05 (grid-snapped positioning) in Phase 3 — the chaos layout is itself a grid, just with jitter applied.
- **D-02:** Layout is **seeded by a filter-set hash**. Seed = deterministic hash of `(filterKey, sortedAssetHashes)`. Same filter returning to the same asset set → same layout across reloads. New filter → new layout. The seed drives both cell assignment and jitter offsets. Not persisted to IndexedDB — recomputed from the seed each entry (cheap; avoids stale-layout invalidation).
- **D-03:** Bounding region is a **square scaled to `ceil(sqrt(N))` cells per side**. Keeps `F` (fit-all) framing clean regardless of count; avoids unbounded pan and avoids aspect-ratio distortion.
- **D-04:** After processing completes and excluded-metadata assets have dropped out, the layout **re-packs** surviving sprites to close holes. Re-pack animates with a **300ms ease tween** — all surviving sprites tween from chaos slot to packed slot simultaneously. Single recompute, no stagger.

### Processing Indicator UX

- **D-05:** Indicator is a **bottom-left floating pill overlaid on the canvas** — visible regardless of Settings panel open/collapsed state. Pill shows `"Processing {done} / {total}"` with a **thin horizontal progress bar** below the count and a trailing `×` cancel button. Self-contained component, mounted inside `MoshpitLayout` (or `MoshpitCanvas` overlay slot).
- **D-06:** Cancel (`×`) **aborts the queue and keeps completed thumbs**. Implementation: the worker honors an `AbortController`; dequeueing stops; in-flight `fetch`/`createImageBitmap` calls abort; already-cached IndexedDB entries are preserved. No partial-write rollback.
- **D-07:** On re-entering Moshpit with the same filter, processing **auto-resumes silently**. The pipeline diffs `(filtered assets) − (IndexedDB-cached thumbs)`; if the delta is non-empty, the worker queue restarts and the indicator reappears with N/M reflecting the remaining work. If the filter has changed, previous cancel is effectively moot — the new filter's pipeline starts fresh (cached thumbs for overlapping assets are reused automatically since they're content-hash keyed).
- **D-08:** Warm-cache short-circuit: if `(filtered assets) − (cached thumbs)` is empty, **indicator never renders** — canvas populates in one frame (ASSET-10).

### Claude's Discretion (flagged for researcher / planner)

These are deliberately unlocked — researcher should investigate, planner should pick, executor should document the choice in the plan. If any choice turns out to be consequential enough to warrant a user call, escalate.

- **Content-hash strategy.** Cache key for both thumbnails (Phase 2) and curation state (Phase 5). Recommended direction: client-side SHA-256 (Web Crypto `crypto.subtle.digest`) computed once in the worker over the fetched full-res buffer, stored alongside the thumb. Trust `AssetItem.asset_hash` when present (cloud path) as a fast-path to skip hashing; always fall back to client-side hash for OSS. Researcher: verify Web Crypto behavior inside a Web Worker, confirm stability of cloud `asset_hash` across sessions.
- **IndexedDB library.** Net-new dep. Recommended direction: `idb` (~1KB promise wrapper) for minimal bundle cost and explicit schema. Rule out `dexie` unless Phase 5's observable-query needs justify the ~22KB. Rule out raw IDB unless bundle-size-phobia dominates. Researcher: check pnpm catalog for existing idb usage, confirm bundle sizes.
- **Worker architecture.** Single worker vs pool, concurrency cap. Recommended direction: **one worker, internal concurrency cap of 4** (tune via profiling); scheduling driven by `runWhenGlobalIdle`; PNG metadata parsing happens **in the worker** (worker already has the full-res buffer, saves a main-thread round-trip). Researcher: confirm OffscreenCanvas + createImageBitmap + WebP encode path feasibility; benchmark the 4-concurrency assumption at 5k scale.
- **IndexedDB schema.** Recommended direction: **two object stores** — `thumbs` (keyPath: `contentHash`, value: `{ blob, width, height, generatedAt }`) and `assetMeta` (keyPath: `contentHash`, value: `{ metadata: ParsedComfyMeta, curation: CurationRecord }`). Splits cache-like data (thumbs, easy to evict later) from authoritative user-edited data (curation). Researcher: confirm the split against Phase 5's curation mutation patterns.
- **Asset store shape.** Recommended direction: **split** — `moshpitThumbStore` (thumb blob-URL cache, lifecycle tied to rendered sprites), `moshpitMetadataStore` (hash → parsed ComfyUI metadata, source of filter data), `moshpitCurationStore` (hash → curation record, Phase 5 primary). A `moshpitAssetRegistry` composable composes them into the ECS-style view PixiJS consumes. Planner: finalize against layering rules.
- **Filter-change-mid-processing.** Recommended direction: follow PRD §7.3 literally — assets that fall out of the new filter are cancelled rather than finished; assets newly in-filter enqueue; the indicator's N/M updates to the new delta. Planner: sequence the queue mutation without a visible reset flash.
- **Excluded-count placement in Settings panel.** Recommended direction: static row under the filter chips area reading `"{N} assets excluded: no metadata"` with an info tooltip explaining why. Planner: confirm against UI-hint artifacts if Phase 2 gets a `/gsd-ui-phase` pass.
- **Indicator fade-out on completion.** Recommended direction: on `done === total`, keep the pill visible for ~600ms at 100%, then fade out over 200ms. Avoids a jarring disappear at the moment the re-pack tween fires.
- **Sprite lifecycle.** Recommended direction: **no placeholder** per PRD §7.3 — sprite is created only when the thumb is ready. The grid slot is reserved regardless so the re-pack math is correct.

### Folded Todos

None — no pending todos matched Phase 2 scope.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ADRs (entity architecture constraints)

- `docs/adr/0001-merge-litegraph-into-frontend.md` — litegraph is vendored; the Moshpit canvas must not touch `src/lib/litegraph`.
- `docs/adr/0003-crdt-based-layout-system.md` — command pattern for entity mutations; Moshpit layout writes must be serializable commands (relevant once Phase 3 sort arrives; Phase 2 groundwork should not preclude it).
- `docs/adr/0008-entity-component-system.md` — no methods/properties added to `LGraphNode` / `LGraphCanvas` / `LGraph` / `Subgraph`; Moshpit sprite entities live in ECS-style stores / systems / composables.

### Project-level specs

- `.planning/PROJECT.md` §Constraints, §Key Decisions — IndexedDB only, desktop-first, 5k budget, no `dark:` / `!important` / `any` / `as any`, no `--no-verify`.
- `.planning/REQUIREMENTS.md` §Asset Ingestion and Thumbnails (ASSET-01..10) — authoritative scope list.
- `.planning/ROADMAP.md` §Phase 2 Success Criteria — what must be TRUE at phase exit.
- `temp/plans/moshpit_prd.md` §5.5, §5.7, §7.3, §8.3, §8.4, §8.6, §9 — processing step UX, thumbnail pipeline, IndexedDB persistence, performance budget, open questions (chaos style is locked here by D-01..D-04).

### Phase 1 carry-forward

- `.planning/phases/01-workspace-shell-canvas-navigation/01-CONTEXT.md` — decisions D-01..D-12 on workspace shell, Settings panel mount point, Moshpit platform-layer domain.
- `.planning/phases/01-workspace-shell-canvas-navigation/01-VERIFICATION.md` — what actually landed in Phase 1, including the pixi-viewport equivalence story (D-07 addendum).

### Codebase maps

- `.planning/codebase/STRUCTURE.md` — layer rules (`base → platform → workbench → renderer`); Moshpit lives at `src/platform/moshpit/`.
- `.planning/codebase/ARCHITECTURE.md` — Pinia setup-API store pattern, composable conventions, service patterns.
- `.planning/codebase/CONVENTIONS.md` — Vue 3.5 destructured props, Tailwind semantic tokens, no `dark:`, `cn()`.
- `.planning/codebase/INTEGRATIONS.md` — existing service wiring patterns (ComfyUI API, assets, etc.).

### Existing code to extend / consume

- `src/stores/assetsStore.ts` — `outputJobAssets` feed (line ~170); source of the `AssetItem[]` stream Phase 2 consumes.
- `src/platform/assets/schemas/assetSchema.ts` — `AssetItem` Zod schema; `asset_hash`, `preview_url`, `thumbnail_url`, `user_metadata`, `tags` fields.
- `src/platform/assets/composables/media/assetMappers.ts` — `mapTaskOutputToAssetItem`, `mapInputFileToAssetItem`; generated outputs are tagged `['output']`.
- `src/scripts/metadata/png.ts` — `getFromPngBuffer(buffer: ArrayBuffer)` and `getFromPngFile(file: File)`; parses tEXt / comf / iTXt chunks. Moshpit calls `getFromPngBuffer` from the worker on the fetched full-res buffer.
- `src/base/common/async.ts` — `runWhenGlobalIdle(callback, timeout?)` for idle-scheduling worker dispatch.
- `src/platform/assets/services/assetUrlUtil.ts` — `getAssetUrl(asset)`; unified cloud/OSS URL resolution for fetching full-res bytes.
- `src/platform/moshpit/stores/moshpitViewportStore.ts` — Phase 1 viewport/pan/zoom state; Phase 2 does not mutate this but needs it for layout math and `F` fit-view.
- `src/platform/moshpit/stores/moshpitSelectionStore.ts` — Phase 1 selection set; Phase 2 sprite click-test must integrate.
- `src/platform/moshpit/components/MoshpitCanvas.vue` — PixiJS `Application` + `Viewport` mount point; Phase 2 adds the sprite container and batched sprite updates here.
- `src/platform/moshpit/components/MoshpitSettingsPanel.vue` — empty scaffold; Phase 2 adds the "N excluded: no metadata" row.
- `src/components/toast/ProgressToastItem.vue` — existing progress visual; reference for pill styling, probably NOT reused directly (indicator is not a queue job).

### External library docs (fetch via Context7 when planning)

- `pixi.js` v8 — sprite batching, texture lifecycle, mipmap LOD.
- `pixi-viewport` — viewport-plugin integration (Phase 1 already set up).
- `idb` — promise wrapper for IndexedDB (recommended library choice).
- `Web Crypto` / `SubtleCrypto.digest` — SHA-256 client-side content hashing inside a Web Worker.
- `OffscreenCanvas` + `createImageBitmap` + `canvas.convertToBlob({ type: 'image/webp' })` — Web Worker encode path.

### Guidance docs

- `docs/guidance/typescript.md` — no `any`, no `as any`, type assertion hierarchy.
- `docs/guidance/vue-components.md` — Vue 3.5 destructured props, `<script setup>`.
- `docs/guidance/design-standards.md` — check Comfy Design Standards Figma before implementing indicator chrome (bottom-left pill needs design tokens).

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`AssetItem` Zod schema (`src/platform/assets/schemas/assetSchema.ts`)** — includes `asset_hash` (server-side), `preview_url`, `thumbnail_url`. Phase 2 consumes this as the worker's input tuple. Server `asset_hash` is trusted on the cloud path as a fast-skip; OSS computes client-side SHA-256.
- **`getFromPngBuffer` (`src/scripts/metadata/png.ts`)** — already handles zlib-compressed iTXt chunks. Phase 2 calls it inside the worker on the fetched full-res `ArrayBuffer`.
- **`runWhenGlobalIdle` (`src/base/common/async.ts`)** — base-layer primitive; safely reachable from `src/platform/moshpit/`. Drives the main-thread dispatcher that feeds the worker.
- **`getAssetUrl` (`src/platform/assets/services/assetUrlUtil.ts`)** — single resolver for cloud vs OSS; Phase 2 calls `fetch(getAssetUrl(asset))` from the worker.
- **`ProgressToastItem` (`src/components/toast/ProgressToastItem.vue`)** — visual reference only; the indicator is a canvas-overlay pill, not a toast. Do not shoe-horn.

### Established Patterns

- **Pinia setup-API stores** — `defineStore('name', () => { ... })`; private refs returned as public surface. Moshpit Phase 2 stores follow this.
- **Platform-layer domains** — `src/platform/moshpit/{stores,composables,components,services}` already exists from Phase 1. Phase 2 adds `services/` (worker bridge, IndexedDB repository) and extends `stores/` and `components/`.
- **Worker integration via Vite** — no precedent in this repo. New pattern: `?worker` query imports (`import ThumbWorker from './thumbWorker.ts?worker'`) and strongly-typed message contracts via a `ThumbWorkerMessage` discriminated union on both sides.
- **Tailwind 4 semantic tokens** — indicator pill chrome uses the same semantic tokens the rest of Moshpit uses; no `dark:`, no `:class="[]"`, no `!important`.
- **vue-i18n** — indicator strings (`Processing {done} / {total}`, `{count} excluded: no metadata`, cancel tooltip) land in `src/locales/en/main.json` under the `moshpit.assets.*` namespace with ICU placeholders.

### Integration Points

- **`src/platform/moshpit/components/MoshpitCanvas.vue`** — add a sprite container under the `Viewport`, drive sprite create/texture-swap/destroy from the thumb-ready stream.
- **`src/platform/moshpit/components/MoshpitSettingsPanel.vue`** — add the "N excluded: no metadata" row.
- **`src/platform/moshpit/components/MoshpitLayout.vue`** (or equivalent) — mount the bottom-left indicator pill overlay.
- **`src/router.ts`** — Phase 1 already wired `/moshpit`; Phase 2 triggers asset pipeline on route enter (after initial filter is set — Phase 3 owns the gate).
- **`src/platform/moshpit/services/`** (new) — worker bridge service, IndexedDB repository, content-hash utility.

### Constraints Surfaced by the Scout

- **No IndexedDB library in the repo.** `idb` is the recommended add — planner decides.
- **No Web Worker precedent.** Phase 2 establishes the pattern; document it clearly in the plan so Phase 6+ workers (if any) can copy the shape.
- **No client-side content hashing utility.** Use Web Crypto `crypto.subtle.digest('SHA-256', buffer)`.
- **`AssetItem.asset_hash`** — cloud-populated only; OSS lane MUST compute client-side.
- **`ProgressToastItem`** is queue-job-shaped and not a drop-in for the bottom-left pill.

</code_context>

<specifics>
## Specific Ideas

- **Jittered grid as "chaos"** — user chose the algorithm that is _already compatible_ with the Phase 3 sort grid (SORT-05 grid-snapped positioning). This is deliberate: the chaos state is the same coordinate system as sorted states, differing only by the jitter-vs-zero-offset and the cell assignment function. Phase 3 sort becomes a seed-swap + re-assignment, not a coordinate-system change.
- **Filter-hash seeded determinism** — the user explicitly wanted re-entry to the same filter to land the user in the same visual arrangement, so muscle-memory spatial recognition works within a session. This rules out persisting the layout to IndexedDB (heavier) AND rules out fresh randomness (breaks memory).
- **Auto-resume on re-entry** — treat cancel as "pause and put it away"; the next visit resumes. The indicator reappears with the new remaining N/M. Don't prompt; don't require an "continue" click.
- **Bottom-left pill, not Settings panel header** — user wanted the indicator visible regardless of Settings panel state. This means the pill overlay is owned by the canvas layer, not the panel layer.

</specifics>

<deferred>
## Deferred Ideas

- **Content-hash strategy details** — user left this as Claude's discretion. Researcher investigates; planner picks; executor documents.
- **IndexedDB library choice** — same as above; `idb` recommended.
- **Worker architecture** — single worker with internal concurrency cap of 4 is the recommended default; validate at 5k.
- **Asset store shape split** — thumb vs metadata vs curation stores; confirm against Phase 5 curation mutation patterns when Phase 5 is planned.
- **IndexedDB schema** — two-store split (`thumbs`, `assetMeta`) is the recommended shape; finalize before write.
- **Filter-change-mid-processing** — PRD §7.3 provides the rule; planner sequences without a visual reset.
- **Excluded-count placement inside Settings panel** — static row under filter chips area; confirm in UI-phase pass if Phase 2 gets one.
- **Indicator fade-out on completion** — 600ms hold at 100% + 200ms fade is the recommended polish; low-priority if it lands as an instant hide.
- **Sprite lifecycle on cold load** — no placeholder card (PRD §7.3); sprite appears only when thumb is ready, grid slot is reserved either way.
- **Thumbnail aspect-ratio handling** — 512px is the _max_ dimension; sprites keep their aspect ratio, so the jittered-grid cell size accommodates the longer dimension. Planner locks cell-size math.
- **Cross-reload layout persistence to IndexedDB** — deferred from Phase 1 (01-CONTEXT D-03); the filter-hash seeding approach (D-02 here) arguably _satisfies_ the intent without needing disk persistence. Revisit if users report a mismatch.
- **Figma design reference check** — no Moshpit-specific Figma node was referenced during discussion. Before implementing the pill chrome, check Comfy Design Standards for any Moshpit indicator tokens.
- **Reviewed Todos (not folded)** — none; no pending todos matched Phase 2 scope.

</deferred>

---

_Phase: 02-asset-pipeline_
_Context gathered: 2026-04-20_
