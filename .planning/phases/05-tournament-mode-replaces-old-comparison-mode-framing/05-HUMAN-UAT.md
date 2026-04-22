---
status: pending-review
phase: 05-tournament-mode-replaces-old-comparison-mode-framing
verdict: pending
signed_off: pending
created: 2026-04-22
---

# Phase 5 — Human UAT (Tournament Mode D-25 Sign-off)

**Purpose:** Validate that tournament mode delivers a faster, more
confident pairwise-selection experience than scrolling a canvas selection,
and that each of D-25's 11 scenarios behaves as specified across
round-robin, single-elim, and skip/exit flows.

**Date:** _pending_
**Tester:** willie@reflct.app
**D-25 Verdict:** _pending_

---

## Prerequisites

- Real ComfyUI backend running
  (`conda activate comfyui && cd /Users/willie/Documents/projects/comfy/ComfyUI && python main.py`,
  default port 8188).
- Frontend dev server (`pnpm dev` → http://localhost:5173).
- An asset population suitable for tournament mode:
  - ≥ 10 generated PNGs with parseable ComfyUI metadata.
  - Mixed aspect ratios (at least one portrait and one landscape pair) so
    side-by-side / overlap / flip all have meaningful test cases.
  - ≥ 2 distinct models and ≥ 2 distinct LoRAs across the population so the
    peek panel's param diff and LoRA set-diff both have non-empty cases.

## Launch

1. Start the backend and generate the asset population described above.
2. Open Moshpit at http://localhost:5173/moshpit.
3. Wait for thumbnails to populate.
4. Verify that the Enter key focuses the container (tab into or click
   the canvas once before the first scenario).

---

## Scenario 1 — Entry gate

1. Clear the selection (Cmd+Shift+A or click empty canvas).
2. Focus the canvas and press `Enter`.

**Expected:** a toast appears with summary
"Select at least 2 assets" (moshpit.tournament.needTwoToastSummary) and
detail "Tournament mode compares pairs — select more assets to begin."
No overlay mounts.

3. Marquee-select (shift-drag) 2 or more assets. Press `Enter`.

**Expected:** the full-screen tournament overlay mounts. The pair
counter in the top-left reads "Pair 1 / N" where N is the bracket size.

- [ ] Verified

### Notes

_(record anything off: toast latency, wrong key, overlay flicker, etc.)_

---

## Scenario 2 — Mode cycling with `[` / `]`

With the tournament active (from Scenario 1), press `]` three times and
then `[` twice.

**Expected:**

- `]` cycles: `sideBySide → overlap → flip → sideBySide`.
- `[` cycles the reverse direction.
- Each mode renders correctly for the current pair regardless of
  portrait vs landscape mix.
- The current pair is preserved across mode switches (D-18).

- [ ] Verified

### Notes

---

## Scenario 3 — Overlap wipe divider

Enter overlap mode. Drag the vertical divider left/right with the
pointer; press `,` then `.` then `Shift+,` then `Shift+.` then `/`.

**Expected:**

- Pointer drag updates the wipe position smoothly (asset B is clipped on
  the right; A shows through on the left).
- `,` / `.` nudge by ±5%; `Shift+,` / `Shift+.` nudge by ±20%.
- `/` resets the divider to 50%.
- Both pointer and keyboard paths work.

- [ ] Verified

### Notes

---

## Scenario 4 — Space flip in each mode

Press `Space` in side-by-side, overlap, and flip modes.

**Expected:**

- In side-by-side: the A/B highlight shifts to the other frame (ring
  follows `flipShowsB`).
- In overlap: highlight shifts on the appropriate frame (or is a no-op
  visually by current implementation — record what happens).
- In flip: the single displayed asset swaps between A and B.
- Space does NOT trigger canvas Space-pan in any mode (D-13 scoped
  keydown eats the event).

- [ ] Verified

### Notes

---

## Scenario 5 — 4-asset round-robin

Select exactly 4 assets. Press `Enter`.

**Expected:**

- Pair counter starts at "Pair 1 / 6" (round-robin, `N*(N-1)/2 = 6`).
- Pressing `←` picks A and advances to the next pair (counter increments).
- Pressing `↓` skips a pair and re-queues it at the tail; the counter
  does NOT increment because the skipped pair is returned to the back.
- Pressing `→` picks B.
- Work through all 6 pairs (skipping at least once); tournament
  completes without stuck state.

- [ ] Verified

### Notes

---

## Scenario 6 — `M` toggles the metadata peek

With a tournament active on at least one pair where A and B differ on
model / CFG / steps / LoRA set, press `M`.

**Expected:**

- Peek panel slides in from the right (200ms transform).
- Assets pane keeps its aspect-fit (panel overlays, does not squish).
- Differ rows are highlighted with `bg-node-component-surface`.
- Matching rows are plain.
- LoRA diff section renders `match` / `added` / `removed` /
  `weightChanged` states in the appropriate colour tokens.

Press `M` again to close.

- [ ] Verified

### Notes

---

## Scenario 7 — Complete round-robin → winner set

Run a 4-asset round-robin to completion, picking one asset consistently
(pick A on every pair where seed 0 is involved, then pick the best of
the rest).

**Expected:**

- Tournament completes when the queue is empty (counter reaches final pair).
- Overlay unmounts.
- The canvas selection is now the winner set (top-3 by wins, with ties
  promoted per D-06). The original non-winners are no longer selected.

- [ ] Verified

### Notes

---

## Scenario 8 — Single-elim with 10+ assets

Select 10 or more assets. Press `Enter`.

**Expected:**

- The tournament is single-elim (`N >= 8` threshold).
- Total pair count = `N - 1`.
- Byes are assigned to the first `(nextPow2(N) - N)` seeds (first-seen
  order) — verify this reads naturally as a user; if it feels off, flag
  for post-UAT tuning per D-01 Claude's Discretion.
- Tournament completes with a single champion; on exit the selection is
  replaced by the champion hash (single element).

- [ ] Verified

### Notes

---

## Scenario 9 — `Esc` early after picks

Select 4–6 assets, enter tournament, pick A on 2 pairs, then press `Esc`.

**Expected:**

- Overlay unmounts.
- The winners-so-far replace the selection (D-08 "accept what you have"
  semantics).
- Sidebar state restores to its pre-tournament panel (D-11).
- No toast fires (winners were picked).

- [ ] Verified

### Notes

---

## Scenario 10 — `Esc` immediately (zero picks)

Select ≥ 2 assets, enter tournament, press `Esc` without picking
anything.

**Expected:**

- Overlay unmounts.
- Toast appears: "No winners picked — Your selection is unchanged."
- Canvas selection is EXACTLY the original selection (hash-compare).
- Sidebar restores.

- [ ] Verified

### Notes

---

## Scenario 11 — Qualitative: faster than scrolling?

Run a tournament on 8 assets (mixed aspect ratios, mixed models).
Separately, take the same 8 assets as a canvas selection (reload the
page or re-select) and scroll / zoom through them to pick favourites
without the tournament.

**Question:** Does tournament mode make picking winners from a set of
8 assets faster and more confident than scrolling the canvas with the
same set selected?

- [ ] Yes
- [ ] No
- [ ] Mixed — see notes
- [ ] Verified (tick once a qualitative answer is recorded above)

### Notes

_(freehand observations: which mode felt best, whether peek helped,
anything that felt slow or confusing)_

---

## Sign-off

**Tester:** willie@reflct.app
**Date:** _pending_
**Verdict:** _pending_

By signing off, I confirm that:

- All 11 scenarios behave as described (or deviations are recorded in the
  Notes sections and deemed non-blocking).
- The qualitative question was answered honestly.
- Any blocking defects have been filed as follow-up tasks (or raised back
  to the orchestrator before sign-off).
