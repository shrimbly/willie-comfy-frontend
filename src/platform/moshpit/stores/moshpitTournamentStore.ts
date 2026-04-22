/**
 * Phase 5 Plan 03 — Ephemeral tournament Pinia store (D-12).
 *
 * RED stub — API surface exported with notImplemented() throwers so the
 * test file can import it cleanly; real implementation lands in the GREEN
 * commit (Task 2).
 */
import { defineStore } from 'pinia'
import type { ComputedRef, Ref } from 'vue'
import { ref } from 'vue'

import type {
  BracketShape,
  TournamentPair
} from '../services/tournamentBracket'

export type TournamentDisplayMode = 'sideBySide' | 'overlap' | 'flip'

function notImplemented(name: string): never {
  throw new Error(`moshpitTournamentStore.${name} not implemented (RED stub)`)
}

export const useMoshpitTournamentStore = defineStore(
  'moshpitTournament',
  () => {
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

    const currentPair: ComputedRef<TournamentPair | null> = ref(
      null
    ) as unknown as ComputedRef<TournamentPair | null>
    const totalPairs: ComputedRef<number> = ref(
      0
    ) as unknown as ComputedRef<number>
    const progress: ComputedRef<{ current: number; total: number }> = ref({
      current: 0,
      total: 0
    }) as unknown as ComputedRef<{ current: number; total: number }>

    function enter(
      _selection: readonly string[],
      _fullResUrlResolver?: (hash: string) => string | null
    ): void {
      notImplemented('enter')
    }
    function exit(_trigger: 'esc' | 'complete'): readonly string[] {
      notImplemented('exit')
    }
    function pickWinner(_which: 'A' | 'B'): void {
      notImplemented('pickWinner')
    }
    function skip(): void {
      notImplemented('skip')
    }
    function toggleFlip(): void {
      notImplemented('toggleFlip')
    }
    function cycleDisplayMode(_direction: -1 | 1): void {
      notImplemented('cycleDisplayMode')
    }
    function setDisplayMode(_mode: TournamentDisplayMode): void {
      notImplemented('setDisplayMode')
    }
    function togglePeek(): void {
      notImplemented('togglePeek')
    }
    function setWipePosition(_n: number): void {
      notImplemented('setWipePosition')
    }
    function nudgeWipe(_delta: number): void {
      notImplemented('nudgeWipe')
    }
    function resetWipe(): void {
      notImplemented('resetWipe')
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
