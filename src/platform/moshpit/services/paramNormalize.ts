/**
 * Worker-safe parameter normalization from raw ComfyUI PNG metadata.
 *
 * Extracts typed NormalizedParams from the `prompt` PNG tEXt chunk
 * (ComfyUI API format). This is a strict leaf module — no Vue, Pinia,
 * or DOM imports — safe to use in a Web Worker context (D-01).
 *
 * Extraction is best-effort, silently null (D-03): missing or unparseable
 * parameters resolve to `undefined`. Assets with undefined params are
 * excluded from any filter/sort that queries those fields.
 */

export interface NormalizedParams {
  readonly model: string | undefined
  readonly loras: readonly { readonly name: string; readonly weight: number }[]
  readonly cfg: number | undefined
  readonly steps: number | undefined
  readonly sampler: string | undefined
  readonly scheduler: string | undefined
  readonly seed: number | undefined
  readonly positivePrompt: string | undefined
  readonly negativePrompt: string | undefined
  readonly width: number | undefined
  readonly height: number | undefined
  /** epoch ms — always defined; mirrors AssetItem.created_at */
  readonly timestamp: number
  /** Fingerprint derived from sorted node class types for workflow grouping */
  readonly workflowFingerprint: string | undefined
}

type PromptNode = {
  class_type: string
  inputs: Record<string, unknown>
  _meta?: { title?: string }
}

export function emptyParams(timestampMs: number): NormalizedParams {
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
    timestamp: timestampMs,
    workflowFingerprint: undefined
  }
}

function findNodeByClassTypes(
  graph: Record<string, PromptNode>,
  classTypes: readonly string[]
): PromptNode | undefined {
  for (const node of Object.values(graph)) {
    if (classTypes.includes(node.class_type)) return node
  }
  return undefined
}

function findAllNodesByClassTypes(
  graph: Record<string, PromptNode>,
  classTypes: readonly string[]
): PromptNode[] {
  return Object.values(graph).filter((n) => classTypes.includes(n.class_type))
}

function resolvePrompts(
  graph: Record<string, PromptNode>,
  samplerNode: PromptNode | undefined
): { positivePrompt: string | undefined; negativePrompt: string | undefined } {
  if (!samplerNode) return { positivePrompt: undefined, negativePrompt: undefined }

  function resolveRef(
    ref: unknown
  ): string | undefined {
    if (typeof ref === 'string') return ref
    if (
      Array.isArray(ref) &&
      ref.length >= 1 &&
      typeof ref[0] === 'string'
    ) {
      const nodeId = ref[0] as string
      const node = graph[nodeId]
      if (node?.class_type === 'CLIPTextEncode') {
        const text = node.inputs['text']
        return typeof text === 'string' ? text : undefined
      }
    }
    return undefined
  }

  return {
    positivePrompt: resolveRef(samplerNode.inputs['positive']),
    negativePrompt: resolveRef(samplerNode.inputs['negative'])
  }
}

function computeWorkflowFingerprint(
  graph: Record<string, PromptNode>
): string | undefined {
  const classTypes = Object.values(graph)
    .map((n) => n.class_type)
    .filter(Boolean)
    .sort()
  if (classTypes.length === 0) return undefined
  return [...new Set(classTypes)].join('+')
}

/**
 * Normalize raw PNG metadata into a typed NormalizedParams record.
 * Called from the Web Worker after `getFromPngBuffer`.
 */
export function normalizeParams(
  rawMeta: Record<string, string>,
  createdAtMs: number
): NormalizedParams {
  const promptRaw = rawMeta['prompt']
  if (!promptRaw) return emptyParams(createdAtMs)

  let graph: Record<string, PromptNode>
  try {
    graph = JSON.parse(promptRaw) as Record<string, PromptNode>
    // Basic structure validation
    if (typeof graph !== 'object' || graph === null || Array.isArray(graph)) {
      return emptyParams(createdAtMs)
    }
  } catch {
    return emptyParams(createdAtMs)
  }

  const samplerNode = findNodeByClassTypes(graph, [
    'KSampler',
    'KSamplerAdvanced',
    'KSamplerSelect'
  ])
  const checkpointNode = findNodeByClassTypes(graph, [
    'CheckpointLoaderSimple',
    'CheckpointLoader'
  ])
  const loraNodes = findAllNodesByClassTypes(graph, [
    'LoraLoader',
    'LoraLoaderModelOnly',
    'LoraTagLoader'
  ])
  const latentNode = findNodeByClassTypes(graph, [
    'EmptyLatentImage',
    'EmptySD3LatentImage',
    'EmptyHunyuanLatentVideo'
  ])

  const { positivePrompt, negativePrompt } = resolvePrompts(graph, samplerNode)

  const loras = loraNodes
    .map((n) => ({
      name: (
        n.inputs['lora_name'] ?? n.inputs['lora_tag']
      ) as string | undefined,
      weight: ((n.inputs['strength_model'] ?? n.inputs['strength']) ??
        1) as number
    }))
    .filter((l): l is { name: string; weight: number } => typeof l.name === 'string' && l.name.length > 0)

  return {
    model: typeof checkpointNode?.inputs['ckpt_name'] === 'string'
      ? checkpointNode.inputs['ckpt_name']
      : undefined,
    loras,
    cfg: typeof samplerNode?.inputs['cfg'] === 'number'
      ? samplerNode.inputs['cfg']
      : undefined,
    steps: typeof samplerNode?.inputs['steps'] === 'number'
      ? samplerNode.inputs['steps']
      : undefined,
    sampler: typeof samplerNode?.inputs['sampler_name'] === 'string'
      ? samplerNode.inputs['sampler_name']
      : undefined,
    scheduler: typeof samplerNode?.inputs['scheduler'] === 'string'
      ? samplerNode.inputs['scheduler']
      : undefined,
    seed: typeof samplerNode?.inputs['seed'] === 'number'
      ? samplerNode.inputs['seed']
      : undefined,
    positivePrompt,
    negativePrompt,
    width: typeof latentNode?.inputs['width'] === 'number'
      ? latentNode.inputs['width']
      : undefined,
    height: typeof latentNode?.inputs['height'] === 'number'
      ? latentNode.inputs['height']
      : undefined,
    timestamp: createdAtMs,
    workflowFingerprint: computeWorkflowFingerprint(graph)
  }
}
