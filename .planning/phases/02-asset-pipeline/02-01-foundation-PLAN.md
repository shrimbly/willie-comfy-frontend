---
phase: 02-asset-pipeline
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - package.json
  - src/platform/moshpit/services/contentHash.test.ts
  - src/platform/moshpit/services/layoutMath.test.ts
  - src/platform/moshpit/services/thumbRepository.test.ts
  - src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts
  - src/platform/moshpit/components/MoshpitProcessingIndicator.test.ts
  - vitest.setup.ts
autonomous: true
requirements: [ASSET-03, ASSET-07]
tags: [foundation, dependencies, test-infrastructure, wave-0]
must_haves:
  truths:
    - '`idb` is an explicit direct dependency of `ComfyUI_frontend` pinned to `^7.1.1` (matches the Firebase transitive lockfile entry)'
    - '`fake-indexeddb` is a devDependency available to vitest so the IDB repository tests can run in happy-dom without a real browser'
    - 'Five Wave-0 test files exist with failing stubs (RED) that downstream plans will turn green — contentHash, layoutMath, thumbRepository, useMoshpitProcessingQueue, MoshpitProcessingIndicator'
    - 'Vitest setup registers `fake-indexeddb/auto` so `indexedDB`, `IDBKeyRange`, etc. are globals in tests'
    - '`pnpm install` exits 0 after package.json edits; `pnpm test:unit --run src/platform/moshpit/services/contentHash.test.ts` exits non-zero (RED because implementation is absent)'
  artifacts:
    - path: 'package.json'
      provides: 'Explicit `idb@^7.1.1` dep; `fake-indexeddb@^6` dev dep'
      contains: '"idb"'
    - path: 'src/platform/moshpit/services/contentHash.test.ts'
      provides: 'RED tests for fnv1a, mulberry32, layoutSeedHash, sha256Hex determinism'
    - path: 'src/platform/moshpit/services/layoutMath.test.ts'
      provides: 'RED tests for computeJitteredGrid, computeSquareGridDimensions determinism'
    - path: 'src/platform/moshpit/services/thumbRepository.test.ts'
      provides: 'RED tests for put/get/getAllHashes against fake-indexeddb'
    - path: 'src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts'
      provides: 'RED tests for diff(filtered, cached), cancel semantics, filter-change delta'
    - path: 'src/platform/moshpit/components/MoshpitProcessingIndicator.test.ts'
      provides: 'RED tests for pill render, progress bar width, cancel emit, fade-out sequence'
    - path: 'vitest.setup.ts'
      provides: 'Registers fake-indexeddb/auto so the IDB repository tests have global indexedDB'
      contains: 'fake-indexeddb/auto'
  key_links:
    - from: 'src/platform/moshpit/services/thumbRepository.test.ts'
      to: 'fake-indexeddb/auto (vitest setup)'
      via: 'global indexedDB'
      pattern: 'fake-indexeddb/auto'
---

<objective>
Wave-0 foundation task: install the two net-new deps (`idb` as explicit direct dep, `fake-indexeddb` as dev dep), register `fake-indexeddb/auto` in the vitest setup, and create five RED test files that the downstream Wave-1/Wave-2/Wave-3/Wave-4 plans will turn green.

This plan creates NO production code. It creates failing tests and installs deps. Every downstream plan's Per-Task Verification Map row references one of these files via `pnpm test:unit --run <path>`.

Purpose: Establish the Nyquist-sampled test contract (VALIDATION.md) before any production code lands, so later plans can follow tight red→green loops.

Output: Two package.json edits, one vitest setup edit, five test files full of `it.todo` or failing stubs matching the Per-Task Verification Map.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-asset-pipeline/02-CONTEXT.md
@.planning/phases/02-asset-pipeline/02-RESEARCH.md
@.planning/phases/02-asset-pipeline/02-VALIDATION.md
@.planning/phases/02-asset-pipeline/02-UI-SPEC.md

<interfaces>
<!-- Deps being declared. Executor does NOT need to inspect idb internals; only
     the API surface below is used later. -->

From `idb` v7.1.1 (already in pnpm-lock.yaml via Firebase transitive):

```typescript
export function openDB<T>(
  name: string,
  version: number,
  opts: OpenDBCallbacks<T>
): Promise<IDBPDatabase<T>>
export interface DBSchema {
  [storeName: string]: { key: string; value: unknown }
}
```

From `fake-indexeddb` v6.x:

```
// fake-indexeddb/auto registers globalThis.indexedDB, globalThis.IDBKeyRange
import 'fake-indexeddb/auto'
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add `idb@^7.1.1` + `fake-indexeddb@^6` to package.json and register fake-indexeddb in vitest setup</name>
  <read_first>
    - package.json (full — identify `dependencies` and `devDependencies` sections)
    - pnpm-lock.yaml (only the `idb` section — confirm resolved version `7.1.1` under Firebase subtree; grep `idb@7` to locate)
    - vitest.setup.ts (full — understand existing setup shape; add the fake-indexeddb import idempotently)
    - .planning/phases/02-asset-pipeline/02-RESEARCH.md §2 (IndexedDB Library — rationale for pinning `^7.1.1`)
  </read_first>
  <action>
Edit `package.json`:

1. Under `"dependencies"` add, in alphabetical position (between existing `i` entries):

```
    "idb": "^7.1.1",
```

2. Under `"devDependencies"` add, in alphabetical position:

```
    "fake-indexeddb": "^6.0.0",
```

DO NOT bump any other version. DO NOT touch `pnpm-workspace.yaml` catalog — `idb` is small and already resolved; adding directly to package.json is the pattern used for previous net-new direct deps.

Edit `vitest.setup.ts`:

Add at the top of the file (before existing imports):

```typescript
import 'fake-indexeddb/auto'
```

This must be added idempotently: if the line already exists, do not duplicate.

Run `pnpm install` and confirm:

- `node_modules/idb/package.json` reports version starting with `7.1`
- `node_modules/fake-indexeddb/package.json` reports version starting with `6.`

Rationale (include as a JSDoc comment above the `fake-indexeddb/auto` import in `vitest.setup.ts`):

```
// Phase 2: IDB repository tests (src/platform/moshpit/services/thumbRepository.test.ts)
// run in happy-dom which has no indexedDB. fake-indexeddb/auto registers the
// required globals so vitest unit tests can exercise idb.openDB without a browser.
```

  </action>
  <verify>
    <automated>pnpm install &amp;&amp; node -e "require('idb'); require('fake-indexeddb/auto'); console.log('ok')"</automated>
  </verify>
  <acceptance_criteria>
    - `grep '"idb":' package.json` returns `"idb": "^7.1.1"` in the `dependencies` section
    - `grep '"fake-indexeddb":' package.json` returns `"fake-indexeddb": "^6.0.0"` in the `devDependencies` section
    - `grep "fake-indexeddb/auto" vitest.setup.ts` returns exactly one match
    - `ls node_modules/idb/package.json` exits 0 after `pnpm install`
    - `ls node_modules/fake-indexeddb/package.json` exits 0 after `pnpm install`
    - `pnpm test:unit --run vitest.setup.ts` does not error on the new import (may fail if there is no test — expected)
  </acceptance_criteria>
  <done>Both deps installed, vitest setup registers fake-indexeddb/auto, `pnpm install` green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create five Wave-0 RED test stubs</name>
  <read_first>
    - .planning/phases/02-asset-pipeline/02-VALIDATION.md §Wave 0 Requirements (the 5 paths this task creates)
    - .planning/phases/02-asset-pipeline/02-RESEARCH.md §Validation Architecture (Unit Test Targets table + Component Test Targets table)
    - .planning/phases/02-asset-pipeline/02-UI-SPEC.md §Surface 1: MoshpitProcessingIndicator (for pill behavior stubs)
    - src/platform/moshpit/stores/moshpitViewportStore.test.ts (for a working vitest+pinia test pattern in this repo)
    - src/platform/moshpit/composables/useMoshpitMarquee.test.ts (for composable test pattern)
  </read_first>
  <action>
Create the following five files. All tests must FAIL when run (RED) because the implementation does not exist yet. Use `it.todo` sparingly — prefer real `it()` blocks that reference the future symbol via dynamic import that will throw `Cannot find module` or similar. That way when the implementation lands the test naturally transitions to GREEN.

**1. `src/platform/moshpit/services/contentHash.test.ts`**

```typescript
import { describe, expect, it } from 'vitest'

describe('contentHash utilities (Wave 1)', () => {
  it('fnv1a produces deterministic 32-bit output for the same input', async () => {
    const mod = await import('./contentHash')
    expect(mod.fnv1a('hello')).toBe(mod.fnv1a('hello'))
    expect(mod.fnv1a('hello')).not.toBe(mod.fnv1a('world'))
    expect(mod.fnv1a('hello')).toBeGreaterThanOrEqual(0)
    expect(mod.fnv1a('hello')).toBeLessThan(2 ** 32)
  })

  it('mulberry32 produces deterministic sequence for the same seed', async () => {
    const { mulberry32 } = await import('./contentHash')
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = [a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
    expect(seqA.every((v) => v >= 0 &amp;&amp; v < 1)).toBe(true)
  })

  it('layoutSeedHash is stable across filterKey + sorted-hash inputs', async () => {
    const { layoutSeedHash } = await import('./contentHash')
    const h1 = layoutSeedHash('workflow-x|today', ['aaa', 'bbb', 'ccc'])
    const h2 = layoutSeedHash('workflow-x|today', ['aaa', 'bbb', 'ccc'])
    const h3 = layoutSeedHash('workflow-x|today', ['bbb', 'aaa', 'ccc'])
    expect(h1).toBe(h2)
    expect(h1).not.toBe(h3) // order matters; the caller must pre-sort
  })

  it('sha256Hex returns lowercase hex string of length 64 for a buffer', async () => {
    const { sha256Hex } = await import('./contentHash')
    const buf = new TextEncoder().encode('hello').buffer
    const hex = await sha256Hex(buf)
    expect(hex).toMatch(/^[0-9a-f]{64}$/)
    // Known SHA-256 of "hello"
    expect(hex).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  })
})
```

**2. `src/platform/moshpit/services/layoutMath.test.ts`**

```typescript
import { describe, expect, it } from 'vitest'

describe('layoutMath (Wave 1)', () => {
  it('computeSquareGridDimensions returns ceil(sqrt(N)) cols and rows', async () => {
    const { computeSquareGridDimensions } = await import('./layoutMath')
    expect(computeSquareGridDimensions(0)).toEqual({ cols: 0, rows: 0 })
    expect(computeSquareGridDimensions(1)).toEqual({ cols: 1, rows: 1 })
    expect(computeSquareGridDimensions(10)).toEqual({ cols: 4, rows: 3 })
    expect(computeSquareGridDimensions(16)).toEqual({ cols: 4, rows: 4 })
    expect(computeSquareGridDimensions(17)).toEqual({ cols: 5, rows: 4 })
  })

  it('computeJitteredGrid returns N slots with jitter bounded by cellSize/2', async () => {
    const { computeJitteredGrid } = await import('./layoutMath')
    const hashes = ['a', 'b', 'c', 'd', 'e']
    const cellSize = 560
    const slots = computeJitteredGrid(hashes, 12345, cellSize)
    expect(slots).toHaveLength(5)
    for (const [i, slot] of slots.entries()) {
      expect(slot.hash).toBe(hashes[i])
      // jitter must not exceed cellSize/2
      const col = i % Math.ceil(Math.sqrt(5))
      const row = Math.floor(i / Math.ceil(Math.sqrt(5)))
      expect(Math.abs(slot.worldX - col * cellSize)).toBeLessThan(cellSize / 2)
      expect(Math.abs(slot.worldY - row * cellSize)).toBeLessThan(cellSize / 2)
    }
  })

  it('computeJitteredGrid is deterministic for same seed + hashes', async () => {
    const { computeJitteredGrid } = await import('./layoutMath')
    const a = computeJitteredGrid(['x', 'y', 'z'], 99, 100)
    const b = computeJitteredGrid(['x', 'y', 'z'], 99, 100)
    expect(a).toEqual(b)
  })
})
```

**3. `src/platform/moshpit/services/thumbRepository.test.ts`**

```typescript
import { beforeEach, describe, expect, it } from 'vitest'

describe('thumbRepository (Wave 1, fake-indexeddb)', () => {
  beforeEach(async () => {
    // Reset the fake DB between tests
    const { deleteMoshpitDB } = await import('./thumbRepository')
    await deleteMoshpitDB()
  })

  it('putThumb then getThumb round-trips a blob by contentHash', async () => {
    const { putThumb, getThumb } = await import('./thumbRepository')
    const blob = new Blob(['thumb-bytes'], { type: 'image/webp' })
    await putThumb({
      contentHash: 'abc',
      blob,
      width: 512,
      height: 512,
      generatedAt: 1
    })
    const got = await getThumb('abc')
    expect(got?.contentHash).toBe('abc')
    expect(got?.width).toBe(512)
    expect(got?.height).toBe(512)
  })

  it('getAllThumbHashes returns the set of cached hashes', async () => {
    const { putThumb, getAllThumbHashes } = await import('./thumbRepository')
    const blob = new Blob(['x'], { type: 'image/webp' })
    await putThumb({
      contentHash: 'a',
      blob,
      width: 512,
      height: 512,
      generatedAt: 1
    })
    await putThumb({
      contentHash: 'b',
      blob,
      width: 512,
      height: 512,
      generatedAt: 1
    })
    const hashes = await getAllThumbHashes()
    expect(new Set(hashes)).toEqual(new Set(['a', 'b']))
  })

  it('putAssetMeta + getAssetMeta round-trips parsed metadata and default curation', async () => {
    const { putAssetMeta, getAssetMeta, defaultCuration } =
      await import('./thumbRepository')
    await putAssetMeta({
      contentHash: 'abc',
      metadata: { workflow: '{}' },
      curation: defaultCuration()
    })
    const got = await getAssetMeta('abc')
    expect(got?.curation).toEqual({
      favourite: false,
      tags: [],
      folders: [],
      hidden: false
    })
    expect(got?.metadata.workflow).toBe('{}')
  })
})
```

**4. `src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts`**

```typescript
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

describe('useMoshpitProcessingQueue (Wave 3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('diff(filtered, cached) returns the set difference by key', async () => {
    const { computeQueueDelta } = await import('./useMoshpitProcessingQueue')
    const filtered = [
      { id: '1', assetHash: 'a' },
      { id: '2', assetHash: 'b' }
    ]
    const cachedHashes = new Set(['a'])
    const delta = computeQueueDelta(filtered, cachedHashes)
    expect(delta.map((x) => x.assetHash)).toEqual(['b'])
  })

  it('when cache is fully warm the delta is empty (D-08 short-circuit)', async () => {
    const { computeQueueDelta } = await import('./useMoshpitProcessingQueue')
    const filtered = [{ id: '1', assetHash: 'a' }]
    const cachedHashes = new Set(['a'])
    expect(computeQueueDelta(filtered, cachedHashes)).toHaveLength(0)
  })

  it('assets without asset_hash fall through to the worker (client-side hash path)', async () => {
    const { computeQueueDelta } = await import('./useMoshpitProcessingQueue')
    const filtered = [{ id: '1', assetHash: null }]
    const delta = computeQueueDelta(filtered, new Set())
    expect(delta).toHaveLength(1)
  })
})
```

**5. `src/platform/moshpit/components/MoshpitProcessingIndicator.test.ts`**

```typescript
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import MoshpitProcessingIndicator from './MoshpitProcessingIndicator.vue'

const mountPill = (props: { done: number; total: number }) =>
  render(MoshpitProcessingIndicator, {
    props,
    global: { plugins: [createPinia()] }
  })

describe('MoshpitProcessingIndicator (Wave 4)', () => {
  it('renders "Processing N / M" with the supplied counts', () => {
    mountPill({ done: 3, total: 10 })
    expect(screen.getByText(/Processing 3 \/ 10/)).toBeInTheDocument()
  })

  it('emits `cancel` when the × button is clicked', async () => {
    const { emitted } = mountPill({ done: 1, total: 5 })
    const btn = screen.getByRole('button', { name: /cancel processing/i })
    await userEvent.click(btn)
    expect(emitted().cancel).toBeTruthy()
  })

  it('exposes progressbar role with aria-valuenow / valuemin / valuemax', () => {
    mountPill({ done: 4, total: 8 })
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '4')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '8')
  })

  it('announces updates via role="status" aria-live="polite"', () => {
    mountPill({ done: 0, total: 1 })
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })
})
```

ALL five files must be saved with the exact content above (minor formatter-driven whitespace changes from `pnpm format` are fine).

Do NOT create the implementation files — they are RED deliberately. Subsequent plans will create the production code and the tests will transition to GREEN.
</action>
<verify>
<automated>pnpm test:unit --run src/platform/moshpit/services/contentHash.test.ts src/platform/moshpit/services/layoutMath.test.ts src/platform/moshpit/services/thumbRepository.test.ts src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts src/platform/moshpit/components/MoshpitProcessingIndicator.test.ts 2>&amp;1 | tail -20; exit 0</automated>
</verify>
<acceptance_criteria> - `test -f src/platform/moshpit/services/contentHash.test.ts` exits 0 - `test -f src/platform/moshpit/services/layoutMath.test.ts` exits 0 - `test -f src/platform/moshpit/services/thumbRepository.test.ts` exits 0 - `test -f src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts` exits 0 - `test -f src/platform/moshpit/components/MoshpitProcessingIndicator.test.ts` exits 0 - Each file contains at least one `it(` block (not only `it.todo`) - Running the vitest command on any of the five files fails with a "Cannot find module" / "is not a function" error (RED state — this is expected and correct) - NO production implementation files created: `test -f src/platform/moshpit/services/contentHash.ts` exits non-zero; same for layoutMath.ts, thumbRepository.ts, useMoshpitProcessingQueue.ts, MoshpitProcessingIndicator.vue
</acceptance_criteria>
<done>Five test files landed in RED state; dep install verified; vitest setup registers fake-indexeddb/auto.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                    | Description                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| npm registry → pnpm install | Supply-chain of `idb` v7 and `fake-indexeddb` v6; both are widely-used, low-surface-area libraries |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                                  | Disposition | Mitigation Plan                                                                                                                                                                                           |
| ---------- | ---------------------- | ---------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-02-01-01 | Tampering              | `idb` dep (supply chain)                                   | accept      | Pin `^7.1.1` to match the Firebase transitive already in lockfile; pnpm's content-addressed store verifies integrity via `pnpm-lock.yaml` SRI hashes. No new surface beyond what Firebase already brings. |
| T-02-01-02 | Tampering              | `fake-indexeddb` dep (supply chain)                        | accept      | Scoped to devDependencies — never ships to production bundle. Widely-used MIT library.                                                                                                                    |
| T-02-01-03 | Information Disclosure | `vitest.setup.ts` registers `fake-indexeddb/auto` globally | accept      | Only active in vitest (NODE_ENV=test). No risk to production runtime.                                                                                                                                     |

</threat_model>

<verification>
After execution:
- `pnpm install` exits 0
- `pnpm test:unit --run src/platform/moshpit/` shows 5 new test files in FAIL state (RED) — these fail at "Cannot find module './contentHash'" etc. This is the expected RED baseline.
- `pnpm typecheck` exits 0 (no new production TS yet)
- Existing Phase 1 tests still pass (regression guard)
</verification>

<success_criteria>

- Both dependencies installed and resolvable
- Five RED test files landed
- `pnpm test:unit` on existing tests still green (no regression)
- `pnpm typecheck` still green
  </success_criteria>

<output>
After completion, create `.planning/phases/02-asset-pipeline/02-01-SUMMARY.md` documenting:
- Confirmed resolved versions of `idb` and `fake-indexeddb`
- Count of RED tests (should be ~15–18 it() blocks across the 5 files)
- Any deviation from the planned content (should be none)
</output>
