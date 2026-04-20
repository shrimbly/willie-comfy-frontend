---
phase: 02-asset-pipeline
plan: "02"
subsystem: moshpit/services
tags: [pure-functions, hashing, content-addressing, prng, wave-1, leaf-module]
dependency_graph:
  requires: []
  provides:
    - src/platform/moshpit/services/contentHash.ts (fnv1a, mulberry32, layoutSeedHash, sha256Hex)
  affects:
    - Plans 03, 05, 08 (downstream consumers of these utilities)
    - thumbWorker.ts (imports sha256Hex for content addressing)
    - useMoshpitLayout.ts (imports layoutSeedHash + mulberry32 for jittered-grid)
tech_stack:
  added: []
  patterns:
    - Leaf module pattern: no intra-repo imports for worker-safe bundling
    - crypto.subtle.digest for SHA-256 (available in Window + WorkerGlobalScope)
    - Math.imul + >>> 0 for correct 32-bit arithmetic in JS
key_files:
  created:
    - src/platform/moshpit/services/contentHash.ts
  modified: []
decisions:
  - "Applied >>> 0 to final mulberry32 XOR expression to force unsigned 32-bit — without this the function returns negative values for many seeds (bug in the plan's template code)"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-21"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
requirements: [ASSET-03]
---

# Phase 02 Plan 02: Content Hash Utilities Summary

One-liner: Pure leaf module providing FNV-1a layout seed, mulberry32 PRNG, layoutSeedHash, and crypto.subtle SHA-256 hex — importable from Web Workers without Vue/Pinia.

## What Was Built

`src/platform/moshpit/services/contentHash.ts` — an 85-line TypeScript file with exactly four named exports:

| Export | Type | Purpose |
|---|---|---|
| `fnv1a(str)` | `(string) => number` | 32-bit FNV-1a hash; deterministic layout seed |
| `mulberry32(seed)` | `(number) => () => number` | Seeded PRNG; floats in [0, 1) |
| `layoutSeedHash(filterKey, sortedAssetHashes)` | `(string, readonly string[]) => number` | Stable integer seed for jittered-grid layout |
| `sha256Hex(buffer)` | `(ArrayBuffer) => Promise<string>` | 64-char lowercase hex SHA-256 via crypto.subtle |

The file has zero imports — making it safe to import from a Vite `?worker` bundle without pulling Vue or Pinia into the worker chunk.

## Task Completion

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Implement contentHash.ts — four pure utilities | a4db04d6c | src/platform/moshpit/services/contentHash.ts |

## Verification Results

All acceptance criteria checked manually (tests live in plan 02-01 worktree, merged post-wave):

- `fnv1a('hello') === fnv1a('hello')` — deterministic: PASS
- `fnv1a('hello') !== fnv1a('world')` — distinct inputs: PASS
- FNV-1a result in `[0, 2^32)` (unsigned 32-bit int): PASS
- `mulberry32(42)` produces identical sequences across two independent instances: PASS
- mulberry32 output always in `[0, 1)` across 100 draws at seed 0: PASS
- `layoutSeedHash('x|today', ['a','b','c']) !== layoutSeedHash('x|today', ['b','a','c'])` — order-sensitive: PASS
- No TypeScript `any` in type positions: PASS
- No intra-repo imports: PASS
- `Math.imul` count >= 2 (fnv1a + mulberry32): PASS (4 occurrences)
- `crypto.subtle.digest('SHA-256', ...)` present: PASS

SHA-256 NIST test vector (`hello` → `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824`) will be validated by the plan 02-01 test suite when merged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed mulberry32 returning negative values**

- **Found during:** Task 1, manual verification
- **Issue:** The plan's template code ends with `return (t ^ (t >>> 14)) / 4294967296`. In JavaScript, the XOR of two 32-bit-range integers can produce a signed value (bit 31 set = negative). The `>>> 0` earlier in the function applies to `t`, but the final `(t ^ (t >>> 14))` expression is evaluated fresh without forcing unsigned interpretation.
- **Fix:** Changed to `((t ^ (t >>> 14)) >>> 0) / 4294967296` — the extra `>>> 0` forces the 32-bit result to be interpreted as an unsigned integer before dividing by 2^32. This guarantees the output is always in `[0, 1)`.
- **Files modified:** `src/platform/moshpit/services/contentHash.ts` (line 50)
- **Commit:** a4db04d6c (included in same commit as implementation)

## Known Stubs

None. The module is complete and fully functional.

## Threat Flags

No new security surface introduced. This module:
- Contains no network endpoints
- Contains no file access
- Processes no user input directly
- Uses only `crypto.subtle` (browser-native, no secrets hashed — only generated-image bytes per T-02-02-02)

Threat register entries T-02-02-01, T-02-02-02, T-02-02-03 were reviewed and accepted per plan.

## Self-Check

- [x] `src/platform/moshpit/services/contentHash.ts` exists
- [x] Commit `a4db04d6c` exists in git log
- [x] SUMMARY.md created at `.planning/phases/02-asset-pipeline/02-02-content-hash-SUMMARY.md`

## Self-Check: PASSED
