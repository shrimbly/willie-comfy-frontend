---
phase: quick
plan: 260423-dab
subsystem: moshpit
tags:
  - moshpit
  - tournament
  - ui
  - tokens
  - refactor
dependency-graph:
  requires:
    - 260423-89u-SUMMARY (sidebar + filter native alignment precedent)
    - 260423-9iv-SUMMARY (bracket tree sidebar introduction)
  provides:
    - Native-modal-aligned tournament overlay (rounded-2xl, bg-modal-panel-background rails, shared Button close)
  affects:
    - MoshpitTournamentOverlay
    - MoshpitTournamentBracketTree
    - MoshpitMetadataPeekPanel
    - i18n (moshpit.tournament.winner)
tech-stack:
  added: []
  patterns:
    - 'Shared ui/button/Button for modal close affordance with pi-times icon'
    - 'bg-modal-panel-background for rail surfaces (footer + sidebars) mirroring BaseModalLayout'
    - 'aria-hidden span spacer to preserve justify-between layout during transition states'
key-files:
  created: []
  modified:
    - src/platform/moshpit/components/MoshpitTournamentOverlay.vue
    - src/platform/moshpit/components/MoshpitTournamentBracketTree.vue
    - src/platform/moshpit/components/MoshpitMetadataPeekPanel.vue
    - src/platform/moshpit/components/MoshpitTournamentOverlay.test.ts
    - src/locales/en/main.json
decisions:
  - 'Reuse global g.closeDialog i18n key via BaseModalLayout pattern — no moshpit-scoped duplicate'
  - 'Prune moshpit.tournament.winner.headerComplete (single orphan consumer deleted)'
  - 'Use aria-hidden empty span (not empty div) as left-side spacer when currentPair is null — preserves justify-between without polluting a11y tree'
metrics:
  duration: ~6 min
  completed: 2026-04-23
---

# Quick Task 260423-dab: Align Tournament Overlay to Native Comfy Summary

Align the Moshpit tournament overlay, bracket sidebar, and metadata peek panel to the native ComfyUI BaseModalLayout vocabulary — rounded-2xl frame, bg-modal-panel-background rails, shared Button close affordance — mirroring the sidebar + filter alignment shipped in quick task 260423-89u.

## Overview

The tournament overlay previously read as a bespoke panel: a redundant visible title, a "Tournament complete" header label that fought with MoshpitTournamentWinner's own complete framing, a hairline interface-stroke around every edge, rounded-lg corners, and a responsive-ladder peek width (w-80 → w-96 → w-md). The bracket sidebar had its own "BRACKET" header block and a right border against a different surface token.

This pass:

1. Stripped three redundancies (overlay title span, overlay "Tournament complete" label, bracket "BRACKET" header).
2. Moved the pair counter from the right to the left of the header and added a native Button close affordance on the right that reuses `tournamentStore.exit('esc')` via the existing `onEscape` handler.
3. Switched DialogContent to rounded-2xl with shadow-only framing; footer gained bg-modal-panel-background as a rail surface.
4. Bracket sidebar: removed header block, switched to bg-modal-panel-background, dropped right border.
5. Metadata peek panel: fixed at w-72 on bg-modal-panel-background with no left border; internal dividers switched to border-border-subtle.
6. Pruned the orphan i18n key `moshpit.tournament.winner.headerComplete`; reused the global `g.closeDialog` key for the close button aria-label.
7. Added a behaviour test locking in the close-button → exit() path.

## Tasks Completed

- **Task 1** — Aligned overlay surface + close affordance in MoshpitTournamentOverlay.vue: imported shared Button, swapped rounded-lg → rounded-2xl and dropped interface-stroke border on DialogContent; rebuilt `<header>` with left-aligned counter + right-aligned Button (pi-times icon, `data-testid="moshpit-tournament-overlay-close"`, `@click="onEscape"`); removed the visible title span and "Tournament complete" label (MoshpitTournamentWinner owns that framing); added bg-modal-panel-background + dropped top border on the footer.
- **Task 2** — Aligned bracket tree + metadata peek surfaces: removed the `<header>` block from MoshpitTournamentBracketTree.vue (aside's `aria-label` preserves screen-reader naming); switched the aside surface to bg-modal-panel-background and dropped `border-r`. In MoshpitMetadataPeekPanel.vue: fixed width to w-72 (dropped lg:w-96 xl:w-md), switched to bg-modal-panel-background, dropped `border-l`, and swapped both internal `border-(--interface-stroke)` instances to `border-border-subtle`.
- **Task 3** — Added `userEvent` import + new `describe('MoshpitTournamentOverlay — close button')` block in MoshpitTournamentOverlay.test.ts that seeds a tournament, clicks `moshpit-tournament-overlay-close`, and asserts `store.isActive === false`. Pruned `headerComplete` from `moshpit.tournament.winner` in `src/locales/en/main.json`.

## Deviations from Plan

None — plan executed exactly as written. The close-button test also calls `seedThumbs(['a', 'b', 'c'])` before `store.enter(...)` to match the pattern used elsewhere in the file; the plan's snippet omitted this but it's a no-op in happy-dom (thumbs are purely render inputs) and follows the file's existing convention.

## Technical Details

### Close-button wiring

The new Button reuses the existing `onEscape` function — no new handler. `tournamentStore.exit('esc')` is idempotent (guarded by `if (!isActive.value) return`), so double-invocation from the `v-model:open` setter and the click handler is safe. Matches the Reka DialogRoot close-path contract already established in the file.

### Layout during transition

When `tournamentStore.currentPair` is null and the tournament is not yet finished (brief `applyPick` → `generateNextRound` transition), the header renders an `<span v-else aria-hidden="true" />` so `justify-between` keeps the close Button right-aligned without polluting the screen-reader tree.

### a11y invariants preserved

`VisuallyHidden > DialogTitle > t('moshpit.tournament.dialogTitle')` and `VisuallyHidden > DialogDescription` are untouched — Reka's DialogRoot a11y contract still holds. Bracket sidebar retains `aria-label="t('moshpit.tournament.bracket.title')"` on the `<aside>`, so removing the visible header has no a11y cost.

### Token alignment

- DialogContent: `rounded-2xl bg-base-background shadow-2xl` (no border).
- Header: structural only — no border, no surface token.
- Footer: `bg-modal-panel-background` (rail).
- Bracket sidebar: `bg-modal-panel-background` (rail) — no right border.
- Peek panel: `w-72 bg-modal-panel-background` (fixed rail) — no left border.
- Internal dividers in peek panel: `border-border-subtle` (project convention for section separators).

## Verification

- `pnpm lint` — clean on the five touched files (pre-existing project-wide errors in `thumbWorker.ts`, `sortMath.test.ts`, etc. are out of scope).
- `pnpm typecheck` — clean project-wide (vue-tsc, no diagnostics).
- `pnpm test:unit` on the three test files — 29/29 green, including the new close-button test.
- Grep sanity checks:
  - No remaining `moshpit-tournament-overlay-title` or `moshpit-tournament-overlay-complete` test IDs in `src/platform/moshpit`.
  - No `headerComplete` references anywhere in `src/`.
  - No `interface-stroke` references in the overlay or peek panel files.
  - No `bg-comfy-menu-bg` references in the bracket tree file.

## Commit

- `84e4f286f` — refactor(moshpit): align tournament overlay to native modal patterns

## Self-Check: PASSED

- Files exist:
  - src/platform/moshpit/components/MoshpitTournamentOverlay.vue (modified)
  - src/platform/moshpit/components/MoshpitTournamentBracketTree.vue (modified)
  - src/platform/moshpit/components/MoshpitMetadataPeekPanel.vue (modified)
  - src/platform/moshpit/components/MoshpitTournamentOverlay.test.ts (modified)
  - src/locales/en/main.json (modified)
- Commit `84e4f286f` present in git log.
