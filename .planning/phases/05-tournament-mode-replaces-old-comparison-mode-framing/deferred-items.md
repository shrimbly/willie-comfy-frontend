# Deferred Items — Phase 05

Out-of-scope issues observed during Phase 5 execution. Tracked for future
cleanup; NOT addressed in this phase per the scope-boundary rule (only fix
issues directly caused by the current task's changes).

## Playwright @moshpit spec deferred — `typecheck:browser` pre-existing blocker

Inherited from Phase 4 deferred-items (see
`.planning/phases/04-lineage-groupings-within-cluster-sort/deferred-items.md`).
Re-verified on Phase 5 Plan 06 entry (2026-04-22): running
`pnpm typecheck:browser` still fails on `main` with these pre-existing
errors:

```
browser_tests/tests/moshpit/moshpit-shell.spec.ts(56,7): error TS2578: Unused '@ts-expect-error' directive.
browser_tests/tests/moshpit/moshpit-shell.spec.ts(60,7): error TS2578: Unused '@ts-expect-error' directive.
browser_tests/tests/moshpit/moshpit-shell.spec.ts(71,7): error TS2578: Unused '@ts-expect-error' directive.
browser_tests/tests/moshpit/moshpit-shell.spec.ts(75,7): error TS2578: Unused '@ts-expect-error' directive.
src/composables/useGlobalLitegraph.ts(17,3): error TS2578: Unused '@ts-expect-error' directive.
src/composables/useGlobalLitegraph.ts(33,3): error TS2578: Unused '@ts-expect-error' directive.
```

Root cause is a tsconfig strictness mismatch between `tsconfig.json` and
`browser_tests/tsconfig.json` — the main `tsconfig.json` requires the
`@ts-expect-error` directive on `window['LiteGraph'] = LiteGraph`; the
browser config treats the same directive as unused. Fixing one breaks the
other. This is unchanged since Phase 4.

**Deferred:** `browser_tests/tests/moshpit/moshpit-tournament.spec.ts`.
`lint-staged.config.ts` triggers `pnpm typecheck:browser` whenever any
file under `browser_tests/` is staged, so the husky pre-commit hook
rejects a new spec file until the tsconfig mismatch is resolved.

**Designed-but-not-shipped test scenarios** (TOUR-01 / TOUR-02 / TOUR-07):

1. Enter with <2 selected → toast appears, no dialog mounts (`[role="dialog"]` not visible).
2. Enter with ≥2 selected → dialog mounts; pair counter reads "Pair 1 / N".
3. `[` / `]` cycles display mode — side-by-side → overlap → flip → wrap.
4. `Esc` with 0 picks → dialog unmounts AND canvas selection preserved.

**Covered by:** Vitest unit + component tests across Plans 05-01..05-06
give full coverage of the tournament flow at the unit level:

- Bracket math + winner-set (Plan 05-01 — 22 tests, 6 fast-check properties)
- Metadata diff + LoRA set-diff (Plan 05-02 — 22 tests, 2 fast-check properties)
- Store lifecycle + ephemerality + keybindings (Plan 05-03 — 48 tests)
- AssetFrame + Pair renderer (Plan 05-04 — 21 tests)
- Peek panel (Plan 05-05 — 16 tests)
- Overlay composition + MoshpitView entry gate (Plan 05-06 — 11 tests)

Plus HUMAN-UAT qualitative flow validation per D-25 (11 scenarios).

TOUR-01..08 + PEEK-01..03 are fully verified via the unit suite; the E2E
would add regression protection for integration-level flow but is not
acceptance-critical.

**Reinstate when:** the tsconfig:browser blocker is fixed as a standalone
chore task. Follow-up path is in Phase 4's deferred-items.md: tighten
`browser_tests/tsconfig.json` `include` so only `browser_tests/**/*.ts`
and the declared `.d.ts` paths compile (currently transitively picks up
`src/composables/` via import-graph resolution).

## Pre-existing i18n unused-key warning (non-blocking)

The repo's i18n-unused-key lint-staged step flags 9 keys under
`moshpit.peek.params.*` as unused because the scalar param labels are
consumed via the dynamic template literal
`t(\`moshpit.peek.params.${row.key}\`)`in`MoshpitMetadataPeekPanel.vue`.
Static analysis can't resolve the template-literal lookup. Warning only;
does not fail the hook.
