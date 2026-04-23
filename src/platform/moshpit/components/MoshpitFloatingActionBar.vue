<template>
  <div
    v-if="isVisible"
    role="toolbar"
    :aria-label="t('moshpit.actionBar.selectedCount', selectionStore.size)"
    class="pointer-events-auto absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border-subtle bg-interface-panel-surface px-3 py-2 shadow-interface"
  >
    <span
      class="text-base-mute-foreground px-2 text-sm"
      data-testid="moshpit-action-bar-count"
    >
      {{ t('moshpit.actionBar.selectedCount', selectionStore.size) }}
    </span>
    <span class="h-4 w-px bg-border-subtle" aria-hidden="true" />
    <button
      type="button"
      :class="buttonClasses"
      :disabled="!canUnpin"
      :aria-label="t('moshpit.actionBar.unpin')"
      data-testid="moshpit-action-bar-unpin"
      @click="onUnpinClick"
    >
      {{ t('moshpit.actionBar.unpin') }}
    </button>
    <button
      type="button"
      :class="buttonClasses"
      :aria-label="t('moshpit.actionBar.download')"
      data-testid="moshpit-action-bar-download"
      @click="onDownloadClick"
    >
      {{ t('moshpit.actionBar.download') }}
    </button>
    <span class="h-4 w-px bg-border-subtle" aria-hidden="true" />
    <button
      type="button"
      :class="buttonClasses"
      :aria-label="t('moshpit.actionBar.clear')"
      data-testid="moshpit-action-bar-clear"
      @click="onClearClick"
    >
      {{ t('moshpit.actionBar.clear') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMoshpitSpriteActions } from '@/platform/moshpit/composables/useMoshpitSpriteActions'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'
import { cn } from '@/utils/tailwindUtil'

defineOptions({ name: 'MoshpitFloatingActionBar' })

const { t } = useI18n()

const selectionStore = useMoshpitSelectionStore()
const tournamentStore = useMoshpitTournamentStore()
const actions = useMoshpitSpriteActions({ getHitTester: () => null })

const isVisible = computed(
  () => selectionStore.size > 0 && !tournamentStore.isActive
)

const canUnpin = computed(() =>
  actions.someSelectedArePinned(selectionStore.selected)
)

const buttonClasses = cn(
  'hover:bg-interface-panel-hover rounded-md px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) disabled:cursor-not-allowed disabled:opacity-50'
)

function onUnpinClick(): void {
  actions.unpinMany(selectionStore.selected)
}

function onDownloadClick(): void {
  actions.downloadMany(selectionStore.selected)
}

function onClearClick(): void {
  selectionStore.clear()
}
</script>
