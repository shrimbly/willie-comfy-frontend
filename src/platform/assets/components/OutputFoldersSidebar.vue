<template>
  <div
    class="flex size-full flex-col overflow-hidden bg-(--comfy-menu-bg)"
    @wheel.capture.stop.prevent="handleWheel"
  >
    <div
      :class="
        cn(
          'flex flex-col p-1 transition-colors',
          isDraggingNonPinned && 'bg-primary/10'
        )
      "
      data-testid="folders-sidebar-pinned"
      @dragenter.prevent
      @dragover.prevent="handlePinnedDragOver"
      @drop.prevent="handlePinnedDrop"
    >
      <h4
        class="mt-2.5 mb-1 ml-2 flex items-center gap-1.5 text-2xs font-semibold text-muted-foreground"
      >
        <i class="icon-[lucide--pin] size-3 shrink-0" />
        {{ $t('sideToolbar.mediaAssets.foldersSidebar.pinnedHeader') }}
      </h4>
      <p
        v-if="pinnedNodes.length === 0"
        class="m-2 text-xs text-muted-foreground"
      >
        {{ $t('sideToolbar.mediaAssets.foldersSidebar.pinHint') }}
      </p>
      <FolderTreeNode
        v-for="pinned in pinnedNodes"
        :key="pinned.path"
        :node="pinned"
        :selected-path="selectedPath"
        :depth="0"
        :draggable="true"
        :expandable="false"
        @select="handleSelect"
        @drag-start="handlePinnedDragStart"
        @drag-end="handleDragEnd"
        @asset-drop="handleAssetDropOnFolder"
      />
    </div>
    <div
      ref="allFoldersSectionRef"
      :class="
        cn(
          'flex-1 overflow-y-auto p-1 transition-colors',
          isDraggingPinned && 'bg-destructive/10'
        )
      "
      data-testid="folders-sidebar-all"
      @dragenter.prevent
      @dragover.prevent="handleAllFoldersDragOver"
      @drop.prevent="handleAllFoldersDrop"
    >
      <h4
        class="mt-4 mb-1 ml-2 flex items-center gap-1.5 text-2xs font-semibold text-muted-foreground"
      >
        <i class="icon-[lucide--folder-tree] size-3 shrink-0" />
        {{ $t('sideToolbar.mediaAssets.foldersSidebar.allFoldersHeader') }}
      </h4>
      <template v-for="tree in trees" :key="tree.path">
        <button
          :class="
            cn(
              'mb-0.5 flex w-full cursor-pointer items-center gap-1 rounded-sm border-none px-2 py-1 text-left text-sm transition-colors',
              selectedPath === tree.path
                ? 'bg-primary/15 text-primary'
                : 'bg-transparent text-base-foreground hover:bg-secondary-background-hover'
            )
          "
          @click="handleSelect(tree.path)"
        >
          <i class="icon-[lucide--home] size-3.5 shrink-0" />
          <span class="truncate">{{ tree.name }}</span>
        </button>
        <FolderTreeNode
          v-for="child in tree.children"
          :key="child.path"
          :node="child"
          :selected-path="selectedPath"
          :depth="0"
          :draggable="true"
          :expanded-depth="-1"
          @select="handleSelect"
          @drag-start="handleAllFoldersDragStart"
          @drag-end="handleDragEnd"
          @asset-drop="handleAssetDropOnFolder"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import FolderTreeNode from '@/platform/assets/components/FolderTreeNode.vue'
import type { FolderTreeNodeType } from '@/platform/assets/components/FolderTreeNode.vue'
import { findNodeByPath } from '@/platform/assets/utils/buildOutputFolderTree'
import { cn } from '@/utils/tailwindUtil'

const { selectedPath, pinnedPaths, trees } = defineProps<{
  selectedPath: string
  pinnedPaths: readonly string[]
  trees: readonly FolderTreeNodeType[]
}>()

const emit = defineEmits<{
  select: [absolutePath: string]
  'update:pinnedPaths': [paths: string[]]
  assetDropOnFolder: [folderPath: string, assetIds: string[]]
}>()

function handleAssetDropOnFolder(folderPath: string, assetIds: string[]) {
  emit('assetDropOnFolder', folderPath, assetIds)
}

const allFoldersSectionRef = ref<HTMLElement | null>(null)
const draggingPath = ref<string | null>(null)
const draggingFromPinned = ref(false)

const pinnedNodes = computed(() => {
  const nodes: FolderTreeNodeType[] = []
  for (const absolute of pinnedPaths) {
    for (const tree of trees) {
      if (absolute === tree.path || absolute.startsWith(`${tree.path}/`)) {
        const node = findNodeByPath(tree, absolute)
        if (node) nodes.push(node)
        break
      }
    }
  }
  return nodes
})

const isDraggingNonPinned = computed(
  () => draggingPath.value !== null && !draggingFromPinned.value
)

const isDraggingPinned = computed(
  () => draggingPath.value !== null && draggingFromPinned.value
)

function belongsToAnyTree(absolutePath: string): boolean {
  return trees.some(
    (tree) =>
      absolutePath === tree.path || absolutePath.startsWith(`${tree.path}/`)
  )
}

function handleSelect(absolutePath: string) {
  emit('select', absolutePath)
}

function handleAllFoldersDragStart(path: string) {
  draggingPath.value = path
  draggingFromPinned.value = false
}

function handlePinnedDragStart(path: string) {
  draggingPath.value = path
  draggingFromPinned.value = true
}

function handleDragEnd() {
  draggingPath.value = null
  draggingFromPinned.value = false
}

function handlePinnedDragOver(event: DragEvent) {
  if (!event.dataTransfer) return
  event.dataTransfer.dropEffect = draggingFromPinned.value ? 'none' : 'move'
}

function handleAllFoldersDragOver(event: DragEvent) {
  if (!event.dataTransfer) return
  event.dataTransfer.dropEffect = draggingFromPinned.value ? 'move' : 'none'
}

function handlePinnedDrop(event: DragEvent) {
  const absolutePath = event.dataTransfer?.getData('text/plain') ?? ''
  if (!absolutePath) return
  if (!belongsToAnyTree(absolutePath)) return
  if (pinnedPaths.includes(absolutePath)) return
  // Don't pin the root itself — only subdirectories
  if (trees.some((tree) => tree.path === absolutePath)) return
  emit('update:pinnedPaths', [...pinnedPaths, absolutePath])
}

function handleAllFoldersDrop(event: DragEvent) {
  const absolutePath = event.dataTransfer?.getData('text/plain') ?? ''
  if (!absolutePath) return
  if (!draggingFromPinned.value) return
  emit(
    'update:pinnedPaths',
    pinnedPaths.filter((p) => p !== absolutePath)
  )
}

function handleWheel(event: WheelEvent) {
  const el = event.currentTarget as HTMLElement | null
  if (!el) return
  const scrollTarget =
    allFoldersSectionRef.value &&
    allFoldersSectionRef.value.contains(event.target as Node)
      ? allFoldersSectionRef.value
      : el
  scrollTarget.scrollTop += event.deltaY
  scrollTarget.scrollLeft += event.deltaX
}
</script>
