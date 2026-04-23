<template>
  <ContextMenuRoot v-model:open="isOpen" :modal="false">
    <ContextMenuTrigger as-child>
      <div
        :style="{
          position: 'fixed',
          left: anchorX + 'px',
          top: anchorY + 'px',
          width: '0',
          height: '0',
          pointerEvents: 'none'
        }"
        aria-hidden="true"
      />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        class="z-1000 min-w-56 rounded-lg border border-border-subtle bg-base-background px-2 py-3 shadow-interface"
      >
        <ContextMenuItem
          v-if="!isTargetPinned"
          :class="itemClasses"
          @select="onPinHere"
        >
          {{ t('moshpit.contextMenu.pinHere') }}
        </ContextMenuItem>
        <ContextMenuItem v-else :class="itemClasses" @select="onUnpin">
          {{ t('moshpit.contextMenu.unpin') }}
        </ContextMenuItem>
        <ContextMenuItem :class="itemClasses" @select="onDownload">
          {{ downloadLabel }}
        </ContextMenuItem>
        <ContextMenuSeparator class="my-1 h-px bg-border-subtle" />
        <ContextMenuItem :class="itemClasses" @select="onSelectSimilar">
          {{ t('moshpit.contextMenu.selectSimilar') }}
        </ContextMenuItem>
        <ContextMenuSeparator class="my-1 h-px bg-border-subtle" />
        <ContextMenuItem :class="itemClasses" @select="onFavourite">
          {{ favouriteLabel }}
          <span class="ml-auto text-xs opacity-60">S</span>
        </ContextMenuItem>
        <ContextMenuItem :class="itemClasses" @select="onTag">
          {{ t('moshpit.contextMenu.tag') }}
          <span class="ml-auto text-xs opacity-60">T</span>
        </ContextMenuItem>
        <ContextMenuItem :class="itemClasses" @select="onHide">
          {{ hideLabel }}
          <span class="ml-auto text-xs opacity-60">H</span>
        </ContextMenuItem>
        <ContextMenuItem :class="itemClasses" @select="onFolder">
          {{ t('moshpit.contextMenu.addToFolder') }}
        </ContextMenuItem>
        <ContextMenuItem :class="itemClasses" @select="onExport">
          {{ t('moshpit.contextMenu.export') }}
          <span class="ml-auto text-xs opacity-60">E</span>
        </ContextMenuItem>
        <ContextMenuSeparator class="my-1 h-px bg-border-subtle" />
        <ContextMenuItem
          :class="itemClasses"
          :disabled="isResetAllDisabled"
          @select="onResetAllPins"
        >
          {{ t('moshpit.contextMenu.resetAllPins') }}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuTrigger
} from 'reka-ui'
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMoshpitCuration } from '@/platform/moshpit/composables/useMoshpitCuration'
import { useMoshpitSpriteActions } from '@/platform/moshpit/composables/useMoshpitSpriteActions'
import { MOSHPIT_SPRITE_HITTEST_INJECTION_KEY } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import { useMoshpitCurationStore } from '@/platform/moshpit/stores/moshpitCurationStore'
import { useMoshpitOverrideStore } from '@/platform/moshpit/stores/moshpitOverrideStore'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'

defineOptions({ name: 'MoshpitSpriteContextMenu' })

const emit = defineEmits<{
  'open-tag-popover': [
    payload: { hashes: readonly string[]; anchorX: number; anchorY: number }
  ]
  'open-folder-picker': [
    payload: { hashes: readonly string[]; anchorX: number; anchorY: number }
  ]
}>()

const { t } = useI18n()

const spriteHitTestRef = inject(MOSHPIT_SPRITE_HITTEST_INJECTION_KEY)
if (!spriteHitTestRef) {
  throw new Error(
    'MoshpitSpriteContextMenu requires MOSHPIT_SPRITE_HITTEST_INJECTION_KEY to be provided by MoshpitView'
  )
}

const overrideStore = useMoshpitOverrideStore()
const selectionStore = useMoshpitSelectionStore()
const curationStore = useMoshpitCurationStore()
const curation = useMoshpitCuration()
const actions = useMoshpitSpriteActions({
  getHitTester: () => spriteHitTestRef?.value ?? null
})

const isOpen = ref(false)
const anchorX = ref(0)
const anchorY = ref(0)
const targetHash = ref('')
const actionSet = ref<readonly string[]>([])

const isTargetPinned = computed(() =>
  targetHash.value ? overrideStore.isPinned(targetHash.value) : false
)
const isResetAllDisabled = computed(() => overrideStore.size === 0)

const downloadLabel = computed(() =>
  actionSet.value.length > 1
    ? t('moshpit.contextMenu.downloadCount', {
        count: actionSet.value.length
      })
    : t('moshpit.contextMenu.download')
)

const allFavourited = computed(
  () =>
    actionSet.value.length > 0 &&
    actionSet.value.every((h) => curationStore.get(h)?.favourite === true)
)

const allHidden = computed(
  () =>
    actionSet.value.length > 0 &&
    actionSet.value.every((h) => curationStore.get(h)?.hidden === true)
)

const favouriteLabel = computed(() =>
  allFavourited.value
    ? t('moshpit.contextMenu.unfavourite')
    : t('moshpit.contextMenu.favourite')
)

const hideLabel = computed(() =>
  allHidden.value
    ? t('moshpit.contextMenu.unhide')
    : t('moshpit.contextMenu.hide')
)

const itemClasses =
  'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-interface-panel-surface data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'

function open(screenX: number, screenY: number, hash: string): void {
  targetHash.value = hash
  anchorX.value = screenX
  anchorY.value = screenY
  actionSet.value =
    selectionStore.size > 1 && selectionStore.isSelected(hash)
      ? [...selectionStore.selected]
      : [hash]
  isOpen.value = true
}

function close(): void {
  isOpen.value = false
}

function onPinHere(): void {
  actions.pinHereMany(actionSet.value)
  close()
}

function onUnpin(): void {
  actions.unpinMany(actionSet.value)
  close()
}

function onDownload(): void {
  actions.downloadMany(actionSet.value)
  close()
}

function onSelectSimilar(): void {
  actions.selectSimilar(targetHash.value)
  close()
}

function onResetAllPins(): void {
  actions.resetAllPins()
  close()
}

function onFavourite(): void {
  curation.favouriteMany(actionSet.value, !allFavourited.value)
  close()
}

function onTag(): void {
  emit('open-tag-popover', {
    hashes: [...actionSet.value],
    anchorX: anchorX.value,
    anchorY: anchorY.value
  })
  close()
}

function onHide(): void {
  curation.hideMany(actionSet.value, !allHidden.value)
  close()
}

function onFolder(): void {
  emit('open-folder-picker', {
    hashes: [...actionSet.value],
    anchorX: anchorX.value,
    anchorY: anchorY.value
  })
  close()
}

function onExport(): void {
  curation.exportMany(actionSet.value)
  close()
}

defineExpose({
  open,
  close,
  onPinHere,
  onUnpin,
  onDownload,
  onSelectSimilar,
  onResetAllPins,
  onFavourite,
  onTag,
  onHide,
  onFolder,
  onExport,
  allFavourited,
  allHidden,
  favouriteLabel,
  hideLabel,
  isResetAllDisabled
})
</script>
