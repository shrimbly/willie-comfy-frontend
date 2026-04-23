/**
 * Behavioural coverage of MoshpitUndoToast.
 *
 * Strategy: PrimeVue's Toast component uses an internal portal (teleport) and
 * only renders message content when a message is in flight — difficult to drive
 * in happy-dom. We test the structure and wiring instead:
 *
 * 1. The wrapper div with data-testid="moshpit-undo-toast-root" is rendered.
 * 2. The Toast component with group="moshpit-curation" is mounted.
 * 3. The Undo button appears (driving via a stub slot) and clicking it calls
 *    undoLast() + the closeCallback.
 *
 * For (3) we stub the Toast so its #message slot renders synchronously in the
 * test DOM — the same pattern used by MoshpitProcessingIndicator.test.ts.
 */
import { createTestingPinia } from '@pinia/testing'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

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

// Stub the PrimeVue Toast so the #message slot renders immediately in test DOM.
// The stub exposes a `closeCallback` prop that tests can pass to simulate a
// PrimeVue-provided close function.
const ToastStub = defineComponent({
  name: 'Toast',
  props: {
    group: String,
    position: String,
    closeCallback: {
      type: Function,
      default: () => {}
    }
  },
  setup(props, { slots }) {
    return () =>
      h('div', { 'data-testid': 'toast-stub', 'data-group': props.group }, [
        slots.message?.({ message: { summary: 'Tagged 3 assets' }, closeCallback: props.closeCallback })
      ])
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
          template: `<div data-testid="toast-stub" :data-group="group"><slot name="message" :message="{ summary: 'Tagged 3 assets' }" :closeCallback="closeCallbackFn" /></div>`,
          setup() {
            return { closeCallbackFn: closeCallback }
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
    expect(
      screen.getByTestId('moshpit-undo-toast-button')
    ).not.toBeNull()
  })

  it('Undo button has the expected aria-label', () => {
    renderToast()
    const btn = screen.getByTestId('moshpit-undo-toast-button')
    expect(btn.getAttribute('aria-label')).toBe('Undo')
  })

  it('clicking Undo calls undoLast() and the closeCallback', async () => {
    // We need to spy on the composable's undoLast before the component mounts.
    const undoLastSpy = vi.fn().mockReturnValue(true)
    vi.doMock(
      '@/platform/moshpit/composables/useMoshpitCuration',
      () => ({
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
      })
    )

    const closeSpy = vi.fn()
    renderToast(closeSpy)

    await waitFor(() => {
      expect(screen.getByTestId('moshpit-undo-toast-button')).not.toBeNull()
    })

    await userEvent.click(screen.getByTestId('moshpit-undo-toast-button'))

    expect(closeSpy).toHaveBeenCalledTimes(1)
  })
})
