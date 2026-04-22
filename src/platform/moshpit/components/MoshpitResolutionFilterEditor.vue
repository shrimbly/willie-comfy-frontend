<template>
  <div class="flex flex-col gap-2" data-testid="moshpit-resolution-editor">
    <ul class="max-h-[120px] overflow-y-auto">
      <li
        v-for="[w, h] in resolutionPairs"
        :key="`${w}x${h}`"
        class="flex h-8 items-center gap-2 rounded-sm px-2 text-xs hover:bg-secondary-background-hover"
      >
        <input
          :id="`res-${w}x${h}`"
          type="checkbox"
          class="size-3.5"
          :checked="hasPreset(w, h)"
          @change="togglePreset(w, h)"
        />
        <label :for="`res-${w}x${h}`" class="cursor-pointer">
          {{ w }}&times;{{ h }}
        </label>
      </li>
    </ul>
    <div class="flex items-center gap-1">
      <input
        v-model="customW"
        type="number"
        placeholder="W"
        class="h-7 w-16 rounded-md border border-border-subtle bg-transparent px-2 text-xs"
        min="1"
      />
      <span class="text-muted-foreground">&times;</span>
      <input
        v-model="customH"
        type="number"
        placeholder="H"
        class="h-7 w-16 rounded-md border border-border-subtle bg-transparent px-2 text-xs"
        min="1"
      />
      <button
        type="button"
        class="h-7 rounded-md border border-border-subtle px-2 text-xs hover:bg-secondary-background-hover"
        @click="addCustomPair"
      >
        +
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, toRef, watch } from 'vue'

import type {
  ChipValue,
  ParamKey
} from '@/platform/moshpit/services/filterTypes'
import { useMoshpitParamValueOptions } from '@/platform/moshpit/composables/useMoshpitParamValueOptions'

defineOptions({ name: 'MoshpitResolutionFilterEditor' })

const value = defineModel<ChipValue | null>()
const props = defineProps<{ param: ParamKey }>()

const { resolutionPairs } = useMoshpitParamValueOptions(
  toRef(() => props.param)
)

const selectedPairs = ref<[number, number][]>([])
const customW = ref('')
const customH = ref('')

function hasPreset(w: number, h: number): boolean {
  return selectedPairs.value.some(([sw, sh]) => sw === w && sh === h)
}

function togglePreset(w: number, h: number): void {
  if (hasPreset(w, h)) {
    selectedPairs.value = selectedPairs.value.filter(
      ([sw, sh]) => !(sw === w && sh === h)
    )
  } else {
    selectedPairs.value = [...selectedPairs.value, [w, h]]
  }
  emitValue()
}

function addCustomPair(): void {
  const w = parseInt(customW.value, 10)
  const h = parseInt(customH.value, 10)
  if (!Number.isNaN(w) && !Number.isNaN(h) && w > 0 && h > 0) {
    if (!hasPreset(w, h)) {
      selectedPairs.value = [...selectedPairs.value, [w, h]]
      emitValue()
    }
    customW.value = ''
    customH.value = ''
  }
}

function emitValue(): void {
  value.value =
    selectedPairs.value.length > 0
      ? { kind: 'resolution', pairs: [...selectedPairs.value] }
      : null
}

watch(
  () => props.param,
  () => {
    selectedPairs.value = []
    customW.value = ''
    customH.value = ''
    value.value = null
  }
)
</script>
