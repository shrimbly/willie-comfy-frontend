import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/vue'
import { computed, ref, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { MOSHPIT_VIEWPORT_INJECTION_KEY } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import type { ClusterNode } from '@/platform/moshpit/services/clusterLayout'
import { OTHER_BUCKET_KEY } from '@/platform/moshpit/services/groupAxes'
import MoshpitClusterOverlay from './MoshpitClusterOverlay.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

// Mutable stubs for useMoshpitFilteredAssets return values.
const clusterTreeStub = ref<ClusterNode | null>(null)

vi.mock('@/platform/moshpit/composables/useMoshpitFilteredAssets', () => ({
  useMoshpitFilteredAssets: () => ({
    clusterTree: computed(() => clusterTreeStub.value)
  })
}))

interface FakeViewport {
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  toScreen: (worldX: number, worldY: number) => { x: number; y: number }
  __handlers: Map<string, Set<(...args: unknown[]) => void>>
  __scale: number
  __fireMoved: () => void
}

function makeFakeViewport(): FakeViewport {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>()
  const vp: FakeViewport = {
    __handlers: handlers,
    __scale: 2,
    on: vi.fn<(event: string, h: (...args: unknown[]) => void) => void>(
      (event, h) => {
        let set = handlers.get(event)
        if (!set) {
          set = new Set()
          handlers.set(event, set)
        }
        set.add(h)
      }
    ),
    off: vi.fn<(event: string, h: (...args: unknown[]) => void) => void>(
      (event, h) => {
        handlers.get(event)?.delete(h)
      }
    ),
    toScreen(worldX: number, worldY: number) {
      return { x: worldX * vp.__scale, y: worldY * vp.__scale }
    },
    __fireMoved() {
      const set = handlers.get('moved')
      if (!set) return
      for (const h of set) h()
    }
  }
  return vp
}

function bounds(x: number, y: number, w: number, h: number) {
  return { x, y, w, h }
}

function leaf(bucketValue: string, depth: number): ClusterNode {
  return {
    axis: 'workflow',
    bucketValue,
    depth,
    boundsWorld: bounds(0, 0, 10, 10),
    children: [],
    leafHashes: []
  }
}

function node(
  bucketValue: string,
  depth: number,
  children: readonly ClusterNode[],
  b = bounds(0, 0, 100, 100)
): ClusterNode {
  return {
    axis: depth === -1 ? null : 'workflow',
    bucketValue,
    depth,
    boundsWorld: b,
    children,
    leafHashes: []
  }
}

let pinia = createPinia()

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  clusterTreeStub.value = null
})

function renderWithViewport(
  viewport: FakeViewport | null = makeFakeViewport()
) {
  const viewportRef = shallowRef(viewport)
  const result = render(MoshpitClusterOverlay, {
    global: {
      plugins: [pinia, i18n],
      provide: {
        [MOSHPIT_VIEWPORT_INJECTION_KEY as unknown as string]: viewportRef
      }
    }
  })
  return { ...result, viewportRef, viewport }
}

describe('MoshpitClusterOverlay', () => {
  it('renders the overlay container with no boxes when clusterTree is null', () => {
    clusterTreeStub.value = null
    renderWithViewport()
    expect(screen.getByTestId('moshpit-cluster-overlay')).toBeTruthy()
    expect(screen.queryAllByTestId('moshpit-cluster-box')).toHaveLength(0)
    expect(screen.queryAllByTestId('moshpit-cluster-label')).toHaveLength(0)
  })

  it('renders one box + label per depth-0 and depth-1 cluster (3 outer × 2 inner = 9 total)', () => {
    const outers = Array.from({ length: 3 }, (_, i) =>
      node(
        `outer-${i}`,
        0,
        Array.from({ length: 2 }, (_, j) => leaf(`inner-${i}-${j}`, 1))
      )
    )
    clusterTreeStub.value = node('root', -1, outers)

    renderWithViewport()

    expect(screen.getAllByTestId('moshpit-cluster-box')).toHaveLength(9)
    expect(screen.getAllByTestId('moshpit-cluster-label')).toHaveLength(9)
  })

  it('does not render depth >= 2 clusters', () => {
    // root(-1) -> outer(0) -> inner(1) -> deep(2) with a unique bucketValue
    const deep = leaf('SHOULD_NOT_APPEAR', 2)
    const inner = node('inner-0', 1, [deep])
    const outer = node('outer-0', 0, [inner])
    clusterTreeStub.value = node('root', -1, [outer])

    renderWithViewport()

    const boxes = screen.getAllByTestId('moshpit-cluster-box')
    expect(boxes).toHaveLength(2) // depth 0 + depth 1 only

    const labels = screen
      .getAllByTestId('moshpit-cluster-label')
      .map((el) => el.textContent?.trim())
    expect(labels).not.toContain('SHOULD_NOT_APPEAR')
  })

  it('renders the literal "(other)" for a cluster whose bucketValue is OTHER_BUCKET_KEY', () => {
    const outer = node(OTHER_BUCKET_KEY, 0, [])
    clusterTreeStub.value = node('root', -1, [outer])

    renderWithViewport()

    const label = screen
      .getByTestId('moshpit-cluster-label')
      .textContent?.trim()
    expect(label).toBe('(other)')
    expect(label).toBe(enMessages.moshpit.grouping.otherLabel)
  })

  it('applies display:none to every box when viewport is null', () => {
    clusterTreeStub.value = node('root', -1, [
      node('outer-0', 0, [leaf('inner-0', 1)])
    ])

    renderWithViewport(null)

    const boxes = screen.getAllByTestId('moshpit-cluster-box')
    expect(boxes).toHaveLength(2)
    for (const box of boxes) {
      expect((box as HTMLElement).style.display).toBe('none')
    }
  })

  it('depth-0 and depth-1 labels use different positions to avoid overlap', () => {
    const inner = leaf('inner', 1)
    const outer = node('outer', 0, [inner])
    clusterTreeStub.value = node('root', -1, [outer])

    renderWithViewport()

    // The outer (depth-0) label hangs ABOVE its box at `-top-4`; the inner
    // (depth-1) label sits INSIDE its box at `top-1`. This keeps the two
    // levels from stacking at the same screen coord when an inner cluster
    // is flush to its parent's top-left corner (the overlap regression
    // reported in Phase 4 UAT).
    const labels = screen.getAllByTestId(
      'moshpit-cluster-label'
    ) as HTMLElement[]
    expect(labels).toHaveLength(2)

    const [outerLabel, innerLabel] = labels
    expect(outerLabel.classList.contains('-top-4')).toBe(true)
    expect(innerLabel.classList.contains('top-1')).toBe(true)
    expect(innerLabel.classList.contains('-top-4')).toBe(false)
  })

  it('label element carries truncate + max-w-56 classes for overflow handling', () => {
    const longLabel = 'x'.repeat(60)
    clusterTreeStub.value = node('root', -1, [node(longLabel, 0, [])])

    renderWithViewport()

    const label = screen.getByTestId('moshpit-cluster-label')
    expect(label.classList.contains('truncate')).toBe(true)
    expect(label.classList.contains('max-w-56')).toBe(true)
    expect(label.textContent?.trim()).toBe(longLabel)
  })

  it('positions boxes using viewport.toScreen and updates on moved events', async () => {
    const outer = node('outer-0', 0, [], bounds(10, 20, 30, 40))
    clusterTreeStub.value = node('root', -1, [outer])

    const viewport = makeFakeViewport()
    renderWithViewport(viewport)

    const box = screen.getByTestId('moshpit-cluster-box') as HTMLElement
    // Initial: toScreen multiplies by 2 → tl=(20,40), br=((10+30)*2, (20+40)*2)=(80,120)
    expect(box.style.left).toBe('20px')
    expect(box.style.top).toBe('40px')
    expect(box.style.width).toBe('60px')
    expect(box.style.height).toBe('80px')

    // Simulate a pan/zoom — change scale and fire 'moved'
    viewport.__scale = 3
    viewport.__fireMoved()
    await Promise.resolve()
    await Promise.resolve()

    expect(box.style.left).toBe('30px')
    expect(box.style.top).toBe('60px')
    expect(box.style.width).toBe('90px')
    expect(box.style.height).toBe('120px')
  })

  it('subscribes to the viewport "moved" event exactly once', () => {
    clusterTreeStub.value = node('root', -1, [node('outer-0', 0, [])])
    const viewport = makeFakeViewport()
    renderWithViewport(viewport)

    const movedRegistrations = viewport.on.mock.calls.filter(
      (c) => c[0] === 'moved'
    )
    expect(movedRegistrations).toHaveLength(1)
  })
})
