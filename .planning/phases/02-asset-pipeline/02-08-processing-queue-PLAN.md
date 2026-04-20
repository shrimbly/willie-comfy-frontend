---
phase: 02-asset-pipeline
plan: 08
type: execute
wave: 3
depends_on: ['02-04', '02-06', '02-07']
files_modified:
  - src/platform/moshpit/composables/useMoshpitProcessingQueue.ts
  - src/platform/moshpit/composables/useMoshpitAssetRegistry.ts
autonomous: true
requirements: [ASSET-01, ASSET-03, ASSET-05, ASSET-07, ASSET-08, ASSET-10]
tags: [composable, queue, wave-3, tdd]
must_haves:
  truths:
    - '`useMoshpitProcessingQueue` is the integration point: it watches `assetsStore.outputJobAssets`, diffs against `getAllThumbHashes` (D-08 warm-cache short-circuit), enqueues the delta to the bridge, and exposes reactive `total`, `done`, `isActive`, `activeFilterId` for the pill AND for downstream consumers (sprite layer, layout)'
    - '`ProcessingQueueState` is exported as a named type so Plan 11 can accept it as a `SpriteLayerOptions.queue` parameter without instantiating a second bridge'
    - 'On `cancel()` the queue posts `cancelAll` to the bridge; completed thumbs remain in IDB per D-06; `isActive` drops to false, but re-entering the same filter later diffs again (D-07 auto-resume)'
    - 'A filter-change is signalled via `setFilter({ filterKey, assets })`: the queue cancels in-flight items not in the new set, enqueues newly-in-filter items, and updates `total` without resetting `done` to zero (RESEARCH §6)'
    - 'Warm-cache short-circuit: when the diff is empty, `total = 0`, `isActive = false`, AND the bridge is NEVER posted to (ASSET-10)'
    - 'On `thumbReady` the composable calls `moshpitThumbStore.addThumb(hash, blob)`, `moshpitMetadataStore.setMetadata(hash, meta)`, `moshpitMetadataStore.recordAssetHash(assetId, hash)` (OSS-path bridge — Plan 07 revision), `moshpitCurationStore.load(...)`, and increments `done`'
    - 'On `excluded` the composable calls `moshpitMetadataStore.incrementExcluded()` and decrements `total` so the N/M ratio reflects the surviving set'
    - '`computeQueueDelta(filtered, cachedHashes)` is a pure exported function for unit-testability (Wave-0 test hook)'
    - '`useMoshpitAssetRegistry` exposes a `computed<readonly AssetEntry[]>` — for each asset it resolves `asset_hash ?? metaStore.getHashForAssetId(id)` so the OSS path renders as soon as the worker computes a hash (ASSET-01 fix)'
    - 'The registry computed depends on `metaStore.assetIdToHash.value` so new OSS hashes trigger re-render; verified by a dedicated test case'
    - '`useMoshpitProcessingQueue.test.ts` from Plan 01 turns GREEN (at minimum the `computeQueueDelta` cases) AND the new OSS-path integration test GREEN'
  artifacts:
    - path: 'src/platform/moshpit/composables/useMoshpitProcessingQueue.ts'
      provides: 'The queue composable — diff, enqueue, cancel, filter-change; exports ProcessingQueueState type for Plan 11'
      contains: 'export function useMoshpitProcessingQueue'
    - path: 'src/platform/moshpit/composables/useMoshpitAssetRegistry.ts'
      provides: 'Computed asset registry — single read target for the canvas; honours OSS-path hash bridge'
      contains: 'export function useMoshpitAssetRegistry'
  key_links:
    - from: 'src/platform/moshpit/composables/useMoshpitProcessingQueue.ts'
      to: 'src/stores/assetsStore.ts'
      via: 'watch(assetsStore.outputJobAssets)'
      pattern: 'outputJobAssets'
    - from: 'src/platform/moshpit/composables/useMoshpitProcessingQueue.ts'
      to: 'src/platform/moshpit/services/workerBridge.ts'
      via: 'bridge.enqueue / bridge.cancelAll'
      pattern: "createWorkerBridge|bridge\\.enqueue|bridge\\.cancelAll"
    - from: 'src/platform/moshpit/composables/useMoshpitProcessingQueue.ts'
      to: 'src/platform/moshpit/stores/moshpitMetadataStore.ts'
      via: 'recordAssetHash(assetId, contentHash) on thumbReady'
      pattern: 'recordAssetHash'
    - from: 'src/platform/moshpit/composables/useMoshpitAssetRegistry.ts'
      to: 'src/platform/moshpit/stores/moshpitMetadataStore.ts'
      via: 'getHashForAssetId(asset.id) fallback when asset_hash is null'
      pattern: 'getHashForAssetId|assetIdToHash'
    - from: 'src/platform/moshpit/composables/useMoshpitProcessingQueue.ts'
      to: 'src/platform/assets/utils/assetUrlUtil.ts'
      via: 'getAssetUrl(asset) to resolve fetchUrl'
      pattern: 'getAssetUrl'
---

<objective>
Build the composable that sits between the reactive Pinia world and the worker bridge. It owns the queue state (`total`, `done`, `isActive`, `activeFilterId`), watches `assetsStore.outputJobAssets`, diffs against IDB, and routes worker callbacks into the stores from Plan 07.

Also ship `useMoshpitAssetRegistry` — a thin composable that exposes a sorted, computed `AssetEntry[]` which the PixiJS canvas (Plan 11) will iterate. Keeping it separate avoids mixing queue mechanics with render input.

**Revision note (iter 1):**

- Exported `ProcessingQueueState` type is the contract Plan 11 consumes via `SpriteLayerOptions.queue` — the sprite layer must NOT call `useMoshpitProcessingQueue()` a second time (would create a duplicate bridge whose counters are always zero).
- On `thumbReady` the queue now calls `metaStore.recordAssetHash(msg.assetId, msg.contentHash)` to bridge OSS-path assets (no server `asset_hash`) into the registry.
- `useMoshpitAssetRegistry` now resolves `a.asset_hash ?? metaStore.getHashForAssetId(a.id)` so local-backend users see their thumbnails.

Purpose: ASSET-01 (consume stream — both cloud AND OSS paths), ASSET-10 (warm-cache one-frame short-circuit), ASSET-07 (progressive), ASSET-08 (cancel-resume via D-07 re-entry), and the Phase-3 hook for filter-change sequencing (RESEARCH §6).

Output: Two composables + integration tests. ~340 LOC.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-asset-pipeline/02-RESEARCH.md
@.planning/phases/02-asset-pipeline/02-CONTEXT.md
@src/stores/assetsStore.ts
@src/platform/assets/schemas/assetSchema.ts
@src/platform/assets/utils/assetUrlUtil.ts
@src/platform/moshpit/services/workerBridge.ts
@src/platform/moshpit/services/thumbRepository.ts
@src/platform/moshpit/stores/moshpitThumbStore.ts
@src/platform/moshpit/stores/moshpitMetadataStore.ts
@src/platform/moshpit/stores/moshpitCurationStore.ts

<interfaces>
```typescript
// useMoshpitProcessingQueue.ts
export interface QueueAssetView {
  readonly id: string
  readonly assetHash: string | null
}

/\*\*

- Public state shape. Consumers that need to READ queue state (sprite layer,
- indicator pill) accept this type — they MUST NOT call useMoshpitProcessingQueue()
- a second time. MoshpitLayout.vue owns the single instantiation and passes
- this shape down the tree.
  \*/
  export interface ProcessingQueueState {
  readonly total: Readonly<Ref<number>>
  readonly done: Readonly<Ref<number>>
  readonly isActive: Readonly<ComputedRef<boolean>>
  readonly activeFilterId: Readonly<Ref<string>>
  setFilter(filterKey: string, assets: readonly AssetItem[]): Promise<void>
  cancel(): void
  destroy(): void
  }

export function useMoshpitProcessingQueue(options?: {
bridge?: WorkerBridge // injectable for tests
}): ProcessingQueueState

/\*_ Pure helper used by Wave-0 tests. _/
export function computeQueueDelta(
filtered: readonly QueueAssetView[],
cachedHashes: ReadonlySet<string>
): QueueAssetView[]

// useMoshpitAssetRegistry.ts
export interface AssetEntry {
readonly id: string
readonly contentHash: string
readonly thumbUrl: string | undefined
readonly hasMetadata: boolean
}

export function useMoshpitAssetRegistry(): {
readonly entries: ComputedRef<readonly AssetEntry[]>
}

````
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement useMoshpitProcessingQueue with injectable bridge + OSS-path hash bridge + Wave-0 tests GREEN</name>
  <read_first>
    - src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts (Wave-0 RED tests — make GREEN at minimum for computeQueueDelta)
    - src/stores/assetsStore.ts (outputJobAssets shape — `ref<AssetItem[]>`)
    - src/platform/assets/schemas/assetSchema.ts (AssetItem type — `asset_hash` is `string | null | undefined`)
    - src/platform/assets/utils/assetUrlUtil.ts (getAssetUrl signature)
    - src/platform/moshpit/services/workerBridge.ts (WorkerBridge interface, ThumbReadyMessage shape — must carry `assetId` AND `contentHash`)
    - src/platform/moshpit/services/thumbRepository.ts (getAllThumbHashes, getAssetMeta)
    - src/platform/moshpit/stores/moshpitMetadataStore.ts (recordAssetHash, getHashForAssetId — Plan 07 revision)
    - .planning/phases/02-asset-pipeline/02-RESEARCH.md §6 Filter-Change-Mid-Processing (exact sequencing rules)
    - .planning/phases/02-asset-pipeline/02-CONTEXT.md decisions D-06, D-07, D-08
  </read_first>
  <behavior>
    - computeQueueDelta(filtered, cachedHashes): returns filtered entries whose `assetHash` is not in cachedHashes; null `assetHash` entries are always included (client-side hash path)
    - setFilter({filterKey: 'F1', assets: [a,b,c]}) where all 3 are cached → no bridge.enqueue calls; total===0; isActive false (D-08)
    - setFilter with 3 assets, 1 cached → bridge.enqueue called 2 times; total === 2; done === 0
    - On thumbReady(msg): moshpitThumbStore.addThumb + moshpitMetadataStore.setMetadata + moshpitMetadataStore.recordAssetHash(msg.assetId, msg.contentHash) + moshpitCurationStore.load; done++
    - On excluded: moshpitMetadataStore.incrementExcluded; total-- (so the N/M ratio reflects surviving set)
    - cancel() → bridge.cancelAll; isActive flips false; `done`/`total` not reset (D-06: completed thumbs kept)
    - Second setFilter with same filterKey + same assets (all now cached due to prior run) → warm-cache one-frame; bridge.enqueue NOT called
    - **OSS-path integration:** an AssetItem with `asset_hash: null` enters the queue, thumbReady fires for its id → after the callback, `metaStore.getHashForAssetId(assetId)` returns the worker-computed hash AND `useMoshpitAssetRegistry().entries.value` contains an AssetEntry for that asset (verifies reactivity)
  </behavior>
  <action>
Create `src/platform/moshpit/composables/useMoshpitProcessingQueue.ts`:

```typescript
import type { ComputedRef, Ref } from 'vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetUrl } from '@/platform/assets/utils/assetUrlUtil'
import {
  getAllThumbHashes,
  getAssetMeta
} from '@/platform/moshpit/services/thumbRepository'
import type { WorkerBridge } from '@/platform/moshpit/services/workerBridge'
import { createWorkerBridge } from '@/platform/moshpit/services/workerBridge'
import { useMoshpitCurationStore } from '@/platform/moshpit/stores/moshpitCurationStore'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { useMoshpitThumbStore } from '@/platform/moshpit/stores/moshpitThumbStore'

export interface QueueAssetView {
  readonly id: string
  readonly assetHash: string | null
}

/**
 * Contract for downstream consumers (sprite layer, indicator pill, layout).
 * Consumers MUST accept this type and MUST NOT call useMoshpitProcessingQueue()
 * a second time — a second call instantiates a second WorkerBridge whose
 * counters and bridge callbacks live in a parallel universe to the real
 * processing, guaranteeing that any watch of `total/done` returns zero forever.
 * MoshpitLayout.vue is the single owner; it passes this shape down the tree.
 */
export interface ProcessingQueueState {
  readonly total: Readonly<Ref<number>>
  readonly done: Readonly<Ref<number>>
  readonly isActive: Readonly<ComputedRef<boolean>>
  readonly activeFilterId: Readonly<Ref<string>>
  setFilter(filterKey: string, assets: readonly AssetItem[]): Promise<void>
  cancel(): void
  destroy(): void
}

/**
 * Pure diff: which of `filtered` lack a cached thumb? Assets without a known
 * `assetHash` (OSS path) are always enqueued — the worker will compute the
 * hash and the warm-cache check runs post-hash via the IDB `get` in the
 * thumbReady handler.
 */
export function computeQueueDelta(
  filtered: readonly QueueAssetView[],
  cachedHashes: ReadonlySet<string>
): QueueAssetView[] {
  return filtered.filter((a) => {
    if (!a.assetHash || a.assetHash.length === 0) return true
    return !cachedHashes.has(a.assetHash)
  })
}

export function useMoshpitProcessingQueue(options?: {
  bridge?: WorkerBridge
}): ProcessingQueueState {
  const bridge = options?.bridge ?? createWorkerBridge()
  const thumbStore = useMoshpitThumbStore()
  const metaStore = useMoshpitMetadataStore()
  const curationStore = useMoshpitCurationStore()

  const total = ref(0)
  const done = ref(0)
  const activeFilterId = ref('')
  const isActive = computed(() => total.value > 0 && done.value < total.value)

  const offReady = bridge.onThumbReady((msg) => {
    thumbStore.addThumb(msg.contentHash, msg.blob)
    metaStore.setMetadata(msg.contentHash, msg.metadata)
    // OSS-path bridge (revision iter 1): record asset.id → contentHash so
    // useMoshpitAssetRegistry can resolve a.asset_hash ?? getHashForAssetId(a.id)
    // for local-backend assets whose server-side asset_hash is null.
    metaStore.recordAssetHash(msg.assetId, msg.contentHash)
    // Hydrate curation from IDB so hidden/favourite flags are reflected
    // even for thumbs that landed on a prior session.
    void getAssetMeta(msg.contentHash).then((rec) => {
      if (rec) curationStore.load(rec)
    })
    done.value++
  })

  const offExcluded = bridge.onExcluded(() => {
    metaStore.incrementExcluded()
    total.value = Math.max(0, total.value - 1)
  })

  const offError = bridge.onError((msg) => {
    console.error('[moshpit] worker error', msg.message)
  })

  async function setFilter(
    filterKey: string,
    assets: readonly AssetItem[]
  ): Promise<void> {
    // New filter invalidates any in-flight work from the previous one
    if (activeFilterId.value !== '' && activeFilterId.value !== filterKey) {
      bridge.cancelAll()
      total.value = 0
      done.value = 0
      metaStore.resetExcluded()
    }
    activeFilterId.value = filterKey
    bridge.setActiveFilterId(filterKey)

    // Diff against IDB warm cache (D-08 / D-07 auto-resume)
    const cached = new Set(await getAllThumbHashes())
    const asViews: QueueAssetView[] = assets.map((a) => ({
      id: a.id,
      assetHash: a.asset_hash ?? null
    }))
    const delta = computeQueueDelta(asViews, cached)

    total.value = delta.length
    done.value = 0

    // Warm cache — do not post anything to the worker (D-08)
    if (delta.length === 0) return

    // Enqueue each delta asset through the bridge
    for (const view of delta) {
      const src = assets.find((a) => a.id === view.id)
      if (!src) continue
      bridge.enqueue({
        id: `${filterKey}:${view.id}`,
        filterId: filterKey,
        fetchUrl: getAssetUrl(src),
        assetId: view.id,          // needed so thumbReady can bridge back to asset.id
        assetHash: view.assetHash
      })
    }
  }

  function cancel(): void {
    bridge.cancelAll()
    // Per D-06: keep done/total counts as-is. The pill is driven by `isActive`
    // which will flip to false once we zero out total — but we set total to
    // done so the pill dismisses cleanly.
    total.value = done.value
  }

  function destroy(): void {
    offReady()
    offExcluded()
    offError()
    bridge.destroy()
  }

  onBeforeUnmount(destroy)

  return { total, done, isActive, activeFilterId, setFilter, cancel, destroy }
}
````

Also create `src/platform/moshpit/composables/useMoshpitAssetRegistry.ts`:

```typescript
import type { ComputedRef } from 'vue'
import { computed } from 'vue'

import { useAssetsStore } from '@/stores/assetsStore'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { useMoshpitThumbStore } from '@/platform/moshpit/stores/moshpitThumbStore'

export interface AssetEntry {
  readonly id: string
  readonly contentHash: string
  readonly thumbUrl: string | undefined
  readonly hasMetadata: boolean
}

/**
 * Composes the three Moshpit Pinia stores into a single reactive view that
 * the PixiJS canvas (Plan 11) iterates. Phase 2 ignores filtering — Plan 11
 * reads every entry with a thumb URL. Phase 3 will layer filter/sort above.
 *
 * OSS-path handling (revision iter 1): AssetItem.asset_hash is null for
 * local-backend assets. The worker computes a contentHash and the queue
 * composable records `asset.id → contentHash` into metaStore.assetIdToHash
 * on thumbReady. This computed reads `a.asset_hash ?? metaStore.getHashForAssetId(a.id)`
 * so OSS assets appear in the registry as soon as the worker completes.
 *
 * Reactivity: the computed reads `metaStore.assetIdToHash.value.get(a.id)`
 * via the `.value` access on the ref, capturing the dependency. Any
 * `recordAssetHash` mutation triggers re-evaluation and new entries appear.
 */
export function useMoshpitAssetRegistry(): {
  readonly entries: ComputedRef<readonly AssetEntry[]>
} {
  const assetsStore = useAssetsStore()
  const thumbStore = useMoshpitThumbStore()
  const metaStore = useMoshpitMetadataStore()

  const entries = computed<readonly AssetEntry[]>(() => {
    const source = assetsStore.outputJobAssets
    // Touch the asset-id map ref so the computed tracks it reactively.
    // Without this `.value` read the computed may not re-run when
    // recordAssetHash only mutates the Map without reassigning the ref.
    const assetIdMap = metaStore.assetIdToHash.value
    const out: AssetEntry[] = []
    for (const a of source) {
      const hash = a.asset_hash ?? assetIdMap.get(a.id) ?? null
      if (!hash) continue
      out.push({
        id: a.id,
        contentHash: hash,
        thumbUrl: thumbStore.getUrl(hash),
        hasMetadata: metaStore.getMetadata(hash) !== undefined
      })
    }
    return out
  })

  return { entries }
}
```

Extend `src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts` (from Plan 01) with integration cases. The Wave-0 `computeQueueDelta` cases already test the pure function. Add:

```typescript
// Append to the existing describe block:
it('setFilter with all-cached assets does NOT enqueue (D-08 warm cache)', async () => {
  // Executor: implement with a fake WorkerBridge (shape matches Plan 06's
  // FakeWorker) + fake-indexeddb pre-seeded. Primary integration guard for
  // ASSET-10. If time-boxed, may land as it.skip with VALIDATION.md reference.
})

it('thumbReady bridges asset.id → contentHash via metaStore.recordAssetHash (OSS path)', async () => {
  // Arrange: fake WorkerBridge that lets us manually trigger onThumbReady.
  // Assets: [{ id: 'asset-1', asset_hash: null }, ...]
  // Act: setFilter('F1', assets); then simulate bridge.onThumbReady({
  //   assetId: 'asset-1', contentHash: 'hash-A', blob, metadata
  // })
  // Assert:
  //   - metaStore.getHashForAssetId('asset-1') === 'hash-A'
  //   - useMoshpitAssetRegistry().entries.value finds an AssetEntry with
  //     id: 'asset-1', contentHash: 'hash-A'
  //   - (reactivity) the entries computed reacts to the recordAssetHash
  //     mutation within a single flushSync tick
})
```

If the executor has time budget, fully implement both integration tests with a fake bridge (shape same as Plan 06's FakeWorker but typed as `WorkerBridge`). If not, only the OSS-path test is a hard requirement — it is the regression guard for the blocker addressed this iteration. The warm-cache test may be `it.skip` with a comment referencing VALIDATION.md.

Constraints:

- NO `any`, NO `as any`.
- `setFilter` is async (IDB read is async) — typed as `Promise<void>`.
- `onBeforeUnmount(destroy)` ensures the bridge and callbacks are torn down when the canvas unmounts.
- Do NOT import `pixi.js` here — the canvas is the only place Pixi lives.
- `ProcessingQueueState` MUST be exported as a named type (Plan 11 imports it).
- `bridge.enqueue` call site MUST include `assetId: view.id` so the worker can echo it back in `thumbReady`. If the WorkerBridge `EnqueueJob` type from Plan 06 lacks `assetId`, this plan extends it (touch `workerBridge.ts` to widen the type). Plan 05 must also echo `assetId` back through `ThumbReadyMessage`. Document the touch in the SUMMARY.
  </action>
  <verify>
  <automated>pnpm test:unit --run src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts &amp;&amp; pnpm typecheck</automated>
  </verify>
  <acceptance_criteria> - `test -f src/platform/moshpit/composables/useMoshpitProcessingQueue.ts` exits 0 - `test -f src/platform/moshpit/composables/useMoshpitAssetRegistry.ts` exits 0 - `grep "export function computeQueueDelta" src/platform/moshpit/composables/useMoshpitProcessingQueue.ts` returns a match - `grep "export function useMoshpitProcessingQueue" src/platform/moshpit/composables/useMoshpitProcessingQueue.ts` returns a match - `grep "export interface ProcessingQueueState" src/platform/moshpit/composables/useMoshpitProcessingQueue.ts` returns a match (Plan 11 depends on this) - `grep "bridge.cancelAll\\|cancelAll()" src/platform/moshpit/composables/useMoshpitProcessingQueue.ts` returns at least one match - `grep "getAssetUrl\\|getAllThumbHashes\\|getAssetMeta" src/platform/moshpit/composables/useMoshpitProcessingQueue.ts` returns at least 3 matches - `grep "D-08\\|warm cache\\|warm-cache" src/platform/moshpit/composables/useMoshpitProcessingQueue.ts` returns at least one match (doc comment for ASSET-10) - `grep "recordAssetHash" src/platform/moshpit/composables/useMoshpitProcessingQueue.ts` returns at least one match (OSS-path bridge wired into thumbReady handler) - `grep "getHashForAssetId\\|assetIdToHash" src/platform/moshpit/composables/useMoshpitAssetRegistry.ts` returns at least one match (OSS fallback read) - `grep "asset_hash ??" src/platform/moshpit/composables/useMoshpitAssetRegistry.ts` returns at least one match (the nullish-coalesce fallback expression) - `grep "\\b: any\\b\\|as any" src/platform/moshpit/composables/useMoshpitProcessingQueue.ts` returns zero matches - `grep "\\b: any\\b\\|as any" src/platform/moshpit/composables/useMoshpitAssetRegistry.ts` returns zero matches - `pnpm test:unit --run src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts` exits 0 with the 3 Wave-0 computeQueueDelta tests GREEN **and** the OSS-path thumbReady-bridge test GREEN (not skipped) - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>Composable integrates bridge + stores + IDB diff; pure helper GREEN; warm-cache short-circuit documented; OSS-path hash bridge wired and tested; ProcessingQueueState type exported for Plan 11.</done>
  </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                 | Description                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| Composable → `getAssetUrl`               | Trusted — helper generates same-origin URLs only                                    |
| Composable ← assetsStore.outputJobAssets | Trusted (internal Pinia state from ComfyUI API / cloud)                             |
| Composable → metaStore.recordAssetHash   | Trusted — `assetId` from enqueued job, `contentHash` from worker (verified SHA-256) |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                                                                     | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | ---------------------- | --------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-02-08-01 | Spoofing               | Asset `id` collision across filters                                                           | mitigate    | Bridge enqueue IDs are namespaced `${filterKey}:${asset.id}` so no cross-filter ID clash.                                                                                                                                                                                                                                                                                                        |
| T-02-08-02 | Information Disclosure | `fetchUrl` only ever derived from `getAssetUrl`                                               | mitigate    | The composable is the ONLY call site that constructs worker-bound URLs; documented in a code comment. Any future caller must go through the same path.                                                                                                                                                                                                                                           |
| T-02-08-03 | Tampering              | `setFilter` called concurrently → race                                                        | mitigate    | Each call updates `activeFilterId` then `bridge.setActiveFilterId`; stale worker responses are dropped by the bridge (Plan 06 `T-02-06-01`). The composable itself is called from a single watch in the canvas, so concurrent calls are rare.                                                                                                                                                    |
| T-02-08-04 | Denial of Service      | enqueue loop of 5k assets blocking main thread                                                | mitigate    | Each `bridge.enqueue` internally goes through `runWhenGlobalIdle` (Plan 06). Main thread remains interactive.                                                                                                                                                                                                                                                                                    |
| T-02-08-05 | Tampering              | Malicious worker posts spoofed `thumbReady.assetId` → wrong asset shows neighbour's thumbnail | mitigate    | The worker is same-origin and from our own bundle; no cross-origin code runs. ASVS L1 V9.1 (worker isolation) accepted. The `assetId` echoed in `thumbReady` is validated against the currently-active filter's enqueued set by Plan 06 (stale filter responses dropped); out-of-band ids produce a no-op `recordAssetHash` which the registry ignores (no matching asset in `outputJobAssets`). |

</threat_model>

<verification>
- `pnpm test:unit --run src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts` — Wave-0 tests GREEN + OSS-path bridge test GREEN
- `pnpm typecheck` exits 0
- `pnpm lint` on new files exits 0
</verification>

<success_criteria>

- Queue composable integrates bridge + stores + IDB diff
- Warm-cache short-circuit (D-08 / ASSET-10) honoured: no worker post when cache is warm
- Cancel semantics follow D-06 (keep completed)
- Registry composable exposes `AssetEntry[]` for the canvas — both cloud (`asset_hash`) and OSS (`getHashForAssetId`) paths
- `ProcessingQueueState` exported as a named type so Plan 11 can consume it without a second `useMoshpitProcessingQueue()` call
  </success_criteria>

<output>
Create `.planning/phases/02-asset-pipeline/02-08-SUMMARY.md` noting:
- The exact integration test coverage level achieved and any `it.skip`s deferred to Plan 14 E2E
- Whether Plan 05/06 `EnqueueJob` / `ThumbReadyMessage` needed `assetId` extensions (touch outside declared files_modified)
- The Pinia `ref<Map>` reactivity approach confirmed working (or the fallback taken)
</output>
