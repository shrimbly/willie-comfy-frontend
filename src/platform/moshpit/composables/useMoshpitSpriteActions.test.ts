/**
 * Behavioural coverage of useMoshpitSpriteActions — the shared action vocabulary
 * invoked by both MoshpitSpriteContextMenu (260423-kx4) and
 * MoshpitFloatingActionBar (260423-led). Tests exercise each returned function
 * in isolation against real Pinia stores; the composable is stateless so we
 * can instantiate it inside a trivial host component per test.
 */
import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { SpriteHitTester } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import type { NormalizedParams } from '@/platform/moshpit/services/paramNormalize'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { useMoshpitOverrideStore } from '@/platform/moshpit/stores/moshpitOverrideStore'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAssetsStore } from '@/stores/assetsStore'

import { useMoshpitSpriteActions } from './useMoshpitSpriteActions'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: { en: {} }
})

type ActionsApi = ReturnType<typeof useMoshpitSpriteActions>

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

function makeAsset(id: string, hash: string): AssetItem {
  return {
    id,
    asset_hash: hash,
    name: `${id}.png`,
    size: 100,
    mime_type: 'image/png',
    tags: ['output'],
    created_at: '2024-01-01',
    last_access_time: '2024-01-01',
    user_metadata: {}
  } as unknown as AssetItem
}

function makeHitTester(
  getPos: (hash: string) => { x: number; y: number } | null
): SpriteHitTester {
  return {
    hitTestPoint: vi.fn(() => null),
    hitTestRect: vi.fn(() => []),
    getSpriteWorldPos: vi.fn(getPos),
    hitTestHandle: vi.fn(() => null)
  }
}

function mountActions(
  getHitTester: () => SpriteHitTester | null = () => null
): ActionsApi {
  let captured: ActionsApi | null = null
  const Host = defineComponent({
    setup() {
      captured = useMoshpitSpriteActions({ getHitTester })
      return () => h('div')
    }
  })
  mount(Host, {
    global: {
      plugins: [
        createTestingPinia({ stubActions: false, createSpy: vi.fn }),
        i18n
      ]
    }
  })
  if (!captured) throw new Error('actions not captured')
  return captured
}

describe('useMoshpitSpriteActions — unpinMany', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('unpins every provided hash', () => {
    const actions = mountActions()
    const overrides = useMoshpitOverrideStore()
    overrides.setPin('hash-A', { x: 1, y: 2 })
    overrides.setPin('hash-B', { x: 3, y: 4 })

    actions.unpinMany(['hash-A', 'hash-B'])

    expect(overrides.isPinned('hash-A')).toBe(false)
    expect(overrides.isPinned('hash-B')).toBe(false)
  })
})

describe('useMoshpitSpriteActions — downloadMany', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('triggers one anchor click per resolvable hash and toasts multi-summary', () => {
    const actions = mountActions()
    const toast = useToastStore()
    const assets = useAssetsStore()
    const addSpy = vi.spyOn(toast, 'add')
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    assets.historyAssets = [makeAsset('a', 'hash-A'), makeAsset('b', 'hash-B')]

    actions.downloadMany(['hash-A', 'hash-B'])

    expect(clickSpy).toHaveBeenCalledTimes(2)
    expect(addSpy).toHaveBeenCalledTimes(1)
    expect(addSpy.mock.calls[0]?.[0]?.summary).toBe(
      'moshpit.contextMenu.downloadStartedMulti'
    )
  })

  it('singular toast when one resolvable hash', () => {
    const actions = mountActions()
    const toast = useToastStore()
    const assets = useAssetsStore()
    const addSpy = vi.spyOn(toast, 'add')
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    assets.historyAssets = [makeAsset('a', 'hash-A')]

    actions.downloadMany(['hash-A'])

    expect(addSpy).toHaveBeenCalledTimes(1)
    expect(addSpy.mock.calls[0]?.[0]?.summary).toBe(
      'moshpit.contextMenu.downloadStarted'
    )
  })
})

describe('useMoshpitSpriteActions — pinHereMany', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('writes setPin with the hit-tester world pos for each unpinned hash', () => {
    const hitTester = makeHitTester(() => ({ x: 7, y: 9 }))
    const actions = mountActions(() => hitTester)
    const overrides = useMoshpitOverrideStore()

    actions.pinHereMany(['hash-A', 'hash-B'])

    expect(overrides.get('hash-A')?.pinnedWorldPos).toEqual({ x: 7, y: 9 })
    expect(overrides.get('hash-B')?.pinnedWorldPos).toEqual({ x: 7, y: 9 })
  })

  it('skips already-pinned hashes', () => {
    const tester = makeHitTester(() => ({ x: 99, y: 99 }))
    const actions = mountActions(() => tester)
    const overrides = useMoshpitOverrideStore()
    overrides.setPin('hash-A', { x: 1, y: 2 })

    actions.pinHereMany(['hash-A', 'hash-B'])

    expect(overrides.get('hash-A')?.pinnedWorldPos).toEqual({ x: 1, y: 2 })
    expect(overrides.get('hash-B')?.pinnedWorldPos).toEqual({ x: 99, y: 99 })
  })

  it('is a no-op and warns when hit-tester is null', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const actions = mountActions(() => null)
    const overrides = useMoshpitOverrideStore()

    actions.pinHereMany(['hash-A'])

    expect(overrides.isPinned('hash-A')).toBe(false)
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })
})

describe('useMoshpitSpriteActions — resetAllPins', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('is a no-op when override store is empty', () => {
    const actions = mountActions()
    const overrides = useMoshpitOverrideStore()
    const clearSpy = vi.spyOn(overrides, 'clearAll')

    actions.resetAllPins()

    expect(clearSpy).not.toHaveBeenCalled()
  })

  it('clears all pins when any exist', () => {
    const actions = mountActions()
    const overrides = useMoshpitOverrideStore()
    overrides.setPin('hash-A', { x: 1, y: 2 })
    overrides.setPin('hash-B', { x: 3, y: 4 })

    actions.resetAllPins()

    expect(overrides.size).toBe(0)
  })
})

describe('useMoshpitSpriteActions — selectSimilar', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('sets selection to all hashes sharing the target workflowFilename', () => {
    const actions = mountActions()
    const meta = useMoshpitMetadataStore()
    const selection = useMoshpitSelectionStore()
    meta.setParams('hash-A', makeParams({ workflowFilename: 'flow-1.png' }))
    meta.setParams('hash-B', makeParams({ workflowFilename: 'flow-1.png' }))
    meta.setParams('hash-C', makeParams({ workflowFilename: 'flow-2.png' }))

    actions.selectSimilar('hash-A')

    expect(new Set(selection.selected)).toEqual(new Set(['hash-A', 'hash-B']))
  })

  it('toasts and leaves selection alone when target has no workflowFilename', () => {
    const actions = mountActions()
    const selection = useMoshpitSelectionStore()
    const toast = useToastStore()
    const addSpy = vi.spyOn(toast, 'add')
    selection.setSelection(['hash-X'])

    actions.selectSimilar('hash-A')

    expect(selection.selected).toEqual(['hash-X'])
    expect(addSpy).toHaveBeenCalledTimes(1)
    expect(addSpy.mock.calls[0]?.[0]?.summary).toBe(
      'moshpit.contextMenu.selectSimilarNoMatch'
    )
  })
})

describe('useMoshpitSpriteActions — someSelectedArePinned', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns false for empty input', () => {
    const actions = mountActions()
    expect(actions.someSelectedArePinned([])).toBe(false)
  })

  it('returns true when at least one hash is pinned', () => {
    const actions = mountActions()
    const overrides = useMoshpitOverrideStore()
    overrides.setPin('hash-A', { x: 1, y: 2 })

    expect(actions.someSelectedArePinned(['hash-A', 'hash-B'])).toBe(true)
  })

  it('returns false when none of the inputs are pinned', () => {
    const actions = mountActions()
    expect(actions.someSelectedArePinned(['hash-A', 'hash-B'])).toBe(false)
  })
})
