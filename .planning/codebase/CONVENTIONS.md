# Coding Conventions

**Analysis Date:** 2026-04-20

Authoritative sources (consult directly when in doubt):

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

Formatter-ignored paths: `packages/registry-types/src/comfyRegistryTypes.ts`, `public/materialdesignicons.min.css`, `src/types/generatedManagerTypes.ts`, `**/__fixtures__/**/*.json`.

Run `pnpm format` before committing; `pnpm format:check` for CI.

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
  - ✅ `import type { Foo } from './foo'` + `import { bar } from './foo'`
  - ❌ `import { bar, type Foo } from './foo'`
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

Do not import these — PrimeVue 4 renamed them:

- `primevue/calendar` → use `primevue/datepicker` (`DatePicker`)
- `primevue/dropdown` → use `primevue/select` (`Select`)
- `primevue/inputswitch` → use `primevue/toggleswitch` (`ToggleSwitch`)
- `primevue/overlaypanel` → use `primevue/popover` (`Popover`)
- `primevue/sidebar` → use `primevue/drawer` (`Drawer`)

Also forbidden:

- `useVirtualList` from `@vueuse/core` — requires uniform item heights. Use TanStack Virtual (via Reka UI virtualizer or `@tanstack/vue-virtual`).
- In Vue SFCs, do not import `t`, `d`, `te` from `@/i18n` — use `const { t } = useI18n()`.
- In non-composable `.ts` files (not matching `use[A-Z]*.ts`), do not import `useI18n` from `vue-i18n` — use `import { t } from '@/i18n'`.
- In `browser_tests/tests/**/*.spec.ts`, do not import `test` from `@playwright/test` — use `comfyPageFixture as test` from `@e2e/fixtures/ComfyPage`.

### Layer Architecture Boundaries (`eslint.config.ts`)

Enforced with `import-x/no-restricted-paths`:

- `src/base/**` may not import from `src/platform/**`, `src/workbench/**`, `src/renderer/**`.
- `src/platform/**` may not import from `src/workbench/**`, `src/renderer/**`.
- `src/workbench/**` may not import from `src/renderer/**`.
- Layer order (bottom → top): `base → platform → workbench → renderer`.

## TypeScript Rules (see `docs/guidance/typescript.md`)

- **NEVER use `any`** (`typescript/no-explicit-any: error`).
- **NEVER use `as any`** — fix the underlying type issue.
- Avoid `@ts-expect-error`.
- Type assertion hierarchy (most to least preferred):
  1. No assertion (properly typed)
  2. Type narrowing: `if ('prop' in obj)` / type guards
  3. Specific assertion `as SpecificType`
  4. `unknown` with narrowing
  5. ❌ `as any` — forbidden
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

From `docs/guidance/vue-components.md` and `AGENTS.md`:

- Use `<script setup lang="ts">`.
- Use Vue 3.5 TypeScript destructured props with defaults. **Do not use** `withDefaults` or runtime props declaration.

  ```typescript
  const { nodes, showTotal = true } = defineProps<{
    nodes: ApiNodeCost[]
    showTotal?: boolean
  }>()
  ```

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

Enforced by `eslint-plugin-better-tailwindcss`:

- `enforce-consistent-class-order: error`
- `enforce-canonical-classes: error`
- `no-deprecated-classes: error`
- Entry point: `packages/design-system/src/css/style.css`.

### Styling Rules

- **NEVER use the `dark:` variant.** Use semantic tokens from `packages/design-system/src/css/style.css` (e.g. `bg-node-component-surface`). Enforced via `vue/no-restricted-class`.
- **NEVER use `:class="[]"` to merge classes.** Always use `cn()` from `@/utils/tailwindUtil`:

  ```vue
  <div
    :class="cn('text-node-component-header-icon', hasError && 'text-danger')"
  />
  ```

  Use `cn()` inline when feasible — don't create a `computed` just to hold merged classes.

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
  ```typescript
  const response = await api.get(api.apiURL('/prompt'))
  const template = await fetch(api.fileURL('/templates/default.json'))
  ```
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

1. Make code changes.
2. Run relevant tests (prefer single-test runs for speed).
3. Run `pnpm typecheck`, `pnpm lint`, `pnpm format`.
4. Check if README updates are needed.
5. Suggest docs.comfy.org updates for user-facing changes.

## Temporary Files (Agent Rules)

- `/temp/plans/` — planning documents
- `/temp/scripts/` — scripts used
- `/temp/summaries/` — work summaries
- `/temp/in_progress/` — TODOs and status updates

---

_Convention analysis: 2026-04-20_
