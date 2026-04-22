import { render, screen, within } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'

import MoshpitTournamentBracketTree from './MoshpitTournamentBracketTree.vue'

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

function renderTree() {
  return render(MoshpitTournamentBracketTree, {
    global: { plugins: [pinia, i18n] }
  })
}

describe('MoshpitTournamentBracketTree', () => {
  it('round-robin: renders one pair card per bracket pair in a single list', async () => {
    const store = useMoshpitTournamentStore()
    store.enter(['a', 'b', 'c', 'd'])

    renderTree()
    await nextTick()

    const pairs = screen.queryAllByTestId(/^moshpit-bracket-pair-/)
    expect(pairs.length).toBe(6)
  })

  it('single-elim: segments into round columns that grow as rounds are generated', async () => {
    const store = useMoshpitTournamentStore()
    const hashes = Array.from({ length: 8 }, (_, i) => `h${i}`)
    store.enter(hashes)

    renderTree()
    await nextTick()

    expect(screen.getByTestId('moshpit-bracket-round-0')).toBeInTheDocument()
    expect(screen.queryByTestId('moshpit-bracket-round-1')).toBeNull()

    // Complete round 1: 4 picks.
    store.pickWinner('A')
    store.pickWinner('A')
    store.pickWinner('A')
    store.pickWinner('A')
    await nextTick()

    const round0 = screen.getByTestId('moshpit-bracket-round-0')
    const round1 = screen.getByTestId('moshpit-bracket-round-1')
    expect(
      within(round0).queryAllByTestId(/^moshpit-bracket-pair-/).length
    ).toBe(4)
    expect(
      within(round1).queryAllByTestId(/^moshpit-bracket-pair-/).length
    ).toBe(2)
  })

  it('marks the winning sub-box with data-testid="moshpit-bracket-winner"', async () => {
    const store = useMoshpitTournamentStore()
    store.enter(['a', 'b', 'c', 'd'])

    renderTree()
    await nextTick()

    store.pickWinner('A')
    await nextTick()

    const winners = screen.queryAllByTestId('moshpit-bracket-winner')
    expect(winners.length).toBe(1)
  })

  it('moves data-current="true" to the active pair', async () => {
    const store = useMoshpitTournamentStore()
    store.enter(['a', 'b', 'c', 'd'])

    renderTree()
    await nextTick()

    expect(screen.getByTestId('moshpit-bracket-pair-0')).toHaveAttribute(
      'data-current',
      'true'
    )

    store.pickWinner('A')
    await nextTick()

    expect(screen.getByTestId('moshpit-bracket-pair-0')).not.toHaveAttribute(
      'data-current'
    )
    expect(screen.getByTestId('moshpit-bracket-pair-1')).toHaveAttribute(
      'data-current',
      'true'
    )
  })

  it('flags skipped pairs with data-skipped="true"', async () => {
    const store = useMoshpitTournamentStore()
    store.enter(['a', 'b', 'c', 'd'])

    renderTree()
    await nextTick()

    const firstPair = store.currentPair!
    const firstIndex = firstPair.index

    store.skip()
    await nextTick()

    expect(
      screen.getByTestId(`moshpit-bracket-pair-${firstIndex}`)
    ).toHaveAttribute('data-skipped', 'true')
  })

  it('renders nothing when the tournament is finished', async () => {
    const store = useMoshpitTournamentStore()
    store.enter(['a', 'b', 'c', 'd'])
    const total = store.bracket.length
    for (let i = 0; i < total; i++) store.pickWinner('A')
    expect(store.isFinished).toBe(true)

    renderTree()
    await nextTick()

    expect(screen.queryByTestId('moshpit-bracket-root')).toBeNull()
  })

  it('renders nothing when no tournament is active', async () => {
    renderTree()
    await nextTick()

    expect(screen.queryByTestId('moshpit-bracket-root')).toBeNull()
  })
})
