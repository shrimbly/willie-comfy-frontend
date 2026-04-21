# Phase 4: Lineage Groupings & Within-Cluster Sort - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 04-lineage-groupings-within-cluster-sort
**Areas discussed:** Cluster layout algorithm, Cluster visual treatment, Save-node + type axis semantics, Advanced-filter disclosure + sort-UI removal

**Discussion mode:** User delegated decisions ("just make the best decision based on what you know") after the gray-area menu returned empty responses. Claude resolved all four areas using codebase scout, PRD §5–9, Phase 3 CONTEXT, and state-recorded open questions.

---

## Cluster Layout Algorithm

| Option | Description | Selected |
|--------|-------------|----------|
| Hierarchical row-column packing | Recursive deterministic packer. Leaf clusters = flat grid (reuses `sortMath.computeSortedLayout1D`). Branch clusters = row-wrapping grid of child clusters. Depth-proportional gaps. | ✓ |
| Treemap / nested rectangles | Space-efficient but scales thumbnails → breaks pixel-level comparison. | |
| Force-directed packing | Non-deterministic, hard to test, risks >400ms at 5k. | |

**Decision:** Hierarchical row-column packing (CONTEXT D-01..D-05).
**Rationale:** Preserves thumbnail size (the non-negotiable); deterministic and testable; reuses existing tween primitive; grid-snap invariant consistent with Phase 2/3. Treemap rejected because scaled thumbnails kill the comparison use case. Force-directed rejected on determinism + budget grounds.

---

## Cluster Visual Treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Padding-only separation | Gap hierarchy conveys nesting; no boxes / labels. Minimal. | |
| Bounding boxes + labels at outer levels only | 1px box at outer + second-outer levels; HTML overlay labels (Phase 3 axis-overlay precedent); inner levels rely on gap. `(other)` = regular bucket at its level. | ✓ |
| Bounding boxes at every level | Maximum clarity; visually noisy with 5 nested axes. | |

**Decision:** Bounding boxes + HTML overlay labels at outermost two nesting levels (CONTEXT D-06).
**Rationale:** Clarity where it matters (workflow, prompt) without visual noise when 5 axes are active. HTML overlay reuses Phase 3 `MoshpitAxisOverlay` pattern (crisp text at any zoom, no PixiJS text-atlas overhead). `(other)` is treated as a regular bucket to keep the math clean.

---

## Save-node + Type Axis Semantics

| Sub-question | Options | Choice |
|--------------|---------|--------|
| Save-node identity | node id \| `_meta.title` \| class_type \| composite | `_meta.title` ?? `class_type` |
| Type buckets | 3 (land/port/sq) \| 5 (+ ultrawide / extreme portrait) \| resolution buckets | 3 buckets (landscape / portrait / square) |
| Type storage | Store in NormalizedParams \| derive at read-time | Derive at read-time |
| IDB migration | v2→v3 bump with re-derivation \| lazy on next write \| wipe cache | v2→v3 bump, cursor re-derivation |

**Decisions:** D-08, D-09, D-10, D-11.
**Rationale:**
- `_meta.title` carries the most user-meaningful lineage signal ("Save Winners" vs generic `SaveImage`), with class_type as a safe fallback.
- 3 aspect buckets with 1.15/0.87 thresholds match typical ComfyUI output shapes and keep the axis signal clean. More buckets add noise; resolution buckets are a v2 candidate per PRD §9.
- Type is a pure function of width+height — storing it would duplicate state. Derive-at-read is cheaper and simpler.
- v2→v3 migration is the established pattern (Phase 3 v1→v2) and raw PNG metadata is already preserved in `assetMeta.metadata`, so re-derivation works without re-thumbnailing.

---

## Advanced-filter Disclosure + Sort-UI Removal

| Sub-question | Options | Choice |
|--------------|---------|--------|
| Disclosure primitive | Reka `Collapsible` \| native `<details>` \| tabs \| drawer | Reka `Collapsible` |
| Default state | Open \| Collapsed | Collapsed |
| Chip-row implementation | Two `MoshpitFilterChipRow` instances \| one row with sectioned chips | Two instances (primary + advanced-in-collapsible) |
| `MoshpitSortControls` / `MoshpitAxisOverlay` | Delete \| Keep as deprecated | Delete (+ tests + i18n keys) |
| `sortMath.ts` | Delete \| Keep as reuse substrate | Keep (leaf-cluster grid substrate) |
| `MoshpitGridSpacingControl` / `MoshpitShowHiddenToggle` | Delete \| Keep | Keep (SORT-04 / FILTER-11 survive) |
| `moshpitFilterStore.sortX/sortY` | Keep \| Remove | Remove |

**Decisions:** D-12..D-17.
**Rationale:** Reka `Collapsible` matches the chrome-consistency preference (Phase 3 established Reka-over-PrimeVue). Two chip-row instances is the smaller diff and avoids complicating the chip component. `sortMath` survives because it's pure math with no UI coupling and the leaf-cluster grid uses the same bucketing primitive. Grid-spacing + show-hidden controls migrate in place with updated labels.

---

## Claude's Discretion (unlocked for planner)

- Row-first vs column-first wrapping at branch levels
- Cluster overlay label culling at deep zoom-out
- Reka `Collapsible` vs native `<details>` final call
- `activeGroupings` storage shape (Set vs array vs object)
- Multi-output-node save-node disambiguation
- IDB migration failure aggregate logging
- Grouping keyboard chords (`G+1..5`)
- `MoshpitGridSpacingControl` single-slider vs split
- Animation shape on simultaneous filter + grouping changes

---

## Deferred Ideas (noted for future phases)

- Manual grouping reorder UI (v2 if auto-nesting fails dogfood)
- Additional grouping axes (sampler / resolution bucket / seed-mod-N)
- Semantic / embedding prompt grouping (v2)
- Workflow graph-hash grouping (v2, PRD §9)
- Per-cluster within-cluster sort override
- Cluster collapse / drill-in interaction
- Save-node `filename_prefix` correlation for multi-output workflows
- Keyboard chords for grouping toggles
- Playwright frame-budget proof for GROUP-10 (Phase 7)
