<template>
  <div class="flex flex-col gap-2" data-testid="moshpit-boolean-editor">
    <label class="flex items-center gap-2 text-xs">
      <input v-model="checked" type="checkbox" class="size-3.5" />
      <span>{{ t('moshpit.filters.editorFavouriteLabel') }}</span>
    </label>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  ChipValue,
  ParamKey
} from '@/platform/moshpit/services/filterTypes'

defineOptions({ name: 'MoshpitBooleanFilterEditor' })

const value = defineModel<ChipValue | null>()
const { param: _param } = defineProps<{ param: ParamKey }>()

const { t } = useI18n()

const checked = ref(true)

watch(
  checked,
  (v) => {
    value.value = { kind: 'boolean', value: v }
  },
  { immediate: true }
)
</script>
