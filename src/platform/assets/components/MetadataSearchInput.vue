<template>
  <div class="relative">
    <TagsInputRoot
      :model-value="tagValues"
      delimiter=""
      class="flex min-h-9 cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-comfy-input bg-secondary-background px-3 py-1.5"
      @remove-tag="onRemoveTag"
      @click="inputRef?.focus()"
    >
      <i
        class="pointer-events-none icon-[lucide--search] size-3.5 shrink-0 text-muted-foreground"
      />

      <!-- Applied filter chips -->
      <TagsInputItem
        v-for="filter in metadataFilters"
        :key="chipKey(filter)"
        :value="chipKey(filter)"
        class="-my-0.5 inline-flex items-center gap-1 rounded-md bg-base-background px-2 py-0.5 text-xs"
      >
        <span class="text-muted-foreground">
          {{ $t(`assets.metadata.${filter.field}`) }}:
        </span>
        <span>{{ filter.value }}</span>
        <TagsInputItemDelete
          class="ml-0.5 aspect-square cursor-pointer rounded-full border-none bg-transparent text-muted-foreground hover:text-base-foreground"
        >
          <i class="icon-[lucide--x] size-3" />
        </TagsInputItemDelete>
      </TagsInputItem>

      <!-- Active field badge -->
      <span
        v-if="activeField"
        class="-my-0.5 inline-flex shrink-0 items-center gap-1 rounded-md bg-base-background px-2 py-0.5 text-xs"
      >
        <span class="text-muted-foreground">
          {{ $t(`assets.metadata.${activeField}`) }}:
        </span>
        <button
          type="button"
          class="aspect-square cursor-pointer rounded-full border-none bg-transparent text-muted-foreground hover:text-base-foreground"
          :aria-label="$t('g.remove')"
          @click="cancelFieldMode"
        >
          <i class="icon-[lucide--x] size-3" />
        </button>
      </span>

      <TagsInputInput as-child>
        <input
          ref="inputRef"
          v-model="inputValue"
          type="text"
          :placeholder="inputPlaceholder"
          class="h-6 min-w-24 flex-1 border-none bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          @keydown="handleKeydown"
          @input="handleInput"
        />
      </TagsInputInput>
    </TagsInputRoot>

    <!-- Field selector dropdown -->
    <div
      v-if="showFieldDropdown"
      ref="dropdownRef"
      class="absolute inset-x-0 top-full z-50 mt-1 rounded-lg border border-comfy-input bg-modal-card-background shadow-lg"
    >
      <button
        v-for="(field, index) in METADATA_FIELDS"
        :key="field"
        type="button"
        :class="
          cn(
            'flex w-full cursor-pointer items-center gap-2 border-none px-3 py-2 text-left text-xs transition-colors',
            index === highlightedIndex
              ? 'bg-secondary-background-hover text-text-primary'
              : 'bg-transparent text-muted-foreground hover:bg-secondary-background-hover hover:text-text-primary',
            index === 0 && 'rounded-t-lg',
            index === METADATA_FIELDS.length - 1 && 'rounded-b-lg'
          )
        "
        @click="selectField(field)"
      >
        {{ $t(`assets.metadata.${field}`) }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import {
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputRoot
} from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  MetadataField,
  MetadataFilter
} from '@/platform/assets/types/metadataFilter'
import { METADATA_FIELDS } from '@/platform/assets/types/metadataFilter'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()

const searchQuery = defineModel<string>('searchQuery', { required: true })
const metadataFilters = defineModel<MetadataFilter[]>('metadataFilters', {
  required: true
})

const inputRef = ref<HTMLInputElement>()
const dropdownRef = ref<HTMLElement>()
const activeField = ref<MetadataField | null>(null)
const showFieldDropdown = ref(false)
const highlightedIndex = ref(0)

onClickOutside(
  dropdownRef,
  () => {
    showFieldDropdown.value = false
  },
  { ignore: [inputRef] }
)

const inputValue = computed({
  get: () => searchQuery.value,
  set: (value: string) => {
    searchQuery.value = value
  }
})

const inputPlaceholder = computed(() => {
  if (activeField.value) {
    return t('assets.metadata.enterValue', {
      field: t(`assets.metadata.${activeField.value}`).toLowerCase()
    })
  }
  return t('assets.metadata.searchPlaceholder')
})

const tagValues = computed(() => metadataFilters.value.map(chipKey))

function chipKey(filter: MetadataFilter): string {
  return `${filter.field}:${filter.value}`
}

function onRemoveTag(tagValue: string) {
  metadataFilters.value = metadataFilters.value.filter(
    (f) => chipKey(f) !== tagValue
  )
}

function selectField(field: MetadataField) {
  activeField.value = field
  showFieldDropdown.value = false
  searchQuery.value = ''
  inputRef.value?.focus()
}

function cancelFieldMode() {
  activeField.value = null
  showFieldDropdown.value = false
  inputRef.value?.focus()
}

function addFilter(field: MetadataField, value: string) {
  metadataFilters.value = [
    ...metadataFilters.value,
    { field, value: value.trim() }
  ]
  activeField.value = null
  searchQuery.value = ''
}

function handleInput(e: Event) {
  const input = e.target as HTMLInputElement
  const value = input.value

  if (!activeField.value && value.endsWith('@')) {
    searchQuery.value = value.slice(0, -1)
    showFieldDropdown.value = true
    highlightedIndex.value = 0
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (showFieldDropdown.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      highlightedIndex.value =
        (highlightedIndex.value + 1) % METADATA_FIELDS.length
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      highlightedIndex.value =
        (highlightedIndex.value - 1 + METADATA_FIELDS.length) %
        METADATA_FIELDS.length
    } else if (e.key === 'Enter') {
      e.preventDefault()
      selectField(METADATA_FIELDS[highlightedIndex.value])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      showFieldDropdown.value = false
    }
    return
  }

  if (activeField.value) {
    if (e.key === 'Enter' && searchQuery.value.trim()) {
      e.preventDefault()
      addFilter(activeField.value, searchQuery.value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelFieldMode()
    }
    return
  }

  if (
    e.key === 'Backspace' &&
    !searchQuery.value &&
    metadataFilters.value.length > 0
  ) {
    metadataFilters.value = metadataFilters.value.slice(0, -1)
  }
}

function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus })
</script>
