# Phase 1: Workspace Shell & Canvas Navigation - Research

**Researched:** 2026-04-20
**Domain:** PixiJS canvas setup, Vue Router keep-alive, shared input composable extraction, sidebar tab system, keybinding scoping
**Confidence:** HIGH (all core claims verified against live codebase)

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Entry is route-based — `/moshpit` URL; existing workflow stays at `/`.
- **D-02:** No keyboard shortcut to toggle Moshpit in v1.
- **D-03:** Full session state (viewport, selection, panel state) persists in-memory via Pinia; IndexedDB persistence defers to Phase 2.
- **D-04:** MoshpitLayout is a sibling to LayoutDefault in the router, not a child route. Full-bleed, no grid chrome.
- **D-05:** MenuHamburger (top menu bar) is shared. Left SideToolbar, bottom panel, and global toasts are NOT shared — Moshpit mounts its own equivalents inside MoshpitLayout.
- **D-06:** GraphView is wrapped in `<keep-alive>` so litegraph canvas, workflow, selection, and extension state all survive the route switch. SHELL-05 depends on this.
- **D-07:** Extract a pure `useCanvasInput` composable owning pan/zoom/marquee math against a generic viewport state. `useCanvasInteractions` becomes a thin litegraph adapter; Moshpit gets a Pixi adapter.
- **D-08:** Zero regressions on litegraph path. Pin current behavior with tests before extraction.
- **D-09:** Pixi viewport managed by `pixi-viewport` plugin. `useCanvasInput` emits transform state; Pixi adapter applies it to pixi-viewport's API.
- **D-10:** MoshpitLayout mounts a Moshpit-specific left icon rail with the same visual pattern as `SideToolbar`. Wiring through existing `sidebarTabStore` or a parallel Moshpit tab store is Claude's discretion.
- **D-11:** Once the user re-opens the Settings panel, it stays open for the rest of the session. Auto-collapse is a one-time first-entry onboarding affordance.
- **D-12:** Auto-collapse triggers on clicks only (empty canvas, then asset-click in Phase 2). Pan, zoom, and scroll do NOT collapse the panel. Refines SHELL-04's "pan / zoom / click" wording — D-12 is authoritative.

### Claude's Discretion

- Exact Pinia store shape for Moshpit viewport/selection state.
- Router guard details (if any) for `/moshpit`.
- Directory placement (`src/platform/moshpit/` proposed — researcher to confirm against layering rules).
- Adapter interface shape for `useCanvasInput`.
- Whether to reuse `sidebarTabStore` directly or stand up a parallel `moshpitTabStore`.
- Specific test harness approach for pinning current litegraph pan/zoom/marquee before extraction.
- `pixi-viewport` version selection and wheel/pinch/drag plugin knob defaults.

### Deferred Ideas (OUT OF SCOPE)

- Keyboard shortcut to toggle Moshpit.
- Cross-reload persistence of viewport/selection/panel state (IndexedDB persistence rides on Phase 2).
- Asset-click auto-collapse (Phase 2 extends the trigger when sprites exist).
- Toast infrastructure inside MoshpitLayout (Phase 5).
- Empty-canvas Playwright validation strategy (decision: unit-test-first posture for extracted composable, deferred integration when Phase 2 assets arrive).
- Figma design reference check (no Moshpit-specific Figma node referenced yet).
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                              | Research Support                                             |
| -------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| SHELL-01 | User can open Moshpit as top-level workspace, peer of workflow graph                     | D-01 route pattern, D-04 sibling layout, router.ts extension |
| SHELL-02 | Moshpit renders full-bleed PixiJS canvas, no node chrome                                 | pixi.js v8 Application + PixiJS Renderer section             |
| SHELL-03 | Canvas pan/zoom/selection indistinguishable from workflow canvas via shared composable   | useCanvasInput extraction, adapter pattern                   |
| SHELL-04 | Left Settings panel via sidebar tab system, open on entry, auto-collapses on first click | sidebarTabStore analysis, D-10/D-11/D-12                     |
| SHELL-05 | User exits Moshpit, workflow graph unchanged                                             | keep-alive pattern, D-06                                     |
| NAV-01   | Pan with Space-drag, zoom with scroll/pinch                                              | useCanvasInput extraction, pixi-viewport                     |
| NAV-02   | F = fit viewport, Z = zoom to selection                                                  | Moshpit command registration, pixi-viewport fitWorld/snap    |
| NAV-03   | Multi-select via drag-rectangle marquee                                                  | marquee composable research                                  |
| NAV-04   | Shift-click add, Cmd/Ctrl-click toggle                                                   | modifier key handling in marquee                             |
| NAV-05   | Cmd/Ctrl-A select all, Esc clear                                                         | keybinding registration, Moshpit command scope               |

</phase_requirements>

---

## Summary

Phase 1 installs a new top-level route (`/moshpit`) with a sibling layout component, wraps GraphView in `<keep-alive>` to preserve litegraph state across route switches, mounts an empty PixiJS canvas managed by `pixi-viewport`, and wires a Moshpit-specific left icon rail. The defining technical challenge is the `useCanvasInput` extraction (D-07/D-08): the current `useCanvasInteractions.ts` has six production callers spread across `src/renderer/` and `src/composables/`; all six consume it as a litegraph forwarder and must continue to work identically after extraction. That extraction must be covered by a regression-pinning test suite before any code moves.

The secondary challenge is keybinding scoping. The existing system uses `targetElementId` DOM presence checks — commands fire only when focus is inside the named element. Moshpit commands (`F`, `Z`, `Cmd+A`, `Esc`) must be scoped to a `moshpit-canvas-container` element, registered separately from the litegraph keybindings, so they only fire when the Moshpit canvas is focused.

**Primary recommendation:** Sequence work as: (1) regression-pin tests, (2) composable extraction, (3) route + layout + keep-alive, (4) Pixi canvas mount, (5) pixi-viewport integration, (6) marquee + selection, (7) sidebar rail + auto-collapse, (8) keyboard commands.

---

## Standard Stack

### Core

| Library                 | Version    | Purpose                                      | Why Standard                                     |
| ----------------------- | ---------- | -------------------------------------------- | ------------------------------------------------ |
| pixi.js                 | 8.18.1     | 2D sprite renderer, canvas management        | Chosen in PRD/CONTEXT; handles 5k sprite scale   |
| pixi-viewport           | 6.0.3      | Pan/zoom/pinch viewport plugin for Pixi v8   | Peer dep `pixi.js>=8`; latest; standard solution |
| Vue 3.5 + Pinia         | (existing) | Reactivity, store, SFC lifecycle integration | Project-wide mandatory                           |
| VueUse `useKeyModifier` | (existing) | Modifier key detection in marquee composable | Already used in `useMarqueeSelection`            |
| VueUse `useMagicKeys`   | (existing) | Shift detection in workspaceStore            | Already in repo                                  |

### Supporting

| Library                       | Version    | Purpose                                           | When to Use                                 |
| ----------------------------- | ---------- | ------------------------------------------------- | ------------------------------------------- |
| `@/base/pointerUtils`         | (internal) | `isMiddlePointerInput` for middle-mouse detection | Reuse directly — already base-layer         |
| `@/utils/tailwindUtil` `cn()` | (internal) | Class merging                                     | All class composition in MoshpitLayout/rail |

### Alternatives Considered

| Instead of                      | Could Use                          | Tradeoff                                                                                                                                                                                               |
| ------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| pixi-viewport                   | Custom pan/zoom on pixi-js         | pixi-viewport handles momentum, pinch, mouse-wheel normalization, deceleration, and world-bounds clamping; hand-rolling that is months of work                                                         |
| Moshpit-local `moshpitTabStore` | Reusing `sidebarTabStore` directly | sidebarTabStore couples to `commandStore` and registers global menu commands; a parallel store avoids polluting the global command palette with Moshpit-specific tab toggles while the graph is active |

**Installation:**

```bash
pnpm add pixi.js pixi-viewport
```

**Version verification:** [VERIFIED: npm registry] pixi.js@8.18.1 is latest. pixi-viewport@6.0.3 is latest; its peer dep is `pixi.js >= 8` — compatible.

---

## Architecture Patterns

### Recommended Project Structure

```
src/platform/moshpit/               # Layer 1 — platform-scoped domain
├── stores/
│   └── moshpitStore.ts             # Viewport state, selection set, panel open/collapsed
├── composables/
│   └── useMoshpitSidebar.ts        # Sidebar rail tab registration logic
└── components/
    └── MoshpitCanvas.vue           # PixiJS Application mount/unmount wrapper

src/renderer/core/canvas/
├── useCanvasInteractions.ts        # (existing) → becomes litegraph adapter post-extraction
└── useCanvasInput.ts               # NEW: pure composable, no litegraph import

src/views/
├── layouts/
│   ├── LayoutDefault.vue           # (existing, untouched)
│   └── MoshpitLayout.vue           # NEW: full-bleed sibling layout
└── MoshpitView.vue                 # NEW: route component, mounts MoshpitCanvas + rail

src/composables/
└── useMoshpitCommands.ts           # NEW: F/Z/Cmd+A/Esc commands for Moshpit scope
```

### Pattern 1: Sibling Route with keep-alive (D-04, D-05, D-06)

**What:** MoshpitLayout is a top-level route component alongside LayoutDefault. GraphView is wrapped in `<keep-alive>` at the router-view level.

**When to use:** When you need full-bleed posture without inheriting LayoutDefault chrome, AND you need the existing view to maintain its DOM and Pinia state across route switches.

**Current router.ts structure:**

```typescript
// Source: src/router.ts (verified)
routes: [
  {
    path: '/',
    component: LayoutDefault,
    children: [
      { path: '', name: 'GraphView', component: () => import('@/views/GraphView.vue') },
      { path: 'user-select', name: 'UserSelectView', ... }
    ]
  }
]
```

**How to extend (D-04, D-06):**

```typescript
// App.vue or router-view wrapper — add keep-alive for GraphView
// <router-view v-slot="{ Component, route }">
//   <keep-alive :include="['GraphView']">
//     <component :is="Component" :key="route.name" />
//   </keep-alive>
// </router-view>

routes: [
  // existing LayoutDefault route unchanged
  {
    path: '/',
    component: LayoutDefault,
    children: [...]
  },
  // NEW: sibling, no parent layout
  {
    path: '/moshpit',
    name: 'MoshpitView',
    component: MoshpitLayout  // or lazy import
  }
]
```

**Critical:** `<keep-alive>` must wrap the `<router-view>` at the `App.vue` level, not inside `LayoutDefault.vue`. `LayoutDefault.vue` currently just renders `<router-view />` inside a `<main>` tag — the keep-alive must be applied where both `LayoutDefault` and `MoshpitLayout` are rendered siblings, which is in `App.vue`'s `<router-view>`. [VERIFIED: read App.vue and LayoutDefault.vue]

The canonical pattern in Vue Router 4 + `<keep-alive>`:

```vue
<!-- App.vue -->
<router-view v-slot="{ Component }">
  <keep-alive :include="['GraphView']">
    <component :is="Component" />
  </keep-alive>
</router-view>
```

`GraphView` must declare `defineOptions({ name: 'GraphView' })` (or the component name matches the route name) for `:include` to match. [ASSUMED — Vue Router 4 keep-alive requires the component name, not the route name, to be set for `:include` matching. Verify `GraphView.vue` has `defineOptions({ name: 'GraphView' })` or equivalent.]

### Pattern 2: `useCanvasInput` Extraction (D-07, D-08)

**What:** Split `useCanvasInteractions.ts` into a pure math composable and two adapters.

**Callers of `useCanvasInteractions` (verified via grep):**

| File                                                                         | Functions Consumed                                      | Layer                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------- |
| `src/renderer/extensions/vueNodes/components/LGraphNode.vue`                 | `handleWheel`, `shouldHandleNodePointerEvents`          | renderer                        |
| `src/renderer/extensions/vueNodes/composables/useNodePointerInteractions.ts` | `forwardEventToCanvas`, `shouldHandleNodePointerEvents` | renderer                        |
| `src/renderer/extensions/vueNodes/composables/useNodeEventHandlers.ts`       | `shouldHandleNodePointerEvents`                         | renderer                        |
| `src/renderer/extensions/vueNodes/components/NodeWidgets.vue`                | `shouldHandleNodePointerEvents`, `forwardEventToCanvas` | renderer                        |
| `src/composables/node/useNodeImage.ts`                                       | `handleWheel`, `handlePointer`                          | composables (renderer-adjacent) |
| `src/composables/node/useNodeAnimatedImage.ts`                               | `handleWheel`, `handlePointer`                          | composables (renderer-adjacent) |
| `src/components/graph/GraphCanvasMenu.vue`                                   | (destructured from `canvasInteractions`)                | components                      |

**What functions are consumed:**

- `handleWheel` — 3 callers (LGraphNode.vue, useNodeImage.ts, useNodeAnimatedImage.ts)
- `handlePointer` — 2 callers (useNodeImage.ts, useNodeAnimatedImage.ts)
- `forwardEventToCanvas` — 2 callers (useNodePointerInteractions.ts, NodeWidgets.vue)
- `shouldHandleNodePointerEvents` — 4 callers (LGraphNode.vue, useNodeEventHandlers.ts, useNodePointerInteractions.ts, NodeWidgets.vue)

**Extraction boundary:**

The pure `useCanvasInput` composable:

- Takes: reactive viewport state (pan x/y, zoom, selection set) + a generic "navigator" interface
- Owns: wheel-to-zoom math, space+drag pan detection, middle-mouse detection, modifier key tracking
- Emits or calls: `onPan(dx, dy)`, `onZoom(scale, focal)`, `onMarqueeRect(rect)` callbacks — the adapter decides what to do with them
- Does NOT import: `app`, `canvasStore`, litegraph types

The litegraph adapter (`useCanvasInteractions.ts` remains, wraps `useCanvasInput`):

- Implements the navigator interface by forwarding events to `app.canvas.canvas.dispatchEvent(...)`
- Retains `shouldHandleNodePointerEvents` (litegraph-specific: checks `canvas.read_only`)
- All existing callers continue to import `useCanvasInteractions` — no rename for them

The Pixi adapter (`useMoshpitCanvasInput.ts` or inline in `MoshpitCanvas.vue`):

- Implements the navigator interface by calling pixi-viewport's `drag`, `pinch`, `wheel` plugin APIs

**Regression test strategy (D-08):** Before any extraction, add tests to `useCanvasInteractions.test.ts` (which already exists with 10+ tests [VERIFIED]) covering:

- Standard nav mode + Ctrl+wheel → dispatched to canvas
- Legacy nav mode + plain wheel → dispatched to canvas
- Space+drag (`read_only=true`, `buttons===1`) → dispatched
- Middle mouse (`buttons===4`) → dispatched
- Wheel on focused `data-capture-wheel` element → NOT dispatched (unless Ctrl/Meta)
- `shouldHandleNodePointerEvents` reflects `canvas.read_only`

### Pattern 3: pixi-viewport Mount/Unmount (D-09)

**What:** PixiJS Application and pixi-viewport are created on `onMounted` and destroyed on `onBeforeUnmount`.

**pixi-viewport v6 + pixi.js v8 integration:**

```typescript
// Source: pixi-viewport README + npm registry [VERIFIED version compatible]
import { Application } from 'pixi.js'
import { Viewport } from 'pixi-viewport'

// In onMounted:
const app = new Application()
await app.init({
  canvas: canvasEl,
  resizeTo: containerEl,
  background: 0x000000,
  antialias: false
})
const viewport = new Viewport({
  screenWidth: containerEl.clientWidth,
  screenHeight: containerEl.clientHeight,
  worldWidth: WORLD_WIDTH, // Claude's discretion on initial size
  worldHeight: WORLD_HEIGHT,
  events: app.renderer.events // required for pixi-viewport v6
})
app.stage.addChild(viewport)
viewport
  .drag({ mouseButtons: 'middle' }) // middle-mouse drag = pan
  .pinch() // pinch-to-zoom
  .wheel({ smooth: 3 }) // scroll-to-zoom
  .decelerate() // momentum

// Space+drag: set viewport.drag({ mouseButtons: 'left' }) when Space held,
// restore on Space release — mirror the litegraph read_only pattern

// On beforeUnmount:
app.destroy(true)
```

**Pixi-viewport `fitWorld()`** — built-in method that fits the viewport to show all world content. Maps directly to the `F` key command.

**Pixi-viewport `snap(x, y, { removeOnComplete: true })`** — animates to a world position. For `Z` (zoom to selection), compute the bounding box of selected sprites and call `viewport.snapZoom({ width, height })` + `viewport.snap(cx, cy)`.

**pixi-viewport plugins used in Phase 1:**

- `drag({ mouseButtons: 'middle' })` — middle-mouse pan
- `pinch()` — two-finger pinch zoom
- `wheel({ smooth: 3 })` — scroll zoom
- `decelerate()` — pan deceleration (momentum)

Space+drag requires dynamic plugin reconfiguration: when Space is held, call `viewport.plugins.remove('drag')` and re-add with `{ mouseButtons: 'left' }`. On Space release, restore. This mirrors how litegraph sets `read_only` to enable left-mouse pan.

### Pattern 4: Moshpit Tab Store (D-10)

**Recommendation: parallel `moshpitSidebarStore.ts`** colocated at `src/platform/moshpit/stores/moshpitSidebarStore.ts`.

**Reason:** `sidebarTabStore` auto-registers a `Workspace.ToggleSidebarTab.{id}` command in the global `commandStore` for every tab registered. If Moshpit's "Settings" tab is registered there, it will appear in the command palette when the user is in the workflow graph, and the keybinding guard (`targetElementId`) won't prevent discovery. A parallel `moshpitSidebarStore` (same shape: `activePanelId`, `togglePanel`, `openPanel`, `closePanel`) keeps Moshpit state isolated.

**Store shape (Setup API):**

```typescript
export const useMoshpitSidebarStore = defineStore('moshpitSidebar', () => {
  const activePanelId = ref<string | null>('settings') // open on entry
  const hasHadFirstInteraction = ref(false) // one-time collapse flag (D-11)

  const isPanelOpen = computed(() => activePanelId.value !== null)

  function collapseOnFirstClick() {
    if (hasHadFirstInteraction.value) return
    hasHadFirstInteraction.value = true
    activePanelId.value = null
  }

  function openPanel(id: string) {
    activePanelId.value = id
    hasHadFirstInteraction.value = true // re-open is explicit, so lock D-11
  }

  function togglePanel(id: string) {
    activePanelId.value = activePanelId.value === id ? null : id
    if (activePanelId.value !== null) hasHadFirstInteraction.value = true
  }

  return {
    activePanelId,
    isPanelOpen,
    hasHadFirstInteraction,
    collapseOnFirstClick,
    openPanel,
    togglePanel
  }
})
```

`hasHadFirstInteraction` implements D-11: once set, `collapseOnFirstClick` is a no-op, so clicking again after the panel reopens never auto-collapses.

### Pattern 5: Keybinding Scoping for Moshpit (F, Z, Cmd+A, Esc)

**How the existing system works (verified: `keybindingService.ts` lines 37–44):**

```typescript
if (targetElementId) {
  const container = document.getElementById(targetElementId)
  if (!container?.contains(target)) return // keybinding ignored outside this element
}
```

Keybindings with `targetElementId: 'graph-canvas-container'` only fire when focus is inside `#graph-canvas-container`. Moshpit commands must use `targetElementId: 'moshpit-canvas-container'` — a div id placed on the root container in `MoshpitLayout.vue`.

**Key collision audit (verified: `src/platform/keybindings/defaults.ts`):**

- `F` key: not in CORE_KEYBINDINGS. `Comfy.Canvas.FitView` is bound to `.` (period), not `F`. **`F` is free.**
- `Z` key: not in CORE_KEYBINDINGS. **`Z` is free.**
- `Cmd/Ctrl+A`: not in CORE_KEYBINDINGS. **Free.**
- `Esc`: handled globally in `keybindingService` for dialog dismissal, but only when `dialogStore.dialogStack.length > 0`. With `targetElementId` scoping, Moshpit's `Esc` (clear selection) fires only inside `#moshpit-canvas-container` when no dialog is open. **No collision.**

**Command registration approach:**

```typescript
// src/composables/useMoshpitCommands.ts
export function useMoshpitCommands(): ComfyCommand[] {
  return [
    {
      id: 'Moshpit.Canvas.FitView',
      label: () => t('moshpit.commands.fitView'),
      function: () => {
        /* call viewport.fitWorld() */
      }
    },
    {
      id: 'Moshpit.Canvas.ZoomToSelection',
      label: () => t('moshpit.commands.zoomToSelection'),
      function: () => {
        /* compute bbox, viewport.snapZoom + snap */
      }
    },
    {
      id: 'Moshpit.Canvas.SelectAll',
      label: () => t('moshpit.commands.selectAll'),
      function: () => {
        moshpitStore.selectAll()
      }
    },
    {
      id: 'Moshpit.Canvas.ClearSelection',
      label: () => t('moshpit.commands.clearSelection'),
      function: () => {
        moshpitStore.clearSelection()
      }
    }
  ]
}
```

Keybinding entries (to be added to `defaults.ts` or registered by the Moshpit view):

```typescript
{ combo: { key: 'f' }, commandId: 'Moshpit.Canvas.FitView', targetElementId: 'moshpit-canvas-container' },
{ combo: { key: 'z' }, commandId: 'Moshpit.Canvas.ZoomToSelection', targetElementId: 'moshpit-canvas-container' },
{ combo: { ctrl: true, key: 'a' }, commandId: 'Moshpit.Canvas.SelectAll', targetElementId: 'moshpit-canvas-container' },
{ combo: { key: 'Escape' }, commandId: 'Moshpit.Canvas.ClearSelection', targetElementId: 'moshpit-canvas-container' },
```

**Focus problem:** The PixiJS canvas element (`<canvas>`) is not focusable by default. The container div needs `tabindex="0"` and `outline: none` to be the `document.activeElement` target for `targetElementId` DOM checks. [ASSUMED — standard browser behavior for canvas focus; verify that PixiJS's `events` renderer does not set `tabindex` itself]

### Pattern 6: Marquee Selection for Moshpit Canvas

**`useMarqueeSelection` from `src/platform/assets/composables/` is NOT reusable directly.** It is tightly coupled to:

- `useAssetSelectionStore` — imports asset-specific store
- `AssetItem` type
- Grid layout geometry (`GridLayout`, column/row math for pixel→asset mapping)
- `[data-virtual-grid-item]` DOM queries

For Phase 1 (empty canvas), a new `useMoshpitMarquee.ts` composable must be written. It reuses:

- `useClickDragGuard` from `@/composables/useClickDragGuard` (5px drag threshold guard — already used in the asset marquee) [VERIFIED: referenced in useMarqueeSelection]
- `useKeyModifier('Shift')`, `useKeyModifier('Control')`, `useKeyModifier('Meta')` from VueUse
- The rect-tracking logic (startX/startY, pointermove, pointerup, marqueeStyle CSS)

The Moshpit marquee operates in **world space**: pointer positions must be converted from screen space to pixi-viewport world coordinates via `viewport.toWorld(screenX, screenY)`. Hit testing is against sprite bounding boxes in world space (deferred to Phase 2 when sprites exist; in Phase 1 the marquee rect is tracked and the selection set remains empty).

### Anti-Patterns to Avoid

- **Do not import `app` or litegraph types in `useCanvasInput`.** The pure composable must have zero litegraph coupling. Any litegraph reference belongs in the adapter only.
- **Do not add MoshpitView as a child of `LayoutDefault`.** D-04 explicitly requires a sibling. Nesting it inside LayoutDefault would inherit grid chrome.
- **Do not register Moshpit commands in `useCoreCommands`.** That composable is loaded unconditionally in GraphView. Moshpit commands registered there would appear in the palette and be executable (without effect) from the workflow canvas. Use `useMoshpitCommands` registered only in `MoshpitView`.
- **Do not set `pixi.js` as a devDependency.** It is a runtime dependency.
- **Do not use `canvasStore` in Moshpit.** `canvasStore` wraps `LGraphCanvas` — litegraph-specific. Moshpit has its own `moshpitStore` for viewport and selection state.
- **Do not use `dark:` Tailwind variant** in MoshpitLayout or rail; use semantic tokens.

---

## Don't Hand-Roll

| Problem                                  | Don't Build                    | Use Instead                                                                           | Why                                                                                   |
| ---------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Viewport pan/zoom/pinch/decelerate       | Custom transform math          | `pixi-viewport`                                                                       | Handles momentum, pinch normalization, world-bounds clamping, browser wheel deltaMode |
| Middle-mouse detection                   | `event.button === 1` ad hoc    | `isMiddlePointerInput` in `@/base/pointerUtils`                                       | Already correct, already tested, base-layer reuse                                     |
| Drag threshold guard                     | Manual distance accumulation   | `useClickDragGuard`                                                                   | Already exists, already used in `useMarqueeSelection`                                 |
| Modifier key tracking                    | Custom keydown/keyup listeners | `useKeyModifier` from VueUse                                                          | Reactive, SSR-safe, already in repo                                                   |
| CSS class merging                        | `:class="[]"` arrays           | `cn()` from `@/utils/tailwindUtil`                                                    | Mandatory per CLAUDE.md                                                               |
| Sidebar icon rail width/padding CSS vars | Custom vars                    | Reuse `--sidebar-width`, `--sidebar-icon-size`, etc. from `SideToolbar.vue` `<style>` | These are root-scoped vars; `MoshpitRail.vue` can read them without re-declaring      |

**Key insight:** The existing `CanvasHelper.ts` in Playwright fixtures (pan, zoom, drag-and-drop, sweep) is a reusable model for writing Moshpit E2E helpers — but it is hardwired to the litegraph canvas locator. Moshpit E2E will need a parallel `MoshpitCanvasHelper.ts` that targets `#moshpit-canvas-container`.

---

## Layering Rules — Confirmed Placement

[VERIFIED: eslint.config.ts layer boundaries + STRUCTURE.md "Where to Add New Code"]

| Artifact                 | Correct Layer        | Path                                                    | Reasoning                                                            |
| ------------------------ | -------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| `moshpitStore.ts`        | platform             | `src/platform/moshpit/stores/moshpitStore.ts`           | Cross-cutting product state, no renderer dependency                  |
| `moshpitSidebarStore.ts` | platform             | `src/platform/moshpit/stores/moshpitSidebarStore.ts`    | UI state, no renderer                                                |
| `MoshpitCanvas.vue`      | platform             | `src/platform/moshpit/components/MoshpitCanvas.vue`     | Pixi canvas mount — does NOT use litegraph; no renderer-layer import |
| `useMoshpitSidebar.ts`   | platform             | `src/platform/moshpit/composables/useMoshpitSidebar.ts` | Sidebar state logic                                                  |
| `MoshpitLayout.vue`      | views/layouts        | `src/views/layouts/MoshpitLayout.vue`                   | Route-level layout shell                                             |
| `MoshpitView.vue`        | views                | `src/views/MoshpitView.vue`                             | Route-level view                                                     |
| `useMoshpitCommands.ts`  | composables          | `src/composables/useMoshpitCommands.ts`                 | Command factory (analogous to useCoreCommands)                       |
| `useCanvasInput.ts`      | renderer/core/canvas | `src/renderer/core/canvas/useCanvasInput.ts`            | Pure input math extracted from the renderer-layer file               |
| `useMoshpitMarquee.ts`   | platform             | `src/platform/moshpit/composables/useMoshpitMarquee.ts` | Moshpit-specific, no litegraph                                       |

**ESLint boundary check:** `src/platform/moshpit/` may import from `src/base/` (pointerUtils) and third-party (pixi.js, pixi-viewport, VueUse). It must NOT import from `src/renderer/` or `src/workbench/`. `useCanvasInput.ts` stays in `src/renderer/core/canvas/` because that's where it logically belongs (renderer input layer); the Pixi adapter at platform level must not import it from renderer. Instead, the Pixi adapter receives the composable's interface through a parameter or factory function — or the pure composable is promoted to `src/composables/` (generic layer).

**Resolution:** Move `useCanvasInput.ts` to `src/composables/canvas/useCanvasInput.ts`. This sits outside the `src/renderer/` boundary, allowing both the litegraph adapter (in `src/renderer/`) and the Pixi adapter (in `src/platform/moshpit/`) to import it. The `src/renderer/` files may import from `src/composables/`. [ASSUMED — layer rules do not explicitly enumerate `src/composables/` as a restricted source; they govern `base/platform/workbench/renderer` upward imports. Verify by running `pnpm layer-audit` after placement.]

---

## i18n Namespace

[VERIFIED: `moshpit.*` is free — grep found zero matches in `src/locales/en/main.json`]

**Proposed initial keys:**

```json
{
  "moshpit": {
    "workspace": {
      "title": "Moshpit",
      "openMoshpit": "Open Moshpit",
      "backToWorkflow": "Back to Workflow"
    },
    "commands": {
      "fitView": "Fit canvas to view",
      "zoomToSelection": "Zoom to selection",
      "selectAll": "Select all assets",
      "clearSelection": "Clear selection"
    },
    "sidebar": {
      "settings": "Settings",
      "toggleSettings": "Toggle Settings Panel"
    },
    "canvas": {
      "emptyState": "No assets — add a workflow and run some generations"
    }
  }
}
```

---

## Common Pitfalls

### Pitfall 1: keep-alive Component Name Mismatch

**What goes wrong:** `<keep-alive :include="['GraphView']">` silently fails to cache if the component's internal `name` doesn't match. Vue Router 4 uses the route component's `name` option, not the route's `name`.

**Why it happens:** `GraphView.vue` may or may not declare `defineOptions({ name: 'GraphView' })`. Without it, `include` matching fails and the component unmounts on every route switch — breaking SHELL-05 (extension re-init, `onAdded`/`onConfigure` callbacks fire again).

**How to avoid:** Verify `GraphView.vue` has `defineOptions({ name: 'GraphView' })`. Add it if missing. Test by navigating `/moshpit` → `/` and asserting the graph is unchanged (no re-initialization toast, workflow state preserved).

**Warning signs:** Extensions fire `onAdded` callbacks on graph return; workflow "dirty" state resets; queue items disappear.

### Pitfall 2: PixiJS canvas focus for keybinding targetElementId

**What goes wrong:** `keybindingService` checks `container.contains(target)` where `target = event.composedPath()[0]`. A `<canvas>` element is not in the DOM focus path unless its container has `tabindex`. The check `container.contains(document.activeElement)` would pass, but the `composedPath()` target may be `document.body` for keyboard events when the canvas has no focus.

**Why it happens:** Canvas elements don't naturally capture keyboard focus; DOM keyboard events bubble up through the element that has `tabIndex`.

**How to avoid:** Set `tabindex="0"` on `#moshpit-canvas-container`. Add `@click="containerEl.focus()"` so first canvas interaction moves focus into the container. Test with `document.activeElement` assertion in Playwright.

**Warning signs:** `F`, `Z`, `Cmd+A` do nothing on the Moshpit canvas.

### Pitfall 3: pixi-viewport events property missing

**What goes wrong:** pixi-viewport v6 requires `events: app.renderer.events` in its constructor options. Without it, interaction plugins (drag, pinch, wheel) silently do nothing.

**Why it happens:** Pixi.js v8 uses `EventSystem` internally; pixi-viewport must be given the same instance.

**How to avoid:** Always pass `events: app.renderer.events` in the Viewport constructor. [CITED: pixi-viewport v6 README — required for pixi.js v8]

### Pitfall 4: Space+drag Pan Conflicts with Browser Defaults

**What goes wrong:** `Space` key triggers `scrollIntoView` or activates buttons in the browser. When Space is held and the user left-drags, the browser may scroll the page instead of triggering the Pixi pan.

**Why it happens:** `Space` has default browser behavior (scroll) and is only suppressed when `event.preventDefault()` is called on the keydown event.

**How to avoid:** In the `keydown` handler for Space, call `event.preventDefault()`. Use `useEventListener(containerEl, 'keydown', onKeyDown)` from VueUse (handles cleanup). Ensure `containerEl` has `tabindex="0"` so it receives keyboard events directly.

### Pitfall 5: `useCanvasInteractions` Test Coverage Gap

**What goes wrong:** If extraction happens before regression tests are added, callers like `useNodeImage.ts` silently break (they use `handleWheel`/`handlePointer` forwarding) — not caught until a node image widget is tested manually.

**Why it happens:** The existing `useCanvasInteractions.test.ts` covers the composable's own logic but not integration with its callers.

**How to avoid:** Write the regression tests first (D-08 gate). Include cases for: standard nav + ctrl+wheel, legacy nav + plain wheel, space+drag detection, middle mouse, wheel-over-focused-widget capture. Only then refactor.

### Pitfall 6: MoshpitLayout Global CSS Conflicts

**What goes wrong:** `SideToolbar.vue` uses `:root` selectors with CSS custom properties (e.g., `--sidebar-width`, `--sidebar-icon-size`). If `MoshpitRail.vue` renders simultaneously with the workflow sidebar (during a brief keep-alive transition), these root vars may conflict.

**Why it happens:** Both toolbars would both set `:root { --sidebar-width: ... }` when mounted.

**How to avoid:** `MoshpitRail.vue` should either use scoped CSS vars with a different name (`--moshpit-rail-width`) or avoid setting `:root` vars entirely — reference them read-only from the Moshpit context since the exact pixel values are the same.

---

## Code Examples

### PixiJS Application Mount/Unmount in Vue

```typescript
// Source: pixi.js v8 API + Vue lifecycle patterns [ASSUMED idiomatic Vue integration]
import { Application } from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useMoshpitPixi(containerEl: Ref<HTMLElement | null>) {
  const app = ref<Application | null>(null)
  const viewport = ref<Viewport | null>(null)

  onMounted(async () => {
    const el = containerEl.value
    if (!el) return

    const pixiApp = new Application()
    await pixiApp.init({
      resizeTo: el,
      background: 0x111111,
      antialias: false,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1
    })
    el.appendChild(pixiApp.canvas)

    const vp = new Viewport({
      screenWidth: el.clientWidth,
      screenHeight: el.clientHeight,
      worldWidth: 10_000,
      worldHeight: 10_000,
      events: pixiApp.renderer.events
    })
    pixiApp.stage.addChild(vp)
    vp.drag({ mouseButtons: 'middle' })
      .pinch()
      .wheel({ smooth: 3 })
      .decelerate()

    app.value = pixiApp
    viewport.value = vp
  })

  onBeforeUnmount(() => {
    app.value?.destroy(true)
    app.value = null
    viewport.value = null
  })

  return { app, viewport }
}
```

### sidebarTabStore `SidebarTabExtension` Type (for reference)

```typescript
// Source: src/types/extensionTypes.ts [VERIFIED]
interface BaseSidebarTabExtension {
  id: string
  title: string
  icon?: string | Component
  iconBadge?: string | (() => string | null)
  tooltip?: string
  label?: string
  panelSize?: number // percentage width
  panelMinSize?: number
}
type SidebarTabExtension = VueSidebarTabExtension | CustomSidebarTabExtension
```

### Keybinding targetElementId Scoping (existing mechanism)

```typescript
// Source: src/platform/keybindings/keybindingService.ts lines 37-44 [VERIFIED]
const targetElementId =
  keybinding.targetElementId === 'graph-canvas'
    ? 'graph-canvas-container'
    : keybinding.targetElementId
if (targetElementId) {
  const container = document.getElementById(targetElementId)
  if (!container?.contains(target)) return // fires only inside element
}
```

---

## State of the Art

| Old Approach                         | Current Approach              | When Changed                  | Impact                                                                                |
| ------------------------------------ | ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| pixi-viewport v5 (pixi.js v7)        | pixi-viewport v6 (pixi.js v8) | v6.0.0 release                | Constructor requires `events: app.renderer.events`; no longer uses `ticker` from pixi |
| LayoutDefault wrapping all views     | Sibling route layouts         | NEW for Moshpit               | First time a sibling top-level layout is added to this codebase                       |
| Global `<keep-alive>` for all routes | Named `include` keep-alive    | Standard Vue Router 4 pattern | Must specify `GraphView` component name explicitly                                    |

**Deprecated/outdated:**

- `pixi-viewport` v4/v5 patterns: `ticker`, `interaction` constructor options — replaced by `events` in v6.
- `:class="[]"` array syntax: forbidden per CLAUDE.md; always use `cn()`.

---

## Assumptions Log

| #   | Claim                                                                                                                                          | Section                        | Risk if Wrong                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| A1  | `GraphView.vue` declares `defineOptions({ name: 'GraphView' })` or equivalent for keep-alive `:include` matching                               | Pattern 1 — keep-alive         | SHELL-05 fails silently; litegraph canvas re-inits on every route switch, hitting 40+ extension callbacks  |
| A2  | `src/composables/canvas/` is the correct home for `useCanvasInput.ts` — no ESLint layer-boundary violation                                     | Layering Rules                 | ESLint error blocks build; `useCanvasInput` import from `src/platform/` fails                              |
| A3  | PixiJS `<canvas>` DOM events bubble correctly for `keybindingService`'s `composedPath()[0]` check when container has `tabindex="0"`            | Pattern 5 — keybinding scoping | F/Z/Cmd+A/Esc never fire in Moshpit canvas                                                                 |
| A4  | pixi-viewport v6 `fitWorld()` method fits all children added to the viewport's world                                                           | Pattern 3 — pixi-viewport      | `F` key produces unexpected zoom result (Phase 1 has no children, so likely a no-op; matters from Phase 2) |
| A5  | `useMoshpitCommands` registered from `MoshpitView.vue` (not from `GraphView`) does not pollute the global command palette when in the workflow | Pattern 5                      | Moshpit commands show in workflow command palette and can be invoked with no Moshpit instance              |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. This table is not empty; A1 and A3 should be verified early in Wave 0.

---

## Open Questions

1. **Does `GraphView.vue` declare a component name for keep-alive?**
   - What we know: `LayoutDefault.vue` renders `<router-view />` and `App.vue` renders `<router-view />` — neither uses keep-alive today.
   - What's unclear: Whether `GraphView.vue` has `defineOptions({ name: 'GraphView' })`.
   - Recommendation: Read `GraphView.vue` script section in Wave 0; add `defineOptions` if missing.

2. **pixi-viewport empty-canvas `F` behavior in Phase 1**
   - What we know: `viewport.fitWorld()` fits all children in world bounds.
   - What's unclear: Behavior when viewport has no sprite children (Phase 1).
   - Recommendation: Wire `F` to `viewport.fitWorld()` anyway; it will be a no-op in Phase 1 and correct from Phase 2. Document this in the plan.

3. **Moshpit commands registration timing**
   - What we know: `useCoreCommands` is called unconditionally during app bootstrap.
   - What's unclear: Whether commands registered via `MoshpitView.vue`'s `onMounted` survive a keep-alive suspend (component is kept but `onMounted` does not re-fire).
   - Recommendation: Register Moshpit commands in a separate call that runs once on first MoshpitView mount (use `onMounted` without problem since keep-alive preserves the mount state). Commands registered once persist in `commandStore` for the session. Confirm that `commandStore` does not clear commands on route change.

---

## Environment Availability

| Dependency    | Required By        | Available         | Version          | Fallback         |
| ------------- | ------------------ | ----------------- | ---------------- | ---------------- |
| Node.js 24.x  | pnpm, build        | ✓                 | (project pinned) | —                |
| pnpm >= 10    | package management | ✓                 | (project pinned) | —                |
| pixi.js       | MoshpitCanvas      | ✗ (not installed) | 8.18.1 on npm    | — (must install) |
| pixi-viewport | MoshpitCanvas      | ✗ (not installed) | 6.0.3 on npm     | — (must install) |

**Missing dependencies with no fallback:**

- `pixi.js` and `pixi-viewport` must be installed via `pnpm add pixi.js pixi-viewport` as part of Wave 0 setup.

**Missing dependencies with fallback:**

- None.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                |
| ------------------ | ---------------------------------------------------- |
| Framework          | Vitest 4.0.16 + happy-dom                            |
| Config file        | `vite.config.mts` `test:` block                      |
| Quick run command  | `pnpm test:unit --reporter=dot src/platform/moshpit` |
| Full suite command | `pnpm test:unit`                                     |

### Phase Requirements → Test Map

| Req ID   | Behavior                                                     | Test Type     | Automated Command                                                           | File Exists?          |
| -------- | ------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------- | --------------------- |
| SHELL-01 | Route `/moshpit` mounts MoshpitLayout, not LayoutDefault     | unit (router) | `pnpm test:unit src/router.test.ts`                                         | ❌ Wave 0             |
| SHELL-02 | PixiJS Application is created on mount, destroyed on unmount | unit          | `pnpm test:unit src/platform/moshpit/components/MoshpitCanvas.test.ts`      | ❌ Wave 0             |
| SHELL-03 | `useCanvasInput` pan/zoom/marquee math — regression suite    | unit          | `pnpm test:unit src/composables/canvas/useCanvasInput.test.ts`              | ❌ Wave 0             |
| SHELL-03 | `useCanvasInteractions` litegraph adapter unchanged behavior | unit          | `pnpm test:unit src/renderer/core/canvas/useCanvasInteractions.test.ts`     | ✅ (existing, extend) |
| SHELL-04 | `moshpitSidebarStore` auto-collapse logic (D-11/D-12)        | unit          | `pnpm test:unit src/platform/moshpit/stores/moshpitSidebarStore.test.ts`    | ❌ Wave 0             |
| SHELL-04 | `moshpitSidebarStore` re-open locks out future auto-collapse | unit          | same file                                                                   | ❌ Wave 0             |
| SHELL-05 | keep-alive preserves GraphView across route switch           | E2E           | `pnpm test:browser:local --grep "moshpit.*workflow preserved"`              | ❌ Wave 0             |
| NAV-01   | `useCanvasInput` space+drag pan detection                    | unit          | `pnpm test:unit src/composables/canvas/useCanvasInput.test.ts`              | ❌ Wave 0             |
| NAV-01   | `useCanvasInput` middle-mouse pan detection                  | unit          | same                                                                        | ❌ Wave 0             |
| NAV-01   | `useCanvasInput` wheel zoom forwarding (standard mode)       | unit          | same                                                                        | ❌ Wave 0             |
| NAV-01   | `useCanvasInput` wheel zoom forwarding (legacy mode)         | unit          | same                                                                        | ❌ Wave 0             |
| NAV-02   | `Moshpit.Canvas.FitView` command registered and callable     | unit          | `pnpm test:unit src/composables/useMoshpitCommands.test.ts`                 | ❌ Wave 0             |
| NAV-03   | Marquee drag updates rect state                              | unit          | `pnpm test:unit src/platform/moshpit/composables/useMoshpitMarquee.test.ts` | ❌ Wave 0             |
| NAV-04   | Shift+marquee merges with pre-drag selection                 | unit          | same                                                                        | ❌ Wave 0             |
| NAV-05   | Cmd+A invokes selectAll                                      | unit          | `pnpm test:unit src/platform/moshpit/stores/moshpitStore.test.ts`           | ❌ Wave 0             |
| NAV-05   | Esc invokes clearSelection                                   | unit          | same                                                                        | ❌ Wave 0             |

**Note on SHELL-05 (keep-alive):** This is the one requirement that requires a Playwright E2E test — unit tests cannot verify cross-route DOM persistence. The test: navigate to `/moshpit`, navigate back to `/`, assert `window.app.graph.nodes` unchanged and no `onAdded` callbacks fired.

**Note on empty-canvas Playwright gap (from deferred items):** Phase 1 defers marquee/Z-zoom-to-selection Playwright testing because the canvas has no sprites. Unit tests cover the composable math. The CONTEXT.md deferred section explicitly accepts this tradeoff.

### Sampling Rate

- **Per task commit:** `pnpm test:unit --reporter=dot src/platform/moshpit src/composables/canvas/useCanvasInput.test.ts src/renderer/core/canvas/useCanvasInteractions.test.ts`
- **Per wave merge:** `pnpm test:unit`
- **Phase gate:** Full suite green + `pnpm typecheck` + `pnpm lint` before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/composables/canvas/useCanvasInput.test.ts` — covers NAV-01 regression suite (D-08 gate)
- [ ] `src/platform/moshpit/stores/moshpitSidebarStore.test.ts` — covers SHELL-04 auto-collapse
- [ ] `src/platform/moshpit/stores/moshpitStore.test.ts` — covers NAV-05 selectAll/clearSelection
- [ ] `src/platform/moshpit/composables/useMoshpitMarquee.test.ts` — covers NAV-03, NAV-04
- [ ] `src/platform/moshpit/components/MoshpitCanvas.test.ts` — covers SHELL-02 Pixi lifecycle
- [ ] `src/composables/useMoshpitCommands.test.ts` — covers NAV-02 command registration
- [ ] `browser_tests/tests/moshpit.spec.ts` — covers SHELL-05 keep-alive E2E
- [ ] `pnpm add pixi.js pixi-viewport` — must precede any import of these packages

---

## Security Domain

### Applicable ASVS Categories (ASVS L1, security_enforcement=true)

| ASVS Category         | Applies | Standard Control                                                                                  |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | N/A — no new auth surface                                                                         |
| V3 Session Management | no      | N/A — Moshpit uses in-memory Pinia (Phase 1); no cookie or session                                |
| V4 Access Control     | partial | Route `/moshpit` should respect existing cloud auth guard if distribution=cloud                   |
| V5 Input Validation   | yes     | Keyboard event handler validates key combos via `KeyComboImpl.fromEvent(event)` (existing system) |
| V6 Cryptography       | no      | N/A                                                                                               |

### Known Threat Patterns for this Stack

| Pattern                                                         | STRIDE                 | Standard Mitigation                                                                                                                                             |
| --------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route bypass (unauthenticated `/moshpit` on cloud distribution) | Elevation of Privilege | Add `/moshpit` to the cloud auth guard's protected routes (same `beforeEach` guard in router.ts that covers `/`)                                                |
| Keyboard event injection from malicious extensions              | Tampering              | Keybinding service uses `event.composedPath()` + `targetElementId` DOM check — only fires inside the Moshpit container. Extensions cannot spoof DOM containment |
| PixiJS canvas CORS or resource loading from arbitrary URLs      | Information Disclosure | Phase 1 canvas is empty; no external resource loading. Future sprite loading in Phase 2 should use the existing `api` helper for ComfyUI URLs                   |

**Route auth guard note:** The existing cloud `beforeEach` guard protects routes based on `to.path`. Adding `/moshpit` to the guard's handled paths (or ensuring it falls through to the default `!isLoggedIn` → redirect logic) is required for cloud distribution. For localhost and desktop distributions, no guard is needed.

---

## Sources

### Primary (HIGH confidence)

- `src/renderer/core/canvas/useCanvasInteractions.ts` — verified full file; extracted all function signatures and callers
- `src/renderer/core/canvas/useCanvasInteractions.test.ts` — verified test patterns and mock setup
- `src/router.ts` — verified route structure; confirmed no existing keep-alive
- `src/App.vue` — verified `<router-view />` render point
- `src/views/layouts/LayoutDefault.vue` — verified minimal wrapper (just `<main>` + `<router-view />`)
- `src/views/GraphView.vue` — verified mount structure (partial read)
- `src/stores/workspace/sidebarTabStore.ts` — verified full store; command auto-registration behavior
- `src/types/extensionTypes.ts` — verified `SidebarTabExtension` type shape
- `src/components/sidebar/SideToolbar.vue` — verified CSS variables, tab click logic
- `src/platform/assets/composables/useMarqueeSelection.ts` — verified asset-coupling prevents reuse
- `src/platform/keybindings/keybindingService.ts` — verified `targetElementId` DOM containment check
- `src/platform/keybindings/defaults.ts` — verified F/Z/Cmd+A/Esc are free of collisions
- `src/base/pointerUtils.ts` — verified `isMiddlePointerInput` function
- `eslint.config.ts` — verified layer boundary rules
- `npm view pixi.js` — latest 8.18.1 [VERIFIED: npm registry]
- `npm view pixi-viewport` — latest 6.0.3, peer dep `pixi.js >= 8` [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)

- pixi-viewport v6 constructor requires `events: app.renderer.events` — sourced from package README patterns and peer-dep structure confirming v8 compatibility

### Tertiary (LOW confidence — see Assumptions Log)

- GraphView keep-alive component name — must verify `defineOptions({ name: 'GraphView' })` in the actual file
- `src/composables/canvas/` as ESLint-safe home for `useCanvasInput.ts` — must run layer-audit after placement

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — versions verified against npm registry
- Architecture: HIGH — all patterns verified against live codebase files
- Pitfalls: HIGH — derived from reading actual implementation files
- Keybinding scoping: HIGH — read keybindingService.ts source code directly
- pixi-viewport integration: MEDIUM — API shape from package structure; no runtime test possible pre-installation

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (pixi.js releases frequently; re-verify version before install)
