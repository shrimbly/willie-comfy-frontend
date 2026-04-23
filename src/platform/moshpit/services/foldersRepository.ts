/**
 * IndexedDB repository for user-defined Moshpit folders. Backed by the
 * `folders` object store introduced at MoshpitDB v5 (Phase 6 Plan 01).
 *
 * Reuses the existing `thumbRepository` connection via `getMoshpitDB()` — do
 * not open a second DB handle.
 *
 * Mirrors the shape of overrideRepository.ts: isValidFolderRecord guard on
 * read, swallow-on-warn semantics belong at the store layer.
 */

import { getMoshpitDB } from './thumbRepository'
import type { FolderRecord } from './thumbRepository.types'

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidFolderRecord(record: unknown): record is FolderRecord {
  if (!record || typeof record !== 'object') return false
  const rec = record as {
    id?: unknown
    name?: unknown
    createdAt?: unknown
  }
  if (typeof rec.id !== 'string' || rec.id.length === 0) return false
  if (typeof rec.name !== 'string') return false
  if (!isFiniteNumber(rec.createdAt)) return false
  return true
}

export async function loadAllFolders(): Promise<FolderRecord[]> {
  const db = await getMoshpitDB()
  const raw = await db.getAll('folders')
  const valid: FolderRecord[] = []
  for (const record of raw) {
    if (isValidFolderRecord(record)) {
      valid.push(record)
    } else {
      console.warn('[moshpit] skipping malformed folder record', record)
    }
  }
  return valid
}

export async function saveFolder(record: FolderRecord): Promise<void> {
  const db = await getMoshpitDB()
  await db.put('folders', record)
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await getMoshpitDB()
  await db.delete('folders', id)
}

export async function clearAllFolders(): Promise<void> {
  const db = await getMoshpitDB()
  await db.clear('folders')
}
