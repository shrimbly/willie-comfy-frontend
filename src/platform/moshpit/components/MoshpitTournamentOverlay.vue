<!--
  Phase 5 Plan 06 — MoshpitTournamentOverlay (D-10, D-13, D-19).

  Reka DialogRoot-backed full-screen overlay composing:
    - MoshpitTournamentPair   (Plan 05-04) — pair renderer for the three modes
    - MoshpitMetadataPeekPanel (Plan 05-05) — right-side metadata peek
    - pair counter header (D-04)
    - legend footer (D-19) — 7 keymap hints

  Reka's DialogRoot ships the focus trap upstream — do NOT add a manual
  focus-trap composable (Pitfall 1). `v-model:open` is a computed proxy:
  `get` mirrors store state,
  `set(false)` routes every close path (Esc / outside-click / programmatic)
  through `tournamentStore.exit('esc')`. `@escape-key-down` also fires, but
  `exit()` is idempotent (guarded by `if (!isActive.value) return`).

  Keybindings (ArrowLeft/Right, ArrowDown, Space, [, ], M, comma, period,
  slash) are attached to the DialogContent root via the composable from
  Plan 05-03. Escape is delegated to Reka (not routed through the composable).
-->
<script setup lang="ts">
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  VisuallyHidden
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMoshpitTournamentKeybindings } from '@/platform/moshpit/composables/useMoshpitTournamentKeybindings'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'

import MoshpitMetadataPeekPanel from './MoshpitMetadataPeekPanel.vue'
import MoshpitTournamentPair from './MoshpitTournamentPair.vue'

defineOptions({ name: 'MoshpitTournamentOverlay' })

const { resolveFullResUrl } = defineProps<{
  resolveFullResUrl: (hash: string) => string | null
}>()

const { t } = useI18n()
const tournamentStore = useMoshpitTournamentStore()
const metadataStore = useMoshpitMetadataStore()

// Keybindings attach to window in capture phase and self-gate on
// tournamentStore.isActive — no DOM ref plumbing needed.
useMoshpitTournamentKeybindings()

const paramsA = computed(() =>
  tournamentStore.currentPair
    ? (metadataStore.getParams(tournamentStore.currentPair.assetHashA) ?? null)
    : null
)
const paramsB = computed(() =>
  tournamentStore.currentPair
    ? (metadataStore.getParams(tournamentStore.currentPair.assetHashB) ?? null)
    : null
)

function onEscape(): void {
  tournamentStore.exit('esc')
}

// v-model:open proxy — getter mirrors store state; setter routes every close
// path (Esc, outside-click, programmatic) through exit('esc'). Calling
// exit() twice is safe: it is guarded by `if (!isActive.value) return`.
const openModel = computed({
  get: () => tournamentStore.isActive,
  set: (v: boolean) => {
    if (!v) tournamentStore.exit('esc')
  }
})
</script>

<template>
  <DialogRoot v-model:open="openModel">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-40 bg-base-background/95 backdrop-blur-sm"
        data-testid="moshpit-tournament-overlay-backdrop"
      />
      <DialogContent
        class="fixed inset-0 z-50 flex flex-col outline-none"
        tabindex="-1"
        data-testid="moshpit-tournament-overlay-content"
        @escape-key-down="onEscape"
      >
        <VisuallyHidden>
          <DialogTitle>{{ t('moshpit.tournament.dialogTitle') }}</DialogTitle>
          <DialogDescription>
            {{ t('moshpit.tournament.dialogDescription') }}
          </DialogDescription>
        </VisuallyHidden>

        <header
          class="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground"
        >
          <span
            v-if="tournamentStore.currentPair"
            data-testid="moshpit-tournament-overlay-counter"
          >
            {{
              t('moshpit.tournament.pairCounter', {
                current: tournamentStore.progress.current,
                total: tournamentStore.progress.total
              })
            }}
          </span>
        </header>

        <main class="relative flex flex-1 overflow-hidden">
          <div class="relative flex-1">
            <MoshpitTournamentPair :resolve-full-res-url="resolveFullResUrl" />
          </div>
          <MoshpitMetadataPeekPanel :params-a="paramsA" :params-b="paramsB" />
        </main>

        <footer
          class="flex flex-wrap gap-4 border-t border-(--interface-stroke) px-4 py-2 text-xs text-muted-foreground"
          data-testid="moshpit-tournament-overlay-legend"
        >
          <span>{{ t('moshpit.tournament.legend.pickA') }}</span>
          <span>{{ t('moshpit.tournament.legend.pickB') }}</span>
          <span>{{ t('moshpit.tournament.legend.skip') }}</span>
          <span>{{ t('moshpit.tournament.legend.mode') }}</span>
          <span>{{ t('moshpit.tournament.legend.flip') }}</span>
          <span>{{ t('moshpit.tournament.legend.peek') }}</span>
          <span>{{ t('moshpit.tournament.legend.exit') }}</span>
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
