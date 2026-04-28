<template>
  <ComboboxRoot
    v-model:open="isOpen"
    v-model:search-term="searchQuery"
    ignore-filter
    :reset-search-term-on-blur="false"
    :reset-search-term-on-select="false"
  >
    <ComboboxAnchor as-child>
      <div
        class="flex min-h-9 cursor-text flex-wrap items-center gap-1 rounded-lg border border-comfy-input bg-secondary-background px-3 py-1"
        @click="focus"
      >
        <i
          class="pointer-events-none icon-[lucide--search] size-3.5 shrink-0 text-white"
        />

        <span
          :class="
            activeField
              ? '-my-0.5 flex min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-md bg-base-background px-2 py-0.5 text-xs'
              : 'flex min-w-0 flex-1 items-center'
          "
        >
          <span v-if="activeField" class="shrink-0 text-muted-foreground">
            {{ $t(`assets.metadata.${activeField}`) }}:
          </span>
          <ComboboxInput
            ref="inputRef"
            v-model="inputValue"
            type="text"
            :placeholder="inputPlaceholder"
            :class="
              cn(
                'flex-1 border-none bg-transparent text-xs outline-none placeholder:text-muted-foreground',
                activeField ? 'h-5 min-w-12' : 'h-6 min-w-24'
              )
            "
            @input="handleInput"
            @keydown="handleKeydown"
          />
          <button
            v-if="activeField"
            type="button"
            class="inline-flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-muted-foreground hover:text-base-foreground"
            :aria-label="$t('g.remove')"
            @click.stop="cancelFieldMode"
          >
            <i class="icon-[lucide--x] size-3" />
          </button>
        </span>
      </div>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        side="bottom"
        :side-offset="4"
        :collision-padding="8"
        data-capture-wheel="true"
        :style="{ zIndex: 2147483000 }"
        :class="
          cn(
            'max-h-72 w-(--reka-combobox-trigger-width) overflow-y-auto',
            'rounded-lg border border-border-default bg-base-background p-1 shadow-lg',
            'data-[side=top]:animate-slideDownAndFade data-[side=bottom]:animate-slideUpAndFade will-change-[opacity,transform]'
          )
        "
        @wheel.capture.stop.prevent="handlePopoverWheel"
        @open-auto-focus.prevent
        @close-auto-focus.prevent
      >
        <div
          v-if="groupedItems.length === 0"
          class="p-2 text-xs text-muted-foreground"
        >
          {{ $t('assets.metadata.noMatches') }}
        </div>
        <ComboboxGroup v-for="group in groupedItems" :key="group.key">
          <div
            class="px-2 pt-1.5 pb-1 text-2xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {{ $t(group.labelKey) }}
          </div>
          <ComboboxItem
            v-for="item in group.items"
            :key="item.value"
            :value="item.value"
            :class="
              cn(
                'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
                'data-highlighted:bg-secondary-background-hover data-highlighted:text-text-primary'
              )
            "
            @mousedown.prevent
            @select.prevent="item.onSelect()"
          >
            <span
              class="inline-flex shrink-0 items-center rounded-sm bg-modal-card-tag-background px-1.5 py-px font-mono text-2xs text-modal-card-tag-foreground"
            >
              {{ item.chip }}
            </span>
            <span
              v-if="item.description"
              class="truncate text-xs text-muted-foreground"
            >
              {{ item.description }}
            </span>
          </ComboboxItem>
        </ComboboxGroup>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import Fuse from 'fuse.js'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxPortal,
  ComboboxRoot
} from 'reka-ui'
import type { ComponentPublicInstance } from 'vue'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  MetadataField,
  MetadataFilter
} from '@/platform/assets/types/metadataFilter'
import {
  DATE_PRESETS,
  FAVORITE_FILTER_OPTIONS,
  MEDIA_TYPE_OPTIONS
} from '@/platform/assets/types/metadataFilter'
import { formatMetadataFilterValue } from '@/platform/assets/utils/metadataFilterFormat'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()

const { availableTags = [], availableValuesByField } = defineProps<{
  availableTags?: string[]
  availableValuesByField?: Record<'model' | 'lora' | 'workflowTitle', string[]>
}>()

const searchQuery = defineModel<string>('searchQuery', { required: true })
const metadataFilters = defineModel<MetadataFilter[]>('metadataFilters', {
  required: true
})
const composing = defineModel<boolean>('composing', { default: false })

const inputRef = useTemplateRef<ComponentPublicInstance>('inputRef')
const inputEl = computed<HTMLInputElement | null>(
  () => (inputRef.value?.$el as HTMLInputElement | null) ?? null
)
const activeField = ref<MetadataField | null>(null)
const isOpen = ref(false)
const triggerMode = ref<'field' | 'options' | null>(null)
// Swallow the Enter that just selected a field, so it doesn't also commit a
// free-text filter using the old search query (Reka's select runs inside the
// same keydown and our @keydown fires afterwards).
let consumeNextEnter = false

const RECENT_MAX = 5
const recentByField = useStorage<Partial<Record<MetadataField, string[]>>>(
  'Comfy.Assets.RecentMetadataValues',
  {}
)

const METADATA_GROUP: MetadataField[] = [
  'model',
  'lora',
  'workflowTitle',
  'prompt'
]
const ATTRIBUTES_GROUP: MetadataField[] = ['date', 'tag', 'type', 'favorite']
const CUSTOM_VALUE_KEY = '__custom__'
const FUSE_OPTIONS = { threshold: 0.4, keys: ['label'], includeScore: true }

interface SuggestionItem {
  value: string
  chip: string
  description?: string
  onSelect: () => void
}

interface SuggestionGroup {
  key: string
  labelKey: string
  items: SuggestionItem[]
}

interface LabelledValue {
  value: string
  label: string
}

function fieldHasOptions(field: MetadataField): boolean {
  return (
    field === 'date' ||
    field === 'tag' ||
    field === 'type' ||
    field === 'favorite' ||
    field === 'model' ||
    field === 'lora' ||
    field === 'workflowTitle'
  )
}

function fieldAllowsCustom(field: MetadataField): boolean {
  return (
    field === 'model' ||
    field === 'lora' ||
    field === 'workflowTitle' ||
    field === 'prompt'
  )
}

const fieldOptions = computed<LabelledValue[]>(() => {
  if (activeField.value === 'date') {
    return DATE_PRESETS.map((preset) => ({
      value: preset,
      label: t(`assets.metadata.datePresets.${preset}`)
    }))
  }
  if (activeField.value === 'tag') {
    return availableTags.map((tag) => ({ value: tag, label: tag }))
  }
  if (activeField.value === 'type') {
    return MEDIA_TYPE_OPTIONS.map((type) => ({
      value: type,
      label: t(`assets.metadata.mediaTypes.${type}`)
    }))
  }
  if (activeField.value === 'favorite') {
    return FAVORITE_FILTER_OPTIONS.map((color) => ({
      value: color,
      label: t(`assets.metadata.favoriteColors.${color}`)
    }))
  }
  if (
    activeField.value === 'model' ||
    activeField.value === 'lora' ||
    activeField.value === 'workflowTitle'
  ) {
    const values = availableValuesByField?.[activeField.value] ?? []
    return values.map((v) => ({ value: v, label: v }))
  }
  return []
})

function fuzzyFilter<T extends { label: string }>(
  items: readonly T[],
  query: string
): T[] {
  if (!query) return [...items]
  const fuse = new Fuse(items, FUSE_OPTIONS)
  return fuse.search(query).map((r) => r.item)
}

function recentItemsForActiveField(query: string): SuggestionItem[] {
  const field = activeField.value
  if (!field) return []
  const recents = (recentByField.value[field] ?? []).map((v) => ({
    value: v,
    label: formatMetadataFilterValue(t, field, v)
  }))
  if (recents.length === 0) return []
  return fuzzyFilter(recents, query).map((r) => ({
    value: `recent:${r.value}`,
    chip: r.label,
    onSelect: () => selectOption(r.value)
  }))
}

function buildFieldItem(field: MetadataField): SuggestionItem {
  return {
    value: `field:${field}`,
    chip: t(`assets.metadata.${field}`),
    description: t(`assets.metadata.descriptions.${field}`),
    onSelect: () => selectField(field)
  }
}

const groupedItems = computed<SuggestionGroup[]>(() => {
  const query = searchQuery.value.trim()

  if (triggerMode.value === 'options' && activeField.value) {
    const field = activeField.value

    const recentItems = recentItemsForActiveField(query)
    const recentKeys = new Set((recentByField.value[field] ?? []).map((v) => v))

    const valueItems = fuzzyFilter(fieldOptions.value, query)
      .filter((opt) => !recentKeys.has(opt.value))
      .map<SuggestionItem>((opt) => ({
        value: `opt:${opt.value}`,
        chip: opt.label,
        onSelect: () => selectOption(opt.value)
      }))

    const groups: SuggestionGroup[] = []
    if (recentItems.length > 0) {
      groups.push({
        key: 'recent',
        labelKey: 'assets.metadata.group.recent',
        items: recentItems
      })
    }
    if (valueItems.length > 0) {
      groups.push({
        key: 'values',
        labelKey: 'assets.metadata.group.values',
        items: valueItems
      })
    }

    if (fieldAllowsCustom(field) && query) {
      const exactMatch =
        fieldOptions.value.some(
          (o) => o.label.toLowerCase() === query.toLowerCase()
        ) ||
        (recentByField.value[field] ?? []).some(
          (v) => v.toLowerCase() === query.toLowerCase()
        )
      if (!exactMatch) {
        groups.push({
          key: 'custom',
          labelKey: 'assets.metadata.group.custom',
          items: [
            {
              value: CUSTOM_VALUE_KEY,
              chip: query,
              description: t('assets.metadata.addCustom'),
              onSelect: () => addFilter(field, query)
            }
          ]
        })
      }
    }

    return groups
  }

  if (triggerMode.value === 'field') {
    const metaItems = fuzzyFilter(
      METADATA_GROUP.map((f) => ({
        field: f,
        label: t(`assets.metadata.${f}`)
      })),
      query
    ).map((i) => buildFieldItem(i.field))
    const attrItems = fuzzyFilter(
      ATTRIBUTES_GROUP.map((f) => ({
        field: f,
        label: t(`assets.metadata.${f}`)
      })),
      query
    ).map((i) => buildFieldItem(i.field))

    const groups: SuggestionGroup[] = []
    if (metaItems.length > 0) {
      groups.push({
        key: 'metadata',
        labelKey: 'assets.metadata.group.metadata',
        items: metaItems
      })
    }
    if (attrItems.length > 0) {
      groups.push({
        key: 'attributes',
        labelKey: 'assets.metadata.group.attributes',
        items: attrItems
      })
    }
    return groups
  }

  return []
})

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
  if (metadataFilters.value.length > 0) return ''
  return t('assets.metadata.searchPlaceholder')
})

function pushRecent(field: MetadataField, value: string) {
  const current = recentByField.value[field] ?? []
  const next = [value, ...current.filter((v) => v !== value)].slice(
    0,
    RECENT_MAX
  )
  recentByField.value = { ...recentByField.value, [field]: next }
}

function selectField(field: MetadataField) {
  activeField.value = field
  searchQuery.value = ''
  consumeNextEnter = true
  if (fieldHasOptions(field)) {
    triggerMode.value = 'options'
    isOpen.value = true
  } else {
    triggerMode.value = null
    isOpen.value = false
  }
  inputEl.value?.focus()
}

function cancelFieldMode() {
  activeField.value = null
  triggerMode.value = null
  isOpen.value = false
  inputEl.value?.focus()
}

function selectOption(value: string) {
  if (!activeField.value) return
  addFilter(activeField.value, value)
}

function addFilter(field: MetadataField, value: string) {
  const trimmed = value.trim()
  if (!trimmed) return
  metadataFilters.value = [...metadataFilters.value, { field, value: trimmed }]
  pushRecent(field, trimmed)
  activeField.value = null
  triggerMode.value = null
  isOpen.value = false
  searchQuery.value = ''
}

function handleInput(e: Event) {
  consumeNextEnter = false
  const input = e.target as HTMLInputElement
  const value = input.value

  if (!activeField.value && value.endsWith('@')) {
    searchQuery.value = value.slice(0, -1)
    triggerMode.value = 'field'
    isOpen.value = true
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && consumeNextEnter) {
    consumeNextEnter = false
    e.preventDefault()
    return
  }

  if (e.key === 'Tab' && isOpen.value) {
    e.preventDefault()
    const target = e.target as HTMLInputElement
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true
      })
    )
    return
  }

  if (
    e.key === 'Enter' &&
    activeField.value &&
    !fieldHasOptions(activeField.value) &&
    searchQuery.value.trim()
  ) {
    e.preventDefault()
    addFilter(activeField.value, searchQuery.value)
    return
  }

  if (e.key === 'Escape' && activeField.value && !isOpen.value) {
    e.preventDefault()
    cancelFieldMode()
    return
  }

  if (
    e.key === 'Backspace' &&
    !searchQuery.value &&
    !activeField.value &&
    metadataFilters.value.length > 0
  ) {
    metadataFilters.value = metadataFilters.value.slice(0, -1)
  }
}

function handlePopoverWheel(event: WheelEvent) {
  const el = event.currentTarget as HTMLElement | null
  if (!el) return
  el.scrollTop += event.deltaY
  el.scrollLeft += event.deltaX
}

watch(isOpen, (open) => {
  if (open) return
  if (triggerMode.value === 'field') {
    triggerMode.value = null
  } else if (triggerMode.value === 'options' && !activeField.value) {
    triggerMode.value = null
  }
})

watch(
  [activeField, isOpen],
  ([field, open]) => {
    composing.value = field !== null || open
  },
  { immediate: true }
)

function focus() {
  inputEl.value?.focus()
}

defineExpose({ focus })
</script>
