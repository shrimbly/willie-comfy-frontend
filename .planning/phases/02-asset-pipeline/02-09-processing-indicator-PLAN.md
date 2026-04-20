---
phase: 02-asset-pipeline
plan: 09
type: execute
wave: 4
depends_on: ['02-07', '02-08']
files_modified:
  - src/platform/moshpit/components/MoshpitProcessingIndicator.vue
  - src/platform/moshpit/components/MoshpitProcessingIndicator.stories.ts
  - src/locales/en/main.json
  - src/views/layouts/MoshpitLayout.vue
autonomous: true
requirements: [ASSET-07, ASSET-08]
tags: [ui, pill, overlay, wave-4, i18n]
must_haves:
  truths:
    - '`MoshpitProcessingIndicator.vue` renders the bottom-left pill per 02-UI-SPEC (structure, geometry, semantic tokens, a11y)'
    - 'Pill is rendered with `absolute bottom-4 left-4 z-50 pointer-events-auto` and uses `bg-interface-panel-surface`, `border-interface-stroke`, `rounded-lg`, `shadow-interface`'
    - "Pill displays `t('moshpit.assets.processing', { done, total })` and the progress bar fill width matches `done/total * 100%` with a `transition-[width] duration-300 ease-out`"
    - "Cancel button has `aria-label={t('moshpit.assets.cancel')}`, is 32×32px hit target (`size-8`), emits `cancel` on click"
    - "Pill uses `role='status' aria-live='polite' aria-atomic='false'` on the wrapper; progress bar uses `role='progressbar' aria-valuenow aria-valuemin aria-valuemax`"
    - 'Completion sequence: 600ms hold at 100%, then 200ms opacity fade, then `v-if` parent unmount — two `setTimeout` (RESEARCH §8)'
    - 'All six i18n keys under `moshpit.assets.*` exist in `src/locales/en/main.json`'
    - '`MoshpitLayout.vue` mounts the indicator as an absolutely-positioned overlay inside the canvas area, driven by `useMoshpitProcessingQueue`'
    - 'Storybook story exposes two states: `Processing` and `NearComplete`'
    - 'Plan 01 `MoshpitProcessingIndicator.test.ts` turns GREEN'
  artifacts:
    - path: 'src/platform/moshpit/components/MoshpitProcessingIndicator.vue'
      provides: 'The pill component'
      contains: 'aria-live="polite"'
    - path: 'src/locales/en/main.json'
      provides: 'Six moshpit.assets.* i18n keys'
      contains: 'moshpit.assets.processing'
    - path: 'src/views/layouts/MoshpitLayout.vue'
      provides: 'Mount point for indicator overlay + wires useMoshpitProcessingQueue'
      contains: 'MoshpitProcessingIndicator'
  key_links:
    - from: 'src/views/layouts/MoshpitLayout.vue'
      to: 'src/platform/moshpit/components/MoshpitProcessingIndicator.vue'
      via: 'component mount'
      pattern: '<MoshpitProcessingIndicator'
    - from: 'src/views/layouts/MoshpitLayout.vue'
      to: 'src/platform/moshpit/composables/useMoshpitProcessingQueue.ts'
      via: 'queue composable drives pill state'
      pattern: 'useMoshpitProcessingQueue'
---

<objective>
Ship the bottom-left processing pill. This plan is the full UI surface for ASSET-07/08 per 02-UI-SPEC. It delivers the component, the Storybook story, the i18n keys, and the `MoshpitLayout` wiring in one tight plan so the behaviour can be verified end-to-end in Wave 4.

Purpose: ASSET-08 docked indicator + cancel affordance. Dogfood-ready accessibility: `role="status"` + `aria-live="polite"` for screen reader users, `role="progressbar"` with explicit min/now/max, 32×32 hit target on the cancel.

Output: One Vue SFC (~120 lines), one stories.ts (~40 lines), six i18n keys, one MoshpitLayout.vue edit.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-asset-pipeline/02-UI-SPEC.md
@.planning/phases/02-asset-pipeline/02-RESEARCH.md
@src/platform/moshpit/composables/useMoshpitProcessingQueue.ts
@src/platform/moshpit/components/MoshpitSideRail.vue
@src/views/layouts/MoshpitLayout.vue
@src/platform/moshpit/components/MoshpitSideRail.stories.ts
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add the six moshpit.assets.* i18n keys</name>
  <read_first>
    - src/locales/en/main.json (locate the existing `moshpit` object)
    - .planning/phases/02-asset-pipeline/02-UI-SPEC.md §Copywriting Contract (exact strings)
  </read_first>
  <action>
Open `src/locales/en/main.json`. Locate the existing `"moshpit"` object (contains `workspace`, `canvas`, `commands`, `sidebar`). Add a new sibling key `assets` with these six entries (insert between `canvas` and `commands`):

```json
    "assets": {
      "processing": "Processing {done} / {total}",
      "cancel": "Cancel processing",
      "excludedCount": "{count} asset excluded: no metadata | {count} assets excluded: no metadata",
      "excludedTooltip": "Assets are excluded because they don't contain parseable ComfyUI metadata. Moshpit only renders generated images with embedded workflow data.",
      "excludedTooltipLabel": "Why are assets excluded?",
      "processingComplete": "Processing complete"
    }
```

Run `pnpm format` to ensure the JSON is normalised. DO NOT edit other locale files — translation workflows handle those.
</action>
<verify>
<automated>node -e "const m=require('./src/locales/en/main.json').moshpit.assets; if(!m||!m.processing||!m.cancel||!m.excludedCount||!m.excludedTooltip||!m.excludedTooltipLabel||!m.processingComplete)process.exit(1);console.log('ok')"</automated>
</verify>
<acceptance_criteria> - `node -e "console.log(require('./src/locales/en/main.json').moshpit.assets.processing)"` prints `Processing {done} / {total}` - `node -e "console.log(require('./src/locales/en/main.json').moshpit.assets.cancel)"` prints `Cancel processing` - `node -e "console.log(require('./src/locales/en/main.json').moshpit.assets.excludedCount)"` prints a string containing `|` (ICU plural) - `pnpm typecheck` exits 0
</acceptance_criteria>
<done>Six i18n keys present and valid JSON.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Build MoshpitProcessingIndicator.vue + Storybook stories, turn Plan-01 test GREEN</name>
  <read_first>
    - .planning/phases/02-asset-pipeline/02-UI-SPEC.md §Surface 1: MoshpitProcessingIndicator (implement verbatim)
    - src/platform/moshpit/components/MoshpitProcessingIndicator.test.ts (Plan 01 RED tests)
    - src/platform/moshpit/components/MoshpitSideRail.stories.ts (Storybook template pattern)
    - src/platform/moshpit/components/MoshpitSideRail.vue (Tailwind 4 + `cn()` pattern)
    - .planning/phases/02-asset-pipeline/02-RESEARCH.md §8 Indicator Fade-Out Polish (setTimeout sequencing)
  </read_first>
  <behavior>
    - Renders `Processing {done} / {total}` text
    - Emits `cancel` when the `×` button is clicked
    - Progress bar has `role='progressbar'`, `aria-valuenow={done}`, `aria-valuemin='0'`, `aria-valuemax={total}`
    - Pill wrapper has `role='status'`, `aria-live='polite'`, `aria-atomic='false'`
    - Cancel button `aria-label` sourced from `t('moshpit.assets.cancel')`
    - When `done === total &amp;&amp; total > 0`, `isFading` flips after 600ms, parent `v-if` unmount at 800ms total
  </behavior>
  <action>
Create `src/platform/moshpit/components/MoshpitProcessingIndicator.vue`:

```vue
<template>
  <div
    role="status"
    aria-live="polite"
    aria-atomic="false"
    :aria-label="t('moshpit.assets.processing', { done, total })"
    :class="
      cn(
        'absolute bottom-4 left-4 z-50 flex min-w-[180px] flex-col gap-1 rounded-lg border border-(--interface-stroke) bg-interface-panel-surface px-3 py-2 shadow-interface transition-opacity duration-200',
        isFading ? 'opacity-0' : 'opacity-100'
      )
    "
    data-testid="moshpit-processing-indicator"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs text-base-foreground">
        {{ t('moshpit.assets.processing', { done, total }) }}
      </span>
      <button
        type="button"
        :aria-label="t('moshpit.assets.cancel')"
        class="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-(--interface-stroke)"
        @click="emit('cancel')"
      >
        <i class="icon-[lucide--x] size-4" aria-hidden="true" />
      </button>
    </div>
    <div
      role="progressbar"
      :aria-valuenow="done"
      :aria-valuemin="0"
      :aria-valuemax="total"
      :aria-label="t('moshpit.assets.processing', { done, total })"
      class="h-0.5 w-full overflow-hidden rounded-full bg-secondary-background"
    >
      <div
        class="h-full rounded-full bg-(--color-interface-panel-job-progress-primary) transition-[width] duration-300 ease-out"
        :style="{ width: progressPct + '%' }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

defineOptions({ name: 'MoshpitProcessingIndicator' })

const { done, total } = defineProps<{
  done: number
  total: number
}>()

const emit = defineEmits<{
  cancel: []
  done: []
}>()

const { t } = useI18n()

const progressPct = computed(() =>
  total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
)

const isFading = ref(false)
let holdTimer: number | null = null
let unmountTimer: number | null = null

watch(
  () => done === total &amp;&amp; total > 0,
  (complete) => {
    if (!complete) {
      isFading.value = false
      if (holdTimer !== null) clearTimeout(holdTimer)
      if (unmountTimer !== null) clearTimeout(unmountTimer)
      return
    }
    holdTimer = window.setTimeout(() => {
      isFading.value = true
    }, 600)
    unmountTimer = window.setTimeout(() => {
      emit('done')
    }, 800)
  },
  { immediate: true }
)
</script>
```

Create `src/platform/moshpit/components/MoshpitProcessingIndicator.stories.ts`:

```typescript
import type { Meta, StoryObj } from '@storybook/vue3-vite'

import MoshpitProcessingIndicator from './MoshpitProcessingIndicator.vue'

const meta: Meta<typeof MoshpitProcessingIndicator> = {
  title: 'platform/moshpit/MoshpitProcessingIndicator',
  component: MoshpitProcessingIndicator
}

export default meta
type Story = StoryObj<typeof MoshpitProcessingIndicator>

export const Processing: Story = {
  args: { done: 12, total: 48 },
  render: (args) => ({
    components: { MoshpitProcessingIndicator },
    setup() {
      return { args }
    },
    template:
      '<div style="position: relative; height: 300px; width: 500px; background: #222;"><MoshpitProcessingIndicator v-bind="args" /></div>'
  })
}

export const NearComplete: Story = {
  args: { done: 47, total: 48 },
  render: (args) => ({
    components: { MoshpitProcessingIndicator },
    setup() {
      return { args }
    },
    template:
      '<div style="position: relative; height: 300px; width: 500px; background: #222;"><MoshpitProcessingIndicator v-bind="args" /></div>'
  })
}
```

Constraints:

- NO `:class="[]"`. Use `cn()` for conditional merging.
- NO `dark:` variant. Semantic tokens only.
- NO `!important` / `!` prefix.
- `defineEmits` uses shorthand array `[]` per Vue 3.5.
- Inline style `{ width: progressPct + '%' }` is the ONE arbitrary runtime value; acceptable because no Tailwind utility supports dynamic float percentages.
  </action>
  <verify>
  <automated>pnpm test:unit --run src/platform/moshpit/components/MoshpitProcessingIndicator.test.ts &amp;&amp; pnpm typecheck</automated>
  </verify>
  <acceptance_criteria> - `test -f src/platform/moshpit/components/MoshpitProcessingIndicator.vue` exits 0 - `test -f src/platform/moshpit/components/MoshpitProcessingIndicator.stories.ts` exits 0 - `grep "aria-live=\"polite\"" src/platform/moshpit/components/MoshpitProcessingIndicator.vue` returns a match - `grep "role=\"progressbar\"" src/platform/moshpit/components/MoshpitProcessingIndicator.vue` returns a match - `grep "aria-valuenow" src/platform/moshpit/components/MoshpitProcessingIndicator.vue` returns a match - `grep "icon-\\[lucide--x\\]" src/platform/moshpit/components/MoshpitProcessingIndicator.vue` returns a match - `grep "size-8" src/platform/moshpit/components/MoshpitProcessingIndicator.vue` returns a match - `grep "setTimeout.*600\\|setTimeout.*800" src/platform/moshpit/components/MoshpitProcessingIndicator.vue` returns at least two matches - `grep "dark:" src/platform/moshpit/components/MoshpitProcessingIndicator.vue` returns zero matches - `grep ":class=\"\\[" src/platform/moshpit/components/MoshpitProcessingIndicator.vue` returns zero matches - `pnpm test:unit --run src/platform/moshpit/components/MoshpitProcessingIndicator.test.ts` exits 0 with 4 tests passing - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>Pill component + stories shipped; Plan-01 component test GREEN; a11y contracts met.</done>
  </task>

<task type="auto" tdd="false">
  <name>Task 3: Wire MoshpitProcessingIndicator into MoshpitLayout.vue via useMoshpitProcessingQueue</name>
  <read_first>
    - src/views/layouts/MoshpitLayout.vue (full file)
    - src/platform/moshpit/composables/useMoshpitProcessingQueue.ts (queue interface)
    - .planning/phases/02-asset-pipeline/02-UI-SPEC.md §Layout and Positioning (overlay owned by canvas area)
  </read_first>
  <action>
Replace `src/views/layouts/MoshpitLayout.vue` with:

```vue
<template>
  <WorkspaceAuthGate>
    <main
      class="relative flex size-full overflow-hidden bg-node-component-surface"
    >
      <MoshpitSideRail />
      <MoshpitSettingsPanel v-if="isSettingsOpen" />
      <div class="relative flex-1">
        <MoshpitView />
        <MoshpitProcessingIndicator
          v-if="queue.isActive.value || showCompletionPulse"
          :done="queue.done.value"
          :total="queue.total.value"
          @cancel="onCancel"
          @done="onIndicatorDone"
        />
      </div>
    </main>
  </WorkspaceAuthGate>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import MoshpitProcessingIndicator from '@/platform/moshpit/components/MoshpitProcessingIndicator.vue'
import MoshpitSettingsPanel from '@/platform/moshpit/components/MoshpitSettingsPanel.vue'
import MoshpitSideRail from '@/platform/moshpit/components/MoshpitSideRail.vue'
import { useMoshpitProcessingQueue } from '@/platform/moshpit/composables/useMoshpitProcessingQueue'
import {
  MOSHPIT_SETTINGS_PANEL_ID,
  useMoshpitSidebarStore
} from '@/platform/moshpit/stores/moshpitSidebarStore'
import WorkspaceAuthGate from '@/platform/workspace/auth/WorkspaceAuthGate.vue'
import MoshpitView from '@/views/MoshpitView.vue'

defineOptions({ name: 'MoshpitLayout' })

const sidebarStore = useMoshpitSidebarStore()
const isSettingsOpen = computed(
  () => sidebarStore.activePanelId === MOSHPIT_SETTINGS_PANEL_ID
)

const queue = useMoshpitProcessingQueue()
const showCompletionPulse = ref(false)

watch(
  () => queue.total.value > 0 &amp;&amp; queue.done.value === queue.total.value,
  (complete) => {
    showCompletionPulse.value = complete
  }
)

function onCancel(): void {
  queue.cancel()
}

function onIndicatorDone(): void {
  showCompletionPulse.value = false
}

onMounted(() => {
  document.getElementById('splash-loader')?.remove()
})
</script>
```

Note: Phase 3's filter gate will drive `queue.setFilter(...)`. Phase 2 does NOT call `setFilter` from `MoshpitLayout` — it is intentionally idle until the initial filter is applied (PRD §5.5).

Constraints:

- Preserve the `splash-loader` removal (Phase 1 fix).
- Queue composable is scoped to `MoshpitLayout` so its `onBeforeUnmount` runs on layout teardown.
  </action>
  <verify>
  <automated>pnpm typecheck &amp;&amp; pnpm test:unit --run src/platform/moshpit</automated>
  </verify>
  <acceptance_criteria> - `grep "MoshpitProcessingIndicator" src/views/layouts/MoshpitLayout.vue` returns at least 2 matches (import + mount) - `grep "useMoshpitProcessingQueue" src/views/layouts/MoshpitLayout.vue` returns at least 2 matches - `grep "splash-loader" src/views/layouts/MoshpitLayout.vue` returns a match - Indicator mount sits inside the `<div class="relative flex-1">` wrapper - `pnpm typecheck` exits 0 - `pnpm test:unit --run src/platform/moshpit` exits 0 with no regression
  </acceptance_criteria>
  <done>Indicator mounted inside canvas area; queue composable instantiated at layout scope; cancel + done emits wired.</done>
  </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                             | Description                                 |
| ------------------------------------ | ------------------------------------------- |
| DOM ← `t('moshpit.assets.*')` output | Strings from project-controlled locale file |
| User → cancel button                 | Trusted main-thread event                   |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                | Disposition | Mitigation Plan                                                       |
| ---------- | ---------------------- | ---------------------------------------- | ----------- | --------------------------------------------------------------------- |
| T-02-09-01 | Tampering              | HTML injection via crafted i18n value    | mitigate    | Vue `{{ }}` interpolation HTML-escapes by default; no `v-html` usage. |
| T-02-09-02 | Denial of Service      | Rapid cancel-clicks spawning setTimeouts | mitigate    | `clearTimeout` called when the `done === total` watch flips to false. |
| T-02-09-03 | Information Disclosure | A11y labels leaking state                | accept      | Labels expose `done`/`total` only — no secrets.                       |

</threat_model>

<verification>
- `pnpm test:unit --run src/platform/moshpit/components/MoshpitProcessingIndicator.test.ts` — 4 tests PASS
- `pnpm typecheck` exits 0
- `pnpm lint` on touched files exits 0
- Manual: `pnpm storybook` renders Processing + NearComplete stories (VALIDATION.md Manual-Only row on pill placement / fade-out polish)
</verification>

<success_criteria>

- Pill component per UI-SPEC
- Six i18n keys present
- Plan-01 component test GREEN
- Mounted inside MoshpitLayout canvas area, driven by queue composable
  </success_criteria>

<output>
Create `.planning/phases/02-asset-pipeline/02-09-SUMMARY.md` noting the Storybook states shipped and any minor deviations from UI-SPEC.
</output>
