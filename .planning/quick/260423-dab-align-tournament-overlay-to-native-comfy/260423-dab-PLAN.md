---
phase: 260423-dab-align-tournament-overlay-to-native-comfy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/platform/moshpit/components/MoshpitTournamentOverlay.vue
  - src/platform/moshpit/components/MoshpitTournamentOverlay.test.ts
  - src/platform/moshpit/components/MoshpitTournamentBracketTree.vue
  - src/platform/moshpit/components/MoshpitTournamentBracketTree.test.ts
  - src/platform/moshpit/components/MoshpitMetadataPeekPanel.vue
  - src/platform/moshpit/components/MoshpitMetadataPeekPanel.test.ts
  - src/locales/en/main.json
autonomous: true
requirements:
  - QUICK-260423-dab
must_haves:
  truths:
    - "Tournament overlay header shows the pair counter on the LEFT and a close button on the RIGHT — no visible redundant title, no 'Tournament complete' label in the header."
    - "Clicking the overlay close button closes the tournament via tournamentStore.exit('esc')."
    - 'DialogContent uses rounded-2xl with shadow-only framing — no interface-stroke border on the panel, header row, or footer.'
    - 'Overlay footer uses the bg-modal-panel-background token so it reads as a distinct rail surface.'
    - "Bracket tree sidebar has no 'BRACKET' header block and uses bg-modal-panel-background with no right border — inner bracket card tokens are unchanged."
    - 'Metadata peek panel is a fixed w-72 rail on bg-modal-panel-background with no left border; internal dividers use border-border-subtle.'
    - 'Unused i18n key moshpit.tournament.winner.headerComplete is removed from src/locales/en/main.json (no other consumers exist).'
    - "Reka DialogTitle a11y contract is preserved — VisuallyHidden DialogTitle still renders t('moshpit.tournament.dialogTitle')."
    - 'Existing behaviour tests still pass: counter renders, peek visibility gate, Escape routes through exit(), bracket segmentation / winner / current / skipped / self-hide.'
  artifacts:
    - path: src/platform/moshpit/components/MoshpitTournamentOverlay.vue
      provides: 'Aligned overlay with left-aligned counter, right-aligned close button, borderless rounded-2xl frame, bg-modal-panel-background footer.'
    - path: src/platform/moshpit/components/MoshpitTournamentBracketTree.vue
      provides: 'Bracket sidebar with no header block, bg-modal-panel-background surface, no right border.'
    - path: src/platform/moshpit/components/MoshpitMetadataPeekPanel.vue
      provides: 'Fixed w-72 peek rail on bg-modal-panel-background with border-border-subtle internal dividers.'
    - path: src/locales/en/main.json
      provides: 'moshpit.tournament.winner.headerComplete removed; g.closeDialog reused (already present at line 134).'
  key_links:
    - from: 'MoshpitTournamentOverlay.vue close Button'
      to: "tournamentStore.exit('esc')"
      via: '@click handler (onEscape)'
      pattern: "tournamentStore\\.exit\\('esc'\\)"
    - from: 'MoshpitTournamentOverlay.vue close Button aria-label'
      to: 'src/locales/en/main.json g.closeDialog'
      via: "t('g.closeDialog')"
      pattern: "t\\(['\"]g\\.closeDialog['\"]\\)"
    - from: 'MoshpitTournamentOverlay.test.ts new close-button test'
      to: "tournamentStore.exit('esc')"
      via: "userEvent.click on data-testid='moshpit-tournament-overlay-close'"
      pattern: 'moshpit-tournament-overlay-close'
---

<objective>
Strip three redundancies from the tournament overlay (visible title span, "Tournament complete" header label, 'BRACKET' sidebar header) and align its surface / border / radius / width / close-affordance tokens with the native BaseModalLayout pattern — mirroring the sidebar + filter alignment shipped in quick task 260423-89u.

Purpose: Tournament overlay currently reads as a bespoke panel rather than a native ComfyUI modal. Strokes + redundant labels + variable peek width fight with the shipped sidebar styling. Normalising to rounded-2xl + bg-modal-panel-background + the shared Button close pattern lands it inside the native modal vocabulary.

Output: Modified overlay / bracket tree / peek panel SFCs, their test files updated in lockstep, one pruned i18n key. Atomic refactor commit (or split into surfaces + close-button + i18n-prune commits — executor discretion per ticket). No new files. Existing behaviour tests still pass and a new close-button behaviour test is added.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@./AGENTS.md

<!-- Reference: native modal pattern this overlay must align to. -->

@src/components/widget/layout/BaseModalLayout.vue

<!-- Primary edit targets. -->

@src/platform/moshpit/components/MoshpitTournamentOverlay.vue
@src/platform/moshpit/components/MoshpitTournamentOverlay.test.ts
@src/platform/moshpit/components/MoshpitTournamentBracketTree.vue
@src/platform/moshpit/components/MoshpitTournamentBracketTree.test.ts
@src/platform/moshpit/components/MoshpitMetadataPeekPanel.vue
@src/platform/moshpit/components/MoshpitMetadataPeekPanel.test.ts

<!-- MoshpitTournamentWinner already owns "complete" framing — DO NOT edit, read for context only. -->

@src/platform/moshpit/components/MoshpitTournamentWinner.vue

<!-- Shared Button used for the close affordance. -->

@src/components/ui/button/Button.vue

<!-- i18n source of truth. -->

@src/locales/en/main.json

<!-- Precedent: token-alignment for sidebar + filters shipped in this quick task. -->

@.planning/quick/260423-89u-align-moshpit-sidebar-and-filter-ui-to-n/260423-89u-SUMMARY.md

<interfaces>
<!-- Key facts pre-verified during planning (grep-confirmed). Executor should NOT re-explore. -->

## g.closeDialog — reuse, do NOT duplicate

`src/locales/en/main.json:134` — `"closeDialog": "Close dialog"` under the `g` block. BaseModalLayout.vue already consumes it via `t('g.closeDialog')` for both panel close buttons. The overlay close Button must reuse the same key — no moshpit-scoped variant.

## moshpit.tournament.winner.headerComplete — prune

`src/locales/en/main.json:1174` — `"headerComplete": "Tournament complete"` under `moshpit.tournament.winner`.
Grep of the repo (non-locale files) returns exactly ONE consumer: `MoshpitTournamentOverlay.vue:133` — the very span this plan deletes. `MoshpitTournamentWinner.vue` does NOT reference it (it renders `moshpit.tournament.winner.title` / `titlePlural` instead). Safe to remove the key after the overlay edit. Leave sibling keys (title, titlePlural, winsLabel, paramsTitle, lorasTitle, lorasEmpty, metadataUnavailable, confirm) intact.

## Native close-button pattern — copy verbatim from BaseModalLayout.vue

```vue
<Button
  size="lg"
  class="w-10 p-0"
  :aria-label="t('g.closeDialog')"
  @click="onEscape"
>
  <i class="pi pi-times" />
</Button>
```

Import: `import Button from '@/components/ui/button/Button.vue'`. Attach `data-testid="moshpit-tournament-overlay-close"` for the new test.

## tournamentStore.exit — idempotent, reuse existing handler

`onEscape()` in the overlay already calls `tournamentStore.exit('esc')`. The close Button's @click binds to the same `onEscape` function — NO new handler, NO new import. Calling `exit()` twice is safe (guarded by `if (!isActive.value) return`). Matches the v-model:open set(false) close-path already routed through exit('esc').

## DialogRoot a11y invariants — preserved

`VisuallyHidden > DialogTitle > t('moshpit.tournament.dialogTitle')` and `VisuallyHidden > DialogDescription` stay exactly as-is. Only the visible duplicate `<span data-testid="moshpit-tournament-overlay-title">` is removed.

## Semantic tokens referenced (all exist in style.css — verified via token precedent from Plan 05-04 SUMMARY and BaseModalLayout.vue)

- `bg-modal-panel-background` — BaseModalLayout rail surface (lines 11, 93).
- `bg-base-background` — DialogContent surface (keep).
- `border-border-subtle` — project convention for internal section dividers (used in bracket tree header already, line 78 of original).
- `text-muted-foreground`, `text-base-foreground`, `tabular-nums`, `rounded-2xl`, `shadow-2xl` — all existing.

## Tests: existing Overlay test-id contract

- `moshpit-tournament-overlay-content` — KEEP (DialogContent root).
- `moshpit-tournament-overlay-backdrop` — KEEP.
- `moshpit-tournament-overlay-counter` — KEEP (now on the left).
- `moshpit-tournament-overlay-legend` — KEEP.
- `moshpit-tournament-overlay-title` — REMOVE (span deleted; no assertions currently depend on it — grep-verified).
- `moshpit-tournament-overlay-complete` — REMOVE (span deleted; no assertions currently depend on it — grep-verified).
- `moshpit-tournament-overlay-close` — NEW (close Button).

## Tests: existing Bracket test contract — no assertions on "BRACKET" header text

Grep-verified: `MoshpitTournamentBracketTree.test.ts` asserts only on `moshpit-bracket-root`, `moshpit-bracket-pair-*`, `moshpit-bracket-round-*`, `moshpit-bracket-winner`, `data-current`, `data-skipped`. Removing the `<header>` block has no test-level fallout. `aria-label` on the `<aside>` stays (it IS the bracket.title i18n key — preserves screen-reader naming).

## Tests: existing Peek test contract — no width-class assertion

Grep-verified: `MoshpitMetadataPeekPanel.test.ts` asserts on `translate-x-full`, `translate-x-0`, `transition-[transform]`, `duration-200`, `aria-hidden`, text content keys. NO assertion on `w-80` / `w-96` / `w-md`. Width change is purely visual — no test updates needed.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Align tournament overlay surface + close affordance (MoshpitTournamentOverlay.vue)</name>
  <files>src/platform/moshpit/components/MoshpitTournamentOverlay.vue</files>
  <action>
Edit `MoshpitTournamentOverlay.vue` per the ticket. All changes stay inside this single file.

1. Add import for the shared Button:

   ```ts
   import Button from '@/components/ui/button/Button.vue'
   ```

   (Place alongside the other imports. Use a `import` not `import type` — Button is a value.)

2. Update `DialogContent` class string:
   - Replace `rounded-lg` with `rounded-2xl`.
   - Delete the `border border-(--interface-stroke)` segment.
   - Keep everything else verbatim: `fixed inset-6 z-1900 flex flex-col overflow-hidden bg-base-background shadow-2xl outline-none lg:inset-10`.

3. Replace the `<header>` block. The final header must:
   - Drop the `border-b border-(--interface-stroke)` utilities (keep the `flex items-center justify-between gap-4 px-4 py-3` layout).
   - On the LEFT: the pair counter (moved from the right). Render only when `tournamentStore.currentPair` OR continue to render the `isFinished` branch if that path is still reachable — BUT note that when `isFinished` is true the main body swaps to `MoshpitTournamentWinner` which owns the "complete" framing. So the `isFinished` complete-label span is DELETED outright. If there is no current pair AND the tournament is not finished (mid-transition), render nothing on the left — do not emit an empty span.
   - On the RIGHT: the new close Button.

   Final header template (replace the entire existing `<header>...</header>` block):

   ```vue
   <header class="flex items-center justify-between gap-4 px-4 py-3">
     <span
       v-if="tournamentStore.currentPair"
       class="text-xs text-muted-foreground tabular-nums"
       data-testid="moshpit-tournament-overlay-counter"
     >
       {{
         t('moshpit.tournament.pairCounter', {
           current: tournamentStore.progress.current,
           total: tournamentStore.progress.total
         })
       }}
     </span>
     <span v-else aria-hidden="true" />
     <Button
       size="lg"
       class="w-10 p-0"
       :aria-label="t('g.closeDialog')"
       data-testid="moshpit-tournament-overlay-close"
       @click="onEscape"
     >
       <i class="pi pi-times" />
     </Button>
   </header>
   ```

   Notes:
   - The `<span v-else aria-hidden="true" />` preserves `justify-between` layout so the close button stays right-aligned during the brief transition state where `currentPair` is null and `isFinished` is false. Do NOT use a non-semantic empty div; the aria-hidden span is invisible to screen readers.
   - Removed testids `moshpit-tournament-overlay-title` and `moshpit-tournament-overlay-complete` MUST NOT appear anywhere in the final file.
   - `VisuallyHidden > DialogTitle` block is UNCHANGED — leave it intact for Reka a11y.

4. Update the `<footer>` class string:
   - Drop `border-t border-(--interface-stroke)`.
   - Add `bg-modal-panel-background`.
   - Keep `flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-xs text-muted-foreground`.
   - Keep `data-testid="moshpit-tournament-overlay-legend"` and the entire inner `<template v-if="...isFinished">` / `<template v-else>` content.

   Final footer opening tag:

   ```vue
   <footer
     class="flex flex-wrap items-center gap-x-6 gap-y-2 bg-modal-panel-background px-4 py-3 text-xs text-muted-foreground"
     data-testid="moshpit-tournament-overlay-legend"
   >
   ```

5. Do NOT touch `<main>`, `DialogOverlay`, `DialogPortal`, `DialogRoot`, the script block's keybinding composable call, `openModel`, `paramsA`/`paramsB` computeds, or `onConfirmWinner`.

Strict rules to respect (AGENTS.md / CLAUDE.md):

- No `:class="[]"` — the header + footer stay as plain `class=`. The close Button uses `class="w-10 p-0"` directly.
- No `dark:`, no `!important`, no arbitrary percentages, no raw hex.
- No `any` / `as any`.
- i18n via `t('g.closeDialog')` — reuse the existing global key; do NOT add a moshpit-scoped duplicate.
- Raw-text lint: `pi-times` is an `<i>` icon (no text node) — no i18n needed. aria-label uses t().
  </action>
  <verify>
  <automated>pnpm lint src/platform/moshpit/components/MoshpitTournamentOverlay.vue &amp;&amp; pnpm typecheck</automated>
  </verify>
  <done>
- MoshpitTournamentOverlay.vue has no `moshpit-tournament-overlay-title` or `moshpit-tournament-overlay-complete` testids anywhere.
- DialogContent class contains `rounded-2xl` and does NOT contain `border border-(--interface-stroke)`.
- Header contains a Button with `data-testid="moshpit-tournament-overlay-close"`, `aria-label="t('g.closeDialog')"` binding, and `@click="onEscape"`.
- Header no longer contains `border-b border-(--interface-stroke)`.
- Footer class contains `bg-modal-panel-background` and does NOT contain `border-t border-(--interface-stroke)`.
- Counter span is the FIRST visible child of `<header>` (left side).
- VisuallyHidden DialogTitle block is intact.
- `pnpm lint` clean on the touched file, `pnpm typecheck` clean project-wide.
  </done>
  </task>

<task type="auto">
  <name>Task 2: Align bracket tree + metadata peek surfaces (BracketTree.vue + PeekPanel.vue)</name>
  <files>src/platform/moshpit/components/MoshpitTournamentBracketTree.vue, src/platform/moshpit/components/MoshpitMetadataPeekPanel.vue</files>
  <action>
Two files, same concern (token alignment). Both edits are visual-only and do not change any data flow, props, emits, computeds, or logic.

### A. MoshpitTournamentBracketTree.vue

1. Delete the entire `<header>...</header>` block (lines 77–85 in the current file — the block rendering the "BRACKET" title label). The `<aside>`'s `aria-label="t('moshpit.tournament.bracket.title')"` already carries the screen-reader naming — no a11y regression.

2. Update the `<aside>` class string:
   - Replace `bg-comfy-menu-bg` with `bg-modal-panel-background`.
   - Delete `border-r border-border-default` (no right border).
   - Keep `flex w-50 shrink-0 flex-col overflow-y-auto`.
   - Keep all other attributes: `v-if`, `:aria-label`, `data-testid="moshpit-bracket-root"`.

   Final `<aside>` opening:

   ```vue
   <aside
     v-if="tournamentStore.isActive && !tournamentStore.isFinished"
     :aria-label="t('moshpit.tournament.bracket.title')"
     class="flex w-50 shrink-0 flex-col overflow-y-auto bg-modal-panel-background"
     data-testid="moshpit-bracket-root"
   >
   ```

3. Do NOT touch the inner `<div v-if="...singleElim">`, the `<ul v-else>`, or any sub-box / pair-card class strings. The bracket card tokens (`border-border-focused`, `bg-bg-toggle-on-default`, `border-border-subtle`, `border-transparent`, `text-base-foreground`, `text-muted-foreground`) stay exactly as-is.

### B. MoshpitMetadataPeekPanel.vue

1. Update the root `<aside>` `:class` cn() argument:
   - Replace `w-80` with `w-72`.
   - Delete `lg:w-96 xl:w-md` — width is now fixed.
   - Replace `bg-base-background` with `bg-modal-panel-background`.
   - Delete `border-l border-(--interface-stroke)`.
   - Keep `absolute top-0 right-0 h-full overflow-y-auto transition-[transform] duration-200 ease-out`.
   - Keep the conditional `store.isPeekOpen ? 'translate-x-0' : 'translate-x-full'` inside the cn() call.

   Final `<aside>` opening:

   ```vue
   <aside
     :class="
       cn(
         'absolute top-0 right-0 h-full w-72 overflow-y-auto bg-modal-panel-background transition-[transform] duration-200 ease-out',
         store.isPeekOpen ? 'translate-x-0' : 'translate-x-full'
       )
     "
     :aria-hidden="!store.isPeekOpen"
     data-testid="moshpit-metadata-peek-panel"
   >
   ```

2. Update the inner `<header>` class:
   - Replace `border-b border-(--interface-stroke)` with `border-b border-border-subtle`.
   - Keep `p-4`.

3. Update the LoRA `<section>` class (the second `<section>` inside the `<template v-else>`):
   - Replace `border-t border-(--interface-stroke)` with `border-t border-border-subtle`.
   - Keep `p-4`.

4. Do NOT touch the loading `<section>`, the param `<section>`, the param diff row classes, the LoRA row classes, `paramStateClass`, `loraStateClass`, `isReady`, `paramRows`, or `loraRows`.

Strict rules (both files):

- No `:class="[]"` array merging — bracket tree uses a plain `class=` on the `<aside>`; peek uses `cn()` already.
- Keep existing `cn()` usage in both files.
- No `dark:`, no `!important`, no arbitrary percentages, no raw hex.
- `w-72` is a Tailwind fraction-free utility (18rem fixed width) — no arbitrary value.
  </action>
  <verify>
  <automated>pnpm lint src/platform/moshpit/components/MoshpitTournamentBracketTree.vue src/platform/moshpit/components/MoshpitMetadataPeekPanel.vue &amp;&amp; pnpm typecheck</automated>
  </verify>
  <done>
- MoshpitTournamentBracketTree.vue has NO `<header>` element (grep the file for `<header` returns zero hits).
- Bracket `<aside>` class contains `bg-modal-panel-background`, does NOT contain `bg-comfy-menu-bg`, does NOT contain `border-r`.
- Peek `<aside>` class contains `w-72`, does NOT contain `w-80`, `w-96`, `w-md`, or `border-l`.
- Peek `<aside>` class contains `bg-modal-panel-background`, does NOT contain `bg-base-background`.
- Peek inner header and LoRA section use `border-border-subtle` (no `--interface-stroke` references remain in the file).
- `pnpm lint` clean on the two touched files; `pnpm typecheck` clean project-wide.
  </done>
  </task>

<task type="auto">
  <name>Task 3: Update tests + prune unused i18n key</name>
  <files>src/platform/moshpit/components/MoshpitTournamentOverlay.test.ts, src/platform/moshpit/components/MoshpitTournamentBracketTree.test.ts, src/platform/moshpit/components/MoshpitMetadataPeekPanel.test.ts, src/locales/en/main.json</files>
  <action>
Three things in this task: (a) add a behaviour test for the new close Button, (b) prune the orphaned i18n key, (c) confirm nothing else regressed (no existing-test code changes expected; see notes per file).

### A. MoshpitTournamentOverlay.test.ts — add close-button test

1. Import `userEvent` at the top of the file. The project already uses `@testing-library/user-event` (see AGENTS.md testing section + existing moshpit tests). Add:

   ```ts
   import userEvent from '@testing-library/user-event'
   ```

   (Place in the `@testing-library` import group, above `createPinia` imports.)

2. Append a new `describe` block AFTER the existing "pair counter (D-04)" block:

   ```ts
   describe('MoshpitTournamentOverlay — close button', () => {
     it('clicking the close button routes through tournamentStore.exit', async () => {
       const user = userEvent.setup()
       const store = useMoshpitTournamentStore()
       store.enter(['a', 'b', 'c'])

       renderOverlay()
       await nextTick()

       expect(store.isActive).toBe(true)

       const closeButton = screen.getByTestId(
         'moshpit-tournament-overlay-close'
       )
       await user.click(closeButton)
       await nextTick()

       expect(store.isActive).toBe(false)
     })
   })
   ```

3. Do NOT modify any other test in the file. In particular:
   - No existing test queries `moshpit-tournament-overlay-title` or `moshpit-tournament-overlay-complete` — grep-verified. Nothing to delete.
   - Counter test (`renders the pair counter with 1-based current / total`) positionally queries by testid, not by DOM position. The counter moving to the left has no test impact.
   - The Escape-wiring test continues to dispatch a raw `KeyboardEvent` — that path is untouched.

### B. MoshpitTournamentBracketTree.test.ts — no edits needed

Grep-verified: no assertion queries the "BRACKET" header text or the `<header>` element itself. Tests drive the store, mount the tree, and assert on pair/round/winner/current/skipped testids. Removing the header block has ZERO test impact. Leave this file untouched — do NOT add an unrelated change.

(If `pnpm lint` or `pnpm typecheck` surfaces an unexpected regression on this test file after Task 2, diagnose and fix; otherwise leave alone.)

### C. MoshpitMetadataPeekPanel.test.ts — no edits needed

Grep-verified: no assertion queries `w-80`, `w-96`, `w-md`, `bg-base-background`, `border-l`, or `--interface-stroke`. Visibility assertions (`translate-x-full`, `translate-x-0`, `transition-[transform]`, `duration-200`) all survive. Leave this file untouched.

### D. src/locales/en/main.json — prune the orphan

1. Open `src/locales/en/main.json` and locate line ~1174 under the `moshpit.tournament.winner` block:
   ```json
   "headerComplete": "Tournament complete",
   ```
2. Remove that line entirely. Sibling keys (`title`, `titlePlural`, `winsLabel`, `paramsTitle`, `lorasTitle`, `lorasEmpty`, `metadataUnavailable`, `confirm`) stay. Preserve JSON trailing-comma hygiene — if `headerComplete` was the last key in the `winner` object (it likely isn't, but verify), adjust the preceding comma accordingly so the file remains valid JSON.
3. Do NOT add any new key. `g.closeDialog` already exists at line 134 — verified. No duplicate under `moshpit.tournament.*`.
4. Run `pnpm knip` after the edit to confirm no dead-code regression on locale usage. (`knip` is the project's unused-export gate — if it flags other moshpit keys, ignore them as out-of-scope for this ticket; only fail if a NEW key is introduced or our edit breaks JSON parsing.)

Strict rules:

- i18n JSON is valid (parseable) — no dangling commas, no stray whitespace.
- No `any` in the new test.
- `userEvent.setup()` + `await user.click(...)` — no `fireEvent` or `dispatchEvent` shortcut.
- Raw text lint: the new test file has `eslint-plugin-intlify` overrides via the `**/*.{stories,test,spec}.ts` rule — raw strings in test assertions are fine.
  </action>
  <verify>
  <automated>pnpm test:unit src/platform/moshpit/components/MoshpitTournamentOverlay.test.ts src/platform/moshpit/components/MoshpitTournamentBracketTree.test.ts src/platform/moshpit/components/MoshpitMetadataPeekPanel.test.ts &amp;&amp; pnpm lint &amp;&amp; pnpm typecheck &amp;&amp; pnpm knip</automated>
  </verify>
  <done>
- MoshpitTournamentOverlay.test.ts contains a new `describe('... — close button')` block with exactly one `it` that clicks `moshpit-tournament-overlay-close` and asserts `store.isActive === false`.
- `userEvent` is imported from `@testing-library/user-event` in that test file.
- BracketTree.test.ts and PeekPanel.test.ts are unchanged (`git diff --stat` reports 0 lines on both).
- `src/locales/en/main.json` no longer contains `"headerComplete"` under `moshpit.tournament.winner` — `grep -n headerComplete src/locales/en/main.json` returns no matches.
- `src/locales/en/main.json` still contains `"closeDialog": "Close dialog"` under the `g` block at ~line 134.
- All three touched test files pass via `pnpm test:unit`, and the full project passes `pnpm lint`, `pnpm typecheck`, `pnpm knip`.
  </done>
  </task>

</tasks>

<verification>
Phase-level gates (run after all three tasks complete):

1. `pnpm lint` — clean project-wide (no new warnings/errors attributable to this change).
2. `pnpm typecheck` — clean (vue-tsc, no new diagnostics).
3. `pnpm knip` — no new unused-export regressions (i18n key removal should REDUCE unused count, not increase).
4. `pnpm test:unit src/platform/moshpit/components/MoshpitTournamentOverlay.test.ts src/platform/moshpit/components/MoshpitTournamentBracketTree.test.ts src/platform/moshpit/components/MoshpitMetadataPeekPanel.test.ts` — all three files green, including the new close-button test.
5. Grep sanity checks:
   - `grep -n "moshpit-tournament-overlay-title\|moshpit-tournament-overlay-complete" src/platform/moshpit/` returns NO matches (spans + any lingering testid references fully removed).
   - `grep -n "headerComplete" src/` returns NO matches.
   - `grep -n "interface-stroke" src/platform/moshpit/components/MoshpitTournamentOverlay.vue src/platform/moshpit/components/MoshpitMetadataPeekPanel.vue` returns NO matches.
   - `grep -n "bg-comfy-menu-bg" src/platform/moshpit/components/MoshpitTournamentBracketTree.vue` returns NO matches.
6. Visual smoke (executor, after backend running): start a tournament in Moshpit, confirm:
   - Header: counter left, close button right, no visible title text.
   - Panel: rounded-2xl corners, no hairline border, footer reads as a darker rail band.
   - Bracket sidebar: no "BRACKET" label, matches rail colour, no right border.
   - Peek panel (press M): narrower fixed width, same rail colour as bracket, no left hairline.
   - Close button click: overlay closes.
     </verification>

<success_criteria>

- All three files ship aligned to the native modal vocabulary: rounded-2xl + bg-modal-panel-background + no interface-stroke borders + shared Button close pattern.
- Three redundancies eliminated: overlay visible title span, overlay "Tournament complete" label, bracket sidebar "BRACKET" header block.
- Counter relocated from right to left; new close button on the right reuses `tournamentStore.exit('esc')` via the existing `onEscape` handler.
- Peek panel fixed at `w-72` (no responsive-ladder widths).
- Orphan i18n key `moshpit.tournament.winner.headerComplete` removed; `g.closeDialog` reused (no duplicate).
- Existing behaviour tests still pass; one new behaviour test locks in the close-button → exit() path.
- All quality gates green: lint, typecheck, knip, touched unit tests.
- Zero new `any`, `:class="[]"`, `dark:`, `!important`, arbitrary percentages, or raw hex introduced.
- Commit(s) use `refactor:` / `test:` / `style:` prefix — no Claude/AI mentions. A single `refactor(moshpit): align tournament overlay to native modal patterns` commit is preferred given the cohesive scope.
  </success_criteria>

<output>
After completion, create `.planning/quick/260423-dab-align-tournament-overlay-to-native-comfy/260423-dab-SUMMARY.md` following `get-shit-done/templates/summary.md`. Append a row to STATE.md's "Quick Tasks Completed" table with id `260423-dab`, date 2026-04-23, commit hash, and directory link.
</output>
