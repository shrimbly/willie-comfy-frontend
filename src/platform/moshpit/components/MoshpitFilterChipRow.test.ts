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

function mountChipRow(props: { tier?: 'primary' | 'advanced' } = {}) {
  return render(MoshpitFilterChipRow, {
    props,
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

  it('renders one chip per entry in filterStore.chips (primary + advanced tiers combined)', () => {
    const filterStore = useMoshpitFilterStore()
    // positivePrompt is primary; cfg and sampler are advanced
    filterStore.addChip(
      makeChip('a', 'cfg', { kind: 'numeric', min: 6, max: 8, exact: null })
    )
    filterStore.addChip(
      makeChip('b', 'sampler', { kind: 'categorical', values: ['euler'] })
    )
    filterStore.addChip(
      makeChip('c', 'positivePrompt', { kind: 'text', substring: 'cat' })
    )

    // Default tier='primary' should show only the positivePrompt chip
    mountChipRow()
    expect(screen.getAllByTestId('moshpit-filter-chip')).toHaveLength(1)
  })

  it('clicking the × button calls filterStore.removeChip with the chip id', async () => {
    const user = userEvent.setup()
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip(
      makeChip('chip1', 'cfg', { kind: 'numeric', min: 7, max: 8, exact: null })
    )

    mountChipRow({ tier: 'advanced' })
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

    mountChipRow({ tier: 'advanced' })
    expect(
      screen.getByRole('button', { name: /remove Sampler filter/i })
    ).toBeInTheDocument()
  })

  it('renders aria-live status with chip count', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip(
      makeChip('x', 'cfg', { kind: 'numeric', min: null, max: null, exact: 7 })
    )

    mountChipRow({ tier: 'advanced' })
    const status = screen.getByRole('status')
    expect(status).toBeInTheDocument()
    expect(status.textContent).toContain('1')
  })

  it('renders correct value summary for numeric range chip', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip(
      makeChip('n', 'cfg', { kind: 'numeric', min: 6, max: 8, exact: null })
    )
    mountChipRow({ tier: 'advanced' })
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
    mountChipRow({ tier: 'advanced' })
    const chip = screen.getByTestId('moshpit-filter-chip')
    expect(chip.textContent).toContain('= 20')
  })

  it('renders correct value summary for categorical single value', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip(
      makeChip('c1', 'sampler', { kind: 'categorical', values: ['euler'] })
    )
    mountChipRow({ tier: 'advanced' })
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
    mountChipRow({ tier: 'advanced' })
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
    mountChipRow({ tier: 'advanced' })
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
    mountChipRow({ tier: 'advanced' })
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

  describe('tier prop', () => {
    function seedMixedChips() {
      const filterStore = useMoshpitFilterStore()
      // Primary chips: positivePrompt, model
      filterStore.addChip(
        makeChip('p1', 'positivePrompt', { kind: 'text', substring: 'cat' })
      )
      filterStore.addChip(
        makeChip('p2', 'model', { kind: 'categorical', values: ['sd15.ckpt'] })
      )
      // Advanced chips: cfg, sampler
      filterStore.addChip(
        makeChip('a1', 'cfg', { kind: 'numeric', min: 6, max: 8, exact: null })
      )
      filterStore.addChip(
        makeChip('a2', 'sampler', { kind: 'categorical', values: ['euler'] })
      )
      // Primary chip: favourite
      filterStore.addChip(
        makeChip('p3', 'favourite', { kind: 'boolean', value: true })
      )
    }

    it('defaults to primary tier — renders primary chips and the Add filter popover', () => {
      seedMixedChips()
      mountChipRow()
      expect(screen.getAllByTestId('moshpit-filter-chip')).toHaveLength(3)
      expect(
        screen.getByTestId('moshpit-add-filter-trigger')
      ).toBeInTheDocument()
    })

    it('tier="primary" renders primary chips (positivePrompt, model, favourite) and the popover', () => {
      seedMixedChips()
      mountChipRow({ tier: 'primary' })
      const chips = screen.getAllByTestId('moshpit-filter-chip')
      expect(chips).toHaveLength(3)
      const text = chips.map((c) => c.textContent ?? '').join(' ')
      expect(text).toContain('cat')
      expect(text).toContain('sd15.ckpt')
      expect(text).toContain('Favourite')
      expect(
        screen.getByTestId('moshpit-add-filter-trigger')
      ).toBeInTheDocument()
    })

    it('tier="advanced" renders advanced chips (cfg, sampler) and exposes the Add filter popover', () => {
      seedMixedChips()
      mountChipRow({ tier: 'advanced' })
      const chips = screen.getAllByTestId('moshpit-filter-chip')
      expect(chips).toHaveLength(2)
      const text = chips.map((c) => c.textContent ?? '').join(' ')
      expect(text).toContain('6')
      expect(text).toContain('euler')
      // Users expand the advanced disclosure specifically to add advanced
      // filters — the add-filter trigger must be reachable from there too.
      expect(
        screen.getByTestId('moshpit-add-filter-trigger')
      ).toBeInTheDocument()
    })

    it('chipCount live-region reflects only the tier chip count for tier="primary"', () => {
      seedMixedChips()
      mountChipRow({ tier: 'primary' })
      const status = screen.getByRole('status')
      expect(status.textContent).toContain('3 filters active')
    })

    it('chipCount live-region reflects only the tier chip count for tier="advanced"', () => {
      seedMixedChips()
      mountChipRow({ tier: 'advanced' })
      const status = screen.getByRole('status')
      expect(status.textContent).toContain('2 filters active')
    })
  })
})
