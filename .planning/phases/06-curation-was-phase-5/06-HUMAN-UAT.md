---
status: partial
phase: 06-curation-was-phase-5
source: [06-06-PLAN.md]
started: 2026-04-23T00:00:00Z
updated: 2026-04-23T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Favourite

expected: Select 3 sprites, press S. Toast "Favourited 3 assets" + Undo button. Add favourite:true filter chip — canvas narrows. Click Undo → sprites un-favourite. Re-favourite, wait >8s, press Cmd-Z → "Nothing to undo" toast.
result: [pending]

### 2. Tag

expected: Select 2 sprites, press T (or right-click → Tag…). Popover opens. Type "hero" + Enter → popover closes, toast confirms. Add tags:hero filter chip → canvas narrows.
result: [pending]

### 3. Hide

expected: Select 1 sprite, press H → sprite disappears. Toggle "Show hidden" in sidebar → sprite reappears. Press H again → unhides.
result: [pending]

### 4. Folders

expected: Settings → Folders → "+ New folder…" → type "Shortlist" + Enter. Select 4 sprites → right-click → "Add to folder…" → click Shortlist → toast confirms. Shortlist shows count=4. Click row → filter chip narrows canvas. Rename → "Final Four". Delete → folder removed.
result: [pending]

### 5. Tournament → Folder

expected: Select ≥4 sprites, Enter tournament. Pick winners until winner screen. Click "Save as folder" → inline input shows default name. Edit + Enter → folder appears in Folders section.
result: [pending]

### 6. Export

expected: Select 2 sprites, press E or right-click → "Export full-resolution…". Two downloads fire. Toast confirms. No Undo button in export toast.
result: [pending]

### 7. Persistence

expected: Hard-reload. Re-enter Moshpit. Favourited/tagged/hidden/folders all persisted.
result: [pending]

### 8. Regression

expected: Pin/unpin/download context menu still works. Tournament still works. Filters still work.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
