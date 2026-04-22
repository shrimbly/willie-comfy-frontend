# Phase 1: Workspace Shell & Canvas Navigation - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Mount an empty full-bleed PixiJS canvas as the Moshpit workspace — a top-level peer of the workflow graph. Deliver pan/zoom/selection parity with the litegraph canvas via a shared input composable, and wire the left Settings panel slot through the sidebar tab extension system. Asset rendering (Phase 2), filtering (Phase 3), and curation (Phase 5) are explicitly out of scope.

Requirements in-scope: SHELL-01..05, NAV-01..05.

</domain>

<decisions>
## Implementation Decisions

### Workspace Entry & Exit

- **D-01:** Entry is route-based. Moshpit gets a dedicated `/moshpit` URL; the existing workflow editor stays at `/`. Return to workflow is via browser back or a top-nav control in the shared menu bar.
- **D-02:** No keyboard shortcut to toggle Moshpit in v1. Discoverability via URL + menu is sufficient for prosumer dogfooding; shortcuts can be added after validation if requested.
- **D-03:** Moshpit keeps **full session state** across route exits — viewport (pan/zoom), selection, and Settings panel open/closed state all persist in-memory while the browser tab lives. Cross-reload persistence to IndexedDB is desirable but **may defer to Phase 2**, when the IndexedDB store is stood up; Phase 1 owns the in-memory Pinia store that Phase 2 will persist-hydrate.

### Layout Integration

- **D-04:** Moshpit mounts via a new **`MoshpitLayout.vue`** that is a **sibling to `LayoutDefault.vue`** in the router — not a reuse of LayoutDefault's center cell. Keeps Moshpit's full-bleed posture uncompromised by grid chrome it doesn't need.
- **D-05:** Chrome sharing with LayoutDefault: **MenuHamburger (top menu bar) is shared** — same File/Edit/View/Help entry points. Left sidebar (`SideToolbar`), bottom panel, and global toasts/dialogs are **NOT** shared — Moshpit mounts its own equivalents in MoshpitLayout where needed. Toast infrastructure for Phase 5 curation undo will need its own mount point inside MoshpitLayout.
- **D-06:** `GraphView` is wrapped in **`<keep-alive>`** so the litegraph canvas, loaded workflow, selection, and extension state all persist across the route switch. SHELL-05 ("workflow unchanged on return") depends on this — unmount-and-reload is rejected because re-init side-effects would hit 40+ extensions via `onAdded`/`onConfigure` callbacks.

### Shared-Input Composable Strategy

- **D-07:** Extract a **pure `useCanvasInput` composable** that owns pan/zoom/marquee math against a generic viewport state (pan x/y + zoom + selection set). The current `src/renderer/core/canvas/useCanvasInteractions.ts` becomes a thin litegraph adapter that forwards the composable's emitted events to `app.canvas`. Moshpit gets a second Pixi adapter that drives `pixi-viewport`.
  - **D-07 addendum (Phase 1 gap closure, 01-06-PLAN):** The extraction to `useCanvasInput` shipped and IS the input path for the litegraph canvas via `useCanvasInteractions`. The Moshpit path, however, achieves pan/zoom parity via **pixi-viewport plugin configuration equivalence** (middle-mouse drag, wheel smooth-zoom, pinch, decelerate, plus Space+drag via the now-renamed `useMoshpitSpacePan`), not via dispatch through `useCanvasInput`. The originally-planned "Moshpit gets a second Pixi adapter that drives pixi-viewport" sub-clause of D-07 is **deferred**: a real `CanvasInputNavigator` implementation for Moshpit will land if/when pixi-viewport is replaced with custom navigator-driven input. For Phase 1, SHELL-03 is satisfied by behavior equivalence (the _what_), not by code sharing (the _how_). See `01-06-PLAN.md` for rationale and `01-VERIFICATION.md` for the updated SC-2 status.
- **D-08:** **Zero regressions on the litegraph path.** Before extraction, pin current behavior with tests: standard _and_ legacy nav mode, middle-mouse panning, `Space`+drag, wheel-over-focused-widget capture, and marquee. Extraction happens behind that harness; any behavioral drift fails CI. Accepts slower Phase 1 in exchange for not breaking the 40+ extension ecosystem.
- **D-09:** PixiJS viewport is managed by the **`pixi-viewport` plugin**. The `useCanvasInput` composable emits transform state; the Pixi adapter applies it to `pixi-viewport`'s API. Claude's discretion on inertia/clamp knobs and exact plugin version.

### Settings Panel Re-open Affordance

- **D-10:** MoshpitLayout mounts a **Moshpit-specific left icon rail** with the **same visual pattern as the litegraph `SideToolbar`** but with Moshpit-specific icons/buttons. Clicking the Settings tab icon re-opens the collapsed panel, exactly like toggling Assets/Workflows in the workflow canvas today. Wiring through the existing `sidebarTabStore` or a parallel Moshpit tab store is Claude's discretion — whichever is cleaner given the scoping.
- **D-11:** Once the user re-opens the Settings panel, it **stays open for the rest of the session**. Auto-collapse is a one-time first-entry onboarding affordance, not a persistent behavior. Re-opening the panel is an explicit "I want this visible" signal; Moshpit respects it.
- **D-12:** Auto-collapse triggers on **clicks only** — click on empty canvas OR click on an asset (once assets exist in Phase 2+). **Pan, zoom, and scroll do NOT collapse the panel.** This is a **refinement of SHELL-04's literal "pan / zoom / click" wording** — this CONTEXT decision is authoritative for the planner. Phase 1 ships only the empty-canvas-click trigger; asset-click adds in Phase 2.

### Claude's Discretion

- Exact Pinia store shape for Moshpit viewport/selection state (name, setup API structure, in-memory vs persisted split).
- Router guard details (if any) for `/moshpit`.
- Directory placement (suggest `src/platform/moshpit/` as a new platform-layer domain; planner/researcher to confirm against layering rules).
- Adapter interface shape for `useCanvasInput` (generic state shape vs typed target interface).
- Whether to reuse `sidebarTabStore` directly or stand up a parallel `moshpitTabStore` for the Moshpit left rail.
- Specific test harness approach for pinning current litegraph pan/zoom/marquee before extraction.
- `pixi-viewport` version selection and wheel/pinch/drag plugin knob defaults.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ADRs (entity architecture constraints)

- `docs/adr/0001-merge-litegraph-into-frontend.md` — litegraph is vendored under `src/lib/litegraph`, no upstream pushes; treat as internal library.
- `docs/adr/0003-crdt-based-layout-system.md` — command pattern for entity mutations; Moshpit layout writes must be serializable commands.
- `docs/adr/0008-entity-component-system.md` — no methods/properties added to `LGraphNode`/`LGraphCanvas`/`LGraph`/`Subgraph`; new canvas logic lives in composables/stores/systems.

### Project-level specs

- `.planning/PROJECT.md` §Constraints, §Key Decisions — PixiJS chosen, shared input composable only, IndexedDB v1, desktop-first, no `dark:` / `!important` / `any`.
- `.planning/REQUIREMENTS.md` §Workspace Shell (SHELL-01..05), §Canvas Navigation (NAV-01..05) — authoritative scope list.
- `.planning/ROADMAP.md` §Phase 1 Success Criteria — what must be TRUE at phase exit.

### Codebase maps

- `.planning/codebase/STRUCTURE.md` — layer rules (`base → platform → workbench → renderer`), "Where to Add New Code" table.
- `.planning/codebase/ARCHITECTURE.md` — store/composable/service patterns, route-driven shell.
- `.planning/codebase/CONVENTIONS.md` — Vue 3.5 destructured props, Tailwind semantic tokens, no `dark:`, `cn()` only.

### Existing code to extend / extract from

- `src/renderer/core/canvas/useCanvasInteractions.ts` — current pan/zoom/selection forwarding; source of the extraction in D-07.
- `src/renderer/core/canvas/canvasStore.ts` — current canvas store; informs Moshpit viewport store shape.
- `src/base/pointerUtils.ts` — `isMiddlePointerInput` and friends, already in base layer, reuse directly.
- `src/views/layouts/LayoutDefault.vue` — grid layout to sibling alongside MoshpitLayout.
- `src/views/GraphView.vue` — view to wrap in `<keep-alive>` per D-06.
- `src/router.ts` — route table to extend with `/moshpit`.
- `src/stores/workspace/sidebarTabStore.ts` — sidebar tab extension system (SHELL-04 reference); decide reuse vs parallel in D-10.
- `src/components/sidebar/SideToolbar.vue` — visual pattern for the Moshpit-specific left rail in D-10.
- `src/platform/keybindings/defaults.ts` — to check for collisions if keyboard shortcut is ever added.

### Guidance docs

- `docs/guidance/typescript.md` — no `any`/`as any`, type assertion hierarchy.
- `docs/guidance/vue-components.md` — `<script setup>`, destructured props with defaults, `defineModel` over prop+emit.
- `docs/guidance/design-standards.md` — Figma as source of truth; check for Moshpit-specific design tokens before hardcoding.

### External library docs (fetch via Context7 when planning)

- `pixi-viewport` — viewport plugin for Pixi v8 (D-09).
- `pixi.js` v8 — renderer API for Moshpit canvas.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`useCanvasInteractions` (`src/renderer/core/canvas/useCanvasInteractions.ts`)** — pan/zoom/wheel forwarding logic; the _direct source_ for the D-07 extraction. Currently forwards events to `app.canvas`; the pure math separates cleanly.
- **`pointerUtils.ts` (`src/base/pointerUtils.ts`)** — middle-mouse detection; base-layer primitive, reuse as-is.
- **`sidebarTabStore` (`src/stores/workspace/sidebarTabStore.ts`)** — already supports arbitrary tab registration with command auto-registration; SHELL-04 literally names this system. Moshpit can either register its Settings tab here or spin up a parallel store if the semantics diverge too far.
- **`keep-alive` / Vue router** — standard Vue pattern, no dependency cost; the clean lever for D-06 preservation.
- **`useMagicKeys` via VueUse** — used in `workspaceStore` for shift detection; reuse for Moshpit key-modifier tracking.
- **`useMarqueeSelection` (`src/platform/assets/composables/useMarqueeSelection.ts`)** — existing marquee composable in the assets domain; inspect before writing a new one for the PixiJS canvas.

### Established Patterns

- **Pinia Setup API** — every store in the repo uses `defineStore('name', () => { ... })` with private refs and a returned public surface. Moshpit stores follow the same shape.
- **Platform-layer domains** — `src/platform/<domain>/{stores,composables,components,services}` is the standard home for cross-cutting capabilities. Moshpit likely lives at `src/platform/moshpit/`.
- **Route + LayoutDefault wrapping** — current router uses a `LayoutDefault` outer shell with child routes. MoshpitLayout being a sibling route is a _new_ pattern for this codebase but syntactically identical.
- **vue-i18n for all strings** — no raw text in templates; new strings land in `src/locales/en/main.json` under a `moshpit.*` namespace.
- **Tailwind 4 semantic tokens** — `bg-node-component-surface` etc., never `dark:`. Moshpit canvas chrome should use the same token family.

### Integration Points

- **`src/router.ts`** — add `/moshpit` route wrapping `MoshpitLayout.vue`; keep existing `GraphView` route intact.
- **`src/views/layouts/LayoutDefault.vue`** — wrap `<GraphCanvas>` in `<keep-alive>` (or equivalent at the route-view level).
- **`src/stores/workspace/sidebarTabStore.ts`** — reuse for Moshpit left-rail tab registration if semantics align; otherwise stand up a parallel store colocated with the Moshpit domain.
- **`src/composables/useCoreCommands.ts`** — register any new Moshpit-scoped commands here (even without a keyboard shortcut, discoverable via command palette).
- **MenuHamburger** — add a "Open Moshpit" / "Back to Workflow" entry that navigates via `router.push('/moshpit')` / `router.push('/')`.

</code_context>

<specifics>
## Specific Ideas

- **"Like the node graph layout"** — for the Moshpit left rail, the user explicitly named the litegraph `SideToolbar` pattern as the target look. Same icon-rail visual, Moshpit-specific icons/buttons. Match its width and token usage, not its content.
- **Respect existing nav-mode setting** — `Comfy.Canvas.NavigationMode` (standard vs legacy) is honored today by `useCanvasInteractions`. The extracted `useCanvasInput` should preserve this setting for the litegraph path. Claude's discretion on whether Moshpit also honors this setting or is always "standard" — lean toward honoring it for consistency.

</specifics>

<deferred>
## Deferred Ideas

- **Keyboard shortcut to toggle Moshpit** — deliberately not shipped in v1 (D-02). Revisit after Phase 3 validation based on dogfood feedback.
- **Cross-reload persistence of viewport/selection/panel state** — the in-memory Pinia store lands in Phase 1; IndexedDB-backed persistence rides on the Phase 2 IndexedDB store.
- **Asset-click auto-collapse** — the click trigger is cleanly defined here, but Phase 1 only implements the empty-canvas-click variant. Phase 2 extends the trigger to asset-click when sprites exist.
- **Toast infrastructure inside MoshpitLayout** — Phase 1 does not need toasts; Phase 5 curation undo requires them. Whoever plans MoshpitLayout should leave a slot.
- **Empty-canvas validation strategy for Phase 1** — user chose to skip this discussion. The planner/researcher must decide whether to ship test fixtures, dev-only placeholder sprites, or defer empirical validation of marquee/selection/`Z`-zoom-to-selection until Phase 2. Recommend a unit-test-first posture for the extracted composable with a deferred integration pass when Phase 2 assets arrive.
- **Figma design reference check** — no Moshpit-specific Figma node was referenced in discussion. Before implementing chrome in MoshpitLayout, check Comfy Design Standards for any Moshpit tokens/components.

</deferred>

---

_Phase: 01-workspace-shell-canvas-navigation_
_Context gathered: 2026-04-20_
