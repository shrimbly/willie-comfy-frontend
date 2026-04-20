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
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true)
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
