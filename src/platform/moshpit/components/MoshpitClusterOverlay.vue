<template>
  <div
    class="pointer-events-none absolute inset-0 overflow-hidden"
    data-testid="moshpit-cluster-overlay"
  >
    <div
      v-for="cluster in renderedClusters"
      :key="cluster.key"
      class="pointer-events-none absolute rounded-md border border-(--interface-stroke)"
      :style="cluster.boxStyle"
      data-testid="moshpit-cluster-box"
      :data-depth="cluster.depth"
    >
      <button
        type="button"
        :class="cluster.labelClass"
        :title="
          t('moshpit.grouping.focusBadgeTooltip', { label: cluster.label })
        "
        data-testid="moshpit-cluster-label"
        @click="onLabelClick(cluster)"
      >
        {{ cluster.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { StyleValue } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMoshpitFilteredAssets } from '@/platform/moshpit/composables/useMoshpitFilteredAssets'
import { useMoshpitViewport } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import type { ClusterNode } from '@/platform/moshpit/services/clusterLayout'
import { OTHER_BUCKET_KEY } from '@/platform/moshpit/services/groupAxes'
import { useMoshpitViewportStore } from '@/platform/moshpit/stores/moshpitViewportStore'

defineOptions({ name: 'MoshpitClusterOverlay' })

const { t } = useI18n()
const viewportRef = useMoshpitViewport()
const viewportStore = useMoshpitViewportStore()
const { clusterTree } = useMoshpitFilteredAssets()

// When the user clicks a label, pad the zoom target so the cluster has
// breathing room against the viewport edges instead of bleeding to the frame.
const FOCUS_PADDING_RATIO = 0.15

// Re-render trigger: Viewport is a third-party class with internal state that
// cannot be made reactive. Bump a scalar on every 'moved' event and read it
// inside boxStyle so Vue re-evaluates the style getters.
const transformTick = ref(0)

watch(
  viewportRef,
  (viewport, _prev, onCleanup) => {
    if (!viewport) return
    const handler = () => {
      transformTick.value++
    }
    viewport.on('moved', handler)
    onCleanup(() => {
      viewport.off?.('moved', handler)
    })
  },
  { immediate: true }
)

interface RenderedCluster {
  readonly key: string
  readonly label: string
  readonly boxStyle: StyleValue
  readonly depth: 0 | 1
  readonly labelClass: string
  readonly boundsWorld: ClusterNode['boundsWorld']
}

// Depth-0 badges sit above the outer box (caption for the whole group).
// Depth-1 badges sit inside their own box in the top-left — keeps the two
// levels from overlapping when an inner cluster is flush to its parent's
// top-left corner (D-06 two-level overlay).
// `pointer-events-auto` overrides the container's `pointer-events-none` so
// badges stay clickable while the rest of the overlay passes events through.
const BADGE_BASE =
  'pointer-events-auto absolute max-w-56 cursor-pointer truncate rounded-full border border-border-subtle px-2 py-0.5 text-xs font-medium text-base-foreground shadow-sm transition-colors hover:bg-secondary-background-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)'
const OUTER_LABEL_CLASS = `${BADGE_BASE} -top-3 left-0 bg-interface-panel-surface`
const INNER_LABEL_CLASS = `${BADGE_BASE} top-1 left-1 bg-interface-panel-surface/85 backdrop-blur-sm`

function labelFor(cluster: ClusterNode): string {
  return cluster.bucketValue === OTHER_BUCKET_KEY
    ? t('moshpit.grouping.otherLabel')
    : cluster.bucketValue
}

function boxStyle(cluster: ClusterNode): StyleValue {
  // Register reactive dep on transformTick so style recomputes on pan/zoom.
  void transformTick.value
  const vp = viewportRef.value
  if (!vp) return { display: 'none' }
  const tl = vp.toScreen(cluster.boundsWorld.x, cluster.boundsWorld.y)
  const br = vp.toScreen(
    cluster.boundsWorld.x + cluster.boundsWorld.w,
    cluster.boundsWorld.y + cluster.boundsWorld.h
  )
  return {
    left: `${tl.x}px`,
    top: `${tl.y}px`,
    width: `${br.x - tl.x}px`,
    height: `${br.y - tl.y}px`
  }
}

const renderedClusters = computed<readonly RenderedCluster[]>(() => {
  const tree = clusterTree.value
  if (!tree) return []
  const out: RenderedCluster[] = []
  // Tree root is depth -1; render only its children (depth 0) and their
  // children (depth 1) — the two outermost nesting levels per D-06.
  for (let i = 0; i < tree.children.length; i++) {
    const outer = tree.children[i]
    out.push({
      key: `d0-${i}-${outer.bucketValue}`,
      label: labelFor(outer),
      boxStyle: boxStyle(outer),
      depth: 0,
      labelClass: OUTER_LABEL_CLASS,
      boundsWorld: outer.boundsWorld
    })
    for (let j = 0; j < outer.children.length; j++) {
      const inner = outer.children[j]
      out.push({
        key: `d1-${i}-${j}-${inner.bucketValue}`,
        label: labelFor(inner),
        boxStyle: boxStyle(inner),
        depth: 1,
        labelClass: INNER_LABEL_CLASS,
        boundsWorld: inner.boundsWorld
      })
    }
  }
  return out
})

function onLabelClick(cluster: RenderedCluster): void {
  const { x, y, w, h } = cluster.boundsWorld
  if (w <= 0 || h <= 0) return
  const padX = w * FOCUS_PADDING_RATIO
  const padY = h * FOCUS_PADDING_RATIO
  viewportStore.requestZoomToSelection({
    x: x - padX,
    y: y - padY,
    width: w + padX * 2,
    height: h + padY * 2
  })
}
</script>
