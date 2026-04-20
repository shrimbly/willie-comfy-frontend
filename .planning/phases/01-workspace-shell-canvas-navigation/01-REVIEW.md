---
phase: 01-workspace-shell-canvas-navigation
reviewed: 2026-04-20T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - browser_tests/fixtures/helpers/MoshpitCanvasHelper.ts
  - browser_tests/tests/moshpit/moshpit-shell.spec.ts
  - src/composables/canvas/useCanvasInput.test.ts
  - src/composables/canvas/useCanvasInput.ts
  - src/composables/useMoshpitCommands.test.ts
  - src/composables/useMoshpitCommands.ts
  - src/platform/moshpit/components/MoshpitCanvas.test.ts
  - src/platform/moshpit/components/MoshpitCanvas.vue
  - src/platform/moshpit/components/MoshpitMarqueeOverlay.vue
  - src/platform/moshpit/components/MoshpitSettingsPanel.vue
  - src/platform/moshpit/components/MoshpitSideRail.stories.ts
  - src/platform/moshpit/components/MoshpitSideRail.vue
  - src/platform/moshpit/composables/useMoshpitCanvasInput.ts
  - src/platform/moshpit/composables/useMoshpitMarquee.test.ts
  - src/platform/moshpit/composables/useMoshpitMarquee.ts
  - src/platform/moshpit/stores/moshpitSelectionStore.test.ts
  - src/platform/moshpit/stores/moshpitSelectionStore.ts
  - src/platform/moshpit/stores/moshpitSidebarStore.test.ts
  - src/platform/moshpit/stores/moshpitSidebarStore.ts
  - src/platform/moshpit/stores/moshpitViewportStore.test.ts
  - src/platform/moshpit/stores/moshpitViewportStore.ts
  - src/renderer/core/canvas/useCanvasInteractions.test.ts
  - src/renderer/core/canvas/useCanvasInteractions.ts
  - src/views/MoshpitView.vue
  - src/views/layouts/MoshpitLayout.stories.ts
  - src/views/layouts/MoshpitLayout.vue
findings:
  critical: 0
  warning: 6
  info: 9
  total: 15
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-20
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Phase 1 establishes the Moshpit workspace shell: layout, side rail, settings panel, PixiJS canvas host, viewport/selection/sidebar stores, marquee composable, and the /moshpit route plumbing. Stores are clean, tests are thorough, and the code adheres to the layer boundaries (no imports from `renderer` into `platform`, and `useCanvasInput` sits at `composables/` as a pure layer with no litegraph ties).

No critical correctness or security issues were found. The warnings concentrate around four real areas:

1. An async-`onMounted` lifecycle race in `MoshpitCanvas.vue` that can leak PixiJS resources if the component unmounts before `app.init()` resolves.
2. A document-level pointer listener leak in `useMoshpitMarquee.ts` when the component unmounts mid-drag.
3. A multi-listener registration hazard in `useMoshpitMarquee.ts` when `onPointerDown` fires twice without a `pointerup` in between.
4. A UX-level correctness issue in `MoshpitView.vue` where `collapseOnFirstClick()` fires on every pointer button (including right-click/middle-click), which probably doesn't match the intent of D-11/D-12 and isn't what the E2E test asserts.

Info findings are mostly project-convention nits (stray `@ts-expect-error`, some superfluous null coalescing, a dead expression statement in a test, aspirational comments left in source, and a very thin indirection through `useCanvasInput` that contributes nothing to the current Moshpit path).

## Warnings

### WR-01: Async onMounted leaks PixiJS resources if component unmounts before init resolves

**File:** `src/platform/moshpit/components/MoshpitCanvas.vue:28-89`
**Issue:** The `onMounted` handler is `async` and awaits `app.init(...)`. If the Vue component is unmounted before `init` resolves (fast route change, StrictMode-like double-mount in tests, aborting navigation), the continuation still runs: it calls `host.appendChild(app.canvas)`, attaches the `Viewport`, registers pixi-viewport plugins, wires `viewport.on('moved', ...)`, and schedules `requestAnimationFrame(tick)` — but `onBeforeUnmount` has already run by then, so none of that is ever torn down. The Application, Viewport, RAF loop, canvas DOM node, and the closure over `viewportStore` all leak.
**Fix:**

```ts
let cancelled = false
onBeforeUnmount(() => { cancelled = true /* plus existing teardown */ })

onMounted(async () => {
  const host = pixiHostRef.value
  if (!host) return

  const pending = new Application()
  await pending.init({ ... })
  if (cancelled) {
    pending.destroy(true, { children: true, texture: true })
    return
  }
  app = pending
  // ...rest of setup
})
```

Also add a guard around the `tick` scheduling so a late `rafHandle = requestAnimationFrame(tick)` can't re-arm after unmount.

### WR-02: useMoshpitMarquee leaks document-level listeners on unmount during drag

**File:** `src/platform/moshpit/composables/useMoshpitMarquee.ts:49-126`
**Issue:** `onPointerDown` registers `pointermove` and `pointerup` on `document`. Cleanup only happens in `onPointerUp` and `cancel()`. If the host component (`MoshpitView`) unmounts while a marquee drag is in progress — e.g., the user navigates away via the side rail mid-drag — the document listeners remain attached. They still hold a closure over the now-dead `isDragging`/`rect` refs and the Pinia selection store, and on the next stray pointermove/up anywhere in the app they will mutate selection and call `releasePointerCapture` on a detached element.
**Fix:** Add an `onBeforeUnmount` that removes both document listeners defensively (or simpler: call `cancel()`):

```ts
import { onBeforeUnmount } from 'vue'
// ...
onBeforeUnmount(() => cancel())
```

### WR-03: Duplicate pointer-listener registration if onPointerDown fires twice without pointerup

**File:** `src/platform/moshpit/composables/useMoshpitMarquee.ts:49-65`
**Issue:** `onPointerDown` unconditionally calls `document.addEventListener('pointermove', onPointerMove)` and `document.addEventListener('pointerup', onPointerUp)`. If a second `pointerdown` fires with no intervening `pointerup` (e.g., pointercancel on touchpads, synthesized events, pointer capture hand-off, or tests dispatching a second down event), the handlers are registered twice. Because `addEventListener` dedupes only on identical `(type, listener, options)` tuples, this specific case is actually deduped — but `preDragSelection`, `startX`, `startY`, and `recordStart(e)` are overwritten in place. A subsequent `pointerup` will then commit selection against the latest start, silently dropping the in-flight drag. There's no `if (isDragging.value) return` guard at the top.
**Fix:** Early-return if a drag is already in progress, or call `cancel()` first:

```ts
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  if (isDragging.value || rect.value) cancel() // safety reset
  // ...existing logic
}
```

### WR-04: collapseOnFirstClick() fires on every pointer button, not just primary click

**File:** `src/views/MoshpitView.vue:35-39`
**Issue:** `onContainerPointerDown` is registered on `@pointerdown` with no button filter. It calls `sidebarStore.collapseOnFirstClick()` for right-click, middle-click, touch, and pen pointer-downs as well as left-click. The D-11/D-12 intent (and the E2E assertion in `moshpit-shell.spec.ts`) is "first canvas **click** auto-collapses" — a right-click that opens a context menu shouldn't silently collapse the panel. The marquee composable itself already gates to `e.button === 0`; the view-level collapse should follow suit.
**Fix:**

```ts
function onContainerPointerDown(e: PointerEvent) {
  containerEl.value?.focus()
  if (e.button === 0) sidebarStore.collapseOnFirstClick()
  marquee.onPointerDown(e)
}
```

Also extend the E2E coverage with one test that right-clicks the canvas and asserts the settings panel stays visible (currently no test guards against this regression).

### WR-05: Return value of useMoshpitCanvasInput is dead — composable is pure side-effect with a misleading API

**File:** `src/platform/moshpit/composables/useMoshpitCanvasInput.ts:8-48` (consumer at `src/platform/moshpit/components/MoshpitCanvas.vue:56`)
**Issue:** `useMoshpitCanvasInput` constructs a `CanvasInputNavigator` whose `dispatchWheel` and `dispatchPointer` are intentional no-ops (pixi-viewport owns input), builds `const api = useCanvasInput(navigator)`, and `return`s it. `MoshpitCanvas.vue` calls `useMoshpitCanvasInput(viewport, containerEl)` without assigning the return value — `handleWheel`/`handlePointer`/`forwardEvent` are never invoked. Every byte of the `useCanvasInput` wrapping is dead weight for the Moshpit path. The composable is effectively: (a) install a `watch` on Space to reconfigure `viewport.drag`, (b) install a keydown preventDefault for Space. The `CanvasInputNavigator` and `useCanvasInput` dance is theater that obscures that.
**Fix:** Either:

- Drop the navigator/`useCanvasInput` wiring here entirely and rename the composable (`useMoshpitSpacePan` or similar) to describe what it actually does.
- Or, if the long-term intent is to route real input through the shared navigator once pixi-viewport is replaced, leave a short `// TODO(phase N): route wheel/pointer through navigator once pixi-viewport plugins removed` on the no-op dispatchers so a future reader knows why they're there.

Leaving a non-functional `const api = useCanvasInput(navigator)` in production code is a classic over-engineering smell — "made the code more generic than it needs to be, or added functionality that isn't presently needed" (AGENTS.md Code Review §Complexity).

### WR-06: Viewport teardown may double-destroy via pixi-viewport and Application.destroy

**File:** `src/platform/moshpit/components/MoshpitCanvas.vue:91-101`
**Issue:** `onBeforeUnmount` calls `viewport.destroy({ children: true })` and then `app.destroy(true, { children: true, texture: true })`. `app.destroy` with `removeView=true` plus `{ children: true, texture: true }` destroys the stage and all descendants — which already includes the viewport (it was added via `app.stage.addChild(viewport)` on line 49). The explicit `viewport.destroy` on line 94 is either redundant or, depending on pixi-viewport's destroy semantics vs Pixi v8's stage teardown, can trigger "already destroyed" warnings or double-free of texture references.
**Fix:** Pick one owner. Since `Application.destroy({ children: true })` is the canonical Pixi v8 teardown and already cascades, drop the explicit `viewport.destroy({ children: true })` (still null the reference):

```ts
onBeforeUnmount(() => {
  if (rafHandle !== null) cancelAnimationFrame(rafHandle)
  viewport = null
  if (app) {
    app.destroy(true, { children: true, texture: true })
    app = null
  }
})
```

Verify against pixi-viewport v6 docs whether it requires explicit `.destroy()` before stage teardown; if so, remove it from stage before destroying and skip `{ children: true }` on the Application call instead.

## Info

### IN-01: Commented-out future-phase code in useMoshpitCommands

**File:** `src/composables/useMoshpitCommands.ts:27-32`
**Issue:** The `Moshpit.Canvas.ZoomToSelection` command body contains two commented-out lines describing Phase 2 intent:

```ts
// Phase 2: const bbox = computeBboxFromSelection(selection.selected)
// useMoshpitViewportStore().requestZoomToSelection(bbox)
```

Project convention (AGENTS.md #14–#15) discourages retaining commented-out code. Tracker issues or ADRs are the correct place for future-phase plans.
**Fix:** Replace with a single-line `// TODO(phase-2): implement bbox + requestZoomToSelection` or delete entirely — the intent is already obvious from the command name and the `selection.selected.length === 0` guard.

### IN-02: @ts-expect-error repeated 4× in E2E test where a typed window shim would do

**File:** `browser_tests/tests/moshpit/moshpit-shell.spec.ts:56, 60, 71, 75`
**Issue:** Four `@ts-expect-error ComfyUI global` directives for `window.app?.graph?.nodes?.length` / `_version`. Project guideline: "Avoid `@ts-expect-error` - fix the underlying issue" (src/AGENTS.md). ComfyUI already ships a typed `window.app` in `src/types/` — either import its type in the `evaluate` callback's scope, or define a small local `interface Window { app?: { graph?: { nodes?: unknown[]; _version?: number } } }` augmentation.
**Fix:** Replace all four directives with a narrow typed accessor helper:

```ts
const getGraphSnapshot = () =>
  comfyPage.page.evaluate(() => {
    const g = (
      window as unknown as {
        app?: { graph?: { nodes?: unknown[]; _version?: number } }
      }
    ).app?.graph
    return { count: g?.nodes?.length ?? 0, version: g?._version ?? 0 }
  })
```

(Still technically a cast, but centralized and explicit rather than four silent opt-outs.)

### IN-03: Dead expression statement in sidebar store test

**File:** `src/platform/moshpit/stores/moshpitSidebarStore.test.ts:30`
**Issue:** `store.activePanelId // collapsed` — a property access with no side effect, value discarded. Looks like leftover scaffolding during test authoring.
**Fix:** Delete the line. The comment on line 31 already explains the state.

### IN-04: Superfluous ?? false on a Ref<boolean>

**File:** `src/platform/moshpit/composables/useMoshpitCanvasInput.ts:14`
**Issue:** `isReadOnly: () => spaceHeld.value ?? false` — `useMagicKeys().space` is `ComputedRef<boolean>`; `.value` is never `null`/`undefined`. The `?? false` is dead defensive code and can mislead readers into thinking the source can be nullish.
**Fix:** `isReadOnly: () => spaceHeld.value`.

### IN-05: handleWheel branch structure has an implicit fall-through no-op

**File:** `src/composables/canvas/useCanvasInput.ts:77-89`
**Issue:** After the guard returns, `handleWheel` has two `if` branches that both `forwardEvent(event); return;`, followed by an implicit fall-through when neither condition matches (standard mode + no ctrl/meta + wheel not captured). The reader has to trace through to realize the no-op is intentional.
**Fix:** Collapse to a single conditional:

```ts
function handleWheel(event: WheelEvent): void {
  if (!shouldForwardWheelEvent(event)) return
  const zoom = event.ctrlKey || event.metaKey
  const shouldForward = !navigator.isStandardNavMode() || zoom
  if (shouldForward) forwardEvent(event)
}
```

Behavior is equivalent, the "no-op when standard + no modifier" case is explicit, and the test coverage in `useCanvasInput.test.ts` already pins both branches.

### IN-06: Import ordering in MoshpitLayout.vue is not alphabetical within the @/platform group

**File:** `src/views/layouts/MoshpitLayout.vue:16-23`
**Issue:** `WorkspaceAuthGate` (platform/workspace) is imported before `MoshpitSettingsPanel`/`MoshpitSideRail` (platform/moshpit) but `MoshpitView` (views) is last. oxfmt/the import plugin should regroup these; run `pnpm format`. Non-blocking — tooling handles it.
**Fix:** `pnpm format` before commit.

### IN-07: preDragSelection is typed as mutable Set but always reassigned, not mutated

**File:** `src/platform/moshpit/composables/useMoshpitMarquee.ts:34, 60`
**Issue:** `let preDragSelection: Set<string> = new Set()` followed by `preDragSelection = new Set(selection.selected)` on every pointerdown. It's never mutated in place, only reassigned. The mutable `let` hides that the Set is effectively immutable at each use site. Project guideline #22: "Avoid mutable state, prefer immutability and assignment at point of declaration."
**Fix:** Convert to a ref or keep the `let` but annotate as `ReadonlySet<string>`:

```ts
let preDragSelection: ReadonlySet<string> = new Set()
```

Minor; improves self-documentation.

### IN-08: SHELL-05 test depends on private litegraph field `_version`

**File:** `browser_tests/tests/moshpit/moshpit-shell.spec.ts:59-77`
**Issue:** The test reads `window.app.graph._version` directly. `_version` is an underscore-prefixed private field of `LGraph` and is explicitly called out in CLAUDE.md / AGENTS.md as sensitive to change ("Changes to `graph._version++` affect 40+ extensions"). The test is _intentionally_ brittle here — that's the guard — but a comment explaining the brittleness and the rationale (already partially present on lines 46-48) is worth keeping and expanding so a future refactor doesn't "fix" the test by removing the `_version` probe.
**Fix:** Extend the existing comment to say "we deliberately assert on `graph._version` — the private field is the integration contract for extensions; if this assertion becomes inconvenient, the fix is a keep-alive wrapper, not removing the check."

### IN-09: MoshpitMarqueeOverlay receives already-unwrapped ref values through props

**File:** `src/views/MoshpitView.vue:10-13`
**Issue:** `:isDragging="marquee.isDragging.value"` and `:overlayStyle="marquee.overlayStyle.value"` — accessing `.value` in the template works (Vue collects the dep) but is stylistically unusual. The more idiomatic pattern is to destructure in `<script setup>` so the template sees a top-level ref that auto-unwraps:

```ts
const {
  isDragging,
  overlayStyle,
  onPointerDown: onMarqueePointerDown
} = marquee
```

Then the template becomes `:isDragging` / `:overlayStyle` with no `.value`. Functionally identical, lower visual noise, matches the rest of the file.

---

_Reviewed: 2026-04-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
