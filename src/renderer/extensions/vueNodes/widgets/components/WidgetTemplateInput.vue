<template>
  <WidgetLayoutField :widget="layoutWidget">
    <ComboboxRoot
      v-model:open="autocomplete.isOpen.value"
      ignore-filter
      :reset-search-term-on-blur="false"
      :reset-search-term-on-select="false"
      :disabled="isReadOnly"
    >
      <div :class="cn(WidgetInputBaseClass, 'flex w-full')">
        <ComboboxAnchor as-child>
          <div class="relative min-w-0 flex-1">
            <div
              v-if="!isEditing"
              v-tooltip="tooltipText"
              :class="
                cn(
                  'flex w-full cursor-text items-center gap-0.5 overflow-hidden rounded-l-lg px-4 hover:bg-component-node-widget-background-hovered',
                  size === 'large' ? 'py-3 text-sm' : 'py-2 text-xs'
                )
              "
              :aria-label="widget.name"
              @click="startEditing"
            >
              <template v-if="segments.length > 0">
                <template v-for="(seg, i) in segments" :key="i">
                  <span
                    v-if="seg.type === 'directory'"
                    v-tooltip="seg.path"
                    :class="
                      cn(
                        'inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-px text-2xs',
                        seg.isAbsolute
                          ? 'bg-(--color-azure-300) text-charcoal-800'
                          : 'bg-modal-card-tag-background text-modal-card-tag-foreground'
                      )
                    "
                  >
                    <i class="icon-[lucide--folder] size-3" />
                    {{ truncateDirectoryPath(seg.path) }}
                    <button
                      type="button"
                      class="-mr-0.5 ml-0.5 inline-flex items-center opacity-70 hover:opacity-100"
                      :aria-label="t('templateVariables.removeDirectory')"
                      @click.stop="removeDirectory"
                    >
                      <i class="icon-[lucide--x] size-3" />
                    </button>
                  </span>
                  <span
                    v-else-if="seg.type === 'variable'"
                    :class="
                      cn(
                        'inline-flex shrink-0 items-center rounded-sm px-1.5 py-px text-2xs',
                        seg.missing
                          ? 'bg-destructive-background text-white'
                          : isCustomSegment(seg)
                            ? 'bg-(--color-azure-300) text-charcoal-800'
                            : 'bg-modal-card-tag-background text-modal-card-tag-foreground'
                      )
                    "
                  >
                    {{ segmentChipLabel(seg) }}
                  </span>
                  <span v-else class="truncate">{{ seg.value }}</span>
                </template>
              </template>
              <span v-else class="truncate opacity-50">
                {{ widget.name }}
              </span>
            </div>

            <ComboboxInput
              v-else
              ref="inputRef"
              v-model="modelValue"
              :class="
                cn(
                  'w-full rounded-l-lg bg-transparent px-4 hover:bg-component-node-widget-background-hovered',
                  size === 'large' ? 'py-3 text-sm' : 'py-2 text-xs'
                )
              "
              :aria-label="widget.name"
              :disabled="isReadOnly"
              @input="autocomplete.handleInput"
              @keydown="onInputKeydown"
              @blur="isEditing = false"
            />
          </div>
        </ComboboxAnchor>
        <button
          type="button"
          :disabled="isReadOnly"
          :aria-label="t('templateVariables.selectDirectory')"
          :class="
            cn(
              'flex w-8 shrink-0 items-center justify-center self-stretch rounded-r-lg border-0 border-l border-node-component-border outline-none',
              'bg-component-node-widget-background text-text-secondary hover:bg-component-node-widget-background-hovered',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )
          "
          @click.stop="onPickDirectory"
          @mousedown.prevent
        >
          <i class="icon-[lucide--folder-search] size-4" />
        </button>
      </div>
      <ComboboxContent
        position="popper"
        side="bottom"
        :side-offset="4"
        :collision-padding="8"
        :class="
          cn(
            'z-1700 max-h-72 w-max max-w-sm min-w-(--reka-combobox-trigger-width) overflow-y-auto',
            'rounded-lg border border-border-default bg-base-background p-1 shadow-lg',
            'data-[side=top]:animate-slideDownAndFade data-[side=bottom]:animate-slideUpAndFade will-change-[opacity,transform]'
          )
        "
        @open-auto-focus.prevent
        @close-auto-focus.prevent
      >
        <div
          v-if="groupedSuggestions.length === 0"
          class="p-2 text-xs text-muted-foreground"
        >
          {{ $t('templateVariables.noMatches') }}
        </div>
        <ComboboxGroup v-for="group in groupedSuggestions" :key="group.group">
          <div
            class="px-2 pt-1.5 pb-1 text-2xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {{ $t(`templateVariables.group.${group.group}`) }}
          </div>
          <ComboboxItem
            v-for="suggestion in group.items"
            :key="suggestion.key"
            :value="suggestion.key"
            :class="
              cn(
                'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
                'data-highlighted:bg-secondary-background-hover data-highlighted:text-text-primary'
              )
            "
            @mousedown.prevent
            @select.prevent="autocomplete.selectSuggestion(suggestion)"
          >
            <span
              :class="
                cn(
                  'inline-flex shrink-0 items-center rounded-sm px-1.5 py-px font-mono text-2xs',
                  suggestion.isCustom
                    ? 'bg-(--color-azure-300) text-charcoal-800'
                    : 'bg-modal-card-tag-background text-modal-card-tag-foreground'
                )
              "
            >
              {{ suggestion.label }}
            </span>
            <span
              v-if="suggestion.description"
              class="truncate text-xs text-muted-foreground"
            >
              {{ suggestion.description }}
            </span>
          </ComboboxItem>
        </ComboboxGroup>
      </ComboboxContent>
    </ComboboxRoot>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot
} from 'reka-ui'
import type { ComponentPublicInstance } from 'vue'
import {
  computed,
  nextTick,
  onScopeDispose,
  ref,
  useTemplateRef,
  watchEffect
} from 'vue'
import { useI18n } from 'vue-i18n'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWidgetValidationStore } from '@/stores/widgetValidationStore'
import { stripGraphPrefix } from '@/stores/widgetValueStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { isElectron, pickDirectory } from '@/utils/directoryPickerUtil'
import { applyTextReplacements } from '@/utils/searchAndReplace'
import type { TemplateSegment } from '@/utils/templateVariableResolver'
import {
  getCustomTemplateVariableValues,
  isAbsolutePath,
  parseTemplateSegments,
  previewResolvedValue,
  removeLeadingDirectoryToken,
  resolveDirectoryTokens,
  setLeadingDirectoryToken,
  truncateDirectoryPath
} from '@/utils/templateVariableResolver'
import { cn } from '@/utils/tailwindUtil'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'
import { useTemplateAutocomplete } from '../composables/useTemplateAutocomplete'
import {
  buildTemplateSuggestions,
  groupSuggestions
} from '../composables/templateSuggestions'

const { widget, size = 'medium' } = defineProps<{
  widget: SimplifiedWidget<string>
  size?: 'medium' | 'large'
}>()

const modelValue = defineModel<string>({ default: '' })

const { t } = useI18n()
const canvasStore = useCanvasStore()

const isEditing = ref(false)
const inputRef = useTemplateRef<ComponentPublicInstance>('inputRef')
const inputEl = computed<HTMLInputElement | null>(
  () => (inputRef.value?.$el as HTMLInputElement | null) ?? null
)

const allSuggestions = computed(() =>
  buildTemplateSuggestions(canvasStore.canvas?.graph ?? null, t)
)

const autocomplete = useTemplateAutocomplete(
  modelValue,
  inputEl,
  allSuggestions
)

const groupedSuggestions = computed(() =>
  groupSuggestions(autocomplete.filteredSuggestions.value)
)

const isReadOnly = computed(() =>
  Boolean(widget.options?.read_only || widget.options?.disabled)
)

const segments = computed(() => parseTemplateSegments(modelValue.value))

const customVariableMap = computed(() => {
  const map = new Map<string, string>()
  for (const v of getCustomTemplateVariableValues()) {
    map.set(v.name, v.value)
  }
  return map
})

function isCustomSegment(seg: TemplateSegment): boolean {
  if (seg.type !== 'variable') return false
  return seg.prefix === '@' && customVariableMap.value.has(seg.name)
}

function segmentChipLabel(seg: TemplateSegment & { type: 'variable' }): string {
  if (isCustomSegment(seg)) {
    const value = customVariableMap.value.get(seg.name)
    if (value) return `${seg.name}: ${value}`
  }
  return seg.name
}

const validationStore = useWidgetValidationStore()

const hasInvalidRefs = computed(() =>
  segments.value.some((s) => s.type === 'variable' && s.missing)
)

watchEffect(() => {
  const locatorId = widget.nodeLocatorId
  if (!locatorId) return
  const invalid = !isEditing.value && hasInvalidRefs.value
  validationStore.setNodeInvalid(locatorId, invalid)
})

onScopeDispose(() => {
  const locatorId = widget.nodeLocatorId
  if (locatorId) validationStore.setNodeInvalid(locatorId, false)
})

const tooltipText = computed(() => {
  if (!modelValue.value) return undefined
  const graph = canvasStore.canvas?.graph
  const withDir = resolveDirectoryTokens(modelValue.value)
  if (!graph || !widget.nodeLocatorId) return withDir

  const nodeId = stripGraphPrefix(widget.nodeLocatorId)
  const node = graph.getNodeById(Number(nodeId))
  if (!node) return withDir

  const withVars = previewResolvedValue(graph, node, withDir)
  return applyTextReplacements(graph, withVars)
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
  inputEl.value?.focus()
}

function onInputKeydown(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !autocomplete.isOpen.value) return
  e.preventDefault()
  const target = e.target as HTMLInputElement
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    })
  )
}

async function onPickDirectory() {
  if (isReadOnly.value) return
  const selected = await chooseDirectoryPath()
  if (!selected) return
  modelValue.value = setLeadingDirectoryToken(modelValue.value, selected)
}

async function chooseDirectoryPath(): Promise<string | null> {
  if (isElectron()) {
    try {
      const result = await pickDirectory()
      if (result.path && isAbsolutePath(result.path)) return result.path
      // Electron IPC may have failed silently, falling through to browser
      // methods that can't expose the full path. Fall back to prompt.
    } catch (err) {
      if (err instanceof Error && /cancel/i.test(err.message)) return null
      console.error('Directory selection failed:', err)
    }
  }
  // Browsers can't expose absolute paths via the File System Access API,
  // so prompt the user to paste/type the path instead.
  const currentLeadingPath = leadingDirectoryPath(modelValue.value)
  const input = window.prompt(
    t('templateVariables.pasteDirectoryPath'),
    currentLeadingPath ?? ''
  )
  if (input === null) return null
  const trimmed = input.trim()
  return trimmed.length > 0 ? trimmed : null
}

function leadingDirectoryPath(value: string): string | null {
  const match = /^%dir:([^%]+)%/.exec(value)
  return match ? match[1] : null
}

function removeDirectory() {
  modelValue.value = removeLeadingDirectoryToken(modelValue.value)
}
</script>
