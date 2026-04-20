# Technology Stack

**Analysis Date:** 2026-04-20

## Languages

**Primary:**

- TypeScript `^5.9.3` (pnpm catalog) — exclusive for all new app code; strict mode enabled in `tsconfig.json` (target `ES2023`, `verbatimModuleSyntax: true`)
- Vue 3 SFC (`.vue`) — Composition API only, `<script setup lang="ts">` pattern

**Secondary:**

- JavaScript — legacy scripts and build helpers under `scripts/` and `tools/`
- CSS — Tailwind 4 + `src/assets/css/style.css` design tokens; stylelint governs `{apps,packages,src}/**/*.{css,vue}`
- GLSL — shaders under `src/renderer/glsl/`
- Python — Python-side devtools in `tools/devtools/` (compile-checked via `pnpm devtools:pycheck`)

## Runtime

**Environment:**

- Node.js `24.x` (pinned in `package.json` `engines` and `.nvmrc`)
- Browsers: Chromium-based, ES2022 build target (`vite.config.mts` → `build.target: 'es2022'`)
- Electron (Desktop distribution) via `@comfyorg/comfyui-electron-types` catalog dep; bridge accessed via `window.electronAPI` (see `src/utils/envUtil.ts`)

**Package Manager:**

- pnpm `^10` (enforced `engines.pnpm: >=10`, `packageManager: pnpm@10.33.0`)
- Lockfile: `pnpm-lock.yaml` (present, 688kB)
- Catalog-based version management via `pnpm-workspace.yaml` `catalog:` protocol

## Frameworks

**Core:**

- Vue `^3.5.13` (catalog) — with `vue-router ^4.4.3`, `pinia ^3.0.4`
- Vue i18n `^9.14.5` — message catalogs under `src/locales/<lang>/main.json`; bootstrap in `src/i18n.ts`
- Reka UI `^2.5.0` + PrimeVue `^4.2.5` (`@primevue/*`, `@primeuix/*` themes/forms/icons) — UI component libraries
- Tailwind CSS `^4.2.0` via `@tailwindcss/vite` — utility-first styling; `<style>` blocks discouraged
- VueUse `^14.2.0` (`@vueuse/core`, `@vueuse/integrations`, `@vueuse/router`)

**Testing:**

- Vitest `^4.0.16` (unit/component) with `happy-dom ^20.0.11` environment — configured in `vite.config.mts` `test:` block
- Playwright `^1.58.1` (E2E/browser) — `playwright.config.ts`, `playwright.i18n.config.ts`
- `@testing-library/vue ^8.1.0`, `@testing-library/user-event ^14.6.1`, `@testing-library/jest-dom ^6.9.1`
- `@vue/test-utils ^2.4.6`, `@pinia/testing ^1.0.3`
- `fast-check ^4.5.3` for property-based tests
- `jsdom ^27.4.0` available as secondary DOM env

**Build/Dev:**

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

**Critical:**

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

**Infrastructure:**

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

**Environment:**

- `.env` (git-ignored) — populated from `.env_example`
- Key vars: `DEV_SERVER_COMFYUI_URL`, `PLAYWRIGHT_TEST_URL`, `TEST_COMFYUI_DIR`, `VITE_REMOTE_DEV`, `ENABLE_MINIFY`, `DISABLE_VUE_PLUGINS`, `DISABLE_TEMPLATES_PROXY`, `ALGOLIA_APP_ID`, `ALGOLIA_API_KEY`, `VITE_POSTHOG_DEBUG`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_PROJECT_PROD`, `SENTRY_DSN`, `FRONTEND_COMMIT_HASH`, `DISTRIBUTION`, `IS_NIGHTLY`, `USE_PROD_CONFIG`, `GENERATE_SOURCEMAP`, `ANALYZE_BUNDLE`
- Compile-time define constants (see `vite.config.mts` `define`): `__COMFYUI_FRONTEND_VERSION__`, `__COMFYUI_FRONTEND_COMMIT__`, `__SENTRY_ENABLED__`, `__SENTRY_DSN__`, `__ALGOLIA_APP_ID__`, `__ALGOLIA_API_KEY__`, `__USE_PROD_CONFIG__`, `__DISTRIBUTION__`, `__IS_NIGHTLY__`

**Build:**

- Vite configs: `vite.config.mts` (main), `vite.electron.config.mts` (desktop), `vite.types.config.mts` (type bundling)
- TypeScript: `tsconfig.json` (app), `tsconfig.types.json`, per-package `tsconfig.json` under `packages/*` and `apps/*`
- Path aliases: `@/*` → `/src/*`; `@/utils/formatUtil` and `@/utils/networkUtil` resolve to `packages/shared-frontend-utils/src/*`
- Nx targets declared in `nx.json` (build, test, serve, dev, preview, typecheck, e2e, storybook, lint)
- Lint/format: `eslint.config.ts`, `.oxlintrc.json`, `.oxfmtrc.json`, `.stylelintrc.json`, `knip.config.ts`, `lint-staged.config.ts`
- Git hooks: Husky (`prepare` script runs `husky || true`); blame ignore file via `.git-blame-ignore-revs`
- Generated assets: `components.d.ts` (by `unplugin-vue-components`), `global.d.ts`, `src/vite-env.d.ts`

## Platform Requirements

**Development:**

- Node `24.x`, pnpm `>=10`
- Conda env `comfyui` for backend (per local memory)
- ComfyUI backend reachable at `http://127.0.0.1:8188` (default) or `*.comfy.org` (cloud mode auto-detected from `DEV_SERVER_COMFYUI_URL`)
- Frontend dev server on `http://localhost:5173`

**Production:**

- Three distribution targets controlled by `DISTRIBUTION` env var (`vite.config.mts`):
  - `localhost` — default OSS build served from ComfyUI Python server
  - `cloud` — deployed at `https://cloud.comfy.org`; enables Sentry sourcemaps, GCS proxy handling, proprietary ABCROM fonts, Twitter/OG meta, remote-config loading
  - `desktop` — Electron-packaged via `apps/desktop-ui`
- Nightly vs. RC/stable releases controlled by `IS_NIGHTLY`
- Bundle output: `dist/` with manual vendor code-splitting (vendor-vue-core, vendor-firebase, vendor-sentry, vendor-primevue, vendor-reka-ui, vendor-three, vendor-tiptap, vendor-chart, vendor-xterm, vendor-yjs, vendor-vueuse, vendor-i18n, vendor-zod, vendor-axios, vendor-markdown, vendor-other)
- Lazy vendor chunks: vendor-three, vendor-xterm, vendor-tiptap, vendor-chart, vendor-yjs (excluded from `modulePreload`)

## Monorepo Layout

**Apps (`apps/`):**

- `apps/desktop-ui/` — Electron desktop UI (`@comfyorg/desktop-ui`)
- `apps/website/` — Astro-based marketing site (`astro.config.ts`, `vercel.json`)

**Packages (`packages/`):**

- `packages/design-system/` — `@comfyorg/design-system` (icons, tokens, primitives)
- `packages/shared-frontend-utils/` — `@comfyorg/shared-frontend-utils` (hosts `formatUtil`, `networkUtil` aliased into `@/utils/*`)
- `packages/tailwind-utils/` — `@comfyorg/tailwind-utils` (`cn()` helper)
- `packages/ingest-types/` — `@comfyorg/ingest-types` (OpenAPI-generated types for Comfy Cloud Ingest API via `@hey-api/openapi-ts`)
- `packages/registry-types/` — `@comfyorg/registry-types` (Comfy Registry API types)

---

_Stack analysis: 2026-04-20_
