# Architecture

**Analysis Date:** 2026-04-20

## Pattern Overview

**Overall:** Layered Vue 3 SPA with a pluggable graph-editor core. Four primary
layers (base → platform → workbench → renderer) sit on top of a shared
`src/lib/litegraph` entity engine. Domain state uses Pinia stores; mutations to
the graph are transitioning toward a command / ECS model (ADR 0003, ADR 0008).
The repo is an Nx + pnpm monorepo containing the main frontend app plus
workspace packages under `packages/` and additional apps under `apps/`.

**Key Characteristics:**

- Vue 3.5 Composition API SFCs (`<script setup lang="ts">`) — runtime composition
  with reactive props destructuring, `defineModel`, no Options API.
- Pinia stores in `src/stores/` and `src/platform/**/stores/` as the single
  source of truth for cross-cutting state (workspace, workflow, queue, execution,
  assets, settings, commands).
- Layered imports enforced: `base` is the most restrictive, `platform` composes
  base, `workbench`/`renderer` compose platform, per the ADRs in `docs/adr/`.
- Graph rendering delegates to the vendored/merged litegraph core in
  `src/lib/litegraph/` (ADR 0001). The core owns `LGraph`, `LGraphNode`,
  `LGraphCanvas`, `Subgraph`, widgets, and link/slot geometry.
- A Vue-native node renderer in `src/renderer/extensions/vueNodes/` runs
  alongside the legacy canvas renderer, using a shared `layoutStore` as the
  coordinate source of truth.
- Entity mutations are migrating to an Entity-Component-System model with
  command-pattern dispatch (ADR 0008); new cross-cutting features must be
  built as systems/commands, not as methods on `LGraphNode`/`LGraph`.
- Route-driven shell: `src/router.ts` mounts `LayoutDefault` then either
  `GraphView` (primary workspace) or `UserSelectView`; cloud builds dynamically
  import `cloudOnboardingRoutes`.
- Distribution-aware bootstrapping: `localhost` / `desktop` (Electron) /
  `cloud` branches selected via `__DISTRIBUTION__` constant and
  `src/platform/distribution/types.ts`.

## Layers

**base (`src/base/`):**

- Purpose: Low-level primitives shared by every layer. No dependencies on
  platform, workbench, renderer, stores, or Vue components.
- Location: `src/base/`
- Contains: `common/`, `credits/`, `pointerUtils.ts` — generic utilities and
  pointer math used everywhere.
- Depends on: Third-party packages only.
- Used by: `platform`, `workbench`, `renderer`, top-level `src/` code.

**platform (`src/platform/`):**

- Purpose: Cross-cutting product capabilities — auth, settings, telemetry,
  workspace, workflow persistence/validation, assets, distribution, navigation,
  cloud onboarding, tasks, updates, surveys, keybindings, remote config.
- Location: `src/platform/`
- Contains:
  - `src/platform/auth/`, `src/platform/cloud/`, `src/platform/distribution/`
  - `src/platform/settings/` (settings store + UI)
  - `src/platform/telemetry/`
  - `src/platform/workflow/` — `core/`, `management/`, `persistence/`,
    `sharing/`, `templates/`, `validation/` (Zod schemas)
  - `src/platform/assets/` — `services/assetService.ts`, components, composables,
    schemas, import sources, mappings
  - `src/platform/workspace/` — workspace API, stores, components
- Depends on: `base`, third-party libs, Pinia, Vue.
- Used by: `workbench`, `renderer`, top-level `src/` components and views.

**workbench (`src/workbench/`):**

- Purpose: Authoring surface and extension runtime that sits around the graph.
- Location: `src/workbench/`
- Contains:
  - `src/workbench/extensions/manager/` — the in-product ComfyUI-Manager
    (components/composables/services/stores/types/utils + generated manager
    types).
  - `src/workbench/eventHelpers.ts`, `src/workbench/utils/`
- Depends on: `base`, `platform`.
- Used by: Top-level views, renderer extensions, components.

**renderer (`src/renderer/`):**

- Purpose: Rendering pipeline for the graph canvas, spatial indexing, layout
  sync, Vue-based node rendering, and canvas-side extensions.
- Location: `src/renderer/`
- Contains:
  - `src/renderer/core/canvas/` — canvas interaction, link routing,
    `pathRenderer.ts`, `useAutoPan.ts`, `useCanvasInteractions.ts`,
    `canvasStore.ts`.
  - `src/renderer/core/layout/store/layoutStore.ts` — authoritative node
    bounds / position store; bridges legacy litegraph geometry to Vue nodes.
  - `src/renderer/core/spatial/QuadTree.ts`, `SpatialIndex.ts` — viewport and
    hit-testing acceleration.
  - `src/renderer/core/thumbnail/graphThumbnailRenderer.ts` — workflow
    thumbnails.
  - `src/renderer/extensions/vueNodes/` — Vue-based node rendering layer
    (components, composables, execution, interactions, layout, preview, slots,
    stores, widgets).
  - `src/renderer/extensions/minimap/` — minimap canvas.
  - `src/renderer/extensions/linearMode/` — linear execution UI.
  - `src/renderer/glsl/`, `src/renderer/utils/`.
- Depends on: `base`, `platform`, `src/lib/litegraph`.
- Used by: `src/components/graph/`, views, top-level app.

**litegraph core (`src/lib/litegraph/src/`):**

- Purpose: Graph data model + legacy canvas renderer (merged in by ADR 0001).
- Key files: `LGraph.ts` (3194 lines), `LGraphNode.ts` (4285 lines),
  `LGraphCanvas.ts` (9093 lines), `litegraph.ts` (barrel), `LLink.ts`,
  `Reroute.ts`, `LGraphGroup.ts`, `CanvasPointer.ts`, `ContextMenu.ts`,
  `DragAndScale.ts`, `draw.ts`, `measure.ts`.
- Subsystems:
  - `src/lib/litegraph/src/canvas/` — `LinkConnector.ts` + render-link variants
    (`ToInputRenderLink.ts`, `ToOutputRenderLink.ts`, etc.), `InputIndicators.ts`,
    `measureSlots.ts`.
  - `src/lib/litegraph/src/node/` — `SlotBase.ts`, `NodeInputSlot.ts`,
    `NodeOutputSlot.ts`, `slotUtils.ts`.
  - `src/lib/litegraph/src/widgets/` — 25+ widget classes
    (`BaseWidget.ts`, `NumberWidget.ts`, `ComboWidget.ts`, `AssetWidget.ts`,
    `PainterWidget.ts`, `CurveWidget.ts`, …) plus `widgetMap.ts`.
  - `src/lib/litegraph/src/subgraph/` — `Subgraph.ts`, `SubgraphNode.ts`,
    `SubgraphInput.ts`, `SubgraphOutput.ts`, `PromotedWidgetViewManager.ts`,
    `ExecutableNodeDTO.ts`.
  - `src/lib/litegraph/src/infrastructure/` — error classes
    (`InvalidLinkError`, `NullGraphError`, `RecursionError`, `SlotIndexError`),
    event maps (`LGraphEventMap`, `LGraphCanvasEventMap`,
    `SubgraphEventMap`), `Rectangle.ts`, `ConstrainedSize.ts`,
    `CustomEventTarget.ts`.
- Depends on: Self-contained; no imports from `src/` parent.
- Used by: `src/scripts/app.ts`, `src/renderer/**`, `src/stores/**`,
  `src/components/graph/**`.

**core (`src/core/`):**

- Purpose: Narrow bridge between litegraph entities and schema/subgraph/widget
  adaptation utilities used by platform and renderer (`core/graph/`,
  `core/schemas/`).

## Data Flow

**App bootstrap:**

1. `src/main.ts` creates the Vue app, wires Pinia, PrimeVue, vue-i18n, VueFire,
   Sentry, the router, and mounts `#vue-app`.
2. For `__DISTRIBUTION__ === 'cloud'`, `main.ts` dynamically imports and awaits
   `refreshRemoteConfig()` and `initTelemetry()` before `createApp`.
3. `useBootstrapStore(pinia).startStoreBootstrap()` kicks off async store
   initialization (settings, user, feature flags, workflow, extensions).
4. `src/router.ts` resolves the initial route; `LayoutDefault.vue` renders and
   mounts `GraphView.vue` or `UserSelectView.vue`.
5. `GraphView.vue` boots the legacy ComfyApp singleton from
   `src/scripts/app.ts`, which creates `LGraph` + `LGraphCanvas` and attaches
   the extension service.

**Graph lifecycle:**

1. `ComfyApp.setup()` in `src/scripts/app.ts` creates `new LGraph()` and
   `new LGraphCanvas(canvas, graph)` from `@/lib/litegraph/src/litegraph`.
2. Node definitions load via `src/stores/nodeDefStore.ts` from the Comfy API
   (`src/scripts/api.ts`), producing typed `ComfyNodeDef` entries validated
   against `src/schemas/nodeDefSchema.ts`.
3. Workflow JSON is loaded/validated by
   `src/platform/workflow/validation/schemas/workflowSchema.ts` (Zod) before
   being fed into `LGraph.configure()`.
4. Geometry from litegraph is synced into the Vue world via
   `src/renderer/core/layout/sync/syncLayoutStoreFromGraph.ts` →
   `src/renderer/core/layout/store/layoutStore.ts`.
5. `src/renderer/extensions/vueNodes/` renders Vue nodes over the canvas using
   the same layout store.

**Execution & queue:**

1. User triggers queue via commands → `src/stores/queueStore.ts` posts to the
   backend through `src/scripts/api.ts`.
2. Backend progress messages arrive over WebSocket into
   `src/stores/executionStore.ts` and `src/stores/executionErrorStore.ts`.
3. Node outputs are captured by `src/stores/nodeOutputStore.ts` and cached via
   `src/services/jobOutputCache.ts` / `src/services/mediaCacheService.ts`.
4. Preview stream feeds `src/stores/jobPreviewStore.ts`; UI surfaces via
   `src/components/queue/QueueProgressOverlay.vue` and related.

**State Management:**

- Pinia (`createPinia()` in `src/main.ts`). All stores are Setup-API stores
  (`defineStore('name', () => { … })`). Public surface is narrow — internal
  refs kept private per `src/AGENTS.md`.
- Core stores in `src/stores/` (74 files): `workspaceStore`, `commandStore`,
  `executionStore`, `queueStore`, `nodeDefStore`, `nodeOutputStore`,
  `widgetStore`, `widgetValueStore`, `domWidgetStore`, `subgraphStore`,
  `subgraphNavigationStore`, `extensionStore`, `assetsStore`,
  `assetDownloadStore`, `assetExportStore`, `executionErrorStore`,
  `jobPreviewStore`, `modelStore`, `userFileStore`, `bootstrapStore`,
  `systemStatsStore`, `serverConfigStore`, `authStore`, `apiKeyAuthStore`,
  `comfyRegistryStore`, etc.
- Workspace-scoped stores in `src/stores/workspace/`:
  `bottomPanelStore`, `sidebarTabStore`, `rightSidePanelStore`,
  `colorPaletteStore`, `favoritedWidgetsStore`, `nodeHelpStore`,
  `searchBoxStore`, `assetsSidebarBadgeStore`.
- Platform-owned stores live with their domain: e.g.
  `src/platform/settings/settingStore.ts`,
  `src/platform/workflow/management/stores/workflowStore.ts`,
  `src/platform/updates/common/toastStore.ts`,
  `src/platform/workspace/stores/…`.
- Renderer state: `src/renderer/core/canvas/canvasStore.ts`,
  `src/renderer/core/layout/store/layoutStore.ts`.

## Key Abstractions

**LGraph / LGraphNode / LGraphCanvas:**

- Purpose: Graph model, node entity, canvas renderer.
- Examples: `src/lib/litegraph/src/LGraph.ts`,
  `src/lib/litegraph/src/LGraphNode.ts`,
  `src/lib/litegraph/src/LGraphCanvas.ts`.
- Pattern: Today these are god-object OOP classes. Per ADR 0008, all new
  features must decompose into ECS components + systems/commands, not new
  methods. Public callback surface (`onConnectionsChange`, `onAdded`,
  `onRemoved`, `onConnectInput/Output`, `onConfigure`, `onWidgetChanged`) is
  part of the 40+-extension contract and must not change without a migration
  plan.

**Subgraph:**

- Purpose: Nested graph hosted by a node.
- Examples: `src/lib/litegraph/src/subgraph/Subgraph.ts`,
  `SubgraphNode.ts`, `PromotedWidgetViewManager.ts`,
  `ExecutableNodeDTO.ts`, `src/stores/subgraphStore.ts`,
  `src/stores/subgraphNavigationStore.ts`.
- Pattern: A subgraph is modeled as a node with subgraph components
  (`SubgraphStructure`, `SubgraphMeta`) in the ECS plan. Widget promotion is
  documented in `docs/architecture/subgraph-boundaries-and-promotion.md`.

**Widgets:**

- Purpose: Per-node inputs (number, combo, slider, file upload, curve, asset,
  painter, chart, markdown, textarea, multiselect, tree-select, etc.).
- Canvas implementations: `src/lib/litegraph/src/widgets/*Widget.ts` plus
  `widgetMap.ts`.
- Vue/DOM implementations: `src/scripts/domWidget.ts`,
  `src/stores/domWidgetStore.ts`, `src/stores/widgetStore.ts`,
  `src/stores/widgetValueStore.ts`,
  `src/renderer/extensions/vueNodes/widgets/`.

**Workflow:**

- Purpose: Serialized graph + metadata managed and persisted as documents.
- Examples: `src/platform/workflow/management/stores/workflowStore.ts`
  (defines `ComfyWorkflow`), `comfyWorkflow.ts`,
  `src/platform/workflow/core/services/workflowService.ts`,
  `src/platform/workflow/validation/schemas/workflowSchema.ts` (Zod),
  `src/platform/workflow/persistence/`, `src/platform/workflow/templates/`,
  `src/platform/workflow/sharing/`, `src/platform/workflow/cloud/`.
- Pattern: Workflow object tracks dirty state, validation warnings, and load
  source; persistence is distribution-aware (localhost/desktop/cloud).

**Assets:**

- Purpose: Unified model for inputs/outputs/models/media.
- Examples: `src/platform/assets/services/assetService.ts`,
  `src/platform/assets/components/AssetBrowserModal.vue`,
  `src/platform/assets/composables/`, `src/platform/assets/schemas/`,
  `src/platform/assets/importSources/`,
  `src/stores/assetsStore.ts`, `src/stores/assetDownloadStore.ts`,
  `src/stores/assetExportStore.ts`,
  `src/stores/workspace/assetsSidebarBadgeStore.ts`.

**Queue & Execution:**

- Purpose: Submit prompts, track progress, surface outputs.
- Examples: `src/stores/queueStore.ts`, `src/stores/executionStore.ts`,
  `src/stores/executionErrorStore.ts`, `src/stores/nodeOutputStore.ts`,
  `src/stores/jobPreviewStore.ts`,
  `src/services/autoQueueService.ts`,
  `src/services/jobOutputCache.ts`,
  `src/services/mediaCacheService.ts`,
  `src/scripts/api.ts`.

**Commands:**

- Purpose: Typed keyboard/menu-invokable actions plus the migration target for
  all graph mutations (ADR 0003).
- Examples: `src/stores/commandStore.ts`, `src/composables/useCoreCommands.ts`,
  `src/constants/coreMenuCommands.ts`, `src/services/extensionService.ts`
  (extensions register commands).

**ComfyApp (legacy god):**

- Location: `src/scripts/app.ts`.
- Role: Bridge between `main.ts`/`App.vue` and the litegraph canvas — owns the
  long-lived `LGraphCanvas` instance, wires the change tracker
  (`src/scripts/changeTracker.ts`), the extension manager, and default-graph
  loading (`src/scripts/defaultGraph.ts`). New code should not grow this file;
  extract into composables/stores/services.

**World (ECS, in progress):**

- Target: Centralized component registry keyed by branded entity IDs; see
  `docs/adr/0008-entity-component-system.md` and
  `docs/architecture/ecs-world-command-api.md`.
- Today: No `src/ecs/` directory yet. Bridges exist indirectly through
  `src/renderer/core/layout/store/layoutStore.ts` which already owns canonical
  node geometry.

## Entry Points

**Web entry (`src/main.ts` → `index.html`):**

- Location: `src/main.ts`, mount point `#vue-app` in `/index.html`.
- Triggers: `pnpm dev` / `pnpm build` via Vite (`vite.config.mts`).
- Responsibilities: Distribution branching (cloud/desktop/localhost), Sentry
  init, Firebase init, Pinia, PrimeVue + custom preset, i18n, router,
  VueFire, bootstrap store kick-off.

**Electron entry:**

- Location: `vite.electron.config.mts`, `pnpm dev:electron`.
- Responsibilities: Runs same Vue app with Electron API mocks and
  `DISTRIBUTION=desktop` define; `electronAPI()` in `src/utils/envUtil.ts` is
  used for native bridges.

**Router (`src/router.ts`):**

- Routes:
  - `/` → `LayoutDefault.vue` → `GraphView.vue` (primary workspace).
  - `/user-select` → `UserSelectView.vue`.
  - Cloud: dynamically imported `cloudOnboardingRoutes` from
    `src/platform/cloud/onboarding/onboardingCloudRoutes`.
- History: `createWebHashHistory()` when `file:` protocol (Electron bundled),
  otherwise `createWebHistory(getBasePath())` where `getBasePath()` honors
  `BASE_URL` on cloud and `window.location.pathname` on self-hosted.
- Guards: User init check for `GraphView`; cloud-only global guard that
  enforces Firebase auth, onboarding survey status, and preserved query
  tracking via `installPreservedQueryTracker`.

**Views (`src/views/`):**

- `src/views/layouts/LayoutDefault.vue` — outer shell.
- `src/views/GraphView.vue` — primary editor view.
- `src/views/LinearView.vue` — linear-mode execution view.
- `src/views/UserSelectView.vue` — multi-user selector.
- `src/views/templates/` — template browser/galleries.

**Backend API (`src/scripts/api.ts`):**

- Owns `/prompt`, `/queue`, `/history`, `/object_info`, WebSocket progress,
  feature flag discovery, folder paths, server logs. Central for every
  queue/execution interaction.

**Test entry points:**

- Unit: `vitest run` via `nx run test` → `vitest.setup.ts` uses `happy-dom`.
- E2E: `playwright.config.ts` → `browser_tests/globalSetup.ts` and
  `browser_tests/tests/**/*.spec.ts`.

## Error Handling

**Strategy:** Explicit, user-facing, and Sentry-observable. Errors must have
actionable messages (`src/AGENTS.md`).

**Patterns:**

- Global Vue error path reports to Sentry (`src/main.ts`); cloud build uses
  `tracesSampleRate: 1.0` and `browserApiErrorsIntegration({ eventTarget: false })`
  to avoid pointermove overhead.
- `App.vue` listens for `vite:preloadError` and resource-load errors; logs and
  reports (silenced toast because extension authors trigger false positives).
- Unified handler composable: `src/composables/useErrorHandling.ts`.
- Toasts: `src/platform/updates/common/toastStore.ts` +
  `src/components/toast/GlobalToast.vue`.
- Execution errors: `src/stores/executionErrorStore.ts` +
  `src/components/error/`.
- Litegraph domain errors: `src/lib/litegraph/src/infrastructure/*Error.ts`
  (`InvalidLinkError`, `NullGraphError`, `RecursionError`, `SlotIndexError`).
- Preload-error parser: `src/utils/preloadErrorUtil.ts`.

## Cross-Cutting Concerns

**Logging:**

- `loglevel` dependency wraps console; Sentry breadcrumbs on cloud. Never log
  secrets (`src/AGENTS.md`).

**Validation:**

- Zod schemas throughout: `src/schemas/apiSchema.ts`,
  `src/schemas/nodeDefSchema.ts`,
  `src/platform/workflow/validation/schemas/workflowSchema.ts`, asset schemas
  under `src/platform/assets/schemas/`. API responses are type-narrowed via
  `generatedManagerTypes.ts`, `packages/ingest-types`, `packages/registry-types`.

**Authentication:**

- Firebase + VueFire (`src/main.ts`, `src/stores/authStore.ts`,
  `src/stores/apiKeyAuthStore.ts`), cloud-only auth guard in `src/router.ts`.

**i18n:**

- vue-i18n (`src/i18n.ts`), translations in `src/locales/{en,…}/main.json`.
  New strings must go in `src/locales/en/main.json` and use the plurals system
  rather than template-level pluralization.

**Theming:**

- Tailwind 4 utility classes + semantic tokens in `src/assets/css/style.css`.
  PrimeVue uses a custom `ComfyUIPreset` (Aura) with a `darkModeSelector`
  workaround (`src/main.ts:94-99`). Never use `dark:` variants or `!important`.

**Feature flags:**

- `src/composables/useFeatureFlags.ts`, `src/composables/useVueFeatureFlags.ts`,
  `src/utils/devFeatureFlagOverride.ts`, remote config
  (`src/platform/remoteConfig/`).

**Extensions:**

- `src/services/extensionService.ts` is the legacy extension entry point.
- In-product manager UI under `src/workbench/extensions/manager/` with its own
  stores, composables, services, types (including
  `types/generatedManagerTypes.ts`), and components.
- Entity callback surface (`onConnectionsChange`, `onAdded`, `onRemoved`,
  `onConnectInput/Output`, `onConfigure`, `onWidgetChanged`) and
  `node.widgets` / `node.serialize` / `graph._version` are the extension
  public contract per ADR 0008.

**Telemetry:**

- `src/platform/telemetry/` (PostHog, mixpanel, Sentry). Page-view tracking
  wired in `src/router.ts` via `router.afterEach`. Cloud-only initialization
  (`initTelemetry` dynamic import in `src/main.ts`).

---

_Architecture analysis: 2026-04-20_
