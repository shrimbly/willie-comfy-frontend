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

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetUrl } from '@/platform/assets/utils/assetUrlUtil'
import { MOSHPIT_SPRITE_HITTEST_INJECTION_KEY } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { useMoshpitOverrideStore } from '@/platform/moshpit/stores/moshpitOverrideStore'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAssetsStore } from '@/stores/assetsStore'

defineOptions({ name: 'MoshpitSpriteContextMenu' })

const { t } = useI18n()

const spriteHitTestRef = inject(MOSHPIT_SPRITE_HITTEST_INJECTION_KEY)
if (!spriteHitTestRef) {
  throw new Error(
    'MoshpitSpriteContextMenu requires MOSHPIT_SPRITE_HITTEST_INJECTION_KEY to be provided by MoshpitView'
  )
}

const overrideStore = useMoshpitOverrideStore()
const selectionStore = useMoshpitSelectionStore()
const metadataStore = useMoshpitMetadataStore()
const assetsStore = useAssetsStore()
const toastStore = useToastStore()

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
  const hitTester = spriteHitTestRef?.value
  if (!hitTester) {
    close()
    return
  }
  for (const hash of actionSet.value) {
    if (overrideStore.isPinned(hash)) continue
    const pos = hitTester.getSpriteWorldPos(hash)
    if (!pos) continue
    overrideStore.setPin(hash, pos)
  }
  close()
}

function onUnpin(): void {
  for (const hash of actionSet.value) {
    overrideStore.unpin(hash)
  }
  close()
}

function buildHashToAssetMap(): Map<string, AssetItem> {
  const map = new Map<string, AssetItem>()
  for (const asset of assetsStore.historyAssets) {
    const hash =
      asset.asset_hash ?? metadataStore.getHashForAssetId(asset.id) ?? null
    if (hash && !map.has(hash)) map.set(hash, asset)
  }
  return map
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function onDownload(): void {
  const hashToAsset = buildHashToAssetMap()
  let count = 0
  for (const hash of actionSet.value) {
    const asset = hashToAsset.get(hash)
    if (!asset) continue
    triggerDownload(getAssetUrl(asset), asset.name)
    count += 1
  }
  if (count > 0) {
    toastStore.add({
      severity: 'info',
      summary:
        count > 1
          ? t('moshpit.contextMenu.downloadStartedMulti', { count })
          : t('moshpit.contextMenu.downloadStarted')
    })
  }
  close()
}

function onSelectSimilar(): void {
  const targetParams = metadataStore.getParams(targetHash.value)
  const targetWorkflow = targetParams?.workflowFilename ?? null
  if (!targetWorkflow) {
    toastStore.add({
      severity: 'info',
      summary: t('moshpit.contextMenu.selectSimilarNoMatch'),
      detail: t('moshpit.contextMenu.selectSimilarNoMatchDetail')
    })
    close()
    return
  }
  const matches: string[] = []
  for (const [hash, params] of metadataStore.paramsByHash) {
    if (params.workflowFilename === targetWorkflow) matches.push(hash)
  }
  selectionStore.setSelection(matches)
  close()
}

function onResetAllPins(): void {
  if (isResetAllDisabled.value) {
    close()
    return
  }
  overrideStore.clearAll()
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
  isResetAllDisabled
})
</script>
