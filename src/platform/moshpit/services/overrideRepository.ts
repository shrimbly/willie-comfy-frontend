/**
 * IndexedDB repository for Moshpit's per-asset sprite overrides (pinned world
 * position + manual scale). Content-hash addressed; backed by the `overrides`
 * object store introduced at MoshpitDB v4 (Quick 260423-m6c).
 *
 * Reuses the existing `thumbRepository` connection via `getMoshpitDB()` — do
 * not open a second DB handle.
 */

import { getMoshpitDB } from './thumbRepository'
import type { OverridePersistedRecord } from './thumbRepository.types'

export type { OverridePersistedRecord } from './thumbRepository.types'

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidRecord(record: unknown): record is OverridePersistedRecord {
  if (!record || typeof record !== 'object') return false
  const rec = record as {
    contentHash?: unknown
    pinnedWorldPos?: unknown
    scale?: unknown
    pinnedAt?: unknown
  }
  if (typeof rec.contentHash !== 'string' || rec.contentHash.length === 0) {
    return false
  }
  if (!isFiniteNumber(rec.pinnedAt)) return false
  if (rec.pinnedWorldPos !== undefined) {
    const pos = rec.pinnedWorldPos as { x?: unknown; y?: unknown } | null
    if (!pos || typeof pos !== 'object') return false
    if (!isFiniteNumber(pos.x) || !isFiniteNumber(pos.y)) return false
  }
  if (rec.scale !== undefined && !isFiniteNumber(rec.scale)) return false
  return true
}

export async function loadAllOverrides(): Promise<OverridePersistedRecord[]> {
  const db = await getMoshpitDB()
  const raw = await db.getAll('overrides')
  const valid: OverridePersistedRecord[] = []
  for (const record of raw) {
    if (isValidRecord(record)) {
      valid.push(record)
    } else {
      console.warn('[moshpit] skipping malformed override record', record)
    }
  }
  return valid
}

export async function saveOverride(
  record: OverridePersistedRecord
): Promise<void> {
  const db = await getMoshpitDB()
  await db.put('overrides', record)
}

export async function deleteOverride(contentHash: string): Promise<void> {
  const db = await getMoshpitDB()
  await db.delete('overrides', contentHash)
}

export async function clearAllOverrides(): Promise<void> {
  const db = await getMoshpitDB()
  await db.clear('overrides')
}
