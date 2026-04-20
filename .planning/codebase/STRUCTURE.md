# Codebase Structure

**Analysis Date:** 2026-04-20

## Directory Layout

```
ComfyUI_frontend/
├── apps/
│   ├── desktop-ui/             # Storybook-style preview app for desktop shell
│   └── website/                # Marketing/website app
├── packages/
│   ├── design-system/          # @comfyorg/design-system (workspace)
│   ├── ingest-types/           # @comfyorg/ingest-types (generated types)
│   ├── registry-types/         # @comfyorg/registry-types
│   ├── shared-frontend-utils/  # @comfyorg/shared-frontend-utils
│   └── tailwind-utils/         # @comfyorg/tailwind-utils (cn() lives here)
├── browser_tests/              # Playwright E2E tests
│   ├── assets/ fixtures/ helpers/ utils/ tests/ dialogs/ types/
│   └── globalSetup.ts, globalTeardown.ts, playwright tsconfig
├── public/                     # Static assets served as-is
│   ├── assets/ cursor/ fonts/ materialdesignicons.min.css
├── src/                        # Frontend source (see sections below)
├── scripts/                    # Repo-level Node/TS tooling scripts
├── tools/                      # Ancillary tools (devtools, etc.)
├── docs/
│   ├── adr/                    # Architecture Decision Records
│   ├── architecture/           # ECS target architecture docs
│   ├── guidance/               # File-type-specific conventions
│   └── testing/                # Vitest / Playwright testing patterns
├── build/                      # Build scripts/assets
├── comfyui_frontend_package/   # Published package bundle
├── dist/                       # Build output (generated)
├── temp/                       # Agent scratch space (plans/scripts/summaries)
├── index.html                  # Vite entry — mounts #vue-app
├── vite.config.mts             # Web build
├── vite.electron.config.mts    # Electron build
├── vite.types.config.mts       # Type-emitting build
├── playwright.config.ts        # E2E config
├── playwright.i18n.config.ts   # i18n collection config
├── vitest.setup.ts             # happy-dom Vitest setup
├── eslint.config.ts            # Flat ESLint config
├── .oxfmtrc.json / .oxlintrc.json  # oxc formatter/linter config
├── nx.json / pnpm-workspace.yaml   # Nx + pnpm workspace config
├── tsconfig.json / tsconfig.types.json
├── knip.config.ts              # Dead-code checks
├── components.d.ts             # Auto-generated Vue component types
└── package.json
```

## `src/` Layout

```
src/
├── main.ts                 # App entry
├── App.vue                 # Root component
├── router.ts               # Vue Router
├── i18n.ts                 # vue-i18n setup
├── config.ts / config/     # Firebase + runtime config
├── assets/                 # css/, icons/, palettes/, splash.css
├── base/                   # Layer 0 — low-level primitives
│   ├── common/ credits/ pointerUtils.ts
├── platform/               # Layer 1 — cross-cutting product capabilities
│   ├── assets/ auth/ cloud/ distribution/
│   ├── keybindings/ missingMedia/ missingModel/
│   ├── navigation/ nodeReplacement/ remote/ remoteConfig/
│   ├── secrets/ settings/ support/ surveys/ tasks/ telemetry/
│   ├── updates/ workflow/ workspace/
├── workbench/              # Layer 2 — authoring surface + extension runtime
│   ├── extensions/manager/ (components, composables, services, stores, types, utils)
│   ├── utils/  eventHelpers.ts
├── renderer/               # Layer 3 — canvas + node rendering
│   ├── core/ (canvas, layout, spatial, thumbnail)
│   ├── extensions/ (vueNodes, minimap, linearMode)
│   ├── glsl/ utils/
├── lib/
│   └── litegraph/          # Vendored graph engine (ADR 0001)
│       ├── src/ (LGraph.ts, LGraphNode.ts, LGraphCanvas.ts,
│       │        subgraph/, widgets/, node/, canvas/, infrastructure/, types/, utils/)
│       ├── test/   public/   imgs/
├── core/                   # Narrow bridge utilities
│   ├── graph/ (subgraph/, widgets/)
│   └── schemas/
├── extensions/core/        # Built-in core extensions loaded at runtime
├── scripts/                # ComfyApp runtime bridge (app.ts, api.ts, …)
├── services/               # Domain services (non-Pinia)
├── stores/                 # Pinia stores (74 files)
│   ├── workspace/          # Workspace-scoped stores
│   └── __tests__/
├── composables/            # Vue composables
├── components/             # Vue SFCs organized by feature
├── views/                  # Route-level pages + layouts
│   └── layouts/, templates/
├── types/                  # Shared TS types and .d.ts augmentation
├── schemas/                # Zod schemas (apiSchema, nodeDefSchema, …)
├── constants/              # Color palettes, menu commands, essentials
├── utils/                  # Pure utility modules (+ __tests__/)
├── locales/                # vue-i18n JSON (en/, zh/, ja/, ko/, …)
└── storybook/              # Storybook configuration helpers
```

## Directory Purposes

**`src/base/`**

- Purpose: Lowest layer — pure primitives shared by everything above.
- Contains: Pointer/input helpers, shared common utilities, credits data.
- Key files: `src/base/pointerUtils.ts`.

**`src/platform/`**

- Purpose: Product-level capabilities independent of any particular UI surface.
- Key subdirs:
  - `src/platform/assets/` — `services/assetService.ts`, `components/*`,
    `composables/`, `schemas/`, `importSources/`, `mappings/`, `types/`,
    `utils/`, `fixtures/`.
  - `src/platform/workflow/` — `core/services/workflowService.ts`,
    `management/stores/workflowStore.ts`, `management/stores/comfyWorkflow.ts`,
    `validation/schemas/workflowSchema.ts`, `persistence/`, `sharing/`,
    `templates/`, `cloud/`, `utils/`.
  - `src/platform/settings/` — `settingStore.ts`.
  - `src/platform/distribution/types.ts` — `isCloud`, `isDesktop` booleans.
  - `src/platform/cloud/onboarding/` — dynamically imported cloud routes.
  - `src/platform/workspace/` — workspace API, stores, components, composables,
    `workspaceConstants.ts`, `workspaceTypes.ts`.
  - `src/platform/telemetry/` — `initTelemetry.ts`, tracking helpers.
  - `src/platform/updates/common/toastStore.ts`.
  - `src/platform/navigation/preservedQueryTracker.ts`,
    `preservedQueryNamespaces.ts`.
- Committed: Yes.

**`src/workbench/`**

- Purpose: Authoring surface and the extension manager runtime.
- Key subdirs: `src/workbench/extensions/manager/{components,composables,services,stores,types,utils}`.
- Notable: `src/workbench/extensions/manager/types/generatedManagerTypes.ts`
  (source of truth for manager API mocks in Playwright).

**`src/renderer/`**

- Purpose: Render pipeline and Vue-based node overlay.
- Key files:
  - `src/renderer/core/canvas/canvasStore.ts`
  - `src/renderer/core/canvas/useCanvasInteractions.ts`
  - `src/renderer/core/canvas/pathRenderer.ts`
  - `src/renderer/core/layout/store/layoutStore.ts`
  - `src/renderer/core/spatial/QuadTree.ts`
  - `src/renderer/core/thumbnail/graphThumbnailRenderer.ts`
  - `src/renderer/extensions/vueNodes/` (components, widgets, slots, preview,
    execution, interactions, layout, composables, stores, utils)
  - `src/renderer/extensions/minimap/MiniMap.vue`
  - `src/renderer/extensions/linearMode/`

**`src/lib/litegraph/`**

- Purpose: Vendored graph engine (ADR 0001). Self-contained; imports nothing
  from `src/` outside this directory.
- Key files:
  - `src/lib/litegraph/src/LGraph.ts` (3194 lines)
  - `src/lib/litegraph/src/LGraphNode.ts` (4285 lines)
  - `src/lib/litegraph/src/LGraphCanvas.ts` (9093 lines)
  - `src/lib/litegraph/src/litegraph.ts` — public barrel
  - `src/lib/litegraph/src/subgraph/Subgraph.ts`,
    `SubgraphNode.ts`, `SubgraphInput.ts`, `SubgraphOutput.ts`,
    `PromotedWidgetViewManager.ts`, `ExecutableNodeDTO.ts`
  - `src/lib/litegraph/src/widgets/*Widget.ts` + `widgetMap.ts`
  - `src/lib/litegraph/src/node/{SlotBase,NodeInputSlot,NodeOutputSlot,slotUtils}.ts`
  - `src/lib/litegraph/src/canvas/LinkConnector.ts` + render-link classes
  - `src/lib/litegraph/src/infrastructure/*` (errors, event maps, Rectangle)
- Tests: Co-located `*.test.ts` and `src/lib/litegraph/test/` fixtures.

**`src/scripts/`**

- Purpose: Legacy runtime bridge between Vue app and litegraph.
- Key files:
  - `src/scripts/app.ts` — `ComfyApp` singleton (canvas wiring, extension
    registration, default graph load, change tracker).
  - `src/scripts/api.ts` — HTTP + WebSocket client for ComfyUI backend.
  - `src/scripts/defaultGraph.ts` — built-in starter workflow JSON.
  - `src/scripts/changeTracker.ts` — undo/redo.
  - `src/scripts/domWidget.ts` — DOM/Vue widget integration with litegraph.
  - `src/scripts/pnginfo.ts`, `src/scripts/widgets.ts`, `src/scripts/ui.ts`.

**`src/components/`**

- Purpose: Reusable Vue 3 SFCs organized by feature area.
- Notable subdirs: `actionbar/`, `appMode/`, `bottomPanel/`, `boundingbox/`,
  `breadcrumb/`, `builder/`, `button/`, `card/`, `chip/`, `common/`,
  `curve/`, `custom/`, `dialog/`, `error/`, `graph/`, `gradientslider/`,
  `helpcenter/`, `honeyToast/`, `icons/`, `imagecrop/`, `input/`,
  `load3d/`, `loader/`, `maskeditor/`, `node/`, `painter/`,
  `primevueOverride/`, `queue/`, `rightSidePanel/`, `searchbox/`, `sidebar/`,
  `tab/`, `templates/`, `toast/`, `topbar/`, `ui/`, `widget/`.
- Graph-critical: `src/components/graph/GraphCanvas.vue`,
  `GraphCanvasMenu.vue`, `SelectionToolbox.vue`, `NodeContextMenu.vue`,
  `NodeTooltip.vue`, `LinkOverlayCanvas.vue`, `DomWidgets.vue`,
  `CanvasModeSelector.vue`.
- Sidebar tabs: `src/components/sidebar/tabs/` —
  `AssetsSidebarTab.vue`, `AssetsSidebarGridView.vue`,
  `AssetsSidebarListView.vue`, `NodeLibrarySidebarTab.vue`,
  `NodeLibrarySidebarTabV2.vue`, `WorkflowsSidebarTab.vue`,
  `ModelLibrarySidebarTab.vue`, `JobHistorySidebarTab.vue`,
  `AppsSidebarTab.vue`, `SidebarTabTemplate.vue`, `SidebarTopArea.vue`.
- Common primitives: `src/components/common/Badge.vue`, `DraggableList.vue`,
  `EditableText.vue`, `FormItem.vue`, `ImageLightbox.vue`, `LazyImage.vue`,
  `NotificationPopup.vue`, `DropdownMenu.vue`.

**`src/composables/`**

- Purpose: Reusable reactive logic (`useX()`). Subfolders per domain:
  `auth/`, `billing/`, `bottomPanelTabs/`, `canvas/`, `element/`,
  `functional/`, `graph/`, `maskeditor/`, `node/`, `painter/`, `queue/`,
  `sidebarTabs/`, `tree/`.
- Notable files:
  - `src/composables/useCoreCommands.ts` — canonical command registration.
  - `src/composables/graph/useGraphNodeManager.ts`,
    `useSelectionOperations.ts`, `useSubgraphOperations.ts`,
    `useNodeMenuOptions.ts`, `useSelectionMenuOptions.ts`.
  - `src/composables/canvas/useSelectedLiteGraphItems.ts`,
    `useSelectionToolboxPosition.ts`, `useFocusNode.ts`.
  - `src/composables/useErrorHandling.ts`,
    `src/composables/useFeatureFlags.ts`,
    `src/composables/useVueFeatureFlags.ts`,
    `src/composables/useGlobalLitegraph.ts`.

**`src/stores/`**

- Purpose: Pinia stores (74 files at root + `workspace/` subfolder).
- Core: `workspaceStore.ts`, `bootstrapStore.ts`, `commandStore.ts`,
  `executionStore.ts`, `executionErrorStore.ts`, `queueStore.ts`,
  `nodeDefStore.ts`, `nodeOutputStore.ts`, `widgetStore.ts`,
  `widgetValueStore.ts`, `domWidgetStore.ts`, `subgraphStore.ts`,
  `subgraphNavigationStore.ts`, `extensionStore.ts`, `assetsStore.ts`,
  `assetDownloadStore.ts`, `assetExportStore.ts`, `jobPreviewStore.ts`,
  `modelStore.ts`, `userFileStore.ts`, `userStore.ts`, `systemStatsStore.ts`,
  `serverConfigStore.ts`, `authStore.ts`, `apiKeyAuthStore.ts`,
  `comfyRegistryStore.ts`, `promotionStore.ts`, `templateRankingStore.ts`,
  `aboutPanelStore.ts`, `dialogStore.ts`, `helpCenterStore.ts`,
  `menuItemStore.ts`, `actionBarButtonStore.ts`, `appModeStore.ts`,
  `modelToNodeStore.ts`, `maskEditorStore.ts`, `maskEditorDataStore.ts`,
  `topbarBadgeStore.ts`, `nodeBookmarkStore.ts`.
- Workspace: `src/stores/workspace/bottomPanelStore.ts`,
  `sidebarTabStore.ts`, `rightSidePanelStore.ts`, `searchBoxStore.ts`,
  `favoritedWidgetsStore.ts`, `colorPaletteStore.ts`, `nodeHelpStore.ts`,
  `assetsSidebarBadgeStore.ts`.
- Reference: `src/stores/README.md`.

**`src/services/`**

- Purpose: Non-Pinia domain services (singletons, caches, SDK wrappers).
- Files: `audioService.ts`, `autoQueueService.ts`, `colorPaletteService.ts`,
  `comfyRegistryService.ts`, `customerEventsService.ts`, `dialogService.ts`,
  `extensionService.ts`, `jobOutputCache.ts`, `litegraphService.ts`,
  `load3dService.ts`, `mediaCacheService.ts`, `nodeHelpService.ts`,
  `nodeOrganizationService.ts`, `nodeSearchService.ts`,
  `subgraphPseudoWidgetCache.ts`, `subgraphService.ts`,
  `useNewUserService.ts`.
- Search stack: `src/services/gateway/registrySearchGateway.ts`,
  `src/services/providers/algoliaSearchProvider.ts`,
  `src/services/providers/registrySearchProvider.ts`.
- Reference: `src/services/README.md`.

**`src/views/`**

- Purpose: Route-level pages.
- Files: `src/views/GraphView.vue`, `src/views/LinearView.vue`,
  `src/views/UserSelectView.vue`, `src/views/layouts/LayoutDefault.vue`,
  `src/views/templates/`.

**`src/schemas/`**

- Purpose: Zod schemas.
- Files: `src/schemas/apiSchema.ts`, `src/schemas/nodeDefSchema.ts`,
  `src/schemas/colorPaletteSchema.ts`, `src/schemas/signInSchema.ts`,
  `src/schemas/nodeDef/`.

**`src/utils/`**

- Purpose: Pure utility modules; co-located `*.test.ts` and `__tests__/`.
- Notable: `src/utils/colorUtil.ts`, `src/utils/envUtil.ts`
  (`electronAPI()`), `src/utils/executableGroupNodeDto.ts`,
  `src/utils/executionUtil.ts`, `src/utils/fuseUtil.ts`,
  `src/utils/graphTraversalUtil.ts`, `src/utils/imageUtil.ts`,
  `src/utils/linkFixer.ts`, `src/utils/litegraphUtil.ts`,
  `src/utils/markdownRendererUtil.ts`, `src/utils/mediaUploadUtil.ts`,
  `src/utils/preloadErrorUtil.ts`, `src/utils/errorReportUtil.ts`,
  `src/utils/hostWhitelist.ts`, `src/utils/dateTimeUtil.ts`,
  `src/utils/mathUtil.ts`. Tailwind `cn()` lives in
  `packages/tailwind-utils/` (imported as `@/utils/tailwindUtil`).

**`src/constants/`**

- Purpose: Shared constants.
- Files: `coreColorPalettes.ts`, `coreMenuCommands.ts`,
  `essentialsNodes.ts`, `essentialsDisplayNames.ts`, `groupNodeConstants.ts`,
  `searchConstants.ts`, `serverConfig.ts`, `slotColors.ts`,
  `splitterConstants.ts`, `toolkitNodes.ts`, `uvMirrors.ts`.

**`src/locales/`**

- Purpose: vue-i18n translation JSON per locale.
- Subdirs: `en/`, `zh/`, `zh-TW/`, `ja/`, `ko/`, `ru/`, `fr/`, `es/`,
  `pt-BR/`, `ar/`, `fa/`, `tr/`. Source of truth: `src/locales/en/main.json`.

**`browser_tests/`**

- Purpose: Playwright E2E.
- Structure:
  - `browser_tests/tests/**/*.spec.ts` (e.g. `graph.spec.ts`,
    `execution.spec.ts`, `copyPaste.spec.ts`, `dialog.spec.ts`,
    `featureFlags.spec.ts`, cloud-only tests, etc.).
  - `browser_tests/dialogs/` sub-suite.
  - `browser_tests/fixtures/` — Playwright test fixtures.
  - `browser_tests/helpers/`, `browser_tests/utils/`, `browser_tests/types/`,
    `browser_tests/assets/`.
  - `browser_tests/globalSetup.ts`, `browser_tests/globalTeardown.ts`.
  - Flake rules: `browser_tests/FLAKE_PREVENTION_RULES.md`.
  - Test-local TS: `browser_tests/tsconfig.json`.

**`public/`**

- Purpose: Static assets served verbatim (cursors, fonts, splash CSS, MDI
  icons, extension assets). Committed: Yes. Generated: No.

**`packages/`**

- Purpose: pnpm workspace packages consumed via `workspace:*`.
  - `packages/design-system/` → `@comfyorg/design-system`
  - `packages/shared-frontend-utils/` → `@comfyorg/shared-frontend-utils`
  - `packages/tailwind-utils/` → `@comfyorg/tailwind-utils` (`cn()`)
  - `packages/ingest-types/` → `@comfyorg/ingest-types` (dev)
  - `packages/registry-types/` → `@comfyorg/registry-types`
- Each has its own `src/`, `package.json`, `tsconfig.json`, `node_modules/`.

**`apps/`**

- Purpose: Additional Nx apps.
- `apps/desktop-ui/` — desktop-ui preview app with its own `vite.config.mts`,
  `storybook` config, and `src/`.
- `apps/website/`.

**`docs/`**

- Purpose: Project docs.
- `docs/adr/` — numbered ADRs (0001–0008).
- `docs/architecture/` — ECS target design, lifecycle scenarios, migration plan,
  world/command API, subgraph boundaries.
- `docs/guidance/` — auto-loaded file-type conventions.
- `docs/testing/` — Vitest/Playwright patterns.

**`temp/`**

- Purpose: Agent scratch space (per `AGENTS.md`).
- Subdirs: `temp/plans/`, `temp/scripts/`, `temp/summaries/`,
  `temp/in_progress/`.
- Committed: No (user-local).

**`dist/`**

- Purpose: Vite build output.
- Generated: Yes. Committed: No.

**`comfyui_frontend_package/`**

- Purpose: Assembled package used for publishing `comfyui-frontend-types`.
- Generated: Partially (populated by `scripts/prepare-types.js`).

## Key File Locations

**Entry Points:**

- `index.html` — Vite HTML entry.
- `src/main.ts` — Vue app bootstrap.
- `src/App.vue` — Root SFC.
- `src/router.ts` — Routes + cloud auth guard.
- `src/i18n.ts` — vue-i18n setup.
- `src/scripts/app.ts` — ComfyApp (canvas + extensions).
- `src/scripts/api.ts` — Backend HTTP/WebSocket client.
- `vite.config.mts`, `vite.electron.config.mts`, `vite.types.config.mts`.

**Configuration:**

- `package.json` — scripts + dependency catalog.
- `nx.json` / `pnpm-workspace.yaml` — monorepo config.
- `tsconfig.json` / `tsconfig.types.json`.
- `eslint.config.ts`, `.oxlintrc.json`, `.oxfmtrc.json`.
- `playwright.config.ts`, `playwright.i18n.config.ts`, `vitest.setup.ts`.
- `knip.config.ts`, `components.json`, `manifest.json`.
- `src/config.ts` / `src/config/firebase.ts`.
- `src/platform/remoteConfig/remoteConfig.ts`.

**Core Logic:**

- `src/lib/litegraph/src/LGraph.ts`, `LGraphNode.ts`, `LGraphCanvas.ts`.
- `src/scripts/app.ts` — legacy bridge.
- `src/renderer/core/layout/store/layoutStore.ts` — canonical node geometry.
- `src/platform/workflow/management/stores/workflowStore.ts` — workflow
  lifecycle + `ComfyWorkflow`.
- `src/stores/queueStore.ts`, `src/stores/executionStore.ts`.
- `src/services/extensionService.ts` — extension entry API.

**Testing:**

- Unit/component: co-located `*.test.ts` beside the file under test.
- Litegraph-specific: co-located in `src/lib/litegraph/src/*.test.ts` +
  `src/lib/litegraph/test/` (fixtures).
- E2E: `browser_tests/tests/**/*.spec.ts`.
- Storybook: `*.stories.ts` co-located; config under
  `src/storybook/` and Nx storybook target.

## Naming Conventions

**Vue components (`.vue`):**

- PascalCase filenames. Example: `src/components/MenuHamburger.vue`,
  `src/components/graph/GraphCanvas.vue`.
- Multi-word PascalCase is required by ESLint Vue rules.
- Stories: `<Component>.stories.ts` co-located.
- Component tests: `<Component>.test.ts` co-located.

**Composables (`.ts`):**

- `useXxx.ts` camelCase with `use` prefix. Example:
  `src/composables/useCoreCommands.ts`,
  `src/composables/canvas/useSelectedLiteGraphItems.ts`.
- Exported function matches filename: `export const useCoreCommands = …`.

**Pinia stores (`.ts`):**

- `*Store.ts` camelCase. Example: `src/stores/queueStore.ts`,
  `src/stores/workspace/bottomPanelStore.ts`,
  `src/platform/settings/settingStore.ts`.
- Exported factory: `useXxxStore` using `defineStore('xxx', () => { … })`
  (Setup API only).

**Services (`.ts`):**

- `*Service.ts` camelCase. Example: `src/services/extensionService.ts`,
  `src/platform/assets/services/assetService.ts`.

**Schemas (`.ts`):**

- `*Schema.ts` (e.g. `src/schemas/nodeDefSchema.ts`,
  `src/platform/workflow/validation/schemas/workflowSchema.ts`).

**Stores with generated types:**

- `types/generatedXxx.ts` (e.g.
  `src/workbench/extensions/manager/types/generatedManagerTypes.ts`).

**Test files:**

- `*.test.ts` for Vitest; `*.spec.ts` under `browser_tests/` for Playwright.
- Snapshot dirs: `<test>.spec.ts-snapshots/` next to the spec.

**Utility modules:**

- `camelCase.ts` ending in `Util.ts` is common but not required
  (`colorUtil.ts`, `envUtil.ts`, `mathUtil.ts`).

**Constants:**

- Grouped by domain under `src/constants/` in camelCase
  (`coreColorPalettes.ts`, `serverConfig.ts`).

**Directories:**

- Lowercase, typically single word (`components`, `stores`, `composables`).
- Compound directories use lowercase or kebab-like camel (`bottomPanelTabs`,
  `sidebarTabs`, `maskeditor`, `rightSidePanel`).

**Litegraph classes:**

- PascalCase. `LGraphXxx.ts` / `SubgraphXxx.ts` / `*Widget.ts` with
  matching exported class name.

## Where to Add New Code

**New route/page view:**

- SFC in `src/views/` (or `src/views/layouts/` for a shell layout).
- Wire into `src/router.ts`; wrap in the cloud auth guard if protected.

**New feature component:**

- Reusable primitive → `src/components/common/` or existing feature folder
  under `src/components/<feature>/`.
- Graph-surface UI → `src/components/graph/`.
- Sidebar tab → add SFC under `src/components/sidebar/tabs/` and register
  via `src/stores/workspace/sidebarTabStore.ts`.
- Feature scoped to a platform capability (e.g. assets/workflow) → place
  alongside that platform domain (e.g.
  `src/platform/assets/components/MyThing.vue`) rather than in `src/components/`.

**New composable:**

- Generic → `src/composables/useXxx.ts`.
- Domain-specific → `src/composables/<domain>/useXxx.ts`
  (e.g. `src/composables/graph/useXxx.ts`,
  `src/composables/canvas/useXxx.ts`, `src/composables/queue/useXxx.ts`).
- Renderer-local → `src/renderer/extensions/vueNodes/composables/`.

**New Pinia store:**

- Cross-cutting → `src/stores/xxxStore.ts`.
- Workspace UI state → `src/stores/workspace/xxxStore.ts`.
- Bound to a platform capability → colocate, e.g.
  `src/platform/<area>/stores/xxxStore.ts`.
- Use Setup API (`defineStore('xxx', () => { … })`), keep internal refs
  private, follow `src/AGENTS.md` guidance.

**New service:**

- Non-Pinia singletons / SDK wrappers → `src/services/xxxService.ts`.
- Search providers go under `src/services/providers/`, gateways under
  `src/services/gateway/`.
- Platform-owned services → `src/platform/<area>/services/xxxService.ts`
  (e.g. `assetService.ts`).

**New command:**

- Register in `src/composables/useCoreCommands.ts` (or a domain-specific
  `useXxxCommands.ts`). Add to `src/constants/coreMenuCommands.ts` if it
  should appear in menus.

**New API call / schema:**

- HTTP/WebSocket → extend `src/scripts/api.ts`.
- Validation → add/extend a Zod schema in `src/schemas/` or
  `src/platform/<area>/schemas/`.
- Mock types for Playwright `route.fulfill()` → source from
  `packages/ingest-types`, `packages/registry-types`,
  `src/workbench/extensions/manager/types/generatedManagerTypes.ts`, or
  `src/schemas/` per `docs/guidance/playwright.md`.

**New graph-entity feature:**

- Do NOT add methods/properties to `LGraphNode`, `LGraphCanvas`, `LGraph`,
  or `Subgraph` (ADR 0008). Extract into systems / stores / composables.
- New mutations must be commands (ADR 0003) — serializable, idempotent,
  replayable.
- Geometry writes go through
  `src/renderer/core/layout/store/layoutStore.ts`, not direct
  `node.pos = …` mutation.

**New widget (canvas-side):**

- `src/lib/litegraph/src/widgets/MyWidget.ts` + register in
  `src/lib/litegraph/src/widgets/widgetMap.ts`. Widgets are plain data;
  behavior lives in systems.

**New widget (Vue/DOM-side):**

- `src/renderer/extensions/vueNodes/widgets/` + wire through
  `src/stores/widgetStore.ts` / `src/stores/domWidgetStore.ts`.

**New extension surface:**

- Register via `src/services/extensionService.ts`; see
  `src/workbench/extensions/manager/` for in-product manager extensions.

**New utility:**

- Pure helper → `src/utils/xxxUtil.ts` with co-located `*.test.ts`.
- Cross-package → promote to `packages/shared-frontend-utils/` or
  `packages/tailwind-utils/`.

**New constants:**

- `src/constants/xxx.ts`. Keep mutable data out of this folder.

**New translations:**

- Add keys to `src/locales/en/main.json` only. Other locales are filled by
  tooling. Use the vue-i18n plurals system, not template branches.

**New test:**

- Unit/component → `<file>.test.ts` colocated, use Vitest + `@testing-library/vue`.
- E2E → `browser_tests/tests/<feature>.spec.ts`, Playwright. Tag with
  `@mobile` / `@2x` where relevant.

## Special Directories

**`dist/`**

- Purpose: Vite build output for the web/cloud/desktop target.
- Generated: Yes. Committed: No (gitignored).

**`comfyui_frontend_package/`**

- Purpose: Staged artifacts for the public `comfyui-frontend-types` package.
- Generated: Partially (`pnpm build:types`).

**`temp/`**

- Purpose: Agent-only scratch (`temp/plans/`, `temp/scripts/`,
  `temp/summaries/`, `temp/in_progress/`).
- Committed: No.

**`willie-comfy/`**

- Purpose: User-local working directory (not canonical).
- Committed: Varies by checkout.

**`browser_tests/`**

- Purpose: Playwright E2E only. Unit tests never live here.

**`public/`**

- Purpose: Vite static passthrough (no import-time resolution).

**`src/lib/litegraph/`**

- Purpose: Vendored subtree (ADR 0001). Treat as an internal library; no
  imports from `src/` parent scope.

**`src/extensions/core/`**

- Purpose: Built-in core extensions loaded by `src/services/extensionService.ts`
  at startup.

**`src/storybook/`**

- Purpose: Storybook setup helpers consumed by the Nx storybook target.

---

_Structure analysis: 2026-04-20_
