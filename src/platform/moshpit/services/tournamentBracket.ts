/**
 * Phase 5 Plan 01 — pure tournament bracket module.
 *
 * Stub: names exported for RED test import resolution. Implementation lands
 * in the GREEN commit (Task 2).
 */

export type BracketShape = 'roundRobin' | 'singleElim'

export const ROUND_ROBIN_THRESHOLD = 8

export interface TournamentPair {
  readonly seedA: number
  readonly seedB: number
  readonly assetHashA: string
  readonly assetHashB: string
  readonly index: number
  readonly total: number
}

export interface BracketUpdate {
  readonly wins: ReadonlyMap<string, number>
  readonly queueTail: readonly TournamentPair[]
}

export interface SkipUpdate {
  readonly nextQueue: readonly TournamentPair[]
  readonly skippedPairIndexes: ReadonlySet<number>
  readonly wins: ReadonlyMap<string, number>
}

function notImplemented(name: string): never {
  throw new Error(`tournamentBracket: ${name} not implemented (RED stub)`)
}

export function decideBracketShape(_n: number): BracketShape {
  return notImplemented('decideBracketShape')
}

export function generateInitialBracket(
  _hashes: readonly string[],
  _shape: BracketShape
): readonly TournamentPair[] {
  return notImplemented('generateInitialBracket')
}

export function applyPick(
  _wins: ReadonlyMap<string, number>,
  _pair: TournamentPair,
  _winner: 'A' | 'B',
  _shape: BracketShape,
  _remainingQueueAfterThis: readonly TournamentPair[]
): BracketUpdate {
  return notImplemented('applyPick')
}

export function generateNextRound(
  _currentRoundWinnersInOrder: readonly string[],
  _totalPicksExpected: number,
  _baseIndex: number
): readonly TournamentPair[] {
  return notImplemented('generateNextRound')
}

export function applySkip(
  _pair: TournamentPair,
  _remainingQueueAfterThis: readonly TournamentPair[],
  _skippedPairIndexes: ReadonlySet<number>,
  _wins: ReadonlyMap<string, number>,
  _shape: BracketShape
): SkipUpdate {
  return notImplemented('applySkip')
}

export function computeWinnerSet(
  _wins: ReadonlyMap<string, number>,
  _shape: BracketShape,
  _hashesInEntryOrder: readonly string[],
  _topN?: number
): readonly string[] {
  return notImplemented('computeWinnerSet')
}
