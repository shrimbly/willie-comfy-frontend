import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useMoshpitSelectionStore } from './moshpitSelectionStore'
import { useMoshpitSidebarStore } from './moshpitSidebarStore'
import { useMoshpitTournamentStore } from './moshpitTournamentStore'
import { useToastStore } from '@/platform/updates/common/toastStore'

// Stub Image constructor so we can assert fire-and-forget preload (TOUR-08)
const imageInstances: Array<{ src: string }> = []

function resetImageSpy() {
  imageInstances.length = 0
  function FakeImage(this: { src: string }) {
    this.src = ''
    imageInstances.push(this)
  }
  vi.stubGlobal('Image', FakeImage)
}

describe('moshpitTournamentStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetImageSpy()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('enter() lifecycle (TOUR-01, D-12)', () => {
    it('empty selection is a no-op (isActive remains false)', () => {
      const store = useMoshpitTournamentStore()
      store.enter([])
      expect(store.isActive).toBe(false)
    })

    it('single-hash selection is a no-op (<2 defensive guard)', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a'])
      expect(store.isActive).toBe(false)
    })

    it('4-hash selection creates a round-robin bracket with correct defaults', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b', 'c', 'd'])

      expect(store.isActive).toBe(true)
      expect(store.bracketShape).toBe('roundRobin')
      expect(store.bracket.length).toBe(6) // 4*3/2
      expect(store.currentPairIndex).toBe(0)
      expect(store.wins.size).toBe(0)
      expect(store.skippedPairIndexes.size).toBe(0)
      expect(store.displayMode).toBe('sideBySide')
      expect(store.flipShowsB).toBe(false)
      expect(store.isPeekOpen).toBe(false) // PEEK-01 default
      expect(store.wipePosition).toBe(0.5)
    })

    it('10-hash selection creates a single-elim bracket', () => {
      const store = useMoshpitTournamentStore()
      const hashes = Array.from({ length: 10 }, (_, i) => `h${i}`)
      store.enter(hashes)
      expect(store.bracketShape).toBe('singleElim')
      expect(store.isActive).toBe(true)
    })

    it('exposes a currentPair computed matching the first bracket entry', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b', 'c', 'd'])
      expect(store.currentPair).not.toBeNull()
      expect(store.currentPair?.assetHashA).toBe('a')
      expect(store.currentPair?.assetHashB).toBe('b')
    })
  })

  describe('enter() captures + restores sidebar state (D-11)', () => {
    it('force-collapses an open sidebar panel on entry and restores on esc exit', () => {
      const sidebarStore = useMoshpitSidebarStore()
      const store = useMoshpitTournamentStore()

      sidebarStore.openPanel('settings')
      expect(sidebarStore.activePanelId).toBe('settings')

      store.enter(['a', 'b'])
      expect(sidebarStore.activePanelId).toBeNull()

      store.exit('esc')
      expect(sidebarStore.activePanelId).toBe('settings')
    })

    it('leaves a closed sidebar closed across enter/exit', () => {
      const sidebarStore = useMoshpitSidebarStore()
      const store = useMoshpitTournamentStore()

      sidebarStore.closePanel()
      expect(sidebarStore.activePanelId).toBeNull()

      store.enter(['a', 'b'])
      expect(sidebarStore.activePanelId).toBeNull()

      store.exit('esc')
      expect(sidebarStore.activePanelId).toBeNull()
    })
  })

  describe('enter() full-res preload (TOUR-08, D-23)', () => {
    it('kicks off one Image() per selection hash via the resolver', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b', 'c', 'd'], (hash) => `/full/${hash}`)

      expect(imageInstances.length).toBe(4)
      expect(imageInstances.map((i) => i.src).sort()).toEqual([
        '/full/a',
        '/full/b',
        '/full/c',
        '/full/d'
      ])
    })

    it('skips null resolver results without erroring', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b'], (hash) => (hash === 'a' ? `/full/a` : null))

      expect(imageInstances.length).toBe(1)
      expect(imageInstances[0].src).toBe('/full/a')
    })

    it('returns synchronously without awaiting loads', () => {
      const store = useMoshpitTournamentStore()
      const start = Date.now()
      store.enter(['a', 'b'], () => '/full/x')
      // Sync path: entry path under 50ms regardless of preload timing.
      expect(Date.now() - start).toBeLessThan(50)
      expect(store.isActive).toBe(true)
    })
  })

  describe('pickWinner (TOUR-03)', () => {
    it('increments wins for the picked side and advances cursor', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b', 'c', 'd'])

      // Pair 0 = (a, b)
      store.pickWinner('A')
      expect(store.wins.get('a')).toBe(1)
      expect(store.currentPairIndex).toBe(1)

      // Pair 1 = (a, c) in round-robin iteration (0,1),(0,2),...
      expect(store.currentPair?.assetHashA).toBe('a')
      expect(store.currentPair?.assetHashB).toBe('c')
      store.pickWinner('B')
      expect(store.wins.get('c')).toBe(1)
      expect(store.currentPairIndex).toBe(2)
    })

    it('is a no-op when isActive is false', () => {
      const store = useMoshpitTournamentStore()
      store.pickWinner('A')
      expect(store.wins.size).toBe(0)
      expect(store.currentPairIndex).toBe(0)
    })

    it('completing single-elim round generates next round pairs', () => {
      const store = useMoshpitTournamentStore()
      // 4 hashes -> round-robin; force single-elim by seeding 8 hashes.
      const hashes = Array.from({ length: 8 }, (_, i) => `h${i}`)
      store.enter(hashes)
      expect(store.bracketShape).toBe('singleElim')

      // Round 1: 4 pairs. Pick A every time.
      const initialBracketLen = store.bracket.length
      expect(initialBracketLen).toBe(4)
      store.pickWinner('A') // h0 wins vs h1
      store.pickWinner('A') // h2 wins vs h3
      store.pickWinner('A') // h4 wins vs h5
      store.pickWinner('A') // h6 wins vs h7

      // After round 1, generateNextRound should have appended 2 pairs (semifinals).
      expect(store.bracket.length).toBeGreaterThan(initialBracketLen)
      expect(store.bracket.length - initialBracketLen).toBe(2)
    })
  })

  describe('skip() (TOUR-03, D-03)', () => {
    it('round-robin skip routes to tail and records the pair index', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b', 'c', 'd'])

      const firstPair = store.currentPair!
      const firstIndex = firstPair.index
      const originalLen = store.bracket.length

      store.skip()

      expect(store.skippedPairIndexes.has(firstIndex)).toBe(true)
      expect(store.bracket.length).toBe(originalLen)
      // skipped pair is the LAST entry now
      expect(store.bracket[store.bracket.length - 1].index).toBe(firstIndex)
    })

    it('single-elim skip bye-advances seedA and records the skip', () => {
      const store = useMoshpitTournamentStore()
      const hashes = Array.from({ length: 8 }, (_, i) => `h${i}`)
      store.enter(hashes)

      const firstPair = store.currentPair!
      store.skip()

      expect(store.skippedPairIndexes.has(firstPair.index)).toBe(true)
      expect(store.wins.get(firstPair.assetHashA)).toBe(1)
    })

    it('is a no-op when inactive', () => {
      const store = useMoshpitTournamentStore()
      store.skip()
      expect(store.skippedPairIndexes.size).toBe(0)
    })
  })

  describe('exit() selection semantics (TOUR-06, TOUR-07, D-07, D-08)', () => {
    it('complete with >=1 win replaces selection with winnerSet', () => {
      const selectionStore = useMoshpitSelectionStore()
      const store = useMoshpitTournamentStore()

      selectionStore.setSelection(['a', 'b'])
      store.enter(['a', 'b'])
      store.pickWinner('A')

      const winners = store.exit('complete')
      expect(winners).toEqual(['a'])
      expect(selectionStore.selected).toEqual(['a'])
      expect(store.isActive).toBe(false)
    })

    it('esc with zero wins preserves selection and fires toast', () => {
      const selectionStore = useMoshpitSelectionStore()
      const toastStore = useToastStore()
      const store = useMoshpitTournamentStore()

      selectionStore.setSelection(['a', 'b'])
      store.enter(['a', 'b'])

      const winners = store.exit('esc')
      expect(winners).toEqual([])
      expect(selectionStore.selected.sort()).toEqual(['a', 'b'])
      expect(toastStore.messagesToAdd.length).toBeGreaterThan(0)
      const msg = toastStore.messagesToAdd[0]
      expect(typeof msg.summary).toBe('string')
      expect(typeof msg.detail).toBe('string')
    })

    it('esc with >=1 win replaces selection (accept-what-you-have)', () => {
      const selectionStore = useMoshpitSelectionStore()
      const store = useMoshpitTournamentStore()

      selectionStore.setSelection(['a', 'b'])
      store.enter(['a', 'b'])
      store.pickWinner('A')

      const winners = store.exit('esc')
      expect(winners).toEqual(['a'])
      expect(selectionStore.selected).toEqual(['a'])
    })
  })

  describe('TOUR-05 ephemerality', () => {
    it('re-entering yields fresh state (wins / skipped / cursor all reset)', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b', 'c', 'd'])
      store.pickWinner('A')
      store.skip()
      expect(store.wins.size).toBeGreaterThan(0)
      expect(store.skippedPairIndexes.size).toBeGreaterThan(0)

      store.exit('complete')
      store.enter(['x', 'y'])

      expect(store.wins.size).toBe(0)
      expect(store.skippedPairIndexes.size).toBe(0)
      expect(store.currentPairIndex).toBe(0)
    })

    it('source file has NO IndexedDB / thumbRepository coupling', () => {
      const src = readFileSync(
        resolve(
          process.cwd(),
          'src/platform/moshpit/stores/moshpitTournamentStore.ts'
        ),
        'utf8'
      )
      // Strip block + line comments so the doc comment saying
      // "no thumbRepository imports" doesn't false-positive.
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(/from ['"][^'"]*\bidb\b/.test(stripped)).toBe(false)
      expect(/indexedDB/.test(stripped)).toBe(false)
      expect(/thumbRepository/.test(stripped)).toBe(false)
      expect(/from ['"]@\/lib\/litegraph/.test(stripped)).toBe(false)
    })
  })

  describe('cycleDisplayMode (TOUR-02, D-18)', () => {
    it('cycles forward through sideBySide -> overlap -> flip -> wraps', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b'])

      expect(store.displayMode).toBe('sideBySide')
      store.cycleDisplayMode(+1)
      expect(store.displayMode).toBe('overlap')
      store.cycleDisplayMode(+1)
      expect(store.displayMode).toBe('flip')
      store.cycleDisplayMode(+1)
      expect(store.displayMode).toBe('sideBySide')
    })

    it('cycles backward through sideBySide -> flip -> overlap -> sideBySide', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b'])

      expect(store.displayMode).toBe('sideBySide')
      store.cycleDisplayMode(-1)
      expect(store.displayMode).toBe('flip')
      store.cycleDisplayMode(-1)
      expect(store.displayMode).toBe('overlap')
      store.cycleDisplayMode(-1)
      expect(store.displayMode).toBe('sideBySide')
    })

    it('setDisplayMode switches to the given mode directly', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b'])
      store.setDisplayMode('flip')
      expect(store.displayMode).toBe('flip')
    })
  })

  describe('toggleFlip (TOUR-04, D-17)', () => {
    it('flips the boolean on each call', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b'])
      expect(store.flipShowsB).toBe(false)
      store.toggleFlip()
      expect(store.flipShowsB).toBe(true)
      store.toggleFlip()
      expect(store.flipShowsB).toBe(false)
    })
  })

  describe('togglePeek (PEEK-01)', () => {
    it('flips isPeekOpen on each call', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b'])
      expect(store.isPeekOpen).toBe(false)
      store.togglePeek()
      expect(store.isPeekOpen).toBe(true)
      store.togglePeek()
      expect(store.isPeekOpen).toBe(false)
    })
  })

  describe('wipePosition (D-16)', () => {
    it('setWipePosition clamps to [0,1]', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b'])

      store.setWipePosition(0.3)
      expect(store.wipePosition).toBeCloseTo(0.3)

      store.setWipePosition(-0.5)
      expect(store.wipePosition).toBe(0)

      store.setWipePosition(1.5)
      expect(store.wipePosition).toBe(1)
    })

    it('nudgeWipe adds the delta and clamps', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b'])

      store.nudgeWipe(-0.05)
      expect(store.wipePosition).toBeCloseTo(0.45)

      store.nudgeWipe(+0.2)
      expect(store.wipePosition).toBeCloseTo(0.65)
    })

    it('resetWipe returns to 0.5', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b'])

      store.setWipePosition(0.9)
      store.resetWipe()
      expect(store.wipePosition).toBe(0.5)
    })
  })

  describe('progress computed', () => {
    it('reports 1-based current vs total', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b', 'c', 'd'])
      expect(store.progress).toEqual({ current: 1, total: 6 })
      store.pickWinner('A')
      expect(store.progress.current).toBe(2)
    })
  })

  describe('isFinished + winnerHashes computeds', () => {
    it('isFinished is false when tournament is inactive', () => {
      const store = useMoshpitTournamentStore()
      expect(store.isFinished).toBe(false)
      expect(store.winnerHashes).toEqual([])
    })

    it('isFinished is false mid-tournament', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b', 'c', 'd'])
      store.pickWinner('A')
      expect(store.isFinished).toBe(false)
    })

    it('round-robin tournament: isFinished true + winnerHashes top-N after all pairs consumed', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b', 'c', 'd'])
      // 6 pairs: (a,b)(a,c)(a,d)(b,c)(b,d)(c,d). Always pick A to make `a`
      // the dominant winner.
      const totalPairs = store.bracket.length
      for (let i = 0; i < totalPairs; i++) store.pickWinner('A')

      expect(store.isFinished).toBe(true)
      expect(store.winnerHashes.length).toBeGreaterThan(0)
      expect(store.winnerHashes[0]).toBe('a')
    })

    it('single-elim tournament: isFinished true + single champion at end', () => {
      const store = useMoshpitTournamentStore()
      const hashes = Array.from({ length: 8 }, (_, i) => `h${i}`)
      store.enter(hashes)
      // Drive to completion by always picking A (keeps appending rounds until
      // the final).
      let safety = 0
      while (!store.isFinished && safety < 100) {
        store.pickWinner('A')
        safety++
      }
      expect(safety).toBeLessThan(100)
      expect(store.isFinished).toBe(true)
      expect(store.winnerHashes.length).toBe(1)
    })

    it('isFinished flips back to false once exit() clears state', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b'])
      store.pickWinner('A')
      expect(store.isFinished).toBe(true)
      store.exit('complete')
      expect(store.isFinished).toBe(false)
      expect(store.isActive).toBe(false)
    })
  })

  describe('pairResults + entryHashes', () => {
    it('pairResults is empty initially after enter()', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b', 'c', 'd'])
      expect(store.pairResults.size).toBe(0)
    })

    it('records A pick under the pair.index', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b', 'c', 'd'])
      const firstPairIndex = store.bracket[0].index
      store.pickWinner('A')
      expect(store.pairResults.get(firstPairIndex)).toBe('A')
    })

    it('records B pick under the next pair.index', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b', 'c', 'd'])
      store.pickWinner('A')
      const secondPairIndex = store.bracket[1].index
      store.pickWinner('B')
      expect(store.pairResults.get(secondPairIndex)).toBe('B')
    })

    it('round-robin skip records skip under the original pair.index', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b', 'c', 'd'])
      const firstPair = store.currentPair!
      const firstIndex = firstPair.index
      store.skip()
      expect(store.pairResults.get(firstIndex)).toBe('skip')
    })

    it('single-elim skip records skip AND preserves bye-advance behaviour', () => {
      const store = useMoshpitTournamentStore()
      const hashes = Array.from({ length: 8 }, (_, i) => `h${i}`)
      store.enter(hashes)
      const firstPair = store.currentPair!
      store.skip()
      expect(store.pairResults.get(firstPair.index)).toBe('skip')
      expect(store.wins.get(firstPair.assetHashA)).toBe(1)
    })

    it('exit() clears pairResults; re-enter yields an empty map', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b', 'c', 'd'])
      store.pickWinner('A')
      expect(store.pairResults.size).toBeGreaterThan(0)
      store.exit('esc')
      store.enter(['x', 'y', 'z'])
      expect(store.pairResults.size).toBe(0)
    })

    it('entryHashes reflects the frozen selection on entry', () => {
      const store = useMoshpitTournamentStore()
      store.enter(['a', 'b', 'c', 'd'])
      expect([...store.entryHashes]).toEqual(['a', 'b', 'c', 'd'])
    })
  })
})
