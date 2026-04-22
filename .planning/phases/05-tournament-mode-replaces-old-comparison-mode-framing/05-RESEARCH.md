# Phase 5: Tournament Mode - Research

**Researched:** 2026-04-22
**Domain:** Keyboard-scoped modal overlay + pure bracket math + pure param-diff + single-asset DOM display primitive layered over live PixiJS canvas
**Confidence:** HIGH (domain code and conventions verified directly in the repo)

## Summary

Phase 5 is a **glue + pure-math + HTML-overlay** phase. All infrastructure it needs already ships: `moshpitSelectionStore.setSelection`, `moshpitSidebarStore.closePanel`, `moshpitThumbStore.getUrl`, `getAssetUrl`, `NormalizedParams`, `paramNormalize`, `toastStore`, `useMagicKeys`, `fast-check`, `reka-ui` Dialog primitives, Tailwind semantic tokens. The only new reusable primitives are two pure modules (`tournamentBracket.ts`, `metadataDiff.ts`) and one ephemeral Pinia store. The UI is a sibling `v-if` overlay on `MoshpitView.vue`, exactly like `MoshpitClusterOverlay` and `MoshpitEmptyGateOverlay`.

Three findings materially shape planning:

1. **`focus-trap` is NOT installed.** `@vueuse/integrations`' `useFocusTrap` treats `focus-trap` as an optional peer dep and the package is absent from `package.json`. Reka UI's `DialogRoot` / `DialogContent` ship their own focus trap and `@escape-key-down` handler — use these instead of adding a new dep. `ImageLightbox.vue` is the in-repo precedent.
2. **`moshpitThumbStore` exposes `getUrl(hash)` — NOT `getObjectUrl(hash)`.** CONTEXT.md D-24 claims the latter; the actual method is `getUrl`. One-word fix in the plan.
3. **No "300ms ease-out-cubic tween primitive" lives in a composable.** CONTEXT.md / Phase 2 carry-forward references to this are actually Tailwind utility classes (`transition-[...] duration-300 ease-out`). Peek slide-in and thumb→full-res crossfade should use Tailwind transitions, not a hand-rolled JS tween. No new dep.

**Primary recommendation:** Ship tournament mode as (1) two pure TypeScript modules + (2) one Setup-API Pinia store + (3) one Reka `DialogRoot` overlay hosting three display-mode sub-components + (4) one metadata peek side-panel + (5) a single `Enter` case added to `MoshpitView`'s pointerdown/keydown surface. Everything else is reuse.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Bracket Algorithm:**

- **D-01: Adaptive bracket shape.** On entry with selection size `N`:
  - `N < 8` → **round-robin**. All `N*(N-1)/2` unique unordered pairs.
  - `N ≥ 8` → **single-elimination**. `N-1` comparisons across `⌈log2(N)⌉` rounds. Byes to first `(nextPow2(N) - N)` seeds (first-seen order).
  - Shape fixed for the session; threshold `8` is a tunable constant.
- **D-02: Pair ordering deterministic by canvas selection order.** Input = ordered array of `assetHash` from `moshpitSelectionStore.selected` (insertion order). Round-robin iterates lexicographically: `(0,1), (0,2) … (1,2) …`. Single-elim seeds in selection order.
- **D-03: Skip re-queues the pair at the end** (round-robin); in single-elim skip = bye for asset A + pair recorded in `skippedPairs`.
- **D-04: Visible `Pair M / N` counter + `Esc` exits early.** No "Finish now" button — `Esc` carries both cancel and accept semantics, disambiguated by wins-map state.
- **D-05: Pair payload.** `TournamentPair { seedA, seedB, assetHashA, assetHashB, index, total }`. Pure — no Vue reactivity.

**Winner Set:**

- **D-06: Winner-set rule is bracket-aware.**
  - Round-robin: top assets by `wins` descending, cutoff = top 3 including all ties at 3rd-place win count. Skipped pairs contribute neither.
  - Single-elim: the champion (single element).
  - On early `Esc` with ≥1 pick: same rule against wins-so-far.
- **D-07: Zero-picks fallback.** Empty wins map at exit → no-op, toast `moshpit.tournament.noWinnersToast`, selection preserved.
- **D-08: Selection semantics on exit.** ≥1 win → `setSelection(winnerSet)`. Zero wins → preserve original. Inferred from state, no explicit control surface.
- **D-09: Tournament always restarts fresh on entry.** No resume semantics. Every `Enter` rederives bracket and zeroes wins map.

**Tournament UI Surface:**

- **D-10: Full-screen Vue overlay mounted inside `MoshpitView`.** New `MoshpitTournamentOverlay.vue` as a sibling of `MoshpitCanvas` / `MoshpitClusterOverlay`. `v-if="tournamentStore.isActive"`; no DOM cost when inactive. Canvas stays mounted behind it (no Pixi re-init). Overlay `inset-0` with `bg-background/95 backdrop-blur-sm`.
- **D-11: Sidebar auto-collapses on tournament entry, restores on exit.** Capture `moshpitSidebarStore.activePanelId` / `isPanelOpen`, close, restore on exit.
- **D-12: Ephemeral Pinia store.** New `src/platform/moshpit/stores/moshpitTournamentStore.ts` — Setup-API. State:
  ```
  isActive: Ref<boolean>
  bracket: Ref<TournamentPair[]>          // frozen on entry
  currentPairIndex: Ref<number>
  wins: Ref<Map<string, number>>
  skippedPairIndexes: Ref<Set<number>>
  displayMode: Ref<'sideBySide' | 'overlap' | 'flip'>
  flipShowsB: Ref<boolean>
  isPeekOpen: Ref<boolean>
  wipePosition: Ref<number>               // 0..1
  ```
  Actions: `enter(selection)`, `pickWinner('A'|'B')`, `skip()`, `toggleFlip()`, `setDisplayMode(mode)`, `togglePeek()`, `setWipePosition(n)`, `exit(trigger)`. No IDB.
- **D-13: Scoped keydown listener + focus containment.** Overlay mounts with `tabindex="-1"`, grabs focus on mount, attaches keydown listener on its own root via `useEventListener`. Tournament keys handled locally with `event.stopPropagation()`. Focus containment via **Reka `DialogRoot`** (see research §Focus trap) — canvas shortcuts gated naturally by event consumption.
- **D-14: `Enter` trigger container-local on `MoshpitView`.** Extend existing `onContainerPointerDown` surface with a keydown handler: when `selectionStore.size ≥ 2` AND `!tournamentStore.isActive`, call `tournamentStore.enter(selectionStore.selected)`. Toast with i18n key on `<2`.

**Display Mode Mechanics:**

- **D-15: Side-by-side = 50/50 vertical split with per-pane aspect-fit.** Two flex children `w-1/2 h-full` hosting `<img>` (or frame) with `object-contain`. Letterbox `bg-background`. No divider chrome.
- **D-16: Overlap = horizontal wipe with draggable divider + keyboard nudge.** Asset A absolute full-frame; asset B on top clipped by `clip-path: inset(0 X% 0 0)`. 2px divider + pill grab-handle. Pointer drag moves `wipePosition`. Keyboard nudge: **`,`/`.`** ±5%, **`Shift+,`/`Shift+.`** ±20%, **`/`** resets center.
- **D-17: A/B flip = manual only, `Space` toggles `flipShowsB` in any mode.** In flip-mode: single full-frame asset; `Space` swaps it. In side-by-side/overlap: brief 150ms border pulse on active side (or `A`/`B` corner label per discretion). `Space` never pans in tournament mode.
- **D-18: Display mode switching = instant swap.** `[` / `]` cycles `['sideBySide','overlap','flip']` with wrap. No animation. Current pair / wins / flipShowsB / wipePosition persist across mode changes.
- **D-19: Minimal chrome legend.** Bottom row: `← win A`, `→ win B`, `↓ skip`, `[ ] mode`, `Space flip`, `M peek`, `Esc exit`. `text-xs text-muted-foreground`. Pair counter in top-left.

**Metadata Peek:**

- **D-20: Right-side panel, pushes assets left.** `MoshpitMetadataPeekPanel.vue`, width `w-96`, assets pane `flex-1`. `M` toggles. 200ms `translateX` slide. Content: two-column (A | B) list; differing rows highlighted `bg-node-component-surface`.
- **D-21: Diff structure uses pure helpers in `metadataDiff.ts`.**
  - `diffParams(a, b): ParamDiffRow[]` — classifies `match | differ | only-a | only-b | missing-both`.
  - `diffLoras(a, b): LoraDiffEntry[]` — name-based, order-insensitive set diff: `match | weight-changed | added | removed`. Sorted alphabetically within state.
  - Semantic tokens: `text-success` / `text-danger` / `text-warning`.
- **D-22: Peek panel shows param source label.** Static map keyed by `keyof NormalizedParams`, i18n under `moshpit.peek.params.<key>`.

**Full-Res Loading:**

- **D-23: Full-res preload on tournament entry.** `Image()` preloads for every `getAssetUrl(asset)` in the selection. Native browser cache handles dedup. Don't block overlay render.
- **D-24: Loading fallback = existing thumb via `moshpitThumbStore.getUrl(hash)`.** (**NOTE: CONTEXT.md wrote `getObjectUrl`; the actual method is `getUrl` — verify during planning.**) While full-res loads, render thumb; swap `src` on load. Opacity-dim if loading >1s.

**Validation:**

- **D-25: HUMAN-UAT in `05-HUMAN-UAT.md`** — 11-scenario qualitative sign-off.
- **D-26: Vitest for pure modules.** `tournamentBracket.ts` + `metadataDiff.ts` with `fast-check` property tests (round-robin completeness, single-elim single-survivor, skip re-queue idempotency, LoRA diff permutation-invariance).
- **D-27: Playwright `@moshpit` spec** for entry gate / mode cycling / pair counter / winner-set selection. Peek + full-res perf not E2E. Check `deferred-items.md` status (see pitfalls).

### Claude's Discretion

- **Overlap wipe direction** — horizontal default; planner may flip to vertical if portraits dominate dogfood.
- **A/B flip visual indicator in non-flip modes** — 150ms border pulse OR corner `A`/`B` label.
- **Pair counter placement** — top-left or top-center, pick one.
- **Peek panel width** — `w-96` default; `w-80`…`w-[28rem]` acceptable.
- **Diff highlight tokens** — confirm against Comfy Design Standards Figma before hardcoding; fallback to `text-muted-foreground` + label prefix.
- **Keyboard chord for wipe divider** — `,`/`.` default; `-`/`=` / `0` acceptable if conflicts appear.
- **Toast implementation** — reuse `useToastStore.add()` from `src/platform/updates/common/toastStore.ts`.
- **Single-elim bye handling** — first-seen seeds vs evenly distributed; either defensible.
- **Preload strategy** — parallel all-at-once OR cap to 8 concurrent.
- **Winner-set visual pulse on exit** — 300ms highlight optional.
- **Peek icon for differ rows** — Lucide `git-compare` or similar.

### Deferred Ideas (OUT OF SCOPE)

- Persisted tournament scores / elo / bracket saves (v2-TOUR-01/02).
- Per-cluster "best of N" scoping (v2-TOUR-03).
- Auto-selected comparison mode per pair.
- Mobile / touch affordances for wipe divider.
- Full canvas a11y parity during tournament.
- Tournament-mode telemetry.
- Peek panel design polish (exact colour tokens, icons, typography — Phase 7 if needed).
- Resume semantics for interrupted tournaments.
- Manual seeding UI for single-elim.
- Winner-set visual pulse.
- Curation mutations from winner set (favourite / tag / folder / hide / export) — Phase 6.
- Frame-budget / full-res perf proof — Phase 7 (UX-08).
- Changes to `moshpitSelectionStore` / `moshpitFilterStore` / `paramNormalize` / `thumbRepository` schema — tournament is consumer only.
- New keybindings infrastructure (`commandStore` / `keybindingStore`).
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID          | Description                                                          | Research Support                                                                                                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **TOUR-01** | Enter tournament mode from selection of ≥2 via `Enter`               | `MoshpitView` already owns `tabindex=0` + container focus; extend `onContainerPointerDown`/keydown with `Enter` gate; read `selectionStore.size` — existing API                                                                                          |
| **TOUR-02** | Three display modes via `[` / `]`: side-by-side / overlap / A/B flip | New `MoshpitTournamentOverlay.vue` with three sub-components; `displayMode` state in new store; `[`/`]` handlers in scoped keydown                                                                                                                       |
| **TOUR-03** | Winner picks via `←` (A) / `→` (B); `↓` skips                        | New store actions `pickWinner('A'                                                                                                                                                                                                                        | 'B')`/`skip()`; keydown routes `ArrowLeft`/`ArrowRight`/`ArrowDown` |
| **TOUR-04** | `Space` triggers A/B flip in any mode                                | Scoped keydown consumes `Space` first — prevents `useMoshpitSpacePan` from firing because its `useMagicKeys` watcher still fires, BUT the viewport drag plugin reconfigure is harmless while overlay eats pointer events. Verify in research pitfall #3. |
| **TOUR-05** | Ephemeral — no scores persist                                        | New store is Setup-API Pinia; no `idb` import; state dies on `exit()`                                                                                                                                                                                    |
| **TOUR-06** | Exit produces winner set selected on canvas                          | `moshpitSelectionStore.setSelection(winnerSet)` — existing method                                                                                                                                                                                        |
| **TOUR-07** | `Esc` exits; selection preserved when zero picks                     | Store `exit('esc')` action applies D-07/D-08 rules                                                                                                                                                                                                       |
| **TOUR-08** | Full-resolution assets load on tournament entry                      | New store `enter()` triggers `Image()` preload over all `getAssetUrl(asset)` URLs — existing `getAssetUrl` helper; fallback via `moshpitThumbStore.getUrl(hash)`                                                                                         |
| **PEEK-01** | No metadata panel by default                                         | `isPeekOpen` defaults `false`; panel `v-if` gated                                                                                                                                                                                                        |
| **PEEK-02** | `M` toggles overlay; matching params plain, differing highlighted    | `diffParams()` pure function; rendering classifies rows; Tailwind semantic tokens                                                                                                                                                                        |
| **PEEK-03** | LoRA set diff — name-based, order-insensitive                        | `diffLoras()` pure function; `fast-check` permutation-invariance test                                                                                                                                                                                    |

</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

| Directive                                                                            | How Phase 5 Complies                                                                                                                                              |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript strict, no `any`, no `as any`, no `@ts-expect-error`                      | New modules use inferred types + narrow helpers; union types for `displayMode` / `DiffState`                                                                      |
| Vue 3.5 destructured-props, `<script setup lang="ts">`, no `withDefaults`            | All new `.vue` files use Vue 3.5 destructured props pattern                                                                                                       |
| No PrimeVue, no `dark:`, no `:class="[]"`, no `!important`, no arbitrary percentages | Use semantic tokens (`text-success` / `text-danger` / `bg-background/95`); `cn()` for class merging; Tailwind fractions (`w-1/2`, `w-4/5`)                        |
| No mods to `LGraphNode` / `LGraphCanvas` / `LGraph` / `Subgraph`                     | Tournament lives entirely in `src/platform/moshpit/`; zero litegraph import                                                                                       |
| Layer architecture: `base → platform → workbench → renderer`                         | All new code in `src/platform/moshpit/` — imports only `base` + `@vueuse/core` + `reka-ui` + internal moshpit modules                                             |
| IndexedDB only for persistence; tournament ephemeral                                 | No IDB calls; state dies with `exit()`                                                                                                                            |
| i18n via `useI18n()` in `.vue`, `import { t }` in non-composable `.ts`               | All user-facing strings in new `moshpit.tournament.*` + `moshpit.peek.*` namespaces                                                                               |
| `console.warn` / `console.error` only                                                | No debug logging                                                                                                                                                  |
| Logging never leaks secrets                                                          | N/A (no secret access)                                                                                                                                            |
| ADR 0003 + 0008: command pattern for entity mutations                                | `pickWinner` / `skip` / `exit` are deterministic, idempotent, replayable Pinia actions operating on plain-data state — compatible with future v2-TOUR-01 elo CRDT |
| Commit prefix `feat:` / `fix:` / `test:`, no AI mention, no `--no-verify`            | Standard project practice                                                                                                                                         |
| Tests for all changes, especially LoRA diff order-insensitivity                      | `fast-check` property tests in `tournamentBracket.test.ts` + `metadataDiff.test.ts`                                                                               |
| No `useVirtualList` from `@vueuse/core`                                              | N/A — peek panel is short list, no virtualization needed                                                                                                          |

## Standard Stack

### Core

| Library            | Version   | Purpose                                                                   | Why Standard                                                                          |
| ------------------ | --------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `vue`              | `^3.5.13` | Component + reactivity                                                    | Project-wide; Setup-API + destructured-props are mandatory style                      |
| `pinia`            | `^3.0.4`  | New `moshpitTournamentStore`                                              | Matches every other Moshpit store (`moshpitSelectionStore`, `moshpitFilterStore`, …)  |
| `@vueuse/core`     | `^14.2.0` | `useEventListener`, `useMagicKeys` (if needed), `useIntersectionObserver` | Already in use in `useMoshpitSpacePan`; avoids hand-rolling event lifecycles          |
| `reka-ui`          | `^2.5.0`  | `DialogRoot` + `DialogContent` for focus trap + `@escape-key-down`        | `ImageLightbox.vue` is the in-repo precedent; avoids adding `focus-trap` as a new dep |
| `vue-i18n`         | `^9.14.5` | All user-facing strings                                                   | Raw text banned in templates by `@intlify/vue-i18n/no-raw-text: error`                |
| `fast-check`       | `^4.5.3`  | Property tests for bracket + LoRA diff invariants                         | Already used in `clusterLayout.test.ts` + `groupAxes.test.ts`                         |
| `vitest`           | `^4.0.16` | Unit tests                                                                | Project standard                                                                      |
| `@playwright/test` | `^1.58.1` | `@moshpit` E2E                                                            | Matches Phase 1–4 E2E pattern (if tsconfig blocker resolved)                          |

### Supporting

| Library                           | Version      | Purpose                                                          | When to Use                                                                              |
| --------------------------------- | ------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `es-toolkit`                      | `^1.39.9`    | `uniqBy`, `sortBy`, `groupBy` for LoRA diff sorting              | Matches project convention (AGENTS.md — "Use es-toolkit")                                |
| Tailwind 4                        | `^4.2.0`     | Layout + colour via semantic tokens                              | All overlay chrome; peek panel slide uses `transition-[transform] duration-200 ease-out` |
| Lucide icons via `unplugin-icons` | (via plugin) | `git-compare` for diff gutter, `trophy` for winner-set highlight | Existing `icon-[lucide--x] size-5` pattern                                               |

### Alternatives Considered

| Instead of                                | Could Use                                             | Tradeoff                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Reka `DialogRoot`                         | Plain `<div>` + `@vueuse/integrations` `useFocusTrap` | Requires adding `focus-trap` dep (optional peer currently absent) — Reka already ships focus trap; no new dep |
| New Pinia store                           | Composable returning refs                             | Loses devtools inspectability; all other Moshpit state is Pinia for consistency                               |
| Hand-rolled tween for peek slide          | Tailwind `transition-[transform] duration-200`        | No reusable JS tween primitive exists; Tailwind transitions match `MoshpitProcessingIndicator` precedent      |
| Global `useMagicKeys` for tournament keys | Scoped keydown on overlay root via `useEventListener` | Global matches canvas shortcuts; scoped keeps events out of canvas — required by D-13                         |

**Installation:**

```bash
# No new dependencies required. All libraries already in catalog.
# (CRITICAL: Do NOT install focus-trap — Reka DialogRoot handles it.)
```

**Version verification:** All library versions are already in `pnpm-workspace.yaml` `catalog:` block. `[VERIFIED: pnpm-workspace.yaml inspection 2026-04-22]` — versions above match catalog exactly.

## Architecture Patterns

### Recommended Project Structure

```
src/platform/moshpit/
├── services/
│   ├── tournamentBracket.ts         # NEW — pure bracket math
│   ├── tournamentBracket.test.ts    # NEW — vitest + fast-check
│   ├── metadataDiff.ts              # NEW — pure param + LoRA diff
│   └── metadataDiff.test.ts         # NEW — vitest + fast-check
├── stores/
│   ├── moshpitTournamentStore.ts    # NEW — Setup-API Pinia
│   └── moshpitTournamentStore.test.ts # NEW
├── composables/
│   ├── useMoshpitTournamentKeybindings.ts   # NEW — scoped keydown factory
│   └── useMoshpitTournamentKeybindings.test.ts # NEW
└── components/
    ├── MoshpitTournamentOverlay.vue         # NEW — root overlay + focus trap
    ├── MoshpitTournamentOverlay.test.ts     # NEW
    ├── MoshpitTournamentOverlay.stories.ts  # NEW
    ├── MoshpitTournamentPair.vue            # NEW — hosts current pair, delegates mode
    ├── MoshpitTournamentPair.test.ts        # NEW
    ├── MoshpitTournamentAssetFrame.vue      # NEW — single-asset w/ full-res + thumb fallback
    ├── MoshpitTournamentAssetFrame.test.ts  # NEW
    ├── MoshpitMetadataPeekPanel.vue         # NEW — right-side diff panel
    ├── MoshpitMetadataPeekPanel.test.ts     # NEW
    └── MoshpitMetadataPeekPanel.stories.ts  # NEW

src/views/
└── MoshpitView.vue                          # EXTEND — mount <MoshpitTournamentOverlay /> + Enter gate

src/locales/en/main.json                     # EXTEND — moshpit.tournament.* + moshpit.peek.*
```

### Pattern 1: Pure math module + colocated Vitest + fast-check property tests

**What:** Bracket generation, winner-set derivation, LoRA diff — all deterministic, no Vue / Pinia / DOM imports.
**When to use:** Any logic that has invariants worth asserting (completeness, uniqueness, permutation-invariance).
**Example:**

```typescript
// Source: mirrors src/platform/moshpit/services/groupAxes.ts pattern
import type { NormalizedParams } from './paramNormalize'

export interface TournamentPair {
  readonly seedA: number
  readonly seedB: number
  readonly assetHashA: string
  readonly assetHashB: string
  readonly index: number
  readonly total: number
}

export type BracketShape = 'roundRobin' | 'singleElim'

export function decideBracketShape(n: number): BracketShape {
  return n < 8 ? 'roundRobin' : 'singleElim'
}

export function generateBracket(
  hashes: readonly string[],
  shape: BracketShape
): readonly TournamentPair[] {
  // Pure — deterministic ordering by input order.
}

export function computeWinnerSet(
  wins: ReadonlyMap<string, number>,
  shape: BracketShape,
  topN: number = 3
): readonly string[] {
  // Round-robin: top-N by wins with ties at cutoff promoted.
  // Single-elim: champion (single element) by wins === total-rounds.
}
```

### Pattern 2: Ephemeral Setup-API Pinia store

**What:** Mirror `moshpitSelectionStore` and `moshpitFilterStore` shape — one file, `defineStore('moshpitTournament', () => { … })`, expose refs + actions only.
**When to use:** Any tournament-scoped mutable state that outlives a single render but dies on `exit()`.
**Example:**

```typescript
// Source: src/platform/moshpit/stores/moshpitSelectionStore.ts pattern (verified in repo)
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useMoshpitTournamentStore = defineStore(
  'moshpitTournament',
  () => {
    const isActive = ref(false)
    const bracket = ref<readonly TournamentPair[]>([])
    const currentPairIndex = ref(0)
    const wins = ref<Map<string, number>>(new Map())
    // … rest of D-12 state

    function enter(selection: readonly string[]): void {
      // Freeze bracket, zero wins, activate.
    }
    function exit(trigger: 'esc' | 'complete'): readonly string[] {
      // Return winner set (may be empty); caller applies to selectionStore.
    }
    return { isActive, bracket, currentPairIndex, wins, enter, exit /* … */ }
  }
)
```

### Pattern 3: Reka `DialogRoot` overlay with scoped keydown

**What:** Use Reka's Dialog primitive for the overlay — get focus trap + escape handler + aria-modal for free.
**When to use:** Full-screen tournament overlay mounted as `MoshpitView` sibling.
**Example:**

```vue
<!-- Source: src/components/common/ImageLightbox.vue (verified precedent) -->
<script setup lang="ts">
import { DialogContent, DialogPortal, DialogRoot, DialogOverlay } from 'reka-ui'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'

const tournamentStore = useMoshpitTournamentStore()
</script>

<template>
  <DialogRoot v-model:open="tournamentStore.isActive">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm"
      />
      <DialogContent
        class="fixed inset-0 z-50 flex flex-col outline-none"
        @escape-key-down="tournamentStore.exit('esc')"
        @keydown="onKeydown"
      >
        <!-- pair counter, pair display, legend, peek -->
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
```

### Pattern 4: Scoped keydown composable factory

**What:** Mirror `useMoshpitSpacePan` shape — accept container ref / store, attach+detach keydown handlers.
**When to use:** All tournament shortcuts.
**Example:**

```typescript
// Source: src/platform/moshpit/composables/useMoshpitSpacePan.ts (verified precedent)
export function useMoshpitTournamentKeybindings(
  rootEl: Ref<HTMLElement | null>
): void {
  const store = useMoshpitTournamentStore()
  function onKeydown(e: KeyboardEvent): void {
    if (!store.isActive) return
    switch (e.key) {
      case 'ArrowLeft':
        store.pickWinner('A')
        e.preventDefault()
        e.stopPropagation()
        break
      case 'ArrowRight':
        store.pickWinner('B')
        e.preventDefault()
        e.stopPropagation()
        break
      case 'ArrowDown':
        store.skip()
        e.preventDefault()
        e.stopPropagation()
        break
      case ' ':
        store.toggleFlip()
        e.preventDefault()
        e.stopPropagation()
        break
      case '[':
        store.cycleMode(-1)
        e.preventDefault()
        e.stopPropagation()
        break
      case ']':
        store.cycleMode(+1)
        e.preventDefault()
        e.stopPropagation()
        break
      case 'm':
      case 'M':
        store.togglePeek()
        e.preventDefault()
        e.stopPropagation()
        break
      // Esc handled by @escape-key-down on DialogContent
      case ',':
        store.nudgeWipe(e.shiftKey ? -0.2 : -0.05)
        break
      case '.':
        store.nudgeWipe(e.shiftKey ? +0.2 : +0.05)
        break
      case '/':
        store.setWipePosition(0.5)
        break
    }
  }
  useEventListener(rootEl, 'keydown', onKeydown)
}
```

### Pattern 5: HTML-over-Pixi overlay

**What:** Overlay is a `v-if`-gated sibling DOM node of `MoshpitCanvas`; canvas stays mounted underneath but inert (overlay eats pointer events).
**When to use:** Every Moshpit overlay (`MoshpitClusterOverlay`, `MoshpitEmptyGateOverlay`, this one).
**Precedent:** `MoshpitView.vue` already hosts three sibling overlays — adding a fourth is zero new infrastructure.

### Anti-Patterns to Avoid

- **Global `useMagicKeys` for tournament keys.** Fights with `useMoshpitSpacePan` (which already uses `useMagicKeys().space`). Use scoped keydown on overlay root.
- **Reactive `tournamentBracket.ts`.** Bracket math must be pure — no Vue, no Pinia — so it's worker-safe for potential v2 offline elo.
- **`watch` on peek state to trigger animation.** Use CSS transitions driven by `v-if` / `:class` — matches `MoshpitProcessingIndicator.vue` precedent.
- **Mounting the overlay inside `MoshpitCanvas.vue`.** Canvas owns PixiJS only; overlays are `MoshpitView` siblings. Phase 4 Plan 06 SUMMARY already corrected a similar miscue.
- **Adding methods to `moshpitSelectionStore`.** Use the existing `setSelection(ids)` primitive. Tournament is a consumer.
- **Using `@ts-expect-error` to paper over any type hole.** Fix the type. Period.

## Don't Hand-Roll

| Problem                                 | Don't Build                                   | Use Instead                                                                                        | Why                                                                                                                        |
| --------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Overlay focus trap                      | Custom focus manager                          | **Reka `DialogRoot` + `DialogContent`**                                                            | Ships focus trap + aria-modal + `@escape-key-down`; `ImageLightbox.vue` precedent; avoids adding `focus-trap` as a new dep |
| Keydown lifecycle                       | `addEventListener` + manual `onBeforeUnmount` | **`useEventListener` from `@vueuse/core`**                                                         | Already used by `useMoshpitSpacePan`; auto-cleanup                                                                         |
| Slide-in animation for peek panel       | `requestAnimationFrame` tween                 | **Tailwind `transition-[transform] duration-200 ease-out` + `translate-x-0` / `translate-x-full`** | `MoshpitProcessingIndicator.vue` precedent; CSS is GPU-accelerated                                                         |
| Full-res URL resolution                 | Hand-rolled fetcher                           | **`getAssetUrl(asset, 'output')` from `src/platform/assets/utils/assetUrlUtil.ts`**                | Already handles cloud + OSS + subfolder encoding; verified in repo                                                         |
| Thumb URL fallback during full-res load | Re-fetch thumb                                | **`moshpitThumbStore.getUrl(hash)`** (NOT `getObjectUrl` — see pitfall #2)                         | Already caches `URL.createObjectURL` for every WebP blob                                                                   |
| Toast for "no winners" / "<2 selected"  | Custom banner                                 | **`useToastStore().add({ severity: 'info', summary, detail })`**                                   | Project-wide PrimeVue Toast; `toastStore.ts` verified in repo                                                              |
| Selection primitive for winner handoff  | New setter                                    | **`moshpitSelectionStore.setSelection(ids)`**                                                      | Exactly the needed primitive — verified in repo                                                                            |
| LoRA permutation detection              | Custom hash                                   | **`es-toolkit` `sortBy` + name-keyed Map**                                                         | Idiomatic; fast-check property test proves order-insensitivity                                                             |
| Param key label map                     | Inline i18n per row                           | **Static `Record<keyof NormalizedParams, string>` + `t('moshpit.peek.params.<key>')`**             | Shares labels with filter chips                                                                                            |

**Key insight:** Tournament mode is almost entirely **reuse + one pure math module + one overlay**. The only greenfield is bracket math and param/LoRA diff. Everything else is glue.

## Common Pitfalls

### Pitfall 1: `focus-trap` is not installed — do NOT pull `useFocusTrap` from `@vueuse/integrations`

**What goes wrong:** `useFocusTrap` silently no-ops (or throws at runtime depending on version) if `focus-trap` peer dep is missing. Tournament overlay loses focus containment, canvas shortcuts fire behind it.
**Why it happens:** `@vueuse/integrations` treats `focus-trap` as an optional peer; our `package.json` omits it. `grep "focus-trap"` in project config returns zero install entries.
**How to avoid:** Use Reka UI's `DialogRoot`/`DialogContent` which ship their own focus trap. `ImageLightbox.vue` is the in-repo pattern. Alternative: add `focus-trap: ^7` to catalog, but this is extra surface area for no benefit.
**Warning signs:** "useFocusTrap is not a function", overlay doesn't contain `Tab`, shortcuts leak through to `useMoshpitSpacePan`.
[VERIFIED: `grep '"focus-trap"' package.json pnpm-workspace.yaml` returns nothing 2026-04-22]

### Pitfall 2: `moshpitThumbStore.getUrl(hash)` — NOT `getObjectUrl`

**What goes wrong:** CONTEXT.md D-24 says `getObjectUrl(hash)`; the actual method is `getUrl(hash)`. Calling `getObjectUrl` throws `TypeError: thumbStore.getObjectUrl is not a function`.
**Why it happens:** Memory drift in the context doc.
**How to avoid:** Grep `moshpitThumbStore.ts` before writing the asset-frame component; use the verified `getUrl` / `has` / `addThumb` / `reset` API.
**Warning signs:** `tsc` error "Property 'getObjectUrl' does not exist on type 'Store<…>'".
[VERIFIED: `src/platform/moshpit/stores/moshpitThumbStore.ts` — `getUrl(contentHash: string): string | undefined`]

### Pitfall 3: `Space` key conflict with `useMoshpitSpacePan`

**What goes wrong:** `useMoshpitSpacePan` uses `useMagicKeys().space` to swap pixi-viewport drag mouse buttons. While tournament overlay is mounted, `useMagicKeys` still fires its reactive watch — flipping viewport config even though canvas is inert.
**Why it happens:** `useMagicKeys` is global; it doesn't respect DOM event propagation. Even if our overlay consumes the keydown, MagicKeys is watching the raw `keydown`/`keyup` at window scope via its own listener.
**How to avoid:** Acceptable side-effect — pixi-viewport config change is a no-op while overlay eats pointer events. Verify in HUMAN-UAT scenario #4: "Press `Space` in flip mode; confirm no pan occurs on canvas underneath." Alternative: add a top-level conditional in `useMoshpitSpacePan` to early-return when `tournamentStore.isActive`, but this couples the composable to the store and is unnecessary if verification passes.
**Warning signs:** Canvas shifts behind tournament overlay when user presses `Space`.

### Pitfall 4: Husky pre-commit hook surfaces pre-existing typecheck errors on every commit

**What goes wrong:** `lint-staged` runs `pnpm typecheck` globally; Phase 4 noted pre-existing errors in `useMinimap.test.ts` + `thumbRepository.ts`. Plan 04-03 resolved these inline but new unrelated failures may appear.
**Why it happens:** Global typecheck surfaces everything, not just staged changes.
**How to avoid:** `pnpm typecheck` BEFORE the first TDD commit; if errors exist, file them in `deferred-items.md` — commits still land because lint-staged's "revert staging" only affects the index, not the commit.
**Warning signs:** `husky pre-commit` output shows unrelated TS errors; commit prompt hangs.

### Pitfall 5: `browser_tests/` tsconfig mismatch blocks `@moshpit` Playwright commits

**What goes wrong:** `pnpm typecheck:browser` fails on `moshpit` branch — `useGlobalLitegraph.ts` + `moshpit-shell.spec.ts` `@ts-expect-error` directives disagree between `tsconfig.json` (requires) and `browser_tests/tsconfig.json` (flags unused). Committing files under `browser_tests/` trips `lint-staged` into running `typecheck:browser`.
**Why it happens:** Phase 4 deferred-items flagged this; status may still be broken on Phase 5 entry.
**How to avoid:** Run `pnpm typecheck:browser` on main before committing any E2E. If still broken, carry the Phase 4 D-21 carve-out forward into Phase 5's `deferred-items.md` and ship without the E2E — HUMAN-UAT + Vitest cover the acceptance surface.
**Warning signs:** Husky pre-commit fails ONLY when Playwright spec is staged.
[VERIFIED: `.planning/phases/04-lineage-groupings-within-cluster-sort/deferred-items.md` — status unresolved on Phase 4 close]

### Pitfall 6: Non-power-of-2 single-elim handling ambiguity

**What goes wrong:** D-01 says "byes to first `(nextPow2(N) - N)` seeds". For `N=10`, that's 6 byes — most of round 1 is byes, feels asymmetric.
**Why it happens:** First-seed byes is the standard sports-bracket convention but can look wrong to UI users.
**How to avoid:** Keep D-01 as written (first-seen order); if dogfood surfaces asymmetry complaints, alternative is distributing byes evenly (every `⌈N / byes⌉`-th seed). Document the choice in a code comment and make the threshold `8` + bye-strategy a top-of-file constant.
**Warning signs:** UAT scenario #8 (10+ asset single-elim) feels "off" to the pilot user.

### Pitfall 7: Peek panel width crushes canvas at 1280px laptop widths

**What goes wrong:** `w-96` (24rem ≈ 384px) panel shrinks a two-pane side-by-side to ~448px each on a 1280px viewport — portraits look cramped.
**Why it happens:** Fixed panel width, no breakpoint rule.
**How to avoid:** Option A: Tailwind breakpoint `w-80 lg:w-96 xl:w-[28rem]`. Option B: Collapse peek to full-screen overlay below a breakpoint (desktop-first posture means this is acceptable). Confirm against Comfy Design Standards Figma for the peek-panel design token if one exists.
**Warning signs:** UAT scenario #6 qualitative note "peek felt cramped at lower resolution".

### Pitfall 8: Winner-set replaces selection mid-animation

**What goes wrong:** `tournamentStore.exit('complete')` calls `selectionStore.setSelection(winnerSet)` while the tournament overlay is still animating out — Pixi canvas selection ring pops visually before overlay fades.
**Why it happens:** Selection mutation and overlay unmount happen in the same synchronous tick.
**How to avoid:** Either (a) apply selection BEFORE unmount so user sees the winner set "through" the fading overlay, or (b) defer `setSelection` via `nextTick` after overlay unmounts. D-08 doesn't specify; pick one and document. No perf impact — just UX polish.

### Pitfall 9: `defineStore` name collision with test pollution

**What goes wrong:** Vitest doesn't reset Pinia state between tests; `tournamentStore` state from test A leaks into test B.
**Why it happens:** Default Pinia behaviour in `happy-dom` environment.
**How to avoid:** Follow Phase 3/4 pattern — instantiate a fresh `createPinia()` in test `beforeEach`, or use `@pinia/testing` `createTestingPinia({ stubActions: false })`. `moshpitSelectionStore.test.ts` is the reference.

## Runtime State Inventory

Not applicable — Phase 5 is greenfield feature delivery, not rename/refactor/migration. No renamed strings, no stored-data impact.

## Environment Availability

| Dependency         | Required By              | Available | Version                      | Fallback                                                  |
| ------------------ | ------------------------ | --------- | ---------------------------- | --------------------------------------------------------- |
| Node               | Build + typecheck        | ✓         | 24.x (pinned in `.nvmrc`)    | —                                                         |
| pnpm               | Install + scripts        | ✓         | 10.x                         | —                                                         |
| Vue                | Runtime                  | ✓         | ^3.5.13                      | —                                                         |
| Pinia              | Store                    | ✓         | ^3.0.4                       | —                                                         |
| `@vueuse/core`     | `useEventListener`       | ✓         | ^14.2.0                      | —                                                         |
| `reka-ui`          | `DialogRoot`             | ✓         | ^2.5.0                       | —                                                         |
| `fast-check`       | Property tests           | ✓         | ^4.5.3                       | —                                                         |
| `vitest`           | Unit tests               | ✓         | ^4.0.16                      | —                                                         |
| `@playwright/test` | E2E                      | ✓         | ^1.58.1                      | Skip E2E if tsconfig:browser blocker persists (Pitfall 5) |
| `focus-trap`       | —                        | **✗**     | —                            | **Use Reka `DialogRoot` (Pitfall 1)**                     |
| ComfyUI backend    | `/view` URL for full-res | ✓         | conda env `comfyui` on :8188 | —                                                         |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** `focus-trap` (use Reka); `typecheck:browser` blocker (defer E2E).

## Validation Architecture

### Test Framework

| Property           | Value                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| Framework          | Vitest `^4.0.16` (unit) + Playwright `^1.58.1` (E2E)                              |
| Config file        | `vite.config.mts` (vitest block), `playwright.config.ts`                          |
| Quick run command  | `pnpm test:unit -- --run src/platform/moshpit/services/tournamentBracket.test.ts` |
| Full suite command | `pnpm test:unit && pnpm lint && pnpm typecheck`                                   |

### Phase Requirements → Test Map

| Req ID    | Behavior                                                                      | Test Type                | Automated Command                                                                           | File Exists? |
| --------- | ----------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- | ------------ |
| TOUR-01   | Enter with ≥2 selected activates store + mounts overlay                       | unit + E2E               | `pnpm test:unit -- moshpitTournamentStore.test` + `pnpm test:browser:local --grep @moshpit` | ❌ Wave 0    |
| TOUR-01   | Enter with <2 selected fires toast                                            | unit                     | `pnpm test:unit -- MoshpitTournamentOverlay.test` (or view-level)                           | ❌ Wave 0    |
| TOUR-02   | `[`/`]` cycles `sideBySide → overlap → flip → sideBySide`                     | unit (store) + component | `pnpm test:unit -- moshpitTournamentStore.test`                                             | ❌ Wave 0    |
| TOUR-03   | `←` records win for A; `→` for B; `↓` records skip                            | unit                     | `pnpm test:unit -- useMoshpitTournamentKeybindings.test`                                    | ❌ Wave 0    |
| TOUR-04   | `Space` toggles `flipShowsB` in any mode                                      | unit (store) + component | `pnpm test:unit -- MoshpitTournamentPair.test`                                              | ❌ Wave 0    |
| TOUR-05   | No IDB writes; store reset on `exit()`                                        | unit                     | `pnpm test:unit -- moshpitTournamentStore.test`                                             | ❌ Wave 0    |
| TOUR-06   | `exit('complete')` with ≥1 win calls `selectionStore.setSelection(winnerSet)` | unit                     | `pnpm test:unit -- moshpitTournamentStore.test`                                             | ❌ Wave 0    |
| TOUR-06   | Round-robin winner set = top-3 with ties                                      | unit + fast-check        | `pnpm test:unit -- tournamentBracket.test`                                                  | ❌ Wave 0    |
| TOUR-06   | Single-elim winner set = champion (1 element)                                 | unit + fast-check        | `pnpm test:unit -- tournamentBracket.test`                                                  | ❌ Wave 0    |
| TOUR-07   | `Esc` with 0 picks preserves selection + toast                                | unit + E2E               | `pnpm test:unit` + Playwright                                                               | ❌ Wave 0    |
| TOUR-07   | `Esc` with ≥1 pick applies winner-set-so-far                                  | unit                     | `pnpm test:unit -- moshpitTournamentStore.test`                                             | ❌ Wave 0    |
| TOUR-08   | `enter()` kicks off `Image()` preload per full-res URL                        | unit                     | `pnpm test:unit -- moshpitTournamentStore.test` (mock `getAssetUrl`)                        | ❌ Wave 0    |
| PEEK-01   | Peek hidden by default                                                        | unit                     | `pnpm test:unit -- MoshpitTournamentOverlay.test`                                           | ❌ Wave 0    |
| PEEK-02   | `M` toggles peek; matching rows plain; differing rows highlighted             | unit                     | `pnpm test:unit -- metadataDiff.test` + `MoshpitMetadataPeekPanel.test`                     | ❌ Wave 0    |
| PEEK-03   | LoRA diff name-based, permutation-invariant                                   | fast-check               | `pnpm test:unit -- metadataDiff.test`                                                       | ❌ Wave 0    |
| HUMAN-UAT | "Is tournament faster than scrolling?" qualitative binary                     | manual                   | `05-HUMAN-UAT.md` scenarios 1–11                                                            | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm test:unit -- --run <file>` for the touched module.
- **Per wave merge:** `pnpm test:unit && pnpm lint && pnpm typecheck && pnpm knip`.
- **Phase gate:** Full suite green + HUMAN-UAT signed off before `/gsd-verify-work`. Playwright `@moshpit` spec green IF tsconfig:browser blocker resolved.

### Wave 0 Gaps

- [ ] `src/platform/moshpit/services/tournamentBracket.test.ts` — covers TOUR-02/06/07, D-01..D-09
- [ ] `src/platform/moshpit/services/metadataDiff.test.ts` — covers PEEK-02/03, D-21
- [ ] `src/platform/moshpit/stores/moshpitTournamentStore.test.ts` — covers TOUR-01/03/04/05/06/07/08, D-12
- [ ] `src/platform/moshpit/composables/useMoshpitTournamentKeybindings.test.ts` — covers TOUR-03/04, D-13
- [ ] `src/platform/moshpit/components/MoshpitTournamentOverlay.test.ts` — covers TOUR-02 mounting, PEEK-01
- [ ] `src/platform/moshpit/components/MoshpitTournamentPair.test.ts` — covers TOUR-02/04, D-15..D-18
- [ ] `src/platform/moshpit/components/MoshpitTournamentAssetFrame.test.ts` — covers TOUR-08/D-24 loading fallback
- [ ] `src/platform/moshpit/components/MoshpitMetadataPeekPanel.test.ts` — covers PEEK-01/02
- [ ] `.planning/phases/05-*/05-HUMAN-UAT.md` — qualitative sign-off per D-25
- [ ] Framework install: none — all deps already present.

## Security Domain

| ASVS Category         | Applies | Standard Control                                                                   |
| --------------------- | ------- | ---------------------------------------------------------------------------------- |
| V2 Authentication     | no      | Handled project-wide by `authStore`; tournament is in-frontend                     |
| V3 Session Management | no      | N/A                                                                                |
| V4 Access Control     | no      | Tournament operates on already-loaded assets                                       |
| V5 Input Validation   | yes     | `NormalizedParams` already validated via Zod schema upstream; no new input surface |
| V6 Cryptography       | no      | No secret access                                                                   |
| V13 API & Web Service | no      | `getAssetUrl` → existing authenticated ComfyUI API; no new endpoints               |
| V14 Configuration     | no      | No new env vars, feature flags, or build inputs                                    |

### Known Threat Patterns for Vue 3 + Pixi + reka-ui

| Pattern                                          | STRIDE        | Standard Mitigation                                                                                                                                                                                                                              |
| ------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| XSS via asset metadata prompt text in peek panel | Tampering     | Use Vue text interpolation (`{{ value }}`) — never `v-html`. Prompt strings from `NormalizedParams.positivePrompt` render as plain text. If rich rendering ever added, route through `DOMPurify.sanitize()` (already in project).                |
| Focus-trap escape via `Tab` cycling              | Elevation     | Rely on Reka `DialogRoot` — shipped focus trap tested upstream                                                                                                                                                                                   |
| Object-URL leak on overlay unmount               | DoS (memory)  | Thumb store owns URL lifecycle (`addThumb` revokes on replace); full-res `Image()` preloads use `img.src` assignment — browser GC handles dereference. Crossfade sprite uses direct `getAssetUrl` URL, not object URL — no manual revoke needed. |
| Unbounded parallel preload on large selection    | DoS (network) | Typical selection ≤32; cap at 8 concurrent via a tiny promise queue if dogfood reveals saturation (D-23 Claude's Discretion).                                                                                                                    |

## Code Examples

### Bracket generation (round-robin)

```typescript
// Source: derives from Phase 3 sortMath.ts + groupAxes.ts pure-module pattern
export function generateRoundRobin(
  hashes: readonly string[]
): readonly TournamentPair[] {
  const n = hashes.length
  const pairs: TournamentPair[] = []
  const total = (n * (n - 1)) / 2
  let index = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push({
        seedA: i,
        seedB: j,
        assetHashA: hashes[i],
        assetHashB: hashes[j],
        index: index++,
        total
      })
    }
  }
  return pairs
}
```

### LoRA diff (name-based, order-insensitive)

```typescript
// Source: pattern from Phase 4 groupAxes.ts (pure, typed)
import { sortBy } from 'es-toolkit'

export type LoraDiffState = 'match' | 'weightChanged' | 'added' | 'removed'

export interface LoraDiffEntry {
  readonly name: string
  readonly state: LoraDiffState
  readonly weightA: number | null
  readonly weightB: number | null
}

export function diffLoras(
  a: readonly { name: string; weight: number }[],
  b: readonly { name: string; weight: number }[]
): readonly LoraDiffEntry[] {
  const byNameA = new Map(a.map((l) => [l.name, l.weight]))
  const byNameB = new Map(b.map((l) => [l.name, l.weight]))
  const names = new Set([...byNameA.keys(), ...byNameB.keys()])
  const rows: LoraDiffEntry[] = []
  for (const name of names) {
    const wa = byNameA.get(name) ?? null
    const wb = byNameB.get(name) ?? null
    const state: LoraDiffState =
      wa !== null && wb !== null
        ? wa === wb
          ? 'match'
          : 'weightChanged'
        : wa !== null
          ? 'removed'
          : 'added'
    rows.push({ name, state, weightA: wa, weightB: wb })
  }
  return sortBy(rows, ['state', 'name'])
}
```

### fast-check property test (LoRA diff permutation-invariance)

```typescript
// Source: pattern from src/platform/moshpit/services/groupAxes.test.ts
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { diffLoras } from './metadataDiff'

describe('diffLoras', () => {
  it('is order-insensitive on both inputs (permutation-invariant)', () => {
    const loraArb = fc.array(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 8 }),
        weight: fc.float({ noNaN: true })
      }),
      { minLength: 0, maxLength: 8 }
    )
    fc.assert(
      fc.property(loraArb, loraArb, (a, b) => {
        const shuffledA = fc.sample(
          fc.shuffledSubarray(a, { minLength: a.length, maxLength: a.length }),
          1
        )[0]
        const shuffledB = fc.sample(
          fc.shuffledSubarray(b, { minLength: b.length, maxLength: b.length }),
          1
        )[0]
        const left = diffLoras(a, b)
        const right = diffLoras(shuffledA, shuffledB)
        expect(left).toEqual(right)
      })
    )
  })
})
```

### Tournament entry gate on `MoshpitView.vue`

```vue
<!-- Source: EXTEND existing MoshpitView.vue (verified in repo) -->
<template>
  <div
    id="moshpit-canvas-container"
    ref="containerEl"
    tabindex="0"
    class="relative size-full overflow-hidden outline-none"
    @pointerdown="onContainerPointerDown"
    @keydown="onContainerKeydown"
  >
    <MoshpitCanvas v-if="containerEl" :container-el="containerEl" />
    <MoshpitClusterOverlay />
    <MoshpitEmptyGateOverlay />
    <MoshpitMarqueeOverlay
      :is-dragging="marquee.isDragging.value"
      :overlay-style="marquee.overlayStyle.value"
    />
    <MoshpitTournamentOverlay />
    <!-- NEW -->
  </div>
</template>

<script setup lang="ts">
// … existing imports …
import MoshpitTournamentOverlay from '@/platform/moshpit/components/MoshpitTournamentOverlay.vue'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useI18n } from 'vue-i18n'

const tournamentStore = useMoshpitTournamentStore()
const selectionStore = useMoshpitSelectionStore()
const toastStore = useToastStore()
const { t } = useI18n()

function onContainerKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter') return
  if (tournamentStore.isActive) return
  if (selectionStore.size < 2) {
    toastStore.add({
      severity: 'info',
      summary: t('moshpit.tournament.needTwoToastSummary'),
      detail: t('moshpit.tournament.needTwoToastDetail')
    })
    return
  }
  tournamentStore.enter(selectionStore.selected)
  e.preventDefault()
}
</script>
```

## State of the Art

| Old Approach                                               | Current Approach                                           | When Changed                                             | Impact                                                                         |
| ---------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| PrimeVue `Dialog` for overlays                             | Reka UI `DialogRoot` / `DialogContent` + Tailwind          | AGENTS.md #12 — "Avoid new usage of PrimeVue components" | Smaller bundle, no CSS override battles, matches `ImageLightbox.vue` precedent |
| Global `useMagicKeys` for modal shortcuts                  | Scoped `useEventListener` on overlay root                  | Phase 1 Moshpit convention                               | Events gated by DOM bubbling; canvas shortcuts naturally suppressed            |
| Runtime props declaration (`const props = defineProps(…)`) | Destructured `const { foo, bar = 0 } = defineProps<{…}>()` | Vue 3.5+                                                 | Simpler syntax; `withDefaults` banned project-wide                             |
| `dark:` Tailwind variant                                   | Semantic tokens (`bg-background`, `text-muted-foreground`) | Project rule                                             | `vue/no-restricted-class: ['error', '/^dark(-theme)?:/']` enforces             |
| `:class="[]"` for class merging                            | `cn()` helper from `@/utils/tailwindUtil`                  | Project rule                                             | Stable ordering; Tailwind merge semantics                                      |
| Inline hex colours                                         | Semantic design tokens (Comfy Design Standards Figma)      | Project rule                                             | Maintained contrast + dark-mode support                                        |
| `import { t }` in `.vue`                                   | `const { t } = useI18n()` in `.vue`                        | ESLint rule                                              | Reactive locale; consistent pattern                                            |

**Deprecated/outdated (do NOT use):**

- `withDefaults(defineProps(), { … })` — use Vue 3.5 destructured defaults instead.
- Inline `{ type: Foo }` mixed imports — ESLint forces `import type` separate.
- `primevue/calendar` / `dropdown` / `overlaypanel` / `sidebar` / `inputswitch` — auto-replaced by `datepicker` / `select` / etc., but project rule is "no new PrimeVue at all".
- `useFocusTrap` from `@vueuse/integrations` — unavailable without `focus-trap` peer dep (Pitfall 1).

## Assumptions Log

| #   | Claim                                                                                          | Section                     | Risk if Wrong                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Reka `DialogRoot` focus trap is sufficient for tournament mode; tested upstream                | Pattern 3 / Don't Hand-Roll | LOW — `ImageLightbox.vue` is in-repo precedent with same shape. If focus leaks, fall back to plain `tabindex` + manual focus management on mount.                             |
| A2  | `useMagicKeys` firing while tournament overlay is active causes no visible regression          | Pitfall 3                   | MEDIUM — if user sees canvas shift on `Space` even once, pay down: add `if (!tournamentStore.isActive)` early return in `useMoshpitSpacePan`. Verify in HUMAN-UAT scenario 4. |
| A3  | Single-elim bye strategy "first-seen seeds get byes" reads naturally to users                  | D-01 / Pitfall 6            | LOW — first-seen is sports-bracket convention. If dogfood surfaces asymmetry, switch to even distribution via one-line change.                                                |
| A4  | `w-96` peek panel width works on the narrowest expected desktop viewport                       | D-20 / Pitfall 7            | LOW-MEDIUM — desktop-first posture accepts 1280px+. UAT scenario 6 should probe.                                                                                              |
| A5  | Parallel `Image()` preload of up to 32 full-res URLs does not saturate browser connection pool | D-23                        | LOW — typical tournaments ≤32; modern browsers handle 6 concurrent per-origin. Cap at 8 if needed.                                                                            |
| A6  | Tailwind `transition-[transform] duration-200 ease-out` is the right primitive for peek slide  | Pattern 1 / Don't Hand-Roll | LOW — matches `MoshpitProcessingIndicator.vue`. Substitute Tailwind `transition-all` if layout transitions are lumpy.                                                         |
| A7  | Full-res crossfade is desired when thumb→full-res swaps                                        | D-24                        | LOW — purely cosmetic; if removed, behaviour still meets TOUR-08 literal. Planner may skip.                                                                                   |
| A8  | Winner-set visual treatment (pulse on selection) not required for acceptance                   | D-25 Claude's Discretion    | LOW — explicitly marked discretionary.                                                                                                                                        |

## Open Questions (RESOLVED)

1. **Should `exit('complete')` apply `setSelection` before or after overlay unmounts?**
   - What we know: D-08 only specifies the mutation happens on exit. Timing is not specified.
   - What's unclear: Pre-unmount = user sees winner highlight "through" fade; post-unmount = cleaner transition but winner ring pops.
   - **RESOLVED:** Apply `setSelection` BEFORE overlay unmount. This avoids a DOM-unmount race against the selection reactivity graph (computed chains tied to sprite highlighting would otherwise tear briefly). The store's `exit()` mutates selection synchronously, then flips `isActive=false`; Reka `DialogRoot` drives the unmount on `open=false`. Mirrored in Plan 05-03 Task 2 `exit()` action sequence (setSelection → restore sidebar → `isActive.value = false`).

2. **Should `useMoshpitSpacePan` be made tournament-aware?**
   - What we know: Space in tournament mode toggles flip; `useMoshpitSpacePan` watches `useMagicKeys().space` and reconfigures pixi-viewport drag.
   - What's unclear: Whether the reconfigure is visibly disruptive (canvas is inert, but drag mode change might leak via pointer-capture).
   - **RESOLVED:** Leave `useMoshpitSpacePan` alone. The tournament overlay (Reka `DialogPortal` + full-bleed `DialogContent` with `z-50`) captures pointer events, and the scoped keydown composable (Plan 05-03) calls `preventDefault() + stopPropagation()` on Space before it bubbles to any canvas-level listener. The pixi-viewport drag reconfigure is idempotent and not visible while the canvas sits behind a `bg-background/95 backdrop-blur-sm` overlay. Verified by the T-05-06-04 acceptance in Plan 05-06.

3. **Which keys nudge the wipe divider?**
   - What we know: D-16 proposes `,`/`.` / `Shift+,`/`Shift+.` / `/`.
   - What's unclear: Users may struggle to find `,`/`.` on ergonomic keyboards; `-`/`=` / `0` alternative offered.
   - **RESOLVED:** Ship the D-16 default `,`/`.` + `Shift+,`/`Shift+.` + `/` keymap as planned in Plan 05-03 Task 3. Key-chord re-mapping / ergonomic-keyboard polish is deferred to Phase 7 (UX pass). No scope change in Phase 5.

4. **Is there a Moshpit-specific `text-success` / `text-warning` / `text-danger` token in Comfy Design Standards?**
   - What we know: `src/assets/css/style.css` defines semantic tokens.
   - What's unclear: Whether Moshpit diff UI has a dedicated palette or reuses the global one.
   - **RESOLVED:** Use the existing global `text-success` / `text-warning` / `text-danger` tokens from `packages/design-system/src/css/style.css`. Canvas-specific peek tokens (if designers decide they are wanted) are deferred. Plan 05-05 Task 1 references these tokens directly for the LoRA diff states per D-21.

5. **Does `useMoshpitProcessingQueue` preload block canvas on entry?**
   - What we know: Phase 2 processing queue owns workers; tournament preload is a separate `Image()` path.
   - What's unclear: Whether in-flight thumb worker fetches slow the full-res burst.
   - **RESOLVED:** Accepted — non-blocking. Tournament preload is bounded by the canvas selection size (typically ≤32 per D-23), well below the browser per-origin connection cap (6). The preload path is pure `new Image(); img.src = url` (fire-and-forget, no worker coupling) and does not compete with the Pixi thumb processing queue which is served from IDB. If dogfood surfaces saturation, apply the 8-concurrent cap noted in Plan 05-03 T-05-03-05 disposition. No architectural change required for Phase 5.

## Sources

### Primary (HIGH confidence)

- **`src/views/MoshpitView.vue`** — Verified overlay sibling pattern, `tabindex=0` + `focus()` pointerdown, `shallowRef(viewport)` + `provide(MOSHPIT_VIEWPORT_INJECTION_KEY)` pattern. [VERIFIED: direct read 2026-04-22]
- **`src/platform/moshpit/stores/moshpitSelectionStore.ts`** — Verified `selected` (computed array), `size`, `setSelection(ids)`, `clear()`. [VERIFIED]
- **`src/platform/moshpit/stores/moshpitSidebarStore.ts`** — Verified `activePanelId`, `isPanelOpen`, `closePanel()`, `openPanel(id)`, `hasHadFirstInteraction`. [VERIFIED]
- **`src/platform/moshpit/stores/moshpitThumbStore.ts`** — **CORRECTION: method is `getUrl(hash)`, NOT `getObjectUrl(hash)` as CONTEXT.md states.** [VERIFIED — Pitfall 2]
- **`src/platform/moshpit/composables/useMoshpitSpacePan.ts`** — Verified scoped keydown + `useMagicKeys` + `onBeforeUnmount` pattern. [VERIFIED]
- **`src/platform/moshpit/components/MoshpitClusterOverlay.vue`** — Verified HTML-over-Pixi overlay + `pointer-events-none` outer + `pointer-events-auto` interactive child + `transformTick` pattern for viewport-reactive styling. [VERIFIED]
- **`src/platform/moshpit/components/MoshpitEmptyGateOverlay.vue`** — Verified `v-if` conditional overlay pattern. [VERIFIED]
- **`src/platform/moshpit/services/paramNormalize.ts`** — Verified `NormalizedParams` + Zod schema + LoRA `{ name, weight }` shape. [VERIFIED]
- **`src/platform/moshpit/services/filterTypes.ts`** — Verified `ParamKey` union, useful for peek row labels. [VERIFIED]
- **`src/platform/moshpit/services/clusterLayout.test.ts`** + **`groupAxes.test.ts`** — Verified fast-check property-test pattern to mimic. [VERIFIED]
- **`src/platform/assets/utils/assetUrlUtil.ts`** — Verified `getAssetUrl(asset, 'output'): string` API, handles subfolder + type + URL encoding. [VERIFIED]
- **`src/platform/updates/common/toastStore.ts`** — Verified `useToastStore().add({ severity, summary, detail })` API. [VERIFIED]
- **`src/components/common/ImageLightbox.vue`** — Verified Reka `DialogRoot` / `DialogContent` / `DialogOverlay` / `DialogPortal` / `@escape-key-down` pattern. [VERIFIED]
- **`package.json` + `pnpm-workspace.yaml`** — Verified `focus-trap` is NOT installed; `@vueuse/integrations` has it as optional peer only. [VERIFIED — Pitfall 1]
- **`.planning/phases/04-lineage-groupings-within-cluster-sort/deferred-items.md`** — Verified `typecheck:browser` tsconfig mismatch deferred; may block Phase 5 E2E commit. [VERIFIED — Pitfall 5]
- **`src/locales/en/main.json`** — Verified `moshpit.*` i18n namespace structure; `moshpit.tournament.*` + `moshpit.peek.*` are greenfield additions. [VERIFIED]

### Secondary (MEDIUM confidence)

- **Reka UI Dialog** — Pattern inferred from `ImageLightbox.vue` usage + official convention; not library-doc-verified this session. Confidence MEDIUM for peripheral behaviour (close-on-outside-click, `modal` prop defaults). Recommendation: planner confirms via Reka docs if deep behaviour (e.g., `modal={false}` for canvas-click pass-through) is required.

### Tertiary (LOW confidence)

- **Tailwind 4 `clip-path` utility availability.** D-16 overlay wipe uses `clip-path: inset(0 X% 0 0)`. Tailwind 4 may not ship `clip-*` utilities; may need inline `style="clip-path: …"` or `@utility` block. Planner verifies during implementation.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all versions verified in `pnpm-workspace.yaml`.
- Architecture: HIGH — patterns mirror existing Moshpit composables, stores, and overlays directly verified in repo.
- Pitfalls: HIGH — each pitfall grounded in a direct file read or `grep` output captured in session.
- Testing surface: HIGH — fast-check + Vitest pattern directly mirrors shipped Phase 4 tests.
- Environment: HIGH — all deps present; one deferred E2E blocker carried forward from Phase 4.

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days — stack is stable, Phase 4 just shipped)
