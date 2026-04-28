<template>
  <div class="col-span-2 grid grid-cols-subgrid items-stretch gap-y-1">
    <WidgetLayoutField :widget="saveToLayoutWidget" root-class="col-span-2">
      <PopoverRoot v-model:open="isDirectoryPickerOpen">
        <PopoverTrigger as-child>
          <button
            type="button"
            :disabled="isReadOnly"
            :aria-label="t('templateVariables.selectDirectory')"
            :class="
              cn(
                WidgetInputBaseClass,
                'flex w-full items-center gap-2 px-4 text-left outline-none',
                'hover:bg-component-node-widget-background-hovered',
                'disabled:cursor-not-allowed disabled:opacity-50',
                size === 'large' ? 'py-3 text-sm' : 'py-2 text-xs'
              )
            "
          >
            <span
              :class="cn('min-w-0 flex-1 truncate', !dirValue && 'opacity-50')"
            >
              {{
                dirValue
                  ? `${SAVE_PATH_PREFIX}${dirValue}`
                  : t('templateVariables.pickAFolder')
              }}
            </span>
            <i
              class="icon-[lucide--folder-search] size-4 shrink-0 text-base-foreground"
            />
          </button>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            side="bottom"
            align="end"
            :side-offset="4"
            :collision-padding="8"
            data-capture-wheel="true"
            :style="{ zIndex: 2147483000 }"
            :class="
              cn(
                'flex max-h-72 w-64 flex-col',
                'rounded-lg border border-border-default bg-base-background shadow-lg',
                'data-[side=top]:animate-slideDownAndFade data-[side=bottom]:animate-slideUpAndFade will-change-[opacity,transform]'
              )
            "
            @wheel.capture.stop.prevent="handlePopoverWheel"
          >
            <div ref="treeScrollRef" class="min-h-0 flex-1 overflow-y-auto p-1">
              <div
                v-if="outputSubdirectoriesLoading"
                class="px-2 py-1.5 text-xs text-muted-foreground"
              >
                {{ t('templateVariables.loadingDirectories') }}
              </div>
              <FolderTreeNode
                v-else
                :node="outputFolderTree"
                :selected-path="selectedTreePath"
                :depth="0"
                :expanded-depth="1"
                @select="handleFolderSelect"
              />
            </div>
            <div class="flex shrink-0 items-center gap-1 p-1">
              <template v-if="addFolderStage === 'idle'">
                <Button
                  variant="secondary"
                  size="md"
                  :disabled="isReadOnly || !dirValue"
                  class="flex-1"
                  @click="clearDirectory"
                >
                  <i class="icon-[lucide--x] size-3.5" />
                  {{ t('g.clear') }}
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  :disabled="isReadOnly"
                  class="flex-1"
                  @click="startAddFolder"
                >
                  <i class="icon-[lucide--folder-plus] size-3.5" />
                  {{ t('templateVariables.addFolder') }}
                </Button>
              </template>
              <template v-else-if="addFolderStage === 'pick-parent'">
                <span class="flex-1 px-2 text-xs text-muted-foreground">
                  {{ t('templateVariables.clickToChooseLocation') }}
                </span>
                <Button
                  variant="textonly"
                  size="md"
                  :aria-label="t('g.cancel')"
                  @click="cancelAddFolder"
                >
                  {{ t('g.cancel') }}
                </Button>
              </template>
              <template v-else>
                <div
                  :class="
                    cn(
                      WidgetInputBaseClass,
                      'flex flex-1 items-center gap-2 px-4 py-2 text-xs focus-within:bg-component-node-widget-background-hovered hover:bg-component-node-widget-background-hovered'
                    )
                  "
                >
                  <input
                    ref="newFolderInputRef"
                    v-model="newFolderName"
                    type="text"
                    :placeholder="t('templateVariables.newFolderName')"
                    :aria-label="t('templateVariables.newFolderName')"
                    class="min-w-0 flex-1 border-none bg-transparent p-0 outline-none placeholder:text-muted-foreground"
                    @keydown.enter.prevent="confirmAddFolder"
                    @keydown.escape.prevent="cancelAddFolder"
                  />
                  <button
                    type="button"
                    :disabled="!newFolderName.trim()"
                    :aria-label="t('g.confirm')"
                    class="inline-flex shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 leading-none text-base-foreground opacity-70 outline-none hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                    @mousedown.prevent
                    @click="confirmAddFolder"
                  >
                    <i class="icon-[lucide--check] size-4" />
                  </button>
                  <button
                    type="button"
                    :aria-label="t('g.cancel')"
                    class="inline-flex shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 leading-none text-base-foreground opacity-70 outline-none hover:opacity-100"
                    @mousedown.prevent
                    @click="cancelAddFolder"
                  >
                    <i class="icon-[lucide--x] size-4" />
                  </button>
                </div>
              </template>
            </div>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>
    </WidgetLayoutField>
    <WidgetLayoutField
      v-tooltip.bottom="pathTooltip"
      :widget="layoutWidget"
      root-class="col-span-2"
    >
      <ComboboxRoot
        v-model:open="autocomplete.isOpen.value"
        ignore-filter
        :reset-search-term-on-blur="false"
        :reset-search-term-on-select="false"
        :disabled="isReadOnly"
        data-capture-wheel="true"
      >
        <div :class="cn(WidgetInputBaseClass, 'flex w-full')">
          <ComboboxAnchor as-child>
            <div class="relative min-w-0 flex-1">
              <div
                v-if="!isEditing"
                :class="
                  cn(
                    'flex w-full cursor-text items-center gap-0.5 overflow-hidden rounded-lg px-4 hover:bg-component-node-widget-background-hovered',
                    size === 'large' ? 'py-3 text-sm' : 'py-2 text-xs'
                  )
                "
                :aria-label="widget.name"
                @click="startEditing"
              >
                <template v-if="filenameSegments.length > 0">
                  <template v-for="(seg, i) in filenameSegments" :key="i">
                    <span
                      v-if="seg.type === 'variable'"
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
                    <span v-else-if="seg.type === 'text'" class="truncate">{{
                      seg.value
                    }}</span>
                  </template>
                </template>
                <span v-else class="truncate opacity-50">
                  {{ widget.name }}
                </span>
              </div>

              <ComboboxInput
                v-else
                ref="inputRef"
                v-model="filenameValue"
                :class="
                  cn(
                    'w-full rounded-lg bg-transparent px-4 hover:bg-component-node-widget-background-hovered',
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
        </div>
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
                'max-h-72 w-max max-w-sm min-w-(--reka-combobox-trigger-width) overflow-y-auto',
                'rounded-lg border border-border-default bg-base-background p-1 shadow-lg',
                'data-[side=top]:animate-slideDownAndFade data-[side=bottom]:animate-slideUpAndFade will-change-[opacity,transform]'
              )
            "
            @wheel.capture.stop.prevent="handlePopoverWheel"
            @open-auto-focus.prevent
            @close-auto-focus.prevent
          >
            <div
              v-if="groupedSuggestions.length === 0"
              class="p-2 text-xs text-muted-foreground"
            >
              {{ $t('templateVariables.noMatches') }}
            </div>
            <ComboboxGroup
              v-for="group in groupedSuggestions"
              :key="group.group"
            >
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
        </ComboboxPortal>
      </ComboboxRoot>
    </WidgetLayoutField>
  </div>
</template>

<script setup lang="ts">
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxPortal,
  ComboboxRoot,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import type { ComponentPublicInstance } from 'vue'
import {
  computed,
  nextTick,
  onScopeDispose,
  ref,
  useTemplateRef,
  watch,
  watchEffect
} from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import FolderTreeNode from '@/platform/assets/components/FolderTreeNode.vue'
import type { FolderTreeNodeType } from '@/platform/assets/components/FolderTreeNode.vue'
import { buildOutputFolderTree } from '@/platform/assets/utils/buildOutputFolderTree'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAssetsStore } from '@/stores/assetsStore'
import { useWidgetValidationStore } from '@/stores/widgetValidationStore'
import { stripGraphPrefix } from '@/stores/widgetValueStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { applyTextReplacements } from '@/utils/searchAndReplace'
import type { TemplateSegment } from '@/utils/templateVariableResolver'
import {
  getCustomTemplateVariableValues,
  parseTemplateSegments,
  previewResolvedValue,
  resolveDirectoryTokens
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

function splitDirectoryAndFilename(value: string): {
  dir: string
  filename: string
} {
  let inToken = false
  let lastSlashIdx = -1
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    if (ch === '%') inToken = !inToken
    else if ((ch === '/' || ch === '\\') && !inToken) lastSlashIdx = i
  }
  if (lastSlashIdx === -1) return { dir: '', filename: value }
  return {
    dir: value.substring(0, lastSlashIdx),
    filename: value.substring(lastSlashIdx + 1)
  }
}

function joinDirectoryAndFilename(dir: string, filename: string): string {
  return dir ? `${dir}/${filename}` : filename
}

const splitValue = computed(() => splitDirectoryAndFilename(modelValue.value))

const dirValue = computed<string>({
  get: () => splitValue.value.dir,
  set: (newDir) => {
    modelValue.value = joinDirectoryAndFilename(
      newDir,
      splitValue.value.filename
    )
  }
})

const filenameValue = computed<string>({
  get: () => splitValue.value.filename,
  set: (newFilename) => {
    modelValue.value = joinDirectoryAndFilename(
      splitValue.value.dir,
      newFilename
    )
  }
})

const currentNode = computed(() => {
  const graph = canvasStore.canvas?.graph
  if (!graph || !widget.nodeLocatorId) return null
  const nodeId = stripGraphPrefix(widget.nodeLocatorId)
  return graph.getNodeById(Number(nodeId)) ?? null
})

const allSuggestions = computed(() =>
  buildTemplateSuggestions(
    canvasStore.canvas?.graph ?? null,
    t,
    currentNode.value
  )
)

const autocomplete = useTemplateAutocomplete(
  filenameValue,
  inputEl,
  allSuggestions
)

const groupedSuggestions = computed(() =>
  groupSuggestions(autocomplete.filteredSuggestions.value)
)

const isReadOnly = computed(() =>
  Boolean(widget.options?.read_only || widget.options?.disabled)
)

const filenameSegments = computed(() => {
  const graph = canvasStore.canvas?.graph
  const node = currentNode.value
  const context = graph && node ? { graph, node } : undefined
  return parseTemplateSegments(filenameValue.value, context)
})

const allSegments = computed(() => {
  const graph = canvasStore.canvas?.graph
  const node = currentNode.value
  const context = graph && node ? { graph, node } : undefined
  return parseTemplateSegments(
    resolveDirectoryTokens(modelValue.value),
    context
  )
})

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
  allSegments.value.some((s) => s.type === 'variable' && s.missing)
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

const SAVE_PATH_PREFIX = 'ComfyUI/output/'

const pathTooltip = computed(() => {
  const hasDir = !!dirValue.value
  const hasTokens = /[@%]/.test(filenameValue.value)
  if (!hasDir && !hasTokens) return widget.tooltip || undefined

  const withDir = resolveDirectoryTokens(modelValue.value)
  const graph = canvasStore.canvas?.graph
  const node = currentNode.value
  if (!graph || !node) return `${SAVE_PATH_PREFIX}${withDir}`

  const withVars = previewResolvedValue(graph, node, withDir)
  return `${SAVE_PATH_PREFIX}${applyTextReplacements(graph, withVars)}`
})

const layoutWidget = computed(() => ({
  name: widget.name,
  label: widget.label,
  borderStyle: widget.borderStyle
}))

const saveToLayoutWidget = computed(() => ({
  name: t('templateVariables.saveTo'),
  label: t('templateVariables.saveTo'),
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

const assetsStore = useAssetsStore()
const isDirectoryPickerOpen = ref(false)
const outputSubdirectoriesLoading = computed(
  () => assetsStore.historyLoading && assetsStore.historyAssets.length === 0
)

const OUTPUT_ROOT_PATH = 'output'
const OUTPUT_ROOT_PREFIX = `${OUTPUT_ROOT_PATH}/`

const outputFolderTree = computed<FolderTreeNodeType>(() =>
  buildOutputFolderTree(
    assetsStore.historyAssets.map((a) => a.name),
    { name: t('templateVariables.outputRoot'), path: OUTPUT_ROOT_PATH }
  )
)

const isAddingFolder = ref(false)
const addFolderParentPath = ref<string | null>(null)
const newFolderName = ref('')
const newFolderInputRef = useTemplateRef<HTMLInputElement>('newFolderInputRef')
const treeScrollRef = useTemplateRef<HTMLElement>('treeScrollRef')

const addFolderStage = computed<'idle' | 'pick-parent' | 'name'>(() => {
  if (!isAddingFolder.value) return 'idle'
  return addFolderParentPath.value === null ? 'pick-parent' : 'name'
})

const currentDirTreePath = computed(() => {
  const resolvedDir = resolveDirectoryTokens(dirValue.value).replace(
    /[/\\]+$/,
    ''
  )
  if (!resolvedDir) return OUTPUT_ROOT_PATH
  return `${OUTPUT_ROOT_PREFIX}${resolvedDir}`
})

const selectedTreePath = computed(() => {
  if (addFolderStage.value === 'name' && addFolderParentPath.value) {
    return addFolderParentPath.value
  }
  if (addFolderStage.value === 'pick-parent') return ''
  return currentDirTreePath.value
})

watchEffect(() => {
  if (!isDirectoryPickerOpen.value) return
  if (assetsStore.historyAssets.length === 0 && !assetsStore.historyLoading) {
    void assetsStore.updateHistory()
  }
})

watch(isDirectoryPickerOpen, (open) => {
  if (!open) cancelAddFolder()
})

function treePathToRelative(path: string): string {
  if (!path || path === OUTPUT_ROOT_PATH) return ''
  return path.startsWith(OUTPUT_ROOT_PREFIX)
    ? path.substring(OUTPUT_ROOT_PREFIX.length)
    : path
}

async function handleFolderSelect(path: string) {
  if (isReadOnly.value) return
  if (isAddingFolder.value) {
    addFolderParentPath.value = path
    newFolderName.value = ''
    await nextTick()
    newFolderInputRef.value?.focus()
    return
  }
  dirValue.value = treePathToRelative(path)
  isDirectoryPickerOpen.value = false
}

function startAddFolder() {
  if (isReadOnly.value) return
  isAddingFolder.value = true
  addFolderParentPath.value = null
  newFolderName.value = ''
}

function cancelAddFolder() {
  isAddingFolder.value = false
  addFolderParentPath.value = null
  newFolderName.value = ''
}

function confirmAddFolder() {
  const name = newFolderName.value.trim()
  if (!name || addFolderParentPath.value === null) return
  const parentRelative = treePathToRelative(addFolderParentPath.value)
  dirValue.value = parentRelative ? `${parentRelative}/${name}` : name
  cancelAddFolder()
  isDirectoryPickerOpen.value = false
}

function clearDirectory() {
  if (isReadOnly.value) return
  dirValue.value = ''
  cancelAddFolder()
  isDirectoryPickerOpen.value = false
}

function handlePopoverWheel(event: WheelEvent) {
  const el = treeScrollRef.value ?? (event.currentTarget as HTMLElement | null)
  if (!el) return
  el.scrollTop += event.deltaY
  el.scrollLeft += event.deltaX
}
</script>
