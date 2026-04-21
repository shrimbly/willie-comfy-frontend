import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { createPinia, setActivePinia } from 'pinia'
import { shallowRef } from 'vue'

import { MOSHPIT_VIEWPORT_INJECTION_KEY } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import type { ClusterNode } from '@/platform/moshpit/services/clusterLayout'
import { OTHER_BUCKET_KEY } from '@/platform/moshpit/services/groupAxes'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import MoshpitClusterOverlay from './MoshpitClusterOverlay.vue'

// Structural viewport shim — the overlay uses only `toScreen`, `on`, `off`.
// Full pixi-viewport requires a PIXI Application which Storybook can't boot.
function makeStubViewport() {
  return {
    on: () => undefined,
    off: () => undefined,
    toScreen: (x: number, y: number) => ({ x, y })
  }
}

function bounds(x: number, y: number, w: number, h: number) {
  return { x, y, w, h }
}

function leaf(bucketValue: string, x: number, y: number): ClusterNode {
  return {
    axis: 'workflow',
    bucketValue,
    depth: 1,
    boundsWorld: bounds(x, y, 80, 60),
    children: [],
    leafHashes: []
  }
}

function outerCluster(
  bucketValue: string,
  b: { x: number; y: number; w: number; h: number },
  children: readonly ClusterNode[]
): ClusterNode {
  return {
    axis: 'workflow',
    bucketValue,
    depth: 0,
    boundsWorld: b,
    children,
    leafHashes: []
  }
}

function root(children: readonly ClusterNode[]): ClusterNode {
  return {
    axis: null,
    bucketValue: 'root',
    depth: -1,
    boundsWorld: bounds(0, 0, 0, 0),
    children,
    leafHashes: []
  }
}

function mountOverlay(tree: ClusterNode | null) {
  // Seed a fresh pinia so the useMoshpitFilteredAssets composable resolves its
  // dependent stores cleanly. We don't drive the composable from Storybook —
  // instead the story renders the overlay while also rendering absolutely
  // positioned preview boxes built from the static `tree` for visual clarity.
  const pinia = createPinia()
  setActivePinia(pinia)
  // Reset filter store so the canvas has nothing to layout.
  useMoshpitFilterStore().reset()

  const previewBoxes: {
    top: number
    left: number
    width: number
    height: number
    label: string
    depth: number
  }[] = []
  if (tree) {
    for (const d0 of tree.children) {
      previewBoxes.push({
        top: d0.boundsWorld.y,
        left: d0.boundsWorld.x,
        width: d0.boundsWorld.w,
        height: d0.boundsWorld.h,
        label: d0.bucketValue,
        depth: 0
      })
      for (const d1 of d0.children) {
        previewBoxes.push({
          top: d1.boundsWorld.y,
          left: d1.boundsWorld.x,
          width: d1.boundsWorld.w,
          height: d1.boundsWorld.h,
          label: d1.bucketValue,
          depth: 1
        })
      }
    }
  }

  return {
    components: { MoshpitClusterOverlay },
    setup() {
      const viewportRef = shallowRef(makeStubViewport())
      return { viewportRef, previewBoxes }
    },
    provide() {
      const self = this as unknown as { viewportRef: unknown }
      return {
        [MOSHPIT_VIEWPORT_INJECTION_KEY as unknown as symbol]: self.viewportRef
      }
    },
    template: `
      <div style="position: relative; width: 640px; height: 400px; background: #0d0d0d; border: 1px solid #333; color: #888; font-family: sans-serif;">
        <div v-for="(b, i) in previewBoxes" :key="i"
             :style="{
               position: 'absolute',
               top: b.top + 'px',
               left: b.left + 'px',
               width: b.width + 'px',
               height: b.height + 'px',
               border: '1px solid ' + (b.depth === 0 ? '#444' : '#333'),
               borderRadius: '6px'
             }">
          <span style="position: absolute; top: -16px; left: 0; font-size: 11px;">{{ b.label }}</span>
        </div>
        <MoshpitClusterOverlay />
      </div>
    `
  }
}

interface StoryArgs {
  readonly clusterTree: ClusterNode | null
}

const meta: Meta<StoryArgs> = {
  title: 'platform/moshpit/MoshpitClusterOverlay',
  render: (args) => mountOverlay(args.clusterTree)
}

export default meta
type Story = StoryObj<StoryArgs>

export const Empty: Story = {
  args: {
    clusterTree: null
  }
}

export const TwoAxes: Story = {
  args: {
    clusterTree: root([
      outerCluster('Workflow A', { x: 40, y: 40, w: 260, h: 140 }, [
        leaf('SDXL', 60, 80),
        leaf('SD1.5', 150, 80),
        leaf('Flux', 240, 80)
      ]),
      outerCluster('Workflow B', { x: 340, y: 40, w: 260, h: 140 }, [
        leaf('SDXL', 360, 80),
        leaf('SD1.5', 450, 80),
        leaf('Flux', 540, 80)
      ])
    ])
  }
}

export const WithOtherBucket: Story = {
  args: {
    clusterTree: root([
      outerCluster('Workflow A', { x: 40, y: 60, w: 260, h: 160 }, [
        leaf('SDXL', 60, 100),
        leaf('Flux', 200, 100)
      ]),
      outerCluster(OTHER_BUCKET_KEY, { x: 340, y: 60, w: 260, h: 160 }, [
        leaf('SD1.5', 400, 100)
      ])
    ])
  }
}
