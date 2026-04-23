---
phase: 260423-ltc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/platform/moshpit/composables/useMoshpitSpriteLayer.ts
  - src/platform/moshpit/composables/useMoshpitSpriteLayer.test.ts
  - src/platform/moshpit/composables/useMoshpitViewportInjection.ts
  - src/platform/moshpit/composables/useMoshpitSpriteResize.ts
  - src/platform/moshpit/composables/useMoshpitSpriteResize.test.ts
  - src/platform/moshpit/components/MoshpitCanvas.vue
  - src/views/MoshpitView.vue
autonomous: true
requirements:
  - QUICK-260423-ltc
tags: [moshpit, pixi, pinia, sprite-layer, resize, pointer-events, overrides]

must_haves:
  truths:
    - "User sees 4 white square resize handles at the AABB corners of a sprite when it's the sole selection."
    - 'Dragging a corner handle uniformly scales the sprite — distance-from-center drives scale delta.'
    - 'Handle drag writes to moshpitOverrideStore.setScale(hash, scale) with MIN 0.25 / MAX 5 clamp.'
    - 'pixi-viewport drag is paused while resizing and resumed on pointerup/pointercancel/Escape/unmount.'
    - 'Escape during a resize restores the pre-resize scale (or clears the override if none existed).'
    - 'Release at scale ≈ 1 (within 0.01) clears the override via clearScale(hash).'
    - 'Resize takes precedence over drag-to-pin when a corner handle is under the pointer.'
    - 'Resize handles only render for selections of size === 1 (multi-select resize is out of scope).'
  artifacts:
    - path: 'src/platform/moshpit/composables/useMoshpitSpriteResize.ts'
      provides: 'useMoshpitSpriteResize composable + SpriteResizeHandle/Options types'
      exports:
        ['useMoshpitSpriteResize', 'SpriteResizeHandle', 'SpriteResizeOptions']
    - path: 'src/platform/moshpit/composables/useMoshpitSpriteResize.test.ts'
      provides: 'Behavioural Vitest coverage for the resize composable'
    - path: 'src/platform/moshpit/composables/useMoshpitSpriteLayer.ts'
      provides: 'resizeHandles Pixi Container + hitTestHandle + cornerHitTest helper'
      contains: 'resizeHandles, hitTestHandle, cornerHitTest'
    - path: 'src/platform/moshpit/composables/useMoshpitViewportInjection.ts'
      provides: 'Extended SpriteHitTester interface with hitTestHandle'
      contains: 'hitTestHandle'
  key_links:
    - from: 'src/views/MoshpitView.vue'
      to: 'useMoshpitSpriteResize.onPointerDown'
      via: 'onContainerPointerDown, before spriteDrag.onPointerDown'
      pattern: "spriteResize\\.onPointerDown"
    - from: 'src/platform/moshpit/composables/useMoshpitSpriteResize.ts'
      to: 'moshpitOverrideStore.setScale / clearScale'
      via: 'pointermove delta → scale write, pointerup → epsilon-clear'
      pattern: "overrideStore\\.(setScale|clearScale)"
    - from: 'src/platform/moshpit/composables/useMoshpitSpriteLayer.ts'
      to: 'resizeHandles Container under viewport'
      via: 'options.viewport.addChild(resizeHandles) alongside selectionRings'
      pattern: 'resizeHandles'
    - from: 'src/platform/moshpit/components/MoshpitCanvas.vue'
      to: 'spriteHitTestRef.value.hitTestHandle'
      via: 'wired from spriteLayerRef.hitTestHandle in onMounted'
      pattern: "hitTestHandle: spriteLayerRef\\.hitTestHandle"
---

<objective>
Add four-corner resize handles to pinned/selected sprites in the Moshpit canvas. Dragging a
corner uniformly scales the sprite via `moshpitOverrideStore.setScale(hash, scale)`. Handles
are drawn as world-space Pixi Graphics siblings of the existing selection rings; the gesture
lives in a new composable modeled on `useMoshpitSpriteDrag`; wiring into `MoshpitView` places
resize ahead of drag-to-pin in the pointer precedence chain.

Purpose: Sprite-control UX — the third leg of pin/scale mutations after drag-to-pin (`260423-kdv`)
and the foundation store (`260423-j4f`). Store primitives (`setScale` / `clearScale`) already
exist; this task adds the gesture and the Pixi handle visuals.

Output:

- New composable `useMoshpitSpriteResize` (source + test)
- Extended `useMoshpitSpriteLayer` with a `resizeHandles` Container and `hitTestHandle`
- Extended `SpriteHitTester` interface (hitTestHandle wired through MoshpitCanvas)
- Resize-first precedence in `MoshpitView.onContainerPointerDown`
- Pure helper `cornerHitTest` covered by unit tests
  </objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260423-j4f-add-sprite-controls-to-moshpit-canvas-ma/260423-j4f-SUMMARY.md
@.planning/quick/260423-kdv-drag-to-pin-sprites-in-moshpit-canvas-le/260423-kdv-SUMMARY.md
@src/platform/moshpit/stores/moshpitOverrideStore.ts
@src/platform/moshpit/stores/moshpitSelectionStore.ts
@src/platform/moshpit/composables/useMoshpitSpriteLayer.ts
@src/platform/moshpit/composables/useMoshpitSpriteDrag.ts
@src/platform/moshpit/composables/useMoshpitViewportInjection.ts
@src/platform/moshpit/components/MoshpitCanvas.vue
@src/views/MoshpitView.vue

<interfaces>
<!-- Key contracts the executor needs — extracted from the codebase. No exploration required. -->

From src/platform/moshpit/stores/moshpitOverrideStore.ts (already implemented):

```ts
export interface OverrideRecord {
  readonly pinnedWorldPos?: { x: number; y: number }
  readonly scale?: number
  readonly pinnedAt: number
}
// Store API (Setup store):
//   get(hash): OverrideRecord | undefined
//   setScale(hash, scale): void   // preserves pinnedWorldPos
//   clearScale(hash): void        // strips scale; deletes record iff no pin left
```

From src/platform/moshpit/composables/useMoshpitViewportInjection.ts (current):

```ts
export interface SpriteHitTester {
  hitTestPoint(worldX, worldY): string | null
  hitTestRect(rect: SpriteHitRect): string[]
  getSpriteWorldPos(hash): { x: number; y: number } | null
  // NEW in this plan:
  // hitTestHandle(worldX, worldY): { hash: string; corner: 'tl'|'tr'|'bl'|'br' } | null
}
```

From src/platform/moshpit/composables/useMoshpitSpriteLayer.ts (current — extend, don't rewrite):

```ts
export interface SpriteLayerHandle {
  destroy(): void
  hitTestPoint(worldX, worldY): string | null
  hitTestRect(rect: SpriteHitRect): string[]
  getSpriteWorldPos(hash): { x: number; y: number } | null
  // NEW in this plan:
  // hitTestHandle(worldX, worldY): { hash; corner } | null
}
// Existing: a single selection watchEffect already reads `overrides.size`
// and rebuilds selectionRings. Extend THIS effect to rebuild resizeHandles
// in the same pass — do NOT add a new watcher.
```

From src/platform/moshpit/composables/useMoshpitSpriteDrag.ts (pattern to mirror):

```ts
// Pattern: containerEl/viewportRef/hitTestRef refs, document pointerup/move
// listeners attached in onPointerDown, detached on up/cancel, onScopeDispose
// safety net, viewport.plugins.pause('drag') / resume('drag') symmetry,
// Escape aborts & restores from pre-gesture snapshot.
```

Conventions (from CLAUDE.md / AGENTS.md):

- Vue 3.5 Composition API, `<script setup lang="ts">` only.
- No `any`, no `as any`, no `@ts-expect-error`.
- Separate `import type` statements; no inline mixed type imports.
- No barrel files; export only what's consumed externally.
- Use `cn()` from `@/utils/tailwindUtil` if merging Tailwind classes (N/A here — Pixi only).
- i18n: no new user-facing strings in this plan (handles are visual-only).
- Commit prefix: `feat(260423-ltc): …`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` must be clean before commit.

Constants:

```ts
const HANDLE_SIZE_WORLD = 20 // logical px, world-space; matches selection ring thickness scale
const HANDLE_FILL = 0xffffff
const HANDLE_STROKE = 0x000000
const HANDLE_STROKE_WIDTH = 2
const MIN_SCALE = 0.25
const MAX_SCALE = 5
const CLEAR_SCALE_EPSILON = 0.01
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend sprite layer with resize handles + hitTestHandle</name>
  <files>
    src/platform/moshpit/composables/useMoshpitSpriteLayer.ts,
    src/platform/moshpit/composables/useMoshpitSpriteLayer.test.ts,
    src/platform/moshpit/composables/useMoshpitViewportInjection.ts
  </files>
  <behavior>
    - `cornerHitTest({ x, y }, sprite, handleSize)` pure helper (new `@internal` export):
      - Returns `'tl' | 'tr' | 'bl' | 'br' | null` based on which corner's square
        `[corner - handleSize/2, corner + handleSize/2]` contains the point.
      - Corners are computed from `sprite.x / sprite.y` + `sprite.width / sprite.height / 2`
        (anchor is 0.5). Accepts a structural `{ x, y, width, height }` shape for
        happy-dom unit testability (no Pixi required).
      - Test cases: hit each of 4 corners, miss at center, miss outside AABB entirely,
        miss at an edge midpoint, handles stay square under non-uniform sprite scale
        (sprite scale only; world handleSize is fixed in this helper — scale
        compensation is layer-side concern, not helper-side).
    - `hitTestHandle(worldX, worldY)` on the SpriteLayerHandle:
      - Iterates `spriteMap` and calls `cornerHitTest` with `HANDLE_SIZE_WORLD`.
      - Returns `{ hash, corner }` on first hit, `null` if none.
      - Only considers sprites whose hash is in a single-element selection
        (`selection.size === 1 && selection.selected[0] === hash`).
  </behavior>
  <action>
Extend `useMoshpitSpriteLayer.ts`:

1. Add constants at module scope (after `DEFAULT_CELL_SIZE`):

   ```ts
   const HANDLE_SIZE_WORLD = 20
   const HANDLE_FILL = 0xffffff
   const HANDLE_STROKE = 0x000000
   const HANDLE_STROKE_WIDTH = 2
   ```

2. Add `@internal` pure helper `cornerHitTest` (co-located with `resolveSlot` /
   `resolveSpriteScale` — same pattern):

   ```ts
   /** @internal */
   export function cornerHitTest(
     point: { x: number; y: number },
     sprite: { x: number; y: number; width: number; height: number },
     handleSize: number
   ): 'tl' | 'tr' | 'bl' | 'br' | null {
     const halfW = sprite.width / 2
     const halfH = sprite.height / 2
     const halfH_ = handleSize / 2
     const corners: readonly ['tl' | 'tr' | 'bl' | 'br', number, number][] = [
       ['tl', sprite.x - halfW, sprite.y - halfH],
       ['tr', sprite.x + halfW, sprite.y - halfH],
       ['bl', sprite.x - halfW, sprite.y + halfH],
       ['br', sprite.x + halfW, sprite.y + halfH]
     ]
     for (const [id, cx, cy] of corners) {
       if (
         point.x >= cx - halfH_ &&
         point.x <= cx + halfH_ &&
         point.y >= cy - halfH_ &&
         point.y <= cy + halfH_
       )
         return id
     }
     return null
   }
   ```

3. In the composable body, create a `resizeHandles` Container as a sibling of
   `selectionRings`:

   ```ts
   const resizeHandles = new Container()
   resizeHandles.label = 'moshpit-resize-handles'
   resizeHandles.cullable = true
   options.viewport.addChild(resizeHandles)
   const handleMap = new Map<string, Graphics[]>() // hash -> 4 corner Graphics
   ```

4. Add a `drawHandles(entry: SpriteEntry)` helper mirroring `drawRing`:
   - Computes the four corner world coords from `entry.sprite.x/y/width/height`.
   - Creates 4 small `Graphics` squares (HANDLE_SIZE_WORLD × HANDLE_SIZE_WORLD,
     fill HANDLE_FILL, stroke HANDLE_STROKE @ HANDLE_STROKE_WIDTH), anchored at
     each corner (positioned via `g.x = cornerX - HANDLE_SIZE_WORLD/2`,
     `g.y = cornerY - HANDLE_SIZE_WORLD/2`).
   - Returns the array; caller adds each to `resizeHandles`.

5. Extend the existing `stopSelectionEffect` watchEffect (DO NOT add a new watcher):
   - After the ring rebuild block, rebuild handles with the same single-selection
     filter:
     ```ts
     // Rebuild handles (destroy existing first).
     for (const [hash, gs] of handleMap) {
       for (const g of gs) {
         resizeHandles.removeChild(g)
         g.destroy()
       }
       handleMap.delete(hash)
     }
     // Only render handles for single-element selection.
     if (ids.size === 1) {
       const [onlyHash] = ids
       const entry = spriteMap.get(onlyHash)
       if (entry) {
         const gs = drawHandles(entry)
         handleMap.set(onlyHash, gs)
         for (const g of gs) resizeHandles.addChild(g)
       }
     }
     ```
   - The existing `void overrides.size` read already makes scale mutations
     re-fire this effect — no extra reactive plumbing needed.

6. Implement `hitTestHandle` method on the returned handle:

   ```ts
   function hitTestHandle(
     worldX: number,
     worldY: number
   ): { hash: string; corner: 'tl' | 'tr' | 'bl' | 'br' } | null {
     // Only active for single selection — handles only render for that case.
     if (selection.size !== 1) return null
     const [hash] = selection.selected
     const entry = spriteMap.get(hash)
     if (!entry) return null
     const corner = cornerHitTest(
       { x: worldX, y: worldY },
       {
         x: entry.sprite.x,
         y: entry.sprite.y,
         width: entry.sprite.width,
         height: entry.sprite.height
       },
       HANDLE_SIZE_WORLD
     )
     return corner ? { hash, corner } : null
   }
   ```

7. Extend `SpriteLayerHandle` interface with `hitTestHandle` and return it from
   `useMoshpitSpriteLayer`. Extend `destroy` to destroy each handle Graphics and
   the `resizeHandles` container (mirror the `selectionRings` teardown exactly).

8. In `useMoshpitViewportInjection.ts`, extend `SpriteHitTester` with the same
   `hitTestHandle` signature. Keep it as a required method — MoshpitCanvas wires
   it unconditionally.

Tests — extend `useMoshpitSpriteLayer.test.ts` with a new `describe('cornerHitTest')`
block covering the behaviour bullets above. Do NOT attempt to instantiate the full
composable — Pixi requires WebGL (same constraint as `260423-j4f`). Pure-helper
tests only.
</action>
<verify>
<automated>pnpm test:unit -- src/platform/moshpit/composables/useMoshpitSpriteLayer.test.ts</automated>
</verify>
<done> - `cornerHitTest` helper exported `@internal`, 6+ tests green. - `SpriteLayerHandle.hitTestHandle` and `SpriteHitTester.hitTestHandle` typed. - Single-selection gate enforced inside `hitTestHandle`. - `resizeHandles` Container mounted, handles drawn inside the EXISTING
`stopSelectionEffect` watchEffect (no new watchers). - `destroy()` tears down handles + resizeHandles container cleanly. - `pnpm typecheck` clean on the three files.
</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create useMoshpitSpriteResize composable + tests</name>
  <files>
    src/platform/moshpit/composables/useMoshpitSpriteResize.ts,
    src/platform/moshpit/composables/useMoshpitSpriteResize.test.ts
  </files>
  <behavior>
    Behavioural tests (mock Viewport + SpriteHitTester + ToastStore):
    - Engages (returns true) on handle hit with `button === 0` and no modifiers.
    - Does NOT engage when `hitTestHandle` returns null (fall-through to drag).
    - Does NOT engage when `button !== 0` or modifiers held (mirrors drag rules).
    - Pauses viewport.plugins.drag once on engage, resumes exactly once on pointerup.
    - pointermove: writes `setScale(hash, startScale × currentDist / startDist)`.
    - Clamps output to [MIN_SCALE=0.25, MAX_SCALE=5] — extreme inputs saturate.
    - pointerup at newScale within CLEAR_SCALE_EPSILON=0.01 of 1 → calls `clearScale(hash)`.
    - pointerup at newScale outside epsilon → final `setScale` persists, no clearScale.
    - Escape mid-resize: restores pre-resize state (setScale to prev scale, or clearScale
      if no prior scale existed), resumes viewport, detaches listeners.
    - pointercancel mid-resize: same restore path.
    - onScopeDispose / onBeforeUnmount mid-resize: viewport resumed, listeners detached,
      further pointermoves are no-ops.
    - `startDistance === 0` edge case: guard by treating zero as engage-abort (return
      false from onPointerDown) to avoid division-by-zero; assert composable does not
      crash and no store writes occur.
  </behavior>
  <action>
Create `src/platform/moshpit/composables/useMoshpitSpriteResize.ts`:

```ts
import type { Viewport } from 'pixi-viewport'
import type { Ref } from 'vue'
import { onBeforeUnmount, ref } from 'vue'

import type { SpriteHitTester } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import { useMoshpitOverrideStore } from '@/platform/moshpit/stores/moshpitOverrideStore'

export interface SpriteResizeOptions {
  containerEl: Ref<HTMLElement | null>
  viewportRef: Ref<Viewport | null>
  hitTestRef: Ref<SpriteHitTester | null>
}

export interface SpriteResizeHandle {
  onPointerDown(e: PointerEvent): boolean
  readonly isResizing: Readonly<Ref<boolean>>
}

const MIN_SCALE = 0.25
const MAX_SCALE = 5
const CLEAR_SCALE_EPSILON = 0.01

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function useMoshpitSpriteResize(
  options: SpriteResizeOptions
): SpriteResizeHandle {
  const { containerEl, viewportRef, hitTestRef } = options
  const overrideStore = useMoshpitOverrideStore()

  const isResizing = ref(false)

  let activeHash: string | null = null
  let startScale = 1
  let startDistance = 0
  let spriteCenter = { x: 0, y: 0 }
  let prevScaleSnapshot: number | undefined
  let isPaused = false

  function pauseViewport() {
    if (isPaused) return
    const vp = viewportRef.value
    if (!vp) return
    vp.plugins.pause('drag')
    isPaused = true
  }

  function resumeViewport() {
    if (!isPaused) return
    const vp = viewportRef.value
    if (vp) vp.plugins.resume('drag')
    isPaused = false
  }

  function detachListeners() {
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    document.removeEventListener('pointercancel', onPointerCancel)
    window.removeEventListener('keydown', onKeydown)
  }

  function attachListeners() {
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('keydown', onKeydown)
  }

  function reset() {
    isResizing.value = false
    activeHash = null
    startScale = 1
    startDistance = 0
    spriteCenter = { x: 0, y: 0 }
    prevScaleSnapshot = undefined
  }

  function restorePreResize() {
    if (!activeHash) return
    if (prevScaleSnapshot === undefined) overrideStore.clearScale(activeHash)
    else overrideStore.setScale(activeHash, prevScaleSnapshot)
  }

  function onPointerDown(e: PointerEvent): boolean {
    if (e.button !== 0) return false
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return false

    const el = containerEl.value
    const vp = viewportRef.value
    const hitTester = hitTestRef.value
    if (!el || !vp || !hitTester) return false

    const bounds = el.getBoundingClientRect()
    const worldStart = vp.toWorld(
      e.clientX - bounds.left,
      e.clientY - bounds.top
    )
    const hit = hitTester.hitTestHandle(worldStart.x, worldStart.y)
    if (!hit) return false

    const center = hitTester.getSpriteWorldPos(hit.hash)
    if (!center) return false

    const dx = worldStart.x - center.x
    const dy = worldStart.y - center.y
    const dist = Math.hypot(dx, dy)
    // Degenerate: pointer is exactly at the sprite center (shouldn't happen —
    // corners are non-zero distance from center — but guard the math).
    if (dist === 0) return false

    activeHash = hit.hash
    spriteCenter = { x: center.x, y: center.y }
    startDistance = dist
    startScale = overrideStore.get(hit.hash)?.scale ?? 1
    prevScaleSnapshot = overrideStore.get(hit.hash)?.scale
    isResizing.value = true
    attachListeners()
    pauseViewport()
    return true
  }

  function onPointerMove(e: PointerEvent) {
    if (!activeHash) return
    const el = containerEl.value
    const vp = viewportRef.value
    if (!el || !vp) return
    const bounds = el.getBoundingClientRect()
    const world = vp.toWorld(e.clientX - bounds.left, e.clientY - bounds.top)
    const dx = world.x - spriteCenter.x
    const dy = world.y - spriteCenter.y
    const dist = Math.hypot(dx, dy)
    const raw = startScale * (dist / startDistance)
    const next = clamp(raw, MIN_SCALE, MAX_SCALE)
    overrideStore.setScale(activeHash, next)
  }

  function onPointerUp(_e: PointerEvent) {
    detachListeners()
    if (activeHash) {
      const final = overrideStore.get(activeHash)?.scale
      if (final !== undefined && Math.abs(final - 1) < CLEAR_SCALE_EPSILON) {
        overrideStore.clearScale(activeHash)
      }
    }
    resumeViewport()
    reset()
  }

  function onPointerCancel(_e: PointerEvent) {
    detachListeners()
    restorePreResize()
    resumeViewport()
    reset()
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    if (!isResizing.value && !isPaused) return
    detachListeners()
    restorePreResize()
    resumeViewport()
    reset()
    e.preventDefault()
  }

  onBeforeUnmount(() => {
    detachListeners()
    resumeViewport()
    reset()
  })

  return { onPointerDown, isResizing }
}
```

Tests (`useMoshpitSpriteResize.test.ts`) — mirror `useMoshpitSpriteDrag.test.ts`
structure. Mock viewport with `{ plugins: { pause: vi.fn(), resume: vi.fn() },
toWorld: (sx, sy) => ({ x: sx, y: sy }) }`. Mock hit tester via
`{ hitTestHandle: vi.fn(), getSpriteWorldPos: vi.fn() }`. Use `createPinia()` +
`setActivePinia`. Use real `moshpitOverrideStore` (it's a pure Pinia store —
no fetch).

Cover every bullet in `<behavior>`. 12+ tests.
</action>
<verify>
<automated>pnpm test:unit -- src/platform/moshpit/composables/useMoshpitSpriteResize.test.ts</automated>
</verify>
<done> - Composable exported with the specified surface. - 12+ behavioural tests green. - MIN/MAX clamp verified. - Epsilon-clear verified. - Escape + pointercancel + unmount all restore viewport drag and pre-resize state. - `pnpm typecheck` clean on both files.
</done>
</task>

<task type="auto">
  <name>Task 3: Wire resize into MoshpitCanvas + MoshpitView precedence chain</name>
  <files>
    src/platform/moshpit/components/MoshpitCanvas.vue,
    src/views/MoshpitView.vue
  </files>
  <action>
1. `src/platform/moshpit/components/MoshpitCanvas.vue` — extend the
   `spriteHitTestRef.value` assignment after sprite layer mount:

```ts
spriteHitTestRef.value = {
  hitTestPoint: spriteLayerRef.hitTestPoint,
  hitTestRect: spriteLayerRef.hitTestRect,
  getSpriteWorldPos: spriteLayerRef.getSpriteWorldPos,
  hitTestHandle: spriteLayerRef.hitTestHandle
}
```

No other changes — the Task 1 extension provides `hitTestHandle` on the
returned handle, and `SpriteHitTester` now requires it.

2. `src/views/MoshpitView.vue`:

   a. Add import:
   `ts
import { useMoshpitSpriteResize } from '@/platform/moshpit/composables/useMoshpitSpriteResize'
`

   b. Instantiate the composable just before `useMoshpitSpriteDrag`:
   `ts
const spriteResize = useMoshpitSpriteResize({
  containerEl,
  viewportRef,
  hitTestRef: spriteHitTestRef
})
`

   c. In `onContainerPointerDown`, add resize as the FIRST gesture after the
   button + sidebar checks — before drag-to-pin:
   `ts
function onContainerPointerDown(e: PointerEvent) {
  containerEl.value?.focus()
  if (e.button !== 0) return
  sidebarStore.collapseOnFirstClick()
  // Resize handles take absolute precedence: if the pointer is on a
  // corner handle, engage resize and short-circuit everything else.
  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
    if (spriteResize.onPointerDown(e)) return
    if (spriteDrag.onPointerDown(e)) return
  }
  if (e.ctrlKey || e.metaKey) marquee.onPointerDown(e)
  clickDownX = e.clientX
  clickDownY = e.clientY
  clickPointerId = e.pointerId
  document.addEventListener('pointerup', onContainerPointerUp, { once: true })
}
`
   The two `onPointerDown` calls are independent — `spriteResize` returns
   false when not on a handle, so `spriteDrag` gets a clean shot. Modifier-
   held pointers skip both and fall through to marquee / click-select
   exactly as today.

   No other changes to MoshpitView.vue. The existing click-select onPointerUp,
   context menu, and Enter→tournament gate are untouched.
   </action>
   <verify>
   <automated>pnpm typecheck &amp;&amp; pnpm lint src/platform/moshpit/components/MoshpitCanvas.vue src/views/MoshpitView.vue src/platform/moshpit/composables/useMoshpitSpriteResize.ts src/platform/moshpit/composables/useMoshpitSpriteLayer.ts src/platform/moshpit/composables/useMoshpitViewportInjection.ts</automated>
   </verify>
   <done> - `MoshpitCanvas.vue` wires `hitTestHandle` through `spriteHitTestRef`. - `MoshpitView.vue` instantiates `useMoshpitSpriteResize` and calls it
   BEFORE `spriteDrag.onPointerDown` in the no-modifier branch. - `pnpm typecheck` + `pnpm lint` both clean on the touched files. - Manual smoke (captured in executor SUMMARY, not verified here):
   single-select a sprite → 4 white squares appear at its corners; drag a
   corner → sprite scales; release near 1× → override cleared; release
   elsewhere → scale persisted; Escape during drag → scale restored.
   </done>
   </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                      | Description                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| DOM PointerEvent → composable | Attacker-controlled event coords; same boundary as the existing drag gesture. Low risk — all |
|                               | state lives in an in-memory Pinia store, no persistence, no network.                         |
| overrideStore.setScale → Pixi | Scale values clamped to [0.25, 5] before the store ever sees them; prevents runaway GPU      |
|                               | memory growth from an unbounded scale upload.                                                |

## STRIDE Threat Register

| ID              | Category               | Component                        | Disposition | Mitigation                                                                                                                                                          |
| --------------- | ---------------------- | -------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-260423-ltc-01 | Denial of Service      | `setScale` on pointermove        | mitigate    | Clamp to `[MIN_SCALE=0.25, MAX_SCALE=5]` in the composable before every store write — prevents a user/script driving `sprite.width * scale` into GPU-OOM territory. |
| T-260423-ltc-02 | Denial of Service      | `hitTestHandle` O(N) per pointer | accept      | Single-selection gate means N ≤ 1 — cheaper than the existing `hitTestPoint` which walks the entire sprite map.                                                     |
| T-260423-ltc-03 | Tampering              | Escape restore path              | mitigate    | `prevScaleSnapshot` captured at engage from the store; restore calls the typed store API (no direct mutation), so an attacker cannot forge intermediate state.      |
| T-260423-ltc-04 | Repudiation            | Override store writes            | accept      | No audit trail by design — per-asset scale is ephemeral UX state, not a persisted artefact (no IDB write in v1).                                                    |
| T-260423-ltc-05 | Information Disclosure | N/A                              | accept      | No data crosses a trust boundary outside the browser tab.                                                                                                           |

</threat_model>

<verification>
- `pnpm test:unit -- src/platform/moshpit/composables/useMoshpitSpriteLayer.test.ts src/platform/moshpit/composables/useMoshpitSpriteResize.test.ts` → all green
- `pnpm typecheck` → clean
- `pnpm lint src/platform/moshpit/composables/useMoshpitSpriteResize.ts src/platform/moshpit/composables/useMoshpitSpriteLayer.ts src/platform/moshpit/composables/useMoshpitViewportInjection.ts src/platform/moshpit/components/MoshpitCanvas.vue src/views/MoshpitView.vue` → clean
- Husky lint-staged hook green on commits (no `--no-verify`)
- Non-test LoC delta < 300 (target ≈ 200: composable ~150 + sprite layer additions ~50 + wiring ~10)
</verification>

<success_criteria>

1. Single-selecting a sprite renders 4 white resize handles at its AABB corners in world space.
2. Selecting 0 or 2+ sprites renders NO handles.
3. Dragging a corner uniformly scales the sprite and the ring + handles track the new size
   (existing selection watchEffect rebuilds on `overrides.size` change).
4. Scale is clamped to [0.25, 5].
5. Releasing near 1× clears the scale override (record deleted unless a pin remains).
6. Escape during drag restores pre-resize scale and resumes viewport drag.
7. Resize engages BEFORE drag-to-pin — clicking a corner never writes a pin.
8. Clicking off a handle (on sprite body) falls through to drag-to-pin exactly as before.
9. Modifier-held (Cmd/Ctrl/Shift/Alt) pointerdown on a handle does NOT engage resize
   (reserved for marquee / multi-select click).
10. No new `watch` / `watchEffect` added to the sprite layer — resize-handle visuals
    piggyback on the existing `stopSelectionEffect` per that file's reactivity contract.
    </success_criteria>

<output>
After completion, create `.planning/quick/260423-ltc-moshpit-sprite-resize-handles-corner-dra/260423-ltc-SUMMARY.md`
with the standard summary template. Commit with prefix `feat(260423-ltc): …` —
recommended split:
  1. `feat(260423-ltc): add resize handles + hitTestHandle to moshpit sprite layer`
  2. `feat(260423-ltc): add useMoshpitSpriteResize composable`
  3. `feat(260423-ltc): wire resize precedence into MoshpitView pointer chain`
</output>
