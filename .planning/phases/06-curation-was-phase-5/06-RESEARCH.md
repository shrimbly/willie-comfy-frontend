# Phase 6: Curation — Research

**Researched:** 2026-04-23
**Domain:** IndexedDB-backed bulk mutation + toast-undo UX layered on top of shipped Moshpit selection/tournament primitives
**Confidence:** HIGH (all primary patterns verified in-repo; no new libraries required)

## Summary

Phase 6 wires five bulk mutation verbs (favourite, tag, hide, folder-assign, export) onto the existing selection → action composable pipeline already shipped by quick tasks `260423-led` (floating action bar), `260423-kx4` (context menu), and `260423-led` (`useMoshpitSpriteActions`). The curation data model and persistence story are already 80% solved — `CurationRecord` lives on every `AssetMetaRecord` and MoshpitDB is at v4. Phase 6 adds (1) mutation actions to `moshpitCurationStore` that write through to IDB via a new `curationRepository`, (2) a toast-with-Undo primitive that extends the shipped `toastStore`/`GlobalToast` PrimeVue pipeline (via `#message` slot + `life: 8000`), (3) UI surfaces on the two existing entry points plus a new folders sidebar section, (4) S/T/H/E/Cmd-Z keybindings on `MoshpitView.onContainerKeydown`, and (5) a `foldersStore` primitive (folders are user-defined, must be enumerated/created independently of per-asset tags). Tags enumerate themselves from the curation map.

**Primary recommendation:** Ship in four waves: (W0) `curationRepository` + MoshpitDB v5 with `folders` store + curation store mutation actions with in-memory optimistic + debounced IDB writes; (W1) `useMoshpitCuration` orchestrator that wraps each mutation in an undo-able command + fires a toast-with-action via a new `MoshpitUndoToast.vue` PrimeVue group; (W2) UI — extend context menu + action bar with curation items, build `MoshpitTagInputPopover` + `MoshpitFoldersSection` + `MoshpitExportButton`, integrate S/T/H/E/Cmd-Z keybinds; (W3) filter-integration for tag enumeration + `MoshpitShowHiddenToggle` already effective via `filterMath.applyFilterChips` — confirm.

<phase_requirements>

## Phase Requirements

| ID        | Description                                                              | Research Support                                                                                                |
| --------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| CURATE-01 | Favourite/unfavourite via right-click or `S`                             | `useMoshpitSpriteActions.favouriteMany` + context menu item + keybind (§1, §3, §4)                              |
| CURATE-02 | Free-text tags via right-click or `T`; filterable                        | `tagMany` + `MoshpitTagInputPopover` + filter chip already exists for `tags` (§3, §6)                           |
| CURATE-03 | Add to user-defined folders; shortlist persistence                       | `foldersStore` + `MoshpitFoldersSection` in sidebar + `addToFolderMany` + "Create folder from winners" (§3, §6) |
| CURATE-04 | Hide/unhide via right-click or `H`; filtered by default                  | `hideMany` + filter store `showHidden` already wired in `filterMath` (§1, §6)                                   |
| CURATE-05 | Export at full resolution via right-click or `E`                         | `exportMany` — full-res via existing `resolveFullResUrl` pattern; distinct from `downloadMany` (§5)             |
| CURATE-06 | Toast with ~8s Undo for tag/untag/hide/unhide/folder/bulk-favourite      | `MoshpitUndoToast` PrimeVue group with `life: 8000` + inverse command (§1)                                      |
| CURATE-07 | Cmd/Ctrl-Z within window undoes last action; permanent after toast fades | `lastUndoable` ref in curation composable; `onContainerKeydown` intercepts (§1, §4)                             |

</phase_requirements>

## User Constraints (from CONTEXT.md)

**No CONTEXT.md was provided by the upstream.** The orchestrator supplied an `<additional_context>` block with research priorities but no locked decisions — the planner should treat the following as the implicit decisions the orchestrator already made:

### Locked Decisions (implicit from additional_context + ROADMAP)

- No real deletion in v1 — hide only (confirmed by CURATE-04 wording + Phase 6 Goal).
- Content-hash keyed in IndexedDB (confirmed by `CurationRecord` on `AssetMetaRecord`, ASSET-04).
- Toast-with-Undo pattern, ~8s window, `Cmd/Ctrl-Z` binds to last action (CURATE-06, CURATE-07).
- Bulk favourite fires a toast; single-asset favourite does not (CURATE-06 explicit list — "bulk favourite").
- Folders are a curation layer, not filesystem moves (CURATE-03).
- Folders can be created from a tournament winner set in one action (ROADMAP SC-5).
- Export at "full resolution" via `/view?filename=…` (existing `resolveFullResUrl` pattern).

### Claude's Discretion

- Tag input UX (inline popover vs. dedicated editor) — recommendation below.
- Folder UX placement (sidebar section vs. settings panel) — recommendation below.
- Whether `toastStore.add` API is extended (add action button to `ToastMessageOptions.extra`) or whether a second store is used — recommendation: extend via a dedicated `MoshpitUndoToast` PrimeVue group using PrimeVue's `#message` slot, no core toast-store change needed (§1).
- MoshpitDB migration shape for `folders` — object store vs. array field on curation — recommendation: separate `folders` store (holds folder metadata: id/name/createdAt) + `CurationRecord.folders: string[]` holds folder ids (already the schema).

### Deferred Ideas (OUT OF SCOPE)

- Generate More Like This (cut from v1, v2-GEN-01/02).
- Persisted tournament ranking (V2-TOUR-01).
- LRU thumbnail eviction (V2-SCALE-04).
- Cloud-synced curation (V2-SCALE-03).
- Real deletion (V2-UX-03).
- Mobile / touch.
- Tag auto-complete / suggestions beyond enumerated existing tags (v1 = free text only).
- Persisted undo history (undo is toast-window only; after fade, permanent).

## Project Constraints (from CLAUDE.md)

- TypeScript strict, no `any`, no `as any`, no `@ts-expect-error`.
- Vue 3.5 `<script setup lang="ts">` with destructured props + defaults; no `withDefaults`.
- `defineModel` for v-model; `emit`/`@event-name` for state changes.
- No `:class="[]"` — use `cn()` from `@/utils/tailwindUtil`.
- No `dark:` variant — use semantic tokens from `packages/design-system/src/css/style.css` (e.g. `bg-interface-panel-surface`, `bg-base-background`, `text-base-foreground`, `ring-(--focus-ring)`, `border-border-subtle`).
- No `!important` or arbitrary percentage widths.
- No new PrimeVue component usage; **reuse existing `primevue/toast`** — confirmed via `GlobalToast.vue`/`RerouteMigrationToast.vue`.
- All strings via `useI18n()` / `t()`; new keys under `moshpit.curation.*` in `src/locales/en/main.json`.
- Layer boundary: curation lives in `platform/` — may import `base/`, may not import `workbench/` or `renderer/`.
- Commit format: `feat:`, `fix:`, `test:`, `refactor:` — scope `(moshpit)` or per-phase.
- Storybook + Playwright skill triggers apply for new SFCs / e2e specs.

---

## 1 — Mutation Pattern: optimistic + IDB + toast undo

The shipped pattern (`useMoshpitSpriteDrag` lines 194-205, `useMoshpitOverrideStore` schedulePersist, `useMoshpitSpriteActions`) establishes:

- **optimistic**: mutation writes the in-memory Pinia store synchronously (caller reads update in the same tick).
- **IDB**: mutation schedules a debounced (100ms) `db.put`; repository failures `console.warn` and never break UX.
- **toast**: a `primevue/toast`-backed `useToastStore().add({ severity, summary, detail, life })` — PrimeVue's `#message` slot supports custom content including action buttons (verified in `RerouteMigrationToast.vue`).

### Recommended Shape

```ts
// src/platform/moshpit/composables/useMoshpitCuration.ts
// Each action wraps: inverse-capture → optimistic apply → IDB write → undoable toast.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMoshpitCurationStore } from '@/platform/moshpit/stores/moshpitCurationStore'
import { useToastStore } from '@/platform/updates/common/toastStore'

export interface UndoableAction {
  readonly id: string // uuid; used by toast + Cmd-Z
  readonly label: string // e.g. "Tagged 12 assets"
  readonly expiresAt: number // Date.now() + 8000
  readonly undo: () => void // re-applies the inverse command
}

const UNDO_WINDOW_MS = 8000

export function useMoshpitCuration() {
  const curationStore = useMoshpitCurationStore()
  const toastStore = useToastStore()
  const { t } = useI18n()
  const lastUndoable = ref<UndoableAction | null>(null)

  function tagMany(hashes: readonly string[], tag: string): void {
    // 1. Capture inverse (per-hash "had tag already?" so untagging is correct)
    const priorHadTag = new Map(
      hashes.map((h) => [h, curationStore.get(h)?.tags.includes(tag) ?? false])
    )
    // 2. Optimistic apply (store writes to IDB via its own debounced path)
    for (const h of hashes) curationStore.addTag(h, tag)

    // 3. Publish undoable + toast
    const action: UndoableAction = {
      id: crypto.randomUUID(),
      label: t('moshpit.curation.tagged', { count: hashes.length, tag }),
      expiresAt: Date.now() + UNDO_WINDOW_MS,
      undo: () => {
        for (const h of hashes) {
          if (!priorHadTag.get(h)) curationStore.removeTag(h, tag)
        }
      }
    }
    lastUndoable.value = action
    toastStore.add({
      severity: 'info',
      summary: action.label,
      detail: t('moshpit.curation.undoHint'), // "Press Cmd/Ctrl-Z or click Undo"
      life: UNDO_WINDOW_MS,
      // group targets MoshpitUndoToast (new component, see §3)
      group: 'moshpit-curation',
      // Pass action id via `data` — PrimeVue ToastMessageOptions accepts arbitrary fields
      // (type is widened; project convention uses summary/detail/life).
      ...{ data: { actionId: action.id } }
    })
  }

  function undoLast(): boolean {
    const a = lastUndoable.value
    if (!a || Date.now() > a.expiresAt) return false
    a.undo()
    lastUndoable.value = null
    toastStore.removeAll() // close the pending undo toast
    return true
  }

  return {
    tagMany,
    favouriteMany,
    hideMany,
    addToFolderMany,
    undoLast,
    lastUndoable
  }
}
```

### Toast-with-Action Button

`primevue/toast` supports a per-group `#message` slot (verified: `RerouteMigrationToast.vue` embeds a `<Button>` inside `#message`). Create `MoshpitUndoToast.vue` rendered once in `MoshpitLayout.vue`:

```vue
<Toast group="moshpit-curation" position="bottom-center">
  <template #message="{ message, closeCallback }">
    <div class="flex items-center gap-3">
      <span class="text-sm">{{ message.summary }}</span>
      <button
        type="button"
        :class="cn('rounded-md px-2 py-1 text-sm bg-interface-panel-surface hover:bg-interface-panel-hover focus-visible:ring-2 focus-visible:ring-(--focus-ring)')"
        @click="() => { curation.undoLast(); closeCallback() }"
      >
        {{ t('moshpit.curation.undo') }}
      </button>
    </div>
  </template>
</Toast>
```

No change to `toastStore.ts` required — the `group` field on `ToastMessageOptions` routes the message to this dedicated `<Toast>` mount, and the `messagesToAdd` watcher already forwards `group` through.

### Debounce / Persistence via curationStore

`moshpitCurationStore` gains the same debounced-persist pattern `moshpitOverrideStore` uses (100ms, per-hash). A new `curationRepository.ts` mirrors `overrideRepository.ts`:

```ts
// src/platform/moshpit/services/curationRepository.ts
export async function saveCuration(
  hash: string,
  curation: CurationRecord
): Promise<void> {
  const db = await getMoshpitDB()
  const existing = await db.get('assetMeta', hash)
  if (!existing) return // curation only persists when assetMeta exists (ASSET-04 invariant)
  await db.put('assetMeta', { ...existing, curation })
}
```

## 2 — Data Model Changes & MoshpitDB v5 Migration

### CurationRecord: no shape change required

`CurationRecord { favourite, tags: string[], folders: string[], hidden }` in `thumbRepository.types.ts` is already the target schema. `folders` holds folder **ids** (stable strings), not user-facing names — names live in the new `folders` store so renaming is O(1) and id references are invariant.

### New `folders` object store at v5

```ts
// thumbRepository.types.ts — add alongside existing types
export interface FolderRecord {
  readonly id: string // uuid; stable across renames
  readonly name: string // user-visible; editable
  readonly createdAt: number // epoch ms
}

export interface MoshpitDB extends DBSchema {
  thumbs: { key: string; value: ThumbRecord }
  assetMeta: { key: string; value: AssetMetaRecord }
  overrides: { key: string; value: OverridePersistedRecord }
  folders: { key: string; value: FolderRecord } // new at v5
}

export const MOSHPIT_DB_VERSION = 5
```

### Upgrade hook (mirror existing v4 pattern in `thumbRepository.ts:113-121`)

```ts
if (oldVersion < 5) {
  if (!db.objectStoreNames.contains('folders')) {
    db.createObjectStore('folders', { keyPath: 'id' })
  }
  // No per-record migration: CurationRecord.folders[] is already a string[] on
  // every existing assetMeta record. A ref integrity pass (drop folder ids that
  // don't exist in `folders`) is not needed at upgrade time — pre-v5 data has
  // `folders: []` universally (no Phase 6 UI existed). If a user somehow has
  // non-empty folder arrays, they silently become dangling references until
  // next read, at which point the filter/chip layer treats them as "no match"
  // — harmless.
}
```

**Pitfall (Pitfall 4 from prior upgrades):** the v5 upgrade must `try/catch` any per-record work — today there is none, so the v5 upgrade is the cleanest of the four. Still follow the in-place `if (!db.objectStoreNames.contains(...))` guard pattern.

### moshpitCurationStore mutation actions

```ts
// Additions to moshpitCurationStore.ts — new Setup-API exports:
function setFavourite(hash: string, favourite: boolean): void
function addTag(hash: string, tag: string): void
function removeTag(hash: string, tag: string): void
function setHidden(hash: string, hidden: boolean): void
function addToFolder(hash: string, folderId: string): void
function removeFromFolder(hash: string, folderId: string): void
```

Each: read existing (default via `defaultCuration()`), build new immutable `CurationRecord`, call `curationByHash.value.set(hash, next)` (with `new Map(...)` wrap so Pinia watchers fire — see `moshpitOverrideStore.setPin` pattern), schedule debounced `saveCuration(hash, next)`.

### New `moshpitFoldersStore`

```ts
// src/platform/moshpit/stores/moshpitFoldersStore.ts
export const useMoshpitFoldersStore = defineStore('moshpitFolders', () => {
  const folders = ref<Map<string, FolderRecord>>(new Map())
  const orderedFolders = computed(() =>
    [...folders.value.values()].sort((a, b) => a.createdAt - b.createdAt)
  )

  async function hydrate(): Promise<void> {
    /* loadAllFolders() */
  }
  function create(name: string): string {
    /* returns new folder id */
  }
  function rename(id: string, name: string): void
  function remove(id: string): void // also strips id from all CurationRecord.folders[]
  function createFromSelection(name: string, hashes: readonly string[]): string
  return {
    folders,
    orderedFolders,
    hydrate,
    create,
    rename,
    remove,
    createFromSelection
  }
})
```

`remove` must also scrub every `CurationRecord.folders[]` that references the deleted id — iterate `curationStore.curationByHash` and call `removeFromFolder` per match. Folder deletion is **not** a curation undoable action (delete-with-undo on a folder that references many assets is complex; planner decision, but recommend: folders are lightweight and managing them is cheap, so deletion is terminal with a confirm-prompt).

## 3 — UX Surfaces

### Context Menu additions (`MoshpitSpriteContextMenu.vue`)

Extend the shipped menu. After the existing Pin/Unpin block, before the Download separator, add:

```
─────────────
[S] Favourite (or Unfavourite if all selected are fav'd)
[T] Tag…                                      ▸ (opens tag popover)
[H] Hide  (or Unhide if all selected are hidden)
Add to folder…                                ▸ (submenu: list folders + "New folder…" + "New folder from selection")
─────────────
[E] Export full-resolution…
```

- Use `reka-ui` `ContextMenuSub` + `ContextMenuSubContent` for the two nested popovers (tag input + folder picker). Reka is already the established menu primitive for Moshpit.
- Keyboard hints (`S`, `T`, `H`, `E`) render right-aligned via `ContextMenuItem`'s existing layout — follow PrimeVue menu convention: `<span class="ml-auto text-xs opacity-60">{{ shortcut }}</span>`.

### Floating Action Bar additions (`MoshpitFloatingActionBar.vue`)

After the existing Unpin/Download buttons, insert a divider and add curation buttons. Consider collapsing to a three-dot overflow once >6 buttons — but 6 buttons still fits cleanly at typical widths. Proposed layout:

```
[ 3 selected | Pin/Unpin | Download ] ─── [ Favourite | Tag | Hide | Add to folder | Export ] ─── [ Clear ]
```

### Tag input UX — recommended: `MoshpitTagInputPopover.vue`

A Reka `PopoverRoot` that opens on `T` / context menu "Tag…" selection. Contents:

- Text `<input>` with autofocus for new tag entry.
- Enter submits; Esc closes without applying.
- Below the input: chip list of **existing tags** (enumerated via `computed(() => new Set(curationStore.curationByHash.values().flatMap((c) => c.tags)))`) — click to apply instantly.
- Visual distinction between tags the whole selection already has vs. tags only some have (checkbox or tri-state indicator).

Do **not** build a dedicated modal editor — the popover is the muscle-memory precedent set by `MoshpitAddFilterPopover`.

### Folders UX — recommended: `MoshpitFoldersSection.vue` inside `MoshpitSettingsPanel.vue`

Folders need enumeration independent of per-asset state (unlike tags which are flat). A dedicated sidebar section below the filter chip row is the natural home:

```
┌─ Folders ─────────────────┐
│ ★ Shortlist A  (12)   ⋯  │
│ ★ To review   (5)     ⋯  │
│ + New folder              │
└───────────────────────────┘
```

- `(12)` is count of assets where `CurationRecord.folders.includes(folder.id)`.
- Clicking a folder row filters the canvas to that folder (adds a folder chip — requires new `folder` ParamKey + `FilterChip` kind `folder`, see §6).
- `⋯` overflow menu: Rename / Delete / Tournament this folder (convenience wrapper around `tournamentStore.enter(members)`).
- `+ New folder` opens an inline input.
- **"Create folder from tournament winners"** appears as a dedicated button inside the Tournament winner screen (see §7).

### Export UX — silent start, toast on completion

`exportMany(hashes)` iterates sequentially, triggering `<a download>` per hash with the full-resolution URL (see §5). No modal — the download behaviour is the same as the shipped `downloadMany`. Single toast `"Exporting N assets at full resolution…"`. Export is **NOT undoable** — toast is informational, no Undo button, no Cmd-Z interception (exclude from `lastUndoable`).

### Component inventory for Phase 6

| Component                        | Purpose                                             | New / Extend |
| -------------------------------- | --------------------------------------------------- | ------------ |
| `MoshpitSpriteContextMenu.vue`   | Add curation items                                  | Extend       |
| `MoshpitFloatingActionBar.vue`   | Add curation buttons                                | Extend       |
| `MoshpitTagInputPopover.vue`     | T-key tag popover                                   | **New**      |
| `MoshpitFolderPickerPopover.vue` | Add-to-folder submenu + "new folder from selection" | **New**      |
| `MoshpitFoldersSection.vue`      | Sidebar folders list                                | **New**      |
| `MoshpitSettingsPanel.vue`       | Mount `MoshpitFoldersSection`                       | Extend       |
| `MoshpitUndoToast.vue`           | PrimeVue Toast group with Undo button               | **New**      |
| `MoshpitLayout.vue`              | Mount `MoshpitUndoToast` once                       | Extend       |
| `MoshpitTournamentWinner.vue`    | "Create folder from winners" button                 | Extend       |

New SFCs trigger the `writing-storybook-stories` skill (stories for `MoshpitTagInputPopover`, `MoshpitFoldersSection`, `MoshpitUndoToast` at minimum).

## 4 — Keyboard Shortcut Integration

`MoshpitView.onContainerKeydown` (lines 197-211) currently handles `Enter` only. Metadata peek `M` handling lives in the tournament keybindings composable (scope: overlay only), so canvas-level keys are clean.

### Conflict check against shipped keybinds

| Key               | Current use                 | Phase 6 proposed                                      | Conflict?                                                             |
| ----------------- | --------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| `F`               | Fit view (NAV-02)           | —                                                     | no                                                                    |
| `Z`               | Zoom to selection (NAV-02)  | —                                                     | no                                                                    |
| `Cmd/Ctrl-A`      | Select all visible (NAV-05) | —                                                     | no                                                                    |
| `Cmd/Ctrl-Z`      | **none on canvas today**    | Undo last curation                                    | safe (browser default on `<input>` is still Undo — not relevant here) |
| `Esc`             | Clear selection (NAV-05)    | —                                                     | no                                                                    |
| `Enter`           | Tournament entry (TOUR-01)  | —                                                     | no                                                                    |
| `S`               | none                        | Favourite toggle                                      | safe                                                                  |
| `T`               | none                        | Open tag popover                                      | safe                                                                  |
| `H`               | none                        | Hide toggle                                           | safe                                                                  |
| `E`               | none                        | Export full-res                                       | safe                                                                  |
| `M`               | Tournament: peek toggle     | **Tournament-scoped only** — canvas-level `M` is free | safe (but do not bind `M` on canvas)                                  |
| `←/→/↓/Space/[/]` | Tournament-scoped           | —                                                     | safe                                                                  |

### Recommended dispatcher structure

Extract curation keybinds from `onContainerKeydown` into a dedicated composable for testability (mirrors `useMoshpitTournamentKeybindings`):

```ts
// src/platform/moshpit/composables/useMoshpitCurationKeybindings.ts
export function useMoshpitCurationKeybindings(
  containerEl: Ref<HTMLElement | null>,
  options: { openTagPopover: () => void; openExportFlow: () => void }
) {
  // Listens on containerEl keydown; guards against:
  //   - tournamentStore.isActive (curation keys disabled during tournament)
  //   - selectionStore.size === 0 (nothing to act on — no-op, no toast)
  //   - Cmd/Ctrl-Z → curation.undoLast() with fallback-no-op if expired
  //   - S → curation.favouriteMany(selected); bulk-toast only if size > 1 (CURATE-06)
  //   - T → options.openTagPopover()
  //   - H → curation.hideMany(selected)
  //   - E → options.exportMany(selected)  (never undoable)
  // Ignores keys when focused inside an <input>/<textarea>/[contenteditable].
}
```

**Gotcha — avoid `filterStore.isGated` dead-key confusion:** like tournament, curation should also be gated — curation on a 0-asset canvas is meaningless. Guard with `selectionStore.size > 0`. No toast on empty-selection keypress (discoverability cost is low — the floating action bar only shows when selected).

**Gotcha — input focus:** the pattern shipped in Tournament (window-capture-phase gated on `isActive`) is not needed here. Canvas-level keydown on `containerEl` is only delivered when the container has focus (`tabindex="0"`, `containerEl.focus()` on pointer-down — see `MoshpitView.vue:134`). Opening the tag popover will move focus out of the container, so `T` inside the popover's `<input>` is correctly not intercepted.

## 5 — Export Flow

`CURATE-05` requires "full resolution". The existing `MoshpitView.resolveFullResUrl(hash)` (lines 120-127) already does the lookup: `assetsStore.historyAssets` + `metadataStore.getHashForAssetId` bridge → `getAssetUrl(asset)` which constructs `/view?filename=…&type=output`.

### Distinction from downloadMany

`useMoshpitSpriteActions.downloadMany` already uses `getAssetUrl` (line 61), which **is** the full-res URL — ComfyUI `AssetItem.url` returns `/view?filename=…`, not the thumbnail. So Phase 6 `exportMany` is **semantically identical to the shipped `downloadMany`**, but:

- Should live on `useMoshpitCuration` not `useMoshpitSpriteActions` (keeps curation vocabulary together).
- Should emit a distinct i18n message (`moshpit.curation.exporting` not `contextMenu.downloadStarted`).
- Should **not** fire Undo (irreversible per §3).

If `downloadMany` is eventually unified under the curation composable, deprecate the context-menu "Download" item in favour of "Export" — but that's a small refactor deferred to the planner's judgement.

### Bulk sequential download gotcha

Browsers may throttle or block rapid-fire `<a download>` clicks (Chromium permission prompt after ~10 downloads in short succession). Current `downloadMany` is synchronous-loop; for large selections (>50), add a `setTimeout(..., 50)` stagger or a confirm-prompt when `hashes.length > 25`. Verify empirically during UAT.

## 6 — Filter Integration

### Tags — already wired

`filterMath.matchesCategoricalChip` (line 146) already handles `param === 'tags'`:

```ts
if (param === 'tags') {
  return val.values.some((tag) => curation.tags.includes(tag))
}
```

and `tags` is in `PRIMARY_FILTER_PARAMS` (`filterTypes.ts:42`). No math changes needed. **But:** `useMoshpitParamValueOptions` must enumerate live tags — check its current handling of `tags`:

- If it returns `[]` today (Phase 2 scaffold), Phase 6 must extend it to return `orderedTags = computed(() => [...new Set(curationStore.curationByHash.values().flatMap((c) => c.tags))].sort())`.

### Folders — new filter dimension

To filter by folder, add `'folder'` to `ParamKey`:

```ts
// filterTypes.ts
export type ParamKey = ... | 'folder'
export const PRIMARY_FILTER_PARAMS = [..., 'folder']   // surface in primary chip popover

// filterMath.ts — add branch to matchesCategoricalChip:
if (param === 'folder') {
  return val.values.some((folderId) => curation.folders.includes(folderId))
}
```

Value-options for `folder` come from `foldersStore.orderedFolders`. Filtering by folder is OR-within-chip (matches tags semantics) + AND-across-chips.

### Hidden — already wired

`filterMath.applyFilterChips` (lines 321-322) already honours `showHidden`:

```ts
if (!showHidden && cur.hidden) continue
```

and `moshpitFilterStore.showHidden` defaults to `false` (line 82). `MoshpitShowHiddenToggle.vue` is shipped and wired. **Verified: the showHidden toggle is effective today**, but will only show visible behaviour once Phase 6 ships `hideMany` to actually mark assets hidden.

### Favourite — already wired

`filterMath.matchesBooleanChip` (line 207) + `favourite` in `PRIMARY_FILTER_PARAMS`. No changes.

## 7 — Tournament → Folder Handoff

Tournament exit (`moshpitTournamentStore.exit`) applies the winner set to `selectionStore.setSelection(winners)` (line 214). Phase 5's `MoshpitTournamentWinner.vue` is the natural site for a "Save as folder" button.

### Recommended handoff

Extend `MoshpitTournamentWinner.vue` with a button that opens an inline name-input popover. On submit:

```ts
function onSaveAsFolder(name: string) {
  const winners = tournamentStore.winnerHashes.value // readonly string[]
  const folderId = foldersStore.createFromSelection(name, winners)
  toastStore.add({
    severity: 'info',
    summary: t('moshpit.curation.folderCreated', {
      name,
      count: winners.length
    }),
    life: 4000
  })
  // Note: do not close the winner dialog — user may still want to see winners.
  // The folder is persisted; Cmd-Z is NOT available here (different composable scope).
}
```

- `createFromSelection(name, winners)` = `create(name)` → for each hash `addToFolder(hash, id)` → persist → return id.
- The winner set is computed pre-exit, so this must happen **before** `tournamentStore.exit()` is called, OR rely on the post-exit `selectionStore.selected` which equals winners at that moment.
- The flow does **not** need a toast undo — folder creation is explicit and the folder itself can be deleted via the folders sidebar.

### Alternative placement (rejected)

Putting "Save as folder" on the post-exit floating action bar is possible (winners are the selection), but worse UX — the tournament winner screen is the high-intent moment where the user has just finished curating. Surfacing "Save as folder" there converts a one-off session into a persistent shortlist, which is exactly the core-value framing ("lineage-grouped canvas + shortlist/tournament").

## Architecture Patterns

### Recommended Project Structure

```
src/platform/moshpit/
├── composables/
│   ├── useMoshpitCuration.ts             # new — orchestrator (mutations + undo + toast)
│   ├── useMoshpitCurationKeybindings.ts  # new — S/T/H/E/Cmd-Z dispatcher
│   └── useMoshpitSpriteActions.ts        # existing — keep pin/download here
├── components/
│   ├── MoshpitSpriteContextMenu.vue      # extend
│   ├── MoshpitFloatingActionBar.vue      # extend
│   ├── MoshpitTagInputPopover.vue        # new
│   ├── MoshpitFolderPickerPopover.vue    # new
│   ├── MoshpitFoldersSection.vue         # new (sidebar)
│   ├── MoshpitUndoToast.vue              # new (mounted once in MoshpitLayout)
│   └── MoshpitTournamentWinner.vue       # extend: "Save as folder" button
├── services/
│   └── curationRepository.ts             # new (mirrors overrideRepository.ts)
├── services/
│   └── foldersRepository.ts              # new (folders CRUD)
└── stores/
    ├── moshpitCurationStore.ts           # add mutation actions + debounced persist
    └── moshpitFoldersStore.ts            # new
```

### Pattern: Undoable Mutation

Every undoable action captures its inverse **before** applying the forward command. This is simpler than a global undo stack and aligns with the 8s-toast-only window (CURATE-07). No persisted undo history.

### Anti-Patterns to Avoid

- **Don't build a global undo-history stack.** CURATE-07 is explicit: "after the toast fades, actions are permanent". A one-slot `lastUndoable` ref is correct.
- **Don't extend `toastStore.ts`** to carry action callbacks. The PrimeVue `#message` slot + a per-group `<Toast>` mount is the idiomatic pattern (see `RerouteMigrationToast.vue`).
- **Don't reuse `useMoshpitSpriteActions`** for curation verbs. That composable is scoped to sprite layout mutations; curation belongs in a sibling composable for testability and layer clarity.
- **Don't put folders on `CurationRecord` as inline names.** Use ids + separate `folders` store so rename is O(1) and empty folders can exist.
- **Don't treat export as a curation mutation.** Export is a read-side operation; no IDB write, no undoable.

## Don't Hand-Roll

| Problem                          | Don't Build                       | Use Instead                                                                                                         | Why                                                                     |
| -------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Toast with action button         | Custom floating alert + timeout   | Existing `primevue/toast` `#message` slot (already in deps, shipped pattern in `RerouteMigrationToast.vue`)         | Keyboard focus, ARIA live-region, auto-dismiss, queueing are all solved |
| Debounced IDB writes             | Manual `setTimeout` per call site | Pattern from `moshpitOverrideStore.schedulePersist` (100ms debounce, per-key pending map)                           | Tested, handles cancellation + flush semantics                          |
| UUID for folder ids / action ids | Hand-rolled random string         | `crypto.randomUUID()` (baseline-supported on all target browsers — ES2022 target)                                   | Collision-free, no deps                                                 |
| Context-menu submenus            | Custom overlay math               | `reka-ui` `ContextMenuSub` / `ContextMenuSubContent` (already the menu primitive in `MoshpitSpriteContextMenu.vue`) | Keyboard nav, positioning, Escape-to-close                              |
| IDB migration pass               | Schema rebuild                    | Additive `if (!db.objectStoreNames.contains(...))` guard + version bump (pattern in `thumbRepository.ts:38-122`)    | Non-destructive; tested v1→v4 path                                      |
| Tag deduplication                | Manual `Array.filter`             | `new Set(...)` round-trip at mutation time                                                                          | Negligible cost for <1k tags                                            |
| "Full resolution" URL            | Reconstruct `/view?filename=…`    | Existing `getAssetUrl(asset)` (§5)                                                                                  | Handles subfolder/type params, OSS-path fallback                        |

**Key insight:** Phase 6 is mostly wiring — the store, persistence, menu, action bar, and toast pipelines all exist. Budget the work around mutation-composable, the new folder store, and UI polish, not infra.

## Common Pitfalls

### Pitfall 1: Stale toast window on rapid mutations

**What goes wrong:** User hits `S` twice rapidly → second action fires before the first toast expires → `lastUndoable` overwrites → Cmd-Z only undoes the second.

**Why it happens:** Single-slot `lastUndoable` is intentional (CURATE-07 explicit) but user expectation may not match.

**How to avoid:** Document clearly in-toast: "Undo reverses only your most recent action." Optional refinement: on second action within 500ms, merge into the first (e.g. batch favourite operations) — defer to planner; likely v2 polish.

### Pitfall 2: IDB write amplification on bulk actions

**What goes wrong:** `favouriteMany([100 hashes])` schedules 100 debounced writes.

**Why it happens:** The per-hash debounce pattern optimises single-field edits; it's the wrong unit for bulk.

**How to avoid:** For bulk mutations, flush immediately in a single IDB transaction:

```ts
async function saveManyCurations(
  updates: ReadonlyMap<string, CurationRecord>
): Promise<void> {
  const db = await getMoshpitDB()
  const tx = db.transaction('assetMeta', 'readwrite')
  await Promise.all(
    [...updates].map(async ([hash, curation]) => {
      const existing = await tx.store.get(hash)
      if (existing) await tx.store.put({ ...existing, curation })
    })
  )
  await tx.done
}
```

And expose `curationStore.applyManyOptimistic(updates)` that writes all in-memory values in one `records.value = new Map(...)` swap + a single `saveManyCurations` call (no debounce). Per-hash `schedulePersist` is still correct for single-asset edits (tag-one, hide-one from single-click context menu).

### Pitfall 3: CurationRecord for a hash without assetMeta

**What goes wrong:** User tries to curate a hash that exists in the sprite layer but whose `assetMeta` entry was never persisted (e.g. cache miss race). `curationRepository.saveCuration` silently returns (no-op).

**Why it happens:** `CurationRecord` is nested inside `AssetMetaRecord` (not its own store) — no asset meta = no persistence.

**How to avoid:** This is actually the correct invariant (ASSET-04: curation lives with meta). Ensure the in-memory curation store mutation still applies, and the write lands when `putAssetMeta` runs for the hash. Consider a fallback: queue orphaned curation updates in a Map keyed by hash, flush when `assetMeta` lands. Alternative (simpler, recommended): detect the missing-meta case and show a console.warn; curation on brand-new assets is rare because processing must complete before the asset is in the registry.

### Pitfall 4: Folder deletion dangling references

**What goes wrong:** User deletes folder `foo-123` while 200 assets reference it in `CurationRecord.folders`. The references are now dangling.

**Why it happens:** Two stores (`folders` + `assetMeta.curation`) share an id relationship.

**How to avoid:** `foldersStore.remove(id)` iterates `curationStore.curationByHash` and calls `removeFromFolder(hash, id)` before deleting from the `folders` store. This is expensive for 5k assets but acceptable (one-shot, <50ms). Alternative: treat missing folder ids as inert (filter returns no match) — cheaper but leaks storage over time. **Recommend: scrub on delete.**

### Pitfall 5: Undo outside toast window is silently ignored

**What goes wrong:** User Cmd-Z 10s after action → nothing happens → user thinks Cmd-Z is broken.

**How to avoid:** `undoLast()` checks `Date.now() > expiresAt` and returns `false`. When false AND no other action to undo, fire an informational toast: `"Nothing to undo — the last action is already permanent."` Life: 2000ms. Keeps discoverability without spamming.

### Pitfall 6: Tag string hygiene

**What goes wrong:** User types " Hero " → tag saved with leading/trailing whitespace → filter doesn't match "Hero".

**How to avoid:** Normalise at mutation time: `tag = tag.trim()`. Reject empty post-trim. Consider also lower-casing for case-insensitive match, but that's a UX decision — recommend preserving case for display but comparing case-insensitive in filter (requires updating `filterMath.matchesCategoricalChip` for the `tags` branch). **Defer to planner.**

### Pitfall 7: Cmd-Z inside an input

**What goes wrong:** User types a tag in `MoshpitTagInputPopover`, hits Cmd-Z to undo a typo → curation undo fires instead of input undo.

**How to avoid:** Keybindings composable short-circuits when `document.activeElement` matches `input, textarea, [contenteditable="true"]`. Already a standard guard; apply consistently.

## Runtime State Inventory

Phase 6 is additive — no rename/refactor. However, curation state is persisted, so **data compatibility** must be tracked:

| Category            | Items Found                                                                                                                                                                                                        | Action Required                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Stored data         | `AssetMetaRecord.curation: CurationRecord` — already persisted at MoshpitDB v1+. New: `folders` object store at v5. `CurationRecord.folders[]` ids must resolve to a `folders` store entry (or be silently inert). | Additive migration v4→v5 creates `folders` store. No existing data transformation. |
| Live service config | None — Moshpit is client-side only, no external services.                                                                                                                                                          | None.                                                                              |
| OS-registered state | None.                                                                                                                                                                                                              | None.                                                                              |
| Secrets / env vars  | None.                                                                                                                                                                                                              | None.                                                                              |
| Build artifacts     | None — additive code only.                                                                                                                                                                                         | None.                                                                              |

**Canonical question:** "After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?" — **nothing**, because Phase 6 adds new fields only; no existing fields are renamed or removed.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest 4.0.16 + happy-dom 20.0.11 (unit/component); Playwright 1.58.1 (e2e)                                                             |
| Config file        | `vite.config.mts` (vitest block); `playwright.config.ts`                                                                                |
| Quick run command  | `pnpm test:unit -- src/platform/moshpit/stores/moshpitCurationStore.test.ts`                                                            |
| Full suite command | `pnpm test:unit -- src/platform/moshpit`                                                                                                |
| E2E                | `pnpm test:browser:local -- browser_tests/tests/moshpit/phase-06-curation.spec.ts` (deferred if tsconfig:browser blocker still present) |

### Phase Requirements → Test Map

| Req ID    | Behavior                                                  | Test Type          | Automated Command                                                                             | File Exists?                                                                 |
| --------- | --------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| CURATE-01 | favouriteMany toggles + persists                          | unit               | `pnpm test:unit -- moshpitCurationStore.test.ts -t "favourite"`                               | ❌ Wave 0                                                                    |
| CURATE-01 | S key triggers favouriteMany on selection                 | component          | `pnpm test:unit -- useMoshpitCurationKeybindings.test.ts -t "S"`                              | ❌ Wave 0                                                                    |
| CURATE-02 | addTag/removeTag + persistence                            | unit               | `pnpm test:unit -- moshpitCurationStore.test.ts -t "tag"`                                     | ❌ Wave 0                                                                    |
| CURATE-02 | tag filter matches curation.tags                          | unit (exists)      | `pnpm test:unit -- filterMath.test.ts -t "tags"`                                              | ✅ (filterMath tests already cover tag path — verify no gap)                 |
| CURATE-02 | MoshpitTagInputPopover opens on T, applies on Enter       | component          | `pnpm test:unit -- MoshpitTagInputPopover.test.ts`                                            | ❌ Wave 0                                                                    |
| CURATE-03 | foldersStore.create + addToFolder                         | unit               | `pnpm test:unit -- moshpitFoldersStore.test.ts`                                               | ❌ Wave 0                                                                    |
| CURATE-03 | MoshpitFoldersSection enumerates + filters                | component          | `pnpm test:unit -- MoshpitFoldersSection.test.ts`                                             | ❌ Wave 0                                                                    |
| CURATE-03 | createFromSelection captures winner set                   | unit               | `pnpm test:unit -- moshpitFoldersStore.test.ts -t "fromSelection"`                            | ❌ Wave 0                                                                    |
| CURATE-04 | setHidden + showHidden filter respects it                 | unit               | `pnpm test:unit -- filterMath.test.ts -t "hidden"` + `moshpitCurationStore.test.ts -t "hide"` | ✅ partial (filterMath has hidden tests) / ❌ curation mutation tests Wave 0 |
| CURATE-05 | exportMany invokes resolveFullResUrl + triggers downloads | unit (mock DOM)    | `pnpm test:unit -- useMoshpitCuration.test.ts -t "export"`                                    | ❌ Wave 0                                                                    |
| CURATE-06 | bulk mutations schedule toast with life=8000 + summary    | unit               | `pnpm test:unit -- useMoshpitCuration.test.ts -t "toast"`                                     | ❌ Wave 0                                                                    |
| CURATE-07 | Cmd-Z within 8s invokes inverse; after 8s no-op           | unit (fake-timers) | `pnpm test:unit -- useMoshpitCuration.test.ts -t "undo"`                                      | ❌ Wave 0                                                                    |
| CURATE-07 | keybinding dispatches undoLast                            | component          | `pnpm test:unit -- useMoshpitCurationKeybindings.test.ts -t "undo"`                           | ❌ Wave 0                                                                    |
| CURATE-06 | tournament→folder: "Save as folder" writes folder record  | component          | `pnpm test:unit -- MoshpitTournamentWinner.test.ts -t "save as folder"`                       | ❌ Wave 0 (extends existing file)                                            |
| All       | e2e smoke: favourite + tag + hide + undo round-trip       | e2e                | `pnpm test:browser:local -- browser_tests/tests/moshpit/phase-06-curation.spec.ts`            | ❌ Wave 0 (deferrable per Phase 4 tsconfig blocker precedent)                |

### Sampling Rate

- **Per task commit:** `pnpm test:unit -- <single test file>` — <10s.
- **Per wave merge:** `pnpm test:unit -- src/platform/moshpit` — full moshpit suite (~30s at current 625-test count).
- **Phase gate:** Full suite + `pnpm typecheck` + `pnpm lint` green before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `src/platform/moshpit/services/curationRepository.test.ts` — saveCuration round-trip with real fake-indexeddb
- [ ] `src/platform/moshpit/services/foldersRepository.test.ts` — folder CRUD
- [ ] `src/platform/moshpit/stores/moshpitCurationStore.test.ts` — extend existing file with mutation actions (favourite/tag/hide/folder + debounced persist)
- [ ] `src/platform/moshpit/stores/moshpitFoldersStore.test.ts` — new file
- [ ] `src/platform/moshpit/composables/useMoshpitCuration.test.ts` — new file, covers undoable pattern + toast emission + bulk flush
- [ ] `src/platform/moshpit/composables/useMoshpitCurationKeybindings.test.ts` — new file, happy-dom keydown synth
- [ ] `src/platform/moshpit/components/MoshpitTagInputPopover.test.ts` — Testing Library + user-event
- [ ] `src/platform/moshpit/components/MoshpitFoldersSection.test.ts`
- [ ] `src/platform/moshpit/components/MoshpitFolderPickerPopover.test.ts`
- [ ] `src/platform/moshpit/components/MoshpitUndoToast.test.ts`
- [ ] MoshpitDB v5 migration path — extend `thumbRepository.test.ts` with a v4→v5 upgrade assertion (folders store exists + empty)
- [ ] `browser_tests/tests/moshpit/phase-06-curation.spec.ts` — e2e smoke (deferrable)

No framework install needed — Vitest + happy-dom + fake-indexeddb + testing-library/vue + fast-check all shipped by Phase 2.

## Code Examples

### 1. Curation store mutation (extends existing store)

```ts
// Inside moshpitCurationStore.ts — new Setup-API function
function setFavourite(hash: string, favourite: boolean): void {
  const current = curationByHash.value.get(hash) ?? defaultCuration()
  if (current.favourite === favourite) return
  const next: CurationRecord = { ...current, favourite }
  const map = new Map(curationByHash.value)
  map.set(hash, next)
  curationByHash.value = map
  schedulePersist(hash, next)
}
```

### 2. Debounced IDB persist (mirrors overrideStore)

```ts
const PERSIST_DEBOUNCE_MS = 100
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

function schedulePersist(hash: string, next: CurationRecord): void {
  const existing = pendingTimers.get(hash)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    pendingTimers.delete(hash)
    saveCuration(hash, next).catch((err) =>
      console.warn('[moshpit] curation persist failed', err)
    )
  }, PERSIST_DEBOUNCE_MS)
  pendingTimers.set(hash, timer)
}
```

### 3. Toast-with-Undo — PrimeVue group mount (new component)

```vue
<!-- src/platform/moshpit/components/MoshpitUndoToast.vue -->
<template>
  <Toast group="moshpit-curation" position="bottom-center">
    <template #message="{ message, closeCallback }">
      <div class="flex items-center gap-3 px-2 py-1">
        <span class="text-sm text-base-foreground">{{ message.summary }}</span>
        <button
          type="button"
          :class="btnClasses"
          data-testid="moshpit-undo-toast-button"
          @click="onUndo(closeCallback)"
        >
          {{ t('moshpit.curation.undo') }}
        </button>
      </div>
    </template>
  </Toast>
</template>

<script setup lang="ts">
import Toast from 'primevue/toast'
import { useI18n } from 'vue-i18n'
import { useMoshpitCuration } from '@/platform/moshpit/composables/useMoshpitCuration'
import { cn } from '@/utils/tailwindUtil'

defineOptions({ name: 'MoshpitUndoToast' })
const { t } = useI18n()
const curation = useMoshpitCuration()

const btnClasses = cn(
  'rounded-md px-2 py-1 text-sm outline-none',
  'bg-interface-panel-surface hover:bg-interface-panel-hover',
  'focus-visible:ring-2 focus-visible:ring-(--focus-ring)'
)

function onUndo(close: () => void): void {
  curation.undoLast()
  close()
}
</script>
```

### 4. Keybindings composable (extract from MoshpitView)

```ts
// src/platform/moshpit/composables/useMoshpitCurationKeybindings.ts
import type { Ref } from 'vue'
import { onMounted, onUnmounted } from 'vue'
import { useMoshpitCuration } from './useMoshpitCuration'
import { useMoshpitSelectionStore } from '../stores/moshpitSelectionStore'
import { useMoshpitTournamentStore } from '../stores/moshpitTournamentStore'

interface Options {
  readonly containerEl: Ref<HTMLElement | null>
  readonly openTagPopover: () => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function useMoshpitCurationKeybindings(options: Options): void {
  const curation = useMoshpitCuration()
  const selectionStore = useMoshpitSelectionStore()
  const tournamentStore = useMoshpitTournamentStore()

  function onKeydown(e: KeyboardEvent): void {
    if (tournamentStore.isActive) return
    if (isEditableTarget(e.target)) return

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      if (curation.undoLast()) e.preventDefault()
      return
    }
    if (selectionStore.size === 0) return
    switch (e.key.toLowerCase()) {
      case 's':
        curation.favouriteMany(selectionStore.selected)
        e.preventDefault()
        return
      case 't':
        options.openTagPopover()
        e.preventDefault()
        return
      case 'h':
        curation.hideMany(selectionStore.selected)
        e.preventDefault()
        return
      case 'e':
        curation.exportMany(selectionStore.selected)
        e.preventDefault()
        return
    }
  }

  onMounted(() =>
    options.containerEl.value?.addEventListener('keydown', onKeydown)
  )
  onUnmounted(() =>
    options.containerEl.value?.removeEventListener('keydown', onKeydown)
  )
}
```

## State of the Art

| Old Approach                          | Current Approach                             | When Changed                                   | Impact                                             |
| ------------------------------------- | -------------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| Custom undo stack                     | Single-slot `lastUndoable` + 8s toast window | CURATE-07 explicit in v3 PRD                   | Simpler; aligns with toast-is-the-affordance model |
| Direct IDB mutation from UI           | Store mutation → debounced repository write  | Shipped in `moshpitOverrideStore` (260423-m6c) | Established pattern; reuse                         |
| `toastStore` with summary/detail only | PrimeVue `#message` slot for action buttons  | Already in-repo (`RerouteMigrationToast`)      | No new API needed                                  |

**Deprecated / outdated:**

- Phase 2's `moshpitCurationStore` with only `load/get/reset` — gains mutation actions in Phase 6 Plan 01 (non-breaking extension).

## Environment Availability

Phase 6 is pure frontend additive work. No external services, no CLIs, no new packages.

| Dependency                          | Required By           | Available         | Version          | Fallback                     |
| ----------------------------------- | --------------------- | ----------------- | ---------------- | ---------------------------- |
| `primevue/toast`                    | MoshpitUndoToast      | ✓                 | 4.2.5 (catalog)  | —                            |
| `reka-ui` ContextMenuSub            | Curation submenus     | ✓                 | 2.5.0            | —                            |
| `idb` (IDBPDatabase)                | curationRepository    | ✓                 | shipped Phase 2  | —                            |
| `fake-indexeddb`                    | repository tests      | ✓                 | shipped Phase 2  | —                            |
| `vitest` + happy-dom                | unit/component tests  | ✓                 | 4.0.16 / 20.0.11 | —                            |
| `crypto.randomUUID()`               | folder/action ids     | ✓ (ES2022 target) | native           | `Math.random().toString(36)` |
| `@testing-library/vue` + user-event | popover/section tests | ✓                 | 8.1.0 / 14.6.1   | `@vue/test-utils`            |

**No missing dependencies.**

## Security Domain

Applicable ASVS categories for Phase 6:

| ASVS Category         | Applies | Standard Control                                                                         |
| --------------------- | ------- | ---------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | (client-only curation; no API writes)                                                    |
| V3 Session Management | no      | (curation is session-independent)                                                        |
| V4 Access Control     | no      | (single-user client state)                                                               |
| V5 Input Validation   | **yes** | `tag.trim()` + length cap (e.g. 64 chars); folder name validation identical              |
| V6 Cryptography       | no      | (no secret material; `crypto.randomUUID()` is non-security-sensitive identifier use)     |
| V8 Data Protection    | partial | Curation stored in IDB — already scoped to origin; no additional controls needed for v1. |

### Known Threat Patterns

| Pattern                                         | STRIDE                 | Standard Mitigation                                                                                                                                                                      |
| ----------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XSS via tag/folder name rendered in DOM         | Tampering / Elevation  | Vue's default `{{ }}` interpolation escapes; never use `v-html` for user-entered strings. Do NOT pass through `dompurify` — it's not needed for text-only strings and adds a dependency. |
| IDB quota exhaustion via unbounded tags/folders | DoS                    | Cap tag length (64 chars) + tag count per asset (50) + folder count (200). Reject with toast on overflow.                                                                                |
| Arbitrary file download via crafted hash        | Information Disclosure | `resolveFullResUrl` looks up by hash in `assetsStore.historyAssets` — never constructs arbitrary URLs.                                                                                   |

**Recommend:** Planner adds explicit input-length caps in `useMoshpitCuration.tagMany` and `foldersStore.create` with i18n error toasts.

## Assumptions Log

| #   | Claim                                                                                                                      | Section   | Risk if Wrong                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| A1  | `primevue/toast` `#message` slot + `life: 8000` is the correct idiom for action-button toasts (vs. extending `toastStore`) | §1        | `[VERIFIED: src/components/toast/RerouteMigrationToast.vue]` — not actually assumed.                                           |
| A2  | `ToastMessageOptions.group` routes through `toastStore.messagesToAdd` watcher unchanged                                    | §1        | `[VERIFIED: src/components/toast/GlobalToast.vue:32-34]` — `newMessages.forEach((m) => toast.add(m))` preserves `group` field. |
| A3  | Curation on hash without `assetMeta` record is a rare race, not a correctness issue                                        | Pitfall 3 | `[ASSUMED]` — if frequent, queue-and-flush pattern is needed.                                                                  |
| A4  | 100 downloads in rapid succession may trigger Chrome's "Do you want to download multiple files?" prompt                    | §5        | `[ASSUMED from general browser behaviour]` — confirm empirically during UAT; stagger if surfaces.                              |
| A5  | Case-insensitive tag comparison is preferred over case-sensitive                                                           | Pitfall 6 | `[ASSUMED]` — deferred to planner; impacts filterMath modification.                                                            |
| A6  | `folders` as a separate object store (with ids) is preferred over embedding folder names in `CurationRecord.folders[]`     | §2        | `[VERIFIED: CurationRecord.folders: readonly string[]` already exists — schema was designed with separate lookup in mind.]     |
| A7  | Tag length cap 64 / tag count cap 50 per asset / folder count cap 200 are reasonable defaults                              | Security  | `[ASSUMED]` — planner should confirm with user.                                                                                |

**Assumptions table is non-empty** → planner should surface A3, A4, A5, A7 as discussion points or codify them in CONTEXT.md before execution.

## Open Questions

1. **Does `ToastMessageOptions.group` need to be added to the `moshpit-curation` group with a second `<Toast>` mount?**
   - What we know: `GlobalToast.vue` already mounts two `<Toast>` groups (default + `billing-operation`); adding a third is the established pattern.
   - What's unclear: whether the new `<Toast group="moshpit-curation">` should live in `MoshpitLayout.vue` (only mounts when Moshpit is active) or in `GlobalToast.vue` (mounts once, always).
   - Recommendation: **`MoshpitLayout.vue`**. The group is Moshpit-specific; mounting it conditionally matches the workspace-isolation posture.

2. **Should `exportMany` and `downloadMany` unify?**
   - What we know: They call the same `getAssetUrl` → `<a download>` pipeline.
   - What's unclear: whether E and the existing "Download" context menu item should be the same verb.
   - Recommendation: keep both during Phase 6 ship; fold into one in a follow-up if UAT shows redundancy.

3. **Should tag input be case-insensitive?**
   - See Assumption A5.

4. **Should the "Save as folder" flow default-name the folder?**
   - Suggestion: `"Tournament <short-date-time>"` e.g. `"Tournament Apr 23, 14:03"`. Planner decides.

## Sources

### Primary (HIGH confidence)

- Repo: `src/platform/moshpit/services/thumbRepository.ts` — IDB schema + upgrade pattern (v1→v4 shipped)
- Repo: `src/platform/moshpit/services/thumbRepository.types.ts` — `CurationRecord` already persisted
- Repo: `src/platform/moshpit/stores/moshpitOverrideStore.ts` — debounced-persist Pinia pattern (shipped 260423-m6c)
- Repo: `src/platform/moshpit/services/overrideRepository.ts` — repository shape to mirror
- Repo: `src/platform/moshpit/composables/useMoshpitSpriteActions.ts` — shared action composable pattern
- Repo: `src/platform/moshpit/components/MoshpitSpriteContextMenu.vue` — reka-ui ContextMenu precedent
- Repo: `src/platform/moshpit/components/MoshpitFloatingActionBar.vue` — action bar shape
- Repo: `src/components/toast/GlobalToast.vue` + `src/components/toast/RerouteMigrationToast.vue` — PrimeVue `#message` slot for action buttons
- Repo: `src/platform/moshpit/services/filterMath.ts` — tag + hidden + favourite filters already wired
- Repo: `src/platform/moshpit/stores/moshpitTournamentStore.ts` — winner-set handoff (`winnerHashes` computed)
- Repo: `src/views/MoshpitView.vue` — keydown dispatch site; `resolveFullResUrl` pattern
- Repo: `src/platform/moshpit/composables/useMoshpitSpriteDrag.ts:194-205` — toast with `life` prop + undo label precedent

### Secondary (MEDIUM confidence)

- ROADMAP.md Phase 6 Goal + Success Criteria
- REQUIREMENTS.md CURATE-01..07 precise wording
- STATE.md v3-pivot decisions (folders = shortlist primitive)

### Tertiary

- None — Phase 6 is almost entirely repo-verified patterns.

## Metadata

**Confidence breakdown:**

- Standard Stack: HIGH — all libraries already shipped
- Architecture: HIGH — patterns verified in shipped code
- Data model / migration: HIGH — mirror of v4 migration
- UX surfaces: MEDIUM — tag popover + folders section are new designs; Figma not consulted (may be a planner/design step)
- Pitfalls: HIGH — direct observation from shipped code and CURATE requirement wording
- Security: MEDIUM — caps are assumed defaults; may need user input

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days; stable — no fast-moving dependencies)
