---
phase: 02-asset-pipeline
plan: 07
type: execute
wave: 3
depends_on: ['02-04']
files_modified:
  - src/platform/moshpit/stores/moshpitThumbStore.ts
  - src/platform/moshpit/stores/moshpitThumbStore.test.ts
  - src/platform/moshpit/stores/moshpitMetadataStore.ts
  - src/platform/moshpit/stores/moshpitMetadataStore.test.ts
  - src/platform/moshpit/stores/moshpitCurationStore.ts
  - src/platform/moshpit/stores/moshpitCurationStore.test.ts
autonomous: true
requirements: [ASSET-01, ASSET-03, ASSET-04, ASSET-05, ASSET-06]
tags: [pinia, stores, wave-3]
must_haves:
  truths:
    - '`moshpitThumbStore` manages a `Map<contentHash, string>` of object URLs; `addThumb(hash, blob)` revokes an old URL before creating a new one so no leaks happen'
    - '`moshpitThumbStore.reset()` revokes every object URL — call on unmount'
    - '`moshpitMetadataStore` exposes `excludedCount: Ref<number>`, `incrementExcluded()`, `resetExcluded()`, and a `Map<contentHash, ParsedMeta>` setter — ASSET-06 surface'
    - '`moshpitMetadataStore` additionally tracks `assetIdToHash: Map<assetId, contentHash>` via `recordAssetHash(assetId, contentHash)` + `getHashForAssetId(assetId)` so the OSS path (no `asset_hash`) can hydrate `useMoshpitAssetRegistry` with worker-computed hashes (ASSET-01 fix)'
    - '`moshpitCurationStore` is a Phase-2 scaffold: `Map<contentHash, CurationRecord>` with `load(record)`, `get(hash)`, `reset()` — Phase 5 adds mutation actions'
    - 'Each store has its own unit test file exercising the public actions (min 3 tests per store; metadata store has an extra test for the asset-id map)'
    - "All stores use the Pinia setup-API (`defineStore('name', () => { ... })`) per Phase 1 precedent"
  artifacts:
    - path: 'src/platform/moshpit/stores/moshpitThumbStore.ts'
      provides: 'URL.createObjectURL cache with revoke-on-replace'
      contains: 'export const useMoshpitThumbStore = defineStore'
    - path: 'src/platform/moshpit/stores/moshpitMetadataStore.ts'
      provides: 'Parsed-metadata map + excludedCount + assetId→contentHash map'
      contains: 'export const useMoshpitMetadataStore = defineStore'
    - path: 'src/platform/moshpit/stores/moshpitCurationStore.ts'
      provides: 'Curation scaffold map (Phase 5 primary)'
      contains: 'export const useMoshpitCurationStore = defineStore'
  key_links:
    - from: 'src/platform/moshpit/stores/moshpitThumbStore.ts'
      to: 'URL.createObjectURL / URL.revokeObjectURL'
      via: 'direct browser API'
      pattern: "URL\\.createObjectURL"
    - from: 'src/platform/moshpit/stores/moshpitMetadataStore.ts'
      to: 'src/platform/moshpit/composables/useMoshpitAssetRegistry.ts'
      via: 'recordAssetHash populated by queue; getHashForAssetId read by registry'
      pattern: 'recordAssetHash|getHashForAssetId'
---

<objective>
Create the three Pinia stores that hold the reactive layer PixiJS consumes. All three follow Phase 1's setup-API precedent and keep a tight, export-minimal public surface.

Purpose: Decouple Pinia state from worker/IDB mechanics. The composable (Plan 08) composes these stores; the canvas (Plan 11) consumes `moshpitThumbStore`; the settings panel (Plan 10) consumes `moshpitMetadataStore.excludedCount`.

**Revision note (iter 1):** `moshpitMetadataStore` grows an `assetIdToHash` map + `recordAssetHash` setter. This is the bridge that fixes the OSS-path blocker in Plan 08 — worker-computed hashes land here keyed by `AssetItem.id`, and `useMoshpitAssetRegistry` reads `asset_hash ?? getHashForAssetId(id)` to render local-backend thumbnails.

Output: Six files (3 stores + 3 tests). ~280 LOC total.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/platform/moshpit/stores/moshpitViewportStore.ts
@src/platform/moshpit/stores/moshpitSidebarStore.ts
@src/platform/moshpit/services/thumbRepository.types.ts
@.planning/phases/02-asset-pipeline/02-RESEARCH.md

<interfaces>
`src/platform/moshpit/stores/moshpitThumbStore.ts`:

```typescript
export const useMoshpitThumbStore = defineStore('moshpitThumb', () => {
  /** Get the object URL for a cached thumb, or undefined if not loaded. */
  function getUrl(contentHash: string): string | undefined
  /** Add/replace a thumb. Revokes any prior URL for the same hash. */
  function addThumb(contentHash: string, blob: Blob): string
  /** True if the hash has a live object URL. */
  function has(contentHash: string): boolean
  /** Revoke all URLs and clear the map. Call on canvas unmount. */
  function reset(): void
  return { urlByHash, getUrl, addThumb, has, reset, size /* computed */ }
})
```

`src/platform/moshpit/stores/moshpitMetadataStore.ts`:

```typescript
export const useMoshpitMetadataStore = defineStore('moshpitMetadata', () => {
  const excludedCount: Ref<number> // public reactive
  function setMetadata(
    contentHash: string,
    meta: Readonly<Record<string, string>>
  ): void
  function getMetadata(
    contentHash: string
  ): Readonly<Record<string, string>> | undefined
  function incrementExcluded(): void
  function resetExcluded(): void
  /** Populated by useMoshpitProcessingQueue when the worker emits thumbReady
   *  for an OSS-path asset (no server asset_hash). Lets the registry
   *  compute `a.asset_hash ?? getHashForAssetId(a.id)`. */
  function recordAssetHash(assetId: string, contentHash: string): void
  function getHashForAssetId(assetId: string): string | undefined
  function reset(): void // clears map, count, and assetIdToHash
  return {
    excludedCount,
    assetIdToHash, // exposed reactive ref so computed() in registry tracks it
    setMetadata,
    getMetadata,
    incrementExcluded,
    resetExcluded,
    recordAssetHash,
    getHashForAssetId,
    reset
  }
})
```

`src/platform/moshpit/stores/moshpitCurationStore.ts`:

```typescript
export const useMoshpitCurationStore = defineStore('moshpitCuration', () => {
  function load(record: AssetMetaRecord): void // hydrate from IDB on init
  function get(contentHash: string): CurationRecord | undefined
  function reset(): void
  return { load, get, reset }
})
```

**Reactivity note (Pinia ref<Map>):** Pinia's `ref(new Map())` is reactive on `.set/.delete/.clear`. `computed(() => map.get(key))` will correctly re-run when the map mutates **if** the computed also reads the ref itself (e.g. `assetIdToHash.value`). The registry computed in Plan 08 does this by iterating `assetsStore.outputJobAssets` and reading `metaStore.assetIdToHash.value.get(a.id)` — dependency is captured via the `.value` access. If this proves insufficient in integration (no re-render on `recordAssetHash` despite set), the fallback is a manual `customRef` trigger or swapping to a plain `ref<Record<string,string>>`. The Plan 08 test asserts this reactivity end-to-end.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create moshpitThumbStore + moshpitMetadataStore + moshpitCurationStore (with tests)</name>
  <read_first>
    - src/platform/moshpit/stores/moshpitViewportStore.ts (Pinia setup-API reference shape)
    - src/platform/moshpit/stores/moshpitViewportStore.test.ts (test pattern: createPinia + setActivePinia + test)
    - src/platform/moshpit/services/thumbRepository.types.ts (CurationRecord, AssetMetaRecord types)
    - .planning/phases/02-asset-pipeline/02-RESEARCH.md §5 Asset Store Shape (object URL lifecycle, excluded count)
  </read_first>
  <behavior>
    - Thumb store: addThumb('h1', blobA) → getUrl('h1') returns a string; addThumb('h1', blobB) revokes the old URL (verifiable by spying on URL.revokeObjectURL); reset revokes every outstanding URL
    - Metadata store: initial excludedCount is 0; incrementExcluded makes it 1, 2, 3; setMetadata + getMetadata round-trip; reset sets count to 0 and clears the map
    - Metadata store asset-id map: recordAssetHash('asset-1', 'hash-A') then getHashForAssetId('asset-1') === 'hash-A'; reset clears the map; re-record overwrites
    - Curation store: load(record) then get(record.contentHash) returns record.curation; reset clears
  </behavior>
  <action>
Create three stores + three tests. Each store is a separate file per Pinia convention.

**`src/platform/moshpit/stores/moshpitThumbStore.ts`:**

```typescript
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useMoshpitThumbStore = defineStore('moshpitThumb', () => {
  const urlByHash = ref(new Map<string, string>())
  const size = computed(() => urlByHash.value.size)

  function getUrl(contentHash: string): string | undefined {
    return urlByHash.value.get(contentHash)
  }

  function has(contentHash: string): boolean {
    return urlByHash.value.has(contentHash)
  }

  function addThumb(contentHash: string, blob: Blob): string {
    const existing = urlByHash.value.get(contentHash)
    if (existing) URL.revokeObjectURL(existing)
    const url = URL.createObjectURL(blob)
    urlByHash.value.set(contentHash, url)
    return url
  }

  function reset(): void {
    urlByHash.value.forEach((url) => URL.revokeObjectURL(url))
    urlByHash.value.clear()
  }

  return { urlByHash, size, getUrl, has, addThumb, reset }
})
```

**`src/platform/moshpit/stores/moshpitMetadataStore.ts`:**

```typescript
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useMoshpitMetadataStore = defineStore('moshpitMetadata', () => {
  const metaByHash = ref(new Map<string, Readonly<Record<string, string>>>())
  // OSS-path bridge: asset.id → worker-computed contentHash. Populated by the
  // processing queue on thumbReady for assets that lacked a server asset_hash.
  // Read by useMoshpitAssetRegistry to fill in the hash for local-backend
  // assets so their sprites render.
  const assetIdToHash = ref(new Map<string, string>())
  const excludedCount = ref(0)
  const size = computed(() => metaByHash.value.size)

  function setMetadata(
    contentHash: string,
    meta: Readonly<Record<string, string>>
  ): void {
    metaByHash.value.set(contentHash, meta)
  }

  function getMetadata(
    contentHash: string
  ): Readonly<Record<string, string>> | undefined {
    return metaByHash.value.get(contentHash)
  }

  function recordAssetHash(assetId: string, contentHash: string): void {
    assetIdToHash.value.set(assetId, contentHash)
  }

  function getHashForAssetId(assetId: string): string | undefined {
    return assetIdToHash.value.get(assetId)
  }

  function incrementExcluded(): void {
    excludedCount.value++
  }

  function resetExcluded(): void {
    excludedCount.value = 0
  }

  function reset(): void {
    metaByHash.value.clear()
    assetIdToHash.value.clear()
    excludedCount.value = 0
  }

  return {
    excludedCount,
    assetIdToHash,
    size,
    setMetadata,
    getMetadata,
    recordAssetHash,
    getHashForAssetId,
    incrementExcluded,
    resetExcluded,
    reset
  }
})
```

**`src/platform/moshpit/stores/moshpitCurationStore.ts`:**

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'

import type {
  AssetMetaRecord,
  CurationRecord
} from '@/platform/moshpit/services/thumbRepository.types'

/**
 * Phase 2 scaffold for curation state. Phase 5 will add mutation actions
 * (favourite, tag, hide, folder) that also write through to IDB. Phase 2
 * only populates the reactive layer after a thumb lands.
 */
export const useMoshpitCurationStore = defineStore('moshpitCuration', () => {
  const curationByHash = ref(new Map<string, CurationRecord>())

  function load(record: AssetMetaRecord): void {
    curationByHash.value.set(record.contentHash, record.curation)
  }

  function get(contentHash: string): CurationRecord | undefined {
    return curationByHash.value.get(contentHash)
  }

  function reset(): void {
    curationByHash.value.clear()
  }

  return { load, get, reset }
})
```

**Tests** — create three sibling `.test.ts` files. Minimum 3 tests each (metadata store has 4 — the asset-id map adds a case). Pattern matches `moshpitViewportStore.test.ts`:

`moshpitThumbStore.test.ts`:

```typescript
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMoshpitThumbStore } from './moshpitThumbStore'

describe('moshpitThumbStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('addThumb creates an object URL, getUrl returns it, has is true', () => {
    const createSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock/1')
    const store = useMoshpitThumbStore()
    const url = store.addThumb('h1', new Blob(['x']))
    expect(url).toBe('blob:mock/1')
    expect(store.getUrl('h1')).toBe('blob:mock/1')
    expect(store.has('h1')).toBe(true)
    createSpy.mockRestore()
  })

  it('adding twice for the same hash revokes the old URL', () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:old')
      .mockReturnValueOnce('blob:new')
    const revokeSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})
    const store = useMoshpitThumbStore()
    store.addThumb('h1', new Blob(['a']))
    store.addThumb('h1', new Blob(['b']))
    expect(revokeSpy).toHaveBeenCalledWith('blob:old')
    expect(store.getUrl('h1')).toBe('blob:new')
  })

  it('reset revokes every outstanding URL', () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:a')
      .mockReturnValueOnce('blob:b')
    const revokeSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})
    const store = useMoshpitThumbStore()
    store.addThumb('h1', new Blob(['a']))
    store.addThumb('h2', new Blob(['b']))
    store.reset()
    expect(revokeSpy).toHaveBeenCalledWith('blob:a')
    expect(revokeSpy).toHaveBeenCalledWith('blob:b')
    expect(store.size).toBe(0)
  })
})
```

`moshpitMetadataStore.test.ts`:

```typescript
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useMoshpitMetadataStore } from './moshpitMetadataStore'

describe('moshpitMetadataStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('setMetadata + getMetadata round-trips', () => {
    const store = useMoshpitMetadataStore()
    store.setMetadata('h1', { workflow: '{}' })
    expect(store.getMetadata('h1')).toEqual({ workflow: '{}' })
  })

  it('incrementExcluded and resetExcluded track excludedCount', () => {
    const store = useMoshpitMetadataStore()
    expect(store.excludedCount).toBe(0)
    store.incrementExcluded()
    store.incrementExcluded()
    expect(store.excludedCount).toBe(2)
    store.resetExcluded()
    expect(store.excludedCount).toBe(0)
  })

  it('recordAssetHash + getHashForAssetId round-trip (OSS-path bridge)', () => {
    const store = useMoshpitMetadataStore()
    expect(store.getHashForAssetId('asset-1')).toBeUndefined()
    store.recordAssetHash('asset-1', 'hash-A')
    expect(store.getHashForAssetId('asset-1')).toBe('hash-A')
    // Re-recording overwrites
    store.recordAssetHash('asset-1', 'hash-B')
    expect(store.getHashForAssetId('asset-1')).toBe('hash-B')
  })

  it('reset clears the map, the count, AND the assetIdToHash bridge', () => {
    const store = useMoshpitMetadataStore()
    store.setMetadata('h1', { k: 'v' })
    store.incrementExcluded()
    store.recordAssetHash('asset-1', 'hash-A')
    store.reset()
    expect(store.getMetadata('h1')).toBeUndefined()
    expect(store.excludedCount).toBe(0)
    expect(store.getHashForAssetId('asset-1')).toBeUndefined()
  })
})
```

`moshpitCurationStore.test.ts`:

```typescript
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useMoshpitCurationStore } from './moshpitCurationStore'

describe('moshpitCurationStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('load stores a CurationRecord by contentHash', () => {
    const store = useMoshpitCurationStore()
    store.load({
      contentHash: 'h1',
      metadata: {},
      curation: { favourite: true, tags: ['a'], folders: [], hidden: false }
    })
    expect(store.get('h1')?.favourite).toBe(true)
    expect(store.get('h1')?.tags).toEqual(['a'])
  })

  it('get returns undefined for unknown hash', () => {
    const store = useMoshpitCurationStore()
    expect(store.get('missing')).toBeUndefined()
  })

  it('reset clears the map', () => {
    const store = useMoshpitCurationStore()
    store.load({
      contentHash: 'h1',
      metadata: {},
      curation: { favourite: false, tags: [], folders: [], hidden: false }
    })
    store.reset()
    expect(store.get('h1')).toBeUndefined()
  })
})
```

Constraints:

- NO `any` anywhere.
- All stores use `defineStore('name', () => { ... })` (setup API).
- Store names are unique and stable: `moshpitThumb`, `moshpitMetadata`, `moshpitCuration`.
- Tests mock `URL.createObjectURL` and `URL.revokeObjectURL` because happy-dom may not implement them.
- `assetIdToHash` is exposed as the reactive ref (not wrapped by a getter) so consumers' `computed()` can capture the dependency via `.value` access. Do NOT return only the `getHashForAssetId` function — the registry needs the underlying ref for reactivity.
  </action>
  <verify>
  <automated>pnpm test:unit --run src/platform/moshpit/stores/moshpitThumbStore.test.ts src/platform/moshpit/stores/moshpitMetadataStore.test.ts src/platform/moshpit/stores/moshpitCurationStore.test.ts &amp;&amp; pnpm typecheck</automated>
  </verify>
  <acceptance_criteria> - `test -f src/platform/moshpit/stores/moshpitThumbStore.ts` exits 0 - `test -f src/platform/moshpit/stores/moshpitMetadataStore.ts` exits 0 - `test -f src/platform/moshpit/stores/moshpitCurationStore.ts` exits 0 - Each corresponding `.test.ts` exists - `grep "defineStore('moshpitThumb'" src/platform/moshpit/stores/moshpitThumbStore.ts` returns a match - `grep "defineStore('moshpitMetadata'" src/platform/moshpit/stores/moshpitMetadataStore.ts` returns a match - `grep "defineStore('moshpitCuration'" src/platform/moshpit/stores/moshpitCurationStore.ts` returns a match - `grep "URL.revokeObjectURL" src/platform/moshpit/stores/moshpitThumbStore.ts` returns at least 2 matches (replace path + reset path) - `grep "recordAssetHash" src/platform/moshpit/stores/moshpitMetadataStore.ts` returns at least 2 matches (definition + return) - `grep "getHashForAssetId" src/platform/moshpit/stores/moshpitMetadataStore.ts` returns at least 2 matches - `grep "assetIdToHash" src/platform/moshpit/stores/moshpitMetadataStore.ts` returns at least 3 matches (declaration + setter + reset) - `grep "recordAssetHash\\|getHashForAssetId\\|assetIdToHash" src/platform/moshpit/stores/moshpitMetadataStore.test.ts` returns at least 4 matches (new test exercises the bridge) - All three vitest commands exit 0 (10 tests total passing — metadata store now has 4) - `pnpm typecheck` exits 0 - `grep "\\b: any\\b\\|as any" src/platform/moshpit/stores/moshpit{Thumb,Metadata,Curation}Store.ts` returns zero matches
  </acceptance_criteria>
  <done>Three stores, ten tests green, revoke-on-replace verified, OSS-path asset-id map exposed, typecheck clean.</done>
  </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                      | Description                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Main thread → DOM object URLs | Created from Blobs received via postMessage from the worker; untrusted bytes but opaque to the rest of the app |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                                                         | Disposition | Mitigation Plan                                                                                                                                                    |
| ---------- | ---------------------- | --------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-02-07-01 | Information Disclosure | Object URL leakage (memory)                                                       | mitigate    | `addThumb` revokes the previous URL for the same hash; `reset` revokes all. Unit tests assert both paths. Prevents unbounded blob memory retention. ASVS L1 V13.2. |
| T-02-07-02 | Tampering              | Metadata record mutation post-storage                                             | mitigate    | `setMetadata` accepts `Readonly<Record<string, string>>`; TS prevents accidental mutation. Runtime mutation is possible but out-of-scope for v1.                   |
| T-02-07-03 | Denial of Service      | Growing the thumb map unbounded                                                   | accept      | Bounded by 5k budget per PROJECT.md. Future v2 LRU eviction is out of scope.                                                                                       |
| T-02-07-04 | Tampering              | `assetIdToHash` stale-after-reassign (asset re-uploaded with new bytes shares id) | mitigate    | `recordAssetHash` overwrites; subsequent `thumbReady` for the same asset.id updates the mapping. The registry always reads the latest value via the reactive ref.  |

</threat_model>

<verification>
- `pnpm test:unit --run src/platform/moshpit/stores/moshpit*.test.ts` — 10 tests PASS
- `pnpm typecheck` exits 0
- Existing Phase 1 store tests still pass (regression)
</verification>

<success_criteria>

- Three Pinia setup-API stores
- Metadata store with ≥4 passing tests (new OSS-bridge case); others ≥3
- Revoke-on-replace verified in thumb store
- `recordAssetHash` / `getHashForAssetId` bridge wired for Plan 08 consumption
  </success_criteria>

<output>
Create `.planning/phases/02-asset-pipeline/02-07-SUMMARY.md` noting store registration names (used by Pinia devtools) and confirming the `assetIdToHash` map reactivity approach chosen (ref'd Map vs customRef).
</output>
