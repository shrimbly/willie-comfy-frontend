# Phase 5: Tournament Mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 05-tournament-mode-replaces-old-comparison-mode-framing
**Areas discussed:** Bracket algorithm, Tournament UI surface, Winner set semantics, Display mode mechanics

---

## Bracket Algorithm

### Pair generation & end condition

| Option                                   | Description                                     | Selected |
| ---------------------------------------- | ----------------------------------------------- | -------- |
| Adaptive: round-robin <8, single-elim ≥8 | PRD §9 default; auto by selection size at entry | ✓        |
| Always round-robin (cap at N)            | Every pair — fatigue at 16+                     |          |
| Always single-elimination                | N-1 comparisons; can feel unfair on close pairs |          |
| Sequential adjacent (king-of-the-hill)   | Winner vs #3 vs #4... — order-dependent         |          |

**User's choice:** Adaptive round-robin <8 / single-elim ≥8 (recommended)

### Skip semantics

| Option                               | Description                                 | Selected |
| ------------------------------------ | ------------------------------------------- | -------- |
| Skip = advance, re-queue pair at end | User can revisit; no lost comparisons       | ✓        |
| Skip = permanent no-decision         | Pair dropped entirely                       |          |
| Skip = drop both from tournament     | Sharpens winners, risks kicking good assets |          |

**User's choice:** Skip re-queues at end (recommended)

### Progress / exit-early

| Option                                                 | Description                                                    | Selected |
| ------------------------------------------------------ | -------------------------------------------------------------- | -------- |
| Visible counter + Esc exits early with partial winners | Pair M/N indicator; Esc carries both cancel and accept-partial | ✓        |
| No counter, Esc aborts                                 | Pure pixels but punishing on long brackets                     |          |
| Counter + explicit Finish button + Esc                 | More control, more chrome                                      |          |

**User's choice:** Visible counter + Esc exits early (recommended)

### Pair ordering

| Option                                  | Description                                             | Selected |
| --------------------------------------- | ------------------------------------------------------- | -------- |
| Deterministic by canvas selection order | Stable, debuggable, user-controlled via selection order | ✓        |
| Random shuffle on entry                 | Fresh pairings each time, non-deterministic             |          |
| Sorted by timestamp / filename          | Follows within-cluster-sort setting                     |          |

**User's choice:** Selection order (recommended)

---

## Tournament UI Surface

### Overlay mount

| Option                                     | Description                                                 | Selected |
| ------------------------------------------ | ----------------------------------------------------------- | -------- |
| Full-screen Vue overlay inside MoshpitView | Conditional mount sibling of MoshpitCanvas; no Pixi re-init | ✓        |
| Separate Vue route /moshpit/tournament     | Unmounts canvas; router push; deep-linkable                 |          |
| PixiJS layer on top of sprite layer        | Performant but reimplements UI primitives in Pixi           |          |

**User's choice:** Vue overlay inside MoshpitView (recommended)

### Sidebar behaviour

| Option                                   | Description                                        | Selected |
| ---------------------------------------- | -------------------------------------------------- | -------- |
| Auto-collapse on entry, restore on exit  | Consistent with Phase 1 "canvas collapses sidebar" | ✓        |
| Stay in current state                    | Lets user check filter chips during tournament     |          |
| Force-hidden in tournament, block toggle | Maximum focus but removes affordance               |          |

**User's choice:** Auto-collapse + restore (recommended)

### State location

| Option                                        | Description                                       | Selected |
| --------------------------------------------- | ------------------------------------------------- | -------- |
| New moshpitTournamentStore (Pinia, ephemeral) | Dedicated per-domain store, testable, ephemeral   | ✓        |
| Local refs inside MoshpitTournamentOverlay    | Simpler; harder to test pure logic                |          |
| Extend moshpitSelectionStore                  | Conceptually related; bloats single-purpose store |          |

**User's choice:** New moshpitTournamentStore (recommended)

### Keyboard routing

| Option                               | Description                                                          | Selected |
| ------------------------------------ | -------------------------------------------------------------------- | -------- |
| Scoped keydown + focus trap          | Matches useMoshpitSpacePan pattern; canvas keys gated by propagation | ✓        |
| Global command with mode guard       | commandStore route; net-new infra                                    |          |
| useMoshpitKeyboardContext composable | Central mode switcher; over-engineered for one mode                  |          |

**User's choice:** Scoped keydown + focus trap (recommended)

### Enter trigger

| Option                              | Description                                                        | Selected |
| ----------------------------------- | ------------------------------------------------------------------ | -------- |
| Container keydown on MoshpitView    | Next to existing Space-pan / Esc-clear; no new infra               | ✓        |
| commandStore registration           | Discoverable / rebindable; breaks Moshpit container-local symmetry |          |
| Button in Settings panel + shortcut | Discoverable; adds chrome                                          |          |

**User's choice:** Container keydown (recommended)

---

## Winner Set Semantics

### Winner set rule

| Option                                              | Description                                           | Selected |
| --------------------------------------------------- | ----------------------------------------------------- | -------- |
| Round-robin: top-3 with ties; Single-elim: champion | Bracket-aware; preserves round-robin's ranking signal | ✓        |
| All assets with ≥1 win                              | Inconsistent across bracket shapes                    |          |
| User confirms shortlist before exit                 | Explicit; adds a curation step                        |          |
| Single champion only                                | Cleanest; wastes round-robin signal                   |          |

**User's choice:** Bracket-aware top-3 / champion (recommended)

### Selection on exit

| Option                                              | Description                                                    | Selected |
| --------------------------------------------------- | -------------------------------------------------------------- | -------- |
| Esc restores / Finish replaces                      | Two semantics by exit path; matches TOUR-06 + TOUR-07 literals | ✓        |
| Always replace with winner set                      | Consistent but destructive on Esc                              |          |
| Always preserve original; winners in transient flag | Conservative; needs a second UI step                           |          |

**User's choice:** Esc restores / Finish replaces (recommended)

### Zero-picks fallback

| Option                            | Description                               | Selected |
| --------------------------------- | ----------------------------------------- | -------- |
| No-op + toast "No winners picked" | Graceful, informative                     | ✓        |
| Silent abort                      | Selection preserved; users may not notice |          |
| Modal confirmation                | Safest; adds chrome at dead-end           |          |

**User's choice:** No-op + toast (recommended)

### Resume vs restart

| Option                        | Description                   | Selected |
| ----------------------------- | ----------------------------- | -------- |
| Restart fresh every entry     | Matches ephemeral PRD framing | ✓        |
| Resume if selection unchanged | Helpful but brittle check     |          |

**User's choice:** Restart fresh (recommended)

---

## Display Mode Mechanics

### Side-by-side layout

| Option                        | Description                            | Selected |
| ----------------------------- | -------------------------------------- | -------- |
| 50/50 split, each aspect-fit  | Robust to mixed portrait + landscape   | ✓        |
| Match largest, scale other    | Biased for portrait-vs-landscape pairs |          |
| Responsive stacked/horizontal | Per-pair layout jumps                  |          |

**User's choice:** 50/50 aspect-fit (recommended)

### Overlap control

| Option                                       | Description                                 | Selected |
| -------------------------------------------- | ------------------------------------------- | -------- |
| Horizontal wipe + keyboard nudge             | Classic before/after UX; pointer + keyboard | ✓        |
| Opacity slider only                          | Simpler, less spatial-intuitive             |          |
| Both: wipe for pointer, opacity for keyboard | Richer but two models to learn              |          |

**User's choice:** Horizontal wipe + divider (recommended)

### A/B flip cadence

| Option                               | Description                | Selected |
| ------------------------------------ | -------------------------- | -------- |
| Manual only: Space flips once        | User-paced, predictable    | ✓        |
| Manual + auto-flip on hold           | Power-user flicker-compare |          |
| Manual + Shift+Space for detail zoom | Two affordances per key    |          |

**User's choice:** Manual Space only (recommended)

### Mode switch transition

| Option           | Description                         | Selected |
| ---------------- | ----------------------------------- | -------- |
| Instant swap     | Fast; no latency in power-user loop | ✓        |
| 300ms crossfade  | Smooth but adds perceptual latency  |          |
| Slide transition | Decorative                          |          |

**User's choice:** Instant swap (recommended)

### Peek panel layout

| Option                               | Description                                           | Selected |
| ------------------------------------ | ----------------------------------------------------- | -------- |
| Bottom-docked drawer                 | Assets stay visible above; matches pixels-first       |          |
| Right-side panel, pushes assets left | Side drawer; allows deeper scroll on long param lists | ✓        |
| Floating modal centered              | Obscures assets; conflicts with compare-while-reading |          |

**User's choice:** Right-side panel (user selected over recommendation; assets shrink to flex-1)

---

## Claude's Discretion

- Overlap wipe direction (horizontal vs vertical) — planner may flip based on dogfood.
- A/B-flip visual indicator in non-flip modes — border pulse vs corner label.
- Pair counter placement — top-left vs top-center.
- Peek panel exact width — `w-96` target with `w-80` / `w-[28rem]` alternatives.
- Diff highlight colour tokens — validated against Comfy Design Standards Figma.
- Wipe divider keymap (`,`/`.` + modifier pattern) — swap if conflicts discovered.
- Toast infrastructure — reuse existing `toastStore` or thinner Moshpit-local pattern.
- Single-elim bye distribution for non-power-of-2 N — first-N-seeds vs evenly-distributed.
- Preload concurrency cap — planner decides if burst saturates connection pool.
- Winner-set visual pulse on exit — polish detail.
- Peek icon gutter icon pick.

## Deferred Ideas

- Persisted tournament scores / elo / saved brackets (v2-TOUR-01/02).
- Per-cluster "best of N" scoping (v2-TOUR-03).
- Auto-selected comparison mode per pair (PRD Out of Scope).
- Mobile / touch affordances for wipe divider.
- Tournament-mode telemetry.
- Peek panel design polish (colours, icons, typography).
- Resume semantics for interrupted tournaments.
- Manual seeding UI for single-elim.
- Winner-set visual treatment (pulse highlight).
