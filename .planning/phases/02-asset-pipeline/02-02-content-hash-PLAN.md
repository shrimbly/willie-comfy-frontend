---
phase: 02-asset-pipeline
plan: 02
type: execute
wave: 1
depends_on: ['02-01']
files_modified:
  - src/platform/moshpit/services/contentHash.ts
autonomous: true
requirements: [ASSET-03]
tags: [pure-functions, hashing, wave-1, tdd]
must_haves:
  truths:
    - '`fnv1a(str)` produces a deterministic 32-bit unsigned int, usable as an LCG seed'
    - '`mulberry32(seed)` returns a seeded PRNG that produces a deterministic float sequence in [0, 1)'
    - '`layoutSeedHash(filterKey, sortedAssetHashes)` returns a stable integer seed for a given filter + asset set'
    - '`sha256Hex(buffer)` returns a lowercase hex string of length 64; works in both main-thread and worker contexts (uses `crypto.subtle`)'
    - 'All four utilities are pure, side-effect-free, and have no DOM / Pinia / Vue imports — safe to import from a Web Worker'
    - 'All Wave-0 tests in `contentHash.test.ts` turn GREEN'
  artifacts:
    - path: 'src/platform/moshpit/services/contentHash.ts'
      provides: 'Pure hash + PRNG utilities: fnv1a, mulberry32, layoutSeedHash, sha256Hex'
      contains: 'export function fnv1a'
  key_links:
    - from: 'src/platform/moshpit/services/contentHash.ts'
      to: 'crypto.subtle.digest (Web Crypto, worker-safe)'
      via: "`crypto.subtle.digest('SHA-256', buffer)`"
      pattern: "crypto\\.subtle\\.digest\\('SHA-256'"
---

<objective>
Create the pure-function hash + PRNG module that underpins both the content-addressing strategy (SHA-256 for IDB keys) and the deterministic jittered-grid layout seed (FNV-1a + mulberry32). Turn the five `contentHash.test.ts` cases from Plan 01 GREEN.

Purpose: Establish a leaf module with zero external deps that both the main thread (layout math) and the worker (content hashing) can import without dragging Vue/Pinia into the worker bundle.

Output: One ~60-line TypeScript file with four named exports and JSDoc comments explaining the math.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-asset-pipeline/02-RESEARCH.md
@.planning/phases/02-asset-pipeline/02-CONTEXT.md

<interfaces>
<!-- Downstream consumers (Plans 03, 05, 08) will import these symbols.
     Lock the exact signatures. -->

Expected public API of `src/platform/moshpit/services/contentHash.ts`:

```typescript
/**
 * 32-bit FNV-1a hash. Deterministic, fast, non-cryptographic.
 * Used as a layout seed — NOT for content addressing (use sha256Hex for that).
 */
export function fnv1a(str: string): number

/**
 * Seeded PRNG (mulberry32). Returns a function that produces deterministic
 * floats in [0, 1) for the given seed.
 */
export function mulberry32(seed: number): () => number

/**
 * Stable seed for the jittered-grid layout. The caller MUST pre-sort
 * `sortedAssetHashes` — the function does not sort internally because
 * order is part of the contract (different orderings must produce
 * different seeds for testability).
 */
export function layoutSeedHash(
  filterKey: string,
  sortedAssetHashes: readonly string[]
): number

/**
 * SHA-256 of a buffer as lowercase hex. Worker-safe: uses `crypto.subtle`
 * which is available on `WorkerGlobalScope.crypto`.
 */
export function sha256Hex(buffer: ArrayBuffer): Promise<string>
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement contentHash.ts — four pure utilities</name>
  <read_first>
    - src/platform/moshpit/services/contentHash.test.ts (the RED tests from Plan 01 — make these GREEN)
    - .planning/phases/02-asset-pipeline/02-RESEARCH.md §Layout Seed Hash + Jittered Grid Math (for FNV-1a and mulberry32 reference implementations)
    - .planning/phases/02-asset-pipeline/02-RESEARCH.md §1 Content-Hash Strategy (for SHA-256 hex conversion pattern)
  </read_first>
  <behavior>
    - fnv1a('hello') === fnv1a('hello') — deterministic
    - fnv1a('hello') !== fnv1a('world') — collision-resistant for distinct short strings
    - fnv1a result is a 32-bit unsigned int (0 ≤ x < 2^32)
    - mulberry32(42) twice produces IDENTICAL sequences for the first N calls
    - mulberry32 output is always in [0, 1)
    - layoutSeedHash('x|today', ['a','b','c']) !== layoutSeedHash('x|today', ['b','a','c']) — order-sensitive (caller must pre-sort)
    - sha256Hex of UTF-8 'hello' === '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824' (NIST test vector)
    - sha256Hex output matches `/^[0-9a-f]{64}$/`
  </behavior>
  <action>
Create `src/platform/moshpit/services/contentHash.ts` with EXACTLY these four exports and JSDoc headers. Do not export anything else. Do not import from Vue, Pinia, or any other repo module — this file is a leaf utility so the worker can import it without dragging the rest of the app into the worker chunk.

```typescript
/**
 * Pure hash + PRNG utilities for Moshpit's asset pipeline.
 *
 * This module is a leaf — it imports nothing from the rest of the app — so it
 * can be imported from a Web Worker (`thumbWorker.ts`) without pulling Vue or
 * Pinia into the worker bundle.
 *
 * Two hash kinds live here:
 *   - `sha256Hex` — cryptographic, used for content addressing (IDB keys).
 *   - `fnv1a` — non-cryptographic 32-bit; used as a seed for `mulberry32`.
 *
 * The jittered-grid layout (D-01, D-02) consumes `layoutSeedHash` + `mulberry32`
 * so the same filter + asset set produces the same layout across reloads.
 */

const FNV_OFFSET_BASIS_32 = 2166136261
const FNV_PRIME_32 = 16777619

export function fnv1a(str: string): number {
  let hash = FNV_OFFSET_BASIS_32
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME_32) >>> 0
  }
  return hash
}

/**
 * Seeded PRNG (mulberry32). Returns a function that produces a deterministic
 * sequence of floats in [0, 1) for the given 32-bit seed.
 *
 * Reference: https://gist.github.com/tommyettinger/46a3d7a9dc0a65fbfc3a25b51b97d1a3
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t =
      (Math.imul(t + Math.imul(t ^ (t >>> 7), 61 | t), t ^ (t >>> 14)) + t) >>>
      0
    return (t ^ (t >>> 14)) / 4294967296
  }
}

/**
 * Layout seed for the jittered-grid chaos placement (D-01 / D-02).
 *
 * The caller MUST pre-sort `sortedAssetHashes` — order is part of the seed so
 * different orderings produce different layouts. In practice Phase 2 passes
 * `assets.map((a) => a.contentHash).sort()` which is a stable canonical order.
 */
export function layoutSeedHash(
  filterKey: string,
  sortedAssetHashes: readonly string[]
): number {
  return fnv1a(filterKey + '\0' + sortedAssetHashes.join(','))
}

/**
 * SHA-256 digest of `buffer` returned as a lowercase hex string (length 64).
 *
 * Uses `crypto.subtle` which is available in both `Window` and
 * `WorkerGlobalScope` — callable from `thumbWorker.ts` without any import.
 */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}
```

Notes:

- `Math.imul` is mandatory for 32-bit integer multiplication (JS numbers are doubles). Without it FNV-1a silently loses precision for long inputs.
- `>>> 0` forces unsigned 32-bit interpretation.
- The SHA-256 hex conversion uses `.padStart(2, '0')` to keep leading zeros (a bug magnet in hand-rolled hex conversion).
- NO `any`, NO `as any`, NO `@ts-expect-error`. The function signatures are strict enough to pass typecheck as-is.
  </action>
  <verify>
  <automated>pnpm test:unit --run src/platform/moshpit/services/contentHash.test.ts</automated>
  </verify>
  <acceptance_criteria> - `test -f src/platform/moshpit/services/contentHash.ts` exits 0 - `grep -c "^export function" src/platform/moshpit/services/contentHash.ts` returns exactly 4 - `grep "crypto.subtle.digest('SHA-256'" src/platform/moshpit/services/contentHash.ts` returns a match - `grep "Math.imul" src/platform/moshpit/services/contentHash.ts` returns at least 2 matches (fnv1a + mulberry32) - File contains NO `import` statements from `@/...` or `vue` or `pinia` (leaf module) - `pnpm test:unit --run src/platform/moshpit/services/contentHash.test.ts` exits 0 with all 4 tests passing - `pnpm typecheck` exits 0 - `grep "any\b" src/platform/moshpit/services/contentHash.ts` returns zero matches
  </acceptance_criteria>
  <done>All four utilities implemented; Plan 01 Wave-0 contentHash tests GREEN; typecheck clean.</done>
  </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary             | Description                                                                           |
| -------------------- | ------------------------------------------------------------------------------------- |
| Worker ↔ main thread | `sha256Hex` runs in both contexts; must not leak secrets through timing side channels |

## STRIDE Threat Register

| Threat ID  | Category               | Component                           | Disposition | Mitigation Plan                                                                                                                                                                                    |
| ---------- | ---------------------- | ----------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-02-02-01 | Tampering              | `fnv1a` used as cache key           | accept      | FNV-1a is non-cryptographic and collision-prone, but it is ONLY used as a layout seed (`layoutSeedHash`), never as an IDB key. Cache keys use `sha256Hex`. Document in JSDoc.                      |
| T-02-02-02 | Information Disclosure | `sha256Hex` timing                  | accept      | SHA-256 via `crypto.subtle` is constant-time-ish within the browser's implementation. No secrets hashed — only generated-image bytes. ASVS L1 V6.2 does not require constant-time for public data. |
| T-02-02-03 | Denial of Service      | `fnv1a` on arbitrarily long strings | accept      | Input is always bounded: `filterKey` is short (<200 chars) and `sortedAssetHashes` is bounded by the 5k budget. Worst case O(64-hex-chars × 5000) = 320k chars — trivial.                          |

</threat_model>

<verification>
- `pnpm test:unit --run src/platform/moshpit/services/contentHash.test.ts` — 4 tests PASS
- `pnpm typecheck` exits 0
- `pnpm lint --filter ./src/platform/moshpit/services/contentHash.ts` exits 0 (or full `pnpm lint` if filter-by-file unsupported)
</verification>

<success_criteria>

- Four exports: `fnv1a`, `mulberry32`, `layoutSeedHash`, `sha256Hex`
- SHA-256 test vector for "hello" passes (verifies byte order + padding)
- Same seed → same mulberry32 sequence
- File is a leaf module (no intra-repo imports)
  </success_criteria>

<output>
Create `.planning/phases/02-asset-pipeline/02-02-SUMMARY.md` confirming test count (4 GREEN) and any minor edits from the template.
</output>
