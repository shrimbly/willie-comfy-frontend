<template>
  <ComboboxRoot
    v-model:open="isOpen"
    ignore-filter
    :model-value="filterStore.workflow ?? ALL_WORKFLOWS_VALUE"
    @update:model-value="onSelect"
  >
    <ComboboxAnchor>
      <button
        type="button"
        :aria-label="t('moshpit.filters.workflowPickerLabel')"
        data-testid="moshpit-workflow-picker-trigger"
        :class="
          cn(
            'flex h-8 w-full items-center justify-between gap-2 rounded-md border border-border-subtle bg-secondary-background px-2 text-xs'
          )
        "
        @click="isOpen = !isOpen"
      >
        <span
          :class="
            cn(
              'truncate',
              filterStore.workflow
                ? 'text-base-foreground'
                : 'text-muted-foreground'
            )
          "
        >
          {{
            filterStore.workflow
              ? selectedDisplayName
              : t('moshpit.filters.workflowPickerPlaceholder')
          }}
        </span>
        <i
          class="icon-[lucide--chevron-down] size-3.5 shrink-0"
          aria-hidden="true"
        />
      </button>
    </ComboboxAnchor>

    <ComboboxContent
      position="popper"
      :class="
        cn(
          'z-1700 max-h-60 w-(--reka-combobox-trigger-width) overflow-y-auto',
          'rounded-md border border-border-subtle bg-interface-panel-surface shadow-interface'
        )
      "
    >
      <ComboboxInput
        :placeholder="t('moshpit.filters.workflowPickerSearch')"
        :aria-label="t('moshpit.filters.workflowPickerSearch')"
        class="sticky top-0 h-8 w-full border-b border-border-subtle bg-transparent px-2 text-xs outline-none"
      />

      <ComboboxItem
        :value="ALL_WORKFLOWS_VALUE"
        data-testid="moshpit-workflow-picker-all"
        :class="
          cn(
            'flex h-10 cursor-pointer items-center px-2 text-xs hover:bg-secondary-background-hover',
            filterStore.workflow === null && 'bg-secondary-background-hover'
          )
        "
      >
        <span class="truncate text-base-foreground">
          {{ t('moshpit.filters.workflowPickerAll') }}
        </span>
      </ComboboxItem>

      <ComboboxItem
        v-for="opt in options"
        :key="opt.fingerprint"
        :value="opt.fingerprint"
        class="flex h-10 cursor-pointer items-center px-2 text-xs hover:bg-secondary-background-hover"
      >
        <span class="truncate text-base-foreground">
          {{
            t(
              'moshpit.filters.workflowOptionCount',
              { name: opt.displayName, count: opt.count },
              opt.count
            )
          }}
        </span>
      </ComboboxItem>
    </ComboboxContent>
  </ComboboxRoot>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot
} from 'reka-ui'

import { cn } from '@/utils/tailwindUtil'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import { useMoshpitWorkflowOptions } from '@/platform/moshpit/composables/useMoshpitWorkflowOptions'

defineOptions({ name: 'MoshpitWorkflowPicker' })

const { t } = useI18n()
const filterStore = useMoshpitFilterStore()
const { options } = useMoshpitWorkflowOptions()
const isOpen = ref(false)

// Sentinel that binds to the Combobox "All workflows" entry. Selecting it
// clears the workflow gate. Using a string value (not null) keeps Reka UI's
// v-model happy — it treats null as "no selection" and skips the update.
const ALL_WORKFLOWS_VALUE = '__moshpit:all-workflows__'

function onSelect(value: string | null | undefined): void {
  if (value === ALL_WORKFLOWS_VALUE || value === null || value === undefined) {
    filterStore.setWorkflow(null)
  } else {
    filterStore.setWorkflow(value)
  }
}

const selectedDisplayName = computed(() => {
  if (!filterStore.workflow) return null
  return (
    options.value.find((o) => o.fingerprint === filterStore.workflow)
      ?.displayName ?? filterStore.workflow
  )
})
</script>
