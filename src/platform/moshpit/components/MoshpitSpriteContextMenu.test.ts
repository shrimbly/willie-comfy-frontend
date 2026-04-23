/**
 * Behavioural coverage of MoshpitSpriteContextMenu.
 *
 * Reka UI's ContextMenuContent is portalled to document.body and gates its
 * render on pointer-event origin, which doesn't flush reliably in happy-dom
 * (see STATE.md / MoshpitSortControls note). Tests therefore drive the
 * component through its defineExpose surface (open, close, and the on*
 * action callbacks) rather than DOM traversal — the callbacks are the
 * behavioural surface that the template delegates to, so this keeps tests
 * anchored to behaviour rather than DOM shape.
 */
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { SpriteHitTester } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import { MOSHPIT_SPRITE_HITTEST_INJECTION_KEY } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { useMoshpitOverrideStore } from '@/platform/moshpit/stores/moshpitOverrideStore'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'
import type { NormalizedParams } from '@/platform/moshpit/services/paramNormalize'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useAssetsStore } from '@/stores/assetsStore'
import { useToastStore } from '@/platform/updates/common/toastStore'

import MoshpitSpriteContextMenu from './MoshpitSpriteContextMenu.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: { en: {} }
})

function makeHitTester(
  getPos: (hash: string) => { x: number; y: number } | null = () => ({
    x: 10,
    y: 20
  })
): SpriteHitTester {
  return {
    hitTestPoint: vi.fn(() => null),
    hitTestRect: vi.fn(() => []),
    getSpriteWorldPos: vi.fn(getPos)
  }
}

function makeParams(
  overrides: Partial<NormalizedParams> = {}
): NormalizedParams {
  return {
    model: 'base.safetensors',
    loras: [],
    cfg: 7,
    steps: 20,
    sampler: 'euler',
    scheduler: 'normal',
    seed: 1,
    positivePrompt: 'a cat',
    negativePrompt: '',
    width: 512,
    height: 512,
    timestamp: 1000,
    workflowFingerprint: 'abc',
    workflowFilename: 'flow.png',
    saveNodeIdentity: 'SaveImage',
    ...overrides
  }
}

function mountMenu(hitTester: SpriteHitTester = makeHitTester()) {
  const wrapper = mount(MoshpitSpriteContextMenu, {
    global: {
      plugins: [
        createTestingPinia({ stubActions: false, createSpy: vi.fn }),
        i18n
      ],
      provide: {
        [MOSHPIT_SPRITE_HITTEST_INJECTION_KEY as symbol]: ref(hitTester)
      }
    }
  })
  return wrapper
}

interface MenuHandle {
  open: (x: number, y: number, hash: string) => void
  close: () => void
  onPinHere: () => void
  onUnpin: () => void
  onDownload: () => void
  onSelectSimilar: () => void
  onResetAllPins: () => void
}

describe('MoshpitSpriteContextMenu — action set (target vs selection)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('Pin here writes the target sprite position into the override store', () => {
    const hitTester = makeHitTester(() => ({ x: 10, y: 20 }))
    const wrapper = mountMenu(hitTester)
    const overrides = useMoshpitOverrideStore()
    const handle = wrapper.vm as unknown as MenuHandle

    handle.open(50, 60, 'hash-A')
    handle.onPinHere()

    expect(overrides.isPinned('hash-A')).toBe(true)
    expect(overrides.get('hash-A')?.pinnedWorldPos).toEqual({ x: 10, y: 20 })
  })

  it('Unpin removes the pin for the target hash', () => {
    const overrides = useMoshpitOverrideStore.bind(null)
    const wrapper = mountMenu()
    const store = overrides()
    store.setPin('hash-A', { x: 1, y: 2 })
    const handle = wrapper.vm as unknown as MenuHandle

    handle.open(0, 0, 'hash-A')
    handle.onUnpin()

    expect(store.isPinned('hash-A')).toBe(false)
  })

  it('acts on the full selection when target is selected and selection size > 1', () => {
    const wrapper = mountMenu()
    const overrides = useMoshpitOverrideStore()
    const selection = useMoshpitSelectionStore()
    selection.setSelection(['hash-A', 'hash-B', 'hash-C'])
    overrides.setPin('hash-A', { x: 0, y: 0 })
    overrides.setPin('hash-B', { x: 0, y: 0 })
    overrides.setPin('hash-C', { x: 0, y: 0 })
    const handle = wrapper.vm as unknown as MenuHandle

    handle.open(0, 0, 'hash-A')
    handle.onUnpin()

    expect(overrides.isPinned('hash-A')).toBe(false)
    expect(overrides.isPinned('hash-B')).toBe(false)
    expect(overrides.isPinned('hash-C')).toBe(false)
  })

  it('acts on just the target when the target is not part of the selection', () => {
    const wrapper = mountMenu()
    const overrides = useMoshpitOverrideStore()
    const selection = useMoshpitSelectionStore()
    selection.setSelection(['hash-B', 'hash-C'])
    overrides.setPin('hash-A', { x: 0, y: 0 })
    overrides.setPin('hash-B', { x: 0, y: 0 })
    const handle = wrapper.vm as unknown as MenuHandle

    handle.open(0, 0, 'hash-A')
    handle.onUnpin()

    expect(overrides.isPinned('hash-A')).toBe(false)
    expect(overrides.isPinned('hash-B')).toBe(true)
  })
})

describe('MoshpitSpriteContextMenu — Download', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('triggers a download per hash in the action set and shows a toast', () => {
    const wrapper = mountMenu()
    const toast = useToastStore()
    const assets = useAssetsStore()
    const addSpy = vi.spyOn(toast, 'add')
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    const makeAsset = (id: string, hash: string): AssetItem =>
      ({
        id,
        asset_hash: hash,
        name: `${id}.png`,
        size: 100,
        mime_type: 'image/png',
        tags: ['output'],
        created_at: '2024-01-01',
        last_access_time: '2024-01-01',
        user_metadata: {}
      }) as unknown as AssetItem

    assets.historyAssets = [makeAsset('a', 'hash-A'), makeAsset('b', 'hash-B')]
    const selection = useMoshpitSelectionStore()
    selection.setSelection(['hash-A', 'hash-B'])
    const handle = wrapper.vm as unknown as MenuHandle

    handle.open(0, 0, 'hash-A')
    handle.onDownload()

    expect(clickSpy).toHaveBeenCalledTimes(2)
    expect(addSpy).toHaveBeenCalledTimes(1)
    expect(addSpy.mock.calls[0]?.[0]?.severity).toBe('info')
  })

  it('single-target download shows the singular toast summary', () => {
    const wrapper = mountMenu()
    const toast = useToastStore()
    const assets = useAssetsStore()
    const addSpy = vi.spyOn(toast, 'add')
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    assets.historyAssets = [
      {
        id: 'a',
        asset_hash: 'hash-A',
        name: 'a.png',
        size: 100,
        mime_type: 'image/png',
        tags: ['output'],
        created_at: '2024-01-01',
        last_access_time: '2024-01-01',
        user_metadata: {}
      } as unknown as AssetItem
    ]
    const handle = wrapper.vm as unknown as MenuHandle

    handle.open(0, 0, 'hash-A')
    handle.onDownload()

    expect(addSpy).toHaveBeenCalledTimes(1)
    const args = addSpy.mock.calls[0]?.[0]
    expect(args?.summary).toBe('moshpit.contextMenu.downloadStarted')
  })
})

describe('MoshpitSpriteContextMenu — Select similar', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sets selection to every hash with matching workflowFilename', () => {
    const wrapper = mountMenu()
    const meta = useMoshpitMetadataStore()
    const selection = useMoshpitSelectionStore()
    meta.setParams('hash-A', makeParams({ workflowFilename: 'flow-1.png' }))
    meta.setParams('hash-B', makeParams({ workflowFilename: 'flow-1.png' }))
    meta.setParams('hash-C', makeParams({ workflowFilename: 'flow-2.png' }))
    const handle = wrapper.vm as unknown as MenuHandle

    handle.open(0, 0, 'hash-A')
    handle.onSelectSimilar()

    expect(new Set(selection.selected)).toEqual(new Set(['hash-A', 'hash-B']))
  })

  it('no-match case toasts and leaves selection unchanged', () => {
    const wrapper = mountMenu()
    const meta = useMoshpitMetadataStore()
    const selection = useMoshpitSelectionStore()
    const toast = useToastStore()
    const addSpy = vi.spyOn(toast, 'add')
    selection.setSelection(['hash-X'])
    // Target has no params at all → workflowFilename resolves to null
    meta.setParams('hash-Y', makeParams({ workflowFilename: 'flow-2.png' }))
    const handle = wrapper.vm as unknown as MenuHandle

    handle.open(0, 0, 'hash-A')
    handle.onSelectSimilar()

    expect(selection.selected).toEqual(['hash-X'])
    expect(addSpy).toHaveBeenCalledTimes(1)
    expect(addSpy.mock.calls[0]?.[0]?.summary).toBe(
      'moshpit.contextMenu.selectSimilarNoMatch'
    )
  })
})

describe('MoshpitSpriteContextMenu — Reset all pins', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes resetAll disabled state that tracks override store size', async () => {
    const wrapper = mountMenu()
    const overrides = useMoshpitOverrideStore()
    const handle = wrapper.vm as unknown as MenuHandle & {
      isResetAllDisabled: boolean
    }

    expect(handle.isResetAllDisabled).toBe(true)

    overrides.setPin('hash-A', { x: 1, y: 2 })
    await wrapper.vm.$nextTick()
    expect(handle.isResetAllDisabled).toBe(false)

    handle.onResetAllPins()
    expect(overrides.size).toBe(0)
  })
})
