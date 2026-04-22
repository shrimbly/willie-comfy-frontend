/**
 * Phase 5 Plan 03 — Ephemeral tournament Pinia store (D-12).
 *
 * Single source of truth for tournament mode:
 *   - bracket (frozen on entry)
 *   - pairwise cursor + wins map + skipped-index set
 *   - display mode / flip / peek / wipe position
 *
 * All state dies on exit (TOUR-05). No IndexedDB coupling, no thumbRepository
 * imports — the pure bracket math lives in `../services/tournamentBracket`.
 *
 * On enter(selection, fullResUrlResolver?):
 *   1. Defensive <2 guard
 *   2. Capture prior sidebar panel id; force-collapse (D-11)
 *   3. Decide shape; generate initial bracket
 *   4. Zero wins / skipped / cursor / flip / peek / wipe / display mode
 *   5. Fire-and-forget full-res preload via `new Image(); img.src = url` (TOUR-08)
 *   6. Flip isActive true
 *
 * On exit(trigger):
 *   - computeWinnerSet against stashed entry order
 *   - If >=1 winner: selectionStore.setSelection(winners) (applies to both
 *     'complete' and 'esc' — accept-what-you-have per D-08)
 *   - If 0 winners: fire toast (D-07), leave selection untouched
 *   - Restore prior sidebar panel id
 *   - Clear all state
 *   - Return winners
 */
import { defineStore } from 'pinia'
import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'

import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'

import type {
  BracketShape,
  TournamentPair
} from '../services/tournamentBracket'
import {
  applyPick,
  applySkip,
  computeWinnerSet,
  decideBracketShape,
  generateInitialBracket,
  generateNextRound
} from '../services/tournamentBracket'
import { useMoshpitSelectionStore } from './moshpitSelectionStore'
import { useMoshpitSidebarStore } from './moshpitSidebarStore'

export type TournamentDisplayMode = 'sideBySide' | 'overlap' | 'flip'

const DISPLAY_MODES: readonly TournamentDisplayMode[] = [
  'sideBySide',
  'overlap',
  'flip'
]

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export const useMoshpitTournamentStore = defineStore(
  'moshpitTournament',
  () => {
    const selectionStore = useMoshpitSelectionStore()
    const sidebarStore = useMoshpitSidebarStore()
    const toastStore = useToastStore()

    // --- reactive state ---
    const isActive: Ref<boolean> = ref(false)
    const bracket: Ref<readonly TournamentPair[]> = ref([])
    const bracketShape: Ref<BracketShape> = ref('roundRobin')
    const currentPairIndex: Ref<number> = ref(0)
    const wins: Ref<Map<string, number>> = ref(new Map())
    const skippedPairIndexes: Ref<Set<number>> = ref(new Set())
    const displayMode: Ref<TournamentDisplayMode> = ref('sideBySide')
    const flipShowsB: Ref<boolean> = ref(false)
    const isPeekOpen: Ref<boolean> = ref(false)
    const wipePosition: Ref<number> = ref(0.5)

    // --- non-reactive session state (restored on exit, NOT part of the
    // public store surface) ---
    const priorSidebarPanelId: Ref<string | null> = ref(null)
    const selectionOnEntry: Ref<readonly string[]> = ref([])
    const currentRoundWinnersInOrder: Ref<string[]> = ref([])
    const totalPicksExpected: Ref<number> = ref(0)

    // --- computed ---
    const currentPair: ComputedRef<TournamentPair | null> = computed(() => {
      if (!isActive.value) return null
      if (currentPairIndex.value >= bracket.value.length) return null
      return bracket.value[currentPairIndex.value]
    })

    const totalPairs: ComputedRef<number> = computed(() => bracket.value.length)

    const progress: ComputedRef<{ current: number; total: number }> = computed(
      () => ({
        current: Math.min(
          currentPairIndex.value + 1,
          Math.max(1, bracket.value.length)
        ),
        total: bracket.value.length
      })
    )

    // --- actions ---

    function resetState(): void {
      isActive.value = false
      bracket.value = []
      bracketShape.value = 'roundRobin'
      currentPairIndex.value = 0
      wins.value = new Map()
      skippedPairIndexes.value = new Set()
      displayMode.value = 'sideBySide'
      flipShowsB.value = false
      isPeekOpen.value = false
      wipePosition.value = 0.5
      selectionOnEntry.value = []
      currentRoundWinnersInOrder.value = []
      totalPicksExpected.value = 0
    }

    function preloadFullRes(
      selection: readonly string[],
      resolver: (hash: string) => string | null
    ): void {
      for (const hash of selection) {
        const url = resolver(hash)
        if (!url) continue
        // Fire-and-forget: assigning `.src` kicks off the browser fetch.
        // Native browser cache handles dedup with subsequent `<img>` renders.
        const img = new Image()
        img.src = url
      }
    }

    function enter(
      selection: readonly string[],
      fullResUrlResolver?: (hash: string) => string | null
    ): void {
      if (selection.length < 2) return

      priorSidebarPanelId.value = sidebarStore.activePanelId
      if (priorSidebarPanelId.value !== null) {
        sidebarStore.closePanel()
      }

      const shape = decideBracketShape(selection.length)
      bracketShape.value = shape
      bracket.value = generateInitialBracket(selection, shape)
      currentPairIndex.value = 0
      wins.value = new Map()
      skippedPairIndexes.value = new Set()
      displayMode.value = 'sideBySide'
      flipShowsB.value = false
      isPeekOpen.value = false
      wipePosition.value = 0.5
      selectionOnEntry.value = [...selection]
      currentRoundWinnersInOrder.value = []
      totalPicksExpected.value =
        shape === 'singleElim' ? selection.length - 1 : 0

      if (fullResUrlResolver) {
        preloadFullRes(selection, fullResUrlResolver)
      }

      isActive.value = true
    }

    function exit(trigger: 'esc' | 'complete'): readonly string[] {
      if (!isActive.value) return []
      void trigger // D-08 collapses esc + complete into one rule: >=1 win → apply.

      const winners = computeWinnerSet(
        wins.value,
        bracketShape.value,
        selectionOnEntry.value
      )

      if (winners.length > 0) {
        selectionStore.setSelection(winners)
      } else {
        toastStore.add({
          severity: 'info',
          summary: t('moshpit.tournament.noWinnersToastSummary'),
          detail: t('moshpit.tournament.noWinnersToastDetail')
        })
      }

      const restorePanelId = priorSidebarPanelId.value
      resetState()
      if (restorePanelId !== null) {
        sidebarStore.openPanel(restorePanelId)
      }
      priorSidebarPanelId.value = null

      return winners
    }

    function pickWinner(which: 'A' | 'B'): void {
      if (!isActive.value) return
      const pair = currentPair.value
      if (!pair) return

      const remaining = bracket.value.slice(currentPairIndex.value + 1)
      const update = applyPick(
        wins.value,
        pair,
        which,
        bracketShape.value,
        remaining
      )
      wins.value = new Map(update.wins)
      const winnerHash = which === 'A' ? pair.assetHashA : pair.assetHashB

      currentPairIndex.value += 1

      if (bracketShape.value === 'singleElim') {
        currentRoundWinnersInOrder.value = [
          ...currentRoundWinnersInOrder.value,
          winnerHash
        ]
        // Round boundary: queue exhausted => generate the next round from the
        // winners collected so far (>=2 winners, otherwise we're at the final).
        if (currentPairIndex.value >= bracket.value.length) {
          const winnersThisRound = currentRoundWinnersInOrder.value
          if (winnersThisRound.length >= 2) {
            const nextRound = generateNextRound(
              winnersThisRound,
              totalPicksExpected.value,
              bracket.value.length
            )
            if (nextRound.length > 0) {
              bracket.value = [...bracket.value, ...nextRound]
              currentRoundWinnersInOrder.value = []
            }
          }
        }
      }
    }

    function skip(): void {
      if (!isActive.value) return
      const pair = currentPair.value
      if (!pair) return

      const remaining = bracket.value.slice(currentPairIndex.value + 1)
      const update = applySkip(
        pair,
        remaining,
        skippedPairIndexes.value,
        wins.value,
        bracketShape.value
      )

      skippedPairIndexes.value = new Set(update.skippedPairIndexes)
      wins.value = new Map(update.wins)

      if (bracketShape.value === 'roundRobin') {
        // applySkip returns the rotated tail (remaining + skippedPair). The
        // new bracket is: everything before the cursor + rotated tail.
        const kept = bracket.value.slice(0, currentPairIndex.value)
        bracket.value = [...kept, ...update.nextQueue]
        // currentPairIndex stays the same — it now points at the next pair
        // because the current one moved to the tail.
      } else {
        // single-elim: seed A bye-advances; cursor moves forward.
        currentRoundWinnersInOrder.value = [
          ...currentRoundWinnersInOrder.value,
          pair.assetHashA
        ]
        currentPairIndex.value += 1
        if (currentPairIndex.value >= bracket.value.length) {
          const winnersThisRound = currentRoundWinnersInOrder.value
          if (winnersThisRound.length >= 2) {
            const nextRound = generateNextRound(
              winnersThisRound,
              totalPicksExpected.value,
              bracket.value.length
            )
            if (nextRound.length > 0) {
              bracket.value = [...bracket.value, ...nextRound]
              currentRoundWinnersInOrder.value = []
            }
          }
        }
      }
    }

    function toggleFlip(): void {
      flipShowsB.value = !flipShowsB.value
    }

    function cycleDisplayMode(direction: -1 | 1): void {
      const idx = DISPLAY_MODES.indexOf(displayMode.value)
      const next =
        (idx + direction + DISPLAY_MODES.length) % DISPLAY_MODES.length
      displayMode.value = DISPLAY_MODES[next]
    }

    function setDisplayMode(mode: TournamentDisplayMode): void {
      displayMode.value = mode
    }

    function togglePeek(): void {
      isPeekOpen.value = !isPeekOpen.value
    }

    function setWipePosition(n: number): void {
      wipePosition.value = clamp01(n)
    }

    function nudgeWipe(delta: number): void {
      setWipePosition(wipePosition.value + delta)
    }

    function resetWipe(): void {
      setWipePosition(0.5)
    }

    return {
      isActive,
      bracket,
      bracketShape,
      currentPairIndex,
      wins,
      skippedPairIndexes,
      displayMode,
      flipShowsB,
      isPeekOpen,
      wipePosition,
      currentPair,
      totalPairs,
      progress,
      enter,
      exit,
      pickWinner,
      skip,
      toggleFlip,
      cycleDisplayMode,
      setDisplayMode,
      togglePeek,
      setWipePosition,
      nudgeWipe,
      resetWipe
    }
  }
)
