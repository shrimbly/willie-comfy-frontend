---
phase: 02-asset-pipeline
plan: 11
type: execute
wave: 4
depends_on: ['02-03', '02-07', '02-08', '02-09']
files_modified:
  - src/platform/moshpit/composables/useMoshpitSpriteLayer.ts
  - src/platform/moshpit/components/MoshpitCanvas.vue
  - src/platform/moshpit/components/MoshpitCanvas.test.ts
  - src/views/layouts/MoshpitLayout.vue
autonomous: false
requirements: [ASSET-02, ASSET-07, ASSET-09]
tags: [pixijs, sprites, tween, wave-4, checkpoint]
must_haves:
  truths:
    - '`useMoshpitSpriteLayer` composable accepts the `ProcessingQueueState` from Plan 08 as `SpriteLayerOptions.queue`. It MUST NOT call `useMoshpitProcessingQueue()` — doing so creates a second WorkerBridge with counters that never tick, guaranteeing the re-pack tween never fires'
    - '`MoshpitLayout.vue` is the single owner of `useMoshpitProcessingQueue()`; it passes the resulting state down through `MoshpitView` → `MoshpitCanvas` → `useMoshpitSpriteLayer(options)` via props (or provide/inject)'
    - '`useMoshpitSpriteLayer` owns the PixiJS sprite container lifecycle: creates a `Container` under the `Viewport`, maintains `Map<contentHash, Sprite>`, adds sprites on thumbReady, removes on asset disappearance'
    - 'Sprite container has `cullable = true` so off-screen sprites do not render (VRAM mitigation, RESEARCH §PixiJS v8 Sprite Batching)'
    - 'Each sprite uses a `Texture.from(blobUrl)` with `ImageSource` configured `{ autoGenerateMipmaps: true, autoGarbageCollect: true }` for LOD + VRAM safety'
    - 'Registry sync uses `watchEffect(() => syncSprites(registry.entries.value))` — NOT a length-based watch. This tracks every reactive dep read inside `syncSprites` (including `thumbStore.urlByHash`, `metaStore.assetIdToHash`) so new thumbs arriving progressively trigger a re-sync even when the asset count is unchanged'
    - 'After processing completes (`queue.total.value > 0 && queue.done.value === queue.total.value` AND no more changes for the Vue flush tick), the composable triggers a 300ms ease-out-cubic Pixi Ticker tween from chaos slot → packed slot per D-04'
    - 'Initial jittered layout uses `layoutSeedHash(filterKey, sortedHashes)` + `computeJitteredGrid`; re-pack uses `computePackedGrid` — all via the pure Plan 03 functions'
    - 'Manual checkpoint verifies: sprites appear progressively, 60fps pan/zoom during processing, re-pack tween feels smooth'
  artifacts:
    - path: 'src/platform/moshpit/composables/useMoshpitSpriteLayer.ts'
      provides: 'Sprite lifecycle composable + tween implementation; consumes injected queue state'
      contains: 'export function useMoshpitSpriteLayer'
    - path: 'src/platform/moshpit/components/MoshpitCanvas.vue'
      provides: 'Mounts the sprite layer inside the viewport; accepts queue state prop'
      contains: 'useMoshpitSpriteLayer'
    - path: 'src/views/layouts/MoshpitLayout.vue'
      provides: 'Single owner of useMoshpitProcessingQueue; passes state down to canvas'
      contains: 'useMoshpitProcessingQueue'
  key_links:
    - from: 'src/platform/moshpit/composables/useMoshpitSpriteLayer.ts'
      to: 'pixi.js Container + Sprite + Texture + Ticker'
      via: "import { Container, Sprite, Texture } from 'pixi.js'"
      pattern: "import .*Container.*Sprite.*Texture.*from 'pixi.js'"
    - from: 'src/platform/moshpit/composables/useMoshpitSpriteLayer.ts'
      to: 'src/platform/moshpit/services/layoutMath.ts'
      via: 'computeJitteredGrid / computePackedGrid'
      pattern: 'computeJitteredGrid|computePackedGrid'
    - from: 'src/platform/moshpit/composables/useMoshpitSpriteLayer.ts'
      to: 'src/platform/moshpit/composables/useMoshpitAssetRegistry.ts'
      via: 'entries computed watchEffect'
      pattern: 'useMoshpitAssetRegistry|watchEffect'
    - from: 'src/platform/moshpit/composables/useMoshpitSpriteLayer.ts'
      to: 'src/platform/moshpit/composables/useMoshpitProcessingQueue.ts'
      via: 'ProcessingQueueState TYPE ONLY — imported but useMoshpitProcessingQueue is NOT called'
      pattern: 'import type.*ProcessingQueueState'
---

<objective>
Wire PixiJS sprites into the Moshpit canvas. This plan converts the reactive `AssetEntry[]` from `useMoshpitAssetRegistry` into a living sprite scene — new sprites appear as thumbs arrive, removed assets disappear, and after processing completes the layout re-packs via a 300ms ease-out-cubic Ticker tween.

**Revision note (iter 1) — two blockers fixed here:**

1. **Single-bridge contract (Blocker 1):** `useMoshpitSpriteLayer` must NOT call `useMoshpitProcessingQueue()`. A second call creates a second `WorkerBridge` whose `total/done` are always zero — the completion watcher never fires and ASSET-09 / D-04 re-pack tween silently dies. The fix: `MoshpitLayout.vue` (Plan 09 revision here) is the single owner; it passes `ProcessingQueueState` down to `MoshpitView` → `MoshpitCanvas` → `useMoshpitSpriteLayer(options.queue)`.

2. **watchEffect for registry sync (Blocker 2):** the original length-based watcher only fired on count change and missed `thumbReady` events (which mutate `thumbStore.urlByHash` without changing asset count). The fix: `watchEffect(() => syncSprites(registry.entries.value))` tracks all reactive deps read inside `syncSprites`, so progressive thumb arrival triggers sprite creation as required by ASSET-07 and 02.

Three-part task split to stay within the ~300LOC budget:

1. Sprite layer composable with jittered-grid placement + texture management (auto-GC, mipmaps) + injected queue + watchEffect.
2. MoshpitLayout + MoshpitCanvas wiring: layout owns the queue, canvas receives the state, sprite layer consumes it.
3. Human checkpoint verifying visual fidelity + 60fps pan/zoom.

Purpose: ASSET-02 (thumbnails reach the canvas), ASSET-07 (non-blocking progressive render), ASSET-09 (initial jittered layout + re-pack tween).

Output: One new composable (~190 lines), MoshpitLayout + MoshpitCanvas edits, one test update, one human checkpoint.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-asset-pipeline/02-RESEARCH.md
@.planning/phases/02-asset-pipeline/02-CONTEXT.md
@src/platform/moshpit/components/MoshpitCanvas.vue
@src/views/layouts/MoshpitLayout.vue
@src/platform/moshpit/services/layoutMath.ts
@src/platform/moshpit/services/contentHash.ts
@src/platform/moshpit/composables/useMoshpitAssetRegistry.ts
@src/platform/moshpit/composables/useMoshpitProcessingQueue.ts
@src/platform/moshpit/stores/moshpitThumbStore.ts

<interfaces>
```typescript
// useMoshpitSpriteLayer.ts
import type { ProcessingQueueState } from '@/platform/moshpit/composables/useMoshpitProcessingQueue'

export interface SpriteLayerOptions {
readonly viewport: Viewport
readonly ticker: Ticker // app.ticker
/\*\*

- REQUIRED. The single ProcessingQueueState owned by MoshpitLayout.
- Passing this in (rather than calling useMoshpitProcessingQueue() inside
- the composable) avoids instantiating a second WorkerBridge. See revision
- note iter 1 / Blocker 1.
  \*/
  readonly queue: ProcessingQueueState
  readonly cellSize?: number // default 560 (512 + 48 gap)
  }

export function useMoshpitSpriteLayer(options: SpriteLayerOptions): {
destroy(): void
}

// Internal constants
export const DEFAULT_CELL_SIZE = 560
export const REPACK_DURATION_MS = 300

````

**Prop-drilling chain:**
- `MoshpitLayout.vue` — `const queue = useMoshpitProcessingQueue()` (only call site)
- `MoshpitLayout.vue` — passes `:queue="queue"` to `<MoshpitView>`
- `MoshpitView.vue` (or `MoshpitCanvas.vue` directly if MoshpitView is a thin wrapper) — accepts `queue: ProcessingQueueState` prop, forwards to `MoshpitCanvas`
- `MoshpitCanvas.vue` — `useMoshpitSpriteLayer({ viewport, ticker: app.ticker, queue: props.queue })`

If the component chain has an intermediate wrapper (MoshpitView) that would be awkward to thread the prop through, use `provide` in MoshpitLayout + `inject` in MoshpitCanvas with a typed `InjectionKey<ProcessingQueueState>`. Document the choice in the SUMMARY.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Build useMoshpitSpriteLayer with injected queue + watchEffect sync + 300ms re-pack tween</name>
  <read_first>
    - .planning/phases/02-asset-pipeline/02-RESEARCH.md §PixiJS v8 Sprite Batching Strategy + §PixiJS Sprite Container Added to Viewport + §Layout Seed Hash + Jittered Grid Math (Ticker tween)
    - src/platform/moshpit/services/layoutMath.ts (computeJitteredGrid, computePackedGrid)
    - src/platform/moshpit/services/contentHash.ts (layoutSeedHash)
    - src/platform/moshpit/composables/useMoshpitAssetRegistry.ts (entries shape — includes OSS-path hash from Plan 08 revision)
    - src/platform/moshpit/composables/useMoshpitProcessingQueue.ts (ProcessingQueueState type — import as TYPE ONLY; do NOT import `useMoshpitProcessingQueue` function)
    - src/views/layouts/MoshpitLayout.vue (Plan 09 — the single owner of the queue; confirms prop/inject chain)
    - src/platform/moshpit/stores/moshpitThumbStore.ts (for `getUrl` — reactive dep that watchEffect must track)
    - node_modules/pixi.js (Container, Sprite, Texture, Ticker types — use `import type`)
  </read_first>
  <action>
Create `src/platform/moshpit/composables/useMoshpitSpriteLayer.ts`:

```typescript
/**
 * Sprite layer composable — ASSET-02 + ASSET-07 + ASSET-09.
 *
 * Owns:
 *   - A single PixiJS `Container` mounted under the `Viewport`
 *   - `Map<contentHash, Sprite>` for O(1) add/remove by registry diff
 *   - The jittered-grid (D-01) → packed-grid (D-04) transition tween
 *
 * Consumes (via `options`):
 *   - `viewport` + `ticker` — Pixi infrastructure owned by MoshpitCanvas
 *   - `queue: ProcessingQueueState` — THE SINGLE queue instance owned by
 *     MoshpitLayout. This composable MUST NOT call useMoshpitProcessingQueue()
 *     itself; doing so instantiates a second WorkerBridge and the `total/done`
 *     counters never tick, breaking the re-pack tween.
 *
 * Consumes (via composables — stateless reads of already-instantiated stores):
 *   - `useMoshpitAssetRegistry().entries` — reactive source of truth for
 *     which sprites should exist right now
 *   - `useMoshpitThumbStore().getUrl` — blob URL for a sprite texture; the
 *     watchEffect tracks this via reads inside `syncSprites`
 *
 * Reactivity contract:
 *   - `watchEffect(() => syncSprites(registry.entries.value))` — re-runs
 *     whenever ANY reactive dep read inside `syncSprites` mutates, including
 *     `thumbStore.urlByHash` (via `registry.entries.value[i].thumbUrl`) and
 *     `metaStore.assetIdToHash` (via the registry's OSS-path fallback).
 *     Do NOT use `watch(() => registry.entries.value.length, ...)` — it
 *     misses thumbReady events that don't change asset count.
 *
 * Texture configuration:
 *   - `autoGenerateMipmaps: true` — smooth LOD at far zoom
 *   - `autoGarbageCollect: true` — PixiJS may unload off-screen textures
 *   - Container `cullable: true` — skip off-screen sprites each frame
 *
 * Coordinate system: world-space (the Container lives under the Viewport, so
 * pan/zoom transforms the sprites automatically). `cellSize` is logical pixels.
 */

import { Container, ImageSource, Sprite, Texture } from 'pixi.js'
import type { Ticker } from 'pixi.js'
import type { Viewport } from 'pixi-viewport'
import { onBeforeUnmount, watch, watchEffect } from 'vue'

import { layoutSeedHash } from '@/platform/moshpit/services/contentHash'
import type { GridSlot } from '@/platform/moshpit/services/layoutMath'
import {
  computeJitteredGrid,
  computePackedGrid
} from '@/platform/moshpit/services/layoutMath'
import { useMoshpitAssetRegistry } from '@/platform/moshpit/composables/useMoshpitAssetRegistry'
import type { ProcessingQueueState } from '@/platform/moshpit/composables/useMoshpitProcessingQueue'
import { useMoshpitThumbStore } from '@/platform/moshpit/stores/moshpitThumbStore'

export const DEFAULT_CELL_SIZE = 560
export const REPACK_DURATION_MS = 300

export interface SpriteLayerOptions {
  readonly viewport: Viewport
  readonly ticker: Ticker
  readonly queue: ProcessingQueueState
  readonly cellSize?: number
}

interface SpriteEntry {
  readonly sprite: Sprite
  slot: GridSlot
}

export function useMoshpitSpriteLayer(
  options: SpriteLayerOptions
): { destroy(): void } {
  const cellSize = options.cellSize ?? DEFAULT_CELL_SIZE
  const queue = options.queue
  const registry = useMoshpitAssetRegistry()
  const thumbStore = useMoshpitThumbStore()
  void thumbStore // kept as explicit reference for code-review clarity; reads happen via registry.entries

  const container = new Container()
  container.label = 'moshpit-sprites'
  container.cullable = true
  options.viewport.addChild(container)

  const spriteMap = new Map<string, SpriteEntry>()
  let currentSlots: GridSlot[] = []
  void currentSlots // written by syncSprites, read only by tests / future hooks

  function computeLayoutSlots(hashes: readonly string[]): GridSlot[] {
    const sorted = [...hashes].sort()
    const seed = layoutSeedHash(queue.activeFilterId.value, sorted)
    return computeJitteredGrid(sorted, seed, cellSize)
  }

  function makeSprite(contentHash: string, thumbUrl: string): Sprite {
    const texture = Texture.from(thumbUrl)
    // Upgrade texture source options after Texture.from creates it. In Pixi v8
    // mipmaps default on for image resources; the explicit sets keep the
    // contract visible for future maintainers.
    if (texture.source instanceof ImageSource) {
      texture.source.autoGenerateMipmaps = true
      texture.source.autoGarbageCollect = true
    }
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.label = `moshpit-sprite:${contentHash}`
    return sprite
  }

  function applySlot(entry: SpriteEntry, slot: GridSlot): void {
    entry.slot = slot
    entry.sprite.x = slot.worldX
    entry.sprite.y = slot.worldY
  }

  function syncSprites(entries: readonly {
    readonly id: string
    readonly contentHash: string
    readonly thumbUrl: string | undefined
    readonly hasMetadata: boolean
  }[]): void {
    const hashes = entries.map((e) => e.contentHash)
    const slots = computeLayoutSlots(hashes)
    currentSlots = slots
    const slotByHash = new Map(slots.map((s) => [s.hash, s]))

    // Remove sprites whose asset is no longer in the registry
    for (const [hash, entry] of spriteMap) {
      if (!slotByHash.has(hash)) {
        container.removeChild(entry.sprite)
        entry.sprite.destroy()
        spriteMap.delete(hash)
      }
    }

    // Add / update sprites. `entry.thumbUrl` is the reactive dep that makes
    // thumbReady events trigger this watchEffect.
    for (const entry of entries) {
      if (!entry.thumbUrl) continue
      const slot = slotByHash.get(entry.contentHash)
      if (!slot) continue
      const existing = spriteMap.get(entry.contentHash)
      if (!existing) {
        const sprite = makeSprite(entry.contentHash, entry.thumbUrl)
        const newEntry: SpriteEntry = { sprite, slot }
        applySlot(newEntry, slot)
        spriteMap.set(entry.contentHash, newEntry)
        container.addChild(sprite)
      } else {
        applySlot(existing, slot)
      }
    }
  }

  function startRepackTween(): void {
    const hashes = Array.from(spriteMap.keys()).sort()
    const packed = computePackedGrid(hashes, cellSize)
    const packedByHash = new Map(packed.map((p) => [p.hash, p]))
    const fromByHash = new Map<string, { x: number; y: number }>()
    for (const [hash, entry] of spriteMap) {
      fromByHash.set(hash, { x: entry.sprite.x, y: entry.sprite.y })
    }

    let elapsed = 0
    const handler = (ticker: Ticker) => {
      elapsed += ticker.deltaMS
      const t = Math.min(elapsed / REPACK_DURATION_MS, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out-cubic
      for (const [hash, entry] of spriteMap) {
        const to = packedByHash.get(hash)
        const from = fromByHash.get(hash)
        if (!to || !from) continue
        entry.sprite.x = from.x + (to.worldX - from.x) * eased
        entry.sprite.y = from.y + (to.worldY - from.y) * eased
      }
      if (t >= 1) {
        // Finalize slots
        for (const [hash, entry] of spriteMap) {
          const to = packedByHash.get(hash)
          if (to) entry.slot = to
        }
        options.ticker.remove(handler)
      }
    }
    options.ticker.add(handler)
  }

  // Watch registry for sprite add/remove/thumb-arrival.
  // watchEffect automatically tracks every reactive dep read inside the
  // callback, including `registry.entries.value[i].thumbUrl` (which reads
  // `thumbStore.urlByHash` via the computed chain), so progressive thumb
  // arrival triggers sync even when asset count is unchanged.
  const stopRegistryEffect = watchEffect(() => {
    syncSprites(registry.entries.value)
  })

  // Watch processing completion → fire re-pack tween once per completion
  let hasRepacked = false
  const stopCompletionWatch = watch(
    () => queue.total.value > 0 && queue.done.value === queue.total.value,
    (complete) => {
      if (complete && !hasRepacked) {
        hasRepacked = true
        startRepackTween()
      } else if (!complete) {
        hasRepacked = false
      }
    }
  )

  function destroy(): void {
    stopRegistryEffect()
    stopCompletionWatch()
    for (const [, entry] of spriteMap) {
      entry.sprite.destroy()
    }
    spriteMap.clear()
    container.destroy({ children: true })
  }

  onBeforeUnmount(destroy)

  return { destroy }
}
````

Constraints:

- NO `any`, NO `as any`.
- NO `console.log`.
- Import `Ticker` via `import type` (it is a type — the runtime instance comes from `app.ticker`).
- Import `ProcessingQueueState` via `import type` — the runtime value (`useMoshpitProcessingQueue`) is NEVER called here.
- `container.cullable = true` is mandatory for 5k-scale VRAM safety.
- `watchEffect` is mandatory — a length-based `watch` is a regression (Blocker 2).
- The `options.queue` parameter is mandatory — a fallback to `useMoshpitProcessingQueue()` is a regression (Blocker 1).
  </action>
  <verify>
  <automated>pnpm typecheck &amp;&amp; pnpm test:unit --run src/platform/moshpit</automated>
  </verify>
  <acceptance_criteria> - `test -f src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` exits 0 - `grep "cullable = true" src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` returns a match - `grep "autoGenerateMipmaps" src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` returns at least one match - `grep "autoGarbageCollect" src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` returns at least one match - `grep "computeJitteredGrid\\|computePackedGrid" src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` returns at least 2 matches - `grep "layoutSeedHash" src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` returns a match - `grep "REPACK_DURATION_MS = 300" src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` returns a match - `grep "1 - Math.pow(1 - t, 3)" src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` returns a match (ease-out-cubic) - `grep "\\b: any\\b\\|as any" src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` returns zero matches - **Blocker 1 guard:** `grep "useMoshpitProcessingQueue(" src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` returns ZERO matches (import-as-type only; never called) - **Blocker 1 guard:** `grep "import type.*ProcessingQueueState" src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` returns a match (type-only import) - **Blocker 1 guard:** `grep "options.queue\\|options\\.queue" src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` returns at least one match (the injected queue is used) - **Blocker 2 guard:** `grep "watchEffect(" src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` returns at least one match - **Blocker 2 guard:** `grep "registry.entries.value.length" src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` returns ZERO matches (no regression to length-based watch) - `pnpm typecheck` exits 0 - `pnpm test:unit --run src/platform/moshpit` exits 0 (no regression)
  </acceptance_criteria>
  <done>Sprite layer composable ships with lifecycle, culling, texture options, injected queue state, watchEffect sync, and re-pack tween — Blockers 1 and 2 guarded.</done>
  </task>

<task type="auto" tdd="false">
  <name>Task 2: Thread ProcessingQueueState through MoshpitLayout → MoshpitCanvas → useMoshpitSpriteLayer</name>
  <read_first>
    - src/views/layouts/MoshpitLayout.vue (full — Plan 09 made this the single queue owner; confirm the queue variable is already declared)
    - src/platform/moshpit/components/MoshpitCanvas.vue (full — find the `onMounted` block after viewport creation)
    - src/platform/moshpit/components/MoshpitCanvas.test.ts (understand the existing vi.mock shape)
    - src/platform/moshpit/composables/useMoshpitSpriteLayer.ts (just created — note the `options.queue` requirement)
    - src/views/MoshpitView.vue (if it exists as a pass-through wrapper; may need to forward the prop)
  </read_first>
  <action>
**1. `src/views/layouts/MoshpitLayout.vue` — pass the queue down:**

MoshpitLayout already calls `const queue = useMoshpitProcessingQueue()` (Plan 09). Extend the template so the queue state reaches MoshpitCanvas. Two acceptable shapes — pick based on the current MoshpitView wrapper:

**Option A — prop drilling (if MoshpitView is a thin wrapper):**

```vue
<MoshpitView :queue="queue" />
```

And in `src/views/MoshpitView.vue`:

```typescript
const { queue } = defineProps<{ queue: ProcessingQueueState }>()
```

Forward to `<MoshpitCanvas :queue="queue" />`.

**Option B — provide/inject (if MoshpitView is non-trivial):**

In MoshpitLayout.vue:

```typescript
import { provide } from 'vue'
import { MOSHPIT_QUEUE_INJECTION_KEY } from '@/platform/moshpit/composables/useMoshpitProcessingQueue'

provide(MOSHPIT_QUEUE_INJECTION_KEY, queue)
```

Add to `useMoshpitProcessingQueue.ts`:

```typescript
import type { InjectionKey } from 'vue'
export const MOSHPIT_QUEUE_INJECTION_KEY: InjectionKey<ProcessingQueueState> =
  Symbol('moshpit:queue')
```

Pick the option whose wrapper shape is simpler. Document in the SUMMARY.

**2. `src/platform/moshpit/components/MoshpitCanvas.vue` — accept and forward:**

If Option A: add `const { queue } = defineProps<{ queue: ProcessingQueueState }>()` at the top.
If Option B: `const queue = inject(MOSHPIT_QUEUE_INJECTION_KEY); if (!queue) throw new Error('MoshpitCanvas requires queue injection')`.

After the `useMoshpitSpacePan(viewport, containerEl)` call (line ~64), before the `viewportStore.setScreenSize(...)` call, add:

```typescript
const spriteLayer = useMoshpitSpriteLayer({
  viewport,
  ticker: app.ticker,
  queue
})
spriteLayerRef = spriteLayer
```

At the top-of-script, add the import:

```typescript
import { useMoshpitSpriteLayer } from '@/platform/moshpit/composables/useMoshpitSpriteLayer'
import type { ProcessingQueueState } from '@/platform/moshpit/composables/useMoshpitProcessingQueue'
```

At module-local state level (near `let app: Application | null = null`), add:

```typescript
let spriteLayerRef: { destroy(): void } | null = null
```

In the `onBeforeUnmount` hook, add `spriteLayer` teardown BEFORE the viewport/app destroy:

```typescript
if (spriteLayerRef) {
  spriteLayerRef.destroy()
  spriteLayerRef = null
}
```

**3. `src/platform/moshpit/components/MoshpitCanvas.test.ts` — mock and feed the new composable + prop:**

```typescript
vi.mock('@/platform/moshpit/composables/useMoshpitSpriteLayer', () => ({
  useMoshpitSpriteLayer: vi.fn(() => ({ destroy: vi.fn() })),
  DEFAULT_CELL_SIZE: 560,
  REPACK_DURATION_MS: 300
}))
```

Also ensure test mount passes a fake `queue` prop (or provides the injection key) matching `ProcessingQueueState`:

```typescript
import { ref, computed } from 'vue'
const fakeQueue = {
  total: ref(0),
  done: ref(0),
  activeFilterId: ref(''),
  isActive: computed(() => false),
  setFilter: vi.fn(),
  cancel: vi.fn(),
  destroy: vi.fn()
}
// Option A: mount(MoshpitCanvas, { props: { queue: fakeQueue } })
// Option B: mount(MoshpitCanvas, { global: { provide: { [MOSHPIT_QUEUE_INJECTION_KEY as symbol]: fakeQueue } } })
```

Insert the mock next to the existing `vi.mock('@/platform/moshpit/composables/useMoshpitSpacePan'` call.

Constraints:

- Do NOT remove the `cancelled` guard, the viewport setup, or the RAF tick loop.
- The sprite layer install must happen AFTER viewport is created (inside `onMounted`, same scope as `useMoshpitSpacePan`).
- Teardown order: sprite layer first, then `app.destroy({children:true})` — the sprite container lives under the viewport, which lives under the stage; the cascade from `app.destroy` would also tear down sprites but explicit destroy gives us a clean error channel.
- **Critical:** `useMoshpitProcessingQueue()` is called EXACTLY ONCE in the codebase — in `MoshpitLayout.vue`. Any other call site is a regression.
  </action>
  <verify>
  <automated>pnpm test:unit --run src/platform/moshpit/components/MoshpitCanvas.test.ts &amp;&amp; pnpm typecheck</automated>
  </verify>
  <acceptance_criteria> - `grep "useMoshpitSpriteLayer" src/platform/moshpit/components/MoshpitCanvas.vue` returns at least 2 matches (import + invoke) - `grep "spriteLayerRef.destroy" src/platform/moshpit/components/MoshpitCanvas.vue` returns a match - `grep "vi.mock.*useMoshpitSpriteLayer" src/platform/moshpit/components/MoshpitCanvas.test.ts` returns a match - **Single-bridge invariant:** `grep -rn "useMoshpitProcessingQueue(" src/platform/moshpit src/views/layouts src/views/MoshpitView.vue 2>/dev/null | grep -v ".test.ts\\|.spec.ts\\|useMoshpitProcessingQueue.ts"` returns EXACTLY ONE match — the call in `src/views/layouts/MoshpitLayout.vue` - MoshpitCanvas either accepts a `queue` prop OR injects `MOSHPIT_QUEUE_INJECTION_KEY`; the chosen path is documented in the SUMMARY - `pnpm test:unit --run src/platform/moshpit/components/MoshpitCanvas.test.ts` exits 0 - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>Single-bridge invariant enforced; sprite layer wired into the canvas lifecycle; existing Phase 1 tests still GREEN with the new mock + queue prop/inject.</done>
  </task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human verification — sprites render progressively, 60fps pan/zoom, re-pack tween quality</name>
  <what-built>
    - `useMoshpitSpriteLayer` composable converting `AssetEntry[]` → Pixi sprites at jittered-grid slots (single injected queue, watchEffect sync)
    - MoshpitLayout owns the single `useMoshpitProcessingQueue`; state threaded to canvas via prop or inject
    - 300ms ease-out-cubic re-pack tween after processing completes
    - Texture options: `autoGenerateMipmaps`, `autoGarbageCollect`, container `cullable`
  </what-built>
  <how-to-verify>
    1. Start backend: `conda activate comfyui &amp;&amp; cd /Users/willie/Documents/projects/comfy/ComfyUI &amp;&amp; python main.py`
    2. Start frontend: `pnpm dev`
    3. Open `http://localhost:5173/moshpit`
    4. Open DevTools → Performance, start recording
    5. Generate ~20–50 test outputs via the workflow graph (or point at an existing outputs folder) — OSS path: these AssetItems have `asset_hash: null` so this also exercises the OSS-path fix from Plan 08
    6. Return to `/moshpit` — sprites should appear PROGRESSIVELY at jittered-grid positions (one-by-one as thumbs land, not in a single batch at the end — Blocker 2 guard)
    7. Pan/zoom during processing — expect 60fps (Performance panel shows no long frames)
    8. When processing completes, observe the 300ms re-pack tween — sprites should glide to packed positions via ease-out-cubic (if they don't move, Blocker 1 has regressed — check there's only one WorkerBridge instance)
    9. Reload the page (warm cache) — sprites should pop in within a single frame, indicator should NOT appear (D-08)
    10. Run cancel on a cold cache mid-processing — indicator disappears, completed sprites stay; re-entering /moshpit resumes processing for remaining assets (D-06 + D-07)
  </how-to-verify>
  <resume-signal>
    Reply with "approved" if all behaviors work, or describe issues:
    - [ ] Sprites appear PROGRESSIVELY (one-by-one as thumbs arrive, not all at once at the end) — Blocker 2 guard
    - [ ] 60fps sustained during processing on a 20-asset set (scale-up at 5k is Phase 7 proof)
    - [ ] Re-pack tween fires on completion, smooth easing (if tween never fires, Blocker 1 regression)
    - [ ] Warm cache populates in one frame with no pill (D-08)
    - [ ] Cancel + resume round-trip preserves completed thumbs
    - [ ] OSS-path (local ComfyUI, no server asset_hash) assets render — Plan 08 fix verified end-to-end
  </resume-signal>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                    | Description                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| Pixi GPU textures ← blob URLs               | Blob URLs from worker-produced WebP blobs; origin is same-origin (`blob:`) |
| SpriteLayer ← injected ProcessingQueueState | Trusted — single instance owned by MoshpitLayout, never forged             |

## STRIDE Threat Register

| Threat ID  | Category          | Component                                                                                                                                                                                                | Disposition | Mitigation Plan                                                                                                                                                                                                             |
| ---------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-02-11-01 | Denial of Service | VRAM exhaustion at 5k sprites                                                                                                                                                                            | mitigate    | `container.cullable = true` + `autoGarbageCollect: true` on each texture source. Phase 7 will validate the 5k budget; if VRAM is exceeded, the GC unloads invisible textures.                                               |
| T-02-11-02 | Denial of Service | Main-thread jank during sprite creation burst                                                                                                                                                            | mitigate    | Sprite creation happens one-at-a-time on thumbReady callbacks (watchEffect re-runs per `thumbStore.urlByHash` mutation); `runWhenGlobalIdle` in the bridge rate-limits dispatch. No batch loops.                            |
| T-02-11-03 | Tampering         | Malicious blob URL causing decode crash                                                                                                                                                                  | mitigate    | PixiJS `Texture.from` reports decode errors via the event system; crashes are bounded to a single sprite, not the whole scene.                                                                                              |
| T-02-11-04 | Denial of Service | Tween handler leaks if component unmounts mid-tween                                                                                                                                                      | mitigate    | `destroy()` removes watches; stale Ticker handlers naturally run against destroyed sprites and their `if (!sprite) continue` guards exit safely. The app.destroy in the parent MoshpitCanvas unmount also kills the ticker. |
| T-02-11-05 | Tampering         | Second `useMoshpitProcessingQueue()` call creates a second WorkerBridge in parallel → sprites render but tween never fires AND worker starts a second thread (double-cost on an already-tight 5k budget) | mitigate    | Acceptance criterion greps for exactly one call site. Single-bridge invariant is documented in both `useMoshpitSpriteLayer.ts` header and in this threat model.                                                             |

</threat_model>

<verification>
- `pnpm test:unit --run src/platform/moshpit` — all existing tests GREEN
- `pnpm typecheck` exits 0
- Single-bridge grep invariant holds (Task 2 acceptance criterion)
- Human checkpoint PASS (blocking gate)
- VALIDATION.md Manual-Only rows for "60fps during cold-cache" and "re-pack tween easing quality" addressed here (full 5k perf validation is Phase 7)
</verification>

<success_criteria>

- Sprite layer composable ships with single injected queue + watchEffect sync
- Canvas mounts the sprite container under the Viewport
- Re-pack tween runs once on processing completion (proves single-bridge)
- Human checkpoint signs off visual fidelity + progressive appearance
- OSS-path assets visible in the canvas (end-to-end Plan 08 validation)
  </success_criteria>

<output>
Create `.planning/phases/02-asset-pipeline/02-11-SUMMARY.md` documenting:
- Observed fps, tween smoothness, pixi-viewport gotchas
- Whether prop-drill (Option A) or provide/inject (Option B) was used
- Confirmation that the single-bridge grep invariant holds
- Any watchEffect reactivity edge-cases encountered (e.g. Pinia ref<Map> dep tracking)
</output>
