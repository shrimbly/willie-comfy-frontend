# External Integrations

**Analysis Date:** 2026-04-20

## APIs & External Services

**ComfyUI Backend (primary):**

- Python ComfyUI server — `http://127.0.0.1:8188` (desktop/localhost) or `https://*.comfy.org` (cloud); auto-detected cloud mode from `DEV_SERVER_COMFYUI_URL` in `vite.config.mts`
- HTTP + WebSocket client: `src/scripts/api.ts` (ComfyApi class; handles `/api/*`, `/ws`, `/workflow_templates`, `/extensions`, `/docs`, `/templates`, `/internal`)
- WS consumers: `src/stores/executionStore.ts`, `src/workbench/extensions/manager/composables/useManagerState.ts`, `useManagerQueue.ts`
- Dev proxy routes (from `vite.config.mts` `server.proxy`): `/api`, `/ws`, `/internal`, `/workflow_templates`, `/extensions`, `/docs`, `/templates`
- Cloud proxy `selfHandleResponse` handling for `/api/view` and `/api/viewvideo` — follows GCS (`storage.googleapis.com`) 302 redirects server-side to avoid CORS
- API response schemas: `src/schemas/apiSchema.ts` (Zod) and `src/schemas/nodeDefSchema.ts`

**Comfy Registry API:**

- Base URL: `https://api.comfy.org` (prod) or `https://stagingapi.comfy.org` (staging)
- Resolver: `src/config/comfyApi.ts` `getComfyApiBaseUrl()` (cloud uses remote config `comfy_api_base_url`)
- Client: `src/services/comfyRegistryService.ts` (axios with typed operations from `src/types/comfyRegistryTypes.ts` / `@comfyorg/registry-types`)
- Purpose: custom node package registry, node organization, discovery
- Related gateway/providers: `src/services/gateway/registrySearchGateway.ts`, `src/services/providers/registrySearchProvider.ts`

**Comfy Platform API:**

- Base URL: `https://platform.comfy.org` (prod) or `https://stagingplatform.comfy.org` (staging)
- Resolver: `src/config/comfyApi.ts` `getComfyPlatformBaseUrl()` (cloud override `comfy_platform_base_url`)
- Workspace/billing/members API: `src/platform/workspace/api/workspaceApi.ts`
- Jobs API: `src/platform/remote/comfyui/jobs/fetchJobs.ts`

**Comfy Cloud Ingest API:**

- OpenAPI-generated client types and Zod schemas in `packages/ingest-types/src/` (regenerated via `pnpm generate` using `@hey-api/openapi-ts`, config `packages/ingest-types/openapi-ts.config.ts`)
- Webhooks and `/api/internal/*` endpoints explicitly excluded from type generation

**Custom Node Manager API:**

- Generated types: `src/workbench/extensions/manager/types/generatedManagerTypes.ts`
- Service: `src/workbench/extensions/manager/services/comfyManagerService.ts`
- Composables: `src/workbench/extensions/manager/composables/useRegistrySearch.ts`, `useManagerState.ts`, `useManagerQueue.ts`, `useManagerStatePersistence.ts`

**Algolia Search:**

- SDK: `algoliasearch` (catalog)
- App ID / API key exposed at build time via `__ALGOLIA_APP_ID__` / `__ALGOLIA_API_KEY__` (`vite.config.mts`)
- Client: `src/services/providers/algoliaSearchProvider.ts`
- Types: `src/types/algoliasearch-lite.d.ts`, `src/types/algoliaTypes.ts`, `src/types/searchServiceTypes.ts`
- Purpose: custom-node package search in manager

**Google Cloud Storage:**

- Media delivery via signed GCS URLs; vite dev proxy intercepts 302 redirects with `Via: google` header in `vite.config.mts` `handleGcsRedirect` for `/api/view*` routes (cloud only)

## Data Storage

**Databases:**

- Firebase (Firestore + Realtime DB references in config): `src/config/firebase.ts` defines `DEV_CONFIG` (project `dreamboothy-dev`) and `PROD_CONFIG` (project `dreamboothy`); production config can be overridden at runtime via remote config `firebase_config`
- Client: `firebase ^11.6.0` initialized in `src/main.ts` via `initializeApp(getFirebaseConfig())`
- Reactivity wrapper: `vuefire ^3.2.1` (`VueFire`, `VueFireAuth` modules registered in `src/main.ts`)

**File Storage:**

- GCS (Google Cloud Storage) via ComfyUI backend-issued signed URLs (cloud mode)
- Local filesystem through ComfyUI Python server `/api/view` and `/api/viewvideo` routes (localhost mode)
- Desktop: local filesystem via Electron bridge (`window.electronAPI`)

**Caching:**

- In-memory service caches: `src/services/mediaCacheService.ts` (blob cache with cleanup), `src/services/jobOutputCache.ts`, `src/services/subgraphPseudoWidgetCache.ts`
- Browser Cache API usage inside media caches
- `@alloc/quick-lru` for LRU primitives

## Authentication & Identity

**Auth Providers:**

- Firebase Auth — primary identity for cloud distribution
  - Config: `src/config/firebase.ts` + runtime override via `remoteConfig.value.firebase_config`
  - Store: `src/stores/authStore.ts` uses `useFirebaseAuth()` from `vuefire`; types from `firebase/auth` (`Auth`, `User`, `UserCredential`)
  - Composables: `src/composables/auth/useAuthActions.ts`, `src/composables/auth/useCurrentUser.ts`
  - Views: `src/platform/cloud/onboarding/CloudLoginView.vue`, `CloudSignupView.vue`, `CloudForgotPasswordView.vue`, `CloudAuthTimeoutView.vue`, `UserCheckView.vue`
- Session cookies: `src/platform/auth/session/useSessionCookie.ts`
- Auth token priority / API-key auth: `src/stores/apiKeyAuthStore.ts`, `src/stores/__tests__/authTokenPriority.test.ts`
- Workspace membership: `src/platform/workspace/stores/workspaceAuthStore.ts`
- Auth header types: `src/types/authTypes.ts`

**Multi-tenant modes:**

- Cloud `/api/users` request intercepted in dev to simulate single-user mode (`vite.config.mts` proxy `bypass`)

## Monitoring & Observability

**Error Tracking:**

- Sentry (`@sentry/vue ^10.32.1`) — initialized in `src/main.ts`
  - DSN resolved from remote config `sentry_dsn` (cloud) or build-time `__SENTRY_DSN__`
  - Enabled via `__SENTRY_ENABLED__` compile-time flag (disabled in dev or when `SENTRY_DSN` missing)
  - Cloud integrations include `browserApiErrorsIntegration({ eventTarget: false })`
  - Traces sample rate: `1.0` cloud, `0` otherwise
  - Sourcemap upload via `@sentry/vite-plugin` (cloud + non-dev); dual-upload to staging + prod when `SENTRY_PROJECT_PROD` is set

**Telemetry Providers:**

- `src/platform/telemetry/TelemetryRegistry.ts` + `src/platform/telemetry/initTelemetry.ts`
- Provider implementations under `src/platform/telemetry/providers/cloud/`:
  - `PostHogTelemetryProvider.ts` — `posthog-js`; token + host from remote config `posthog_project_token`, `posthog_api_host`, `posthog_config`
  - `MixpanelTelemetryProvider.ts` — `mixpanel-browser`; token from remote config `mixpanel_token`
  - `ClickHouseTelemetryProvider.ts` — custom HTTP ingest
  - `GtmTelemetryProvider.ts` — Google Tag Manager; container id from remote config `gtm_container_id`
  - `ImpactTelemetryProvider.ts` — attribution/conversion tracking
- Telemetry orchestration: `src/platform/telemetry/index.ts` (`useTelemetry`), `topupTracker.ts`, event types in `src/platform/telemetry/types.ts`
- Disabled events controlled by remote config `telemetry_disabled_events`

**Logs:**

- `loglevel ^1.9.2` for app-level logging
- Console methods tree-shaken in production via `rolldownOptions.treeshake.manualPureFunctions`
- In-app log panel backed by `@xterm/xterm` in the manager/logs views

## CI/CD & Deployment

**Hosting:**

- Cloud frontend: `https://cloud.comfy.org` (prod), `https://testcloud.comfy.org`, `https://stagingcloud.comfy.org`, `https://pr-<n>.testenvs.comfy.org` (per-PR preview)
- Website: deployed via Vercel (`apps/website/vercel.json`)
- Desktop: packaged with the Electron `@comfyorg/desktop` bundle (built via `pnpm build:desktop`)

**CI Pipeline:**

- GitHub-hosted; CodeOwners at `CODEOWNERS`, CodeRabbit config at `.coderabbit.yaml`, pinned actions via `.pinact.yaml`
- Nx task orchestration with caching for `build`, `lint`, `typecheck`, `test`, `e2e`
- Pre-commit gate: Husky + `lint-staged.config.ts`
- Quality gates per `AGENTS.md`: `pnpm lint`, `pnpm typecheck`, `pnpm knip`, relevant tests

## Environment Configuration

**Required env vars (see `.env_example`):**

- `DEV_SERVER_COMFYUI_URL` — proxy target for ComfyUI backend (drives cloud auto-detection)
- `PLAYWRIGHT_TEST_URL`, `TEST_COMFYUI_DIR` — E2E test configuration
- `ALGOLIA_APP_ID`, `ALGOLIA_API_KEY` — Algolia search credentials (baked into build via `define`)
- `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_PROJECT_PROD` — Sentry error tracking + sourcemap uploads
- `VITE_REMOTE_DEV`, `ENABLE_MINIFY`, `DISABLE_VUE_PLUGINS`, `DISABLE_TEMPLATES_PROXY`, `VITE_POSTHOG_DEBUG` — dev-server toggles
- `DISTRIBUTION` (`desktop` | `localhost` | `cloud`), `USE_PROD_CONFIG`, `IS_NIGHTLY`, `FRONTEND_COMMIT_HASH`, `GENERATE_SOURCEMAP`, `ANALYZE_BUNDLE` — build-mode selectors

**Remote Configuration (cloud):**

- Loaded at startup before telemetry init in `src/main.ts` via `src/platform/remoteConfig/refreshRemoteConfig.ts`
- Exposed as `remoteConfig` ref in `src/platform/remoteConfig/remoteConfig.ts`
- Schema: `src/platform/remoteConfig/types.ts` (`RemoteConfig`) — fields include `gtm_container_id`, `ga_measurement_id`, `mixpanel_token`, `posthog_project_token`, `posthog_api_host`, `posthog_config`, `subscription_required`, `server_health_alert`, `max_upload_size`, `comfy_api_base_url`, `comfy_platform_base_url`, `firebase_config`, `telemetry_disabled_events`, feature-flag booleans (`model_upload_button_enabled`, `asset_rename_enabled`, `private_models_enabled`, `onboarding_survey_enabled`, `linear_toggle_enabled`, `team_workspaces_enabled`, `user_secrets_enabled`, `node_library_essentials_enabled`, `workflow_sharing_enabled`, `comfyhub_upload_enabled`, `comfyhub_profile_gate_enabled`, `new_free_tier_subscriptions`), `free_tier_credits`, `sentry_dsn`
- Defaults (client fallbacks): `src/config/clientFeatureFlags.json`; dev override via `src/utils/devFeatureFlagOverride.ts`

**Secrets location:**

- Local `.env` (git-ignored; see `.env_example`)
- CI secrets: GitHub Actions environment (`SENTRY_AUTH_TOKEN`, publishing creds)
- Runtime secrets delivered via server-issued remote config (e.g., Firebase credentials for cloud), never committed

## Webhooks & Callbacks

**Incoming:**

- None handled by the frontend. Backend-only webhooks explicitly excluded from ingest type generation in `packages/ingest-types/openapi-ts.config.ts`

**Outgoing:**

- None; all outbound traffic uses standard REST/WebSocket calls via axios or `src/scripts/api.ts`

## Desktop / Electron Bridges

**Electron API surface:**

- Types: `@comfyorg/comfyui-electron-types` (catalog dep, excluded from `optimizeDeps`)
- Access helper: `src/utils/envUtil.ts` `electronAPI()` returns `(window as ElectronWindow).electronAPI as ElectronAPI`
- Consumers:
  - `src/stores/electronDownloadStore.ts` — model/asset downloads
  - `src/stores/aboutPanelStore.ts` — version + update info
  - `src/platform/settings/components/ServerConfigPanel.vue` — server configuration UI
  - `src/platform/cloud/notification/components/DesktopCloudNotificationController.vue` — cross-distribution notifications
  - `src/platform/assets/components/FolderContextMenu.vue`, `MediaAssetContextMenu.vue` — native context menus
  - `src/utils/directoryPickerUtil.ts` — native folder picker
  - `src/utils/electronMirrorCheck.ts` — mirror validation
  - `src/components/sidebar/tabs/AssetsSidebarTab.vue`, `src/views/GraphView.vue`, `src/views/templates/BaseViewTemplate.vue` — UI surfaces
- Desktop detection: `src/platform/distribution/types.ts` (`isDesktop = DISTRIBUTION === 'desktop'`); `isNativeWindow()` in `envUtil.ts`
- Native system menu hook: `showNativeSystemMenu()` via `electronAPI()?.showContextMenu()`

## Subscription / Billing

- Subscription state: `src/platform/cloud/subscription/` (components, composables, constants, utils)
- Checkout flow: `src/platform/cloud/subscription/utils/subscriptionCheckoutUtil.ts` (+ test) — redirects to platform-hosted checkout
- Workspace members/billing UI: `src/platform/workspace/components/dialogs/settings/MembersPanelContent.vue`, `MemberListItem.vue`, `SubscriptionPanelContentWorkspace.vue`
- Pricing config: `src/config/subscriptionPricesConfig.ts`
- Topup telemetry: `src/platform/telemetry/topupTracker.ts`

## Third-party MCP / Dev Integrations

- `@storybook/addon-mcp` (catalog) — Model Context Protocol integration for Storybook dev
- Figma MCP (agent-side) — referenced in `AGENTS.md` under Design Standards; consumed via MCP tools, not via runtime code
- Context7 MCP (agent-side) — documentation fetcher; no runtime code dependency

## Internationalization

- `vue-i18n ^9.14.5` — composition API usage
- Translation sources: `src/locales/<lang>/main.json` (en, zh, zh-TW, tr, ru, pt-BR, ko, ja, fr, fa, and others)
- Lobe i18n CLI: `@lobehub/i18n-cli` — `pnpm locale` command
- Collect script: `pnpm collect-i18n` runs Playwright with `playwright.i18n.config.ts`

## Rich Media

- Tiptap editor stack for markdown widgets (`@tiptap/core`, `@tiptap/starter-kit`, table + link extensions, `tiptap-markdown`) — `vendor-tiptap` chunk
- Three.js + `@sparkjsdev/spark` + `wwobjloader2` for 3D previews — `vendor-three` chunk; service `src/services/load3dService.ts`
- Xterm terminal for logs panel — `vendor-xterm` chunk
- Chart.js for stats/monitoring — `vendor-chart` chunk
- Audio: `extendable-media-recorder` + WAV encoder in `src/services/audioService.ts`

## CRDT / Collaboration

- `yjs ^13.6.27` for layout state CRDT (`vendor-yjs` chunk)
- Consumers: `src/renderer/core/layout/store/layoutStore.ts`, `src/renderer/core/layout/utils/mappers.ts`

---

_Integration audit: 2026-04-20_
