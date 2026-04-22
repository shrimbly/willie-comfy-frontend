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
import MoshpitTournamentWinner from './MoshpitTournamentWinner.vue'

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

function onConfirmWinner(): void {
  tournamentStore.exit('complete')
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
        class="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
        data-testid="moshpit-tournament-overlay-backdrop"
      />
      <DialogContent
        class="fixed inset-6 z-50 flex flex-col overflow-hidden rounded-lg border border-(--interface-stroke) bg-base-background shadow-2xl outline-none lg:inset-10"
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
          class="flex items-center justify-between gap-4 border-b border-(--interface-stroke) px-4 py-3"
        >
          <span
            class="text-2xs font-medium tracking-wide text-muted-foreground uppercase"
            data-testid="moshpit-tournament-overlay-title"
          >
            {{ t('moshpit.tournament.dialogTitle') }}
          </span>
          <span
            v-if="tournamentStore.currentPair"
            class="text-xs text-muted-foreground tabular-nums"
            data-testid="moshpit-tournament-overlay-counter"
          >
            {{
              t('moshpit.tournament.pairCounter', {
                current: tournamentStore.progress.current,
                total: tournamentStore.progress.total
              })
            }}
          </span>
          <span
            v-else-if="tournamentStore.isFinished"
            class="text-xs text-base-foreground"
            data-testid="moshpit-tournament-overlay-complete"
          >
            {{ t('moshpit.tournament.winner.headerComplete') }}
          </span>
        </header>

        <main class="relative flex flex-1 overflow-hidden">
          <template v-if="tournamentStore.isFinished">
            <MoshpitTournamentWinner
              :resolve-full-res-url="resolveFullResUrl"
              @confirm="onConfirmWinner"
            />
          </template>
          <template v-else>
            <div class="relative flex-1">
              <MoshpitTournamentPair
                :resolve-full-res-url="resolveFullResUrl"
              />
            </div>
            <MoshpitMetadataPeekPanel :params-a="paramsA" :params-b="paramsB" />
          </template>
        </main>

        <footer
          class="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-(--interface-stroke) px-4 py-3 text-xs text-muted-foreground"
          data-testid="moshpit-tournament-overlay-legend"
        >
          <template v-if="tournamentStore.isFinished">
            <span>{{ t('moshpit.tournament.legend.confirm') }}</span>
            <span>{{ t('moshpit.tournament.legend.exit') }}</span>
          </template>
          <template v-else>
            <span class="flex items-center gap-3">
              <span>{{ t('moshpit.tournament.legend.pickA') }}</span>
              <span>{{ t('moshpit.tournament.legend.pickB') }}</span>
              <span>{{ t('moshpit.tournament.legend.skip') }}</span>
            </span>
            <span class="flex items-center gap-3">
              <span>{{ t('moshpit.tournament.legend.mode') }}</span>
              <span>{{ t('moshpit.tournament.legend.flip') }}</span>
              <span>{{ t('moshpit.tournament.legend.peek') }}</span>
            </span>
            <span class="ml-auto">{{
              t('moshpit.tournament.legend.exit')
            }}</span>
          </template>
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
