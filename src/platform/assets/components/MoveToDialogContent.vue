<template>
  <section class="mx-4 mt-4 mb-2 flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <label class="text-sm text-muted-foreground">
        {{ t('mediaAsset.moveTo.pathLabel') }}
      </label>
      <InputText
        v-model="destinationPath"
        :placeholder="t('mediaAsset.moveTo.pathPlaceholder')"
        autofocus
        class="w-full"
        @keyup.enter="handleConfirm"
      />
    </div>

    <!-- Folder tree -->
    <div
      class="max-h-64 overflow-y-auto rounded-lg border border-comfy-input p-1"
    >
      <FolderTreeNodeVue
        v-for="root in folderRoots"
        :key="root.path"
        :node="root"
        :selected-path="destinationPath"
        :depth="0"
        @select="handleFolderSelect"
      />
    </div>

    <div class="flex shrink-0 flex-wrap justify-end gap-4">
      <Button variant="secondary" autofocus @click="handleCancel">
        <i class="pi pi-undo" />
        {{ $t('g.cancel') }}
      </Button>
      <Button :disabled="!destinationPath.trim()" @click="handleConfirm">
        <i class="icon-[lucide--folder-input] size-4" />
        {{ t('mediaAsset.moveTo.moveButton') }}
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useAssetsStore } from '@/stores/assetsStore'
import { useDialogStore } from '@/stores/dialogStore'

import FolderTreeNodeVue from './FolderTreeNode.vue'
import type { FolderTreeNodeType as FolderTreeNode } from './FolderTreeNode.vue'

const props = defineProps<{
  onConfirm: (path: string) => void
  onCancel: () => void
}>()

const { t } = useI18n()
const assetsStore = useAssetsStore()

const destinationPath = ref('')

function buildFolderTree(
  assets: { name: string }[],
  rootName: string
): FolderTreeNode {
  const dirs = new Set<string>()

  for (const asset of assets) {
    const parts = asset.name.split('/')
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join('/'))
      }
    }
  }

  const rootPath = rootName.toLowerCase()
  const root: FolderTreeNode = { name: rootName, path: rootPath, children: [] }

  const sorted = Array.from(dirs).sort()
  const nodeMap = new Map<string, FolderTreeNode>()
  nodeMap.set('', root)

  for (const dir of sorted) {
    const parts = dir.split('/')
    const name = parts[parts.length - 1]
    const parentDir = parts.slice(0, -1).join('/')
    const fullPath = `${rootPath}/${dir}`

    const node: FolderTreeNode = { name, path: fullPath, children: [] }
    nodeMap.set(dir, node)

    const parent = nodeMap.get(parentDir) ?? root
    parent.children.push(node)
  }

  return root
}

const folderRoots = computed<FolderTreeNode[]>(() => {
  const outputRoot = buildFolderTree(assetsStore.historyAssets, 'Output')
  const inputRoot = buildFolderTree(assetsStore.inputAssets, 'Input')
  return [outputRoot, inputRoot]
})

const handleFolderSelect = (path: string) => {
  destinationPath.value = path
}

const handleConfirm = () => {
  const path = destinationPath.value.trim()
  if (!path) return
  props.onConfirm(path)
  useDialogStore().closeDialog()
}

const handleCancel = () => {
  props.onCancel()
  useDialogStore().closeDialog()
}
</script>
