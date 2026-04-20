<template>
  <section
    class="flex flex-col gap-2 px-3 py-2"
    :aria-label="t('moshpit.sort.sectionLabel')"
  >
    <span class="text-2xs uppercase tracking-wide text-muted-foreground">
      {{ t('moshpit.sort.sectionLabel') }}
    </span>

    <!-- X axis row -->
    <div class="flex items-center gap-2">
      <span class="w-4 shrink-0 text-2xs uppercase text-muted-foreground">
        {{ t('moshpit.sort.xAxisLabel') }}
      </span>
      <PopoverRoot v-model:open="xOpen">
        <PopoverTrigger as-child>
          <button
            type="button"
            :class="
              cn(
                'flex h-8 flex-1 items-center rounded-md border border-border-subtle bg-secondary-background px-2 text-xs',
                filterStore.sortX === null
                  ? 'text-muted-foreground'
                  : 'text-base-foreground'
              )
            "
            data-testid="moshpit-sort-x-trigger"
          >
            <span>{{
              filterStore.sortX !== null
                ? paramLabel(filterStore.sortX)
                : t('moshpit.sort.xAxisPlaceholder')
            }}</span>
          </button>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            side="bottom"
            :side-offset="4"
            :class="
              cn(
                'z-1700 w-48 rounded-md border border-border-subtle bg-base-background p-1 shadow-sm',
                'data-[state=open]:data-[side=bottom]:animate-slideUpAndFade'
              )
            "
          >
            <ul>
              <li
                v-for="key in SORTABLE_PARAM_KEYS"
                :key="key"
                role="option"
                :class="
                  cn(
                    'flex h-8 cursor-pointer items-center rounded-sm px-2 text-xs',
                    filterStore.sortX === key
                      ? 'bg-secondary-background text-base-foreground'
                      : 'text-base-foreground hover:bg-secondary-background-hover'
                  )
                "
                @click="selectX(key)"
              >
                <span>{{ paramLabel(key) }}</span>
              </li>
            </ul>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>
      <button
        v-if="filterStore.sortX !== null"
        type="button"
        class="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary-background-hover hover:text-base-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-background"
        :aria-label="t('moshpit.sort.clearAxis', { axis: 'X' })"
        data-testid="moshpit-sort-clear-x"
        @click="filterStore.setSortX(null)"
      >
        <i class="icon-[lucide--x] size-3" aria-hidden="true" />
      </button>
    </div>

    <!-- Y axis row -->
    <div class="flex items-center gap-2">
      <span class="w-4 shrink-0 text-2xs uppercase text-muted-foreground">
        {{ t('moshpit.sort.yAxisLabel') }}
      </span>
      <PopoverRoot v-model:open="yOpen">
        <PopoverTrigger as-child>
          <button
            type="button"
            :class="
              cn(
                'flex h-8 flex-1 items-center rounded-md border border-border-subtle bg-secondary-background px-2 text-xs',
                filterStore.sortY === null
                  ? 'text-muted-foreground'
                  : 'text-base-foreground'
              )
            "
            data-testid="moshpit-sort-y-trigger"
          >
            <span>{{
              filterStore.sortY !== null
                ? paramLabel(filterStore.sortY)
                : t('moshpit.sort.yAxisPlaceholder')
            }}</span>
          </button>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            side="bottom"
            :side-offset="4"
            :class="
              cn(
                'z-1700 w-48 rounded-md border border-border-subtle bg-base-background p-1 shadow-sm',
                'data-[state=open]:data-[side=bottom]:animate-slideUpAndFade'
              )
            "
          >
            <ul>
              <li
                v-for="key in SORTABLE_PARAM_KEYS"
                :key="key"
                role="option"
                :class="
                  cn(
                    'flex h-8 cursor-pointer items-center rounded-sm px-2 text-xs',
                    filterStore.sortY === key
                      ? 'bg-secondary-background text-base-foreground'
                      : 'text-base-foreground hover:bg-secondary-background-hover'
                  )
                "
                @click="selectY(key)"
              >
                <span>{{ paramLabel(key) }}</span>
              </li>
            </ul>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>
      <button
        v-if="filterStore.sortY !== null"
        type="button"
        class="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary-background-hover hover:text-base-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-background"
        :aria-label="t('moshpit.sort.clearAxis', { axis: 'Y' })"
        data-testid="moshpit-sort-clear-y"
        @click="filterStore.setSortY(null)"
      >
        <i class="icon-[lucide--x] size-3" aria-hidden="true" />
      </button>
    </div>

    <!-- aria-live announcement region -->
    <span class="sr-only" role="status" aria-live="polite">
      {{ announcement }}
    </span>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import { cn } from '@/utils/tailwindUtil'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import { SORTABLE_PARAM_KEYS } from '@/platform/moshpit/services/sortMath'
import type { ParamKey } from '@/platform/moshpit/services/filterTypes'

defineOptions({ name: 'MoshpitSortControls' })

const { t } = useI18n()
const filterStore = useMoshpitFilterStore()

const xOpen = ref(false)
const yOpen = ref(false)
const announcement = ref('')

watch(
  () => [filterStore.sortX, filterStore.sortY] as const,
  ([x, y]) => {
    if (x === null && y === null) {
      announcement.value = t('moshpit.sort.axisClearedAnnouncement')
    } else if (x !== null) {
      announcement.value = t('moshpit.sort.axisSetAnnouncement', {
        param: paramLabel(x),
        axis: 'X'
      })
    } else if (y !== null) {
      announcement.value = t('moshpit.sort.axisSetAnnouncement', {
        param: paramLabel(y),
        axis: 'Y'
      })
    }
  }
)

function paramLabel(p: ParamKey): string {
  switch (p) {
    case 'positivePrompt':
      return t('moshpit.filters.paramPrompt')
    case 'negativePrompt':
      return t('moshpit.filters.paramNegativePrompt')
    case 'timestamp':
      return t('moshpit.filters.paramGenerationTime')
    case 'resolution':
      return t('moshpit.filters.paramResolution')
    case 'loras':
      return t('moshpit.filters.paramLoras')
    default:
      return t(
        `moshpit.filters.param${p.charAt(0).toUpperCase()}${p.slice(1)}`
      )
  }
}

function selectX(key: ParamKey): void {
  filterStore.setSortX(key)
  xOpen.value = false
}

function selectY(key: ParamKey): void {
  filterStore.setSortY(key)
  yOpen.value = false
}

defineExpose({ selectX, selectY })
</script>
