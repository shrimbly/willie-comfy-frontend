<template>
  <WidgetLayoutField :widget="layoutWidget">
    <PopoverRoot v-model:open="autocomplete.isOpen.value">
      <PopoverAnchor as-child>
        <div class="relative">
          <!-- Display mode: badges for variables -->
          <div
            v-if="!isEditing"
            v-tooltip="tooltipText"
            :class="
              cn(
                WidgetInputBaseClass,
                'flex w-full cursor-text items-center gap-0.5 overflow-hidden px-4 hover:bg-component-node-widget-background-hovered',
                size === 'large' ? 'py-3 text-sm' : 'py-2 text-xs'
              )
            "
            :aria-label="widget.name"
            @click="startEditing"
          >
            <template v-if="segments.length > 0">
              <template v-for="(seg, i) in segments" :key="i">
                <span
                  v-if="seg.type === 'variable'"
                  class="inline-flex shrink-0 items-center rounded-sm bg-modal-card-tag-background px-1.5 py-px text-2xs text-modal-card-tag-foreground"
                >
                  {{ seg.name }}
                </span>
                <span v-else class="truncate">{{ seg.value }}</span>
              </template>
            </template>
            <span v-else class="truncate opacity-50">
              {{ widget.name }}
            </span>
          </div>

          <!-- Edit mode: raw input with autocomplete -->
          <input
            v-else
            ref="inputRef"
            v-model="modelValue"
            :class="
              cn(
                WidgetInputBaseClass,
                'w-full px-4 hover:bg-component-node-widget-background-hovered',
                size === 'large' ? 'py-3 text-sm' : 'py-2 text-xs'
              )
            "
            :aria-label="widget.name"
            :readonly="isReadOnly"
            @input="autocomplete.handleInput"
            @keydown="autocomplete.handleKeydown"
            @blur="isEditing = false"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        side="bottom"
        :side-offset="4"
        :collision-padding="8"
        :class="
          cn(
            'z-1700 max-h-48 overflow-y-auto rounded-lg border',
            'border-border-subtle bg-base-background p-2 shadow-sm',
            'data-[side=top]:animate-slideDownAndFade data-[side=bottom]:animate-slideUpAndFade will-change-[opacity,transform]'
          )
        "
        @open-auto-focus.prevent
      >
        <div
          v-for="(variable, index) in autocomplete.filteredSuggestions.value"
          :key="variable.name"
          :class="
            cn(
              'flex cursor-pointer flex-col gap-0.5 rounded-lg p-2 leading-none',
              index === autocomplete.highlightIndex.value &&
                'bg-secondary-background-hover'
            )
          "
          @pointerdown.prevent="autocomplete.selectSuggestion(variable)"
        >
          <span class="text-sm">{{ variable.name }}</span>
          <span class="text-xs text-muted-foreground">
            {{ $t(variable.description) }}
          </span>
        </div>
      </PopoverContent>
    </PopoverRoot>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { PopoverAnchor, PopoverContent, PopoverRoot } from 'reka-ui'
import { computed, nextTick, ref, useTemplateRef } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { stripGraphPrefix } from '@/stores/widgetValueStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  parseTemplateSegments,
  previewResolvedValue
} from '@/utils/templateVariableResolver'
import { cn } from '@/utils/tailwindUtil'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'
import { useTemplateAutocomplete } from '../composables/useTemplateAutocomplete'

const { widget, size = 'medium' } = defineProps<{
  widget: SimplifiedWidget<string>
  size?: 'medium' | 'large'
}>()

const modelValue = defineModel<string>({ default: '' })

const isEditing = ref(false)
const inputRef = useTemplateRef<HTMLInputElement>('inputRef')

const autocomplete = useTemplateAutocomplete(modelValue, inputRef)

const isReadOnly = computed(() =>
  Boolean(widget.options?.read_only || widget.options?.disabled)
)

const segments = computed(() => parseTemplateSegments(modelValue.value))

const tooltipText = computed(() => {
  if (!modelValue.value) return undefined
  const canvasStore = useCanvasStore()
  const graph = canvasStore.canvas?.graph
  if (!graph || !widget.nodeLocatorId) return modelValue.value

  const nodeId = stripGraphPrefix(widget.nodeLocatorId)
  const node = graph.getNodeById(Number(nodeId))
  if (!node) return modelValue.value

  return previewResolvedValue(graph, node, modelValue.value)
})

const layoutWidget = computed(() => ({
  name: widget.name,
  label: widget.label,
  borderStyle: widget.borderStyle
}))

async function startEditing() {
  if (isReadOnly.value) return
  isEditing.value = true
  await nextTick()
  inputRef.value?.focus()
}
</script>
