---
phase: 260423-led
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/platform/moshpit/composables/useMoshpitSpriteActions.ts
  - src/platform/moshpit/composables/useMoshpitSpriteActions.test.ts
  - src/platform/moshpit/components/MoshpitSpriteContextMenu.vue
  - src/platform/moshpit/components/MoshpitSpriteContextMenu.test.ts
  - src/platform/moshpit/components/MoshpitFloatingActionBar.vue
  - src/platform/moshpit/components/MoshpitFloatingActionBar.test.ts
  - src/views/MoshpitView.vue
  - src/locales/en/main.json
autonomous: true
requirements:
  - 260423-led — Moshpit floating action bar (selection-driven bulk actions)

must_haves:
  truths:
    - 'When selection is empty, the floating action bar is NOT rendered.'
    - 'When selection has >=1 item, the floating action bar renders pinned to the bottom-center of the Moshpit canvas container with a count badge.'
    - 'Clicking Clear empties the selection (bar disappears on same tick).'
    - 'Clicking Download on a non-empty selection triggers one browser download per resolvable hash and surfaces a toast summary.'
    - 'Clicking Unpin removes pinned overrides for every hash in the selection that is currently pinned; the button is disabled when none of the selected hashes are pinned.'
    - 'The context menu (260423-kx4) and the action bar invoke the same action implementations (single source of truth) — no duplicated download/unpin/select-similar logic.'
    - 'The action bar is not rendered during tournament mode.'
  artifacts:
    - path: 'src/platform/moshpit/composables/useMoshpitSpriteActions.ts'
      provides: 'Shared action helpers (downloadMany, unpinMany, pinHereMany, selectSimilar, resetAllPins) consumed by both the context menu and the floating action bar.'
    - path: 'src/platform/moshpit/composables/useMoshpitSpriteActions.test.ts'
      provides: 'Behavioural coverage for each action helper (unpin, download, pin-here, reset-all, select-similar).'
    - path: 'src/platform/moshpit/components/MoshpitFloatingActionBar.vue'
      provides: 'Overlay DOM component that renders count badge + Unpin/Download/Clear buttons when selectionStore.size > 0.'
    - path: 'src/platform/moshpit/components/MoshpitFloatingActionBar.test.ts'
      provides: 'Behavioural tests for visibility, Unpin-disabled derivation, Clear behaviour, Download invocation.'
    - path: 'src/locales/en/main.json'
      contains: 'moshpit.actionBar.*'
  key_links:
    - from: 'src/platform/moshpit/components/MoshpitSpriteContextMenu.vue'
      to: 'src/platform/moshpit/composables/useMoshpitSpriteActions.ts'
      via: 'import + call'
      pattern: "useMoshpitSpriteActions\\("
    - from: 'src/platform/moshpit/components/MoshpitFloatingActionBar.vue'
      to: 'src/platform/moshpit/composables/useMoshpitSpriteActions.ts'
      via: 'import + call'
      pattern: "useMoshpitSpriteActions\\("
    - from: 'src/views/MoshpitView.vue'
      to: 'src/platform/moshpit/components/MoshpitFloatingActionBar.vue'
      via: 'sibling overlay mount next to MoshpitMarqueeOverlay'
      pattern: '<MoshpitFloatingActionBar'
---

<objective>
Ship the Moshpit floating action bar: a DOM overlay pinned to the bottom-center of the canvas container that appears when `selectionStore.size > 0`, offering Unpin / Download / Clear on the current selection. Along the way, extract the per-item action logic already inlined inside `MoshpitSpriteContextMenu.vue` (260423-kx4) into a reusable composable `useMoshpitSpriteActions` so both surfaces call the same tested functions.

Purpose: The context menu and the floating action bar operate on the same conceptual "sprite action" vocabulary (download, unpin, pin-here, select-similar). Duplicating that logic across two components will drift within a phase; centralising it now is a DRY fix where the need has materialised (not premature).

Output: One new composable (+ test), one new overlay component (+ test), a refactor of the existing context menu to consume the composable, a wiring line in `MoshpitView.vue`, and four new i18n keys under `moshpit.actionBar.*`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260423-kx4-moshpit-sprite-context-menu-right-click-/260423-kx4-SUMMARY.md
@src/platform/moshpit/components/MoshpitSpriteContextMenu.vue
@src/platform/moshpit/stores/moshpitOverrideStore.ts
@src/platform/moshpit/stores/moshpitSelectionStore.ts
@src/platform/moshpit/stores/moshpitMetadataStore.ts
@src/views/MoshpitView.vue
@src/platform/moshpit/components/MoshpitMarqueeOverlay.vue

<interfaces>
<!-- Key contracts the executor needs up front. Do not hunt through the codebase for these. -->

From src/platform/moshpit/stores/moshpitSelectionStore.ts:

```typescript
export const useMoshpitSelectionStore: StoreDefinition<
  'moshpitSelection',
  {
    selected: ComputedRef<string[]> // array copy of selection, stable read API
    size: ComputedRef<number>
    isSelected(id: string): boolean
    setSelection(ids: readonly string[]): void
    clear(): void
    // ...add/remove/toggle/selectAll/addMany
  }
>
```

From src/platform/moshpit/stores/moshpitOverrideStore.ts:

```typescript
export interface OverrideRecord {
  readonly pinnedWorldPos?: { x: number; y: number }
  readonly scale?: number
  readonly pinnedAt: number
}
export const useMoshpitOverrideStore: StoreDefinition<
  'moshpitOverride',
  {
    size: ComputedRef<number>
    isPinned(hash: string): boolean
    setPin(hash: string, worldPos: { x: number; y: number }): void
    unpin(hash: string): void
    clearAll(): void
    // ...get/setScale/clearScale/clear/reset
  }
>
```

From src/platform/moshpit/composables/useMoshpitViewportInjection.ts:

```typescript
// SpriteHitTester exposes getSpriteWorldPos(hash) → { x, y } | null, added in 260423-kx4.
export const MOSHPIT_SPRITE_HITTEST_INJECTION_KEY: InjectionKey<
  ShallowRef<SpriteHitTester | null>
>
export interface SpriteHitTester {
  hitTestPoint(x: number, y: number): string | null
  hitTestRect(rect: {
    left: number
    top: number
    right: number
    bottom: number
  }): string[]
  getSpriteWorldPos(hash: string): { x: number; y: number } | null
}
```

From src/platform/moshpit/stores/moshpitMetadataStore.ts:

```typescript
// getParams(hash) → NormalizedParams | undefined (NormalizedParams.workflowFilename is the match key for Select similar).
// paramsByHash is a ComputedRef<Map<string, NormalizedParams>> — iterate with .paramsByHash.value or .paramsByHash depending on caller (Pinia unwraps).
```

From src/stores/assetsStore.ts:

```typescript
// historyAssets: AssetItem[] — iterate to build hash → AssetItem map for download (mirror MoshpitSpriteContextMenu.buildHashToAssetMap).
```

From src/platform/assets/utils/assetUrlUtil.ts:

```typescript
export function getAssetUrl(asset: AssetItem): string // /view?filename=... URL
```

From src/platform/updates/common/toastStore.ts:

```typescript
// toastStore.add({ severity: 'info' | 'success' | 'warn' | 'error', summary: string, detail?: string })
```

From src/platform/moshpit/stores/moshpitTournamentStore.ts:

```typescript
// isActive: boolean — true while tournament overlay is mounted; action bar must NOT render while isActive.
```

</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract shared sprite actions composable + refactor context menu</name>
  <files>
    src/platform/moshpit/composables/useMoshpitSpriteActions.ts,
    src/platform/moshpit/composables/useMoshpitSpriteActions.test.ts,
    src/platform/moshpit/components/MoshpitSpriteContextMenu.vue,
    src/platform/moshpit/components/MoshpitSpriteContextMenu.test.ts
  </files>
  <action>
    Create `src/platform/moshpit/composables/useMoshpitSpriteActions.ts` exporting a single `useMoshpitSpriteActions` composable. It must:

    1. Accept a single options argument: `{ getHitTester: () => SpriteHitTester | null }`. This keeps the composable stateless; `MoshpitView.vue` already has the hit-test ref and can pass a getter. The composable MUST NOT inject the hit-test key itself — the context menu does (historically) but the floating bar lives at the same level and we want one shared code path. Passing a getter avoids double-injection bugs.

    2. Internally call `useMoshpitOverrideStore()`, `useMoshpitSelectionStore()`, `useMoshpitMetadataStore()`, `useAssetsStore()`, `useToastStore()`, `useI18n()`. No `inject` calls.

    3. Return the following function declarations (use `function foo()` not `const foo = () =>` per AGENTS #24):
       - `downloadMany(hashes: readonly string[]): void` — lift bytes from the context menu's current `buildHashToAssetMap` + `triggerDownload` + toast emission (severity `info`, keys `moshpit.contextMenu.downloadStarted` / `moshpit.contextMenu.downloadStartedMulti`). Keep the i18n keys under `moshpit.contextMenu.*` — they are still correct, the UX copy is shared; do not duplicate them under `moshpit.actionBar.*`.
       - `unpinMany(hashes: readonly string[]): void` — `overrideStore.unpin(hash)` for each. No toast.
       - `pinHereMany(hashes: readonly string[]): void` — for each hash, skip if already pinned, else resolve world-pos via `getHitTester()?.getSpriteWorldPos(hash)` (if the tester is null, log `console.warn('[moshpit] pinHereMany: no hit-tester available')` and return). Write via `overrideStore.setPin`.
       - `selectSimilar(hash: string): void` — mirror the context menu's current logic: read `metadataStore.getParams(hash)?.workflowFilename`, iterate `metadataStore.paramsByHash`, collect matches, call `selectionStore.setSelection(matches)`. On no-match, toast `moshpit.contextMenu.selectSimilarNoMatch` / `...selectSimilarNoMatchDetail` and leave selection unchanged.
       - `resetAllPins(): void` — `if (overrideStore.size === 0) return; overrideStore.clearAll()`.

    4. Derived predicates also exported from the composable for consumers that need reactive visibility:
       - `someSelectedArePinned(hashes: readonly string[]): boolean` — pure function (not a `computed`); callers wrap in their own `computed` if they want reactivity. Implementation: `hashes.some((h) => overrideStore.isPinned(h))`.

    5. Types: `SpriteHitTester` imported via `import type` from `'@/platform/moshpit/composables/useMoshpitViewportInjection'`. `AssetItem` via `import type` from `'@/platform/assets/schemas/assetSchema'`.

    6. No `any`, no `as any`, no barrel file. The composable file is a leaf module — no re-exports from other files.

    **Refactor `MoshpitSpriteContextMenu.vue`** to use the composable:
    - Replace the inlined `buildHashToAssetMap`, `triggerDownload`, `onDownload`, `onUnpin`, `onPinHere`, `onSelectSimilar`, `onResetAllPins` implementations with calls into the composable's returned functions.
    - The menu continues to `inject(MOSHPIT_SPRITE_HITTEST_INJECTION_KEY)` to compute `isTargetPinned` and to build a `getHitTester` getter passed into `useMoshpitSpriteActions({ getHitTester: () => spriteHitTestRef?.value ?? null })`.
    - Keep `defineExpose({ open, close, onPinHere, onUnpin, onDownload, onSelectSimilar, onResetAllPins, isResetAllDisabled })` intact — 260423-kx4 tests drive these directly and we must not break them.
    - The `actionSet`-capture-at-open-time semantics must be preserved: the `@select` handlers still call the composable with `actionSet.value` (not the live selection), so a click after selection drift still acts on the captured set.

    **Tests — `useMoshpitSpriteActions.test.ts`** (vitest + happy-dom, mirror the Pinia/mount patterns in `MoshpitSpriteContextMenu.test.ts`):
    - Arrange: fresh `setActivePinia(createPinia())`, seed `metadataStore.setParams`, `assetsStore.historyAssets` (cast via typed helper if needed — DO NOT use `as any`; prefer casting through a minimal `AssetItem` literal with the fields `id`, `asset_hash`, `name`, plus required schema fields — inspect `assetSchema.ts` to build a minimal valid literal).
    - Tests (one describe block per function):
      - `unpinMany` calls `overrideStore.unpin` for each provided hash (assert via reading `isPinned` before+after, seeded with `setPin`).
      - `downloadMany` spies `HTMLAnchorElement.prototype.click` (per the kx4 test pattern) and asserts one click per resolvable hash; toast payload is `downloadStarted` for 1 and `downloadStartedMulti` for >1.
      - `pinHereMany` with a stub `getHitTester` returning a tester whose `getSpriteWorldPos` returns `{ x: 7, y: 9 }` writes `setPin(hash, { x: 7, y: 9 })` (assert via `overrideStore.get(hash)?.pinnedWorldPos`); with `getHitTester` returning null, no writes happen and a `console.warn` spy fired.
      - `pinHereMany` skips already-pinned hashes (seed one pinned, one unpinned; only the unpinned is written).
      - `resetAllPins` is a no-op when `overrideStore.size === 0`; when pins exist it clears them all.
      - `selectSimilar` on a positive match sets the selection to all matching hashes; on no-match (target has no workflowFilename) it toasts and does not mutate selection.
      - `someSelectedArePinned([])` → `false`; with one pinned hash in input → `true`.

    Run: `pnpm test:unit -- src/platform/moshpit/composables/useMoshpitSpriteActions.test.ts` and `pnpm test:unit -- src/platform/moshpit/components/MoshpitSpriteContextMenu.test.ts`. The latter (9 existing tests from 260423-kx4) MUST remain green post-refactor — if any break, fix the refactor, not the tests.

    **Commit:** `refactor(260423-led): extract useMoshpitSpriteActions composable` — this commit is intentionally separate from Task 2's `feat:` commit to keep the refactor diff clean. Do NOT use `--no-verify`.

  </action>
  <verify>
    <automated>pnpm test:unit -- src/platform/moshpit/composables/useMoshpitSpriteActions.test.ts src/platform/moshpit/components/MoshpitSpriteContextMenu.test.ts</automated>
  </verify>
  <done>
    - `useMoshpitSpriteActions.ts` exists, exports a single composable, takes `{ getHitTester }`, returns the five action functions + `someSelectedArePinned` predicate.
    - `MoshpitSpriteContextMenu.vue` no longer contains the inlined `buildHashToAssetMap`/`triggerDownload` helpers or direct `overrideStore.setPin`/`overrideStore.unpin`/`overrideStore.clearAll` calls — those live in the composable.
    - All 9 existing `MoshpitSpriteContextMenu.test.ts` tests pass unchanged.
    - New `useMoshpitSpriteActions.test.ts` adds ≥ 7 behavioural tests, all passing.
    - `pnpm typecheck` clean; no `any`, `as any`, `dark:`, `:class="[]"`, or `!important` introduced.
    - Single commit on branch: `refactor(260423-led): extract useMoshpitSpriteActions composable`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Build MoshpitFloatingActionBar + wire into MoshpitView</name>
  <files>
    src/platform/moshpit/components/MoshpitFloatingActionBar.vue,
    src/platform/moshpit/components/MoshpitFloatingActionBar.test.ts,
    src/views/MoshpitView.vue,
    src/locales/en/main.json
  </files>
  <action>
    **i18n — `src/locales/en/main.json`** — add under `moshpit.actionBar` (do not touch `moshpit.contextMenu.*` — download/unpin copy is shared via Task 1's composable which already uses the kx4 keys):
    ```json
    "actionBar": {
      "selectedCount": "{count} selected | {count} selected",
      "unpin": "Unpin",
      "download": "Download",
      "clear": "Clear"
    }
    ```
    The `selectedCount` entry uses vue-i18n's pipe-separated plural syntax (singular | plural); call site: `t('moshpit.actionBar.selectedCount', count)` — passing the count as the second arg enables pluralisation selection. Both forms are identical in English; the plural slot is reserved so translators can pluralise "selected" in target languages.

    **Component — `src/platform/moshpit/components/MoshpitFloatingActionBar.vue`** — new SFC:

    Template:
    - Root: a `<div v-if="isVisible" class="..." role="toolbar" :aria-label="t('moshpit.actionBar.selectedCount', selectionStore.size)">` positioned absolute, bottom-center of the container (`absolute bottom-4 left-1/2 -translate-x-1/2`), z-index higher than marquee but below tournament overlay (use `z-30` — tournament overlay uses `z-50` per STATE.md Plan 05-06 notes). Surface styling: use semantic tokens from `packages/design-system/src/css/style.css` — prefer `bg-interface-panel-surface` (matches existing moshpit chrome like the context menu's `data-[highlighted]:bg-interface-panel-surface`), `border border-border-subtle`, `shadow-interface`, `rounded-full`, `px-3 py-2`, `flex items-center gap-2`, `pointer-events-auto`.
    - Children in order:
      1. `<span class="text-sm text-base-mute-foreground px-2" data-testid="moshpit-action-bar-count">` rendering `t('moshpit.actionBar.selectedCount', selectionStore.size)`.
      2. A vertical divider `<span class="h-4 w-px bg-border-subtle" aria-hidden="true" />`.
      3. `<button type="button" :class="buttonClasses" :disabled="!canUnpin" :aria-label="t('moshpit.actionBar.unpin')" data-testid="moshpit-action-bar-unpin" @click="onUnpinClick">{{ t('moshpit.actionBar.unpin') }}</button>`
      4. `<button type="button" :class="buttonClasses" :aria-label="t('moshpit.actionBar.download')" data-testid="moshpit-action-bar-download" @click="onDownloadClick">{{ t('moshpit.actionBar.download') }}</button>`
      5. A divider (same as above).
      6. `<button type="button" :class="buttonClasses" :aria-label="t('moshpit.actionBar.clear')" data-testid="moshpit-action-bar-clear" @click="onClearClick">{{ t('moshpit.actionBar.clear') }}</button>`
    - Use `cn()` from `@/utils/tailwindUtil` for the `buttonClasses` constant. Button classes: `cn('rounded-md px-2 py-1 text-sm outline-none hover:bg-interface-panel-hover focus-visible:ring-2 focus-visible:ring-(--focus-ring) disabled:cursor-not-allowed disabled:opacity-50')`. Do NOT use `:class="[...]"` array merging and do NOT use `dark:`.

    Script setup:
    - `defineOptions({ name: 'MoshpitFloatingActionBar' })`.
    - Props (optional, via reactive destructuring): none for now — the bar reads its own state from stores. If the executor finds a need for `getHitTester` prop (for pinHereMany) — NO, this plan does not render a pin-here control, so no hit-tester needed.
    - `const { t } = useI18n()` — use the composable, not module-level `t` import (SFC rule).
    - `const selectionStore = useMoshpitSelectionStore()`; `const tournamentStore = useMoshpitTournamentStore()`.
    - `const actions = useMoshpitSpriteActions({ getHitTester: () => null })` — the action bar only calls `downloadMany`, `unpinMany`, and never `pinHereMany`, so passing `() => null` is safe. The composable documents that `pinHereMany` no-ops when the getter returns null.
    - `const isVisible = computed(() => selectionStore.size > 0 && !tournamentStore.isActive)`.
    - `const canUnpin = computed(() => actions.someSelectedArePinned(selectionStore.selected))`.
    - Function declarations (not expressions):
      - `function onUnpinClick() { actions.unpinMany(selectionStore.selected) }`
      - `function onDownloadClick() { actions.downloadMany(selectionStore.selected) }`
      - `function onClearClick() { selectionStore.clear() }`

    No `<style>` block. No transition animation in v1 (keep LoC tight; animation is explicitly noted as "keep simple" in scope and a plain `v-if` works; we can add `<Transition>` in a follow-up if the visual review calls for it).

    **Wiring — `src/views/MoshpitView.vue`**:
    - Add `import MoshpitFloatingActionBar from '@/platform/moshpit/components/MoshpitFloatingActionBar.vue'`.
    - Mount as a sibling of `<MoshpitMarqueeOverlay />` and `<MoshpitSpriteContextMenu ref="contextMenuRef" />`, directly before the context menu line: `<MoshpitFloatingActionBar />`.
    - No props, no ref needed — the component reads stores directly.

    **Tests — `MoshpitFloatingActionBar.test.ts`** (vitest + @testing-library/vue, mirror the Pinia mount pattern in `MoshpitSpriteContextMenu.test.ts`):
    - Setup: `setActivePinia(createPinia())` in `beforeEach`; use the real composable (no mock of `useMoshpitSpriteActions`) so we're testing the integration. Mock `HTMLAnchorElement.prototype.click` for the download test only, per kx4 precedent.
    - Tests:
      1. **Hidden when selection empty** — mount with no selection; `queryByTestId('moshpit-action-bar-count')` returns null.
      2. **Visible with count when selection > 0** — seed `selectionStore.setSelection(['a', 'b', 'c'])`, mount, assert count badge text contains "3 selected".
      3. **Hidden during tournament mode** — seed selection of 2, set `tournamentStore` into an active state (if the store exposes a direct `isActive` flag or a setter; otherwise call its public entry method — inspect the store; if no public setter, skip this test with a `// TODO` comment referencing the store's private state and explain in the SUMMARY). Assert the bar is absent.
      4. **Unpin disabled when none pinned** — seed selection of 2, no pins; assert the Unpin button has `disabled` attribute.
      5. **Unpin enabled when at least one pinned** — seed selection of 2, call `overrideStore.setPin('a', { x: 1, y: 2 })`; assert Unpin is not disabled; click it (`userEvent.click`); assert `overrideStore.isPinned('a')` is false afterwards.
      6. **Clear empties the selection** — seed selection of 3; click Clear; assert `selectionStore.size === 0` and the bar is no longer in the DOM (await `waitFor` for reactivity flush if necessary).
      7. **Download triggers anchor clicks** — seed selection of 2 with matching `assetsStore.historyAssets` entries (reuse the kx4 test's helper pattern for building AssetItem literals — copy from `MoshpitSpriteContextMenu.test.ts`); spy `HTMLAnchorElement.prototype.click`; click Download; assert spy called 2 times.

    **Commit:** `feat(260423-led): add MoshpitFloatingActionBar for selection-driven bulk actions`.

    Budget check before commit: non-test LoC diff across this task should be well under 300 (action bar SFC ≈ 70 LoC, MoshpitView.vue diff ≈ 2 lines, i18n ≈ 5 lines). Task 1's refactor is net-neutral-or-negative on the context menu.

  </action>
  <verify>
    <automated>pnpm test:unit -- src/platform/moshpit/components/MoshpitFloatingActionBar.test.ts src/platform/moshpit/components/MoshpitSpriteContextMenu.test.ts && pnpm typecheck</automated>
  </verify>
  <done>
    - `MoshpitFloatingActionBar.vue` renders (via `v-if`) iff `selectionStore.size > 0 && !tournamentStore.isActive`.
    - All 7 new `MoshpitFloatingActionBar.test.ts` tests pass (test 3 may be skipped with a documented TODO if tournament store has no public `isActive` setter).
    - The kx4 suite (`MoshpitSpriteContextMenu.test.ts`, 9 tests) still passes.
    - `pnpm typecheck` clean.
    - `MoshpitView.vue` renders `<MoshpitFloatingActionBar />` alongside the other overlays.
    - `moshpit.actionBar.{selectedCount,unpin,download,clear}` present in `src/locales/en/main.json`.
    - No `any`, `as any`, `dark:`, `:class="[]"`, `!important`, arbitrary percentage widths, or new PrimeVue imports anywhere in the diff.
    - Single commit on branch: `feat(260423-led): add MoshpitFloatingActionBar for selection-driven bulk actions`.
  </done>
</task>

</tasks>

<verification>
Run from project root:

1. `pnpm test:unit -- src/platform/moshpit` — expect 712+/712+ passing (701 pre-plan baseline + 7 action-bar tests + 7 composable tests, minus any tests removed during the context-menu refactor; the refactor must not remove tests).
2. `pnpm typecheck` — clean.
3. `pnpm lint` — clean. Pay attention to:
   - no raw text in templates (all strings via `t(...)`),
   - no `:class="[]"` merging,
   - no `dark:` variant,
   - oxlint's `vue/no-unused-properties` on the new component.
4. Manual smoke (optional, not gating CI):
   - `pnpm dev`, open Moshpit, select a few sprites — bar appears at bottom-center with count, disappears when selection is cleared.
   - Pin one sprite (drag-to-pin or right-click → Pin here), re-select it — Unpin is enabled; click it, the pin override clears and the sprite snaps back to cluster layout.
   - Click Download — one browser download per selected hash with resolvable asset; toast confirms.
   - Enter tournament (≥2 selected, press Enter) — action bar disappears.

Grep checks (no findings expected):

- `grep -R "as any" src/platform/moshpit/composables/useMoshpitSpriteActions.ts src/platform/moshpit/components/MoshpitFloatingActionBar.vue` — no output.
- `grep -R "dark:" src/platform/moshpit/components/MoshpitFloatingActionBar.vue` — no output.
- `grep -R "!important\\|:class=\\\"\\[" src/platform/moshpit/components/MoshpitFloatingActionBar.vue` — no output.
  </verification>

<success_criteria>

- Selection of ≥1 sprite shows a bottom-center floating bar with "N selected", Unpin, Download, Clear.
- Bar hides when selection is empty and when tournament mode is active.
- All three bar buttons work and call through the shared composable.
- The context menu now delegates all its per-item actions to the same composable (single source of truth).
- Two commits on branch: one `refactor:` for the composable extraction, one `feat:` for the new component and wiring. Both prefixed `260423-led`.
- Full moshpit test suite green, typecheck green, lint green.
- Non-test LoC for the combined plan stays well under 300.
  </success_criteria>

<output>
After completion, create `.planning/quick/260423-led-moshpit-floating-action-bar-visible-when/260423-led-SUMMARY.md` following the summary template and including:
- Commit hashes and messages (one refactor, one feat).
- Test counts before/after (moshpit suite baseline 701 → expected 715+).
- Any deviations (e.g. test 3 skipped with TODO if tournament store lacks a public setter).
- LoC delta (non-test vs test).
- Self-check of all must_haves truths + artifacts + key_links.
</output>
