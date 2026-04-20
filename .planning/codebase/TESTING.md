# Testing Patterns

**Analysis Date:** 2026-04-20

Authoritative sources:

- `docs/testing/README.md`, `unit-testing.md`, `component-testing.md`, `store-testing.md`, `vitest-patterns.md`
- `docs/guidance/vitest.md` (auto-loaded for `*.test.ts`)
- `docs/guidance/playwright.md` (auto-loaded for `*.spec.ts`)
- `browser_tests/README.md`, `browser_tests/AGENTS.md`, `browser_tests/FLAKE_PREVENTION_RULES.md`
- `vite.config.mts` (Vitest `test` block)
- `playwright.config.ts`
- `vitest.setup.ts`

## Test Frameworks

| Layer             | Tool                                                             | Runner                                   |
| ----------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| Unit / utility    | Vitest                                                           | `happy-dom` environment                  |
| Pinia stores      | Vitest + `@pinia/testing`                                        | happy-dom                                |
| Vue components    | Vitest + `@testing-library/vue` (preferred) or `@vue/test-utils` | happy-dom                                |
| User events       | `@testing-library/user-event`                                    |                                          |
| E2E / browser     | Playwright                                                       | Chromium + mobile-chrome + 2x/0.5x scale |
| Component stories | Storybook 8                                                      |                                          |

Globals are enabled (`globals: true`) — `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach` are available without imports.

## Test File Locations & Naming

| Type                     | Location pattern                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Unit / component / store | co-located `sourceFile.test.ts` next to `sourceFile.ts`/`.vue`                                                      |
| Vitest include globs     | `src/**/*.{test,spec}.{ts,mts,cts,js,mjs,cjs,tsx,jsx}`, `packages/**/*.{test,spec}.*`, `scripts/**/*.{test,spec}.*` |
| E2E (Playwright)         | `browser_tests/tests/**/*.spec.ts` (only)                                                                           |
| Litegraph tests          | `src/lib/litegraph/test/`                                                                                           |
| Storybook stories        | `*.stories.ts` alongside the component                                                                              |

ESLint restrictions:

- `.test.ts` files are **forbidden** under `browser_tests/tests/` — use `.spec.ts` there.
- `.spec.ts` files are **only** allowed under `browser_tests/tests/`.
- `browser_tests/fixtures/data/**` cannot import from `@playwright/*` — static data only.

## Run Commands

```bash
# Vitest (unit/component/store)
pnpm test:unit                                 # Run all unit tests
pnpm test:unit -- src/path/to/file.test.ts     # Run specific file
pnpm test:unit -- --watch                      # Watch mode

# Playwright (E2E)
pnpm test:browser:local                        # All E2E tests
pnpm test:browser:local --ui                   # Interactive UI mode (preferred for dev)
pnpm test:browser:local widget.spec.ts         # Specific spec

# Typecheck for browser tests
pnpm typecheck:browser

# Lint a specific test
pnpm exec eslint browser_tests/tests/foo.spec.ts
pnpm exec oxlint browser_tests/tests/foo.spec.ts
```

## Vitest Configuration (`vite.config.mts` `test` block)

```
environment: 'happy-dom'
setupFiles: ['./vitest.setup.ts']
retry: process.env.CI ? 2 : 0
silent: 'passed-only'
coverage.provider: 'v8'
coverage.include: ['src/**/*.{ts,vue}']
coverage.exclude: tests, stories, d.ts, locales, lib/litegraph, assets
```

`vitest.setup.ts` performs:

- `@testing-library/jest-dom/vitest` augment for DOM matchers.
- Mocks `@sparkjsdev/spark` (WASM incompatible with Node).
- Seeds `globalThis.__COMFYUI_FRONTEND_VERSION__`, `__SENTRY_ENABLED__`, `__DISTRIBUTION__`, etc.
- Seeds `window.__CONFIG__` with test Firebase + mixpanel values.
- Stubs `globalThis.Worker` (for `extendable-media-recorder`).

## General Testing Rules (from `AGENTS.md` + `docs/guidance/vitest.md`)

1. Do not write **change-detector tests** (tests that just assert defaults).
2. Do not write tests dependent on non-behavioral features (Tailwind classes, styles).
3. Be parsimonious — avoid redundant tests.
4. **Don't mock what you don't own** — https://hynek.me/articles/what-to-mock-in-5-mins/.
5. Do not write tests that only test the mocks — real code must be exercised.
6. Never delete or disable tests to make them pass.
7. Write tests for all changes, especially bug fixes (regression protection).
8. Aim for behavioral coverage of critical and new features.

## Vitest — Unit & Composable Patterns

### Basic Composable Test

```typescript
// Example shape: src/composables/useServerLogs.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useServerLogs } from '@/composables/useServerLogs'

vi.mock('@/scripts/api', () => ({
  api: { subscribeLogs: vi.fn() }
}))

describe('useServerLogs', () => {
  it('should update reactive logs when receiving events', async () => {
    const { logs, startListening } = useServerLogs()
    await startListening()
    // ... trigger event
    await nextTick() // wait for Vue reactivity
    expect(logs.value).toEqual(['Log message'])
  })
})
```

### Fake Timers (debounce/throttle/polling)

```typescript
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('polls after delay', async () => {
  const store = useMyStore()
  store.startPolling()
  await vi.advanceTimersByTimeAsync(30000)
  expect(mockService.fetch).toHaveBeenCalled()
})
```

### Mocking `vi.doMock` — FORBIDDEN

ESLint rule (`no-restricted-properties`) blocks `vi.doMock`. Use `vi.mock()` with `vi.hoisted()` when per-test mock state is needed. See `docs/testing/vitest-patterns.md`.

## Mocking Patterns

### Module-level mocks

```typescript
vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn(),
    subscribeLogs: vi.fn(),
    getUserData: vi.fn(),
    listUserDataFullInfo: vi.fn(),
    apiURL: vi.fn()
  }
}))

vi.mock('@/scripts/app', () => ({
  app: { canvas: null }
}))
```

### Mocking Composables with Reactive State (singleton pattern)

Rules:

1. Define `vi.fn()` and `ref()` inside the `vi.mock()` factory — not in `beforeEach`.
2. Factory runs once — all calls return the same mock object (singleton).
3. Access mocks per-test by calling the composable.
4. Wrap in `vi.mocked(service.method).mockResolvedValue(...)` for type safety.
5. `vi.resetAllMocks()` in `beforeEach` resets call counts (ref values may need manual reset).

```typescript
// From src/platform/updates/common/releaseStore.test.ts
import { ref } from 'vue'

vi.mock('@/path/to/composable', () => {
  const doSomething = vi.fn()
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  return {
    useMyComposable: () => ({ doSomething, isLoading, error })
  }
})

describe('MyStore', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should handle errors from composable', async () => {
    const service = useMyComposable()
    vi.mocked(service.doSomething).mockResolvedValue(null)
    service.error.value = 'Something went wrong'
    await store.initialize()
    expect(store.error).toBe('Something went wrong')
  })
})
```

### Anti-patterns (do not do)

```typescript
// ❌ Shared mutable variable + beforeEach reassignment
let mockService: { doSomething: Mock }
beforeEach(() => {
  mockService = { doSomething: vi.fn() }
  vi.mocked(useMyComposable).mockReturnValue(mockService)
})

// ❌ Auto-mock then override — reactive refs won't work
vi.mock('@/path/to/composable')
vi.mocked(useMyComposable).mockReturnValue({ isLoading: ref(false) })
```

### Mocking Lodash / Debounce

```typescript
vi.mock('es-toolkit/compat', () => ({
  debounce: vi.fn((fn) => {
    const mockDebounced = (...args: any[]) => fn(...args)
    mockDebounced.cancel = vi.fn()
    return mockDebounced
  })
}))
```

### Extracting Registered Event Handlers

```typescript
function getEventHandler() {
  const call = vi
    .mocked(api.addEventListener)
    .mock.calls.find(([event]) => event === 'my_event')
  return call?.[1] as (e: CustomEvent<MyEventType>) => void
}
```

## Pinia Store Testing

Always use `createTestingPinia` from `@pinia/testing` (not `createPinia`):

```typescript
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  vi.useFakeTimers()
  vi.resetAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})
```

`stubActions: false` runs real action bodies — required when testing actual store behavior.

## Component Testing

### Preferred: `@testing-library/vue` + `@testing-library/user-event`

User-centric behavioral tests. Enforced rules in `eslint.config.ts` for `**/*.test.ts`:

- `testing-library/prefer-screen-queries: error` — use `screen.getByRole(...)`, not `wrapper.find(...)`.
- `testing-library/no-container: error`.
- `testing-library/no-node-access: error`.
- `testing-library/no-wait-for-multiple-assertions: error`.
- `testing-library/prefer-find-by: error`.
- `testing-library/prefer-presence-queries: error`.
- `testing-library/prefer-user-event: error` — use `userEvent` not `fireEvent`.
- `testing-library/no-debugging-utils: error`.

### Accepted: `@vue/test-utils`

Use `mount()` when you need `findComponent`, `emitted()`, or direct wrapper access:

```typescript
import { mount } from '@vue/test-utils'
import SidebarIcon from './SidebarIcon.vue'

it('renders label', () => {
  const wrapper = mount(SidebarIcon, {
    props: { icon: 'pi pi-cog', selected: false }
  })
  expect(wrapper.find('.p-button-label').exists()).toBe(true)
})
```

### PrimeVue Setup

```typescript
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'

const wrapper = mount(Component, {
  global: {
    plugins: [PrimeVue],
    components: { SelectButton, ColorPicker },
    directives: { tooltip: Tooltip }
  }
})
```

### i18n in Component Tests

Use real `createI18n` with empty messages rather than mocking `vue-i18n`. See `SearchBox.test.ts`.

### Reactivity Helper

```typescript
const waitForPromises = async () => {
  await new Promise((resolve) => setTimeout(resolve, 16))
  await nextTick()
}
```

Always `await nextTick()` after state changes; components with async `onMounted` need both microtask flush and `nextTick`.

## Assertion Style

```typescript
// ✅ Good
expect(store.items).toHaveLength(1)
expect(store.completedItems[0]).toMatchObject({
  id: 'task-123',
  status: 'done'
})

// ❌ Avoid
expect(store.items.length).toBe(1)
```

## Playwright / E2E Testing

### Configuration (`playwright.config.ts`)

- `testDir: './browser_tests'`.
- `fullyParallel: true`; `forbidOnly: !!process.env.CI`.
- Reporter: `html`.
- `globalSetup: './browser_tests/globalSetup.ts'`, `globalTeardown: './browser_tests/globalTeardown.ts'`.
- Retries: 3 on CI, 0 locally. Local overrides available via `PLAYWRIGHT_LOCAL=1`.

### Test Projects / Tags

| Project         | Viewport / DPR            | Grep                               |
| --------------- | ------------------------- | ---------------------------------- | ----- | ------ | ------- |
| `chromium`      | Desktop Chrome, default   | excludes `@mobile                  | @perf | @audit | @cloud` |
| `performance`   | Desktop Chrome            | only `@perf` (60s timeout, serial) |
| `audit`         | Desktop Chrome            | only `@audit` (120s timeout)       |
| `chromium-2x`   | `deviceScaleFactor: 2`    | only `@2x`                         |
| `chromium-0.5x` | `deviceScaleFactor: 0.5`  | only `@0.5x`                       |
| `cloud`         | Desktop Chrome            | only `@cloud`, excludes `@oss`     |
| `mobile-chrome` | Pixel 5, `hasTouch: true` | only `@mobile`                     |

Tag tests appropriately (e.g. `test('does X', { tag: '@mobile' }, ...)`).

### Prerequisites

```bash
# 1. ComfyUI backend with --multi-user
python main.py --multi-user

# 2. Install Chromium driver
pnpm exec playwright install chromium --with-deps

# 3. Copy devtools into custom_nodes (one-time)
cp -r tools/devtools/* /path/to/ComfyUI/custom_nodes/ComfyUI_devtools/

# 4. .env — DISABLE_VUE_PLUGINS=true is recommended for debugging
```

### Test Structure

```typescript
// ALWAYS use this import (not raw @playwright/test)
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('single_ksampler')
  })

  test('does X', async ({ comfyPage }) => {
    await comfyPage.menu.topbar.click()
    await expect(comfyPage.menu.nodeLibraryTab.root).toBeVisible()
  })
})
```

### Playwright Rules (from `docs/guidance/playwright.md`)

- **NEVER** `waitForTimeout` — use `Locator` actions and retrying assertions.
- Prefer specific selectors: role, label, test-id.
- Assertions around preconditions should include messages:
  ```typescript
  expect(
    node.widgets,
    'Widget count changed — update test fixture'
  ).toHaveLength(4)
  ```
- Use `expect.soft()` for multiple invariants without aborting.
- **Arrange/Act/Assert:** All setup in `test.beforeEach()` or fixtures. Inside `test()`, only act and assert. Never call `clearAllMocks` mid-test.

### Polling Assertions

Prefer `expect.poll()` over `expect(async () => { ... }).toPass()` for single-call+single-assertion blocks:

```typescript
// ✅
await expect
  .poll(() => comfyPage.nodeOps.getGraphNodesCount(), { timeout: 250 })
  .toBe(0)

// ❌ Avoid
await expect(async () => {
  expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
}).toPass({ timeout: 250 })
```

Reserve `toPass()` for multiple assertions or complex async logic.

### Custom Fixtures (not ComfyPage properties)

New domain helpers register as Playwright fixtures via `base.extend()` — not as properties on `ComfyPage`. Compose with `mergeTests`:

```typescript
// browser_tests/fixtures/assetFixture.ts
import { test as base } from '@playwright/test'

export const test = base.extend<{ assetHelper: AssetHelper }>({
  assetHelper: async ({ page }, use) => {
    const helper = new AssetHelper(page)
    await helper.setup()
    await use(helper)
    await helper.cleanup()
  }
})
```

### Custom Assertions

Put assertion methods directly on the page object (`await node.expectPinned()`). Do **not** extend `comfyExpect`.

### Type Assertions in E2E

Non-null assertions on window globals are allowed:

```typescript
window.app!.graph!.nodes
window.LiteGraph!.registered_node_types
```

But `as any` is still forbidden. E2E has stricter `.oxlintrc.json` overrides — `typescript/no-explicit-any: error`, plus re-enabled `no-async-promise-executor`, `no-control-regex`, `no-useless-rename`, `no-unused-private-class-members`, `unicorn/no-empty-file`.

### `page.evaluate` — Use Sparingly

✅ Acceptable: reading internal graph/store state with no UI representation, registering test extensions.

❌ Avoid: performing actions with a UI equivalent (click/fill/type), dispatching synthetic DOM events, calling store actions that represent user interactions.

### Typed API Mocks — REQUIRED

Never use untyped inline JSON in `route.fulfill()`. Use existing schemas/generated types:

| Endpoint category                                   | Type source                                                                                           |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Cloud-only (hub, billing, workflows)                | `@comfyorg/ingest-types` (`packages/ingest-types`)                                                    |
| Registry (releases, nodes, publishers)              | `@comfyorg/registry-types` (`packages/registry-types`)                                                |
| Manager (queue tasks, packages)                     | `src/workbench/extensions/manager/types/generatedManagerTypes.ts`                                     |
| Python backend (queue, history, settings, features) | `src/schemas/apiSchema.ts`                                                                            |
| Node definitions                                    | `src/schemas/nodeDefSchema.ts`, `src/schemas/nodeDef/nodeDefSchemaV2.ts`                              |
| Workflows                                           | `src/platform/workflow/validation/schemas/workflowSchema.ts`                                          |
| Jobs                                                | `src/platform/remote/comfyui/jobs/jobTypes.ts` (`zJobDetail`, `zJobsListResponse`, `zRawJobListItem`) |
| Templates                                           | `src/platform/workflow/templates/types/template.ts`                                                   |
| Asset metadata                                      | `src/types/metadataTypes.ts`                                                                          |

```typescript
// ✅
import type { ReleaseNote } from '@/platform/updates/common/releaseService'
const mockRelease: ReleaseNote = { id: 1, project: 'comfyui', ... }
body: JSON.stringify([mockRelease])

// ❌ Untyped inline JSON — silently drifts from real schema
body: JSON.stringify([{ id: 1, project: 'comfyui' }])
```

### Release API Mocking by Default

All tests mock `api.comfy.org/releases` to prevent popup interference. Disable with:

```typescript
await comfyPage.setup({ mockReleases: false })
```

### Directory Architecture (`browser_tests/AGENTS.md`)

```
browser_tests/
├── assets/               Test data (JSON workflows, images)
├── fixtures/
│   ├── ComfyPage.ts          Main fixture
│   ├── ComfyMouse.ts         Mouse helper
│   ├── VueNodeHelpers.ts     Vue Nodes 2.0 helpers
│   ├── selectors.ts          Centralized TestIds
│   ├── data/                 Static mock data ONLY (no Playwright imports)
│   ├── components/           Page object components
│   ├── helpers/              Focused helper classes (CanvasHelper, WorkflowHelper, ...)
│   └── utils/                Pure utils (no Page dep)
├── helpers/              Test-specific utilities
└── tests/                Spec files (*.spec.ts only)
```

- `fixtures/data/` — **no executable code, no Playwright imports** (ESLint-enforced).
- `fixtures/components/` — locators + interactions.
- `fixtures/helpers/` — domain actions coordinating multiple page objects.
- `fixtures/utils/` — stateless pure utilities.

### Flake-Prevention Gotchas (`browser_tests/AGENTS.md`)

| Symptom                                           | Cause                                      | Fix                                                 |
| ------------------------------------------------- | ------------------------------------------ | --------------------------------------------------- |
| `subtree intercepts pointer events` on DOM widget | Canvas z-999 overlay intercepts `.click()` | `locator.dispatchEvent('contextmenu', {...})`       |
| Context menu empty / wrong items                  | Node not selected                          | `vueNodes.selectNode()` or `nodeRef.click('title')` |
| `navigateIntoSubgraph` timeout                    | Node too small in asset JSON               | Use node size `[400, 200]` minimum                  |

### Disambiguating Duplicate Titles

```typescript
// strict-mode violation with bare locator — use .nth(n)
vueNodes.getNodeByTitle('Load Image').nth(0)
```

### Test Data / Fixtures

- Test workflows: `browser_tests/assets/`.
- Prefer realistic, minimal ComfyUI workflows — include only nodes the test needs.
- Common workflow load: `await comfyPage.loadWorkflow('single_ksampler')`.

### Screenshots

- Reference screenshots are **Linux-only** (CI runner). Do not commit local baselines.
- Generate via `pnpm test:browser:local --update-snapshots` for local comparison.
- New baselines for `Comfy-Org/ComfyUI_frontend` branches: add PR label `New Browser Test Expectation` — CI commits baselines.
- Fork PRs require maintainer commit.

### Functional > Visual

```typescript
// ✅ Preferred
expect(await node.isPinned()).toBe(true)
expect(await node.getProperty('title')).toBe('Expected Title')

// Use only when visual verification is required
await expect(comfyPage.canvas).toHaveScreenshot('state.png')
```

## Storybook Testing (`docs/guidance/storybook.md`)

Place `*.stories.ts` alongside components. Required story variants when applicable: **Default**, **WithData**, **Loading**, **Error**, **Empty**.

```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import ComponentName from './ComponentName.vue'

const meta: Meta<typeof ComponentName> = {
  title: 'Category/ComponentName',
  component: ComponentName,
  parameters: { layout: 'centered' }
}
export default meta

type Story = StoryObj<typeof meta>
export const Default: Story = {
  args: {
    /* ... */
  }
}
```

## Coverage

- Provider: v8.
- Reporters: text, json, html, lcov.
- Included: `src/**/*.{ts,vue}`.
- Excluded: tests, stories, `.d.ts`, `src/locales/**`, `src/lib/litegraph/**`, `src/assets/**`.
- No hard coverage threshold enforced — aim for behavioral coverage of critical paths (AGENTS.md).

## Quality Gates (PR-Blocking)

- `pnpm lint`
- `pnpm typecheck`
- `pnpm knip`
- Relevant tests (unit + E2E where touched)
- Never use `--no-verify`.

---

_Testing analysis: 2026-04-20_
