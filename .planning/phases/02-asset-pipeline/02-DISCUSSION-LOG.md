# Phase 2: Asset Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 02-asset-pipeline
**Areas discussed:** Chaos placement, Processing indicator UX

---

## Gray Area Selection

**Question:** Which Phase 2 gray areas do you want to discuss?

| Option                  | Description                                                                        | Selected |
| ----------------------- | ---------------------------------------------------------------------------------- | -------- |
| Content-hash strategy   | Cache key + Phase 5 curation key. SHA-256 vs server hash + fallback vs path+mtime. |          |
| IndexedDB library       | Raw IDB API vs `idb` vs `dexie`.                                                   |          |
| Chaos placement         | PRD §9 open question. Pure random vs jittered grid vs physics-settle.              | ✓        |
| Processing indicator UX | Docked location + cancel + resume semantics.                                       | ✓        |

**User's choice:** Chaos placement + Processing indicator UX. Content-hash and IDB library delegated to Claude's discretion (researcher/planner).

---

## Chaos Placement

### Placement algorithm

| Option                      | Description                                                                       | Selected |
| --------------------------- | --------------------------------------------------------------------------------- | -------- |
| Jittered grid (Recommended) | Deterministic hash→grid-cell + per-cell jitter. Grid-snapped, SORT-05 compatible. | ✓        |
| Pure random in rectangle    | Random (x,y) in bounding rect. Can overlap.                                       |          |
| Physics settle              | Random seed + rigid-body settle. Frame-budget risk.                               |          |

**User's choice:** Jittered grid.

### Determinism

| Option                              | Description                                                | Selected |
| ----------------------------------- | ---------------------------------------------------------- | -------- |
| Seeded by filter hash (Recommended) | Same filter + same asset set → same layout across reloads. | ✓        |
| Fresh randomness every session      | New layout every entry. Breaks spatial memory.             |          |
| Persist layout to IndexedDB         | Write positions to disk on first compute.                  |          |

**User's choice:** Seeded by filter hash.

### Bounding region

| Option                                 | Description                                                    | Selected |
| -------------------------------------- | -------------------------------------------------------------- | -------- |
| Square scaled to sqrt(N) (Recommended) | Bounds grow as sqrt(N) \* cellSize. `F` always frames cleanly. | ✓        |
| Fit to viewport aspect ratio           | Bounds match canvas aspect.                                    |          |
| Unbounded grid                         | Infinite pan; simplest positioning.                            |          |

**User's choice:** Square scaled to sqrt(N).

### Re-pack animation

| Option                     | Description                                                    | Selected |
| -------------------------- | -------------------------------------------------------------- | -------- |
| Instant jump (Recommended) | PRD §7.3 literal ("acceptable visual jump"). Zero motion cost. |          |
| Brief tween (~300ms ease)  | All surviving sprites ease to packed positions.                | ✓        |
| Stagger settle (~600ms)    | Per-index delay cascade. Most polished, most code.             |          |

**User's choice:** Brief tween (~300ms ease).
**Notes:** User explicitly upgraded from the recommended option — willing to spend the ~300ms motion budget for a more intentional feel.

### More questions on Chaos?

**User's choice:** Next area. Open items (cell-size / aspect-ratio / seed-invalidation) deferred to research/planning.

---

## Processing Indicator UX

### Location

| Option                                  | Description                                                 | Selected |
| --------------------------------------- | ----------------------------------------------------------- | -------- |
| Bottom-left floating pill (Recommended) | Canvas overlay; visible regardless of Settings panel state. | ✓        |
| Settings panel header row               | Hidden when panel collapsed.                                |          |
| Both — header + pill                    | Two render paths, migrates to user focus.                   |          |

**User's choice:** Bottom-left floating pill.

### Format

| Option                                  | Description                                            | Selected |
| --------------------------------------- | ------------------------------------------------------ | -------- |
| Count + thin progress bar (Recommended) | "Processing 1247 / 5000" + thin bar. Matches PRD §7.3. | ✓        |
| Count only                              | No bar. Loses visual "how close".                      |          |
| Circular spinner + count badge          | More modern; less scannable at 5k.                     |          |

**User's choice:** Count + thin progress bar.

### Cancel semantics

| Option                                           | Description                                                | Selected |
| ------------------------------------------------ | ---------------------------------------------------------- | -------- |
| Abort queue, keep completed thumbs (Recommended) | AbortController-based; cached thumbs preserved; resumable. | ✓        |
| Abort + discard in-flight writes                 | Cleaner "cancel means cancel"; loses partial work.         |          |
| Pause (in-flight finishes)                       | Explicit pause; more state to manage.                      |          |

**User's choice:** Abort queue, keep completed thumbs.

### Resume on re-entry

| Option                                | Description                                                 | Selected |
| ------------------------------------- | ----------------------------------------------------------- | -------- |
| Auto-resume on re-entry (Recommended) | Worker picks up remaining queue silently. Matches ASSET-08. | ✓        |
| Show "Resume processing" toast        | Explicit confirm click on every return.                     |          |
| Sticky cancel — no auto-resume        | User must re-trigger manually. Rejects ASSET-08.            |          |

**User's choice:** Auto-resume on re-entry.

### More questions on Processing indicator?

**User's choice:** Wrap up. Filter-change-mid-processing, excluded-count placement, and indicator fade-out deferred to research/planning.

---

## Final

**Question:** Explore more gray areas or write CONTEXT.md?
**User's choice:** I'm ready for context.

## Claude's Discretion

- Content-hash strategy (Web Crypto SHA-256 in worker recommended; trust server `asset_hash` fast-path on cloud)
- IndexedDB library (`idb` recommended)
- Worker architecture (single worker + internal concurrency cap of 4 recommended)
- IndexedDB schema (`thumbs` + `assetMeta` two-store split recommended)
- Asset store shape (split into thumb / metadata / curation stores recommended)
- Filter-change-mid-processing sequencing (PRD §7.3 is the rule)
- Excluded-count placement inside Settings panel (static row under filter chips recommended)
- Indicator fade-out on completion (600ms hold + 200ms fade recommended)
- Sprite lifecycle on cold load (no placeholder; slot reserved; sprite on thumb-ready)

## Deferred Ideas

- Cross-reload layout persistence to IndexedDB — filter-hash seeding may satisfy intent; revisit if users report mismatch.
- Thumbnail aspect-ratio handling — 512px is max-dim; cell-size math locked by planner.
- Figma reference check for pill chrome before implementation.
