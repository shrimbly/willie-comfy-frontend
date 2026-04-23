/**
 * Behavioural coverage of MoshpitUndoToast.
 *
 * Strategy: PrimeVue's Toast component uses an internal portal (teleport) and
 * only renders message content when a message is in flight — difficult to drive
 * in happy-dom. We stub the Toast component so the #message slot renders
 * synchronously in the test DOM, then assert on structure and click wiring.
 */
import { createTestingPinia } from '@pinia/testing'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

const { undoLastSpy } = vi.hoisted(() => ({
  undoLastSpy: vi.fn().mockReturnValue(true)
}))

vi.mock('@/platform/moshpit/composables/useMoshpitCuration', () => ({
  useMoshpitCuration: () => ({
    undoLast: undoLastSpy,
    lastUndoable: { value: null },
    favouriteMany: vi.fn(),
    tagMany: vi.fn(),
    untagMany: vi.fn(),
    hideMany: vi.fn(),
    unhideMany: vi.fn(),
    addToFolderMany: vi.fn(),
    removeFromFolderMany: vi.fn(),
    exportMany: vi.fn()
  })
}))

import MoshpitUndoToast from './MoshpitUndoToast.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      moshpit: {
        curation: {
          undo: 'Undo'
        }
      }
    }
  }
})

function renderToast(closeCallback = vi.fn()) {
  return render(MoshpitUndoToast, {
    global: {
      plugins: [
        createTestingPinia({ stubActions: false, createSpy: vi.fn }),
        i18n
      ],
      stubs: {
        Toast: {
          name: 'Toast',
          props: ['group', 'position'],
          template: `<div data-testid="toast-stub" :data-group="group"><slot name="message" :message="{ summary: 'Tagged 3 assets' }" :closeCallback="closeFn" /></div>`,
          setup() {
            return { closeFn: closeCallback }
          }
        }
      }
    }
  })
}

describe('MoshpitUndoToast — structure', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders the wrapper with data-testid="moshpit-undo-toast-root"', () => {
    renderToast()
    expect(screen.getByTestId('moshpit-undo-toast-root')).not.toBeNull()
  })

  it('mounts a Toast with group="moshpit-curation"', () => {
    renderToast()
    const stub = screen.getByTestId('toast-stub')
    expect(stub.getAttribute('data-group')).toBe('moshpit-curation')
  })
})

describe('MoshpitUndoToast — Undo button', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders an Undo button via the #message slot', () => {
    renderToast()
    expect(screen.getByTestId('moshpit-undo-toast-button')).not.toBeNull()
  })

  it('Undo button has the expected aria-label', () => {
    renderToast()
    const btn = screen.getByTestId('moshpit-undo-toast-button')
    expect(btn.getAttribute('aria-label')).toBe('Undo')
  })

  it('clicking Undo calls undoLast() and the closeCallback', async () => {
    const closeSpy = vi.fn()
    renderToast(closeSpy)

    await waitFor(() => {
      expect(screen.getByTestId('moshpit-undo-toast-button')).not.toBeNull()
    })

    await userEvent.click(screen.getByTestId('moshpit-undo-toast-button'))

    expect(undoLastSpy).toHaveBeenCalledTimes(1)
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })
})
