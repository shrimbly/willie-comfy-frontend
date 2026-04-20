<template>
  <div class="flex flex-col gap-2" data-testid="moshpit-text-editor">
    <textarea
      v-model="text"
      rows="3"
      :placeholder="t('moshpit.filters.editorSubstringHint')"
      class="h-16 w-full resize-none rounded-md border border-border-subtle bg-transparent px-2 py-1 text-xs"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ChipValue, ParamKey } from '@/platform/moshpit/services/filterTypes'

defineOptions({ name: 'MoshpitTextFilterEditor' })

const value = defineModel<ChipValue | null>()
const { param: _param } = defineProps<{ param: ParamKey }>()

const { t } = useI18n()

const text = ref('')

watch(text, (raw) => {
  const trimmed = raw.trim()
  value.value = trimmed.length > 0 ? { kind: 'text', substring: trimmed } : null
})
</script>
