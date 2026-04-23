import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useMoshpitFoldersStore } from '@/platform/moshpit/stores/moshpitFoldersStore'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { useMoshpitThumbStore } from '@/platform/moshpit/stores/moshpitThumbStore'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'
import { useToastStore } from '@/platform/updates/common/toastStore'

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

describe('MoshpitTournamentWinner — Save as folder', () => {
  it('renders the "Save as folder" button in the footer', () => {
    const hashes = ['h1', 'h2']
    seedThumbs(hashes)
    finishSingleElim(hashes)

    renderWinner()

    expect(
      screen.getByTestId('moshpit-tournament-winner-save-folder')
    ).toBeInTheDocument()
  })

  it('clicking Save as folder shows the inline folder name input', async () => {
    const hashes = ['h1', 'h2']
    seedThumbs(hashes)
    finishSingleElim(hashes)

    renderWinner()

    const btn = screen.getByTestId('moshpit-tournament-winner-save-folder')
    await userEvent.click(btn)

    expect(
      screen.getByTestId('moshpit-tournament-winner-folder-input')
    ).toBeInTheDocument()
    // button should be replaced by the form
    expect(
      screen.queryByTestId('moshpit-tournament-winner-save-folder')
    ).not.toBeInTheDocument()
  })

  it('submitting a valid name calls foldersStore.createFromSelection with winner hashes', async () => {
    const hashes = ['h1', 'h2']
    seedThumbs(hashes)
    finishSingleElim(hashes)

    renderWinner()

    const foldersStore = useMoshpitFoldersStore()
    const createSpy = vi.spyOn(foldersStore, 'createFromSelection')

    const btn = screen.getByTestId('moshpit-tournament-winner-save-folder')
    await userEvent.click(btn)

    const input = screen.getByTestId('moshpit-tournament-winner-folder-input')
    await userEvent.clear(input)
    await userEvent.type(input, 'My Winners')
    await userEvent.keyboard('{Enter}')

    const store = useMoshpitTournamentStore()
    expect(createSpy).toHaveBeenCalledWith('My Winners', store.winnerHashes)
  })

  it('shows an info toast on successful folder creation', async () => {
    const hashes = ['h1', 'h2']
    seedThumbs(hashes)
    finishSingleElim(hashes)

    renderWinner()

    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')
    const foldersStore = useMoshpitFoldersStore()
    vi.spyOn(foldersStore, 'createFromSelection').mockReturnValue('folder-id')

    const btn = screen.getByTestId('moshpit-tournament-winner-save-folder')
    await userEvent.click(btn)

    const input = screen.getByTestId('moshpit-tournament-winner-folder-input')
    await userEvent.clear(input)
    await userEvent.type(input, 'Winners')
    await userEvent.keyboard('{Enter}')

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'info' })
    )
    // input should collapse back to button after success
    expect(
      screen.getByTestId('moshpit-tournament-winner-save-folder')
    ).toBeInTheDocument()
  })

  it('shows a warn toast and does NOT create a folder when name is empty', async () => {
    const hashes = ['h1', 'h2']
    seedThumbs(hashes)
    finishSingleElim(hashes)

    renderWinner()

    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')
    const foldersStore = useMoshpitFoldersStore()
    const createSpy = vi.spyOn(foldersStore, 'createFromSelection')

    const btn = screen.getByTestId('moshpit-tournament-winner-save-folder')
    await userEvent.click(btn)

    const input = screen.getByTestId('moshpit-tournament-winner-folder-input')
    await userEvent.clear(input)
    await userEvent.keyboard('{Enter}')

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn' })
    )
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('clicking Cancel collapses the form back to the Save as folder button', async () => {
    const hashes = ['h1', 'h2']
    seedThumbs(hashes)
    finishSingleElim(hashes)

    renderWinner()

    const btn = screen.getByTestId('moshpit-tournament-winner-save-folder')
    await userEvent.click(btn)

    const cancelBtn = screen.getByTestId(
      'moshpit-tournament-winner-folder-cancel'
    )
    await userEvent.click(cancelBtn)

    expect(
      screen.getByTestId('moshpit-tournament-winner-save-folder')
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('moshpit-tournament-winner-folder-input')
    ).not.toBeInTheDocument()
  })

  it('does NOT call tournamentStore.exit when saving a folder', async () => {
    const hashes = ['h1', 'h2']
    seedThumbs(hashes)
    finishSingleElim(hashes)

    renderWinner()

    const tournamentStore = useMoshpitTournamentStore()
    const exitSpy = vi.spyOn(tournamentStore, 'exit')
    const foldersStore = useMoshpitFoldersStore()
    vi.spyOn(foldersStore, 'createFromSelection').mockReturnValue('folder-id')

    const btn = screen.getByTestId('moshpit-tournament-winner-save-folder')
    await userEvent.click(btn)

    const input = screen.getByTestId('moshpit-tournament-winner-folder-input')
    await userEvent.clear(input)
    await userEvent.type(input, 'Good Ones')
    await userEvent.keyboard('{Enter}')

    expect(exitSpy).not.toHaveBeenCalled()
  })
})
