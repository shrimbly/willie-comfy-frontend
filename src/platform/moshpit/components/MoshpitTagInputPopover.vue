<template>
  <PopoverRoot v-model:open="openModel">
    <PopoverAnchor as-child>
      <div aria-hidden="true" class="pointer-events-none" />
    </PopoverAnchor>
    <PopoverPortal>
      <PopoverContent
        class="z-50 w-72 rounded-lg border border-border-subtle bg-base-background p-3 shadow-interface"
        :side-offset="8"
        @escape-key-down="openModel = false"
      >
        <input
          ref="inputEl"
          v-model="draft"
          type="text"
          :placeholder="t('moshpit.curation.tags.placeholder')"
          :aria-label="t('moshpit.curation.tags.inputLabel')"
          maxlength="64"
          data-testid="moshpit-tag-popover-input"
          :class="inputClasses"
          @keydown.enter="onEnter"
          @keydown.esc="openModel = false"
        />
        <div v-if="existingTags.length > 0" class="mt-2 flex flex-wrap gap-1">
          <button
            v-for="{ value, count, tristate } in existingTags"
            :key="value"
            type="button"
            :aria-pressed="tristate === 'all' ? 'true' : 'false'"
            :class="chipClass(tristate)"
            :data-testid="`moshpit-tag-popover-chip-${value}`"
            @click="onChipClick(value, tristate)"
          >
            {{ value }} ({{ count }})
          </button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup lang="ts">
import {
  PopoverAnchor,
  PopoverContent,
  PopoverPortal,
  PopoverRoot
} from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMoshpitCuration } from '@/platform/moshpit/composables/useMoshpitCuration'
import { useMoshpitParamValueOptions } from '@/platform/moshpit/composables/useMoshpitParamValueOptions'
import { useMoshpitCurationStore } from '@/platform/moshpit/stores/moshpitCurationStore'
import { cn } from '@/utils/tailwindUtil'

defineOptions({ name: 'MoshpitTagInputPopover' })

const openModel = defineModel<boolean>('open', { required: true })
const { hashes } = defineProps<{ hashes: readonly string[] }>()

const { t } = useI18n()
const curation = useMoshpitCuration()
const curationStore = useMoshpitCurationStore()
const paramValueOptions = useMoshpitParamValueOptions(() => 'tags')

const inputEl = ref<HTMLInputElement | null>(null)
const draft = ref('')

type TriState = 'all' | 'some' | 'none'

const existingTags = computed(() => {
  return paramValueOptions.options.value.map(({ value, count }) => {
    let appliedToCount = 0
    for (const h of hashes) {
      if (curationStore.get(h)?.tags.includes(value)) appliedToCount++
    }
    const tristate: TriState =
      hashes.length > 0 && appliedToCount === hashes.length
        ? 'all'
        : appliedToCount === 0
          ? 'none'
          : 'some'
    return { value, count, tristate }
  })
})

function onEnter(): void {
  const trimmed = draft.value.trim()
  if (!trimmed) return
  curation.tagMany(hashes, trimmed)
  draft.value = ''
  openModel.value = false
}

function onChipClick(value: string, tristate: TriState): void {
  if (tristate === 'all') {
    curation.untagMany(hashes, value)
  } else {
    curation.tagMany(hashes, value)
  }
}

const inputClasses = cn(
  'w-full rounded-md border border-border-subtle bg-secondary-background px-2 py-1.5 text-sm',
  'outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)'
)

function chipClass(tristate: TriState): string {
  return cn(
    'rounded-full px-2 py-0.5 text-xs border',
    tristate === 'all' &&
      'border-interface-menu-component-surface-selected bg-interface-menu-component-surface-selected text-base-foreground',
    tristate === 'some' &&
      'border-warning bg-interface-panel-surface text-base-foreground',
    tristate === 'none' &&
      'border-border-subtle bg-interface-panel-surface text-muted-foreground hover:bg-interface-panel-hover'
  )
}
</script>
