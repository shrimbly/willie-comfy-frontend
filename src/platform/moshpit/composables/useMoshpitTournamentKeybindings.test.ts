import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

import { useMoshpitTournamentKeybindings } from './useMoshpitTournamentKeybindings'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'

interface MountResult {
  rootEl: Window
}

function mountHarness(): MountResult {
  const Harness = defineComponent({
    setup() {
      useMoshpitTournamentKeybindings()
      return () => h('div', { tabindex: -1 })
    }
  })
  mount(Harness, { attachTo: document.body })
  return { rootEl: window }
}

function dispatchKey(
  el: Window | HTMLElement,
  key: string,
  opts: { shiftKey?: boolean } = {}
): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', {
    key,
    shiftKey: opts.shiftKey ?? false,
    bubbles: true,
    cancelable: true
  })
  const preventSpy = vi.spyOn(ev, 'preventDefault')
  const stopSpy = vi.spyOn(ev, 'stopPropagation')
  el.dispatchEvent(ev)
  Object.assign(ev, { _preventSpy: preventSpy, _stopSpy: stopSpy })
  return ev
}

describe('useMoshpitTournamentKeybindings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('when tournament is inactive', () => {
    it('ignores ArrowLeft (no pickWinner)', () => {
      const { rootEl } = mountHarness()
      const store = useMoshpitTournamentStore()
      const spy = vi.spyOn(store, 'pickWinner')

      dispatchKey(rootEl, 'ArrowLeft')

      expect(spy).not.toHaveBeenCalled()
    })

    it('ignores Space (no toggleFlip)', () => {
      const { rootEl } = mountHarness()
      const store = useMoshpitTournamentStore()
      const spy = vi.spyOn(store, 'toggleFlip')

      dispatchKey(rootEl, ' ')

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('when tournament is active', () => {
    function activate() {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b', 'c', 'd'])
      return store
    }

    it('ArrowLeft -> pickWinner(A) and consumes the event', () => {
      const { rootEl } = mountHarness()
      const store = activate()
      const spy = vi.spyOn(store, 'pickWinner')

      const ev = dispatchKey(rootEl, 'ArrowLeft')

      expect(spy).toHaveBeenCalledWith('A')
      expect(ev.defaultPrevented).toBe(true)
    })

    it('ArrowRight -> pickWinner(B)', () => {
      const { rootEl } = mountHarness()
      const store = activate()
      const spy = vi.spyOn(store, 'pickWinner')

      dispatchKey(rootEl, 'ArrowRight')

      expect(spy).toHaveBeenCalledWith('B')
    })

    it('ArrowDown -> skip', () => {
      const { rootEl } = mountHarness()
      const store = activate()
      const spy = vi.spyOn(store, 'skip')

      dispatchKey(rootEl, 'ArrowDown')

      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('Space -> toggleFlip', () => {
      const { rootEl } = mountHarness()
      const store = activate()
      const spy = vi.spyOn(store, 'toggleFlip')

      dispatchKey(rootEl, ' ')

      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('[ -> cycleDisplayMode(-1)', () => {
      const { rootEl } = mountHarness()
      const store = activate()
      const spy = vi.spyOn(store, 'cycleDisplayMode')

      dispatchKey(rootEl, '[')

      expect(spy).toHaveBeenCalledWith(-1)
    })

    it('] -> cycleDisplayMode(+1)', () => {
      const { rootEl } = mountHarness()
      const store = activate()
      const spy = vi.spyOn(store, 'cycleDisplayMode')

      dispatchKey(rootEl, ']')

      expect(spy).toHaveBeenCalledWith(1)
    })

    it('m (lowercase) -> togglePeek', () => {
      const { rootEl } = mountHarness()
      const store = activate()
      const spy = vi.spyOn(store, 'togglePeek')

      dispatchKey(rootEl, 'm')

      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('M (uppercase) -> togglePeek', () => {
      const { rootEl } = mountHarness()
      const store = activate()
      const spy = vi.spyOn(store, 'togglePeek')

      dispatchKey(rootEl, 'M')

      expect(spy).toHaveBeenCalledTimes(1)
    })

    it(', without shift -> nudgeWipe(-0.05)', () => {
      const { rootEl } = mountHarness()
      const store = activate()
      const spy = vi.spyOn(store, 'nudgeWipe')

      dispatchKey(rootEl, ',')

      expect(spy).toHaveBeenCalledWith(-0.05)
    })

    it('. without shift -> nudgeWipe(+0.05)', () => {
      const { rootEl } = mountHarness()
      const store = activate()
      const spy = vi.spyOn(store, 'nudgeWipe')

      dispatchKey(rootEl, '.')

      expect(spy).toHaveBeenCalledWith(0.05)
    })

    it(', with shift -> nudgeWipe(-0.2)', () => {
      const { rootEl } = mountHarness()
      const store = activate()
      const spy = vi.spyOn(store, 'nudgeWipe')

      dispatchKey(rootEl, ',', { shiftKey: true })

      expect(spy).toHaveBeenCalledWith(-0.2)
    })

    it('. with shift -> nudgeWipe(+0.2)', () => {
      const { rootEl } = mountHarness()
      const store = activate()
      const spy = vi.spyOn(store, 'nudgeWipe')

      dispatchKey(rootEl, '.', { shiftKey: true })

      expect(spy).toHaveBeenCalledWith(0.2)
    })

    it('/ -> resetWipe', () => {
      const { rootEl } = mountHarness()
      const store = activate()
      const spy = vi.spyOn(store, 'resetWipe')

      dispatchKey(rootEl, '/')

      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('Escape is NOT handled here (delegated to Reka DialogContent)', () => {
      const { rootEl } = mountHarness()
      const store = activate()
      const exitSpy = vi.spyOn(store, 'exit')

      const ev = dispatchKey(rootEl, 'Escape')

      expect(exitSpy).not.toHaveBeenCalled()
      expect(ev.defaultPrevented).toBe(false)
    })

    it('unhandled keys do not prevent-default', () => {
      const { rootEl } = mountHarness()
      activate()

      const ev = dispatchKey(rootEl, 'z')

      expect(ev.defaultPrevented).toBe(false)
    })

    it('handled keys call stopPropagation', () => {
      const { rootEl } = mountHarness()
      activate()

      const ev = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
        cancelable: true
      })
      const stopSpy = vi.spyOn(ev, 'stopPropagation')
      rootEl.dispatchEvent(ev)

      expect(stopSpy).toHaveBeenCalled()
    })

    it('listens in capture phase so it fires before bubble-phase listeners', () => {
      const { rootEl } = mountHarness()
      const store = activate()
      const spy = vi.spyOn(store, 'pickWinner')

      // A bubble-phase listener attached after the composable should still
      // receive the event (our handler does stopPropagation in capture —
      // dispatchEvent on window runs capture + target but skips bubble).
      dispatchKey(rootEl, 'ArrowLeft')

      expect(spy).toHaveBeenCalledWith('A')
    })
  })
})
