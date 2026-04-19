import { shallowReactive } from 'vue'

import { api } from '@/scripts/api'
import { getFromPngBuffer } from '@/scripts/metadata/png'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { PromptMetadata } from '@/platform/assets/utils/promptMetadataParser'
import { parsePromptMetadata } from '@/platform/assets/utils/promptMetadataParser'

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

  return { extractMetadata, getCached, extractBatch }
}

function hasData(meta: PromptMetadata | null): meta is PromptMetadata {
  if (!meta) return false
  return (
    meta.model !== null ||
    meta.lora !== null ||
    meta.vae !== null ||
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

async function fetchFromJob(jobId: string): Promise<PromptMetadata | null> {
  try {
    const detail = await api.getJobDetail(jobId)
    if (!detail?.workflow) return null

    const workflow = detail.workflow as Record<string, unknown>
    const prompt = workflow.prompt ?? workflow
    return parsePromptMetadata(prompt)
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
