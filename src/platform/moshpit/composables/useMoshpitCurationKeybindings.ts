import type { Ref } from 'vue'
import { onMounted, onUnmounted } from 'vue'

import { t } from '@/i18n'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'
import { useToastStore } from '@/platform/updates/common/toastStore'

import { useMoshpitCuration } from './useMoshpitCuration'

export interface MoshpitCurationKeybindingsOptions {
  readonly containerEl: Ref<HTMLElement | null>
  readonly openTagPopover: () => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function useMoshpitCurationKeybindings(
  options: MoshpitCurationKeybindingsOptions
): void {
  const { containerEl, openTagPopover } = options
  const selectionStore = useMoshpitSelectionStore()
  const tournamentStore = useMoshpitTournamentStore()
  const toastStore = useToastStore()
  const curation = useMoshpitCuration()

  function onKeydown(e: KeyboardEvent): void {
    if (tournamentStore.isActive) return
    if (isEditableTarget(e.target)) return

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      const ok = curation.undoLast()
      e.preventDefault()
      if (!ok) {
        toastStore.add({
          severity: 'info',
          summary: t('moshpit.curation.nothingToUndo'),
          life: 2000
        })
      }
      return
    }

    if (selectionStore.size === 0) return

    switch (e.key.toLowerCase()) {
      case 's':
        curation.favouriteMany(selectionStore.selected)
        e.preventDefault()
        break
      case 't':
        openTagPopover()
        e.preventDefault()
        break
      case 'h':
        curation.hideMany(selectionStore.selected)
        e.preventDefault()
        break
      case 'e':
        curation.exportMany(selectionStore.selected)
        e.preventDefault()
        break
    }
  }

  // Capture the element at mount time; Vue clears template refs before
  // onUnmounted fires, so we need the reference stored separately.
  let attachedEl: HTMLElement | null = null

  onMounted(() => {
    attachedEl = containerEl.value
    attachedEl?.addEventListener('keydown', onKeydown)
  })

  onUnmounted(() => {
    attachedEl?.removeEventListener('keydown', onKeydown)
    attachedEl = null
  })
}
