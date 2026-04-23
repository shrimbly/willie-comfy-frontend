import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import { mount } from '@vue/test-utils'

import { useMoshpitTournamentStore } from '../stores/moshpitTournamentStore'
import { useMoshpitSelectionStore } from '../stores/moshpitSelectionStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useMoshpitCuration } from './useMoshpitCuration'
import { useMoshpitCurationKeybindings } from './useMoshpitCurationKeybindings'

// Helper: dispatch a keydown event on an element
function keydown(
  el: HTMLElement,
  key: string,
  opts: { metaKey?: boolean; ctrlKey?: boolean } = {}
): void {
  el.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      metaKey: opts.metaKey ?? false,
      ctrlKey: opts.ctrlKey ?? false
    })
  )
}

function makeWrapper(openTagPopover: () => void) {
  const containerEl = ref<HTMLElement | null>(null)
  const Wrapper = defineComponent({
    setup() {
      useMoshpitCurationKeybindings({ containerEl, openTagPopover })
      return { containerEl }
    },
    template: '<div ref="containerEl" tabindex="0"><input id="inner-input" /></div>'
  })
  const wrapper = mount(Wrapper, { attachTo: document.body })
  const el = wrapper.element as HTMLElement
  containerEl.value = el
  return { wrapper, el, containerEl }
}

describe('useMoshpitCurationKeybindings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keydown S with selection calls favouriteMany', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.setSelection(['h1', 'h2', 'h3'])

    const curation = useMoshpitCuration()
    const favouriteSpy = vi.spyOn(curation, 'favouriteMany')

    // Patch useMoshpitCuration to return our spied instance
    vi.doMock('./useMoshpitCuration', () => ({
      useMoshpitCuration: () => curation,
      UNDO_WINDOW_MS: 8000
    }))

    const openTagPopover = vi.fn()
    const { el } = makeWrapper(openTagPopover)

    keydown(el, 's')
    await nextTick()

    expect(favouriteSpy).toHaveBeenCalledWith(selectionStore.selected)
  })

  it('keydown S with empty selection is a no-op', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.clear()

    const curation = useMoshpitCuration()
    const favouriteSpy = vi.spyOn(curation, 'favouriteMany')

    const openTagPopover = vi.fn()
    const { el } = makeWrapper(openTagPopover)

    keydown(el, 's')
    await nextTick()

    expect(favouriteSpy).not.toHaveBeenCalled()
  })

  it('keydown S while tournament is active is a no-op', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.setSelection(['h1', 'h2'])

    const tournamentStore = useMoshpitTournamentStore()
    // Force isActive by mocking the ref directly
    vi.spyOn(tournamentStore, 'isActive', 'get').mockReturnValue(true)

    const curation = useMoshpitCuration()
    const favouriteSpy = vi.spyOn(curation, 'favouriteMany')

    const openTagPopover = vi.fn()
    const { el } = makeWrapper(openTagPopover)

    keydown(el, 's')
    await nextTick()

    expect(favouriteSpy).not.toHaveBeenCalled()
  })

  it('keydown S when activeElement is an input is a no-op', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.setSelection(['h1', 'h2'])

    const curation = useMoshpitCuration()
    const favouriteSpy = vi.spyOn(curation, 'favouriteMany')

    const openTagPopover = vi.fn()
    const { wrapper } = makeWrapper(openTagPopover)

    const inputEl = wrapper.find('#inner-input').element as HTMLInputElement
    inputEl.focus()

    keydown(inputEl, 's')
    await nextTick()

    expect(favouriteSpy).not.toHaveBeenCalled()
  })

  it('keydown H calls hideMany', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.setSelection(['h1', 'h2'])

    const curation = useMoshpitCuration()
    const hideSpy = vi.spyOn(curation, 'hideMany')

    const openTagPopover = vi.fn()
    const { el } = makeWrapper(openTagPopover)

    keydown(el, 'h')
    await nextTick()

    expect(hideSpy).toHaveBeenCalledWith(selectionStore.selected)
  })

  it('keydown T calls openTagPopover', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.setSelection(['h1'])

    const openTagPopover = vi.fn()
    const { el } = makeWrapper(openTagPopover)

    keydown(el, 't')
    await nextTick()

    expect(openTagPopover).toHaveBeenCalledOnce()
  })

  it('keydown E calls exportMany', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.setSelection(['h1', 'h2'])

    const curation = useMoshpitCuration()
    const exportSpy = vi.spyOn(curation, 'exportMany')

    const openTagPopover = vi.fn()
    const { el } = makeWrapper(openTagPopover)

    keydown(el, 'e')
    await nextTick()

    expect(exportSpy).toHaveBeenCalledWith(selectionStore.selected)
  })

  it('keydown Cmd+Z calls undoLast; if true, does not fire nothingToUndo toast', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.setSelection(['h1', 'h2'])

    const curation = useMoshpitCuration()
    // Make undoLast return true (something to undo)
    vi.spyOn(curation, 'undoLast').mockReturnValue(true)

    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')

    const openTagPopover = vi.fn()
    const { el } = makeWrapper(openTagPopover)

    keydown(el, 'z', { metaKey: true })
    await nextTick()

    expect(curation.undoLast).toHaveBeenCalledOnce()
    expect(addSpy).not.toHaveBeenCalled()
  })

  it('keydown Ctrl+Z when undoLast returns false fires nothingToUndo toast', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.setSelection(['h1'])

    const curation = useMoshpitCuration()
    vi.spyOn(curation, 'undoLast').mockReturnValue(false)

    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')

    const openTagPopover = vi.fn()
    const { el } = makeWrapper(openTagPopover)

    keydown(el, 'z', { ctrlKey: true })
    await nextTick()

    expect(addSpy).toHaveBeenCalledOnce()
    expect(addSpy.mock.calls[0][0].severity).toBe('info')
  })

  it('listener is removed after unmount', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.setSelection(['h1', 'h2'])

    const curation = useMoshpitCuration()
    const favouriteSpy = vi.spyOn(curation, 'favouriteMany')

    const openTagPopover = vi.fn()
    const { wrapper, el } = makeWrapper(openTagPopover)

    wrapper.unmount()
    keydown(el, 's')
    await nextTick()

    expect(favouriteSpy).not.toHaveBeenCalled()
  })
})
