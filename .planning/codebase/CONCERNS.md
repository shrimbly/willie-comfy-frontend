# Codebase Concerns

**Analysis Date:** 2026-04-20

This document catalogs technical debt, fragile areas, and risks in the ComfyUI_frontend codebase. Concerns are organized by category. Many items are grounded in the project's own ADR set (`docs/adr/`) and architecture docs (`docs/architecture/`) — notably ADR 0003 (CRDT layout), ADR 0008 (ECS), ADR 0006 (PrimitiveNode), and `docs/architecture/entity-problems.md`.

## Tech Debt

### God Objects in `src/lib/litegraph/src/`

The three classes below carry far too many responsibilities. They are explicitly protected by ADR 0008: **no new methods or instance properties may be added**. All new behavior must go in systems, stores, or composables.

**`src/lib/litegraph/src/LGraphCanvas.ts` (9,093 lines):**

- Issue: Mixes rendering, input handling, selection, link dragging, context menus, clipboard, undo/redo hooks, and layout triggers
- ~848 method/property definitions per audit in `docs/architecture/appendix-critical-analysis.md`
- 32 TODO/FIXME/HACK comments (highest in the codebase)
- Contains 17 `@ts-expect-error` / `@ts-ignore` uses and 18 `as any` assertions
- Fix approach: Extract responsibilities to systems per ADR 0008. Do not add more methods.

**`src/lib/litegraph/src/LGraphNode.ts` (4,285 lines):**

- Issue: Domain model, connectivity, serialization, rendering, layout, execution, property management all in one class
- 26 references to lifecycle callbacks (`onConnectionsChange`, `onRemoved`, `onAdded`, etc.)
- Mutates `graph._version++` directly from 8+ locations (lines 833, 2989, 3138, 3176, 3304, 3539, 3550, 3567)
- Fix approach: New features extract to components + systems; bridge layer reads from existing class

**`src/lib/litegraph/src/LGraph.ts` (3,194 lines):**

- Issue: Container management, serialization, subgraph lifecycle, execution ordering, link dedup
- Defines `Subgraph` inside the file (at approx line 2761) because of an unresolvable circular dependency
- 11 call sites referencing node lifecycle callbacks
- Imports Pinia stores at module level (`useLayoutMutations`, `usePromotionStore`, `useWidgetValueStore`), coupling domain objects to the Vue runtime

### LGraph ↔ Subgraph Circular Dependency

- Files: `src/lib/litegraph/src/LGraph.ts`, `src/lib/litegraph/src/subgraph/Subgraph.ts`, `src/lib/litegraph/src/litegraph.ts`
- Issue: `Subgraph extends LGraph` but `LGraph` creates `Subgraph` instances. Resolved only via barrel export with order-dependent imports
- `src/lib/litegraph/src/subgraph/Subgraph.ts` is a 3-line compatibility shim: `export { Subgraph, type GraphOrSubgraph } from '@/lib/litegraph/src/LGraph'`
- Test files MUST import from the barrel `@/lib/litegraph/src/litegraph` or they fail to resolve (see `src/lib/litegraph/AGENTS.md`)
- Impact: Forces contributors to understand a non-obvious import ordering rule. Blocks the decomposition planned in ADR 0008.
- Fix approach: ADR 0008 ECS eliminates inheritance — a subgraph becomes a node carrying a `SubgraphStructure` component

### Legacy `src/scripts/` Directory

Legacy imperative JS-style code that predates the Vue rewrite, now mostly TypeScript but still procedural and tightly coupled:

- `src/scripts/app.ts` (2,227 lines) — god object for app-level orchestration, 3 TODO comments, 13 `@ts-expect-error` uses
- `src/scripts/api.ts` (1,422 lines) — API client with 2 TODO comments and 1 `@ts-expect-error`
- `src/scripts/changeTracker.ts` (456 lines) — diff-based undo/redo system explicitly called out in ADR 0003 as scaling O(n) with graph complexity. To be replaced by reactive push/pull signals.
- `src/scripts/ui.ts` (719 lines) — legacy UI code, 24 `@ts-expect-error` uses, 3 `innerHTML` references
- `src/scripts/widgets.ts` (320 lines) — 10 `@ts-expect-error` uses
- `src/scripts/domWidget.ts` (415 lines) — DOM overlay positioning that competes with LiteGraph canvas (documented in ADR 0003)
- Fix approach: Incremental migration into `src/renderer/`, `src/platform/`, `src/stores/`, or `src/composables/`. Do not add new code here.

### `src/extensions/core/groupNode.ts` (2,024 lines)

- Issue: Single-file 2000+ line module with 7 TODO/FIXME including `"FIXME: Looks like copy/paste broken logic - checks for 'on', executes 'do'"` (line 582) and `"TODO: recursion check/helper method"` (line 2264)
- 20 `@ts-expect-error` / `as any` suppressions
- Core part of the extension API surface; changes here ripple to the 40+ custom node repositories
- Fix approach: High-risk refactor — any change requires extensive regression testing against known group-node workflows

### Type-Safety Suppressions

- 417 total `@ts-expect-error` / `@ts-ignore` / `as any` occurrences across 75 files (counted via Grep)
- 126 `@deprecated` markers across 32 files
- Concentrations:
  - `src/lib/litegraph/src/LGraphCanvas.ts` — 27 suppressions + 36 `@deprecated`
  - `src/lib/litegraph/src/LGraphNode.ts` — 20 suppressions + 5 `@deprecated`
  - `src/lib/litegraph/src/LGraph.ts` — 13 suppressions + 13 `@deprecated`
  - `src/scripts/app.ts` — 13 `@deprecated` + 1 `as any`
  - `src/utils/nodeDefUtil.test.ts` — 18 `@ts-expect-error`
- Fix approach: Address one concentration at a time. ADR-compliant: AGENTS.md says "Avoid `@ts-expect-error` - fix the underlying issue."

### 132 Outstanding TODO/FIXME/HACK Markers

Distributed across 72 files (top contributors):

- `src/lib/litegraph/src/LGraphCanvas.ts` — 32
- `src/lib/litegraph/src/LiteGraphGlobal.ts` — 7
- `src/lib/litegraph/src/LGraph.ts` — 7
- `src/lib/litegraph/src/LGraphNode.ts` — 5
- `src/lib/litegraph/src/subgraph/subgraphUtils.ts` — 4
- `src/core/graph/widgets/dynamicWidgets.ts` — 3
- `src/scripts/app.ts` — 3
- `src/lib/litegraph/src/types/widgets.ts` — 3

Notable inline comments:

- `LGraphCanvas.ts:148`: `// FIXME: Should not be optional`
- `LGraphCanvas.ts:5981,5993`: `// TODO: still use LG get pos if vue nodes is off until stable` — hints at in-progress Vue-nodes migration
- `LGraph.ts:2837`: `// TODO: Move back to separate file once circular dependencies are resolved`
- `LGraphNode.ts:698`: `// FIXME: Re-typing`
- `LGraphNode.ts:2613`: `// TODO: Remove or reimpl. events. WILL CREATE THE onTrigger IN SLOT`
- `extensionService.ts:75`: `// TODO(huchenlei): We should deprecate the async return value of...`

### Remaining PrimeVue Usage

PrimeVue is still widely used despite ADR 0004 rejecting a fork and the project's guidance to prefer shadcn/vue / Reka UI. Do not add new PrimeVue usage.

- 386 `from 'primevue` import occurrences across 228 files
- PrimeVue workarounds live at `src/components/primevueOverride/`:
  - `SelectPlus.vue` — override for coordinate/scroll issues
  - `AutoCompletePlus.vue` — override for coordinate/scroll issues
- Known upstream issues from ADR 0004 are unresolved:
  - `getBoundingClientRect()` not CSS-transform-aware
  - Slider uses raw `pageX/pageY` without transform awareness
  - Overlay `scrollIntoView` interferes with LiteGraph's `DragAndScale` virtual scroll
- Fix approach: Replace case-by-case with shadcn/vue or Reka UI. Use `primevueOverride/*` as an example of targeted wrapping.

### Primitive Node Copy/Paste (ADR 0006, unresolved)

- Files: `src/extensions/core/widgetInputs.ts` (14 suppressions), related serialization paths
- Issue: PrimitiveNode clones lack `this.widgets`, so `LGraphNode.serialize()` drops `widgets_values` from the clipboard. Secondary widget values (`control_after_generate`) are lost on paste.
- References: Issue #1757, PR #8938, `docs/WIDGET_SERIALIZATION.md#primitiveno-and-copypaste`
- Status: ADR 0006 is **Proposed**. Option A (override `serialize()` on PrimitiveNode) is the pragmatic first step.
- Fix approach: Ship Option A; defer Option B/C until stabilized

## Known Bugs

### Render-Time State Mutations

- Files: `src/lib/litegraph/src/LGraphCanvas.ts` lines 5554–5664, `src/lib/litegraph/src/widgets/BaseWidget.ts:439`
- Issue: `drawNode()` mutates node state as a side effect of rendering (`_setConcreteSlots()` at line 5562, `arrange()` at line 5564), and `BaseWidget` increments `graph._version++` during render path
- Trigger: Every frame that draws a node; concurrent or partial renders produce inconsistent state
- Impact: Render order matters (later nodes see earlier nodes' side effects); performance profiling conflates render with layout
- Workaround: None — blocks any future off-main-thread or partial rendering

### Widget Lookups by Name (Silent Failure)

- Files: `src/lib/litegraph/src/LGraphNode.ts` lines 904, 4077, 4086
- Issue: Widgets have no independent IDs — identified by `(name + parent node)`. If a widget is renamed, lookups silently break with no runtime error
- Trigger: Extension code that mutates a widget's `name` property
- Fix approach: ADR 0008 assigns synthetic `WidgetEntityId` values

### Slot Identity Tied to Array Index

- Files: `src/lib/litegraph/src/LGraphNode.ts` line 1556, `src/lib/litegraph/src/LLink.ts`
- Issue: Slots are identified by their index within a node's `inputs[]` / `outputs[]`. If an extension reorders slots, all links referencing that node become stale
- Fix approach: ADR 0008 introduces branded `SlotEntityId`

### Ambiguous `NodeId = number | string`

- File: `src/lib/litegraph/src/LGraphNode.ts:100`
- Issue: Most nodes use numeric IDs but subgraph-related nodes use strings. Code uses runtime type guards (`typeof node.id === 'number'` at `LGraph.ts:978`, `LGraphCanvas.ts:9045`) — a source of subtle bugs
- Magic numbers: `SUBGRAPH_INPUT_ID = -10`, `SUBGRAPH_OUTPUT_ID = -20` (`src/lib/litegraph/src/constants.ts`) are negative sentinels baked into the general-purpose `LLink` class

## Security Considerations

### HTML Rendering Surface

- Files that use `innerHTML` / `dangerouslySetInnerHTML` / `eval` / `new Function`: 61 occurrences across 18 files
- Concentrations:
  - `src/renderer/extensions/vueNodes/widgets/components/WidgetMarkdown.test.ts` — 10 (test-only)
  - `src/scripts/ui.ts` — 3
  - `src/lib/litegraph/src/ContextMenu.ts` — 2
  - `src/lib/litegraph/src/LGraphCanvas.ts` — 17 (likely low-severity canvas usages; verify each)
  - `src/components/node/NodePreview.test.ts` — 16 (test-only)
- DOMPurify is used in 7 files (e.g., `src/utils/markdownRendererUtil.ts`, `src/platform/updates/components/WhatsNewPopup.vue`)
- Current mitigation: `src/AGENTS.md` mandates "Sanitize HTML with DOMPurify" — but enforcement is by convention, not a lint rule
- Recommendation: Add an ESLint rule restricting `innerHTML` assignment in `src/` outside an explicit allowlist. Audit the 17 `LGraphCanvas.ts` occurrences for user-controlled content.

### Extension Execution Model

- File: `src/services/extensionService.ts` (244 lines)
- Issue: Extensions are first-class citizens via `registerExtension` (20 files reference the API). They can mutate `LGraphNode`, inject widgets, override serialization, and listen to every lifecycle callback
- Risk: Malicious or buggy extensions can corrupt workflow data or exfiltrate credentials stored in memory
- Current mitigation: Extension code runs in the same origin/page as the frontend — no sandboxing
- Recommendation: Document this explicitly for users; consider extension signing or manifest-based permissions in a future Extension API v2 (referenced in ADR 0005 notes via issue #4668)

### Auth Flow

- Files:
  - `src/platform/auth/session/useSessionCookie.ts` — session cookie management
  - `src/platform/workspace/stores/workspaceAuthStore.ts` — team workspace auth
  - `src/platform/workspace/auth/WorkspaceAuthGate.vue` — auth gating for workspace features
  - `src/platform/workflow/sharing/composables/useComfyHubProfileGate.ts` — ComfyHub profile gating
  - `src/components/dialog/content/signin/*.vue` — sign-in forms
- Current mitigation: Auth handled by `@firebase/auth` (see platform dependencies); `src/AGENTS.md` requires "Validate trusted sources" and "Never log secrets"
- Risk: Several sign-in forms accept user input (PasswordFields, SignInForm, SignUpForm, ApiKeyForm). No obvious unsafe patterns found but a dedicated audit is warranted
- Recommendation: Add a CSP header configuration pass; verify PostHog / Mixpanel telemetry redacts PII

## Performance Bottlenecks

### Large-Workflow Rendering (100+ nodes)

- File: `src/scripts/changeTracker.ts` (456 lines)
- Issue: ADR 0003 explicitly calls this out — "diff-based systems scale O(n) with graph complexity (traverse entire structure to detect changes), while signal-based reactive systems scale O(1) with actual changes"
- `changeTracker.ts` serializes the entire workflow to JSON (via `JSON.parse(JSON.stringify(obj))` clone at line 21) on every checkpoint
- MAX_HISTORY = 50 workflows held in memory simultaneously
- Trigger: Any interaction on a large workflow
- Fix approach: Replace with CRDT-backed layout + event-driven undo (ADR 0003 Phase 2)

### Polling-Based Change Detection

- Issue: ADR 0003 — UI updates require full graph traversals to detect position changes; 100+ node workflows bottleneck
- Current mitigations:
  - `src/renderer/core/layout/store/layoutStore.ts` (1,552 lines) — Y.js CRDT-based layout store ("most architecturally advanced extraction" per `docs/architecture/appendix-critical-analysis.md`)
  - `src/renderer/extensions/vueNodes/layout/useNodeLayout.ts` — reactive node layout composable
- Tension: ADR 0003 (CRDT) and ADR 0008 (ECS) coexistence unresolved — would the ECS World contain Y.js docs? Appendix flags this as an open architectural question

### `graph._version++` Scattered Across 15+ Locations

- Files: `LGraph.ts` (lines 956, 989, 1042, 1109, 2643), `LGraphNode.ts` (8 locations), `LGraphCanvas.ts` (lines 3083, 7879), `BaseWidget.ts:439`, `SubgraphInputNode.ts:190`, `SubgraphOutput.ts:102`, `SubgraphInput.ts:137`
- Issue: No central mechanism. Easy to forget an increment (stale render) or add a redundant one (wasted work)
- Change tracker polls `graph._version` for diff detection — missed increments silently skip undo history
- Fix approach: Encapsulate in a single method; ADR 0008 makes version tracking a system responsibility

### `beforeChange()`/`afterChange()` Checkpoint Sprawl

- File: `src/lib/litegraph/src/LGraphCanvas.ts`
- Issue: Called from 12+ locations (lines 1574, 1592, 1604, 1620, 1752, 1770, 8754, 8760, 8771, 8777, 8803, 8811)
- Misplaced or missing pairs split one logical operation across multiple undo entries; unmatched extra calls delay checkpoints
- Fix approach: Command-pattern undo (ADR 0003) replaces this pattern entirely

### Virtualization Restrictions

- File: `eslint.config.ts` lines 67-71, 396, 417
- Enforced rule: `useVirtualListRestriction` — `useVirtualList` is banned globally: "useVirtualList requires uniform item heights. Use TanStack Virtual (via Reka UI virtualizer or @tanstack/vue-virtual) instead."
- Implication: All virtualized lists (sidebar panels, node library, asset grid at `src/components/sidebar/tabs/AssetsSidebarTab.vue` — 1,465 lines) must go through TanStack Virtual

### Module-Scope Store Access in Domain Objects

- `src/lib/litegraph/src/LLink.ts:24` — `const layoutMutations = useLayoutMutations()` at module scope
- `src/lib/litegraph/src/Reroute.ts` — same pattern
- `src/lib/litegraph/src/widgets/BaseWidget.ts:20-22` — imports `usePromotionStore`, `useWidgetValueStore` at module level
- Issue: Makes litegraph domain objects untestable without a Vue app context; couples rendering domain to Pinia
- Fix approach: Inject dependencies explicitly or migrate to ECS systems (ADR 0008)

## Fragile Areas

### Entity Architecture Mid-Migration to ECS (ADR 0008)

- Files: entire `src/lib/litegraph/src/` tree
- Why fragile: Migration is **Proposed** (not yet Accepted). Both OOP and ECS patterns must coexist. The project is committed to:
  - No new methods on `LGraphNode`, `LGraphCanvas`, `LGraph`, `Subgraph`
  - No new instance properties
  - All new mutations via commands (ADR 0003)
  - Components are plain data (no methods, no back-references)
- Safe modification:
  - New cross-cutting features (undo/redo, sync, serialization) must be built as systems reading ECS components, NOT as new class methods
  - Use the bridge layer (adapter functions) described in ADR 0008 migration strategy
  - Test coverage: `src/lib/litegraph/src/**/*.test.ts` — ~40 test files. Always use barrel import `@/lib/litegraph/src/litegraph`
- Test coverage gaps: Integration tests between Vue-nodes mode and legacy canvas mode (see `LiteGraph.vueNodesMode` — 46 references across 14 files, gated behavior during migration)

### Layered Architecture Enforcement

- File: `eslint.config.ts` lines 330-371
- Layer order (bottom to top): `base → platform → workbench → renderer`
- Enforced by `import-x/no-restricted-paths` ESLint rule
- Why fragile:
  - **Existing violations are suppressed with `eslint-disable` comments** in 9 files:
    - `src/workbench/eventHelpers.ts`
    - `src/platform/workflow/templates/composables/useTemplateUrlLoader.ts`
    - `src/platform/workflow/management/stores/workflowStore.ts`
    - `src/platform/workflow/core/services/workflowService.ts`
    - `src/platform/settings/composables/useLitegraphSettings.ts`
    - `src/platform/missingModel/missingModelStore.ts`
    - `src/platform/missingModel/missingModelScan.ts`
    - `src/platform/missingMedia/missingMediaStore.ts`
    - `src/base/common/downloadUtil.ts`
  - These are grandfathered violations — new code must not add more
- Safe modification: When editing files under `src/base/`, `src/platform/`, `src/workbench/`, keep imports only from layers below. If unavoidable, document the violation and plan a refactor.

### Extension Ecosystem Impact (Primary Risk)

**Custom node repositories consume these public APIs.** Any change affects 40+ downstream extensions:

| API Surface                                                                                                                                             | Files                                                                                                                | Risk                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `LGraphNode` lifecycle callbacks (`onConnectionsChange`, `onRemoved`, `onAdded`, `onConnectInput`, `onConnectOutput`, `onConfigure`, `onWidgetChanged`) | `src/lib/litegraph/src/LGraphNode.ts` (26 refs)                                                                      | Breaking change → extension crash                    |
| `node.widgets` array                                                                                                                                    | `src/core/graph/widgets/dynamicWidgets.ts`, `src/lib/litegraph/src/LGraphNode.ts`, `src/lib/litegraph/src/LGraph.ts` | Breaking change → widget reads return undefined      |
| `node.serialize()` / `node.configure()`                                                                                                                 | `src/lib/litegraph/src/LGraphNode.ts:943, 831`                                                                       | Breaking change → workflow load/save                 |
| `graph._version++` manual increments                                                                                                                    | 15+ sites across litegraph                                                                                           | Removing this breaks change detection for extensions |
| `registerExtension` API                                                                                                                                 | `src/services/extensionService.ts`, used by 20+ files                                                                | Contract with all user extensions                    |

Per `docs/architecture/appendix-critical-analysis.md` section III: "The ECS scenarios show these callbacks disappearing... Extensions rely on these callbacks. The documents do not discuss how this API would be preserved, adapted, or replaced. This is not a minor omission — it is the repression of the system's most anxiety-producing constraint."

**Mitigation required for any ECS migration:**

- Bridge layer must preserve the callback API even after internal migration
- Deprecation warnings before removal
- Migration guides for extension authors
- Semantic versioning respected for breaking changes

### Vue-Nodes Mode Migration

- Flag: `LiteGraph.vueNodesMode` — 46 references across 14 files
- Concentrations: `LGraphCanvas.ts` (18), `LGraphNode.ts` (inherit), `syncLayoutStoreFromGraph.ts`, `nodeOutputStore.ts` (9)
- Comments in code: `"TODO: still use LG get pos if vue nodes is off until stable"` (`LGraphCanvas.ts:5981, 5993`)
- Why fragile: Two rendering paths maintained concurrently. Bug fixes must be tested in both modes.
- Files: `src/renderer/extensions/vueNodes/` — Vue-based node rendering

### Subgraph Recursion and Widget Promotion

- Files:
  - `src/lib/litegraph/src/subgraph/PromotedWidgetViewManager.ts`
  - `src/lib/litegraph/src/subgraph/SubgraphNode.ts` (1,624 lines)
  - `src/core/graph/subgraph/subgraph-dynamic-input-limitations.md` (documented limitations)
- Issue: Widget promotion (exposing inner widgets at subgraph level) is architecturally complex. The appendix describes the `"Subgraph extends LGraph"` relationship as "the child that contains the parent's structure — the recursive self-reference that gives the system its power and its pathology simultaneously."
- Test coverage: Extensive — `Subgraph*.test.ts` files exist for every major subgraph concern
- Safe modification: Run full subgraph test suite. Prefer barrel imports. Avoid depth-first recursion without a visited set.

### Clipboard/Copy-Paste Lifecycle

- Files: `src/lib/litegraph/src/LGraphCanvas.clipboard.test.ts`, `src/utils/vintageClipboard.ts` (1 `@deprecated`, 5 `as any`)
- Issue: PrimitiveNode loses widget values on copy/paste (ADR 0006). Other node types with dynamic widgets face similar risks.
- Why fragile: Multiple code paths (workflow load, clipboard paste, duplicate) each have their own reconstruction logic
- Fix approach: Unify through a single serialization system (ADR 0008 SerializationSystem)

## Scaling Limits

### Change Tracker Memory

- File: `src/scripts/changeTracker.ts`
- Limit: `MAX_HISTORY = 50` workflow snapshots retained per workflow
- Scaling path: ADR 0003 command-pattern history (store commands, not full snapshots)

### NodeExecutionOutput Schema Passthrough

- File: `src/schemas/` (per ADR 0007)
- Issue: `zOutputs.passthrough()` allows unknown keys as `unknown`. Runtime validation required at every iteration site
- Accepted tradeoff per ADR 0007 — can only be eliminated by TypeScript supporting "exclusive index signatures" or a backend API restructure

## Dependencies at Risk

### `@comfyorg/litegraph` (archived)

- Per ADR 0001, the upstream fork has been merged into this repo at `src/lib/litegraph/` and the original repository archived
- Risk: All litegraph maintenance burden now lives in this repo. No upstream contributions.
- Impact: Library bugs must be fixed here. Historical commit references point to an archived repo.

### PrimeVue Pinned Usage

- Per ADR 0004, a fork was rejected. Project uses standard npm `primevue` with 386 imports across 228 files
- Risk: Known incompatibilities (`getBoundingClientRect()` not transform-aware; `scrollIntoView` hostility) require workarounds indefinitely
- Migration path: shadcn/vue and Reka UI are the preferred replacements

### Vue Extension Bundling Breaking Change (v1.33.9)

- Per ADR 0005, extensions using `external: ['vue']` fail with "Failed to resolve module specifier 'vue'" after v1.33.9
- Affected versions: v1.32.x–v1.33.8 supported the import-map pattern; v1.33.9+ requires bundling
- Risk: Old extensions on the Marketplace will break silently
- Mitigation: Issue #7267 documents the migration; `ComfyUI_frontend_vue_basic` demonstrates the new pattern

## Missing Critical Features

### Unified Identity System

- Problem: Widgets and Slots have no independent IDs (ADR 0008 addresses this)
- Blocks: Reliable widget state persistence across rename, cross-kind ID type safety, clean CRDT merging

### Transactional Atomicity Guarantees

- Problem: ADR 0008 describes operations as "atomic" but does not specify transactional semantics
- Current state: `beforeChange()`/`afterChange()` provides coarse undo snapshots; no rollback on mid-operation failure
- Fix: World transactions (discussed in `docs/architecture/ecs-world-command-api.md`)

### Y.js / ECS Coexistence Design

- Problem: The two most sophisticated subsystems — CRDT layout (ADR 0003) and ECS World (ADR 0008) — have no documented coexistence strategy
- Per appendix: "This is not an implementation detail — it is a fundamental architectural question"
- Blocks: Confident migration sequencing

## Test Coverage Gaps

### ECS Migration Parity Tests

- What's not tested: No parity tests between the legacy LGraph direct-access path and the proto-ECS store reads
- Files: `src/renderer/core/layout/store/layoutStore.test.ts` exists but does not compare against `node.pos` direct reads
- Risk: Silent divergence during Phase 1 bridge period
- Priority: High

### Extension Compatibility Regression Suite

- What's not tested: No automated suite that exercises the public callback API surface (`onConnectionsChange`, `onRemoved`, etc.) from an extension consumer's perspective
- Risk: Any ECS refactor could silently break custom nodes in production
- Priority: High (primary risk per appendix section III)

### Large-Workflow Performance Baselines

- What's not tested: No automated benchmarks for 200-node / 500-node workflow frame times (required by ADR 0008 as a release gate)
- Files: Storybook stories exist in `src/storybook/` but no performance harness
- Priority: Medium — required before Phase 2 of ECS migration

### Render-Loop Side-Effect Reproducibility

- What's not tested: No tests asserting `drawNode()` is idempotent (because it is not — see `LGraphCanvas.ts:5562,5564`)
- Risk: Future render changes may introduce new state mutations unnoticed
- Priority: Medium

### PrimeVue Workaround Tests

- What's not tested: `src/components/primevueOverride/SelectPlus.vue` and `AutoCompletePlus.vue` have no dedicated tests for the transform-coordinate or scroll-interference scenarios that motivated them
- Risk: PrimeVue updates could regress the workaround silently
- Priority: Medium

---

_Concerns audit: 2026-04-20_
