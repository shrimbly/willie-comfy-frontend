---
status: passed
phase: 04-lineage-groupings-within-cluster-sort
verdict: Yes
signed_off: 2026-04-21
---

# Phase 4 — Human UAT (v3 Core Value Validation)

**Purpose:** Validate whether lineage-grouped spatial organisation + within-cluster sort makes comparable generations easier to find than a flat parameter-sorted grid. A negative or "sort of" sign-off here pauses Phase 5 per **D-22** — Phase 4 is the v3 pivot's go/no-go milestone.

**Date:** 2026-04-21
**Tester:** willie@reflct.app
**D-22 Verdict:** **YES** — Phase 4 shipped after inline gap closure on 8 UAT findings (workflow picker filename, cluster overlay alignment, All-workflows entry, workflow gate filtering, depth label overlap, badge click-to-focus, uniform zoom, child cluster inset) and 6 additional settings-panel polish items (unified chip area, chip UI, × affordance, type-group tooltips, sort stability, drop repack tween).

---

## Prerequisites

- Real ComfyUI backend running (`conda activate comfyui && cd /Users/willie/Documents/projects/comfy/ComfyUI && python main.py`)
- Frontend dev server (`pnpm dev` → http://localhost:5173)
- A realistic asset population:
  - ≥ 2 distinct workflows (different `.json` filenames)
  - Each workflow has ≥ 2 save nodes (e.g. `SaveImage` + a renamed `_meta.title` variant)
  - Overlapping models across workflows (at least one model used by both workflows)
  - Overlapping prompt text (at least one exact-match prompt repeated between workflows)
  - Mixed aspect ratios (landscape + portrait + square within the same workflow)
  - ≥ 80 generated PNGs total (the more the better — 5k is the design ceiling)

## Launch

1. Start the backend and generate the asset population described above.
2. Open Moshpit at http://localhost:5173/moshpit.
3. Confirm the Settings panel is open by default; if it auto-collapses on first canvas click, re-open via the side-rail Settings tab.
4. Apply the initial filter gate: workflow = "all", time = "all time".
5. Wait for thumbnails to populate (processing indicator shows `n/m`).

---

## Scenario — D-20 Dogfood Checklist

### Step 1: Baseline flat grid

- [ ] With no grouping toggles active, assets render as a flat grid at default spacing.
- [ ] Within-cluster sort dropdown shows "Newest first" by default.

### Step 2: Workflow grouping alone

Toggle the **Workflow** grouping pill.

- [ ] Visible clusters appear; each cluster corresponds to a distinct workflow filename.
- [ ] Clusters are ordered by bucket density descending (largest cluster outermost / leftmost).
- [ ] Each cluster has a visible bounding box + label showing the workflow filename.
- [ ] Thumbnails inside each cluster remain at full size (no shrinking to fit).

### Step 3: Add prompt grouping

Add the **Prompt** grouping pill (workflow stays on).

- [ ] Nesting order reorders automatically — whichever axis has the larger average bucket size becomes the outer axis.
- [ ] Clusters at the outer level still have a label; nested (inner) clusters are visually separated but not labelled (D-06: labels only at depths 0 and 1).
- [ ] Depth-proportional spacing is perceptible — outer clusters have more gap between them than inner ones.

### Step 4: Add save_node + model + type groupings one at a time

Add **Save node**, then **Model**, then **Type** — verifying at each step:

- [ ] Nesting auto-reorders on each toggle; order matches "avg bucket size descending".
- [ ] `(other)` clusters render for assets missing the axis key (e.g. assets without a parseable save node).
- [ ] At 5 active axes, the layout remains coherent — tweens complete under ~400ms visually.
- [ ] Bounding boxes at the outer 2 levels remain legible; inner levels rely on whitespace alone.

### Step 5: Change within-cluster sort

With several groupings active, change the within-cluster sort dropdown:

- [ ] Switch **Newest first → Oldest first** — leaf-cluster order reverses; cluster boundaries stay stable.
- [ ] Switch **Oldest first → Alphabetical** — leaf-cluster order changes to filename alphabetical; cluster boundaries still stable.
- [ ] No sprite "jumps" or layout thrash between sort changes — 300ms ease-out-cubic tween is smooth.

### Step 6: Advanced filter disclosure (FILTER-12)

With the filter gate still open:

- [ ] The "Advanced filters" disclosure trigger is visible below the primary chip row.
- [ ] Clicking the trigger expands the advanced chip row and rotates the chevron.
- [ ] Open the `+ Add filter` popover — parameters are split into **Primary** and **Advanced** sections.
- [ ] Adding an advanced param (e.g. `cfg`) inserts the chip into the advanced row, not the primary row.
- [ ] Adding a primary param (e.g. `model`) inserts into the primary row.
- [ ] Clicking the disclosure trigger again collapses the advanced row without losing chip state.

### Step 7: Cross-interaction smoke

- [ ] Apply an advanced filter (e.g. `cfg: 6–8`) while groupings are active — cluster set shrinks, auto-nesting recomputes.
- [ ] Remove the filter — clusters reflow to the previous state.
- [ ] Show-hidden toggle still operates independently of groupings.

### Step 8: Qualitative Sign-Off (D-22 gate question)

**Do lineage clusters make comparable assets easier to find than a flat grid? Is the auto-nesting order predictable?**

- [ ] **YES** — ship Phase 5 as planned.
- [ ] **SORT OF** — note specific blockers below; consider gap-closure before Phase 5.
- [ ] **NO** — pause Phase 5 per D-22; gather feedback; reconsider whether the lineage-grouping thesis needs rework.

---

## Gate (D-22)

> If the qualitative sign-off is `No` or `Sort of`, **PAUSE Phase 5**. Phase 4 is the v3 Core Value validation milestone; negative sign-off means the lineage-grouping thesis needs rework before Tournament mode is built on top of it.

---

## Sign-Off

- **Date:**
- **Tester:**
- **Dataset size (asset count):**
- **Workflows tested:**
- **Verdict:** YES / SORT OF / NO
- **Notes / blockers:**

<!-- Free-form observations. Examples: "workflow labels clip at high zoom", "save-node `(other)` dominates when _meta.title is absent", "prompt normalisation too aggressive — different prompts collapse into one bucket" -->

Signed: ****\*\*****\_\_\_****\*\*****
