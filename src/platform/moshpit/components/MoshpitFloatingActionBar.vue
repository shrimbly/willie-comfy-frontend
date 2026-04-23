<template>
  <div
    v-if="isVisible"
    role="toolbar"
    :aria-label="t('moshpit.actionBar.selectedCount', selectionStore.size)"
    class="pointer-events-auto absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 flex-row items-center gap-1 border border-interface-stroke bg-comfy-menu-bg p-2 shadow-interface"
  >
    <span
      class="px-2 text-xs font-medium text-muted-foreground tabular-nums select-none"
      data-testid="moshpit-action-bar-count"
    >
      {{ t('moshpit.actionBar.selectedCount', selectionStore.size) }}
    </span>

    <div class="h-[27px] w-px self-center bg-node-divider" aria-hidden="true" />

    <Button
      v-for="btn in actionButtons"
      :key="btn.id"
      v-tooltip.top="btn.tooltip"
      variant="secondary"
      class="size-8 bg-comfy-menu-bg p-0 hover:bg-interface-button-hover-surface!"
      :disabled="btn.disabled"
      :aria-label="btn.tooltip"
      :data-testid="btn.testId"
      @click="btn.onClick"
    >
      <i :class="cn(btn.icon, 'size-4')" aria-hidden="true" />
    </Button>

    <div class="h-[27px] w-px self-center bg-node-divider" aria-hidden="true" />

    <Button
      v-tooltip.top="t('moshpit.actionBar.clear')"
      variant="secondary"
      class="size-8 bg-comfy-menu-bg p-0 hover:bg-interface-button-hover-surface!"
      :aria-label="t('moshpit.actionBar.clear')"
      data-testid="moshpit-action-bar-clear"
      @click="onClearClick"
    >
      <i class="icon-[lucide--x] size-4" aria-hidden="true" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useMoshpitCuration } from '@/platform/moshpit/composables/useMoshpitCuration'
import { useMoshpitSpriteActions } from '@/platform/moshpit/composables/useMoshpitSpriteActions'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'
import { cn } from '@/utils/tailwindUtil'

defineOptions({ name: 'MoshpitFloatingActionBar' })

const { resolveFullResUrl } = defineProps<{
  resolveFullResUrl?: (hash: string) => string | null
}>()

const emit = defineEmits<{
  'open-tag-popover': [payload: { hashes: readonly string[] }]
  'open-folder-picker': [payload: { hashes: readonly string[] }]
}>()

const { t } = useI18n()

const selectionStore = useMoshpitSelectionStore()
const tournamentStore = useMoshpitTournamentStore()
const actions = useMoshpitSpriteActions({ getHitTester: () => null })
const curation = useMoshpitCuration({ resolveFullResUrl })

const isVisible = computed(
  () => selectionStore.size > 0 && !tournamentStore.isActive
)

const canUnpin = computed(() =>
  actions.someSelectedArePinned(selectionStore.selected)
)

type ActionButton = {
  id: string
  testId: string
  tooltip: string
  icon: string
  disabled?: boolean
  onClick: () => void
}

const actionButtons = computed<ActionButton[]>(() => [
  {
    id: 'unpin',
    testId: 'moshpit-action-bar-unpin',
    tooltip: t('moshpit.actionBar.unpin'),
    icon: 'icon-[lucide--pin-off]',
    disabled: !canUnpin.value,
    onClick: () => actions.unpinMany(selectionStore.selected)
  },
  {
    id: 'download',
    testId: 'moshpit-action-bar-download',
    tooltip: t('moshpit.actionBar.download'),
    icon: 'icon-[lucide--download]',
    onClick: () => actions.downloadMany(selectionStore.selected)
  },
  {
    id: 'tournament',
    testId: 'moshpit-action-bar-tournament',
    tooltip: t('moshpit.actionBar.tournament'),
    icon: 'icon-[lucide--swords]',
    disabled: selectionStore.size < 2 || !resolveFullResUrl,
    onClick: onTournamentClick
  },
  {
    id: 'favourite',
    testId: 'moshpit-action-bar-favourite',
    tooltip: t('moshpit.actionBar.favourite'),
    icon: 'icon-[lucide--heart]',
    onClick: () => curation.favouriteMany(selectionStore.selected)
  },
  {
    id: 'tag',
    testId: 'moshpit-action-bar-tag',
    tooltip: t('moshpit.actionBar.tag'),
    icon: 'icon-[lucide--tag]',
    onClick: () => emit('open-tag-popover', { hashes: selectionStore.selected })
  },
  {
    id: 'hide',
    testId: 'moshpit-action-bar-hide',
    tooltip: t('moshpit.actionBar.hide'),
    icon: 'icon-[lucide--eye-off]',
    onClick: () => curation.hideMany(selectionStore.selected)
  },
  {
    id: 'folder',
    testId: 'moshpit-action-bar-folder',
    tooltip: t('moshpit.actionBar.folder'),
    icon: 'icon-[lucide--folder-plus]',
    onClick: () =>
      emit('open-folder-picker', { hashes: selectionStore.selected })
  },
  {
    id: 'export',
    testId: 'moshpit-action-bar-export',
    tooltip: t('moshpit.actionBar.export'),
    icon: 'icon-[lucide--file-output]',
    onClick: () => curation.exportMany(selectionStore.selected)
  }
])

function onClearClick(): void {
  selectionStore.clear()
}

function onTournamentClick(): void {
  if (!resolveFullResUrl) return
  if (selectionStore.size < 2) return
  tournamentStore.enter(selectionStore.selected, resolveFullResUrl)
}
</script>
