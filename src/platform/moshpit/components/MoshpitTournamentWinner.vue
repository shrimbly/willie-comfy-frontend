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
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  PARAM_DIFF_KEY_ORDER,
  formatValue
} from '@/platform/moshpit/services/metadataDiff'
import { useMoshpitFoldersStore } from '@/platform/moshpit/stores/moshpitFoldersStore'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
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
const foldersStore = useMoshpitFoldersStore()
const toastStore = useToastStore()

const winners = computed(() => tournamentStore.winnerHashes)
const isSingle = computed(() => winners.value.length === 1)

const title = computed(() =>
  isSingle.value
    ? t('moshpit.tournament.winner.title')
    : t('moshpit.tournament.winner.titlePlural', {
        count: winners.value.length
      })
)

const savingFolder = ref(false)
const folderName = ref('')
const folderInputEl = ref<HTMLInputElement | null>(null)

watch(savingFolder, (val) => {
  if (val) {
    const now = new Date()
    folderName.value = t('moshpit.tournament.winner.saveAsFolderDefault', {
      date: now.toLocaleString()
    })
    void nextTick(() => folderInputEl.value?.focus())
  }
})

function onSaveFolder(): void {
  const trimmed = folderName.value.trim()
  if (!trimmed || trimmed.length > 64) {
    toastStore.add({
      severity: 'warn',
      summary: t('moshpit.curation.invalidFolder'),
      life: 3000
    })
    return
  }
  const winnerList = [...tournamentStore.winnerHashes]
  foldersStore.createFromSelection(trimmed, winnerList)
  toastStore.add({
    severity: 'info',
    summary: t('moshpit.curation.folderCreated', {
      name: trimmed,
      count: winnerList.length
    }),
    life: 4000
  })
  savingFolder.value = false
  folderName.value = ''
}

function getWins(hash: string): number {
  return tournamentStore.wins.get(hash) ?? 0
}

function onConfirm(): void {
  emit('confirm')
}
</script>

<template>
  <section
    class="flex size-full flex-col overflow-hidden bg-interface-panel-surface"
    data-testid="moshpit-tournament-winner"
  >
    <header
      class="flex items-center justify-between border-b border-(--interface-stroke) px-4 py-3"
    >
      <h2 class="text-sm font-medium text-base-foreground">{{ title }}</h2>
    </header>

    <div
      :class="
        cn(
          'min-h-0 flex-1 overflow-hidden p-4',
          isSingle
            ? 'flex gap-4'
            : 'grid auto-rows-max grid-cols-1 gap-4 overflow-y-auto md:grid-cols-2 xl:grid-cols-3'
        )
      "
    >
      <article
        v-for="hash in winners"
        :key="hash"
        :class="
          cn(
            'flex min-h-0 overflow-hidden rounded-md border border-border-subtle bg-secondary-background',
            isSingle ? 'w-full flex-row' : 'flex-col'
          )
        "
        :data-testid="`moshpit-tournament-winner-card-${hash}`"
      >
        <div
          :class="
            cn(
              'relative min-h-0 overflow-hidden bg-base-background',
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
              'flex min-h-0 flex-col gap-3 overflow-y-auto p-3',
              isSingle
                ? 'flex-2 border-l border-border-subtle'
                : 'border-t border-border-subtle'
            )
          "
        >
          <div class="flex items-center justify-between">
            <span
              class="text-2xs font-medium tracking-wide text-muted-foreground uppercase"
            >
              {{
                t('moshpit.tournament.winner.winsLabel', {
                  count: getWins(hash)
                })
              }}
            </span>
            <!-- deferred: favourite / tag / hide actions wire in here -->
            <div
              class="flex items-center gap-1"
              :data-testid="`moshpit-tournament-winner-actions-${hash}`"
            />
          </div>

          <template v-if="metadataStore.getParams(hash)">
            <section class="flex flex-col gap-1">
              <h3 class="text-xs font-medium text-base-foreground">
                {{ t('moshpit.tournament.winner.paramsTitle') }}
              </h3>
              <div class="flex flex-col gap-0.5">
                <div
                  v-for="key in PARAM_DIFF_KEY_ORDER"
                  :key="key"
                  class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm px-2 py-1 text-xs"
                  :data-testid="`moshpit-tournament-winner-param-${hash}-${key}`"
                >
                  <span class="truncate text-muted-foreground">
                    {{ t(`moshpit.peek.params.${key}`) }}
                  </span>
                  <span
                    class="max-w-full truncate text-right font-mono text-base-foreground"
                  >
                    {{ formatValue(metadataStore.getParams(hash)?.[key]) }}
                  </span>
                </div>
              </div>
            </section>

            <section
              class="flex flex-col gap-1 border-t border-border-subtle pt-3"
            >
              <h3 class="text-xs font-medium text-base-foreground">
                {{ t('moshpit.tournament.winner.lorasTitle') }}
              </h3>
              <div
                v-if="(metadataStore.getParams(hash)?.loras.length ?? 0) === 0"
                class="px-2 text-xs text-muted-foreground"
              >
                {{ t('moshpit.tournament.winner.lorasEmpty') }}
              </div>
              <ul v-else class="flex flex-col gap-0.5">
                <li
                  v-for="lora in metadataStore.getParams(hash)?.loras"
                  :key="lora.name"
                  class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm px-2 py-1 text-xs"
                >
                  <span class="truncate font-mono text-base-foreground">
                    {{ lora.name }}
                  </span>
                  <span class="font-mono text-muted-foreground">
                    {{ formatValue(lora.weight) }}
                  </span>
                </li>
              </ul>
            </section>
          </template>

          <div v-else class="px-2 text-xs text-muted-foreground">
            {{ t('moshpit.tournament.winner.metadataUnavailable') }}
          </div>
        </div>
      </article>
    </div>

    <footer
      class="flex items-center justify-between border-t border-(--interface-stroke) px-4 py-3"
    >
      <div class="flex items-center gap-2">
        <button
          v-if="!savingFolder"
          type="button"
          class="inline-flex h-8 items-center rounded-sm border border-border-subtle px-4 text-xs font-medium text-base-foreground transition-colors hover:bg-interface-panel-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)"
          data-testid="moshpit-tournament-winner-save-folder"
          @click="savingFolder = true"
        >
          {{ t('moshpit.tournament.winner.saveAsFolder') }}
        </button>
        <form
          v-else
          class="flex items-center gap-2"
          @submit.prevent="onSaveFolder"
        >
          <input
            ref="folderInputEl"
            v-model="folderName"
            type="text"
            :placeholder="t('moshpit.curation.folders.newFolderPlaceholder')"
            maxlength="64"
            data-testid="moshpit-tournament-winner-folder-input"
            class="h-8 rounded-sm border border-border-subtle bg-interface-panel-surface px-2 text-xs text-base-foreground placeholder-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)"
          />
          <button
            type="submit"
            class="inline-flex h-8 items-center rounded-sm bg-primary-background px-3 text-xs font-medium text-base-foreground transition-colors hover:bg-primary-background-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)"
            data-testid="moshpit-tournament-winner-folder-submit"
          >
            {{ t('g.save') }}
          </button>
          <button
            type="button"
            class="inline-flex h-8 items-center rounded-sm border border-border-subtle px-3 text-xs font-medium text-base-foreground transition-colors hover:bg-interface-panel-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)"
            data-testid="moshpit-tournament-winner-folder-cancel"
            @click="savingFolder = false"
          >
            {{ t('g.cancel') }}
          </button>
        </form>
      </div>
      <button
        type="button"
        class="inline-flex h-8 items-center rounded-sm bg-primary-background px-4 text-xs font-medium text-base-foreground transition-colors hover:bg-primary-background-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)"
        data-testid="moshpit-tournament-winner-confirm"
        @click="onConfirm"
      >
        {{ t('moshpit.tournament.winner.confirm') }}
      </button>
    </footer>
  </section>
</template>
