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
      :aria-label="t('moshpit.actionBar.favourite')"
      data-testid="moshpit-action-bar-favourite"
      @click="onFavouriteClick"
    >
      {{ t('moshpit.actionBar.favourite') }}
    </button>
    <button
      type="button"
      :class="buttonClasses"
      :aria-label="t('moshpit.actionBar.tag')"
      data-testid="moshpit-action-bar-tag"
      @click="onTagClick"
    >
      {{ t('moshpit.actionBar.tag') }}
    </button>
    <button
      type="button"
      :class="buttonClasses"
      :aria-label="t('moshpit.actionBar.hide')"
      data-testid="moshpit-action-bar-hide"
      @click="onHideClick"
    >
      {{ t('moshpit.actionBar.hide') }}
    </button>
    <button
      type="button"
      :class="buttonClasses"
      :aria-label="t('moshpit.actionBar.folder')"
      data-testid="moshpit-action-bar-folder"
      @click="onFolderClick"
    >
      {{ t('moshpit.actionBar.folder') }}
    </button>
    <button
      type="button"
      :class="buttonClasses"
      :aria-label="t('moshpit.actionBar.export')"
      data-testid="moshpit-action-bar-export"
      @click="onExportClick"
    >
      {{ t('moshpit.actionBar.export') }}
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

const buttonClasses = cn(
  'hover:bg-interface-panel-hover rounded-md px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) disabled:cursor-not-allowed disabled:opacity-50'
)

function onUnpinClick(): void {
  actions.unpinMany(selectionStore.selected)
}

function onDownloadClick(): void {
  actions.downloadMany(selectionStore.selected)
}

function onFavouriteClick(): void {
  curation.favouriteMany(selectionStore.selected)
}

function onTagClick(): void {
  emit('open-tag-popover', { hashes: selectionStore.selected })
}

function onHideClick(): void {
  curation.hideMany(selectionStore.selected)
}

function onFolderClick(): void {
  emit('open-folder-picker', { hashes: selectionStore.selected })
}

function onExportClick(): void {
  curation.exportMany(selectionStore.selected)
}

function onClearClick(): void {
  selectionStore.clear()
}
</script>
