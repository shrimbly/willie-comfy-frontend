<template>
  <div class="flex flex-col gap-1" data-testid="moshpit-categorical-editor">
    <input
      v-model="searchQuery"
      type="text"
      :placeholder="t('moshpit.filters.editorSearchValues')"
      class="h-7 w-full rounded-md border border-border-subtle bg-transparent px-2 text-xs"
    />
    <ul class="max-h-[180px] overflow-y-auto">
      <li
        v-for="opt in filteredOptions"
        :key="opt.value"
        class="flex h-8 items-center gap-2 rounded-sm px-2 text-xs hover:bg-secondary-background-hover"
      >
        <input
          :id="`cat-opt-${opt.value}`"
          type="checkbox"
          class="size-3.5"
          :checked="selected.has(opt.value)"
          @change="toggleValue(opt.value)"
        />
        <label :for="`cat-opt-${opt.value}`" class="flex-1 cursor-pointer">
          {{ opt.value }}
        </label>
        <span class="text-2xs text-muted-foreground">({{ opt.count }})</span>
      </li>
      <li v-if="filteredOptions.length === 0" class="px-2 py-1 text-xs text-muted-foreground">
        {{ t('moshpit.filters.editorSearchValues') }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import Fuse from 'fuse.js'
import { computed, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ChipValue, ParamKey } from '@/platform/moshpit/services/filterTypes'
import { useMoshpitParamValueOptions } from '@/platform/moshpit/composables/useMoshpitParamValueOptions'

defineOptions({ name: 'MoshpitCategoricalFilterEditor' })

const value = defineModel<ChipValue | null>()
const props = defineProps<{ param: ParamKey }>()

const { t } = useI18n()

const { options } = useMoshpitParamValueOptions(toRef(() => props.param))

const searchQuery = ref('')
const selected = ref(new Set<string>())

const fuse = computed(
  () =>
    new Fuse(options.value, {
      keys: ['value'],
      threshold: 0.4
    })
)

const filteredOptions = computed(() => {
  if (!searchQuery.value) return options.value
  return fuse.value.search(searchQuery.value).map((r) => r.item)
})

function toggleValue(val: string): void {
  if (selected.value.has(val)) {
    selected.value.delete(val)
  } else {
    selected.value.add(val)
  }
  // Trigger reactivity by replacing the Set
  selected.value = new Set(selected.value)
  emitValue()
}

function emitValue(): void {
  if (selected.value.size === 0) {
    value.value = null
    return
  }
  value.value = { kind: 'categorical', values: [...selected.value] }
}

watch(
  () => props.param,
  () => {
    selected.value = new Set()
    searchQuery.value = ''
    value.value = null
  }
)
</script>
