import { render, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'

import MoshpitView from './MoshpitView.vue'

// Stub child components so we test composition, not internals. Each stub
// preserves the real component's key data-testid so the assertion stays
// black-box.
const stubs = {
  MoshpitCanvas: {
    template: '<div data-testid="stub-moshpit-canvas" />'
  },
  MoshpitClusterOverlay: {
    template: '<div data-testid="moshpit-cluster-overlay" />'
  },
  MoshpitEmptyGateOverlay: {
    template: '<div data-testid="stub-moshpit-empty-gate" />'
  },
  MoshpitMarqueeOverlay: {
    template: '<div data-testid="stub-moshpit-marquee" />'
  }
}

function mountView() {
  return render(MoshpitView, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn })],
      stubs
    }
  })
}

describe('MoshpitView cluster overlay mount', () => {
  it('mounts MoshpitClusterOverlay parallel to MoshpitCanvas', () => {
    mountView()
    expect(screen.getByTestId('moshpit-cluster-overlay')).toBeInTheDocument()
  })

  it('still mounts the other legacy overlays (empty-gate, marquee)', () => {
    mountView()
    expect(screen.getByTestId('stub-moshpit-empty-gate')).toBeInTheDocument()
    expect(screen.getByTestId('stub-moshpit-marquee')).toBeInTheDocument()
  })
})
