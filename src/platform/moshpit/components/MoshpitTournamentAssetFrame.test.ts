import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/vue'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useMoshpitThumbStore } from '@/platform/moshpit/stores/moshpitThumbStore'
import MoshpitTournamentAssetFrame from './MoshpitTournamentAssetFrame.vue'

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

interface FakePreloader {
  src: string
  onload: (() => void) | null
  onerror: (() => void) | null
}

const preloaderInstances: FakePreloader[] = []

function FakeImage(this: FakePreloader) {
  this.src = ''
  this.onload = null
  this.onerror = null
  preloaderInstances.push(this)
}

let pinia = createPinia()

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  preloaderInstances.length = 0
  vi.stubGlobal('Image', FakeImage as unknown as typeof Image)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderFrame(props: {
  hash: string
  fullResUrl: string | null
  label?: 'A' | 'B'
  highlight?: boolean
}) {
  return render(MoshpitTournamentAssetFrame, {
    props,
    global: { plugins: [pinia, i18n] }
  })
}

function seedThumb(hash: string, url: string): void {
  const thumbStore = useMoshpitThumbStore()
  thumbStore.urlByHash.set(hash, url)
}

describe('MoshpitTournamentAssetFrame', () => {
  it('renders the thumb URL when fullResUrl is null', () => {
    seedThumb('hash-a', 'blob:thumb/a')
    renderFrame({ hash: 'hash-a', fullResUrl: null })

    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.src).toContain('blob:thumb/a')
  })

  it('does NOT construct a preloader Image when fullResUrl is null', () => {
    seedThumb('hash-a', 'blob:thumb/a')
    renderFrame({ hash: 'hash-a', fullResUrl: null })
    expect(preloaderInstances).toHaveLength(0)
  })

  it('renders thumb first when fullResUrl is set but not yet loaded, then swaps to full-res on load', async () => {
    seedThumb('hash-a', 'blob:thumb/a')
    renderFrame({ hash: 'hash-a', fullResUrl: '/full/a.png' })

    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.src).toContain('blob:thumb/a')

    expect(preloaderInstances).toHaveLength(1)
    const preloader = preloaderInstances[0]
    expect(preloader.src).toBe('/full/a.png')

    preloader.onload?.()
    await nextTick()

    expect(img.src).toContain('/full/a.png')
    expect(img.src).not.toContain('blob:thumb/a')
  })

  it('stays on the thumb if full-res preload errors', async () => {
    seedThumb('hash-a', 'blob:thumb/a')
    renderFrame({ hash: 'hash-a', fullResUrl: '/full/a.png' })

    const preloader = preloaderInstances[0]
    preloader.onerror?.()
    await nextTick()

    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.src).toContain('blob:thumb/a')
  })

  it('does not render an img element when thumb is missing and full-res not loaded', () => {
    renderFrame({ hash: 'missing-hash', fullResUrl: null })
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('renders the A label badge when label="A"', () => {
    seedThumb('hash-a', 'blob:thumb/a')
    renderFrame({ hash: 'hash-a', fullResUrl: null, label: 'A' })
    const badge = screen.getByTestId('moshpit-tournament-asset-label')
    expect(badge.textContent?.trim()).toBe('A')
  })

  it('renders the B label badge when label="B"', () => {
    seedThumb('hash-a', 'blob:thumb/a')
    renderFrame({ hash: 'hash-a', fullResUrl: null, label: 'B' })
    const badge = screen.getByTestId('moshpit-tournament-asset-label')
    expect(badge.textContent?.trim()).toBe('B')
  })

  it('does not render a label badge when label is undefined', () => {
    seedThumb('hash-a', 'blob:thumb/a')
    renderFrame({ hash: 'hash-a', fullResUrl: null })
    expect(screen.queryByTestId('moshpit-tournament-asset-label')).toBeNull()
  })

  it('applies the highlight ring class when highlight=true', () => {
    seedThumb('hash-a', 'blob:thumb/a')
    renderFrame({ hash: 'hash-a', fullResUrl: null, highlight: true })
    const root = screen.getByTestId('moshpit-tournament-asset-frame')
    expect(root.classList.contains('ring-2')).toBe(true)
  })

  it('does NOT apply the highlight ring class when highlight is false/undefined', () => {
    seedThumb('hash-a', 'blob:thumb/a')
    renderFrame({ hash: 'hash-a', fullResUrl: null })
    const root = screen.getByTestId('moshpit-tournament-asset-frame')
    expect(root.classList.contains('ring-2')).toBe(false)
  })

  it('gives the <img> an alt attribute', () => {
    seedThumb('hash-a', 'blob:thumb/a')
    renderFrame({ hash: 'hash-a', fullResUrl: null })
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.alt.length).toBeGreaterThan(0)
  })

  it('rebuilds the preloader when fullResUrl changes between renders', async () => {
    seedThumb('hash-a', 'blob:thumb/a')
    const { rerender } = renderFrame({
      hash: 'hash-a',
      fullResUrl: '/full/a.png'
    })
    expect(preloaderInstances).toHaveLength(1)
    expect(preloaderInstances[0].src).toBe('/full/a.png')

    await rerender({ hash: 'hash-a', fullResUrl: '/full/a-v2.png' })
    expect(preloaderInstances).toHaveLength(2)
    expect(preloaderInstances[1].src).toBe('/full/a-v2.png')
  })
})
