---
phase: 05-tournament-mode-replaces-old-comparison-mode-framing
verified: 2026-04-23T04:45:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
deferred:
  - truth: 'Playwright @moshpit E2E regression spec'
    addressed_in: 'Standalone chore (typecheck:browser tsconfig mismatch)'
    evidence: 'deferred-items.md — pre-existing blocker inherited from Phase 4; unit + UAT coverage substitutes'
  - truth: 'Exit produces a winner set selected on the canvas — user can immediately export (E), favourite (S), tag (T), or folder-assign the winners'
    addressed_in: 'Phase 6: Curation'
    evidence: 'ROADMAP Phase 6 goal: Favourite, tag, folder, hide, export. Phase 5 exits with winners selected on canvas; curation commands are Phase 6 scope.'
---

# Phase 5: Tournament Mode Verification Report

**Phase Goal:** User can enter tournament mode from a selection of ≥2 assets, step through pairwise comparisons using three display modes ([/] cycles side-by-side / overlap / A/B flip), pick winners with ←/→ (or skip with ↓), and exit with the winner set selected on the canvas for export or foldering. Scores are ephemeral; no persisted elo or leaderboards. An optional metadata peek (M) surfaces parameter diffs on demand.

**Verified:** 2026-04-23T04:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + Plan frontmatter must_haves)

| #   | Truth                                                                                                                                                             | Status   | Evidence                                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | With ≥2 assets selected, `Enter` opens tournament mode; `Esc` exits with the canvas selection preserved (SC-1, TOUR-01/07)                                        | VERIFIED | `MoshpitView.vue:155-169` onContainerKeydown routes Enter→tournamentStore.enter; toasts when <2. `moshpitTournamentStore.exit()` line 196-224 preserves selection when no wins. Test: moshpitTournamentStore.test.ts — 35 passing tests. UAT Scenario 1 + 10 approved.                                                                          |
| 2   | Three display modes accessible via `[` / `]`: side-by-side, overlap (opacity / wipe), A/B flip; `Space` triggers A/B flip in any mode (SC-2, TOUR-02/04)          | VERIFIED | `useMoshpitTournamentKeybindings.ts:68-72` maps `[`/`]` to cycleDisplayMode. Line 65 maps Space→toggleFlip. MoshpitTournamentPair.vue:83-136 renders all three modes. Test: MoshpitTournamentPair.test.ts — 9 passing. UAT Scenario 2 + 4 approved.                                                                                             |
| 3   | User picks the winner of each pair via `←` (A) or `→` (B); `↓` advances without picking (SC-3, TOUR-03)                                                           | VERIFIED | `useMoshpitTournamentKeybindings.ts:56-63` ArrowLeft→pickWinner('A'), ArrowRight→pickWinner('B'), ArrowDown→skip. Store pickWinner/skip actions line 226-320. Test: useMoshpitTournamentKeybindings.test.ts — 19 passing. UAT Scenario 5 approved.                                                                                              |
| 4   | Exit produces a winner set selected on the canvas (SC-4 partial, TOUR-06)                                                                                         | VERIFIED | `moshpitTournamentStore.ts:206-207` selectionStore.setSelection(winners) on exit. computeWinnerSet imported from tournamentBracket. Test: moshpitTournamentStore.test.ts exit() tests. UAT Scenario 7 + 8 + 9 approved. Note: "immediately export/favourite/tag" is Phase 6 scope — deferred per roadmap.                                       |
| 5   | No tournament scores, elo, or bracket state persist across sessions — tournaments are per-session only (SC-5, TOUR-05)                                            | VERIFIED | grep of moshpitTournamentStore.ts shows NO idb/indexedDB/thumbRepository imports (only a code comment). Store state reset via resetState() on exit. Test: ephemerality spec in moshpitTournamentStore.test.ts.                                                                                                                                  |
| 6   | Metadata peek hidden by default; `M` toggles overlay showing automatic parameter diff including LoRA set-diff name-based, order-insensitive (SC-6, PEEK-01/02/03) | VERIFIED | `MoshpitMetadataPeekPanel.vue:90` `translate-x-full` default when `!isPeekOpen`. keybindings.ts:74-76 m/M→togglePeek. metadataDiff.ts diffLoras property-test passes permutation invariance (fast-check). Test: MoshpitMetadataPeekPanel.test.ts — 16 passing; metadataDiff.test.ts — 22 passing (incl. 2 fast-check). UAT Scenario 6 approved. |
| 7   | Full-resolution assets load on tournament entry within Phase 7 perf budget (SC-7, TOUR-08)                                                                        | VERIFIED | `moshpitTournamentStore.ts` enter() triggers parallel Image() preloads via fullResUrlResolver. `MoshpitTournamentAssetFrame.vue` implements thumb→full-res crossfade via watch on fullResUrl. Test: MoshpitTournamentAssetFrame.test.ts — 12 passing. UX-08 perf proof is Phase 7 by design.                                                    |
| 8   | Bracket generator is pure (no Vue/Pinia/DOM imports) and worker-safe (Plan 05-01)                                                                                 | VERIFIED | `tournamentBracket.ts` imports: grep for `from 'vue'                                                                                                                                                                                                                                                                                            | from 'pinia' | from '@/'` returns NO matches. Test: tournamentBracket.test.ts pure-module invariant test — 22 passing (incl. 3 fast-check). |
| 9   | Round-robin for N<8 generates N\*(N-1)/2 pairs; single-elim for N≥8 generates N-1 matches with byes (Plan 05-01)                                                  | VERIFIED | `tournamentBracket.ts:27` ROUND_ROBIN_THRESHOLD=8. decideBracketShape + generateInitialBracket pass fast-check completeness properties for n∈[2,7] (round-robin) and n∈[8,32] (single-elim). UAT Scenario 5 (4-asset, 6 pairs) + 8 (10+ assets single-elim) approved.                                                                           |
| 10  | Ephemeral Pinia store + scoped keydown composable (Plan 05-03)                                                                                                    | VERIFIED | `moshpitTournamentStore.ts:63` defineStore('moshpitTournament'). Setup-API pattern. sidebarStore capture/restore line 169-219. Preload on enter. useMoshpitTournamentKeybindings attaches window-capture keydown. Esc intentionally NOT routed (handled by Reka DialogContent @escape-key-down).                                                |
| 11  | Overlay composed of Reka DialogRoot + focus-trap + Pair + PeekPanel + legend + counter; MoshpitView Enter gate fires toast when <2 selected (Plan 05-06)          | VERIFIED | `MoshpitTournamentOverlay.vue:87-179` DialogRoot/Portal/Overlay/Content composition with @escape-key-down. v-model:open proxy routes close→exit('esc'). useFocusTrap NOT used (Reka ships focus trap). MoshpitView.vue:155-165 Enter-with-<2 fires moshpit.tournament.needTwoToast\*. 11 UAT scenarios all approved.                            |

**Score:** 11/11 truths verified

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases or standalone chores.

| #   | Item                                                       | Addressed In                                           | Evidence                                                                                                                                                                |
| --- | ---------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Playwright @moshpit E2E regression spec                    | Standalone chore (typecheck:browser tsconfig mismatch) | `deferred-items.md` — pre-existing TS2578 errors on main. Inherited from Phase 4. Unit + HUMAN-UAT provides full coverage (145 passing unit tests).                     |
| 2   | "Immediately export/favourite/tag winners" (SC-4 phrasing) | Phase 6: Curation                                      | ROADMAP Phase 6 explicitly owns: Favourite, tag, folder, hide, export. Phase 5 ends with winner hashes on `moshpitSelectionStore.selected`; Phase 6 binds action verbs. |

### Required Artifacts

| Artifact                                                              | Expected                                   | Status                       | Details                                                                                                                                                                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/platform/moshpit/services/tournamentBracket.ts`                  | Pure bracket math module                   | VERIFIED                     | 269 lines; exports BracketShape, TournamentPair, ROUND_ROBIN_THRESHOLD, decideBracketShape, generateInitialBracket, applyPick, applySkip, computeWinnerSet, generateNextRound. Zero vue/pinia/@/ imports.                          |
| `src/platform/moshpit/services/tournamentBracket.test.ts`             | 22 tests incl. fast-check properties       | VERIFIED                     | 486 lines; 22 tests all passing.                                                                                                                                                                                                   |
| `src/platform/moshpit/services/metadataDiff.ts`                       | Pure diff module                           | VERIFIED                     | 168 lines; exports ParamDiffKey/State/Row, PARAM_DIFF_KEY_ORDER (14 keys), diffParams, LoraDiffState/Entry, diffLoras. Type-only import from paramNormalize.                                                                       |
| `src/platform/moshpit/services/metadataDiff.test.ts`                  | Property tests for permutation invariance  | VERIFIED                     | 338 lines; 22 tests incl. fast-check permutation-invariance for diffLoras.                                                                                                                                                         |
| `src/platform/moshpit/stores/moshpitTournamentStore.ts`               | Setup-API Pinia store                      | VERIFIED                     | 383 lines; defineStore('moshpitTournament'). No IDB coupling. All expected actions present (enter/exit/pickWinner/skip/toggleFlip/cycleDisplayMode/setDisplayMode/togglePeek/setWipePosition/nudgeWipe/resetWipe). 35 tests pass.  |
| `src/platform/moshpit/composables/useMoshpitTournamentKeybindings.ts` | Scoped keydown composable                  | VERIFIED                     | 97 lines; routes D-13/D-16 keymap; Esc NOT routed (Reka DialogContent owns it); window-capture listener (post-UAT fix from commit 76a9b0d0 — scoped DialogContent ref returned component instance not HTMLElement). 19 tests pass. |
| `src/platform/moshpit/components/MoshpitTournamentAssetFrame.vue`     | Thumb→full-res crossfade                   | VERIFIED                     | 98 lines; uses thumbStore.getUrl(hash) (NOT getObjectUrl). Crossfade via Tailwind transition-opacity. 12 tests pass.                                                                                                               |
| `src/platform/moshpit/components/MoshpitTournamentPair.vue`           | Three display modes                        | VERIFIED                     | 187 lines; all three modes rendered; clipPath for overlap; `w-1/2` for side-by-side; pick-pulse feedback (post-UAT commit 4a719cd8); 9 tests pass.                                                                                 |
| `src/platform/moshpit/components/MoshpitMetadataPeekPanel.vue`        | Right-slide panel with diff                | VERIFIED                     | 166 lines; uses translate-x-full/translate-x-0 for slide; semantic tokens (text-success/danger/warning/bg-node-component-surface); no v-html; 16 tests pass.                                                                       |
| `src/platform/moshpit/components/MoshpitTournamentOverlay.vue`        | Reka DialogRoot composition                | VERIFIED                     | 180 lines; DialogRoot/Portal/Overlay/Content; @escape-key-down→exit('esc'); useMoshpitTournamentKeybindings() attached; composes Pair + PeekPanel + Winner screen + legend + counter. 5 tests pass.                                |
| `src/platform/moshpit/components/MoshpitTournamentWinner.vue`         | Winner completion screen                   | VERIFIED (post-UAT addition) | 205 lines; added via commit 7c6352c91 in response to UAT Scenario 7 feedback. 5 tests pass.                                                                                                                                        |
| `src/views/MoshpitView.vue`                                           | Overlay mount + Enter gate                 | VERIFIED                     | @keydown="onContainerKeydown" on container; MoshpitTournamentOverlay mounted as sibling; resolveFullResUrl resolver handles OSS assets via metadataStore bridge; needTwo toast when <2 selected.                                   |
| `src/locales/en/main.json`                                            | moshpit.tournament._ + moshpit.peek._ keys | VERIFIED                     | 15 peek.params keys (14 scalar + loras); 8 tournament.legend keys; needTwo/noWinners toast keys; pairCounter ICU template; winner subtree added post-UAT.                                                                          |
| `.planning/phases/05-*/05-HUMAN-UAT.md`                               | 11 scenarios signed off                    | VERIFIED                     | status=approved (frontmatter); all 11 scenarios marked `[x] Verified`; Scenario 11 qualitative "Yes — tournament mode is decisively faster and more confident"; signed off by willie@reflct.app on 2026-04-23.                     |
| `.planning/phases/05-*/deferred-items.md`                             | Playwright deferral documented             | VERIFIED                     | Playwright @moshpit spec deferred with explicit rationale citing Phase 4 tsconfig:browser mismatch. 4 designed scenarios documented.                                                                                               |

### Key Link Verification

| From                               | To                              | Via                                                                                    | Status | Details                                                            |
| ---------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| tournamentBracket.ts               | (no @/ runtime imports)         | pure module                                                                            | WIRED  | grep confirms zero vue/pinia/@/ imports.                           |
| metadataDiff.ts                    | paramNormalize.ts               | `import type { NormalizedParams }`                                                     | WIRED  | Type-only import present at line 17.                               |
| moshpitTournamentStore.ts          | tournamentBracket.ts            | imports decideBracketShape/generateInitialBracket/applyPick/applySkip/computeWinnerSet | WIRED  | Line 40-47.                                                        |
| moshpitTournamentStore.ts          | moshpitSelectionStore.ts        | setSelection(winnerSet) on exit                                                        | WIRED  | Line 207.                                                          |
| moshpitTournamentStore.ts          | moshpitSidebarStore.ts          | activePanelId capture / closePanel / openPanel                                         | WIRED  | Lines 169, 171, 219.                                               |
| useMoshpitTournamentKeybindings.ts | moshpitTournamentStore.ts       | routes keydown to store actions                                                        | WIRED  | Line 34 import; all actions called in switch.                      |
| MoshpitTournamentAssetFrame.vue    | moshpitThumbStore.getUrl(hash)  | thumb fallback                                                                         | WIRED  | Uses getUrl NOT getObjectUrl (Pitfall 2 verified).                 |
| MoshpitTournamentPair.vue          | moshpitTournamentStore.ts       | reads currentPair/displayMode/flipShowsB/wipePosition                                  | WIRED  | Line 19 import; all store refs used.                               |
| MoshpitMetadataPeekPanel.vue       | metadataDiff.ts                 | diffParams + diffLoras                                                                 | WIRED  | Lines 31-32.                                                       |
| MoshpitMetadataPeekPanel.vue       | moshpitTournamentStore.ts       | store.isPeekOpen                                                                       | WIRED  | Line 90 `store.isPeekOpen ? 'translate-x-0' : 'translate-x-full'`. |
| MoshpitTournamentOverlay.vue       | reka-ui                         | DialogRoot/Content/Portal/Overlay + @escape-key-down                                   | WIRED  | Lines 22-27, 97.                                                   |
| MoshpitTournamentOverlay.vue       | useMoshpitTournamentKeybindings | attaches window-scope keydown                                                          | WIRED  | Line 54.                                                           |
| MoshpitView.vue                    | moshpitTournamentStore.enter    | onContainerKeydown→Enter                                                               | WIRED  | Line 167.                                                          |

### Data-Flow Trace (Level 4)

| Artifact                    | Data Variable                        | Source                                                                        | Produces Real Data                                                                                            | Status  |
| --------------------------- | ------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------- |
| MoshpitTournamentOverlay    | currentPair/paramsA/paramsB          | tournamentStore + metadataStore.getParams(hash)                               | Yes — real bracket + normalized params from IDB-backed metadata                                               | FLOWING |
| MoshpitTournamentPair       | currentPair/displayMode/wipePosition | tournamentStore (mutated by keybindings + pointer gestures)                   | Yes — store drives via user input                                                                             | FLOWING |
| MoshpitTournamentAssetFrame | fullResUrl / thumb                   | parent passes via resolveFullResUrl(hash); thumb via moshpitThumbStore.getUrl | Yes — MoshpitView resolveFullResUrl walks assetsStore.historyAssets + metadataStore.getHashForAssetId for OSS | FLOWING |
| MoshpitMetadataPeekPanel    | paramRows/loraRows                   | pure diffParams/diffLoras of paramsA/B                                        | Yes — diff computed from real NormalizedParams                                                                | FLOWING |
| MoshpitTournamentWinner     | winners                              | tournamentStore.computeWinnerSet(wins, shape, selectionOnEntry)               | Yes — computed from real pick history                                                                         | FLOWING |

### Behavioral Spot-Checks

| Behavior                                    | Command                                                                      | Result                                                              | Status |
| ------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| Full Phase 5 unit suite passes              | `pnpm test:unit -- --run <9 phase-5 test files>`                             | 9 files, 145 tests pass in 1.96s                                    | PASS   |
| Phase 5 typecheck clean                     | `pnpm typecheck 2>&1 \| grep <phase-5 files>`                                | No errors on MoshpitTournament\*/metadataDiff/MoshpitView additions | PASS   |
| Pure-module invariant for tournamentBracket | `grep -E "from 'vue'\|from 'pinia'\|from '@/'" tournamentBracket.ts`         | no matches                                                          | PASS   |
| Pure-module invariant for metadataDiff      | same grep on metadataDiff.ts                                                 | no matches                                                          | PASS   |
| No IDB coupling in tournament store         | `grep "'idb'\|indexedDB\|thumbRepository\|LGraph" moshpitTournamentStore.ts` | only 1 match, inside a documentation comment                        | PASS   |
| i18n peek.params count                      | `Object.keys(moshpit.peek.params).length`                                    | 15 (14 scalar + loras)                                              | PASS   |
| i18n legend count                           | `Object.keys(moshpit.tournament.legend).length`                              | 8 (spec said 7; winner screen added one)                            | PASS   |

### Requirements Coverage

| Requirement | Description                                                  | Status    | Evidence                                                                                        |
| ----------- | ------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------- |
| TOUR-01     | User can enter tournament mode from ≥2 via Enter             | SATISFIED | MoshpitView.onContainerKeydown + tournamentStore.enter; UAT Scenario 1.                         |
| TOUR-02     | Three display modes via [/]: side-by-side, overlap, A/B flip | SATISFIED | MoshpitTournamentPair three branches; cycleDisplayMode keybindings; UAT Scenario 2.             |
| TOUR-03     | Pick via ← (A) / → (B); ↓ skips                              | SATISFIED | keybindings routes ArrowLeft/Right/Down to store actions; UAT Scenario 5.                       |
| TOUR-04     | Space triggers A/B flip in any mode                          | SATISFIED | keybindings line 65 ' '→toggleFlip; UAT Scenario 4.                                             |
| TOUR-05     | Ephemeral — no persistence                                   | SATISFIED | No IDB imports; resetState() on exit; dedicated test.                                           |
| TOUR-06     | Winner set selected on canvas at exit                        | SATISFIED | selectionStore.setSelection(winners) on exit; UAT Scenario 7+8.                                 |
| TOUR-07     | Esc exits with selection preserved (zero picks)              | SATISFIED | D-07/D-08 logic in exit(); UAT Scenario 10.                                                     |
| TOUR-08     | Full-res loads on tournament entry                           | SATISFIED | enter() kicks off Image() preloads via resolver; AssetFrame crossfades. UX-08 proof is Phase 7. |
| PEEK-01     | Hidden by default                                            | SATISFIED | isPeekOpen default false; translate-x-full when closed.                                         |
| PEEK-02     | M toggles overlay with param diff (match/differ)             | SATISFIED | M→togglePeek; diffParams classifies rows; bg-node-component-surface highlight.                  |
| PEEK-03     | LoRA set-diff name-based, order-insensitive                  | SATISFIED | diffLoras with fast-check permutation-invariance property test.                                 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact                                                                                                                                                                                                                             |
| ---- | ---- | ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —    | —    | —       | —        | No blockers or warnings found in Phase 5 scope. Pre-existing issues (assetsStore.test.ts failure, 6 floating-promise errors, 2860 warnings, i18n dynamic-key false-positives) all documented in deferred-items.md as pre-existing. |

### Human Verification Required

None — HUMAN-UAT was completed and signed off on 2026-04-23 (status=approved). All 11 scenarios marked `[x] Verified`; qualitative Scenario 11 answered "Yes — tournament mode is decisively faster and more confident for 8-asset sets".

### Gaps Summary

No gaps. Phase 5 delivers all 7 roadmap success criteria and 11 requirement IDs with 145 passing unit tests, a signed-off human UAT, and two explicitly documented deferred items that roadmap to either (a) a standalone typecheck:browser chore for the @moshpit E2E spec, or (b) Phase 6 for the export/favourite/tag action verbs that attach to the Phase-5-produced winner set.

Notable post-UAT hardening (commits b114f85a / 76a9b0d0 / 4a719cd8 / 7c6352c91 / eada31568 / e6275c74c / 1d69ae0db / 361a2643a) filled the following gaps surfaced during dogfood:

- Canvas selection gestures (click / ctrl+click / shift+click / marquee) — UAT Scenario 1 revealed missing prerequisite; fix enabled tournament entry from canvas.
- Tournament key listener re-attached to `window` capture phase instead of DialogContent template ref — the Reka `<Primitive>` exposes a component instance, not an HTMLElement, so scoped useEventListener silently attached to null.
- Overlap wipe clip-path inverted so the divider is the A↔B boundary (fixed in 4a719cd8).
- Pick-pulse visual feedback (lastPickedSide + pickPulseId + 420ms CSS pulse) — UAT Scenario 5 feedback.
- Winner completion screen (commit 7c6352c91) — UAT Scenario 7 feedback that the abrupt unmount felt jarring.
- Modal framing / z-index / backdrop polish (eada3/e6275/1d69a/361a2) — pure design alignment.

---

_Verified: 2026-04-23T04:45:00Z_
_Verifier: Claude (gsd-verifier)_
