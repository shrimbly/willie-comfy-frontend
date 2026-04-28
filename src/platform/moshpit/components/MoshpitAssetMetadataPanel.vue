<!--
  Single-asset metadata side panel for the Moshpit lightbox.

  Companion to MoshpitMetadataPeekPanel (which shows a 2-asset diff). This one
  shows one asset's scalar params in PARAM_DIFF_KEY_ORDER, plus the LoRA stack.
  Shares the `moshpit.peek.*` i18n namespace so the key catalogue stays small.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  PARAM_DIFF_KEY_ORDER,
  formatValue
} from '@/platform/moshpit/services/metadataDiff'
import type { NormalizedParams } from '@/platform/moshpit/services/paramNormalize'

defineOptions({ name: 'MoshpitAssetMetadataPanel' })

const { params } = defineProps<{
  params: NormalizedParams | null
}>()

const { t } = useI18n()

const paramRows = computed(() =>
  params ? PARAM_DIFF_KEY_ORDER.map((key) => ({ key, value: params[key] })) : []
)

const loraRows = computed(() => params?.loras ?? [])
</script>

<template>
  <aside
    class="flex h-full w-80 shrink-0 flex-col overflow-y-auto border-l border-border-subtle bg-modal-panel-background"
    data-testid="moshpit-lightbox-metadata-panel"
  >
    <header class="border-b border-border-subtle px-4 py-3">
      <h2 class="text-sm font-medium text-base-foreground">
        {{ t('moshpit.peek.panelTitle') }}
      </h2>
    </header>

    <section
      v-if="!params"
      class="p-4 text-xs text-muted-foreground"
      data-testid="moshpit-lightbox-metadata-loading"
    >
      {{ t('moshpit.peek.loadingMetadata') }}
    </section>

    <template v-else>
      <section
        class="flex flex-col gap-1 p-4"
        data-testid="moshpit-lightbox-metadata-param-section"
      >
        <div
          v-for="row in paramRows"
          :key="row.key"
          class="grid grid-cols-[1fr_auto] items-start gap-3 px-2 py-1 text-xs"
          :data-testid="`moshpit-lightbox-metadata-param-row-${row.key}`"
        >
          <span class="text-muted-foreground">
            {{ t(`moshpit.peek.params.${row.key}`) }}
          </span>
          <span
            class="max-w-48 truncate text-right font-mono text-base-foreground"
            :title="formatValue(row.value)"
          >
            {{ formatValue(row.value) }}
          </span>
        </div>
      </section>

      <section class="border-t border-border-subtle p-4">
        <h3 class="mb-2 text-xs font-medium text-base-foreground">
          {{ t('moshpit.peek.lora.sectionTitle') }}
        </h3>
        <div
          v-if="loraRows.length === 0"
          class="text-xs text-muted-foreground"
          data-testid="moshpit-lightbox-metadata-lora-empty"
        >
          {{ t('moshpit.lightbox.lorasEmpty') }}
        </div>
        <ul v-else class="flex flex-col gap-1 text-xs">
          <li
            v-for="lora in loraRows"
            :key="lora.name"
            class="flex items-baseline justify-between gap-2 rounded-sm px-2 py-1 text-muted-foreground"
          >
            <span class="truncate font-mono" :title="lora.name">
              {{ lora.name }}
            </span>
            <span class="font-mono text-base-foreground tabular-nums">
              {{ formatValue(lora.weight) }}
            </span>
          </li>
        </ul>
      </section>
    </template>
  </aside>
</template>
