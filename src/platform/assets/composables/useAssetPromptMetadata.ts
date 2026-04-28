import { shallowReactive } from 'vue'

import { api } from '@/scripts/api'
import { getFromPngBuffer } from '@/scripts/metadata/png'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { PromptMetadata } from '@/platform/assets/utils/promptMetadataParser'
import { parsePromptMetadata } from '@/platform/assets/utils/promptMetadataParser'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

export function useAssetPromptMetadata() {
  const cache = shallowReactive(new Map<string, PromptMetadata>())
  const pending = new Set<string>()

  async function extractMetadata(
    asset: AssetItem
  ): Promise<PromptMetadata | null> {
    if (cache.has(asset.id)) return cache.get(asset.id)!
    if (pending.has(asset.id)) return null

    pending.add(asset.id)
    try {
      const metadata = await fetchMetadata(asset)
      if (metadata) {
        cache.set(asset.id, metadata)
      }
      return metadata
    } finally {
      pending.delete(asset.id)
    }
  }

  function getCached(assetId: string): PromptMetadata | null {
    return cache.get(assetId) ?? null
  }

  function extractBatch(assets: AssetItem[]): void {
    for (const asset of assets) {
      if (!cache.has(asset.id) && !pending.has(asset.id)) {
        void extractMetadata(asset)
      }
    }
  }

  function getAvailableValues(
    field: 'model' | 'lora' | 'workflowTitle'
  ): string[] {
    const seen = new Set<string>()
    for (const meta of cache.values()) {
      const raw = meta[field]
      if (!raw) continue
      if (field === 'lora') {
        for (const part of raw.split(',')) {
          const trimmed = part.trim()
          if (trimmed) seen.add(trimmed)
        }
      } else {
        seen.add(raw)
      }
    }
    return [...seen].sort((a, b) => a.localeCompare(b))
  }

  return { extractMetadata, getCached, extractBatch, getAvailableValues }
}

function hasData(meta: PromptMetadata | null): meta is PromptMetadata {
  if (!meta) return false
  return (
    meta.model !== null ||
    meta.lora !== null ||
    meta.vae !== null ||
    meta.workflowTitle !== null ||
    meta.prompt !== null ||
    meta.steps !== null ||
    meta.seed !== null
  )
}

async function fetchMetadata(asset: AssetItem): Promise<PromptMetadata | null> {
  const jobId = asset.user_metadata?.jobId as string | undefined
  if (jobId) {
    const result = await fetchFromJob(jobId)
    if (hasData(result)) return result
  }

  if (asset.preview_url && asset.name.endsWith('.png')) {
    return fetchFromPng(asset.preview_url)
  }

  return null
}

function resolveWorkflowTitle(
  workflowId: string | null | undefined
): string | null {
  if (!workflowId) return null
  const store = useWorkflowStore()
  for (const wf of store.openWorkflows) {
    if (wf.activeState?.id === workflowId) {
      return wf.filename
    }
  }
  return workflowId
}

async function fetchFromJob(jobId: string): Promise<PromptMetadata | null> {
  try {
    const detail = await api.getJobDetail(jobId)
    if (!detail) return null

    const workflowTitle = resolveWorkflowTitle(detail.workflow_id)

    if (!detail.workflow) {
      return workflowTitle
        ? {
            model: null,
            lora: null,
            vae: null,
            workflowTitle,
            prompt: null,
            steps: null,
            seed: null
          }
        : null
    }

    const workflow = detail.workflow as Record<string, unknown>
    const prompt = workflow.prompt ?? workflow
    const parsed = parsePromptMetadata(prompt)
    if (!parsed) {
      return workflowTitle
        ? {
            model: null,
            lora: null,
            vae: null,
            workflowTitle,
            prompt: null,
            steps: null,
            seed: null
          }
        : null
    }
    return { ...parsed, workflowTitle }
  } catch {
    return null
  }
}

async function fetchFromPng(url: string): Promise<PromptMetadata | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const buffer = await response.arrayBuffer()
    const chunks = await getFromPngBuffer(buffer)
    if (!chunks.prompt) return null

    const promptData = JSON.parse(chunks.prompt)
    return parsePromptMetadata(promptData)
  } catch {
    return null
  }
}
