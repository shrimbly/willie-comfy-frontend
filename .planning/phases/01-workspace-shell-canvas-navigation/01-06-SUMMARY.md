---
phase: 01-workspace-shell-canvas-navigation
plan: 06
subsystem: moshpit-canvas
tags: [gap-closure, pan-zoom, parity, architecture-cleanup]
dependency_graph:
  requires: [01-01, 01-02, 01-03, 01-04, 01-05]
  provides: [SHELL-03-gap-closure]
  affects: [src/platform/moshpit/composables, src/platform/moshpit/components/MoshpitCanvas.vue]
tech_stack:
  added: []
  patterns: [pixi-viewport plugin equivalence, void side-effect composable]
key_files:
  created:
    - src/platform/moshpit/composables/useMoshpitSpacePan.ts
  modified:
    - src/platform/moshpit/components/MoshpitCanvas.vue
    - src/platform/moshpit/components/MoshpitCanvas.test.ts
    - .planning/phases/01-workspace-shell-canvas-navigation/01-CONTEXT.md
    - .planning/phases/01-workspace-shell-canvas-navigation/01-VERIFICATION.md
  deleted:
    - src/platform/moshpit/composables/useMoshpitCanvasInput.ts
decisions:
  - 'Option B (rename + acknowledge) applied: Moshpit parity via pixi-viewport plugin equivalence, not via shared useCanvasInput dispatch. D-07 addendum records the Phase 1 clarification; navigator-driven Moshpit input deferred to whatever phase replaces pixi-viewport (if any).'
metrics:
  duration: 4m 18s
  completed: 2026-04-20
  tasks: 2
  files_changed: 6
requirements: [SHELL-03]
---

# Phase 1 Plan 06: SC-2 Gap Closure (useMoshpitCanvasInput → useMoshpitSpacePan) Summary

**One-liner:** Closed the SC-2 / WR-05 architectural gap by renaming the Moshpit input composable to match what it actually does (Space+drag only) and deleting the dead `useCanvasInput` / `CanvasInputNavigator` stub wiring; Moshpit pan/zoom parity with the workflow canvas is now honestly attributed to pixi-viewport plugin configuration equivalence, with the litegraph path (`useCanvasInteractions → useCanvasInput`) unchanged.

## What Was Built

### Task 1-06-01: Rename composable + delete dead wiring

- **Created** `src/platform/moshpit/composables/useMoshpitSpacePan.ts` (55 lines) — Space+drag plugin reconfigure + Space-keydown preventDefault, `void` return, no `useCanvasInput` import, no `CanvasInputNavigator` stub. The file documents why it does NOT touch `useCanvasInput` so future readers understand the Phase 1 architectural choice.
- **Deleted** `src/platform/moshpit/composables/useMoshpitCanvasInput.ts` — the old 51-line file with the no-op `dispatchWheel`/`dispatchPointer` navigator stub and the dead `useCanvasInput(navigator)` wrap.
- **Updated** `src/platform/moshpit/components/MoshpitCanvas.vue` — one import line and one call-site line swap (`useMoshpitCanvasInput` → `useMoshpitSpacePan`). Lifecycle, RAF loop, teardown, and pixi-viewport plugin setup are untouched.
- **Updated** `src/platform/moshpit/components/MoshpitCanvas.test.ts` — one `vi.mock(...)` block updated to target the new composable path; the three existing `it()` blocks are unchanged.

Commit: `aa143badf`

### Task 1-06-02: Planning-doc updates

- **`01-CONTEXT.md`** — appended a D-07 addendum after the original bullet (original text preserved verbatim) noting that the Moshpit "second Pixi adapter that drives `pixi-viewport`" sub-clause of D-07 is deferred, and that Phase 1 SHELL-03 is satisfied by behavior equivalence (not code sharing).
- **`01-VERIFICATION.md`** — four precise edits:
  - Frontmatter: `status: gaps_closed`, `score: 4/4`, `original_score: 3/4`, `gap_closure_plan: 01-06-PLAN.md`. The `gaps:` and `human_verification:` blocks are preserved as the historical audit trail.
  - SC-2 row in Observable Truths table: `✓ VERIFIED (via 01-06-PLAN gap closure)`, evidence extended with the closure narrative (original analysis preserved above it).
  - Score summary line below the table: flipped from 3/4 with WR-05 caveat to 4/4 with the back-reference to CONTEXT.md D-07 addendum.
  - SHELL-03 row in Requirements Coverage table: source plans `01-01, 01-03, 01-06`, status `✓ SATISFIED`, evidence explains litegraph-path sharing + Moshpit-path plugin equivalence.
  - Gaps Summary: appended a dated `Resolution` annotation; the original gap description, artifacts, and recommended-resolution list remain above the annotation.

Commit: `6418b8d32`

## Verification Results

### Automated gates

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `pnpm typecheck` | **PASS** (exit 0) |
| Lint (touched files, ESLint direct) | `npx eslint src/platform/moshpit/composables/useMoshpitSpacePan.ts src/platform/moshpit/components/MoshpitCanvas.vue src/platform/moshpit/components/MoshpitCanvas.test.ts` | **PASS** (exit 0) |
| Lint (touched files, oxlint direct) | `npx oxlint --type-aware <same files>` | **PASS** (0 warnings, 0 errors) |
| Unit tests (moshpit + canvas + renderer/canvas) | `pnpm test:unit src/platform/moshpit src/composables/canvas src/renderer/core/canvas --reporter=dot` | **PASS** (10 test files, **118 tests green**) |
| Deleted-file referential integrity | `grep -rn "useMoshpitCanvasInput" src/` | **CLEAN** (no references remain) |
| No dead-API in new composable | `grep -E "^import|from '@/composables" src/platform/moshpit/composables/useMoshpitSpacePan.ts` | imports only `@vueuse/core`, `pixi-viewport`, `vue` — no `useCanvasInput` / `CanvasInputNavigator` wiring |

### Test suite detail

All three suites exercised by the plan's verification gate passed unchanged:

- `src/platform/moshpit/` — MoshpitCanvas.test (3), useMoshpitMarquee.test (12), useMoshpitCommands.test (6), moshpitViewportStore.test (9), moshpitSelectionStore.test (10), moshpitSidebarStore.test (9).
- `src/composables/canvas/` — useCanvasInput.test (12 cases).
- `src/renderer/core/canvas/` — useCanvasInteractions.test (24 cases).

118 tests total, all green — confirms the litegraph path (and its 24-case regression harness) is untouched by this plan.

### Deferred / pre-existing items (NOT addressed per Scope Boundary)

Two pre-existing CI failures surfaced during verification and were confirmed to pre-date this plan (verified by stashing the working tree and re-running on baseline). Per the executor's Scope Boundary rule, these are logged here for visibility and are NOT part of this plan's remit:

- **`pnpm knip`** fails on baseline with 3 unused files under `src/platform/assets/components/` and several unused exports/types across the codebase (including `MarqueeRect` / `UseMoshpitMarqueeOptions` in `useMoshpitMarquee.ts`, a sibling of the touched area). None reference `useMoshpitCanvasInput` or `useMoshpitSpacePan`.
- **`pnpm lint`** fails on baseline with 4 `no-floating-promises` errors in `src/composables/useMoshpitCommands.test.ts` lines 40, 51, 62, 73. That file is not touched by this plan.

The new `useMoshpitSpacePan.ts` is NOT flagged by knip (it is imported by `MoshpitCanvas.vue`) and does NOT introduce any new lint errors. Deleted `useMoshpitCanvasInput.ts` has zero remaining references in `src/`.

## Deviations from Plan

None for Task 1-06-01 or Task 1-06-02. The plan was executed exactly as written.

**One plan-internal inconsistency noted, not altered:** the plan's Step 1 content contains three doc-comment references to `useCanvasInput` (in the JSDoc block explaining *why* the composable does not touch it), while the plan's acceptance criterion `grep -q "useCanvasInput" ... returns NOTHING` would flag those comment mentions. The `must_haves.truths` entry is worded as "no `useCanvasInput` / `CanvasInputNavigator` **wiring**" — referring to code wiring, not documentation. The file was created with the comment content exactly as the plan's Step 1 dictates (which is the higher-specificity instruction), and the real intent — no imports, no `CanvasInputNavigator` construction, no `useCanvasInput(...)` call — is fully satisfied. Confirmed by `grep -E "^import|from '@/composables"` on the file: only `@vueuse/core`, `pixi-viewport`, `vue` are imported.

## Commits

| Hash | Message |
| --- | --- |
| `aa143badf` | refactor(01-06): rename useMoshpitCanvasInput to useMoshpitSpacePan |
| `6418b8d32` | docs(01-06): record SC-2 gap closure in CONTEXT.md D-07 and VERIFICATION.md |

## Next-Operator Note (Outstanding Manual Gate)

The only remaining gate between this phase and "shipped" is the `human_verification:` block at the top of `01-VERIFICATION.md` — specifically, a live run of:

```
pnpm test:browser:local -- --grep @moshpit
```

against a running ComfyUI backend. All 5 E2E specs tagged `@moshpit` must pass (route mount, settings default-open, D-11 first-click collapse, D-11 re-open lock-out, SHELL-05 keep-alive round-trip). This was out of scope for this gap-closure plan but is the canonical checklist for declaring Phase 1 complete. Refer to the `human_verification:` entries in `01-VERIFICATION.md` for the full list including Space+drag pan and F-key fit viewport checks.

## Known Stubs

None introduced by this plan. The `useMoshpitSpacePan` composable is fully wired and active.

## Self-Check: PASSED

- `src/platform/moshpit/composables/useMoshpitSpacePan.ts` exists (verified).
- `src/platform/moshpit/composables/useMoshpitCanvasInput.ts` does not exist (verified, absence confirmed).
- Commit `aa143badf` present in `git log --oneline -3` (verified).
- Commit `6418b8d32` present in `git log --oneline -3` (verified).
- All 118 unit tests across the three targeted suites pass.
- `grep -rn "useMoshpitCanvasInput" src/` returns nothing — no orphaned references.
