# Phase 3 — Human UAT (Core Value Validation)

**Purpose:** Validate whether spatial-sort-by-parameter is a valuable interaction for reasoning about generation output. A negative or "sort of" sign-off here pauses the roadmap per D-22.

**Prerequisites:**

- Real ComfyUI backend running (conda env `comfyui` per project memory)
- At least 30 PNG outputs from a single workflow where CFG varies across a deliberate sweep (suggested: CFG 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 with fixed seed/sampler/steps, ~3 samples per CFG)

---

## Scenario 1: CFG Sweep Sort

1. Start the ComfyUI backend and generate a CFG sweep of ≥30 outputs to a single workflow
2. Open Moshpit in the frontend (`pnpm dev`, then visit `/moshpit`)
3. In the Settings panel, pick the workflow
4. Set time range to "All time"
5. Wait for thumbnails to populate (watch the processing indicator)
6. Open the Sort section → X axis picker → pick "CFG"
7. Capture a screenshot of the arrangement (filename: `temp/summaries/phase-03-uat-cfg-sweep.png`)

### Qualitative checks

- [ ] Columns are visually distinguishable at default grid spacing (560 px)
- [ ] Column order is low→high CFG (leftmost = lowest CFG)
- [ ] Axis labels are legible at default zoom ("CFG 3", "CFG 4", etc.)
- [ ] Axis labels remain readable when I zoom in to an individual column
- [ ] Axis labels remain readable when I zoom out to see all columns at once
- [ ] I can identify "the best CFG row" faster than I could by scrolling a flat grid

### Primary question

**Does the sort-by-CFG arrangement make it easier to pick the best CFG for this workflow than scrolling a flat grid would?**

- [ ] YES — ship Phases 4–7 as planned
- [ ] SORT OF — note specific blockers below, consider gap-closure before Phase 4
- [ ] NO — pause roadmap per D-22; gather feedback; consider whether Phase 3 needs rework

### Notes / blockers

<!-- Free-form observations. Examples: "Labels clip at <1.0× zoom", "Grid spacing too tight below 400px", "Would like to see sort-by-LoRA-weight" (v2) -->

---

## Scenario 2: 2D Sort (CFG × Sampler)

1. With the same dataset, set Sort X = "CFG" and Sort Y = "Sampler"
2. Capture screenshot: `temp/summaries/phase-03-uat-2d-scatter.png`

### Qualitative checks

- [ ] 2D grid is coherent — each cell contains the asset(s) with matching (CFG, Sampler) values
- [ ] Sparse cells (where no asset has that combination) appear empty, not broken
- [ ] Grid is navigable — I can mentally map "this is euler at CFG 7, that is dpmpp at CFG 8"

---

## Scenario 3: Filter chip add/remove stress

1. Add 3+ filter chips simultaneously (e.g., Sampler = euler OR dpmpp, CFG 6–8, Steps ≥ 20)
2. Remove them one-by-one
3. Verify the canvas tweens cleanly between states (no sprite jumps, no layout thrash)

### Qualitative checks

- [ ] Every chip remove triggers a smooth 300ms tween (D-18)
- [ ] Chip interaction feels responsive at 5k-asset budget (no lag on click)
- [ ] OR-within-chip semantics match my mental model (D-12)

---

## Sign-Off

- **Date:**
- **Dataset size (asset count):**
- **Primary question answer:** YES / SORT OF / NO
- **Blockers for Phase 4:** (list or "none")

Signed:
