<template>
  <div
    v-if="axisMode !== 'chaos' && viewport"
    class="pointer-events-none absolute inset-0 z-50"
    data-testid="moshpit-axis-overlay"
  >
    <!-- X-axis column labels at top of canvas area -->
    <span
      v-for="col in columns"
      :key="`x-${col.columnIndex}`"
      class="absolute rounded-full border border-interface-stroke bg-interface-panel-surface px-3 py-1 text-xs font-medium text-base-foreground shadow-sm"
      :style="xLabelStyle(col)"
      data-testid="moshpit-axis-label-x"
    >
      {{ formatLabel(col.paramValue, sortX) }}
    </span>
    <!-- Y-axis row labels at left of canvas area (2D only) -->
    <span
      v-for="row in rows"
      :key="`y-${row.rowIndex}`"
      class="absolute rounded-full border border-interface-stroke bg-interface-panel-surface px-3 py-1 text-xs font-medium text-base-foreground shadow-sm"
      :style="yLabelStyle(row)"
      data-testid="moshpit-axis-label-y"
    >
      {{ truncate(formatLabel(row.paramValue, sortY), 16) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { ColumnDescriptor, RowDescriptor } from '@/platform/moshpit/services/sortMath'
import type { ParamKey } from '@/platform/moshpit/services/filterTypes'
import { useMoshpitFilteredAssets } from '@/platform/moshpit/composables/useMoshpitFilteredAssets'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import { useMoshpitViewport } from '@/platform/moshpit/composables/useMoshpitViewportInjection'

defineOptions({ name: 'MoshpitAxisOverlay' })

const filterStore = useMoshpitFilterStore()
const viewportRef = useMoshpitViewport()
const { columns, rows, axisMode } = useMoshpitFilteredAssets()

const sortX = computed(() => filterStore.sortX)
const sortY = computed(() => filterStore.sortY)
const viewport = computed(() => viewportRef.value)

// transformTick is incremented on every 'moved' event so style bindings
// re-evaluate viewport.toScreen on each pan/zoom. Avoids making the Viewport
// class reactive (it's a third-party class with internal state) while still
// triggering template re-render.
const transformTick = ref(0)

watch(
  () => viewportRef.value,
  (vp, _prevVp, onCleanup) => {
    if (!vp) return
    const handler = () => {
      transformTick.value++
    }
    vp.on('moved', handler)
    onCleanup(() => {
      vp.off('moved', handler)
    })
  },
  { immediate: true }
)

function xLabelStyle(col: ColumnDescriptor): Record<string, string> {
  void transformTick.value // read reactive dep so style re-evaluates on pan/zoom
  const vp = viewport.value
  if (!vp) return { display: 'none' }
  const gridSpacing = filterStore.gridSpacing
  const screen = vp.toScreen(col.worldX + gridSpacing / 2, 0)
  return {
    left: `${screen.x}px`,
    top: '8px',
    transform: 'translateX(-50%)'
  }
}

function yLabelStyle(row: RowDescriptor): Record<string, string> {
  void transformTick.value // read reactive dep so style re-evaluates on pan/zoom
  const vp = viewport.value
  if (!vp) return { display: 'none' }
  const gridSpacing = filterStore.gridSpacing
  const screen = vp.toScreen(0, row.worldY + gridSpacing / 2)
  return {
    left: '8px',
    top: `${screen.y}px`,
    transform: 'translateY(-50%)'
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}\u2026`
}

function formatLabel(raw: string, param: ParamKey | null): string {
  if (param === null) return raw
  if (param === 'timestamp') {
    const n = Number(raw)
    if (Number.isFinite(n)) {
      const d = new Date(n)
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }
    return raw
  }
  if (param === 'loras') {
    const count = Number(raw)
    if (Number.isFinite(count)) return count === 1 ? `${count} LoRA` : `${count} LoRAs`
    return raw
  }
  return raw
}
</script>
