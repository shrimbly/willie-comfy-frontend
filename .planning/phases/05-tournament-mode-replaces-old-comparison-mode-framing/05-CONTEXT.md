# Phase 5: Tournament Mode - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship tournament mode: an ephemeral, pairwise-comparison focus mode entered from a canvas selection of ≥2 assets. Three display modes (side-by-side / overlap / A/B flip) cycle with `[`/`]`; `Space` triggers A/B flip in any mode; `←`/`→` pick winners; `↓` skips. Exit via `Esc` (selection preserved) or completing the bracket (winner set replaces selection). Opt-in metadata peek via `M` shows automatic parameter diff including LoRA set-diff (name-based, order-insensitive). Full-resolution assets load on entry. All tournament state is per-session — no IDB writes, no elo, no persisted brackets.

**Requirements in-scope:** TOUR-01..08, PEEK-01..03.

**Out of scope:**

- Curation mutations from the winner set (favourite / tag / folder / hide / export) — Phase 6 owns those. Phase 5 exits with winners selected and hands off.
- Persisted tournament state, scores, elo, leaderboards, saveable brackets — explicit PRD non-goal (§4 Non-goals); v2-TOUR-01/02/03.
- Cross-cluster or "per-cluster best-of" scoping — v2-TOUR-03.
- Frame-budget / full-res perf proof — Phase 7 (UX-08 is Phase 7).
- Peek colour/typography treatment — PRD §9 design detail; Phase 5 ships structural diff with semantic tokens, design pass in Phase 7 if dogfood demands it.
- Mobile / touch affordances for the wipe divider and tournament shortcuts — desktop-first posture.
- Changes to `moshpitSelectionStore`, `moshpitFilterStore`, `paramNormalize`, or `thumbRepository` schema — tournament is a consumer only.
- New keybindings infrastructure — tournament uses scoped keydown at overlay level, not `commandStore` / `keybindingStore`.

</domain>

<decisions>
## Implementation Decisions

### Bracket Algorithm

- **D-01: Adaptive bracket shape.** On tournament entry with selection size `N`:
  - `N < 8` → **round-robin**. All `N*(N-1)/2` unique unordered pairs are generated.
  - `N ≥ 8` → **single-elimination**. `N-1` comparisons across `⌈log2(N)⌉` rounds. When `N` is not a power of 2, give byes to the first `(nextPow2(N) - N)` seeds (first-seen order) to round out the first round.
  - Bracket shape is decided once on entry and fixed for the session. The threshold (`8`) is a decision variable — easy to tune in a constant.
- **D-02: Pair ordering is deterministic by canvas selection order.** The input to the bracket generator is the ordered array of `assetHash` drawn from `moshpitSelectionStore.selected` (which is the order assets were added to the selection). Round-robin iterates pairs in lexicographic order of seed indices: `(0,1), (0,2), … (0,N-1), (1,2), …`. Single-elim seeds in selection order. Re-entering the tournament with the same selection set gives the same bracket.
- **D-03: Skip re-queues the pair at the end.** In round-robin, skipped pair is removed from its current position and pushed onto the tail of the queue so the user can come back to it; tournament completes when the queue is empty. In single-elim, skip is treated as a bye for the first asset of the pair (it advances) AND the pair is recorded in `skippedPairs` so the second asset is flagged as "no-decision" — it does not count as a loss and the asset is eligible for the final winner set if it somehow re-surfaces later (it won't in single-elim, but the flag informs the winner-set computation per D-06).
- **D-04: Visible counter + `Esc` exits early.** A small `Pair M / N` indicator sits in the tournament chrome (top-left or top-center, one line). `Esc` at any time triggers graceful exit with the winner-set-so-far (see D-06/D-07). No explicit "Finish now" button — `Esc` carries both "cancel" and "I've seen enough, lock in what I have" semantics, disambiguated by whether any picks were made (D-07).
- **D-05: Pair payload.** The bracket generator produces an iterable of `TournamentPair { seedA: number; seedB: number; assetHashA: string; assetHashB: string; index: number; total: number }`. Pure function; no Vue reactivity inside `tournamentBracket.ts`.

### Winner Set

- **D-06: Winner-set rule is bracket-aware.**
  - **Round-robin:** winner set = top assets by `wins` count, descending. Cutoff: keep the top 3 by wins, including all assets tied with the 3rd-place win count (ties promote, not demote). Skipped pairs contribute neither wins nor losses. If fewer than 3 assets have any wins, return just those (may be 0, 1, or 2 — see D-07).
  - **Single-elim:** winner set = the champion (the asset with no losses at bracket end). Single element.
  - If user exits early via `Esc` **after** picking ≥1 pair, apply the same rule to wins-so-far.
- **D-07: Zero-picks fallback.** If the wins map is empty at exit (no picks landed, whether normal completion or early `Esc`), treat exit as a no-op: do NOT replace the canvas selection, emit a toast `moshpit.tournament.noWinnersToast` ("No winners picked — selection unchanged"). The selection is preserved exactly.
- **D-08: Selection semantics on exit.**
  - **Normal completion** (bracket exhausted) with ≥1 win recorded: call `moshpitSelectionStore.setSelection(winnerSet)` — selection is replaced with the winner hashes.
  - **`Esc` early exit** with ≥1 win recorded: same as normal completion — winner-set-so-far replaces selection. Matches "I've seen enough" semantics.
  - **`Esc` with zero wins**: preserve original selection (D-07).
  - No separate "preserve vs replace" control surface; the rule is inferred from wins-map state. Documented behaviour only.
- **D-09: Tournament always restarts fresh on entry.** No resume semantics. Every `Enter` re-derives the bracket from `moshpitSelectionStore.selected` and zeroes the wins map. Tournaments are ephemeral per PRD §5.8; partial bracket restoration contradicts that model and brittle "did the selection change?" checks aren't worth the code.

### Tournament UI Surface

- **D-10: Full-screen Vue overlay mounted inside `MoshpitView`.** New component `MoshpitTournamentOverlay.vue` rendered as a sibling of `MoshpitCanvas` / `MoshpitClusterOverlay` in `src/views/MoshpitView.vue`. Conditional mount (`v-if="tournamentStore.isActive"`) — when inactive, no DOM cost. Canvas stays mounted behind it (no Pixi re-init). Overlay spans `inset-0` with `bg-background/95 backdrop-blur-sm`. Matches the existing overlay pattern (`MoshpitEmptyGateOverlay`, `MoshpitClusterOverlay`).
- **D-11: Sidebar auto-collapses on tournament entry, restores on exit.** Read `moshpitSidebarStore.isCollapsed` at entry, force-collapse, restore previous value at exit. Matches the Phase 1 "canvas interaction collapses sidebar" pattern. Tournament is pixels-first per PEEK-01.
- **D-12: Ephemeral Pinia store.** New `src/platform/moshpit/stores/moshpitTournamentStore.ts` — Setup-API pattern consistent with the Moshpit store family. State shape:
  ```
  isActive: Ref<boolean>
  bracket: Ref<TournamentPair[]>          // frozen on entry
  currentPairIndex: Ref<number>           // 0-based cursor into bracket
  wins: Ref<Map<string, number>>          // assetHash → win count
  skippedPairIndexes: Ref<Set<number>>    // indexes re-queued or no-decision
  displayMode: Ref<'sideBySide' | 'overlap' | 'flip'>
  flipShowsB: Ref<boolean>                // A/B flip state; also used by Space in any mode
  isPeekOpen: Ref<boolean>                // M-toggled metadata peek
  wipePosition: Ref<number>               // 0..1 for overlap divider
  ```
  Actions: `enter(selection: string[])`, `pickWinner('A' | 'B')`, `skip()`, `toggleFlip()`, `setDisplayMode(mode)`, `togglePeek()`, `setWipePosition(n)`, `exit(trigger: 'esc' | 'complete')`. No IDB persistence — all state dies on exit.
- **D-13: Scoped keydown listener + VueUse `useFocusTrap`.** `MoshpitTournamentOverlay` mounts with `tabindex="-1"`, grabs focus on mount, and attaches a keydown listener to its own root via `useEventListener`. All tournament keys (`←`/`→`/`↓`/`Space`/`[`/`]`/`M`/`Esc`) handled locally with `event.stopPropagation()`. `useFocusTrap` (VueUse) ensures `Tab` stays within the overlay chrome. Canvas shortcuts (`F`/`Z`/`Cmd+A`/`Space`-pan) are naturally gated because their listeners are on `MoshpitView`'s container and the overlay eats the events before they bubble.
- **D-14: `Enter` trigger is container-local on `MoshpitView`.** Extend the existing `onContainerPointerDown`/keydown surface in `MoshpitView.vue` with an `Enter` handler: when `selection.size ≥ 2` AND `!tournamentStore.isActive`, call `tournamentStore.enter(selection.selected)`. No `commandStore` registration — keeps symmetry with the other container-local Moshpit shortcuts. Enter is a no-op with a toast when selection size < 2.

### Display Mode Mechanics

- **D-15: Side-by-side is a 50/50 vertical split with per-pane aspect-fit.** Two flex children each `w-1/2 h-full` hosting an `<img>` (or `<MoshpitTournamentAssetFrame>` component) with `object-contain` so each asset fits its half without cropping. Letterbox gaps filled with `bg-background`. Works for any aspect mix (portrait vs landscape); identical pixel budget per asset. No divider chrome in side-by-side (pure two-pane).
- **D-16: Overlap mode = horizontal wipe with draggable divider + keyboard nudge.** Both assets layered; asset A is absolute-positioned full-frame underneath, asset B is on top clipped by CSS `clip-path: inset(0 X% 0 0)` where `X = wipePosition * 100`. A vertical 2px divider line with a pill grab-handle sits at the wipe boundary. Pointer drag on the divider (or anywhere on the overlay) moves `wipePosition`. Keyboard nudge: `[`/`]` are reserved for mode switch and `←`/`→` for picks, so **`,`/`.`** (the keys sitting at `<`/`>`) nudge the divider ±5% and **`Shift+,`/`Shift+.`** move ±20%. `/` resets divider to center. This keymap avoids all conflicts with pick/skip/mode-switch and is discoverable via the in-overlay legend (D-19).
- **D-17: A/B flip = manual only, `Space` toggles `flipShowsB` in any mode.** In flip-mode the overlay shows a single asset full-frame (the one currently indicated by `flipShowsB`); `Space` swaps it. In side-by-side or overlap, `Space` also toggles `flipShowsB` but its visual effect is to highlight the asset chrome for the "active" side (brief 150ms border pulse) — primarily useful as a "which one am I looking at" affordance. No auto-cycle, no hold-to-flicker. `Space` never pans in tournament mode (canvas `Space`-pan is gated by the overlay keydown listener per D-13).
- **D-18: Display mode switching is an instant swap.** `[` / `]` cycles through `['sideBySide', 'overlap', 'flip']` (`[` = previous, `]` = next, wraps). No transition animation — mode change is synchronous DOM update. Current pair is preserved across mode changes; wins state, `flipShowsB`, and `wipePosition` also persist so users can cycle modes to find the best view and switch back.
- **D-19: Minimal chrome legend.** A single row at the bottom of the overlay shows the essential keys — `← win A`, `→ win B`, `↓ skip`, `[ ] mode`, `Space flip`, `M peek`, `Esc exit` — rendered in `text-xs text-muted-foreground`. No popover help, no tutorial. The pair counter (D-04) sits in the top-left. Both are semantic-token styled and collapsible to a single line for short viewports.

### Metadata Peek

- **D-20: Right-side panel, pushes assets left.** `MoshpitMetadataPeekPanel.vue` renders on the right edge of the overlay when `isPeekOpen` is true. Width: `w-96` (24rem, ~384px). Assets pane shrinks to `flex-1` / `calc(100% - 24rem)` on peek-open. `M` toggles open/closed; state persists within the tournament session only. 200ms `translateX` slide animation. Content: scrollable list with two columns (A | B) per param row; when the values differ, the row has a `bg-node-component-surface` highlight and an icon in the left gutter; when they match, row is plain.
- **D-21: Diff structure uses pure helpers in a new `metadataDiff.ts` service.** Functions:
  - `diffParams(a: NormalizedParams, b: NormalizedParams): ParamDiffRow[]` — iterates the union of keys in both; classifies each as `match | differ | only-a | only-b | missing-both`.
  - `diffLoras(a: LoraRef[], b: LoraRef[]): LoraDiffEntry[]` — name-based, order-insensitive set diff with three states: `match` (same name + weight), `weight-changed` (same name, different weight), `added` (only in B), `removed` (only in A). Sorted alphabetically by name within each state group. PEEK-03 literal.
  - Visual diff tokens use semantic tailwind classes only: `text-success` for added, `text-danger` for removed, `text-warning` for weight-changed. Exact colour tokens validated against the Comfy Design Standards Figma before hardcoding — planner checks. Worst case falls back to `text-muted-foreground` + label prefix ("added", "removed", "changed").
- **D-22: Peek panel shows param source label.** Each row labelled from a static map keyed by `keyof NormalizedParams`, i18n'd under `moshpit.peek.params.<key>`. LoRA rows render `<name> @ <weight>`.

### Full-Res Loading

- **D-23: Full-res preload on tournament entry.** On `tournamentStore.enter()`, kick off parallel `Image()` preloads for ALL full-res URLs (`getAssetUrl(asset)` from `src/platform/assets/utils/assetUrlUtil.ts`) across the selected set — not just the first pair. Per TOUR-08 literal ("Full-resolution assets load on tournament entry, not on hover, not on high zoom"). Native browser cache handles dedup; warm HTTP cache means most loads complete in <100ms. Don't block tournament rendering on the preload — the overlay mounts immediately and the first pair renders from cache (fallback to thumbnail while loading). UX-08 (<500ms warm full-res) is formally Phase 7's proof, but implementation shouldn't regress it.
- **D-24: Loading fallback = existing thumb via `moshpitThumbStore.getObjectUrl(hash)`.** While full-res is loading, render the cached WebP thumb. On load, swap the `src` with a crossfade (reuse 300ms ease-out-cubic per D-18 Phase 2). No spinner chrome. A small skeleton / opacity-dim on the asset frame indicates loading if it exceeds 1s.

### Validation

- **D-25: HUMAN-UAT in `05-HUMAN-UAT.md`.** Qualitative sign-off pattern reused from Phase 3/4. Scenario:
  1. Select ≥2 assets across clusters. Verify `Enter` triggers tournament.
  2. Cycle modes with `[`/`]`. Verify each mode renders correctly for portrait, landscape, and mixed-aspect pairs.
  3. In overlap, drag the wipe divider with pointer; nudge with `,`/`.`; reset with `/`. Verify keyboard and pointer both work.
  4. Press `Space` in each mode. Verify flip behaviour per D-17.
  5. Run a 4-asset round-robin. Verify pair count = 6, skip → re-queue, progress counter updates.
  6. Toggle `M`. Verify peek panel slides in from the right, assets shrink, diff rows render correctly for matching + differing params + LoRAs.
  7. Complete tournament. Verify winner set (top-3 with ties) is selected on the canvas at exit.
  8. Repeat with 10+ assets for single-elim. Verify champion is the single selected asset at exit.
  9. `Esc` early after picking 2 winners. Verify selection replaced with those winners.
  10. `Esc` immediately (0 picks). Verify selection unchanged + toast.
  11. Qualitative: "Does tournament mode make picking winners from a set of 8 assets faster and more confident than scrolling the canvas with the same set selected?" — binary + notes.
- **D-26: Vitest coverage for pure modules.** `tournamentBracket.ts` (round-robin + single-elim generation + skip handling + winner-set derivation) and `metadataDiff.ts` (param diff + LoRA set-diff) are deterministic and testable without Vue. Property tests (`fast-check`) cover: round-robin completeness invariant, single-elim single-survivor invariant, `skip → re-queue` idempotency, LoRA diff order-insensitivity (permute inputs, diff result identical).
- **D-27: Playwright `@moshpit` spec.** A scoped E2E covers tournament entry gate (Enter with <2 selected → no-op toast; Enter with ≥2 → overlay mounts), mode cycling, pair counter, and exit-with-winners-selected. Metadata peek rendering and full-res perf are NOT in the E2E — covered by Vitest + HUMAN-UAT + Phase 7 respectively. Known constraint: `browser_tests/` tsconfig mismatch may still block commits (see Phase 4 D-21 deferred-items). Planner reuses the Phase 4 D-21 carve-out if still present; otherwise ship the spec.

### Claude's Discretion

- **Overlap wipe direction.** D-16 specifies horizontal (vertical divider line, left/right reveal). If dogfood surfaces that vertical wipe is preferred for tall portraits, planner flips to vertical with the matching keymap rotation (`,`/`.` still nudge; just along the Y axis).
- **A/B-flip visual indicator in non-flip modes.** D-17 specifies a 150ms border pulse on the active side in side-by-side / overlap. Planner may substitute a small `A` / `B` label in the corner if the pulse is visually noisy.
- **Pair counter placement.** D-04 says top-left or top-center. Planner picks one consistent position; either works.
- **Peek panel width.** D-20 specifies `w-96` (24rem). Planner may narrow to `w-80` if the diff layout reads comfortably, or widen to `w-[28rem]` for long LoRA lists. Not a behaviour change, design sizing.
- **Diff highlight tokens.** D-21 suggests `text-success` / `text-danger` / `text-warning`; planner confirms against the Comfy Design Standards Figma for Moshpit-specific tokens if defined. Never hardcodes hex.
- **Keyboard chord for wipe divider.** D-16 specifies `,`/`.` + `Shift+,`/`Shift+.` + `/`. Planner may swap to `-`/`=` / `0` if `,`/`.` conflict with something discovered during implementation. Whatever lands, the legend (D-19) documents it.
- **Toast implementation for zero-picks and "need 2+ to enter".** Reuse the existing `toastStore` (`src/platform/updates/common/toastStore.ts`) — planner wires i18n keys under `moshpit.tournament.*`. If the Moshpit platform has a thinner toast pattern, use that.
- **Single-elim bye handling with non-power-of-2 N.** D-01 suggests "byes to the first `(nextPow2(N) - N)` seeds". Planner confirms this reads naturally to users; alternative is "byes distributed evenly" (every other seed). Either is defensible.
- **Preload strategy.** D-23 says parallel all-at-once via `Image()` preload. Planner may cap concurrent loads (e.g., 8 at a time via a tiny queue) if a 5k-asset tournament entry would saturate the browser connection pool — UNLIKELY because tournaments are capped by selection size, typically ≤32.
- **Winner-set visual "pulse" on exit.** Planner may add a 300ms highlight animation on the winner hashes after setSelection to make the handoff visible. Not a behaviour change.
- **Peek icon gutter.** D-20 mentions an icon in the left gutter for differ rows. Planner picks an icon (Lucide `git-compare`?) — cosmetic detail.

### Folded Todos

None — no pending todos matched Phase 5 scope (checked via `gsd-tools todo match-phase 5` → 0 matches).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ADRs (entity architecture constraints)

- `docs/adr/0001-merge-litegraph-into-frontend.md` — litegraph is vendored; tournament overlay must not import from `src/lib/litegraph`.
- `docs/adr/0003-crdt-based-layout-system.md` — command pattern; tournament store mutations must be serialisable (even though we don't persist them — future v2-TOUR-01 elo might).
- `docs/adr/0008-entity-component-system.md` — no methods on god-object entities; tournament bracket math lives in pure modules, state in a dedicated store.

### Project-level specs

- `.planning/PROJECT.md` §Active (Tournament mode bullets + Curation bullets), §Constraints (PixiJS boundary, IDB-only-for-persistence, keyboard-reachability), §Key Decisions (tournament is ephemeral, input=selection, peek collapsed to `M`, LoRA set-diff, comparison modes all kept, no telemetry).
- `.planning/REQUIREMENTS.md` §Tournament Mode (TOUR-01..08), §Metadata Peek (PEEK-01..03) — authoritative requirement list. UX-08 (<500ms warm full-res) is Phase 7's proof, not Phase 5's gate.
- `.planning/ROADMAP.md` §Phase 5 Goal + 7 Success Criteria — what must be TRUE at phase exit. Phase 5 depends on Phase 4 (stable cluster layout + canvas selection surface).
- `temp/plans/moshpit_prd.md` §5.8 (shortlist + tournament framing), §7.7 (tournament mode — three display modes, pairwise picks, ephemeral scoring), §7.8 (metadata peek on `M`), §7.9 (metadata diff rendering + LoRA set-diff), §7.12 (full keyboard map for tournament + curation), §8.7 (performance budget — tournament entry <500ms warm), §9 (open questions — bracket shape, diff visual treatment).

### Phase 1 / 2 / 3 / 4 carry-forward

- `.planning/phases/01-workspace-shell-canvas-navigation/01-CONTEXT.md` — container `tabindex=0` + focus pattern, Moshpit platform domain (`src/platform/moshpit/`), sidebar-store auto-collapse pattern, keyboard shortcut scoping.
- `.planning/phases/02-asset-pipeline/02-CONTEXT.md` — 300ms ease-out-cubic tween primitive (reused for peek slide + thumbnail→full-res crossfade), content-hash keying, `moshpitThumbStore.getObjectUrl(hash)` fallback for full-res load states.
- `.planning/phases/03-filter-sort-core-validation/03-CONTEXT.md` — `NormalizedParams` shape (peek diff consumes this), HUMAN-UAT pattern, chip-value-editor pattern (useful mental model for the peek row component).
- `.planning/phases/04-lineage-groupings-within-cluster-sort/04-CONTEXT.md` — `moshpitFilterStore` shape, cluster overlay HTML-over-Pixi pattern (peek panel is HTML-only, simpler), `saveNodeIdentity` in NormalizedParams (peek diff should render this row), D-21 deferred-items note on `browser_tests/` tsconfig mismatch (check if still blocking).

### Codebase maps

- `.planning/codebase/STRUCTURE.md` — `base → platform → workbench → renderer`; Moshpit tournament code lives in `src/platform/moshpit/`.
- `.planning/codebase/ARCHITECTURE.md` — Pinia setup-API + composable patterns.
- `.planning/codebase/CONVENTIONS.md` — Vue 3.5 destructured props, Tailwind semantic tokens, `cn()` only, no `dark:` / `:class="[]"` / `!important`.
- `.planning/codebase/TESTING.md` — Vitest + happy-dom for unit, Playwright `@moshpit` tag for E2E, fast-check for property tests.

### Existing code to consume / extend

- `src/views/MoshpitView.vue` — mount `<MoshpitTournamentOverlay>` as a sibling of `<MoshpitCanvas>`. Extend container keydown to handle `Enter` (tournament entry gate per D-14).
- `src/platform/moshpit/stores/moshpitSelectionStore.ts` — read selection on entry, call `setSelection(winners)` on exit with winners. No store mutations beyond `setSelection`.
- `src/platform/moshpit/stores/moshpitSidebarStore.ts` — capture `isCollapsed` state on entry, force-collapse, restore on exit (D-11).
- `src/platform/moshpit/stores/moshpitThumbStore.ts` — `getObjectUrl(hash)` for the loading fallback (D-24).
- `src/platform/moshpit/services/paramNormalize.ts` — `NormalizedParams` schema feeds `metadataDiff.ts`. Read-only consumer.
- `src/platform/moshpit/services/filterTypes.ts` — param keys and label map reused for peek rows.
- `src/platform/moshpit/composables/useMoshpitSpacePan.ts` — scoped-keydown pattern model for `useMoshpitTournamentKeybindings.ts`.
- `src/platform/moshpit/components/MoshpitClusterOverlay.vue` — HTML-over-Pixi overlay precedent (overlay mount + viewport coexistence).
- `src/platform/moshpit/components/MoshpitEmptyGateOverlay.vue` — conditional `v-if` overlay mount precedent.
- `src/platform/assets/utils/assetUrlUtil.ts` — `getAssetUrl(asset)` returns the full-res URL (D-23 preload).
- `src/platform/updates/common/toastStore.ts` — toast infrastructure for "No winners" and "Select 2+ to start" messages.
- `src/locales/en/main.json` — new `moshpit.tournament.*` + `moshpit.peek.*` namespaces.

### New modules to create

- `src/platform/moshpit/services/tournamentBracket.ts` + `tournamentBracket.test.ts` — pure: `generateBracket(hashes, shape) → TournamentPair[]`, `applyPick(wins, pair, winner)`, `applySkip(queue, pair, shape)`, `computeWinnerSet(wins, shape, topN=3)`. Property tests with `fast-check` for completeness / invariants (D-26).
- `src/platform/moshpit/services/metadataDiff.ts` + `metadataDiff.test.ts` — pure: `diffParams(a, b)`, `diffLoras(a, b)`. Property tests for LoRA diff order-insensitivity (D-21, D-26).
- `src/platform/moshpit/stores/moshpitTournamentStore.ts` + `moshpitTournamentStore.test.ts` — Setup-API Pinia store per D-12.
- `src/platform/moshpit/composables/useMoshpitTournamentKeybindings.ts` + test — scoped keydown handler factory consumed by the overlay (D-13).
- `src/platform/moshpit/components/MoshpitTournamentOverlay.vue` + test + story — top-level overlay, focus trap, keydown root, display-mode switcher (D-10, D-13, D-18, D-19).
- `src/platform/moshpit/components/MoshpitTournamentPair.vue` + test + story — hosts the current pair's two asset frames; receives display mode and delegates rendering.
- `src/platform/moshpit/components/MoshpitTournamentAssetFrame.vue` + test + story — single-asset display primitive handling full-res vs thumb fallback with crossfade (D-24).
- `src/platform/moshpit/components/MoshpitMetadataPeekPanel.vue` + test + story — right-side peek panel (D-20, D-22).
- Optional display-mode sub-components if `MoshpitTournamentPair.vue` gets too big — planner's call.

### Files to extend

- `src/views/MoshpitView.vue` — add `<MoshpitTournamentOverlay />` sibling; add `Enter` case to container keydown (D-14).
- `src/locales/en/main.json` — `moshpit.tournament.*` (entry-prompt, no-winners toast, pair-counter template, display-mode labels, legend keys), `moshpit.peek.*` (param labels, diff state labels).

### Guidance docs

- `docs/guidance/typescript.md` — no `any`, Zod for schema, type-assertion hierarchy; tournament types live in colocated `.ts` files.
- `docs/guidance/vue-components.md` — Vue 3.5 destructured props, `<script setup>`, `defineModel` where appropriate, no `:class="[]"`.
- `docs/guidance/design-standards.md` — check Comfy Design Standards Figma for tournament-overlay / peek-panel / diff-state tokens before hardcoding any colour.

### External library docs (fetch via Context7 when planning)

- `@vueuse/core` — `useFocusTrap` for overlay focus containment; `useEventListener` for scoped keydown; `useMagicKeys` is tempting but NOT recommended here (global listener, fights with canvas shortcuts).
- `reka-ui` — `Dialog` / `DialogContent` may be overkill for the overlay since we don't want its default focus-trap + aria-modal semantics clashing with canvas focus; a plain overlay div + VueUse focus trap is lighter. Planner confirms. `Slider` could back the wipe divider if keyboard-slider semantics are desired; otherwise plain pointer handlers suffice.
- `pixi.js` v8 — NOT needed. Tournament overlay is pure HTML. Canvas stays mounted underneath but is not interactive during tournament (overlay eats pointer/keyboard).

### Domain references

- TOUR-08 + UX-08 performance envelope: full-res load on entry, <500ms warm / 2s cold (Phase 7 gates the proof).
- PRD §7.9 LoRA set-diff semantics: name-based, order-insensitive, four states (match / weight-changed / added / removed).
- PRD §9 open question "Tournament bracket shape" resolved by D-01 (adaptive threshold 8).
- PRD §9 open question "Diff visual treatment" partially resolved by D-21 (semantic tokens); full design pass deferred to Phase 7 if needed.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`moshpitSelectionStore.setSelection(ids)`** — exactly the primitive needed for winner-set handoff; no new store API required.
- **`moshpitThumbStore.getObjectUrl(hash)`** — warm-cache thumb URL for the full-res loading fallback (D-24).
- **`getAssetUrl(asset)` from `src/platform/assets/utils/assetUrlUtil.ts`** — full-res URL resolution, cloud + OSS handled already.
- **`useMoshpitSpacePan`** scoped-keydown pattern — structural template for `useMoshpitTournamentKeybindings`.
- **300ms ease-out-cubic tween primitive** in `useMoshpitSpriteLayer` — reused for peek panel slide-in AND thumbnail→full-res crossfade (no new animation shape).
- **`MoshpitClusterOverlay.vue` / `MoshpitEmptyGateOverlay.vue`** — overlay mount + viewport coexistence precedent.
- **`NormalizedParams` from `paramNormalize.ts`** — feeds `metadataDiff.ts` directly.
- **`fast-check` + Vitest property test harness** — already used for `clusterLayout.ts` / `sortMath.ts`; reuse for bracket invariants.
- **`toastStore`** from `src/platform/updates/common/` — existing toast infrastructure.

### Established Patterns

- **Pure math modules + colocated Vitest** — `tournamentBracket.ts` + `metadataDiff.ts` follow the Phase 3/4 pattern (`sortMath` / `clusterLayout` / `groupAxes`).
- **Pinia setup-API store per domain** — `moshpitTournamentStore` joins `moshpitFilterStore` / `moshpitSelectionStore` / `moshpitCurationStore` / etc. Single-purpose, ephemeral.
- **HTML-only overlay inside MoshpitView** — `MoshpitTournamentOverlay` is a sibling of the canvas, no Pixi coupling.
- **Scoped keydown + focus trap** — Phase 1 pattern extended; canvas shortcuts naturally gated by event propagation.
- **i18n namespace `moshpit.*`** — new `moshpit.tournament.*` and `moshpit.peek.*`.
- **Reka UI over new PrimeVue** — used where it helps (focus trap via VueUse; `Dialog` is likely overkill but available).
- **Tailwind semantic tokens + `cn()`** — all new chrome; no `:class="[]"`, no `dark:`, no `!important`.

### Integration Points

- **`MoshpitView.vue`** — overlay mount + `Enter` keydown entry gate.
- **`moshpitSelectionStore`** — read on entry, setSelection on exit (winners or original).
- **`moshpitSidebarStore`** — capture + restore `isCollapsed`.
- **`moshpitThumbStore`** + `getAssetUrl` — loading fallback for full-res preload.
- **`paramNormalize.NormalizedParams`** — peek diff input.
- **`toastStore`** — no-winners + selection-too-small toasts.
- **`src/locales/en/main.json`** — two new namespaces.

### Constraints Surfaced by the Scout

- **`moshpitSelectionStore.selected` is an array derived from a `Set`** — iteration order is insertion order (Set semantics), which maps naturally to D-02 deterministic bracket seeding. No new store API needed.
- **`MoshpitView.vue` already owns `tabindex=0` container focus and `containerEl.focus()` on pointerdown** — the tournament overlay grabs focus on mount and releases it back to the container on unmount; simple lifecycle handoff.
- **No existing commandStore integration for Moshpit keys** — all Phase 1–4 keys are container-local. Tournament follows the same shape (D-13/D-14) rather than introducing commandStore infra mid-phase.
- **`browser_tests/` tsconfig mismatch (Phase 4 D-21)** — if still present, may block committing `@moshpit` Playwright spec. Planner checks current state before building the E2E; if still broken, defer with a `deferred-items.md` note matching the Phase 4 carve-out.
- **Full-res preload at tournament entry is a network burst** — for typical selection sizes (2–32) this is safe, but planner should decide whether to cap concurrent loads. D-23 defers this to planner discretion.
- **Peek panel width (w-96) vs canvas size on small monitors** — planner verifies the layout isn't crushed on 1280-wide laptops; may need a breakpoint-based width.

</code_context>

<specifics>
## Specific Ideas

- **Tournament is a focus mode.** Sidebar collapses; canvas stays mounted but inert; keyboard scope is contained. Nothing else in Moshpit behaves this way — the precedent is "everything is ambient, everything is live". Tournament is explicitly different.
- **Selection order = bracket order.** Users learn this once: "the order you selected is the order they'll face off". Gives power users agency without a UI for seeding.
- **`Esc` carries two semantics, inferred from state, not declared.** `Esc` with wins → accept-what-you-have. `Esc` with zero wins → cancel. Implementation is one branch, user model is "if I picked any, they stick; if I didn't, nothing changes."
- **Pure pixels by default, metadata on demand.** The peek panel is a power-user feature, not a crutch. Default view is a clean comparison.
- **Reuse the tween primitive.** 300ms ease-out-cubic for peek slide and thumb→full-res crossfade. One motion language across the whole app.
- **HUMAN-UAT is qualitative.** Vitest covers the bracket math and the LoRA diff. The E2E covers the structural flow. The "is this faster than scrolling" question is qualitative and binary.
- **No re-invention.** Selection store already works. Thumb store already works. Asset URL resolution already works. The tournament is glue + one new pure module + one overlay.

</specifics>

<deferred>
## Deferred Ideas

- **Persisted tournament scores / elo / bracket saves** — PRD §4 Non-goals; v2-TOUR-01/02.
- **Per-cluster "best of N" tournament scoping** — v2-TOUR-03. Out of v1.
- **Auto-selected comparison mode per pair** — PRD Out of Scope ("Contextual / auto-selected comparison modes").
- **Mobile / touch affordances for wipe divider** — desktop-first posture; out of v1.
- **Full canvas a11y parity during tournament** — canvas is inert in tournament mode; tournament overlay is itself keyboard-reachable and screen-reader-legible. Phase 7 audits.
- **Tournament-mode telemetry** (time-per-pair, skip rate) — PRD Out of Scope v1.
- **Peek panel design polish** (exact colour tokens, icons for diff states, typography) — PRD §9 design detail; Phase 7 if needed.
- **Resume semantics for interrupted tournaments** — D-09 rejects this for v1; revisit only if dogfood demands.
- **Manual seeding UI for single-elim** — D-02 uses selection order; manual seeding is a v2 power-user feature.
- **Winner-set visual treatment** (pulse highlight) — D-25 Claude's Discretion; polish if dogfood asks.

### Reviewed Todos (not folded)

None — `gsd-tools todo match-phase 5` returned 0 matches.

</deferred>

---

_Phase: 05-tournament-mode-replaces-old-comparison-mode-framing_
_Context gathered: 2026-04-22_
