---
phase: 02-asset-pipeline
plan: 10
type: execute
wave: 4
depends_on: ['02-07']
files_modified:
  - src/platform/moshpit/components/MoshpitSettingsPanel.vue
  - src/platform/moshpit/components/MoshpitSettingsPanel.test.ts
autonomous: true
requirements: [ASSET-05, ASSET-06]
tags: [ui, settings-panel, excluded-count, wave-4, a11y]
must_haves:
  truths:
    - '`MoshpitSettingsPanel.vue` renders the excluded-count row per 02-UI-SPEC §Surface 2 when `moshpitMetadataStore.excludedCount > 0`'
    - "Row contains: span with `t('moshpit.assets.excludedCount', count)` (Vue i18n plural) + `lucide--info` icon with `v-tooltip.top` trigger and `aria-describedby` linkage"
    - 'Row is hidden when `excludedCount === 0` via `v-if` — ASSET-06 row is a reactive subscription to the metadata store'
    - "Info icon tooltip uses `v-tooltip.top` directive (globally-registered PrimeVue directive, no new import) with `t('moshpit.assets.excludedTooltip')` content"
    - 'A placeholder HTML comment marks where Phase 3 filter chips will land above the excluded row, per UI-SPEC mount-point guidance'
    - 'Component-level unit test covers: row hidden at 0, row visible + correct string at 1 (singular) and 3 (plural)'
  artifacts:
    - path: 'src/platform/moshpit/components/MoshpitSettingsPanel.vue'
      provides: 'Excluded-count row bound to moshpitMetadataStore.excludedCount'
      contains: 'moshpit.assets.excludedCount'
    - path: 'src/platform/moshpit/components/MoshpitSettingsPanel.test.ts'
      provides: 'Vitest coverage of the three-state row (0, 1, 3)'
      contains: "describe('MoshpitSettingsPanel"
  key_links:
    - from: 'src/platform/moshpit/components/MoshpitSettingsPanel.vue'
      to: 'src/platform/moshpit/stores/moshpitMetadataStore.ts'
      via: 'useMoshpitMetadataStore().excludedCount'
      pattern: 'useMoshpitMetadataStore|excludedCount'
---

<objective>
Add the "{N} assets excluded: no metadata" row to the Settings panel. Plain, reactive, hidden when zero. This is the ASSET-06 user-visible surface and the second half of ASSET-05 (the exclusion happens in the worker; the user-visible signal lives here).

Output: One Vue SFC edit (~20-line addition), one new component test file (~60 lines). No new i18n keys — Plan 09 added them.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-asset-pipeline/02-UI-SPEC.md
@src/platform/moshpit/components/MoshpitSettingsPanel.vue
@src/platform/moshpit/stores/moshpitMetadataStore.ts
@src/locales/en/main.json
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add excluded-count row to MoshpitSettingsPanel.vue with tooltip + component tests</name>
  <read_first>
    - src/platform/moshpit/components/MoshpitSettingsPanel.vue (current scaffold — preserve the existing header + scroll container)
    - .planning/phases/02-asset-pipeline/02-UI-SPEC.md §Surface 2 (implement verbatim — geometry, tooltip spec, a11y)
    - src/platform/moshpit/stores/moshpitMetadataStore.ts (excludedCount ref)
    - Confirm `v-tooltip` globally-registered PrimeVue directive by grepping: `grep -rn "v-tooltip" src/platform/moshpit src/components 2>/dev/null | head -5`
  </read_first>
  <behavior>
    - excludedCount = 0 → row not rendered (v-if false)
    - excludedCount = 1 → row visible with singular copy `"1 asset excluded: no metadata"`
    - excludedCount = 3 → row visible with plural copy `"3 assets excluded: no metadata"`
    - Info icon has `role="img"`, `aria-label={t('moshpit.assets.excludedTooltipLabel')}`
    - Info icon has `v-tooltip.top` directive with `t('moshpit.assets.excludedTooltip')` as the binding value
  </behavior>
  <action>
Replace `src/platform/moshpit/components/MoshpitSettingsPanel.vue` with:

```vue
<template>
  <aside
    data-testid="moshpit-settings-panel"
    class="flex h-full w-64 flex-col border-r border-(--interface-stroke) bg-node-component-surface"
  >
    <header class="flex items-center justify-between px-3 py-2 text-sm">
      <span>{{ t('moshpit.sidebar.settings') }}</span>
    </header>
    <div class="flex-1 overflow-y-auto px-3 py-2 text-xs">
      <!-- Phase 3 will inject filter chips / sort controls ABOVE this comment. -->
      <!-- excluded-count row below is the ASSET-06 surface. -->
      <div
        v-if="excludedCount > 0"
        class="flex items-center gap-1"
        data-testid="moshpit-excluded-count"
      >
        <span :id="excludedDescId" class="text-muted-foreground">
          {{ t('moshpit.assets.excludedCount', excludedCount) }}
        </span>
        <i
          v-tooltip.top="t('moshpit.assets.excludedTooltip')"
          class="icon-[lucide--info] size-3.5 cursor-help text-muted-foreground"
          role="img"
          :aria-label="t('moshpit.assets.excludedTooltipLabel')"
          :aria-describedby="excludedDescId"
        />
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'

defineOptions({ name: 'MoshpitSettingsPanel' })

const { t } = useI18n()
const metadataStore = useMoshpitMetadataStore()
const excludedCount = computed(() => metadataStore.excludedCount)
const excludedDescId = useId()
</script>
```

Create `src/platform/moshpit/components/MoshpitSettingsPanel.test.ts`:

```typescript
import { render, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MoshpitSettingsPanel from './MoshpitSettingsPanel.vue'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      moshpit: {
        sidebar: { settings: 'Settings' },
        assets: {
          excludedCount:
            '{count} asset excluded: no metadata | {count} assets excluded: no metadata',
          excludedTooltip: 'Tooltip body',
          excludedTooltipLabel: 'Why?'
        }
      }
    }
  }
})

function mountPanel() {
  return render(MoshpitSettingsPanel, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
      directives: {
        tooltip: { mounted: () => {} }
      }
    }
  })
}

describe('MoshpitSettingsPanel excluded-count row', () => {
  beforeEach(() => {
    // Reset pinia between tests is handled by createTestingPinia
  })

  it('hides the row when excludedCount === 0', () => {
    mountPanel()
    expect(screen.queryByTestId('moshpit-excluded-count')).toBeNull()
  })

  it('shows singular copy when excludedCount === 1', async () => {
    mountPanel()
    const store = useMoshpitMetadataStore()
    store.excludedCount = 1
    await new Promise((r) => setTimeout(r, 0))
    expect(
      screen.getByText('1 asset excluded: no metadata')
    ).toBeInTheDocument()
  })

  it('shows plural copy when excludedCount === 3', async () => {
    mountPanel()
    const store = useMoshpitMetadataStore()
    store.excludedCount = 3
    await new Promise((r) => setTimeout(r, 0))
    expect(
      screen.getByText('3 assets excluded: no metadata')
    ).toBeInTheDocument()
  })

  it('info icon exposes aria-label and aria-describedby', async () => {
    mountPanel()
    const store = useMoshpitMetadataStore()
    store.excludedCount = 2
    await new Promise((r) => setTimeout(r, 0))
    const icon = screen.getByRole('img', { name: /why\?/i })
    expect(icon).toHaveAttribute('aria-describedby')
  })
})
```

Constraints:

- NO new PrimeVue imports — `v-tooltip` is a globally-registered directive. The test stubs it with a no-op `mounted` so the directive resolution does not fail in jsdom.
- NO `dark:` variant.
- NO `:class="[]"`.
- NO `any`.
- The `useId()` composable (Vue 3.5) provides a stable SSR-safe id — preferred over manual ID generation.
  </action>
  <verify>
  <automated>pnpm test:unit --run src/platform/moshpit/components/MoshpitSettingsPanel.test.ts &amp;&amp; pnpm typecheck</automated>
  </verify>
  <acceptance_criteria> - `grep "moshpit.assets.excludedCount" src/platform/moshpit/components/MoshpitSettingsPanel.vue` returns a match - `grep "v-tooltip.top" src/platform/moshpit/components/MoshpitSettingsPanel.vue` returns a match - `grep "icon-\\[lucide--info\\]" src/platform/moshpit/components/MoshpitSettingsPanel.vue` returns a match - `grep "aria-describedby" src/platform/moshpit/components/MoshpitSettingsPanel.vue` returns a match - `grep "useMoshpitMetadataStore" src/platform/moshpit/components/MoshpitSettingsPanel.vue` returns at least 2 matches (import + use) - `grep "Phase 3 will inject" src/platform/moshpit/components/MoshpitSettingsPanel.vue` returns a match (planner marker) - `grep "dark:" src/platform/moshpit/components/MoshpitSettingsPanel.vue` returns zero matches - `test -f src/platform/moshpit/components/MoshpitSettingsPanel.test.ts` exits 0 - `pnpm test:unit --run src/platform/moshpit/components/MoshpitSettingsPanel.test.ts` exits 0 with 4 tests passing - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>Excluded-count row shipped; tooltip wired; 4 component tests GREEN; Phase 3 hook marker in place.</done>
  </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary         | Description                                                                     |
| ---------------- | ------------------------------------------------------------------------------- |
| Store → row text | `excludedCount` is a pure number from the metadata store — no injection surface |
| i18n → DOM       | Tooltip content from locale file — trusted project asset                        |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                      | Disposition | Mitigation Plan                                                                          |
| ---------- | ---------------------- | ---------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| T-02-10-01 | Tampering              | Tooltip HTML injection via `v-tooltip` binding | mitigate    | PrimeVue `v-tooltip` renders as text; no `v-html`. The binding value is a locale string. |
| T-02-10-02 | Information Disclosure | Tooltip exposes internal state                 | accept      | Tooltip explains the exclusion policy — public user-facing copy.                         |

</threat_model>

<verification>
- `pnpm test:unit --run src/platform/moshpit/components/MoshpitSettingsPanel.test.ts` — 4 tests PASS
- `pnpm typecheck` exits 0
- `pnpm lint` on touched files exits 0
</verification>

<success_criteria>

- Row reactive to `excludedCount`
- Plural + singular copy both correct
- Tooltip accessible via `role="img"` + `aria-label`
  </success_criteria>

<output>
Create `.planning/phases/02-asset-pipeline/02-10-SUMMARY.md` confirming the v-tooltip directive is globally registered (document the grep evidence).
</output>
