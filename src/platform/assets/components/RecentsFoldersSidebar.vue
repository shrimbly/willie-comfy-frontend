<template>
  <div class="flex size-full flex-col overflow-hidden bg-(--comfy-menu-bg)">
    <div class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3">
      <button
        type="button"
        :class="
          cn(
            'flex w-full cursor-pointer items-center gap-2 rounded-md border-none px-3 py-2 text-left text-sm text-base-foreground transition-colors',
            recentsActive
              ? 'bg-interface-menu-component-surface-selected'
              : 'bg-transparent hover:bg-interface-menu-component-surface-hovered'
          )
        "
        @click="emit('selectRecents')"
      >
        <i class="icon-[lucide--clock] size-3.5 shrink-0" />
        <span class="truncate">
          {{ $t('sideToolbar.mediaAssets.foldersSidebar.recent') }}
        </span>
      </button>

      <button
        type="button"
        :class="
          cn(
            'flex w-full cursor-pointer items-center gap-2 rounded-md border-none px-3 py-2 text-left text-sm text-base-foreground transition-colors',
            favoritesActive && favoriteColorFilter === null
              ? 'bg-interface-menu-component-surface-selected'
              : 'bg-transparent hover:bg-interface-menu-component-surface-hovered'
          )
        "
        @click="emit('selectFavorites')"
      >
        <i class="icon-[lucide--star] size-3.5 shrink-0" />
        <span class="truncate">
          {{ $t('sideToolbar.mediaAssets.foldersSidebar.favorites') }}
        </span>
      </button>

      <div v-if="favoritesActive" class="flex flex-col">
        <template v-for="color in FAVORITE_COLORS" :key="color">
          <div
            v-if="editingColor === color"
            class="flex w-full items-center gap-2 rounded-md bg-interface-menu-component-surface-selected py-1.5 pr-3 pl-7 text-sm text-base-foreground"
          >
            <i
              :class="
                cn(
                  'icon-[ph--circle-fill] size-3 shrink-0',
                  favoriteSwatchColorClass(color)
                )
              "
            />
            <input
              ref="colorEditInput"
              v-model="editingDraft"
              type="text"
              class="min-w-0 flex-1 rounded-sm border border-comfy-input bg-transparent px-1 text-sm text-base-foreground outline-none focus:border-primary"
              @keydown.enter.prevent="commitColorEdit"
              @keydown.escape.prevent="cancelColorEdit"
              @blur="commitColorEdit"
              @click.stop
            />
          </div>
          <button
            v-else
            type="button"
            :class="
              cn(
                'group flex w-full cursor-pointer items-center gap-2 rounded-md border-none py-1.5 pr-3 pl-7 text-left text-sm text-base-foreground transition-colors',
                favoriteColorFilter === color
                  ? 'bg-interface-menu-component-surface-selected'
                  : 'bg-transparent hover:bg-interface-menu-component-surface-hovered'
              )
            "
            :aria-pressed="favoriteColorFilter === color"
            @click="
              emit(
                'selectFavoriteColor',
                favoriteColorFilter === color ? null : color
              )
            "
          >
            <i
              :class="
                cn(
                  'icon-[ph--circle-fill] size-3 shrink-0',
                  favoriteSwatchColorClass(color)
                )
              "
            />
            <span class="truncate">
              {{ favoriteColorLabel(color) }}
            </span>
            <i
              class="ml-auto icon-[lucide--pencil] size-3 shrink-0 cursor-pointer opacity-0 transition-opacity group-hover:opacity-60 hover:opacity-100"
              :aria-label="
                $t('sideToolbar.mediaAssets.foldersSidebar.renameFavoriteColor')
              "
              role="button"
              tabindex="0"
              @click.stop="startColorEdit(color)"
              @keydown.enter.stop.prevent="startColorEdit(color)"
            />
          </button>
        </template>
      </div>

      <div
        :class="
          cn(
            'flex flex-col transition-colors',
            isDraggingNonPinned && 'bg-primary/10'
          )
        "
        data-testid="recents-sidebar-pinned"
        @dragenter.prevent
        @dragover.prevent="handlePinDragOver"
        @drop.prevent="handlePinDrop"
      >
        <p
          v-if="pinnedNodes.length === 0"
          class="px-3 py-2 text-xs text-muted-foreground"
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
        :class="
          cn(
            'mt-4 flex flex-col transition-colors',
            isDraggingPinned && 'bg-destructive/10'
          )
        "
        data-testid="recents-sidebar-generated"
        @dragenter.prevent
        @dragover.prevent="handleUnpinDragOver"
        @drop.prevent="handleUnpinDrop"
      >
        <button
          type="button"
          :class="
            cn(
              'flex w-full cursor-pointer items-center gap-2 rounded-md border-none px-3 py-2 text-left text-sm text-base-foreground transition-colors',
              selectedPath === outputTree.path
                ? 'bg-interface-menu-component-surface-selected'
                : 'bg-transparent hover:bg-interface-menu-component-surface-hovered'
            )
          "
          @click="handleSelect(outputTree.path)"
        >
          <i class="icon-[comfy--image-ai-edit] size-3.5 shrink-0" />
          <span class="truncate">
            {{ $t('sideToolbar.mediaAssets.foldersSidebar.generatedHeader') }}
          </span>
        </button>
        <div
          v-if="outputTreeWithPending.children.length > 0"
          class="max-h-90 overflow-y-auto"
        >
          <FolderTreeNode
            v-for="child in outputTreeWithPending.children"
            :key="child.path"
            :node="child"
            :selected-path="selectedPath"
            :depth="1"
            :draggable="!child.editing"
            :expanded-depth="-1"
            @select="handleSelect"
            @drag-start="handleTreeDragStart"
            @drag-end="handleDragEnd"
            @commit-edit="handleCommitEdit"
            @cancel-edit="handleCancelEdit"
            @asset-drop="handleAssetDropOnFolder"
          />
        </div>
      </div>

      <div
        :class="
          cn(
            'mt-4 flex flex-col transition-colors',
            isDraggingPinned && 'bg-destructive/10'
          )
        "
        data-testid="recents-sidebar-imported"
        @dragenter.prevent
        @dragover.prevent="handleUnpinDragOver"
        @drop.prevent="handleUnpinDrop"
      >
        <button
          type="button"
          :class="
            cn(
              'flex w-full cursor-pointer items-center gap-2 rounded-md border-none px-3 py-2 text-left text-sm text-base-foreground transition-colors',
              selectedPath === inputTree.path
                ? 'bg-interface-menu-component-surface-selected'
                : 'bg-transparent hover:bg-interface-menu-component-surface-hovered'
            )
          "
          @click="handleSelect(inputTree.path)"
        >
          <i class="icon-[lucide--upload] size-3.5 shrink-0" />
          <span class="truncate">
            {{ $t('sideToolbar.mediaAssets.foldersSidebar.importedHeader') }}
          </span>
        </button>
        <div
          v-if="inputTreeWithPending.children.length > 0"
          class="max-h-90 overflow-y-auto"
        >
          <FolderTreeNode
            v-for="child in inputTreeWithPending.children"
            :key="child.path"
            :node="child"
            :selected-path="selectedPath"
            :depth="1"
            :draggable="!child.editing"
            :expanded-depth="-1"
            @select="handleSelect"
            @drag-start="handleTreeDragStart"
            @drag-end="handleDragEnd"
            @commit-edit="handleCommitEdit"
            @cancel-edit="handleCancelEdit"
            @asset-drop="handleAssetDropOnFolder"
          />
        </div>
      </div>
    </div>
    <div
      v-if="canAddFolder"
      class="flex h-18 shrink-0 items-center border-t border-comfy-input px-2"
    >
      <Button
        variant="secondary"
        class="w-full"
        :disabled="hasPendingEdit"
        @click="handleAddFolder"
      >
        <span>
          {{ $t('sideToolbar.mediaAssets.foldersSidebar.addFolder') }}
        </span>
        <i class="icon-[lucide--folder-plus] size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import FolderTreeNode from '@/platform/assets/components/FolderTreeNode.vue'
import type { FolderTreeNodeType } from '@/platform/assets/components/FolderTreeNode.vue'
import { FAVORITE_COLORS } from '@/platform/assets/composables/useAssetFavorites';
import type { FavoriteColor } from '@/platform/assets/composables/useAssetFavorites';
import { findNodeByPath } from '@/platform/assets/utils/buildOutputFolderTree'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()

const customColorNames = useStorage<Partial<Record<FavoriteColor, string>>>(
  'Comfy.Assets.FavoriteColorNames',
  {}
)

const editingColor = ref<FavoriteColor | null>(null)
const editingDraft = ref('')
const colorEditInput = ref<HTMLInputElement[] | HTMLInputElement | null>(null)

function favoriteColorLabel(color: FavoriteColor): string {
  const custom = customColorNames.value[color]?.trim()
  if (custom) return custom
  return t(`sideToolbar.mediaAssets.foldersSidebar.favoriteColors.${color}`)
}

function startColorEdit(color: FavoriteColor) {
  editingColor.value = color
  editingDraft.value = favoriteColorLabel(color)
  void nextTick(() => {
    const el = Array.isArray(colorEditInput.value)
      ? colorEditInput.value[0]
      : colorEditInput.value
    el?.focus()
    el?.select()
  })
}

function commitColorEdit() {
  if (!editingColor.value) return
  const color = editingColor.value
  const next = editingDraft.value.trim()
  const defaultLabel = t(
    `sideToolbar.mediaAssets.foldersSidebar.favoriteColors.${color}`
  )
  const updated = { ...customColorNames.value }
  if (!next || next === defaultLabel) {
    delete updated[color]
  } else {
    updated[color] = next
  }
  customColorNames.value = updated
  editingColor.value = null
  editingDraft.value = ''
}

function cancelColorEdit() {
  editingColor.value = null
  editingDraft.value = ''
}

const {
  selectedPath,
  pinnedPaths,
  inputTree,
  outputTree,
  recentsActive = false,
  favoritesActive = false,
  favoriteColorFilter = null
} = defineProps<{
  selectedPath: string
  pinnedPaths: readonly string[]
  inputTree: FolderTreeNodeType
  outputTree: FolderTreeNodeType
  recentsActive?: boolean
  favoritesActive?: boolean
  favoriteColorFilter?: FavoriteColor | null
}>()

const emit = defineEmits<{
  select: [absolutePath: string]
  selectRecents: []
  selectFavorites: []
  selectFavoriteColor: [color: FavoriteColor | null]
  'update:pinnedPaths': [paths: string[]]
  assetDropOnFolder: [folderPath: string, assetIds: string[]]
}>()

function handleAssetDropOnFolder(folderPath: string, assetIds: string[]) {
  emit('assetDropOnFolder', folderPath, assetIds)
}

function favoriteSwatchColorClass(color: FavoriteColor): string {
  switch (color) {
    case 'yellow':
      return 'text-citrine-400'
    case 'blue':
      return 'text-azure-400'
    case 'green':
      return 'text-jade-600'
  }
}

const draggingPath = ref<string | null>(null)
const draggingFromPinned = ref(false)

function resolvePinned(absolute: string): FolderTreeNodeType | null {
  if (
    absolute === outputTree.path ||
    absolute.startsWith(`${outputTree.path}/`)
  ) {
    return findNodeByPath(outputTree, absolute) ?? leafNodeFromPath(absolute)
  }
  if (
    absolute === inputTree.path ||
    absolute.startsWith(`${inputTree.path}/`)
  ) {
    return findNodeByPath(inputTree, absolute) ?? leafNodeFromPath(absolute)
  }
  return leafNodeFromPath(absolute)
}

function leafNodeFromPath(absolute: string): FolderTreeNodeType {
  const parts = absolute.split('/')
  return {
    name: parts[parts.length - 1] || absolute,
    path: absolute,
    children: []
  }
}

const pinnedNodes = computed(() =>
  pinnedPaths
    .map((absolute) => resolvePinned(absolute))
    .filter((n): n is FolderTreeNodeType => n !== null)
)

const isDraggingNonPinned = computed(
  () => draggingPath.value !== null && !draggingFromPinned.value
)
const isDraggingPinned = computed(
  () => draggingPath.value !== null && draggingFromPinned.value
)

function belongsToAnyTree(absolutePath: string): boolean {
  return (
    absolutePath === outputTree.path ||
    absolutePath.startsWith(`${outputTree.path}/`) ||
    absolutePath === inputTree.path ||
    absolutePath.startsWith(`${inputTree.path}/`)
  )
}

function handleSelect(absolutePath: string) {
  emit('select', absolutePath)
}

function handleTreeDragStart(path: string) {
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

function handlePinDragOver(event: DragEvent) {
  if (!event.dataTransfer) return
  event.dataTransfer.dropEffect = draggingFromPinned.value ? 'none' : 'move'
}

function handleUnpinDragOver(event: DragEvent) {
  if (!event.dataTransfer) return
  event.dataTransfer.dropEffect = draggingFromPinned.value ? 'move' : 'none'
}

function handlePinDrop(event: DragEvent) {
  const absolutePath = event.dataTransfer?.getData('text/plain') ?? ''
  if (!absolutePath) return
  if (!belongsToAnyTree(absolutePath)) return
  if (pinnedPaths.includes(absolutePath)) return
  if (absolutePath === outputTree.path || absolutePath === inputTree.path) {
    return
  }
  emit('update:pinnedPaths', [...pinnedPaths, absolutePath])
}

function handleUnpinDrop(event: DragEvent) {
  const absolutePath = event.dataTransfer?.getData('text/plain') ?? ''
  if (!absolutePath) return
  if (!draggingFromPinned.value) return
  emit(
    'update:pinnedPaths',
    pinnedPaths.filter((p) => p !== absolutePath)
  )
}

interface PendingFolder {
  id: string
  parentPath: string
  name: string
  editing: boolean
}

const PENDING_PATH_PREFIX = '__pending__/'
const pendingFolders = ref<PendingFolder[]>([])

const hasPendingEdit = computed(() =>
  pendingFolders.value.some((p) => p.editing)
)

function pendingPath(id: string): string {
  return `${PENDING_PATH_PREFIX}${id}`
}

function injectPending(node: FolderTreeNodeType): FolderTreeNodeType {
  const here = pendingFolders.value.filter((p) => p.parentPath === node.path)
  const injectedChildren = node.children.map(injectPending)
  const newChildren: FolderTreeNodeType[] = here.map((p) => ({
    name: p.name,
    path: pendingPath(p.id),
    children: [],
    editing: p.editing
  }))
  if (newChildren.length === 0 && injectedChildren === node.children) {
    return node
  }
  return {
    ...node,
    children: [...injectedChildren, ...newChildren]
  }
}

const outputTreeWithPending = computed(() => injectPending(outputTree))
const inputTreeWithPending = computed(() => injectPending(inputTree))

const canAddFolder = computed(() => {
  if (!selectedPath) return false
  return (
    selectedPath === outputTree.path ||
    selectedPath.startsWith(`${outputTree.path}/`) ||
    selectedPath === inputTree.path ||
    selectedPath.startsWith(`${inputTree.path}/`)
  )
})

function handleAddFolder() {
  if (!canAddFolder.value || hasPendingEdit.value) return
  pendingFolders.value = [
    ...pendingFolders.value,
    {
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      parentPath: selectedPath,
      name: t('sideToolbar.mediaAssets.foldersSidebar.newFolderName'),
      editing: true
    }
  ]
}

function findPendingByPath(path: string): PendingFolder | undefined {
  if (!path.startsWith(PENDING_PATH_PREFIX)) return undefined
  const id = path.slice(PENDING_PATH_PREFIX.length)
  return pendingFolders.value.find((p) => p.id === id)
}

function handleCommitEdit(path: string, name: string) {
  const pending = findPendingByPath(path)
  if (!pending) return
  const trimmed = name.trim()
  if (!trimmed) {
    pendingFolders.value = pendingFolders.value.filter(
      (p) => p.id !== pending.id
    )
    return
  }
  pendingFolders.value = pendingFolders.value.map((p) =>
    p.id === pending.id ? { ...p, name: trimmed, editing: false } : p
  )
}

function handleCancelEdit(path: string) {
  const pending = findPendingByPath(path)
  if (!pending) return
  pendingFolders.value = pendingFolders.value.filter((p) => p.id !== pending.id)
}
</script>
