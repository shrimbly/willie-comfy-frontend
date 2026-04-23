<template>
  <div data-testid="moshpit-undo-toast-root">
    <Toast group="moshpit-curation" position="bottom-center">
      <template #message="slotProps">
        <div class="flex items-center gap-3 px-2 py-1">
          <span class="text-sm text-base-foreground">
            {{ (slotProps as ToastSlotProps).message.summary }}
          </span>
          <button
            type="button"
            :class="btnClasses"
            :aria-label="t('moshpit.curation.undo')"
            data-testid="moshpit-undo-toast-button"
            @click="onUndo((slotProps as ToastSlotProps).closeCallback)"
          >
            {{ t('moshpit.curation.undo') }}
          </button>
        </div>
      </template>
    </Toast>
  </div>
</template>

<script setup lang="ts">
import type { ToastMessageOptions } from 'primevue/toast'
import Toast from 'primevue/toast'
import { useI18n } from 'vue-i18n'

import { useMoshpitCuration } from '@/platform/moshpit/composables/useMoshpitCuration'
import { cn } from '@/utils/tailwindUtil'

defineOptions({ name: 'MoshpitUndoToast' })

interface ToastSlotProps {
  message: ToastMessageOptions
  closeCallback: () => void
}

const { t } = useI18n()
const curation = useMoshpitCuration()

const btnClasses = cn(
  'rounded-md px-2 py-1 text-sm outline-none',
  'hover:bg-interface-panel-hover bg-interface-panel-surface',
  'focus-visible:ring-2 focus-visible:ring-(--focus-ring)'
)

function onUndo(close: () => void): void {
  curation.undoLast()
  close()
}
</script>
