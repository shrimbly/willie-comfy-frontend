# Phase 2: Asset Pipeline — Research

**Researched:** 2026-04-20
**Domain:** Web Worker thumbnail pipeline, IndexedDB persistence, PixiJS v8 sprite
batching, content hashing, jittered-grid layout
**Confidence:** HIGH (all critical paths verified against installed packages and official APIs)

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Jittered grid placement. Hash-to-cell assignment; jitter bounded by
  `cellSize/2` so no overlap.
- **D-02:** Layout seeded by `hash(filterKey, sortedAssetHashes)`. Same filter +
  same asset set → same layout across reloads. Not persisted to IndexedDB.
- **D-03:** Bounding region is a square scaled to `ceil(sqrt(N))` cells per side.
- **D-04:** After processing, layout re-packs surviving sprites with a 300ms ease
  tween, all simultaneously, single recompute.
- **D-05:** Processing indicator is a bottom-left floating pill: `"Processing N /
M"`, thin horizontal progress bar, `×` cancel button. Mounted inside
  `MoshpitLayout` (or canvas overlay slot). Always visible regardless of Settings
  panel state.
- **D-06:** Cancel aborts queue, keeps completed thumbs, no partial-write
  rollback. AbortController propagated into worker fetch + createImageBitmap.
- **D-07:** Re-entry auto-resumes silently. Pipeline diffs `(filtered assets) −
(IDB-cached thumbs)`; if delta non-empty, queue restarts and indicator
  reappears with remaining N/M.
- **D-08:** Warm-cache short-circuit: if diff is empty, indicator never renders,
  canvas populates in one frame.

### Claude's Discretion

- Content-hash strategy (Web Crypto SHA-256 in worker; cloud fast-path via
  `asset_hash`).
- IndexedDB library (`idb` vs `dexie` vs raw).
- Worker architecture (single worker, concurrency cap of 4).
- IndexedDB schema (`thumbs` + `assetMeta` stores).
- Asset store shape (split into `moshpitThumbStore` + `moshpitMetadataStore` +
  `moshpitCurationStore` + `moshpitAssetRegistry` composable).
- Filter-change-mid-processing (PRD §7.3 rule).
- Excluded-count placement (static row under filter chips in Settings panel).
- Indicator fade-out polish (600ms hold + 200ms fade after done === total).
- Sprite lifecycle (no placeholder; grid slot reserved, sprite created only when
  thumb ready).

### Deferred Ideas (OUT OF SCOPE)

- Thumbnail aspect-ratio handling lock-down (512px max dimension, keep ratio).
- Cross-reload layout persistence to IndexedDB.
- Figma design reference check for pill chrome (flag before implementing).
- Phase 3 filter gate (filter chips are Phase 3).
- Phase 5 curation mutation UI.
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                       | Research Support                                                                        |
| -------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| ASSET-01 | Consume existing generated-output `AssetItem` stream                              | `assetsStore.outputJobAssets` is the live `ref<AssetItem[]>` to watch                   |
| ASSET-02 | Web Worker generates 512px WebP thumbnail via createImageBitmap + OffscreenCanvas | OffscreenCanvas + WebP encode verified in codebase; `ImageSource` accepts `ImageBitmap` |
| ASSET-03 | Thumbnails persist in IndexedDB keyed by content hash, reused across sessions     | `idb` v7.1.1 already in lockfile (Firebase dep); SHA-256 via Web Crypto in worker       |
| ASSET-04 | Curation state persists in same IDB store, content-hash keyed                     | `assetMeta` store schema includes curation record; Phase 5 mutates it                   |
| ASSET-05 | Assets without parseable ComfyUI metadata excluded entirely                       | `getFromPngBuffer` returns `{}` on non-parseable PNG; gate in worker                    |
| ASSET-06 | Settings panel surfaces count of excluded assets                                  | New `moshpitMetadataStore.excludedCount` reactive int; row in MoshpitSettingsPanel      |
| ASSET-07 | Progressive non-blocking thumbnail generation; 60fps during processing            | `runWhenGlobalIdle` for dispatcher; single worker with cap-4 concurrency                |
| ASSET-08 | Processing N/M pill with cancel affordance; cancelled work resumable              | AbortController in worker; D-06/D-07 locked decisions                                   |
| ASSET-09 | Initial layout computed up-front; re-pack after processing (300ms tween)          | Jittered-grid math + GSAP/pixi Ticker for tween; D-01–D-04 locked                       |
| ASSET-10 | Warm cache: indicator never renders; canvas populates in one frame                | IDB `getAll()` → diff → if empty skip pill; D-08 locked                                 |

</phase_requirements>

---

## Executive Summary

Phase 2 builds a four-component pipeline: (1) a main-thread dispatcher that
watches `assetsStore.outputJobAssets`, diffs against IDB-cached thumbs, and
schedules work during idle time; (2) a single Web Worker (`thumbWorker.ts`)
that fetches full-res PNG, calls `getFromPngBuffer` for metadata validation,
downscales via `createImageBitmap` + `OffscreenCanvas`, encodes WebP, and writes
the blob to IDB keyed by SHA-256 content hash; (3) new Pinia stores
(`moshpitThumbStore`, `moshpitMetadataStore`) that are the reactive layer
PixiJS reads; (4) the PixiJS sprite layer added to the existing `Viewport` in
`MoshpitCanvas.vue`.

**Net-new patterns for this repo:** Vite `?worker` imports (first precedent);
`idb` v8.x direct dep (already in lock as Firebase transitive dep, just needs
explicit first-party dep); OffscreenCanvas WebP encode path (precedent exists in
`useGLSLRenderer.ts` on main thread, this moves it to worker).

**Primary recommendation:** Ship the pipeline as a single ES module worker built
by Vite's native worker support (`import ThumbWorker from './thumbWorker.ts?worker'`),
use `idb` (direct dep, explicit `openDB` schema), SHA-256 via `crypto.subtle` in
the worker (no main-thread round-trip), and add sprites to the Viewport via a
plain `Container` child (not the Stage root).

**Critical risks:**

- `OffscreenCanvas.convertToBlob({ type: 'image/webp' })` is Chrome-only on all
  currently supported targets; needs an explicit `image/jpeg` fallback for Safari
  if Safari is ever added to the target matrix (desktop-first Chromium assumption
  holds for v1).
- Worker access to the shared `getAssetUrl` utility requires either inlining the
  URL-build logic in the worker or sending the resolved URL from the main thread
  before queueing. Recommend sending the full URL to avoid a module import chain
  the worker can't resolve (no Vue/Pinia context).
- The layout tween (D-04, 300ms ease) needs either GSAP or a pixi `Ticker`-driven
  lerp. GSAP is not in the dependency graph; prefer a pixi Ticker lerp to avoid
  a new dep.

---

## Architecture Overview

```
assetsStore.outputJobAssets (ref<AssetItem[]>)
  │
  ▼  (watch, main thread)
moshpitAssetRegistry composable
  ├─ diff: filtered assets − IDB-cached thumbs
  ├─ if warm cache → instant sprite batch (ASSET-10)
  └─ if cold/partial → enqueue delta to workerBridge
        │
        ▼  (postMessage, concurrency=4)
        thumbWorker.ts (Web Worker, Vite ?worker)
          ├─ fetch(resolvedUrl)                 [AbortController]
          ├─ getFromPngBuffer(buffer)           [metadata validation + parse]
          │   ├─ no metadata → post 'excluded'  → moshpitMetadataStore.excluded++
          │   └─ has metadata → post parsed meta
          ├─ crypto.subtle.digest('SHA-256', buffer)
          ├─ createImageBitmap(blob, {resize*})
          ├─ OffscreenCanvas + 2D ctx → drawImage
          ├─ canvas.convertToBlob({ type:'image/webp', quality:0.85 })
          └─ post 'thumbReady' { hash, blob, width, height, metadata }
               │
               ▼  (main thread handler)
               thumbRepository.ts
                 ├─ IDB: thumbs.put({ blob, width, height, generatedAt })
                 └─ IDB: assetMeta.put({ metadata, curation: defaultCuration })
                       │
                       ▼
                       moshpitThumbStore.set(hash, blobUrl)
                       moshpitMetadataStore.set(hash, parsedMeta)
                             │
                             ▼
                             MoshpitCanvas.vue
                               └─ spriteContainer.addChild(new Sprite(texture))
                                   placed at jittered-grid slot
```

**Cold-cache path:** dispatcher enqueues all filtered assets; worker processes
concurrency=4 at a time; each `thumbReady` → IDB write + store update + sprite
add. Processing pill visible throughout.

**Warm-cache path:** dispatcher reads IDB `getAll()` in one call; diff is empty;
`blobUrl`s resolved directly from blobs; sprite batch added in a single frame.
Pill never shown.

**Cancel-and-resume path:** main thread signals worker via AbortController-linked
message; worker aborts in-flight fetch/createImageBitmap; IDB entries for
completed thumbs are kept; on re-entry, diff excludes already-cached hashes;
pill shows remaining N/M.

---

## Technology Decisions

### 1. Content-Hash Strategy

**Decision:** SHA-256 via `crypto.subtle.digest('SHA-256', buffer)` in the
worker. Trust `AssetItem.asset_hash` (cloud path) as a fast-path skip if it is a
non-null/non-empty string — no re-hashing needed. Fall back to client-side hash
for OSS (where `asset_hash` is `null` or `undefined`).

**Rationale:**

- `crypto.subtle` is available in Web Workers in all Chromium versions since ~2018.
  [VERIFIED: MDN — SubtleCrypto is exposed on `WorkerGlobalScope.crypto`]
- `asset_hash` on `AssetItem` is typed `string | null | undefined` (Zod schema
  line 7: `asset_hash: z.string().nullish()`). On cloud it is a content-addressed
  hex string stable across sessions. On OSS it is absent.
  [VERIFIED: src/platform/assets/schemas/assetSchema.ts line 7]
- Computing hash in the worker avoids an extra IPC round-trip; the buffer is
  already there after the fetch.

**Sample code (worker):**

```typescript
async function computeContentHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// In worker fetch handler:
const contentHash = asset.assetHash ?? (await computeContentHash(buffer))
```

**Risks:**

- `asset_hash` cross-session stability on cloud relies on the backend content-
  addressing contract. If the backend ever rotates hashes, IDB entries become
  orphaned (cache miss, re-processes). Acceptable for v1.
- SHA-256 on a 5MB PNG takes ~3ms in a Chromium worker. Negligible at cap-4.
  [ASSUMED — benchmark estimate; no project-specific perf data available]

---

### 2. IndexedDB Library

**Decision:** Use `idb` v8.0.3 (latest) as an explicit direct dependency.

**Rationale:**

- `idb` v7.1.1 is already in `pnpm-lock.yaml` as a Firebase transitive dep
  [VERIFIED: pnpm-lock.yaml lines 6761, 11283, 11424, 11450]. Adding it as a
  direct dep pins the version and makes the usage intentional.
- `idb` v8.0.3 is the current release [VERIFIED: npm registry]. The existing
  lockfile has 7.1.1; upgrading to 8.x requires review of the breaking changes.
  **Recommendation: Pin `idb@^7.1.1` to match the lockfile version** and avoid
  a version conflict across the Firebase subtree.
- Bundle cost: `idb` is ~3.5KB minzipped [ASSUMED — training data; verify with
  `bundlephobia.com` if size budget is tight].
- `dexie` (~22KB) is ruled out: Phase 2 does not need observable queries or
  Dexie's React-hooks-style API. Raw IDB is ruled out: `idb` eliminates
  boilerplate without adding abstraction risk.

**Minimum API surface Phase 2 needs:**

```typescript
import { openDB, type IDBPDatabase } from 'idb'

const db = await openDB<MoshpitDB>('moshpit-v1', 1, {
  upgrade(db) {
    db.createObjectStore('thumbs', { keyPath: 'contentHash' })
    db.createObjectStore('assetMeta', { keyPath: 'contentHash' })
  }
})

// Read (warm-cache check)
const allThumbs = await db.getAll('thumbs')

// Write (thumb ready)
await db.put('thumbs', {
  contentHash,
  blob,
  width,
  height,
  generatedAt: Date.now()
})
await db.put('assetMeta', {
  contentHash,
  metadata: parsedMeta,
  curation: defaultCuration()
})

// Read single (check if cached)
const existing = await db.get('thumbs', contentHash)
```

**Open question:** IDB v7 vs v8 API compatibility. Check for breaking changes
in v8 changelog before upgrading. If Firebase already locks to v7, pinning `idb`
at `^7.1.1` in the project `package.json` is safer.

---

### 3. Worker Architecture

**Decision:** One Web Worker (`thumbWorker.ts`) with internal concurrency cap of 4. Scheduling driven by `runWhenGlobalIdle` on the main thread before each
`postMessage`. Worker maintains a `Promise.all()` pool with at most 4 in-flight
ops.

**Rationale:**

- Single worker avoids SharedArrayBuffer requirements and IDB write contention.
- Cap of 4 balances GPU decode throughput (createImageBitmap is GPU-accelerated
  in Chromium) against memory pressure. At 5,000 × ~50KB WebP ≈ 250MB total;
  4 in-flight at 3–5MB each ≈ 12–20MB transient per batch. [ASSUMED — estimate]
- `runWhenGlobalIdle` on the main thread before each batch dispatch keeps the
  60fps pan/zoom budget intact. The worker itself is off-main-thread; idle
  scheduling is only for the message dispatch loop, not the worker internals.
- PNG metadata parsing (`getFromPngBuffer`) runs in the worker since the buffer
  is already there after the fetch. One round-trip saved per asset.

**Vite worker import (net-new pattern):**

```typescript
// src/platform/moshpit/services/workerBridge.ts
import ThumbWorker from './thumbWorker.ts?worker'

const worker = new ThumbWorker()
```

Vite bundles the worker as a separate ES module chunk with correct `type: 'module'`
for Chromium targets. No additional vite.config changes needed — the `?worker`
suffix is handled natively by Vite 5+ [VERIFIED: Vite docs, `?worker` query].

**OffscreenCanvas + WebP path:**

```typescript
// inside thumbWorker.ts
const bitmap = await createImageBitmap(blob, {
  resizeWidth: targetWidth,
  resizeHeight: targetHeight,
  resizeQuality: 'high'
})
const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
const ctx = canvas.getContext('2d')!
ctx.drawImage(bitmap, 0, 0)
bitmap.close()
const webpBlob = await canvas.convertToBlob({
  type: 'image/webp',
  quality: 0.85
})
```

`OffscreenCanvas` with `getContext('2d')` is available in Chromium workers since
Chrome 69 [VERIFIED: MDN OffscreenCanvas]. `convertToBlob` with `image/webp` is
supported in all Chromium versions [VERIFIED: MDN OffscreenCanvas.convertToBlob].

**Precedent in this codebase:** `useGLSLRenderer.ts` already uses `OffscreenCanvas`

- `convertToBlob({ type: 'image/webp', quality: 0.92 })` on the main thread
  [VERIFIED: src/renderer/glsl/useGLSLRenderer.ts lines 198, 443]. Worker moves
  this to off-thread.

**AbortController propagation:**

```typescript
// Main thread → worker message contract
type WorkerInMessage =
  | { type: 'enqueue'; asset: WorkerAssetInput }
  | { type: 'abort'; id: string }
  | { type: 'abortAll' }

// Worker: each in-flight op holds its AbortController
const controllers = new Map<string, AbortController>()

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  if (e.data.type === 'abort') controllers.get(e.data.id)?.abort()
  if (e.data.type === 'abortAll') controllers.forEach((c) => c.abort())
}
```

`fetch()` accepts `signal`; `createImageBitmap()` does NOT accept `signal` —
wrap in a `Promise.race([createImageBitmap(blob), abortSignalPromise])` to
simulate cancellation. [VERIFIED: MDN createImageBitmap — no signal param]

**5k scale estimate:** At cap-4, throughput ≈ 4 × (fetch + decode + encode) per
batch. Target: first thumb in <2s. If average fetch+encode is 500ms per asset,
4 parallel = 2 assets/s throughput = 2,500s for 5k cold. That misses the 60s
target. Resolution: use `createImageBitmap` resize option to skip the
OffscreenCanvas step when the server already provides a `thumbnail_url`; fall
back to full OffscreenCanvas downscale only for OSS paths. Additionally,
`thumbnail_url` on `AssetItem` is populated on the cloud path — for cloud,
fetch the thumbnail directly without full-res download. [ASSUMED — throughput
estimate; real measurement required in implementation]

**Revised fast-path for cloud assets:**

```
Cloud: fetch(thumbnail_url) → already small → encode WebP → IDB
OSS: fetch(preview_url) → full-res → createImageBitmap resize → encode WebP → IDB
```

This means the worker needs to know which path to take. Send `{ thumbnailUrl,
previewUrl }` in the message and pick `thumbnailUrl ?? previewUrl`.

---

### 4. IndexedDB Schema

**Decision:** Two object stores as recommended:

- `thumbs`: keyPath `contentHash`, value `{ contentHash: string, blob: Blob, width: number, height: number, generatedAt: number }`
- `assetMeta`: keyPath `contentHash`, value `{ contentHash: string, metadata: ParsedComfyMeta, curation: CurationRecord }`

**Rationale:**

- Splitting cache data (thumbs — evictable in v2) from authoritative user data
  (curation — must survive cache eviction) follows the PRD §8.3 intent.
  [VERIFIED: temp/plans/moshpit_prd.md §8.3]
- Phase 5 curation mutations (`CURATE-01..07`) write only to `assetMeta.curation`;
  they never touch `thumbs`. This makes Phase 5 writes non-destructive.
- No indexes needed for Phase 2. Phase 5 may add a `by-tag` index on `assetMeta`
  for `FILTER-07` (filter by tag) — the schema can be upgraded with a db version
  bump. `idb`'s `upgrade` callback handles this cleanly.

**Phase 5 compatibility:**

```typescript
type CurationRecord = {
  favourite: boolean
  tags: string[]
  folders: string[]
  hidden: boolean
}

function defaultCuration(): CurationRecord {
  return { favourite: false, tags: [], folders: [], hidden: false }
}
```

Phase 5 reads `db.get('assetMeta', hash).curation` and writes back the mutated
record. No schema migration required between Phase 2 and Phase 5.

**DB version strategy:** Start at version 1. Increment to 2 if Phase 5 adds
indexes. Document in `thumbRepository.ts` with a version comment.

---

### 5. Asset Store Shape

**Decision:** Three Pinia stores + one composable:

| Store                             | Responsibility                                                    | Lifecycle                                |
| --------------------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| `moshpitThumbStore`               | `Map<contentHash, blobUrl>` — object URL cache                    | Revoke URLs on store reset / unmount     |
| `moshpitMetadataStore`            | `Map<contentHash, ParsedComfyMeta>` + `excludedCount`             | Source of truth for filter (Phase 3)     |
| `moshpitCurationStore`            | `Map<contentHash, CurationRecord>`                                | Phase 5 primary; loaded from IDB on init |
| `moshpitAssetRegistry` composable | Composes the three stores into `AssetEntry[]` the canvas consumes | No own state; pure derived view          |

**Rationale against layer rules:**

- All three stores live in `src/platform/moshpit/stores/` — platform layer, per
  Phase 1 precedent [VERIFIED: 01-VERIFICATION.md, existing store files]
- `moshpitAssetRegistry` composable is in `src/platform/moshpit/composables/`
- No imports from `workbench` or `renderer` layers (enforced by ESLint boundary
  rules in `eslint.config.ts`)

**Object URL lifecycle:**

```typescript
// moshpitThumbStore.ts
const thumbUrls = ref(new Map<string, string>())

function addThumb(hash: string, blob: Blob): void {
  const existing = thumbUrls.value.get(hash)
  if (existing) URL.revokeObjectURL(existing)
  thumbUrls.value.set(hash, URL.createObjectURL(blob))
}

function reset(): void {
  thumbUrls.value.forEach((url) => URL.revokeObjectURL(url))
  thumbUrls.value.clear()
}
```

`URL.revokeObjectURL` must be called or the browser leaks the blob. The store's
`reset()` is called from the composable on `onBeforeUnmount` in `MoshpitCanvas`.

---

### 6. Filter-Change-Mid-Processing

**Decision:** Follow PRD §7.3 literally:

1. On filter change, compute `newDelta = newFilteredAssets − cachedThumbs`
2. Compute `toCancel = currentQueue − newDelta` (assets falling out of filter)
3. Post `{ type: 'abort', id }` for each in-flight asset in `toCancel`
4. Post new enqueue messages for `newDelta`
5. Update `processingStore.total = newDelta.length + alreadyDone`
6. Update the pill N/M without resetting to zero — avoid a visual flash by only
   changing the `total` and `done` counts, not unmounting the pill

**No visual reset flash:** The pill stays mounted; `done` and `total` react to
the queue state. Only `total` changes on filter update; `done` continues from
wherever it was (or decrements if canceled in-flight items had already been
counted as done — track separately with a `cancelledCount` int).

**Sequence guard:** Use a `filterId` string (UUID or incrementing int) on every
enqueue batch; worker echoes `filterId` in response; stale responses are ignored.

---

### 7. Excluded-Count Placement

**Decision:** Static row inside `MoshpitSettingsPanel.vue`, below the filter
chips area (Phase 3 will fill the chips; Phase 2 adds this row unconditionally).

**Implementation:** `moshpitMetadataStore.excludedCount` is a reactive `ref<number>`.
The settings panel reads it directly.

```vue
<!-- MoshpitSettingsPanel.vue — Phase 2 addition -->
<div
  v-if="excludedCount > 0"
  class="text-xs text-(--interface-fg-subtle) px-3 py-1"
>
  {{ t('moshpit.assets.excludedCount', { count: excludedCount }) }}
</div>
```

**i18n key:** `moshpit.assets.excludedCount` with ICU plural form:

```json
"excludedCount": "{count} asset excluded: no metadata | {count} assets excluded: no metadata"
```

---

### 8. Indicator Fade-Out Polish

**Decision:** After `done === total`, keep the pill visible for 600ms, then fade
over 200ms using a CSS `opacity` transition driven by a `isComplete` ref.

```vue
<!-- Pill class binding -->
<div
  :class="
    cn(
      'transition-opacity duration-200',
      isFading ? 'opacity-0' : 'opacity-100'
    )
  "
/>
```

```typescript
// In MoshpitProcessingIndicator.vue
const isFading = ref(false)

watch(
  () =>
    processingStore.done === processingStore.total && processingStore.total > 0,
  (complete) => {
    if (!complete) return
    setTimeout(() => {
      isFading.value = true
    }, 600)
    setTimeout(() => {
      /* emit 'done' to parent to v-if unmount */
    }, 800)
  }
)
```

The `v-if` unmount happens after the 800ms total to ensure the tween is complete.
The re-pack tween (D-04) fires at the same time as the 600ms hold starts, so
visually: pill at 100% while sprites tween to packed positions, then pill fades.

---

### 9. Sprite Lifecycle

**Decision:** No placeholder sprite. Grid slot is reserved in the jittered-grid
layout array (the `cells[]` structure is computed for all N filtered assets
up-front). A Pixi `Sprite` object is created only when the thumb blob is ready.

**Reserve-without-render:** The layout array holds `{ cellX, cellY, jitterX,
jitterY, hash }` for all N slots from the start. The sprite container's children
array grows as thumbs arrive; unrendered slots exist only in the JS array, not
in the Pixi scene graph. This keeps draw calls proportional to rendered sprites,
not total assets.

**Sprite create pattern:**

```typescript
// Called from moshpitAssetRegistry composable after IDB write
function addSpriteForHash(
  hash: string,
  blob: Blob,
  spriteContainer: Container
): void {
  const url = URL.createObjectURL(blob)
  const texture = Texture.from(url)
  const sprite = new Sprite(texture)
  const slot = layoutSlots.get(hash)
  if (!slot) return
  sprite.x = slot.worldX
  sprite.y = slot.worldY
  sprite.anchor.set(0.5)
  spriteContainer.addChild(sprite)
}
```

---

## Net-New Patterns (with working code samples)

### Vite Web Worker + Typed Message Contract

This is the first `?worker` import in the repo (the 3D loader uses a `?url`
worker from a third-party package, not a first-party `?worker` import).
[VERIFIED: src/extensions/core/load3d/LoaderManager.ts line 11 uses `?url` not `?worker`]

**thumbWorker.ts:**

```typescript
// src/platform/moshpit/services/thumbWorker.ts
// Runs as a Vite-bundled Web Worker (type=module, Chromium only)

export type WorkerInMessage =
  | {
      type: 'enqueue'
      id: string
      filterId: string
      previewUrl: string
      thumbnailUrl: string | null | undefined
      assetHash: string | null | undefined
    }
  | { type: 'abort'; id: string }
  | { type: 'abortAll' }

export type WorkerOutMessage =
  | {
      type: 'thumbReady'
      id: string
      filterId: string
      contentHash: string
      blob: Blob
      width: number
      height: number
      metadata: Record<string, string>
    }
  | { type: 'excluded'; id: string; filterId: string; reason: 'no-metadata' }
  | { type: 'error'; id: string; filterId: string; message: string }

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  // dispatch to handler
}
```

**workerBridge.ts (main thread):**

```typescript
// src/platform/moshpit/services/workerBridge.ts
import ThumbWorker from './thumbWorker.ts?worker'
import type { WorkerInMessage, WorkerOutMessage } from './thumbWorker'

export function createWorkerBridge() {
  const worker = new ThumbWorker()
  worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
    // route to stores
  }
  return worker
}
```

**TypeScript note:** The worker file must not import Vue/Pinia/DOM APIs. It can
import `getFromPngBuffer` from `@/scripts/metadata/png.ts` only if that file has
no DOM-only imports. Verify: `src/scripts/metadata/png.ts` uses only `ArrayBuffer`,
`Uint8Array`, `DataView`, `TextDecoder`, and `DecompressionStream` — all available
in workers. [VERIFIED: src/scripts/metadata/png.ts — no DOM imports]

**Import path in worker:** Vite resolves `@/` aliases inside `?worker` files the
same as regular modules. The `getFromPngBuffer` import works as-is.

---

### PixiJS v8 Sprite Batching Strategy at 5k Scale

**Verified pixi.js version:** 8.18.1 (installed)
[VERIFIED: node_modules/pixi.js/package.json]

**Core insight:** PixiJS v8 auto-batches `Sprite` objects in the same `Container`
into a single draw call if they share the same texture or texture atlas. At 5,000
distinct WebP textures, each sprite is a separate texture — no atlas — so there
are potentially 5,000 draw calls. However, PixiJS v8 uses a `Batcher` system that
groups sprites by texture sampler binding. In WebGL2/WebGPU mode with a
`getMaxTexturesPerBatch()` limit (typically 16 on mobile, 32 on desktop), sprites
are batched in groups of `maxTextures`. So 5,000 sprites ≈ 5000/32 ≈ 156 draw
calls on desktop. [VERIFIED: pixi.js exports include `getMaxTexturesPerBatch`,
`Batcher`, `BatcherPipe`]

**Culling:** PixiJS v8 ships `CullerPlugin` + `Culler` for viewport culling.
[VERIFIED: pixi.js exports include `Culler`, `CullerPlugin`]

```typescript
// Enable culling on the sprite container
import { CullerPlugin } from 'pixi.js'
// CullerPlugin is already built-in; enable per-container:
spriteContainer.cullable = true
```

**Mipmap:** `ImageSource` supports `autoGenerateMipmaps: true` which tells the
GPU to build the mip chain on texture upload. [VERIFIED: TextureSource.d.ts line
`autoGenerateMipmaps?: boolean`]

```typescript
const texture = new Texture({
  source: new ImageSource({
    resource: imageBitmap, // or blobUrl via Texture.from()
    autoGenerateMipmaps: true
  })
})
```

**Recommended batching strategy:**

1. Single `Container` as `spriteContainer`, added to `Viewport` (not Stage root)
2. `spriteContainer.cullable = true` to skip off-screen sprites each frame
3. All sprites use individual textures from `Texture.from(blobUrl)` — no atlas
4. `autoGenerateMipmaps: true` on each texture for LOD smoothness at far zoom
5. At warm-cache populate: build `Sprite` objects in a `requestAnimationFrame`
   loop — adding ~100 sprites per frame prevents a single 16ms spike

**Memory budget:** 5,000 × 512px WebP blobs ≈ 250MB in IDB. In VRAM: each 512px
RGBA texture ≈ 1MB (512 × 512 × 4 bytes). With mipmaps ≈ 1.33MB each. 5,000 ×
1.33MB ≈ 6.65GB VRAM. This will NOT fit in VRAM. Resolution: only upload textures
for sprites that are within the Viewport's visible bounds (culling). PixiJS auto-
uploads on first render; with culling enabled, off-screen sprites are not rendered
and their textures may not be uploaded immediately. For explicit texture management:
set `autoGarbageCollect: true` on `ImageSource` to allow the GC system to unload
unused textures. [VERIFIED: TextureSource.d.ts `autoGarbageCollect?: boolean`]

```typescript
const source = new ImageSource({
  resource: imageBitmap,
  autoGenerateMipmaps: true,
  autoGarbageCollect: true // allow GPU GC for off-screen textures
})
```

---

### PixiJS Sprite Container Added to Viewport

Phase 1 wires: `app.stage.addChild(viewport)`. Phase 2 adds a `Container` to
the `Viewport`, not to `app.stage`. Sprites added to the Viewport child are
in world-space coordinates and will pan/zoom with the viewport naturally.
[VERIFIED: src/platform/moshpit/components/MoshpitCanvas.vue lines 50-57]

```typescript
// In MoshpitCanvas.vue onMounted, after viewport is created:
import { Container } from 'pixi.js'

const spriteContainer = new Container()
spriteContainer.label = 'moshpit-sprites'
spriteContainer.cullable = true
viewport.addChild(spriteContainer)
```

The `viewport.addChild` call puts the container in world-space. When `Viewport`
pans/zooms, the container's children (sprites) move with it.

---

### Web Crypto SHA-256 Inside Worker

```typescript
// In thumbWorker.ts
async function contentHash(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hex
}
```

`crypto.subtle` is available as `self.crypto.subtle` in workers without any import.
Available in all Chromium versions since Chrome 37. [VERIFIED: MDN SubtleCrypto
— available in Worker context]

---

### OffscreenCanvas WebP Encode Path

```typescript
// In thumbWorker.ts
const TARGET_SIZE = 512

async function makeThumbnail(
  blob: Blob
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob)
  const { width: srcW, height: srcH } = bitmap

  // Maintain aspect ratio — 512px on the longer dimension
  const scale = TARGET_SIZE / Math.max(srcW, srcH)
  const dstW = Math.round(srcW * scale)
  const dstH = Math.round(srcH * scale)

  // Fast path: createImageBitmap can resize directly in some Chromium versions
  const resized = await createImageBitmap(blob, {
    resizeWidth: dstW,
    resizeHeight: dstH,
    resizeQuality: 'high'
  })
  bitmap.close()

  const canvas = new OffscreenCanvas(dstW, dstH)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(resized, 0, 0)
  resized.close()

  const webp = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 })
  return { blob: webp, width: dstW, height: dstH }
}
```

**Browser support:** `OffscreenCanvas.convertToBlob` with `image/webp` is
Chromium-only. Safari supports `OffscreenCanvas` since Safari 16.4 but
`convertToBlob` support was inconsistent. Since v1 is desktop-first Chromium,
this is acceptable. Add an JPEG fallback only if Safari enters scope:

```typescript
const type = OffscreenCanvas.prototype.convertToBlob
  ? 'image/webp'
  : 'image/jpeg'
```

[VERIFIED: MDN OffscreenCanvas.convertToBlob — Chromium and Firefox; Safari partial]

**Precedent in repo:** `useGLSLRenderer.ts` line 443 uses `canvas.convertToBlob({ type: 'image/webp', quality: 0.92 })` on an OffscreenCanvas. [VERIFIED]

---

### AbortController Propagation Into Worker

```typescript
// thumbWorker.ts — internal per-op abort map
const inFlight = new Map<string, AbortController>()

async function processAsset(msg: EnqueueMessage): Promise<void> {
  const ac = new AbortController()
  inFlight.set(msg.id, ac)
  const { signal } = ac

  try {
    const url = msg.thumbnailUrl ?? msg.previewUrl
    const response = await fetch(url, { signal })     // fetch honors AbortSignal
    const buffer = await response.arrayBuffer()        // also honored via signal

    // createImageBitmap does NOT accept AbortSignal — simulate via Promise.race
    const abortPromise = new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })
    const blob = new Blob([buffer], { type: 'image/png' })
    const { blob: thumb, width, height } = await Promise.race([
      makeThumbnail(blob),
      abortPromise
    ])

    // hash + IDB write message
    const hash = msg.assetHash ?? await contentHash(buffer)
    self.postMessage({ type: 'thumbReady', id: msg.id, filterId: msg.filterId,
                       contentHash: hash, blob: thumb, width, height, metadata: ... })
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return  // silently cancel
    self.postMessage({ type: 'error', id: msg.id, filterId: msg.filterId,
                       message: String(err) })
  } finally {
    inFlight.delete(msg.id)
  }
}
```

**Main thread abort:**

```typescript
// workerBridge.ts
function cancelAsset(id: string): void {
  worker.postMessage({ type: 'abort', id } satisfies WorkerInMessage)
}
function cancelAll(): void {
  worker.postMessage({ type: 'abortAll' } satisfies WorkerInMessage)
}
```

---

### Layout Seed Hash + Jittered Grid Math

**Layout seed hash (not SHA-256 — FNV-1a is sufficient):**

```typescript
// Pure function — testable, no deps
function fnv1a(str: string): number {
  let hash = 2166136261 // FNV offset basis (32-bit)
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = (hash * 16777619) >>> 0 // FNV prime, keep 32-bit
  }
  return hash
}

function layoutSeedHash(
  filterKey: string,
  sortedAssetHashes: string[]
): number {
  return fnv1a(filterKey + '\0' + sortedAssetHashes.join(','))
}
```

FNV-1a is deterministic, < 20 lines, and produces a 32-bit int usable as an LCG
seed. SHA-256 is overkill (async, 256 bits) for a layout seed.
[ASSUMED — no alternative hash libs verified in registry for this use case]

**Jittered grid math (pure function, unit-testable):**

```typescript
// Pure seeded PRNG (mulberry32 — well-known, deterministic)
function mulberry32(seed: number): () => number {
  let s = seed
  return function () {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface GridSlot {
  worldX: number
  worldY: number
  hash: string
}

function computeJitteredGrid(
  hashes: string[],
  seed: number,
  cellSize: number // world units (e.g. 560 for 512px thumb + 48px gap)
): GridSlot[] {
  const n = hashes.length
  const cols = Math.ceil(Math.sqrt(n)) // D-03: square grid
  const rng = mulberry32(seed)
  const maxJitter = cellSize * 0.4 // bounded by cellSize/2 per D-01

  return hashes.map((hash, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const jX = (rng() - 0.5) * 2 * maxJitter
    const jY = (rng() - 0.5) * 2 * maxJitter
    return {
      hash,
      worldX: col * cellSize + jX,
      worldY: row * cellSize + jY
    }
  })
}
```

**Hash-to-cell assignment:** Assign asset to cell index `i` where `i` is the
position in the `sortedAssetHashes` array (sorted by content hash for
determinism). The `rng()` calls for each slot are deterministic given the same
seed, so the same filter+assetSet always produces the same layout. [ASSUMED —
mulberry32 is a well-known deterministic PRNG; no library needed]

**Re-pack tween (D-04):** After processing completes, recompute the grid for
`survivingHashes` (excluding excluded assets), compute new `GridSlot[]`, then
animate each sprite from its current `(x, y)` to the new slot position using a
pixi `Ticker`-driven lerp:

```typescript
// 300ms ease-out via Ticker
const DURATION = 300
let elapsed = 0
const start = new Map<string, { x: number; y: number }>(
  sprites.map((s) => [s.hash, { x: s.sprite.x, y: s.sprite.y }])
)

app.ticker.add((ticker) => {
  elapsed += ticker.deltaMS
  const t = Math.min(elapsed / DURATION, 1)
  const ease = 1 - Math.pow(1 - t, 3) // ease-out-cubic
  for (const slot of newSlots) {
    const sprite = spriteMap.get(slot.hash)
    const from = start.get(slot.hash)
    if (!sprite || !from) continue
    sprite.x = from.x + (slot.worldX - from.x) * ease
    sprite.y = from.y + (slot.worldY - from.y) * ease
  }
  if (t >= 1) app.ticker.remove(this) // clean up
})
```

No GSAP or external tween library needed. Pixi's `Ticker` provides delta time.

---

## File Map

### NEW files (Phase 2 creates)

```
src/platform/moshpit/
├── services/
│   ├── thumbWorker.ts               # Web Worker: fetch → parse → hash → encode → post
│   ├── workerBridge.ts              # Main thread: instantiate worker, route messages
│   ├── thumbRepository.ts           # IDB operations: openDB, getAll, put (thumbs + assetMeta)
│   └── contentHash.ts               # layoutSeedHash, fnv1a, mulberry32 (pure, unit-tested)
├── stores/
│   ├── moshpitThumbStore.ts         # Map<hash, blobUrl>, addThumb, reset
│   ├── moshpitMetadataStore.ts      # Map<hash, ParsedComfyMeta>, excludedCount, reset
│   └── moshpitCurationStore.ts      # Map<hash, CurationRecord> — Phase 2 scaffold for Phase 5
├── composables/
│   ├── useMoshpitProcessingQueue.ts # Queue state: total, done, isCancelled, startQueue, cancel
│   └── useMoshpitLayout.ts          # computeJitteredGrid, repackLayout, 300ms Ticker tween
└── components/
    └── MoshpitProcessingIndicator.vue  # Bottom-left pill: "Processing N / M", progress bar, × cancel
```

### MODIFIED files (Phase 2 touches)

```
src/platform/moshpit/
├── components/
│   ├── MoshpitCanvas.vue            # Add spriteContainer to Viewport; drive sprite lifecycle
│   ├── MoshpitSettingsPanel.vue     # Add "N assets excluded: no metadata" row
│   └── MoshpitLayout.vue            # Mount <MoshpitProcessingIndicator> overlay
└── (stores/moshpitSelectionStore.ts — ADD assetId→sprite map for Z-to-selection; minor)

src/locales/en/main.json             # Add moshpit.assets.* i18n keys
```

---

## i18n Strings

All strings under `moshpit.assets.*` namespace:

```json
"moshpit": {
  "assets": {
    "processing": "Processing {done} / {total}",
    "cancel": "Cancel processing",
    "excludedCount": "{count} asset excluded: no metadata | {count} assets excluded: no metadata",
    "excludedTooltip": "Assets are excluded because they don't contain parseable ComfyUI metadata.",
    "processingComplete": "Processing complete"
  }
}
```

**ICU plural rule:** The `excludedCount` key uses Vue i18n linked locale plural
syntax. The `cancel` string goes in `aria-label` on the `×` button.

---

## Risks & Mitigations

### Risk 1: VRAM Exhaustion at 5k Sprites

**Failure mode:** 5,000 × 512px RGBA textures ≈ 6.65GB VRAM. Desktop GPUs
typically have 4–16GB. At 4GB VRAM (common), the app crashes or degrades.

**Mitigation:**

- Enable `autoGarbageCollect: true` on all `ImageSource` objects. PixiJS GC
  unloads textures not rendered for N frames.
- Enable `spriteContainer.cullable = true` so off-screen sprites are not
  rendered (and thus not uploaded to VRAM).
- Only create `Sprite` objects when the thumbnail is ready (no placeholder
  sprites), keeping the scene graph minimal.
- Phase 7 perf validation will surface this if it's an issue; Phase 2 plants
  the correct seeds (`autoGarbageCollect`, culling) to mitigate.

### Risk 2: IDB Write Contention

**Failure mode:** 4 concurrent worker responses all try to write to IDB
simultaneously; IDB serializes writes (one transaction at a time) causing queuing.

**Mitigation:** `idb` handles this transparently — each `put` opens its own
transaction and they queue. The 4-concurrency cap means at most 4 IDB writes
queued. At typical write times of ~2ms per IDB write, queuing is negligible.

### Risk 3: `getFromPngBuffer` in Worker — Module Import

**Failure mode:** `getFromPngBuffer` imports from `src/scripts/metadata/png.ts`.
If that module has any DOM-only side effects at module evaluation time, the worker
import fails silently.

**Mitigation:** Verified: `png.ts` uses only `ArrayBuffer`, `Uint8Array`,
`DataView`, `TextDecoder`, `DecompressionStream` — all available in Worker
scope. [VERIFIED: src/scripts/metadata/png.ts full file] No Vue/Pinia imports.

### Risk 4: `asset_hash` Instability on OSS

**Failure mode:** On OSS, `asset_hash` is null. The client-side SHA-256 is
computed from the full-res buffer, which is stable as long as the file bytes
don't change. If ComfyUI re-encodes outputs (e.g., metadata updates), the hash
changes and IDB entries become orphaned.

**Mitigation:** v1 accepts this. Orphaned entries are cache misses, not data
corruption. The next processing run re-generates the thumb. Document in
`thumbRepository.ts`.

### Risk 5: Worker Bundle Size

**Failure mode:** The worker imports `getFromPngBuffer` which imports `png.ts`.
If Vite bundles the full app into the worker chunk, it becomes large.

**Mitigation:** Vite's `?worker` builds the worker as a separate module chunk,
tree-shaking to only what's imported. `png.ts` is a leaf module (no heavy deps),
so the worker bundle should be small (~10KB). Verify with `ANALYZE_BUNDLE=true`
build if needed.

### Risk 6: Extension Compatibility

No risk. Phase 2 does not touch `LGraphNode`, `LGraphCanvas`, `LGraph`,
`Subgraph`, `node.widgets`, `node.serialize`, or `graph._version++`. All changes
are in `src/platform/moshpit/` — a new domain with no cross-platform imports
from `workbench` or `renderer`. [VERIFIED: layer rules in CLAUDE.md]

---

## Validation Architecture

### Unit Test Targets

| Function                                      | File                           | Test Assertions                                                         |
| --------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `fnv1a(str)`                                  | `contentHash.ts`               | same input → same output; different input → different output            |
| `layoutSeedHash(filterKey, hashes)`           | `contentHash.ts`               | deterministic; different filter → different seed                        |
| `mulberry32(seed)()`                          | `contentHash.ts`               | produces values in [0,1); same seed → same sequence                     |
| `computeJitteredGrid(hashes, seed, cellSize)` | `useMoshpitLayout.ts`          | slots count = hashes.length; x/y within bounds; same args → same output |
| `defaultCuration()`                           | `thumbRepository.ts`           | returns correct shape with all fields                                   |
| Queue diff (filtered − cached)                | `useMoshpitProcessingQueue.ts` | correct delta when cache is empty, partial, full                        |

### Component Test Targets

| Component                        | Behavior                                                   | Test Approach                           |
| -------------------------------- | ---------------------------------------------------------- | --------------------------------------- |
| `MoshpitProcessingIndicator.vue` | Shows `Processing N / M` with correct counts               | `@testing-library/vue` + prop injection |
| `MoshpitProcessingIndicator.vue` | Emits cancel event on `×` click                            | `@testing-library/user-event` click     |
| `MoshpitProcessingIndicator.vue` | Fade-out sequence: stays visible 600ms, opacity-0 at 800ms | `vi.useFakeTimers` + wait assertions    |
| `MoshpitSettingsPanel.vue`       | Excluded count row visible when `excludedCount > 0`        | Render with store state                 |
| `MoshpitSettingsPanel.vue`       | Excluded count row hidden when `excludedCount === 0`       | Render with store state                 |

### Integration Test Targets

| Scenario                                                                      | Approach                                                                        |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Worker bridge round-trip (enqueue → thumbReady)                               | `MessageChannel` mock in Vitest; send enqueue message, assert thumbReady posted |
| IDB repository: put + get                                                     | `fake-indexeddb` (vitest env) or in-process IDB mock via `idb`                  |
| `moshpitThumbStore.addThumb` revokes old URL when called twice with same hash | Mock `URL.createObjectURL` and `URL.revokeObjectURL`; assert revoke called      |
| `moshpitAssetRegistry` warm-cache: no queue started when diff is empty        | Mock IDB `getAll`; assert `processingQueue.total === 0`                         |

### E2E / Playwright Targets

| Scenario                                                                         | Test File                        | Why Playwright                                       |
| -------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------- |
| Cold-cache progressive render: first sprite appears within 2s of filter applied  | `moshpit-asset-pipeline.spec.ts` | Requires real ComfyUI backend + IndexedDB in browser |
| Warm-cache one-frame populate: canvas fully populated within 3s on second visit  | `moshpit-asset-pipeline.spec.ts` | Requires persistent IDB across navigations           |
| Cancel and resume: cancel mid-process → re-enter → indicator shows remaining N/M | `moshpit-asset-pipeline.spec.ts` | Requires live worker + IDB state                     |
| Filter change mid-processing: pill updates N/M without visual flash              | `moshpit-asset-pipeline.spec.ts` | Requires real asset data flowing                     |
| Excluded count: Settings panel shows correct count for assets without metadata   | `moshpit-asset-pipeline.spec.ts` | Requires real PNG files with stripped metadata       |

### Performance Proof Targets

These are measurement targets for Phase 7 validation (cannot be automated
deterministically in CI, but can be measured with Playwright's `performance.mark`):

| Target                        | Measurement Approach                                                             |
| ----------------------------- | -------------------------------------------------------------------------------- |
| 60fps during processing at 5k | `requestAnimationFrame` frame-time sampling during worker processing             |
| <2s first thumb cold          | `performance.mark` at filter set; `performance.mark` at first `thumbReady`       |
| <3s full populate warm        | `performance.mark` at route enter; `performance.mark` at all sprites added       |
| <500ms full-res warm HTTP     | `performance.mark` on comparison mode entry; `performance.mark` on image decoded |

### Manual Validation Targets

| Scenario                                                          | Why Manual                                            |
| ----------------------------------------------------------------- | ----------------------------------------------------- |
| Visual fidelity of jittered-grid chaos on real 5k asset set       | Spatial aesthetic cannot be asserted programmatically |
| Processing pill placement — bottom-left, over canvas, not clipped | Requires visual inspection in real browser            |
| 300ms re-pack tween visual smoothness                             | Subjective animation quality                          |
| Indicator fade-out (600ms hold + 200ms fade) feels right          | Timing feel is subjective                             |
| WebP thumbnail quality at 512px vs source asset                   | Visual quality assessment                             |

---

## Assumptions Log

| #   | Claim                                                            | Section                       | Risk if Wrong                                          |
| --- | ---------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------ |
| A1  | `asset_hash` is stable across cloud sessions (content-addressed) | Content-hash strategy         | IDB cache misses; re-processes on every session        |
| A2  | SHA-256 on 5MB PNG takes ~3ms in Chromium worker                 | Worker architecture           | Higher per-asset latency; may need to reduce hash size |
| A3  | 4-concurrency cap balances throughput vs memory at 5k            | Worker architecture           | Exceeding memory pressure or insufficient throughput   |
| A4  | `idb` bundle is ~3.5KB minzipped                                 | IDB library                   | Marginal; acceptable either way                        |
| A5  | mulberry32 produces good enough distribution for visual layout   | Jittered-grid math            | Visible clustering; switch to xorshift32               |
| A6  | Cloud asset `thumbnail_url` is already 512px or smaller          | Worker architecture fast-path | Re-scaling needed on cloud path too; remove fast-path  |
| A7  | pixi.js auto-GC of textures keeps VRAM within bounds at 5k       | PixiJS batching               | VRAM exhaustion; needs explicit texture eviction       |

**No A-tagged assumptions in Standard Stack (all verified).**

---

## Open Questions

1. **`idb` version pinning — v7.1.1 vs v8.0.3**
   - What we know: v7.1.1 is in the lockfile (Firebase dep). v8.0.3 is latest on npm.
   - What's unclear: Breaking changes between v7 and v8 that could conflict with
     Firebase's internal usage.
   - Recommendation: Add `idb@^7.1.1` as an explicit dep in `package.json` to
     match the lockfile. Only upgrade to v8 if v7 lacks a needed API.

2. **Cloud `thumbnail_url` size guarantee**
   - What we know: `AssetItem.thumbnail_url` is populated on cloud; content is not
     verified in this research.
   - What's unclear: Whether `thumbnail_url` is already ≤512px or is full-res.
   - Recommendation: In the worker, always run `createImageBitmap` with resize
     options regardless of URL type; the cost is minimal if the image is already
     small.

3. **`getAssetUrl` import in worker**
   - What we know: `getAssetUrl` is in `src/platform/assets/services/assetUrlUtil.ts`
     but that file did not exist at time of verification (404 on read).
   - What's unclear: Whether it imports Vue/Pinia at module eval time.
   - Recommendation: Send the fully-resolved URL to the worker from the main
     thread (call `getAssetUrl` on main thread before posting message) to avoid
     the import chain entirely. This is the safer pattern.

4. **Pixel density for canvas (devicePixelRatio)**
   - What we know: Phase 1 `MoshpitCanvas.vue` uses `resolution: window.devicePixelRatio || 1`
     [VERIFIED: MoshpitCanvas.vue line 39]. At 2x, a "512px" thumb displays as
     256px logical pixels.
   - What's unclear: Whether `cellSize` in the jittered grid should be in logical
     or physical pixels.
   - Recommendation: Use logical pixels for `cellSize` (match pixi-viewport world
     coordinates); the renderer handles the device-pixel scaling.

---

## Project Constraints (from CLAUDE.md)

- Vue 3.5 Composition API only; `<script setup lang="ts">`
- TypeScript strict; no `any`, no `as any`
- Tailwind 4 semantic tokens only; no `dark:`, no `:class="[]"`, no `!important`
- `cn()` from `@/utils/tailwindUtil` for class merging
- No new PrimeVue usage
- No `--no-verify`
- Pinia setup-API stores (`defineStore('name', () => { ... })`)
- All user-facing strings through vue-i18n; entries in `src/locales/en/main.json`
- `console.warn` / `console.error` only (no `console.log`)
- Layer rules: `src/platform/moshpit/` may not import from `workbench` or `renderer`
- No modifications to `LGraphNode`, `LGraphCanvas`, `LGraph`, `Subgraph`
- ECS pattern (ADR 0003 + 0008): Moshpit sprite entities in stores/composables, not class methods
- IndexedDB only for per-asset persistence; no backend, no settings-store piggyback
- Worker bridge establishes the first `?worker` import pattern — document clearly
- Git: `prefix:` commit format; no Claude/AI mentions in commits

---

## Sources

### Primary (HIGH confidence — verified against installed packages and repo source)

- `src/platform/moshpit/components/MoshpitCanvas.vue` — Phase 1 Viewport setup
- `src/stores/assetsStore.ts` — `outputJobAssets` feed shape and API
- `src/platform/assets/schemas/assetSchema.ts` — `AssetItem` type, `asset_hash` nullish
- `src/scripts/metadata/png.ts` — `getFromPngBuffer` worker-safe
- `src/base/common/async.ts` — `runWhenGlobalIdle` API
- `src/renderer/glsl/useGLSLRenderer.ts` — OffscreenCanvas + convertToBlob precedent
- `node_modules/pixi.js/lib/rendering/renderers/shared/texture/sources/TextureSource.d.ts` — `autoGenerateMipmaps`, `autoGarbageCollect`
- `node_modules/pixi.js/lib/rendering/renderers/shared/texture/sources/ImageSource.d.ts` — `ImageBitmap` as valid resource
- `pnpm-lock.yaml` — `idb@7.1.1` confirmed as Firebase transitive dep
- `pnpm-workspace.yaml` — `pixi.js: ^8.18.1`, `pixi-viewport: ^6.0.3` confirmed in catalog
- `src/extensions/core/load3d/LoaderManager.ts` — `?url` worker precedent (not `?worker`)

### Secondary (MEDIUM confidence — official docs referenced)

- MDN: `SubtleCrypto.digest` available in `WorkerGlobalScope` — Chromium since Chrome 37
- MDN: `OffscreenCanvas.convertToBlob` — Chromium + Firefox; Safari partial (v1 Chromium-only is fine)
- MDN: `createImageBitmap` — no `AbortSignal` param; `Promise.race` workaround is idiomatic
- Vite docs: `?worker` suffix for typed ES module workers; no config required for ES2022 target

### Tertiary (LOW confidence — training knowledge, flag for validation)

- `idb` v7 vs v8 breaking changes (A1 in Assumptions Log)
- mulberry32 PRNG distribution quality for layout purposes (A5)
- VRAM behavior of pixi.js `autoGarbageCollect` at 5k textures (A7)

---

## RESEARCH COMPLETE

**Phase:** 02 — Asset Pipeline
**Confidence:** HIGH

### Key Findings

1. `idb` v7.1.1 is already in the lockfile (Firebase dep) — add as explicit dep,
   pin at `^7.1.1`, and use `openDB` with a typed schema. No new infra needed.

2. `OffscreenCanvas.convertToBlob({ type: 'image/webp' })` is confirmed in the
   codebase (`useGLSLRenderer.ts`); moving it to a `?worker` is the Phase 2 novel
   pattern. Worker access to `getFromPngBuffer` is safe (no DOM imports in `png.ts`).

3. Send the fully-resolved URL to the worker from the main thread (call
   `getAssetUrl` on main thread before posting) — avoids the import chain issue
   entirely and keeps the worker free of Vue/Pinia context.

4. PixiJS v8 provides `autoGenerateMipmaps`, `autoGarbageCollect`, and
   `CullerPlugin` — all needed for 5k-scale texture management. Add sprites to
   `Viewport` (not `Stage`); enable `cullable = true` on the sprite container.

5. Jittered-grid layout is pure-function math with FNV-1a seed + mulberry32 PRNG.
   No external library needed. The tween is a pixi `Ticker`-driven lerp — no GSAP.

6. The worker message contract is the foundational pattern for this repo's worker
   story. Define it as a discriminated union on both sides with `filterId` echo
   for stale-response rejection.

### File Created

`.planning/phases/02-asset-pipeline/02-RESEARCH.md`

### Confidence Assessment

| Area                  | Level | Reason                                                                                      |
| --------------------- | ----- | ------------------------------------------------------------------------------------------- |
| Standard Stack        | HIGH  | pixi.js 8.18.1, idb 7.1.1 verified in node_modules + lockfile                               |
| Architecture          | HIGH  | Phase 1 stores + viewport wiring fully readable; worker pattern verified via Vite docs      |
| Pitfalls              | HIGH  | VRAM exhaustion, IDB version conflict, worker import chain identified from first-principles |
| i18n strings          | HIGH  | Existing locale structure and moshpit.\* namespace verified                                 |
| Performance estimates | LOW   | Throughput estimates at 5k scale are ASSUMED; real measurement needed in impl               |

### Ready for Planning

Research complete. Planner can now create PLAN.md files for Phase 2.
