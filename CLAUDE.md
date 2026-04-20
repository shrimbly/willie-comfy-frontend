@AGENTS.md

<!-- GSD:project-start source:PROJECT.md -->

## Project

**Moshpit (ComfyUI Autocanvas)**

Moshpit is a full-bleed spatial canvas inside ComfyUI for prosumer users to explore, compare, and curate generated image assets. It's a cross-workflow workspace — a peer of the workflow graph, not scoped to any open workflow — where users progressively filter and arrange outputs by embedded metadata (CFG, steps, LoRA, sampler, etc.), compare candidates across three comparison modes, and curate via favourites, tags, folders, hide, and export.

**Core Value:** **Prove that spatial-sort-by-parameter is a valuable interaction for reasoning about generation output.** Every tradeoff resolves toward that: if the sort axis doesn't feel great on real parameter sweeps, nothing else matters.

### Constraints

- **Tech stack**: Vue 3.5 Composition API, TypeScript, Tailwind 4, Pinia, Vite, pnpm — mandatory (project-wide conventions). No new PrimeVue usage, no `dark:` variant, no `:class="[]"`, no `!important`, no `any` / `as any`, no `--no-verify`.
- **Rendering**: PixiJS for Moshpit canvas. Shared input composable with litegraph canvas; do not share the renderer.
- **Entity architecture**: No modifications to `LGraphNode`, `LGraphCanvas`, `LGraph`, or `Subgraph`. ADR 0003 + 0008 — command pattern for mutations, ECS-style component access, no OOP inheritance for entities. Extension compatibility is non-negotiable.
- **Persistence**: IndexedDB only for v1. No backend storage, no sidecar DB, no settings-store piggyback for per-asset data.
- **Metadata**: Embedded PNG metadata only (`getFromPngBuffer`). Assets without parseable ComfyUI metadata are excluded.
- **Performance budget**: 5,000 assets target. 60fps pan/zoom, <2s first thumb cold, <3s full populate on warm cache, <500ms full-res on warm HTTP. No graceful degradation beyond 5k.
- **Platform**: Desktop-first. Mobile/touch is explicitly unsupported for v1 (IndexedDB quota, canvas density).
- **Accessibility posture**: Canvas is a visual-only surface. All _actions_ (filter, sort, compare, curate, export) must be keyboard-reachable and screen-reader-legible via the Settings panel and comparison mode.
- **Git conventions**: `prefix:` commit format (`feat:`, `fix:`, `test:`). PRs reference issues via "Fixes #n". No Claude/AI mentions in commits.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript `^5.9.3` (pnpm catalog) — exclusive for all new app code; strict mode enabled in `tsconfig.json` (target `ES2023`, `verbatimModuleSyntax: true`)
- Vue 3 SFC (`.vue`) — Composition API only, `<script setup lang="ts">` pattern
- JavaScript — legacy scripts and build helpers under `scripts/` and `tools/`
- CSS — Tailwind 4 + `src/assets/css/style.css` design tokens; stylelint governs `{apps,packages,src}/**/*.{css,vue}`
- GLSL — shaders under `src/renderer/glsl/`
- Python — Python-side devtools in `tools/devtools/` (compile-checked via `pnpm devtools:pycheck`)

## Runtime

- Node.js `24.x` (pinned in `package.json` `engines` and `.nvmrc`)
- Browsers: Chromium-based, ES2022 build target (`vite.config.mts` → `build.target: 'es2022'`)
- Electron (Desktop distribution) via `@comfyorg/comfyui-electron-types` catalog dep; bridge accessed via `window.electronAPI` (see `src/utils/envUtil.ts`)
- pnpm `^10` (enforced `engines.pnpm: >=10`, `packageManager: pnpm@10.33.0`)
- Lockfile: `pnpm-lock.yaml` (present, 688kB)
- Catalog-based version management via `pnpm-workspace.yaml` `catalog:` protocol

## Frameworks

- Vue `^3.5.13` (catalog) — with `vue-router ^4.4.3`, `pinia ^3.0.4`
- Vue i18n `^9.14.5` — message catalogs under `src/locales/<lang>/main.json`; bootstrap in `src/i18n.ts`
- Reka UI `^2.5.0` + PrimeVue `^4.2.5` (`@primevue/*`, `@primeuix/*` themes/forms/icons) — UI component libraries
- Tailwind CSS `^4.2.0` via `@tailwindcss/vite` — utility-first styling; `<style>` blocks discouraged
- VueUse `^14.2.0` (`@vueuse/core`, `@vueuse/integrations`, `@vueuse/router`)
- Vitest `^4.0.16` (unit/component) with `happy-dom ^20.0.11` environment — configured in `vite.config.mts` `test:` block
- Playwright `^1.58.1` (E2E/browser) — `playwright.config.ts`, `playwright.i18n.config.ts`
- `@testing-library/vue ^8.1.0`, `@testing-library/user-event ^14.6.1`, `@testing-library/jest-dom ^6.9.1`
- `@vue/test-utils ^2.4.6`, `@pinia/testing ^1.0.3`
- `fast-check ^4.5.3` for property-based tests
- `jsdom ^27.4.0` available as secondary DOM env
- Vite `^8.0.0` — entry `vite.config.mts`, electron variant `vite.electron.config.mts`, types variant `vite.types.config.mts`
- Nx `22.6.1` — monorepo orchestrator (`nx.json`), wraps `@nx/vite`, `@nx/eslint`, `@nx/playwright`, `@nx/storybook`
- Storybook `^10.2.10` via `@storybook/vue3-vite` — `.storybook/` directory, `pnpm storybook`
- `unplugin-vue-components` — auto-registers components under `src/components`, `src/layout`, `src/views` (emits `components.d.ts`)
- `unplugin-icons` — icon components with custom `comfy` collection loaded from `packages/design-system/src/icons`
- `unplugin-typegpu` — WebGPU shader transforms
- `@sentry/vite-plugin ^4.6.0` — sourcemap upload for cloud builds
- `rollup-plugin-visualizer` — bundle analysis when `ANALYZE_BUNDLE=true`
- `vite-plugin-html`, `vite-plugin-dts`, `vite-plugin-vue-devtools`
- Custom build plugins in `build/plugins.ts` (e.g., `comfyAPIPlugin`)

## Key Dependencies

- `pinia ^3.0.4` — state management; stores under `src/stores/` and feature-scoped stores under `src/platform/**`
- `vuefire ^3.2.1` + `firebase ^11.6.0` — Firebase Auth integration (`VueFireAuth`), config in `src/config/firebase.ts`
- `@sentry/vue ^10.32.1` — error telemetry, initialized in `src/main.ts`
- `axios ^1.13.5` — HTTP client for external registry APIs (see `src/services/comfyRegistryService.ts`, `src/scripts/api.ts`)
- `zod ^3.23.8` + `zod-validation-error ^3.3.0` — schema validation; schemas under `src/schemas/` and `packages/ingest-types/src/zod.gen.ts`
- `es-toolkit ^1.39.9` — preferred utility library
- `fuse.js ^7.0.0` — fuzzy search for node/registry search
- `algoliasearch` (catalog) — managed node search provider (`src/services/providers/algoliaSearchProvider.ts`)
- `posthog-js` (catalog) + `mixpanel-browser` — telemetry providers under `src/platform/telemetry/providers/cloud/`
- `yjs ^13.6.27` — CRDT layout store at `src/renderer/core/layout/store/layoutStore.ts`
- `jsonata ^2.1.0`, `jsondiffpatch ^0.7.3` — JSON query/diff utilities
- `marked ^15.0.11` + `dompurify ^3.2.5` — markdown rendering with sanitization
- `@tiptap/core ^2.27.2` + extensions (link, table, starter-kit) + `tiptap-markdown ^0.8.10` — rich text editor widgets
- `three ^0.170.0` + `@types/three` + `wwobjloader2` — 3D preview (`load3dService.ts`)
- `@sparkjsdev/spark` — companion 3D rendering
- `typegpu ^0.8.2` + `@webgpu/types ^0.1.66` — WebGPU compute (via `unplugin-typegpu`)
- `@xterm/xterm ^5.5.0` + `@xterm/addon-fit`, `@xterm/addon-serialize` — terminal/log panel
- `chart.js ^4.5.0` — stats/monitoring charts
- `@tanstack/vue-virtual` — virtualized lists/grids (asset browser)
- `@atlaskit/pragmatic-drag-and-drop ^1.3.1` — drag-and-drop primitives
- `@formkit/auto-animate` — layout animations
- `extendable-media-recorder` + `extendable-media-recorder-wav-encoder` — WAV audio recording (`audioService.ts`)
- `loglevel ^1.9.2` — leveled logging
- `semver ^7.7.2` — version comparisons
- `cva` + `tw-animate-css` + `primeicons ^7.0.0` — UI composition utilities
- `@comfyorg/comfyui-electron-types` — desktop bridge types (excluded from `optimizeDeps`)

## Configuration

- `.env` (git-ignored) — populated from `.env_example`
- Key vars: `DEV_SERVER_COMFYUI_URL`, `PLAYWRIGHT_TEST_URL`, `TEST_COMFYUI_DIR`, `VITE_REMOTE_DEV`, `ENABLE_MINIFY`, `DISABLE_VUE_PLUGINS`, `DISABLE_TEMPLATES_PROXY`, `ALGOLIA_APP_ID`, `ALGOLIA_API_KEY`, `VITE_POSTHOG_DEBUG`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_PROJECT_PROD`, `SENTRY_DSN`, `FRONTEND_COMMIT_HASH`, `DISTRIBUTION`, `IS_NIGHTLY`, `USE_PROD_CONFIG`, `GENERATE_SOURCEMAP`, `ANALYZE_BUNDLE`
- Compile-time define constants (see `vite.config.mts` `define`): `__COMFYUI_FRONTEND_VERSION__`, `__COMFYUI_FRONTEND_COMMIT__`, `__SENTRY_ENABLED__`, `__SENTRY_DSN__`, `__ALGOLIA_APP_ID__`, `__ALGOLIA_API_KEY__`, `__USE_PROD_CONFIG__`, `__DISTRIBUTION__`, `__IS_NIGHTLY__`
- Vite configs: `vite.config.mts` (main), `vite.electron.config.mts` (desktop), `vite.types.config.mts` (type bundling)
- TypeScript: `tsconfig.json` (app), `tsconfig.types.json`, per-package `tsconfig.json` under `packages/*` and `apps/*`
- Path aliases: `@/*` → `/src/*`; `@/utils/formatUtil` and `@/utils/networkUtil` resolve to `packages/shared-frontend-utils/src/*`
- Nx targets declared in `nx.json` (build, test, serve, dev, preview, typecheck, e2e, storybook, lint)
- Lint/format: `eslint.config.ts`, `.oxlintrc.json`, `.oxfmtrc.json`, `.stylelintrc.json`, `knip.config.ts`, `lint-staged.config.ts`
- Git hooks: Husky (`prepare` script runs `husky || true`); blame ignore file via `.git-blame-ignore-revs`
- Generated assets: `components.d.ts` (by `unplugin-vue-components`), `global.d.ts`, `src/vite-env.d.ts`

## Platform Requirements

- Node `24.x`, pnpm `>=10`
- Conda env `comfyui` for backend (per local memory)
- ComfyUI backend reachable at `http://127.0.0.1:8188` (default) or `*.comfy.org` (cloud mode auto-detected from `DEV_SERVER_COMFYUI_URL`)
- Frontend dev server on `http://localhost:5173`
- Three distribution targets controlled by `DISTRIBUTION` env var (`vite.config.mts`):
- Nightly vs. RC/stable releases controlled by `IS_NIGHTLY`
- Bundle output: `dist/` with manual vendor code-splitting (vendor-vue-core, vendor-firebase, vendor-sentry, vendor-primevue, vendor-reka-ui, vendor-three, vendor-tiptap, vendor-chart, vendor-xterm, vendor-yjs, vendor-vueuse, vendor-i18n, vendor-zod, vendor-axios, vendor-markdown, vendor-other)
- Lazy vendor chunks: vendor-three, vendor-xterm, vendor-tiptap, vendor-chart, vendor-yjs (excluded from `modulePreload`)

## Monorepo Layout

- `apps/desktop-ui/` — Electron desktop UI (`@comfyorg/desktop-ui`)
- `apps/website/` — Astro-based marketing site (`astro.config.ts`, `vercel.json`)
- `packages/design-system/` — `@comfyorg/design-system` (icons, tokens, primitives)
- `packages/shared-frontend-utils/` — `@comfyorg/shared-frontend-utils` (hosts `formatUtil`, `networkUtil` aliased into `@/utils/*`)
- `packages/tailwind-utils/` — `@comfyorg/tailwind-utils` (`cn()` helper)
- `packages/ingest-types/` — `@comfyorg/ingest-types` (OpenAPI-generated types for Comfy Cloud Ingest API via `@hey-api/openapi-ts`)
- `packages/registry-types/` — `@comfyorg/registry-types` (Comfy Registry API types)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

- `AGENTS.md` / `CLAUDE.md` (root project instructions)
- `docs/guidance/typescript.md` (TypeScript rules)
- `docs/guidance/vue-components.md` (Vue component rules)
- `docs/guidance/design-standards.md` (UI/Figma rules)
- `.oxfmtrc.json` (formatter config)
- `.oxlintrc.json` (oxlint rules)
- `eslint.config.ts` (ESLint rules, import boundaries, i18n)

## Language & File Types

- **TypeScript exclusive.** No new JavaScript files. Exceptions: `scripts/**/*.js` and legacy files in `src/extensions/core/*` and `src/scripts/*` (both ignored by oxlint).
- **Vue 3.5+ SFCs** (`.vue`) with Composition API only — `<script setup lang="ts">`.
- **Tailwind 4** for all styling. Avoid `<style>` blocks (exception: scoped `:deep()` for third-party DOM like xterm — add a comment).
- **Node entry:** `src/main.ts`; routing in `src/router.ts`; i18n in `src/i18n.ts`.

## Formatter (oxfmt — `.oxfmtrc.json`)

| Setting         | Value                            |
| --------------- | -------------------------------- |
| `singleQuote`   | `true`                           |
| `tabWidth`      | `2`                              |
| `semi`          | `false` (no trailing semicolons) |
| `trailingComma` | `"none"`                         |
| `printWidth`    | `80`                             |

## Naming Patterns

| Entity            | Convention                               | Example                               |
| ----------------- | ---------------------------------------- | ------------------------------------- |
| Vue components    | PascalCase                               | `MenuHamburger.vue`                   |
| Composables       | `useXyz.ts` camelCase                    | `useServerLogs.ts`                    |
| Pinia stores      | `*Store.ts`                              | `releaseStore.ts`, `workflowStore.ts` |
| Test files        | `sourceFile.test.ts` (co-located)        | `workflowStore.test.ts`               |
| E2E specs         | `*.spec.ts` under `browser_tests/tests/` | `widget.spec.ts`                      |
| Storybook stories | `*.stories.ts`                           | `MyComponent.stories.ts`              |
| Schemas           | `*Schema.ts`                             | `src/schemas/nodeDefSchema.ts`        |

## Import Rules

- Imports are sorted/grouped by plugin — run `pnpm format` before committing.
- Use **separate** `import type` statements, not inline `type` in mixed imports (enforced by `import/consistent-type-specifier-style: prefer-top-level` in `.oxlintrc.json`).
- No barrel files inside `/src` (e.g. `index.ts` re-exports are discouraged).
- No duplicate imports (`import/no-duplicates: error`).
- No floating promises (`typescript/no-floating-promises: error`).
- Unused imports removed (`unused-imports/no-unused-imports: error`).

### Path Aliases

- `@/*` → `/src` (main src alias).
- `@/utils/formatUtil` → `packages/shared-frontend-utils/src/formatUtil.ts`.
- `@/utils/networkUtil` → `packages/shared-frontend-utils/src/networkUtil.ts`.
- `@e2e/*` → use in `browser_tests/` instead of relative imports (enforced).

### Deprecated / Restricted Imports (from `.oxlintrc.json`)

- `primevue/calendar` → use `primevue/datepicker` (`DatePicker`)
- `primevue/dropdown` → use `primevue/select` (`Select`)
- `primevue/inputswitch` → use `primevue/toggleswitch` (`ToggleSwitch`)
- `primevue/overlaypanel` → use `primevue/popover` (`Popover`)
- `primevue/sidebar` → use `primevue/drawer` (`Drawer`)
- `useVirtualList` from `@vueuse/core` — requires uniform item heights. Use TanStack Virtual (via Reka UI virtualizer or `@tanstack/vue-virtual`).
- In Vue SFCs, do not import `t`, `d`, `te` from `@/i18n` — use `const { t } = useI18n()`.
- In non-composable `.ts` files (not matching `use[A-Z]*.ts`), do not import `useI18n` from `vue-i18n` — use `import { t } from '@/i18n'`.
- In `browser_tests/tests/**/*.spec.ts`, do not import `test` from `@playwright/test` — use `comfyPageFixture as test` from `@e2e/fixtures/ComfyPage`.

### Layer Architecture Boundaries (`eslint.config.ts`)

- `src/base/**` may not import from `src/platform/**`, `src/workbench/**`, `src/renderer/**`.
- `src/platform/**` may not import from `src/workbench/**`, `src/renderer/**`.
- `src/workbench/**` may not import from `src/renderer/**`.
- Layer order (bottom → top): `base → platform → workbench → renderer`.

## TypeScript Rules (see `docs/guidance/typescript.md`)

- **NEVER use `any`** (`typescript/no-explicit-any: error`).
- **NEVER use `as any`** — fix the underlying type issue.
- Avoid `@ts-expect-error`.
- Type assertion hierarchy (most to least preferred):
- `no-unsafe-optional-chaining: error`.
- `typescript/no-empty-object-type: error` (interfaces allowed).
- `typescript/no-import-type-side-effects: error`.

### Zod Schemas

- Never use `z.any()` — it propagates `any` into types.
- Use `z.unknown()` + narrow.
- Never add test-only settings/types to production schemas.

### Public API Contracts

- Keep public API types stable (e.g., `ExtensionManager`).
- Don't expose internal Pinia store types.
- Unwrap `ComputedRef<T>` before exposing.

### Circular Dependency Avoidance

- Extract type guards + interfaces into **leaf modules** (only `import type`).
- Never put type guards in heavy modules (those with runtime store/util imports).

## Vue 3 Composition API

- Use `<script setup lang="ts">`.
- Use Vue 3.5 TypeScript destructured props with defaults. **Do not use** `withDefaults` or runtime props declaration.
- Prefer `defineModel` over separate prop+emit for `v-model`.
- Do not import Vue macros unnecessarily (enforced: `vue/no-import-compiler-macros: error`).
- Define slots via template usage — no `defineSlots`.
- Use same-name shorthand for slot prop bindings: `:isExpanded` not `:is-expanded="isExpanded"`.
- Derive component types via `vue-component-type-helpers` (`ComponentProps`, `ComponentSlots`).
- Use `emit/@event-name` for state changes. `defineExpose` only for imperative ops (`form.validate()`, `modal.open()`).
- Prefer VueUse composables: `useElementHover`, `useIntersectionObserver`, `useFocusTrap`, `useEventListener`.
- Implement cleanup in unmounted hooks for async ops.

### State Management Discipline (AGENTS.md #25)

- If a prop suffices, don't add a `ref`.
- If a `ref`/prop suffices, don't add a `computed`.
- If a `computed` suffices, don't add a `watch`.

### ESLint Vue Rules (`eslint.config.ts`)

- `vue/match-component-import-name: error`
- `vue/no-unused-properties: error`
- `vue/no-unused-refs: error`
- `vue/no-unused-emit-declarations: error`
- `vue/no-useless-mustaches: error`
- `vue/no-useless-v-bind: error`
- `vue/no-use-v-else-with-v-for: error`
- `vue/one-component-per-file: error`
- `vue/no-restricted-class: ['error', '/^dark(-theme)?:/']` — enforces the no-`dark:` rule.

## Tailwind CSS (Tailwind 4)

- `enforce-consistent-class-order: error`
- `enforce-canonical-classes: error`
- `no-deprecated-classes: error`
- Entry point: `packages/design-system/src/css/style.css`.

### Styling Rules

- **NEVER use the `dark:` variant.** Use semantic tokens from `packages/design-system/src/css/style.css` (e.g. `bg-node-component-surface`). Enforced via `vue/no-restricted-class`.
- **NEVER use `:class="[]"` to merge classes.** Always use `cn()` from `@/utils/tailwindUtil`:
- **NEVER use `!important` / `!` prefix.** Find the offending `!important` rule and fix it upstream.
- **NEVER use arbitrary percentage values** like `w-[80%]` when a fraction utility exists. Use `w-4/5`, `w-1/2`, etc.
- Map Figma tokens to Tailwind semantic tokens; never hardcode hex.
- Skip Figma `-hover` / `-selected` tokens — derive with `color-mix()` or Tailwind `hover:` modifiers.

## Logging

- Use `console.warn` / `console.error` only. `console.log` et al. are forbidden (`no-console: [error, { allow: ['warn', 'error'] }]`).
- Overridden to `allow` in `**/*.{stories,test,spec}.ts` and `**/*.stories.vue`.
- Never log secrets.

## Error Handling

- Implement proper error handling (AGENTS.md dev guideline #8).
- Sanitize HTML with `DOMPurify.sanitize()`.

## Function Design

- Prefer **function declarations** over function expressions where possible (AGENTS.md #24).
- Keep functions short and functional (#20).
- Minimize nesting — avoid the arrow anti-pattern (#21).
- Prefer immutability and point-of-declaration assignment (#22).
- Favor pure, testable functions (#23).

## Module Design

- Minimize module surface area — minimize exports from each module/composable (AGENTS.md #18).
- No barrel `index.ts` re-exports inside `/src` (#19).
- Extract reused inline complex types into named types (#4).

## i18n

- All user-facing strings go through vue-i18n. English source: `src/locales/en/main.json`.
- Use the plurals system — do not hardcode pluralization in templates.
- `@intlify/vue-i18n/no-raw-text: error` — raw text in templates is blocked. Ignored text list includes: `API`, `ComfyUI`, `CPU`, `fps`, `GB`, `GitHub`, `GPU`, `JSON`, `KB`, `LoRA`, `MB`, `ms`, `OpenAI`, `png`, `px`, `RAM`, `URL`, `YAML`.
- Ignored attributes for raw text: `aria-label`, `aria-placeholder`, `aria-roledescription`, `aria-valuetext`, `label`, `placeholder`, `title`, `v-tooltip`, `img/alt`.
- Website app (`apps/website/**`) is exempt (marketing site, no i18n setup).

## API Usage

- Use `api` helpers for ComfyUI calls:
- Don't construct URLs directly (`fetch('/api/prompt')` is wrong).

## Utility Libraries

- Use `es-toolkit` for utility functions (not lodash).
- Use VueUse composables for performance-enhancing behaviors.

## Comments

- Code should be self-documenting (AGENTS.md #14).
- Don't retain redundant comments — clean as you go (#15).
- When comments are needed, explain **why**, not what.

## Entity / ADR Constraints

- All entity mutations must be serializable, idempotent, deterministic commands (ADR 0003 + 0008).
- Entity data lives in the World registry; access via `world.getComponent(entityId, ComponentType)`.
- **Do not add methods to god objects**: `LGraphNode`, `LGraphCanvas`, `LGraph`, `Subgraph`. Extract to systems / stores / composables.
- ECS components are plain data — no methods, no back-references.
- Changes to entity callbacks (`onConnectionsChange`, `onRemoved`, `onAdded`, `onConnectInput/Output`, `onConfigure`, `onWidgetChanged`), `node.widgets`, `node.serialize`, or `graph._version++` affect 40+ extensions and require migration guidance.

## Common Pitfalls (from `AGENTS.md`)

- **NEVER** use `any` type.
- **NEVER** use `as any` type assertions.
- **NEVER** use `--no-verify` when committing.
- **NEVER** delete or disable tests to make them pass.
- **NEVER** circumvent quality checks (`pnpm lint`, `pnpm typecheck`, `pnpm knip`, tests).
- **NEVER** use the `dark:` tailwind variant — use semantic tokens.
- **NEVER** use `:class="[]"` for class merging — use `cn()`.
- **NEVER** use `!important` or `!` prefix in Tailwind.
- **NEVER** use arbitrary percentages when a Tailwind fraction utility exists.
- **NEVER** mention Claude/AI in commit messages.

## Git Conventions

- Commit prefixes: `feat:`, `fix:`, `test:`, `refactor:`, `chore:`, `docs:` (see recent git log).
- Reference issues: `- Fixes #123` in PR descriptions.
- PRs: concise, information-dense, no emojis, no excessive sections. Follow the template in `.github/`.
- Quality gates before merge: `pnpm lint`, `pnpm typecheck`, `pnpm knip`, relevant tests.
- Target ≤ 300 lines of non-test code per PR — split larger PRs.

## Development Workflow

## Temporary Files (Agent Rules)

- `/temp/plans/` — planning documents
- `/temp/scripts/` — scripts used
- `/temp/summaries/` — work summaries
- `/temp/in_progress/` — TODOs and status updates
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## Pattern Overview

- Vue 3.5 Composition API SFCs (`<script setup lang="ts">`) — runtime composition
- Pinia stores in `src/stores/` and `src/platform/**/stores/` as the single
- Layered imports enforced: `base` is the most restrictive, `platform` composes
- Graph rendering delegates to the vendored/merged litegraph core in
- A Vue-native node renderer in `src/renderer/extensions/vueNodes/` runs
- Entity mutations are migrating to an Entity-Component-System model with
- Route-driven shell: `src/router.ts` mounts `LayoutDefault` then either
- Distribution-aware bootstrapping: `localhost` / `desktop` (Electron) /

## Layers

- Purpose: Low-level primitives shared by every layer. No dependencies on
- Location: `src/base/`
- Contains: `common/`, `credits/`, `pointerUtils.ts` — generic utilities and
- Depends on: Third-party packages only.
- Used by: `platform`, `workbench`, `renderer`, top-level `src/` code.
- Purpose: Cross-cutting product capabilities — auth, settings, telemetry,
- Location: `src/platform/`
- Contains:
- Depends on: `base`, third-party libs, Pinia, Vue.
- Used by: `workbench`, `renderer`, top-level `src/` components and views.
- Purpose: Authoring surface and extension runtime that sits around the graph.
- Location: `src/workbench/`
- Contains:
- Depends on: `base`, `platform`.
- Used by: Top-level views, renderer extensions, components.
- Purpose: Rendering pipeline for the graph canvas, spatial indexing, layout
- Location: `src/renderer/`
- Contains:
- Depends on: `base`, `platform`, `src/lib/litegraph`.
- Used by: `src/components/graph/`, views, top-level app.
- Purpose: Graph data model + legacy canvas renderer (merged in by ADR 0001).
- Key files: `LGraph.ts` (3194 lines), `LGraphNode.ts` (4285 lines),
- Subsystems:
- Depends on: Self-contained; no imports from `src/` parent.
- Used by: `src/scripts/app.ts`, `src/renderer/**`, `src/stores/**`,
- Purpose: Narrow bridge between litegraph entities and schema/subgraph/widget

## Data Flow

- Pinia (`createPinia()` in `src/main.ts`). All stores are Setup-API stores
- Core stores in `src/stores/` (74 files): `workspaceStore`, `commandStore`,
- Workspace-scoped stores in `src/stores/workspace/`:
- Platform-owned stores live with their domain: e.g.
- Renderer state: `src/renderer/core/canvas/canvasStore.ts`,

## Key Abstractions

- Purpose: Graph model, node entity, canvas renderer.
- Examples: `src/lib/litegraph/src/LGraph.ts`,
- Pattern: Today these are god-object OOP classes. Per ADR 0008, all new
- Purpose: Nested graph hosted by a node.
- Examples: `src/lib/litegraph/src/subgraph/Subgraph.ts`,
- Pattern: A subgraph is modeled as a node with subgraph components
- Purpose: Per-node inputs (number, combo, slider, file upload, curve, asset,
- Canvas implementations: `src/lib/litegraph/src/widgets/*Widget.ts` plus
- Vue/DOM implementations: `src/scripts/domWidget.ts`,
- Purpose: Serialized graph + metadata managed and persisted as documents.
- Examples: `src/platform/workflow/management/stores/workflowStore.ts`
- Pattern: Workflow object tracks dirty state, validation warnings, and load
- Purpose: Unified model for inputs/outputs/models/media.
- Examples: `src/platform/assets/services/assetService.ts`,
- Purpose: Submit prompts, track progress, surface outputs.
- Examples: `src/stores/queueStore.ts`, `src/stores/executionStore.ts`,
- Purpose: Typed keyboard/menu-invokable actions plus the migration target for
- Examples: `src/stores/commandStore.ts`, `src/composables/useCoreCommands.ts`,
- Location: `src/scripts/app.ts`.
- Role: Bridge between `main.ts`/`App.vue` and the litegraph canvas — owns the
- Target: Centralized component registry keyed by branded entity IDs; see
- Today: No `src/ecs/` directory yet. Bridges exist indirectly through

## Entry Points

- Location: `src/main.ts`, mount point `#vue-app` in `/index.html`.
- Triggers: `pnpm dev` / `pnpm build` via Vite (`vite.config.mts`).
- Responsibilities: Distribution branching (cloud/desktop/localhost), Sentry
- Location: `vite.electron.config.mts`, `pnpm dev:electron`.
- Responsibilities: Runs same Vue app with Electron API mocks and
- Routes:
- History: `createWebHashHistory()` when `file:` protocol (Electron bundled),
- Guards: User init check for `GraphView`; cloud-only global guard that
- `src/views/layouts/LayoutDefault.vue` — outer shell.
- `src/views/GraphView.vue` — primary editor view.
- `src/views/LinearView.vue` — linear-mode execution view.
- `src/views/UserSelectView.vue` — multi-user selector.
- `src/views/templates/` — template browser/galleries.
- Owns `/prompt`, `/queue`, `/history`, `/object_info`, WebSocket progress,
- Unit: `vitest run` via `nx run test` → `vitest.setup.ts` uses `happy-dom`.
- E2E: `playwright.config.ts` → `browser_tests/globalSetup.ts` and

## Error Handling

- Global Vue error path reports to Sentry (`src/main.ts`); cloud build uses
- `App.vue` listens for `vite:preloadError` and resource-load errors; logs and
- Unified handler composable: `src/composables/useErrorHandling.ts`.
- Toasts: `src/platform/updates/common/toastStore.ts` +
- Execution errors: `src/stores/executionErrorStore.ts` +
- Litegraph domain errors: `src/lib/litegraph/src/infrastructure/*Error.ts`
- Preload-error parser: `src/utils/preloadErrorUtil.ts`.

## Cross-Cutting Concerns

- `loglevel` dependency wraps console; Sentry breadcrumbs on cloud. Never log
- Zod schemas throughout: `src/schemas/apiSchema.ts`,
- Firebase + VueFire (`src/main.ts`, `src/stores/authStore.ts`,
- vue-i18n (`src/i18n.ts`), translations in `src/locales/{en,…}/main.json`.
- Tailwind 4 utility classes + semantic tokens in `src/assets/css/style.css`.
- `src/composables/useFeatureFlags.ts`, `src/composables/useVueFeatureFlags.ts`,
- `src/services/extensionService.ts` is the legacy extension entry point.
- In-product manager UI under `src/workbench/extensions/manager/` with its own
- Entity callback surface (`onConnectionsChange`, `onAdded`, `onRemoved`,
- `src/platform/telemetry/` (PostHog, mixpanel, Sentry). Page-view tracking
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill                       | Description                                                                                                                                                                                                                                                                                                       | Path                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| adding-deprecation-warnings | 'Adds deprecation warnings for renamed or removed properties/APIs. Searches custom node ecosystem for usage, applies defineDeprecatedProperty helper, adds JSDoc. Triggers on: deprecate, deprecation warning, rename property, backward compatibility.'                                                          | `.claude/skills/adding-deprecation-warnings/SKILL.md` |
| backport-management         | Manages cherry-pick backports across stable release branches. Discovers candidates from Slack/git, analyzes dependencies, resolves conflicts via worktree, and logs results. Use when asked to backport, cherry-pick to stable, manage release branches, do stable branch maintenance, or run a backport session. | `.claude/skills/backport-management/SKILL.md`         |
| contain-audit               | 'Detect DOM elements where CSS contain:layout+style would improve rendering performance. Runs a Playwright-based audit on a large workflow, scores candidates by subtree size and sizing constraints, measures performance impact, and generates a ranked report.'                                                | `.claude/skills/contain-audit/SKILL.md`               |
| layer-audit                 | 'Detect violations of the layered architecture import rules (base -> platform -> workbench -> renderer). Runs ESLint with the import-x/no-restricted-paths rule and generates a grouped report.'                                                                                                                  | `.claude/skills/layer-audit/SKILL.md`                 |
| perf-fix-with-proof         | 'Ships performance fixes with CI-proven improvement using stacked PRs. PR1 adds a @perf test (establishes baseline on main), PR2 adds the fix (CI shows delta). Use when implementing a perf optimization and wanting to prove it in CI.'                                                                         | `.claude/skills/perf-fix-with-proof/SKILL.md`         |
| red-green-fix               | 'Bug fix workflow that proves test validity with a red-then-green CI sequence. Commits a failing test first (CI red), then the minimal fix (CI green). Use when fixing a bug, writing a regression test, or when asked to prove a fix works.'                                                                     | `.claude/skills/red-green-fix/SKILL.md`               |
| regenerating-screenshots    | 'Creates a PR to regenerate Playwright screenshot expectations. Use when screenshot tests are failing on main or PRs due to stale golden images. Triggers on: regen screenshots, regenerate screenshots, update expectations, fix screenshot tests.'                                                              | `.claude/skills/regenerating-screenshots/SKILL.md`    |
| ticket-intake               | 'Parse ticket URL (Notion or GitHub), extract all data, initialize pipeline run. Use when starting work on a new ticket or when asked to pick up a ticket.'                                                                                                                                                       | `.claude/skills/ticket-intake/SKILL.md`               |
| writing-playwright-tests    | 'Writes Playwright e2e tests for ComfyUI_frontend. Use when creating, modifying, or debugging browser tests. Triggers on: playwright, e2e test, browser test, spec file.'                                                                                                                                         | `.claude/skills/writing-playwright-tests/SKILL.md`    |
| writing-storybook-stories   | 'Write or update Storybook stories for Vue components in ComfyUI_frontend. Use when adding, modifying, reviewing, or debugging `.stories.ts` files, Storybook docs, component demos, or visual catalog entries in `src/` or `apps/desktop-ui/`.'                                                                  | `.claude/skills/writing-storybook-stories/SKILL.md`   |

<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.

<!-- GSD:profile-end -->
