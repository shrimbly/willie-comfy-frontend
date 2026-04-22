import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { useMoshpitThumbStore } from '@/platform/moshpit/stores/moshpitThumbStore'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'

import MoshpitTournamentWinner from './MoshpitTournamentWinner.vue'

// Echo-key i18n so `t('some.key')` returns 'some.key' for stable assertions.
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: { en: {} }
})

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

afterEach(() => {
  vi.unstubAllGlobals()
})

function seedThumbs(hashes: readonly string[]): void {
  const thumbStore = useMoshpitThumbStore()
  for (const hash of hashes) {
    thumbStore.urlByHash.set(hash, `blob:thumb/${hash}`)
  }
}

function finishSingleElim(hashes: readonly string[]): void {
  const store = useMoshpitTournamentStore()
  store.enter(hashes)
  let safety = 0
  while (!store.isFinished && safety < 100) {
    store.pickWinner('A')
    safety++
  }
}

function finishRoundRobin(hashes: readonly string[]): void {
  const store = useMoshpitTournamentStore()
  store.enter(hashes)
  const total = store.bracket.length
  for (let i = 0; i < total; i++) store.pickWinner('A')
}

function renderWinner() {
  return render(MoshpitTournamentWinner, {
    props: { resolveFullResUrl: () => null },
    global: { plugins: [pinia, i18n] }
  })
}

describe('MoshpitTournamentWinner', () => {
  it('renders a single card for single-elim champion', () => {
    const hashes = Array.from({ length: 8 }, (_, i) => `h${i}`)
    seedThumbs(hashes)
    finishSingleElim(hashes)

    renderWinner()

    const store = useMoshpitTournamentStore()
    expect(store.winnerHashes.length).toBe(1)
    const championHash = store.winnerHashes[0]
    expect(
      screen.getByTestId(`moshpit-tournament-winner-card-${championHash}`)
    ).toBeInTheDocument()
  })

  it('renders one card per winner for round-robin top-N', () => {
    const hashes = ['a', 'b', 'c', 'd']
    seedThumbs(hashes)
    finishRoundRobin(hashes)

    renderWinner()

    const store = useMoshpitTournamentStore()
    expect(store.winnerHashes.length).toBeGreaterThan(1)
    for (const hash of store.winnerHashes) {
      expect(
        screen.getByTestId(`moshpit-tournament-winner-card-${hash}`)
      ).toBeInTheDocument()
    }
  })

  it('emits confirm when the Done button is clicked', async () => {
    const hashes = ['a', 'b']
    seedThumbs(hashes)
    finishSingleElim(hashes)

    const { emitted } = renderWinner()
    await userEvent.click(
      screen.getByTestId('moshpit-tournament-winner-confirm')
    )

    expect(emitted()).toHaveProperty('confirm')
    expect(emitted().confirm.length).toBe(1)
  })

  it('renders metadata rows when metadata store has params', () => {
    const hashes = ['a', 'b']
    seedThumbs(hashes)
    const metadata = useMoshpitMetadataStore()
    metadata.setParams('a', {
      model: 'sdxl',
      loras: [],
      cfg: 7,
      steps: 20,
      sampler: 'euler',
      scheduler: 'normal',
      seed: 123,
      positivePrompt: 'cat',
      negativePrompt: '',
      width: 1024,
      height: 1024,
      timestamp: 0,
      workflowFingerprint: 'fp',
      workflowFilename: null,
      saveNodeIdentity: null
    })
    finishSingleElim(hashes)

    renderWinner()

    const store = useMoshpitTournamentStore()
    const championHash = store.winnerHashes[0]
    expect(championHash).toBe('a')
    expect(
      screen.getByTestId(
        `moshpit-tournament-winner-param-${championHash}-model`
      )
    ).toBeInTheDocument()
  })

  it('renders fallback text when metadata is unavailable', () => {
    const hashes = ['a', 'b']
    seedThumbs(hashes)
    finishSingleElim(hashes)

    renderWinner()

    expect(
      screen.getByText('moshpit.tournament.winner.metadataUnavailable')
    ).toBeInTheDocument()
  })
})
