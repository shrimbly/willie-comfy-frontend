---
phase: 260423-kdv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/platform/moshpit/composables/useMoshpitSpriteDrag.ts
  - src/platform/moshpit/composables/useMoshpitSpriteDrag.test.ts
  - src/views/MoshpitView.vue
  - src/locales/en/main.json
autonomous: true
requirements:
  - QUICK-260423-KDV-01
tags: [moshpit, pixi, pinia, sprite-layer, drag, pointer-events, toast]

must_haves:
  truths:
    - 'Left-dragging a sprite (no modifiers) moves the sprite with the pointer and writes setPin(hash, worldPos) on every pointermove.'
    - 'Viewport panning (pixi-viewport drag plugin) is suspended for the duration of a sprite drag, then resumed on pointerup/cancel.'
    - 'When the dragged sprite is part of a multi-selection, every selected sprite moves together; pin positions are written for each.'
    - 'A genuine click (movement < CLICK_DRAG_THRESHOLD_PX) does not pin — it falls through to the existing selection path.'
    - 'On pointerup after a real drag, a toast surfaces with an Undo action that calls overrideStore.unpin(hash) for every hash moved in that drag.'
    - 'Pressing Escape during a drag aborts: previous pin state is restored for every moved hash (or unpin if the sprite was not previously pinned).'
    - 'Drag-pin engages only on hit-test HIT with left-button and zero modifiers; ctrl/meta/shift/alt routes continue to reach marquee + click-select.'
  artifacts:
    - path: 'src/platform/moshpit/composables/useMoshpitSpriteDrag.ts'
      provides: 'useMoshpitSpriteDrag composable — pointerdown-driven sprite-drag gesture writing to moshpitOverrideStore.'
      exports: ['useMoshpitSpriteDrag', 'SpriteDragOptions', 'SpriteDragHandle']
    - path: 'src/platform/moshpit/composables/useMoshpitSpriteDrag.test.ts'
      provides: 'Behavioural coverage: engage/ignore matrix, viewport pause/resume, pin writes, multi-select, toast, Escape abort.'
    - path: 'src/views/MoshpitView.vue'
      provides: 'Drag-pin wired into onContainerPointerDown ahead of marquee + click fall-through.'
    - path: 'src/locales/en/main.json'
      provides: 'moshpit.pin.{toastSingle,toastMulti,undoLabel} strings under existing moshpit namespace.'
  key_links:
    - from: 'src/views/MoshpitView.vue#onContainerPointerDown'
      to: 'useMoshpitSpriteDrag#onPointerDown'
      via: 'direct call; short-circuits if returns true'
      pattern: "spriteDrag\\.onPointerDown"
    - from: 'src/platform/moshpit/composables/useMoshpitSpriteDrag.ts'
      to: 'src/platform/moshpit/stores/moshpitOverrideStore.ts'
      via: 'setPin/unpin'
      pattern: "overrideStore\\.(setPin|unpin)"
    - from: 'src/platform/moshpit/composables/useMoshpitSpriteDrag.ts'
      to: 'pixi-viewport Viewport.plugins'
      via: "pause('drag') / resume('drag')"
      pattern: "plugins\\.(pause|resume)\\('drag'\\)"
---

<objective>
Ship drag-to-pin: left-drag on a sprite writes `moshpitOverrideStore.setPin(hash, worldPos)` while the pointer moves, breaking the auto-layout for that asset (multi-select moves the group). On release, surface an Undo toast; Escape aborts and restores prior pin state.

Purpose: Second sprite-control quick task, building on the override-store foundation from 260423-j4f. Unlocks manual curation on the canvas without blocking on a context menu or action bar.

Output:

- New composable `useMoshpitSpriteDrag` (drag gesture → override store).
- MoshpitView wiring that prefers drag-pin over marquee + click-select when on-sprite with no modifiers.
- Three new i18n strings under `moshpit.pin.*`.
- Co-located Vitest covering engage/ignore matrix, viewport suspension, per-hash pin writes, multi-select, toast, and Escape abort.
  </objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260423-j4f-add-sprite-controls-to-moshpit-canvas-ma/260423-j4f-SUMMARY.md
@src/platform/moshpit/stores/moshpitOverrideStore.ts
@src/views/MoshpitView.vue
@src/platform/moshpit/components/MoshpitCanvas.vue
@src/platform/moshpit/composables/useMoshpitMarquee.ts
@src/platform/moshpit/composables/useMoshpitViewportInjection.ts
@src/platform/moshpit/stores/moshpitSelectionStore.ts
@src/platform/updates/common/toastStore.ts

<interfaces>
<!-- Already-shipped contracts the executor will call into. Use directly; no exploration needed. -->

From src/platform/moshpit/stores/moshpitOverrideStore.ts:

```ts
export interface OverrideRecord {
  readonly pinnedWorldPos?: { x: number; y: number }
  readonly scale?: number
  readonly pinnedAt: number
}
// Pinia Setup store
useMoshpitOverrideStore() => {
  records: Ref<Map<string, OverrideRecord>>
  size: ComputedRef<number>
  get(hash: string): OverrideRecord | undefined
  isPinned(hash: string): boolean
  setPin(hash: string, worldPos: { x: number; y: number }): void // preserves scale
  setScale(hash: string, scale: number): void
  unpin(hash: string): void // strips pinnedWorldPos; deletes record if no scale
  clearScale(hash: string): void
  clear(hash: string): void
  clearAll(): void
  reset(): void
}
```

From src/platform/moshpit/composables/useMoshpitViewportInjection.ts:

```ts
export interface SpriteHitTester {
  hitTestPoint(worldX: number, worldY: number): string | null
  hitTestRect(rect: SpriteHitRect): string[]
}
export const MOSHPIT_VIEWPORT_INJECTION_KEY: InjectionKey<Ref<Viewport | null>>
export const MOSHPIT_SPRITE_HITTEST_INJECTION_KEY: InjectionKey<
  Ref<SpriteHitTester | null>
>
```

From src/platform/moshpit/stores/moshpitSelectionStore.ts:

```ts
useMoshpitSelectionStore() => {
  selected: ComputedRef<string[]>
  size: ComputedRef<number>
  isSelected(id: string): boolean
  // plus add/addMany/remove/toggle/setSelection/selectAll/clear
}
```

From pixi-viewport Viewport (already imported in MoshpitView):

- `viewport.toWorld(screenX: number, screenY: number): { x: number; y: number }`
- `viewport.plugins.pause('drag')` / `viewport.plugins.resume('drag')`
- `screenWidth` / `screenHeight` available if needed

From src/platform/updates/common/toastStore.ts:

```ts
// Signature mirrors PrimeVue ToastMessageOptions.
toastStore.add({ severity: 'info'|'warn'|'success'|..., summary: string, detail?: string, life?: number })
```

Note: `toastStore` exposes no dedicated "action button" field. Undo is delivered as a detail + a secondary host — for this plan use the `summary` + `detail` + a follow-up test that asserts the toast body contains `t('moshpit.pin.undoLabel')` text and the composable exposes a `lastUndo` handle the consumer can surface. If a richer action toast exists elsewhere in the moshpit phase, prefer it; otherwise keep the surface minimal and expose `undoLast()` from the composable so a future richer toast host can be wired without churning this file.

From src/views/MoshpitView.vue (relevant excerpt):

```ts
// CLICK_DRAG_THRESHOLD_PX = 5
// onContainerPointerDown(e):
//   - focuses container, returns if e.button !== 0
//   - collapses sidebar
//   - engages marquee ONLY when ctrlKey||metaKey
//   - records click-candidacy (clickDownX/Y/pointerId)
//   - registers single-shot document 'pointerup' → onContainerPointerUp
// onContainerPointerUp:
//   - if dx/dy > CLICK_DRAG_THRESHOLD_PX → return (drag handled elsewhere)
//   - else hit-test world point via viewportRef + spriteHitTestRef and run selection rules
```

Existing imports already present in MoshpitView.vue (do not re-add):

- `useMoshpitSelectionStore`, `useMoshpitSidebarStore`, `useMoshpitTournamentStore`, `useMoshpitMetadataStore`, `useAssetsStore`, `useToastStore`, `useI18n`.
- `containerEl: Ref<HTMLElement | null>`, `viewportRef: ShallowRef<Viewport | null>`, `spriteHitTestRef: ShallowRef<SpriteHitTester | null>`.
  </interfaces>

<prior-art>
- `useMoshpitMarquee` is the gold-standard local pattern for pointer-gesture composables: `document.addEventListener('pointermove'/'pointerup')`, setPointerCapture, `onBeforeUnmount → cancel()`, explicit `cancel()` safety reset on re-entry.
- `useClickDragGuard(threshold=5)` provides `recordStart(e)` / `wasDragged(e)` / `reset()` — reuse it to separate click from drag rather than re-implementing the threshold check.
- The tournament phase uses `window.addEventListener` + `onScopeDispose` (SUMMARY 05-06) as the safety net when teardown is post-unmount. Prefer `onBeforeUnmount` here (same-scope handler) for symmetry with `useMoshpitMarquee`.
- Override store's `setPin` is cheap (O(n) Map copy) and already batched by Pinia — calling it every pointermove is fine at 5k-asset scale; do NOT throttle unless a perf profile demands it (YAGNI).
</prior-art>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement useMoshpitSpriteDrag composable</name>
  <files>src/platform/moshpit/composables/useMoshpitSpriteDrag.ts, src/platform/moshpit/composables/useMoshpitSpriteDrag.test.ts</files>
  <behavior>
    Engage/ignore matrix (onPointerDown returns boolean):
    - left-button + no modifiers + hit-test HIT → engage, return true
    - left-button + hit-test MISS → do not engage, return false
    - any of ctrlKey/metaKey/shiftKey/altKey held → do not engage, return false
    - e.button !== 0 → do not engage, return false
    - containerEl/viewportRef/hitTestRef null → return false (defensive)

    While dragging:
    - `viewport.plugins.pause('drag')` called exactly once at engage; `resume('drag')` called exactly once on pointerup or cancel/abort.
    - For each pointermove: convert `(e.clientX - bounds.left, e.clientY - bounds.top)` → world via `viewport.toWorld`; compute per-hash offset from the initial world position of that hash; call `overrideStore.setPin(hash, initialWorld[hash] + delta)` for every dragged hash.
    - Multi-select semantics: if the dragged hash is in `selectionStore.selected` AND `selectionStore.size > 1`, the drag set = full selection; else drag set = [dragged hash].
    - Drag set is snapshotted at engage-time; changing selection mid-drag must NOT change the drag set.
    - For each hash in the drag set, capture its pre-drag override snapshot (`overrideStore.get(hash)`) before the first setPin, so Escape-abort can restore.

    Pointerup path:
    - If the gesture never exceeded `CLICK_DRAG_THRESHOLD_PX` (5px) from start, treat as a click: do NOT write any pin, resume viewport drag, return. The click handling in MoshpitView still fires because MoshpitView owns the click path; our composable simply declines by `return false` from `onPointerDown` in the click case is NOT possible (threshold is decided on move). Instead: when we engaged and later see a click-sized drag, we still paused the viewport — so on pointerup, revert any speculative pin writes (there will be none if movement never exceeded threshold because we defer the FIRST setPin until threshold is exceeded) and resume drag.
    - If the gesture did exceed threshold: after the final setPin, surface a toast via `toastStore.add({ severity: 'info', summary: t('moshpit.pin.toastSingle' or 'moshpit.pin.toastMulti', { count }), detail: t('moshpit.pin.undoLabel'), life: 5000 })`.
    - Expose `undoLast()` on the handle that calls, for each hash in the last drag set, either `overrideStore.setPin(hash, prevPos)` (if the hash had a pinnedWorldPos before) or `overrideStore.unpin(hash)` (otherwise).

    Abort paths:
    - Escape keydown while `isDragging.value` → restore each hash's pre-drag snapshot (setPin with old coords if it existed, otherwise unpin), resume viewport drag, reset state, do NOT surface toast.
    - pointercancel → same behaviour as Escape abort.
    - onBeforeUnmount → call internal cancel() which removes listeners and resumes viewport drag if still paused.

    Test matrix (Vitest, happy-dom, co-located):
    1. Engages on hit + no modifiers; `isDragging.value === true` after threshold exceeded.
    2. Does NOT engage on miss (hitTestPoint returns null).
    3. Does NOT engage with ctrlKey / metaKey / shiftKey / altKey held (parameterised via `.each`).
    4. Does NOT engage when `e.button !== 0`.
    5. Pauses `viewport.plugins.pause('drag')` exactly once at engage, resumes exactly once at pointerup.
    6. Writes `setPin(hash, expectedWorld)` on pointermove past threshold (use a mock viewport with `toWorld: (sx,sy) => ({ x: sx, y: sy })` for deterministic asserts).
    7. Multi-select: drag set = selection.selected when size > 1 and dragged hash ∈ selection; every selected hash receives setPin with its own offset.
    8. Multi-select: drag set = [draggedHash] when selection.size <= 1 or draggedHash ∉ selection.
    9. Below-threshold release: no setPin called, viewport resume still fires (leak-free).
    10. Above-threshold release: toastStore.add called once with `severity: 'info'`, summary key resolved against i18n.
    11. Escape during drag: each hash's pre-drag state restored; no toast; viewport resumed.
    12. pointercancel mid-drag: same restoration as Escape.
    13. onBeforeUnmount mid-drag: viewport.plugins.resume('drag') called; document listeners removed (assert subsequent fake pointermove does not call setPin).

    Mocking conventions:
    - Build a `makeViewport()` helper returning `{ toWorld: vi.fn(...), plugins: { pause: vi.fn(), resume: vi.fn() } }` typed as `Partial<Viewport>` and cast to `Viewport` via `as unknown as Viewport` (NOT `as any`).
    - Build a `makeHitTester(hash: string | null)` helper with `hitTestPoint: vi.fn(() => hash), hitTestRect: vi.fn(() => [])`.
    - Mount the composable inside `defineComponent({ setup() { return useMoshpitSpriteDrag(options) } })` via `@vue/test-utils` to get proper lifecycle + Pinia injection.
    - Seed `overrideStore` with `setActivePinia(createPinia())` in `beforeEach`.

  </behavior>
  <action>
    Create `src/platform/moshpit/composables/useMoshpitSpriteDrag.ts` with exported types:

    ```ts
    export interface SpriteDragOptions {
      containerEl: Ref<HTMLElement | null>
      viewportRef: Ref<Viewport | null>
      hitTestRef: Ref<SpriteHitTester | null>
    }
    export interface SpriteDragHandle {
      onPointerDown(e: PointerEvent): boolean
      readonly isDragging: Readonly<Ref<boolean>>
      undoLast(): void
      cancel(): void
    }
    export function useMoshpitSpriteDrag(
      options: SpriteDragOptions
    ): SpriteDragHandle
    ```

    Internal state (all module-scope to the composable invocation):
    - `isDragging = ref(false)`
    - `dragSet: string[] = []` (snapshotted at engage)
    - `initialWorldByHash: Map<string, { x: number; y: number }> = new Map()`
    - `preDragSnapshots: Map<string, OverrideRecord | undefined> = new Map()`
    - `lastDragSet: string[] = []`, `lastSnapshots: Map<string, OverrideRecord | undefined> = new Map()` for `undoLast()`
    - `startScreenX = 0`, `startScreenY = 0`, `hasExceededThreshold = false`
    - `pointerId: number | null = null`
    - `isPaused = false` (single source of truth for pause/resume idempotency)

    Use `useClickDragGuard(5)` from `@/composables/useClickDragGuard` for threshold detection — matches marquee pattern.

    Pointer flow:
    1. `onPointerDown(e)` — validate guards (button, modifiers, refs present); `hitTestPoint` via world coords; if HIT, engage: compute drag set from selectionStore, capture initial world positions (start from the hit hash's current override.pinnedWorldPos if set, else from a layout provider derived position), snapshot pre-drag overrides, attach `document.pointermove/pointerup/pointercancel` + `window.keydown` listeners, call `viewport.plugins.pause('drag')`, set `isPaused = true`, return true. **Important for initial positions:** the cleanest source of truth is the sprite's current world position as rendered — read it from `overrideStore.get(hash)?.pinnedWorldPos` if set, otherwise infer via the hit-tester's sprite center. Since `SpriteHitTester` doesn't expose sprite positions, expose an optional `spritePositionAt(hash: string): { x: number; y: number } | null` on the composable-facing API by extending `SpriteHitTester` in **a follow-up**; for THIS plan, fall back to the pointer's initial world position as the anchor for all hashes in the drag set and apply the same world delta to every hash (i.e. translate-the-group by the pointer delta). This keeps multi-select grouping intuitive and does not require a new injection surface.
    2. `onPointerMove(e)` — if not yet past threshold, check `wasDragged(e)`; once exceeded, for each hash in dragSet: `overrideStore.setPin(hash, { x: anchorX + (worldX - startWorldX), y: anchorY + (worldY - startWorldY) })` where `anchorByHash[hash]` is the hash's pre-drag pinned pos (or the group's common start world if not previously pinned — simplest: use the SAME pointer start world for every hash and let the store record absolute world positions = pointer-relative deltas applied to each hash's pre-drag position retrieved from `preDragSnapshots[hash]?.pinnedWorldPos` with fallback to the pointer's start world). Document this choice with a brief `// Why:` comment.
    3. `onPointerUp(e)` — remove listeners; if `!hasExceededThreshold` → resume, reset, no toast, no pin writes (none should have happened). Else → surface toast with `moshpit.pin.toastSingle` if dragSet.length === 1 else `moshpit.pin.toastMulti` with `{ count: dragSet.length }`; persist dragSet + snapshots to `lastDragSet/lastSnapshots`; resume viewport drag; reset transient state.
    4. `onKeydown(e)` — if `e.key === 'Escape' && isDragging.value`: restoreFromSnapshots(preDragSnapshots); resume; reset; `e.preventDefault()`.
    5. `onPointerCancel(e)` — same as Escape.
    6. `cancel()` — remove listeners, resume if paused, reset state. Call from `onBeforeUnmount`.
    7. `undoLast()` — iterate `lastSnapshots`: if `snapshot?.pinnedWorldPos` → `setPin(hash, snapshot.pinnedWorldPos)`, else `unpin(hash)`. Clear `lastDragSet/lastSnapshots` afterwards.

    Helper `restoreFromSnapshots(snapshots: Map<string, OverrideRecord | undefined>)`:
    ```ts
    for (const [hash, snap] of snapshots) {
      if (snap?.pinnedWorldPos) overrideStore.setPin(hash, snap.pinnedWorldPos)
      else overrideStore.unpin(hash)
    }
    ```

    Type safety: use `Readonly<Ref<boolean>>` for the exposed `isDragging`, import `Viewport` as `type`, import `SpriteHitTester` as `type` — enforce `import type` separation (oxlint rule).

    Logging: none. If the composable needs to warn (e.g. viewport null mid-drag), use `console.warn` only.

    Write `src/platform/moshpit/composables/useMoshpitSpriteDrag.test.ts` covering all 13 behaviours above. Use `@vue/test-utils` mount pattern for lifecycle correctness; seed `setActivePinia(createPinia())` in `beforeEach`. No `as any`; no global mutable state outside test scope.

    Commit: `feat(260423-kdv): add useMoshpitSpriteDrag composable with override-store writes`

  </action>
  <verify>
    <automated>pnpm test:unit -- src/platform/moshpit/composables/useMoshpitSpriteDrag.test.ts</automated>
  </verify>
  <done>
    - File exists at `src/platform/moshpit/composables/useMoshpitSpriteDrag.ts` exporting `useMoshpitSpriteDrag`, `SpriteDragOptions`, `SpriteDragHandle`.
    - Test file passes all 13 enumerated cases.
    - `pnpm typecheck` clean on the two files.
    - No `any` / `as any`; no `--no-verify`; no barrel re-export.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire drag-to-pin into MoshpitView and add i18n strings</name>
  <files>src/views/MoshpitView.vue, src/locales/en/main.json</files>
  <action>
    **MoshpitView.vue changes:**

    1. Import the new composable:
       ```ts
       import { useMoshpitSpriteDrag } from '@/platform/moshpit/composables/useMoshpitSpriteDrag'
       ```
    2. Instantiate alongside `marquee` (after `marquee` declaration is fine; ordering doesn't matter because handlers are invoked explicitly):
       ```ts
       const spriteDrag = useMoshpitSpriteDrag({
         containerEl,
         viewportRef,
         hitTestRef: spriteHitTestRef
       })
       ```
    3. In `onContainerPointerDown`, AFTER `sidebarStore.collapseOnFirstClick()` and BEFORE the marquee modifier-gated branch, add:
       ```ts
       // Drag-to-pin takes precedence when on-sprite with no modifiers.
       // If it engages, bail out — don't track click candidacy (no selection change)
       // and don't start marquee.
       if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
         if (spriteDrag.onPointerDown(e)) return
       }
       ```
    4. Leave the rest of `onContainerPointerDown` + `onContainerPointerUp` untouched. This preserves:
       - marquee engaging on ctrl/meta
       - click-vs-drag threshold (CLICK_DRAG_THRESHOLD_PX) for click-select fall-through
       - hit-test selection rules
    5. Do NOT add a `@keydown="onContainerKeydown"` change — the sprite-drag composable owns its own `window`/`document` keydown listener (installed only while dragging). This avoids touching the existing Enter handler.

    **src/locales/en/main.json changes:**

    Inside the existing `"moshpit"` namespace (starts at line ~1049), add a new `"pin"` block. Place it alphabetically between `"peek"` (or the nearest neighbour) and the next sibling — do NOT reorder existing keys. Use the plurals idiom with `{count}` interpolation:

    ```json
    "pin": {
      "toastSingle": "Pinned asset — broke auto-layout",
      "toastMulti": "Pinned {count} assets — broke auto-layout",
      "undoLabel": "Undo"
    }
    ```

    If the moshpit namespace is sorted alphabetically, drop `"pin"` in the sorted slot. If not strictly sorted, insert near `"peek"` (preceding) for neighbour-locality.

    **Verification before commit:**
    - `pnpm typecheck` clean.
    - `pnpm lint` clean on `src/views/MoshpitView.vue` and `src/locales/en/main.json`.
    - Manually open the dev server + Moshpit view: left-drag on a sprite pans the sprite; release shows the pin toast (console `toast.add` payload is acceptable if Toast host is elsewhere); plain empty-canvas left-drag still pans; ctrl/meta drag still runs marquee; plain left-click on a sprite still selects it. (Automated browser coverage is Task 3's `pnpm lint`+`typecheck`; a @moshpit Playwright spec is deferred per Phase-4 tsconfig blocker documented in STATE.md.)

    Commit: `feat(260423-kdv): wire drag-to-pin into MoshpitView and add moshpit.pin.* strings`

  </action>
  <verify>
    <automated>pnpm typecheck && pnpm lint --quiet src/views/MoshpitView.vue src/locales/en/main.json</automated>
  </verify>
  <done>
    - `useMoshpitSpriteDrag` imported and instantiated in MoshpitView.
    - `onContainerPointerDown` short-circuits on engage without modifiers.
    - `moshpit.pin.toastSingle`, `moshpit.pin.toastMulti`, `moshpit.pin.undoLabel` present in `src/locales/en/main.json`.
    - `pnpm typecheck` clean project-wide.
    - `pnpm lint` clean on modified files.
    - Marquee (ctrl/meta-drag), click-select, and empty-canvas pan regressions all preserved by the short-circuit logic (manual smoke).
  </done>
</task>

</tasks>

<verification>
Plan-level checks (in addition to per-task `<verify>`):

- `pnpm test:unit -- src/platform/moshpit/composables/useMoshpitSpriteDrag.test.ts` — all green.
- `pnpm typecheck` — clean.
- `pnpm lint --quiet` — clean on touched files (`src/platform/moshpit/composables/useMoshpitSpriteDrag.ts`, `.test.ts`, `src/views/MoshpitView.vue`, `src/locales/en/main.json`).
- Manual smoke in dev server on `/moshpit`:
  1. Load at least 2 assets.
  2. Left-drag an unpinned sprite ~100px → sprite follows pointer, auto-layout broken for that hash, toast appears with “Pinned asset — broke auto-layout”.
  3. Select 3 sprites (cmd-click), then drag one of them → all 3 move together, toast shows “Pinned 3 assets — broke auto-layout”.
  4. Start a drag, press Esc before release → sprite(s) snap back to pre-drag positions, no toast.
  5. Plain left-drag on empty canvas → still pans viewport (pixi-viewport drag plugin active).
  6. Cmd-left-drag anywhere → still engages marquee (no regression).
  7. Plain left-click on a sprite → still selects (no regression; no stray pin).
- No unused imports (`unused-imports/no-unused-imports`).
- No `:class="[]"`, no `dark:`, no PrimeVue additions — composable is pure TS so this is automatic, but recheck if the MoshpitView diff grows.
  </verification>

<success_criteria>

- [ ] `useMoshpitSpriteDrag` composable exists with the documented surface.
- [ ] Composable writes `setPin(hash, worldPos)` on drag and surfaces Undo-capable toast on release.
- [ ] Escape / pointercancel / unmount abort restore the pre-drag pin state (or unpin if unset), and always resume viewport drag.
- [ ] Multi-selection drag moves the whole selection when the dragged sprite is in the selection and selection size > 1.
- [ ] MoshpitView wires the composable in the correct precedence (drag-pin > marquee > click-select), and no existing gesture regresses.
- [ ] `moshpit.pin.toastSingle` / `toastMulti` / `undoLabel` strings added under existing `moshpit` i18n namespace.
- [ ] All enumerated behaviour tests pass.
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test:unit` on the new test file all clean.
- [ ] Non-test LoC delta < 300.
- [ ] Commits follow `feat(260423-kdv): …` prefix style; no Claude/AI mentions.
      </success_criteria>

<output>
After completion, create `.planning/quick/260423-kdv-drag-to-pin-sprites-in-moshpit-canvas-le/260423-kdv-SUMMARY.md` with:
- Final composable surface (exported types + methods + their semantics)
- Exact changes to MoshpitView.vue (diff-style listing: imports, composable instantiation, onContainerPointerDown edit)
- i18n keys added
- Any deviations from the plan and why
- Verification results (test counts, typecheck/lint status, manual smoke outcome)
- Commits (hash + message)
- Follow-up hooks for future sprite-control tasks (richer action toast, sprite position API on SpriteHitTester, resize handles)
</output>
