/**
 * Shared sprite-action vocabulary consumed by both the sprite context menu
 * (260423-kx4) and the floating action bar (260423-led). Centralising here
 * keeps the per-item behaviour (download / unpin / pin-here / select-similar /
 * reset-all) on a single tested code path — the two surfaces disagreeing is
 * easy to introduce and hard to notice, hence the DRY fix now that a second
 * consumer has materialised.
 *
 * Stateless: the caller passes `{ getHitTester }` so each component can wire
 * in its own injection without the composable re-injecting the hit-test key.
 */
import { useI18n } from 'vue-i18n'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetUrl } from '@/platform/assets/utils/assetUrlUtil'
import type { SpriteHitTester } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { useMoshpitOverrideStore } from '@/platform/moshpit/stores/moshpitOverrideStore'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAssetsStore } from '@/stores/assetsStore'

export interface MoshpitSpriteActionsOptions {
  getHitTester: () => SpriteHitTester | null
}

export function useMoshpitSpriteActions(options: MoshpitSpriteActionsOptions) {
  const { getHitTester } = options
  const overrideStore = useMoshpitOverrideStore()
  const selectionStore = useMoshpitSelectionStore()
  const metadataStore = useMoshpitMetadataStore()
  const assetsStore = useAssetsStore()
  const toastStore = useToastStore()
  const { t } = useI18n()

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

  function downloadMany(hashes: readonly string[]): void {
    const hashToAsset = buildHashToAssetMap()
    let count = 0
    for (const hash of hashes) {
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
  }

  function unpinMany(hashes: readonly string[]): void {
    for (const hash of hashes) {
      overrideStore.unpin(hash)
    }
  }

  function pinHereMany(hashes: readonly string[]): void {
    const hitTester = getHitTester()
    if (!hitTester) {
      console.warn('[moshpit] pinHereMany: no hit-tester available')
      return
    }
    for (const hash of hashes) {
      if (overrideStore.isPinned(hash)) continue
      const pos = hitTester.getSpriteWorldPos(hash)
      if (!pos) continue
      overrideStore.setPin(hash, pos)
    }
  }

  function selectSimilar(hash: string): void {
    const targetParams = metadataStore.getParams(hash)
    const targetWorkflow = targetParams?.workflowFilename ?? null
    if (!targetWorkflow) {
      toastStore.add({
        severity: 'info',
        summary: t('moshpit.contextMenu.selectSimilarNoMatch'),
        detail: t('moshpit.contextMenu.selectSimilarNoMatchDetail')
      })
      return
    }
    const matches: string[] = []
    for (const [candidateHash, params] of metadataStore.paramsByHash) {
      if (params.workflowFilename === targetWorkflow)
        matches.push(candidateHash)
    }
    selectionStore.setSelection(matches)
  }

  function resetAllPins(): void {
    if (overrideStore.size === 0) return
    overrideStore.clearAll()
  }

  function someSelectedArePinned(hashes: readonly string[]): boolean {
    return hashes.some((hash) => overrideStore.isPinned(hash))
  }

  return {
    downloadMany,
    unpinMany,
    pinHereMany,
    selectSimilar,
    resetAllPins,
    someSelectedArePinned
  }
}
