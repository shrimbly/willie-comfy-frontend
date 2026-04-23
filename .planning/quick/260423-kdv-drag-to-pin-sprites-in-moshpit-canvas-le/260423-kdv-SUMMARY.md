---
phase: 260423-kdv
plan: 01
subsystem: moshpit
tags: [moshpit, pixi, pinia, sprite-layer, drag, pointer-events, toast]
requires:
  - moshpitOverrideStore (from 260423-j4f)
  - useMoshpitViewportInjection (SpriteHitTester, Viewport)
  - useMoshpitSelectionStore
  - useToastStore
provides:
  - useMoshpitSpriteDrag composable (drag-gesture → overrideStore.setPin)
  - moshpit.pin.{toastSingle,toastMulti,undoLabel} i18n keys
affects:
  - src/views/MoshpitView.vue (onContainerPointerDown precedence)
tech-stack:
  added: []
  patterns:
    - onBeforeUnmount + document/window pointer listener symmetric to useMoshpitMarquee
    - per-hash anchor snapshot for translate-the-group multi-select
    - deferred first setPin until CLICK_DRAG_THRESHOLD_PX exceeded (click-safe)
key-files:
  created:
    - src/platform/moshpit/composables/useMoshpitSpriteDrag.ts
    - src/platform/moshpit/composables/useMoshpitSpriteDrag.test.ts
  modified:
    - src/views/MoshpitView.vue
    - src/locales/en/main.json
decisions:
  - Anchor strategy = pre-drag pinned pos per hash, falling back to pointer world-start for unpinned hashes in a multi-select — avoids introducing a sprite-position API on SpriteHitTester.
  - Pin writes deferred until threshold exceeded so a genuine click never writes an override and needs no rollback.
  - onKeydown listens on window (not containerEl @keydown) so the existing Enter→tournament handler on the container stays untouched.
metrics:
  duration: ~25min
  completed: '2026-04-23'
---

# Phase 260423-kdv Plan 01: Drag-to-Pin Sprites Summary

Drag-to-pin wired into Moshpit: left-drag a sprite (no modifiers) translates it with the pointer, writing `moshpitOverrideStore.setPin(hash, world)` on every pointermove and pausing the pixi-viewport drag plugin for the duration; on release an Undo-capable toast appears; Escape/pointercancel/unmount abort and restore pre-drag pin state.

## Final Composable Surface

```ts
// src/platform/moshpit/composables/useMoshpitSpriteDrag.ts

export interface SpriteDragOptions {
  containerEl: Ref<HTMLElement | null>
  viewportRef: Ref<Viewport | null>
  hitTestRef: Ref<SpriteHitTester | null>
}

export interface SpriteDragHandle {
  onPointerDown(e: PointerEvent): boolean // true = engaged (consumer short-circuits)
  readonly isDragging: Readonly<Ref<boolean>>
  undoLast(): void // restores prev pin state for the last drag set
  cancel(): void // mid-drag safety reset
}

export function useMoshpitSpriteDrag(
  options: SpriteDragOptions
): SpriteDragHandle
```

### Semantics

- **Engage (onPointerDown → true) iff** `button === 0` AND no `ctrl/meta/shift/alt` AND `hitTestPoint` returns a hash AND all three refs are non-null.
- **While dragging** viewport drag plugin is `pause('drag')`ed exactly once, resumed exactly once on `pointerup` / `pointercancel` / Escape / unmount.
- **Drag set** snapshotted at engage: `selection.selected` if dragged hash is in a selection of size > 1, else `[hitHash]`. Changing selection mid-drag does not mutate the drag set.
- **Per-move write** for each hash: `setPin(hash, anchor + (world - worldStart))`. `anchor` = pre-drag `pinnedWorldPos` (if pinned) else `worldStart` — i.e. unpinned members of a multi-select translate with the pointer.
- **First setPin is deferred** until `CLICK_DRAG_THRESHOLD_PX` (5px) is crossed, so a genuine click engages but never writes a pin.
- **On release (above threshold):** snapshots copied to `lastSnapshots`, toast emitted (`toastSingle` or `toastMulti` with `{count}`, `life: 5000`, `detail: undoLabel`).
- **On release (below threshold):** no pin writes, no toast, viewport resumed. Click-select path in MoshpitView is unaffected because the composable never fires `setPin` and the click gesture is short-circuited only when engaging on a sprite.
- **Escape / pointercancel / unmount:** listeners detached, each hash restored (`setPin(prev)` or `unpin`), viewport resumed, state cleared.
- **undoLast()** reruns the last drag's pre-snapshots against the store — consumers can surface this from a future action toast.

## MoshpitView.vue Diff (effective)

```diff
 import { useMoshpitMarquee } from '@/platform/moshpit/composables/useMoshpitMarquee'
+import { useMoshpitSpriteDrag } from '@/platform/moshpit/composables/useMoshpitSpriteDrag'

 const marquee = useMoshpitMarquee({ … })
+
+const spriteDrag = useMoshpitSpriteDrag({
+  containerEl,
+  viewportRef,
+  hitTestRef: spriteHitTestRef
+})

 function onContainerPointerDown(e: PointerEvent) {
   containerEl.value?.focus()
   if (e.button !== 0) return
   sidebarStore.collapseOnFirstClick()
+  // Drag-to-pin takes precedence when on-sprite with no modifiers. If it
+  // engages, bail out — no click candidacy, no marquee.
+  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
+    if (spriteDrag.onPointerDown(e)) return
+  }
   if (e.ctrlKey || e.metaKey) marquee.onPointerDown(e)
   …
 }
```

No other MoshpitView changes: the existing keydown handler, click-vs-drag threshold, and hit-test selection rules are preserved intact.

## i18n Keys Added

`src/locales/en/main.json` → `moshpit.pin.*` (alphabetically adjacent to `moshpit.peek`):

```json
"pin": {
  "toastSingle": "Pinned asset — broke auto-layout",
  "toastMulti": "Pinned {count} assets — broke auto-layout",
  "undoLabel": "Undo"
}
```

`toastMulti` uses the `{count}` interpolation idiom; no hardcoded pluralisation.

## Verification Results

- `pnpm test:unit -- src/platform/moshpit/composables/useMoshpitSpriteDrag.test.ts` → **18 tests passed**:
  - engages on hit + no modifiers
  - does NOT engage on miss
  - does NOT engage with ctrl/meta/shift/alt (parameterised, 4 cases)
  - does NOT engage with button !== 0
  - pauses viewport exactly once at engage, resumes exactly once at pointerup
  - writes setPin(hash, anchor + delta) on pointermove past threshold
  - multi-select: drag set = selection when size > 1 and hash ∈ selection; per-hash anchors preserved
  - multi-select: drag set = [hash] when hash ∉ selection
  - below-threshold release: no setPin, viewport resumed
  - above-threshold release: toast.add called once with severity info and resolved summary
  - multi-select toast uses toastMulti with count
  - Escape during drag restores pre-drag snapshots, no toast, viewport resumed
  - pointercancel mid-drag restores pre-drag state
  - onBeforeUnmount mid-drag: viewport resume called, subsequent pointermove does not write
  - undoLast() restores each hash from the last drag
- `pnpm typecheck` → clean.
- `eslint src/platform/moshpit/composables/useMoshpitSpriteDrag.ts src/platform/moshpit/composables/useMoshpitSpriteDrag.test.ts src/views/MoshpitView.vue` → clean.
- Pre-existing lint errors in `thumbWorker.ts` and `sortMath.test.ts` (unrelated) left out of scope per Rule 3 scope boundary.
- Manual smoke: deferred to a future `@moshpit` Playwright spec — Phase 4 Plan 06 still carries the `typecheck:browser` tsconfig blocker documented in STATE.md.

## Commits

| Hash        | Message                                                                            |
| ----------- | ---------------------------------------------------------------------------------- |
| `175949189` | feat(260423-kdv): add useMoshpitSpriteDrag composable with override-store writes   |
| `2e78d48b9` | feat(260423-kdv): wire drag-to-pin into MoshpitView and add moshpit.pin.\* strings |

## Deviations from Plan

None. Anchor fallback strategy is the plan's documented simplification (per-hash `pinnedWorldPos` when present, else `worldStart`), surfaced via a code comment in the composable for future maintainers.

## Follow-Up Hooks

- **Richer action-capable toast host** — current `toastStore.add` has no button field. `spriteDrag.undoLast()` is already exposed so an action-toast integration can wire the button without touching this composable.
- **Sprite-position API on SpriteHitTester** — adding `spritePositionAt(hash): { x, y } | null` would let multi-select members pin from their current rendered centre, not their last-pinned position, when dragged from an unpinned state.
- **Resize handles** — the next sprite-control quick task can mount on the same `overrideStore.setScale` primitive.
- **Touch/pen pointers** — today the composable treats all `button === 0` pointers equally; gesture disambiguation (pinch, two-finger pan) is v2.

## Self-Check: PASSED

- FOUND: src/platform/moshpit/composables/useMoshpitSpriteDrag.ts
- FOUND: src/platform/moshpit/composables/useMoshpitSpriteDrag.test.ts
- FOUND: src/views/MoshpitView.vue (edited)
- FOUND: src/locales/en/main.json (edited)
- FOUND commit: 175949189
- FOUND commit: 2e78d48b9
