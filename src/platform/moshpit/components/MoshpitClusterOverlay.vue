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
    >
      <span
        class="absolute -top-4 left-0 max-w-56 truncate text-xs text-muted-foreground"
        data-testid="moshpit-cluster-label"
      >
        {{ cluster.label }}
      </span>
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

defineOptions({ name: 'MoshpitClusterOverlay' })

const { t } = useI18n()
const viewportRef = useMoshpitViewport()
const { clusterTree } = useMoshpitFilteredAssets()

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
}

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
      boxStyle: boxStyle(outer)
    })
    for (let j = 0; j < outer.children.length; j++) {
      const inner = outer.children[j]
      out.push({
        key: `d1-${i}-${j}-${inner.bucketValue}`,
        label: labelFor(inner),
        boxStyle: boxStyle(inner)
      })
    }
  }
  return out
})
</script>
