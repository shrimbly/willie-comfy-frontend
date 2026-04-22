<!--
  Phase 5 Plan 05 — MoshpitMetadataPeekPanel (D-20, D-21, D-22; PEEK-01..03).

  Right-side metadata peek panel for tournament mode. Visibility is driven by
  `store.isPeekOpen` via Tailwind transform classes so the 200ms slide runs on
  toggle rather than on mount. When open, the panel renders:

    1. A scrollable list of scalar-param diff rows — one per
       `PARAM_DIFF_KEY_ORDER` entry. Rows where the A/B values differ are
       highlighted with the `bg-node-component-surface` token (D-20).
    2. A LoRA set-diff section with four state groups — match / weightChanged
       / added / removed — coloured via `text-success` / `text-danger` /
       `text-warning` semantic tokens (D-21).

  XSS note (threat T-05-05-01): prompt text flows through Vue mustache
  interpolation only — raw HTML binding is never used. NormalizedParams
  scalars originate from user-generated PNG metadata.

  i18n keys referenced (wired by Plan 05-06 in src/locales/en/main.json):
    moshpit.peek.panelTitle
    moshpit.peek.loadingMetadata
    moshpit.peek.params.<key>              (one per PARAM_DIFF_KEY_ORDER entry)
    moshpit.peek.lora.sectionTitle
    moshpit.peek.lora.empty
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { diffLoras, diffParams } from '@/platform/moshpit/services/metadataDiff'
import type {
  LoraDiffEntry,
  LoraDiffState,
  ParamDiffRow,
  ParamDiffState
} from '@/platform/moshpit/services/metadataDiff'
import type { NormalizedParams } from '@/platform/moshpit/services/paramNormalize'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'
import { cn } from '@/utils/tailwindUtil'

defineOptions({ name: 'MoshpitMetadataPeekPanel' })

const { paramsA, paramsB } = defineProps<{
  paramsA: NormalizedParams | null
  paramsB: NormalizedParams | null
}>()

const { t } = useI18n()
const store = useMoshpitTournamentStore()

const isReady = computed(() => paramsA !== null && paramsB !== null)

const paramRows = computed<readonly ParamDiffRow[]>(() =>
  paramsA && paramsB ? diffParams(paramsA, paramsB) : []
)

const loraRows = computed<readonly LoraDiffEntry[]>(() =>
  paramsA && paramsB ? diffLoras(paramsA.loras, paramsB.loras) : []
)

function paramStateClass(state: ParamDiffState): string {
  return state === 'differ' || state === 'onlyA' || state === 'onlyB'
    ? 'bg-node-component-surface'
    : ''
}

function loraStateClass(state: LoraDiffState): string {
  switch (state) {
    case 'added':
      return 'text-success'
    case 'removed':
      return 'text-danger'
    case 'weightChanged':
      return 'text-warning'
    default:
      return 'text-muted-foreground'
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}
</script>

<template>
  <aside
    :class="
      cn(
        'absolute top-0 right-0 h-full w-80 overflow-y-auto border-l border-(--interface-stroke) bg-base-background transition-[transform] duration-200 ease-out lg:w-96 xl:w-md',
        store.isPeekOpen ? 'translate-x-0' : 'translate-x-full'
      )
    "
    :aria-hidden="!store.isPeekOpen"
    data-testid="moshpit-metadata-peek-panel"
  >
    <header class="border-b border-(--interface-stroke) p-4">
      <h2 class="text-sm font-medium text-base-foreground">
        {{ t('moshpit.peek.panelTitle') }}
      </h2>
    </header>

    <section
      v-if="!isReady"
      class="p-4 text-xs text-muted-foreground"
      data-testid="moshpit-metadata-peek-loading"
    >
      {{ t('moshpit.peek.loadingMetadata') }}
    </section>

    <template v-else>
      <section
        class="flex flex-col gap-1 p-4"
        data-testid="moshpit-metadata-peek-param-section"
      >
        <div
          v-for="row in paramRows"
          :key="row.key"
          :class="
            cn(
              'grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-sm px-2 py-1 text-xs',
              paramStateClass(row.state)
            )
          "
          :data-testid="`moshpit-metadata-peek-param-row-${row.key}`"
          data-moshpit-peek-param-row=""
        >
          <span class="text-muted-foreground">
            {{ t(`moshpit.peek.params.${row.key}`) }}
          </span>
          <span
            class="max-w-40 truncate text-right font-mono text-base-foreground"
          >
            {{ formatValue(row.valueA) }}
          </span>
          <span
            class="max-w-40 truncate text-right font-mono text-base-foreground"
          >
            {{ formatValue(row.valueB) }}
          </span>
        </div>
      </section>

      <section class="border-t border-(--interface-stroke) p-4">
        <h3 class="mb-2 text-xs font-medium text-base-foreground">
          {{ t('moshpit.peek.lora.sectionTitle') }}
        </h3>
        <div v-if="loraRows.length === 0" class="text-xs text-muted-foreground">
          {{ t('moshpit.peek.lora.empty') }}
        </div>
        <ul v-else class="flex flex-col gap-1 text-xs">
          <li
            v-for="row in loraRows"
            :key="row.name"
            :class="cn('rounded-sm px-2 py-1', loraStateClass(row.state))"
            :data-testid="`moshpit-metadata-peek-lora-row-${row.name}`"
          >
            <span class="font-mono">{{ row.name }}</span>
            <span class="ml-2 font-mono">
              {{ formatValue(row.weightA) }} → {{ formatValue(row.weightB) }}
            </span>
          </li>
        </ul>
      </section>
    </template>
  </aside>
</template>
