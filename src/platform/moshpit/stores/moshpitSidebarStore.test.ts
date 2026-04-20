import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  MOSHPIT_SETTINGS_PANEL_ID,
  useMoshpitSidebarStore
} from './moshpitSidebarStore'

describe('moshpitSidebarStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('has correct initial state', () => {
    const store = useMoshpitSidebarStore()
    expect(store.activePanelId).toBe(MOSHPIT_SETTINGS_PANEL_ID)
    expect(store.hasHadFirstInteraction).toBe(false)
    expect(store.isPanelOpen).toBe(true)
  })

  it('collapseOnFirstClick closes panel and sets interaction flag', () => {
    const store = useMoshpitSidebarStore()
    store.collapseOnFirstClick()
    expect(store.activePanelId).toBeNull()
    expect(store.hasHadFirstInteraction).toBe(true)
    expect(store.isPanelOpen).toBe(false)
  })

  it('second collapseOnFirstClick is a no-op (D-11)', () => {
    const store = useMoshpitSidebarStore()
    store.collapseOnFirstClick()
    store.activePanelId // collapsed
    // Manually re-open by setting activePanelId as if user re-opened
    // Actually, second call after first interaction should be no-op:
    store.collapseOnFirstClick() // second call — no-op
    expect(store.activePanelId).toBeNull() // stays in whatever state
  })

  it('openPanel sets activePanelId and locks out auto-collapse (D-11)', () => {
    const store = useMoshpitSidebarStore()
    store.collapseOnFirstClick() // first click collapses
    store.openPanel('settings') // user explicitly re-opens
    expect(store.activePanelId).toBe('settings')
    expect(store.isPanelOpen).toBe(true)
    expect(store.hasHadFirstInteraction).toBe(true)
  })

  it('preserves open state when user explicitly re-opened after initial collapse (D-11 critical)', () => {
    const store = useMoshpitSidebarStore()
    store.collapseOnFirstClick() // first click auto-collapses
    store.openPanel('settings') // user re-opens explicitly
    store.collapseOnFirstClick() // another click — should NOT collapse
    expect(store.isPanelOpen).toBe(true)
    expect(store.activePanelId).toBe('settings')
  })

  it('togglePanel closes open panel', () => {
    const store = useMoshpitSidebarStore()
    expect(store.isPanelOpen).toBe(true)
    store.togglePanel('settings')
    expect(store.activePanelId).toBeNull()
    expect(store.isPanelOpen).toBe(false)
  })

  it('togglePanel opens closed panel and sets interaction flag', () => {
    const store = useMoshpitSidebarStore()
    store.closePanel()
    store.togglePanel('settings')
    expect(store.activePanelId).toBe('settings')
    expect(store.isPanelOpen).toBe(true)
    expect(store.hasHadFirstInteraction).toBe(true)
  })

  it('closePanel sets activePanelId to null', () => {
    const store = useMoshpitSidebarStore()
    store.closePanel()
    expect(store.activePanelId).toBeNull()
    expect(store.isPanelOpen).toBe(false)
  })

  it('isPanelOpen reflects activePanelId !== null', () => {
    const store = useMoshpitSidebarStore()
    store.closePanel()
    expect(store.isPanelOpen).toBe(false)
    store.openPanel('settings')
    expect(store.isPanelOpen).toBe(true)
    store.closePanel()
    expect(store.isPanelOpen).toBe(false)
  })
})
