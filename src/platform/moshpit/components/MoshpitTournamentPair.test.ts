import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useMoshpitThumbStore } from '@/platform/moshpit/stores/moshpitThumbStore'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'
import MoshpitTournamentPair from './MoshpitTournamentPair.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      ...enMessages,
      moshpit: {
        ...enMessages.moshpit,
        tournament: { assetAlt: 'Tournament asset' }
      }
    }
  }
})

// Image stub needed by MoshpitTournamentAssetFrame children. Non-constructor
// (`vi.fn(() => {})`) mocks break `new Image()` — use a real function.
function FakeImage(this: {
  src: string
  onload: (() => void) | null
  onerror: (() => void) | null
}) {
  this.src = ''
  this.onload = null
  this.onerror = null
}

let pinia = createPinia()

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  vi.stubGlobal('Image', FakeImage as unknown as typeof Image)
})

function seedThumbs(hashes: readonly string[]): void {
  const thumbStore = useMoshpitThumbStore()
  for (const hash of hashes) {
    thumbStore.urlByHash.set(hash, `blob:thumb/${hash}`)
  }
}

function renderPair(
  resolveFullResUrl: (hash: string) => string | null = () => null
) {
  return render(MoshpitTournamentPair, {
    props: { resolveFullResUrl },
    global: { plugins: [pinia, i18n] }
  })
}

function bootstrapTournament(): ReturnType<typeof useMoshpitTournamentStore> {
  const store = useMoshpitTournamentStore()
  store.enter(['a', 'b', 'c', 'd'])
  return store
}

describe('MoshpitTournamentPair', () => {
  it('renders nothing when currentPair is null (tournament inactive)', () => {
    seedThumbs(['a', 'b'])
    renderPair()
    expect(
      screen.queryAllByTestId('moshpit-tournament-asset-frame')
    ).toHaveLength(0)
  })

  describe('sideBySide mode', () => {
    beforeEach(() => {
      seedThumbs(['a', 'b', 'c', 'd'])
    })

    it('renders two asset frames with 50/50 vertical split (D-15)', () => {
      bootstrapTournament()
      renderPair()

      expect(
        screen.getAllByTestId('moshpit-tournament-asset-frame')
      ).toHaveLength(2)

      const halfPanes = screen.getAllByTestId('moshpit-tournament-pair-half')
      expect(halfPanes).toHaveLength(2)
      for (const pane of halfPanes) {
        expect(pane.classList.contains('w-1/2')).toBe(true)
      }
    })

    it('labels the frames A and B and maps them to currentPair.assetHashA / B', () => {
      const store = bootstrapTournament()
      renderPair()
      const pair = store.currentPair
      expect(pair).not.toBeNull()

      const labels = screen.getAllByTestId('moshpit-tournament-asset-label')
      expect(labels[0].textContent?.trim()).toBe('A')
      expect(labels[1].textContent?.trim()).toBe('B')

      const imgs = screen.getAllByRole('img') as HTMLImageElement[]
      expect(imgs[0].src).toContain(`blob:thumb/${pair?.assetHashA}`)
      expect(imgs[1].src).toContain(`blob:thumb/${pair?.assetHashB}`)
    })
  })

  describe('overlap mode', () => {
    beforeEach(() => {
      seedThumbs(['a', 'b', 'c', 'd'])
    })

    it('renders two layered frames with a divider at wipePosition', () => {
      const store = bootstrapTournament()
      store.setDisplayMode('overlap')
      store.setWipePosition(0.3)

      renderPair()
      expect(
        screen.getAllByTestId('moshpit-tournament-asset-frame')
      ).toHaveLength(2)

      const clippedLayer = screen.getByTestId(
        'moshpit-tournament-pair-clipped'
      ) as HTMLElement
      expect(clippedLayer.style.clipPath).toBe('inset(0 30% 0 0)')

      const divider = screen.getByTestId(
        'moshpit-tournament-pair-divider'
      ) as HTMLElement
      expect(divider.style.left).toBe('30%')
    })

    it('pointer drag on the divider updates store.wipePosition based on root rect', () => {
      const store = bootstrapTournament()
      store.setDisplayMode('overlap')
      store.setWipePosition(0)

      renderPair()
      const root = screen.getByTestId(
        'moshpit-tournament-pair-root'
      ) as HTMLElement
      const divider = screen.getByTestId(
        'moshpit-tournament-pair-divider'
      ) as HTMLElement

      // Stub rect so wipe math is deterministic in happy-dom (default 0s).
      root.getBoundingClientRect = () =>
        ({
          left: 0,
          top: 0,
          right: 1000,
          bottom: 500,
          width: 1000,
          height: 500,
          x: 0,
          y: 0,
          toJSON() {}
        }) as DOMRect

      divider.dispatchEvent(
        new PointerEvent('pointerdown', { pointerId: 1, clientX: 200 })
      )
      divider.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientX: 750 })
      )

      expect(store.wipePosition).toBeCloseTo(0.75, 5)
    })
  })

  describe('flip mode', () => {
    beforeEach(() => {
      seedThumbs(['a', 'b', 'c', 'd'])
    })

    it('renders ONE frame for assetHashA when flipShowsB is false', () => {
      const store = bootstrapTournament()
      store.setDisplayMode('flip')
      expect(store.flipShowsB).toBe(false)
      const pair = store.currentPair

      renderPair()
      expect(
        screen.getAllByTestId('moshpit-tournament-asset-frame')
      ).toHaveLength(1)

      const img = screen.getByRole('img') as HTMLImageElement
      expect(img.src).toContain(`blob:thumb/${pair?.assetHashA}`)

      expect(
        screen.getByTestId('moshpit-tournament-asset-label').textContent?.trim()
      ).toBe('A')
    })

    it('renders ONE frame for assetHashB after toggleFlip() — D-17', async () => {
      const store = bootstrapTournament()
      store.setDisplayMode('flip')
      const pair = store.currentPair

      const { rerender } = renderPair()
      store.toggleFlip()
      await rerender({ resolveFullResUrl: () => null })

      const img = screen.getByRole('img') as HTMLImageElement
      expect(img.src).toContain(`blob:thumb/${pair?.assetHashB}`)
      expect(
        screen.getByTestId('moshpit-tournament-asset-label').textContent?.trim()
      ).toBe('B')
    })
  })

  describe('mode switch preserves store state (D-18)', () => {
    beforeEach(() => {
      seedThumbs(['a', 'b', 'c', 'd'])
    })

    it('wipePosition / flipShowsB survive round-trip across modes', async () => {
      const store = bootstrapTournament()
      const pairBefore = store.currentPair
      store.setWipePosition(0.3)
      store.toggleFlip()
      expect(store.flipShowsB).toBe(true)

      const { rerender } = renderPair()

      store.setDisplayMode('overlap')
      await rerender({ resolveFullResUrl: () => null })
      const clipped = screen.getByTestId(
        'moshpit-tournament-pair-clipped'
      ) as HTMLElement
      expect(clipped.style.clipPath).toBe('inset(0 30% 0 0)')

      store.setDisplayMode('flip')
      await rerender({ resolveFullResUrl: () => null })
      const img = screen.getByRole('img') as HTMLImageElement
      expect(img.src).toContain(`blob:thumb/${pairBefore?.assetHashB}`)

      store.setDisplayMode('sideBySide')
      await rerender({ resolveFullResUrl: () => null })
      expect(
        screen.getAllByTestId('moshpit-tournament-asset-frame')
      ).toHaveLength(2)

      // State on the store itself is untouched.
      expect(store.wipePosition).toBe(0.3)
      expect(store.flipShowsB).toBe(true)
      expect(store.currentPair).toEqual(pairBefore)
    })
  })

  describe('resolveFullResUrl prop', () => {
    beforeEach(() => {
      seedThumbs(['a', 'b', 'c', 'd'])
    })

    it('invokes the resolver with each frame hash', () => {
      const store = bootstrapTournament()
      const pair = store.currentPair
      const resolver = vi.fn<(hash: string) => string | null>(
        (h) => `/full/${h}`
      )
      renderPair(resolver)
      expect(resolver).toHaveBeenCalledWith(pair?.assetHashA)
      expect(resolver).toHaveBeenCalledWith(pair?.assetHashB)
    })
  })
})
