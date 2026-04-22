<!--
  MoshpitTournamentWinner — terminal screen shown inside the tournament overlay
  once every pair has been resolved. Renders each winner (top-1 for single-elim,
  top-N for round-robin with ties) with its full-res image and metadata, and
  emits `confirm` when the user accepts — the overlay then calls
  tournamentStore.exit('complete') which applies the winners to the canvas
  selection per Phase 5 D-08.

  Curation actions (favourite / tag / hide) are intentionally deferred: the
  mutation layer does not yet exist in Phase 5. The toolbar placeholder is
  marked so the next phase can drop buttons in without template churn.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  PARAM_DIFF_KEY_ORDER,
  formatValue
} from '@/platform/moshpit/services/metadataDiff'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'
import { cn } from '@/utils/tailwindUtil'

import MoshpitTournamentAssetFrame from './MoshpitTournamentAssetFrame.vue'

defineOptions({ name: 'MoshpitTournamentWinner' })

const { resolveFullResUrl } = defineProps<{
  resolveFullResUrl: (hash: string) => string | null
}>()

const emit = defineEmits<{ confirm: [] }>()

const { t } = useI18n()
const tournamentStore = useMoshpitTournamentStore()
const metadataStore = useMoshpitMetadataStore()

const winners = computed(() => tournamentStore.winnerHashes)
const isSingle = computed(() => winners.value.length === 1)

const title = computed(() =>
  isSingle.value
    ? t('moshpit.tournament.winner.title')
    : t('moshpit.tournament.winner.titlePlural', {
        count: winners.value.length
      })
)

function getWins(hash: string): number {
  return tournamentStore.wins.get(hash) ?? 0
}

function onConfirm(): void {
  emit('confirm')
}
</script>

<template>
  <section
    class="flex size-full flex-col overflow-hidden"
    data-testid="moshpit-tournament-winner"
  >
    <header class="flex items-center justify-between px-6 pt-4 pb-2">
      <h2 class="text-lg font-medium text-base-foreground">{{ title }}</h2>
    </header>

    <div
      :class="
        cn(
          'flex-1 overflow-hidden px-6 pb-4',
          isSingle
            ? 'flex min-h-0'
            : 'grid auto-rows-max grid-cols-1 gap-4 overflow-y-auto md:grid-cols-2 xl:grid-cols-3'
        )
      "
    >
      <article
        v-for="hash in winners"
        :key="hash"
        :class="
          cn(
            'min-h-0 overflow-hidden',
            isSingle
              ? 'flex w-full gap-6'
              : 'flex flex-col rounded-md border border-(--interface-stroke) bg-base-background'
          )
        "
        :data-testid="`moshpit-tournament-winner-card-${hash}`"
      >
        <div
          :class="
            cn(
              'relative min-h-0 overflow-hidden',
              isSingle ? 'flex-3' : 'aspect-square w-full'
            )
          "
        >
          <MoshpitTournamentAssetFrame
            :hash="hash"
            :full-res-url="resolveFullResUrl(hash)"
          />
        </div>

        <div
          :class="
            cn(
              'flex min-h-0 flex-col gap-3 overflow-y-auto',
              isSingle ? 'flex-2' : 'border-t border-(--interface-stroke) p-3'
            )
          "
        >
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-base-foreground">
              {{
                t('moshpit.tournament.winner.winsLabel', {
                  count: getWins(hash)
                })
              }}
            </span>
            <!-- deferred: favourite / tag / hide actions wire in here -->
            <div
              class="flex items-center gap-2"
              :data-testid="`moshpit-tournament-winner-actions-${hash}`"
            />
          </div>

          <template v-if="metadataStore.getParams(hash)">
            <h3 class="text-xs font-medium text-muted-foreground">
              {{ t('moshpit.tournament.winner.paramsTitle') }}
            </h3>
            <div class="flex flex-col gap-0.5">
              <div
                v-for="key in PARAM_DIFF_KEY_ORDER"
                :key="key"
                class="grid grid-cols-[1fr_auto] items-center gap-2 text-xs"
                :data-testid="`moshpit-tournament-winner-param-${hash}-${key}`"
              >
                <span class="text-muted-foreground">
                  {{ t(`moshpit.peek.params.${key}`) }}
                </span>
                <span
                  class="max-w-64 truncate text-right font-mono text-base-foreground"
                >
                  {{ formatValue(metadataStore.getParams(hash)?.[key]) }}
                </span>
              </div>
            </div>

            <h3 class="mt-1 text-xs font-medium text-muted-foreground">
              {{ t('moshpit.tournament.winner.lorasTitle') }}
            </h3>
            <div
              v-if="(metadataStore.getParams(hash)?.loras.length ?? 0) === 0"
              class="text-xs text-muted-foreground"
            >
              {{ t('moshpit.tournament.winner.lorasEmpty') }}
            </div>
            <ul v-else class="flex flex-col gap-0.5 text-xs">
              <li
                v-for="lora in metadataStore.getParams(hash)?.loras"
                :key="lora.name"
                class="grid grid-cols-[1fr_auto] gap-2"
              >
                <span class="truncate font-mono text-base-foreground">
                  {{ lora.name }}
                </span>
                <span class="font-mono text-muted-foreground">
                  {{ formatValue(lora.weight) }}
                </span>
              </li>
            </ul>
          </template>

          <div v-else class="text-xs text-muted-foreground">
            {{ t('moshpit.tournament.winner.metadataUnavailable') }}
          </div>
        </div>
      </article>
    </div>

    <footer
      class="flex items-center justify-end border-t border-(--interface-stroke) px-6 py-3"
    >
      <button
        type="button"
        class="rounded-sm bg-interface-panel-surface px-4 py-2 text-sm font-medium text-base-foreground hover:bg-interface-panel-surface/80"
        data-testid="moshpit-tournament-winner-confirm"
        @click="onConfirm"
      >
        {{ t('moshpit.tournament.winner.confirm') }}
      </button>
    </footer>
  </section>
</template>
