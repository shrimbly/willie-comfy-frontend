import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { ViewportBbox } from './moshpitViewportStore'
import { useMoshpitViewportStore } from './moshpitViewportStore'

describe('moshpitViewportStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('has correct initial state', () => {
    const store = useMoshpitViewportStore()
    expect(store.panX).toBe(0)
    expect(store.panY).toBe(0)
    expect(store.zoom).toBe(1)
    expect(store.screenWidth).toBe(0)
    expect(store.screenHeight).toBe(0)
  })

  it('setPan updates panX and panY', () => {
    const store = useMoshpitViewportStore()
    store.setPan(100, 200)
    expect(store.panX).toBe(100)
    expect(store.panY).toBe(200)
  })

  it('transform computed reflects current pan and zoom', () => {
    const store = useMoshpitViewportStore()
    store.setPan(50, 75)
    store.setZoom(2)
    expect(store.transform).toEqual({ panX: 50, panY: 75, zoom: 2 })
  })

  it('setZoom clamps to minimum 0.01', () => {
    const store = useMoshpitViewportStore()
    store.setZoom(0)
    expect(store.zoom).toBe(0.01)
    store.setZoom(-5)
    expect(store.zoom).toBe(0.01)
  })

  it('setZoom clamps to maximum 50', () => {
    const store = useMoshpitViewportStore()
    store.setZoom(100)
    expect(store.zoom).toBe(50)
  })

  it('setZoom accepts valid values within range', () => {
    const store = useMoshpitViewportStore()
    store.setZoom(2.5)
    expect(store.zoom).toBe(2.5)
  })

  it('setScreenSize updates screenWidth and screenHeight', () => {
    const store = useMoshpitViewportStore()
    store.setScreenSize(1920, 1080)
    expect(store.screenWidth).toBe(1920)
    expect(store.screenHeight).toBe(1080)
  })

  it('requestFitView sets pendingFitView and consumeFitView returns true then false', () => {
    const store = useMoshpitViewportStore()
    expect(store.consumeFitView()).toBe(false)
    store.requestFitView()
    expect(store.consumeFitView()).toBe(true)
    expect(store.consumeFitView()).toBe(false)
  })

  it('requestZoomToSelection sets pending bbox and consumeZoomToSelection returns it then null', () => {
    const store = useMoshpitViewportStore()
    expect(store.consumeZoomToSelection()).toBeNull()

    const bbox: ViewportBbox = { x: 10, y: 20, width: 100, height: 200 }
    store.requestZoomToSelection(bbox)
    expect(store.consumeZoomToSelection()).toEqual(bbox)
    expect(store.consumeZoomToSelection()).toBeNull()
  })
})
