<template>
  <ContextMenu
    ref="contextMenu"
    :model="contextMenuItems"
    :pt="{
      root: {
        id: contextMenuId,
        class: cn(
          'rounded-lg',
          'bg-secondary-background text-base-foreground',
          'shadow-lg'
        )
      }
    }"
    @hide="onMenuHide"
  >
    <template #item="{ item, props }">
      <Button
        variant="secondary"
        class="w-full justify-start"
        v-bind="props.action"
      >
        <i v-if="item.icon" :class="item.icon" class="size-4" />
        <span>{{
          typeof item.label === 'function' ? item.label() : (item.label ?? '')
        }}</span>
      </Button>
    </template>
  </ContextMenu>
</template>

<script setup lang="ts">
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem } from 'primevue/menuitem'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useDismissableOverlay } from '@/composables/useDismissableOverlay'
import { isDesktop } from '@/platform/distribution/types'
import { electronAPI } from '@/utils/envUtil'
import { cn } from '@/utils/tailwindUtil'

const { allowMoveActions = false } = defineProps<{
  allowMoveActions?: boolean
}>()

const emit = defineEmits<{
  hide: []
  'open-in-finder': []
  'export-all': []
  'move-to': []
}>()

type ContextMenuHandle = {
  show: (event: MouseEvent) => void
  hide: () => void
}

const contextMenu = ref<ContextMenuHandle | null>(null)
const contextMenuId = useId()
const isVisible = ref(false)
const { t } = useI18n()

useDismissableOverlay({
  isOpen: isVisible,
  getOverlayEl: () => document.getElementById(contextMenuId),
  onDismiss: hide,
  dismissOnScroll: true
})

const contextMenuItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = []

  // Open in OS file manager (desktop only)
  if (isDesktop) {
    const platform = electronAPI().getPlatform()
    const labelKey =
      platform === 'darwin'
        ? 'mediaAsset.actions.showInFinder'
        : platform === 'win32'
          ? 'mediaAsset.actions.showInExplorer'
          : 'mediaAsset.actions.showInFileManager'
    const iconClass =
      platform === 'darwin'
        ? 'icon-[comfy--finder]'
        : 'icon-[lucide--folder-open]'
    items.push({
      label: t(labelKey),
      icon: iconClass,
      command: () => emit('open-in-finder')
    })
  }

  // Export all
  items.push({
    label: t('mediaAsset.actions.exportAll'),
    icon: 'icon-[lucide--download]',
    command: () => emit('export-all')
  })

  // Move to
  if (allowMoveActions) {
    items.push({
      label: t('mediaAsset.actions.moveFolderTo'),
      icon: 'icon-[lucide--folder-input]',
      command: () => emit('move-to')
    })
  }

  return items
})

function onMenuHide() {
  isVisible.value = false
  emit('hide')
}

function show(event: MouseEvent) {
  isVisible.value = true
  contextMenu.value?.show(event)
}

function hide() {
  isVisible.value = false
  contextMenu.value?.hide()
}

defineExpose({ show, hide })
</script>
