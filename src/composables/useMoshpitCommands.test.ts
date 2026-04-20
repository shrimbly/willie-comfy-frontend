import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n', () => ({ t: (k: string) => k }))

import { useMoshpitCommands } from './useMoshpitCommands'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'
import { useMoshpitViewportStore } from '@/platform/moshpit/stores/moshpitViewportStore'

describe('useMoshpitCommands', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns exactly 4 commands with correct ids', () => {
    const commands = useMoshpitCommands()
    expect(commands).toHaveLength(4)
    const ids = commands.map((c) => c.id)
    expect(ids).toContain('Moshpit.Canvas.FitView')
    expect(ids).toContain('Moshpit.Canvas.ZoomToSelection')
    expect(ids).toContain('Moshpit.Canvas.SelectAll')
    expect(ids).toContain('Moshpit.Canvas.ClearSelection')
  })

  it('all commands have non-empty label results', () => {
    const commands = useMoshpitCommands()
    for (const command of commands) {
      const label =
        typeof command.label === 'function' ? command.label() : command.label
      expect(label).toBeTruthy()
    }
  })

  it('Moshpit.Canvas.FitView calls requestFitView()', () => {
    const viewport = useMoshpitViewportStore()
    const spy = vi.spyOn(viewport, 'requestFitView')

    const commands = useMoshpitCommands()
    const cmd = commands.find((c) => c.id === 'Moshpit.Canvas.FitView')!
    cmd.function()

    expect(spy).toHaveBeenCalledOnce()
  })

  it('Moshpit.Canvas.ZoomToSelection with empty selection is a no-op (does NOT call requestZoomToSelection)', () => {
    const viewport = useMoshpitViewportStore()
    const zoomSpy = vi.spyOn(viewport, 'requestZoomToSelection')

    const commands = useMoshpitCommands()
    const cmd = commands.find((c) => c.id === 'Moshpit.Canvas.ZoomToSelection')!
    cmd.function()

    expect(zoomSpy).not.toHaveBeenCalled()
  })

  it('Moshpit.Canvas.SelectAll calls selectAll([])', () => {
    const selection = useMoshpitSelectionStore()
    const spy = vi.spyOn(selection, 'selectAll')

    const commands = useMoshpitCommands()
    const cmd = commands.find((c) => c.id === 'Moshpit.Canvas.SelectAll')!
    cmd.function()

    expect(spy).toHaveBeenCalledWith([])
  })

  it('Moshpit.Canvas.ClearSelection calls clear()', () => {
    const selection = useMoshpitSelectionStore()
    const spy = vi.spyOn(selection, 'clear')

    const commands = useMoshpitCommands()
    const cmd = commands.find((c) => c.id === 'Moshpit.Canvas.ClearSelection')!
    cmd.function()

    expect(spy).toHaveBeenCalledOnce()
  })
})
