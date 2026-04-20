# Phase 3: Filter & Sort (Core Validation) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 03-filter-sort-core-validation
**Areas discussed:** Param extraction, Initial gate UX, Filter chip authoring, Sort controls + bucketing

---

## Parameter Extraction & Normalization

| Option | Description | Selected |
|--------|-------------|----------|
| Worker, store in IDB | Worker parses once, writes `assetMeta.params` alongside raw metadata. Filter/sort reads typed fields. Zero main-thread cost on warm cache. | ✓ |
| Main-thread, lazy pure fn | `normalizeParams(rawMeta)` runs on first filter/sort access, memoized per-hash. Cheap to iterate but N thousand parses on cold filter. | |
| Hybrid: worker does cheap fields, main-thread does prompt strings | Worker writes `{cfg, steps, sampler, scheduler, seed, model, resolution, loras[]}`; prompt substring match stays raw on-demand. | |

**User's choice:** Worker, store in IDB
**Notes:** Recommended path. Normalization happens once per asset in the worker, the typed `params` shape is written alongside raw metadata in the `assetMeta` IDB store. Filter/sort math just reads typed fields.

| Option | Description | Selected |
|--------|-------------|----------|
| `prompt` (API format) | Inputs-by-name object: `node.inputs.cfg`, `node.inputs.steps`. Stable across UI reorderings. | ✓ |
| `workflow` (UI graph format) | `widgets_values` in positional order. Fragile across ComfyUI versions. | |
| Both — prompt first, workflow fallback | Max coverage, extra code. | |

**User's choice:** `prompt` (API format)
**Notes:** Recommended. Workflow-chunk fallback is deferred to a scoped gap closure if dogfooding surfaces misses.

| Option | Description | Selected |
|--------|-------------|----------|
| Best-effort, silently null | Missing param = `undefined`. Asset stays in Moshpit but drops out of any filter/sort needing the missing field. | ✓ |
| Best-effort + dev-only warning | Same runtime behaviour + `console.warn` in dev. | |
| Strict: partial-metadata counter | Surface `N assets: partial metadata` in Settings panel. | |

**User's choice:** Best-effort, silently null
**Notes:** Consistent with FILTER-09 / SORT-03. No user-facing noise.

| Option | Description | Selected |
|--------|-------------|----------|
| Name-set + weight pairs | `loras: [{name, weight}]`. Filter by name match, sort by count. | ✓ |
| Name-set only | `loras: string[]`. Filter by name, no weight exposure. | |
| Name+weight as single filter token | "LoRA X at 0.7 ± 0.1". Overkill for v1. | |

**User's choice:** Name-set + weight pairs, filter by name, sort by count
**Notes:** Recommended. Sort-by-weight is deferred to v2 — would require per-LoRA axis UI.

---

## Initial Filter Gate UX

| Option | Description | Selected |
|--------|-------------|----------|
| Settings panel only + empty canvas message | Panel (already open) shows workflow+time controls; canvas shows "Pick a workflow..." message. | ✓ |
| Centered full-canvas hero card | Large centered card with the controls. Duplicates panel UI. | |
| Modal overlay on first entry | PrimeVue Dialog blocks the canvas. Against new-PrimeVue conventions. | |

**User's choice:** Settings panel only + empty canvas message
**Notes:** Matches UX-01 and avoids a modal pattern foreign to the codebase.

| Option | Description | Selected |
|--------|-------------|----------|
| Searchable combobox with asset counts | `workflow_name (1,247 assets)` format. Reka/Tailwind. Scales to 100+ filenames. | ✓ |
| Flat scrolly list | No search. Awkward at scale. | |
| Native dropdown | Cheapest, least ergonomic. | |

**User's choice:** Searchable combobox of filenames with asset counts
**Notes:** Recommended. No new PrimeVue surface.

| Option | Description | Selected |
|--------|-------------|----------|
| Today / This week / This month / All time + custom | Matches PRD §7.2 and FILTER-01 literally. | ✓ |
| Presets only, no custom | Ship custom in Phase 7. | |
| PRD list + yesterday / last week / last month | Matches existing `DATE_PRESETS` but extras aren't in PRD. | |

**User's choice:** Today / This week / This month / All time + custom range
**Notes:** PRD-literal. Scope discipline — don't ship the existing yesterday/lastWeek/lastMonth extras.

| Option | Description | Selected |
|--------|-------------|----------|
| Single workflow only | Aligns with PRD §7.2; keeps core validation signal clean. | |
| Multi-workflow (checkbox list) | Wider scope; sparse 2D scatters when params don't align. | ✓ (initial) |

**User's choice (initial):** Multi-workflow (checkbox list)

**Follow-up:**

| Option | Description | Selected |
|--------|-------------|----------|
| Union asset sets, trust Best-effort extraction | Selected workflows' assets all land on canvas; drop-out per-asset where params missing. | |
| Multi-workflow, intersection of common params only | Avoids sparse scatters but hides useful per-workflow sweeps. | |
| Revert to single workflow | Stay aligned with PRD. v2 multi-workflow. | ✓ |

**User's final choice:** Revert to single workflow
**Notes:** Downstream implications (heterogeneous KSampler shapes, diluted validation signal, sparse 2D scatters) surfaced on follow-up; user chose to revert. Multi-workflow is v2.

| Option | Description | Selected |
|--------|-------------|----------|
| Searchable checkbox list with pills in field | Opens panel with search + checkboxes per workflow. | ✓ |
| One chip per workflow | Each selected workflow = own chip. | |
| Pre-filter only (no chip) | Sticky top-of-panel, not chip. | |

**User's choice:** Searchable checkbox list inside the workflow picker
**Notes:** Moot after single-workflow revert — recorded for audit. CONTEXT.md ships single-select searchable combobox only.

---

## Filter Chip Authoring

| Option | Description | Selected |
|--------|-------------|----------|
| + Add filter → two-step popover picker | Parameter → value editor. Matches Notion / Linear / Airtable. `/` focuses the button. | ✓ |
| All parameter controls always visible, collapsed | Every param row in panel, collapses when empty. Busier but discoverable. | |
| Command palette over `/` | `/cfg 7-9` parsed into chip. Power-user only. | |

**User's choice:** + Add filter button → two-step picker
**Notes:** Recommended. `/` key focus matches PRD §7.12.

| Option | Description | Selected |
|--------|-------------|----------|
| Per-type inline editors | Numbers: min-max. Categorical: multi-select. Text: substring. Resolution: presets+custom. Boolean: toggle. | ✓ |
| Universal string-match input | One text input per param. CFG ranges feel bad. | |
| Per-type inline + chip-summary when closed | Chip shows compact summary on close. More state to manage. | |

**User's choice:** Per-type inline editors
**Notes:** Recommended.

| Option | Description | Selected |
|--------|-------------|----------|
| One chip per parameter, values OR-combined within | "Sampler: euler OR dpmpp". Different params AND. | ✓ |
| Multiple chips per parameter, AND-combined | Sampler euler AND Sampler dpmpp = zero matches. Confusing. | |
| Toggle per chip: OR vs AND | Maximum power, overkill. | |

**User's choice:** One chip per parameter, values OR-combined within
**Notes:** Recommended — matches natural user phrasing.

| Option | Description | Selected |
|--------|-------------|----------|
| Implicit default, explicit toggle in panel footer | No chip by default. "Show hidden" checkbox near excluded-count row. | ✓ |
| Persistent chip "Hidden: false" | Chip visible from session start. Eats row space. | |
| Menu item in a settings gear | Tucked away. Discoverability suffers. | |

**User's choice:** Implicit default, explicit toggle in panel footer
**Notes:** Matches FILTER-11.

---

## Sort Controls + Bucketing

| Option | Description | Selected |
|--------|-------------|----------|
| X-axis picker always visible, Y-axis picker optional | `Sort — X: [param ▾]  Y: [+ Add axis]`. Axis state IS the mode. | ✓ |
| Explicit 1D/2D segmented toggle + axis picker(s) | Radio [1D|2D]. Clearer affordance, more controls. | |
| Command-style mini-form | Compact but less discoverable for optional Y. | |

**User's choice:** X-axis picker always visible, Y-axis picker optional
**Notes:** Recommended. No explicit mode toggle — axis state IS the mode.

| Option | Description | Selected |
|--------|-------------|----------|
| Column-per-unique-value for discrete + continuous | Groups by exact param value. Matches how users sweep parameters. | ✓ |
| Bucketed columns for continuous, unique for discrete | Auto-bucket CFG, unique-value steps. Requires type classification + bucket heuristic. | |
| True scatter: continuous map-min-to-max | Violates SORT-05 grid-snapped requirement. | |

**User's choice:** Column-per-unique-value for discrete + continuous
**Notes:** Recommended — deterministic, matches real sweep behaviour.

| Option | Description | Selected |
|--------|-------------|----------|
| 300ms ease-out-cubic tween, same as Phase 2 re-pack | Reuses `useMoshpitSpriteLayer` tween path. Single animation primitive. | ✓ |
| Snap (no tween) | Cheaper but kills spatial-memory benefit. | |
| Snap for sort, tween for filter removal only | Inconsistent feel. | |

**User's choice:** 300ms ease-out-cubic tween, same as Phase 2 re-pack
**Notes:** Matches Phase 2 D-04 precedent.

| Option | Description | Selected |
|--------|-------------|----------|
| HUMAN-UAT checklist with real parameter sweep + screenshots | 03-HUMAN-UAT.md documents the dogfood steps. User signs off qualitatively. | ✓ |
| Playwright E2E against a fixture + HUMAN-UAT | Stronger regression net; harder to build. | |
| Qualitative only, no artifact | Fastest but leaves no trace. | |

**User's choice:** HUMAN-UAT checklist with real parameter sweep, dogfood + screenshots
**Notes:** Phase 3 is the Core Value milestone — validation is a human judgement call. Negative sign-off pauses Phases 4–7.

---

## Claude's Discretion

Areas the user left unlocked for researcher/planner:

- Grid-spacing control UX (slider vs numeric input vs three-step picker).
- Clear-sort behaviour detail — D-19 locks "return to chaos" but exact animation behaviour is planner's call.
- Axis-label / legend rendering on canvas (PixiJS-drawn vs HTML overlay).
- Filter state storage store shape (new dedicated `moshpitFilterStore` recommended).
- "+ Add filter" picker scroll/filter behaviour (likely needs search for keyboard affordance).
- DateRange control reuse vs adapt vs ship-local.
- IDB schema migration strategy for the new `params` field on `assetMeta`.
- Axis label overlay alignment to viewport world-to-screen transforms.

## Deferred Ideas

- Multi-workflow selection — v2.
- Sort-by-LoRA-weight — v2.
- `workflow` chunk fallback for extraction — only if dogfooding surfaces misses.
- Auto-bucketing heuristic — v2 polish.
- Playwright E2E fixture for filter/sort — Phase 7 perf validation may cover.
- Saved filter/sort presets — out of scope per PRD.
- Semantic prompt search — out of scope per PRD.
- Shareable filter URL / query-param sync — not in PRD.
- Workflow grouping by graph hash — PRD §9 open question, v2.
- Thumbnail cache eviction — v2.
- Figma design reference check — no Phase 3 Figma node referenced during discussion.
