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

/**
 * 32-bit FNV-1a hash. Deterministic, fast, non-cryptographic.
 * Used as a layout seed — NOT for content addressing (use sha256Hex for that).
 *
 * `Math.imul` is mandatory for correct 32-bit integer multiplication; without it
 * JS doubles silently lose precision for long inputs. `>>> 0` forces unsigned
 * 32-bit interpretation after each XOR+multiply step.
 */
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
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
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
 *
 * `.padStart(2, '0')` is required to preserve leading zeros for bytes < 0x10;
 * omitting it produces an incorrect hash for inputs containing such bytes.
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
