import { t } from '@/i18n'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'
import { useMoshpitViewportStore } from '@/platform/moshpit/stores/moshpitViewportStore'
import type { ComfyCommand } from '@/stores/commandStore'

export function useMoshpitCommands(): ComfyCommand[] {
  return [
    {
      id: 'Moshpit.Canvas.FitView',
      label: () => t('moshpit.commands.fitView'),
      icon: 'pi pi-arrows-alt',
      versionAdded: '1.31.0',
      category: 'view-controls',
      source: 'System',
      function: () => {
        useMoshpitViewportStore().requestFitView()
      }
    },
    {
      id: 'Moshpit.Canvas.ZoomToSelection',
      label: () => t('moshpit.commands.zoomToSelection'),
      icon: 'pi pi-search-plus',
      versionAdded: '1.31.0',
      category: 'view-controls',
      source: 'System',
      function: () => {
        // Phase 1 has no assets — no-op when selection is empty.
        // Phase 2: compute bbox from selection.selected, then call requestZoomToSelection.
        const selection = useMoshpitSelectionStore()
        if (selection.selected.length === 0) return
        // Phase 2: const bbox = computeBboxFromSelection(selection.selected)
        // useMoshpitViewportStore().requestZoomToSelection(bbox)
      }
    },
    {
      id: 'Moshpit.Canvas.SelectAll',
      label: () => t('moshpit.commands.selectAll'),
      versionAdded: '1.31.0',
      category: 'view-controls',
      source: 'System',
      function: () => {
        // Phase 1 has no assets — selectAll([]) is a no-op on the selection set.
        // Phase 2 will pass the currently visible asset ID set.
        useMoshpitSelectionStore().selectAll([])
      }
    },
    {
      id: 'Moshpit.Canvas.ClearSelection',
      label: () => t('moshpit.commands.clearSelection'),
      versionAdded: '1.31.0',
      category: 'view-controls',
      source: 'System',
      function: () => {
        useMoshpitSelectionStore().clear()
      }
    }
  ]
}
