---
phase: 05
plan: 04
subsystem: moshpit-tournament-visuals
tags: [moshpit, tournament, components, vue, tdd]
requires:
  - 'useMoshpitThumbStore.getUrl (Phase 2)'
  - 'useMoshpitTournamentStore (Plan 05-03)'
provides:
  - 'MoshpitTournamentAssetFrame.vue — single-asset DOM frame with thumb fallback + full-res crossfade'
  - 'MoshpitTournamentPair.vue — renders currentPair in active displayMode (sideBySide / overlap / flip)'
affects: []
tech-stack:
  added: []
  patterns:
    - 'Vue 3.5 destructured-props SFC with Composition API'
    - 'Detached Image() preloader + Tailwind `transition-opacity duration-300 ease-out` crossfade'
    - 'Inline `:style` for dynamic `clip-path` + divider `left` (Tailwind utility not required)'
    - 'Pointer drag on absolute-positioned divider → store.setWipePosition via getBoundingClientRect math'
    - 'data-testid hooks for ESLint-compliant queries via `screen` (no `container` access)'
key-files:
  created:
    - 'src/platform/moshpit/components/MoshpitTournamentAssetFrame.vue'
    - 'src/platform/moshpit/components/MoshpitTournamentAssetFrame.test.ts'
    - 'src/platform/moshpit/components/MoshpitTournamentPair.vue'
    - 'src/platform/moshpit/components/MoshpitTournamentPair.test.ts'
  modified: []
decisions:
  - 'Semantic tokens verified against in-repo usage — AssetFrame uses `bg-base-background`, divider uses `bg-base-foreground`, highlight ring uses `ring-(--focus-ring)`. No `bg-background` / `bg-foreground` / `ring-primary` (none of those tokens exist in style.css).'
  - 'clip-path applied via inline `:style="clipStyleForB"` rather than a Tailwind utility — Tailwind 4 has no first-class `clip-path: inset(...)` utility and inline style is the pragmatic dynamic-value carrier (no `!important` required).'
  - 'A/B label strategy — corner badge (`label="A"` / `label="B"`) applied in every mode for consistency. In side-by-side, the active side additionally carries `highlight=!store.flipShowsB` / `highlight=store.flipShowsB` so Space flips surface a visible ring (D-17 Claude discretion: label + ring, not a one-shot 150ms pulse — keeps UI stateless and avoids hand-rolled animation).'
  - 'Preloader `onload` handler re-checks `preloader.src === url` before flipping `isFullResLoaded` to avoid a stale-preloader race when `fullResUrl` changes mid-load.'
  - "Test — `vi.stubGlobal('Image', FakeImage)` uses a real `function` declaration (not arrow) so `new Image()` works (Phase 5 Plan 03 lesson re-applied)."
  - "Test — avoided `render().container.querySelectorAll` (ESLint testing-library/no-container). Used `data-testid` hooks and `screen.getAllByTestId` / `screen.getByRole('img')`."
  - 'Skipped the explicit RED commit — TDD RED was blocked twice by different lint rules (`vue/no-unused-properties` on prop-only stubs, `import-x/no-unresolved` on missing-file stubs). Shipped each task as a single `feat:` commit with tests-first in the working tree. Pure-UI glue per plan — no behavioural regression risk since tests landed alongside.'
metrics:
  duration: ~6min
  completed: 2026-04-22
  tasks: 2
  files: 4
  commits:
    - '7b66ea49a feat(05-04): add MoshpitTournamentAssetFrame with thumb fallback and full-res crossfade'
    - '027149d40 feat(05-04): add MoshpitTournamentPair (side-by-side / overlap / flip modes)'
---

# Phase 5 Plan 04: Tournament Visual Primitives Summary

Two Vue 3.5 SFCs ship the pixel-rendering half of tournament mode: a
single-asset frame that crossfades from a cached thumb to the full-res on
load, and a pair renderer that reactively switches between side-by-side,
overlap (horizontal wipe), and A/B flip layouts driven by the tournament
store.

## Final API Surface

### `MoshpitTournamentAssetFrame.vue`

```typescript
defineProps<{
  hash: string
  fullResUrl: string | null
  label?: 'A' | 'B'
  highlight?: boolean
}>()
```

Behaviour:

- Renders `<img>` with `max-w-full max-h-full object-contain` inside a
  `bg-base-background` letterbox.
- On mount / `fullResUrl` change: constructs a detached `new Image()`
  preloader; on `onload`, swaps `shownSrc` from the thumb to `fullResUrl`.
- `<img>` transitions `opacity-95 → opacity-100` via Tailwind
  `transition-opacity duration-300 ease-out` (no JS tween, Research §Don't
  Hand-Roll honoured).
- `label` → corner badge on `bg-interface-panel-surface/80`.
- `highlight=true` → `ring-2 ring-(--focus-ring)` on root.
- `alt` text: `t('moshpit.tournament.assetAlt')` (key wired in Plan 06).
- No emits. No slots. No imperative API.

### `MoshpitTournamentPair.vue`

```typescript
defineProps<{
  resolveFullResUrl: (hash: string) => string | null
}>()
```

Renders based on `store.displayMode`:

- `sideBySide` — two `MoshpitTournamentAssetFrame` in `w-1/2 h-full` flex
  children; labels A/B; highlight follows `flipShowsB`.
- `overlap` — two absolutely-positioned layers; asset B's layer carries
  `clip-path: inset(0 ${wipePosition * 100}% 0 0)` via inline `:style`;
  divider at `left: ${wipePosition * 100}%` with a round grab handle.
  Pointer drag on divider → `store.setWipePosition(fraction)`.
- `flip` — single `MoshpitTournamentAssetFrame` for
  `flipShowsB ? assetHashB : assetHashA`, label matches.

## Tailwind Token Choices (Verified Against In-Repo Usage)

Plan suggested `bg-background`, `bg-foreground`, `ring-primary`. None of those
exist in `packages/design-system/src/css/style.css` or
`_palette.css`. Concrete tokens shipped:

| Suggested       | Shipped                         | Source                                                    |
| --------------- | ------------------------------- | --------------------------------------------------------- |
| `bg-background` | `bg-base-background`            | Used in `MoshpitShowHiddenToggle.vue`                     |
| `bg-foreground` | `bg-base-foreground`            | Matches `text-base-foreground` token family               |
| `ring-primary`  | `ring-(--focus-ring)`           | Matches `MoshpitClusterOverlay.vue` focus-visible outline |
| Label badge bg  | `bg-interface-panel-surface/80` | Matches `MoshpitClusterOverlay` outer label               |

All tokens are semantic (CSS variables). No hex literals, no `dark:` variant,
no `:class="[]"`, no `!important`, no arbitrary percentages
(`w-1/2`, `top-1/2`, `left-1/2` — all fraction utilities; clip-path percentages
flow through inline `:style` which is not a Tailwind arbitrary value).

## Invalid Tailwind Class Guard (Replacements Shipped)

| Invalid                  | Replacement                         | Reason                                 |
| ------------------------ | ----------------------------------- | -------------------------------------- |
| `max-size-full`          | `max-w-full max-h-full`             | Not a Tailwind 4 utility               |
| `-translate-1/2`         | `-translate-x-1/2 -translate-y-1/2` | Two utilities — single form is invalid |
| Arbitrary `w-[80%]` etc. | `w-1/2`, `top-1/2`, `left-1/2`      | Fraction utilities exist               |

Grep guards in the plan's acceptance criteria confirm none of these appear in
either shipped SFC.

## Pointer-Capture Behaviour (happy-dom)

The overlap-mode divider uses:

```typescript
function onDividerPointerDown(e: PointerEvent): void {
  isDraggingDivider.value = true
  const target = e.currentTarget as Element | null
  target?.setPointerCapture?.(e.pointerId)
}
```

The `?.setPointerCapture?.()` guards both an undefined `currentTarget`
(possible in synthetic unit-test events) and happy-dom's missing
`setPointerCapture` implementation. The test dispatches `pointerdown` and
`pointermove` directly via `element.dispatchEvent(new PointerEvent(...))` —
no browser emulation of pointer capture is required for the drag math to
fire, because the `pointermove` handler lives on the divider itself (not the
window), so capture is nice-to-have but not load-bearing for the test to
pass.

Stub root `getBoundingClientRect` in the test — happy-dom's default returns
all zeros.

## Test Coverage (21 tests)

| File                                  | Tests | Coverage                                                                                                                                                          |
| ------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MoshpitTournamentAssetFrame.test.ts` | 12    | thumb fallback, preloader swap, onerror stay-on-thumb, missing thumb, A/B labels, highlight ring, alt text, preloader rebuild on URL change                       |
| `MoshpitTournamentPair.test.ts`       | 9     | null pair, sideBySide layout + labels + hashes, overlap clip-path + divider position + pointer-drag math, flip A/B swap via `toggleFlip`, D-18 state preservation |

D-18 test explicitly sets `wipePosition = 0.3`, toggles flip to `true`,
cycles `sideBySide → overlap → flip → sideBySide`, and asserts at each stop
that the store state is intact and each mode renders correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vue `no-unused-properties` blocks prop-stubbed RED commits**

- **Found during:** Task 1 RED commit
- **Issue:** Husky's pre-commit ESLint rejected a stub SFC that declared
  `defineProps` without referencing any prop. The four "unused property" errors
  blocked the commit; `lint-staged` reverted the stash.
- **Fix:** Skipped the explicit RED commit for Task 1 and shipped a single
  `feat:` commit with both the tests and the real implementation. Plan note
  at `<task tdd="true">` allows lighter TDD for UI glue ("this is UI glue so
  TDD is lighter than for stores"). Tests were verified failing (9/12
  failing against a minimal stub) before the real implementation was written.
- **Files modified:** n/a (process change)
- **Commits:** Folded into `7b66ea49a` and `027149d40`

**2. [Rule 3 - Blocking] ESLint `testing-library/no-container` + `no-node-access` blocked Pair tests**

- **Found during:** Task 2 GREEN commit
- **Issue:** `container.querySelector(...)` and
  `container.querySelectorAll(...)` (which worked in Plan 05-03 tests via
  `getByTestId` — a different pattern) emit
  `testing-library/no-container` / `no-node-access` errors across 52
  call-sites.
- **Fix:** Rewrote every assertion to use
  `screen.getByTestId(...)` / `screen.getAllByTestId(...)` /
  `screen.queryAllByTestId(...)` / `screen.getByRole('img')`. No `container`
  references remain.
- **Files modified:** `src/platform/moshpit/components/MoshpitTournamentPair.test.ts`
- **Commit:** Folded into `027149d40`

No architectural changes, no auth gates, no CLAUDE.md directives violated.

## Pointer for Plan 05-05 / 05-06 Executor

### Overlay mount pattern (Plan 05-06)

```vue
<!-- MoshpitTournamentOverlay.vue — inside Reka DialogContent -->
<script setup lang="ts">
import { getAssetUrl } from '@/platform/assets/utils/assetUrlUtil'
import { useAssetsStore } from '@/stores/assetsStore'
import MoshpitTournamentPair from '@/platform/moshpit/components/MoshpitTournamentPair.vue'

const assetsStore = useAssetsStore()
function resolveFullResUrl(hash: string): string | null {
  const asset = assetsStore.historyAssets.find((a) => a.asset_hash === hash)
  return asset ? getAssetUrl(asset) : null
}
</script>

<template>
  <DialogContent>
    <MoshpitTournamentPair :resolveFullResUrl="resolveFullResUrl" />
    <!-- legend, pair counter, peek panel mount separately -->
  </DialogContent>
</template>
```

### D-17 label-pulse expectation

Pair already passes `highlight` to AssetFrame based on `flipShowsB` in
side-by-side mode. Plan 06 can forgo a separate 150ms pulse composable — the
AssetFrame's static `ring-2 ring-(--focus-ring)` highlights the "active" side
for as long as `flipShowsB` points at it. If dogfood asks for a one-shot
pulse, wrap the highlight in a `useTimeoutFn`-cleared ref on the overlay
side.

### i18n key to wire in Plan 06

`moshpit.tournament.assetAlt` — short generic alt text, e.g. "Tournament
asset". The key is NOT yet in `src/locales/en/main.json`; tests inject it
via `createI18n({ messages: ... })` per-test.

### Test harness pattern reusable for Plan 06

The `FakeImage` constructor stub and `vi.stubGlobal('Image', FakeImage)` in
both test files can be hoisted into a shared `test/helpers/fakeImage.ts` if
Plan 06's overlay tests also render AssetFrame children. Matches the pattern
from `moshpitTournamentStore.test.ts`.

## Verification

- `pnpm test:unit -- --run src/platform/moshpit/components/MoshpitTournamentAssetFrame.test.ts src/platform/moshpit/components/MoshpitTournamentPair.test.ts` → 21 / 21 passing
- `pnpm typecheck` ran clean via husky pre-commit hook on both GREEN commits
- Acceptance-criterion greps all pass:
  - `useMoshpitThumbStore` / `getUrl(` present in AssetFrame
  - `getObjectUrl` absent (Pitfall 2)
  - No `dark:` / `:class="["` / `!important` in either file
  - `object-contain` present in AssetFrame
  - `max-size-full` / bare `-translate-1/2` absent
  - `displayMode === 'sideBySide|overlap|flip'` all three present in Pair
  - `MoshpitTournamentAssetFrame` consumed in Pair
  - `clipPath` present in Pair
  - `w-1/2` present in Pair

## Self-Check

- `src/platform/moshpit/components/MoshpitTournamentAssetFrame.vue` — FOUND
- `src/platform/moshpit/components/MoshpitTournamentAssetFrame.test.ts` — FOUND
- `src/platform/moshpit/components/MoshpitTournamentPair.vue` — FOUND
- `src/platform/moshpit/components/MoshpitTournamentPair.test.ts` — FOUND
- Commit `7b66ea49a` (AssetFrame) — FOUND
- Commit `027149d40` (Pair) — FOUND
- All 21 tests pass under `pnpm test:unit -- --run src/platform/moshpit/components/MoshpitTournamentAssetFrame.test.ts src/platform/moshpit/components/MoshpitTournamentPair.test.ts`

## Self-Check: PASSED
