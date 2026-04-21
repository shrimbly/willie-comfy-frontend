import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import type { FilterChip } from '@/platform/moshpit/services/filterTypes'
import MoshpitFilterChipRow from './MoshpitFilterChipRow.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

// Stub out MoshpitAddFilterPopover to avoid rendering its full tree in chip row tests
vi.mock('./MoshpitAddFilterPopover.vue', () => ({
  default: {
    name: 'MoshpitAddFilterPopover',
    template:
      '<button data-testid="moshpit-add-filter-trigger">Add filter</button>'
  }
}))

let pinia = createPinia()

function mountChipRow() {
  return render(MoshpitFilterChipRow, {
    global: { plugins: [pinia, i18n] }
  })
}

function makeChip(
  id: string,
  param: FilterChip['param'],
  value: FilterChip['value']
): FilterChip {
  return { id, param, value }
}

describe('MoshpitFilterChipRow', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('renders zero chips and the Add filter trigger when filterStore.chips is empty', () => {
    mountChipRow()
    expect(screen.queryAllByTestId('moshpit-filter-chip')).toHaveLength(0)
    expect(screen.getByTestId('moshpit-add-filter-trigger')).toBeInTheDocument()
  })

  it('renders every chip in filterStore.chips regardless of primary/advanced tier', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip(
      makeChip('a', 'cfg', { kind: 'numeric', min: 6, max: 8, exact: null })
    )
    filterStore.addChip(
      makeChip('b', 'sampler', { kind: 'categorical', values: ['euler'] })
    )
    filterStore.addChip(
      makeChip('c', 'positivePrompt', { kind: 'text', substring: 'cat' })
    )

    mountChipRow()
    expect(screen.getAllByTestId('moshpit-filter-chip')).toHaveLength(3)
  })

  it('clicking the × button calls filterStore.removeChip with the chip id', async () => {
    const user = userEvent.setup()
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip(
      makeChip('chip1', 'cfg', { kind: 'numeric', min: 7, max: 8, exact: null })
    )

    mountChipRow()
    const removeBtn = screen.getByRole('button', { name: /remove CFG filter/i })
    const removeSpy = vi.spyOn(filterStore, 'removeChip')

    await user.click(removeBtn)

    expect(removeSpy).toHaveBeenCalledWith('chip1')
  })

  it('remove button has aria-label including the chip parameter display name', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip(
      makeChip('s1', 'sampler', { kind: 'categorical', values: ['euler'] })
    )

    mountChipRow()
    expect(
      screen.getByRole('button', { name: /remove Sampler filter/i })
    ).toBeInTheDocument()
  })

  it('renders aria-live status with chip count', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip(
      makeChip('x', 'cfg', { kind: 'numeric', min: null, max: null, exact: 7 })
    )

    mountChipRow()
    const status = screen.getByRole('status')
    expect(status).toBeInTheDocument()
    expect(status.textContent).toContain('1')
  })

  it('renders correct value summary for numeric range chip', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip(
      makeChip('n', 'cfg', { kind: 'numeric', min: 6, max: 8, exact: null })
    )
    mountChipRow()
    const chip = screen.getByTestId('moshpit-filter-chip')
    expect(chip.textContent).toContain('6')
    expect(chip.textContent).toContain('8')
  })

  it('renders correct value summary for numeric exact chip', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip(
      makeChip('e', 'steps', {
        kind: 'numeric',
        min: null,
        max: null,
        exact: 20
      })
    )
    mountChipRow()
    const chip = screen.getByTestId('moshpit-filter-chip')
    expect(chip.textContent).toContain('= 20')
  })

  it('renders correct value summary for categorical single value', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip(
      makeChip('c1', 'sampler', { kind: 'categorical', values: ['euler'] })
    )
    mountChipRow()
    expect(screen.getByTestId('moshpit-filter-chip').textContent).toContain(
      'euler'
    )
  })

  it('renders correct value summary for categorical multi-value', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip(
      makeChip('c2', 'sampler', {
        kind: 'categorical',
        values: ['euler', 'dpmpp_2m']
      })
    )
    mountChipRow()
    expect(screen.getByTestId('moshpit-filter-chip').textContent).toContain(
      '+1'
    )
  })

  it('renders correct value summary for text chip (quoted)', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip(
      makeChip('t1', 'positivePrompt', {
        kind: 'text',
        substring: 'masterpiece'
      })
    )
    mountChipRow()
    expect(screen.getByTestId('moshpit-filter-chip').textContent).toContain(
      '"masterpiece"'
    )
  })

  it('renders correct value summary for resolution single pair', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip(
      makeChip('r1', 'resolution', { kind: 'resolution', pairs: [[512, 512]] })
    )
    mountChipRow()
    expect(screen.getByTestId('moshpit-filter-chip').textContent).toContain(
      '512'
    )
  })

  it('renders correct value summary for resolution multi pair', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip(
      makeChip('r2', 'resolution', {
        kind: 'resolution',
        pairs: [
          [512, 512],
          [768, 768]
        ]
      })
    )
    mountChipRow()
    expect(screen.getByTestId('moshpit-filter-chip').textContent).toContain(
      '+1'
    )
  })

  it('renders correct value summary for boolean chip (favourite=true)', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip(
      makeChip('b1', 'favourite', { kind: 'boolean', value: true })
    )
    mountChipRow()
    expect(screen.getByTestId('moshpit-filter-chip').textContent).toContain(
      'Favourite'
    )
  })

  describe('unified chip area', () => {
    function seedMixedChips() {
      const filterStore = useMoshpitFilterStore()
      filterStore.addChip(
        makeChip('p1', 'positivePrompt', { kind: 'text', substring: 'cat' })
      )
      filterStore.addChip(
        makeChip('p2', 'model', { kind: 'categorical', values: ['sd15.ckpt'] })
      )
      filterStore.addChip(
        makeChip('a1', 'cfg', { kind: 'numeric', min: 6, max: 8, exact: null })
      )
      filterStore.addChip(
        makeChip('a2', 'sampler', { kind: 'categorical', values: ['euler'] })
      )
      filterStore.addChip(
        makeChip('p3', 'favourite', { kind: 'boolean', value: true })
      )
    }

    it('renders every active chip regardless of primary/advanced tier', () => {
      seedMixedChips()
      mountChipRow()
      const chips = screen.getAllByTestId('moshpit-filter-chip')
      expect(chips).toHaveLength(5)
      const text = chips.map((c) => c.textContent ?? '').join(' ')
      expect(text).toContain('cat')
      expect(text).toContain('sd15.ckpt')
      expect(text).toContain('Favourite')
      expect(text).toContain('6')
      expect(text).toContain('euler')
    })

    it('renders the Add filter trigger above the chip list', () => {
      seedMixedChips()
      mountChipRow()
      expect(
        screen.getByTestId('moshpit-add-filter-trigger')
      ).toBeInTheDocument()
    })

    it('chipCount live-region reflects the total chip count across tiers', () => {
      seedMixedChips()
      mountChipRow()
      const status = screen.getByRole('status')
      expect(status.textContent).toContain('5 filters active')
    })
  })
})
