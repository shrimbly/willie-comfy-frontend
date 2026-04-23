---
phase: 260424-9cn
plan: 01
subsystem: moshpit-canvas-overlays
tags: [moshpit, reka-ui, context-menu, floating-action-bar, styling]
requires: []
provides:
  - Programmatic v-model:open support for sprite context menu (fixes right-click regression from 260423-kx4)
  - GraphCanvasMenu-aligned floating action bar silhouette (rectangular, border-interface-stroke, bg-comfy-menu-bg)
affects:
  - src/views/MoshpitView.vue (caller already uses spriteContextMenuRef.open() — no change needed)
tech-stack:
  added: []
  patterns:
    - Reka UI DropdownMenu* substituted for ContextMenu* when a parent needs programmatic open (ContextMenu only listens for native contextmenu events on its Trigger)
    - Internal Button variant=secondary + hover:bg-interface-button-hover-surface! is the canonical toolbar button idiom (verbatim from GraphCanvasMenu)
key-files:
  created: []
  modified:
    - src/platform/moshpit/components/MoshpitSpriteContextMenu.vue
    - src/platform/moshpit/components/MoshpitFloatingActionBar.vue
decisions:
  - Drop-in rename from ContextMenu* → DropdownMenu* preserves every behavioural contract (props/emits/defineExpose/item selection); no test changes required
  - Removed pointerEvents:'none' inline style from 0x0 anchor div — DropdownMenuTrigger requires pointer eligibility for Reka's focus-trap setup; 0x0 geometry still prevents click interception
  - Obsolete iconButtonClasses const deleted once all FAB icons moved to <Button variant="secondary">; cn() import retained for cn(btn.icon, 'size-4')
metrics:
  duration: ~12 min
  completed: 2026-04-24
---

# Quick Task 260424-9cn: Fix Moshpit Context Menu Programmatic Open + Restyle Floating Action Bar

Restored right-click sprite context menu (regressed at 260423-kx4 by adopting Reka `ContextMenu` which is bound to native `contextmenu` events) by swapping to `DropdownMenu` which honours `v-model:open`, and re-aligned `MoshpitFloatingActionBar` to the canonical ComfyUI toolbar silhouette defined by `GraphCanvasMenu`.

## Deviations from Plan

None — plan executed exactly as written. The only cosmetic note: the FAB test suite contains 15 tests (not 13 as the plan stated); all 15 pass unchanged.

## Tasks Completed

| #   | Task                                                                                    | Commit      | Files                                                          |
| --- | --------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------- |
| 1   | Swap MoshpitSpriteContextMenu from ContextMenu to DropdownMenu (v-model:open works)     | `22b34dbcc` | `src/platform/moshpit/components/MoshpitSpriteContextMenu.vue` |
| 2   | Restyle MoshpitFloatingActionBar to match GraphCanvasMenu (rectangular, bordered, flat) | `fb04a9885` | `src/platform/moshpit/components/MoshpitFloatingActionBar.vue` |

## Verification

- `pnpm exec vitest run src/platform/moshpit/components/MoshpitSpriteContextMenu.test.ts` → 19/19 passed
- `pnpm exec vitest run src/platform/moshpit/components/MoshpitFloatingActionBar.test.ts` → 15/15 passed
- `pnpm typecheck` → clean
- `pnpm exec eslint` on both modified files → clean

## Self-Check: PASSED

- FOUND: `src/platform/moshpit/components/MoshpitSpriteContextMenu.vue` (modified)
- FOUND: `src/platform/moshpit/components/MoshpitFloatingActionBar.vue` (modified)
- FOUND: commit `22b34dbcc` in git log
- FOUND: commit `fb04a9885` in git log
