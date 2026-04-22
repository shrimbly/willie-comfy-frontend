import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/vue'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'
import type { NormalizedParams } from '@/platform/moshpit/services/paramNormalize'
import MoshpitMetadataPeekPanel from './MoshpitMetadataPeekPanel.vue'

// Echo-key i18n so assertions can pin against moshpit.peek.* keys directly.
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: { en: {} }
})

let pinia = createPinia()

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

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

function renderPanel(props: {
  paramsA: NormalizedParams | null
  paramsB: NormalizedParams | null
}) {
  return render(MoshpitMetadataPeekPanel, {
    props,
    global: { plugins: [pinia, i18n] }
  })
}

describe('MoshpitMetadataPeekPanel — visibility gate (PEEK-01)', () => {
  it('renders with translate-x-full (hidden off-screen) when store.isPeekOpen is false', () => {
    const store = useMoshpitTournamentStore()
    store.isPeekOpen = false
    renderPanel({ paramsA: makeParams(), paramsB: makeParams() })

    const aside = screen.getByTestId('moshpit-metadata-peek-panel')
    expect(aside.className).toContain('translate-x-full')
    expect(aside.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders with translate-x-0 (on-screen) when store.isPeekOpen is true', async () => {
    const store = useMoshpitTournamentStore()
    store.isPeekOpen = true
    renderPanel({ paramsA: makeParams(), paramsB: makeParams() })
    await nextTick()

    const aside = screen.getByTestId('moshpit-metadata-peek-panel')
    expect(aside.className).toContain('translate-x-0')
    expect(aside.className).not.toContain('translate-x-full')
    expect(aside.getAttribute('aria-hidden')).toBe('false')
  })

  it('uses a Tailwind transform transition (no hand-rolled JS tween)', () => {
    const store = useMoshpitTournamentStore()
    store.isPeekOpen = true
    renderPanel({ paramsA: makeParams(), paramsB: makeParams() })

    const aside = screen.getByTestId('moshpit-metadata-peek-panel')
    expect(aside.className).toContain('transition-[transform]')
    expect(aside.className).toContain('duration-200')
  })

  it('renders the panel title via the moshpit.peek.panelTitle i18n key', () => {
    const store = useMoshpitTournamentStore()
    store.isPeekOpen = true
    renderPanel({ paramsA: makeParams(), paramsB: makeParams() })

    expect(screen.getByText('moshpit.peek.panelTitle')).toBeTruthy()
  })
})

describe('MoshpitMetadataPeekPanel — param diff rendering (PEEK-02)', () => {
  beforeEach(() => {
    const store = useMoshpitTournamentStore()
    store.isPeekOpen = true
  })

  it('renders all scalar keys in PARAM_DIFF_KEY_ORDER', () => {
    renderPanel({ paramsA: makeParams(), paramsB: makeParams() })

    const rows = screen.getAllByTestId(/^moshpit-metadata-peek-param-row-/)
    // PARAM_DIFF_KEY_ORDER has 14 entries (all NormalizedParams scalars
    // minus loras).
    expect(rows.length).toBe(14)
  })

  it('highlights a differing scalar row with bg-node-component-surface (D-20)', () => {
    renderPanel({
      paramsA: makeParams({ cfg: 7 }),
      paramsB: makeParams({ cfg: 9 })
    })

    const cfgRow = screen.getByTestId('moshpit-metadata-peek-param-row-cfg')
    expect(cfgRow.className).toContain('bg-node-component-surface')
    expect(cfgRow.textContent).toContain('7')
    expect(cfgRow.textContent).toContain('9')
  })

  it('renders a matching scalar row without the differ highlight token', () => {
    renderPanel({
      paramsA: makeParams({ model: 'x' }),
      paramsB: makeParams({ model: 'x' })
    })

    const modelRow = screen.getByTestId('moshpit-metadata-peek-param-row-model')
    expect(modelRow.className).not.toContain('bg-node-component-surface')
  })

  it('renders row labels via the moshpit.peek.params.<key> i18n namespace', () => {
    renderPanel({ paramsA: makeParams(), paramsB: makeParams() })

    const cfgRow = screen.getByTestId('moshpit-metadata-peek-param-row-cfg')
    const stepsRow = screen.getByTestId('moshpit-metadata-peek-param-row-steps')
    expect(cfgRow.textContent).toContain('moshpit.peek.params.cfg')
    expect(stepsRow.textContent).toContain('moshpit.peek.params.steps')
  })
})

describe('MoshpitMetadataPeekPanel — LoRA diff rendering (PEEK-03 / D-21)', () => {
  beforeEach(() => {
    const store = useMoshpitTournamentStore()
    store.isPeekOpen = true
  })

  it('renders added LoRA rows with text-success token', () => {
    renderPanel({
      paramsA: makeParams({ loras: [] }),
      paramsB: makeParams({ loras: [{ name: 'added-lora', weight: 0.8 }] })
    })

    const row = screen.getByTestId('moshpit-metadata-peek-lora-row-added-lora')
    expect(row.className).toContain('text-success')
  })

  it('renders removed LoRA rows with text-danger token', () => {
    renderPanel({
      paramsA: makeParams({ loras: [{ name: 'gone', weight: 0.5 }] }),
      paramsB: makeParams({ loras: [] })
    })

    const row = screen.getByTestId('moshpit-metadata-peek-lora-row-gone')
    expect(row.className).toContain('text-danger')
  })

  it('renders weight-changed LoRA rows with text-warning token', () => {
    renderPanel({
      paramsA: makeParams({ loras: [{ name: 'shift', weight: 1 }] }),
      paramsB: makeParams({ loras: [{ name: 'shift', weight: 0.5 }] })
    })

    const row = screen.getByTestId('moshpit-metadata-peek-lora-row-shift')
    expect(row.className).toContain('text-warning')
  })

  it('renders matching LoRA rows without any diff-state token', () => {
    renderPanel({
      paramsA: makeParams({ loras: [{ name: 'same', weight: 1 }] }),
      paramsB: makeParams({ loras: [{ name: 'same', weight: 1 }] })
    })

    const row = screen.getByTestId('moshpit-metadata-peek-lora-row-same')
    expect(row.className).not.toContain('text-success')
    expect(row.className).not.toContain('text-danger')
    expect(row.className).not.toContain('text-warning')
  })

  it('renders an empty-state message when both LoRA arrays are empty', () => {
    renderPanel({
      paramsA: makeParams({ loras: [] }),
      paramsB: makeParams({ loras: [] })
    })

    expect(screen.getByText('moshpit.peek.lora.empty')).toBeTruthy()
  })
})

describe('MoshpitMetadataPeekPanel — null safety', () => {
  beforeEach(() => {
    const store = useMoshpitTournamentStore()
    store.isPeekOpen = true
  })

  it('renders the loading placeholder when paramsA is null', () => {
    renderPanel({ paramsA: null, paramsB: makeParams() })
    expect(screen.getByText('moshpit.peek.loadingMetadata')).toBeTruthy()
    expect(
      screen.queryAllByTestId(/^moshpit-metadata-peek-param-row-/)
    ).toHaveLength(0)
  })

  it('renders the loading placeholder when paramsB is null', () => {
    renderPanel({ paramsA: makeParams(), paramsB: null })
    expect(screen.getByText('moshpit.peek.loadingMetadata')).toBeTruthy()
    expect(
      screen.queryAllByTestId(/^moshpit-metadata-peek-param-row-/)
    ).toHaveLength(0)
  })

  it('does not crash when both params are null', () => {
    expect(() => renderPanel({ paramsA: null, paramsB: null })).not.toThrow()
    expect(screen.getByText('moshpit.peek.loadingMetadata')).toBeTruthy()
  })
})
