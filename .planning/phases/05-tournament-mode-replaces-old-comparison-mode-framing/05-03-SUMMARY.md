---
phase: 05
plan: 03
subsystem: moshpit-tournament-store
tags: [moshpit, tournament, pinia, composable, keybindings, tdd]
requires:
  - 'decideBracketShape / generateInitialBracket / applyPick / generateNextRound / applySkip / computeWinnerSet from src/platform/moshpit/services/tournamentBracket.ts (Plan 05-01)'
  - 'useMoshpitSelectionStore.setSelection (D-08 winner handoff)'
  - 'useMoshpitSidebarStore.activePanelId / openPanel / closePanel (D-11 restore)'
  - 'useToastStore.add (D-07 zero-winners toast)'
provides:
  - 'useMoshpitTournamentStore() — Setup-API Pinia store per D-12'
  - 'TournamentDisplayMode type ("sideBySide" | "overlap" | "flip")'
  - 'useMoshpitTournamentKeybindings(rootEl) — D-13 / D-16 keymap adapter'
affects: []
tech-stack:
  added: []
  patterns:
    - 'Ephemeral Setup-API Pinia store (mirrors moshpitSelectionStore / moshpitSidebarStore shape)'
    - 'Scoped keydown via useEventListener (mirrors useMoshpitSpacePan)'
    - 'Injected fullResUrlResolver for TOUR-08 preload — keeps store pure w.r.t. assetsStore'
    - 'Functional-ref harness pattern for composable tests (manual ref callback instead of VNode `ref` prop, which proved unreliable under happy-dom)'
key-files:
  created:
    - 'src/platform/moshpit/stores/moshpitTournamentStore.ts'
    - 'src/platform/moshpit/stores/moshpitTournamentStore.test.ts'
    - 'src/platform/moshpit/composables/useMoshpitTournamentKeybindings.ts'
    - 'src/platform/moshpit/composables/useMoshpitTournamentKeybindings.test.ts'
  modified: []
decisions:
  - 'enter(selection, fullResUrlResolver?) signature — optional resolver keeps the store decoupled from assetsStore; MoshpitView composes the resolver using getAssetUrl + the asset registry (see Plan 06 executor pointer).'
  - 'currentRoundWinnersInOrder lives as an internal Setup-scope ref inside the store (NOT part of the public surface). Pushed on every pickWinner/skip in single-elim; cleared when generateNextRound materialises the next round.'
  - 'Preload is uncapped fire-and-forget — typical selection ≤32, browser connection-pool limit is the de-facto cap. Revisit with an 8-concurrent throttle only if UX-08 regresses under dogfood (D-23 Claude’s Discretion).'
  - 'Used `import { t } from "@/i18n"` (not useI18n inside setup). Pinia setup stores are composables for Vue’s purposes but the project convention across all Moshpit stores is the @/i18n helper — verified via `grep "useI18n|import \\{ t \\}"` returning zero matches in src/platform/moshpit/stores.'
  - 'D-08 collapses esc + complete into one rule — both triggers apply the winner set when >=1 win was recorded; only the zero-wins branch differentiates by firing the toast.'
  - 'Image constructor mock uses a real `function` declaration (not arrow) so `new Image()` works — vi.fn with an arrow implementation throws "is not a constructor".'
  - 'Ephemerality regex test strips comments before scanning so the doc comment "no thumbRepository imports" does not false-positive against the /thumbRepository/ guard.'
  - 'Keybinding test harness uses a function-style template ref callback rather than `h("div", { ref: el })` — the VNode-prop form failed to populate the ref reliably under happy-dom, leaving `useEventListener` with a null rootEl.'
metrics:
  duration: ~7min
  completed: 2026-04-22
  tasks: 3
  files: 4
  commits:
    - '2e209ee41 test(05-03): add failing tournament store tests'
    - '55b50fc63 feat(05-03): implement tournament store (ephemeral, no-IDB)'
    - '5b17be1ef test(05-03): add failing tournament keybindings test'
    - '452064f6a feat(05-03): implement tournament keybindings composable'
---

# Phase 5 Plan 03: Tournament Store + Keybindings Summary

Ephemeral Pinia store holding the full tournament-mode state (bracket, cursor,
wins, display mode, flip, peek, wipe) plus the scoped keydown composable that
translates the D-13 / D-16 keymap into store actions. Consumed by the overlay
components in Plans 05-04, 05-05, and 05-06.

## Final API Surface

### `moshpitTournamentStore.ts`

```typescript
import type {
  BracketShape,
  TournamentPair
} from '../services/tournamentBracket'

export type TournamentDisplayMode = 'sideBySide' | 'overlap' | 'flip'

export const useMoshpitTournamentStore = defineStore('moshpitTournament', () => {
  // state
  isActive: Ref<boolean>
  bracket: Ref<readonly TournamentPair[]>
  bracketShape: Ref<BracketShape>
  currentPairIndex: Ref<number>
  wins: Ref<Map<string, number>>
  skippedPairIndexes: Ref<Set<number>>
  displayMode: Ref<TournamentDisplayMode>
  flipShowsB: Ref<boolean>
  isPeekOpen: Ref<boolean>
  wipePosition: Ref<number>           // 0..1

  // computed
  currentPair: ComputedRef<TournamentPair | null>
  totalPairs: ComputedRef<number>
  progress: ComputedRef<{ current: number; total: number }> // 1-based

  // actions
  enter(selection: readonly string[], fullResUrlResolver?: (hash: string) => string | null): void
  exit(trigger: 'esc' | 'complete'): readonly string[]
  pickWinner(which: 'A' | 'B'): void
  skip(): void
  toggleFlip(): void
  cycleDisplayMode(direction: -1 | 1): void
  setDisplayMode(mode: TournamentDisplayMode): void
  togglePeek(): void
  setWipePosition(n: number): void   // clamps to [0, 1]
  nudgeWipe(delta: number): void     // clamps to [0, 1]
  resetWipe(): void                  // => 0.5
})
```

### `useMoshpitTournamentKeybindings.ts`

```typescript
export function useMoshpitTournamentKeybindings(
  rootEl: Ref<HTMLElement | null>
): void
```

Scoped `keydown` via `useEventListener(rootEl, 'keydown', …)`. Routes:

| Key                 | Action                                 |
| ------------------- | -------------------------------------- |
| `ArrowLeft`         | `pickWinner('A')`                      |
| `ArrowRight`        | `pickWinner('B')`                      |
| `ArrowDown`         | `skip()`                               |
| ` ` (Space)         | `toggleFlip()`                         |
| `[`                 | `cycleDisplayMode(-1)`                 |
| `]`                 | `cycleDisplayMode(+1)`                 |
| `m` / `M`           | `togglePeek()`                         |
| `,` / `Shift+,`     | `nudgeWipe(-0.05)` / `nudgeWipe(-0.2)` |
| `.` / `Shift+.`     | `nudgeWipe(+0.05)` / `nudgeWipe(+0.2)` |
| `/`                 | `resetWipe()`                          |
| `Escape` (NOT here) | Delegated to Reka DialogContent        |

Every handled key calls `preventDefault()` + `stopPropagation()`. Unhandled
keys pass through. No-op when `tournamentStore.isActive === false`.

## Signature Deviations from Plan `<interfaces>`

None of substance — every method listed in the plan's `<interfaces>` block
ships with the matching signature. The optional `fullResUrlResolver`
parameter on `enter(selection, resolver?)` matches the plan's recommended
signature (plan §Task 1 §3 NOTE). Overload safety: omitting the resolver
means preload is skipped entirely — the overlay can still render from
existing thumbnail cache and progressively upgrade as full-res loads via
the `<img>` tags themselves.

## Test Coverage (48 tests, 0 fast-check properties)

| File                                      | Describe blocks                                                                                                                                                                                                                         | Tests |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `moshpitTournamentStore.test.ts`          | enter() lifecycle (5) / sidebar capture+restore (2) / full-res preload (3) / pickWinner (3) / skip (3) / exit (3) / TOUR-05 ephemerality (2) / cycleDisplayMode (3) / toggleFlip (1) / togglePeek (1) / wipePosition (3) / progress (1) | 30    |
| `useMoshpitTournamentKeybindings.test.ts` | inactive no-op (2) / active key routing (14) / Escape pass-through (1) / unhandled keys pass-through (1) / stopPropagation on handled keys (1)                                                                                          | 18    |

**TOUR-05 ephemerality is enforced by a file-scan test** — the store source
is read from disk, comments are stripped, and the result is grepped for
`from '…idb`, `indexedDB`, `thumbRepository`, and `from '@/lib/litegraph`
— all must be absent. This is a cheap, durable regression guard: any future
refactor that accidentally imports IDB trips the test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 – Blocking] ESLint `import-x/no-unresolved` blocks test-first commits**

- **Found during:** Task 1 RED commit planning (anticipated from Plan 05-01 / 05-02 SUMMARY notes)
- **Issue:** Committing just a test file without the implementation file fails
  the husky pre-commit ESLint step.
- **Fix:** Shipped the RED commit with a stub `moshpitTournamentStore.ts`
  exporting the API surface with `notImplemented()` throwers. 29 of 30 tests
  still fail (only the ephemerality file-scan test passes at RED because the
  stub has no forbidden imports).
- **Files modified:** `src/platform/moshpit/stores/moshpitTournamentStore.ts`
- **Commit:** Folded into RED commit `2e209ee41`

**2. [Rule 1 – Bug] `vi.fn().mockImplementation(() => { ... })` is not a constructor**

- **Found during:** Task 2 GREEN verification
- **Issue:** The preload tests stubbed `Image` with an arrow-function mock.
  Vitest's own warning flagged it: "The vi.fn() mock did not use 'function'
  or 'class' in its implementation." `new Image()` inside `preloadFullRes`
  threw `TypeError: … is not a constructor`.
- **Fix:** Replaced with a real `function FakeImage(this: { src: string })`
  declaration and `vi.stubGlobal('Image', FakeImage)`. `new` now works; the
  `imageInstances` side-channel captures every constructed image for
  assertion.
- **Files modified:** `src/platform/moshpit/stores/moshpitTournamentStore.test.ts`
- **Commit:** Folded into GREEN commit `55b50fc63`

**3. [Rule 1 – Bug] Ephemerality regex false-positive on doc comment**

- **Found during:** Task 2 GREEN verification
- **Issue:** The TOUR-05 scan tested `/thumbRepository/.test(src)` but the
  store's own doc comment says "No IndexedDB coupling, no thumbRepository
  imports" — the regex matched the comment.
- **Fix:** Test now strips block + line comments before scanning. Import
  detection tightened to `/from ['"][^'"]*\bidb\b/` and `/from ['"]@\/lib\/litegraph/`
  so only real import statements trip the guard.
- **Files modified:** `src/platform/moshpit/stores/moshpitTournamentStore.test.ts`
- **Commit:** Folded into GREEN commit `55b50fc63`

**4. [Rule 1 – Bug] VNode-prop `ref` didn't populate under happy-dom**

- **Found during:** Task 3 GREEN verification
- **Issue:** The keybinding tests used `h('div', { ref: el, tabindex: -1 })`
  in the Harness render. Under happy-dom + vue-test-utils, `el.value`
  remained `null`, so `useEventListener(rootEl, 'keydown', …)` never
  attached a real DOM listener and every active-state test failed with
  "wrappedAction called 0 times".
- **Fix:** Switched to a callback-style template ref:
  `ref: (node) => { el.value = (node as HTMLElement | null) ?? null }`.
  All 14 active-state tests + the stopPropagation test flipped green.
- **Files modified:** `src/platform/moshpit/composables/useMoshpitTournamentKeybindings.test.ts`
- **Commit:** Folded into GREEN commit `452064f6a`

**5. [Rule 3 – Lint] Inline `type` specifier blocked by oxlint**

- **Found during:** Task 2 GREEN commit
- **Issue:** oxlint's `import/consistent-type-specifier-style: prefer-top-level`
  rejected `import { applyPick, …, type BracketShape, type TournamentPair } from '…'`.
- **Fix:** Split into a dedicated `import type { BracketShape, TournamentPair } from '…'`
  followed by the runtime-value import.
- **Files modified:** `src/platform/moshpit/stores/moshpitTournamentStore.ts`
- **Commit:** Folded into GREEN commit `55b50fc63`

No architectural changes required. No auth gates. No CLAUDE.md directives
violated.

## Notes for Plan 05-04 / 05-05 / 05-06 Executor

### Overlay mount pattern

```vue
<!-- MoshpitTournamentOverlay.vue (Plan 05-04) -->
<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useMoshpitTournamentKeybindings } from '@/platform/moshpit/composables/useMoshpitTournamentKeybindings'

const dialogContentRef = useTemplateRef<HTMLElement>('content')
useMoshpitTournamentKeybindings(dialogContentRef)
</script>

<template>
  <DialogContent ref="content" @escape-key-down="tournamentStore.exit('esc')">
    <!-- pair renderer, legend, peek panel -->
  </DialogContent>
</template>
```

### Entry gate pattern (Plan 05-06 — `MoshpitView.vue`)

```typescript
import { getAssetUrl } from '@/platform/assets/utils/assetUrlUtil'
import { useAssetsStore } from '@/stores/assetsStore'

function onContainerKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && selection.size >= 2 && !tournamentStore.isActive) {
    const assetsStore = useAssetsStore()
    tournamentStore.enter(selection.selected, (hash) => {
      const asset = assetsStore.historyAssets.find((a) => a.asset_hash === hash)
      return asset ? getAssetUrl(asset) : null
    })
  }
}
```

Resolver may need to consult `moshpitMetadataStore.assetIdToHash` for OSS
assets where `asset.asset_hash` is null (see
`useMoshpitAssetRegistry.ts:54`). The resolver contract accepts `null` returns
gracefully — the preload loop skips null URLs.

### Zero-winners toast i18n keys (Plan 05-06)

The store calls:

```typescript
toastStore.add({
  severity: 'info',
  summary: t('moshpit.tournament.noWinnersToastSummary'),
  detail: t('moshpit.tournament.noWinnersToastDetail')
})
```

Wire these keys in `src/locales/en/main.json` under `moshpit.tournament.*`
— the test only asserts on string type, so the keys will surface as raw
strings until Plan 06 lands the locale entries.

### D-08 exit semantics LOCKED

Both `exit('complete')` and `exit('esc')` apply the same rule:

- `winners.length > 0` → `selectionStore.setSelection(winners)` (both triggers)
- `winners.length === 0` → fire toast, preserve selection (both triggers)

The `trigger` argument is retained in the signature for telemetry /
future-compat but currently affects no behaviour. The overlay still passes
`'esc'` on `@escape-key-down` and `'complete'` on bracket exhaustion to keep
the call-site narrative clear.

### Sidebar restore ordering

`exit()` does `resetState()` BEFORE calling `sidebarStore.openPanel(...)` so
the sidebar animation and the overlay unmount animate in parallel rather
than the sidebar snapping back before the overlay fades. Pitfall 8 in the
RESEARCH doc (winner-set replaces selection mid-animation) is partially
addressed by the same ordering — the overlay sees `isActive=false` first,
Pixi canvas re-renders selection, then the sidebar returns.

## Self-Check

- `src/platform/moshpit/stores/moshpitTournamentStore.ts` — FOUND
- `src/platform/moshpit/stores/moshpitTournamentStore.test.ts` — FOUND
- `src/platform/moshpit/composables/useMoshpitTournamentKeybindings.ts` — FOUND
- `src/platform/moshpit/composables/useMoshpitTournamentKeybindings.test.ts` — FOUND
- Commit `2e209ee41` (store RED) — FOUND
- Commit `55b50fc63` (store GREEN) — FOUND
- Commit `5b17be1ef` (keybindings RED) — FOUND
- Commit `452064f6a` (keybindings GREEN) — FOUND
- All 48 tests pass under `pnpm test:unit -- --run src/platform/moshpit/stores/moshpitTournamentStore.test.ts src/platform/moshpit/composables/useMoshpitTournamentKeybindings.test.ts`
- TOUR-05 invariant: no `idb` / `indexedDB` / `thumbRepository` / `@/lib/litegraph` imports in the store source
- Keybindings: no `Escape` / `'esc'` string in the composable source (delegated to Reka DialogContent)

## Self-Check: PASSED
