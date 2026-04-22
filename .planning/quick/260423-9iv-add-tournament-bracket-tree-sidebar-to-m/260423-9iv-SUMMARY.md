---
phase: 260423-9iv
plan: 01
type: summary
completed: 2026-04-23
requirements:
  - QUICK-BRACKET-SIDEBAR
tags: [moshpit, tournament, ui, sidebar]
dependency_graph:
  requires:
    - moshpitTournamentStore (enter / pickWinner / skip / bracket / bracketShape / currentPair / isFinished / isActive / selectionOnEntry)
    - tournamentBracket.ts (TournamentPair type)
    - MoshpitTournamentOverlay.vue (mount point)
  provides:
    - MoshpitTournamentBracketTree.vue — left sidebar visualisation
    - pairResults reactive map on tournament store
    - entryHashes readonly computed on tournament store
  affects:
    - MoshpitTournamentOverlay.vue (added bracket as leftmost child of <main>)
tech_stack:
  patterns:
    - Reactive Pinia store exposing `Ref<Map>` + `ComputedRef<readonly T[]>` via return block
    - Immutable-replace (`pairResults.value = new Map(pairResults.value)`) for reactivity
    - Cn-merged Tailwind classes with semantic tokens (border-border-focused, bg-bg-toggle-on-default, text-muted-foreground, border-border-subtle, bg-comfy-menu-bg)
    - Echo-key vitest pattern for i18n in component tests
    - `within(root).queryAllByTestId(...)` to satisfy testing-library/no-node-access
key_files:
  created:
    - src/platform/moshpit/components/MoshpitTournamentBracketTree.vue
    - src/platform/moshpit/components/MoshpitTournamentBracketTree.test.ts
  modified:
    - src/platform/moshpit/stores/moshpitTournamentStore.ts
    - src/platform/moshpit/stores/moshpitTournamentStore.test.ts
    - src/platform/moshpit/components/MoshpitTournamentOverlay.vue
    - src/locales/en/main.json
decisions:
  - pairResults keyed by `pair.index` (stable across round-robin tail-rotation); cleared in resetState().
  - entryHashes exposed as readonly computed (thin projection of `selectionOnEntry`), no defensive copy needed because the ref is only mutated on enter/reset.
  - sliceIntoRounds only emits fully-populated rounds — partial rounds are never rendered (prevents flashing half-filled columns between round boundaries).
  - Component self-hides on both `!isActive` AND `isFinished`; overlay-level gating is redundant belt-and-suspenders, not required for correctness.
  - Chose `bg-bg-toggle-on-default` to match the native ComfyUI selection token alignment from quick task 260423-89u (selection states).
  - 4 i18n keys (bracket.round / currentPair / skipped / winnerLabel) are declared but not yet consumed; reserved for follow-up polish (round headers, aria-live announcements). Lint warns but does not fail.
metrics:
  duration: ~15 min
  tasks: 3
  commits: 3
  tests_added: 7 component tests + 7 store tests (14 total new)
  tests_green: 54 / 54 across the three related test files
commits:
  - 315cbf427 — feat(260423-9iv): add pairResults + entryHashes to tournament store
  - e71745476 — feat(260423-9iv): add MoshpitTournamentBracketTree sidebar component
  - c8c30fff1 — feat(260423-9iv): mount bracket tree in tournament overlay
---

# Quick Task 260423-9iv: Tournament Bracket Tree Sidebar Summary

Added a narrow left bracket-tree sidebar to the Moshpit tournament overlay so users can see the matchup structure, review past results at a glance, and track the current pair within its round. Round-robin renders as a single vertical list; single-elim renders as round columns that grow as further rounds are generated.

## What shipped

1. **Store** — `moshpitTournamentStore` gained `pairResults: Ref<Map<number, 'A' | 'B' | 'skip'>>` and `entryHashes: ComputedRef<readonly string[]>`. `pickWinner` and `skip` both write into `pairResults` using the existing immutable-replace pattern. `resetState()` clears the map so re-entry starts clean.
2. **Component** — `MoshpitTournamentBracketTree.vue` renders a `w-50` left aside driven entirely from the store. Winner sub-box accented with `bg-bg-toggle-on-default`; loser dimmed with `opacity-60`; current pair ringed with `border-border-focused`; skipped pairs get `border-dashed opacity-60`. Round segmentation for single-elim uses an inline `nextPow2` + `sliceIntoRounds` helper that only emits fully-populated rounds.
3. **Overlay** — `MoshpitTournamentOverlay.vue` mounts `<MoshpitTournamentBracketTree />` as the leftmost child of `<main>` inside the active-tournament branch. The component self-hides on `isFinished`, so the winner screen still renders full-width.
4. **i18n** — `moshpit.tournament.bracket.{title, round, matchup, winnerLabel, currentPair, skipped}` in `src/locales/en/main.json`.

## Token choices

All tokens verified against `packages/design-system/src/css/style.css` (and already used elsewhere in the overlay):

| Purpose                  | Token used                 |
| ------------------------ | -------------------------- |
| Sidebar surface          | `bg-comfy-menu-bg`         |
| Sidebar right border     | `border-border-default`    |
| Header divider           | `border-border-subtle`     |
| Default pair card border | `border-border-subtle`     |
| Current pair ring        | `border-border-focused`    |
| Winner sub-box surface   | `bg-bg-toggle-on-default`  |
| Winner text              | `text-base-foreground`     |
| Loser / muted text       | `text-muted-foreground`    |
| Skipped state            | `border-dashed opacity-60` |

No hex values, no arbitrary percentages, no `dark:`, no `:class="[]"`, no `<style>` block. All conditional classes use `cn()` from `@/utils/tailwindUtil`.

## Deviations from Plan

None. All three tasks executed exactly as specified.

The plan's `<action>` block for the component noted a partial-round guard; the simpler `if (cursor + size > pairs.length) break` form was used (as recommended in the plan's own simpler-equivalent note).

## Test counts

- `moshpitTournamentStore.test.ts`: **42 / 42 passing** (35 pre-existing + 7 new under `pairResults + entryHashes`).
- `MoshpitTournamentBracketTree.test.ts`: **7 / 7 passing** (new file — round-robin list, single-elim segmentation growth, winner marker, current marker, skipped state, finished self-hide, inactive self-hide).
- `MoshpitTournamentOverlay.test.ts`: **5 / 5 passing** (no changes needed — bracket mounts as an inert sibling in the active branch).

## Verification

- `pnpm test:unit -- src/platform/moshpit/components/MoshpitTournamentOverlay.test.ts src/platform/moshpit/components/MoshpitTournamentBracketTree.test.ts src/platform/moshpit/stores/moshpitTournamentStore.test.ts --run` — 54 / 54 green.
- `pnpm typecheck` — clean.
- `pnpm lint --quiet` — clean on the files this task touched. The 5 pre-existing `no-floating-promises` errors on `main` are unrelated (Asset worker, subscription watcher, etc.) and out of scope per SCOPE BOUNDARY.

## Known Stubs

None. The sidebar is wired directly to live store state; there are no hard-coded empty arrays or placeholder components.

## Self-Check: PASSED

- `src/platform/moshpit/components/MoshpitTournamentBracketTree.vue` — FOUND
- `src/platform/moshpit/components/MoshpitTournamentBracketTree.test.ts` — FOUND
- `src/platform/moshpit/stores/moshpitTournamentStore.ts` — FOUND (modified)
- `src/platform/moshpit/stores/moshpitTournamentStore.test.ts` — FOUND (modified)
- `src/platform/moshpit/components/MoshpitTournamentOverlay.vue` — FOUND (modified)
- `src/locales/en/main.json` — FOUND (modified)
- Commit `315cbf427` — FOUND
- Commit `e71745476` — FOUND
- Commit `c8c30fff1` — FOUND
