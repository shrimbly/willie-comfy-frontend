<template>
  <div class="flex flex-col gap-2" data-testid="moshpit-numeric-editor">
    <label class="flex items-center gap-2 text-xs">
      <input
        v-model="isExact"
        type="checkbox"
        class="size-3.5"
        :aria-label="t('moshpit.filters.editorExact')"
      />
      <span>{{ t('moshpit.filters.editorExact') }}</span>
    </label>
    <div v-if="isExact" class="flex flex-col gap-1">
      <input
        :value="exactStr"
        type="number"
        :placeholder="t('moshpit.filters.editorExact')"
        class="h-7 w-full rounded-md border border-border-subtle bg-transparent px-2 text-xs"
        @input="onExactInput"
      />
    </div>
    <div v-else class="flex items-center gap-1">
      <input
        :value="minStr"
        type="number"
        :placeholder="t('moshpit.filters.editorMin')"
        class="h-7 w-16 rounded-md border border-border-subtle bg-transparent px-2 text-xs"
        @input="onMinInput"
      />
      <span class="text-muted-foreground">&ndash;</span>
      <input
        :value="maxStr"
        type="number"
        :placeholder="t('moshpit.filters.editorMax')"
        class="h-7 w-16 rounded-md border border-border-subtle bg-transparent px-2 text-xs"
        @input="onMaxInput"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  ChipValue,
  ParamKey
} from '@/platform/moshpit/services/filterTypes'

defineOptions({ name: 'MoshpitNumericFilterEditor' })

const value = defineModel<ChipValue | null>()
const { param: _param } = defineProps<{ param: ParamKey }>()

const { t } = useI18n()

const isExact = ref(false)
const minStr = ref('')
const maxStr = ref('')
const exactStr = ref('')

function emitValue(): void {
  if (isExact.value) {
    const exact = parseFloat(exactStr.value)
    value.value = Number.isNaN(exact)
      ? null
      : { kind: 'numeric', min: null, max: null, exact }
  } else {
    const min = minStr.value ? parseFloat(minStr.value) : null
    const max = maxStr.value ? parseFloat(maxStr.value) : null
    if (min === null && max === null) {
      value.value = null
      return
    }
    if (
      (min !== null && Number.isNaN(min)) ||
      (max !== null && Number.isNaN(max))
    ) {
      value.value = null
      return
    }
    value.value = { kind: 'numeric', min, max, exact: null }
  }
}

function onExactInput(e: Event): void {
  exactStr.value = (e.target as HTMLInputElement).value
  emitValue()
}

function onMinInput(e: Event): void {
  minStr.value = (e.target as HTMLInputElement).value
  emitValue()
}

function onMaxInput(e: Event): void {
  maxStr.value = (e.target as HTMLInputElement).value
  emitValue()
}

watch(isExact, () => {
  // Clear fields and reset model when toggling mode
  minStr.value = ''
  maxStr.value = ''
  exactStr.value = ''
  value.value = null
})
</script>
