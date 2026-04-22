<!--
  MoshpitTournamentBracketTree — left sidebar bracket visualisation for the
  tournament overlay.

  Reads entirely from the tournament store. Self-hides when the tournament is
  not active OR when it has completed (winner screen takes the full width).

  Round-robin: single vertical list of every pair. Single-elim: horizontal
  round columns that grow as rounds materialise — only fully-generated rounds
  are rendered (we never show half-filled rounds).
-->
<script setup lang="ts">
import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { TournamentPair } from '@/platform/moshpit/services/tournamentBracket'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'
import { cn } from '@/utils/tailwindUtil'

defineOptions({ name: 'MoshpitTournamentBracketTree' })

const { t } = useI18n()
const tournamentStore = useMoshpitTournamentStore()

function nextPow2(n: number): number {
  return n <= 1 ? 1 : 1 << Math.ceil(Math.log2(n))
}

function singleElimRoundSizes(entryCount: number): number[] {
  if (entryCount < 2) return []
  const sizes: number[] = []
  const byeCount = nextPow2(entryCount) - entryCount
  const firstRound = (entryCount - byeCount) / 2
  if (firstRound > 0) sizes.push(firstRound)
  let size = nextPow2(entryCount) / 4
  while (size >= 1) {
    sizes.push(size)
    size = size / 2
  }
  return sizes
}

function sliceIntoRounds(
  pairs: readonly TournamentPair[],
  sizes: readonly number[]
): TournamentPair[][] {
  const rounds: TournamentPair[][] = []
  let cursor = 0
  for (const size of sizes) {
    if (cursor + size > pairs.length) break
    rounds.push([...pairs.slice(cursor, cursor + size)])
    cursor += size
  }
  return rounds
}

const rounds: ComputedRef<TournamentPair[][]> = computed(() => {
  const bracket = tournamentStore.bracket
  if (tournamentStore.bracketShape === 'roundRobin') {
    return bracket.length > 0 ? [[...bracket]] : []
  }
  return sliceIntoRounds(
    bracket,
    singleElimRoundSizes(tournamentStore.entryHashes.length)
  )
})
</script>

<template>
  <aside
    v-if="tournamentStore.isActive && !tournamentStore.isFinished"
    :aria-label="t('moshpit.tournament.bracket.title')"
    class="flex w-50 shrink-0 flex-col overflow-y-auto bg-modal-panel-background"
    data-testid="moshpit-bracket-root"
  >
    <div
      v-if="tournamentStore.bracketShape === 'singleElim'"
      class="flex gap-2 p-3"
    >
      <div
        v-for="(round, roundIdx) in rounds"
        :key="roundIdx"
        class="flex flex-col justify-around gap-3"
        :data-testid="`moshpit-bracket-round-${roundIdx}`"
      >
        <div
          v-for="pair in round"
          :key="pair.index"
          :class="
            cn(
              'flex flex-col gap-1 rounded-sm border p-1 text-2xs',
              pair.index === tournamentStore.currentPairIndex
                ? 'border-border-focused'
                : 'border-border-subtle',
              tournamentStore.pairResults.get(pair.index) === 'skip' &&
                'border-dashed opacity-60'
            )
          "
          :data-testid="`moshpit-bracket-pair-${pair.index}`"
          :data-current="
            pair.index === tournamentStore.currentPairIndex ? 'true' : undefined
          "
          :data-skipped="
            tournamentStore.pairResults.get(pair.index) === 'skip'
              ? 'true'
              : undefined
          "
          :aria-label="
            t('moshpit.tournament.bracket.matchup', {
              a: pair.seedA + 1,
              b: pair.seedB + 1
            })
          "
        >
          <div
            :class="
              cn(
                'flex items-center justify-between rounded-xs border px-2 py-0.5 font-mono',
                tournamentStore.pairResults.get(pair.index) === 'A'
                  ? 'border-border-focused bg-bg-toggle-on-default text-base-foreground'
                  : 'border-transparent text-muted-foreground',
                tournamentStore.pairResults.get(pair.index) === 'B' &&
                  'opacity-60'
              )
            "
            :data-testid="
              tournamentStore.pairResults.get(pair.index) === 'A'
                ? 'moshpit-bracket-winner'
                : undefined
            "
          >
            <span>#{{ pair.seedA + 1 }}</span>
          </div>
          <div
            :class="
              cn(
                'flex items-center justify-between rounded-xs border px-2 py-0.5 font-mono',
                tournamentStore.pairResults.get(pair.index) === 'B'
                  ? 'border-border-focused bg-bg-toggle-on-default text-base-foreground'
                  : 'border-transparent text-muted-foreground',
                tournamentStore.pairResults.get(pair.index) === 'A' &&
                  'opacity-60'
              )
            "
            :data-testid="
              tournamentStore.pairResults.get(pair.index) === 'B'
                ? 'moshpit-bracket-winner'
                : undefined
            "
          >
            <span>#{{ pair.seedB + 1 }}</span>
          </div>
        </div>
      </div>
    </div>

    <ul v-else class="flex flex-col gap-1 p-3">
      <li
        v-for="pair in rounds[0] ?? []"
        :key="pair.index"
        :class="
          cn(
            'flex flex-col gap-1 rounded-sm border p-1 text-2xs',
            pair.index === tournamentStore.currentPairIndex
              ? 'border-border-focused'
              : 'border-border-subtle',
            tournamentStore.pairResults.get(pair.index) === 'skip' &&
              'border-dashed opacity-60'
          )
        "
        :data-testid="`moshpit-bracket-pair-${pair.index}`"
        :data-current="
          pair.index === tournamentStore.currentPairIndex ? 'true' : undefined
        "
        :data-skipped="
          tournamentStore.pairResults.get(pair.index) === 'skip'
            ? 'true'
            : undefined
        "
        :aria-label="
          t('moshpit.tournament.bracket.matchup', {
            a: pair.seedA + 1,
            b: pair.seedB + 1
          })
        "
      >
        <div
          :class="
            cn(
              'flex items-center justify-between rounded-xs border px-2 py-0.5 font-mono',
              tournamentStore.pairResults.get(pair.index) === 'A'
                ? 'border-border-focused bg-bg-toggle-on-default text-base-foreground'
                : 'border-transparent text-muted-foreground',
              tournamentStore.pairResults.get(pair.index) === 'B' &&
                'opacity-60'
            )
          "
          :data-testid="
            tournamentStore.pairResults.get(pair.index) === 'A'
              ? 'moshpit-bracket-winner'
              : undefined
          "
        >
          <span>#{{ pair.seedA + 1 }}</span>
        </div>
        <div
          :class="
            cn(
              'flex items-center justify-between rounded-xs border px-2 py-0.5 font-mono',
              tournamentStore.pairResults.get(pair.index) === 'B'
                ? 'border-border-focused bg-bg-toggle-on-default text-base-foreground'
                : 'border-transparent text-muted-foreground',
              tournamentStore.pairResults.get(pair.index) === 'A' &&
                'opacity-60'
            )
          "
          :data-testid="
            tournamentStore.pairResults.get(pair.index) === 'B'
              ? 'moshpit-bracket-winner'
              : undefined
          "
        >
          <span>#{{ pair.seedB + 1 }}</span>
        </div>
      </li>
    </ul>
  </aside>
</template>
