<template>
  <div>
    <div
      v-if="node.editing"
      :class="[
        'flex w-full items-center gap-2 rounded-md border-none bg-interface-menu-component-surface-selected px-3 py-2 text-left text-sm text-base-foreground'
      ]"
      :style="{ paddingLeft: `${depth * 10 + 12}px` }"
    >
      <i
        v-if="expandable"
        class="invisible icon-[lucide--chevron-right] size-3.5 shrink-0"
      />
      <i class="icon-[lucide--folder] size-4 shrink-0" />
      <input
        ref="inputRef"
        v-model="editName"
        type="text"
        class="min-w-0 flex-1 rounded-sm border border-comfy-input bg-transparent px-1 text-sm text-base-foreground outline-none focus:border-primary"
        @keydown.enter.prevent="commitEdit"
        @keydown.escape.prevent="cancelEdit"
        @blur="commitEdit"
        @click.stop
      />
    </div>
    <button
      v-else
      :class="[
        'flex w-full cursor-pointer items-center gap-2 rounded-md border-none px-3 py-2 text-left text-sm text-base-foreground transition-colors',
        isAssetDropHovered
          ? 'bg-azure-400/20'
          : isSelected
            ? 'bg-interface-menu-component-surface-selected'
            : 'bg-transparent hover:bg-interface-menu-component-surface-hovered'
      ]"
      :style="{ paddingLeft: `${depth * 10 + 12}px` }"
      :draggable="draggable"
      @click="handleSelect"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @dragenter.prevent="handleAssetDragEnter"
      @dragover.prevent="handleAssetDragOver"
      @dragleave="handleAssetDragLeave"
      @drop.prevent="handleAssetDrop"
    >
      <i
        v-if="expandable"
        :class="[
          'size-3.5 shrink-0 transition-transform',
          node.children.length > 0
            ? expanded
              ? 'icon-[lucide--chevron-down]'
              : 'icon-[lucide--chevron-right]'
            : 'invisible'
        ]"
        @click.stop="toggleExpand"
      />
      <i class="icon-[lucide--folder] size-4 shrink-0" />
      <span class="truncate">{{ node.name }}</span>
    </button>
    <div v-if="expandable && expanded && node.children.length > 0">
      <FolderTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :selected-path="selectedPath"
        :depth="depth + 1"
        :draggable="draggable && !child.editing"
        :expanded-depth="expandedDepth"
        @select="(path: string) => emit('select', path)"
        @drag-start="(path: string) => emit('dragStart', path)"
        @drag-end="(path: string) => emit('dragEnd', path)"
        @commit-edit="
          (path: string, name: string) => emit('commitEdit', path, name)
        "
        @cancel-edit="(path: string) => emit('cancelEdit', path)"
        @asset-drop="
          (path: string, ids: string[]) => emit('assetDrop', path, ids)
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

export interface FolderTreeNodeType {
  name: string
  path: string
  children: FolderTreeNodeType[]
  editing?: boolean
}

const {
  node,
  selectedPath,
  depth,
  draggable = false,
  expandedDepth = 0,
  expandable = true
} = defineProps<{
  node: FolderTreeNodeType
  selectedPath: string
  depth: number
  draggable?: boolean
  expandedDepth?: number
  expandable?: boolean
}>()

const emit = defineEmits<{
  select: [path: string]
  dragStart: [path: string]
  dragEnd: [path: string]
  commitEdit: [path: string, name: string]
  cancelEdit: [path: string]
  assetDrop: [path: string, assetIds: string[]]
}>()

const expanded = ref(depth <= expandedDepth)

const isSelected = computed(() => selectedPath === node.path)

const editName = ref(node.name)
const inputRef = ref<HTMLInputElement | null>(null)
const editingFinalized = ref(false)

const focusEdit = () => {
  void nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

onMounted(() => {
  if (node.editing) {
    editName.value = node.name
    editingFinalized.value = false
    focusEdit()
  }
})

watch(
  () => node.editing,
  (editing) => {
    if (editing) {
      editName.value = node.name
      editingFinalized.value = false
      focusEdit()
    }
  }
)

const commitEdit = () => {
  if (!node.editing || editingFinalized.value) return
  editingFinalized.value = true
  emit('commitEdit', node.path, editName.value.trim())
}

const cancelEdit = () => {
  if (!node.editing || editingFinalized.value) return
  editingFinalized.value = true
  emit('cancelEdit', node.path)
}

const handleSelect = () => {
  emit('select', node.path)
  if (expandable && node.children.length > 0) {
    expanded.value = true
  }
}

const toggleExpand = () => {
  if (!expandable) return
  expanded.value = !expanded.value
}

const handleDragStart = (event: DragEvent) => {
  if (!draggable) return
  event.dataTransfer?.setData('text/plain', node.path)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
  emit('dragStart', node.path)
}

const handleDragEnd = () => {
  if (!draggable) return
  emit('dragEnd', node.path)
}

const ASSET_DRAG_MIME = 'application/x-comfy-asset-ids'
const isAssetDropHovered = ref(false)

function isAssetDrag(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes(ASSET_DRAG_MIME)
}

const handleAssetDragEnter = (event: DragEvent) => {
  if (!isAssetDrag(event)) return
  isAssetDropHovered.value = true
}

const handleAssetDragOver = (event: DragEvent) => {
  if (!isAssetDrag(event)) return
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  isAssetDropHovered.value = true
}

const handleAssetDragLeave = (event: DragEvent) => {
  const related = event.relatedTarget as Node | null
  const current = event.currentTarget as HTMLElement | null
  if (current && related && current.contains(related)) return
  isAssetDropHovered.value = false
}

const handleAssetDrop = (event: DragEvent) => {
  if (!isAssetDrag(event)) return
  isAssetDropHovered.value = false
  const raw = event.dataTransfer?.getData(ASSET_DRAG_MIME)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return
    const ids = parsed.filter((id): id is string => typeof id === 'string')
    if (ids.length === 0) return
    emit('assetDrop', node.path, ids)
  } catch {
    // Ignore malformed payload
  }
}
</script>
