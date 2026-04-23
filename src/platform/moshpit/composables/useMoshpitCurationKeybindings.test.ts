import 'fake-indexeddb/auto'

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import { mount } from '@vue/test-utils'

import { useMoshpitCurationStore } from '../stores/moshpitCurationStore'
import { useMoshpitSelectionStore } from '../stores/moshpitSelectionStore'
import { useMoshpitTournamentStore } from '../stores/moshpitTournamentStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useMoshpitCuration } from './useMoshpitCuration'
import { useMoshpitCurationKeybindings } from './useMoshpitCurationKeybindings'

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
    template:
      '<div ref="containerEl" tabindex="0"><input id="inner-input" /></div>'
  })
  const wrapper = mount(Wrapper, { attachTo: document.body })
  containerEl.value = wrapper.element as HTMLElement
  return { wrapper, el: wrapper.element as HTMLElement }
}

describe('useMoshpitCurationKeybindings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] })
    // Clear module-level lastUndoable before each test
    const c = useMoshpitCuration()
    if (c.lastUndoable.value) c.undoLast()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keydown S with selection calls favouriteMany — curation store updated', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.setSelection(['h1', 'h2', 'h3'])

    const openTagPopover = vi.fn()
    const { el } = makeWrapper(openTagPopover)

    const curationStore = useMoshpitCurationStore()
    const applySpy = vi.spyOn(curationStore, 'applyManyOptimistic')

    keydown(el, 's')
    await nextTick()

    expect(applySpy).toHaveBeenCalledOnce()
  })

  it('keydown S with empty selection is a no-op', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.clear()

    const curationStore = useMoshpitCurationStore()
    const applySpy = vi.spyOn(curationStore, 'applyManyOptimistic')

    const openTagPopover = vi.fn()
    const { el } = makeWrapper(openTagPopover)

    keydown(el, 's')
    await nextTick()

    expect(applySpy).not.toHaveBeenCalled()
  })

  it('keydown S while tournamentStore.isActive is true is a no-op', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.setSelection(['h1', 'h2'])

    const tournamentStore = useMoshpitTournamentStore()
    vi.spyOn(tournamentStore, 'isActive', 'get').mockReturnValue(true)

    const curationStore = useMoshpitCurationStore()
    const applySpy = vi.spyOn(curationStore, 'applyManyOptimistic')

    const openTagPopover = vi.fn()
    const { el } = makeWrapper(openTagPopover)

    keydown(el, 's')
    await nextTick()

    expect(applySpy).not.toHaveBeenCalled()
  })

  it('keydown S when activeElement is an input inside the container is a no-op', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.setSelection(['h1', 'h2'])

    const curationStore = useMoshpitCurationStore()
    const applySpy = vi.spyOn(curationStore, 'applyManyOptimistic')

    const openTagPopover = vi.fn()
    const { wrapper } = makeWrapper(openTagPopover)

    const inputEl = wrapper.find('#inner-input').element as HTMLInputElement
    inputEl.focus()

    keydown(inputEl, 's')
    await nextTick()

    expect(applySpy).not.toHaveBeenCalled()
  })

  it('keydown H calls hideMany — hidden flag flipped in curation store', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.setSelection(['h1', 'h2'])

    const curationStore = useMoshpitCurationStore()
    const applySpy = vi.spyOn(curationStore, 'applyManyOptimistic')

    const openTagPopover = vi.fn()
    const { el } = makeWrapper(openTagPopover)

    keydown(el, 'h')
    await nextTick()

    expect(applySpy).toHaveBeenCalledOnce()
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

  it('keydown E with no resolveFullResUrl is a no-op (no toast, no crash)', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.setSelection(['h1', 'h2'])

    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')

    const openTagPopover = vi.fn()
    const { el } = makeWrapper(openTagPopover)

    // exportMany without resolveFullResUrl is a no-op (console.warn only)
    keydown(el, 'e')
    await nextTick()

    // The curation orchestrator fires no toast when resolver is absent
    expect(addSpy).not.toHaveBeenCalled()
  })

  it('keydown Cmd+Z calls undoLast via the shared curation singleton', async () => {
    // Seed an undoable action so undoLast returns true
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.setSelection(['h1', 'h2'])

    // Fire a bulk favourite so lastUndoable is set
    const curation = useMoshpitCuration()
    curation.favouriteMany(['h1', 'h2'], true)
    expect(curation.lastUndoable.value).not.toBeNull()

    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')

    const openTagPopover = vi.fn()
    const { el } = makeWrapper(openTagPopover)

    keydown(el, 'z', { metaKey: true })
    await nextTick()

    // undoLast clears lastUndoable
    expect(curation.lastUndoable.value).toBeNull()
    // no nothingToUndo toast when undo succeeds
    // (add was called by favouriteMany itself earlier, check no extra calls after)
    const callsAfter = addSpy.mock.calls.filter((c) =>
      c[0].summary?.toString().includes('Nothing to undo')
    )
    expect(callsAfter).toHaveLength(0)
  })

  it('keydown Ctrl+Z when nothing to undo fires nothingToUndo info toast', async () => {
    // Ensure lastUndoable is null (beforeEach already does this)
    const curation = useMoshpitCuration()
    expect(curation.lastUndoable.value).toBeNull()

    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')

    const openTagPopover = vi.fn()
    const { el } = makeWrapper(openTagPopover)

    keydown(el, 'z', { ctrlKey: true })
    await nextTick()

    expect(addSpy).toHaveBeenCalledOnce()
    expect(addSpy.mock.calls[0][0].severity).toBe('info')
  })

  it('listener is removed after unmount — subsequent keydown is a no-op', async () => {
    const selectionStore = useMoshpitSelectionStore()
    selectionStore.setSelection(['h1', 'h2'])

    const curationStore = useMoshpitCurationStore()
    const applySpy = vi.spyOn(curationStore, 'applyManyOptimistic')

    const openTagPopover = vi.fn()
    const { wrapper, el } = makeWrapper(openTagPopover)

    wrapper.unmount()
    keydown(el, 's')
    await nextTick()

    expect(applySpy).not.toHaveBeenCalled()
  })
})
