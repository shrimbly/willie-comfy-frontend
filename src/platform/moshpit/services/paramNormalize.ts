/**
 * Pure parameter extraction from ComfyUI PNG `prompt` metadata — per CONTEXT.md
 * D-01 / D-02 / D-05. This module is worker-safe: it must not import Vue,
 * Pinia, or any DOM-only module. The only permitted runtime import is `zod`.
 *
 * Behaviour (D-03): best-effort, silently null. Missing / unparseable
 * parameters resolve to `undefined`; the asset stays in the Moshpit but drops
 * out of any filter/sort query against the missing field.
 *
 * Workflow identity: two derived fields live alongside D-05's 12 core fields —
 *   - `workflowFingerprint` (always string; sorted unique class_type set)
 *   - `workflowFilename`    (string | null; PNG filename stem heuristic)
 * The workflow picker (Plan 03-07) prefers `workflowFilename` as displayName
 * and falls back to the fingerprint when filename is null.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Zod schema + inferred type (D-05 shape + deviation_note extension)
// ---------------------------------------------------------------------------

export const NormalizedParamsSchema = z.object({
  model: z.string().optional(),
  loras: z
    .array(z.object({ name: z.string(), weight: z.number() }))
    .readonly(),
  cfg: z.number().optional(),
  steps: z.number().optional(),
  sampler: z.string().optional(),
  scheduler: z.string().optional(),
  seed: z.number().optional(),
  positivePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  timestamp: z.number(),
  workflowFingerprint: z.string(),
  workflowFilename: z.string().nullable()
})

export type NormalizedParams = z.infer<typeof NormalizedParamsSchema>

// ---------------------------------------------------------------------------
// Internal ComfyUI prompt graph types
// ---------------------------------------------------------------------------

type PromptNode = {
  class_type: string
  inputs: Record<string, unknown>
  _meta?: { title?: string }
}

type PromptGraph = Record<string, PromptNode>

// ---------------------------------------------------------------------------
// Filename heuristic
// ---------------------------------------------------------------------------

const IMAGE_EXT_RE = /\.(png|jpe?g|webp)$/i
const COUNTER_SUFFIX_RE = /_\d{4,6}_?$/

/**
 * Derive a human-readable workflow display name from a PNG output filename.
 *
 * Strips path prefix, image extension, and the ComfyUI counter suffix
 * (`_NNNNN_` or `_NNNNN`) that ComfyUI appends to generated outputs.
 * Returns `null` when the remaining stem is empty.
 *
 * Used by the workflow picker (Plan 03-07) as the display name for a workflow
 * group when `workflowFilename` is non-null (OQ-3 resolution).
 */
export function extractWorkflowFilename(
  sourceFilename: string | null | undefined
): string | null {
  if (sourceFilename === null || sourceFilename === undefined) return null
  if (typeof sourceFilename !== 'string') return null
  // Strip leading path components
  const lastSlash = Math.max(
    sourceFilename.lastIndexOf('/'),
    sourceFilename.lastIndexOf('\\')
  )
  const base =
    lastSlash >= 0 ? sourceFilename.slice(lastSlash + 1) : sourceFilename
  // Strip image extension
  const noExt = base.replace(IMAGE_EXT_RE, '')
  // Strip ComfyUI counter suffix (_NNNNN_ or _NNNNN)
  const noCounter = noExt.replace(COUNTER_SUFFIX_RE, '')
  // Trim trailing underscores and whitespace
  const trimmed = noCounter.replace(/[_\s]+$/, '').trim()
  return trimmed.length > 0 ? trimmed : null
}

// ---------------------------------------------------------------------------
// emptyParams — all fields undefined except timestamp + identity fields
// ---------------------------------------------------------------------------

export function emptyParams(createdAtMs: number): NormalizedParams {
  return {
    model: undefined,
    loras: [],
    cfg: undefined,
    steps: undefined,
    sampler: undefined,
    scheduler: undefined,
    seed: undefined,
    positivePrompt: undefined,
    negativePrompt: undefined,
    width: undefined,
    height: undefined,
    timestamp: createdAtMs,
    workflowFingerprint: '',
    workflowFilename: null
  }
}

// ---------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------

function isPromptGraph(value: unknown): value is PromptGraph {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  // Shallow check: every own-property value must be an object with class_type
  for (const key of Object.keys(value as object)) {
    const node = (value as Record<string, unknown>)[key]
    if (node === null || typeof node !== 'object') return false
    if (typeof (node as Record<string, unknown>)['class_type'] !== 'string') {
      return false
    }
  }
  return true
}

const KSAMPLER_CLASS_TYPES = new Set([
  'KSampler',
  'KSamplerAdvanced',
  'KSampler (Efficient)'
])

const CHECKPOINT_CLASS_TYPES = new Set([
  'CheckpointLoaderSimple',
  'CheckpointLoader'
])

const LORA_CLASS_TYPES = new Set([
  'LoraLoader',
  'LoraLoaderModelOnly',
  'LoraTagLoader'
])

const LATENT_CLASS_TYPES = new Set([
  'EmptyLatentImage',
  'EmptySD3LatentImage',
  'EmptyHunyuanLatentVideo'
])

function findNodeByClassTypes(
  graph: PromptGraph,
  classTypes: Set<string>
): PromptNode | undefined {
  for (const node of Object.values(graph)) {
    if (classTypes.has(node.class_type)) return node
  }
  return undefined
}

function findAllNodesByClassTypes(
  graph: PromptGraph,
  classTypes: Set<string>
): PromptNode[] {
  const result: PromptNode[] = []
  for (const node of Object.values(graph)) {
    if (classTypes.has(node.class_type)) result.push(node)
  }
  return result
}

/**
 * Resolve positive and negative prompt text from CLIPTextEncode nodes
 * referenced by a KSampler node's `positive` / `negative` inputs.
 *
 * KSampler inputs use array references of the form `[nodeId, outputIndex]`
 * to point to upstream nodes. Only CLIPTextEncode array references are
 * resolved in v1 — plain string values return `undefined` (D-02).
 */
function resolvePrompts(
  graph: PromptGraph,
  samplerNode: PromptNode | undefined
): { positivePrompt: string | undefined; negativePrompt: string | undefined } {
  if (!samplerNode) {
    return { positivePrompt: undefined, negativePrompt: undefined }
  }

  function resolveRef(ref: unknown): string | undefined {
    // Only resolve array references ([nodeId, outputIndex]) — not plain strings
    if (!Array.isArray(ref) || ref.length < 1) return undefined
    const nodeId = ref[0]
    if (typeof nodeId !== 'string') return undefined
    const node = graph[nodeId]
    if (!node || node.class_type !== 'CLIPTextEncode') return undefined
    const text = node.inputs['text']
    return typeof text === 'string' ? text : undefined
  }

  return {
    positivePrompt: resolveRef(samplerNode.inputs['positive']),
    negativePrompt: resolveRef(samplerNode.inputs['negative'])
  }
}

/**
 * Derive `workflowFingerprint` — a stable identifier for the workflow's
 * node-graph topology, independent of node IDs or ordering.
 *
 * Computed as the sorted unique set of `class_type` values joined by `|`.
 * Two graphs with the same set of node types produce the same fingerprint.
 * Used by the workflow picker as a grouping key when no filename is available.
 */
function computeWorkflowFingerprint(graph: PromptGraph): string {
  const classTypes = new Set<string>()
  for (const node of Object.values(graph)) {
    classTypes.add(node.class_type)
  }
  return [...classTypes].sort().join('|')
}

// ---------------------------------------------------------------------------
// LoRA extraction helpers
// ---------------------------------------------------------------------------

type LoraEntry = { readonly name: string; readonly weight: number }

function extractLoras(loraNodes: PromptNode[]): LoraEntry[] {
  const loras: LoraEntry[] = []
  for (const node of loraNodes) {
    const rawName = node.inputs['lora_name'] ?? node.inputs['lora_tag']
    if (typeof rawName !== 'string' || rawName.length === 0) continue
    const rawWeight = node.inputs['strength_model'] ?? node.inputs['strength']
    const weight = typeof rawWeight === 'number' ? rawWeight : 1
    loras.push({ name: rawName, weight })
  }
  return loras
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

/**
 * Normalize a ComfyUI PNG `prompt` metadata chunk into a typed
 * `NormalizedParams` record.
 *
 * @param rawMeta     The raw PNG tEXt/iTXt chunk map from `getFromPngBuffer`.
 *                    Expected to contain a `prompt` key with JSON.
 * @param createdAtMs Epoch milliseconds — mirrors AssetItem.created_at (D-05).
 * @param sourceFilename Optional PNG output filename used to derive
 *                    `workflowFilename` via `extractWorkflowFilename`.
 *
 * Returns `emptyParams(createdAtMs)` (with workflowFilename applied) on any
 * parse or validation failure — best-effort, silently null per D-03.
 */
export function normalizeParams(
  rawMeta: Readonly<Record<string, string>>,
  createdAtMs: number,
  sourceFilename?: string | null
): NormalizedParams {
  const workflowFilename = extractWorkflowFilename(sourceFilename ?? null)
  const fallback: NormalizedParams = {
    ...emptyParams(createdAtMs),
    workflowFilename
  }

  const promptRaw = rawMeta['prompt']
  if (!promptRaw) return fallback

  let parsed: unknown
  try {
    parsed = JSON.parse(promptRaw)
  } catch {
    return fallback
  }

  if (!isPromptGraph(parsed)) return fallback

  const graph: PromptGraph = parsed

  const samplerNode = findNodeByClassTypes(graph, KSAMPLER_CLASS_TYPES)
  const checkpointNode = findNodeByClassTypes(graph, CHECKPOINT_CLASS_TYPES)
  const loraNodes = findAllNodesByClassTypes(graph, LORA_CLASS_TYPES)
  const latentNode = findNodeByClassTypes(graph, LATENT_CLASS_TYPES)

  const { positivePrompt, negativePrompt } = resolvePrompts(graph, samplerNode)
  const loras = extractLoras(loraNodes)
  const workflowFingerprint = computeWorkflowFingerprint(graph)

  const samplerInputs = samplerNode?.inputs
  const checkpointInputs = checkpointNode?.inputs
  const latentInputs = latentNode?.inputs

  const cfg =
    typeof samplerInputs?.['cfg'] === 'number'
      ? samplerInputs['cfg']
      : undefined
  const steps =
    typeof samplerInputs?.['steps'] === 'number'
      ? samplerInputs['steps']
      : undefined
  const sampler =
    typeof samplerInputs?.['sampler_name'] === 'string'
      ? samplerInputs['sampler_name']
      : undefined
  const scheduler =
    typeof samplerInputs?.['scheduler'] === 'string'
      ? samplerInputs['scheduler']
      : undefined
  const seed =
    typeof samplerInputs?.['seed'] === 'number'
      ? samplerInputs['seed']
      : undefined
  const model =
    typeof checkpointInputs?.['ckpt_name'] === 'string'
      ? checkpointInputs['ckpt_name']
      : undefined
  const width =
    typeof latentInputs?.['width'] === 'number'
      ? latentInputs['width']
      : undefined
  const height =
    typeof latentInputs?.['height'] === 'number'
      ? latentInputs['height']
      : undefined

  return {
    model,
    loras,
    cfg,
    steps,
    sampler,
    scheduler,
    seed,
    positivePrompt,
    negativePrompt,
    width,
    height,
    timestamp: createdAtMs,
    workflowFingerprint,
    workflowFilename
  }
}
