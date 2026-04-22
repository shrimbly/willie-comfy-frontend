---
phase: 05
plan: 06
subsystem: moshpit-tournament-integration
tags: [moshpit, tournament, integration, overlay, uat, i18n]
requires:
  - 'useMoshpitTournamentStore + useMoshpitTournamentKeybindings (Plan 05-03)'
  - 'MoshpitTournamentPair + MoshpitTournamentAssetFrame (Plan 05-04)'
  - 'MoshpitMetadataPeekPanel (Plan 05-05)'
  - 'Reka DialogRoot / DialogContent / DialogOverlay / DialogPortal'
  - 'useAssetsStore.historyAssets + getAssetUrl for full-res resolver'
  - 'useToastStore for Enter-with-<2 notice'
provides:
  - 'MoshpitTournamentOverlay.vue — Reka DialogRoot composition wrapping Pair + Peek + legend + counter + winner screen'
  - 'MoshpitTournamentWinner.vue — final winner-reveal screen on tournament completion (post-UAT addition)'
  - 'MoshpitView.vue Enter-key entry gate + marquee/click selection wiring + window-scoped tournament keybindings'
  - 'moshpit.tournament.* + moshpit.peek.* i18n namespaces in src/locales/en/main.json'
  - '05-HUMAN-UAT.md — signed-off D-25 qualitative validation (11 scenarios + qualitative question)'
affects:
  - 'src/views/MoshpitView.vue — container @keydown entry gate; marquee on Cmd/Ctrl; sprite-layer selection rings'
  - 'src/platform/moshpit/components/MoshpitCanvas.vue — marquee gesture handed to MoshpitView (ctrl/meta gated)'
  - 'src/platform/moshpit/composables/useMoshpitSpriteLayer.ts — sprite hit-test API + selection-ring Graphics layer'
  - 'src/platform/moshpit/composables/useMoshpitViewportInjection.ts — viewport injection for MoshpitView-level marquee'
tech-stack:
  added: []
  patterns:
    - "Reka DialogRoot v-model:open proxy — single two-way binding routes Esc + outside-click + programmatic close through one exit('esc') call"
    - 'Window capture-phase keydown (not template-ref scoped) because Reka DialogContent exposes a component instance rather than an HTMLElement'
    - 'Pixi sprite hit-test API on useMoshpitSpriteLayer + Graphics selection-ring layer (MoshpitView owns selection-gesture state)'
    - 'Marquee gated on Cmd/Ctrl at pointerdown so plain left-drag still pans the canvas'
    - 'Tournament pick-pulse via store.lastPickedSide + pickPulseId scalar bump (no JS tween, CSS gradient only)'
key-files:
  created:
    - 'src/platform/moshpit/components/MoshpitTournamentOverlay.vue'
    - 'src/platform/moshpit/components/MoshpitTournamentOverlay.test.ts'
    - 'src/platform/moshpit/components/MoshpitTournamentWinner.vue'
    - 'src/platform/moshpit/components/MoshpitTournamentWinner.test.ts'
    - '.planning/phases/05-tournament-mode-replaces-old-comparison-mode-framing/05-HUMAN-UAT.md'
    - '.planning/phases/05-tournament-mode-replaces-old-comparison-mode-framing/deferred-items.md'
  modified:
    - 'src/views/MoshpitView.vue'
    - 'src/views/MoshpitView.test.ts'
    - 'src/locales/en/main.json'
    - 'src/platform/moshpit/components/MoshpitCanvas.vue'
    - 'src/platform/moshpit/components/MoshpitCanvas.test.ts'
    - 'src/platform/moshpit/components/MoshpitTournamentAssetFrame.vue'
    - 'src/platform/moshpit/components/MoshpitTournamentPair.vue'
    - 'src/platform/moshpit/components/MoshpitTournamentPair.test.ts'
    - 'src/platform/moshpit/components/MoshpitMetadataPeekPanel.vue'
    - 'src/platform/moshpit/composables/useMoshpitSpriteLayer.ts'
    - 'src/platform/moshpit/composables/useMoshpitViewportInjection.ts'
    - 'src/platform/moshpit/composables/useMoshpitTournamentKeybindings.ts'
    - 'src/platform/moshpit/composables/useMoshpitTournamentKeybindings.test.ts'
    - 'src/platform/moshpit/stores/moshpitTournamentStore.ts'
    - 'src/platform/moshpit/stores/moshpitTournamentStore.test.ts'
    - 'src/platform/moshpit/services/metadataDiff.ts'
decisions:
  - 'Tournament keybindings attach to `window` (capture phase), not the DialogContent template ref. Reka returns a component instance from the ref, not an HTMLElement — useEventListener silently attached to null. Window-capture gated on tournamentStore.isActive preserves scope semantics without the ref-type mismatch.'
  - 'Canvas selection gestures added in this plan — Phase 1-4 MoshpitCanvas had no click/marquee wiring. UAT Scenario 1 would have been unreachable without it. Sprite hit-test lives on useMoshpitSpriteLayer; selection state owned by MoshpitView.'
  - 'Marquee requires Cmd/Ctrl at pointerdown. Plain left-drag pans the canvas (pixi-viewport default). Matches the convention from other spatial UIs.'
  - 'Overlap clip-path inverted post-UAT (`4a719cd82`) from right-clip to left-clip so the divider IS the visible A↔B boundary. Original build had the divider floating visually disconnected from the image seam.'
  - 'Pick feedback: green gradient pulse on the picked half via store.lastPickedSide + store.pickPulseId monotonic scalar + CSS-only transition. No JS tween. Feedback was dead without it.'
  - 'Winner screen (MoshpitTournamentWinner.vue) added post-UAT — abrupt overlay unmount on tournament completion felt disorienting. Winner hero + metadata summary, Enter/Esc to close, then winner-set applied to canvas selection. Required new store methods (winnerHash / hasWinner / acknowledgeWinner) + keybinding routing for "winner-ack" keys.'
  - 'Modal framing polish (`e6275c74c`, `1d69ae0db`, `eada31568`, `361a2643a`) — bounded modal with stronger backdrop, z-index raised above MoshpitLayout, Comfy panel-surface tokens aligned with the rest of the workbench.'
  - 'moshpit.peek.state.* + moshpit.peek.lora.state* keys dropped from i18n wiring per Plan 05-05 — state conveyed by colour alone. Final peek namespace has 15 param labels, panelTitle, loadingMetadata, and lora.{sectionTitle, empty}.'
  - '@moshpit Playwright spec deferred — Phase 4 typecheck:browser blocker still active. TOUR-01/02/07 covered at unit layer + UAT; reinstate when the tsconfig chore lands.'
metrics:
  duration: ~95 min (overlay/view/UAT ~40 min; post-UAT hardening + winner screen ~55 min)
  completed: 2026-04-23
  tasks: 5
  files: 6 created + 15 modified
  commits:
    - 'b4e62f827 feat(05-06): add MoshpitTournamentOverlay composition with Reka DialogRoot'
    - '5041824d8 feat(05-06): wire tournament overlay + Enter gate into MoshpitView'
    - 'e2c4ecef6 docs(05-06): defer @moshpit spec pending typecheck:browser fix'
    - 'd31821e25 docs(05-06): add HUMAN-UAT scenarios'
    - 'b114f85aa feat(moshpit): canvas selection via click, ctrl+click, and marquee'
    - '76a9b0d09 fix(moshpit): gate marquee on Cmd/Ctrl; attach tournament keys to window'
    - '4a719cd82 fix(moshpit-tournament): invert overlap wipe + add pick-pulse feedback'
    - '7c6352c91 feat(moshpit-tournament): add winner screen at tournament completion'
    - 'eada31568 style(moshpit-tournament): align overlay + winner to Comfy panel patterns'
    - 'e6275c74c style(moshpit-tournament): frame overlay as a bounded modal'
    - '1d69ae0db style(moshpit-tournament): strengthen modal backdrop dim'
    - '361a2643a fix(moshpit-tournament): raise modal z-index above MoshpitLayout'
    - 'ad4993304 docs(05-06): sign off HUMAN-UAT scenarios 1-11'
---

# Phase 5 Plan 06: Tournament Integration + HUMAN-UAT Sign-off Summary

The final Phase 5 plan — wires all prior work (bracket math, diff service,
store, keybindings, visual primitives, peek panel) into a mounted Reka-Dialog
overlay on MoshpitView, lands the i18n namespaces, writes and signs off the
D-25 qualitative UAT, and closes TOUR-01..08 + PEEK-01..03 (11 requirements).
The plan took an extra lap when UAT exposed that the canvas had no selection
gestures at all — fixed in-scope along with several overlay interaction
issues discovered by dogfooding against real assets.

## Deliverables

### Plan-scoped (Tasks 1–5)

1. **`MoshpitTournamentOverlay.vue`** — Reka `DialogRoot` / `DialogContent` /
   `DialogOverlay` / `DialogPortal` composition wrapping `MoshpitTournamentPair`,
   `MoshpitMetadataPeekPanel`, pair counter, and keyboard legend. `v-model:open`
   proxy routes all close paths (Esc, outside-click, programmatic) through
   `tournamentStore.exit('esc')` exactly once. Plus an 11-test component
   suite covering mount/unmount by `isActive`, Escape routing, PEEK-01
   translate-x-full default, legend/counter rendering.
2. **`MoshpitView.vue` extensions** — Container `@keydown="onContainerKeydown"`
   routes `Enter` to `tournamentStore.enter(selection, resolveFullResUrl)`
   when `selectionStore.size >= 2`; fires the "need 2" toast otherwise.
   Mounts `<MoshpitTournamentOverlay>` as a sibling of the canvas + other
   overlays. Builds `resolveFullResUrl` from `useAssetsStore.historyAssets`
   - `getAssetUrl` with fallback via `moshpitMetadataStore.assetIdToHash`
     for OSS assets. MoshpitView.test.ts gained 92 lines covering the Enter
     gate (toast on <2; enter on ≥2; no-op while active).
3. **`src/locales/en/main.json`** — `moshpit.tournament.*` (13 keys:
   needTwoToast{Summary,Detail}, noWinnersToast{Summary,Detail},
   pairCounter, assetAlt, legend.{pickA,pickB,skip,mode,flip,peek,exit})
   and `moshpit.peek.*` (15 param labels + panelTitle + loadingMetadata +
   lora.{sectionTitle,empty}). Winner screen keys added post-UAT under
   `moshpit.tournament.winner.*`.
4. **`deferred-items.md`** — @moshpit Playwright spec deferred with full
   rationale inheriting the Phase-4 tsconfig:browser blocker; pre-existing
   assetsStore.test.ts failure + 6 floating-promises lint errors +
   i18n-unused-key warning catalogued as out-of-scope.
5. **`05-HUMAN-UAT.md`** — 11 D-25 scenarios with verification checkboxes,
   qualitative question, and structured sign-off section. All 11 verified
   and approved on 2026-04-23.

### Post-UAT hardening (Tasks 6+, in-scope fixes surfaced during dogfood)

6. **Canvas selection (`b114f85aa`)** — `feat(moshpit): canvas selection
via click, ctrl+click, and marquee`. Sprite hit-test API on
   `useMoshpitSpriteLayer`, selection ring Graphics layer, click /
   ctrl+click / shift+click / marquee selection in `MoshpitView.vue`.
   UAT Scenario 1 revealed the canvas had no way to select assets — the
   Enter gate was verifiable in tests but unreachable via mouse on the
   actual UI.
7. **Marquee gating + window keybindings (`76a9b0d09`)** — `fix(moshpit):
gate marquee on Cmd/Ctrl; attach tournament keys to window`. Plain
   left-drag pans the canvas again (marquee requires Cmd/Ctrl at
   pointerdown). Tournament keybindings moved from a DialogContent
   template-ref target to `window` capture phase because Reka's
   DialogContent ref returns a component instance, not an HTMLElement —
   `useEventListener` was silently attaching to `null`. Active-state gate
   on `tournamentStore.isActive` preserves scope semantics.
8. **Overlap wipe + pick pulse (`4a719cd82`)** — `fix(moshpit-tournament):
invert overlap wipe + add pick-pulse feedback`. clipPath flipped from
   right-clip to left-clip so the divider IS the visible A↔B boundary.
   Store gained `lastPickedSide` + `pickPulseId` monotonic scalar;
   MoshpitTournamentPair renders a green-gradient pulse on the picked half
   via CSS transition keyed on pulseId.
9. **Winner screen (`7c6352c91`)** — `feat(moshpit-tournament): add winner
screen at tournament completion`. `MoshpitTournamentWinner.vue` hero +
   metadata summary, rendered on tournament completion before overlay
   unmount. Enter/Esc/Space acknowledge and close (winner-set still
   applied to canvas selection via existing exit() path). 54 lines of
   new store state + 167-line test suite. Also adds `winnerHash` /
   `hasWinner` / `acknowledgeWinner` to the store and new i18n keys
   under `moshpit.tournament.winner.*`.
10. **Modal framing polish (`eada31568`, `e6275c74c`, `1d69ae0db`,
    `361a2643a`)** — overlay reframed as a bounded modal on a Comfy
    panel-surface background with a stronger backdrop dim and a z-index
    above MoshpitLayout. Aligns with the rest of the workbench's dialog
    patterns.

## Requirements Closed

Phase 5 closes the full TOUR + PEEK requirement block:

| Req     | Description                                  | Verified at                                     |
| ------- | -------------------------------------------- | ----------------------------------------------- |
| TOUR-01 | Enter-with-≥2 mounts overlay; <2 toasts      | MoshpitView.test.ts + UAT Scenario 1            |
| TOUR-02 | Three display modes cycle via [/]            | Pair.test.ts + Overlay.test.ts + UAT Scenario 2 |
| TOUR-03 | Overlap horizontal wipe (pointer + keyboard) | Pair.test.ts + UAT Scenario 3                   |
| TOUR-04 | A/B flip via Space                           | Pair.test.ts + UAT Scenario 4                   |
| TOUR-05 | Ephemeral store (no IDB persistence)         | tournamentStore.test.ts file-scan invariant     |
| TOUR-06 | Round-robin + single-elim brackets           | tournamentBracket.test.ts + UAT Scenarios 5 + 8 |
| TOUR-07 | Esc exit semantics (D-07/D-08)               | tournamentStore.test.ts + UAT Scenarios 9 + 10  |
| TOUR-08 | Full-res preload on entry                    | tournamentStore.test.ts preload block           |
| PEEK-01 | Peek default closed, slides in on M          | PeekPanel.test.ts + Overlay.test.ts + UAT 6     |
| PEEK-02 | Param diff rows + labels                     | metadataDiff.test.ts + PeekPanel.test.ts        |
| PEEK-03 | LoRA set-diff (permutation-invariant)        | metadataDiff.test.ts (2 fast-check properties)  |

## Deviations from Plan

### Rule 2 — Add missing critical functionality (in-scope for UAT to pass)

**1. Canvas selection gestures did not exist on MoshpitCanvas.**

- **Found during:** Task 5 UAT Scenario 1 dogfood
- **Issue:** Plan 05-06 assumed the user could select 2+ assets on the
  canvas before pressing Enter. The canvas had no click / marquee /
  ctrl-click wiring — selection state existed in `moshpitSelectionStore`
  but no gesture bound to populate it.
- **Fix:** Added sprite hit-test API on `useMoshpitSpriteLayer`, a
  Graphics selection-ring layer, and click / ctrl+click / shift+click /
  marquee gestures in `MoshpitView.vue`. 261 lines net across canvas +
  sprite layer + viewport injection + view.
- **Commit:** `b114f85aa`

**2. Tournament keybindings silently attached to `null`.**

- **Found during:** UAT Scenario 4 (Space did nothing)
- **Issue:** `useMoshpitTournamentKeybindings(dialogContentRef)` received
  a Reka `DialogContent` component instance ref, not an `HTMLElement`.
  `useEventListener(ref, 'keydown', …)` silently attached the listener
  to `null` because the ref value wasn't a DOM node.
- **Fix:** Moved the listener to `window` capture phase, gated on
  `tournamentStore.isActive`. Preserves scope (no-op when inactive) and
  no longer depends on a Reka-internal ref shape.
- **Commit:** `76a9b0d09`

**3. Plain left-drag was being consumed by the (new) marquee logic.**

- **Found during:** UAT post-fix verification
- **Issue:** The fix above added marquee on plain left-pointerdown,
  breaking pixi-viewport's pan gesture.
- **Fix:** Gated marquee on `ev.ctrlKey || ev.metaKey` at pointerdown.
  Plain left-drag pans again; Cmd/Ctrl-drag marquees.
- **Commit:** `76a9b0d09` (same commit)

### Rule 1 — Auto-fix bugs

**4. Overlap clip inverted; divider visually disconnected from A↔B seam.**

- **Found during:** UAT Scenario 3
- **Issue:** `clipPath: inset(0 {wipe*100}% 0 0)` clipped B from the
  RIGHT. User expected the divider line to BE the boundary; instead the
  B image was being clipped at a seam that didn't align with the draggable
  divider.
- **Fix:** Flipped to `inset(0 0 0 {wipe*100}%)` — now the divider's
  horizontal position IS the seam between A (left) and B (right).
- **Commit:** `4a719cd82`

**5. No pick feedback.**

- **Found during:** UAT Scenario 5
- **Issue:** Picking A/B advanced the pair with no visible confirmation.
  Felt dead.
- **Fix:** Store gained `lastPickedSide` + `pickPulseId` scalar; Pair
  renders a CSS-only green gradient pulse on the picked half keyed on
  pulseId. No JS tween. 63 lines.
- **Commit:** `4a719cd82` (same commit)

### Rule 2 — Add missing functionality (UX polish)

**6. Winner screen added on tournament completion.**

- **Found during:** UAT Scenario 7 post-verification
- **Issue:** Overlay unmounted abruptly on completion. User asked "who
  won?" — the winner-set replaced selection on canvas but there was no
  in-overlay celebration / summary.
- **Fix:** `MoshpitTournamentWinner.vue` hero + metadata summary,
  Enter/Esc/Space to acknowledge and close. Store gained `winnerHash`,
  `hasWinner`, `acknowledgeWinner`. Overlay renders Winner view when
  `hasWinner && !isActive`. 195-line component + 167-line test suite.
- **Commit:** `7c6352c91`

### Rule 1 — Modal framing fixes

**7. Overlay sat on raw background; z-index below MoshpitLayout; backdrop too weak.**

- **Found during:** UAT Scenarios 1 + 6 aesthetic pass
- **Fix:** Reframed overlay as a bounded modal with panel-surface
  background, stronger backdrop dim, z-50+ above MoshpitLayout, Comfy
  panel alignment.
- **Commits:** `eada31568`, `e6275c74c`, `1d69ae0db`, `361a2643a`

No architectural changes required. No auth gates. No CLAUDE.md directives
violated.

## Full-suite Test Results

- **Moshpit unit suite:** 625/625 green across all Plan 05 test files
  (`pnpm test:unit -- --run src/platform/moshpit src/views/MoshpitView.test.ts`).
- **`pnpm typecheck`:** clean. No new errors introduced by Plan 05-06.
- **`pnpm lint`:** 2860 warnings (pre-existing), 6 `no-floating-promises`
  errors (all pre-existing in `src/utils/widgetUtil.test.ts`,
  `src/composables/useMoshpitCommands.test.ts`, and
  `src/platform/moshpit/services/sortMath.test.ts`).
- **`pnpm knip`:** no new dead exports from Plan 05-06.
- **`pnpm test:browser:local --grep @moshpit`:** NOT RUN — spec deferred
  per Pitfall 5 (see `deferred-items.md`).
- **`src/stores/assetsStore.test.ts`:** pre-existing 1-test failure
  (`expected undefined to be null` on historyError) — verified unrelated
  to Phase 5 scope; documented in `deferred-items.md`.

## Deferred Items

See `deferred-items.md` for full rationale on:

- `browser_tests/tests/moshpit/moshpit-tournament.spec.ts` (inherits
  Phase 4 tsconfig:browser blocker; covered by unit + UAT).
- `src/stores/assetsStore.test.ts` pre-existing failure.
- 6 `no-floating-promises` lint errors in pre-existing test files.
- i18n unused-key warning on `moshpit.peek.params.*` (dynamic
  template-literal lookup — false positive by static analysis).

## Final Overlay Composition

The shipped overlay differs slightly from the plan's `<interfaces>` skeleton:

1. **`v-model:open` proxy** — shipped exactly as planned (single two-way
   binding, no separate `:open` + `@update:open`).
2. **Escape routing** — `@escape-key-down="onEscape"` on DialogContent;
   `onEscape()` calls `tournamentStore.exit('esc')`. Idempotent because
   the store guards with `if (!isActive.value) return`.
3. **Keybindings attach point** — NOT the DialogContent ref; attached to
   `window` capture phase gated on `isActive` (see Deviation #2).
4. **Winner screen** — `v-if="hasWinner"` branch renders
   `MoshpitTournamentWinner` in place of Pair + Peek + legend. Not in the
   plan's skeleton; added post-UAT.
5. **Modal framing** — bounded modal with panel-surface background +
   stronger backdrop + z-50, not the planned full-bleed
   `fixed inset-0 z-50 flex flex-col`. Post-UAT styling polish.

## Notes for Phase 6 Executor (Curation)

Phase 6 inherits the winner-set selection primitive demonstrated here.
`tournamentStore.exit()` + `selectionStore.setSelection(winners)` is the
canonical handoff path for "commit a derived subset of the current
selection back to the canvas". Curation's "shortlist" operations should
mirror this — never mutate the selection during a sub-flow; only
replace it at the explicit commit step.

The canvas-selection gesture additions (`b114f85aa`) give Phase 6 a
solid substrate: sprite hit-test, selection-ring Graphics layer, and
ctrl/meta-gated marquee are all reusable for folder-assign / tag-apply
/ favourite-toggle batch operations.

Closing note: **Phase 5 shipped; Phase 6 (Curation) depends on the
winner-set selection primitive demonstrated here.**

## Self-Check: PASSED

- `src/platform/moshpit/components/MoshpitTournamentOverlay.vue` — FOUND
- `src/platform/moshpit/components/MoshpitTournamentOverlay.test.ts` — FOUND
- `src/platform/moshpit/components/MoshpitTournamentWinner.vue` — FOUND
- `src/platform/moshpit/components/MoshpitTournamentWinner.test.ts` — FOUND
- `src/views/MoshpitView.vue` modified (Enter gate + overlay mount + selection gestures) — FOUND
- `src/locales/en/main.json` with moshpit.tournament._ + moshpit.peek._ — FOUND
- `05-HUMAN-UAT.md` signed off 2026-04-23 with all 11 scenarios `[x]` — FOUND
- `deferred-items.md` with @moshpit spec deferral + pre-existing catalog — FOUND
- Commit `b4e62f827` (overlay) — FOUND
- Commit `5041824d8` (MoshpitView wire-up) — FOUND
- Commit `e2c4ecef6` (E2E deferral) — FOUND
- Commit `d31821e25` (HUMAN-UAT scenarios) — FOUND
- Commit `b114f85aa` (canvas selection) — FOUND
- Commit `76a9b0d09` (marquee gating + window keybindings) — FOUND
- Commit `4a719cd82` (overlap wipe + pick pulse) — FOUND
- Commit `7c6352c91` (winner screen) — FOUND
- Commit `eada31568` (modal framing) — FOUND
- Commit `e6275c74c` (bounded modal) — FOUND
- Commit `1d69ae0db` (backdrop dim) — FOUND
- Commit `361a2643a` (z-index) — FOUND
- Commit `ad4993304` (UAT sign-off) — FOUND
- Moshpit unit suite 625/625 green
- `pnpm typecheck` clean
